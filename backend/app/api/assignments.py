import csv
import html
import io
import os
import re
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import mammoth

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from starlette.datastructures import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.auth import get_current_user, require_teacher, require_student
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.user import User
from app.models.submission import Submission
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentResponse,
)
from app.schemas.submission import (
    SubmissionResponse,
    GradeSubmissionRequest,
    ReleaseGradesRequest,
    ReleaseGradesResponse,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])


def validate_and_save_pdf(file: UploadFile) -> tuple[str, str, int]:
    """
    Validates that the uploaded file:
    1. Is non-empty.
    2. Does not exceed settings.max_upload_size_bytes.
    3. Contains valid PDF magic bytes (%PDF-).
    Saves to a safe, uniquely-named path in settings.UPLOAD_DIR.
    Returns: (stored_file_path, sanitized_original_filename, file_size_in_bytes)
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing or invalid.",
        )

    # Reset file pointer if needed
    try:
        file.file.seek(0)
    except Exception:
        pass

    # Read content up to size limit + 1 byte to check for overflow
    contents = file.file.read(settings.max_upload_size_bytes + 1)
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty.",
        )

    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File size exceeds the maximum allowed limit of {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # Strict magic-bytes verification (%PDF-)
    if not contents.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format: file must be a valid PDF document (missing %PDF- header).",
        )

    # Ensure upload directory exists
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Generate a unique, safe filename for local storage
    safe_stored_name = f"{uuid.uuid4().hex}.pdf"
    target_path = settings.UPLOAD_DIR / safe_stored_name

    # Sanitize the original filename for presentation/download headers
    original_stem = Path(file.filename).name
    clean_display_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", original_stem)
    if not clean_display_name.lower().endswith(".pdf"):
        clean_display_name += ".pdf"

    # Write file to disk
    try:
        with open(target_path, "wb") as f:
            f.write(contents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file on disk: {str(exc)}",
        )

    return str(target_path), clean_display_name, file_size


def verify_teacher_class_ownership(class_id: Optional[int], teacher_id: int, db: Session) -> Optional[int]:
    """
    Verifies that if a class_id is provided, the class exists and is owned by the current teacher.
    Raises 404 if class does not exist, or 403 if teacher does not own the class.
    """
    if class_id is None:
        return None

    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found.",
        )

    if target_class.teacher_id != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only publish assignments to classes you own.",
        )

    return target_class.id


def verify_teacher_assignment_ownership(assignment: Assignment, teacher_id: int) -> None:
    """
    Verifies that the teacher either created the assignment or is the teacher of its class.
    Raises HTTP 403 Forbidden if teacher does not own the assignment.
    """
    if assignment.created_by_id and assignment.created_by_id == teacher_id:
        return
    if assignment.classroom and assignment.classroom.teacher_id == teacher_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You do not own this assignment.",
    )


@router.post(
    "",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new assignment",
)
async def create_assignment(
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Creates a new assignment in PostgreSQL.
    A teacher can publish an assignment to one of their own classes only.
    Supports multipart/form-data with attached question PDF, as well as JSON payloads.
    """
    content_type = request.headers.get("content-type", "")
    saved_file_path: Optional[str] = None

    if content_type.startswith("multipart/form-data") or content_type.startswith("application/x-www-form-urlencoded"):
        form = await request.form()
        title = form.get("title")
        subject = form.get("subject")
        description = form.get("description")
        due_date_str = form.get("due_date")
        status_val = form.get("status") or "active"
        upload_file = form.get("file")
        class_id_raw = form.get("class_id")
        max_marks_raw = form.get("max_marks")

        # Field validation
        if not title or not str(title).strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Title is required and cannot be empty.",
            )
        if not subject or not str(subject).strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Subject is required and cannot be empty.",
            )
        if not due_date_str:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Due date is required.",
            )

        try:
            due_date = datetime.fromisoformat(str(due_date_str).replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid ISO due_date format.",
            )

        max_marks_val = 100.0
        if max_marks_raw is not None and str(max_marks_raw).strip():
            try:
                max_marks_val = float(max_marks_raw)
                if max_marks_val < 0:
                    raise ValueError
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="max_marks must be a non-negative number.",
                )

        # Parse & verify class ownership
        target_class_id = None
        if class_id_raw is not None and str(class_id_raw).strip() and str(class_id_raw).lower() != "null":
            try:
                target_class_id = int(class_id_raw)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Invalid class_id format: must be an integer.",
                )
            target_class_id = verify_teacher_class_ownership(target_class_id, teacher.id, db)

        # PDF file validation
        if not upload_file or not hasattr(upload_file, "filename") or not upload_file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A question PDF file is required when creating an assignment.",
            )

        saved_file_path, display_name, file_size = validate_and_save_pdf(upload_file)

        db_assignment = Assignment(
            title=str(title).strip(),
            subject=str(subject).strip(),
            description=str(description).strip() if description else None,
            due_date=due_date,
            status=str(status_val),
            max_marks=max_marks_val,
            class_id=target_class_id,
            file_path=saved_file_path,
            file_name=display_name,
            file_size=file_size,
            created_by_id=teacher.id,
        )

        try:
            db.add(db_assignment)
            db.commit()
            db.refresh(db_assignment)
            return db_assignment
        except Exception as exc:
            db.rollback()
            if saved_file_path:
                Path(saved_file_path).unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while saving assignment: {str(exc)}",
            )

    elif content_type.startswith("application/json") or not content_type:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid JSON payload format.",
            )

        try:
            assignment_in = AssignmentCreate(**body)
        except Exception as err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(err),
            )

        target_class_id = verify_teacher_class_ownership(assignment_in.class_id, teacher.id, db)

        db_assignment = Assignment(
            title=assignment_in.title,
            subject=assignment_in.subject,
            description=assignment_in.description,
            due_date=assignment_in.due_date,
            status=assignment_in.status,
            class_id=target_class_id,
            created_by_id=teacher.id,
        )
        db.add(db_assignment)
        db.commit()
        db.refresh(db_assignment)
        return db_assignment

    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported content type. Send multipart/form-data or application/json.",
        )


@router.get("", response_model=List[AssignmentResponse], summary="List assignments")
def list_assignments(
    class_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves assignments based on user role and class enrollment:
    - Teachers: view assignments they created (or unassigned legacy assignments), optionally filtered by class_id.
    - Students: view assignments ONLY for classes they have joined.
    """
    if current_user.role == "teacher":
        query = db.query(Assignment)
        if class_id is not None:
            target_class = db.query(Class).filter(Class.id == class_id).first()
            if not target_class or target_class.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not own this class.",
                )
            query = query.filter(Assignment.class_id == class_id)
        else:
            query = query.filter(
                (Assignment.created_by_id == current_user.id)
                | (Assignment.created_by_id.is_(None))
            )
        return query.order_by(Assignment.id.desc()).all()

    else:
        # Student access: strictly scoped to joined classes
        enrolled_class_ids = [
            row[0]
            for row in db.query(ClassEnrollment.class_id)
            .filter(ClassEnrollment.student_id == current_user.id)
            .all()
        ]
        if not enrolled_class_ids:
            return []

        if class_id is not None:
            if class_id not in enrolled_class_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You are not enrolled in this class.",
                )
            return (
                db.query(Assignment)
                .filter(Assignment.class_id == class_id)
                .order_by(Assignment.id.desc())
                .all()
            )

        return (
            db.query(Assignment)
            .filter(Assignment.class_id.in_(enrolled_class_ids))
            .order_by(Assignment.id.desc())
            .all()
        )


@router.get("/{id}", response_model=AssignmentResponse, summary="Get assignment by ID")
def get_assignment(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves a single assignment by ID.
    - Teachers can view assignments they created or in classes they own (or unassigned legacy).
    - Students can view assignments ONLY if they are enrolled in the assignment's class.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    if current_user.role == "teacher":
        if assignment.created_by_id and assignment.created_by_id != current_user.id:
            if assignment.classroom and assignment.classroom.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not own this assignment.",
                )
    else:
        # Student access verification
        if not assignment.class_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in the class for this assignment.",
            )
        is_enrolled = (
            db.query(ClassEnrollment)
            .filter(
                ClassEnrollment.class_id == assignment.class_id,
                ClassEnrollment.student_id == current_user.id,
            )
            .first()
        )
        if not is_enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in the class for this assignment.",
            )

    return assignment


@router.put("/{id}", response_model=AssignmentResponse, summary="Update an assignment")
async def update_assignment(
    id: int,
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Updates an existing assignment.
    A teacher can update their own assignments and link them only to classes they own.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    if assignment.created_by_id and assignment.created_by_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only edit your own assignments.",
        )

    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data") or content_type.startswith("application/x-www-form-urlencoded"):
        form = await request.form()
        title = form.get("title")
        subject = form.get("subject")
        description = form.get("description")
        due_date_str = form.get("due_date")
        status_val = form.get("status")
        upload_file = form.get("file")
        class_id_raw = form.get("class_id")

        if title is not None and str(title).strip():
            assignment.title = str(title).strip()
        if subject is not None and str(subject).strip():
            assignment.subject = str(subject).strip()
        if description is not None:
            assignment.description = str(description).strip() if description else None
        if due_date_str is not None:
            try:
                assignment.due_date = datetime.fromisoformat(str(due_date_str).replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Invalid ISO due_date format.",
                )
        if status_val is not None:
            assignment.status = str(status_val)

        if class_id_raw is not None:
            if not str(class_id_raw).strip() or str(class_id_raw).lower() == "null":
                assignment.class_id = None
            else:
                try:
                    target_class_id = int(class_id_raw)
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="Invalid class_id format: must be an integer.",
                    )
                assignment.class_id = verify_teacher_class_ownership(target_class_id, teacher.id, db)

        # Optional replacement PDF file
        new_file_path = None
        old_file_path = None
        if upload_file and hasattr(upload_file, "filename") and upload_file.filename:
            old_file_path = assignment.file_path
            new_file_path, new_file_name, new_file_size = validate_and_save_pdf(upload_file)

            assignment.file_path = new_file_path
            assignment.file_name = new_file_name
            assignment.file_size = new_file_size

        try:
            db.commit()
            db.refresh(assignment)

            if new_file_path and old_file_path and Path(old_file_path).exists():
                try:
                    Path(old_file_path).unlink(missing_ok=True)
                except Exception:
                    pass

            return assignment
        except Exception as exc:
            db.rollback()
            if new_file_path:
                Path(new_file_path).unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while updating assignment: {str(exc)}",
            )

    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid JSON payload format.",
            )

        try:
            assignment_in = AssignmentUpdate(**body)
        except Exception as err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(err),
            )

        update_data = assignment_in.model_dump(exclude_unset=True)
        if "class_id" in update_data:
            target_class_id = update_data["class_id"]
            if target_class_id is not None:
                verify_teacher_class_ownership(target_class_id, teacher.id, db)

        for field, value in update_data.items():
            setattr(assignment, field, value)

        db.commit()
        db.refresh(assignment)
        return assignment


@router.delete("/{id}", summary="Delete an assignment")
def delete_assignment(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Deletes an assignment from PostgreSQL by ID and removes any associated file from disk.
    Only the owning teacher may delete the assignment.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    if assignment.created_by_id and assignment.created_by_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only delete your own assignments.",
        )

    if assignment.file_path and Path(assignment.file_path).exists():
        try:
            Path(assignment.file_path).unlink(missing_ok=True)
        except Exception:
            pass

    db.delete(assignment)
    db.commit()
    return {"message": f"Assignment with ID {id} successfully deleted", "id": id}


@router.get("/{id}/download", summary="Download assignment question PDF")
def download_assignment_pdf(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Secure download endpoint for the question PDF attached to an assignment.
    Students can download assignment PDFs ONLY for classes they have joined.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    # Scoped authorization
    if current_user.role == "student":
        if not assignment.class_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in the class for this assignment.",
            )
        is_enrolled = (
            db.query(ClassEnrollment)
            .filter(
                ClassEnrollment.class_id == assignment.class_id,
                ClassEnrollment.student_id == current_user.id,
            )
            .first()
        )
        if not is_enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not enrolled in the class for this assignment.",
            )
    else:
        # Teacher check
        if assignment.created_by_id and assignment.created_by_id != current_user.id:
            if assignment.classroom and assignment.classroom.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not own this assignment.",
                )

    if not assignment.file_path or not assignment.file_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No PDF document is attached to this assignment.",
        )

    file_path = Path(assignment.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attached PDF file was not found on server storage.",
        )

    return FileResponse(
        path=str(file_path),
        filename=assignment.file_name,
        media_type="application/pdf",
        content_disposition_type="inline",
    )


# ==========================================================================
# Student Assignment Submissions
# ==========================================================================

ALLOWED_SUBMISSION_EXTENSIONS = {".pdf", ".docx", ".doc", ".zip", ".txt"}


def validate_and_save_submission_file(file: UploadFile) -> tuple[str, str, int]:
    """
    Validates that the submitted work file:
    1. Has a valid filename and supported non-executable extension (PDF, DOCX, DOC, TXT, ZIP).
    2. Is non-empty.
    3. Does not exceed settings.max_upload_size_bytes (10MB).
    4. Passes format checks (e.g. %PDF- for PDF files).
    Saves to a safe, uniquely-named path in settings.SUBMISSIONS_UPLOAD_DIR.
    Returns: (stored_file_path, sanitized_original_filename, file_size_in_bytes)
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing or invalid.",
        )

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_SUBMISSION_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: '{file_ext}' is not supported. Allowed formats are PDF, DOCX, DOC, TXT, and ZIP.",
        )

    try:
        file.file.seek(0)
    except Exception:
        pass

    contents = file.file.read(settings.max_upload_size_bytes + 1)
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded submission file is empty.",
        )

    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File size exceeds the maximum allowed limit of {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # Magic-bytes verification for PDF files
    if file_ext == ".pdf" and not contents.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format: file must be a valid PDF document (missing %PDF- header).",
        )

    settings.SUBMISSIONS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    safe_stored_name = f"{uuid.uuid4().hex}{file_ext}"
    target_path = settings.SUBMISSIONS_UPLOAD_DIR / safe_stored_name

    clean_display_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", Path(file.filename).name)
    if not clean_display_name.lower().endswith(file_ext):
        clean_display_name += file_ext

    try:
        with open(target_path, "wb") as f:
            f.write(contents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store submission file on disk: {str(exc)}",
        )

    return str(target_path), clean_display_name, file_size


def serialize_submission(sub: Submission, viewer_role: str = "teacher") -> SubmissionResponse:
    """
    Helper to convert Submission model to SubmissionResponse without exposing server file paths.
    Enforces privacy wall:
    - If viewer is student and status is NOT 'released', marks, feedback, and timestamps are masked.
    - If viewer is teacher, or status is 'released', full grade and feedback are returned.
    """
    is_teacher = (viewer_role == "teacher")
    is_released = (sub.status == "released")
    show_grade = is_teacher or is_released

    assignment_max_marks = float(sub.assignment.max_marks) if (sub.assignment and sub.assignment.max_marks is not None) else 100.0

    return SubmissionResponse(
        id=sub.id,
        assignment_id=sub.assignment_id,
        student_id=sub.student_id,
        student_name=sub.student.full_name if sub.student else None,
        student_email=sub.student.email if sub.student else None,
        file_name=sub.file_name,
        file_size=sub.file_size,
        notes=sub.notes,
        submitted_at=sub.submitted_at,
        is_late=sub.is_late,
        grade=float(sub.grade) if (show_grade and sub.grade is not None) else None,
        feedback=sub.feedback if show_grade else None,
        status=sub.status if show_grade else "submitted",
        graded_at=sub.graded_at if show_grade else None,
        released_at=sub.released_at if (is_released or is_teacher) else None,
        max_marks=assignment_max_marks,
        download_url=f"/api/assignments/{sub.assignment_id}/submissions/{sub.id}/download",
        preview_url=f"/api/assignments/{sub.assignment_id}/submissions/{sub.id}/preview",
    )


@router.post(
    "/{id}/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit work for an assignment (Student only)",
)
async def submit_assignment_work(
    id: int,
    request: Request,
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """
    Submits completed work against an assignment.
    - Only students enrolled in the assignment's class can submit.
    - Enforces one submission per student per assignment.
    - Evaluates whether the submission is late based on assignment.due_date.
    - Validates file type and size.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    if not assignment.class_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not enrolled in the class for this assignment.",
        )

    is_enrolled = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.class_id == assignment.class_id,
            ClassEnrollment.student_id == student.id,
        )
        .first()
    )
    if not is_enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not enrolled in the class for this assignment.",
        )

    # Check for duplicate submission
    existing = (
        db.query(Submission)
        .filter(
            Submission.assignment_id == id,
            Submission.student_id == student.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted work for this assignment. Duplicate submissions are not permitted.",
        )

    content_type = request.headers.get("content-type", "")
    if not (content_type.startswith("multipart/form-data") or content_type.startswith("application/x-www-form-urlencoded")):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported content type. Send multipart/form-data with a completed-work file.",
        )

    form = await request.form()
    upload_file = form.get("file")
    notes = form.get("notes")

    if not upload_file or not hasattr(upload_file, "filename") or not upload_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A completed-work file is required for submission.",
        )

    saved_file_path, clean_display_name, file_size = validate_and_save_submission_file(upload_file)

    now = datetime.now(timezone.utc)
    due_date = assignment.due_date
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    is_late = now > due_date

    submission = Submission(
        assignment_id=assignment.id,
        student_id=student.id,
        file_path=saved_file_path,
        file_name=clean_display_name,
        file_size=file_size,
        notes=str(notes).strip() if notes and str(notes).strip() else None,
        submitted_at=now,
        is_late=is_late,
    )

    try:
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return serialize_submission(submission)
    except Exception as exc:
        db.rollback()
        if saved_file_path:
            Path(saved_file_path).unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while saving submission: {str(exc)}",
        )


@router.get(
    "/{id}/submissions/me",
    response_model=SubmissionResponse,
    summary="View own submission for an assignment (Student only)",
)
def get_my_submission(
    id: int,
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """
    Allows an enrolled student to view their own submission details and late status.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    if not assignment.class_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not enrolled in the class for this assignment.",
        )

    is_enrolled = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.class_id == assignment.class_id,
            ClassEnrollment.student_id == student.id,
        )
        .first()
    )
    if not is_enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not enrolled in the class for this assignment.",
        )

    submission = (
        db.query(Submission)
        .filter(
            Submission.assignment_id == id,
            Submission.student_id == student.id,
        )
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No submission found for this assignment.",
        )

    return serialize_submission(submission, viewer_role="student")


@router.get(
    "/{id}/submissions/{submission_id}/download",
    summary="Download student submission file (Authorized Teacher or Submitting Student)",
)
def download_submission_file(
    id: int,
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Secure download endpoint for student-submitted work.
    - Submitting student can download their own submission.
    - Class-owning teacher can download any student's submission.
    - Unauthorized students or other teachers are denied (403).
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    submission = (
        db.query(Submission)
        .filter(
            Submission.id == submission_id,
            Submission.assignment_id == id,
        )
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with ID {submission_id} not found",
        )

    if current_user.role == "student":
        if submission.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot download another student's submission.",
            )
    else:
        verify_teacher_assignment_ownership(assignment, current_user.id)

    file_path = Path(submission.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submitted file was not found on server storage.",
        )

    return FileResponse(
        path=str(file_path),
        filename=submission.file_name,
        media_type="application/octet-stream",
        content_disposition_type="attachment",
    )


@router.get(
    "/{id}/submissions",
    response_model=List[SubmissionResponse],
    summary="List all submissions for an assignment (Teacher only)",
)
def list_assignment_submissions(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Allows the owning teacher to view all student submissions for an assignment without exposing server file paths.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    verify_teacher_assignment_ownership(assignment, teacher.id)

    submissions = (
        db.query(Submission)
        .filter(Submission.assignment_id == id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    return [serialize_submission(s, viewer_role="teacher") for s in submissions]


@router.get(
    "/{id}/submissions/{submission_id}/preview",
    summary="In-browser PDF preview of student submission (Owning Teacher or Submitting Student)",
)
def preview_submission_file(
    id: int,
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Streams the student's submission file for in-browser preview if it is a PDF.
    Non-PDF submissions return HTTP 415 Unsupported Media Type with download guidance.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    submission = (
        db.query(Submission)
        .filter(
            Submission.id == submission_id,
            Submission.assignment_id == id,
        )
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with ID {submission_id} not found",
        )

    if current_user.role == "student":
        if submission.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot preview another student's submission.",
            )
    else:
        verify_teacher_assignment_ownership(assignment, current_user.id)

    file_path = Path(submission.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submitted file was not found on server storage.",
        )

    file_ext = file_path.suffix.lower()
    if file_ext == ".pdf":
        return FileResponse(
            path=str(file_path),
            filename=submission.file_name,
            media_type="application/pdf",
            content_disposition_type="inline",
        )
    elif file_ext == ".docx":
        try:
            with open(file_path, "rb") as docx_file:
                conversion_result = mammoth.convert_to_html(docx_file)
                raw_html = conversion_result.value
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unable to preview document: The DOCX file is corrupted, encrypted, or invalid. ({str(exc)})",
            )

        sanitized_body = sanitize_docx_html(raw_html)
        full_html = wrap_docx_html(sanitized_body, title=submission.file_name or "Document Preview")

        return Response(
            content=full_html,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline';",
                "X-Content-Type-Options": "nosniff",
            },
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="In-browser preview is available for PDF and DOCX files only. Please use the download endpoint.",
        )


def sanitize_docx_html(raw_html: str) -> str:
    """
    Sanitizes HTML generated from DOCX conversion:
    1. Removes dangerous elements (script, style, iframe, object, embed, applet, form)
    2. Strips inline event handlers (onclick, onload, onerror, etc.)
    3. Neutralizes javascript: and data: schemes in href attributes
    4. Strips remote image/resource sources (http://, https://, //) to prevent external tracking/requests
    """
    dangerous_blocks = [
        r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>",
        r"<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>",
        r"<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>",
        r"<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>",
        r"<embed\b[^>]*>",
        r"<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>",
        r"<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>",
    ]
    cleaned = raw_html
    for pattern in dangerous_blocks:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Strip any remaining disallowed tags
    cleaned = re.sub(
        r"<\/?(script|style|iframe|object|embed|applet|form|input|button|link|meta|base)\b[^>]*>",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    # Strip inline event handlers: onclick="...", onload='...', etc.
    cleaned = re.sub(r'\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)', "", cleaned)

    # Neutralize dangerous URI schemes in href attributes
    cleaned = re.sub(
        r'href\s*=\s*(?:"javascript:[^"]*"|\'javascript:[^\']*\'|javascript:[^\s>]+)',
        'href="#"',
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r'href\s*=\s*(?:"data:[^"]*"|\'data:[^\']*\'|data:[^\s>]+)',
        'href="#"',
        cleaned,
        flags=re.IGNORECASE,
    )

    # Strip remote resources (http://, https://, //) from src attributes
    cleaned = re.sub(
        r'src\s*=\s*(?:"https?:[^"]*"|\'https?:[^\']*\'|https?:[^\s>]+)',
        'src=""',
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r'src\s*=\s*(?:"\/\/[^"]*"|\'\/\/[^\']*\'|\/\/[^\s>]+)',
        'src=""',
        cleaned,
        flags=re.IGNORECASE,
    )

    return cleaned


def wrap_docx_html(body_html: str, title: str = "Document Preview") -> str:
    """
    Wraps sanitized DOCX HTML into a standalone, styled document with strict CSP meta tag.
    Preserves headings, paragraphs, tables, lists, and inline styles in a clean, readable layout.
    """
    escaped_title = html.escape(title)
    rendered_body = body_html.strip() if body_html.strip() else "<p style='color: #64748b; font-style: italic;'>[This document has no readable text content.]</p>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escaped_title}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #ffffff;
      padding: 2.5rem;
      max-width: 820px;
      margin: 0 auto;
      box-sizing: border-box;
      word-wrap: break-word;
    }}
    h1, h2, h3, h4, h5, h6 {{
      color: #0f172a;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }}
    h1 {{ font-size: 1.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4rem; }}
    h2 {{ font-size: 1.4rem; }}
    h3 {{ font-size: 1.2rem; }}
    p {{
      margin-top: 0;
      margin-bottom: 1em;
      color: #334155;
    }}
    table {{
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
      font-size: 0.95rem;
    }}
    th, td {{
      border: 1px solid #cbd5e1;
      padding: 0.65rem 0.85rem;
      text-align: left;
    }}
    th {{
      background-color: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }}
    tr:nth-child(even) {{
      background-color: #f8fafc;
    }}
    ul, ol {{
      margin-top: 0;
      margin-bottom: 1em;
      padding-left: 2em;
      color: #334155;
    }}
    li {{ margin-bottom: 0.35em; }}
    img {{
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }}
    blockquote {{
      border-left: 4px solid #6366f1;
      padding-left: 1rem;
      margin: 1.2em 0;
      color: #475569;
      font-style: italic;
    }}
    strong {{ font-weight: 600; color: #0f172a; }}
    code, pre {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #f1f5f9;
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.9em;
    }}
  </style>
</head>
<body>
  {rendered_body}
</body>
</html>"""



@router.put(
    "/{id}/submissions/{submission_id}/grade",
    response_model=SubmissionResponse,
    summary="Grade or update marks and feedback for a student submission (Teacher only)",
)
def grade_submission(
    id: int,
    submission_id: int,
    payload: GradeSubmissionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Saves marks and feedback for a student submission as a draft (status='graded').
    Never releases grades to students. Validates 0 <= grade <= assignment.max_marks.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    verify_teacher_assignment_ownership(assignment, teacher.id)

    sub_query = (
        db.query(Submission)
        .filter(
            Submission.id == submission_id,
            Submission.assignment_id == id,
        )
    )
    bind = db.get_bind()
    if bind and bind.dialect.name in ("postgresql", "mysql"):
        sub_query = sub_query.with_for_update()
    submission = sub_query.first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with ID {submission_id} not found",
        )

    # Validate grade against assignment max_marks
    if payload.grade < 0.0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Grade cannot be negative.",
        )
    if assignment.max_marks is not None and payload.grade > assignment.max_marks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Grade cannot exceed assignment maximum marks of {assignment.max_marks}.",
        )

    submission.grade = payload.grade
    submission.feedback = payload.feedback.strip() if payload.feedback else None
    if submission.status != "released":
        submission.status = "graded"
    submission.graded_at = datetime.now(timezone.utc)
    submission.graded_by_id = teacher.id

    db.commit()
    db.refresh(submission)

    return serialize_submission(submission, viewer_role="teacher")


@router.post(
    "/{id}/submissions/{submission_id}/release",
    response_model=SubmissionResponse,
    summary="Release grade and feedback to student for a single submission (Teacher only)",
)
def release_single_submission_grade(
    id: int,
    submission_id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Releases a graded submission to the student (status='released').
    Rejects submissions that have not yet been graded.
    Repeated release requests on already-released submissions are safely idempotent.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    verify_teacher_assignment_ownership(assignment, teacher.id)

    submission = (
        db.query(Submission)
        .filter(
            Submission.id == submission_id,
            Submission.assignment_id == id,
        )
        .with_for_update()
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with ID {submission_id} not found",
        )

    if submission.grade is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot release un-graded submission. Please grade the submission first.",
        )

    submission.status = "released"
    if not submission.released_at:
        submission.released_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(submission)

    return serialize_submission(submission, viewer_role="teacher")


@router.post(
    "/{id}/release-grades",
    response_model=ReleaseGradesResponse,
    summary="Release grades for all graded submissions or a specified subset (Teacher only)",
)
def release_assignment_grades(
    id: int,
    payload: Optional[ReleaseGradesRequest] = None,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Atomically releases grades for graded submissions under an assignment.
    Ungraded submissions remain 'submitted' and are unaffected.
    Rolls back the entire transaction if any failure occurs.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    verify_teacher_assignment_ownership(assignment, teacher.id)

    query = (
        db.query(Submission)
        .filter(
            Submission.assignment_id == id,
            Submission.grade.isnot(None),
            Submission.status != "released",
        )
    )

    if payload and payload.submission_ids is not None:
        if len(payload.submission_ids) == 0:
            return ReleaseGradesResponse(
                released_count=0,
                message="No submissions selected for release."
            )
        query = query.filter(Submission.id.in_(payload.submission_ids))

    bind = db.get_bind()
    if bind and bind.dialect.name in ("postgresql", "mysql"):
        query = query.with_for_update()

    try:
        submissions_to_release = query.all()
        now_utc = datetime.now(timezone.utc)
        count = len(submissions_to_release)

        for sub in submissions_to_release:
            sub.status = "released"
            if not sub.released_at:
                sub.released_at = now_utc

        db.commit()

        return ReleaseGradesResponse(
            released_count=count,
            message=f"Successfully released grades for {count} student{'s' if count != 1 else ''}."
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction error while releasing grades: {str(exc)}",
        )


def sanitize_csv_value(value: any) -> str:
    """
    Prevents CSV formula injection (DDE attacks) for spreadsheet viewers.
    Prefixes cells starting with =, +, -, @, \\t, or \\r with a single quote.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{val_str}"
    return val_str


@router.get(
    "/{id}/export/csv",
    summary="Export assignment submissions to CSV (Teacher only)",
)
def export_assignment_submissions_csv(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Exports all student submissions for an assignment to CSV.
    Only the owning teacher is authorized (403 for non-owners/students).
    Includes student identifiers, submission status, grade, max marks, percentage, feedback, release status.
    All cells are sanitized against spreadsheet formula injection.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    verify_teacher_assignment_ownership(assignment, teacher.id)

    submissions = (
        db.query(Submission)
        .filter(Submission.assignment_id == id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    max_marks = float(assignment.max_marks) if assignment.max_marks is not None else 100.0
    safe_title = re.sub(r"[^\w\-]", "_", assignment.title.strip()).strip("_") or f"assignment_{id}"
    class_name = assignment.classroom.name if assignment.classroom else ""

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Student ID",
        "Student Name",
        "Student Email",
        "Assignment Title",
        "Class",
        "Submitted At (UTC)",
        "Late Submission",
        "Submission Status",
        "Grade",
        "Maximum Marks",
        "Percentage",
        "Grade Released",
        "Released At (UTC)",
        "Teacher Feedback",
        "Submission Filename",
    ]
    writer.writerow(headers)

    for sub in submissions:
        student_id = sub.student_id
        student_name = sub.student.full_name if sub.student else ""
        student_email = sub.student.email if sub.student else ""
        submitted_at_str = sub.submitted_at.isoformat() if sub.submitted_at else ""
        is_late_str = "Yes" if sub.is_late else "No"
        status_str = sub.status
        grade_str = str(sub.grade) if sub.grade is not None else ""
        max_marks_str = str(max_marks)
        percentage_str = (
            f"{round((float(sub.grade) / max_marks) * 100, 2)}%"
            if sub.grade is not None
            else ""
        )
        grade_released_str = "Yes" if sub.status == "released" else "No"
        released_at_str = sub.released_at.isoformat() if sub.released_at else ""
        feedback_str = sub.feedback if sub.feedback else ""
        filename_str = sub.file_name if sub.file_name else ""

        row = [
            sanitize_csv_value(student_id),
            sanitize_csv_value(student_name),
            sanitize_csv_value(student_email),
            sanitize_csv_value(assignment.title),
            sanitize_csv_value(class_name),
            sanitize_csv_value(submitted_at_str),
            sanitize_csv_value(is_late_str),
            sanitize_csv_value(status_str),
            sanitize_csv_value(grade_str),
            sanitize_csv_value(max_marks_str),
            sanitize_csv_value(percentage_str),
            sanitize_csv_value(grade_released_str),
            sanitize_csv_value(released_at_str),
            sanitize_csv_value(feedback_str),
            sanitize_csv_value(filename_str),
        ]
        writer.writerow(row)

    csv_content = output.getvalue()
    filename = f"{safe_title}_submissions.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get(
    "/{id}/export/zip",
    summary="Download all student-submitted files as a ZIP archive (Teacher only)",
)
def export_assignment_submissions_zip(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Packages all actual student-submitted files for an assignment into a ZIP archive.
    Only the owning teacher is authorized (403 for non-owners/students).
    CRITICAL: Never includes the teacher's original assignment attachment.
    Prevents path traversal, disambiguates collisions, and safely handles missing files.
    """
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with ID {id} not found",
        )

    verify_teacher_assignment_ownership(assignment, teacher.id)

    submissions = (
        db.query(Submission)
        .filter(Submission.assignment_id == id)
        .all()
    )

    safe_title = re.sub(r"[^\w\-]", "_", assignment.title.strip()).strip("_") or f"assignment_{id}"
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip_path = temp_zip.name
    temp_zip.close()

    try:
        with zipfile.ZipFile(temp_zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            seen_filenames = set()

            for sub in submissions:
                if not sub.file_path:
                    continue

                file_path = Path(sub.file_path)
                # Ensure file actually exists on server filesystem
                if not file_path.is_file():
                    continue

                # CRITICAL SECURITY: Never include teacher's assignment attachment
                if assignment.file_path and str(file_path.resolve()) == str(Path(assignment.file_path).resolve()):
                    continue

                # Safe student name prefix
                raw_student_name = (
                    sub.student.full_name
                    if (sub.student and sub.student.full_name)
                    else f"student_{sub.student_id}"
                )
                student_slug = re.sub(r"[^\w\-]", "_", raw_student_name).strip("_") or f"student_{sub.student_id}"

                # Strip path traversal: use Path.name strictly
                original_basename = Path(sub.file_name or file_path.name).name
                safe_basename = re.sub(r"[^\w\.\-\s]", "_", original_basename).strip() or "submission.bin"

                base_arcname = f"{student_slug}_{sub.student_id}_{safe_basename}"

                # Disambiguate duplicate filenames in the archive
                candidate = base_arcname
                counter = 1
                arc_p = Path(base_arcname)
                stem = arc_p.stem
                suffix = arc_p.suffix

                while candidate.lower() in seen_filenames:
                    candidate = f"{stem}_{counter}{suffix}"
                    counter += 1

                seen_filenames.add(candidate.lower())
                zf.write(file_path, arcname=candidate)
    except Exception:
        if os.path.exists(temp_zip_path):
            os.unlink(temp_zip_path)
        raise

    zip_filename = f"{safe_title}_submissions.zip"

    return FileResponse(
        path=temp_zip_path,
        filename=zip_filename,
        media_type="application/zip",
        content_disposition_type="attachment",
        background=BackgroundTask(os.unlink, temp_zip_path),
    )
