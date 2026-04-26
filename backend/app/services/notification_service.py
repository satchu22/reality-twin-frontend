"""Business logic for creating and managing notifications."""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.notification import Notification
from .realtime_service import broadcast_event
from .email_service import resolve_user_email, send_email


def build_payment_reminder_email(amount: float, due_date: str) -> tuple[str, str]:
    """Build the payment reminder email subject and body."""

    return (
        "Payment Reminder",
        f"You have a pending payment of ${amount} due on {due_date}",
    )


def build_generic_notification_email(
    message: str, notification_type: str
) -> tuple[str, str]:
    """Build a generic email subject/body for a notification."""

    subject_map = {
        "info": "Notification Update",
        "warning": "Warning Notification",
        "critical": "Critical Notification",
    }
    return subject_map.get(notification_type, "Notification Update"), message


def create_notification_with_email(
    db: Session,
    *,
    user_id: int,
    transaction_id: int | None = None,
    message: str,
    notification_type: str,
    email_subject: str | None = None,
    email_message: str | None = None,
) -> Notification:
    """Persist a notification and send an email if an address is configured."""

    notification = Notification(
        user_id=user_id,
        transaction_id=transaction_id,
        message=message,
        type=notification_type,
    )
    db.add(notification)
    db.flush()

    recipient_email = resolve_user_email(user_id)
    if recipient_email:
        subject = email_subject or build_generic_notification_email(
            message, notification_type
        )[0]
        body = email_message or build_generic_notification_email(
            message, notification_type
        )[1]
        send_email(recipient_email, subject, body)

    return notification


def broadcast_notification_event(notification: Notification) -> None:
    """Broadcast a notification payload to connected clients."""

    broadcast_event(
        "notification",
        {
            "id": notification.id,
            "user_id": notification.user_id,
            "transaction_id": notification.transaction_id,
            "message": notification.message,
            "type": notification.type,
            "is_read": notification.is_read,
            "created_at": (
                notification.created_at.isoformat()
                if notification.created_at
                else datetime.now().isoformat()
            ),
        },
    )


def list_notifications(db: Session, *, user_id: int) -> list[Notification]:
    """Return notifications for one user ordered newest first."""

    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )


def create_manual_notification(
    db: Session,
    *,
    user_id: int,
    message: str,
    notification_type: str,
) -> Notification:
    """Create the same manual notification flow the monolith used."""

    email_subject, email_message = build_generic_notification_email(
        message,
        notification_type,
    )
    notification = create_notification_with_email(
        db,
        user_id=user_id,
        message=message,
        notification_type=notification_type,
        email_subject=email_subject,
        email_message=email_message,
    )
    db.commit()
    db.refresh(notification)
    broadcast_notification_event(notification)
    return notification


def mark_notification_as_read(db: Session, *, notification_id: int) -> Notification:
    """Mark one notification as read or raise a 404."""

    notification = (
        db.query(Notification).filter(Notification.id == notification_id).first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    broadcast_notification_event(notification)
    return notification
