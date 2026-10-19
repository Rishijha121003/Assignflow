import io
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy import text
from app.core.config import settings
from app.models.assignment import Assignment
from app.models.classroom import Class, Subject, ClassEnrollment
from app.models.submission import Submission


def sample_pdf_bytes():
    """Returns valid minimal PDF bytes starting with %PDF-."""
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000120 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n170\n%%EOF\n"


def test_subject_filtering_by_class(client, teacher_headers):
    """
    Requirements 3, 6:
    When fetching subjects for a class, the response must show ONLY subjects
    associated with that selected class, and not subjects of other classes or global defaults.
    """
    res_a = client.post("/api/classes", json={"name": f"CS Class A {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    assert res_a.status_code == 201
    class_a_id = res_a.json()["id"]

    sub_a1 = client.post(f"/api/classes/{class_a_id}/subjects", json={"name": "Compiler Design"}, headers=teacher_headers)
    assert sub_a1.status_code == 201
    sub_a2 = client.post(f"/api/classes/{class_a_id}/subjects", json={"name": "Computer Networks"}, headers=teacher_headers)
    assert sub_a2.status_code == 201

    res_b = client.post("/api/classes", json={"name": f"EE Class B {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    assert res_b.status_code == 201
    class_b_id = res_b.json()["id"]

    sub_b1 = client.post(f"/api/classes/{class_b_id}/subjects", json={"name": "Digital Signal Processing"}, headers=teacher_headers)
    assert sub_b1.status_code == 201

    try:
        res_subs_a = client.get(f"/api/classes/{class_a_id}/subjects", headers=teacher_headers)
        assert res_subs_a.status_code == 200
        names_a = [s["name"] for s in res_subs_a.json()]
        assert "Compiler Design" in names_a
        assert "Computer Networks" in names_a
        assert "Digital Signal Processing" not in names_a
        assert "Design" not in names_a

        res_subs_b = client.get(f"/api/classes/{class_b_id}/subjects", headers=teacher_headers)
        assert res_subs_b.status_code == 200
        names_b = [s["name"] for s in res_subs_b.json()]
        assert "Digital Signal Processing" in names_b
        assert "Compiler Design" not in names_b
        assert "Computer Networks" not in names_b
    finally:
        client.delete(f"/api/classes/{class_a_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_b_id}", headers=teacher_headers)


def test_reject_subject_not_belonging_to_selected_class(client, teacher_headers):
    """
    Requirements 3, 5, 6:
    Server-side validation must reject assignment creation if subject does not belong to the selected class.
    """
    res_a = client.post("/api/classes", json={"name": f"Class 1 {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class_a_id = res_a.json()["id"]
    res_b = client.post("/api/classes", json={"name": f"Class 2 {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class_b_id = res_b.json()["id"]

    sub_b = client.post(f"/api/classes/{class_b_id}/subjects", json={"name": "Chemistry"}, headers=teacher_headers)
    sub_b_id = sub_b.json()["id"]

    future_due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    try:
        payload = {
            "title": "Mismatched Subject Assignment",
            "subject": "Chemistry",
            "class_id": class_a_id,
            "subject_id": sub_b_id,
            "description": "Solve all problems",
            "max_marks": 50,
            "due_date": future_due,
            "status": "active"
        }
        res = client.post("/api/assignments", json=payload, headers=teacher_headers)
        assert res.status_code in (400, 422)
        assert "mismatched" in res.json()["detail"].lower() or "not associated" in res.json()["detail"].lower()
    finally:
        client.delete(f"/api/classes/{class_a_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_b_id}", headers=teacher_headers)


def test_create_assignment_instructions_only(client, teacher_headers):
    """
    Requirements 3, 6:
    Assignment can be created with Instructions only (no PDF attachment).
    """
    future_due = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    data = {
        "title": "Instructions Only Assignment",
        "subject": "Compiler Design",
        "description": "Please write a 500-word essay on lexical analysis.",
        "max_marks": 20,
        "due_date": future_due,
        "status": "active",
        "allow_late": "true",
        "resubmission_policy": "until_due"
    }
    res = client.post("/api/assignments", data=data, headers=teacher_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["has_attachment"] is False
    assert body["file_name"] is None
    assert body["description"] == "Please write a 500-word essay on lexical analysis."
    assert body["max_marks"] == 20.0
    assert body["allow_late"] is True
    assert body["resubmission_policy"] == "until_due"

    # Cleanup
    client.delete(f"/api/assignments/{body['id']}", headers=teacher_headers)


def test_create_assignment_pdf_only(client, teacher_headers):
    """
    Requirements 3, 6:
    Assignment can be created with Question PDF only (empty instructions).
    """
    future_due = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    data = {
        "title": "PDF Only Assignment",
        "subject": "Digital Logic",
        "description": "",
        "max_marks": 100,
        "due_date": future_due,
        "status": "active",
        "allow_late": "false",
        "resubmission_policy": "teacher_approval"
    }
    files = {
        "file": ("questions_sheet.pdf", sample_pdf_bytes(), "application/pdf")
    }
    res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["has_attachment"] is True
    assert body["file_name"] == "questions_sheet.pdf"
    assert body["description"] == "" or body["description"] is None
    assert body["max_marks"] == 100.0
    assert body["allow_late"] is False
    assert body["resubmission_policy"] == "approval_only"

    # Cleanup
    client.delete(f"/api/assignments/{body['id']}", headers=teacher_headers)


def test_create_assignment_instructions_and_pdf(client, teacher_headers):
    """
    Requirements 3, 6:
    Assignment can be created with both Instructions and Question PDF.
    """
    future_due = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()
    data = {
        "title": "Hybrid Assignment with PDF and Text",
        "subject": "Computer Networks",
        "description": "Read the attached questions carefully and show all work.",
        "max_marks": 75.5,
        "assignment_type": "Unit 2",
        "due_date": future_due,
        "status": "active",
        "allow_late": "true",
        "resubmission_policy": "until_due"
    }
    files = {
        "file": ("unit2_problems.pdf", sample_pdf_bytes(), "application/pdf")
    }
    res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["has_attachment"] is True
    assert body["file_name"] == "unit2_problems.pdf"
    assert body["description"] == "Read the attached questions carefully and show all work."
    assert body["max_marks"] == 75.5
    assert body["assignment_type"] == "Unit 2"

    # Cleanup
    client.delete(f"/api/assignments/{body['id']}", headers=teacher_headers)


def test_neither_instructions_nor_pdf_rejected(client, teacher_headers):
    """
    Requirements 3, 6:
    If neither Instructions nor Question PDF is provided, request is rejected with 400.
    """
    future_due = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    data = {
        "title": "Empty Assignment",
        "subject": "Discrete Mathematics",
        "description": "   ",
        "max_marks": 50,
        "due_date": future_due,
        "status": "active"
    }
    res = client.post("/api/assignments", data=data, headers=teacher_headers)
    assert res.status_code == 400
    assert "at least one of instructions or question pdf is required" in res.json()["detail"].lower()


def test_max_marks_validation(client, teacher_headers):
    """
    Requirements 3, 6:
    Maximum marks must be required, > 0, <= 1000, with at most 2 decimal places.
    """
    future_due = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    base_data = {
        "title": "Marks Validation Test",
        "subject": "Theory of Computation",
        "description": "Valid instructions",
        "due_date": future_due,
        "status": "active"
    }

    # Zero marks
    res = client.post("/api/assignments", data={**base_data, "max_marks": 0}, headers=teacher_headers)
    assert res.status_code in (400, 422)
    assert "maximum marks" in res.json()["detail"].lower()

    # Negative marks
    res = client.post("/api/assignments", data={**base_data, "max_marks": -10}, headers=teacher_headers)
    assert res.status_code in (400, 422)
    assert "maximum marks" in res.json()["detail"].lower()

    # Exceeding upper limit (1000)
    res = client.post("/api/assignments", data={**base_data, "max_marks": 1001}, headers=teacher_headers)
    assert res.status_code in (400, 422)
    assert "cannot exceed 1000" in res.json()["detail"].lower() or "up to 1000" in res.json()["detail"].lower()

    # Valid fractional marks
    res = client.post("/api/assignments", data={**base_data, "max_marks": "33.50"}, headers=teacher_headers)
    assert res.status_code == 201
    client.delete(f"/api/assignments/{res.json()['id']}", headers=teacher_headers)


def test_deadline_validation_publish_vs_draft(client, teacher_headers):
    """
    Requirements 3, 4, 6:
    Publishing requires a valid future deadline.
    Drafts allow past deadlines or incomplete setups.
    """
    past_due = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    base_data = {
        "title": "Deadline Test",
        "subject": "Operating Systems",
        "description": "Some instructions",
        "max_marks": 50,
        "due_date": past_due
    }

    # Publishing with past deadline -> 422/400
    res = client.post("/api/assignments", data={**base_data, "status": "active"}, headers=teacher_headers)
    assert res.status_code in (400, 422)
    assert "future" in res.json()["detail"].lower()

    # Draft with past deadline -> 201 allowed
    res_draft = client.post("/api/assignments", data={**base_data, "status": "draft"}, headers=teacher_headers)
    assert res_draft.status_code == 201
    draft_id = res_draft.json()["id"]
    assert res_draft.json()["status"] == "draft"

    # Cleanup
    client.delete(f"/api/assignments/{draft_id}", headers=teacher_headers)


def test_draft_visibility_privacy_and_student_isolation(client, teacher_headers, student_headers, student_user, db_engine):
    """
    Requirements 4, 5, 6:
    A draft assignment must remain completely hidden from students until published.
    Students cannot fetch, view, or submit to draft assignments.
    """
    res_cls = client.post("/api/classes", json={"name": f"Draft Test Class {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class_id = res_cls.json()["id"]

    # Enroll student in class
    with db_engine.connect() as conn:
        conn.execute(
            text("INSERT INTO assignflow.class_enrollments (class_id, student_id) VALUES (:cid, :sid) ON CONFLICT DO NOTHING"),
            {"cid": class_id, "sid": student_user["id"]}
        )
        conn.commit()

    future_due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    # 2. Create draft assignment
    res_draft = client.post(
        "/api/assignments",
        data={
            "title": "Secret Draft Assignment",
            "subject": "Software Engineering",
            "class_id": class_id,
            "description": "Work in progress questions",
            "max_marks": 50,
            "due_date": future_due,
            "status": "draft"
        },
        headers=teacher_headers
    )
    assert res_draft.status_code == 201
    draft_id = res_draft.json()["id"]

    try:
        # 3. Student list assignments: draft must NOT appear
        res_list = client.get("/api/assignments", headers=student_headers)
        assert res_list.status_code == 200
        student_assign_ids = [a["id"] for a in res_list.json()]
        assert draft_id not in student_assign_ids

        # 4. Student get assignment detail: returns 403 Forbidden
        res_get = client.get(f"/api/assignments/{draft_id}", headers=student_headers)
        assert res_get.status_code == 403

        # 5. Student cannot submit to draft: returns 400
        sub_files = {"file": ("my_submission.pdf", sample_pdf_bytes(), "application/pdf")}
        res_sub = client.post(f"/api/assignments/{draft_id}/submissions", files=sub_files, headers=student_headers)
        assert res_sub.status_code == 400
        assert "draft" in res_sub.json()["detail"].lower()

        # 6. Teacher CAN see draft assignment
        res_t_get = client.get(f"/api/assignments/{draft_id}", headers=teacher_headers)
        assert res_t_get.json()["status"] == "draft"

    finally:
        client.delete(f"/api/assignments/{draft_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_late_submission_policy_enforced(client, teacher_headers, student_headers, student_user, db_engine):
    """
    Requirements 3, 5, 6:
    When allow_late is False, student submission after deadline must be rejected with 400.
    """
    res_cls = client.post("/api/classes", json={"name": f"Policy Class {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class_id = res_cls.json()["id"]

    with db_engine.connect() as conn:
        conn.execute(
            text("INSERT INTO assignflow.class_enrollments (class_id, student_id) VALUES (:cid, :sid) ON CONFLICT DO NOTHING"),
            {"cid": class_id, "sid": student_user["id"]}
        )
        conn.commit()

    # Create published assignment with allow_late=False
    future_due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    res_a = client.post(
        "/api/assignments",
        data={
            "title": "Strict Deadline Assignment",
            "subject": "Algorithm Analysis",
            "class_id": class_id,
            "description": "No late submissions allowed.",
            "max_marks": 100,
            "due_date": future_due,
            "status": "active",
            "allow_late": "false"
        },
        headers=teacher_headers
    )
    assert res_a.status_code == 201
    assign_id = res_a.json()["id"]

    try:
        # Move due date to the past in DB to simulate overdue state
        past_time = datetime.now(timezone.utc) - timedelta(hours=2)
        with db_engine.connect() as conn:
            conn.execute(
                text("UPDATE assignflow.assignments SET due_date = :dt WHERE id = :id"),
                {"dt": past_time, "id": assign_id}
            )
            conn.commit()

        # Student submits after deadline: must be rejected
        files = {"file": ("late_sub.pdf", sample_pdf_bytes(), "application/pdf")}
        res_sub = client.post(f"/api/assignments/{assign_id}/submissions", files=files, headers=student_headers)
        assert res_sub.status_code == 400
        assert "late submissions are not accepted" in res_sub.json()["detail"].lower()

    finally:
        client.delete(f"/api/assignments/{assign_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_prevent_class_subject_change_with_submissions(client, teacher_headers, student_headers, student_user, db_engine):
    """
    Requirements 4, 5, 6:
    When editing an assignment that already has student submissions,
    changing class_id or subject_id must be rejected to prevent orphaned records.
    """
    res_c1 = client.post("/api/classes", json={"name": f"Orig Class {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class1_id = res_c1.json()["id"]
    res_c2 = client.post("/api/classes", json={"name": f"Target Class {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class2_id = res_c2.json()["id"]

    with db_engine.connect() as conn:
        conn.execute(
            text("INSERT INTO assignflow.class_enrollments (class_id, student_id) VALUES (:cid, :sid) ON CONFLICT DO NOTHING"),
            {"cid": class1_id, "sid": student_user["id"]}
        )
        conn.commit()

    future_due = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    res_assign = client.post(
        "/api/assignments",
        data={
            "title": "Submissions Locked Assignment",
            "subject": "Data Mining",
            "class_id": class1_id,
            "description": "Complete all tasks",
            "max_marks": 50,
            "due_date": future_due,
            "status": "active"
        },
        headers=teacher_headers
    )
    assign_id = res_assign.json()["id"]

    try:
        # Student submits
        files = {"file": ("student_submission.pdf", sample_pdf_bytes(), "application/pdf")}
        sub_res = client.post(f"/api/assignments/{assign_id}/submissions", files=files, headers=student_headers)
        assert sub_res.status_code == 201

        # Teacher attempts to change class_id to class2_id
        update_res = client.patch(
            f"/api/assignments/{assign_id}",
            json={"class_id": class2_id},
            headers=teacher_headers
        )
        assert update_res.status_code == 400
        assert "cannot change the class" in update_res.json()["detail"].lower()

    finally:
        with db_engine.connect() as conn:
            conn.execute(
                text("DELETE FROM assignflow.submissions WHERE assignment_id = :id"),
                {"id": assign_id}
            )
            conn.commit()
        client.delete(f"/api/assignments/{assign_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class1_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class2_id}", headers=teacher_headers)


def test_failed_upload_safe_rollback_no_orphaned_assignment_or_file(client, teacher_headers):
    """
    Requirements 4, 5, 6:
    If file upload fails validation (e.g. invalid magic bytes),
    safe rollback ensures neither database assignment nor orphaned file is stored.
    """
    future_due = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    data = {
        "title": "Corrupt Upload Test",
        "subject": "Computer Architecture",
        "description": "Will fail file validation",
        "max_marks": 100,
        "due_date": future_due,
        "status": "active"
    }
    corrupt_files = {
        "file": ("corrupt.pdf", b"NOT A VALID PDF FILE AT ALL", "application/pdf")
    }

    files_before = set(settings.UPLOAD_DIR.glob("*"))

    res = client.post("/api/assignments", data=data, files=corrupt_files, headers=teacher_headers)
    assert res.status_code == 400
    assert "valid pdf" in res.json()["detail"].lower()

    # Check disk has no orphaned file
    files_after = set(settings.UPLOAD_DIR.glob("*"))
    assert files_before == files_after


def test_frontend_drawer_modal_structure_and_controls(client):
    """
    Requirements 2, 4, 6:
    Verify the frontend HTML includes all UI controls from reference image:
    - 2-column class & semester row with lock icons
    - Subject dropdown with lock icon
    - Title with unit 1 placeholder
    - Controlled Unit / Assessment dropdown
    - Description textarea with line break support
    - Max marks & Due Date 2-column row
    - PDF dropzone and selected-file preview card with remove button
    - Side-by-side policy cards with custom radio controls
    - Explicit Save as Draft and Create/Publish Assignment buttons
    """
    res = client.get("/")
    assert res.status_code == 200
    html = res.text

    # Modal header and subtitles
    assert 'id="drawerTitle"' in html
    assert 'id="drawerSubtitle"' in html
    assert 'id="drawerCloseBtn"' in html

    # Class & Semester row
    assert 'id="formClass"' in html
    assert 'id="formSemesterDisplay"' in html
    assert 'id="classLockIcon"' in html
    assert 'id="semesterLockIcon"' in html

    # Subject row
    assert 'id="formSubject"' in html
    assert 'id="subjectLockIcon"' in html
    assert 'id="subjectEmptyState"' in html

    # Title & Unit
    assert 'id="formTitle"' in html
    assert 'placeholder="Enter assignment title (e.g., Unit 1 — Lexical Analysis)"' in html
    assert 'id="formUnit"' in html

    # Description
    assert 'id="formDescription"' in html
    assert 'id="descriptionError"' in html

    # Max Marks & Due Date
    assert 'id="formMaxMarks"' in html
    assert 'id="maxMarksError"' in html
    assert 'id="formDueDate"' in html
    assert 'id="dueDateError"' in html

    # Question PDF dropzone and preview card
    assert 'id="fileDropzone"' in html
    assert 'id="selectedFileCard"' in html
    assert 'id="selectedFileName"' in html
    assert 'id="selectedFileSize"' in html
    assert 'id="removeAttachmentBtn"' in html

    # Policy cards
    assert 'name="latePolicy"' in html
    assert 'name="resubmissionPolicy"' in html

    # Footer actions
    assert 'id="drawerCancelBtn"' in html
    assert 'id="drawerDraftBtn"' in html
    assert 'id="drawerSubmitBtn"' in html
    assert 'id="submitBtnText"' in html
    assert 'Publish Assignment' in html

    # Safe defaults
    assert 'id="lateReject"' in html
    assert 'id="resubApproval"' in html
    assert 'checked' in html  # radio defaults checked
    assert 'id="dueDateTzLabel"' in html


def test_class_semester_relationship_enforcement(client, teacher_headers):
    """
    Requirements 1, 6:
    Assignment saved with class must inherit that class's true semester_id.
    Teacher sending mismatched semester_id for a semester-linked class must be corrected to class's semester.
    """
    # 1. Create a semester
    sem_res = client.post("/api/semesters", json={
        "name": f"Semester Test {uuid.uuid4().hex[:4]}",
        "semester_number": 5,
        "academic_year": "2025 - 2026",
        "start_date": "2025-07-01",
        "end_date": "2025-12-31",
        "status": "active",
        "type": "odd"
    }, headers=teacher_headers)
    assert sem_res.status_code == 201
    sem_id = sem_res.json()["id"]

    # 2. Create class linked to semester
    cls_res = client.post("/api/classes", json={
        "name": f"Linked Class {uuid.uuid4().hex[:6]}",
        "semester_id": sem_id
    }, headers=teacher_headers)
    assert cls_res.status_code == 201
    class_id = cls_res.json()["id"]

    sub_res = client.post(f"/api/classes/{class_id}/subjects", json={"name": "Database Systems"}, headers=teacher_headers)
    assert sub_res.status_code == 201

    future_due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    try:
        # Create assignment passing matching class_id
        res_a = client.post("/api/assignments", json={
            "title": "Semester Linked Assignment",
            "subject": "Database Systems",
            "class_id": class_id,
            "description": "Perform normalizations",
            "max_marks": 50,
            "due_date": future_due,
            "status": "active"
        }, headers=teacher_headers)
        assert res_a.status_code == 201
        data = res_a.json()
        assert data["class_id"] == class_id
        assert data["semester_id"] == sem_id

        # If a mismatched semester_id is explicitly sent, backend rejects it with 422
        res_mismatch = client.post("/api/assignments", json={
            "title": "Mismatch Semester Assignment",
            "subject": "Database Systems",
            "class_id": class_id,
            "semester_id": 999999,
            "description": "Perform normalizations",
            "max_marks": 50,
            "due_date": future_due,
            "status": "active"
        }, headers=teacher_headers)
        assert res_mismatch.status_code in (400, 422)
        assert "belongs to semester" in res_mismatch.json()["detail"].lower()

        client.delete(f"/api/assignments/{data['id']}", headers=teacher_headers)
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)
        client.delete(f"/api/semesters/{sem_id}", headers=teacher_headers)


def test_independent_class_without_semester(client, teacher_headers):
    """
    Requirements 1, 6:
    When a class has no semester (independent class):
    - Submitting semester_id=None persists semester_id=None.
    - If a non-null semester_id is passed for an independent class, backend rejects it with 400.
    """
    cls_res = client.post("/api/classes", json={
        "name": f"Independent Class {uuid.uuid4().hex[:6]}"
    }, headers=teacher_headers)
    assert cls_res.status_code == 201
    class_id = cls_res.json()["id"]

    sub_res = client.post(f"/api/classes/{class_id}/subjects", json={"name": "Independent Elective"}, headers=teacher_headers)
    assert sub_res.status_code == 201

    future_due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    try:
        # Create assignment with semester_id=None
        res_a = client.post("/api/assignments", json={
            "title": "Independent Class Assignment",
            "subject": "Independent Elective",
            "class_id": class_id,
            "semester_id": None,
            "description": "Independent study work",
            "max_marks": 100,
            "due_date": future_due,
            "status": "active"
        }, headers=teacher_headers)
        assert res_a.status_code == 201
        data = res_a.json()
        assert data["class_id"] == class_id
        assert data["semester_id"] is None
        client.delete(f"/api/assignments/{data['id']}", headers=teacher_headers)

        # Attempting to assign a semester to an independent class must be rejected
        res_bad = client.post("/api/assignments", json={
            "title": "Bad Semester Assignment",
            "subject": "Independent Elective",
            "class_id": class_id,
            "semester_id": 80,
            "description": "Should fail",
            "max_marks": 100,
            "due_date": future_due,
            "status": "active"
        }, headers=teacher_headers)
        assert res_bad.status_code in (400, 422)
        assert "independent" in res_bad.json()["detail"].lower() or "does not belong" in res_bad.json()["detail"].lower()
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_resubmission_policy_approval_only_blocks_duplicate(client, teacher_headers, student_headers, student_user, db_engine):
    """
    Requirement 3:
    When resubmission_policy="approval_only" (default):
    - First submission succeeds.
    - Second submission attempt before deadline is rejected with 400.
    """
    cls_res = client.post("/api/classes", json={"name": f"Class Approval {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class_id = cls_res.json()["id"]

    with db_engine.connect() as conn:
        conn.execute(
            text("INSERT INTO assignflow.class_enrollments (class_id, student_id) VALUES (:cid, :sid) ON CONFLICT DO NOTHING"),
            {"cid": class_id, "sid": student_user["id"]}
        )
        conn.commit()

    future_due = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    res_a = client.post("/api/assignments", json={
        "title": "Single Submission Assignment",
        "subject": "Computer Networks",
        "class_id": class_id,
        "description": "Approval only test",
        "max_marks": 50,
        "due_date": future_due,
        "status": "active",
        "resubmission_policy": "approval_only"
    }, headers=teacher_headers)
    assert res_a.status_code == 201
    assign_id = res_a.json()["id"]

    try:
        # First submission
        files1 = {"file": ("sub1.pdf", sample_pdf_bytes(), "application/pdf")}
        res_sub1 = client.post(f"/api/assignments/{assign_id}/submissions", files=files1, headers=student_headers)
        assert res_sub1.status_code == 201

        # Second submission must be rejected
        files2 = {"file": ("sub2.pdf", sample_pdf_bytes(), "application/pdf")}
        res_sub2 = client.post(f"/api/assignments/{assign_id}/submissions", files=files2, headers=student_headers)
        assert res_sub2.status_code == 400
        assert "teacher authorization" in res_sub2.json()["detail"].lower() or "already submitted" in res_sub2.json()["detail"].lower()
    finally:
        client.delete(f"/api/assignments/{assign_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_resubmission_policy_until_due_replaces_ungraded_and_blocks_graded_or_overdue(client, teacher_headers, student_headers, student_user, db_engine):
    """
    Requirement 3:
    When resubmission_policy="until_due":
    - Ungraded attempt before deadline can be replaced safely (old file cleaned up).
    - If assignment has been graded, resubmission is blocked with 400.
    - If deadline has passed, resubmission is blocked with 400.
    """
    cls_res = client.post("/api/classes", json={"name": f"Class Resub {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    class_id = cls_res.json()["id"]

    with db_engine.connect() as conn:
        conn.execute(
            text("INSERT INTO assignflow.class_enrollments (class_id, student_id) VALUES (:cid, :sid) ON CONFLICT DO NOTHING"),
            {"cid": class_id, "sid": student_user["id"]}
        )
        conn.commit()

    future_due = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    res_a = client.post("/api/assignments", json={
        "title": "Flexible Resubmission Assignment",
        "subject": "Web Tech",
        "class_id": class_id,
        "description": "Until due policy test",
        "max_marks": 100,
        "due_date": future_due,
        "status": "active",
        "resubmission_policy": "until_due"
    }, headers=teacher_headers)
    assert res_a.status_code == 201
    assign_id = res_a.json()["id"]

    try:
        # First submission
        pdf1 = sample_pdf_bytes()
        files1 = {"file": ("attempt1.pdf", pdf1, "application/pdf")}
        res_sub1 = client.post(f"/api/assignments/{assign_id}/submissions", files=files1, headers=student_headers)
        assert res_sub1.status_code == 201
        sub1_id = res_sub1.json()["id"]

        with db_engine.connect() as conn:
            row = conn.execute(text("SELECT file_path FROM assignflow.submissions WHERE id = :id"), {"id": sub1_id}).fetchone()
            sub1_path = Path(row[0])
        assert sub1_path.exists()

        # Second submission before deadline: replaces first submission
        pdf2 = sample_pdf_bytes()
        files2 = {"file": ("attempt2.pdf", pdf2, "application/pdf")}
        res_sub2 = client.post(f"/api/assignments/{assign_id}/submissions", files=files2, headers=student_headers)
        assert res_sub2.status_code in (200, 201)
        sub2_id = res_sub2.json()["id"]
        assert sub2_id == sub1_id
        assert res_sub2.json()["file_name"] == "attempt2.pdf"
        assert not sub1_path.exists()  # Old file deleted

        # Now simulate graded submission: resubmission must be blocked
        with db_engine.connect() as conn:
            conn.execute(
                text("UPDATE assignflow.submissions SET grade = 95.0, status = 'graded' WHERE id = :id"),
                {"id": sub2_id}
            )
            conn.commit()

        files3 = {"file": ("attempt3.pdf", sample_pdf_bytes(), "application/pdf")}
        res_sub3 = client.post(f"/api/assignments/{assign_id}/submissions", files=files3, headers=student_headers)
        assert res_sub3.status_code == 400
        assert "graded" in res_sub3.json()["detail"].lower()

        # Reset grade, move deadline to past: resubmission must be blocked
        with db_engine.connect() as conn:
            conn.execute(
                text("UPDATE assignflow.submissions SET grade = NULL, status = 'submitted' WHERE id = :id"),
                {"id": sub2_id}
            )
            past_due = datetime.now(timezone.utc) - timedelta(hours=1)
            conn.execute(
                text("UPDATE assignflow.assignments SET due_date = :dt WHERE id = :id"),
                {"dt": past_due, "id": assign_id}
            )
            conn.commit()

        files4 = {"file": ("attempt4.pdf", sample_pdf_bytes(), "application/pdf")}
        res_sub4 = client.post(f"/api/assignments/{assign_id}/submissions", files=files4, headers=student_headers)
        assert res_sub4.status_code == 400
        assert "due date" in res_sub4.json()["detail"].lower()

    finally:
        client.delete(f"/api/assignments/{assign_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_draft_without_instructions_and_pdf_lifecycle(client, teacher_headers, student_headers, student_user, db_engine):
    """
    Phase 2 Test:
    1. Saving a draft without instructions and without question PDF succeeds.
    2. Incomplete draft remains hidden from enrolled students.
    3. Updating a draft without instructions and without question PDF succeeds.
    4. Publishing an incomplete draft without instructions or PDF fails with 400.
    5. Publishing with valid instructions succeeds and becomes visible to students.
    """
    # Create class and enroll student
    cls_res = client.post("/api/classes", json={"name": f"Draft Lifecycle Class {uuid.uuid4().hex[:6]}"}, headers=teacher_headers)
    assert cls_res.status_code == 201
    class_id = cls_res.json()["id"]

    sub_res = client.post(f"/api/classes/{class_id}/subjects", json={"name": "Software Engineering"}, headers=teacher_headers)
    assert sub_res.status_code == 201

    join_code = cls_res.json()["join_code"]
    join_res = client.post("/api/classes/join", json={"join_code": join_code}, headers=student_headers)
    assert join_res.status_code == 200

    future_due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    assign_id = None
    try:
        # 1. Create draft with NO instructions and NO question PDF
        draft_payload = {
            "title": "Incomplete Draft Assignment",
            "subject": "Software Engineering",
            "class_id": str(class_id),
            "description": "   ",  # empty/whitespace
            "max_marks": "50",
            "due_date": future_due,
            "status": "draft",
        }
        create_res = client.post("/api/assignments", data=draft_payload, headers=teacher_headers)
        assert create_res.status_code == 201
        draft_data = create_res.json()
        assign_id = draft_data["id"]
        assert draft_data["status"] == "draft"
        assert draft_data["description"] is None
        assert draft_data["file_name"] is None

        # 2. Student cannot see the incomplete draft
        student_list_res = client.get(f"/api/assignments?class_id={class_id}", headers=student_headers)
        assert student_list_res.status_code == 200
        student_assign_ids = [a["id"] for a in student_list_res.json()]
        assert assign_id not in student_assign_ids

        student_get_res = client.get(f"/api/assignments/{assign_id}", headers=student_headers)
        assert student_get_res.status_code == 403

        # 3. Teacher can update draft title/marks while still incomplete
        update_draft_res = client.put(
            f"/api/assignments/{assign_id}",
            data={
                "title": "Updated Draft Title",
                "status": "draft",
                "max_marks": "75",
            },
            headers=teacher_headers,
        )
        assert update_draft_res.status_code == 200
        assert update_draft_res.json()["title"] == "Updated Draft Title"
        assert update_draft_res.json()["max_marks"] == 75.0
        assert update_draft_res.json()["status"] == "draft"

        # 4. Attempting to PUBLISH without instructions or PDF must fail with 400
        publish_fail_res = client.put(
            f"/api/assignments/{assign_id}",
            data={"status": "active"},
            headers=teacher_headers,
        )
        assert publish_fail_res.status_code == 400
        assert "at least one of instructions or question pdf is required" in publish_fail_res.json()["detail"].lower()

        # 5. Publishing by providing instructions succeeds
        publish_success_res = client.put(
            f"/api/assignments/{assign_id}",
            data={
                "status": "active",
                "description": "Complete Chapter 4 architectural review.",
            },
            headers=teacher_headers,
        )
        assert publish_success_res.status_code == 200
        published_data = publish_success_res.json()
        assert published_data["status"] == "active"
        assert published_data["description"] == "Complete Chapter 4 architectural review."

        # 6. Student can now see the published assignment
        student_list_published = client.get(f"/api/assignments?class_id={class_id}", headers=student_headers)
        assert student_list_published.status_code == 200
        published_ids = [a["id"] for a in student_list_published.json()]
        assert assign_id in published_ids

    finally:
        if assign_id:
            client.delete(f"/api/assignments/{assign_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_frontend_subject_starts_disabled_with_placeholder(client):
    """
    Phase 1 Test:
    Verify that in frontend index.html and app.js:
    - formSubject initially renders with 'Select a class first' placeholder.
    - loadClassSubjects(null) disables formSubject until a class is selected.
    - changing classes clears previously selected subject and dynamic options.
    """
    res = client.get("/")
    assert res.status_code == 200
    html = res.text
    assert '<select id="formSubject" class="form-input" required>' in html
    assert '<option value="" disabled selected>Select a class first</option>' in html

    js_res = client.get("/js/app.js")
    assert js_res.status_code == 200
    js = js_res.text
    assert "elements.formSubject.innerHTML = '<option value=\"\" disabled selected>Select a class first</option>'" in js
    assert "elements.formSubject.disabled = true" in js

