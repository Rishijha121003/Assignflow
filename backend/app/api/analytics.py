import csv
import io
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_teacher
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.submission import Submission
from app.models.user import User
from app.schemas.analytics import (
    AtRiskStudent,
    ClassOverviewResponse,
    ClassRankingsResponse,
    GradeDistribution,
    LeaderboardEntry,
    LeaderboardResponse,
    StudentFeedbackItem,
    StudentRankingItem,
    TeacherAlertsResponse,
    UnitComparison,
    UnitScoreItem,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def sanitize_csv_value(value: Any) -> str:
    """
    Prevents CSV formula injection (DDE attacks) for spreadsheet viewers.
    Prepends a single quote if the string begins with =, +, -, @, \\t, or \\r.
    """
    if value is None:
        return ""
    str_val = str(value)
    if str_val and str_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{str_val}"
    return str_val


def verify_class_access(cls: Class, user: User, db: Session):
    """Verifies that the user has access to this class (teacher owner or enrolled student)."""
    if user.role == "teacher":
        if cls.teacher_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not teach this class.")
    elif user.role == "student":
        enr = (
            db.query(ClassEnrollment)
            .filter(ClassEnrollment.class_id == cls.id, ClassEnrollment.student_id == user.id)
            .first()
        )
        if not enr:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this class.")


def compute_class_rankings(
    cls: Class,
    subject: str,
    db: Session,
    viewer: User,
    required_units_override: Optional[List[int]] = None,
) -> ClassRankingsResponse:
    """
    Computes unit rankings, provisional calculations, and final calculations.
    Rule: Never treat ungraded or unreleased work as zero.
    """
    # Find all assignments for this class and subject
    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.class_id == cls.id,
            func.lower(Assignment.subject) == subject.strip().lower(),
        )
        .order_by(Assignment.unit.asc())
        .all()
    )

    distinct_units = sorted(list({a.unit for a in assignments if a.unit is not None}))
    required_units = required_units_override if required_units_override is not None else distinct_units

    # Check if subject is finalized
    from app.models.finalization import FinalizedResult
    is_subject_finalized = (
        db.query(FinalizedResult)
        .filter(
            FinalizedResult.class_id == cls.id,
            func.lower(FinalizedResult.subject) == subject.strip().lower(),
        )
        .first()
        is not None
    )

    # Fetch enrollments
    enrollments = (
        db.query(ClassEnrollment)
        .filter(ClassEnrollment.class_id == cls.id)
        .all()
    )

    # Unit-wise scores and rankings calculation
    # unit -> list of (student_id, score, max_marks)
    unit_released_scores: Dict[int, List[dict]] = {u: [] for u in distinct_units}
    # (student_id, unit) -> dict of score details
    student_unit_map = {}

    for asg in assignments:
        if asg.unit is None:
            continue
        subs = db.query(Submission).filter(Submission.assignment_id == asg.id).all()
        subs_by_student: Dict[int, List[Submission]] = {}
        for s in subs:
            subs_by_student.setdefault(s.student_id, []).append(s)

        for enr in enrollments:
            sid = enr.student_id
            student_subs = subs_by_student.get(sid, [])
            rel_sub = next(
                (s for s in sorted(student_subs, key=lambda x: (x.attempt_number or 1, x.id), reverse=True)
                 if s.status == "released" and s.grade is not None),
                None
            )
            draft_sub = next(
                (s for s in sorted(student_subs, key=lambda x: (x.attempt_number or 1, x.id), reverse=True)
                 if s.grade is not None),
                None
            )
            latest_sub = sorted(student_subs, key=lambda x: (x.attempt_number or 1, x.id), reverse=True)[0] if student_subs else None

            sub = rel_sub or (draft_sub if viewer.role == "teacher" else latest_sub)
            max_m = float(asg.max_marks or 100.0)

            if sub and sub.status == "released" and sub.grade is not None:
                g_val = float(sub.grade)
                pct = round((g_val / max_m) * 100, 2) if max_m > 0 else 0.0
                item = {
                    "unit": asg.unit,
                    "assignment_id": asg.id,
                    "assignment_title": asg.title,
                    "status": "released",
                    "score": g_val,
                    "max_marks": max_m,
                    "percentage": pct,
                    "is_released": True,
                }
                unit_released_scores[asg.unit].append({"student_id": sid, "score": g_val})
            elif sub and sub.grade is not None and viewer.role == "teacher":
                # Teacher can see draft marks, but marked as draft
                g_val = float(sub.grade)
                pct = round((g_val / max_m) * 100, 2) if max_m > 0 else 0.0
                item = {
                    "unit": asg.unit,
                    "assignment_id": asg.id,
                    "assignment_title": asg.title,
                    "status": "graded",
                    "score": g_val,
                    "max_marks": max_m,
                    "percentage": pct,
                    "is_released": False,
                }
            elif sub:
                item = {
                    "unit": asg.unit,
                    "assignment_id": asg.id,
                    "assignment_title": asg.title,
                    "status": "submitted",
                    "score": None,
                    "max_marks": max_m,
                    "percentage": None,
                    "is_released": False,
                }
            else:
                item = {
                    "unit": asg.unit,
                    "assignment_id": asg.id,
                    "assignment_title": asg.title,
                    "status": "missing",
                    "score": None,
                    "max_marks": max_m,
                    "percentage": None,
                    "is_released": False,
                }
            student_unit_map[(sid, asg.unit)] = item

    # Assign unit ranks for released scores
    unit_ranks: Dict[int, Dict[int, int]] = {}
    for u, scores in unit_released_scores.items():
        scores.sort(key=lambda x: x["score"], reverse=True)
        u_rank = {}
        cur_rank = 1
        for idx, entry in enumerate(scores):
            if idx > 0 and entry["score"] < scores[idx - 1]["score"]:
                cur_rank = idx + 1
            u_rank[entry["student_id"]] = cur_rank
        unit_ranks[u] = u_rank

    # Compile student records
    student_records = []
    for enr in enrollments:
        student = enr.student
        is_self = (student.id == viewer.id)
        student_name = student.full_name
        student_email = student.email if viewer.role == "teacher" or is_self else None

        unit_items = []
        unit_marks = {}
        earned_score = 0.0
        earned_max = 0.0
        completed_units_set = set()

        for u in distinct_units:
            raw_item = student_unit_map.get((student.id, u))
            if raw_item:
                u_rank = unit_ranks.get(u, {}).get(student.id)
                unit_item = UnitScoreItem(
                    unit=raw_item["unit"],
                    assignment_id=raw_item["assignment_id"],
                    assignment_title=raw_item["assignment_title"],
                    status=raw_item["status"],
                    score=raw_item["score"],
                    max_marks=raw_item["max_marks"],
                    percentage=raw_item["percentage"],
                    unit_rank=u_rank,
                    is_released=raw_item["is_released"],
                )
                unit_items.append(unit_item)

                # Only include released work in provisional/final calculations
                if raw_item["is_released"] and raw_item["score"] is not None:
                    earned_score += raw_item["score"]
                    earned_max += raw_item["max_marks"]
                    completed_units_set.add(u)
                    unit_marks[u] = raw_item["score"]
                elif viewer.role == "teacher" and raw_item["score"] is not None:
                    unit_marks[u] = raw_item["score"]
                else:
                    unit_marks[u] = None

        # Provisional calculation
        provisional_percentage = None
        provisional_score = None
        provisional_max = None
        if earned_max > 0:
            provisional_score = round(earned_score, 2)
            provisional_max = round(earned_max, 2)
            provisional_percentage = round((earned_score / earned_max) * 100, 2)

        # Final calculation: only if all required_units are complete
        is_complete = set(required_units).issubset(completed_units_set) if required_units else False
        final_percentage = None
        final_score = None
        final_max = None
        if is_complete and earned_max > 0:
            final_score = provisional_score
            final_max = provisional_max
            final_percentage = provisional_percentage

        status_label = "finalized" if (is_complete and is_subject_finalized) else ("complete" if is_complete else "provisional")

        student_records.append(
            StudentRankingItem(
                student_id=student.id,
                student_name=student_name,
                student_email=student_email,
                is_self=is_self,
                provisional_score=provisional_score,
                provisional_max=provisional_max,
                provisional_percentage=provisional_percentage,
                final_score=final_score,
                final_max=final_max,
                final_percentage=final_percentage,
                is_complete=is_complete,
                status=status_label,
                completed_units_count=len(completed_units_set),
                total_required_units=len(required_units),
                units=unit_items,
                unit_marks=unit_marks,
            )
        )

    # 1. Provisional Rankings (among students with provisional scores)
    # Sort order: is_complete desc, provisional_percentage desc, completed_units_count desc, provisional_score desc, deterministic
    prov_sortable = [r for r in student_records if r.provisional_percentage is not None]
    prov_sortable.sort(
        key=lambda r: (
            1 if r.is_complete else 0,
            r.provisional_percentage or 0.0,
            r.completed_units_count or 0,
            r.provisional_score or 0.0,
            -(r.student_id or 0),
        ),
        reverse=True,
    )

    def is_prov_tied(a, b):
        return (
            a.is_complete == b.is_complete
            and a.provisional_percentage == b.provisional_percentage
            and a.completed_units_count == b.completed_units_count
            and a.provisional_score == b.provisional_score
        )

    for idx, r in enumerate(prov_sortable):
        if idx > 0:
            if is_prov_tied(r, prov_sortable[idx - 1]):
                r.provisional_rank = prov_sortable[idx - 1].provisional_rank
            else:
                r.provisional_rank = idx + 1
        else:
            r.provisional_rank = 1

    # 2. Final Rankings (among completed students)
    final_sortable = [r for r in student_records if r.is_complete and r.final_percentage is not None]
    final_sortable.sort(
        key=lambda r: (
            r.final_percentage or 0.0,
            r.final_score or 0.0,
            -(r.student_id or 0),
        ),
        reverse=True,
    )

    def is_final_tied(a, b):
        return (
            a.final_percentage == b.final_percentage
            and a.final_score == b.final_score
        )

    for idx, r in enumerate(final_sortable):
        if idx > 0:
            if is_final_tied(r, final_sortable[idx - 1]):
                r.final_rank = final_sortable[idx - 1].final_rank
            else:
                r.final_rank = idx + 1
        else:
            r.final_rank = 1

    # 3. Overall Unified Class Ranking
    # Completed students first, then provisional students, then unranked students
    def unified_sort_key(r):
        if r.is_complete and r.final_percentage is not None:
            return (0, -(r.final_percentage or 0.0), -(r.final_score or 0.0), (r.student_name or "").lower(), r.student_id)
        elif r.provisional_percentage is not None:
            return (1, -(r.provisional_percentage or 0.0), -(r.completed_units_count or 0), -(r.provisional_score or 0.0), (r.student_name or "").lower(), r.student_id)
        else:
            return (2, 0, 0, 0, (r.student_name or "").lower(), r.student_id)

    student_records.sort(key=unified_sort_key)

    def is_unified_tied(a, b):
        if a.is_complete != b.is_complete:
            return False
        if a.is_complete:
            return is_final_tied(a, b)
        if a.provisional_percentage is not None and b.provisional_percentage is not None:
            return is_prov_tied(a, b)
        return (a.provisional_percentage is None and b.provisional_percentage is None)

    for idx, r in enumerate(student_records):
        if idx > 0:
            if is_unified_tied(r, student_records[idx - 1]):
                r.rank = student_records[idx - 1].rank
            else:
                r.rank = idx + 1
        else:
            r.rank = 1

    # Privacy wall: when viewer is a student, anonymize all peer names
    if viewer.role == "student":
        for idx, r in enumerate(student_records):
            if not r.is_self:
                r.student_name = f"Student #{idx + 1}"

    completed_count = sum(1 for r in student_records if r.is_complete)
    provisional_count = sum(1 for r in student_records if r.provisional_percentage is not None)

    return ClassRankingsResponse(
        class_id=cls.id,
        class_name=cls.name,
        subject=subject,
        required_units=required_units,
        units=required_units,
        is_finalized=is_subject_finalized,
        total_enrolled=len(enrollments),
        completed_count=completed_count,
        provisional_count=provisional_count,
        rankings=student_records,
    )


# ---------------------------------------------------------
# Feature 4 & 5: Unit Rankings & Provisional/Final Calculation
# ---------------------------------------------------------
@router.get(
    "/classes/{class_id}/subjects/{subject}/rankings",
    response_model=ClassRankingsResponse,
    summary="Get unit-wise rankings and provisional/final scores for a class subject",
)
def get_rankings(
    class_id: int,
    subject: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    verify_class_access(cls, current_user, db)

    return compute_class_rankings(cls, subject, db, current_user)


# ---------------------------------------------------------
# Feature 6: Privacy-safe Class Leaderboard
# ---------------------------------------------------------
@router.get(
    "/classes/{class_id}/subjects/{subject}/leaderboard",
    response_model=LeaderboardResponse,
    summary="Get privacy-safe leaderboard for a class subject",
)
def get_leaderboard(
    class_id: int,
    subject: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    verify_class_access(cls, current_user, db)

    data = compute_class_rankings(cls, subject, db, current_user)

    # Filter to students with at least 1 released unit (has provisional percentage)
    active = [r for r in data.rankings if r.provisional_percentage is not None]
    active.sort(key=lambda x: x.provisional_percentage, reverse=True)

    entries = []
    is_teacher = (current_user.role == "teacher")

    for idx, r in enumerate(active):
        display_name = r.student_name if is_teacher else ("You" if r.is_self else f"Student #{idx + 1}")
        entries.append(
            LeaderboardEntry(
                rank=r.provisional_rank or (idx + 1),
                display_name=display_name,
                percentage=r.provisional_percentage,
                units_completed=r.completed_units_count,
                is_self=r.is_self,
            )
        )

    return LeaderboardResponse(
        class_id=cls.id,
        class_name=cls.name,
        subject=subject,
        total_participants=len(entries),
        leaderboard=entries,
    )


# ---------------------------------------------------------
# Feature 7: Class-level Analytics Overview
# ---------------------------------------------------------
@router.get(
    "/classes/{class_id}/overview",
    response_model=ClassOverviewResponse,
    summary="Get class-level analytics overview",
)
def get_class_overview(
    class_id: int,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    verify_class_access(cls, current_user, db)

    asg_query = db.query(Assignment).filter(Assignment.class_id == class_id)
    if subject:
        asg_query = asg_query.filter(func.lower(Assignment.subject) == subject.strip().lower())
    assignments = asg_query.order_by(Assignment.unit.asc()).all()

    # Enrollments for class
    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    enrolled_count = len(enrollments)

    total_pct_sum = 0.0
    total_pct_count = 0
    unit_comparisons = []
    pending_submissions_count = 0
    unreleased_grades_count = 0

    subj_name = subject or (assignments[0].subject if assignments else "General")

    # Map of student_id -> {"earned": float, "max": float} across distinct assignments
    student_released_totals: Dict[int, Dict[str, float]] = {enr.student_id: {"earned": 0.0, "max": 0.0} for enr in enrollments}

    for asg in assignments:
        max_m = float(asg.max_marks or 100.0)
        subs = db.query(Submission).filter(Submission.assignment_id == asg.id).all()

        subs_by_student: Dict[int, List[Submission]] = {}
        for s in subs:
            subs_by_student.setdefault(s.student_id, []).append(s)

        released_subs = []
        for sid, s_list in subs_by_student.items():
            rel = next((s for s in sorted(s_list, key=lambda x: (x.attempt_number or 1, x.id), reverse=True) if s.status == "released" and s.grade is not None), None)
            if rel:
                released_subs.append(rel)
                if sid in student_released_totals:
                    student_released_totals[sid]["earned"] += float(rel.grade)
                    student_released_totals[sid]["max"] += max_m

        unreleased = [s for s in subs if s.status == "graded"]
        unreleased_grades_count += len(unreleased)

        submitted_only = [s for s in subs if s.status == "submitted" and s.grade is None]
        pending_submissions_count += len(submitted_only)

        avg_score = None
        avg_pct = None
        if released_subs:
            avg_score = round(sum(float(s.grade) for s in released_subs) / len(released_subs), 2)
            avg_pct = round((avg_score / max_m) * 100, 2) if max_m > 0 else 0.0
            total_pct_sum += avg_pct
            total_pct_count += 1

        unit_comparisons.append(
            UnitComparison(
                unit=asg.unit or 0,
                assignment_title=asg.title,
                title=asg.title,
                max_marks=max_m,
                average_score=avg_score,
                average_percentage=avg_pct,
                submission_count=len(subs),
                released_count=len(released_subs),
                graded_count=len(released_subs),
            )
        )

    class_avg = round(total_pct_sum / total_pct_count, 2) if total_pct_count > 0 else None
    total_expected = enrolled_count * len(assignments)
    total_submissions = sum(u.submission_count for u in unit_comparisons)
    compliance_rate = round((total_submissions / total_expected) * 100, 1) if total_expected > 0 else 0.0

    # Calculate grade distribution by distinct enrolled students
    distribution = GradeDistribution()
    for sid, totals in student_released_totals.items():
        if totals["max"] > 0:
            pct = (totals["earned"] / totals["max"]) * 100
            if pct >= 90:
                distribution.grade_a += 1
            elif pct >= 80:
                distribution.grade_b += 1
            elif pct >= 70:
                distribution.grade_c += 1
            elif pct >= 60:
                distribution.grade_d += 1
            else:
                distribution.grade_f += 1

    dist_dict = {
        "A (90-100%)": distribution.grade_a,
        "B (80-89%)": distribution.grade_b,
        "C (70-79%)": distribution.grade_c,
        "D (60-69%)": distribution.grade_d,
        "F (<60%)": distribution.grade_f,
        "A (85-100%)": distribution.grade_a,
        "B (70-84%)": distribution.grade_b,
        "C (55-69%)": distribution.grade_c,
        "D (40-54%)": distribution.grade_d,
        "F (<40%)": distribution.grade_f,
        "grade_a": distribution.grade_a,
        "grade_b": distribution.grade_b,
        "grade_c": distribution.grade_c,
        "grade_d": distribution.grade_d,
        "grade_f": distribution.grade_f,
    }

    return ClassOverviewResponse(
        class_id=cls.id,
        class_name=cls.name,
        subject=subj_name,
        total_students=enrolled_count,
        total_assignments=len(assignments),
        class_average=class_avg,
        class_average_percentage=class_avg,
        submission_compliance_rate=compliance_rate,
        distribution=distribution,
        grade_distribution=dist_dict,
        unit_comparisons=unit_comparisons,
        pending_submissions_count=pending_submissions_count,
        unreleased_grades_count=unreleased_grades_count,
    )


# ---------------------------------------------------------
# Feature 8: Teacher Alerts & Private Student Feedback
# ---------------------------------------------------------
@router.get(
    "/classes/{class_id}/alerts",
    response_model=TeacherAlertsResponse,
    summary="Get teacher alerts for at-risk students and backlog (Teacher only)",
)
def get_teacher_alerts(
    class_id: int,
    subject: Optional[str] = None,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher.id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found or unauthorized")

    asg_query = db.query(Assignment).filter(Assignment.class_id == class_id)
    if subject:
        asg_query = asg_query.filter(func.lower(Assignment.subject) == subject.strip().lower())
    assignments = asg_query.all()
    assignment_ids = [a.id for a in assignments]

    # Ungraded and unreleased counts
    ungraded_count = (
        db.query(Submission)
        .filter(Submission.assignment_id.in_(assignment_ids), Submission.grade.is_(None))
        .count()
        if assignment_ids
        else 0
    )
    unreleased_count = (
        db.query(Submission)
        .filter(Submission.assignment_id.in_(assignment_ids), Submission.status == "graded")
        .count()
        if assignment_ids
        else 0
    )

    # Identify at-risk students
    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    at_risk_list = []

    for enr in enrollments:
        student = enr.student
        total_earned = 0.0
        total_max = 0.0
        missing_count = 0

        for asg in assignments:
            sub = db.query(Submission).filter(Submission.assignment_id == asg.id, Submission.student_id == student.id).first()
            if not sub:
                missing_count += 1
            elif sub.status == "released" and sub.grade is not None:
                total_earned += float(sub.grade)
                total_max += float(asg.max_marks or 100.0)

        provisional_pct = round((total_earned / total_max) * 100, 2) if total_max > 0 else None

        # At risk if provisional < 50% or missing 2+ assignments
        if (provisional_pct is not None and provisional_pct < 50.0) or (missing_count >= 2):
            reason_parts = []
            if provisional_pct is not None and provisional_pct < 50.0:
                reason_parts.append(f"Low provisional average ({provisional_pct}%)")
            if missing_count >= 2:
                reason_parts.append(f"Missing {missing_count} assessments")
            at_risk_list.append(
                AtRiskStudent(
                    student_id=student.id,
                    student_name=student.full_name,
                    student_email=student.email,
                    provisional_percentage=provisional_pct,
                    missing_units_count=missing_count,
                    reason=", ".join(reason_parts),
                )
            )

    return TeacherAlertsResponse(
        class_id=cls.id,
        class_name=cls.name,
        at_risk_students=at_risk_list,
        ungraded_count=ungraded_count,
        unreleased_count=unreleased_count,
        overdue_assignments=[a.title for a in assignments if a.status == "active"],
    )


@router.get(
    "/student/feedback",
    response_model=List[StudentFeedbackItem],
    summary="Private student feedback per unit assessment (Student only)",
)
def get_student_feedback(
    class_id: int,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(Submission.student_id == current_user.id, Assignment.class_id == class_id)
    )
    if subject:
        query = query.filter(func.lower(Assignment.subject) == subject.strip().lower())

    submissions = query.order_by(Assignment.unit.asc()).all()
    feedback_items = []
    for s in submissions:
        is_released = (s.status == "released")
        feedback_items.append(
            StudentFeedbackItem(
                unit=s.assignment.unit,
                assignment_title=s.assignment.title,
                grade=float(s.grade) if (is_released and s.grade is not None) else None,
                max_marks=float(s.assignment.max_marks or 100.0),
                feedback=s.feedback if is_released else None,
                is_late=s.is_late,
                status=s.status if is_released else "submitted",
            )
        )
    return feedback_items


# ---------------------------------------------------------
# Feature 16: Downloadable Reports (CSV)
# ---------------------------------------------------------
@router.get(
    "/classes/{class_id}/reports/summary.csv",
    summary="Download summary report CSV for a class (Teacher only)",
)
def download_summary_report_csv(
    class_id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher.id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found or unauthorized")

    overview = get_class_overview(class_id=class_id, current_user=teacher, db=db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Class ID",
        "Class Name",
        "Subject",
        "Total Students",
        "Total Assessments",
        "Class Average (%)",
        "Grade A",
        "Grade B",
        "Grade C",
        "Grade D",
        "Grade F",
        "Pending Submissions",
        "Unreleased Grades",
    ])
    writer.writerow([
        overview.class_id,
        sanitize_csv_value(overview.class_name),
        sanitize_csv_value(overview.subject),
        overview.total_students,
        overview.total_assignments,
        overview.class_average_percentage if overview.class_average_percentage is not None else "N/A",
        overview.distribution.grade_a,
        overview.distribution.grade_b,
        overview.distribution.grade_c,
        overview.distribution.grade_d,
        overview.distribution.grade_f,
        overview.pending_submissions_count,
        overview.unreleased_grades_count,
    ])

    csv_data = output.getvalue()
    filename = f"class_{class_id}_summary_report.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/classes/{class_id}/reports/detailed.csv",
    summary="Download detailed student-wise report CSV for a class subject (Teacher only)",
)
def download_detailed_report_csv(
    class_id: int,
    subject: str = Query(..., description="Subject name"),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher.id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found or unauthorized")

    rankings_data = compute_class_rankings(cls, subject, db, teacher)

    output = io.StringIO()
    writer = csv.writer(output)

    # Dynamic headers for units
    unit_nums = rankings_data.required_units
    unit_headers = []
    for u in unit_nums:
        unit_headers.extend([f"Unit {u} Score", f"Unit {u} Max", f"Unit {u} Rank"])

    header = [
        "Student ID",
        "Student Name",
        "Student Email",
        *unit_headers,
        "Provisional Score",
        "Provisional Max",
        "Provisional (%)",
        "Provisional Rank",
        "Final Score",
        "Final Max",
        "Final (%)",
        "Final Rank",
        "Status",
    ]
    writer.writerow(header)

    for r in rankings_data.rankings:
        unit_dict = {u.unit: u for u in r.units}
        unit_row = []
        for u in unit_nums:
            u_item = unit_dict.get(u)
            if u_item and u_item.score is not None:
                unit_row.extend([u_item.score, u_item.max_marks, u_item.unit_rank or "N/A"])
            else:
                unit_row.extend(["Pending/Missing", u_item.max_marks if u_item else "100.0", "N/A"])

        status_str = "Finalized" if r.is_complete else "Provisional"
        row = [
            r.student_id,
            sanitize_csv_value(r.student_name),
            sanitize_csv_value(r.student_email or ""),
            *unit_row,
            r.provisional_score if r.provisional_score is not None else "N/A",
            r.provisional_max if r.provisional_max is not None else "N/A",
            r.provisional_percentage if r.provisional_percentage is not None else "N/A",
            r.provisional_rank if r.provisional_rank is not None else "N/A",
            r.final_score if r.final_score is not None else "N/A",
            r.final_max if r.final_max is not None else "N/A",
            r.final_percentage if r.final_percentage is not None else "N/A",
            r.final_rank if r.final_rank is not None else "N/A",
            status_str,
        ]
        writer.writerow(row)

    csv_data = output.getvalue()
    filename = f"class_{class_id}_{subject.lower()}_detailed_report.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
