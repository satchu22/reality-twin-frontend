"""Notification endpoints with logic delegated to notification services."""

from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from ...db.session import get_db
from ...schemas.notification import NotificationCreate, NotificationResponse
from ...services.notification_service import (
    create_manual_notification,
    list_notifications,
    mark_notification_as_read,
)

router = APIRouter(tags=["notifications"])


@router.get("/", response_model=list[NotificationResponse])
def get_notifications(user_id: int, db: Session = Depends(get_db)):
    """Return notifications for one user."""

    return list_notifications(db, user_id=user_id)


@router.post("/", response_model=NotificationResponse)
def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
):
    """Create a manual notification."""

    return create_manual_notification(
        db,
        user_id=data.user_id,
        message=data.message,
        notification_type=data.type,
    )


@router.patch("/{id}/read", response_model=NotificationResponse)
def read_notification(id: int, db: Session = Depends(get_db)):
    """Mark a notification as read."""

    return mark_notification_as_read(db, notification_id=id)
