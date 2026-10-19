from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    Boolean,
    ForeignKey,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class Semester(Base):
    """
    SQLAlchemy model representing an Academic Semester (e.g., Semester 5, Jul - Dec 2024).
    Stored in PostgreSQL under the 'assignflow' schema.
    """
    __tablename__ = "semesters"
    __table_args__ = (
        CheckConstraint("start_date <= end_date", name="chk_semester_dates"),
        CheckConstraint("status IN ('active', 'completed', 'archived')", name="chk_semester_status"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    academic_year = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(30), nullable=False, default="active")
    program = Column(String(100), nullable=True, default="B.Tech CSE")

    teacher_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Finalization tracking
    is_finalized = Column(Boolean, nullable=False, default=False)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    finalized_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    teacher = relationship("User", foreign_keys=[teacher_id], backref="owned_semesters")
    finalized_by = relationship("User", foreign_keys=[finalized_by_id])
    classes = relationship("Class", back_populates="semester")

    def __repr__(self) -> str:
        return f"<Semester(id={self.id}, name='{self.name}', academic_year='{self.academic_year}', status='{self.status}')>"
