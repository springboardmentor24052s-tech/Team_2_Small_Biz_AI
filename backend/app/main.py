import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .database import engine, SessionLocal
from . import models
from .migrate import ensure_business_id_columns
from .seed_data import seed_if_empty
from . import models

# Initialize database tables
models.Base.metadata.create_all(bind=engine)

# Run lightweight migrations for multi-tenant setup
ensure_business_id_columns(engine)
from .routers import (
    auth, customers, inventory, sales, invoices, analytics, 
    categories, suppliers, datasets, users, ai, revenue, notifications,
    forecasting, segmentation
)

app = FastAPI(
    title="MarketMind AI",
    description="Small Business Sales Intelligence Platform - API",
    version="1.0.0",
)

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
app.include_router(forecasting.router)
app.include_router(segmentation.router)
app.include_router(notifications.router)



@app.on_event("startup")
def startup_seed():
    if os.getenv("SEED_DEMO_DATA", "false").lower() != "true":
        return  # real-data mode: skip demo seeding entirely
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    _start_cache_warmup()


def _start_cache_warmup() -> None:
    """Pre-compute per-business KPIs + AI results on a background thread.

    Every Neon round-trip costs ~1s, so the first request after a restart used
    to pay that for EACH endpoint (KPIs, forecast, segmentation, ...). Warming
    the shared TTL caches here means real users hit warm caches immediately.
    Never blocks startup; failures are swallowed per business.
    """
    from types import SimpleNamespace

    from .cache import get_or_set
    from .routers import ai, analytics, notifications as notif_router

    def _warm() -> None:
        db = SessionLocal()
        try:
            bids = [r[0] for r in db.query(models.Business.id).all()]
        finally:
            db.close()

        for bid in bids:
            try:
                wdb = SessionLocal()
                try:
                    fake = SimpleNamespace(business_id=bid)
                    get_or_set(
                        f"analytics:{bid}:kpis",
                        300,
                        lambda: analytics._compute_kpis(wdb, bid),
                    )
                    ai.get_sales_forecast(horizon_days=14, db=wdb, current_user=fake)
                    ai.get_sales_forecast(horizon_days=30, db=wdb, current_user=fake)
                    ai.get_customer_segmentation(db=wdb, current_user=fake)
                    ai.get_churn_predictions(db=wdb, current_user=fake)
                    ai.get_product_recommendations(db=wdb, current_user=fake)
                    ai.get_anomaly_alerts(db=wdb, current_user=fake)
                    notif_router._sync_notifications(wdb, bid)
                finally:
                    wdb.close()
            except Exception:
                pass

    threading.Thread(target=_warm, daemon=True).start()


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "MarketMind AI API is running. Visit /docs for interactive API documentation.",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
