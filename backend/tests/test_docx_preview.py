import html
import io
import sys
import uuid
import zipfile
from datetime import datetime, timezone, timedelta
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


def create_test_docx(
    headings: list[str] = None,
    paragraphs: list[str] = None,
    table_rows: list[list[str]] = None,
) -> bytes:
    """Helper to build a valid, minimal DOCX binary in memory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>'
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>'
        )

        body_elements = []
        if headings:
            for h in headings:
                body_elements.append(
                    f'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>{html.escape(h)}</w:t></w:r></w:p>'
                )
        if paragraphs:
            for p in paragraphs:
                body_elements.append(
                    f'<w:p><w:r><w:t>{html.escape(p)}</w:t></w:r></w:p>'
                )
        if table_rows:
            body_elements.append('<w:tbl>')
            for row in table_rows:
                body_elements.append('<w:tr>')
                for cell in row:
                    body_elements.append(
                        f'<w:tc><w:p><w:r><w:t>{html.escape(cell)}</w:t></w:r></w:p></w:tc>'
                    )
                body_elements.append('</w:tr>')
            body_elements.append('</w:tbl>')

        if not body_elements:
            body_elements.append('<w:p><w:r><w:t>Default docx text</w:t></w:r></w:p>')

        body_content = "".join(body_elements)
        zf.writestr(
            "word/document.xml",
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f'<w:body>{body_content}</w:body>'
            f'</w:document>'
        )
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture
def docx_preview_env(db_engine):
    """
    Sets up a fixture environment for DOCX and PDF preview testing:
    - Teacher 1 (owner)
    - Teacher 2 (unauthorized teacher)
    - Student 1 (submits valid DOCX)
    - Student 2 (submits valid PDF)
    - Student 3 (submits corrupted DOCX)
    - Student 4 (submits unsupported format e.g. ZIP)
    - Class and Assignment
    """
    with Session(db_engine) as session:
        t1 = User(
            email=f"t1_dpx_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Prof. Charles Xavier",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        t2 = User(
            email=f"t2_dpx_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Prof. Erik Lehnsherr",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        s1 = User(
            email=f"s1_dpx_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Scott Summers",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s2 = User(
            email=f"s2_dpx_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Jean Grey",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s3 = User(
            email=f"s3_dpx_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Hank McCoy",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s4 = User(
            email=f"s4_dpx_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Ororo Munroe",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([t1, t2, s1, s2, s3, s4])
        session.commit()
        for u in [t1, t2, s1, s2, s3, s4]:
            session.refresh(u)

        classroom = Class(
            name="Structural Biochemistry",
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
            ClassEnrollment(class_id=classroom.id, student_id=s4.id),
        ])
        session.commit()

        # Files on disk
        test_dir = Path("uploads/test_docx_preview")
        test_dir.mkdir(parents=True, exist_ok=True)

        # 1. Valid DOCX with headings, paragraphs, and table
        docx_bytes = create_test_docx(
            headings=["Protein Tertiary Structures"],
            paragraphs=["Alpha helices and beta pleated sheets fold into 3D domains."],
            table_rows=[["Domain", "Function"], ["SH2", "Phosphotyrosine binding"], ["Kinase", "Phosphorylation"]],
        )
        docx_path = test_dir / f"valid_{uuid.uuid4().hex[:6]}.docx"
        docx_path.write_bytes(docx_bytes)

        # 2. Valid PDF
        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        pdf_path = test_dir / f"valid_{uuid.uuid4().hex[:6]}.pdf"
        pdf_path.write_bytes(pdf_bytes)

        # 3. Corrupted DOCX (not a zip)
        corrupted_path = test_dir / f"corrupt_{uuid.uuid4().hex[:6]}.docx"
        corrupted_path.write_bytes(b"NOT_A_VALID_ZIP_ARCHIVE_DATA")

        # 4. Unsupported format (.zip)
        zip_path = test_dir / f"archive_{uuid.uuid4().hex[:6]}.zip"
        zip_path.write_bytes(b"PK\x05\x06" + b"\x00" * 18)

        due = datetime.now(timezone.utc) + timedelta(days=7)
        assignment = Assignment(
            title="Biochemistry Essay 1",
            subject="Biochemistry",
            due_date=due,
            status="active",
            class_id=classroom.id,
            created_by_id=t1.id,
            max_marks=100.0,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)

        # Submissions
        sub_docx = Submission(
            assignment_id=assignment.id,
            student_id=s1.id,
            file_name="protein_structure.docx",
            file_path=str(docx_path),
            file_size=len(docx_bytes),
            status="submitted",
        )
        sub_pdf = Submission(
            assignment_id=assignment.id,
            student_id=s2.id,
            file_name="protein_diagram.pdf",
            file_path=str(pdf_path),
            file_size=len(pdf_bytes),
            status="submitted",
        )
        sub_corrupt = Submission(
            assignment_id=assignment.id,
            student_id=s3.id,
            file_name="corrupted_file.docx",
            file_path=str(corrupted_path),
            file_size=len(b"NOT_A_VALID_ZIP_ARCHIVE_DATA"),
            status="submitted",
        )
        sub_unsupported = Submission(
            assignment_id=assignment.id,
            student_id=s4.id,
            file_name="data_files.zip",
            file_path=str(zip_path),
            file_size=22,
            status="submitted",
        )
        session.add_all([sub_docx, sub_pdf, sub_corrupt, sub_unsupported])
        session.commit()
        for s in [sub_docx, sub_pdf, sub_corrupt, sub_unsupported]:
            session.refresh(s)

        env = {
            "t1": {"id": t1.id, "email": t1.email, "role": "teacher"},
            "t2": {"id": t2.id, "email": t2.email, "role": "teacher"},
            "s1": {"id": s1.id, "email": s1.email, "role": "student"},
            "s2": {"id": s2.id, "email": s2.email, "role": "student"},
            "s3": {"id": s3.id, "email": s3.email, "role": "student"},
            "s4": {"id": s4.id, "email": s4.email, "role": "student"},
            "classroom_id": classroom.id,
            "assignment_id": assignment.id,
            "sub_docx_id": sub_docx.id,
            "sub_pdf_id": sub_pdf.id,
            "sub_corrupt_id": sub_corrupt.id,
            "sub_unsupported_id": sub_unsupported.id,
        }
    return env


def test_docx_preview_success_formatting(client, docx_preview_env):
    """Verify DOCX preview renders semantic HTML preserving headings, paragraphs, and tables."""
    t1 = docx_preview_env["t1"]
    assign_id = docx_preview_env["assignment_id"]
    sub_id = docx_preview_env["sub_docx_id"]

    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(t1),
    )
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")

    # Security headers
    csp = res.headers.get("content-security-policy", "")
    assert "default-src 'none'" in csp
    assert res.headers.get("x-content-type-options") == "nosniff"

    html_content = res.text
    # Verify semantic HTML tags and content
    assert "Protein Tertiary Structures" in html_content
    assert "<h1>" in html_content or "<h2>" in html_content
    assert "<p>" in html_content
    assert "Alpha helices and beta pleated sheets" in html_content
    assert "<table>" in html_content
    assert "Phosphotyrosine binding" in html_content


def test_docx_preview_sanitizes_untrusted_html(client, db_engine, docx_preview_env):
    """Verify DOCX preview sanitizes dangerous elements, scripts, event handlers, and remote URLs."""
    t1 = docx_preview_env["t1"]
    assign_id = docx_preview_env["assignment_id"]
    test_dir = Path("uploads/test_docx_preview")

    # Build DOCX with script, event handler, javascript: href, and remote img
    xss_docx_bytes = create_test_docx(
        headings=["Security Assessment"],
        paragraphs=[
            '<script>alert("XSS")</script>Safe text here.',
            '<img src="https://tracker.com/pixel.png">Another text.',
            '<a href="javascript:alert(1)">Click for bonus</a>',
        ],
    )
    xss_path = test_dir / f"xss_{uuid.uuid4().hex[:6]}.docx"
    xss_path.write_bytes(xss_docx_bytes)

    with Session(db_engine) as session:
        # Create student for this submission
        s_sec = User(
            email=f"sec_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Security Auditor",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add(s_sec)
        session.commit()
        session.refresh(s_sec)

        sub_sec = Submission(
            assignment_id=assign_id,
            student_id=s_sec.id,
            file_name="xss_test.docx",
            file_path=str(xss_path),
            file_size=len(xss_docx_bytes),
            status="submitted",
        )
        session.add(sub_sec)
        session.commit()
        session.refresh(sub_sec)
        sec_sub_id = sub_sec.id

    # Directly test the sanitize_docx_html function with dangerous HTML constructs
    from app.api.assignments import sanitize_docx_html
    dirty_html = (
        '<div>'
        '<script>alert("XSS")</script>'
        '<iframe src="https://evil.com/frame"></iframe>'
        '<style>body { display: none; }</style>'
        '<p onclick="alert(2)" onmouseover="steal()">Text with handlers</p>'
        '<a href="javascript:alert(3)">Malicious Link</a>'
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data URI</a>'
        '<img src="https://tracker.com/pixel.png" alt="tracker">'
        '<img src="//cdn.tracker.com/img.png">'
        '</div>'
    )
    cleaned_html = sanitize_docx_html(dirty_html)
    assert "<script" not in cleaned_html.lower()
    assert "<iframe" not in cleaned_html.lower()
    assert "<style" not in cleaned_html.lower()
    assert "onclick" not in cleaned_html.lower()
    assert "onmouseover" not in cleaned_html.lower()
    assert 'href="javascript:' not in cleaned_html.lower()
    assert 'href="data:' not in cleaned_html.lower()
    assert 'href="#"' in cleaned_html
    assert 'https://tracker.com' not in cleaned_html
    assert '//cdn.tracker.com' not in cleaned_html
    assert 'src=""' in cleaned_html
    assert "Text with handlers" in cleaned_html

    # Also test the preview endpoint serving the document
    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sec_sub_id}/preview",
        headers=make_auth_header(t1),
    )
    assert res.status_code == 200
    html_content = res.text

    # Assert security headers and meta tags
    assert "default-src 'none'" in res.headers.get("content-security-policy", "")
    assert '<meta http-equiv="Content-Security-Policy"' in html_content
    # Assert no executable unescaped scripts
    assert "<script>" not in html_content.lower()
    assert "</script>" not in html_content.lower()
    assert "Safe text here" in html_content


def test_docx_preview_corrupted_file_returns_422(client, docx_preview_env):
    """Verify corrupted/malformed DOCX returns HTTP 422 with clear error detail."""
    t1 = docx_preview_env["t1"]
    assign_id = docx_preview_env["assignment_id"]
    sub_id = docx_preview_env["sub_corrupt_id"]

    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(t1),
    )
    assert res.status_code == 422
    assert "corrupted" in res.json().get("detail", "").lower()


def test_docx_preview_authorization_and_ownership(client, docx_preview_env):
    """Verify teacher ownership and student authorization on DOCX preview."""
    assign_id = docx_preview_env["assignment_id"]
    sub_id = docx_preview_env["sub_docx_id"]
    t1 = docx_preview_env["t1"]
    t2 = docx_preview_env["t2"]
    s1 = docx_preview_env["s1"]  # Submitting student
    s2 = docx_preview_env["s2"]  # Another student

    # 1. Unauthenticated -> 401
    res = client.get(f"/api/assignments/{assign_id}/submissions/{sub_id}/preview")
    assert res.status_code == 401

    # 2. Non-owning teacher -> 403
    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(t2),
    )
    assert res.status_code == 403

    # 3. Another student -> 403
    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(s2),
    )
    assert res.status_code == 403

    # 4. Submitting student -> 200 (allowed to preview own submission)
    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(s1),
    )
    assert res.status_code == 200

    # 5. Non-existent assignment -> 404
    res = client.get(
        f"/api/assignments/999999/submissions/{sub_id}/preview",
        headers=make_auth_header(t1),
    )
    assert res.status_code == 404


def test_pdf_preview_regression_unchanged(client, docx_preview_env):
    """Verify that existing PDF preview behavior remains intact with inline disposition."""
    t1 = docx_preview_env["t1"]
    assign_id = docx_preview_env["assignment_id"]
    sub_id = docx_preview_env["sub_pdf_id"]

    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(t1),
    )
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    assert "inline" in res.headers.get("content-disposition", "")


def test_non_previewable_file_format_returns_415(client, docx_preview_env):
    """Verify unsupported formats (e.g. ZIP) return HTTP 415 with download guidance."""
    t1 = docx_preview_env["t1"]
    assign_id = docx_preview_env["assignment_id"]
    sub_id = docx_preview_env["sub_unsupported_id"]

    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_id}/preview",
        headers=make_auth_header(t1),
    )
    assert res.status_code == 415
    assert "download" in res.json().get("detail", "").lower()


def test_student_b_cannot_preview_student_a_docx_submission(client, docx_preview_env):
    """Explicit regression test: verify Student B receives 403 Forbidden attempting to preview Student A's DOCX."""
    assign_id = docx_preview_env["assignment_id"]
    sub_docx_id = docx_preview_env["sub_docx_id"]
    s2 = docx_preview_env["s2"]  # Non-submitting student

    res = client.get(
        f"/api/assignments/{assign_id}/submissions/{sub_docx_id}/preview",
        headers=make_auth_header(s2),
    )
    assert res.status_code == 403
    assert "cannot preview another student" in res.json().get("detail", "").lower()
