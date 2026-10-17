import email.utils
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import Notification, NotificationPreference
from app.models.user import User

logger = logging.getLogger("assignflow.notifications")


def get_or_create_preferences(db: Session, user_id: int) -> NotificationPreference:
    """Retrieves or creates default notification preferences for a user."""
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if not pref:
        pref = NotificationPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def send_email_safe(recipient_email: str, subject: str, body_text: str) -> bool:
    """
    Safely sends an email using SMTP if configured.
    If unconfigured or if connection fails, logs warning without crashing the request.
    """
    if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        logger.info(
            "SMTP is unconfigured (SMTP_HOST is empty). Simulated email to %s: [%s] %s",
            recipient_email,
            subject,
            body_text,
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = email.utils.formataddr((settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL))
        msg["To"] = recipient_email
        msg.attach(MIMEText(body_text, "plain", "utf-8"))

        if settings.SMTP_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM_EMAIL, [recipient_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM_EMAIL, [recipient_email], msg.as_string())
        return True
    except Exception as exc:
        logger.warning("Failed to send email to %s via %s: %s", recipient_email, settings.SMTP_HOST, exc)
        return False


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notif_type: str,
    link: Optional[str] = None,
) -> Notification:
    """
    Persists an in-app notification and attempts email notification if user preference permits.
    """
    prefs = get_or_create_preferences(db, user_id)

    if not prefs.in_app_enabled:
        return None

    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        link_url=link,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Check email preference
    should_email = prefs.email_enabled
    if notif_type == "grade_released" and not prefs.email_on_grade_released:
        should_email = False
    elif notif_type in ("deadline_extension", "deadline_reminder") and not prefs.email_on_deadline:
        should_email = False
    elif notif_type in ("reevaluation_requested", "reevaluation_decision") and not prefs.email_on_reevaluation:
        should_email = False

    if should_email:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.email:
            send_email_safe(user.email, f"[AssignFlow] {title}", message)

    return notification
