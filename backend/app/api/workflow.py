import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_teacher, require_student
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.classroom import Class, ClassEnrollment
from app.models.correction import GradeCorrection, SubmissionHistory
from app.models.extension import DeadlineExtension
from app.models.finalization import FinalizedResult
from app.models.notification import Notification
from app.models.reevaluation import ReevaluationRequest
from app.models.submission import Submission
from app.models.user import User
from app.schemas.workflow import (
    AllowResubmissionRequest,
    DeadlineExtensionCreate,
    DeadlineExtensionResponse,
    FinalizeSubjectRequest,
    FinalizedResultResponse,
    GradeCorrectionRequest,
    GradeCorrectionResponse,
    ReevaluationCreateRequest,
    ReevaluationDecisionRequest,
    ReevaluationResponse,
    SubmissionHistoryResponse,
)
from app.services.notification_service import create_notification

router = APIRouter(tags=["workflow"])


def verify_teacher_assignment_ownership(assignment: Assignment, teacher_id: int, db: Session):
    """Verifies that the teacher owns the assignment directly or via class ownership."""
    if assignment.created_by_id == teacher_id:
        return
    if assignment.class_id:
        cls = db.query(Class).filter(Class.id == assignment.class_id, Class.teacher_id == teacher_id).first()
        if cls:
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to manage this assignment.",
    )


def verify_teacher_class_ownership(class_id: int, teacher_id: int, db: Session) -> Class:
    """Verifies that the teacher owns the specified class."""
    cls = db.query(Class).filter(Class.id == class_id, Class.teacher_id == teacher_id).first()
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this class.",
        )
    return cls


# ---------------------------------------------------------
# Feature 9: Deadline Extensions
# ---------------------------------------------------------
@router.post(
    "/assignments/{id}/extensions",
    response_model=DeadlineExtensionResponse,
    summary="Grant an individual deadline extension (Teacher only)",
)
def grant_deadline_extension(
    id: int,
    payload: DeadlineExtensionCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_teacher_assignment_ownership(assignment, teacher.id, db)

    # Verify student exists and is enrolled if assignment has a class
    student = db.query(User).filter(User.id == payload.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    if assignment.class_id:
        enrollment = (
            db.query(ClassEnrollment)
            .filter(ClassEnrollment.class_id == assignment.class_id, ClassEnrollment.student_id == student.id)
            .first()
        )
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student is not enrolled in the class for this assignment.",
            )

    # Check if existing extension exists for this assignment/student
    ext = (
        db.query(DeadlineExtension)
        .filter(DeadlineExtension.assignment_id == id, DeadlineExtension.student_id == student.id)
        .first()
    )
    if ext:
        ext.extended_due_date = payload.extended_deadline
        ext.reason = payload.reason
        ext.granted_by_id = teacher.id
    else:
        ext = DeadlineExtension(
            assignment_id=id,
            student_id=student.id,
            extended_due_date=payload.extended_deadline,
            reason=payload.reason,
            granted_by_id=teacher.id,
        )
        db.add(ext)

    db.commit()
    db.refresh(ext)

    create_notification(
        db=db,
        user_id=student.id,
        title="Deadline Extension Granted",
        message=f"You have been granted an extension for '{assignment.title}' until {payload.extended_deadline.strftime('%Y-%m-%d %H:%M UTC')}.",
        notif_type="deadline_extension",
        link=f"/#assignments",
    )

    return DeadlineExtensionResponse(
        id=ext.id,
        assignment_id=ext.assignment_id,
        student_id=ext.student_id,
        student_name=student.full_name,
        extended_deadline=ext.extended_due_date,
        reason=ext.reason,
        granted_by_id=ext.granted_by_id,
        created_at=ext.created_at,
    )


@router.get(
    "/assignments/{id}/extensions",
    response_model=List[DeadlineExtensionResponse],
    summary="List all granted extensions for an assignment (Teacher only)",
)
def list_assignment_extensions(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_teacher_assignment_ownership(assignment, teacher.id, db)

    extensions = db.query(DeadlineExtension).filter(DeadlineExtension.assignment_id == id).all()
    results = []
    for ext in extensions:
        results.append(
            DeadlineExtensionResponse(
                id=ext.id,
                assignment_id=ext.assignment_id,
                student_id=ext.student_id,
                student_name=ext.student.full_name if ext.student else "Student",
                extended_deadline=ext.extended_due_date,
                reason=ext.reason,
                granted_by_id=ext.granted_by_id,
                created_at=ext.created_at,
            )
        )
    return results


# ---------------------------------------------------------
# Feature 10: Teacher-controlled Resubmissions & History
# ---------------------------------------------------------
@router.post(
    "/submissions/{id}/allow-resubmission",
    summary="Authorize student to resubmit work (Teacher only)",
)
def allow_resubmission(
    id: int,
    payload: AllowResubmissionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    verify_teacher_assignment_ownership(submission.assignment, teacher.id, db)

    submission.resubmission_allowed = True
    submission.resubmission_deadline = payload.resubmission_deadline
    submission.resubmission_note = payload.resubmission_note
    db.commit()

    notif_msg = f"Your teacher has authorized a resubmission for '{submission.assignment.title}'. Notes: {payload.resubmission_note or 'Please review feedback and resubmit.'}"
    notif_link = f"/#assignments?resubmit={submission.assignment_id}"

    existing_notif = (
        db.query(Notification)
        .filter(
            Notification.user_id == submission.student_id,
            Notification.type == "resubmission_authorized",
            Notification.is_read == False,
            Notification.message.like(f"%'{submission.assignment.title}'%"),
        )
        .first()
    )
    if existing_notif:
        existing_notif.message = notif_msg
        existing_notif.link_url = notif_link
        existing_notif.created_at = datetime.now(timezone.utc)
        db.commit()
    else:
        create_notification(
            db=db,
            user_id=submission.student_id,
            title="Resubmission Authorized",
            message=notif_msg,
            notif_type="resubmission_authorized",
            link=notif_link,
        )

    return {"message": "Resubmission authorized successfully", "submission_id": id}


@router.get(
    "/submissions/{id}/history",
    response_model=List[SubmissionHistoryResponse],
    summary="Retrieve archived previous attempts for a submission",
)
def get_submission_history(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Authorize: student must be owner, or teacher must own assignment
    if current_user.role == "student" and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif current_user.role == "teacher":
        verify_teacher_assignment_ownership(submission.assignment, current_user.id, db)

    history = (
        db.query(SubmissionHistory)
        .filter(SubmissionHistory.submission_id == id)
        .order_by(SubmissionHistory.attempt_number.asc())
        .all()
    )

    results = []
    for h in history:
        results.append(
            SubmissionHistoryResponse(
                id=h.id,
                submission_id=h.submission_id,
                attempt_number=h.attempt_number,
                file_name=h.file_name,
                file_size=h.file_size,
                notes=h.notes,
                grade=float(h.grade) if (h.grade is not None and (current_user.role == "teacher" or submission.status == "released")) else None,
                feedback=h.feedback if (current_user.role == "teacher" or submission.status == "released") else None,
                submitted_at=h.submitted_at,
                archived_at=h.archived_at,
                download_url=f"/api/assignments/{submission.assignment_id}/submissions/{submission.id}/download",
            )
        )
    return results


# ---------------------------------------------------------
# Feature 11: Authorized Grade Corrections
# ---------------------------------------------------------
@router.put(
    "/submissions/{id}/correct-grade",
    response_model=GradeCorrectionResponse,
    summary="Record an authorized grade correction with mandatory reason (Teacher only)",
)
def correct_submission_grade(
    id: int,
    payload: GradeCorrectionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    verify_teacher_assignment_ownership(submission.assignment, teacher.id, db)

    if not payload.reason or len(payload.reason.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mandatory audit reason (minimum 3 characters) is required for grade correction.",
        )

    previous_grade = float(submission.grade) if submission.grade is not None else None
    new_grade = round(float(payload.new_grade), 2)
    max_marks = float(submission.assignment.max_marks or 100.0)
    if new_grade > max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Grade ({new_grade}) cannot exceed maximum marks ({max_marks}).",
        )

    now_utc = datetime.now(timezone.utc)

    # Create correction audit log
    correction = GradeCorrection(
        submission_id=submission.id,
        previous_grade=previous_grade,
        new_grade=new_grade,
        previous_feedback=submission.feedback,
        new_feedback=payload.feedback,
        reason=payload.reason.strip(),
        changed_by_id=teacher.id,
    )
    db.add(correction)

    # Update submission
    submission.grade = new_grade
    if payload.feedback is not None:
        submission.feedback = payload.feedback
    submission.graded_at = now_utc
    if submission.status == "submitted":
        submission.status = "graded"

    db.commit()
    db.refresh(correction)

    # Notify student
    create_notification(
        db=db,
        user_id=submission.student_id,
        title="Grade Corrected",
        message=f"Grade corrected for '{submission.assignment.title}' to {new_grade}/{max_marks}. Reason: {payload.reason.strip()}",
        notif_type="grade_corrected",
        link=f"/#assignments",
    )

    return GradeCorrectionResponse(
        id=correction.id,
        submission_id=correction.submission_id,
        previous_grade=correction.previous_grade,
        new_grade=correction.new_grade,
        reason=correction.reason,
        corrected_by_id=correction.changed_by_id or teacher.id,
        corrected_by_name=teacher.full_name,
        corrected_at=correction.created_at,
    )


@router.get(
    "/submissions/{id}/corrections",
    response_model=List[GradeCorrectionResponse],
    summary="Get audit log of all grade corrections for a submission",
)
def get_grade_corrections(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == "student" and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif current_user.role == "teacher":
        verify_teacher_assignment_ownership(submission.assignment, current_user.id, db)

    corrections = (
        db.query(GradeCorrection)
        .filter(GradeCorrection.submission_id == id)
        .order_by(GradeCorrection.created_at.desc())
        .all()
    )

    results = []
    for c in corrections:
        results.append(
            GradeCorrectionResponse(
                id=c.id,
                submission_id=c.submission_id,
                previous_grade=c.previous_grade,
                new_grade=c.new_grade,
                reason=c.reason,
                corrected_by_id=c.changed_by_id or 0,
                corrected_by_name=c.changed_by.full_name if c.changed_by else "Teacher",
                corrected_at=c.created_at,
            )
        )
    return results


# ---------------------------------------------------------
# Feature 12: Student Re-evaluation Requests
# ---------------------------------------------------------
@router.post(
    "/submissions/{id}/request-reevaluation",
    response_model=ReevaluationResponse,
    summary="Request re-evaluation of released grades (Student only)",
)
def request_reevaluation(
    id: int,
    payload: ReevaluationCreateRequest,
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == id, Submission.student_id == student.id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if submission.status != "released":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Re-evaluation can only be requested after grades are released.",
        )

    # Check for active pending request
    pending = (
        db.query(ReevaluationRequest)
        .filter(ReevaluationRequest.submission_id == id, ReevaluationRequest.status == "pending")
        .first()
    )
    if pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A re-evaluation request is already pending review.",
        )

    reeval = ReevaluationRequest(
        submission_id=id,
        student_id=student.id,
        reason=payload.reason.strip(),
        status="pending",
    )
    db.add(reeval)
    db.commit()
    db.refresh(reeval)

    # Notify teacher
    teacher_id = submission.assignment.created_by_id
    if not teacher_id and submission.assignment.classroom:
        teacher_id = submission.assignment.classroom.teacher_id
    if teacher_id:
        create_notification(
            db=db,
            user_id=teacher_id,
            title="Re-evaluation Requested",
            message=f"{student.full_name} has requested re-evaluation for '{submission.assignment.title}'. Reason: {payload.reason.strip()}",
            notif_type="reevaluation_requested",
            link=f"/#assignments",
        )

    return ReevaluationResponse(
        id=reeval.id,
        submission_id=reeval.submission_id,
        assignment_id=submission.assignment_id,
        assignment_title=submission.assignment.title,
        student_id=reeval.student_id,
        student_name=student.full_name,
        reason=reeval.reason,
        status=reeval.status,
        teacher_notes=reeval.decision_notes,
        reviewed_by_id=reeval.decided_by_id,
        reviewed_at=reeval.decided_at,
        created_at=reeval.created_at,
        current_grade=submission.grade,
        max_marks=submission.assignment.max_marks,
    )


@router.get(
    "/assignments/{id}/reevaluations",
    response_model=List[ReevaluationResponse],
    summary="List re-evaluation requests for an assignment (Teacher only)",
)
def list_assignment_reevaluations(
    id: int,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_teacher_assignment_ownership(assignment, teacher.id, db)

    requests = (
        db.query(ReevaluationRequest)
        .join(Submission, ReevaluationRequest.submission_id == Submission.id)
        .filter(Submission.assignment_id == id)
        .order_by(ReevaluationRequest.created_at.desc())
        .all()
    )

    results = []
    for r in requests:
        results.append(
            ReevaluationResponse(
                id=r.id,
                submission_id=r.submission_id,
                assignment_id=r.submission.assignment_id,
                assignment_title=r.submission.assignment.title,
                student_id=r.student_id,
                student_name=r.student.full_name if r.student else "Student",
                reason=r.reason,
                status=r.status,
                teacher_notes=r.decision_notes,
                reviewed_by_id=r.decided_by_id,
                reviewed_at=r.decided_at,
                created_at=r.created_at,
                current_grade=r.submission.grade,
                max_marks=r.submission.assignment.max_marks,
            )
        )
    return results


@router.put(
    "/reevaluations/{id}/decision",
    response_model=ReevaluationResponse,
    summary="Decide on a re-evaluation request (Teacher only)",
)
def decide_reevaluation(
    id: int,
    payload: ReevaluationDecisionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    reeval = db.query(ReevaluationRequest).filter(ReevaluationRequest.id == id).first()
    if not reeval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Re-evaluation request not found")

    submission = reeval.submission
    verify_teacher_assignment_ownership(submission.assignment, teacher.id, db)

    now_utc = datetime.now(timezone.utc)
    reeval.status = payload.status
    reeval.decision_notes = payload.teacher_notes
    reeval.decided_by_id = teacher.id
    reeval.decided_at = now_utc

    # If grade change was supplied upon approval
    if payload.status == "approved" and payload.new_grade is not None:
        prev_grade = float(submission.grade) if submission.grade is not None else None
        new_grade = round(float(payload.new_grade), 2)
        reeval.previous_grade = prev_grade
        reeval.revised_grade = new_grade
        if prev_grade != new_grade:
            correction = GradeCorrection(
                submission_id=submission.id,
                previous_grade=prev_grade,
                new_grade=new_grade,
                previous_feedback=submission.feedback,
                new_feedback=payload.teacher_notes,
                reason=f"Approved re-evaluation request #{reeval.id}: {payload.teacher_notes or 'Grade adjusted after review'}",
                changed_by_id=teacher.id,
            )
            db.add(correction)
            submission.grade = new_grade
            submission.graded_at = now_utc

    db.commit()
    db.refresh(reeval)

    # Notify student
    create_notification(
        db=db,
        user_id=reeval.student_id,
        title=f"Re-evaluation Request {payload.status.capitalize()}",
        message=f"Your re-evaluation request for '{submission.assignment.title}' was {payload.status}. Notes: {payload.teacher_notes or 'No notes provided.'}",
        notif_type="reevaluation_decision",
        link="/#assignments",
    )

    return ReevaluationResponse(
        id=reeval.id,
        submission_id=reeval.submission_id,
        assignment_id=submission.assignment_id,
        assignment_title=submission.assignment.title,
        student_id=reeval.student_id,
        student_name=reeval.student.full_name if reeval.student else "Student",
        reason=reeval.reason,
        status=reeval.status,
        teacher_notes=reeval.decision_notes,
        reviewed_by_id=reeval.decided_by_id,
        reviewed_at=reeval.decided_at,
        created_at=reeval.created_at,
        current_grade=submission.grade,
        max_marks=submission.assignment.max_marks,
    )


# ---------------------------------------------------------
# Feature 17: Explicit Subject Finalization & Audit Trail
# ---------------------------------------------------------
@router.post(
    "/classes/{class_id}/subjects/{subject}/finalize",
    response_model=List[FinalizedResultResponse],
    summary="Explicitly finalize subject marks for a class with audit trail (Teacher only)",
)
def finalize_subject_results(
    class_id: int,
    subject: str,
    payload: FinalizeSubjectRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cls = verify_teacher_class_ownership(class_id, teacher.id, db)

    # Find assignments for this class and subject matching required_units
    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.class_id == class_id,
            func.lower(Assignment.subject) == subject.strip().lower(),
            Assignment.unit.in_(payload.required_units),
        )
        .all()
    )
    if not assignments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No assessments found for subject '{subject}' in unit(s) {payload.required_units}.",
        )

    # Fetch enrolled students
    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    if not enrollments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No students are enrolled in this class.",
        )

    now_utc = datetime.now(timezone.utc)
    student_records = []

    for enr in enrollments:
        student = enr.student
        unit_breakdown = {}
        total_earned = 0.0
        total_max = 0.0
        all_completed = True

        for asg in assignments:
            sub = (
                db.query(Submission)
                .filter(Submission.assignment_id == asg.id, Submission.student_id == student.id)
                .first()
            )
            # Only released grades count for finalized results
            if sub and sub.status == "released" and sub.grade is not None:
                grade_val = float(sub.grade)
                max_val = float(asg.max_marks or 100.0)
                total_earned += grade_val
                total_max += max_val
                unit_breakdown[f"Unit {asg.unit}"] = {
                    "assignment_id": asg.id,
                    "score": grade_val,
                    "max_marks": max_val,
                    "percentage": round((grade_val / max_val) * 100, 2) if max_val > 0 else 0.0,
                }
            else:
                all_completed = False
                unit_breakdown[f"Unit {asg.unit}"] = {
                    "assignment_id": asg.id,
                    "score": None,
                    "max_marks": float(asg.max_marks or 100.0),
                    "status": "incomplete",
                }

        pct = round((total_earned / total_max) * 100, 2) if total_max > 0 else 0.0

        student_records.append(
            {
                "student": student,
                "total_earned": round(total_earned, 2),
                "total_max": round(total_max, 2),
                "percentage": pct,
                "is_final": all_completed,
                "unit_breakdown": unit_breakdown,
            }
        )

    # Sort and compute rank
    student_records.sort(key=lambda x: x["percentage"], reverse=True)
    rank = 1
    for idx, rec in enumerate(student_records):
        if idx > 0 and rec["percentage"] < student_records[idx - 1]["percentage"]:
            rank = idx + 1
        rec["rank"] = rank

    # Serialize for JSON storage in FinalizedResult
    serialized_summary = []
    for rec in student_records:
        serialized_summary.append(
            {
                "student_id": rec["student"].id,
                "student_name": rec["student"].full_name,
                "student_email": rec["student"].email,
                "total_score": rec["total_earned"],
                "max_score": rec["total_max"],
                "percentage": rec["percentage"],
                "rank": rec["rank"],
                "required_units": payload.required_units,
                "unit_breakdown": rec["unit_breakdown"],
                "is_final": rec["is_final"],
            }
        )

    req_units_str = ",".join(str(u) for u in sorted(payload.required_units))
    existing = (
        db.query(FinalizedResult)
        .filter(
            FinalizedResult.class_id == class_id,
            func.lower(FinalizedResult.subject) == subject.strip().lower(),
        )
        .first()
    )
    if existing:
        existing.required_units = req_units_str
        existing.results_summary = json.dumps(serialized_summary)
        existing.finalized_by_id = teacher.id
        existing.finalized_at = now_utc
        target = existing
    else:
        target = FinalizedResult(
            class_id=class_id,
            subject=subject.strip(),
            required_units=req_units_str,
            results_summary=json.dumps(serialized_summary),
            finalized_by_id=teacher.id,
            finalized_at=now_utc,
        )
        db.add(target)

    db.commit()
    db.refresh(target)

    # Build response
    responses = []
    for rec in serialized_summary:
        responses.append(
            FinalizedResultResponse(
                id=target.id,
                class_id=target.class_id,
                subject=target.subject,
                student_id=rec["student_id"],
                student_name=rec["student_name"],
                student_email=rec["student_email"],
                total_score=rec["total_score"],
                max_score=rec["max_score"],
                percentage=rec["percentage"],
                rank=rec["rank"],
                required_units=payload.required_units,
                unit_breakdown=rec["unit_breakdown"],
                is_final=rec["is_final"],
                finalized_by_id=target.finalized_by_id,
                finalized_at=target.finalized_at,
            )
        )
    return responses


@router.get(
    "/classes/{class_id}/subjects/{subject}/finalized",
    response_model=List[FinalizedResultResponse],
    summary="Get finalized results for a class subject (Role-scoped)",
)
def get_finalized_results(
    class_id: int,
    subject: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    if current_user.role == "student":
        enr = (
            db.query(ClassEnrollment)
            .filter(ClassEnrollment.class_id == class_id, ClassEnrollment.student_id == current_user.id)
            .first()
        )
        if not enr:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this class")
    else:
        if cls.teacher_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this class")

    record = (
        db.query(FinalizedResult)
        .filter(
            FinalizedResult.class_id == class_id,
            func.lower(FinalizedResult.subject) == subject.strip().lower(),
        )
        .first()
    )
    if not record or not record.results_summary:
        return []

    data = json.loads(record.results_summary)
    req_units = [int(u) for u in record.required_units.split(",") if u.strip().isdigit()]

    responses = []
    for rec in data:
        if current_user.role == "student" and rec.get("student_id") != current_user.id:
            continue
        responses.append(
            FinalizedResultResponse(
                id=record.id,
                class_id=record.class_id,
                subject=record.subject,
                student_id=rec.get("student_id", 0),
                student_name=rec.get("student_name"),
                student_email=rec.get("student_email") if current_user.role == "teacher" else None,
                total_score=rec.get("total_score", 0.0),
                max_score=rec.get("max_score", 0.0),
                percentage=rec.get("percentage", 0.0),
                rank=rec.get("rank"),
                required_units=req_units,
                unit_breakdown=rec.get("unit_breakdown", {}),
                is_final=rec.get("is_final", False),
                finalized_by_id=record.finalized_by_id,
                finalized_at=record.finalized_at,
            )
        )
    return responses
