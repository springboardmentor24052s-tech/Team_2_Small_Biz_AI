import os
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .database import engine, SessionLocal
from . import models
from .seed_data import seed_if_empty

from .routers import (
    auth,
    customers,
    inventory,
    sales,
    invoices,
    analytics,
    categories,
    suppliers,
    datasets,
    users,
    ai,
    revenue,
    notifications,
)


# --------------------------------------------------
# DATABASE INITIALIZATION
# --------------------------------------------------

# Create tables that do not already exist.
#
# IMPORTANT:
# Database schema changes/migrations should be handled
# using Alembic manually:
#
#     alembic upgrade head
#
# We do NOT run Alembic automatically during every
# application startup.
models.Base.metadata.create_all(bind=engine)


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="MarketMind AI",
    description="Small Business Sales Intelligence Platform - API",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ROUTERS
# --------------------------------------------------

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(invoices.router)
app.include_router(analytics.router)
app.include_router(categories.router)
app.include_router(suppliers.router)
app.include_router(datasets.router)
app.include_router(users.router)
app.include_router(ai.router)
app.include_router(revenue.router)
app.include_router(notifications.router)


# --------------------------------------------------
# STARTUP
# --------------------------------------------------

@app.on_event("startup")
def startup_seed():
    """
    Seed demo data only when explicitly enabled.

    Set:
        SEED_DEMO_DATA=true

    to enable demo-data seeding.
    """

    if os.getenv("SEED_DEMO_DATA", "false").lower() != "true":
        return

    db = SessionLocal()

    try:
        seed_if_empty(db)
    finally:
        db.close()

    _start_cache_warmup()


# --------------------------------------------------
# CACHE WARMUP
# --------------------------------------------------

def _start_cache_warmup() -> None:
    """
    Pre-compute per-business KPIs and AI results
    in a background thread.

    This does NOT block application startup.
    """

    from types import SimpleNamespace

    from .cache import get_or_set
    from .routers import (
        ai,
        analytics,
        notifications as notif_router,
    )

    def _warm() -> None:
        db = SessionLocal()

        try:
            bids = [
                row[0]
                for row in db.query(models.Business.id).all()
            ]
        finally:
            db.close()

        for bid in bids:
            try:
                wdb = SessionLocal()

                try:
                    fake = SimpleNamespace(
                        business_id=bid
                    )

                    # ------------------------------------------
                    # KPI CACHE
                    # ------------------------------------------

                    get_or_set(
                        f"analytics:{bid}:kpis",
                        300,
                        lambda: analytics._compute_kpis(
                            wdb,
                            bid,
                        ),
                    )

                    # ------------------------------------------
                    # AI CACHE WARMUP
                    # ------------------------------------------

                    ai.get_sales_forecast(
                        horizon_days=14,
                        db=wdb,
                        current_user=fake,
                    )

                    ai.get_sales_forecast(
                        horizon_days=30,
                        db=wdb,
                        current_user=fake,
                    )

                    ai.get_customer_segmentation(
                        db=wdb,
                        current_user=fake,
                    )

                    ai.get_churn_predictions(
                        db=wdb,
                        current_user=fake,
                    )

                    ai.get_product_recommendations(
                        db=wdb,
                        current_user=fake,
                    )

                    ai.get_anomaly_alerts(
                        db=wdb,
                        current_user=fake,
                    )

                    # ------------------------------------------
                    # NOTIFICATIONS
                    # ------------------------------------------

                    notif_router._sync_notifications(
                        wdb,
                        bid,
                    )

                finally:
                    wdb.close()

            except Exception:
                # Cache warmup should never prevent
                # the application from running.
                pass

    threading.Thread(
        target=_warm,
        daemon=True,
    ).start()


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": (
            "MarketMind AI API is running. "
            "Visit /docs for interactive API documentation."
        ),
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }