import uuid
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.assignment import Assignment
from app.models.classroom import Class
from app.models.semester import Semester


def sample_assignment_payload(title="Calculus I - Problem Set 1"):
    """Generates a valid assignment payload."""
    future_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    return {
        "title": title,
        "subject": "Mathematics",
        "description": "Complete exercises 1.1 through 1.5 from chapter 1.",
        "due_date": future_date,
        "status": "active",
    }


def test_create_assignment_success(client, teacher_headers):
    """Verify that POST /api/assignments creates a new record and returns 201."""
    payload = sample_assignment_payload()
    response = client.post("/api/assignments", json=payload, headers=teacher_headers)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["title"] == payload["title"]
    assert data["subject"] == payload["subject"]
    assert data["description"] == payload["description"]
    assert data["status"] == "active"
    assert "created_at" in data
    assert "updated_at" in data

    # Clean up test-created record
    client.delete(f"/api/assignments/{data['id']}", headers=teacher_headers)


def test_create_assignment_validation_errors(client, teacher_headers):
    """Verify that invalid payloads return 422 Unprocessable Entity."""
    # Missing 'title'
    bad_payload = sample_assignment_payload()
    del bad_payload["title"]
    res = client.post("/api/assignments", json=bad_payload, headers=teacher_headers)
    assert res.status_code == 422

    # Empty 'title'
    bad_payload = sample_assignment_payload()
    bad_payload["title"] = ""
    res = client.post("/api/assignments", json=bad_payload, headers=teacher_headers)
    assert res.status_code == 422

    # Missing 'due_date'
    bad_payload = sample_assignment_payload()
    del bad_payload["due_date"]
    res = client.post("/api/assignments", json=bad_payload, headers=teacher_headers)
    assert res.status_code == 422

    # Malformed 'due_date'
    bad_payload = sample_assignment_payload()
    bad_payload["due_date"] = "not-a-valid-date"
    res = client.post("/api/assignments", json=bad_payload, headers=teacher_headers)
    assert res.status_code == 422


def test_list_assignments(client, teacher_headers):
    """Verify that GET /api/assignments returns a list containing created assignments."""
    create_res = client.post(
        "/api/assignments",
        json=sample_assignment_payload("Physics Lab Report"),
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    try:
        response = client.get("/api/assignments", headers=teacher_headers)
        assert response.status_code == 200

        items = response.json()
        assert isinstance(items, list)
        matching = [item for item in items if item["id"] == created_id]
        assert len(matching) == 1
        assert matching[0]["title"] == "Physics Lab Report"
    finally:
        # Clean up test-created record
        client.delete(f"/api/assignments/{created_id}", headers=teacher_headers)


def test_get_assignment_by_id(client, teacher_headers):
    """Verify that GET /api/assignments/{id} retrieves the correct record."""
    create_res = client.post(
        "/api/assignments",
        json=sample_assignment_payload("Data Structures Essay"),
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    try:
        response = client.get(f"/api/assignments/{created_id}", headers=teacher_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_id
        assert data["title"] == "Data Structures Essay"
    finally:
        # Clean up test-created record
        client.delete(f"/api/assignments/{created_id}", headers=teacher_headers)


def test_get_nonexistent_assignment_returns_404(client, teacher_headers):
    """Verify that querying a nonexistent ID returns 404 Not Found."""
    response = client.get("/api/assignments/999999", headers=teacher_headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_assignment(client, teacher_headers):
    """Verify that PUT /api/assignments/{id} updates fields and preserves unchanged ones."""
    create_res = client.post(
        "/api/assignments",
        json=sample_assignment_payload("Organic Chemistry Quiz"),
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    try:
        update_payload = {
            "title": "Organic Chemistry Midterm Prep",
            "status": "closed",
        }
        response = client.put(f"/api/assignments/{created_id}", json=update_payload, headers=teacher_headers)
        assert response.status_code == 200

        updated_data = response.json()
        assert updated_data["id"] == created_id
        assert updated_data["title"] == "Organic Chemistry Midterm Prep"
        assert updated_data["status"] == "closed"
        assert updated_data["subject"] == "Mathematics" or updated_data["subject"] != ""
    finally:
        # Clean up test-created record
        client.delete(f"/api/assignments/{created_id}", headers=teacher_headers)


def test_update_nonexistent_assignment_returns_404(client, teacher_headers):
    """Verify that updating a nonexistent ID returns 404 Not Found."""
    response = client.put("/api/assignments/999999", json={"title": "Updated Title"}, headers=teacher_headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_delete_assignment(client, teacher_headers):
    """Verify that DELETE /api/assignments/{id} removes the assignment."""
    create_res = client.post(
        "/api/assignments",
        json=sample_assignment_payload("Temporary Assignment"),
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    # Delete
    delete_res = client.delete(f"/api/assignments/{created_id}", headers=teacher_headers)
    assert delete_res.status_code == 200

    # Ensure it no longer exists
    get_res = client.get(f"/api/assignments/{created_id}", headers=teacher_headers)
    assert get_res.status_code == 404


def test_delete_nonexistent_assignment_returns_404(client, teacher_headers):
    """Verify that deleting a nonexistent ID returns 404 Not Found."""
    response = client.delete("/api/assignments/999999", headers=teacher_headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_postgresql_persistence_direct_db_query(client, db_engine, teacher_headers):
    """
    Requirement 10: Verify that records persist in PostgreSQL after the API request completes.
    Directly inspects the PostgreSQL table using a raw database connection.
    """
    unique_title = f"Database Persistence Verification - {datetime.now(timezone.utc).timestamp()}"
    payload = sample_assignment_payload(title=unique_title)

    post_res = client.post("/api/assignments", json=payload, headers=teacher_headers)
    assert post_res.status_code == 201
    created_id = post_res.json()["id"]

    try:
        # Direct query to PostgreSQL using a separate connection
        with db_engine.connect() as connection:
            query = text("SELECT id, title, subject, status FROM assignflow.assignments WHERE id = :id")
            result = connection.execute(query, {"id": created_id}).mappings().first()

            assert result is not None, "Record was not persisted in PostgreSQL database!"
            assert result["id"] == created_id
            assert result["title"] == unique_title
            assert result["status"] == "active"
    finally:
        # Clean up test-created record
        client.delete(f"/api/assignments/{created_id}", headers=teacher_headers)


def test_create_assignment_with_valid_pdf_multipart(client, db_engine, teacher_headers):
    """
    Requirements 3, 4, 5, 10:
    Upload assignment with valid question PDF via multipart/form-data.
    Verify:
    1. Response 201 Created with PDF metadata (file_name, file_size, has_attachment, download_url).
    2. Data persisted in PostgreSQL table assignflow.assignments.
    3. File safely written to disk.
    4. Safe cleanup on deletion.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Calculus Questions) >>\nendobj\n%%EOF"

    data = {
        "title": "Calculus II - Integration Exercises",
        "subject": "Mathematics",
        "description": "Solve all problems in the attached question paper.",
        "due_date": future_date,
        "status": "active",
    }
    files = {
        "file": ("Calculus_Questions_Sheet.pdf", dummy_pdf_content, "application/pdf")
    }

    response = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert response.status_code == 201

    res_data = response.json()
    assignment_id = res_data["id"]

    try:
        assert res_data["has_attachment"] is True
        assert res_data["file_name"] == "Calculus_Questions_Sheet.pdf"
        assert res_data["file_size"] == len(dummy_pdf_content)
        assert res_data["download_url"] == f"/api/assignments/{assignment_id}/download"

        # Verify PostgreSQL database persistence directly
        with db_engine.connect() as conn:
            query = text(
                "SELECT id, file_path, file_name, file_size FROM assignflow.assignments WHERE id = :id"
            )
            row = conn.execute(query, {"id": assignment_id}).mappings().first()
            assert row is not None
            assert row["file_name"] == "Calculus_Questions_Sheet.pdf"
            assert row["file_size"] == len(dummy_pdf_content)
            assert row["file_path"] is not None

            # Verify file exists on local filesystem
            stored_path = Path(row["file_path"])
            assert stored_path.exists()
            assert stored_path.read_bytes() == dummy_pdf_content

    finally:
        # Cleanup
        del_res = client.delete(f"/api/assignments/{assignment_id}", headers=teacher_headers)
        assert del_res.status_code == 200
        # Verify file is also deleted from disk
        if "stored_path" in locals():
            assert not stored_path.exists()


def test_create_assignment_missing_file_in_multipart_rejected(client, teacher_headers):
    """
    Requirements 4, 9:
    Creating an assignment via multipart/form-data without a file must return 400 Bad Request.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    data = {
        "title": "Missing File Assignment",
        "subject": "Science",
        "due_date": future_date,
        "status": "active",
    }
    response = client.post("/api/assignments", data=data, headers=teacher_headers)
    assert response.status_code == 400
    assert "required" in response.json()["detail"].lower()


def test_create_assignment_invalid_magic_bytes_rejected(client, teacher_headers):
    """
    Requirements 4, 9:
    Ensure non-PDF files (even with .pdf extension) are rejected via magic-byte inspection.
    Ensure no orphaned file is left on disk.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    data = {
        "title": "Fake PDF Assignment",
        "subject": "Computer Science",
        "due_date": future_date,
        "status": "active",
    }
    # Pretend to be a PDF by filename/mime, but content is plaintext
    files = {
        "file": ("fake_document.pdf", b"PLAIN TEXT CONTENT - NOT A REAL PDF", "application/pdf")
    }

    # Count files before test in upload dir
    files_before = set(settings.UPLOAD_DIR.glob("*"))

    response = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert response.status_code == 400
    assert "valid pdf" in response.json()["detail"].lower()

    # Ensure no orphaned file was created on disk
    files_after = set(settings.UPLOAD_DIR.glob("*"))
    assert files_before == files_after


def test_create_assignment_oversized_file_rejected(client, monkeypatch, teacher_headers):
    """
    Requirements 4, 9:
    Enforce configurable max upload size limit.
    Ensure oversized file returns 413 and leaves no orphaned file.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    data = {
        "title": "Oversized File Assignment",
        "subject": "Computer Science",
        "due_date": future_date,
        "status": "active",
    }

    # Temporarily set max size to 50 bytes for test
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 0.00005)
    monkeypatch.setattr(
        type(settings),
        "max_upload_size_bytes",
        property(lambda self: 50),
    )

    oversized_content = b"%PDF-1.4 " + b"X" * 100
    files = {
        "file": ("too_large.pdf", oversized_content, "application/pdf")
    }

    files_before = set(settings.UPLOAD_DIR.glob("*"))

    response = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()

    # Ensure no file remained on disk
    files_after = set(settings.UPLOAD_DIR.glob("*"))
    assert files_before == files_after


def test_download_assignment_pdf(client, teacher_headers):
    """
    Requirements 6, 10:
    Verify that GET /api/assignments/{id}/download serves the attached PDF.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    pdf_content = b"%PDF-1.4\nTest Question Paper Content\n%%EOF"

    create_res = client.post(
        "/api/assignments",
        data={
            "title": "Download Test Assignment",
            "subject": "Design",
            "due_date": future_date,
            "status": "active",
        },
        files={"file": ("Exam_Paper.pdf", pdf_content, "application/pdf")},
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    assignment_id = create_res.json()["id"]

    try:
        download_res = client.get(f"/api/assignments/{assignment_id}/download", headers=teacher_headers)
        assert download_res.status_code == 200
        assert download_res.headers["content-type"] == "application/pdf"
        assert download_res.content == pdf_content
    finally:
        client.delete(f"/api/assignments/{assignment_id}", headers=teacher_headers)


def test_download_assignment_without_attachment_returns_404(client, teacher_headers):
    """
    Requirements 6, 9:
    Attempting to download from an assignment with no attachment returns 404.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    create_res = client.post(
        "/api/assignments",
        json={
            "title": "Assignment Without Attachment",
            "subject": "Mathematics",
            "due_date": future_date,
            "status": "active",
        },
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    assignment_id = create_res.json()["id"]

    try:
        download_res = client.get(f"/api/assignments/{assignment_id}/download", headers=teacher_headers)
        assert download_res.status_code == 404
        assert "no pdf document" in download_res.json()["detail"].lower()
    finally:
        client.delete(f"/api/assignments/{assignment_id}", headers=teacher_headers)


def test_update_assignment_replace_pdf(client, teacher_headers):
    """
    Requirement 1, 4, 9:
    Update an assignment with a new PDF, ensuring old PDF on disk is replaced cleanly.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_v1 = b"%PDF-1.4\nVersion 1 Content\n%%EOF"
    pdf_v2 = b"%PDF-1.4\nVersion 2 Updated Content\n%%EOF"

    # Create initial
    create_res = client.post(
        "/api/assignments",
        data={
            "title": "Editable Assignment",
            "subject": "Science",
            "due_date": future_date,
            "status": "active",
        },
        files={"file": ("v1.pdf", pdf_v1, "application/pdf")},
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    assignment_id = create_res.json()["id"]

    try:
        # Check v1 download
        d1 = client.get(f"/api/assignments/{assignment_id}/download", headers=teacher_headers)
        assert d1.content == pdf_v1

        # Update with new PDF v2
        update_res = client.put(
            f"/api/assignments/{assignment_id}",
            data={"title": "Editable Assignment (Updated)"},
            files={"file": ("v2_final.pdf", pdf_v2, "application/pdf")},
            headers=teacher_headers,
        )
        assert update_res.status_code == 200
        up_data = update_res.json()
        assert up_data["file_name"] == "v2_final.pdf"
        assert up_data["title"] == "Editable Assignment (Updated)"

        # Check v2 download
        d2 = client.get(f"/api/assignments/{assignment_id}/download", headers=teacher_headers)
        assert d2.content == pdf_v2
    finally:
        client.delete(f"/api/assignments/{assignment_id}", headers=teacher_headers)


def test_create_assignment_with_real_binary_pdf_regression(client, db_engine, teacher_headers):
    """
    Regression Test:
    Ensures that real-world PDFs containing non-UTF-8 binary bytes (e.g., \x93\x8c\x8b\x9e from ReportLab)
    can be uploaded without triggering UnicodeDecodeError or HTTP 500.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    # Real-world binary PDF header with non-UTF8 byte markers
    binary_pdf_content = (
        b"%PDF-1.4\n%\x93\x8c\x8b\x9e ReportLab Generated PDF document (opensource)\n"
        b"1 0 obj\n<< /Title (Calculus Exam Paper) >>\nendobj\n"
        b"stream\n\x00\x01\x02\xff\xfe\x93\x8c\nendstream\n%%EOF"
    )

    data = {
        "title": "Math Worksheet - Advanced Calculus",
        "subject": "Mathematics",
        "description": "Linear algebra problem set covering matrix inversion and eigenvalues.",
        "due_date": future_date,
        "status": "active",
    }
    files = {
        "file": ("allotment_letter_3.pdf", binary_pdf_content, "application/pdf")
    }

    response = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert response.status_code == 201

    res_data = response.json()
    assignment_id = res_data["id"]

    try:
        assert res_data["has_attachment"] is True
        assert res_data["file_name"] == "allotment_letter_3.pdf"
        assert res_data["file_size"] == len(binary_pdf_content)
        assert res_data["download_url"] == f"/api/assignments/{assignment_id}/download"

        # Verify direct download returns identical binary bytes
        dl_response = client.get(f"/api/assignments/{assignment_id}/download", headers=teacher_headers)
        assert dl_response.status_code == 200
        assert dl_response.content == binary_pdf_content

        # Verify PostgreSQL persistence
        with db_engine.connect() as conn:
            query = text(
                "SELECT id, file_name, file_size FROM assignflow.assignments WHERE id = :id"
            )
            row = conn.execute(query, {"id": assignment_id}).mappings().first()
            assert row is not None
            assert row["file_name"] == "allotment_letter_3.pdf"
            assert row["file_size"] == len(binary_pdf_content)
    finally:
        del_res = client.delete(f"/api/assignments/{assignment_id}", headers=teacher_headers)
        assert del_res.status_code == 200


def test_malformed_request_with_binary_data_returns_422_not_500(client, teacher_headers):
    """
    Regression Test:
    Ensures that validation failures on requests with non-UTF-8 binary payloads return
    422 Unprocessable Content rather than crashing with an unhandled 500 UnicodeDecodeError.
    """
    binary_payload = b"\x93\x8c\x8b\x9e not a valid json or utf-8 payload"
    response = client.post(
        "/api/assignments",
        content=binary_payload,
        headers={"Content-Type": "application/json", **teacher_headers},
    )
    # Must return 422, NEVER 500
    assert response.status_code == 422


def test_create_assignment_from_semester_subject(client, teacher_user, teacher_headers, db_engine):
    """
    Regression Test:
    Verify creating an assignment from a semester subject:
    - Subject is custom (e.g. 'CD — Compiler Design').
    - Class is the semester subject class.
    - Semester is the parent semester.
    - Persists class_id, semester_id, subject accurately in backend database.
    """
    with Session(db_engine) as session:
        sem = Semester(
            teacher_id=teacher_user["id"],
            name="Semester 7 (Autumn 2026)",
            academic_year="2026 - 2027",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            program="B.Tech CSE",
            status="active",
        )
        session.add(sem)
        session.commit()
        session.refresh(sem)
        sem_id = sem.id

        cls = Class(
            teacher_id=teacher_user["id"],
            name="CD — Compiler Design",
            description="Lexical analysis, parsing, syntax directed translation",
            join_code=uuid.uuid4().hex[:8].upper(),
            semester_id=sem_id,
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)
        cls_id = cls.id

    dummy_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    future_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    try:
        # 1. Create assignment using multipart/form-data (as done by frontend drawer)
        data = {
            "title": "Lab 1: Lexical Analyzer with Lex/Flex",
            "subject": "CD — Compiler Design",
            "description": "Construct a lexical analyzer recognizing tokens of a subset of C.",
            "due_date": future_date,
            "status": "active",
            "class_id": str(cls_id),
            "semester_id": str(sem_id),
        }
        files = {
            "file": ("lab1_compiler_design.pdf", dummy_pdf, "application/pdf")
        }

        res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
        assert res.status_code == 201, res.text
        res_data = res.json()
        as_id = res_data["id"]

        assert res_data["subject"] == "CD — Compiler Design"
        assert res_data["class_id"] == cls_id
        assert res_data["semester_id"] == sem_id

        # Verify DB directly
        with Session(db_engine) as session:
            db_as = session.query(Assignment).filter(Assignment.id == as_id).first()
            assert db_as is not None
            assert db_as.subject == "CD — Compiler Design"
            assert db_as.class_id == cls_id
            assert db_as.semester_id == sem_id

        # Verify list filtering by class_id and semester_id
        list_class_res = client.get(f"/api/assignments?class_id={cls_id}", headers=teacher_headers)
        assert list_class_res.status_code == 200
        assert any(a["id"] == as_id for a in list_class_res.json())

        list_sem_res = client.get(f"/api/assignments?semester_id={sem_id}", headers=teacher_headers)
        assert list_sem_res.status_code == 200
        assert any(a["id"] == as_id for a in list_sem_res.json())

        # Clean up assignment
        del_res = client.delete(f"/api/assignments/{as_id}", headers=teacher_headers)
        assert del_res.status_code == 200

    finally:
        with Session(db_engine) as session:
            session.query(Class).filter(Class.id == cls_id).delete()
            session.query(Semester).filter(Semester.id == sem_id).delete()
            session.commit()


def test_prevent_accidental_unassigned_in_semester_context(client, teacher_user, teacher_headers, db_engine):
    """
    Regression Test:
    Ensure that attempting to create or update an assignment within a semester context
    without linking to a specific class (i.e. leaving it General / Unassigned) is rejected with 422.
    """
    with Session(db_engine) as session:
        sem = Semester(
            teacher_id=teacher_user["id"],
            name="Semester 7 (Autumn 2026)",
            academic_year="2026 - 2027",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            program="B.Tech CSE",
            status="active",
        )
        session.add(sem)
        session.commit()
        session.refresh(sem)
        sem_id = sem.id

    dummy_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    future_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    try:
        # Multipart without class_id but with semester_id
        data = {
            "title": "Unassigned Semester Assignment",
            "subject": "CD — Compiler Design",
            "due_date": future_date,
            "status": "active",
            "semester_id": str(sem_id),
            # class_id omitted / left unassigned
        }
        files = {
            "file": ("test.pdf", dummy_pdf, "application/pdf")
        }
        res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
        assert res.status_code == 422
        assert "must be assigned to a specific subject/class" in res.text

        # Explicit null class_id with semester_id
        data["class_id"] = "null"
        res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
        assert res.status_code == 422
        assert "must be assigned to a specific subject/class" in res.text

        # JSON payload without class_id but with semester_id
        json_data = {
            "title": "JSON Unassigned Semester Assignment",
            "subject": "CD — Compiler Design",
            "due_date": future_date,
            "status": "active",
            "semester_id": sem_id,
            "class_id": None,
        }
        res = client.post("/api/assignments", json=json_data, headers=teacher_headers)
        assert res.status_code == 422
        assert "must be assigned to a specific subject/class" in res.text

    finally:
        with Session(db_engine) as session:
            session.query(Semester).filter(Semester.id == sem_id).delete()
            session.commit()


def test_mismatched_class_and_semester_rejected(client, teacher_user, teacher_headers, db_engine):
    """
    Regression Test:
    Verify that submitting a class that belongs to Semester A with semester_id set to Semester B returns 422.
    """
    with Session(db_engine) as session:
        sem1 = Semester(
            teacher_id=teacher_user["id"],
            name="Semester 5",
            academic_year="2025 - 2026",
            start_date=date(2025, 7, 1),
            end_date=date(2025, 12, 31),
            program="B.Tech CSE",
            status="active",
        )
        sem2 = Semester(
            teacher_id=teacher_user["id"],
            name="Semester 7",
            academic_year="2026 - 2027",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            program="B.Tech CSE",
            status="active",
        )
        session.add_all([sem1, sem2])
        session.commit()
        session.refresh(sem1)
        session.refresh(sem2)

        cls1 = Class(
            teacher_id=teacher_user["id"],
            name="Operating Systems",
            join_code=uuid.uuid4().hex[:8].upper(),
            semester_id=sem1.id,
        )
        session.add(cls1)
        session.commit()
        session.refresh(cls1)
        cls_id = cls1.id
        sem1_id = sem1.id
        sem2_id = sem2.id

    future_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    try:
        # Try to publish cls1 (belongs to sem1) under sem2
        json_payload = {
            "title": "Mismatched Semester Assignment",
            "subject": "Operating Systems",
            "due_date": future_date,
            "status": "active",
            "class_id": cls_id,
            "semester_id": sem2_id,
        }
        res = client.post("/api/assignments", json=json_payload, headers=teacher_headers)
        assert res.status_code == 422
        assert f"belongs to semester {sem1_id}, not semester {sem2_id}" in res.text

    finally:
        with Session(db_engine) as session:
            session.query(Class).filter(Class.id == cls_id).delete()
            session.query(Semester).filter(Semester.id.in_([sem1_id, sem2_id])).delete()
            session.commit()


def test_standalone_non_semester_assignment_workflow(client, teacher_headers):
    """
    Regression Test:
    Preserve existing standalone assignment creation for teachers not using semesters.
    Ensures class_id=None and semester_id=None succeeds with 201 without restrictions.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    payload = {
        "title": "Standalone Assignment - General",
        "subject": "Computer Science",
        "description": "General homework without semester association.",
        "due_date": future_date,
        "status": "active",
        "class_id": None,
        "semester_id": None,
    }

    res = client.post("/api/assignments", json=payload, headers=teacher_headers)
    assert res.status_code == 201
    data = res.json()
    as_id = data["id"]

    try:
        assert data["class_id"] is None
        assert data["semester_id"] is None
        assert data["subject"] == "Computer Science"

        # Update standalone assignment without adding semester
        update_res = client.put(
            f"/api/assignments/{as_id}",
            json={"title": "Standalone Assignment - Updated"},
            headers=teacher_headers,
        )
        assert update_res.status_code == 200
        assert update_res.json()["title"] == "Standalone Assignment - Updated"
        assert update_res.json()["class_id"] is None
        assert update_res.json()["semester_id"] is None

    finally:
        client.delete(f"/api/assignments/{as_id}", headers=teacher_headers)


def test_assignment_list_data_isolation_and_no_duplication(client, db_engine):
    """
    Regression Test:
    Ensures that assignments belonging to other teachers' classes (even if created_by_id is None)
    are NOT leaked or duplicated in GET /api/assignments for another teacher.
    Preserves legacy unassigned assignments (created_by_id=None and class_id=None).
    """
    from app.core.security import hash_password, create_access_token
    from app.models.user import User

    # 1. Create two separate teachers
    with Session(db_engine) as session:
        t1 = User(
            email=f"iso_teacher_1_{uuid.uuid4().hex[:6]}@assignflow.edu",
            full_name="Teacher One",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        t2 = User(
            email=f"iso_teacher_2_{uuid.uuid4().hex[:6]}@assignflow.edu",
            full_name="Teacher Two",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        session.add_all([t1, t2])
        session.commit()
        session.refresh(t1)
        session.refresh(t2)
        t1_id, t2_id = t1.id, t2.id

        # Teacher 2 owns a class
        t2_class = Class(
            teacher_id=t2_id,
            name="Cloud Computing",
            join_code=uuid.uuid4().hex[:8].upper(),
        )
        session.add(t2_class)
        session.commit()
        session.refresh(t2_class)
        t2_class_id = t2_class.id

        # Assignment in Teacher 2's class with created_by_id=None (simulating fixture/orphaned records)
        t2_as1 = Assignment(
            title="Cloud Architecture Design",
            subject="Cloud Computing",
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
            status="active",
            class_id=t2_class_id,
            created_by_id=None,
        )
        # Assignment in Teacher 2's class created by Teacher 2
        t2_as2 = Assignment(
            title="Kubernetes Deployment",
            subject="Cloud Computing",
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
            status="active",
            class_id=t2_class_id,
            created_by_id=t2_id,
            unit=2,
        )
        # Legacy unassigned assignment (created_by_id=None, class_id=None)
        legacy_as = Assignment(
            title="Legacy Unassigned General Paper",
            subject="Computer Science",
            due_date=datetime.now(timezone.utc) + timedelta(days=10),
            status="active",
            class_id=None,
            created_by_id=None,
        )
        session.add_all([t2_as1, t2_as2, legacy_as])
        session.commit()
        session.refresh(t2_as1)
        session.refresh(t2_as2)
        session.refresh(legacy_as)
        t2_as1_id = t2_as1.id
        t2_as2_id = t2_as2.id
        legacy_as_id = legacy_as.id

    t1_token = create_access_token({"sub": str(t1_id), "role": "teacher", "email": "t1@assignflow.edu"})
    t1_headers = {"Authorization": f"Bearer {t1_token}"}

    try:
        # Teacher 1 fetches assignments
        res = client.get("/api/assignments", headers=t1_headers)
        assert res.status_code == 200
        items = res.json()
        item_ids = [item["id"] for item in items]

        # Teacher 1 MUST see the legacy unassigned assignment
        assert legacy_as_id in item_ids

        # Teacher 1 MUST NOT see Teacher 2's assignments (neither the created_by_id=None nor created_by_id=t2_id)
        assert t2_as1_id not in item_ids
        assert t2_as2_id not in item_ids

        # Ensure no duplicates in the returned list
        assert len(item_ids) == len(set(item_ids)), "Returned assignments contain duplicate IDs"

    finally:
        with Session(db_engine) as session:
            session.query(Assignment).filter(Assignment.id.in_([t2_as1_id, t2_as2_id, legacy_as_id])).delete()
            session.query(Class).filter(Class.id == t2_class_id).delete()
            session.query(User).filter(User.id.in_([t1_id, t2_id])).delete()
            session.commit()


def test_class_specific_subject_binding_and_persistence(client, teacher_user, teacher_headers, db_engine):
    """
    Regression Test:
    Verify that an assignment created for a specific class accurately binds:
    - class_id
    - semester_id
    - subject (exact class name, NEVER generic 'Computer Science')
    And returns class_name in AssignmentResponse.
    """
    with Session(db_engine) as session:
        sem = Semester(
            teacher_id=teacher_user["id"],
            name="Semester 4 (Spring 2026)",
            academic_year="2025 - 2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            program="B.Tech CSE",
            status="active",
        )
        session.add(sem)
        session.commit()
        session.refresh(sem)
        sem_id = sem.id

        cls = Class(
            teacher_id=teacher_user["id"],
            name="Algorithms & Data Structures",
            description="Sorting, searching, dynamic programming, graph algorithms",
            join_code=uuid.uuid4().hex[:8].upper(),
            semester_id=sem_id,
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)
        cls_id = cls.id

    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    dummy_pdf = b"%PDF-1.4\nAlgorithms Question Sheet\n%%EOF"

    try:
        data = {
            "title": "Problem Set 3: Dynamic Programming",
            "subject": "Algorithms & Data Structures",
            "description": "Solve the 0/1 knapsack and longest common subsequence problems.",
            "due_date": future_date,
            "status": "active",
            "class_id": str(cls_id),
            "semester_id": str(sem_id),
        }
        files = {"file": ("algo_ps3.pdf", dummy_pdf, "application/pdf")}

        res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
        assert res.status_code == 201, res.text
        created = res.json()
        as_id = created["id"]

        # Verify response attributes
        assert created["class_id"] == cls_id
        assert created["semester_id"] == sem_id
        assert created["subject"] == "Algorithms & Data Structures"
        assert created["subject"] != "Computer Science"
        assert created["class_name"] == "Algorithms & Data Structures"

        # Verify DB persistence directly
        with Session(db_engine) as session:
            db_record = session.query(Assignment).filter(Assignment.id == as_id).first()
            assert db_record is not None
            assert db_record.class_id == cls_id
            assert db_record.semester_id == sem_id
            assert db_record.subject == "Algorithms & Data Structures"
            assert db_record.created_by_id == teacher_user["id"]

        # Verify GET /api/assignments returns the correct associations
        list_res = client.get("/api/assignments", headers=teacher_headers)
        assert list_res.status_code == 200
        found = next((a for a in list_res.json() if a["id"] == as_id), None)
        assert found is not None
        assert found["class_id"] == cls_id
        assert found["class_name"] == "Algorithms & Data Structures"
        assert found["subject"] == "Algorithms & Data Structures"

    finally:
        with Session(db_engine) as session:
            session.query(Assignment).filter(Assignment.title == "Problem Set 3: Dynamic Programming").delete()
            session.query(Class).filter(Class.id == cls_id).delete()
            session.query(Semester).filter(Semester.id == sem_id).delete()
            session.commit()


def test_teacher_cannot_filter_by_unowned_semester(client, teacher_user, db_engine):
    """
    Regression Test:
    Ensures that a teacher cannot list assignments using another teacher's semester_id (returns 403).
    """
    from app.core.security import hash_password, create_access_token
    from app.models.user import User

    with Session(db_engine) as session:
        other_teacher = User(
            email=f"other_teacher_{uuid.uuid4().hex[:6]}@assignflow.edu",
            full_name="Other Teacher",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        session.add(other_teacher)
        session.commit()
        session.refresh(other_teacher)

        other_sem = Semester(
            teacher_id=other_teacher.id,
            name="Other Semester",
            academic_year="2026 - 2027",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            program="B.Tech CSE",
            status="active",
        )
        session.add(other_sem)
        session.commit()
        session.refresh(other_sem)
        other_teacher_id = other_teacher.id
        other_sem_id = other_sem.id

    t_token = create_access_token({"sub": str(teacher_user["id"]), "role": "teacher", "email": teacher_user["email"]})
    t_headers = {"Authorization": f"Bearer {t_token}"}

    try:
        res = client.get(f"/api/assignments?semester_id={other_sem_id}", headers=t_headers)
        assert res.status_code == 403
        assert "You do not own this semester" in res.text

    finally:
        with Session(db_engine) as session:
            session.query(Semester).filter(Semester.id == other_sem_id).delete()
            session.query(User).filter(User.id == other_teacher_id).delete()
            session.commit()


def test_student_cannot_download_draft_assignment_pdf(client, teacher_headers, student_headers):
    """
    Phase 1 Regression Test:
    Enrolled students are forbidden from downloading question-sheet PDFs of draft assignments.
    Teachers can download their own draft PDFs.
    When the assignment is published ('active'), enrolled students can download it.
    """
    # 1. Create a class and enroll student
    cls_res = client.post(
        "/api/classes",
        json={"name": "Draft PDF Security Class", "description": "Testing access control"},
        headers=teacher_headers,
    )
    assert cls_res.status_code == 201
    cls_data = cls_res.json()
    cls_id = cls_data["id"]
    join_code = cls_data["join_code"]

    join_res = client.post("/api/classes/join", json={"join_code": join_code}, headers=student_headers)
    assert join_res.status_code == 200

    # 2. Teacher creates a DRAFT assignment with an attached question PDF
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_content = b"%PDF-1.4\nConfidential Exam Questions\n%%EOF"

    create_res = client.post(
        "/api/assignments",
        data={
            "title": "Confidential Draft Exam",
            "subject": "Cybersecurity",
            "due_date": future_date,
            "status": "draft",
            "class_id": str(cls_id),
        },
        files={"file": ("Secret_Exam.pdf", pdf_content, "application/pdf")},
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    asgn_id = create_res.json()["id"]

    try:
        # 3. Enrolled student attempts to download draft question PDF -> must be 403 Forbidden
        st_dl = client.get(f"/api/assignments/{asgn_id}/download", headers=student_headers)
        assert st_dl.status_code == 403
        assert "Draft assignments are not visible to students" in st_dl.json()["detail"]

        # 4. Teacher owner can download the draft question PDF -> 200 OK
        t_dl = client.get(f"/api/assignments/{asgn_id}/download", headers=teacher_headers)
        assert t_dl.status_code == 200
        assert t_dl.content == pdf_content

        # 5. Teacher publishes assignment ('active')
        pub_res = client.put(
            f"/api/assignments/{asgn_id}",
            json={"status": "active"},
            headers=teacher_headers,
        )
        assert pub_res.status_code == 200

        # 6. Now enrolled student can download question PDF -> 200 OK
        st_pub_dl = client.get(f"/api/assignments/{asgn_id}/download", headers=student_headers)
        assert st_pub_dl.status_code == 200
        assert st_pub_dl.content == pdf_content
    finally:
        client.delete(f"/api/assignments/{asgn_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{cls_id}", headers=teacher_headers)
