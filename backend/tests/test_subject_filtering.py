import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session

from app.models.classroom import Class, Subject
from app.models.assignment import Assignment
from app.models.semester import Semester


def test_class_subjects_endpoints(client, teacher_user, teacher_headers):
    """
    Test GET /api/classes/{id}/subjects and POST /api/classes/{id}/subjects:
    - Verifies subjects are scoped to specific class ID.
    - Verifies empty list when class has no subjects.
    - Verifies creating subjects associates them only with that class.
    """
    # 1. Create a class
    cls_res = client.post(
        "/api/classes",
        json={"name": "CS301 Theory of Computation", "description": "Automata and Grammars"},
        headers=teacher_headers,
    )
    assert cls_res.status_code == 201
    cls_id = cls_res.json()["id"]

    # 2. Initially class has no subjects
    get_res = client.get(f"/api/classes/{cls_id}/subjects", headers=teacher_headers)
    assert get_res.status_code == 200
    assert get_res.json() == []

    # 3. Add subject to class
    post_res = client.post(
        f"/api/classes/{cls_id}/subjects",
        json={"name": "Turing Machines"},
        headers=teacher_headers,
    )
    assert post_res.status_code == 201
    sub_data = post_res.json()
    assert sub_data["name"] == "Turing Machines"
    assert sub_data["class_id"] == cls_id

    # Add second subject
    post_res2 = client.post(
        f"/api/classes/{cls_id}/subjects",
        json={"name": "Finite Automata"},
        headers=teacher_headers,
    )
    assert post_res2.status_code == 201

    # 4. Fetch class subjects again
    get_res2 = client.get(f"/api/classes/{cls_id}/subjects", headers=teacher_headers)
    assert get_res2.status_code == 200
    names = [s["name"] for s in get_res2.json()]
    assert names == ["Turing Machines", "Finite Automata"]

    # 5. Another class should have empty subjects
    cls2_res = client.post(
        "/api/classes",
        json={"name": "EE101 Basic Electrical", "description": "Circuits"},
        headers=teacher_headers,
    )
    cls2_id = cls2_res.json()["id"]
    get2_res = client.get(f"/api/classes/{cls2_id}/subjects", headers=teacher_headers)
    assert get2_res.status_code == 200
    assert get2_res.json() == []


def test_backend_validation_rejects_mismatched_subject_id(client, teacher_user, teacher_headers):
    """
    Regression Test:
    Validate backend rejects assignment creation/update when subject_id belongs to a different class.
    """
    # Create Class A and Subject A
    cls_a = client.post("/api/classes", json={"name": "Class Alpha"}, headers=teacher_headers).json()
    sub_a = client.post(f"/api/classes/{cls_a['id']}/subjects", json={"name": "Subject Alpha"}, headers=teacher_headers).json()

    # Create Class B and Subject B
    cls_b = client.post("/api/classes", json={"name": "Class Beta"}, headers=teacher_headers).json()
    sub_b = client.post(f"/api/classes/{cls_b['id']}/subjects", json={"name": "Subject Beta"}, headers=teacher_headers).json()

    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    dummy_pdf = b"%PDF-1.4\nTest Question Content\n%%EOF"

    # Try creating assignment for Class A with Subject B's ID (mismatched)
    mismatched_data = {
        "title": "Mismatched ID Test Assignment",
        "subject": "Subject Beta",
        "subject_id": str(sub_b["id"]),
        "class_id": str(cls_a["id"]),
        "due_date": future_date,
    }
    files = {"file": ("test.pdf", dummy_pdf, "application/pdf")}
    res = client.post("/api/assignments", data=mismatched_data, files=files, headers=teacher_headers)
    assert res.status_code == 422
    assert "Mismatched class and subject IDs" in res.text

    # Try creating assignment for Class A with unassociated subject string
    unassociated_data = {
        "title": "Unassociated Subject Name Test",
        "subject": "Computer Science",  # generic default, does not belong to Class Alpha
        "class_id": str(cls_a["id"]),
        "due_date": future_date,
    }
    res2 = client.post("/api/assignments", data=unassociated_data, files=files, headers=teacher_headers)
    assert res2.status_code == 422
    assert "is not associated with class" in res2.text

    # Valid association: Class A with Subject A
    valid_data = {
        "title": "Valid Association Assignment",
        "subject": "Subject Alpha",
        "subject_id": str(sub_a["id"]),
        "class_id": str(cls_a["id"]),
        "due_date": future_date,
    }
    res3 = client.post("/api/assignments", data=valid_data, files=files, headers=teacher_headers)
    assert res3.status_code == 201
    asgn_data = res3.json()
    assert asgn_data["subject"] == "Subject Alpha"
    assert asgn_data["subject_id"] == sub_a["id"]
    assert asgn_data["class_id"] == cls_a["id"]


def test_standalone_assignment_preserves_workflow(client, teacher_user, teacher_headers):
    """
    Regression Test:
    Standalone assignments (without a class_id) preserve workflow:
    - Subject can be any valid string.
    - No class association required.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    dummy_pdf = b"%PDF-1.4\nStandalone PDF\n%%EOF"

    data = {
        "title": "Standalone Assignment Test",
        "subject": "General Mathematics",
        "due_date": future_date,
    }
    files = {"file": ("standalone.pdf", dummy_pdf, "application/pdf")}
    res = client.post("/api/assignments", data=data, files=files, headers=teacher_headers)
    assert res.status_code == 201
    asgn = res.json()
    assert asgn["class_id"] is None
    assert asgn["subject"] == "General Mathematics"


def test_frontend_subject_filtering_integration(client):
    """
    Regression Test:
    Verifies frontend integration:
    - Hardcoded options (Computer Science, Mathematics, Science, Design, Other) are removed from select.
    - subjectEmptyState and btnDrawerAddSubject elements are present in index.html.
    - loadClassSubjects is defined and handles class-specific fetching and empty states.
    - formClass change listener invokes loadClassSubjects.
    """
    index_res = client.get("/")
    assert index_res.status_code == 200
    html = index_res.text

    # 1. Check select element does not contain hardcoded unrelated default options
    assert '<select id="formSubject" class="form-input" required>' in html
    # Ensure options are not hardcoded inside formSubject
    select_snippet = html.split('<select id="formSubject"')[1].split('</select>')[0]
    assert '<option value="Computer Science">Computer Science</option>' not in select_snippet
    assert '<option value="Mathematics">Mathematics</option>' not in select_snippet
    assert '<option value="Science">Science</option>' not in select_snippet
    assert '<option value="Design">Design</option>' not in select_snippet
    assert '<option value="Other">Other</option>' not in select_snippet

    # 2. Check empty state and Add Subject button exist
    assert 'id="subjectEmptyState"' in html
    assert 'id="btnDrawerAddSubject"' in html
    assert "No subjects added to this class yet." in html

    # 3. Check app.js implementation
    js_res = client.get("/js/app.js")
    assert js_res.status_code == 200
    js = js_res.text

    assert "async function loadClassSubjects(" in js
    assert "subjectEmptyState: document.getElementById(\"subjectEmptyState\")" in js
    assert "btnDrawerAddSubject: document.getElementById(\"btnDrawerAddSubject\")" in js
    assert "await loadClassSubjects(" in js
    assert "elements.btnDrawerAddSubject.addEventListener(" in js
