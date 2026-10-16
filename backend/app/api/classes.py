from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_teacher, require_student
from app.db.session import get_db
from app.models.classroom import Class, ClassEnrollment, generate_join_code
from app.models.assignment import Assignment
from app.models.user import User
from app.schemas.classroom import (
    ClassCreate,
    ClassUpdate,
    ClassJoin,
    ClassResponse,
    StudentEnrollmentResponse,
)

router = APIRouter(prefix="/classes", tags=["classes"])


def serialize_class(cls: Class, db: Session) -> ClassResponse:
    """Helper to convert Class model into ClassResponse schema with aggregate counts."""
    student_count = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == cls.id).count()
    assignment_count = db.query(Assignment).filter(Assignment.class_id == cls.id).count()
    teacher_name = cls.teacher.full_name if cls.teacher else None

    return ClassResponse(
        id=cls.id,
        name=cls.name,
        description=cls.description,
        join_code=cls.join_code,
        teacher_id=cls.teacher_id,
        teacher_name=teacher_name,
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
    Creates a new class with a name, optional description, and a unique join code.
    Only authenticated teachers may create classes.
    """
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Class name cannot be empty.",
        )

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists classes:
    - If Teacher: returns only classes owned by this teacher.
    - If Student: returns only classes the student is enrolled in.
    """
    if current_user.role == "teacher":
        classes = (
            db.query(Class)
            .filter(Class.teacher_id == current_user.id)
            .order_by(Class.created_at.desc())
            .all()
        )
    else:
        # Student enrolled classes
        classes = (
            db.query(Class)
            .join(ClassEnrollment, Class.id == ClassEnrollment.class_id)
            .filter(ClassEnrollment.student_id == current_user.id)
            .order_by(ClassEnrollment.enrolled_at.desc())
            .all()
        )

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
