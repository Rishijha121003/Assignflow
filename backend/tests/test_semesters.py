import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.classroom import Class, ClassEnrollment
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.models.semester import Semester
from app.core.security import hash_password, create_access_token


@pytest.fixture
def other_teacher_headers(db_engine):
    with Session(db_engine) as session:
        email = f"other_teacher_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            email=email,
            full_name="Prof. Other Teacher",
            hashed_password=hash_password("TeacherPassword123!"),
            role="teacher",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id
    token = create_access_token({"sub": str(user_id), "role": "teacher", "email": email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_student(db_engine):
    with Session(db_engine) as session:
        email = f"second_student_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            email=email,
            full_name="Peter Parker",
            hashed_password=hash_password("StudentPassword123!"),
            role="student",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id
        full_name = user.full_name
    token = create_access_token({"sub": str(user_id), "role": "student", "email": email})
    return {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "headers": {"Authorization": f"Bearer {token}"},
    }


def test_create_semester_teacher_success(client, teacher_headers):
    payload = {
        "name": "Semester 5 (Jul - Dec 2024)",
        "academic_year": "2024 - 2025",
        "start_date": "2024-07-01",
        "end_date": "2024-12-31",
        "status": "active",
        "program": "B.Tech CSE",
    }
    response = client.post("/api/semesters", json=payload, headers=teacher_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["academic_year"] == payload["academic_year"]
    assert data["start_date"] == "2024-07-01"
    assert data["end_date"] == "2024-12-31"
    assert data["status"] == "active"
    assert data["program"] == "B.Tech CSE"
    assert "id" in data


def test_create_semester_student_forbidden(client, student_headers):
    payload = {
        "name": "Semester 5",
        "academic_year": "2024 - 2025",
        "start_date": "2024-07-01",
        "end_date": "2024-12-31",
    }
    response = client.post("/api/semesters", json=payload, headers=student_headers)
    assert response.status_code == 403


def test_create_semester_invalid_dates(client, teacher_headers):
    # start_date > end_date
    payload = {
        "name": "Invalid Semester",
        "academic_year": "2024 - 2025",
        "start_date": "2024-12-31",
        "end_date": "2024-07-01",
    }
    response = client.post("/api/semesters", json=payload, headers=teacher_headers)
    assert response.status_code == 422


def test_create_semester_empty_name(client, teacher_headers):
    payload = {
        "name": "   ",
        "academic_year": "2024 - 2025",
        "start_date": "2024-07-01",
        "end_date": "2024-12-31",
    }
    response = client.post("/api/semesters", json=payload, headers=teacher_headers)
    assert response.status_code == 422


def test_list_semesters_teacher(client, teacher_headers):
    res = client.get("/api/semesters", headers=teacher_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_get_and_update_semester(client, teacher_headers, other_teacher_headers):
    # Create semester
    payload = {
        "name": "Semester To Update",
        "academic_year": "2025 - 2026",
        "start_date": "2025-01-01",
        "end_date": "2025-06-30",
        "status": "active",
    }
    create_res = client.post("/api/semesters", json=payload, headers=teacher_headers)
    assert create_res.status_code == 201
    sem_id = create_res.json()["id"]

    # Get by ID
    get_res = client.get(f"/api/semesters/{sem_id}", headers=teacher_headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Semester To Update"

    # Other teacher cannot update
    forbidden_update = client.put(f"/api/semesters/{sem_id}", json={"name": "Hacked"}, headers=other_teacher_headers)
    assert forbidden_update.status_code == 403

    # Owning teacher can update
    update_res = client.put(
        f"/api/semesters/{sem_id}",
        json={"name": "Semester 6 (Jan - Jun 2025)", "status": "completed"},
        headers=teacher_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Semester 6 (Jan - Jun 2025)"
    assert update_res.json()["status"] == "completed"


def test_semester_safe_deletion_and_archival(client, teacher_headers, teacher_user, student_user, db_engine):
    # Create semester
    create_res = client.post(
        "/api/semesters",
        json={
            "name": "Semester with Records",
            "academic_year": "2024 - 2025",
            "start_date": "2024-01-01",
            "end_date": "2024-06-30",
        },
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    sem_id = create_res.json()["id"]

    # Add subject to this semester
    cls_res = client.post(
        f"/api/semesters/{sem_id}/subjects",
        json={"name": "DBMS", "description": "Database Systems"},
        headers=teacher_headers,
    )
    assert cls_res.status_code == 201
    class_id = cls_res.json()["id"]

    # Seed an assignment and submission
    with Session(db_engine) as session:
        # Enroll student
        enrollment = ClassEnrollment(class_id=class_id, student_id=student_user["id"])
        session.add(enrollment)

        assign = Assignment(
            title="ER Diagram Design",
            subject="DBMS",
            due_date=datetime.now(timezone.utc) + timedelta(days=5),
            status="active",
            class_id=class_id,
            semester_id=sem_id,
            created_by_id=teacher_user["id"],
        )
        session.add(assign)
        session.commit()
        session.refresh(assign)

        sub = Submission(
            assignment_id=assign.id,
            student_id=student_user["id"],
            file_path="/tmp/fake_sub.pdf",
            file_name="fake_sub.pdf",
            file_size=1024,
            status="submitted",
        )
        session.add(sub)
        session.commit()

    # Attempt delete should fail because submissions exist!
    del_res = client.delete(f"/api/semesters/{sem_id}", headers=teacher_headers)
    assert del_res.status_code == 400
    assert "Cannot delete semester" in del_res.json()["detail"]
    assert "archive" in del_res.json()["detail"]

    # Archive should succeed
    archive_res = client.post(f"/api/semesters/{sem_id}/archive", headers=teacher_headers)
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"


def test_semester_dashboard_and_performance(client, teacher_headers, teacher_user, student_headers, student_user, db_engine):
    # Create semester
    create_res = client.post(
        "/api/semesters",
        json={
            "name": "Semester 5 (Jul - Dec 2024)",
            "academic_year": "2024 - 2025",
            "start_date": "2024-07-01",
            "end_date": "2024-12-31",
            "program": "B.Tech CSE",
        },
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    sem_id = create_res.json()["id"]

    # Create subjects
    sub1_res = client.post(
        f"/api/semesters/{sem_id}/subjects",
        json={"name": "DBMS", "description": "Database Management Systems"},
        headers=teacher_headers,
    )
    assert sub1_res.status_code == 201
    sub1_id = sub1_res.json()["id"]

    sub2_res = client.post(
        f"/api/semesters/{sem_id}/subjects",
        json={"name": "Operating Systems", "description": "Systems"},
        headers=teacher_headers,
    )
    assert sub2_res.status_code == 201
    sub2_id = sub2_res.json()["id"]

    # Seed enrollment and assignments
    with Session(db_engine) as session:
        session.add(ClassEnrollment(class_id=sub1_id, student_id=student_user["id"]))
        session.add(ClassEnrollment(class_id=sub2_id, student_id=student_user["id"]))

        as1 = Assignment(
            title="ER Modeling",
            subject="DBMS",
            due_date=datetime.now(timezone.utc) + timedelta(days=3),
            status="active",
            class_id=sub1_id,
            semester_id=sem_id,
            max_marks=100.0,
            created_by_id=teacher_user["id"],
        )
        as2 = Assignment(
            title="Process Scheduling",
            subject="Operating Systems",
            due_date=datetime.now(timezone.utc) + timedelta(days=6),
            status="active",
            class_id=sub2_id,
            semester_id=sem_id,
            max_marks=100.0,
            created_by_id=teacher_user["id"],
        )
        session.add(as1)
        session.add(as2)
        session.commit()
        session.refresh(as1)
        session.refresh(as2)

        # Seed 1 submission with draft grade
        s1 = Submission(
            assignment_id=as1.id,
            student_id=student_user["id"],
            file_path="/tmp/sub1.pdf",
            file_name="sub1.pdf",
            file_size=2048,
            grade=88.0,
            status="graded",  # DRAFT grade!
        )
        session.add(s1)
        session.commit()
        as1_id = as1.id

    # 1. Check Semester Dashboard
    dash_res = client.get(f"/api/semesters/{sem_id}/dashboard", headers=teacher_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["selected_semester"]["id"] == sem_id
    assert dash_data["statistics"]["subject_count"] == 2
    assert dash_data["statistics"]["assignment_count"] == 2
    assert dash_data["statistics"]["submission_count"] == 1
    assert len(dash_data["subjects"]) == 2
    assert len(dash_data["upcoming_deadlines"]) >= 1

    # 2. Check Subject Performance Grade Privacy
    # Student requests subject performance: draft grade must NOT be shown as average score
    student_perf = client.get(f"/api/semesters/{sem_id}/subjects/{sub1_id}/performance", headers=student_headers)
    assert student_perf.status_code == 200
    st_perf_data = student_perf.json()
    assert len(st_perf_data["students"]) == 1
    # Because s1 is only "graded" (draft) and not "released", student cannot see score:
    assert st_perf_data["students"][0]["average_score"] is None
    assert st_perf_data["students"][0]["average_score_label"] == "N/A"

    # Teacher requests subject performance: can see evaluated marks
    teacher_perf = client.get(f"/api/semesters/{sem_id}/subjects/{sub1_id}/performance", headers=teacher_headers)
    assert teacher_perf.status_code == 200
    t_perf_data = teacher_perf.json()
    assert t_perf_data["students"][0]["average_score"] == 88.0
    assert t_perf_data["students"][0]["average_score_label"] == "88%"

    # 3. Finalization Check: should fail because s1 is still in "graded" (draft/unreleased)
    fin_res = client.post(f"/api/semesters/{sem_id}/finalize", headers=teacher_headers)
    assert fin_res.status_code == 400
    assert "unreleased or pending grading" in fin_res.json()["detail"]

    # Now release grade
    with Session(db_engine) as session:
        sub_to_release = session.query(Submission).filter(Submission.assignment_id == as1_id).first()
        sub_to_release.status = "released"
        sub_to_release.released_at = datetime.now(timezone.utc)
        session.commit()

    # Now student can see released score
    student_perf_after = client.get(f"/api/semesters/{sem_id}/subjects/{sub1_id}/performance", headers=student_headers)
    assert student_perf_after.status_code == 200
    assert student_perf_after.json()["students"][0]["average_score"] == 88.0
    assert student_perf_after.json()["students"][0]["average_score_label"] == "88%"

    # 4. Check Semester Report
    rep_res = client.get(f"/api/semesters/{sem_id}/report", headers=teacher_headers)
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert rep_data["summary"]["total_students"] >= 1
    assert rep_data["summary"]["total_assignments"] == 2
    assert len(rep_data["subject_performances"]) == 2

    # 5. Check CSV Export
    csv_res = client.get(f"/api/semesters/{sem_id}/report/export-csv", headers=teacher_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "AssignFlow Semester Performance Report" in csv_res.text
    assert "DBMS" in csv_res.text


def test_non_semester_class_and_assignment_workflow(client, teacher_headers):
    """Verifies that creating classes and assignments without a semester works without regression."""
    # 1. Create a class without semester_id
    cls_res = client.post(
        "/api/classes",
        json={"name": "Independent Coaching Class", "description": "No semester"},
        headers=teacher_headers,
    )
    assert cls_res.status_code == 201
    cls_data = cls_res.json()
    assert cls_data["semester_id"] is None

    # 2. Create an assignment for this class
    as_res = client.post(
        "/api/assignments",
        json={
            "title": "Standalone Assignment",
            "subject": "Physics",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "class_id": cls_data["id"],
            "max_marks": 50.0,
        },
        headers=teacher_headers,
    )
    assert as_res.status_code == 201
    as_data = as_res.json()
    assert as_data["class_id"] == cls_data["id"]
    assert as_data["semester_id"] is None


def test_semester_dashboard_student_access_and_privacy(
    client, teacher_headers, teacher_user, student_headers, student_user, second_student, db_engine
):
    """
    Regression Test:
    1. Unenrolled student cannot access semester dashboard (403 Forbidden).
    2. Enrolled student can access dashboard, but recent_submissions only contains
       their own submissions, preventing unauthorized disclosure of peer names, emails,
       and submission details.
    3. Teacher can access semester dashboard and see submissions from all students.
    """
    # 1. Teacher creates semester and subject
    sem_res = client.post(
        "/api/semesters",
        json={
            "name": "Semester Dashboard Privacy Test",
            "academic_year": "2026 - 2027",
            "start_date": "2026-08-01",
            "end_date": "2026-12-31",
            "program": "B.Tech CSE",
        },
        headers=teacher_headers,
    )
    assert sem_res.status_code == 201
    sem_id = sem_res.json()["id"]

    sub_res = client.post(
        f"/api/semesters/{sem_id}/subjects",
        json={"name": "Cloud Computing", "description": "Cloud architectures"},
        headers=teacher_headers,
    )
    assert sub_res.status_code == 201
    sub_id = sub_res.json()["id"]

    # 2. Student (not yet enrolled) tries to access semester dashboard -> 403 Forbidden
    unenrolled_res = client.get(f"/api/semesters/{sem_id}/dashboard", headers=student_headers)
    assert unenrolled_res.status_code == 403
    assert "not enrolled in any class in this semester" in unenrolled_res.json()["detail"]

    # 3. Enroll student_user and second_student
    with Session(db_engine) as session:
        session.add(ClassEnrollment(class_id=sub_id, student_id=student_user["id"]))
        session.add(ClassEnrollment(class_id=sub_id, student_id=second_student["id"]))

        asgn = Assignment(
            title="Kubernetes Deployment Lab",
            subject="Cloud Computing",
            due_date=datetime.now(timezone.utc) + timedelta(days=4),
            status="active",
            class_id=sub_id,
            semester_id=sem_id,
            max_marks=100.0,
            created_by_id=teacher_user["id"],
        )
        session.add(asgn)
        session.commit()
        session.refresh(asgn)
        asgn_id = asgn.id

        # second_student submits work first
        sub_peer = Submission(
            assignment_id=asgn_id,
            student_id=second_student["id"],
            file_path="/tmp/peer_k8s.pdf",
            file_name="peer_k8s.pdf",
            file_size=1024,
            status="submitted",
        )
        session.add(sub_peer)
        session.commit()

    # 4. Enrolled student_user checks semester dashboard before submitting
    # Must NOT see second_student's submission in recent_submissions!
    st1_dash = client.get(f"/api/semesters/{sem_id}/dashboard", headers=student_headers)
    assert st1_dash.status_code == 200
    st1_data = st1_dash.json()
    assert len(st1_data["recent_submissions"]) == 0
    assert not any(s["student_name"] == second_student["full_name"] for s in st1_data["recent_submissions"])

    # 5. student_user submits work
    with Session(db_engine) as session:
        sub_self = Submission(
            assignment_id=asgn_id,
            student_id=student_user["id"],
            file_path="/tmp/my_k8s.pdf",
            file_name="my_k8s.pdf",
            file_size=2048,
            status="submitted",
        )
        session.add(sub_self)
        session.commit()

    # 6. student_user checks dashboard again
    st1_dash_after = client.get(f"/api/semesters/{sem_id}/dashboard", headers=student_headers)
    assert st1_dash_after.status_code == 200
    st1_subs = st1_dash_after.json()["recent_submissions"]
    assert len(st1_subs) == 1
    assert st1_subs[0]["student_name"] == student_user["email"] or st1_subs[0]["student_name"] == "Miles Morales"
    assert st1_subs[0]["student_email"] == student_user["email"]

    # 7. Teacher checks dashboard: can see submissions from both students
    t_dash = client.get(f"/api/semesters/{sem_id}/dashboard", headers=teacher_headers)
    assert t_dash.status_code == 200
    t_subs = t_dash.json()["recent_submissions"]
    assert len(t_subs) == 2


def test_subject_performance_student_enrollment_and_peer_anonymization(
    client, teacher_headers, teacher_user, student_headers, student_user, second_student, db_engine
):
    """
    Regression Test:
    1. Unenrolled student cannot access subject performance (403 Forbidden).
    2. Enrolled student can access subject performance, seeing their own name and email,
       while peer records are strictly anonymized ('Student #N', empty email, peer id 0, status 'Enrolled').
    3. Teacher sees unmasked identities and emails for all enrolled students.
    """
    # 1. Create semester and subject
    sem_res = client.post(
        "/api/semesters",
        json={
            "name": "Subject Performance Anonymization Test",
            "academic_year": "2026 - 2027",
            "start_date": "2026-08-01",
            "end_date": "2026-12-31",
            "program": "B.Tech CSE",
        },
        headers=teacher_headers,
    )
    assert sem_res.status_code == 201
    sem_id = sem_res.json()["id"]

    sub_res = client.post(
        f"/api/semesters/{sem_id}/subjects",
        json={"name": "Machine Learning", "description": "Supervised & Unsupervised"},
        headers=teacher_headers,
    )
    assert sub_res.status_code == 201
    sub_id = sub_res.json()["id"]

    # 2. Unenrolled student gets 403 Forbidden
    unenrolled_perf = client.get(f"/api/semesters/{sem_id}/subjects/{sub_id}/performance", headers=student_headers)
    assert unenrolled_perf.status_code == 403
    assert "not enrolled in this subject" in unenrolled_perf.json()["detail"]

    # 3. Enroll both students
    with Session(db_engine) as session:
        session.add(ClassEnrollment(class_id=sub_id, student_id=student_user["id"]))
        session.add(ClassEnrollment(class_id=sub_id, student_id=second_student["id"]))

        asgn = Assignment(
            title="Regression Lab",
            subject="Machine Learning",
            due_date=datetime.now(timezone.utc) + timedelta(days=5),
            status="active",
            class_id=sub_id,
            semester_id=sem_id,
            max_marks=100.0,
            created_by_id=teacher_user["id"],
        )
        session.add(asgn)
        session.commit()
        session.refresh(asgn)

        # Give released grades to both
        now_utc = datetime.now(timezone.utc)
        s1 = Submission(
            assignment_id=asgn.id,
            student_id=student_user["id"],
            file_path="/tmp/ml1.pdf",
            file_name="ml1.pdf",
            file_size=1024,
            grade=95.0,
            status="released",
            released_at=now_utc,
        )
        s2 = Submission(
            assignment_id=asgn.id,
            student_id=second_student["id"],
            file_path="/tmp/ml2.pdf",
            file_name="ml2.pdf",
            file_size=1024,
            grade=85.0,
            status="released",
            released_at=now_utc,
        )
        session.add_all([s1, s2])
        session.commit()

    # 4. Enrolled student requests subject performance
    st_perf = client.get(f"/api/semesters/{sem_id}/subjects/{sub_id}/performance", headers=student_headers)
    assert st_perf.status_code == 200
    st_perf_data = st_perf.json()
    st_list = st_perf_data["students"]
    assert len(st_list) == 2

    # Verify student sees own details
    self_entry = next((s for s in st_list if s["id"] == student_user["id"]), None)
    assert self_entry is not None
    assert self_entry["student_name"] == "Miles Morales"
    assert self_entry["student_email"] == student_user["email"]

    # Verify student sees peer anonymized
    peer_entry = next((s for s in st_list if s["id"] == 0), None)
    assert peer_entry is not None
    assert peer_entry["student_name"] != second_student["full_name"]
    assert peer_entry["student_name"].startswith("Student #")
    assert peer_entry["student_email"] == ""
    assert peer_entry["status"] == "Enrolled"

    # 5. Teacher requests subject performance: sees full unmasked details
    t_perf = client.get(f"/api/semesters/{sem_id}/subjects/{sub_id}/performance", headers=teacher_headers)
    assert t_perf.status_code == 200
    t_list = t_perf.json()["students"]
    assert len(t_list) == 2
    assert any(s["id"] == student_user["id"] and s["student_name"] == "Miles Morales" for s in t_list)
    assert any(s["id"] == second_student["id"] and s["student_name"] == second_student["full_name"] for s in t_list)


def test_semester_reports_and_export_role_restrictions(
    client, teacher_headers, other_teacher_headers, student_headers
):
    """
    Regression Test:
    1. Student requesting semester report or CSV export gets 403 Forbidden.
    2. Non-owning teacher requesting semester report or CSV export gets 403 Forbidden.
    3. Owning teacher requesting semester report or CSV export gets 200 OK.
    """
    # Create semester
    sem_res = client.post(
        "/api/semesters",
        json={
            "name": "Report Security Test Semester",
            "academic_year": "2026 - 2027",
            "start_date": "2026-08-01",
            "end_date": "2026-12-31",
            "program": "B.Tech CSE",
        },
        headers=teacher_headers,
    )
    assert sem_res.status_code == 201
    sem_id = sem_res.json()["id"]

    # 1. Student access -> 403 Forbidden
    rep_st = client.get(f"/api/semesters/{sem_id}/report", headers=student_headers)
    assert rep_st.status_code == 403

    csv_st = client.get(f"/api/semesters/{sem_id}/report/export-csv", headers=student_headers)
    assert csv_st.status_code == 403

    # 2. Non-owning teacher access -> 403 Forbidden
    rep_other = client.get(f"/api/semesters/{sem_id}/report", headers=other_teacher_headers)
    assert rep_other.status_code == 403

    csv_other = client.get(f"/api/semesters/{sem_id}/report/export-csv", headers=other_teacher_headers)
    assert csv_other.status_code == 403

    # 3. Owning teacher access -> 200 OK
    rep_owner = client.get(f"/api/semesters/{sem_id}/report", headers=teacher_headers)
    assert rep_owner.status_code == 200

    csv_owner = client.get(f"/api/semesters/{sem_id}/report/export-csv", headers=teacher_headers)
    assert csv_owner.status_code == 200
