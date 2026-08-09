import datetime as dt
from collections import defaultdict
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sqlalchemy.orm import Session

from .. import models


def _build_daily_series(db: Session) -> pd.DataFrame:
    sales = db.query(models.Sale).order_by(models.Sale.sale_date.asc()).all()
    daily = defaultdict(float)
    for s in sales:
        daily[s.sale_date.date()] = daily[s.sale_date.date()] + s.total_amount
    if not daily:
        return pd.DataFrame(columns=["date", "revenue"])
    dates = sorted(daily.keys())
    full_range = pd.date_range(dates[0], dates[-1], freq="D")
    df = pd.DataFrame({"date": full_range})
    df["revenue"] = df["date"].dt.date.map(daily).fillna(0.0)
    return df


def run_forecast(db: Session, horizon_days: int = 14) -> dict:
    df = _build_daily_series(db)
    if len(df) < 5:
        return {
            "history": [],
            "forecast": [],
            "trend": "insufficient_data",
            "growth_pct": 0.0,
            "mae": None,
            "rmse": None,
            "r2": None,
        }

    df = df.reset_index(drop=True)
    df["t"] = np.arange(len(df))
    X = df[["t"]].values
    y = df["revenue"].values

    # Train/test split (last 20% held out) to report quantitative model performance metrics.
    split_idx = max(1, int(len(df) * 0.8))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    if len(X_train) >= 3:
        eval_model = RandomForestRegressor(n_estimators=200, random_state=42, max_depth=6).fit(X_train, y_train)
    else:
        eval_model = LinearRegression().fit(X_train, y_train)

    mae = rmse = r2 = None
    if len(X_test) > 0:
        preds_test = eval_model.predict(X_test)
        mae = float(mean_absolute_error(y_test, preds_test))
        rmse = float(np.sqrt(mean_squared_error(y_test, preds_test)))
        r2 = float(r2_score(y_test, preds_test)) if len(y_test) > 1 else None

    # Refit on full history for the actual forward forecast.
    final_model = RandomForestRegressor(n_estimators=200, random_state=42, max_depth=6).fit(X, y)
    future_t = np.arange(len(df), len(df) + horizon_days).reshape(-1, 1)
    future_preds = final_model.predict(future_t)
    future_preds = np.clip(future_preds, 0, None)

    last_date = df["date"].iloc[-1]
    forecast_points = []
    for i, val in enumerate(future_preds, start=1):
        period = (last_date + dt.timedelta(days=i)).strftime("%Y-%m-%d")
        forecast_points.append({"period": period, "predicted_revenue": round(float(val), 2)})

    recent_avg = float(np.mean(y[-7:])) if len(y) >= 7 else float(np.mean(y))
    future_avg = float(np.mean(future_preds)) if len(future_preds) else recent_avg
    growth_pct = round(((future_avg - recent_avg) / recent_avg) * 100, 2) if recent_avg > 0 else 0.0
    trend = "increasing" if growth_pct > 2 else ("decreasing" if growth_pct < -2 else "stable")

    history = [
        {"date": row["date"].strftime("%Y-%m-%d"), "revenue": round(float(row["revenue"]), 2)}
        for _, row in df.tail(60).iterrows()
    ]

    return {
        "history": history,
        "forecast": forecast_points,
        "trend": trend,
        "growth_pct": growth_pct,
        "mae": round(mae, 2) if mae is not None else None,
        "rmse": round(rmse, 2) if rmse is not None else None,
        "r2": round(r2, 3) if r2 is not None else None,
    }
