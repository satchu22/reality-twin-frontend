"""FastAPI application assembly for the modular backend."""

import asyncio
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import ai, auth, notifications, realtime, routes, simulate, transactions
from .core.config import settings
from .db.base import Base
from .db.session import SessionLocal, engine
from .services.live_data_service import refresh_live_events
from .services.seed_service import seed_local_data
from .services.scheduler_service import (
    run_daily_transaction_job,
    run_live_event_refresh_job,
)
from .services.realtime_service import realtime_manager
from . import models  # noqa: F401

scheduler = BackgroundScheduler(daemon=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start and stop background jobs with the application lifecycle."""

    realtime_manager.set_event_loop(asyncio.get_running_loop())
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_local_data(db)
        refresh_live_events(db)
    finally:
        db.close()

    scheduler.add_job(
        run_daily_transaction_job,
        "cron",
        id="daily-transaction-reminder-job",
        hour=settings.TRANSACTION_REMINDER_HOUR,
        minute=settings.TRANSACTION_REMINDER_MINUTE,
        replace_existing=True,
    )
    scheduler.add_job(
        run_live_event_refresh_job,
        "interval",
        id="live-event-refresh-job",
        minutes=settings.LIVE_EVENT_REFRESH_MINUTES,
        replace_existing=True,
    )
    scheduler.start()

    try:
        yield
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.include_router(simulate.router, prefix="/simulate")
app.include_router(ai.router, prefix="/ai")
app.include_router(transactions.router, prefix="/transactions")
app.include_router(notifications.router, prefix="/notifications")
app.include_router(auth.router, prefix="/auth")
app.include_router(realtime.router)
