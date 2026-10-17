from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class ReevaluationRequest(Base):
    """
    Student re-evaluation request for an already released grade.
    Records student reason, teacher decision (approve/reject), optional revised grade, and outcome.
    """
    __tablename__ = "reevaluation_requests"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="chk_reevaluation_status"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(
        Integer,
        ForeignKey("assignflow.submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, rejected
    decision_notes = Column(Text, nullable=True)
    previous_grade = Column(Float, nullable=True)
    revised_grade = Column(Float, nullable=True)
    decided_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    submission = relationship("Submission", backref="reevaluation_requests")
    student = relationship("User", foreign_keys=[student_id])
    decided_by = relationship("User", foreign_keys=[decided_by_id])
