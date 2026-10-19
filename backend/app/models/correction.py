from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class GradeCorrection(Base):
    """
    Audit log record for authorized grade corrections.
    Records previous/new marks, feedback, reason, actor, and timestamp.
    """
    __tablename__ = "grade_corrections"
    __table_args__ = (
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(
        Integer,
        ForeignKey("assignflow.submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_grade = Column(Float, nullable=True)
    new_grade = Column(Float, nullable=False)
    previous_feedback = Column(Text, nullable=True)
    new_feedback = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    changed_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    submission = relationship("Submission", backref="grade_corrections")
    changed_by = relationship("User", foreign_keys=[changed_by_id])


class SubmissionHistory(Base):
    """
    Preserved history archive of previous submission attempts before a teacher-authorized resubmission.
    Ensures zero data loss when students submit revisions.
    """
    __tablename__ = "submission_history"
    __table_args__ = (
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(
        Integer,
        ForeignKey("assignflow.submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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
    attempt_number = Column(Integer, nullable=False, default=1)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=False)
    is_late = Column(Boolean, default=False, nullable=False)
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="submitted")
    archived_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    submission = relationship("Submission", backref="history")
