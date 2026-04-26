"""Transaction endpoints with all business logic delegated to services."""

from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from ...db.session import get_db
from ...schemas.transaction import TransactionCreate, TransactionResponse
from ...services.transaction_service import (
    create_transaction_with_events,
    list_transactions,
    pay_transaction,
)

router = APIRouter(tags=["transactions"])


@router.post("/", response_model=TransactionResponse)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
):
    """Create a transaction and emit the same side effects as before."""

    return create_transaction_with_events(
        db,
        company_id=data.company_id,
        amount=data.amount,
        status=data.status,
        due_date=data.due_date,
        description=data.description,
    )


@router.get("/", response_model=list[TransactionResponse])
def get_transactions(db: Session = Depends(get_db)):
    """List transactions in reverse chronological order."""

    return list_transactions(db)


@router.patch("/{id}/pay", response_model=TransactionResponse)
def mark_transaction_as_paid(id: int, db: Session = Depends(get_db)):
    """Mark a transaction as paid."""

    return pay_transaction(db, transaction_id=id)
