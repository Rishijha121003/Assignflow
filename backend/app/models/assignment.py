from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, CheckConstraint, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class Assignment(Base):
    """
    SQLAlchemy model representing an assignment created for students.
    Stored in PostgreSQL under the 'assignflow' schema.
    """
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint("max_marks > 0", name="chk_assignment_max_marks"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), nullable=False, default="active")
    max_marks = Column(Float, nullable=False, default=100.0)

    # Author/Teacher association
    created_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    creator = relationship("User", backref="assignments")

    # Class association
    class_id = Column(
        Integer,
        ForeignKey("assignflow.classes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    classroom = relationship("Class", back_populates="assignments")

    # Attachment metadata (Teacher-uploaded question PDF)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @property
    def class_name(self) -> str | None:
        return self.classroom.name if self.classroom else None

    def __repr__(self) -> str:
        return f"<Assignment(id={self.id}, title='{self.title}', subject='{self.subject}', status='{self.status}', file='{self.file_name}')>"
