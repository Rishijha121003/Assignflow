import io
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.correction import GradeCorrection, SubmissionHistory
from app.models.extension import DeadlineExtension
from app.models.notification import Notification, NotificationPreference
from app.models.reevaluation import ReevaluationRequest
from app.models.submission import Submission
from app.models.user import User


@pytest.fixture
def workflow_setup(db_engine):
    """Fixture to set up a unique teacher, enrolled student, and class."""
    unique_id = uuid.uuid4().hex[:8]
    with Session(db_engine) as session:
        teacher = User(
            email=f"workflow_teacher_{unique_id}@example.com",
            full_name="Prof. Workflow",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        student = User(
            email=f"workflow_student_{unique_id}@example.com",
            full_name="Workflow Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([teacher, student])
        session.commit()
        session.refresh(teacher)
        session.refresh(student)

        cls = Class(
            name=f"Workflow Class {unique_id}",
            join_code=uuid.uuid4().hex[:7].upper(),
            teacher_id=teacher.id,
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)

        enrollment = ClassEnrollment(class_id=cls.id, student_id=student.id)
        session.add(enrollment)
        session.commit()

        teacher_id = teacher.id
        teacher_email = teacher.email
        teacher_name = teacher.full_name
        student_id = student.id
        student_email = student.email
        student_name = student.full_name
        class_id = cls.id

    teacher_token = create_access_token({"sub": str(teacher_id), "role": "teacher", "email": teacher_email})
    student_token = create_access_token({"sub": str(student_id), "role": "student", "email": student_email})

    return {
        "teacher_id": teacher_id,
        "teacher_name": teacher_name,
        "teacher_headers": {"Authorization": f"Bearer {teacher_token}"},
        "student_id": student_id,
        "student_name": student_name,
        "student_headers": {"Authorization": f"Bearer {student_token}"},
        "class_id": class_id,
    }


def test_deadline_extension_and_late_submission_rule(client, db_engine, workflow_setup):
    """
    Feature 9: Configurable deadlines, grace periods, late rules, and per-student extensions.
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    student_id = workflow_setup["student_id"]
    class_id = workflow_setup["class_id"]

    past_due = datetime.now(timezone.utc) - timedelta(hours=2)
    with Session(db_engine) as session:
        assignment = Assignment(
            title="Late Rule Test",
            subject="Computer Science",
            due_date=past_due,
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=1,
            allow_late=False,
            grace_period_minutes=0,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

    # 1. Student attempts to submit past deadline without extension -> rejected 400
    file_bytes = b"%PDF-1.4 test pdf content"
    files = {"file": ("sol.pdf", file_bytes, "application/pdf")}
    resp = client.post(f"/api/assignments/{assignment_id}/submissions", files=files, headers=student_headers)
    assert resp.status_code == 400
    assert "Late submissions are not accepted" in resp.json()["detail"]

    # 2. Teacher grants extension to student
    new_dl = datetime.now(timezone.utc) + timedelta(days=2)
    ext_payload = {
        "student_id": student_id,
        "extended_deadline": new_dl.isoformat(),
        "reason": "Medical emergency extension",
    }
    resp = client.post(f"/api/assignments/{assignment_id}/extensions", json=ext_payload, headers=teacher_headers)
    assert resp.status_code == 200
    ext_data = resp.json()
    assert ext_data["student_id"] == student_id
    assert ext_data["reason"] == "Medical emergency extension"

    # Teacher lists extensions
    resp = client.get(f"/api/assignments/{assignment_id}/extensions", headers=teacher_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 3. Student now submits successfully within extended deadline
    files = {"file": ("sol.pdf", file_bytes, "application/pdf")}
    resp = client.post(f"/api/assignments/{assignment_id}/submissions", files=files, headers=student_headers)
    assert resp.status_code == 201
    assert resp.json()["is_late"] is False


def test_resubmission_flow_and_history(client, db_engine, workflow_setup):
    """
    Feature 10: Teacher-controlled resubmission and preserved submission history.
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    class_id = workflow_setup["class_id"]

    with Session(db_engine) as session:
        assignment = Assignment(
            title="Resubmission Assignment",
            subject="Algorithms",
            due_date=datetime.now(timezone.utc) + timedelta(days=5),
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=2,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

    # First submission attempt
    file_bytes_1 = b"%PDF-1.4 first attempt"
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("attempt1.pdf", file_bytes_1, "application/pdf")},
        data={"notes": "First attempt notes"},
        headers=student_headers,
    )
    assert resp.status_code == 201
    sub_id = resp.json()["id"]

    # Grade the first attempt
    resp = client.put(
        f"/api/assignments/{assignment_id}/submissions/{sub_id}/grade",
        json={"grade": 50.0, "feedback": "Needs major corrections"},
        headers=teacher_headers,
    )
    assert resp.status_code == 200

    # Student cannot resubmit without authorization -> 400
    file_bytes_2 = b"%PDF-1.4 second attempt"
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("attempt2.pdf", file_bytes_2, "application/pdf")},
        headers=student_headers,
    )
    assert resp.status_code == 400
    assert "Duplicate submissions are not permitted" in resp.json()["detail"]

    # Teacher authorizes resubmission
    resub_deadline = datetime.now(timezone.utc) + timedelta(days=3)
    resp = client.post(
        f"/api/submissions/{sub_id}/allow-resubmission",
        json={"resubmission_deadline": resub_deadline.isoformat(), "resubmission_note": "Fix section 2"},
        headers=teacher_headers,
    )
    assert resp.status_code == 200

    # Student resubmits
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("attempt2.pdf", file_bytes_2, "application/pdf")},
        data={"notes": "Second attempt corrected"},
        headers=student_headers,
    )
    assert resp.status_code in (200, 201)
    updated_sub = resp.json()
    assert updated_sub["attempt_number"] == 2
    assert updated_sub["file_name"] == "attempt2.pdf"
    assert updated_sub["status"] == "submitted"
    assert updated_sub["grade"] is None

    # Check submission history
    resp = client.get(f"/api/submissions/{sub_id}/history", headers=student_headers)
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["attempt_number"] == 1
    assert history[0]["file_name"] == "attempt1.pdf"


def test_authorized_grade_correction_audit_log(client, db_engine, workflow_setup):
    """
    Feature 11: Authorized grade corrections with previous/new marks, reason, actor, and timestamp.
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    class_id = workflow_setup["class_id"]

    with Session(db_engine) as session:
        assignment = Assignment(
            title="Grade Correction Test",
            subject="Database Systems",
            due_date=datetime.now(timezone.utc) + timedelta(days=2),
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=3,
            max_marks=100.0,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

    # Submit and initial grade
    file_bytes = b"%PDF-1.4 test content"
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("db.pdf", file_bytes, "application/pdf")},
        headers=student_headers,
    )
    assert resp.status_code == 201
    sub_id = resp.json()["id"]

    resp = client.put(
        f"/api/assignments/{assignment_id}/submissions/{sub_id}/grade",
        json={"grade": 70.0, "feedback": "Good effort"},
        headers=teacher_headers,
    )
    assert resp.status_code == 200

    # 1. Student attempts correction -> 403
    resp = client.put(
        f"/api/submissions/{sub_id}/correct-grade",
        json={"new_grade": 90.0, "reason": "Hacking grade"},
        headers=student_headers,
    )
    assert resp.status_code == 403

    # 2. Correction missing reason -> 400 or 422
    resp = client.put(
        f"/api/submissions/{sub_id}/correct-grade",
        json={"new_grade": 85.0, "reason": "  "},
        headers=teacher_headers,
    )
    assert resp.status_code in (400, 422)

    # 3. Successful grade correction with audit reason
    resp = client.put(
        f"/api/submissions/{sub_id}/correct-grade",
        json={"new_grade": 85.0, "reason": "Re-evaluated question 3 rubric discrepancy"},
        headers=teacher_headers,
    )
    assert resp.status_code == 200
    corr = resp.json()
    assert corr["previous_grade"] == 70.0
    assert corr["new_grade"] == 85.0
    assert corr["reason"] == "Re-evaluated question 3 rubric discrepancy"
    assert corr["corrected_by_name"] == workflow_setup["teacher_name"]

    # 4. View corrections history
    resp = client.get(f"/api/submissions/{sub_id}/corrections", headers=teacher_headers)
    assert resp.status_code == 200
    corrections = resp.json()
    assert len(corrections) == 1
    assert corrections[0]["new_grade"] == 85.0


def test_reevaluation_request_and_decision(client, db_engine, workflow_setup):
    """
    Feature 12: Student re-evaluation requests with reason, teacher decision, and recorded outcome.
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    class_id = workflow_setup["class_id"]

    with Session(db_engine) as session:
        assignment = Assignment(
            title="Re-evaluation Assessment",
            subject="Operating Systems",
            due_date=datetime.now(timezone.utc) + timedelta(days=2),
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=4,
            max_marks=100.0,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

    # Submit and grade
    file_bytes = b"%PDF-1.4 test os"
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("os.pdf", file_bytes, "application/pdf")},
        headers=student_headers,
    )
    sub_id = resp.json()["id"]

    client.put(
        f"/api/assignments/{assignment_id}/submissions/{sub_id}/grade",
        json={"grade": 65.0, "feedback": "Needs work"},
        headers=teacher_headers,
    )

    # 1. Requesting reevaluation before release -> 400
    resp = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Please check my Q2 answer"},
        headers=student_headers,
    )
    assert resp.status_code == 400
    assert "after grades are released" in resp.json()["detail"]

    # Release grade
    resp = client.post(f"/api/assignments/{assignment_id}/submissions/{sub_id}/release", headers=teacher_headers)
    assert resp.status_code == 200

    # 2. Student requests reevaluation
    resp = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Page 3 flowchart was overlooked in grading."},
        headers=student_headers,
    )
    assert resp.status_code == 200
    reeval = resp.json()
    assert reeval["status"] == "pending"
    assert reeval["reason"] == "Page 3 flowchart was overlooked in grading."
    reeval_id = reeval["id"]

    # 3. Duplicate pending request -> 400
    resp = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Another request"},
        headers=student_headers,
    )
    assert resp.status_code == 400

    # 4. Teacher lists requests
    resp = client.get(f"/api/assignments/{assignment_id}/reevaluations", headers=teacher_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 5. Teacher decides on re-evaluation: approve with new grade
    resp = client.put(
        f"/api/reevaluations/{reeval_id}/decision",
        json={"status": "approved", "teacher_notes": "Flowchart confirmed correct. +15 marks.", "new_grade": 80.0},
        headers=teacher_headers,
    )
    assert resp.status_code == 200
    decision = resp.json()
    assert decision["status"] == "approved"
    assert decision["current_grade"] == 80.0


def test_in_app_notifications_and_preferences(client, workflow_setup):
    """
    Feature 13: In-app notifications and preferences.
    """
    student_headers = workflow_setup["student_headers"]

    # 1. Get initial preferences
    resp = client.get("/api/notifications/preferences", headers=student_headers)
    assert resp.status_code == 200
    prefs = resp.json()
    assert prefs["in_app_enabled"] is True

    # 2. Update preferences
    resp = client.put(
        "/api/notifications/preferences",
        json={"email_enabled": False, "email_on_grade_released": True},
        headers=student_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["email_enabled"] is False

    # 3. Query notifications
    resp = client.get("/api/notifications", headers=student_headers)
    assert resp.status_code == 200
    notifs = resp.json()
    assert isinstance(notifs, list)

    # 4. Read all
    resp = client.put("/api/notifications/read-all", headers=student_headers)
    assert resp.status_code == 200


def test_notification_user_isolation_and_security(client, db_engine, workflow_setup):
    """
    Verify authenticated users can load notifications and update their own preferences,
    and that one user's preferences or notifications cannot be accessed or modified by another.
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    student_id = workflow_setup["student_id"]

    # 1. Unauthenticated requests are rejected
    assert client.get("/api/notifications").status_code == 401
    assert client.get("/api/notifications/preferences").status_code == 401
    assert client.put("/api/notifications/preferences", json={"in_app_enabled": False}).status_code == 401
    assert client.put("/api/notifications/read-all").status_code == 401
    assert client.put("/api/notifications/1/read").status_code == 401

    # 2. Preference isolation: Student updates preferences; Teacher preferences remain default
    resp = client.put(
        "/api/notifications/preferences",
        json={
            "in_app_enabled": False,
            "email_enabled": True,
            "email_on_grade_released": False,
            "email_on_deadline": False,
            "email_on_reevaluation": False,
        },
        headers=student_headers,
    )
    assert resp.status_code == 200
    student_prefs = resp.json()
    assert student_prefs["in_app_enabled"] is False
    assert student_prefs["email_enabled"] is True
    assert student_prefs["email_on_grade_released"] is False

    teacher_prefs = client.get("/api/notifications/preferences", headers=teacher_headers).json()
    assert teacher_prefs["in_app_enabled"] is True
    assert teacher_prefs["email_on_grade_released"] is True

    # 3. Notification visibility isolation
    with Session(db_engine) as session:
        notif = Notification(
            user_id=student_id,
            title="Private Student Alert",
            message="Your assignment submission was received.",
            type="submission_received",
            is_read=False,
        )
        session.add(notif)
        session.commit()
        session.refresh(notif)
        notif_id = notif.id

    # Student sees their notification
    student_notifs = client.get("/api/notifications", headers=student_headers).json()
    assert any(n["id"] == notif_id for n in student_notifs)

    # Teacher does NOT see student's notification
    teacher_notifs = client.get("/api/notifications", headers=teacher_headers).json()
    assert not any(n["id"] == notif_id for n in teacher_notifs)

    # Teacher cannot mark student's notification as read (returns 404)
    cross_read_resp = client.put(f"/api/notifications/{notif_id}/read", headers=teacher_headers)
    assert cross_read_resp.status_code == 404

    # Student can mark their own notification as read
    own_read_resp = client.put(f"/api/notifications/{notif_id}/read", headers=student_headers)
    assert own_read_resp.status_code == 200
    assert own_read_resp.json()["is_read"] is True


def test_resubmission_permission_persistence_and_expiry(client, db_engine, workflow_setup):
    """
    Regression test for resubmission permission persistence, visibility, deadline expiry,
    and handling of assignments where allow_late is False.
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    class_id = workflow_setup["class_id"]

    # 1. Create an assignment with due date in the past and allow_late=False
    with Session(db_engine) as session:
        assignment = Assignment(
            title="Past Strict Assignment",
            subject="Operating Systems",
            due_date=datetime.now(timezone.utc) - timedelta(days=2),
            allow_late=False,
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=1,
            max_marks=100.0,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

        # Insert an existing graded and released submission
        sub = Submission(
            assignment_id=assignment_id,
            student_id=workflow_setup["student_id"],
            file_path="uploads/test/initial.pdf",
            file_name="initial.pdf",
            file_size=1024,
            notes="Initial submission notes",
            submitted_at=datetime.now(timezone.utc) - timedelta(days=3),
            is_late=False,
            grade=70.0,
            feedback="Good effort but missing section 3",
            status="released",
            graded_at=datetime.now(timezone.utc) - timedelta(days=1),
            released_at=datetime.now(timezone.utc) - timedelta(days=1),
            attempt_number=1,
        )
        session.add(sub)
        session.commit()
        session.refresh(sub)
        sub_id = sub.id

    # 2. Before teacher authorizes, student cannot submit duplicate -> 400
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("unauthorized.pdf", b"%PDF-1.4 unauth", "application/pdf")},
        headers=student_headers,
    )
    assert resp.status_code == 400
    assert "Duplicate submissions are not permitted" in resp.json()["detail"]

    # 3. Teacher grants resubmission permission with a future deadline and teacher note
    resub_deadline = datetime.now(timezone.utc) + timedelta(days=2)
    teacher_note = "Please add section 3 benchmarks and resubmit."
    resp = client.post(
        f"/api/submissions/{sub_id}/allow-resubmission",
        json={"resubmission_deadline": resub_deadline.isoformat(), "resubmission_note": teacher_note},
        headers=teacher_headers,
    )
    assert resp.status_code == 200

    # 3b. Teacher accidentally calls authorize resubmission again (e.g. double click)
    resp2 = client.post(
        f"/api/submissions/{sub_id}/allow-resubmission",
        json={"resubmission_deadline": resub_deadline.isoformat(), "resubmission_note": teacher_note},
        headers=teacher_headers,
    )
    assert resp2.status_code == 200

    # Verify notification deduplication: student has exactly ONE resubmission_authorized notification
    notif_resp = client.get("/api/notifications", headers=student_headers)
    assert notif_resp.status_code == 200
    resub_notifs = [n for n in notif_resp.json() if n.get("type") == "resubmission_authorized"]
    assert len(resub_notifs) == 1
    assert "Resubmission Authorized" in resub_notifs[0]["title"]
    assert f"resubmit={assignment_id}" in resub_notifs[0]["link_url"]

    # 4. Persistence & Student Visibility:
    # A fresh student session calls /api/assignments/{id}/submissions/me
    resp = client.get(f"/api/assignments/{assignment_id}/submissions/me", headers=student_headers)
    assert resp.status_code == 200
    sub_me = resp.json()
    assert sub_me["resubmission_allowed"] is True
    assert sub_me["resubmission_note"] == teacher_note
    assert sub_me["attempt_number"] == 1
    assert sub_me["grade"] == 70.0  # Existing released grade preserved
    assert sub_me["status"] == "released"

    # Also visible in Student Dashboard /api/dashboard recently_submitted
    dash_resp = client.get("/api/dashboard", headers=student_headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    recent = next((r for r in dash_data.get("recently_submitted", []) if r["assignment_id"] == assignment_id), None)
    assert recent is not None
    assert recent["resubmission_allowed"] is True
    assert recent["resubmission_note"] == teacher_note
    assert recent["attempt_number"] == 1
    assert recent["grade"] == 70.0

    # Also visible in GET /api/submissions for student
    resp = client.get("/api/submissions", headers=student_headers)
    assert resp.status_code == 200
    subs_list = resp.json()
    my_sub_row = next((s for s in subs_list if s["id"] == sub_id), None)
    assert my_sub_row is not None
    assert my_sub_row["resubmission_allowed"] is True
    assert my_sub_row["resubmission_note"] == teacher_note
    assert my_sub_row["grade"] == 70.0

    # 5. Test expired resubmission deadline rejection:
    with Session(db_engine) as session:
        sub_db = session.query(Submission).filter(Submission.id == sub_id).first()
        sub_db.resubmission_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        session.commit()

    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("expired.pdf", b"%PDF-1.4 expired", "application/pdf")},
        headers=student_headers,
    )
    assert resp.status_code == 400
    assert "The resubmission deadline for this assignment has expired" in resp.json()["detail"]

    # 6. Reset deadline to future and successfully resubmit (even with allow_late=False):
    with Session(db_engine) as session:
        sub_db = session.query(Submission).filter(Submission.id == sub_id).first()
        sub_db.resubmission_deadline = datetime.now(timezone.utc) + timedelta(days=2)
        session.commit()

    revised_bytes = b"%PDF-1.4 revised attempt"
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("revised_v2.pdf", revised_bytes, "application/pdf")},
        data={"notes": "Added section 3 benchmarks"},
        headers=student_headers,
    )
    assert resp.status_code in (200, 201)
    new_sub = resp.json()
    assert new_sub["attempt_number"] == 2
    assert new_sub["file_name"] == "revised_v2.pdf"
    assert new_sub["status"] == "submitted"
    assert new_sub["grade"] is None
    assert new_sub["resubmission_allowed"] is False

    # 6b. Teacher reviews new attempt:
    # Teacher queries submissions for assignment: attempt 2 is visible with status 'submitted' ready for review
    t_resp = client.get(f"/api/assignments/{assignment_id}/submissions", headers=teacher_headers)
    assert t_resp.status_code == 200
    t_subs = t_resp.json()
    t_sub = next((s for s in t_subs if s["id"] == sub_id), None)
    assert t_sub is not None
    assert t_sub["attempt_number"] == 2
    assert t_sub["status"] == "submitted"
    assert t_sub["grade"] is None
    assert t_sub["file_name"] == "revised_v2.pdf"

    # 7. Check submission history has archived attempt 1:
    resp = client.get(f"/api/submissions/{sub_id}/history", headers=student_headers)
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["attempt_number"] == 1
    assert history[0]["file_name"] == "initial.pdf"
    assert history[0]["notes"] == "Initial submission notes"

    # 8. Denied duplicate resubmission:
    resp = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("unauthorized_v3.pdf", b"%PDF-1.4 unauth v3", "application/pdf")},
        headers=student_headers,
    )
    assert resp.status_code == 400
    assert "Duplicate submissions are not permitted" in resp.json()["detail"]


def test_submission_history_endpoint_and_authorization(client, db_engine, workflow_setup):
    """
    Regression Test:
    Verifies that the submission history endpoint matches the mounted FastAPI route
    /api/submissions/{id}/history and strictly enforces authorization boundaries:
    - 200 OK for submission owner
    - 403 Forbidden for unauthorized peer students
    - 404 Not Found for nonexistent submission ID
    - 200 OK for owning teacher
    - 403 Forbidden for non-owning teacher
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    class_id = workflow_setup["class_id"]

    # Create assignment and submission
    with Session(db_engine) as session:
        asgn = Assignment(
            title="History Route Test",
            subject="Operating Systems",
            due_date=datetime.now(timezone.utc) + timedelta(days=3),
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=1,
            max_marks=100.0,
        )
        session.add(asgn)
        session.commit()
        session.refresh(asgn)
        asgn_id = asgn.id

        # Create peer student
        peer_email = f"peer_{uuid.uuid4().hex[:8]}@example.com"
        peer_student = User(
            email=peer_email,
            full_name="Peer Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        # Create unrelated teacher
        other_teacher_email = f"other_t_{uuid.uuid4().hex[:8]}@example.com"
        other_teacher = User(
            email=other_teacher_email,
            full_name="Other Teacher",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        session.add_all([peer_student, other_teacher])
        session.commit()
        session.refresh(peer_student)
        session.refresh(other_teacher)

        peer_token = create_access_token({"sub": str(peer_student.id), "role": "student", "email": peer_email})
        peer_headers = {"Authorization": f"Bearer {peer_token}"}

        other_t_token = create_access_token({"sub": str(other_teacher.id), "role": "teacher", "email": other_teacher_email})
        other_t_headers = {"Authorization": f"Bearer {other_t_token}"}

    # Submit file
    res = client.post(
        f"/api/assignments/{asgn_id}/submissions",
        files={"file": ("history_test.pdf", b"%PDF-1.4 history content", "application/pdf")},
        headers=student_headers,
    )
    assert res.status_code == 201
    sub_id = res.json()["id"]

    # 1. Authorize resubmission and submit second attempt to populate history
    client.post(
        f"/api/submissions/{sub_id}/allow-resubmission",
        json={"resubmission_note": "Try again"},
        headers=teacher_headers,
    )
    res2 = client.post(
        f"/api/assignments/{asgn_id}/submissions",
        files={"file": ("history_v2.pdf", b"%PDF-1.4 attempt 2", "application/pdf")},
        headers=student_headers,
    )
    assert res2.status_code in (200, 201)

    # 2. Owner student calls actual mounted route: /api/submissions/{id}/history -> 200 OK
    hist_owner = client.get(f"/api/submissions/{sub_id}/history", headers=student_headers)
    assert hist_owner.status_code == 200
    owner_history = hist_owner.json()
    assert len(owner_history) >= 1
    assert owner_history[0]["attempt_number"] == 1
    assert owner_history[0]["file_name"] == "history_test.pdf"

    # 3. Peer student calls /api/submissions/{id}/history -> 403 Forbidden
    hist_peer = client.get(f"/api/submissions/{sub_id}/history", headers=peer_headers)
    assert hist_peer.status_code == 403

    # 4. Nonexistent submission -> 404 Not Found
    hist_404 = client.get("/api/submissions/999999/history", headers=student_headers)
    assert hist_404.status_code == 404

    # 5. Owning teacher calls /api/submissions/{id}/history -> 200 OK
    hist_teacher = client.get(f"/api/submissions/{sub_id}/history", headers=teacher_headers)
    assert hist_teacher.status_code == 200

    # 6. Unrelated teacher calls /api/submissions/{id}/history -> 403 Forbidden
    hist_other_t = client.get(f"/api/submissions/{sub_id}/history", headers=other_t_headers)
    assert hist_other_t.status_code == 403


def test_reevaluation_action_eligibility_and_boundaries(client, db_engine, workflow_setup):
    """
    Regression Test:
    Verifies that the re-evaluation request endpoint /api/submissions/{id}/request-reevaluation
    strictly enforces business eligibility and authorization rules:
    - 400 Bad Request if grades are unreleased
    - 403 Forbidden if called by teacher role (require_student)
    - 404 Not Found if called on another student's submission
    - 422 Unprocessable Content if reason is too short (< 5 chars)
    - 200 OK for valid student request on released grade
    - 400 Bad Request for duplicate request when already pending
    """
    teacher_headers = workflow_setup["teacher_headers"]
    student_headers = workflow_setup["student_headers"]
    class_id = workflow_setup["class_id"]

    with Session(db_engine) as session:
        asgn = Assignment(
            title="Reevaluation Boundary Test",
            subject="Algorithms",
            due_date=datetime.now(timezone.utc) + timedelta(days=3),
            class_id=class_id,
            created_by_id=workflow_setup["teacher_id"],
            unit=2,
            max_marks=100.0,
        )
        session.add(asgn)
        session.commit()
        session.refresh(asgn)
        asgn_id = asgn.id

        # Second student
        peer_email = f"peer2_{uuid.uuid4().hex[:8]}@example.com"
        peer2 = User(
            email=peer_email,
            full_name="Peer Student 2",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add(peer2)
        session.commit()
        session.refresh(peer2)
        peer2_token = create_access_token({"sub": str(peer2.id), "role": "student", "email": peer_email})
        peer2_headers = {"Authorization": f"Bearer {peer2_token}"}

    # Submit file
    res = client.post(
        f"/api/assignments/{asgn_id}/submissions",
        files={"file": ("algo.pdf", b"%PDF-1.4 algo solution", "application/pdf")},
        headers=student_headers,
    )
    assert res.status_code == 201
    sub_id = res.json()["id"]

    # 1. Unreleased submission (status='submitted') -> 400 Bad Request
    unreleased_res = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Please re-evaluate my question 1"},
        headers=student_headers,
    )
    assert unreleased_res.status_code == 400
    assert "after grades are released" in unreleased_res.json()["detail"]

    # Teacher grades without releasing (status='graded')
    grade_res = client.put(
        f"/api/assignments/{asgn_id}/submissions/{sub_id}/grade",
        json={"grade": 70.0, "feedback": "Good attempt"},
        headers=teacher_headers,
    )
    assert grade_res.status_code == 200

    # Draft graded but still unreleased -> 400 Bad Request
    graded_unreleased = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Please re-evaluate my question 1"},
        headers=student_headers,
    )
    assert graded_unreleased.status_code == 400
    assert "after grades are released" in graded_unreleased.json()["detail"]

    # 2. Teacher role calls student endpoint -> 403 Forbidden
    teacher_call = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Teacher cannot request reevaluation"},
        headers=teacher_headers,
    )
    assert teacher_call.status_code == 403

    # Teacher officially releases grade -> status='released'
    rel_res = client.post(f"/api/assignments/{asgn_id}/submissions/{sub_id}/release", headers=teacher_headers)
    assert rel_res.status_code == 200

    # 3. Peer student attempts to request re-evaluation on someone else's submission -> 404 Not Found
    peer_call = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Peer trying to reevaluate someone else's work"},
        headers=peer2_headers,
    )
    assert peer_call.status_code == 404

    # 4. Reason too short (< 5 chars) -> 422 Unprocessable Content
    short_res = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Bad"},
        headers=student_headers,
    )
    assert short_res.status_code == 422

    # 5. Valid student request on released grade -> 200 OK
    valid_res = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Question 3 proof steps on page 2 were marked incorrectly."},
        headers=student_headers,
    )
    assert valid_res.status_code == 200
    data = valid_res.json()
    assert data["status"] == "pending"
    assert data["submission_id"] == sub_id
    assert "Question 3 proof steps" in data["reason"]

    # 6. Duplicate request while active is pending -> 400 Bad Request
    dup_res = client.post(
        f"/api/submissions/{sub_id}/request-reevaluation",
        json={"reason": "Another duplicate request while first is pending"},
        headers=student_headers,
    )
    assert dup_res.status_code == 400
    assert "already pending review" in dup_res.json()["detail"]
