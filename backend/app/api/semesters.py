import csv
import io
from datetime import datetime, timezone, date
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_teacher
from app.db.session import get_db
from app.models.semester import Semester
from app.models.classroom import Class, ClassEnrollment, Subject, generate_join_code
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.models.user import User
from app.schemas.semester import (
    SemesterCreate,
    SemesterUpdate,
    SemesterResponse,
    SemesterSubjectSummary,
    SemesterDashboardResponse,
    SubjectPerformanceResponse,
    SubjectStudentPerformanceItem,
    SemesterReportResponse,
)
from app.schemas.classroom import ClassResponse, ClassCreate

router = APIRouter(prefix="/semesters", tags=["semesters"])


def format_relative_time(dt: Optional[datetime]) -> str:
    """Helper to format a datetime into human-friendly relative time."""
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
        return f"{minutes}m ago" if minutes == 1 else f"{minutes} mins ago"
    hours = minutes // 60
    if hours < 24:
        return "1 hour ago" if hours == 1 else f"{hours} hours ago"
    days = hours // 24
    if days == 1:
        return "1 day ago"
    if days < 7:
        return f"{days} days ago"
    weeks = days // 7
    return f"{weeks} week ago" if weeks == 1 else f"{weeks} weeks ago"


def calculate_days_left(due_dt: datetime) -> int:
    """Returns number of days remaining until deadline."""
    now = datetime.now(timezone.utc)
    target = due_dt if due_dt.tzinfo else due_dt.replace(tzinfo=timezone.utc)
    diff = target - now
    return diff.days


def sanitize_csv_cell(val: Any) -> str:
    """Protects against CSV formula injection by prepending a single quote if string starts with formula tokens."""
    if val is None:
        return ""
    text = str(val)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text}"
    return text


def serialize_semester(sem: Semester, db: Session) -> SemesterResponse:
    """Computes real aggregate metrics for a semester from active DB records."""
    # 1. Subjects/classes count in this semester
    classes = db.query(Class).filter(Class.semester_id == sem.id).all()
    subject_count = len(classes)
    class_ids = [c.id for c in classes]

    # 2. Distinct enrolled students count across this semester's classes
    student_count = (
        db.query(ClassEnrollment.student_id)
        .filter(ClassEnrollment.class_id.in_(class_ids))
        .distinct()
        .count()
        if class_ids
        else 0
    )

    # 3. Total assignments in this semester
    assignment_count = (
        db.query(Assignment)
        .filter((Assignment.semester_id == sem.id) | (Assignment.class_id.in_(class_ids)))
        .count()
        if class_ids
        else db.query(Assignment).filter(Assignment.semester_id == sem.id).count()
    )

    # 4. Total submissions and completion rate
    assignments = (
        db.query(Assignment)
        .filter((Assignment.semester_id == sem.id) | (Assignment.class_id.in_(class_ids)))
        .all()
        if class_ids
        else db.query(Assignment).filter(Assignment.semester_id == sem.id).all()
    )
    assignment_ids = [a.id for a in assignments]

    submission_count = (
        db.query(Submission)
        .filter(Submission.assignment_id.in_(assignment_ids))
        .count()
        if assignment_ids
        else 0
    )

    # Calculate completion rate: total actual submissions / expected submissions (sum of enrolled students per assignment)
    expected_submissions = 0
    for a in assignments:
        if a.class_id:
            c_enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == a.class_id).count()
            expected_submissions += c_enrollments
        else:
            expected_submissions += student_count

    completion_rate = 0.0
    if expected_submissions > 0:
        completion_rate = round((submission_count / expected_submissions) * 100, 1)
        if completion_rate > 100.0:
            completion_rate = 100.0

    teacher_name = sem.teacher.full_name if sem.teacher else None

    return SemesterResponse(
        id=sem.id,
        name=sem.name,
        academic_year=sem.academic_year,
        start_date=sem.start_date,
        end_date=sem.end_date,
        status=sem.status,
        program=sem.program or "B.Tech CSE",
        teacher_id=sem.teacher_id,
        teacher_name=teacher_name,
        subject_count=subject_count,
        student_count=student_count,
        assignment_count=assignment_count,
        submission_count=submission_count,
        completion_rate=completion_rate,
        is_finalized=sem.is_finalized,
        finalized_at=sem.finalized_at,
        finalized_by_id=sem.finalized_by_id,
        created_at=sem.created_at,
        updated_at=sem.updated_at,
    )


@router.post(
    "",
    response_model=SemesterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new semester (Teacher only)",
)
def create_semester(
    payload: SemesterCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Creates an academic semester with validated name, academic year, and date range.
    Only teachers can create semesters.
    """
    clean_name = payload.name.strip()
    clean_year = payload.academic_year.strip()

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Semester name cannot be empty.",
        )
    if not clean_year:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Academic year cannot be empty.",
        )
    if payload.start_date > payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Semester start date must be before or equal to end date.",
        )

    new_sem = Semester(
        name=clean_name,
        academic_year=clean_year,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status or "active",
        program=payload.program or "B.Tech CSE",
        teacher_id=teacher.id,
    )
    db.add(new_sem)
    db.commit()
    db.refresh(new_sem)

    return serialize_semester(new_sem, db)


@router.get(
    "",
    response_model=List[SemesterResponse],
    summary="List semesters for current user",
)
def list_semesters(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists semesters:
    - Teacher: returns semesters owned by the teacher.
    - Student: returns semesters for classes the student is enrolled in.
    """
    if current_user.role == "teacher":
        query = db.query(Semester).filter(Semester.teacher_id == current_user.id)
        if status_filter:
            query = query.filter(Semester.status == status_filter)
        semesters = query.order_by(Semester.start_date.desc(), Semester.id.desc()).all()
    else:
        # Student enrolled classes -> semesters
        enrolled_class_ids = [
            row[0]
            for row in db.query(ClassEnrollment.class_id)
            .filter(ClassEnrollment.student_id == current_user.id)
            .all()
        ]
        if not enrolled_class_ids:
            return []

        enrolled_semester_ids = [
            row[0]
            for row in db.query(Class.semester_id)
            .filter(Class.id.in_(enrolled_class_ids), Class.semester_id.isnot(None))
            .distinct()
            .all()
        ]
        if not enrolled_semester_ids:
            return []

        query = db.query(Semester).filter(Semester.id.in_(enrolled_semester_ids))
        if status_filter:
            query = query.filter(Semester.status == status_filter)
        semesters = query.order_by(Semester.start_date.desc(), Semester.id.desc()).all()

    return [serialize_semester(s, db) for s in semesters]


@router.get(
    "/{id}",
    response_model=SemesterResponse,
    summary="Get semester details by ID",
)
def get_semester(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves semester details. Only the owning teacher or enrolled students may view."""
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )

    if current_user.role == "teacher":
        if sem.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this semester.",
            )
    else:
        # Verify student enrollment in any class of this semester
        enrolled = (
            db.query(ClassEnrollment)
            .join(Class, ClassEnrollment.class_id == Class.id)
            .filter(Class.semester_id == id, ClassEnrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in any class in this semester.",
            )

    return serialize_semester(sem, db)


@router.put(
    "/{id}",
    response_model=SemesterResponse,
    summary="Update semester (Teacher only)",
)
def update_semester(
    id: int,
    payload: SemesterUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Updates semester attributes. Only owning teacher can update."""
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )
    if sem.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only edit semesters you created.",
        )

    if payload.name is not None:
        clean_name = payload.name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Semester name cannot be empty.",
            )
        sem.name = clean_name

    if payload.academic_year is not None:
        clean_year = payload.academic_year.strip()
        if not clean_year:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Academic year cannot be empty.",
            )
        sem.academic_year = clean_year

    new_start = payload.start_date or sem.start_date
    new_end = payload.end_date or sem.end_date
    if new_start > new_end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Semester start date must be before or equal to end date.",
        )
    sem.start_date = new_start
    sem.end_date = new_end

    if payload.status is not None:
        if payload.status not in ("active", "completed", "archived"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid semester status. Must be active, completed, or archived.",
            )
        sem.status = payload.status

    if payload.program is not None:
        sem.program = payload.program.strip()

    db.commit()
    db.refresh(sem)

    return serialize_semester(sem, db)


@router.delete(
    "/{id}",
    summary="Delete a semester (Teacher only, safe guardrails)",
)
def delete_semester(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Deletes a semester if no academic submissions or records exist.
    If submissions exist, deletion is blocked to protect historical integrity; recommends archival.
    """
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )
    if sem.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only delete semesters you created.",
        )

    # Check for active academic records (submissions)
    class_ids = [c.id for c in db.query(Class.id).filter(Class.semester_id == id).all()]
    assignment_ids = [
        a.id
        for a in db.query(Assignment.id)
        .filter((Assignment.semester_id == id) | (Assignment.class_id.in_(class_ids)))
        .all()
    ] if class_ids else [a.id for a in db.query(Assignment.id).filter(Assignment.semester_id == id).all()]

    submissions_count = (
        db.query(Submission).filter(Submission.assignment_id.in_(assignment_ids)).count()
        if assignment_ids
        else 0
    )

    if submissions_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete semester '{sem.name}': it contains {submissions_count} academic submissions. "
                "Please archive this semester instead to preserve historical records."
            ),
        )

    # Safe to delete: disassociate any classes
    db.query(Class).filter(Class.semester_id == id).update({"semester_id": None})
    db.query(Assignment).filter(Assignment.semester_id == id).update({"semester_id": None})
    db.delete(sem)
    db.commit()

    return {"message": f"Semester '{sem.name}' successfully deleted.", "id": id}


@router.post(
    "/{id}/archive",
    response_model=SemesterResponse,
    summary="Safely archive a semester (Teacher only)",
)
def archive_semester(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Sets a semester's status to 'archived', safely retaining all grades and records."""
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )
    if sem.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only archive semesters you created.",
        )

    sem.status = "archived"
    db.commit()
    db.refresh(sem)

    return serialize_semester(sem, db)


@router.post(
    "/{id}/finalize",
    response_model=SemesterResponse,
    summary="Finalize semester results (Teacher only)",
)
def finalize_semester(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Marks semester results as final.
    Enforces that all submitted assignments are graded and released before finalization.
    """
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )
    if sem.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only finalize semesters you created.",
        )

    # Check for unreleased or ungraded submissions
    class_ids = [c.id for c in db.query(Class.id).filter(Class.semester_id == id).all()]
    assignment_ids = [
        a.id
        for a in db.query(Assignment.id)
        .filter((Assignment.semester_id == id) | (Assignment.class_id.in_(class_ids)))
        .all()
    ] if class_ids else [a.id for a in db.query(Assignment.id).filter(Assignment.semester_id == id).all()]

    if assignment_ids:
        unreleased_count = (
            db.query(Submission)
            .filter(
                Submission.assignment_id.in_(assignment_ids),
                Submission.status.in_(["submitted", "graded"]),
            )
            .count()
        )
        if unreleased_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot finalize semester: {unreleased_count} submission(s) are still unreleased or pending grading.",
            )

    sem.is_finalized = True
    sem.finalized_at = datetime.now(timezone.utc)
    sem.finalized_by_id = teacher.id
    sem.status = "completed"

    db.commit()
    db.refresh(sem)

    return serialize_semester(sem, db)


@router.get(
    "/{id}/dashboard",
    response_model=SemesterDashboardResponse,
    summary="Get rich dashboard data for a semester",
)
def get_semester_dashboard(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns complete dashboard data matching the semester overview reference screen:
    - Selected semester and available semesters list
    - 4 main metric counters (Subjects, Total Assignments, Total Submissions, Average Completion Rate)
    - Subject cards with assignment counts, enrolled students, and submission progress
    - Recent submissions with status badges and relative timestamps
    - Upcoming deadlines with days left badges
    """
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )

    # Verify authorization
    if current_user.role == "teacher":
        if sem.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this semester.",
            )
        available_sems = (
            db.query(Semester)
            .filter(Semester.teacher_id == current_user.id)
            .order_by(Semester.start_date.desc())
            .all()
        )
    else:
        # Student enrollment check
        enrolled_class_ids = [
            row[0]
            for row in db.query(ClassEnrollment.class_id)
            .filter(ClassEnrollment.student_id == current_user.id)
            .all()
        ]
        available_sems = (
            db.query(Semester)
            .join(Class, Class.semester_id == Semester.id)
            .filter(Class.id.in_(enrolled_class_ids))
            .distinct()
            .order_by(Semester.start_date.desc())
            .all()
        )
        if sem.id not in [s.id for s in available_sems]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in any class in this semester.",
            )

    # Serialize selected semester
    selected_semester = serialize_semester(sem, db)
    serialized_available = [serialize_semester(s, db) for s in available_sems]

    # Classes/subjects in this semester
    classes = db.query(Class).filter(Class.semester_id == sem.id).order_by(Class.id.asc()).all()
    class_ids = [c.id for c in classes]

    # Build Subject Cards
    subjects_data: List[SemesterSubjectSummary] = []
    for c in classes:
        c_student_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == c.id).count()
        c_assignments = db.query(Assignment).filter(Assignment.class_id == c.id).all()
        c_assignment_count = len(c_assignments)
        c_assignment_ids = [a.id for a in c_assignments]

        c_submissions_count = (
            db.query(Submission).filter(Submission.assignment_id.in_(c_assignment_ids)).count()
            if c_assignment_ids
            else 0
        )

        c_expected = c_student_count * c_assignment_count
        rate = round((c_submissions_count / c_expected * 100), 0) if c_expected > 0 else 0.0
        if rate > 100.0:
            rate = 100.0

        subjects_data.append(
            SemesterSubjectSummary(
                id=c.id,
                name=c.name,
                description=c.description or "Core Subject",
                join_code=c.join_code,
                assignments_count=c_assignment_count,
                students_count=c_student_count,
                submission_rate=rate,
                submission_rate_label=f"{int(rate)}% submitted",
            )
        )

    # Recent submissions in this semester
    assignment_ids = [
        a.id
        for a in db.query(Assignment.id)
        .filter((Assignment.semester_id == sem.id) | (Assignment.class_id.in_(class_ids)))
        .all()
    ] if class_ids else [a.id for a in db.query(Assignment.id).filter(Assignment.semester_id == sem.id).all()]

    recent_submissions_data = []
    if assignment_ids:
        recent_subs_query = (
            db.query(Submission)
            .filter(Submission.assignment_id.in_(assignment_ids))
        )
        if current_user.role == "student":
            recent_subs_query = recent_subs_query.filter(Submission.student_id == current_user.id)
        recent_subs = (
            recent_subs_query
            .order_by(Submission.submitted_at.desc())
            .limit(5)
            .all()
        )
        for s in recent_subs:
            # Respect grade release rules for students
            is_released = s.status == "released"
            if current_user.role == "student":
                student_label = current_user.full_name
                student_email = current_user.email
            else:
                student_label = s.student.full_name if s.student else "Student"
                student_email = s.student.email if s.student else ""
            sub_title = s.assignment.title if s.assignment else "Assignment"
            class_name = s.assignment.class_name if (s.assignment and s.assignment.class_name) else "Subject"

            status_badge = "Submitted"
            if s.status == "released":
                status_badge = "Released"
            elif s.status == "graded" and current_user.role == "teacher":
                status_badge = "Graded (Draft)"
            elif s.is_late:
                status_badge = "Late"

            recent_submissions_data.append({
                "id": s.id,
                "student_name": student_label,
                "student_email": student_email,
                "assignment_title": sub_title,
                "class_name": class_name,
                "status": status_badge,
                "relative_time": format_relative_time(s.submitted_at),
                "is_late": s.is_late,
            })

    # Upcoming deadlines in this semester
    now = datetime.now(timezone.utc)
    upcoming_deadlines_data = []
    if assignment_ids:
        upcoming_query = (
            db.query(Assignment)
            .filter(
                Assignment.id.in_(assignment_ids),
                Assignment.status == "active",
                Assignment.due_date >= now,
            )
        )
        if current_user.role == "student":
            upcoming_query = upcoming_query.filter(Assignment.class_id.in_(enrolled_class_ids))
        upcoming_as = (
            upcoming_query
            .order_by(Assignment.due_date.asc())
            .limit(5)
            .all()
        )
        for a in upcoming_as:
            days = calculate_days_left(a.due_date)
            badge_label = f"{days} days left" if days > 1 else ("1 day left" if days == 1 else "Due today")
            badge_urgency = "danger" if days <= 3 else ("warning" if days <= 7 else "info")

            upcoming_deadlines_data.append({
                "id": a.id,
                "title": a.title,
                "class_name": a.class_name or a.subject,
                "due_date": a.due_date.strftime("%d %b %Y"),
                "days_left": days,
                "badge_label": badge_label,
                "badge_urgency": badge_urgency,
            })

    stats = {
        "subject_count": selected_semester.subject_count,
        "assignment_count": selected_semester.assignment_count,
        "submission_count": selected_semester.submission_count,
        "completion_rate": selected_semester.completion_rate,
        "completion_rate_label": f"{int(selected_semester.completion_rate)}%",
    }

    return SemesterDashboardResponse(
        selected_semester=selected_semester,
        available_semesters=serialized_available,
        statistics=stats,
        subjects=subjects_data,
        recent_submissions=recent_submissions_data,
        upcoming_deadlines=upcoming_deadlines_data,
    )


@router.get(
    "/{id}/subjects",
    response_model=List[ClassResponse],
    summary="List subjects in a semester",
)
def list_semester_subjects(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all subjects (classes) belonging to this semester."""
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found.",
        )

    if current_user.role == "teacher":
        if sem.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this semester.",
            )
    else:
        enrolled_in_sem = (
            db.query(ClassEnrollment)
            .join(Class, ClassEnrollment.class_id == Class.id)
            .filter(Class.semester_id == id, ClassEnrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled_in_sem:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in any class in this semester.",
            )

    classes = db.query(Class).filter(Class.semester_id == id).order_by(Class.id.asc()).all()
    # Serialize classes using the existing serialize_class pattern
    results = []
    for cls in classes:
        st_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == cls.id).count()
        as_count = db.query(Assignment).filter(Assignment.class_id == cls.id).count()
        results.append(
            ClassResponse(
                id=cls.id,
                name=cls.name,
                description=cls.description,
                join_code=cls.join_code,
                teacher_id=cls.teacher_id,
                teacher_name=cls.teacher.full_name if cls.teacher else None,
                semester_id=cls.semester_id,
                semester_name=sem.name,
                student_count=st_count,
                assignment_count=as_count,
                created_at=cls.created_at,
                updated_at=cls.updated_at,
            )
        )
    return results


@router.post(
    "/{id}/subjects",
    response_model=ClassResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create subject inside a semester (Teacher only)",
)
def create_semester_subject(
    id: int,
    payload: ClassCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Creates a subject (Class entity) explicitly linked to this semester."""
    sem = db.query(Semester).filter(Semester.id == id, Semester.teacher_id == teacher.id).first()
    if not sem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Semester with ID {id} not found or not owned by you.",
        )

    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Subject name cannot be empty.",
        )

    join_code = None
    for _ in range(10):
        code = generate_join_code()
        if not db.query(Class).filter(Class.join_code == code).first():
            join_code = code
            break

    new_class = Class(
        name=clean_name,
        description=payload.description.strip() if payload.description else None,
        join_code=join_code,
        teacher_id=teacher.id,
        semester_id=sem.id,
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    # Associate Subject entity for this class
    new_subject = Subject(name=clean_name, class_id=new_class.id)
    db.add(new_subject)
    db.commit()

    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        description=new_class.description,
        join_code=new_class.join_code,
        teacher_id=new_class.teacher_id,
        teacher_name=teacher.full_name,
        semester_id=new_class.semester_id,
        semester_name=sem.name,
        student_count=0,
        assignment_count=0,
        created_at=new_class.created_at,
        updated_at=new_class.updated_at,
    )


@router.get(
    "/{id}/subjects/{subject_id}/performance",
    response_model=SubjectPerformanceResponse,
    summary="Get subject-wise student performance and ranking",
)
def get_subject_performance(
    id: int,
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns student performance metrics for a specific subject in a semester:
    - Enrolled students, submission completion rates (e.g., 4 / 4)
    - Average score calculated strictly from released grades
    - Respects grade-release privacy: draft grades are NEVER shown to students
    - Does NOT penalize missing or unreleased assessments as zero
    - Shows status badges (On Track, At Risk, Excellent)
    """
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")

    cls = db.query(Class).filter(Class.id == subject_id, Class.semester_id == id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found in this semester.")

    is_teacher = current_user.role == "teacher"
    if is_teacher:
        if cls.teacher_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this subject.")
    else:
        is_enrolled = (
            db.query(ClassEnrollment)
            .filter(
                ClassEnrollment.class_id == subject_id,
                ClassEnrollment.student_id == current_user.id,
            )
            .first()
        )
        if not is_enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in this subject.",
            )

    # All assignments for this subject
    assignments = db.query(Assignment).filter(Assignment.class_id == subject_id).all()
    total_assignments = len(assignments)
    assignment_ids = [a.id for a in assignments]
    max_marks_map = {a.id: (float(a.max_marks) if a.max_marks else 100.0) for a in assignments}

    # Enrolled students
    enrollments = (
        db.query(ClassEnrollment, User)
        .join(User, ClassEnrollment.student_id == User.id)
        .filter(ClassEnrollment.class_id == subject_id)
        .order_by(User.full_name.asc())
        .all()
    )

    students_perf: List[SubjectStudentPerformanceItem] = []

    for enrollment, user in enrollments:
        # If requester is a student, only reveal full detail if it's their own record
        # (or provide anonymized info)
        student_submissions = (
            db.query(Submission)
            .filter(
                Submission.student_id == user.id,
                Submission.assignment_id.in_(assignment_ids),
            )
            .all()
            if assignment_ids
            else []
        )

        completed_count = len(student_submissions)
        valid_scores = []
        has_incomplete = (completed_count < total_assignments)

        for s in student_submissions:
            # Check grade release privacy:
            # If teacher, can calculate with graded/released
            # If student, ONLY released grades are accessible
            if is_teacher:
                if s.grade is not None:
                    max_m = max_marks_map.get(s.assignment_id, 100.0)
                    pct = (float(s.grade) / max_m) * 100.0
                    valid_scores.append(pct)
            else:
                if s.status == "released" and s.grade is not None:
                    max_m = max_marks_map.get(s.assignment_id, 100.0)
                    pct = (float(s.grade) / max_m) * 100.0
                    valid_scores.append(pct)

        avg_score: Optional[float] = None
        avg_label = "N/A"
        if valid_scores:
            avg_score = round(sum(valid_scores) / len(valid_scores), 1)
            avg_label = f"{int(avg_score)}%"

        # Status determination:
        # If completion < 75% or avg_score < 70%: At Risk
        # Else if avg_score >= 80%: On Track
        completion_pct = (completed_count / total_assignments * 100) if total_assignments > 0 else 100.0
        if completion_pct < 75.0 or (avg_score is not None and avg_score < 70.0):
            st_status = "At Risk"
        else:
            st_status = "On Track"

        students_perf.append(
            SubjectStudentPerformanceItem(
                id=user.id,
                rank=1,
                student_name=user.full_name,
                student_email=user.email,
                submissions=f"{completed_count} / {total_assignments}",
                submissions_completed=completed_count,
                submissions_required=total_assignments,
                average_score=avg_score,
                average_score_label=avg_label,
                status=st_status,
                has_incomplete=has_incomplete,
            )
        )

    # Sort students by average score descending (None values last)
    students_perf.sort(key=lambda s: (s.average_score is not None, s.average_score or 0.0), reverse=True)
    for idx, item in enumerate(students_perf):
        item.rank = idx + 1
        if not is_teacher and item.id != current_user.id:
            item.student_name = f"Student #{idx + 1}"
            item.student_email = ""
            item.status = "Enrolled"
            item.id = 0

    return SubjectPerformanceResponse(
        subject_id=cls.id,
        subject_name=cls.name,
        subject_description=cls.description,
        semester_id=sem.id,
        semester_name=sem.name,
        total_students=len(enrollments),
        total_assignments=total_assignments,
        students=students_perf,
    )


@router.get(
    "/{id}/report",
    response_model=SemesterReportResponse,
    summary="Get comprehensive semester-level performance report",
)
def get_semester_report(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Computes overall semester report matching Reference Screen 5:
    - 4 Summary KPI metrics: Total Students, Total Assignments, Average Score, Completion Rate
    - Subject-wise comparative performance: Class Average vs Highest Score
    - Student-wise rankings (Top students overall percentage and subjects count)
    - Clearly marks incomplete or provisional results until officially finalized
    """
    sem = db.query(Semester).filter(Semester.id == id).first()
    if not sem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")

    if sem.teacher_id != teacher.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this semester.")

    serialized_sem = serialize_semester(sem, db)

    classes = db.query(Class).filter(Class.semester_id == id).order_by(Class.id.asc()).all()
    class_ids = [c.id for c in classes]

    subject_performances = []
    student_scores_map: Dict[int, Dict[str, Any]] = {}
    has_any_incomplete = False

    all_valid_class_scores = []

    for c in classes:
        c_assignments = db.query(Assignment).filter(Assignment.class_id == c.id).all()
        c_assignment_ids = [a.id for a in c_assignments]
        max_marks_map = {a.id: (float(a.max_marks) if a.max_marks else 100.0) for a in c_assignments}

        enrollments = (
            db.query(ClassEnrollment, User)
            .join(User, ClassEnrollment.student_id == User.id)
            .filter(ClassEnrollment.class_id == c.id)
            .all()
        )

        subject_valid_scores = []
        for enrollment, user in enrollments:
            if user.id not in student_scores_map:
                student_scores_map[user.id] = {
                    "name": user.full_name,
                    "email": user.email,
                    "subjects_count": 0,
                    "subject_averages": [],
                }

            s_subs = (
                db.query(Submission)
                .filter(
                    Submission.student_id == user.id,
                    Submission.assignment_id.in_(c_assignment_ids),
                )
                .all()
                if c_assignment_ids
                else []
            )

            # Check incomplete assessments
            if len(s_subs) < len(c_assignments):
                has_any_incomplete = True

            student_sub_scores = []
            for s in s_subs:
                if teacher.role == "teacher":
                    if s.grade is not None:
                        max_m = max_marks_map.get(s.assignment_id, 100.0)
                        pct = (float(s.grade) / max_m) * 100.0
                        student_sub_scores.append(pct)
                else:
                    if s.status == "released" and s.grade is not None:
                        max_m = max_marks_map.get(s.assignment_id, 100.0)
                        pct = (float(s.grade) / max_m) * 100.0
                        student_sub_scores.append(pct)

            if student_sub_scores:
                st_subj_avg = sum(student_sub_scores) / len(student_sub_scores)
                subject_valid_scores.append(st_subj_avg)
                student_scores_map[user.id]["subject_averages"].append(st_subj_avg)
                student_scores_map[user.id]["subjects_count"] += 1

        cls_avg = round(sum(subject_valid_scores) / len(subject_valid_scores), 1) if subject_valid_scores else 0.0
        cls_high = round(max(subject_valid_scores), 1) if subject_valid_scores else 0.0

        if subject_valid_scores:
            all_valid_class_scores.extend(subject_valid_scores)

        subject_performances.append({
            "subject_id": c.id,
            "subject_name": c.name,
            "class_average": cls_avg,
            "highest_score": cls_high,
            "student_count": len(enrollments),
            "assignment_count": len(c_assignments),
        })

    # Overall semester average score
    overall_avg_score = round(sum(all_valid_class_scores) / len(all_valid_class_scores), 1) if all_valid_class_scores else 0.0

    # Top students table
    top_students = []
    for st_id, data in student_scores_map.items():
        if data["subject_averages"]:
            overall_pct = round(sum(data["subject_averages"]) / len(data["subject_averages"]), 1)
            if overall_pct >= 85.0:
                st_status = "Excellent"
            elif overall_pct >= 75.0:
                st_status = "Good"
            else:
                st_status = "Needs Attention"

            top_students.append({
                "student_id": st_id,
                "student_name": data["name"],
                "overall_percentage": overall_pct,
                "overall_percentage_label": f"{int(overall_pct)}%",
                "subjects_count": data["subjects_count"],
                "status": st_status,
            })

    # Sort top students descending
    top_students.sort(key=lambda s: s["overall_percentage"], reverse=True)
    for idx, st in enumerate(top_students):
        st["rank"] = idx + 1

    summary = {
        "total_students": serialized_sem.student_count,
        "total_assignments": serialized_sem.assignment_count,
        "average_score": overall_avg_score,
        "average_score_label": f"{int(overall_avg_score)}%" if overall_avg_score > 0 else "N/A",
        "completion_rate": serialized_sem.completion_rate,
        "completion_rate_label": f"{int(serialized_sem.completion_rate)}%",
        "is_finalized": sem.is_finalized,
        "finalized_at": sem.finalized_at.isoformat() if sem.finalized_at else None,
        "has_incomplete_assessments": has_any_incomplete,
        "status_label": "Finalized (Official)" if sem.is_finalized else "Provisional (In Progress)",
    }

    return SemesterReportResponse(
        semester=serialized_sem,
        summary=summary,
        subject_performances=subject_performances,
        top_students=top_students[:10],
    )


@router.get(
    "/{id}/report/export-csv",
    summary="Export semester report as sanitized CSV",
)
def export_semester_csv(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Downloads full semester performance report in CSV format.
    Includes formula injection protections for spreadsheet security.
    """
    report_data = get_semester_report(id=id, teacher=teacher, db=db)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header section
    writer.writerow(["AssignFlow Semester Performance Report"])
    writer.writerow(["Semester Name", sanitize_csv_cell(report_data.semester.name)])
    writer.writerow(["Academic Year", sanitize_csv_cell(report_data.semester.academic_year)])
    writer.writerow(["Program", sanitize_csv_cell(report_data.semester.program)])
    writer.writerow(["Status", sanitize_csv_cell(report_data.summary.get("status_label"))])
    writer.writerow([])

    # Metrics section
    writer.writerow(["Total Students", report_data.summary.get("total_students")])
    writer.writerow(["Total Assignments", report_data.summary.get("total_assignments")])
    writer.writerow(["Average Score", report_data.summary.get("average_score_label")])
    writer.writerow(["Completion Rate", report_data.summary.get("completion_rate_label")])
    writer.writerow([])

    # Subject performance
    writer.writerow(["Subject Performance Comparison"])
    writer.writerow(["Subject Name", "Class Average (%)", "Highest Score (%)", "Students Enrolled", "Assignments"])
    for sp in report_data.subject_performances:
        writer.writerow([
            sanitize_csv_cell(sp["subject_name"]),
            f"{sp['class_average']}%",
            f"{sp['highest_score']}%",
            sp["student_count"],
            sp["assignment_count"],
        ])
    writer.writerow([])

    # Student performance
    writer.writerow(["Student Performance Roster"])
    writer.writerow(["Rank", "Student Name", "Overall Score (%)", "Subjects Evaluated", "Status"])
    for st in report_data.top_students:
        writer.writerow([
            st.get("rank"),
            sanitize_csv_cell(st.get("student_name")),
            st.get("overall_percentage_label"),
            st.get("subjects_count"),
            sanitize_csv_cell(st.get("status")),
        ])

    csv_content = output.getvalue()
    safe_filename = f"semester_{id}_performance_report.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )
