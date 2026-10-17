from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class FinalizedResult(Base):
    """
    Teacher-reviewed and explicitly finalized combined results for a class & subject.
    Captures required-units configuration, finalizing teacher, timestamp, and audit summary.
    """
    __tablename__ = "finalized_results"
    __table_args__ = (
        UniqueConstraint("class_id", "subject", name="uq_finalized_class_subject"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    class_id = Column(
        Integer,
        ForeignKey("assignflow.classes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject = Column(String(100), nullable=False)
    required_units = Column(String(200), nullable=False)  # Comma-separated unit numbers, e.g. "1,2,3"
    results_summary = Column(Text, nullable=True)  # JSON-serialized audit snapshot of scores and ranks
    finalized_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    finalized_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    classroom = relationship("Class", backref="finalized_results")
    finalized_by = relationship("User", foreign_keys=[finalized_by_id])
