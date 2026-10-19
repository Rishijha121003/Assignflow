from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, CheckConstraint, UniqueConstraint, func
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
        UniqueConstraint("class_id", "subject", "unit", name="uq_class_subject_unit"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), nullable=False, default="active")
    max_marks = Column(Float, nullable=False, default=100.0)
    unit = Column(Integer, nullable=False, default=1)
    grace_period_minutes = Column(Integer, nullable=False, default=0)
    allow_late = Column(Boolean, nullable=False, default=True)
    late_penalty_percent = Column(Float, nullable=False, default=0.0)

    # Author/Teacher association
    created_by_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    creator = relationship("User", backref="assignments")

    # Class and Semester association
    class_id = Column(
        Integer,
        ForeignKey("assignflow.classes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    classroom = relationship("Class", back_populates="assignments")

    semester_id = Column(
        Integer,
        ForeignKey("assignflow.semesters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    semester = relationship("Semester", backref="assignments")

    subject_id = Column(
        Integer,
        ForeignKey("assignflow.subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    subject_ref = relationship("Subject", backref="assignments")

    assignment_type = Column(String(50), nullable=False, default="Assignment")
    resubmission_policy = Column(String(50), nullable=False, default="approval_only")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan", passive_deletes=True)

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

    @property
    def submission_count(self) -> int:
        return len(self.submissions) if self.submissions else 0

    @property
    def total_students(self) -> int:
        return len(self.classroom.enrollments) if self.classroom and self.classroom.enrollments else 0

    def __repr__(self) -> str:
        return f"<Assignment(id={self.id}, title='{self.title}', subject='{self.subject}', status='{self.status}', file='{self.file_name}')>"
