from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_teacher, require_student
from app.db.session import get_db
from app.models.classroom import Class, ClassEnrollment, Subject, generate_join_code
from app.models.assignment import Assignment
from app.models.user import User
from app.schemas.classroom import (
    ClassCreate,
    ClassUpdate,
    ClassJoin,
    ClassResponse,
    StudentEnrollmentResponse,
    SubjectCreate,
    SubjectResponse,
)

router = APIRouter(prefix="/classes", tags=["classes"])


from app.models.semester import Semester


def serialize_class(cls: Class, db: Session) -> ClassResponse:
    """Helper to convert Class model into ClassResponse schema with aggregate counts."""
    student_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == cls.id).count()
    assignment_count = db.query(Assignment).filter(Assignment.class_id == cls.id).count()
    teacher_name = cls.teacher.full_name if cls.teacher else None
    semester_name = cls.semester.name if cls.semester else None

    return ClassResponse(
        id=cls.id,
        name=cls.name,
        description=cls.description,
        join_code=cls.join_code,
        teacher_id=cls.teacher_id,
        teacher_name=teacher_name,
        semester_id=cls.semester_id,
        semester_name=semester_name,
        student_count=student_count,
        assignment_count=assignment_count,
        created_at=cls.created_at,
        updated_at=cls.updated_at,
    )


@router.post(
    "",
    response_model=ClassResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new class (Teacher only)",
)
def create_class(
    payload: ClassCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Creates a new class with a name, optional description, optional semester_id, and a unique join code.
    Only authenticated teachers may create classes.
    """
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Class name cannot be empty.",
        )

    # Validate semester_id if supplied
    semester_id = None
    if payload.semester_id:
        sem = db.query(Semester).filter(Semester.id == payload.semester_id, Semester.teacher_id == teacher.id).first()
        if not sem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Semester with ID {payload.semester_id} not found or not owned by you.",
            )
        semester_id = sem.id

    # Generate a unique, non-guessable join code
    join_code = None
    for _ in range(10):
        candidate_code = generate_join_code()
        exists = db.query(Class).filter(Class.join_code == candidate_code).first()
        if not exists:
            join_code = candidate_code
            break

    if not join_code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate a unique join code. Please try again.",
        )

    new_class = Class(
        name=clean_name,
        description=payload.description.strip() if payload.description else None,
        join_code=join_code,
        teacher_id=teacher.id,
        semester_id=semester_id,
    )

    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    return serialize_class(new_class, db)


@router.get(
    "",
    response_model=List[ClassResponse],
    summary="List classes for the current user",
)
def list_classes(
    semester_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists classes:
    - If Teacher: returns classes owned by this teacher, optionally filtered by semester_id.
    - If Student: returns classes the student is enrolled in, optionally filtered by semester_id.
    """
    if current_user.role == "teacher":
        query = db.query(Class).filter(Class.teacher_id == current_user.id)
        if semester_id is not None:
            query = query.filter(Class.semester_id == semester_id)
        classes = query.order_by(Class.created_at.desc()).all()
    else:
        # Student enrolled classes
        query = (
            db.query(Class)
            .join(ClassEnrollment, Class.id == ClassEnrollment.class_id)
            .filter(ClassEnrollment.student_id == current_user.id)
        )
        if semester_id is not None:
            query = query.filter(Class.semester_id == semester_id)
        classes = query.order_by(ClassEnrollment.enrolled_at.desc()).all()

    return [serialize_class(c, db) for c in classes]


@router.get(
    "/{id}",
    response_model=ClassResponse,
    summary="Get class details by ID",
)
def get_class(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves class details:
    - Teachers can only view classes they own.
    - Students can only view classes they have enrolled in.
    """
    cls = db.query(Class).filter(Class.id == id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {id} not found.",
        )

    if current_user.role == "teacher":
        if cls.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this class.",
            )
    else:
        # Verify student enrollment
        enrollment = (
            db.query(ClassEnrollment)
            .filter(
                ClassEnrollment.class_id == id,
                ClassEnrollment.student_id == current_user.id,
            )
            .first()
        )
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in this class.",
            )

    return serialize_class(cls, db)


@router.put(
    "/{id}",
    response_model=ClassResponse,
    summary="Update class details (Teacher only)",
)
def update_class(
    id: int,
    payload: ClassUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Updates a class. Only the owning teacher may update the class.
    """
    cls = db.query(Class).filter(Class.id == id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {id} not found.",
        )

    if cls.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only edit classes you created.",
        )

    if payload.name is not None:
        clean_name = payload.name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Class name cannot be empty.",
            )
        cls.name = clean_name

    if payload.description is not None:
        cls.description = payload.description.strip() if payload.description else None

    if payload.semester_id is not None:
        if payload.semester_id == 0:
            cls.semester_id = None
        else:
            sem = db.query(Semester).filter(Semester.id == payload.semester_id, Semester.teacher_id == teacher.id).first()
            if not sem:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Semester with ID {payload.semester_id} not found or not owned by you.",
                )
            cls.semester_id = sem.id

    db.commit()
    db.refresh(cls)

    return serialize_class(cls, db)


@router.delete(
    "/{id}",
    summary="Delete a class (Teacher only)",
)
def delete_class(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Deletes a class. Only the owning teacher may delete the class.
    """
    cls = db.query(Class).filter(Class.id == id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {id} not found.",
        )

    if cls.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only delete classes you created.",
        )

    class_name = cls.name
    db.delete(cls)
    db.commit()

    return {"message": f"Class '{class_name}' successfully deleted.", "id": id}


@router.post(
    "/join",
    response_model=ClassResponse,
    status_code=status.HTTP_200_OK,
    summary="Join a class via join code (Student only)",
)
def join_class(
    payload: ClassJoin,
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """
    Enrolls a student in a class using the unique join code.
    Prevents duplicate joins and rejects invalid codes.
    """
    clean_code = payload.join_code.strip().upper()
    if not clean_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Join code cannot be empty.",
        )

    cls = db.query(Class).filter(func.upper(Class.join_code) == clean_code).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid join code: No class found matching this code.",
        )

    # Check for existing enrollment
    existing = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.class_id == cls.id,
            ClassEnrollment.student_id == student.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already enrolled in this class.",
        )

    enrollment = ClassEnrollment(class_id=cls.id, student_id=student.id)
    db.add(enrollment)
    db.commit()

    return serialize_class(cls, db)


@router.get(
    "/{id}/students",
    response_model=List[StudentEnrollmentResponse],
    summary="View enrolled students in a class (Teacher only)",
)
def list_class_students(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Retrieves the list of students enrolled in the specified class.
    Only the teacher who owns the class can view its enrolled students.
    """
    cls = db.query(Class).filter(Class.id == id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {id} not found.",
        )

    if cls.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only view students for classes you own.",
        )

    enrollments = (
        db.query(ClassEnrollment, User)
        .join(User, ClassEnrollment.student_id == User.id)
        .filter(ClassEnrollment.class_id == id)
        .order_by(ClassEnrollment.enrolled_at.desc())
        .all()
    )

    results = []
    for enrollment, user in enrollments:
        results.append(
            StudentEnrollmentResponse(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                enrolled_at=enrollment.enrolled_at,
            )
        )

    return results


@router.get(
    "/{id}/subjects",
    response_model=List[SubjectResponse],
    summary="List subjects for a class",
)
def list_class_subjects(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves all subjects belonging to the specified class.
    - Teachers can only view subjects for classes they own.
    - Students can only view subjects for classes they are enrolled in.
    """
    cls = db.query(Class).filter(Class.id == id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {id} not found.",
        )

    if current_user.role == "teacher":
        if cls.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this class.",
            )
    else:
        enrollment = (
            db.query(ClassEnrollment)
            .filter(
                ClassEnrollment.class_id == id,
                ClassEnrollment.student_id == current_user.id,
            )
            .first()
        )
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in this class.",
            )

    subjects = db.query(Subject).filter(Subject.class_id == id).order_by(Subject.id.asc()).all()
    return subjects


@router.post(
    "/{id}/subjects",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a subject to a class (Teacher only)",
)
def create_class_subject(
    id: int,
    payload: SubjectCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Creates a new subject associated with this class.
    Only the teacher who owns the class can create subjects for it.
    """
    cls = db.query(Class).filter(Class.id == id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {id} not found.",
        )

    if cls.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only add subjects to classes you own.",
        )

    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Subject name cannot be empty.",
        )

    # Check for duplicate subject in same class
    existing = db.query(Subject).filter(
        Subject.class_id == id,
        func.lower(Subject.name) == clean_name.lower(),
    ).first()
    if existing:
        return existing

    new_subject = Subject(name=clean_name, class_id=id)
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject

