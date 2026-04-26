"""Business logic for creating, listing, and paying transactions."""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.notification import Notification
from ..models.transaction import Transaction
from .notification_service import (
    broadcast_notification_event,
    build_generic_notification_email,
    build_payment_reminder_email,
    create_notification_with_email,
)
from .realtime_service import broadcast_event


def _create_notification_if_missing(
    db: Session,
    *,
    user_id: int,
    transaction_id: int | None = None,
    message: str,
    notification_type: str,
):
    """Avoid duplicate notifications when transaction jobs run repeatedly."""

    existing_notification = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.transaction_id == transaction_id,
            Notification.message == message,
            Notification.type == notification_type,
        )
        .first()
    )

    if existing_notification:
        return existing_notification, False

    email_subject = None
    email_message = None
    if notification_type == "info" and message.startswith("New payment of $"):
        due_date = message.split(" due on ", maxsplit=1)[-1]
        amount = float(
            message.split("$", maxsplit=1)[-1].split(" created", maxsplit=1)[0]
        )
        email_subject, email_message = build_payment_reminder_email(amount, due_date)
    else:
        email_subject, email_message = build_generic_notification_email(
            message, notification_type
        )

    return (
        create_notification_with_email(
            db,
            user_id=user_id,
            transaction_id=transaction_id,
            message=message,
            notification_type=notification_type,
            email_subject=email_subject,
            email_message=email_message,
        ),
        True,
    )


def _broadcast_transaction_status(transaction: Transaction) -> None:
    """Broadcast transaction status changes to all connected clients."""

    broadcast_event(
        "transaction_update",
        {
            "transaction": {
                "id": transaction.id,
                "company_id": transaction.company_id,
                "amount": transaction.amount,
                "status": transaction.status,
                "due_date": transaction.due_date.isoformat(),
                "description": transaction.description,
                "created_at": transaction.created_at.isoformat(),
            }
        },
    )


def _new_payment_message(transaction: Transaction) -> str:
    """Build the transaction-created notification message."""

    return (
        f"New payment of ${transaction.amount} created, due on "
        f"{transaction.due_date.date().isoformat()}"
    )


def _overdue_message() -> str:
    """Return the canonical overdue message."""

    return "Payment overdue — please take action"


def apply_overdue_rules(
    db: Session,
    transaction: Transaction,
    *,
    overdue_message: str | None = None,
) -> tuple[Transaction, Notification | None]:
    """Keep transaction status and overdue notifications in sync."""

    if transaction.status == "paid":
        return transaction, None

    if transaction.due_date >= datetime.now():
        return transaction, None

    message = overdue_message or _overdue_message()
    transaction.status = "overdue"
    notification, created_notification = _create_notification_if_missing(
        db,
        user_id=transaction.company_id,
        transaction_id=transaction.id,
        message=message,
        notification_type="critical",
    )
    return transaction, notification if created_notification else None


def create_transaction_with_events(
    db: Session,
    *,
    company_id: int,
    amount: float,
    status: str,
    due_date: datetime,
    description: str,
) -> Transaction:
    """Create a transaction and fire the same side effects as before."""

    transaction = Transaction(
        company_id=company_id,
        amount=amount,
        status=status,
        due_date=due_date,
        description=description,
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    new_payment_notification, created_notification = _create_notification_if_missing(
        db,
        user_id=transaction.company_id,
        transaction_id=transaction.id,
        message=_new_payment_message(transaction),
        notification_type="info",
    )

    _, overdue_notification = apply_overdue_rules(db, transaction)

    db.commit()
    db.refresh(transaction)
    if created_notification:
        db.refresh(new_payment_notification)
        broadcast_notification_event(new_payment_notification)
    if overdue_notification is not None:
        db.refresh(overdue_notification)
        broadcast_notification_event(overdue_notification)
    _broadcast_transaction_status(transaction)
    return transaction


def list_transactions(db: Session) -> list[Transaction]:
    """List transactions and keep overdue states current."""

    transactions = db.query(Transaction).order_by(Transaction.created_at.desc()).all()
    sync_transaction_overdue_state(db, transactions)
    return db.query(Transaction).order_by(Transaction.created_at.desc()).all()


def pay_transaction(db: Session, *, transaction_id: int) -> Transaction:
    """Mark one transaction as paid or raise a 404."""

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction.status = "paid"
    db.commit()
    db.refresh(transaction)
    _broadcast_transaction_status(transaction)
    return transaction


def sync_transaction_overdue_state(
    db: Session, transactions: list[Transaction]
) -> list[Transaction]:
    """Apply overdue state changes across a list of transactions."""

    has_updates = False
    updated_transactions: list[Transaction] = []
    created_overdue_notifications: list[Notification] = []

    for transaction in transactions:
        previous_status = transaction.status
        _, overdue_notification = apply_overdue_rules(db, transaction)
        if transaction.status != previous_status:
            has_updates = True
            updated_transactions.append(transaction)
            if overdue_notification is not None:
                created_overdue_notifications.append(overdue_notification)

    if has_updates:
        db.commit()
        for notification in created_overdue_notifications:
            db.refresh(notification)
            broadcast_notification_event(notification)
        for transaction in updated_transactions:
            db.refresh(transaction)
            _broadcast_transaction_status(transaction)

    return transactions
