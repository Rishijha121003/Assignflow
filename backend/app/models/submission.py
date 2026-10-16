from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Float,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class Submission(Base):
    """
    SQLAlchemy model representing a student's submission for an assignment.
    Stored in PostgreSQL under the 'assignflow' schema.
    Enforces one submission per student per assignment in this initial version.
    """
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_assignment_student"),
        CheckConstraint("grade IS NULL OR grade >= 0", name="chk_grade_positive"),
        CheckConstraint("status IN ('submitted', 'graded', 'released')", name="chk_submission_status"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    assignment_id = Column(
        Integer,
        ForeignKey("assignflow.assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_late = Column(Boolean, default=False, nullable=False)

    # Grading fields
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    status = Column(String(20), default="submitted", nullable=False)  # submitted, graded, released
    graded_at = Column(DateTime(timezone=True), nullable=True)
    graded_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    released_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    assignment = relationship("Assignment", backref="submissions")
    student = relationship("User", foreign_keys=[student_id], backref="submissions")
    grader = relationship("User", foreign_keys=[graded_by_id])

    @property
    def student_name(self) -> str:
        return self.student.full_name if self.student else ""

    @property
    def student_email(self) -> str:
        return self.student.email if self.student else ""

    def __repr__(self) -> str:
        return f"<Submission(id={self.id}, assignment_id={self.assignment_id}, student_id={self.student_id}, is_late={self.is_late})>"
