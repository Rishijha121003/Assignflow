import secrets
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def generate_join_code(length: int = 7) -> str:
    """
    Generates a cryptographically secure, non-guessable alphanumeric join code.
    Excludes ambiguous characters (0, O, 1, I) to ensure ease of entry.
    """
    charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(charset) for _ in range(length))


class Class(Base):
    """
    SQLAlchemy model representing a class/course created by a Teacher.
    Stored in PostgreSQL under the 'assignflow' schema.
    """
    __tablename__ = "classes"
    __table_args__ = {"schema": "assignflow"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    join_code = Column(String(12), unique=True, index=True, nullable=False)

    teacher_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    semester_id = Column(
        Integer,
        ForeignKey("assignflow.semesters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    teacher = relationship("User", backref="taught_classes")
    semester = relationship("Semester", back_populates="classes")
    assignments = relationship("Assignment", back_populates="classroom", cascade="all, delete-orphan")
    enrollments = relationship("ClassEnrollment", back_populates="classroom", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="classroom", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Class(id={self.id}, name='{self.name}', join_code='{self.join_code}', teacher_id={self.teacher_id}, semester_id={self.semester_id})>"


class ClassEnrollment(Base):
    """
    SQLAlchemy model representing a student's enrollment in a class.
    Stored in PostgreSQL under the 'assignflow' schema.
    """
    __tablename__ = "class_enrollments"
    __table_args__ = (
        UniqueConstraint("class_id", "student_id", name="uq_class_student"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    class_id = Column(
        Integer,
        ForeignKey("assignflow.classes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    enrolled_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    classroom = relationship("Class", back_populates="enrollments")
    student = relationship("User", backref="enrolled_classes")

    def __repr__(self) -> str:
        return f"<ClassEnrollment(id={self.id}, class_id={self.class_id}, student_id={self.student_id})>"


class Subject(Base):
    """
    SQLAlchemy model representing a subject created and associated with a specific Class.
    Stored in PostgreSQL under the 'assignflow' schema.
    """
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("class_id", "name", name="uq_class_subject_name"),
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    class_id = Column(
        Integer,
        ForeignKey("assignflow.classes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    classroom = relationship("Class", back_populates="subjects")

    def __repr__(self) -> str:
        return f"<Subject(id={self.id}, name='{self.name}', class_id={self.class_id})>"

