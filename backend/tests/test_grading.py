import io
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.submission import Submission
from app.models.user import User
from app.core.security import hash_password, create_access_token


def make_auth_headers(user: dict) -> dict:
    token = create_access_token({
        "sub": str(user["id"]),
        "role": user["role"],
        "email": user["email"],
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_setup(db_engine):
    """
    Sets up a full fixture environment:
    - Teacher 1 (owner)
    - Teacher 2 (unauthorized)
    - Student 1 (enrolled, submitted work)
    - Student 2 (enrolled, submitted work)
    - Student 3 (enrolled, submitted non-PDF work)
    - Class & Assignment (max_marks=100.0)
    """
    with Session(db_engine) as session:
        # Teacher 1
        t1_email = f"t1_{uuid.uuid4().hex[:6]}@example.com"
        t1 = User(
            email=t1_email,
            full_name="Prof. Charles Xavier",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        # Teacher 2
        t2_email = f"t2_{uuid.uuid4().hex[:6]}@example.com"
        t2 = User(
            email=t2_email,
            full_name="Prof. Erik Lehnsherr",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        # Student 1
        s1_email = f"s1_{uuid.uuid4().hex[:6]}@example.com"
        s1 = User(
            email=s1_email,
            full_name="Scott Summers",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        # Student 2
        s2_email = f"s2_{uuid.uuid4().hex[:6]}@example.com"
        s2 = User(
            email=s2_email,
            full_name="Jean Grey",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([t1, t2, s1, s2])
        session.commit()
        session.refresh(t1)
        session.refresh(t2)
        session.refresh(s1)
        session.refresh(s2)

        # Classroom
        classroom = Class(
            name="Mutant Genetics 101",
            join_code=uuid.uuid4().hex[:8].upper(),
            teacher_id=t1.id,
        )
        session.add(classroom)
        session.commit()
        session.refresh(classroom)

        # Enrollments
        e1 = ClassEnrollment(class_id=classroom.id, student_id=s1.id)
        e2 = ClassEnrollment(class_id=classroom.id, student_id=s2.id)
        session.add_all([e1, e2])
        session.commit()

        # Dummy PDF file on disk
        upload_dir = Path("uploads/test_submissions")
        upload_dir.mkdir(parents=True, exist_ok=True)
        pdf_path1 = upload_dir / f"test_sub_s1_{uuid.uuid4().hex[:6]}.pdf"
        pdf_path1.write_bytes(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")

        pdf_path2 = upload_dir / f"test_sub_s2_{uuid.uuid4().hex[:6]}.pdf"
        pdf_path2.write_bytes(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")

        docx_path = upload_dir / f"test_sub_s3_{uuid.uuid4().hex[:6]}.docx"
        docx_path.write_bytes(b"PK\x03\x04dummy_docx_content")

        # Assignment with max_marks = 100.0
        due = datetime.now(timezone.utc) + timedelta(days=5)
        assignment = Assignment(
            title="Cell Division Essay",
            subject="Biology",
            due_date=due,
            status="active",
            max_marks=100.0,
            created_by_id=t1.id,
            class_id=classroom.id,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)

        # Submission 1 (Student 1)
        sub1 = Submission(
            assignment_id=assignment.id,
            student_id=s1.id,
            file_path=str(pdf_path1),
            file_name="scott_essay.pdf",
            file_size=len(pdf_path1.read_bytes()),
            notes="Please review my section 2",
            status="submitted",
        )
        # Submission 2 (Student 2)
        sub2 = Submission(
            assignment_id=assignment.id,
            student_id=s2.id,
            file_path=str(pdf_path2),
            file_name="jean_essay.pdf",
            file_size=len(pdf_path2.read_bytes()),
            notes="Completed on time",
            status="submitted",
        )
        session.add_all([sub1, sub2])
        session.commit()
        session.refresh(sub1)
        session.refresh(sub2)

        return {
            "t1": {"id": t1.id, "email": t1.email, "role": "teacher"},
            "t2": {"id": t2.id, "email": t2.email, "role": "teacher"},
            "s1": {"id": s1.id, "email": s1.email, "role": "student"},
            "s2": {"id": s2.id, "email": s2.email, "role": "student"},
            "assignment_id": assignment.id,
            "sub1_id": sub1.id,
            "sub2_id": sub2.id,
            "docx_path": str(docx_path),
        }


# ============================================================================
# 1. Access Control & Authorization Tests
# ============================================================================

def test_teacher_ownership_enforced_on_grading(client, test_setup):
    """Unauthorized teacher receives HTTP 403 when trying to grade an assignment they do not own."""
    t2_headers = make_auth_headers(test_setup["t2"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 90.0, "feedback": "Great work"},
        headers=t2_headers,
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_student_cannot_grade_submission(client, test_setup):
    """Student receives HTTP 403 Forbidden when calling the grade endpoint."""
    s1_headers = make_auth_headers(test_setup["s1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 100.0},
        headers=s1_headers,
    )
    assert res.status_code == 403


def test_student_cannot_preview_other_student_submission(client, test_setup):
    """Student 1 cannot preview Student 2's submission (returns 403)."""
    s1_headers = make_auth_headers(test_setup["s1"])
    as_id = test_setup["assignment_id"]
    sub2_id = test_setup["sub2_id"]

    res = client.get(
        f"/api/assignments/{as_id}/submissions/{sub2_id}/preview",
        headers=s1_headers,
    )
    assert res.status_code == 403
    assert "cannot preview another student's submission" in res.json()["detail"]


def test_student_cannot_download_other_student_submission(client, test_setup):
    """Student 1 cannot download Student 2's submission (returns 403)."""
    s1_headers = make_auth_headers(test_setup["s1"])
    as_id = test_setup["assignment_id"]
    sub2_id = test_setup["sub2_id"]

    res = client.get(
        f"/api/assignments/{as_id}/submissions/{sub2_id}/download",
        headers=s1_headers,
    )
    assert res.status_code == 403


# ============================================================================
# 2. Mark Validation & Boundary Checks
# ============================================================================

def test_grade_negative_rejected(client, test_setup):
    """Negative grade is rejected with HTTP 422."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": -5.0},
        headers=t1_headers,
    )
    assert res.status_code == 422


def test_grade_exceeds_max_marks_rejected(client, test_setup):
    """Grade greater than assignment max_marks (100.0) is rejected with HTTP 422."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 105.0},
        headers=t1_headers,
    )
    assert res.status_code == 422
    assert "cannot exceed assignment maximum marks" in res.json()["detail"]


def test_grade_zero_and_exact_maximum(client, test_setup):
    """Grade 0.0 and grade 100.0 (exact maximum) are both accepted."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]
    sub2_id = test_setup["sub2_id"]

    # Grade 0.0
    res0 = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 0.0, "feedback": "Needs complete revision."},
        headers=t1_headers,
    )
    assert res0.status_code == 200
    assert res0.json()["grade"] == 0.0
    assert res0.json()["status"] == "graded"

    # Grade 100.0
    res100 = client.put(
        f"/api/assignments/{as_id}/submissions/{sub2_id}/grade",
        json={"grade": 100.0, "feedback": "Flawless submission."},
        headers=t1_headers,
    )
    assert res100.status_code == 200
    assert res100.json()["grade"] == 100.0
    assert res100.json()["status"] == "graded"


def test_grade_decimal_precision(client, test_setup):
    """Grade with decimal precision (e.g. 87.75) is saved and returned accurately."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 87.75, "feedback": "Good attempt on question 3."},
        headers=t1_headers,
    )
    assert res.status_code == 200
    assert res.json()["grade"] == 87.75


# ============================================================================
# 3. Privacy Wall & Grade Release Workflow
# ============================================================================

def test_draft_grade_privacy_wall(client, test_setup):
    """
    Teacher saves draft grade -> status becomes 'graded'.
    Student checks own submission -> grade and feedback are strictly MASKED (None) and status is 'submitted'.
    """
    t1_headers = make_auth_headers(test_setup["t1"])
    s1_headers = make_auth_headers(test_setup["s1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    # 1. Teacher grades as draft
    grade_res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 92.5, "feedback": "Confidential draft feedback."},
        headers=t1_headers,
    )
    assert grade_res.status_code == 200
    assert grade_res.json()["status"] == "graded"
    assert grade_res.json()["grade"] == 92.5

    # 2. Student checks own submission via /api/assignments/{id}/submissions/me
    student_res = client.get(
        f"/api/assignments/{as_id}/submissions/me",
        headers=s1_headers,
    )
    assert student_res.status_code == 200
    sub_data = student_res.json()
    assert sub_data["grade"] is None, "Draft grade leaked to student!"
    assert sub_data["feedback"] is None, "Draft feedback leaked to student!"
    assert sub_data["status"] == "submitted", "Status should be masked as 'submitted' for student!"

    # 3. Student checks submissions list via /api/submissions
    list_res = client.get("/api/submissions", headers=s1_headers)
    assert list_res.status_code == 200
    user_subs = list_res.json()
    matching = next((s for s in user_subs if s["id"] == sub1_id), None)
    assert matching is not None
    assert matching["grade"] is None
    assert matching["feedback"] is None
    assert matching["status"] == "submitted"


def test_single_release_and_partial_release(client, test_setup):
    """
    Teacher grades Student 1 and Student 2.
    Teacher releases ONLY Student 1.
    Student 1 sees grade and feedback; Student 2 continues seeing 'submitted' and grade=None.
    """
    t1_headers = make_auth_headers(test_setup["t1"])
    s1_headers = make_auth_headers(test_setup["s1"])
    s2_headers = make_auth_headers(test_setup["s2"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]
    sub2_id = test_setup["sub2_id"]

    # Grade both students
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 85.0, "feedback": "Well written."},
        headers=t1_headers,
    )
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub2_id}/grade",
        json={"grade": 78.0, "feedback": "Good effort."},
        headers=t1_headers,
    )

    # Release ONLY sub1
    rel_res = client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t1_headers,
    )
    assert rel_res.status_code == 200
    assert rel_res.json()["status"] == "released"
    assert rel_res.json()["released_at"] is not None

    # Student 1 sees released score
    s1_res = client.get(f"/api/assignments/{as_id}/submissions/me", headers=s1_headers)
    assert s1_res.status_code == 200
    assert s1_res.json()["grade"] == 85.0
    assert s1_res.json()["feedback"] == "Well written."
    assert s1_res.json()["status"] == "released"

    # Student 2 grade is STILL masked
    s2_res = client.get(f"/api/assignments/{as_id}/submissions/me", headers=s2_headers)
    assert s2_res.status_code == 200
    assert s2_res.json()["grade"] is None
    assert s2_res.json()["feedback"] is None
    assert s2_res.json()["status"] == "submitted"


def test_cannot_release_ungraded_submission(client, test_setup):
    """Attempting to release a submission with no grade returns HTTP 400 Bad Request."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub2_id = test_setup["sub2_id"]

    # sub2 has not been graded yet
    res = client.post(
        f"/api/assignments/{as_id}/submissions/{sub2_id}/release",
        headers=t1_headers,
    )
    assert res.status_code == 400
    assert "Cannot release un-graded submission" in res.json()["detail"]


def test_repeated_release_is_idempotent(client, test_setup):
    """Calling release on an already released submission succeeds safely without error (200 OK)."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    # Grade & release
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 95.0},
        headers=t1_headers,
    )
    first_rel = client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t1_headers,
    )
    assert first_rel.status_code == 200

    # Repeat release
    second_rel = client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t1_headers,
    )
    assert second_rel.status_code == 200
    assert second_rel.json()["status"] == "released"


def test_bulk_release_grades(client, test_setup):
    """Bulk release releases all graded submissions; ungraded submissions remain 'submitted'."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]
    sub2_id = test_setup["sub2_id"]

    # Grade only sub1; leave sub2 ungraded
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 91.0, "feedback": "Outstanding work."},
        headers=t1_headers,
    )

    # Call bulk release
    bulk_res = client.post(
        f"/api/assignments/{as_id}/release-grades",
        headers=t1_headers,
    )
    assert bulk_res.status_code == 200
    assert bulk_res.json()["released_count"] == 1

    # Check teacher submissions roster
    roster_res = client.get(f"/api/assignments/{as_id}/submissions", headers=t1_headers)
    assert roster_res.status_code == 200
    roster = roster_res.json()
    sub1_data = next(s for s in roster if s["id"] == sub1_id)
    sub2_data = next(s for s in roster if s["id"] == sub2_id)
    assert sub1_data["status"] == "released"
    assert sub2_data["status"] == "submitted"


# ============================================================================
# 4. In-Browser PDF Preview & Non-PDF Fallback Tests
# ============================================================================

def test_pdf_preview_headers(client, test_setup):
    """PDF submission returns Content-Type application/pdf and Content-Disposition inline."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    res = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/preview",
        headers=t1_headers,
    )
    assert res.status_code == 200
    assert "application/pdf" in res.headers["content-type"]
    assert "inline" in res.headers["content-disposition"]


def test_non_pdf_preview_fallback(client, test_setup, db_engine):
    """Previewing an unsupported format returns 415; corrupted DOCX returns 422 with guidance."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    upload_dir = Path("uploads/test_submissions")

    # 1. Test unsupported file format (e.g. .zip) returns 415
    zip_path = upload_dir / f"test_sub_unsupported_{uuid.uuid4().hex[:6]}.zip"
    zip_path.write_bytes(b"PK\x05\x06" + b"\x00" * 18)

    with Session(db_engine) as session:
        dummy_student1 = User(
            email=f"dummy1_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Dummy Student 1",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        dummy_student2 = User(
            email=f"dummy2_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Dummy Student 2",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([dummy_student1, dummy_student2])
        session.commit()
        session.refresh(dummy_student1)
        session.refresh(dummy_student2)

        sub_zip = Submission(
            assignment_id=as_id,
            student_id=dummy_student1.id,
            file_path=str(zip_path),
            file_name="project.zip",
            file_size=22,
            status="submitted",
        )
        # Corrupted DOCX submission (PK\x03\x04dummy_docx_content)
        sub_corrupt_docx = Submission(
            assignment_id=as_id,
            student_id=dummy_student2.id,
            file_path=test_setup["docx_path"],
            file_name="notes.docx",
            file_size=500,
            status="submitted",
        )
        session.add_all([sub_zip, sub_corrupt_docx])
        session.commit()
        session.refresh(sub_zip)
        session.refresh(sub_corrupt_docx)
        sub_zip_id = sub_zip.id
        sub_docx_id = sub_corrupt_docx.id

    # Unsupported format (.zip) returns 415
    res_zip = client.get(
        f"/api/assignments/{as_id}/submissions/{sub_zip_id}/preview",
        headers=t1_headers,
    )
    assert res_zip.status_code == 415
    assert "In-browser preview is available for PDF and DOCX files only" in res_zip.json()["detail"]

    # Corrupted DOCX returns 422
    res_docx = client.get(
        f"/api/assignments/{as_id}/submissions/{sub_docx_id}/preview",
        headers=t1_headers,
    )
    assert res_docx.status_code == 422
    assert "The DOCX file is corrupted" in res_docx.json()["detail"]


# ============================================================================
# 5. Dashboard Metrics Accuracy
# ============================================================================

def test_dashboard_metrics_reflect_grading(client, test_setup):
    """Teacher dashboard reflects actual count of graded and pending submissions."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    # Initial state: 0 graded
    res1 = client.get("/api/dashboard", headers=t1_headers)
    assert res1.status_code == 200
    assert res1.json()["submissions_overview"]["graded"] == 0

    # Grade 1 submission
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 90.0},
        headers=t1_headers,
    )

    # Updated state: 1 graded
    res2 = client.get("/api/dashboard", headers=t1_headers)
    assert res2.status_code == 200
    assert res2.json()["submissions_overview"]["graded"] == 1
    assert res2.json()["submissions_overview"]["draft"] == 1
    assert res2.json()["submissions_overview"]["released"] == 0


# ============================================================================
# 6. Phase 3: Student Results UI & Dashboard Integration Tests
# ============================================================================

def test_teacher_dashboard_distinguishes_ungraded_draft_and_released(client, test_setup):
    """Teacher dashboard metrics and submissions_overview correctly distinguish ungraded, draft, and released."""
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]
    sub2_id = test_setup["sub2_id"]

    # Initial state: 2 submissions total, 2 ungraded, 0 draft, 0 released
    res1 = client.get("/api/dashboard", headers=t1_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["metrics"]["pending_grading"] == 2
    assert data1["metrics"]["graded_draft"] == 0
    assert data1["metrics"]["released"] == 0
    assert data1["submissions_overview"]["ungraded"] == 2
    assert data1["submissions_overview"]["draft"] == 0
    assert data1["submissions_overview"]["released"] == 0

    # Grade sub1 as draft (do NOT release)
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 88.0, "feedback": "Solid draft."},
        headers=t1_headers,
    )

    # State: 1 ungraded, 1 draft, 0 released
    res2 = client.get("/api/dashboard", headers=t1_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["metrics"]["pending_grading"] == 1
    assert data2["metrics"]["graded_draft"] == 1
    assert data2["metrics"]["released"] == 0
    assert data2["submissions_overview"]["ungraded"] == 1
    assert data2["submissions_overview"]["draft"] == 1
    assert data2["submissions_overview"]["released"] == 0

    # Release sub1
    client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t1_headers,
    )

    # State: 1 ungraded, 0 draft, 1 released
    res3 = client.get("/api/dashboard", headers=t1_headers)
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["metrics"]["pending_grading"] == 1
    assert data3["metrics"]["graded_draft"] == 0
    assert data3["metrics"]["released"] == 1
    assert data3["submissions_overview"]["ungraded"] == 1
    assert data3["submissions_overview"]["draft"] == 0
    assert data3["submissions_overview"]["released"] == 1


def test_student_dashboard_metrics_and_pending_review_distinction(client, test_setup):
    """Student dashboard accurately reports pending_review and never exposes draft grades before release."""
    s1_headers = make_auth_headers(test_setup["s1"])
    t1_headers = make_auth_headers(test_setup["t1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    # 1. Before grading: student dashboard shows pending_review == 1, released == 0
    res1 = client.get("/api/dashboard", headers=s1_headers)
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["metrics"]["submitted"] >= 1
    assert d1["metrics"]["pending_review"] >= 1
    assert d1["metrics"]["released"] == 0
    recent1 = d1["recently_submitted"][0]
    assert recent1["status"] == "Pending Review"
    assert recent1["grade"] is None
    assert recent1["feedback"] is None

    # 2. Teacher saves draft grade (not released)
    client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 92.5, "feedback": "Great explanation."},
        headers=t1_headers,
    )

    # Student dashboard STILL shows Pending Review and grade is None
    res2 = client.get("/api/dashboard", headers=s1_headers)
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["metrics"]["pending_review"] >= 1
    assert d2["metrics"]["released"] == 0
    recent2 = d2["recently_submitted"][0]
    assert recent2["status"] == "Pending Review"
    assert recent2["grade"] is None
    assert recent2["feedback"] is None

    # 3. Teacher explicitly releases grade
    client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t1_headers,
    )

    # Student dashboard now reports released == 1, pending_review == 0, with score visible
    res3 = client.get("/api/dashboard", headers=s1_headers)
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["metrics"]["released"] == 1
    recent3 = d3["recently_submitted"][0]
    assert recent3["status"] == "Released"
    assert recent3["grade"] == 92.5
    assert recent3["feedback"] == "Great explanation."


def test_student_cannot_access_other_student_submission_file(client, test_setup):
    """Enforce strict isolation: Student 2 cannot preview or download Student 1's submission."""
    s2_headers = make_auth_headers(test_setup["s2"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    # Student 2 tries to download Student 1's submission
    dl_res = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/download",
        headers=s2_headers,
    )
    assert dl_res.status_code == 403
    assert "Access denied" in dl_res.json()["detail"]

    # Student 2 tries to preview Student 1's submission
    prev_res = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/preview",
        headers=s2_headers,
    )
    assert prev_res.status_code == 403
    assert "Access denied" in prev_res.json()["detail"]


def test_preview_download_permissions_and_auth(client, test_setup):
    """Verify preview/download permissions, inline vs attachment disposition, and auth enforcement."""
    t1_headers = make_auth_headers(test_setup["t1"])
    t2_headers = make_auth_headers(test_setup["t2"])
    s1_headers = make_auth_headers(test_setup["s1"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]

    # 1. Owning Teacher preview (PDF -> inline)
    res_t1_prev = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/preview",
        headers=t1_headers,
    )
    assert res_t1_prev.status_code == 200
    assert "application/pdf" in res_t1_prev.headers.get("content-type", "")
    assert "inline" in res_t1_prev.headers.get("content-disposition", "")

    # 2. Owning Teacher download (attachment)
    res_t1_dl = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/download",
        headers=t1_headers,
    )
    assert res_t1_dl.status_code == 200
    assert "attachment" in res_t1_dl.headers.get("content-disposition", "")

    # 3. Submitting Student preview (PDF -> inline)
    res_s1_prev = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/preview",
        headers=s1_headers,
    )
    assert res_s1_prev.status_code == 200
    assert "application/pdf" in res_s1_prev.headers.get("content-type", "")
    assert "inline" in res_s1_prev.headers.get("content-disposition", "")

    # 4. Submitting Student download (attachment)
    res_s1_dl = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/download",
        headers=s1_headers,
    )
    assert res_s1_dl.status_code == 200
    assert "attachment" in res_s1_dl.headers.get("content-disposition", "")

    # 5. Non-owning Teacher preview denied (403)
    res_t2_prev = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/preview",
        headers=t2_headers,
    )
    assert res_t2_prev.status_code == 403

    # 6. Non-owning Teacher download denied (403)
    res_t2_dl = client.get(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/download",
        headers=t2_headers,
    )
    assert res_t2_dl.status_code == 403

    # 7. Unauthenticated preview rejected (401)
    res_anon_prev = client.get(f"/api/assignments/{as_id}/submissions/{sub1_id}/preview")
    assert res_anon_prev.status_code == 401

    # 8. Unauthenticated download rejected (401)
    res_anon_dl = client.get(f"/api/assignments/{as_id}/submissions/{sub1_id}/download")
    assert res_anon_dl.status_code == 401

    # 9. Non-existent submission preview returns 404
    res_404_prev = client.get(
        f"/api/assignments/{as_id}/submissions/999999/preview",
        headers=t1_headers,
    )
    assert res_404_prev.status_code == 404

    # 10. Non-existent submission download returns 404
    res_404_dl = client.get(
        f"/api/assignments/{as_id}/submissions/999999/download",
        headers=t1_headers,
    )
    assert res_404_dl.status_code == 404


def test_speedgrader_release_grade_to_student_workflow(client, test_setup, db_engine):
    """
    Complete regression test for SpeedGrader single grade release:
    1. Validates graded draft with 89.7 marks and feedback.
    2. Student cannot view draft marks/feedback prior to release (privacy wall).
    3. Unauthorized teacher and students are rejected with 403.
    4. Teacher releases grade: status becomes 'released' and released_at timestamp is recorded.
    5. Student can now immediately see released score and feedback.
    6. Releasing an ungraded submission is rejected with 400.
    """
    t1_headers = make_auth_headers(test_setup["t1"])
    t2_headers = make_auth_headers(test_setup["t2"])
    s1_headers = make_auth_headers(test_setup["s1"])
    s2_headers = make_auth_headers(test_setup["s2"])
    as_id = test_setup["assignment_id"]
    sub1_id = test_setup["sub1_id"]
    sub2_id = test_setup["sub2_id"]

    # 1. Save draft grade 89.7 for sub1
    save_draft_res = client.put(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/grade",
        json={"grade": 89.7, "feedback": "Solid understanding of the mechanism."},
        headers=t1_headers,
    )
    assert save_draft_res.status_code == 200
    assert save_draft_res.json()["status"] == "graded"
    assert save_draft_res.json()["grade"] == 89.7
    assert save_draft_res.json()["released_at"] is None

    # 2. Student 1 checks submission - score must be hidden
    s1_pre = client.get(f"/api/assignments/{as_id}/submissions/me", headers=s1_headers)
    assert s1_pre.status_code == 200
    assert s1_pre.json()["status"] == "submitted"
    assert s1_pre.json()["grade"] is None
    assert s1_pre.json()["feedback"] is None

    # 3. Authorization checks on release endpoint
    # Student cannot release grade
    s1_rel = client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=s1_headers,
    )
    assert s1_rel.status_code == 403

    # Non-owning teacher cannot release grade
    t2_rel = client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t2_headers,
    )
    assert t2_rel.status_code == 403

    # Unauthenticated cannot release grade
    anon_rel = client.post(f"/api/assignments/{as_id}/submissions/{sub1_id}/release")
    assert anon_rel.status_code == 401

    # Cannot release un-graded submission (sub2 is ungraded)
    ungraded_rel = client.post(
        f"/api/assignments/{as_id}/submissions/{sub2_id}/release",
        headers=t1_headers,
    )
    assert ungraded_rel.status_code == 400
    assert "Cannot release un-graded submission" in ungraded_rel.json()["detail"]

    # 4. Teacher 1 releases sub1 grade
    rel_res = client.post(
        f"/api/assignments/{as_id}/submissions/{sub1_id}/release",
        headers=t1_headers,
    )
    assert rel_res.status_code == 200
    rel_data = rel_res.json()
    assert rel_data["status"] == "released"
    assert rel_data["grade"] == 89.7
    assert rel_data["feedback"] == "Solid understanding of the mechanism."
    assert rel_data["released_at"] is not None

    # 5. Student 1 now sees score and feedback
    s1_post = client.get(f"/api/assignments/{as_id}/submissions/me", headers=s1_headers)
    assert s1_post.status_code == 200
    assert s1_post.json()["status"] == "released"
    assert s1_post.json()["grade"] == 89.7
    assert s1_post.json()["feedback"] == "Solid understanding of the mechanism."
    assert s1_post.json()["released_at"] is not None
