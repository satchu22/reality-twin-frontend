"""Notification ORM model for in-app alerts."""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from ..db.base import Base


class Notification(Base):
    """Stores notifications generated for a user."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    transaction_id = Column(Integer, nullable=True, index=True)
    message = Column(String, nullable=False)
    type = Column(String, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
