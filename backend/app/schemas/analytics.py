from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class UnitScoreItem(BaseModel):
    """Score summary for a single curriculum unit."""
    unit: int
    assignment_id: int
    assignment_title: str
    status: str  # 'released', 'graded', 'submitted', 'missing'
    score: Optional[float] = None
    max_marks: float = 100.0
    percentage: Optional[float] = None
    unit_rank: Optional[int] = None
    is_released: bool = False


class StudentRankingItem(BaseModel):
    """Rank and performance record for an individual student."""
    student_id: int
    student_name: str
    student_email: Optional[str] = None
    is_self: bool = False
    rank: Optional[int] = None  # primary rank for display (final_rank if complete else provisional_rank)
    provisional_score: Optional[float] = None
    provisional_max: Optional[float] = None
    provisional_percentage: Optional[float] = None
    provisional_rank: Optional[int] = None
    final_score: Optional[float] = None
    final_max: Optional[float] = None
    final_percentage: Optional[float] = None
    final_rank: Optional[int] = None
    is_complete: bool = False
    status: str = "provisional"  # 'finalized', 'complete', or 'provisional'
    completed_units_count: int = 0
    total_required_units: int = 0
    units: List[UnitScoreItem] = []
    unit_marks: Dict[int, Optional[float]] = {}


class ClassRankingsResponse(BaseModel):
    """Subject and class-level ranking and performance overview."""
    class_id: int
    class_name: str
    subject: str
    required_units: List[int]
    units: Optional[List[int]] = None
    is_finalized: bool = False
    total_enrolled: int
    completed_count: int
    provisional_count: int
    rankings: List[StudentRankingItem]


class LeaderboardEntry(BaseModel):
    """Privacy-safe leaderboard entry."""
    rank: int
    display_name: str  # 'You' if viewer is this student, or 'Student #N' if anonymous, or real name if teacher
    percentage: float
    units_completed: int
    is_self: bool = False


class LeaderboardResponse(BaseModel):
    """Privacy-aware leaderboard."""
    class_id: int
    class_name: str
    subject: str
    total_participants: int
    leaderboard: List[LeaderboardEntry]


class GradeDistribution(BaseModel):
    """Counts of letter grades across completed/provisional results."""
    grade_a: int = 0  # >= 90%
    grade_b: int = 0  # 80-89%
    grade_c: int = 0  # 70-79%
    grade_d: int = 0  # 60-69%
    grade_f: int = 0  # < 60%


class UnitComparison(BaseModel):
    """Unit aggregate metrics."""
    unit: int
    assignment_title: str
    title: Optional[str] = None
    max_marks: float
    average_score: Optional[float] = None
    average_percentage: Optional[float] = None
    submission_count: int
    released_count: int
    graded_count: Optional[int] = None


class ClassOverviewResponse(BaseModel):
    """Comprehensive class-level analytics."""
    class_id: int
    class_name: str
    subject: str
    total_students: int
    total_assignments: int
    class_average: Optional[float] = None
    class_average_percentage: Optional[float] = None
    submission_compliance_rate: float = 0.0
    distribution: GradeDistribution
    grade_distribution: Optional[Dict[str, int]] = None
    unit_comparisons: List[UnitComparison]
    pending_submissions_count: int
    unreleased_grades_count: int


class AtRiskStudent(BaseModel):
    """Student requiring academic intervention."""
    student_id: int
    student_name: str
    student_email: Optional[str] = None
    provisional_percentage: Optional[float] = None
    missing_units_count: int
    reason: str


class TeacherAlertsResponse(BaseModel):
    """Alerts for teacher intervention and backlog management."""
    class_id: int
    class_name: str
    at_risk_students: List[AtRiskStudent]
    ungraded_count: int
    unreleased_count: int
    overdue_assignments: List[str]


class StudentFeedbackItem(BaseModel):
    """Private feedback item for a student."""
    unit: int
    assignment_title: str
    grade: Optional[float] = None
    max_marks: float
    feedback: Optional[str] = None
    is_late: bool = False
    status: str
