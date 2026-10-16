from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.classroom import Class
from app.models.submission import Submission
from app.models.user import User

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.get("", summary="Get all submissions for current user (role-scoped)")
def list_user_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Returns submissions scoped to the current user:
    - Teacher: all submissions across the teacher's created assignments and classes.
    - Student: all submissions submitted by the student across all assignments.
    """
    if current_user.role == "teacher":
        teacher_classes = (
            db.query(Class)
            .filter(Class.teacher_id == current_user.id)
            .all()
        )
        teacher_class_ids = [c.id for c in teacher_classes]

        assignments = (
            db.query(Assignment)
            .filter(
                (Assignment.created_by_id == current_user.id)
                | (Assignment.class_id.in_(teacher_class_ids))
            )
            .all()
        )
        assignment_ids = [a.id for a in assignments]
        if not assignment_ids:
            return []

        submissions = (
            db.query(Submission)
            .filter(Submission.assignment_id.in_(assignment_ids))
            .order_by(Submission.submitted_at.desc())
            .all()
        )
    else:
        submissions = (
            db.query(Submission)
            .filter(Submission.student_id == current_user.id)
            .order_by(Submission.submitted_at.desc())
            .all()
        )

    results = []
    is_teacher = (current_user.role == "teacher")
    for s in submissions:
        assignment = s.assignment
        student = s.student
        class_name = "General"
        if assignment:
            if assignment.classroom and assignment.classroom.name:
                class_name = assignment.classroom.name
            elif assignment.subject:
                class_name = assignment.subject

        is_released = (s.status == "released")
        show_grade = is_teacher or is_released
        assignment_max_marks = float(assignment.max_marks) if (assignment and assignment.max_marks is not None) else 100.0

        results.append(
            {
                "id": s.id,
                "assignment_id": s.assignment_id,
                "assignment_title": assignment.title if assignment else "Assignment",
                "class_name": class_name,
                "student_id": s.student_id,
                "student_name": student.full_name if student else "Student",
                "student_email": student.email if student else "",
                "file_name": s.file_name,
                "file_size": s.file_size,
                "notes": s.notes,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else "",
                "due_date": assignment.due_date.isoformat() if assignment and assignment.due_date else None,
                "is_late": s.is_late,
                "status": s.status if show_grade else "submitted",
                "grade": float(s.grade) if (show_grade and s.grade is not None) else None,
                "feedback": s.feedback if show_grade else None,
                "graded_at": s.graded_at.isoformat() if (show_grade and s.graded_at) else None,
                "released_at": s.released_at.isoformat() if (is_released and s.released_at) else None,
                "max_marks": assignment_max_marks,
                "download_url": f"/api/assignments/{s.assignment_id}/submissions/{s.id}/download",
                "preview_url": f"/api/assignments/{s.assignment_id}/submissions/{s.id}/preview",
            }
        )
    return results
