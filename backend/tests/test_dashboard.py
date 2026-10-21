import pytest
from datetime import datetime, timedelta, timezone


def test_dashboard_unauthenticated_returns_401(client):
    """Verify that unauthenticated GET /api/dashboard returns 401 Unauthorized."""
    response = client.get("/api/dashboard")
    assert response.status_code == 401


def test_teacher_dashboard_metrics_and_scoping(client, teacher_headers):
    """Verify teacher dashboard returns teacher-specific metrics and data."""
    # Create a class
    class_res = client.post(
        "/api/classes",
        json={"name": "CSE 3A", "description": "Computer Science Engineering"},
        headers=teacher_headers,
    )
    assert class_res.status_code == 201
    class_data = class_res.json()
    class_id = class_data["id"]

    # Create an assignment
    due_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    assign_res = client.post(
        "/api/assignments",
        json={
            "title": "DBMS Assignment",
            "subject": "Database Management",
            "description": "SQL Queries and Schema Design",
            "due_date": due_date,
            "status": "active",
            "class_id": class_id,
        },
        headers=teacher_headers,
    )
    assert assign_res.status_code == 201

    # Fetch dashboard data
    res = client.get("/api/dashboard", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["role"] == "teacher"
    assert data["metrics"]["total_assignments"] >= 1
    assert data["metrics"]["active_assignments"] >= 1
    assert "submissions_overview" in data
    assert "my_classes" in data
    assert any(c["name"] == "CSE 3A" for c in data["my_classes"])
    assert "upcoming_deadlines" in data
    assert any(d["title"] == "DBMS Assignment" for d in data["upcoming_deadlines"])


def test_student_dashboard_metrics_and_scoping(client, teacher_headers, student_headers):
    """Verify student dashboard returns student-specific metrics scoped to enrolled classes."""
    # 1. Teacher creates class and assignment
    class_res = client.post(
        "/api/classes",
        json={"name": "CSE 3B", "description": "Computer Science Engineering"},
        headers=teacher_headers,
    )
    class_data = class_res.json()
    join_code = class_data["join_code"]
    class_id = class_data["id"]

    due_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    assign_res = client.post(
        "/api/assignments",
        json={
            "title": "OOPs Project",
            "subject": "Object Oriented Programming",
            "description": "Build an inventory system",
            "due_date": due_date,
            "status": "active",
            "class_id": class_id,
        },
        headers=teacher_headers,
    )
    assert assign_res.status_code == 201
    assign_id = assign_res.json()["id"]

    # 2. Student joins class
    join_res = client.post(
        "/api/classes/join",
        json={"join_code": join_code},
        headers=student_headers,
    )
    assert join_res.status_code == 200

    # 3. Check student dashboard before submission
    dash1 = client.get("/api/dashboard", headers=student_headers).json()
    assert dash1["role"] == "student"
    assert dash1["metrics"]["total_assignments"] >= 1
    assert any(a["title"] == "OOPs Project" for a in dash1["upcoming_assignments"])

    # 4. Student submits work
    sub_res = client.post(
        f"/api/assignments/{assign_id}/submissions",
        data={"notes": "Final code attached"},
        files={"file": ("project.pdf", b"%PDF-1.4 Student Solution", "application/pdf")},
        headers=student_headers,
    )
    assert sub_res.status_code == 201

    # 5. Check student dashboard after submission
    dash2 = client.get("/api/dashboard", headers=student_headers).json()
    assert dash2["metrics"]["submitted"] >= 1
    assert any(s["assignment_title"] == "OOPs Project" for s in dash2["recently_submitted"])


def test_student_dashboard_excludes_draft_assignments(client, teacher_headers, student_headers):
    """
    Regression Test:
    Ensures that draft assignments are strictly excluded from student dashboard aggregation:
    - total_assignments metric does not count draft assignments.
    - pending metric does not count draft assignments.
    - upcoming_assignments list does not contain draft assignments.
    - Teacher dashboard retains visibility over draft assignments.
    """
    # 1. Teacher creates class
    cls_res = client.post(
        "/api/classes",
        json={"name": "Draft Exclude Class", "description": "Draft filtering verification"},
        headers=teacher_headers,
    )
    assert cls_res.status_code == 201
    cls_data = cls_res.json()
    cls_id = cls_data["id"]
    join_code = cls_data["join_code"]

    # 2. Student joins class
    join_res = client.post(
        "/api/classes/join",
        json={"join_code": join_code},
        headers=student_headers,
    )
    assert join_res.status_code == 200

    # 3. Teacher creates 1 active assignment and 1 draft assignment
    due_date = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()

    active_res = client.post(
        "/api/assignments",
        json={
            "title": "Visible Active Task",
            "subject": "System Design",
            "due_date": due_date,
            "status": "active",
            "class_id": cls_id,
        },
        headers=teacher_headers,
    )
    assert active_res.status_code == 201

    draft_res = client.post(
        "/api/assignments",
        json={
            "title": "Confidential Draft Task",
            "subject": "System Design",
            "unit": 2,
            "due_date": due_date,
            "status": "draft",
            "class_id": cls_id,
        },
        headers=teacher_headers,
    )
    assert draft_res.status_code == 201

    # 4. Student checks dashboard
    st_dash = client.get("/api/dashboard", headers=student_headers)
    assert st_dash.status_code == 200
    st_data = st_dash.json()

    # Draft task must NOT be in upcoming_assignments
    upcoming = st_data["upcoming_assignments"]
    assert any(a["title"] == "Visible Active Task" for a in upcoming)
    assert not any(a["title"] == "Confidential Draft Task" for a in upcoming)
    assert all(a.get("status") != "draft" for a in upcoming)

    # 5. Teacher checks dashboard
    t_dash = client.get("/api/dashboard", headers=teacher_headers)
    assert t_dash.status_code == 200
    t_data = t_dash.json()
    assert t_data["metrics"]["total_assignments"] >= 2
