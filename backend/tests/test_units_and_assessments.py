import io
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.classroom import Class, ClassEnrollment
from app.models.assignment import Assignment
from app.core.security import hash_password, create_access_token


@pytest.fixture
def unique_prefix():
    return uuid.uuid4().hex[:8]


@pytest.fixture
def setup_teacher_and_student(db_engine, unique_prefix):
    """Creates a teacher, a student, and a class with enrollment."""
    with Session(db_engine) as session:
        teacher = User(
            email=f"teacher_unit_{unique_prefix}@assignflow.test",
            full_name="Prof. Unit Tester",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        student_enrolled = User(
            email=f"student_enrolled_{unique_prefix}@assignflow.test",
            full_name="Enrolled Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        student_outsider = User(
            email=f"student_outsider_{unique_prefix}@assignflow.test",
            full_name="Outsider Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([teacher, student_enrolled, student_outsider])
        session.commit()
        session.refresh(teacher)
        session.refresh(student_enrolled)
        session.refresh(student_outsider)

        classroom = Class(
            name=f"CS Unit Test Class {unique_prefix}",
            description="Testing dynamic units",
            join_code=f"U{unique_prefix[:6].upper()}",
            teacher_id=teacher.id,
        )
        session.add(classroom)
        session.commit()
        session.refresh(classroom)

        enrollment = ClassEnrollment(
            class_id=classroom.id,
            student_id=student_enrolled.id,
        )
        session.add(enrollment)
        session.commit()

        teacher_id = teacher.id
        student_enrolled_id = student_enrolled.id
        student_outsider_id = student_outsider.id
        class_id = classroom.id

        teacher_token = create_access_token({"sub": str(teacher.id), "role": "teacher", "email": teacher.email})
        enrolled_token = create_access_token({"sub": str(student_enrolled.id), "role": "student", "email": student_enrolled.email})
        outsider_token = create_access_token({"sub": str(student_outsider.id), "role": "student", "email": student_outsider.email})

    return {
        "teacher_id": teacher_id,
        "teacher_headers": {"Authorization": f"Bearer {teacher_token}"},
        "student_enrolled_id": student_enrolled_id,
        "enrolled_headers": {"Authorization": f"Bearer {enrolled_token}"},
        "student_outsider_id": student_outsider_id,
        "outsider_headers": {"Authorization": f"Bearer {outsider_token}"},
        "class_id": class_id,
    }


def make_sample_pdf():
    return (b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", "assessment_doc.pdf", "application/pdf")


def test_create_assessment_with_unit_success(client, setup_teacher_and_student):
    """Verify teacher can create an assessment organized by class, subject, unit, max marks, and deadline."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    response = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Data Structures Unit 1 Assignment",
            "subject": "Data Structures",
            "description": "Complete all binary tree problems.",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "75.5",
            "unit": "1",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Data Structures Unit 1 Assignment"
    assert data["subject"] == "Data Structures"
    assert data["unit"] == 1
    assert data["max_marks"] == 75.5
    assert data["class_id"] == ctx["class_id"]


def test_duplicate_unit_assessment_in_same_class_and_subject_rejected(client, setup_teacher_and_student):
    """Requirement 2: Each unit contains one assessment for v0.2.0. Duplicate unit in same class & subject must return 409."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # 1. First assessment for Unit 2
    res1 = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Algorithms Unit 2 Assessment",
            "subject": "Algorithms",
            "description": "Sorting algorithms.",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "50",
            "unit": "2",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res1.status_code == 201

    # 2. Duplicate assessment for Unit 2 in same class and subject
    res2 = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Algorithms Unit 2 Duplicate Attempt",
            "subject": "Algorithms",
            "description": "Attempting second assessment in unit 2.",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "100",
            "unit": "2",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res2.status_code == 409, res2.text
    assert "already exists for Unit 2" in res2.json()["detail"]


def test_different_unit_or_different_subject_in_same_class_allowed(client, setup_teacher_and_student):
    """Verify different units in same subject and same unit in different subjects are allowed."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # Unit 3 in Algorithms
    res_unit3 = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Algorithms Unit 3 Assessment",
            "subject": "Algorithms",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "100",
            "unit": "3",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_unit3.status_code == 201

    # Unit 3 in a different subject (Database Systems)
    res_db_unit3 = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "DBMS Unit 3 Assessment",
            "subject": "Database Systems",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "100",
            "unit": "3",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_db_unit3.status_code == 201


def test_student_scoping_sees_only_enrolled_class_assessments(client, setup_teacher_and_student):
    """Requirement 4: Students must see only assessments relevant to their enrolled class."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # Create assessment in class
    create_res = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Enrolled Scoping Assessment",
            "subject": "Operating Systems",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "60",
            "unit": "4",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    # Enrolled student can see it
    res_enrolled = client.get(
        f"/api/assignments?class_id={ctx['class_id']}",
        headers=ctx["enrolled_headers"],
    )
    assert res_enrolled.status_code == 200
    ids = [a["id"] for a in res_enrolled.json()]
    assert created_id in ids

    # Non-enrolled student cannot access class list
    res_outsider = client.get(
        f"/api/assignments?class_id={ctx['class_id']}",
        headers=ctx["outsider_headers"],
    )
    assert res_outsider.status_code == 403


def test_filter_by_subject_and_unit(client, setup_teacher_and_student):
    """Verify filtering by subject and unit parameters works as expected."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Networking Unit 5",
            "subject": "Networking",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "80",
            "unit": "5",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )

    # Filter by subject
    res_subj = client.get(
        f"/api/assignments?class_id={ctx['class_id']}&subject=Networking",
        headers=ctx["enrolled_headers"],
    )
    assert res_subj.status_code == 200
    for a in res_subj.json():
        assert a["subject"] == "Networking"

    # Filter by unit
    res_unit = client.get(
        f"/api/assignments?class_id={ctx['class_id']}&unit=5",
        headers=ctx["enrolled_headers"],
    )
    assert res_unit.status_code == 200
    for a in res_unit.json():
        assert a["unit"] == 5


def test_assessment_structure_hierarchical_endpoint(client, setup_teacher_and_student):
    """Verify /structure/units returns the Class -> Subject -> Unit hierarchy."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Hierarchical Structure Assessment",
            "subject": "Computer Architecture",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "100",
            "unit": "1",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )

    res = client.get(
        f"/api/assignments/structure/units?class_id={ctx['class_id']}",
        headers=ctx["teacher_headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    class_entry = data[0]
    assert "class_name" in class_entry
    assert "subjects" in class_entry
    assert len(class_entry["subjects"]) >= 1
    for subj in class_entry["subjects"]:
        assert "subject" in subj
        assert "units" in subj
        for u in subj["units"]:
            assert "unit" in u
            assert "title" in u


def test_unit_and_max_marks_validation(client, setup_teacher_and_student):
    """Verify validation: unit must be positive int, max_marks must be positive float."""
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # Invalid unit (0 or negative)
    res_inv_unit = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Invalid Unit Test",
            "subject": "Math",
            "due_date": due_date,
            "unit": "0",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_inv_unit.status_code == 422

    # Invalid max_marks (0 or negative)
    res_inv_marks = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Invalid Marks Test",
            "subject": "Math",
            "due_date": due_date,
            "max_marks": "-10",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_inv_marks.status_code == 422


def test_unassigned_assignment_visibility_private_to_teacher_and_hidden_from_students(client, setup_teacher_and_student):
    """
    Regression Test:
    - Keep unassigned assignments (General / Unassigned, class_id=None) private to the teacher.
    - Students (both enrolled in classes and outsiders) must NOT see unassigned assignments.
    - Direct access attempts to GET, download, or submit against unassigned assignments must return 403 Forbidden.
    """
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # 1. Teacher creates unassigned assignment (class_id omitted / None)
    res_create = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Draft Unit 9 General Assignment",
            "subject": "Computer Science",
            "description": "Unassigned assessment for preparation.",
            "due_date": due_date,
            "max_marks": "100",
            "unit": "9",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_create.status_code == 201, res_create.text
    unassigned_id = res_create.json()["id"]
    assert res_create.json()["class_id"] is None
    assert res_create.json()["class_name"] is None

    # 2. Teacher sees the unassigned assignment in list
    res_teacher = client.get("/api/assignments", headers=ctx["teacher_headers"])
    assert res_teacher.status_code == 200
    teacher_ids = [a["id"] for a in res_teacher.json()]
    assert unassigned_id in teacher_ids

    # 3. Enrolled student does NOT see the unassigned assignment
    res_enrolled = client.get("/api/assignments", headers=ctx["enrolled_headers"])
    assert res_enrolled.status_code == 200
    enrolled_ids = [a["id"] for a in res_enrolled.json()]
    assert unassigned_id not in enrolled_ids

    # 4. Outsider student does NOT see the unassigned assignment
    res_outsider = client.get("/api/assignments", headers=ctx["outsider_headers"])
    assert res_outsider.status_code == 200
    outsider_ids = [a["id"] for a in res_outsider.json()]
    assert unassigned_id not in outsider_ids

    # 5. Direct access to unassigned assignment by student returns 403 Forbidden
    res_direct_enrolled = client.get(f"/api/assignments/{unassigned_id}", headers=ctx["enrolled_headers"])
    assert res_direct_enrolled.status_code == 403
    assert "not enrolled in the class for this assignment" in res_direct_enrolled.json()["detail"]

    res_direct_outsider = client.get(f"/api/assignments/{unassigned_id}", headers=ctx["outsider_headers"])
    assert res_direct_outsider.status_code == 403

    # 6. Direct download of question PDF by student returns 403 Forbidden
    res_dl = client.get(f"/api/assignments/{unassigned_id}/download", headers=ctx["enrolled_headers"])
    assert res_dl.status_code == 403

    # 7. Student submission attempt against unassigned assignment returns 403 Forbidden
    res_sub = client.post(
        f"/api/assignments/{unassigned_id}/submissions",
        headers=ctx["enrolled_headers"],
        files={"file": ("my_submission.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert res_sub.status_code == 403


def test_teacher_assigns_unassigned_assessment_to_class_and_enrolled_student_sees_it(client, setup_teacher_and_student):
    """
    Regression Test:
    - Teacher creates an unassigned assessment (Unit 6, Computer Science).
    - Enrolled student does NOT see it initially.
    - Teacher edits the assignment and sets class_id to the enrolled student's class.
    - After update, enrolled student DOES see Unit 6 with the correct class badge.
    - Outsider student still cannot see it or access it.
    """
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=8)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # 1. Create unassigned assessment
    res_create = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Unit 6 Advanced Algorithms",
            "subject": "Computer Science",
            "due_date": due_date,
            "max_marks": "100",
            "unit": "6",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_create.status_code == 201
    asgn_id = res_create.json()["id"]
    assert res_create.json()["class_id"] is None

    # Enrolled student cannot see it initially
    res_pre = client.get("/api/assignments", headers=ctx["enrolled_headers"])
    assert asgn_id not in [a["id"] for a in res_pre.json()]

    # 2. Teacher edits assignment to assign it to ctx['class_id']
    res_update = client.put(
        f"/api/assignments/{asgn_id}",
        headers=ctx["teacher_headers"],
        data={
            "title": "Unit 6 Advanced Algorithms",
            "subject": "Computer Science",
            "due_date": due_date,
            "max_marks": "100",
            "unit": "6",
            "class_id": str(ctx["class_id"]),
        },
    )
    assert res_update.status_code == 200, res_update.text
    updated_data = res_update.json()
    assert updated_data["class_id"] == ctx["class_id"]
    assert updated_data["class_name"] is not None

    # 3. Enrolled student NOW sees Unit 6
    res_post = client.get("/api/assignments", headers=ctx["enrolled_headers"])
    assert res_post.status_code == 200
    student_assignments = {a["id"]: a for a in res_post.json()}
    assert asgn_id in student_assignments
    assert student_assignments[asgn_id]["unit"] == 6
    assert student_assignments[asgn_id]["class_id"] == ctx["class_id"]
    assert student_assignments[asgn_id]["class_name"] == updated_data["class_name"]

    # 4. Outsider student still CANNOT see it
    res_outsider = client.get("/api/assignments", headers=ctx["outsider_headers"])
    assert asgn_id not in [a["id"] for a in res_outsider.json()]

    # 5. Outsider student direct access is rejected with 403 Forbidden
    res_out_direct = client.get(f"/api/assignments/{asgn_id}", headers=ctx["outsider_headers"])
    assert res_out_direct.status_code == 403


def test_assigning_to_class_enforces_unique_unit_per_class(client, setup_teacher_and_student):
    """
    Regression Test:
    - If a class already has an assessment for Unit 7 in 'Physics'.
    - An unassigned assignment exists for Unit 7 in 'Physics'.
    - Attempting to update the unassigned assignment's class_id to that class must be rejected with 409 Conflict.
    """
    ctx = setup_teacher_and_student
    due_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes, filename, content_type = make_sample_pdf()

    # 1. Create assigned assessment for Unit 7 in Physics
    res1 = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Physics Unit 7 Official",
            "subject": "Physics",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "100",
            "unit": "7",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res1.status_code == 201

    # 2. Create unassigned assessment for Unit 7 in Physics
    res2 = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Physics Unit 7 Draft Unassigned",
            "subject": "Physics",
            "due_date": due_date,
            "max_marks": "100",
            "unit": "7",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res2.status_code == 201
    draft_id = res2.json()["id"]

    # 3. Attempting to assign the draft to ctx['class_id'] must trigger 409 Conflict
    res_conflict = client.put(
        f"/api/assignments/{draft_id}",
        headers=ctx["teacher_headers"],
        data={
            "title": "Physics Unit 7 Draft Unassigned",
            "subject": "Physics",
            "due_date": due_date,
            "class_id": str(ctx["class_id"]),
            "max_marks": "100",
            "unit": "7",
        },
    )
    assert res_conflict.status_code == 409
    assert "already exists for Unit 7 in 'Physics' for this class" in res_conflict.json()["detail"]


def test_teacher_cannot_create_or_edit_assessment_for_other_teachers_class(client, setup_teacher_and_student, db_engine):
    """
    Teacher authorization check:
    - Teacher 1 cannot create an assessment for Teacher 2's class.
    - Teacher 1 cannot edit an assessment to assign it to Teacher 2's class.
    - Teacher 2 cannot edit Teacher 1's assessment.
    """
    ctx = setup_teacher_and_student
    pdf_bytes, filename, content_type = make_sample_pdf()
    due_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

    # Create Teacher 2 with their own class
    with Session(db_engine) as session:
        t2_prefix = uuid.uuid4().hex[:8]
        teacher2 = User(
            email=f"teacher2_{t2_prefix}@assignflow.test",
            full_name="Prof. Other Teacher",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        session.add(teacher2)
        session.commit()
        session.refresh(teacher2)

        class2 = Class(
            name=f"Other Class {t2_prefix}",
            join_code=f"O{t2_prefix[:6].upper()}",
            teacher_id=teacher2.id,
        )
        session.add(class2)
        session.commit()
        session.refresh(class2)

        t2_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(teacher2.id), 'role': 'teacher', 'email': teacher2.email})}"}
        class2_id = class2.id

    # 1. Teacher 1 attempts to create an assessment linked to Teacher 2's class -> 403
    res_unauth_create = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Unauthorized Class Assessment",
            "subject": "Computer Science",
            "due_date": due_date,
            "class_id": str(class2_id),
            "max_marks": "100",
            "unit": "1",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_unauth_create.status_code == 403
    assert "You can only publish assignments to classes you own" in res_unauth_create.json()["detail"]

    # 2. Teacher 1 creates legitimate unassigned assessment
    res_legit = client.post(
        "/api/assignments",
        headers=ctx["teacher_headers"],
        data={
            "title": "Teacher 1 Draft",
            "subject": "Computer Science",
            "due_date": due_date,
            "max_marks": "100",
            "unit": "8",
        },
        files={"file": (filename, io.BytesIO(pdf_bytes), content_type)},
    )
    assert res_legit.status_code == 201
    asgn_id = res_legit.json()["id"]

    # 3. Teacher 1 attempts to update their draft to Teacher 2's class -> 403
    res_unauth_edit = client.put(
        f"/api/assignments/{asgn_id}",
        headers=ctx["teacher_headers"],
        data={
            "title": "Teacher 1 Draft",
            "subject": "Computer Science",
            "due_date": due_date,
            "class_id": str(class2_id),
            "max_marks": "100",
            "unit": "8",
        },
    )
    assert res_unauth_edit.status_code == 403
    assert "You can only publish assignments to classes you own" in res_unauth_edit.json()["detail"]

    # 4. Teacher 2 attempts to edit Teacher 1's assessment -> 403
    res_t2_edit_t1 = client.put(
        f"/api/assignments/{asgn_id}",
        headers=t2_headers,
        data={
            "title": "Hijacked Title",
            "subject": "Computer Science",
            "due_date": due_date,
            "max_marks": "100",
            "unit": "8",
        },
    )
    assert res_t2_edit_t1.status_code == 403
    assert "You can only edit your own assignments" in res_t2_edit_t1.json()["detail"]


