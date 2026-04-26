"""Transaction ORM model for payment records."""

from sqlalchemy import Column, DateTime, Float, Integer, String, func

from ..db.base import Base


class Transaction(Base):
    """Stores the payment lifecycle for a company transaction."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    due_date = Column(DateTime, nullable=False)
    description = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
