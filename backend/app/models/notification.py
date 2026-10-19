from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class Notification(Base):
    """
    In-app notification for important academic events (grade released, deadline, extension, decision).
    """
    __tablename__ = "notifications"
    __table_args__ = (
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, default="general")  # grade_released, deadline_extension, resubmission, reevaluation, alert
    link_url = Column(String(300), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", backref="notifications")


class NotificationPreference(Base):
    """
    Persisted user notification preferences for in-app and email channels.
    """
    __tablename__ = "notification_preferences"
    __table_args__ = (
        {"schema": "assignflow"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("assignflow.users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=False, nullable=False)
    email_on_grade_released = Column(Boolean, default=True, nullable=False)
    email_on_deadline = Column(Boolean, default=True, nullable=False)
    email_on_reevaluation = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="notification_preference")
