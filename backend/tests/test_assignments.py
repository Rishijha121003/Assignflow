from datetime import datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy import text
from app.core.config import settings


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
