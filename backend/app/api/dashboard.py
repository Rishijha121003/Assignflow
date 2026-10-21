from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.submission import Submission
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def format_relative_time(dt: Optional[datetime]) -> str:
    """Helper to format a datetime into human-friendly relative time (e.g. '2 hours ago')."""
    if not dt:
        return "recently"

    now = datetime.now(timezone.utc)
    target = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    diff = now - target

    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago" if minutes == 1 else f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return "1 hour ago" if hours == 1 else f"{hours} hours ago"
    days = hours // 24
    if days == 1:
        return "1 day ago"
    if days < 7:
        return f"{days} days ago"
    weeks = days // 7
    if weeks == 1:
        return "1 week ago"
    return f"{weeks} weeks ago"


def calculate_days_left(due_dt: datetime) -> int:
    """Returns number of days remaining until deadline. Negative if overdue."""
    now = datetime.now(timezone.utc)
    target = due_dt if due_dt.tzinfo else due_dt.replace(tzinfo=timezone.utc)
    diff = target - now
    return diff.days


@router.get("", summary="Get role-specific dashboard metrics and cards")
def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns authenticated role-scoped dashboard metrics, cards, and charts:
    - Teacher: total assignments, active, total students, pending grading, recent submissions,
      submissions overview donut stats, classes, upcoming deadlines.
    - Student: total assignments, pending, submitted, overdue, upcoming assignments,
      submission status donut stats, recently submitted, joined classes.
    """
    now = datetime.now(timezone.utc)

    if current_user.role == "teacher":
        # 1. Teacher's classes
        teacher_classes = (
            db.query(Class)
            .filter(Class.teacher_id == current_user.id)
            .order_by(Class.id.desc())
            .all()
        )
        teacher_class_ids = [c.id for c in teacher_classes]

        # 2. Teacher's assignments
        assignments = (
            db.query(Assignment)
            .filter(
                (Assignment.created_by_id == current_user.id)
                | (Assignment.class_id.in_(teacher_class_ids))
            )
            .order_by(Assignment.due_date.asc())
            .all()
        )
        assignment_ids = [a.id for a in assignments]

        total_assignments = len(assignments)

        active_assignments = 0
        for a in assignments:
            a_due = a.due_date if a.due_date.tzinfo else a.due_date.replace(tzinfo=timezone.utc)
            if a.status == "active" and a_due >= now:
                active_assignments += 1

        total_students = (
            db.query(ClassEnrollment.student_id)
            .filter(ClassEnrollment.class_id.in_(teacher_class_ids))
            .distinct()
            .count()
            if teacher_class_ids
            else 0
        )

        # 3. Submissions across teacher's assignments
        submissions = (
            db.query(Submission)
            .filter(Submission.assignment_id.in_(assignment_ids))
            .order_by(Submission.submitted_at.desc())
            .all()
            if assignment_ids
            else []
        )

        total_submissions = len(submissions)
        late_submissions = sum(1 for s in submissions if s.is_late)
        ungraded_submissions = sum(1 for s in submissions if s.status == "submitted")
        graded_draft_submissions = sum(1 for s in submissions if s.status == "graded")
        released_submissions = sum(1 for s in submissions if s.status == "released")
        pending_grading = ungraded_submissions

        # Recent submissions (up to 5)
        recent_submissions_data = []
        for s in submissions[:5]:
            if s.status == "released":
                sub_status_label = "Released"
            elif s.status == "graded":
                sub_status_label = "Graded (Draft)"
            elif s.is_late:
                sub_status_label = "Late"
            else:
                sub_status_label = "New"

            recent_submissions_data.append(
                {
                    "id": s.id,
                    "student_name": s.student.full_name if s.student else "Student",
                    "student_email": s.student.email if s.student else "",
                    "assignment_title": s.assignment.title if s.assignment else "Assignment",
                    "class_name": s.assignment.class_name if s.assignment else "",
                    "submitted_at": s.submitted_at.isoformat() if s.submitted_at else "",
                    "relative_time": format_relative_time(s.submitted_at),
                    "is_late": s.is_late,
                    "status": sub_status_label,
                    "submission_status": s.status,
                }
            )

        # Real pending grading queue (ungraded submissions and pending re-evaluations)
        pending_queue_subs = [
            s for s in submissions if s.status in ("submitted", "reevaluation_requested")
        ][:6]
        grading_queue_data = [
            {
                "id": s.id,
                "assignment_id": s.assignment_id,
                "assignment_title": s.assignment.title if s.assignment else "Assignment",
                "class_name": s.assignment.class_name if s.assignment else "General",
                "student_name": s.student.full_name if s.student else "Student",
                "student_email": s.student.email if s.student else "",
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else "",
                "relative_time": format_relative_time(s.submitted_at),
                "status": s.status,
                "is_late": s.is_late,
                "needs_reevaluation": (s.status == "reevaluation_requested"),
            }
            for s in pending_queue_subs
        ]

        # Submissions overview donut
        submissions_overview = {
            "ungraded": ungraded_submissions,
            "draft": graded_draft_submissions,
            "released": released_submissions,
            "graded": graded_draft_submissions + released_submissions,
            "pending": ungraded_submissions,
            "late": late_submissions,
            "total": total_submissions,
        }

        # My classes list
        my_classes_data = []
        for c in teacher_classes[:4]:
            st_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == c.id).count()
            as_count = db.query(Assignment).filter(Assignment.class_id == c.id).count()
            my_classes_data.append(
                {
                    "id": c.id,
                    "name": c.name,
                    "description": c.description or "Computer Science Engineering",
                    "student_count": st_count,
                    "assignment_count": as_count,
                    "join_code": c.join_code,
                }
            )

        # Upcoming deadlines (sorted soonest first)
        upcoming_deadlines_data = []
        for a in assignments:
            a_due = a.due_date if a.due_date.tzinfo else a.due_date.replace(tzinfo=timezone.utc)
            if a_due >= now and a.status == "active":
                days = calculate_days_left(a.due_date)
                upcoming_deadlines_data.append(
                    {
                        "id": a.id,
                        "title": a.title,
                        "class_name": a.class_name or a.subject or "General",
                        "due_date": a.due_date.isoformat(),
                        "days_left": days,
                    }
                )
            if len(upcoming_deadlines_data) >= 4:
                break

        return {
            "role": "teacher",
            "user": {
                "id": current_user.id,
                "full_name": current_user.full_name,
                "email": current_user.email,
                "role": current_user.role,
            },
            "metrics": {
                "total_assignments": total_assignments,
                "active_assignments": active_assignments,
                "total_students": total_students,
                "pending_grading": pending_grading,
                "graded_draft": graded_draft_submissions,
                "released": released_submissions,
            },
            "recent_submissions": recent_submissions_data,
            "submissions_overview": submissions_overview,
            "my_classes": my_classes_data,
            "upcoming_deadlines": upcoming_deadlines_data,
            "grading_queue": grading_queue_data,
        }

    else:
        # Student Dashboard
        enrollments = (
            db.query(ClassEnrollment)
            .filter(ClassEnrollment.student_id == current_user.id)
            .all()
        )
        enrolled_class_ids = [e.class_id for e in enrollments]

        student_classes = (
            db.query(Class)
            .filter(Class.id.in_(enrolled_class_ids))
            .order_by(Class.id.desc())
            .all()
            if enrolled_class_ids
            else []
        )

        accessible_assignments = (
            db.query(Assignment)
            .filter(
                Assignment.class_id.in_(enrolled_class_ids),
                Assignment.status != "draft",
            )
            .order_by(Assignment.due_date.asc())
            .all()
            if enrolled_class_ids
            else []
        )

        student_submissions = (
            db.query(Submission)
            .filter(Submission.student_id == current_user.id)
            .order_by(Submission.submitted_at.desc())
            .all()
        )
        submitted_dict = {s.assignment_id: s for s in student_submissions}

        total_assignments = len(accessible_assignments)
        submitted_count = len(submitted_dict)

        pending_count = 0
        overdue_count = 0

        for a in accessible_assignments:
            if a.id not in submitted_dict:
                a_due = a.due_date if a.due_date.tzinfo else a.due_date.replace(tzinfo=timezone.utc)
                if a_due >= now:
                    pending_count += 1
                else:
                    overdue_count += 1

        pending_review_count = sum(1 for s in student_submissions if s.status in ("submitted", "graded"))
        released_count = sum(1 for s in student_submissions if s.status == "released")

        # Upcoming assignments (not yet submitted, sorted soonest first)
        upcoming_assignments_data = []
        for a in accessible_assignments:
            if a.id not in submitted_dict:
                days = calculate_days_left(a.due_date)
                teacher_name = (
                    a.creator.full_name
                    if a.creator
                    else (
                        a.classroom.teacher.full_name
                        if a.classroom and a.classroom.teacher
                        else "Prof. Instructor"
                    )
                )
                upcoming_assignments_data.append(
                    {
                        "id": a.id,
                        "title": a.title,
                        "class_name": a.class_name or a.subject or "General",
                        "teacher_name": teacher_name,
                        "due_date": a.due_date.isoformat(),
                        "days_left": days,
                    }
                )
            if len(upcoming_assignments_data) >= 4:
                break

        # Recently submitted list
        recently_submitted_data = []
        for s in student_submissions[:4]:
            is_released = (s.status == "released")
            max_marks = float(s.assignment.max_marks) if (s.assignment and s.assignment.max_marks is not None) else 100.0
            recently_submitted_data.append(
                {
                    "id": s.id,
                    "assignment_id": s.assignment_id,
                    "assignment_title": s.assignment.title if s.assignment else "Assignment",
                    "class_name": s.assignment.class_name if s.assignment else "General",
                    "submitted_at": s.submitted_at.isoformat() if s.submitted_at else "",
                    "is_late": s.is_late,
                    "status": "Released" if is_released else "Pending Review",
                    "review_status": "Released" if is_released else "Pending Review",
                    "grade": float(s.grade) if (is_released and s.grade is not None) else None,
                    "max_marks": max_marks,
                    "feedback": s.feedback if is_released else None,
                    "resubmission_allowed": s.resubmission_allowed or False,
                    "resubmission_deadline": s.resubmission_deadline.isoformat() if s.resubmission_deadline else None,
                    "resubmission_note": s.resubmission_note,
                    "attempt_number": s.attempt_number or 1,
                }
            )

        # My classes list
        my_classes_data = []
        for c in student_classes[:4]:
            my_classes_data.append(
                {
                    "id": c.id,
                    "name": c.name,
                    "description": c.description or "Computer Science Engineering",
                    "teacher_name": c.teacher.full_name if c.teacher else "Instructor",
                }
            )

        submission_status = {
            "pending": pending_count,
            "submitted": submitted_count,
            "overdue": overdue_count,
            "pending_review": pending_review_count,
            "released": released_count,
            "total": total_assignments,
        }

        return {
            "role": "student",
            "user": {
                "id": current_user.id,
                "full_name": current_user.full_name,
                "email": current_user.email,
                "role": current_user.role,
            },
            "metrics": {
                "total_assignments": total_assignments,
                "pending": pending_count,
                "submitted": submitted_count,
                "overdue": overdue_count,
                "pending_review": pending_review_count,
                "released": released_count,
            },
            "upcoming_assignments": upcoming_assignments_data,
            "submission_status": submission_status,
            "recently_submitted": recently_submitted_data,
            "my_classes": my_classes_data,
        }
