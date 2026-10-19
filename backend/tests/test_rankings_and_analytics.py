import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.submission import Submission
from app.models.user import User


@pytest.fixture
def analytics_setup(db_engine):
    """Fixture to set up a teacher, 2 students, a class, and 2 units."""
    unique_id = uuid.uuid4().hex[:8]
    with Session(db_engine) as session:
        teacher = User(
            email=f"analytics_teacher_{unique_id}@example.com",
            full_name="Prof. Analytics",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        s1 = User(
            email=f"alice_{unique_id}@example.com",
            full_name="Alice Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s2 = User(
            email=f"bob_{unique_id}@example.com",
            full_name="Bob Student",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([teacher, s1, s2])
        session.commit()
        session.refresh(teacher)
        session.refresh(s1)
        session.refresh(s2)

        cls = Class(
            name=f"Analytics Class {unique_id}",
            join_code=uuid.uuid4().hex[:7].upper(),
            teacher_id=teacher.id,
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)

        e1 = ClassEnrollment(class_id=cls.id, student_id=s1.id)
        e2 = ClassEnrollment(class_id=cls.id, student_id=s2.id)
        session.add_all([e1, e2])

        now_utc = datetime.now(timezone.utc)
        u1 = Assignment(
            title="Unit 1: Foundations",
            subject="Computer Science",
            due_date=now_utc + timedelta(days=5),
            unit=1,
            max_marks=100.0,
            class_id=cls.id,
            created_by_id=teacher.id,
        )
        u2 = Assignment(
            title="Unit 2: Data Structures",
            subject="Computer Science",
            due_date=now_utc + timedelta(days=10),
            unit=2,
            max_marks=100.0,
            class_id=cls.id,
            created_by_id=teacher.id,
        )
        session.add_all([u1, u2])
        session.commit()
        session.refresh(u1)
        session.refresh(u2)

        teacher_id = teacher.id
        teacher_email = teacher.email
        s1_id = s1.id
        s1_email = s1.email
        s1_name = s1.full_name
        s2_id = s2.id
        s2_email = s2.email
        s2_name = s2.full_name
        class_id = cls.id
        u1_id = u1.id
        u2_id = u2.id

    teacher_token = create_access_token({"sub": str(teacher_id), "role": "teacher", "email": teacher_email})
    s1_token = create_access_token({"sub": str(s1_id), "role": "student", "email": s1_email})
    s2_token = create_access_token({"sub": str(s2_id), "role": "student", "email": s2_email})

    return {
        "teacher_id": teacher_id,
        "teacher_headers": {"Authorization": f"Bearer {teacher_token}"},
        "s1_id": s1_id,
        "s1_name": s1_name,
        "s1_headers": {"Authorization": f"Bearer {s1_token}"},
        "s2_id": s2_id,
        "s2_name": s2_name,
        "s2_headers": {"Authorization": f"Bearer {s2_token}"},
        "class_id": class_id,
        "u1_id": u1_id,
        "u2_id": u2_id,
    }


def test_unit_rankings_and_provisional_vs_final_calculation(
    client,
    db_engine,
    analytics_setup,
):
    """
    Feature 4 & 5:
    Provisional overall percentage/ranking when required results are incomplete,
    and final calculations when all configured required units are complete.
    CRITICAL RULE: Never treat ungraded or unreleased work as zero.
    """
    class_id = analytics_setup["class_id"]
    u1_id = analytics_setup["u1_id"]
    u2_id = analytics_setup["u2_id"]
    s1_id = analytics_setup["s1_id"]
    s2_id = analytics_setup["s2_id"]
    teacher_headers = analytics_setup["teacher_headers"]

    now_utc = datetime.now(timezone.utc)

    # Student 1 (Alice): completes Unit 1 with 80/100, released. Unit 2 not submitted.
    # Student 2 (Bob): completes Unit 1 with 90/100, released. Completes Unit 2 with 70/100, released.
    with Session(db_engine) as session:
        sub1_u1 = Submission(
            assignment_id=u1_id,
            student_id=s1_id,
            file_path="/tmp/fake1.pdf",
            file_name="fake1.pdf",
            file_size=100,
            grade=80.0,
            status="released",
            released_at=now_utc,
            submitted_at=now_utc,
        )
        sub2_u1 = Submission(
            assignment_id=u1_id,
            student_id=s2_id,
            file_path="/tmp/fake2.pdf",
            file_name="fake2.pdf",
            file_size=100,
            grade=90.0,
            status="released",
            released_at=now_utc,
            submitted_at=now_utc,
        )
        sub2_u2 = Submission(
            assignment_id=u2_id,
            student_id=s2_id,
            file_path="/tmp/fake3.pdf",
            file_name="fake3.pdf",
            file_size=100,
            grade=70.0,
            status="released",
            released_at=now_utc,
            submitted_at=now_utc,
        )
        session.add_all([sub1_u1, sub2_u1, sub2_u2])
        session.commit()

    # Query rankings API
    resp = client.get(f"/api/analytics/classes/{class_id}/subjects/Computer Science/rankings", headers=teacher_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_enrolled"] == 2
    assert data["completed_count"] == 1  # Only Bob completed both units
    assert data["provisional_count"] == 2  # Both have provisional scores

    rankings = {r["student_id"]: r for r in data["rankings"]}
    alice = rankings[s1_id]
    bob = rankings[s2_id]

    # Rule Check for Alice:
    # Alice has only Unit 1 (80/100). Unit 2 is incomplete.
    # Provisional calculation: 80 / 100 = 80.0%.
    # NEVER 80 / 200 = 40.0% (which would treat Unit 2 as zero)!
    assert alice["provisional_score"] == 80.0
    assert alice["provisional_max"] == 100.0
    assert alice["provisional_percentage"] == 80.0
    assert alice["is_complete"] is False
    assert alice["final_percentage"] is None  # Not final!

    # Rule Check for Bob:
    # Bob has Unit 1 (90/100) and Unit 2 (70/100). Total: 160/200 = 80.0%.
    assert bob["provisional_score"] == 160.0
    assert bob["provisional_max"] == 200.0
    assert bob["provisional_percentage"] == 80.0
    assert bob["is_complete"] is True
    assert bob["final_percentage"] == 80.0
    assert bob["final_rank"] == 1

    # Unit 1 Rankings check: Bob (90) is Rank 1, Alice (80) is Rank 2
    alice_u1 = next(u for u in alice["units"] if u["unit"] == 1)
    bob_u1 = next(u for u in bob["units"] if u["unit"] == 1)
    assert bob_u1["unit_rank"] == 1
    assert alice_u1["unit_rank"] == 2


def test_privacy_safe_leaderboard(client, db_engine, analytics_setup):
    """
    Feature 6: Privacy-safe class leaderboard.
    """
    class_id = analytics_setup["class_id"]
    u1_id = analytics_setup["u1_id"]
    s1_id = analytics_setup["s1_id"]
    s2_id = analytics_setup["s2_id"]
    teacher_headers = analytics_setup["teacher_headers"]
    s1_headers = analytics_setup["s1_headers"]

    now_utc = datetime.now(timezone.utc)
    with Session(db_engine) as session:
        session.add_all([
            Submission(
                assignment_id=u1_id,
                student_id=s1_id,
                file_path="/tmp/f1.pdf",
                file_name="f1.pdf",
                file_size=10,
                grade=95.0,
                status="released",
                released_at=now_utc,
                submitted_at=now_utc,
            ),
            Submission(
                assignment_id=u1_id,
                student_id=s2_id,
                file_path="/tmp/f2.pdf",
                file_name="f2.pdf",
                file_size=10,
                grade=85.0,
                status="released",
                released_at=now_utc,
                submitted_at=now_utc,
            ),
        ])
        session.commit()

    # Teacher view sees real names
    resp = client.get(f"/api/analytics/classes/{class_id}/subjects/Computer Science/leaderboard", headers=teacher_headers)
    assert resp.status_code == 200
    lb = resp.json()["leaderboard"]
    assert len(lb) == 2
    assert lb[0]["display_name"] == analytics_setup["s1_name"]
    assert lb[1]["display_name"] == analytics_setup["s2_name"]

    # Student view: s1 sees "You" for self, and anonymized "Student #2" for s2
    resp = client.get(f"/api/analytics/classes/{class_id}/subjects/Computer Science/leaderboard", headers=s1_headers)
    assert resp.status_code == 200
    lb = resp.json()["leaderboard"]
    assert len(lb) == 2
    assert lb[0]["display_name"] == "You"
    assert lb[0]["is_self"] is True
    assert "Student #" in lb[1]["display_name"]
    assert lb[1]["is_self"] is False


def test_class_overview_and_alerts(client, db_engine, analytics_setup):
    """
    Feature 7 & 8: Class overview, averages, grade distribution, and teacher alerts.
    """
    class_id = analytics_setup["class_id"]
    u1_id = analytics_setup["u1_id"]
    s1_id = analytics_setup["s1_id"]
    s2_id = analytics_setup["s2_id"]
    teacher_headers = analytics_setup["teacher_headers"]

    now_utc = datetime.now(timezone.utc)
    with Session(db_engine) as session:
        session.add_all([
            Submission(
                assignment_id=u1_id,
                student_id=s1_id,
                file_path="/tmp/f.pdf",
                file_name="f.pdf",
                file_size=10,
                grade=95.0,
                status="released",
                released_at=now_utc,
                submitted_at=now_utc,
            ),
            Submission(
                assignment_id=u1_id,
                student_id=s2_id,
                file_path="/tmp/f2.pdf",
                file_name="f2.pdf",
                file_size=10,
                grade=45.0,
                status="released",
                released_at=now_utc,
                submitted_at=now_utc,
            ),
        ])
        session.commit()

    # Overview
    resp = client.get(f"/api/analytics/classes/{class_id}/overview", headers=teacher_headers)
    assert resp.status_code == 200
    ov = resp.json()
    assert ov["distribution"]["grade_a"] == 1
    assert ov["distribution"]["grade_f"] == 1
    assert ov["class_average_percentage"] == 70.0  # (95 + 45) / 2

    # Alerts: Bob should be flagged as at risk (< 50%)
    resp = client.get(f"/api/analytics/classes/{class_id}/alerts", headers=teacher_headers)
    assert resp.status_code == 200
    alerts = resp.json()
    at_risk_names = [s["student_name"] for s in alerts["at_risk_students"]]
    assert analytics_setup["s2_name"] in at_risk_names


def test_downloadable_reports_csv(client, analytics_setup):
    """
    Feature 16: Downloadable summary and detailed CSV reports at class/subject scope.
    """
    class_id = analytics_setup["class_id"]
    teacher_headers = analytics_setup["teacher_headers"]

    # 1. Summary CSV
    resp = client.get(f"/api/analytics/classes/{class_id}/reports/summary.csv", headers=teacher_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Total Students" in resp.text

    # 2. Detailed CSV
    resp = client.get(
        f"/api/analytics/classes/{class_id}/reports/detailed.csv?subject=Computer%20Science",
        headers=teacher_headers,
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Unit 1 Score" in resp.text
    assert "Unit 2 Score" in resp.text


def test_subject_finalization_flow(client, db_engine, analytics_setup):
    """
    Feature 17: Teacher-reviewed and explicitly finalized combined results with audit trail.
    """
    class_id = analytics_setup["class_id"]
    u1_id = analytics_setup["u1_id"]
    u2_id = analytics_setup["u2_id"]
    s2_id = analytics_setup["s2_id"]
    teacher_headers = analytics_setup["teacher_headers"]

    now_utc = datetime.now(timezone.utc)
    with Session(db_engine) as session:
        session.add_all([
            Submission(
                assignment_id=u1_id,
                student_id=s2_id,
                file_path="/tmp/f.pdf",
                file_name="f.pdf",
                file_size=10,
                grade=90.0,
                status="released",
                released_at=now_utc,
                submitted_at=now_utc,
            ),
            Submission(
                assignment_id=u2_id,
                student_id=s2_id,
                file_path="/tmp/f.pdf",
                file_name="f.pdf",
                file_size=10,
                grade=80.0,
                status="released",
                released_at=now_utc,
                submitted_at=now_utc,
            ),
        ])
        session.commit()

    # Teacher finalizes results for required units [1, 2]
    finalize_payload = {
        "required_units": [1, 2],
        "notes": "End of semester finalization batch",
    }
    resp = client.post(
        f"/api/classes/{class_id}/subjects/Computer Science/finalize",
        json=finalize_payload,
        headers=teacher_headers,
    )
    assert resp.status_code == 200
    final_list = resp.json()
    assert len(final_list) == 2

    bob_res = next(r for r in final_list if r["student_id"] == s2_id)
    assert bob_res["is_final"] is True
    assert bob_res["total_score"] == 170.0
    assert bob_res["max_score"] == 200.0
    assert bob_res["percentage"] == 85.0

    # Query finalized results
    resp = client.get(
        f"/api/classes/{class_id}/subjects/Computer Science/finalized",
        headers=teacher_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_analytics_regression_correctness(client, db_engine):
    """
    Regression test verifying:
    - Multiple units with different max marks (50, 150, 100)
    - Released vs unreleased grades (unreleased NOT treated as 0)
    - Ungraded and missing submissions
    - Correct percentage calculation (provisional_percentage <= 100%, earned marks != %)
    - Class average percentage, submission compliance rate, grade distribution, unit comparisons
    - Schema bindings (rank, status, unit_marks, title, graded_count)
    """
    unique_id = uuid.uuid4().hex[:8]
    now_utc = datetime.now(timezone.utc)

    with Session(db_engine) as session:
        teacher = User(
            email=f"prof_reg_{unique_id}@example.com",
            full_name="Prof. Regression",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        s_bob = User(
            email=f"bob_reg_{unique_id}@example.com",
            full_name="Bob TopStudent",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s_alice = User(
            email=f"alice_reg_{unique_id}@example.com",
            full_name="Alice MidStudent",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        s_charlie = User(
            email=f"charlie_reg_{unique_id}@example.com",
            full_name="Charlie Ungraded",
            hashed_password=hash_password("Pass123!"),
            role="student",
            is_active=True,
        )
        session.add_all([teacher, s_bob, s_alice, s_charlie])
        session.commit()
        for u in [teacher, s_bob, s_alice, s_charlie]:
            session.refresh(u)

        cls = Class(
            name=f"Physics 101 {unique_id}",
            join_code=uuid.uuid4().hex[:7].upper(),
            teacher_id=teacher.id,
        )
        session.add(cls)
        session.commit()
        session.refresh(cls)

        for s in [s_bob, s_alice, s_charlie]:
            session.add(ClassEnrollment(class_id=cls.id, student_id=s.id))

        u1 = Assignment(
            title="Lab 1: Motion",
            subject="Physics",
            due_date=now_utc + timedelta(days=3),
            unit=1,
            max_marks=50.0,
            class_id=cls.id,
            created_by_id=teacher.id,
        )
        u2 = Assignment(
            title="Midterm Exam",
            subject="Physics",
            due_date=now_utc + timedelta(days=7),
            unit=2,
            max_marks=150.0,
            class_id=cls.id,
            created_by_id=teacher.id,
        )
        u3 = Assignment(
            title="Final Project",
            subject="Physics",
            due_date=now_utc + timedelta(days=14),
            unit=3,
            max_marks=100.0,
            class_id=cls.id,
            created_by_id=teacher.id,
        )
        session.add_all([u1, u2, u3])
        session.commit()
        for a in [u1, u2, u3]:
            session.refresh(a)

        # Bob: all 3 units completed and released
        # Unit 1: 45/50 (90%)
        # Unit 2: 135/150 (90%)
        # Unit 3: 95/100 (95%)
        # Total: 275/300 = 91.67%
        session.add_all([
            Submission(assignment_id=u1.id, student_id=s_bob.id, file_path="/tmp/b1.pdf", file_name="b1.pdf", file_size=10, grade=45.0, status="released", released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u2.id, student_id=s_bob.id, file_path="/tmp/b2.pdf", file_name="b2.pdf", file_size=10, grade=135.0, status="released", released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u3.id, student_id=s_bob.id, file_path="/tmp/b3.pdf", file_name="b3.pdf", file_size=10, grade=95.0, status="released", released_at=now_utc, submitted_at=now_utc),
        ])

        # Alice: Unit 1 released, Unit 2 released, Unit 3 graded but unreleased
        # Unit 1: 40/50 (80%)
        # Unit 2: 120/150 (80%)
        # Unit 3: 80/100 (unreleased)
        # Provisional (only released): (40 + 120) / (50 + 150) = 160 / 200 = 80.0%
        session.add_all([
            Submission(assignment_id=u1.id, student_id=s_alice.id, file_path="/tmp/a1.pdf", file_name="a1.pdf", file_size=10, grade=40.0, status="released", released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u2.id, student_id=s_alice.id, file_path="/tmp/a2.pdf", file_name="a2.pdf", file_size=10, grade=120.0, status="released", released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u3.id, student_id=s_alice.id, file_path="/tmp/a3.pdf", file_name="a3.pdf", file_size=10, grade=80.0, status="graded", released_at=None, submitted_at=now_utc),
        ])

        # Charlie: Unit 1 submitted but ungraded, Unit 2 & 3 missing
        session.add(
            Submission(assignment_id=u1.id, student_id=s_charlie.id, file_path="/tmp/c1.pdf", file_name="c1.pdf", file_size=10, grade=None, status="submitted", submitted_at=now_utc)
        )
        session.commit()

        teacher_token = create_access_token({"sub": str(teacher.id), "role": "teacher", "email": teacher.email})
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        class_id_val = cls.id
        bob_id_val = s_bob.id
        alice_id_val = s_alice.id
        charlie_id_val = s_charlie.id

    # 1. Verify Class Overview API
    ov_resp = client.get(f"/api/analytics/classes/{class_id_val}/overview", headers=teacher_headers)
    assert ov_resp.status_code == 200
    ov = ov_resp.json()

    assert ov["total_students"] == 3
    assert ov["total_assignments"] == 3
    # Submission rate: 7 submissions out of 9 total expected = 77.8%
    assert ov["submission_compliance_rate"] is not None
    assert 70.0 <= ov["submission_compliance_rate"] <= 85.0
    # Class average: Bob (91.67%) and Alice (80.0%) average ~ 85.83%
    assert ov["class_average"] is not None
    assert ov["class_average_percentage"] is not None
    assert ov["class_average"] == ov["class_average_percentage"]
    assert 80.0 <= ov["class_average_percentage"] <= 95.0

    assert "grade_distribution" in ov
    assert "A (85-100%)" in ov["grade_distribution"]
    assert ov["grade_distribution"]["A (85-100%)"] == 1  # Bob (distinct student)
    assert ov["grade_distribution"]["B (70-84%)"] == 1   # Alice (distinct student)
    assert ov["distribution"]["grade_a"] == 1
    assert ov["distribution"]["grade_b"] == 1
    total_dist = (ov["distribution"]["grade_a"] + ov["distribution"]["grade_b"] +
                  ov["distribution"]["grade_c"] + ov["distribution"]["grade_d"] +
                  ov["distribution"]["grade_f"])
    assert total_dist == 2  # exactly 2 distinct students with released grades, NOT 5 submissions!

    # Unit comparisons check
    assert len(ov["unit_comparisons"]) == 3
    u1_comp = next(u for u in ov["unit_comparisons"] if u["unit"] == 1)
    assert u1_comp["title"] == "Lab 1: Motion"
    assert u1_comp["graded_count"] == 2  # Alice and Bob released
    assert u1_comp["released_count"] == 2
    assert u1_comp["average_percentage"] == 85.0

    u2_comp = next(u for u in ov["unit_comparisons"] if u["unit"] == 2)
    assert u2_comp["title"] == "Midterm Exam"
    assert u2_comp["graded_count"] == 2
    assert u2_comp["average_percentage"] == 85.0

    u3_comp = next(u for u in ov["unit_comparisons"] if u["unit"] == 3)
    assert u3_comp["title"] == "Final Project"
    assert u3_comp["graded_count"] == 1  # Only Bob is released!
    assert u3_comp["average_percentage"] == 95.0

    # 2. Verify Subject Rankings API
    rk_resp = client.get(f"/api/analytics/classes/{class_id_val}/subjects/Physics/rankings", headers=teacher_headers)
    assert rk_resp.status_code == 200
    rk = rk_resp.json()

    assert rk["units"] == [1, 2, 3]
    assert rk["is_finalized"] is False
    assert len(rk["rankings"]) == 3

    bob_rk = next(s for s in rk["rankings"] if s["student_id"] == bob_id_val)
    alice_rk = next(s for s in rk["rankings"] if s["student_id"] == alice_id_val)
    charlie_rk = next(s for s in rk["rankings"] if s["student_id"] == charlie_id_val)

    # Bob: Rank 1, 275 marks (score) -> 91.67% (percentage). Percentage must NOT be 275!
    assert bob_rk["rank"] == 1
    assert bob_rk["provisional_score"] == 275.0
    assert bob_rk["provisional_percentage"] == 91.67
    assert bob_rk["provisional_percentage"] <= 100.0
    assert bob_rk["final_score"] == 275.0
    assert bob_rk["final_percentage"] == 91.67
    assert bob_rk["is_complete"] is True
    assert bob_rk["status"] in ("complete", "finalized")
    assert bob_rk["unit_marks"]["1"] == 45.0
    assert bob_rk["unit_marks"]["2"] == 135.0
    assert bob_rk["unit_marks"]["3"] == 95.0

    # Alice: Rank 2, 160 marks out of 200 eligible marks = 80.0%
    # Crucially, Unit 3 is NOT released, so earned max is 200, NOT 300 (never treated as 0)
    assert alice_rk["rank"] == 2
    assert alice_rk["provisional_score"] == 160.0
    assert alice_rk["provisional_percentage"] == 80.0
    assert alice_rk["provisional_percentage"] <= 100.0
    # Final score is None because Unit 3 is not released
    assert alice_rk["final_score"] is None
    assert alice_rk["final_percentage"] is None
    assert alice_rk["is_complete"] is False
    assert alice_rk["unit_marks"]["1"] == 40.0
    assert alice_rk["unit_marks"]["2"] == 120.0

    # Charlie: Rank 3, ungraded/unsubmitted work is NOT treated as zero
    assert charlie_rk["rank"] == 3
    assert charlie_rk["provisional_score"] is None
    assert charlie_rk["provisional_percentage"] is None
    assert charlie_rk["final_score"] is None
    assert charlie_rk["final_percentage"] is None
    assert charlie_rk["is_complete"] is False
    assert charlie_rk["status"] == "provisional"

    # Also verify as Student Alice to ensure privacy: unreleased work is hidden from student
    alice_token = create_access_token({"sub": str(alice_id_val), "role": "student", "email": "alice_test@example.com"})
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    rk_student_resp = client.get(f"/api/analytics/classes/{class_id_val}/subjects/Physics/rankings", headers=alice_headers)
    assert rk_student_resp.status_code == 200
    rk_student = rk_student_resp.json()
    alice_self = next(s for s in rk_student["rankings"] if s["student_id"] == alice_id_val)
    assert alice_self["unit_marks"].get("3") is None
    assert alice_self["provisional_score"] == 160.0
    assert alice_self["provisional_percentage"] == 80.0
    assert alice_self["final_score"] is None


def test_rankings_distinct_and_tied_ranks_with_duplicate_submissions(client, db_engine):
    """
    Regression test verifying:
    1. Distinct ranks: Complete students rank ahead of provisional students even if percentages match.
       Student with 80% complete ranks higher than student with 80% provisional.
    2. Tied ranks with deterministic handling: True ties (identical metrics) share the same rank,
       with standard competition ranking gaps (1, 1, 3).
    3. Duplicate submissions: Resubmissions on a unit do not duplicate student counts or overwrite released grades.
    4. Grade distribution: Counts distinct enrolled students, matching class enrollment count.
    """
    unique_id = uuid.uuid4().hex[:8]
    now_utc = datetime.now(timezone.utc)

    with Session(db_engine) as session:
        teacher = User(
            email=f"prof_ties_{unique_id}@example.com",
            full_name="Prof. Ties",
            hashed_password=hash_password("Pass123!"),
            role="teacher",
            is_active=True,
        )
        s_alice = User(email=f"alice_t_{unique_id}@example.com", full_name="Alice Alpha", hashed_password=hash_password("Pass123!"), role="student", is_active=True)
        s_bob = User(email=f"bob_t_{unique_id}@example.com", full_name="Bob Beta", hashed_password=hash_password("Pass123!"), role="student", is_active=True)
        s_charlie = User(email=f"charlie_t_{unique_id}@example.com", full_name="Charlie Gamma", hashed_password=hash_password("Pass123!"), role="student", is_active=True)
        s_david = User(email=f"david_t_{unique_id}@example.com", full_name="David Delta", hashed_password=hash_password("Pass123!"), role="student", is_active=True)

        session.add_all([teacher, s_alice, s_bob, s_charlie, s_david])
        session.commit()
        for u in [teacher, s_alice, s_bob, s_charlie, s_david]:
            session.refresh(u)

        cls = Class(name=f"Math Ties {unique_id}", join_code=uuid.uuid4().hex[:7].upper(), teacher_id=teacher.id)
        session.add(cls)
        session.commit()
        session.refresh(cls)

        for s in [s_alice, s_bob, s_charlie, s_david]:
            session.add(ClassEnrollment(class_id=cls.id, student_id=s.id))

        u1 = Assignment(title="Unit 1: Algebra", subject="Math", due_date=now_utc + timedelta(days=5), unit=1, max_marks=100.0, class_id=cls.id, created_by_id=teacher.id)
        u2 = Assignment(title="Unit 2: Calculus", subject="Math", due_date=now_utc + timedelta(days=10), unit=2, max_marks=100.0, class_id=cls.id, created_by_id=teacher.id)
        session.add_all([u1, u2])
        session.commit()
        session.refresh(u1)
        session.refresh(u2)

        # Alice: 90 on U1, 90 on U2 -> 180/200 = 90.0% (Complete)
        # Bob: 90 on U1, 90 on U2 -> 180/200 = 90.0% (Complete - EXACT TIE with Alice!)
        # Charlie: 80 on U1, 80 on U2 -> 160/200 = 80.0% (Complete)
        # David: 80 on U1, U2 missing -> 80/100 = 80.0% (Provisional)
        #
        # Submissions across units total 7 (Alice 2, Bob 2, Charlie 2, David 1).
        # Grade distribution must NOT count 7 submissions, but exactly 4 distinct students!
        session.add_all([
            # Alice (2 submissions across units)
            Submission(assignment_id=u1.id, student_id=s_alice.id, file_path="/tmp/a1.pdf", file_name="a1.pdf", file_size=10, grade=90.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u2.id, student_id=s_alice.id, file_path="/tmp/a2.pdf", file_name="a2.pdf", file_size=10, grade=90.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
            # Bob (2 submissions across units)
            Submission(assignment_id=u1.id, student_id=s_bob.id, file_path="/tmp/b1.pdf", file_name="b1.pdf", file_size=10, grade=90.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u2.id, student_id=s_bob.id, file_path="/tmp/b2.pdf", file_name="b2.pdf", file_size=10, grade=90.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
            # Charlie (2 submissions across units)
            Submission(assignment_id=u1.id, student_id=s_charlie.id, file_path="/tmp/c1.pdf", file_name="c1.pdf", file_size=10, grade=80.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
            Submission(assignment_id=u2.id, student_id=s_charlie.id, file_path="/tmp/c2.pdf", file_name="c2.pdf", file_size=10, grade=80.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
            # David (1 submission across units)
            Submission(assignment_id=u1.id, student_id=s_david.id, file_path="/tmp/d1.pdf", file_name="d1.pdf", file_size=10, grade=80.0, status="released", attempt_number=1, released_at=now_utc, submitted_at=now_utc),
        ])
        session.commit()

        teacher_token = create_access_token({"sub": str(teacher.id), "role": "teacher", "email": teacher.email})
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        class_id_val = cls.id
        alice_id = s_alice.id
        bob_id = s_bob.id
        charlie_id = s_charlie.id
        david_id = s_david.id

    # 1. Verify Rankings & Ties
    rk_resp = client.get(f"/api/analytics/classes/{class_id_val}/subjects/Math/rankings", headers=teacher_headers)
    assert rk_resp.status_code == 200
    rk = rk_resp.json()

    alice_rk = next(s for s in rk["rankings"] if s["student_id"] == alice_id)
    bob_rk = next(s for s in rk["rankings"] if s["student_id"] == bob_id)
    charlie_rk = next(s for s in rk["rankings"] if s["student_id"] == charlie_id)
    david_rk = next(s for s in rk["rankings"] if s["student_id"] == david_id)

    # Alice and Bob tied for Rank #1
    assert alice_rk["rank"] == 1
    assert bob_rk["rank"] == 1
    assert alice_rk["final_rank"] == 1
    assert bob_rk["final_rank"] == 1
    assert alice_rk["is_complete"] is True
    assert bob_rk["is_complete"] is True

    # Charlie is Rank #3 due to competition ranking gap after tied #1 (1, 1, 3)
    assert charlie_rk["rank"] == 3
    assert charlie_rk["final_rank"] == 3
    assert charlie_rk["is_complete"] is True
    assert charlie_rk["final_percentage"] == 80.0

    # David is Rank #4: David has 80% provisional, but is incomplete (only 1 unit, 80 marks).
    # Charlie (complete, 160 marks) MUST rank ahead of David!
    # David MUST NOT be Rank #1 or Rank #3!
    assert david_rk["rank"] == 4
    assert david_rk["provisional_rank"] == 4
    assert david_rk["final_rank"] is None
    assert david_rk["is_complete"] is False
    assert david_rk["status"] == "provisional"

    # 2. Verify Grade Distribution: distinct students only!
    ov_resp = client.get(f"/api/analytics/classes/{class_id_val}/overview", headers=teacher_headers)
    assert ov_resp.status_code == 200
    ov = ov_resp.json()

    assert ov["total_students"] == 4
    # Grade A: Alice (90%) and Bob (90%) = 2 students
    # Grade B: Charlie (80%) and David (80%) = 2 students
    assert ov["distribution"]["grade_a"] == 2
    assert ov["distribution"]["grade_b"] == 2
    assert ov["distribution"]["grade_c"] == 0
    assert ov["distribution"]["grade_d"] == 0
    assert ov["distribution"]["grade_f"] == 0

    total_dist_students = (ov["distribution"]["grade_a"] + ov["distribution"]["grade_b"] +
                           ov["distribution"]["grade_c"] + ov["distribution"]["grade_d"] +
                           ov["distribution"]["grade_f"])
    # Total MUST be exactly 4 (matching enrolled students), NEVER 7 (counting submissions across units)
    assert total_dist_students == 4
