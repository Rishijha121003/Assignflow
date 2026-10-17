from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field


class AssignmentBase(BaseModel):
    """Shared fields for an assignment."""
    title: str = Field(..., min_length=1, max_length=200, description="Title of the assignment")
    subject: str = Field(..., min_length=1, max_length=100, description="Course or subject name")
    description: Optional[str] = Field(None, description="Detailed instructions or description")
    due_date: datetime = Field(..., description="Submission deadline (ISO 8601 format)")
    status: str = Field(default="active", max_length=50, description="Status: active, closed, draft, etc.")
    class_id: Optional[int] = Field(None, description="Class ID to which this assignment belongs")
    max_marks: float = Field(default=100.0, gt=0.0, description="Maximum numeric marks for this assignment (must be greater than 0)")
    unit: int = Field(default=1, ge=1, description="Curriculum unit number for this assessment (e.g. 1, 2, 3)")
    grace_period_minutes: int = Field(default=0, ge=0, description="Grace period duration in minutes beyond due_date")
    allow_late: bool = Field(default=True, description="Whether late submissions are permitted beyond grace period")
    late_penalty_percent: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage deduction for late submission")


class AssignmentCreate(AssignmentBase):
    """Schema for incoming POST request to create an assignment (when submitted as JSON)."""
    pass


class AssignmentUpdate(BaseModel):
    """Schema for incoming PUT/PATCH request to update an assignment."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    subject: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = Field(None, max_length=50)
    class_id: Optional[int] = None
    max_marks: Optional[float] = Field(None, gt=0.0)
    unit: Optional[int] = Field(None, ge=1)
    grace_period_minutes: Optional[int] = Field(None, ge=0)
    allow_late: Optional[bool] = None
    late_penalty_percent: Optional[float] = Field(None, ge=0.0, le=100.0)


class AssignmentResponse(AssignmentBase):
    """Schema for outgoing response representing an assignment retrieved from PostgreSQL."""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: Optional[int] = None
    class_id: Optional[int] = None
    class_name: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None

    @computed_field
    @property
    def has_attachment(self) -> bool:
        """Indicates whether a question PDF is attached to this assignment."""
        return bool(self.file_name)

    @computed_field
    @property
    def download_url(self) -> Optional[str]:
        """Authorized endpoint URL to view or download the attached question PDF."""
        if self.file_name:
            return f"/api/assignments/{self.id}/download"
        return None

    model_config = ConfigDict(from_attributes=True)
