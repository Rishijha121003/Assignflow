from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class GradeSubmissionRequest(BaseModel):
    """Schema for grading or updating marks and feedback for a student submission."""
    grade: float = Field(..., ge=0.0, description="Numeric mark obtained by the student")
    feedback: Optional[str] = Field(None, description="Optional constructive feedback comments")


class ReleaseGradesRequest(BaseModel):
    """Schema for releasing grades in bulk or selectively."""
    submission_ids: Optional[List[int]] = Field(
        None,
        description="Optional list of specific submission IDs to release. If omitted, releases all graded submissions for the assignment.",
    )


class ReleaseGradesResponse(BaseModel):
    """Schema returned after a bulk or selective grade release operation."""
    released_count: int
    message: str


class SubmissionResponse(BaseModel):
    """Schema representing a student submission response with privacy-aware grading fields."""
    id: int
    assignment_id: int
    student_id: int
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    file_name: str
    file_size: int
    notes: Optional[str] = None
    submitted_at: datetime
    is_late: bool = False
    grade: Optional[float] = None
    feedback: Optional[str] = None
    status: str = "submitted"  # submitted, graded, released
    graded_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    max_marks: Optional[float] = None
    resubmission_allowed: bool = False
    resubmission_deadline: Optional[datetime] = None
    resubmission_note: Optional[str] = None
    attempt_number: int = 1
    download_url: Optional[str] = None
    preview_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
