from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SemesterCreate(BaseModel):
    """Schema for teacher creating a semester."""
    name: str = Field(..., min_length=1, max_length=100, description="Semester title, e.g., 'Semester 5'")
    academic_year: str = Field(..., min_length=1, max_length=50, description="Academic year, e.g., '2024 - 2025'")
    start_date: date = Field(..., description="Semester start date (YYYY-MM-DD)")
    end_date: date = Field(..., description="Semester end date (YYYY-MM-DD)")
    status: str = Field(default="active", max_length=30, description="Status: 'active', 'completed', or 'archived'")
    program: Optional[str] = Field(default="B.Tech CSE", max_length=100, description="Program/Degree name")

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date > self.end_date:
            raise ValueError("Semester start date must be before or equal to end date.")
        return self


class SemesterUpdate(BaseModel):
    """Schema for teacher updating a semester."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    academic_year: Optional[str] = Field(None, min_length=1, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = Field(None, max_length=30)
    program: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("Semester start date must be before or equal to end date.")
        return self


class SemesterResponse(BaseModel):
    """Public representation of an academic semester."""
    id: int
    name: str
    academic_year: str
    start_date: date
    end_date: date
    status: str
    program: Optional[str] = "B.Tech CSE"
    teacher_id: int
    teacher_name: Optional[str] = None
    subject_count: int = 0
    student_count: int = 0
    assignment_count: int = 0
    submission_count: int = 0
    completion_rate: float = 0.0
    is_finalized: bool = False
    finalized_at: Optional[datetime] = None
    finalized_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SemesterSubjectSummary(BaseModel):
    """Summary of a subject within a semester."""
    id: int
    name: str
    description: Optional[str] = None
    join_code: str
    assignments_count: int = 0
    students_count: int = 0
    submission_rate: float = 0.0
    submission_rate_label: str = "0% submitted"


class SemesterDashboardResponse(BaseModel):
    """Full dashboard payload for a selected semester."""
    selected_semester: SemesterResponse
    available_semesters: List[SemesterResponse]
    statistics: Dict[str, Any]
    subjects: List[SemesterSubjectSummary]
    recent_submissions: List[Dict[str, Any]]
    upcoming_deadlines: List[Dict[str, Any]]


class SubjectStudentPerformanceItem(BaseModel):
    """Student performance row for a subject."""
    id: int
    rank: int
    student_name: str
    student_email: str
    submissions: str
    submissions_completed: int
    submissions_required: int
    average_score: Optional[float] = None
    average_score_label: str = "N/A"
    status: str = "On Track"
    has_incomplete: bool = False


class SubjectPerformanceResponse(BaseModel):
    """Full subject-wise performance response."""
    subject_id: int
    subject_name: str
    subject_description: Optional[str] = None
    semester_id: int
    semester_name: str
    total_students: int
    total_assignments: int
    students: List[SubjectStudentPerformanceItem]


class SemesterReportResponse(BaseModel):
    """Semester-level summary and comparative performance report."""
    semester: SemesterResponse
    summary: Dict[str, Any]
    subject_performances: List[Dict[str, Any]]
    top_students: List[Dict[str, Any]]
