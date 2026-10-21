import csv
from datetime import datetime, timezone, timedelta
import io
import sys
import uuid
import zipfile
from pathlib import Path
import pytest
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment, generate_join_code
from app.models.submission import Submission
from app.models.user import User
from app.core.security import hash_password, create_access_token


def make_auth_header(user: dict) -> dict:
    token = create_access_token({
        "sub": str(user["id"]),
        "role": user["role"],
        "email": user["email"],
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def export_test_env(db_engine):
    """
    Sets up a complete test environment:
    - Teacher 1 (owner)
    - Teacher 2 (unauthorized non-owner)
    - Student 1 (enrolled, submitted work)
    - Student 2 (enrolled, submitted work)
    - Student 3 (enrolled, submitted work with formula injection payload)
    - Classroom & Assignment (max_marks=80.0, with teacher attachment)
    """
    with Session(db_engine) as session:
        t1 = User(
            email=f"t1_exp_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Prof. Charles Xavier",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        t2 = User(
            email=f"t2_exp_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Prof. Erik Lehnsherr",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        s1 = User(
            email=f"s1_exp_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Scott Summers",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s2 = User(
            email=f"s2_exp_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Jean Grey",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s3 = User(
            email=f"s3_exp_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Hank McCoy",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([t1, t2, s1, s2, s3])
        session.commit()
        for u in [t1, t2, s1, s2, s3]:
            session.refresh(u)

        classroom = Class(
            name="Advanced Biophysics",
            join_code=generate_join_code(),
            teacher_id=t1.id,
        )
        session.add(classroom)
        session.commit()
        session.refresh(classroom)

        session.add_all([
            ClassEnrollment(class_id=classroom.id, student_id=s1.id),
            ClassEnrollment(class_id=classroom.id, student_id=s2.id),
            ClassEnrollment(class_id=classroom.id, student_id=s3.id),
        ])
        session.commit()

        # Files on disk
        test_dir = Path("uploads/test_exports")
        test_dir.mkdir(parents=True, exist_ok=True)

        teacher_attachment = test_dir / f"teacher_question_{uuid.uuid4().hex[:6]}.pdf"
        teacher_attachment.write_bytes(b"%PDF-1.4 TEACHER QUESTION FILE CONTENT DO NOT EXPORT")

        s1_file = test_dir / f"sub1_{uuid.uuid4().hex[:6]}.pdf"
        s1_file.write_bytes(b"%PDF-1.4 SCOTT SUBMISSION CONTENT")

        s2_file = test_dir / f"sub2_{uuid.uuid4().hex[:6]}.pdf"
        s2_file.write_bytes(b"%PDF-1.4 JEAN SUBMISSION CONTENT")

        s3_file = test_dir / f"sub3_{uuid.uuid4().hex[:6]}.pdf"
        s3_file.write_bytes(b"%PDF-1.4 HANK SUBMISSION CONTENT")

        due = datetime.now(timezone.utc) + timedelta(days=5)
        assignment = Assignment(
            title="Cellular Energy Systems",
            description="Detailed analysis of ATP synthesis.",
            subject="Biophysics",
            due_date=due,
            status="active",
            class_id=classroom.id,
            created_by_id=t1.id,
            max_marks=80.0,
            file_name="question_sheet.pdf",
            file_path=str(teacher_attachment),
            file_size=len(teacher_attachment.read_bytes()),
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)

        # Submissions
        sub1 = Submission(
            assignment_id=assignment.id,
            student_id=s1.id,
            file_name="scott_essay.pdf",
            file_path=str(s1_file),
            file_size=len(s1_file.read_bytes()),
            grade=72.0,
            feedback="Excellent depth on oxidative phosphorylation.",
            status="graded",
            graded_by_id=t1.id,
        )
        sub2 = Submission(
            assignment_id=assignment.id,
            student_id=s2.id,
            file_name="jean_essay.pdf",
            file_path=str(s2_file),
            file_size=len(s2_file.read_bytes()),
            grade=78.0,
            feedback="Outstanding work!",
            status="released",
            graded_by_id=t1.id,
        )
        sub3 = Submission(
            assignment_id=assignment.id,
            student_id=s3.id,
            file_name="=cmd|' /C calc'!A0.pdf",
            file_path=str(s3_file),
            file_size=len(s3_file.read_bytes()),
            grade=None,
            feedback="+SUM(1,2)",
            status="submitted",
        )
        session.add_all([sub1, sub2, sub3])
        session.commit()
        for s in [sub1, sub2, sub3]:
            session.refresh(s)

        env = {
            "t1": {"id": t1.id, "email": t1.email, "role": "teacher"},
            "t2": {"id": t2.id, "email": t2.email, "role": "teacher"},
            "s1": {"id": s1.id, "email": s1.email, "role": "student"},
            "s2": {"id": s2.id, "email": s2.email, "role": "student"},
            "s3": {"id": s3.id, "email": s3.email, "role": "student"},
            "classroom_id": classroom.id,
            "assignment_id": assignment.id,
            "sub1_id": sub1.id,
            "sub2_id": sub2.id,
            "sub3_id": sub3.id,
            "teacher_attachment": teacher_attachment,
            "s1_file": s1_file,
            "s2_file": s2_file,
            "s3_file": s3_file,
        }
    return env


# ==================== CSV EXPORT TESTS ====================

def test_csv_export_headers_and_values(client, export_test_env):
    """Verify CSV export contains expected headers and accurately formatted submission records."""
    t1 = export_test_env["t1"]
    assignment_id = export_test_env["assignment_id"]
    headers = make_auth_header(t1)

    res = client.get(f"/api/assignments/{assignment_id}/export/csv", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "filename=" in res.headers.get("content-disposition", "")
    assert "Cellular_Energy_Systems_submissions.csv" in res.headers.get("content-disposition", "")

    csv_reader = csv.reader(io.StringIO(res.text))
    rows = list(csv_reader)

    # Check headers
    expected_headers = [
        "Student ID",
        "Student Name",
        "Student Email",
        "Assignment Title",
        "Class",
        "Submitted At (UTC)",
        "Late Submission",
        "Submission Status",
        "Grade",
        "Maximum Marks",
        "Percentage",
        "Grade Released",
        "Released At (UTC)",
        "Teacher Feedback",
        "Submission Filename",
    ]
    assert rows[0] == expected_headers

    # Check data rows exist (3 submissions)
    assert len(rows) == 4

    # Find Scott's row (graded draft, 72/80 = 90.0%)
    scott_row = next(r for r in rows[1:] if "Scott Summers" in r[1])
    assert scott_row[3] == "Cellular Energy Systems"
    assert scott_row[4] == "Advanced Biophysics"
    assert scott_row[7] == "graded"
    assert scott_row[8] == "72.0"
    assert scott_row[9] == "80.0"
    assert scott_row[10] == "90.0%"
    assert scott_row[11] == "No"
    assert "Excellent depth" in scott_row[13]

    # Find Jean's row (released, 78/80 = 97.5%)
    jean_row = next(r for r in rows[1:] if "Jean Grey" in r[1])
    assert jean_row[7] == "released"
    assert jean_row[8] == "78.0"
    assert jean_row[10] == "97.5%"
    assert jean_row[11] == "Yes"
    assert jean_row[13] == "Outstanding work!"


def test_csv_export_formula_injection_protection(client, export_test_env):
    """Verify that formula injection characters (=, +, -, @) are sanitized with leading quotes."""
    t1 = export_test_env["t1"]
    assignment_id = export_test_env["assignment_id"]
    headers = make_auth_header(t1)

    res = client.get(f"/api/assignments/{assignment_id}/export/csv", headers=headers)
    assert res.status_code == 200

    csv_reader = csv.reader(io.StringIO(res.text))
    rows = list(csv_reader)

    # Hank's submission has filename starting with = and feedback with +
    hank_row = next(r for r in rows[1:] if "Hank McCoy" in r[1])
    # Feedback should start with '+
    assert hank_row[13].startswith("'+")
    # Filename should start with '=
    assert hank_row[14].startswith("'=")


def test_csv_export_authorization_and_ownership(client, export_test_env):
    """Verify authentication and teacher ownership enforcement for CSV export."""
    assignment_id = export_test_env["assignment_id"]
    t2 = export_test_env["t2"]
    s1 = export_test_env["s1"]

    # 1. Unauthenticated -> 401
    res = client.get(f"/api/assignments/{assignment_id}/export/csv")
    assert res.status_code == 401

    # 2. Student role -> 403
    res = client.get(f"/api/assignments/{assignment_id}/export/csv", headers=make_auth_header(s1))
    assert res.status_code == 403

    # 3. Non-owning teacher -> 403
    res = client.get(f"/api/assignments/{assignment_id}/export/csv", headers=make_auth_header(t2))
    assert res.status_code == 403

    # 4. Non-existent assignment -> 404
    res = client.get("/api/assignments/999999/export/csv", headers=make_auth_header(export_test_env["t1"]))
    assert res.status_code == 404


# ==================== ZIP EXPORT TESTS ====================

def test_zip_export_contents_and_file_safety(client, export_test_env):
    """Verify ZIP export bundles submitted files, sanitizes filenames, and contains correct data."""
    t1 = export_test_env["t1"]
    assignment_id = export_test_env["assignment_id"]
    headers = make_auth_header(t1)

    res = client.get(f"/api/assignments/{assignment_id}/export/zip", headers=headers)
    assert res.status_code == 200
    assert "application/zip" in res.headers.get("content-type", "")
    assert "Cellular_Energy_Systems_submissions.zip" in res.headers.get("content-disposition", "")

    zip_bytes = io.BytesIO(res.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        namelist = zf.namelist()
        assert len(namelist) == 3

        # Scott's file in archive
        scott_file = next(n for n in namelist if "Scott_Summers" in n)
        assert zf.read(scott_file) == b"%PDF-1.4 SCOTT SUBMISSION CONTENT"

        # Jean's file in archive
        jean_file = next(n for n in namelist if "Jean_Grey" in n)
        assert zf.read(jean_file) == b"%PDF-1.4 JEAN SUBMISSION CONTENT"


def test_zip_export_never_includes_teacher_assignment_attachment(client, export_test_env):
    """CRITICAL REQUIREMENT: Verify that teacher's assignment attachment is NEVER included in ZIP."""
    t1 = export_test_env["t1"]
    assignment_id = export_test_env["assignment_id"]
    headers = make_auth_header(t1)

    res = client.get(f"/api/assignments/{assignment_id}/export/zip", headers=headers)
    assert res.status_code == 200

    zip_bytes = io.BytesIO(res.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        namelist = zf.namelist()
        for name in namelist:
            content = zf.read(name)
            assert b"TEACHER QUESTION FILE CONTENT DO NOT EXPORT" not in content
            assert "question_sheet.pdf" not in name


def test_zip_export_duplicate_filenames_disambiguation(client, db_engine, export_test_env):
    """Verify that multiple submissions with the same original filename are disambiguated."""
    t1 = export_test_env["t1"]
    test_dir = Path("uploads/test_exports")

    dup_file1 = test_dir / f"dup1_{uuid.uuid4().hex[:6]}.pdf"
    dup_file1.write_bytes(b"%PDF-1.4 DUP CONTENT 1")
    dup_file2 = test_dir / f"dup2_{uuid.uuid4().hex[:6]}.pdf"
    dup_file2.write_bytes(b"%PDF-1.4 DUP CONTENT 2")

    with Session(db_engine) as session:
        # Create dedicated assignment and two students
        s_dup1 = User(
            email=f"dup1_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Duplicate Student 1",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s_dup2 = User(
            email=f"dup2_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Duplicate Student 2",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([s_dup1, s_dup2])
        session.commit()
        session.refresh(s_dup1)
        session.refresh(s_dup2)

        due = datetime.now(timezone.utc) + timedelta(days=5)
        dup_assignment = Assignment(
            title="Duplicate Test Assignment",
            subject="Test",
            due_date=due,
            status="active",
            class_id=export_test_env["classroom_id"],
            created_by_id=t1["id"],
            max_marks=100.0,
        )
        session.add(dup_assignment)
        session.commit()
        session.refresh(dup_assignment)

        # Both students submit files named "project.pdf"
        sub_dup1 = Submission(
            assignment_id=dup_assignment.id,
            student_id=s_dup1.id,
            file_name="project.pdf",
            file_path=str(dup_file1),
            file_size=len(dup_file1.read_bytes()),
            status="submitted",
        )
        sub_dup2 = Submission(
            assignment_id=dup_assignment.id,
            student_id=s_dup2.id,
            file_name="project.pdf",
            file_path=str(dup_file2),
            file_size=len(dup_file2.read_bytes()),
            status="submitted",
        )
        session.add_all([sub_dup1, sub_dup2])
        session.commit()
        dup_assign_id = dup_assignment.id

    headers = make_auth_header(t1)
    res = client.get(f"/api/assignments/{dup_assign_id}/export/zip", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content), "r") as zf:
        namelist = zf.namelist()
        # All filenames in archive must be strictly unique
        assert len(namelist) == len(set(namelist))
        assert len(namelist) == 2
        # Disambiguated files contain project.pdf and student identifiers
        assert any("project.pdf" in name for name in namelist)


def test_zip_export_path_traversal_prevention(client, db_engine, export_test_env):
    """Verify path traversal characters in submission filename are safely stripped in archive."""
    t1 = export_test_env["t1"]
    test_dir = Path("uploads/test_exports")

    trav_file = test_dir / f"trav_{uuid.uuid4().hex[:6]}.pdf"
    trav_file.write_bytes(b"%PDF-1.4 TRAVERSAL TEST")

    with Session(db_engine) as session:
        s_trav = User(
            email=f"trav_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Traversal Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add(s_trav)
        session.commit()
        session.refresh(s_trav)

        due = datetime.now(timezone.utc) + timedelta(days=5)
        trav_assign = Assignment(
            title="Traversal Test Assignment",
            subject="Security",
            due_date=due,
            status="active",
            class_id=export_test_env["classroom_id"],
            created_by_id=t1["id"],
            max_marks=100.0,
        )
        session.add(trav_assign)
        session.commit()
        session.refresh(trav_assign)

        sub_trav = Submission(
            assignment_id=trav_assign.id,
            student_id=s_trav.id,
            file_name="../../../etc/passwd.pdf",
            file_path=str(trav_file),
            file_size=len(trav_file.read_bytes()),
            status="submitted",
        )
        session.add(sub_trav)
        session.commit()
        trav_assign_id = trav_assign.id

    headers = make_auth_header(t1)
    res = client.get(f"/api/assignments/{trav_assign_id}/export/zip", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content), "r") as zf:
        namelist = zf.namelist()
        for name in namelist:
            assert ".." not in name
            assert "/" not in name
            assert "\\" not in name

    with zipfile.ZipFile(io.BytesIO(res.content), "r") as zf:
        namelist = zf.namelist()
        for name in namelist:
            assert ".." not in name
            assert "/" not in name
            assert "\\" not in name


def test_zip_export_empty_submissions_and_missing_files(client, db_engine, export_test_env):
    """Verify empty assignments and missing disk files are handled safely without 500 error."""
    t1 = export_test_env["t1"]

    with Session(db_engine) as session:
        due = datetime.now(timezone.utc) + timedelta(days=5)
        empty_assignment = Assignment(
            title="Empty Assignment",
            description="No submissions yet.",
            subject="Test",
            due_date=due,
            status="active",
            class_id=export_test_env["classroom_id"],
            created_by_id=t1["id"],
            max_marks=100.0,
        )
        session.add(empty_assignment)
        session.commit()
        session.refresh(empty_assignment)
        empty_id = empty_assignment.id

    headers = make_auth_header(t1)
    # Empty submissions returns valid ZIP archive
    res = client.get(f"/api/assignments/{empty_id}/export/zip", headers=headers)
    assert res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(res.content), "r") as zf:
        assert len(zf.namelist()) == 0

    # Submission pointing to non-existent file on disk
    with Session(db_engine) as session:
        ghost_sub = Submission(
            assignment_id=empty_id,
            student_id=export_test_env["s1"]["id"],
            file_name="ghost.pdf",
            file_path="/tmp/non_existent_file_99887766.pdf",
            file_size=1234,
            status="submitted",
        )
        session.add(ghost_sub)
        session.commit()

    # Still returns 200 without crashing
    res2 = client.get(f"/api/assignments/{empty_id}/export/zip", headers=headers)
    assert res2.status_code == 200
    with zipfile.ZipFile(io.BytesIO(res2.content), "r") as zf:
        assert len(zf.namelist()) == 0


def test_zip_export_authorization_and_ownership(client, export_test_env):
    """Verify auth and teacher ownership check for ZIP export."""
    assignment_id = export_test_env["assignment_id"]
    t2 = export_test_env["t2"]
    s1 = export_test_env["s1"]

    # 1. Unauthenticated -> 401
    res = client.get(f"/api/assignments/{assignment_id}/export/zip")
    assert res.status_code == 401

    # 2. Student -> 403
    res = client.get(f"/api/assignments/{assignment_id}/export/zip", headers=make_auth_header(s1))
    assert res.status_code == 403

    # 3. Non-owner teacher -> 403
    res = client.get(f"/api/assignments/{assignment_id}/export/zip", headers=make_auth_header(t2))
    assert res.status_code == 403

    # 4. Non-existent -> 404
    res = client.get("/api/assignments/999999/export/zip", headers=make_auth_header(export_test_env["t1"]))
    assert res.status_code == 404


# ==================== BULK GRADE RELEASE TESTS ====================

def test_bulk_release_selective_with_submission_ids(client, db_engine, export_test_env):
    """Verify selective release releases only the chosen graded submissions."""
    t1 = export_test_env["t1"]
    assignment_id = export_test_env["assignment_id"]
    sub1_id = export_test_env["sub1_id"]
    sub3_id = export_test_env["sub3_id"]

    # Grade sub3 as well
    with Session(db_engine) as session:
        s3_db = session.query(Submission).filter(Submission.id == sub3_id).first()
        s3_db.grade = 65.0
        s3_db.status = "graded"
        session.commit()

    headers = make_auth_header(t1)

    # Selectively release ONLY sub1, leaving sub3 as 'graded'
    payload = {"submission_ids": [sub1_id]}
    res = client.post(
        f"/api/assignments/{assignment_id}/release-grades",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["released_count"] == 1

    with Session(db_engine) as session:
        sub1_reloaded = session.query(Submission).filter(Submission.id == sub1_id).first()
        sub3_reloaded = session.query(Submission).filter(Submission.id == sub3_id).first()
        assert sub1_reloaded.status == "released"
        assert sub1_reloaded.released_at is not None
        assert sub3_reloaded.status == "graded"  # Unselected remains graded draft


def test_bulk_release_skips_ungraded_submissions(client, db_engine, export_test_env):
    """Verify bulk release never releases ungraded submissions, even if specified in submission_ids."""
    t1 = export_test_env["t1"]
    headers = make_auth_header(t1)

    with Session(db_engine) as session:
        s_ungraded = User(
            email=f"ungraded_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Ungraded Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add(s_ungraded)
        session.commit()
        session.refresh(s_ungraded)

        due = datetime.now(timezone.utc) + timedelta(days=5)
        ungraded_assign = Assignment(
            title="Ungraded Skip Assignment",
            subject="Test",
            due_date=due,
            status="active",
            class_id=export_test_env["classroom_id"],
            created_by_id=t1["id"],
            max_marks=100.0,
        )
        session.add(ungraded_assign)
        session.commit()
        session.refresh(ungraded_assign)

        ungraded_sub = Submission(
            assignment_id=ungraded_assign.id,
            student_id=s_ungraded.id,
            file_name="ungraded.pdf",
            file_path="/tmp/ungraded.pdf",
            file_size=100,
            grade=None,
            status="submitted",
        )
        session.add(ungraded_sub)
        session.commit()
        session.refresh(ungraded_sub)
        ungraded_id = ungraded_sub.id
        assign_id = ungraded_assign.id

    # Try releasing the ungraded submission ID explicitly
    payload = {"submission_ids": [ungraded_id]}
    res = client.post(
        f"/api/assignments/{assign_id}/release-grades",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 200
    assert res.json()["released_count"] == 0

    with Session(db_engine) as session:
        check_sub = session.query(Submission).filter(Submission.id == ungraded_id).first()
        assert check_sub.status == "submitted"
        assert check_sub.released_at is None


def test_bulk_release_empty_list_safely_ignored(client, export_test_env):
    """Verify passing an empty submission_ids list returns 0 and does not release everything."""
    t1 = export_test_env["t1"]
    assignment_id = export_test_env["assignment_id"]
    headers = make_auth_header(t1)

    payload = {"submission_ids": []}
    res = client.post(
        f"/api/assignments/{assignment_id}/release-grades",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 200
    assert res.json()["released_count"] == 0
    assert "No submissions selected" in res.json()["message"]


def test_bulk_release_student_privacy_regression(client, db_engine, export_test_env):
    """Verify that student only sees marks/feedback after grade release."""
    assignment_id = export_test_env["assignment_id"]
    s1 = export_test_env["s1"]
    s2 = export_test_env["s2"]

    with Session(db_engine) as session:
        # Ensure s1 is draft graded, s2 is released
        sub1 = session.query(Submission).filter(
            Submission.assignment_id == assignment_id,
            Submission.student_id == s1["id"],
        ).first()
        sub1.grade = 70.0
        sub1.feedback = "Private draft feedback"
        sub1.status = "graded"
        sub1.released_at = None

        sub2 = session.query(Submission).filter(
            Submission.assignment_id == assignment_id,
            Submission.student_id == s2["id"],
        ).first()
        sub2.grade = 75.0
        sub2.feedback = "Public released feedback"
        sub2.status = "released"
        session.commit()

    # Student 1 checks /api/submissions
    res_s1 = client.get("/api/submissions", headers=make_auth_header(s1))
    assert res_s1.status_code == 200
    sub1_data = next((s for s in res_s1.json() if s["assignment_id"] == assignment_id), None)
    assert sub1_data is not None
    assert sub1_data["status"] == "submitted"
    assert sub1_data["grade"] is None
    assert sub1_data["feedback"] is None

    # Student 2 checks /api/submissions
    res_s2 = client.get("/api/submissions", headers=make_auth_header(s2))
    assert res_s2.status_code == 200
    sub2_data = next((s for s in res_s2.json() if s["assignment_id"] == assignment_id), None)
    assert sub2_data is not None
    assert sub2_data["status"] == "released"
    assert sub2_data["grade"] == 75.0
    assert sub2_data["feedback"] == "Public released feedback"


def test_csv_export_zero_submissions_returns_valid_headers(client, db_engine, export_test_env):
    """Verify that exporting CSV for an assignment with 0 submissions succeeds with valid headers."""
    t1 = export_test_env["t1"]
    headers = make_auth_header(t1)

    with Session(db_engine) as session:
        due = datetime.now(timezone.utc) + timedelta(days=10)
        empty_assign = Assignment(
            title="Empty Submissions Assignment",
            subject="Physics",
            due_date=due,
            status="active",
            class_id=export_test_env["classroom_id"],
            created_by_id=t1["id"],
            max_marks=100.0,
        )
        session.add(empty_assign)
        session.commit()
        session.refresh(empty_assign)
        empty_assign_id = empty_assign.id

    res = client.get(f"/api/assignments/{empty_assign_id}/export/csv", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    content = res.text
    lines = [line.strip() for line in content.strip().split("\n") if line.strip()]
    assert len(lines) == 1  # Only header line
    assert "Student ID" in lines[0]
    assert "Grade" in lines[0]


def test_zip_export_zero_submissions_returns_valid_empty_zip(client, db_engine, export_test_env):
    """Verify that downloading ZIP for an assignment with 0 submissions succeeds with a valid empty archive."""
    t1 = export_test_env["t1"]
    headers = make_auth_header(t1)

    with Session(db_engine) as session:
        due = datetime.now(timezone.utc) + timedelta(days=10)
        empty_assign = Assignment(
            title="Empty Submissions ZIP Assignment",
            subject="Chemistry",
            due_date=due,
            status="active",
            class_id=export_test_env["classroom_id"],
            created_by_id=t1["id"],
            max_marks=100.0,
        )
        session.add(empty_assign)
        session.commit()
        session.refresh(empty_assign)
        empty_assign_id = empty_assign.id

    res = client.get(f"/api/assignments/{empty_assign_id}/export/zip", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("content-type") == "application/zip"

    # Verify that the downloaded file is a valid ZIP archive with 0 members
    zip_bytes = io.BytesIO(res.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        assert len(zf.namelist()) == 0


def test_settings_production_validation():
    """Verify Settings raises ValueError in production if default secret or debug mode is used."""
    from app.core.config import Settings
    import pytest

    # Default secret in production -> should raise ValueError
    with pytest.raises(ValueError, match="Insecure SECRET_KEY"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="assignflow-super-secret-jwt-key-2026-production-ready",
        )

    # DEBUG=True in production -> should raise ValueError
    with pytest.raises(ValueError, match="Insecure DEBUG mode"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=True,
            SECRET_KEY="a-very-secure-random-custom-production-key-9999",
        )

    # Wildcard ALLOWED_ORIGINS in production -> should raise ValueError
    with pytest.raises(ValueError, match="Insecure ALLOWED_ORIGINS"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="a-very-secure-random-custom-production-key-9999",
            ALLOWED_ORIGINS="*",
        )

    # Empty ALLOWED_ORIGINS in production -> should raise ValueError
    with pytest.raises(ValueError, match="Insecure ALLOWED_ORIGINS"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="a-very-secure-random-custom-production-key-9999",
            ALLOWED_ORIGINS="   ",
        )

    # Valid production settings -> should pass
    valid_prod = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a-very-secure-random-custom-production-key-9999",
        ALLOWED_ORIGINS="https://assignflow.college.edu",
    )
    assert valid_prod.ENVIRONMENT == "production"
    assert valid_prod.DEBUG is False
    assert valid_prod.ALLOWED_ORIGINS == "https://assignflow.college.edu"


def test_settings_staging_validation():
    """Verify Settings raises ValueError in staging if default secret, debug mode, or wildcard origins are used."""
    from app.core.config import Settings
    import pytest

    # Default secret in staging -> should raise ValueError
    with pytest.raises(ValueError, match=r"Insecure SECRET_KEY.*staging"):
        Settings(
            ENVIRONMENT="staging",
            DEBUG=False,
            SECRET_KEY="assignflow-super-secret-jwt-key-2026-production-ready",
            ALLOWED_ORIGINS="https://staging.assignflow.example.edu",
        )

    # DEBUG=True in staging -> should raise ValueError
    with pytest.raises(ValueError, match=r"Insecure DEBUG mode.*staging"):
        Settings(
            ENVIRONMENT="staging",
            DEBUG=True,
            SECRET_KEY="a-very-secure-random-custom-staging-key-9999",
            ALLOWED_ORIGINS="https://staging.assignflow.example.edu",
        )

    # Wildcard ALLOWED_ORIGINS in staging -> should raise ValueError
    with pytest.raises(ValueError, match=r"Insecure ALLOWED_ORIGINS.*staging"):
        Settings(
            ENVIRONMENT="staging",
            DEBUG=False,
            SECRET_KEY="a-very-secure-random-custom-staging-key-9999",
            ALLOWED_ORIGINS="*",
        )

    # Empty ALLOWED_ORIGINS in staging -> should raise ValueError
    with pytest.raises(ValueError, match=r"Insecure ALLOWED_ORIGINS.*staging"):
        Settings(
            ENVIRONMENT="staging",
            DEBUG=False,
            SECRET_KEY="a-very-secure-random-custom-staging-key-9999",
            ALLOWED_ORIGINS="",
        )

    # Valid staging settings -> should pass
    valid_staging = Settings(
        ENVIRONMENT="staging",
        DEBUG=False,
        SECRET_KEY="a-very-secure-random-custom-staging-key-9999",
        ALLOWED_ORIGINS="https://staging.assignflow.example.edu",
    )
    assert valid_staging.ENVIRONMENT == "staging"
    assert valid_staging.DEBUG is False
    assert valid_staging.ALLOWED_ORIGINS == "https://staging.assignflow.example.edu"


def test_settings_development_behavior():
    """Verify Settings retains development mode defaults and allows debug/default secret."""
    from app.core.config import Settings

    # Development mode accepts default secret and DEBUG=True without raising ValueError
    dev_settings = Settings(
        ENVIRONMENT="development",
        DEBUG=True,
        SECRET_KEY="assignflow-super-secret-jwt-key-2026-production-ready",
        ALLOWED_ORIGINS="*",
    )
    assert dev_settings.ENVIRONMENT == "development"
    assert dev_settings.DEBUG is True
    assert dev_settings.ALLOWED_ORIGINS == "*"


def test_bulk_release_concurrency_and_timestamp_preservation(client, db_engine, export_test_env):
    """Verify that repeated or concurrent bulk release calls preserve original released_at timestamps."""
    t1 = export_test_env["t1"]
    assign_id = export_test_env["assignment_id"]
    headers = make_auth_header(t1)

    # First release
    res1 = client.post(f"/api/assignments/{assign_id}/release-grades", headers=headers, json=None)
    assert res1.status_code == 200

    with Session(db_engine) as session:
        sub = session.query(Submission).filter(
            Submission.assignment_id == assign_id,
            Submission.status == "released"
        ).first()
        assert sub is not None
        original_released_at = sub.released_at

    # Second release attempt on already released items
    res2 = client.post(f"/api/assignments/{assign_id}/release-grades", headers=headers, json=None)
    assert res2.status_code == 200
    assert res2.json()["released_count"] == 0

    with Session(db_engine) as session:
        sub_after = session.query(Submission).filter(Submission.id == sub.id).first()
        assert sub_after.released_at == original_released_at
