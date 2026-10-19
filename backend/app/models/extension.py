from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class DeadlineExtension(Base):
    """
    Per-student deadline extension granted by a teacher for an assignment.
    Allows an authorized teacher to set an extended due date and reason.
    """
    __tablename__ = "deadline_extensions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_extension_assignment_student"),
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
    extended_due_date = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=True)
    granted_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    assignment = relationship("Assignment", backref="deadline_extensions")
    student = relationship("User", foreign_keys=[student_id])
    granted_by = relationship("User", foreign_keys=[granted_by_id])
