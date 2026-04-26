"""Background jobs for transaction reminders and overdue checks."""

from datetime import datetime, timedelta

from ..db.session import SessionLocal
from ..models.transaction import Transaction
from .live_data_service import refresh_live_events
from .notification_service import (
    build_generic_notification_email,
    create_notification_with_email,
)
from .transaction_service import apply_overdue_rules

REMINDER_MESSAGE = "Reminder: Payment due in 2 days"
OVERDUE_MESSAGE = "Payment overdue — please take action"


def run_daily_transaction_job():
    """Send reminder notifications and mark overdue transactions daily."""
    db = SessionLocal()
    try:
        today = datetime.now().date()
        reminder_cutoff = today + timedelta(days=2)

        pending_transactions = (
            db.query(Transaction).filter(Transaction.status == "pending").all()
        )

        for transaction in pending_transactions:
            due_date = transaction.due_date.date()

            if today <= due_date <= reminder_cutoff:
                email_subject, email_message = build_generic_notification_email(
                    REMINDER_MESSAGE,
                    "warning",
                )
                create_notification_with_email(
                    db,
                    user_id=transaction.company_id,
                    transaction_id=transaction.id,
                    message=REMINDER_MESSAGE,
                    notification_type="warning",
                    email_subject=email_subject,
                    email_message=email_message,
                )

        overdue_transactions = (
            db.query(Transaction).filter(Transaction.status != "paid").all()
        )

        for transaction in overdue_transactions:
            if transaction.due_date.date() < today:
                apply_overdue_rules(
                    db,
                    transaction,
                    overdue_message=OVERDUE_MESSAGE,
                )

        db.commit()
    finally:
        db.close()


def run_live_event_refresh_job():
    """Refresh weather, traffic, and disruption events for route analysis."""

    db = SessionLocal()
    try:
        refresh_live_events(db)
    finally:
        db.close()
