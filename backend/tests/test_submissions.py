import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.user import User
from app.models.classroom import Class, ClassEnrollment
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.core.security import hash_password, create_access_token


@pytest.fixture
def test_setup(db_engine, teacher_user, student_user):
    """
    Creates a dedicated class, enrolls student_user, and creates a test assignment.
    Returns dictionary with all entity IDs and headers.
    """
    with Session(db_engine) as session:
        # 1. Create class owned by teacher_user
        cls = Class(
            name=f"CS{uuid.uuid4().hex[:4].upper()} Algorithms",
            join_code=uuid.uuid4().hex[:7].upper(),
            teacher_id=teacher_user["id"],
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)
        class_id = cls.id

        # 2. Enroll student_user in the class
        enrollment = ClassEnrollment(class_id=class_id, student_id=student_user["id"])
        session.add(enrollment)
        session.commit()

        # 3. Create active assignment with future due date
        due_date = datetime.now(timezone.utc) + timedelta(days=7)
        assignment = Assignment(
            title="Algorithms Problem Set 1",
            subject="Computer Science",
            description="Complete all sorting problems.",
            due_date=due_date,
            status="active",
            class_id=class_id,
            created_by_id=teacher_user["id"],
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

    return {
        "class_id": class_id,
        "assignment_id": assignment_id,
        "teacher_id": teacher_user["id"],
        "student_id": student_user["id"],
    }


def test_student_successful_submission(client, test_setup, student_headers):
    """Verify that an enrolled student can submit their completed work."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Student Solution) >>\nendobj\n%%EOF"

    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        data={"notes": "Here is my completed solution with unit benchmarks."},
        files={"file": ("solution.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["assignment_id"] == assignment_id
    assert data["student_id"] == test_setup["student_id"]
    assert data["file_name"] == "solution.pdf"
    assert data["file_size"] == len(pdf_content)
    assert data["notes"] == "Here is my completed solution with unit benchmarks."
    assert data["is_late"] is False
    assert f"/api/assignments/{assignment_id}/submissions/{data['id']}/download" in data["download_url"]


def test_unauthenticated_submission_rejected(client, test_setup):
    """Verify unauthenticated submission attempts return 401 Unauthorized."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"

    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("work.pdf", pdf_content, "application/pdf")},
    )
    assert response.status_code == 401


def test_teacher_attempting_submission_rejected(client, test_setup, teacher_headers):
    """Verify teachers cannot submit assignments (role-restricted to students)."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"

    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("teacher_work.pdf", pdf_content, "application/pdf")},
        headers=teacher_headers,
    )
    assert response.status_code == 403
    assert "not authorized" in response.json()["detail"].lower()


def test_unenrolled_student_cannot_submit(client, db_engine, test_setup):
    """Verify a student NOT enrolled in the assignment's class receives 403 Forbidden."""
    assignment_id = test_setup["assignment_id"]

    # Create another student not enrolled in this class
    with Session(db_engine) as session:
        other_email = f"unenrolled_{uuid.uuid4().hex[:6]}@example.com"
        other_student = User(
            email=other_email,
            full_name="Peter Parker",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add(other_student)
        session.commit()
        session.refresh(other_student)
        other_token = create_access_token({
            "sub": str(other_student.id),
            "role": "student",
            "email": other_email,
        })

    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"
    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("work.pdf", pdf_content, "application/pdf")},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 403
    assert "not enrolled" in response.json()["detail"].lower()


def test_duplicate_submission_rejected(client, test_setup, student_headers):
    """Verify duplicate submissions by the same student are rejected with 400 Bad Request."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"

    # First submission
    first_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("submission_1.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    assert first_res.status_code == 201

    # Second submission (duplicate)
    second_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("submission_2.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    assert second_res.status_code == 400
    assert "already submitted" in second_res.json()["detail"].lower()


def test_invalid_file_type_rejected(client, test_setup, student_headers):
    """Verify unsupported file types (e.g. .exe, .sh) are rejected with 400 Bad Request."""
    assignment_id = test_setup["assignment_id"]
    executable_content = b"\x7fELF\x02\x01\x01\x00malicious_binary"

    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("exploit.exe", executable_content, "application/octet-stream")},
        headers=student_headers,
    )
    assert response.status_code == 400
    assert "invalid file type" in response.json()["detail"].lower()


def test_fake_pdf_invalid_magic_bytes_rejected(client, test_setup, student_headers):
    """Verify files with .pdf extension but missing %PDF- header are rejected."""
    assignment_id = test_setup["assignment_id"]
    fake_content = b"This is just plain text masquerading as a PDF file."

    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("fake.pdf", fake_content, "application/pdf")},
        headers=student_headers,
    )
    assert response.status_code == 400
    assert "must be a valid pdf" in response.json()["detail"].lower()


def test_oversized_submission_file_rejected(client, test_setup, student_headers):
    """Verify files exceeding 10MB are rejected with 413 Content Too Large."""
    assignment_id = test_setup["assignment_id"]
    # 10MB + 100 bytes
    oversized_content = b"%PDF-" + b"0" * (10 * 1024 * 1024 + 100)

    response = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("oversized.pdf", oversized_content, "application/pdf")},
        headers=student_headers,
    )
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()


def test_student_can_view_own_submission(client, test_setup, student_headers):
    """Verify student can view their own submission status via GET /submissions/me."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"

    client.post(
        f"/api/assignments/{assignment_id}/submissions",
        data={"notes": "Final revision"},
        files={"file": ("my_work.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )

    response = client.get(
        f"/api/assignments/{assignment_id}/submissions/me",
        headers=student_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["assignment_id"] == assignment_id
    assert data["file_name"] == "my_work.pdf"
    assert data["notes"] == "Final revision"
    assert data["is_late"] is False


def test_student_cannot_download_other_student_submission(client, db_engine, test_setup, student_headers):
    """Verify a student cannot download another student's submitted file (returns 403)."""
    assignment_id = test_setup["assignment_id"]
    class_id = test_setup["class_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Author (Student A) >>\nendobj\n%%EOF"

    # Student A submits work
    submit_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("student_a.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    submission_id = submit_res.json()["id"]

    # Create Student B, enrolled in the same class
    with Session(db_engine) as session:
        b_email = f"student_b_{uuid.uuid4().hex[:6]}@example.com"
        student_b = User(
            email=b_email,
            full_name="Gwen Stacy",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add(student_b)
        session.commit()
        session.refresh(student_b)

        enrollment = ClassEnrollment(class_id=class_id, student_id=student_b.id)
        session.add(enrollment)
        session.commit()

        b_token = create_access_token({
            "sub": str(student_b.id),
            "role": "student",
            "email": b_email,
        })

    # Student B attempts to download Student A's submission
    download_res = client.get(
        f"/api/assignments/{assignment_id}/submissions/{submission_id}/download",
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert download_res.status_code == 403
    assert "cannot download another student" in download_res.json()["detail"].lower()


def test_unauthorized_teacher_cannot_view_or_download_submissions(client, db_engine, test_setup, student_headers):
    """Verify another teacher who does not own the class/assignment is denied (returns 403)."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"

    submit_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("student_work.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    submission_id = submit_res.json()["id"]

    # Create a different teacher
    with Session(db_engine) as session:
        other_teacher_email = f"prof_other_{uuid.uuid4().hex[:6]}@example.com"
        other_teacher = User(
            email=other_teacher_email,
            full_name="Prof. Charles Xavier",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        session.add(other_teacher)
        session.commit()
        session.refresh(other_teacher)

        other_teacher_token = create_access_token({
            "sub": str(other_teacher.id),
            "role": "teacher",
            "email": other_teacher_email,
        })
        other_teacher_headers = {"Authorization": f"Bearer {other_teacher_token}"}

    # Other teacher attempts to list submissions
    list_res = client.get(
        f"/api/assignments/{assignment_id}/submissions",
        headers=other_teacher_headers,
    )
    assert list_res.status_code == 403
    assert "access denied" in list_res.json()["detail"].lower()

    # Other teacher attempts to download submission
    dl_res = client.get(
        f"/api/assignments/{assignment_id}/submissions/{submission_id}/download",
        headers=other_teacher_headers,
    )
    assert dl_res.status_code == 403
    assert "access denied" in dl_res.json()["detail"].lower()


def test_assignment_owner_can_list_and_download_submissions(client, test_setup, teacher_headers, student_headers):
    """Verify the assignment's creator/teacher can list all submissions and download student files."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Student Solution Final) >>\nendobj\n%%EOF"

    submit_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        data={"notes": "All tests passing."},
        files={"file": ("assignment_solution.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    assert submit_res.status_code == 201
    submission_id = submit_res.json()["id"]

    # Teacher lists submissions
    list_res = client.get(
        f"/api/assignments/{assignment_id}/submissions",
        headers=teacher_headers,
    )
    assert list_res.status_code == 200
    submissions = list_res.json()
    assert len(submissions) >= 1
    target = next((s for s in submissions if s["id"] == submission_id), None)
    assert target is not None
    assert target["file_name"] == "assignment_solution.pdf"
    assert target["student_id"] == test_setup["student_id"]
    assert "file_path" not in target  # Ensure server file path is never exposed

    # Teacher downloads student submission
    dl_res = client.get(
        f"/api/assignments/{assignment_id}/submissions/{submission_id}/download",
        headers=teacher_headers,
    )
    assert dl_res.status_code == 200
    assert dl_res.content == pdf_content


def test_late_submission_handling(client, db_engine, teacher_user, student_user, student_headers):
    """Verify that submissions made after assignment.due_date have is_late == True."""
    with Session(db_engine) as session:
        # Create class & enrollment
        cls = Class(
            name=f"Late Test Class {uuid.uuid4().hex[:4]}",
            join_code=uuid.uuid4().hex[:7].upper(),
            teacher_id=teacher_user["id"],
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)

        session.add(ClassEnrollment(class_id=cls.id, student_id=student_user["id"]))

        # Assignment with due date in the PAST
        past_date = datetime.now(timezone.utc) - timedelta(days=2)
        assignment = Assignment(
            title="Overdue Homework 1",
            subject="History",
            due_date=past_date,
            status="active",
            class_id=cls.id,
            created_by_id=teacher_user["id"],
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        assignment_id = assignment.id

    pdf_content = b"%PDF-1.4\n1 0 obj\nendobj\n%%EOF"
    submit_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files={"file": ("late_homework.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    assert submit_res.status_code == 201
    assert submit_res.json()["is_late"] is True


def test_list_all_submissions_endpoint(client, test_setup, student_headers, teacher_headers):
    """Verify GET /api/submissions returns role-scoped submission summaries for students and teachers."""
    assignment_id = test_setup["assignment_id"]
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"

    # Submit work as student
    submit_res = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        data={"notes": "Final report submission"},
        files={"file": ("report.pdf", pdf_content, "application/pdf")},
        headers=student_headers,
    )
    assert submit_res.status_code == 201

    # Unauthenticated request returns 401
    unauth_res = client.get("/api/submissions")
    assert unauth_res.status_code == 401

    # Student listing returns student's submissions
    student_list_res = client.get("/api/submissions", headers=student_headers)
    assert student_list_res.status_code == 200
    student_subs = student_list_res.json()
    assert isinstance(student_subs, list)
    assert len(student_subs) >= 1
    sub_item = next((s for s in student_subs if s["assignment_id"] == assignment_id), None)
    assert sub_item is not None
    assert sub_item["file_name"] == "report.pdf"
    assert sub_item["notes"] == "Final report submission"
    assert "download_url" in sub_item
    assert "class_name" in sub_item

    # Teacher listing returns student's submission under teacher's assignment
    teacher_list_res = client.get("/api/submissions", headers=teacher_headers)
    assert teacher_list_res.status_code == 200
    teacher_subs = teacher_list_res.json()
    assert isinstance(teacher_subs, list)
    assert len(teacher_subs) >= 1
    teacher_sub_item = next((s for s in teacher_subs if s["assignment_id"] == assignment_id), None)
    assert teacher_sub_item is not None
    assert teacher_sub_item["student_name"] is not None
    assert teacher_sub_item["student_email"] is not None
    assert teacher_sub_item["file_name"] == "report.pdf"

