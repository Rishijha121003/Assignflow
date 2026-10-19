from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------
# Deadline Extensions
# ---------------------------------------------------------
class DeadlineExtensionCreate(BaseModel):
    """Payload to grant a student an individualized deadline extension."""
    student_id: int = Field(..., description="ID of the student receiving the extension")
    extended_deadline: datetime = Field(..., description="New deadline in ISO 8601 format")
    reason: Optional[str] = Field(None, max_length=500, description="Reason or justification for extension")


class DeadlineExtensionResponse(BaseModel):
    """Representation of an approved deadline extension."""
    id: int
    assignment_id: int
    student_id: int
    student_name: Optional[str] = None
    extended_deadline: datetime
    reason: Optional[str] = None
    granted_by_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Resubmissions & Submission History
# ---------------------------------------------------------
class AllowResubmissionRequest(BaseModel):
    """Payload for teacher to authorize a student resubmission."""
    resubmission_deadline: Optional[datetime] = Field(None, description="Optional deadline for the resubmission")
    resubmission_note: Optional[str] = Field(None, max_length=500, description="Guidance or instructions for resubmitting")


class SubmissionHistoryResponse(BaseModel):
    """Representation of an archived submission attempt."""
    id: int
    submission_id: int
    attempt_number: int
    file_name: str
    file_size: int
    notes: Optional[str] = None
    grade: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: datetime
    archived_at: datetime
    download_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Grade Corrections
# ---------------------------------------------------------
class GradeCorrectionRequest(BaseModel):
    """Payload to correct an existing grade with a mandatory audit reason."""
    new_grade: float = Field(..., ge=0.0, description="Corrected grade mark")
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory audit reason for correction")
    feedback: Optional[str] = Field(None, description="Optional updated feedback comments")


class GradeCorrectionResponse(BaseModel):
    """Audit log entry representing a recorded grade correction."""
    id: int
    submission_id: int
    previous_grade: Optional[float] = None
    new_grade: float
    reason: str
    corrected_by_id: int
    corrected_by_name: Optional[str] = None
    corrected_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Re-evaluation Requests
# ---------------------------------------------------------
class ReevaluationCreateRequest(BaseModel):
    """Payload for a student to request grade re-evaluation."""
    reason: str = Field(..., min_length=5, max_length=1000, description="Specific justification or grounds for re-evaluation")


class ReevaluationDecisionRequest(BaseModel):
    """Payload for teacher to decide on a re-evaluation request."""
    status: str = Field(..., pattern="^(approved|rejected)$", description="Outcome: 'approved' or 'rejected'")
    teacher_notes: Optional[str] = Field(None, max_length=1000, description="Teacher review comments or explanation")
    new_grade: Optional[float] = Field(None, ge=0.0, description="Optional updated grade if approved")


class ReevaluationResponse(BaseModel):
    """Representation of a student re-evaluation request."""
    id: int
    submission_id: int
    assignment_id: int
    assignment_title: Optional[str] = None
    student_id: int
    student_name: Optional[str] = None
    reason: str
    status: str
    teacher_notes: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    current_grade: Optional[float] = None
    max_marks: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Subject Finalization
# ---------------------------------------------------------
class FinalizeSubjectRequest(BaseModel):
    """Payload to finalize combined subject marks for a class."""
    required_units: List[int] = Field(..., min_length=1, description="List of required unit numbers (e.g. [1, 2, 3])")
    notes: Optional[str] = Field(None, max_length=500, description="Audit note regarding finalization")


class FinalizedResultResponse(BaseModel):
    """Representation of an explicitly finalized subject result for a student."""
    id: int
    class_id: int
    subject: str
    student_id: int
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    total_score: float
    max_score: float
    percentage: float
    rank: Optional[int] = None
    required_units: List[int]
    unit_breakdown: Dict[str, Any]
    is_final: bool
    finalized_by_id: Optional[int] = None
    finalized_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Notifications & Preferences
# ---------------------------------------------------------
class NotificationResponse(BaseModel):
    """In-app notification item."""
    id: int
    user_id: int
    title: str
    message: str
    type: str
    link_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceResponse(BaseModel):
    """User notification settings."""
    in_app_enabled: bool = True
    email_enabled: bool = True
    email_on_grade_released: bool = True
    email_on_deadline: bool = True
    email_on_reevaluation: bool = True

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceUpdate(BaseModel):
    """Update user notification preferences."""
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    email_on_grade_released: Optional[bool] = None
    email_on_deadline: Optional[bool] = None
    email_on_reevaluation: Optional[bool] = None
