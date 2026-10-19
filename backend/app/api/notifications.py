from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.notification import Notification, NotificationPreference
from app.models.user import User
from app.schemas.workflow import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
)
from app.services.notification_service import get_or_create_preferences

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationResponse], summary="Get current user's notifications")
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return notifications


@router.put("/{id}/read", response_model=NotificationResponse, summary="Mark notification as read")
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(Notification.id == id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.put("/read-all", summary="Mark all notifications as read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update(
        {"is_read": True}
    )
    db.commit()
    return {"message": "All notifications marked as read"}


@router.get("/preferences", response_model=NotificationPreferenceResponse, summary="Get notification preferences")
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_or_create_preferences(db, current_user.id)


@router.put("/preferences", response_model=NotificationPreferenceResponse, summary="Update notification preferences")
def update_preferences(
    payload: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_preferences(db, current_user.id)
    if payload.in_app_enabled is not None:
        pref.in_app_enabled = payload.in_app_enabled
    if payload.email_enabled is not None:
        pref.email_enabled = payload.email_enabled
    if payload.email_on_grade_released is not None:
        pref.email_on_grade_released = payload.email_on_grade_released
    if payload.email_on_deadline is not None:
        pref.email_on_deadline = payload.email_on_deadline
    if payload.email_on_reevaluation is not None:
        pref.email_on_reevaluation = payload.email_on_reevaluation

    db.commit()
    db.refresh(pref)
    return pref
