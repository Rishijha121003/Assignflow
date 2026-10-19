import uuid
from datetime import datetime, timezone, timedelta
from app.core.security import create_access_token


def unique_email(prefix="user"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def test_register_teacher_success(client):
    """Verify that a teacher can register and receives a valid token and session cookie."""
    email = unique_email("teacher")
    payload = {
        "email": email,
        "full_name": "Professor Charles Xavier",
        "password": "StrongPassword123!",
        "role": "teacher",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "teacher"
    assert data["user"]["full_name"] == "Professor Charles Xavier"

    # Verify session cookie was set
    assert "access_token" in response.cookies


def test_register_student_success(client):
    """Verify that a student can register with role student."""
    email = unique_email("student")
    payload = {
        "email": email,
        "full_name": "Peter Parker",
        "password": "StrongPassword123!",
        "role": "student",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "student"


def test_register_duplicate_email_fails(client):
    """Verify that registering with an existing email returns 400 Bad Request."""
    email = unique_email("duplicate")
    payload = {
        "email": email,
        "full_name": "Duplicate User",
        "password": "StrongPassword123!",
        "role": "teacher",
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()


def test_register_validation_errors(client):
    """Verify registration validation constraints (short password, invalid email, invalid role)."""
    # Short password (< 6 chars)
    res = client.post("/api/auth/register", json={
        "email": unique_email(),
        "full_name": "Short Pwd",
        "password": "123",
        "role": "student",
    })
    assert res.status_code == 422

    # Invalid email format
    res = client.post("/api/auth/register", json={
        "email": "not-an-email",
        "full_name": "Invalid Email",
        "password": "ValidPassword123!",
        "role": "student",
    })
    assert res.status_code == 422

    # Invalid role (must be teacher or student)
    res = client.post("/api/auth/register", json={
        "email": unique_email(),
        "full_name": "Bad Role",
        "password": "ValidPassword123!",
        "role": "admin",
    })
    assert res.status_code == 422


def test_login_success(client):
    """Verify that a registered user can log in with valid credentials."""
    email = unique_email("login")
    password = "CorrectPassword123!"
    reg_payload = {
        "email": email,
        "full_name": "Alice Smith",
        "password": password,
        "role": "teacher",
    }
    client.post("/api/auth/register", json=reg_payload)

    login_res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_res.status_code == 200

    data = login_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert "access_token" in login_res.cookies


def test_login_invalid_password_returns_401(client):
    """Verify that entering an incorrect password returns 401 Unauthorized."""
    email = unique_email("wrongpwd")
    client.post("/api/auth/register", json={
        "email": email,
        "full_name": "Bob Jones",
        "password": "RealPassword123!",
        "role": "student",
    })

    login_res = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword"})
    assert login_res.status_code == 401
    assert "invalid email or password" in login_res.json()["detail"].lower()


def test_login_nonexistent_user_returns_401(client):
    """Verify that querying a nonexistent user returns 401 Unauthorized."""
    login_res = client.post("/api/auth/login", json={
        "email": "nobody_exists_here_999@example.com",
        "password": "AnyPassword123!",
    })
    assert login_res.status_code == 401


def test_get_me_authenticated(client):
    """Verify GET /api/auth/me returns the authenticated user profile."""
    email = unique_email("me")
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "full_name": "Profile User",
        "password": "Password123!",
        "role": "teacher",
    })
    token = reg_res.json()["access_token"]

    # Call with Bearer header
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email
    assert me_res.json()["role"] == "teacher"


def test_get_me_unauthenticated_returns_401(client):
    """Verify GET /api/auth/me returns 401 when no token or cookie is provided."""
    # Ensure no cookies sent
    client.cookies.clear()
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "authentication required" in res.json()["detail"].lower()


def test_logout_clears_cookie(client):
    """Verify that POST /api/auth/logout clears the session cookie."""
    email = unique_email("logout")
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "full_name": "Logout User",
        "password": "Password123!",
        "role": "student",
    })
    assert "access_token" in reg_res.cookies

    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    # Cookie should be deleted (empty or expired)
    assert logout_res.cookies.get("access_token") is None or logout_res.cookies.get("access_token") == ""


def test_expired_token_returns_401(client):
    """Verify that an expired JWT token returns 401 Unauthorized."""
    # Create token expired 10 minutes ago
    expired_token = create_access_token(
        {"sub": "1", "role": "teacher"},
        expires_delta=timedelta(minutes=-10),
    )
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_rbac_student_cannot_create_assignment(client, student_headers):
    """Requirement 6: Verify students are forbidden from creating assignments (403)."""
    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    payload = {
        "title": "Hacked Assignment",
        "subject": "Mathematics",
        "due_date": future_date,
        "status": "active",
    }
    client.cookies.clear()
    res = client.post("/api/assignments", json=payload, headers=student_headers)
    assert res.status_code == 403
    assert "access denied" in res.json()["detail"].lower()


def test_rbac_student_cannot_update_or_delete_assignment(client, teacher_headers, student_headers):
    """Requirement 6: Verify students are forbidden from updating or deleting assignments (403)."""
    future_date = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    # Teacher creates assignment
    create_res = client.post(
        "/api/assignments",
        json={
            "title": "Legitimate Teacher Assignment",
            "subject": "Science",
            "due_date": future_date,
            "status": "active",
        },
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    asgn_id = create_res.json()["id"]

    try:
        # Student attempts update -> 403
        client.cookies.clear()
        up_res = client.put(
            f"/api/assignments/{asgn_id}",
            json={"title": "Student Modified Title"},
            headers=student_headers,
        )
        assert up_res.status_code == 403

        # Student attempts delete -> 403
        del_res = client.delete(f"/api/assignments/{asgn_id}", headers=student_headers)
        assert del_res.status_code == 403
    finally:
        # Teacher cleans up
        client.delete(f"/api/assignments/{asgn_id}", headers=teacher_headers)


def test_rbac_student_can_list_and_download_assignment(client, teacher_headers, student_headers):
    """Requirement 7: Authenticated students may view and download assignments."""
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    pdf_bytes = b"%PDF-1.4\nTest Questions for Students\n%%EOF"

    # 1. Teacher creates a class
    class_res = client.post(
        "/api/classes",
        json={"name": "CS101 Intro", "description": "Intro to Computer Science"},
        headers=teacher_headers,
    )
    assert class_res.status_code == 201
    class_id = class_res.json()["id"]
    join_code = class_res.json()["join_code"]

    # 2. Student joins the class
    join_res = client.post(
        "/api/classes/join",
        json={"join_code": join_code},
        headers=student_headers,
    )
    assert join_res.status_code == 200

    # 3. Teacher creates assignment published to that class
    create_res = client.post(
        "/api/assignments",
        data={
            "title": "Student Download Test Assignment",
            "subject": "Computer Science",
            "due_date": future_date,
            "status": "active",
            "class_id": str(class_id),
        },
        files={"file": ("questions.pdf", pdf_bytes, "application/pdf")},
        headers=teacher_headers,
    )
    assert create_res.status_code == 201
    asgn_id = create_res.json()["id"]

    try:
        client.cookies.clear()
        # Student lists assignments for joined class -> 200
        list_res = client.get("/api/assignments", headers=student_headers)
        assert list_res.status_code == 200
        items = list_res.json()
        assert any(item["id"] == asgn_id for item in items)

        # Student downloads PDF -> 200
        dl_res = client.get(f"/api/assignments/{asgn_id}/download", headers=student_headers)
        assert dl_res.status_code == 200
        assert dl_res.content == pdf_bytes
    finally:
        client.delete(f"/api/assignments/{asgn_id}", headers=teacher_headers)
        client.delete(f"/api/classes/{class_id}", headers=teacher_headers)


def test_unauthenticated_request_to_protected_endpoints_returns_401(client):
    """Requirement 5: Verify that unauthenticated requests to protected endpoints return 401."""
    client.cookies.clear()

    # Create unauthenticated
    res1 = client.post("/api/assignments", json={"title": "Test"})
    assert res1.status_code == 401

    # List unauthenticated
    res2 = client.get("/api/assignments")
    assert res2.status_code == 401

    # Detail unauthenticated
    res3 = client.get("/api/assignments/1")
    assert res3.status_code == 401

    # Download unauthenticated
    res4 = client.get("/api/assignments/1/download")
    assert res4.status_code == 401


def test_role_transition_teacher_to_student_and_back(client):
    """
    Regression test for Teacher -> Student and Student -> Teacher session transitions.
    Verifies that:
    1. Teacher logs in and accesses teacher endpoints.
    2. Logging out invalidates the session cookie and subsequent protected requests return 401.
    3. Student logs in and identity resolves to role 'student'.
    4. Student is strictly forbidden (403) from accessing teacher-only management endpoints.
    5. Student can access student endpoints.
    6. Transitioning back to Teacher restores teacher permissions and profile identity.
    """
    teacher_email = unique_email("trans_teacher")
    student_email = unique_email("trans_student")
    pwd = "ValidPassword123!"

    # Setup accounts
    r_t = client.post("/api/auth/register", json={
        "email": teacher_email,
        "full_name": "Teacher Alice",
        "password": pwd,
        "role": "teacher",
    })
    assert r_t.status_code == 201

    r_s = client.post("/api/auth/register", json={
        "email": student_email,
        "full_name": "Student Bob",
        "password": pwd,
        "role": "student",
    })
    assert r_s.status_code == 201

    # 1. Login as Teacher
    login_t = client.post("/api/auth/login", json={"email": teacher_email, "password": pwd})
    assert login_t.status_code == 200
    assert "access_token" in login_t.cookies

    # Teacher identity check
    me_t = client.get("/api/auth/me")
    assert me_t.status_code == 200
    assert me_t.json()["role"] == "teacher"
    assert me_t.json()["email"] == teacher_email

    # Teacher can access teacher endpoints (e.g. create class)
    cls_res = client.post("/api/classes", json={"name": "Transition Class 101"})
    assert cls_res.status_code == 201
    class_id = cls_res.json()["id"]

    # 2. Teacher Logs Out
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Cookie cleared, cannot access protected endpoints
    me_unauth = client.get("/api/auth/me")
    assert me_unauth.status_code == 401

    # 3. Login as Student
    login_s = client.post("/api/auth/login", json={"email": student_email, "password": pwd})
    assert login_s.status_code == 200
    assert "access_token" in login_s.cookies

    # Student identity check
    me_s = client.get("/api/auth/me")
    assert me_s.status_code == 200
    assert me_s.json()["role"] == "student"
    assert me_s.json()["email"] == student_email

    # 4. Student is BLOCKED (403 Forbidden) from Teacher-only routes
    asgn_forbidden = client.post("/api/assignments", data={
        "title": "Hacked Assignment",
        "subject": "Math",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "status": "active",
        "class_id": str(class_id),
    })
    assert asgn_forbidden.status_code == 403

    alerts_forbidden = client.get(f"/api/analytics/classes/{class_id}/alerts")
    assert alerts_forbidden.status_code == 403

    # 5. Student CAN access student endpoints
    subs_res = client.get("/api/submissions")
    assert subs_res.status_code == 200
    assert isinstance(subs_res.json(), list)

    feedback_res = client.get(f"/api/analytics/student/feedback?class_id={class_id}")
    assert feedback_res.status_code == 200

    # 6. Student Logs Out & Switch back to Teacher
    client.post("/api/auth/logout")
    me_unauth2 = client.get("/api/auth/me")
    assert me_unauth2.status_code == 401

    login_t2 = client.post("/api/auth/login", json={"email": teacher_email, "password": pwd})
    assert login_t2.status_code == 200
    me_t2 = client.get("/api/auth/me")
    assert me_t2.status_code == 200
    assert me_t2.json()["role"] == "teacher"

    # Cleanup
    client.delete(f"/api/classes/{class_id}")
    client.cookies.clear()
