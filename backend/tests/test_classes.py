import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session
from app.core.security import hash_password, create_access_token
from app.models.user import User


@pytest.fixture
def other_teacher(db_engine):
    """Fixture to create a second teacher for cross-ownership authorization tests."""
    with Session(db_engine) as session:
        unique_email = f"other_teacher_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            email=unique_email,
            full_name="Other Teacher",
            hashed_password=hash_password("Password123!"),
            role="teacher",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id
        email = user.email
    return {"id": user_id, "email": email, "role": "teacher"}


@pytest.fixture
def other_teacher_headers(other_teacher):
    token = create_access_token({
        "sub": str(other_teacher["id"]),
        "email": other_teacher["email"],
        "role": other_teacher["role"],
    })
    return {"Authorization": f"Bearer {token}"}


def test_teacher_can_create_class_generates_unique_code(client, teacher_headers):
    """Requirement 1 & 2: Teacher can create a class with name and description; unique join code generated."""
    res = client.post(
        "/api/classes",
        json={"name": "Linear Algebra", "description": "Vectors, matrices, and eigenvalues."},
        headers=teacher_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Linear Algebra"
    assert data["description"] == "Vectors, matrices, and eigenvalues."
    assert "join_code" in data
    assert len(data["join_code"]) >= 6
    assert data["student_count"] == 0
    assert data["assignment_count"] == 0
    assert data["teacher_name"] is not None

    # Clean up
    client.delete(f"/api/classes/{data['id']}", headers=teacher_headers)


def test_student_cannot_create_class_returns_403(client, student_headers):
    """Requirement 9: Only teachers may create classes."""
    res = client.post(
        "/api/classes",
        json={"name": "Unauthorized Class"},
        headers=student_headers,
    )
    assert res.status_code == 403


def test_unauthenticated_cannot_create_or_list_classes_returns_401(client):
    """Requirement 9: Unauthenticated requests to class endpoints return 401."""
    client.cookies.clear()
    res1 = client.post("/api/classes", json={"name": "Hacking 101"})
    assert res1.status_code == 401

    res2 = client.get("/api/classes")
    assert res2.status_code == 401


def test_teacher_lists_only_own_classes(client, teacher_headers, other_teacher_headers):
    """Requirement 4: A teacher can list and manage only classes they own."""
    # Teacher 1 creates Class A
    res_a = client.post(
        "/api/classes",
        json={"name": "Teacher 1 Physics"},
        headers=teacher_headers,
    )
    assert res_a.status_code == 201
    class_a_id = res_a.json()["id"]

    # Teacher 2 creates Class B
    res_b = client.post(
        "/api/classes",
        json={"name": "Teacher 2 Chemistry"},
        headers=other_teacher_headers,
    )
    assert res_b.status_code == 201
    class_b_id = res_b.json()["id"]

    try:
        # Teacher 1 lists
        list_1 = client.get("/api/classes", headers=teacher_headers)
        assert list_1.status_code == 200
        ids_1 = [c["id"] for c in list_1.json()]
        assert class_a_id in ids_1
        assert class_b_id not in ids_1

        # Teacher 2 lists
        list_2 = client.get("/api/classes", headers=other_teacher_headers)
        assert list_2.status_code == 200
        ids_2 = [c["id"] for c in list_2.json()]
        assert class_b_id in ids_2
        assert class_a_id not in ids_2
    finally:
        client.delete(f"/api/classes/{class_a_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_b_id}", headers=other_teacher_headers)


def test_teacher_can_update_and_delete_own_class(client, teacher_headers, other_teacher_headers):
    """Requirement 4: Teacher can edit/delete their own class, unauthorized teacher gets 403."""
    res = client.post(
        "/api/classes",
        json={"name": "Old Class Title", "description": "Original text"},
        headers=teacher_headers,
    )
    assert res.status_code == 201
    class_id = res.json()["id"]

    try:
        # Other teacher tries to edit -> 403
        edit_hacked = client.put(
            f"/api/classes/{class_id}",
            json={"name": "Hacked Title"},
            headers=other_teacher_headers,
        )
        assert edit_hacked.status_code == 403

        # Owning teacher edits -> 200
        edit_ok = client.put(
            f"/api/classes/{class_id}",
            json={"name": "Updated Class Title", "description": "New text"},
            headers=teacher_headers,
        )
        assert edit_ok.status_code == 200
        assert edit_ok.json()["name"] == "Updated Class Title"
        assert edit_ok.json()["description"] == "New text"

        # Other teacher tries to delete -> 403
        del_hacked = client.delete(f"/api/classes/{class_id}", headers=other_teacher_headers)
        assert del_hacked.status_code == 403

        # Owning teacher deletes -> 200
        del_ok = client.delete(f"/api/classes/{class_id}", headers=teacher_headers)
        assert del_ok.status_code == 200
    except Exception:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)
        raise


def test_student_can_join_class_with_valid_code(client, teacher_headers, student_headers):
    """Requirement 3: An authenticated student can join a class using its join code."""
    res = client.post(
        "/api/classes",
        json={"name": "Algorithms & Data Structures"},
        headers=teacher_headers,
    )
    assert res.status_code == 201
    class_id = res.json()["id"]
    join_code = res.json()["join_code"]

    try:
        # Student joins
        join_res = client.post(
            "/api/classes/join",
            json={"join_code": join_code},
            headers=student_headers,
        )
        assert join_res.status_code == 200
        assert join_res.json()["id"] == class_id

        # Student lists classes -> class is in list
        list_res = client.get("/api/classes", headers=student_headers)
        assert list_res.status_code == 200
        joined_ids = [c["id"] for c in list_res.json()]
        assert class_id in joined_ids
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_student_joining_with_invalid_code_returns_404(client, student_headers):
    """Requirement 10: Joining with an invalid/nonexistent code returns 404."""
    res = client.post(
        "/api/classes/join",
        json={"join_code": "NONEXISTENT999"},
        headers=student_headers,
    )
    assert res.status_code == 404


def test_student_duplicate_join_rejected_returns_400(client, teacher_headers, student_headers):
    """Requirement 10: Joining the same class twice returns 400."""
    res = client.post(
        "/api/classes",
        json={"name": "Robotics Seminar"},
        headers=teacher_headers,
    )
    class_id = res.json()["id"]
    join_code = res.json()["join_code"]

    try:
        # First join succeeds
        first_join = client.post(
            "/api/classes/join",
            json={"join_code": join_code},
            headers=student_headers,
        )
        assert first_join.status_code == 200

        # Second join returns 400
        second_join = client.post(
            "/api/classes/join",
            json={"join_code": join_code},
            headers=student_headers,
        )
        assert second_join.status_code == 400
        assert "already enrolled" in second_join.json()["detail"].lower()
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_teacher_cannot_join_class_returns_403(client, teacher_headers):
    """Requirement 9: Teachers cannot join classes as students."""
    res = client.post(
        "/api/classes",
        json={"name": "Quantum Computing"},
        headers=teacher_headers,
    )
    class_id = res.json()["id"]
    join_code = res.json()["join_code"]

    try:
        join_res = client.post(
            "/api/classes/join",
            json={"join_code": join_code},
            headers=teacher_headers,
        )
        assert join_res.status_code == 403
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_teacher_can_view_enrolled_students(client, teacher_headers, other_teacher_headers, student_headers, student_user):
    """Requirement 5: A teacher can view students enrolled in their classes; unauthorized teachers/students cannot."""
    res = client.post(
        "/api/classes",
        json={"name": "Machine Learning Lab"},
        headers=teacher_headers,
    )
    class_id = res.json()["id"]
    join_code = res.json()["join_code"]

    try:
        # Student joins
        client.post(
            "/api/classes/join",
            json={"join_code": join_code},
            headers=student_headers,
        )

        # Owning teacher views students -> 200
        students_res = client.get(f"/api/classes/{class_id}/students", headers=teacher_headers)
        assert students_res.status_code == 200
        students = students_res.json()
        assert len(students) >= 1
        assert any(s["email"] == student_user["email"] for s in students)

        # Other teacher tries to view students -> 403
        unauth_teacher = client.get(f"/api/classes/{class_id}/students", headers=other_teacher_headers)
        assert unauth_teacher.status_code == 403

        # Student tries to view enrolled list -> 403
        unauth_student = client.get(f"/api/classes/{class_id}/students", headers=student_headers)
        assert unauth_student.status_code == 403
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_teacher_can_publish_assignment_only_to_own_class(client, teacher_headers, other_teacher_headers):
    """Requirement 7: A teacher can publish an assignment to one of their own classes only."""
    # Teacher 1 creates Class 1
    c1 = client.post("/api/classes", json={"name": "Teacher 1 Class"}, headers=teacher_headers)
    c1_id = c1.json()["id"]

    # Teacher 2 creates Class 2
    c2 = client.post("/api/classes", json={"name": "Teacher 2 Class"}, headers=other_teacher_headers)
    c2_id = c2.json()["id"]

    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes = b"%PDF-1.4\nTest PDF\n%%EOF"

    try:
        # Teacher 1 publishes to Class 1 -> 201 OK
        ok_res = client.post(
            "/api/assignments",
            data={
                "title": "Teacher 1 Assignment",
                "subject": "CS",
                "due_date": future_date,
                "status": "active",
                "class_id": str(c1_id),
            },
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
            headers=teacher_headers,
        )
        assert ok_res.status_code == 201
        asgn_id = ok_res.json()["id"]
        assert ok_res.json()["class_id"] == c1_id
        assert ok_res.json()["class_name"] == "Teacher 1 Class"

        # Teacher 1 tries to publish to Class 2 (Teacher 2's class) -> 403 Forbidden!
        bad_res = client.post(
            "/api/assignments",
            data={
                "title": "Unauthorized Cross-Class Assignment",
                "subject": "CS",
                "due_date": future_date,
                "status": "active",
                "class_id": str(c2_id),
            },
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
            headers=teacher_headers,
        )
        assert bad_res.status_code == 403
        assert "classes you own" in bad_res.json()["detail"].lower()

        # Clean up assignment
        client.delete(f"/api/assignments/{asgn_id}", headers=teacher_headers)
    finally:
        client.delete(f"/api/classes/{c1_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{c2_id}", headers=other_teacher_headers)


def test_student_can_list_and_view_only_assignments_from_joined_classes(client, teacher_headers, student_headers):
    """Requirement 8: Students can list, view, and download assignment PDFs only for classes they have joined."""
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes = b"%PDF-1.4\nAssignment Content\n%%EOF"

    # Teacher creates Class A and Class B
    cA = client.post("/api/classes", json={"name": "Class A - Enrolled"}, headers=teacher_headers).json()
    cB = client.post("/api/classes", json={"name": "Class B - Not Enrolled"}, headers=teacher_headers).json()

    # Student joins Class A only
    client.post("/api/classes/join", json={"join_code": cA["join_code"]}, headers=student_headers)

    # Teacher creates assignment in Class A
    asgn_A = client.post(
        "/api/assignments",
        data={
            "title": "Assignment for Class A",
            "subject": "Math",
            "due_date": future_date,
            "status": "active",
            "class_id": str(cA["id"]),
        },
        files={"file": ("a.pdf", pdf_bytes, "application/pdf")},
        headers=teacher_headers,
    ).json()

    # Teacher creates assignment in Class B
    asgn_B = client.post(
        "/api/assignments",
        data={
            "title": "Assignment for Class B",
            "subject": "Biology",
            "due_date": future_date,
            "status": "active",
            "class_id": str(cB["id"]),
        },
        files={"file": ("b.pdf", pdf_bytes, "application/pdf")},
        headers=teacher_headers,
    ).json()

    try:
        # Student lists assignments
        list_res = client.get("/api/assignments", headers=student_headers)
        assert list_res.status_code == 200
        student_asgn_ids = [a["id"] for a in list_res.json()]

        # Student MUST see Class A's assignment
        assert asgn_A["id"] in student_asgn_ids
        # Student MUST NOT see Class B's assignment
        assert asgn_B["id"] not in student_asgn_ids

        # Student views Class A assignment details -> 200
        view_A = client.get(f"/api/assignments/{asgn_A['id']}", headers=student_headers)
        assert view_A.status_code == 200

        # Student views Class B assignment details -> 403
        view_B = client.get(f"/api/assignments/{asgn_B['id']}", headers=student_headers)
        assert view_B.status_code == 403

        # Student downloads Class A PDF -> 200
        dl_A = client.get(f"/api/assignments/{asgn_A['id']}/download", headers=student_headers)
        assert dl_A.status_code == 200

        # Student downloads Class B PDF -> 403
        dl_B = client.get(f"/api/assignments/{asgn_B['id']}/download", headers=student_headers)
        assert dl_B.status_code == 403
    finally:
        client.delete(f"/api/assignments/{asgn_A['id']}", headers=teacher_headers)
        client.delete(f"/api/assignments/{asgn_B['id']}", headers=teacher_headers)
        client.delete(f"/api/classes/{cA['id']}", headers=teacher_headers)
        client.delete(f"/api/classes/{cB['id']}", headers=teacher_headers)


def test_legacy_unassigned_assignments_remain_hidden_from_students(client, teacher_headers, student_headers):
    """
    Decision verification for legacy data:
    Legacy assignments without a class remain preserved for teachers,
    but remain hidden from students until published to a joined class.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes = b"%PDF-1.4\nLegacy Unassigned Sheet\n%%EOF"

    # Teacher creates an unassigned assignment (class_id=None)
    res = client.post(
        "/api/assignments",
        data={
            "title": "Legacy Unassigned Assignment",
            "subject": "General",
            "due_date": future_date,
            "status": "active",
        },
        files={"file": ("legacy.pdf", pdf_bytes, "application/pdf")},
        headers=teacher_headers,
    )
    assert res.status_code == 201
    asgn_id = res.json()["id"]
    assert res.json()["class_id"] is None

    try:
        # Teacher can view and download it
        t_view = client.get(f"/api/assignments/{asgn_id}", headers=teacher_headers)
        assert t_view.status_code == 200

        t_dl = client.get(f"/api/assignments/{asgn_id}/download", headers=teacher_headers)
        assert t_dl.status_code == 200

        # Student list -> does NOT contain unassigned assignment
        s_list = client.get("/api/assignments", headers=student_headers)
        assert s_list.status_code == 200
        assert not any(a["id"] == asgn_id for a in s_list.json())

        # Student direct view -> 403 Forbidden
        s_view = client.get(f"/api/assignments/{asgn_id}", headers=student_headers)
        assert s_view.status_code == 403

        # Student download -> 403 Forbidden
        s_dl = client.get(f"/api/assignments/{asgn_id}/download", headers=student_headers)
        assert s_dl.status_code == 403
    finally:
        client.delete(f"/api/assignments/{asgn_id}", headers=teacher_headers)


def test_student_enrollment_persists_across_subsequent_requests_and_dashboard(
    client, teacher_headers, student_headers, student_user
):
    """
    Regression Test:
    Proves that after a student joins a class with a valid join code:
    1. Enrollment is created, committed, and persists in the database.
    2. Subsequent authenticated GET /api/classes calls return the enrolled class.
    3. Subsequent authenticated GET /api/dashboard calls return the joined class in my_classes and metrics.
    4. Subsequent authenticated GET /api/classes/{id} returns the class details.
    5. Duplicate join attempts are rejected with HTTP 400.
    6. Invalid join codes return HTTP 404 and empty join codes return HTTP 422.
    7. Teacher role cannot join classes (HTTP 403).
    8. Teacher sees student in the class roster (GET /api/classes/{id}/students).
    """
    # 1. Teacher creates class
    cls_res = client.post(
        "/api/classes",
        json={"name": "Cloud Computing Architecture", "description": "Microservices and Distributed Data"},
        headers=teacher_headers,
    )
    assert cls_res.status_code == 201
    cls_data = cls_res.json()
    class_id = cls_data["id"]
    join_code = cls_data["join_code"]

    try:
        # 2. Teacher creates an assignment in this class
        future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        assign_res = client.post(
            "/api/assignments",
            json={
                "title": "Raft Consensus Lab",
                "subject": "Distributed Systems",
                "description": "Implement leader election and log replication.",
                "class_id": class_id,
                "due_date": future_date,
                "max_marks": 100,
                "status": "active",
            },
            headers=teacher_headers,
        )
        assert assign_res.status_code == 201

        # 3. Validation: Empty and invalid join codes
        empty_res = client.post("/api/classes/join", json={"join_code": "   "}, headers=student_headers)
        assert empty_res.status_code in (422, 400)

        invalid_res = client.post("/api/classes/join", json={"join_code": "WRONG99"}, headers=student_headers)
        assert invalid_res.status_code == 404

        # 4. Teacher cannot join class as student
        teacher_join_res = client.post("/api/classes/join", json={"join_code": join_code}, headers=teacher_headers)
        assert teacher_join_res.status_code == 403

        # 5. Student joins class
        join_res = client.post("/api/classes/join", json={"join_code": join_code}, headers=student_headers)
        assert join_res.status_code == 200
        assert join_res.json()["id"] == class_id

        # 6. Duplicate join attempt returns 400
        dup_res = client.post("/api/classes/join", json={"join_code": join_code}, headers=student_headers)
        assert dup_res.status_code == 400
        assert "already enrolled" in dup_res.json()["detail"].lower()

        # 7. Subsequent request 1: Student lists classes (persists after join)
        list_res = client.get("/api/classes", headers=student_headers)
        assert list_res.status_code == 200
        student_classes = list_res.json()
        enrolled_class = next((c for c in student_classes if c["id"] == class_id), None)
        assert enrolled_class is not None, "Joined class missing from subsequent GET /api/classes request"
        assert enrolled_class["name"] == "Cloud Computing Architecture"
        assert enrolled_class["student_count"] >= 1
        assert enrolled_class["assignment_count"] >= 1

        # 8. Subsequent request 2: Student dashboard (persists after refresh)
        dash_res = client.get("/api/dashboard", headers=student_headers)
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["role"] == "student"
        assert any(c["id"] == class_id for c in dash_data.get("my_classes", [])), "Joined class missing from student dashboard"
        assert dash_data["metrics"]["total_assignments"] >= 1
        assert any(a["title"] == "Raft Consensus Lab" for a in dash_data.get("upcoming_assignments", []))

        # 9. Subsequent request 3: Student fetches class detail directly
        detail_res = client.get(f"/api/classes/{class_id}", headers=student_headers)
        assert detail_res.status_code == 200
        assert detail_res.json()["name"] == "Cloud Computing Architecture"

        # 10. Teacher verifies student in roster
        roster_res = client.get(f"/api/classes/{class_id}/students", headers=teacher_headers)
        assert roster_res.status_code == 200
        roster = roster_res.json()
        assert any(s["email"] == student_user["email"] for s in roster)
    finally:
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)
