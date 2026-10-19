from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ClassCreate(BaseModel):
    """Schema for teacher creating a class/subject."""
    name: str = Field(..., min_length=1, max_length=150, description="Name of the class/course")
    description: Optional[str] = Field(None, max_length=1000, description="Optional class description")
    semester_id: Optional[int] = Field(None, description="Optional associated semester ID")


class ClassUpdate(BaseModel):
    """Schema for teacher updating a class/subject."""
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    semester_id: Optional[int] = Field(None, description="Optional associated semester ID")


class ClassJoin(BaseModel):
    """Schema for student joining a class via join code."""
    join_code: str = Field(..., min_length=1, max_length=20, description="Unique class join code")


class ClassResponse(BaseModel):
    """Public representation of a class/subject."""
    id: int
    name: str
    description: Optional[str] = None
    join_code: str
    teacher_id: int
    teacher_name: Optional[str] = None
    semester_id: Optional[int] = None
    semester_name: Optional[str] = None
    student_count: int = 0
    assignment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentEnrollmentResponse(BaseModel):
    """Representation of an enrolled student in a class."""
    id: int
    full_name: str
    email: str
    enrolled_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubjectCreate(BaseModel):
    """Schema for teacher adding a subject to a class."""
    name: str = Field(..., min_length=1, max_length=100, description="Subject name, e.g., 'Database Systems'")


class SubjectResponse(BaseModel):
    """Public representation of a class subject."""
    id: int
    name: str
    class_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

