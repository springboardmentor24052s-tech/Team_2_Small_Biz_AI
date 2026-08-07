"""
AI / Machine Learning endpoints powering the Forecasting, Segmentation,
Churn, Recommendations, and Anomalies pages. Everything here reads live
from the real `sales`, `customers`, `products`, and `invoices` tables —
there is no seed/demo data involved. On a fresh database (or one with
very little history) each endpoint degrades gracefully and reports
"insufficient data" rather than fabricating a result.
"""
import datetime as dt
from collections import defaultdict
from typing import List

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, accuracy_score, precision_score, recall_score, f1_score
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import cosine_similarity

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI / Machine Learning"])


def _sales_dataframe(db: Session) -> pd.DataFrame:
    rows = db.query(models.Sale).all()
    if not rows:
        return pd.DataFrame(columns=["id", "customer_id", "product_id", "quantity", "unit_price", "total_amount", "sale_date"])
    data = [{
        "id": s.id, "customer_id": s.customer_id, "product_id": s.product_id,
        "quantity": s.quantity, "unit_price": s.unit_price, "total_amount": s.total_amount,
        "sale_date": s.sale_date,
    } for s in rows]
    df = pd.DataFrame(data)
    df["sale_date"] = pd.to_datetime(df["sale_date"])
    return df


# ---------------------------------------------------------------------------
# 1. Forecasting — Random Forest Regressor on daily revenue
# ---------------------------------------------------------------------------
@router.get("/forecast", response_model=schemas.ForecastResponse)
def forecast(horizon_days: int = 14, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    df = _sales_dataframe(db)
    if df.empty or df["sale_date"].dt.normalize().nunique() < 5:
        return schemas.ForecastResponse(history=[], forecast=[], trend="insufficient_data", growth_pct=0.0)

    daily = df.groupby(df["sale_date"].dt.date)["total_amount"].sum().reset_index()
    daily.columns = ["date", "revenue"]
    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.sort_values("date").reset_index(drop=True)
    daily["day_index"] = np.arange(len(daily))
    daily["day_of_week"] = daily["date"].dt.dayofweek
    daily["is_weekend"] = (daily["day_of_week"] >= 5).astype(int)

    X = daily[["day_index", "day_of_week", "is_weekend"]]
    y = daily["revenue"]

    mae = rmse = r2 = None
    if len(daily) >= 8:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
        model = RandomForestRegressor(n_estimators=200, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        mae = round(float(np.mean(np.abs(preds - y_test))), 2)
        rmse = round(float(np.sqrt(np.mean((preds - y_test) ** 2))), 2)
        if len(y_test) > 1 and y_test.var() > 0:
            ss_res = float(np.sum((y_test - preds) ** 2))
            ss_tot = float(np.sum((y_test - y_test.mean()) ** 2))
            r2 = round(1 - ss_res / ss_tot, 3) if ss_tot > 0 else None

    final_model = RandomForestRegressor(n_estimators=200, max_depth=6, random_state=42)
    final_model.fit(X, y)

    last_index = int(daily["day_index"].max())
    last_date = daily["date"].max()
    future_rows = []
    for i in range(1, horizon_days + 1):
        fd = last_date + pd.Timedelta(days=i)
        future_rows.append({"day_index": last_index + i, "day_of_week": fd.dayofweek, "is_weekend": int(fd.dayofweek >= 5), "date": fd})
    future_df = pd.DataFrame(future_rows)
    preds = np.clip(final_model.predict(future_df[["day_index", "day_of_week", "is_weekend"]]), 0, None)

    forecast_points = [
        schemas.ForecastPoint(period=row["date"].strftime("%Y-%m-%d"), predicted_revenue=round(float(p), 2))
        for row, p in zip(future_rows, preds)
    ]
    history = [{"date": row["date"].strftime("%Y-%m-%d"), "revenue": round(float(row["revenue"]), 2)} for _, row in daily.iterrows()]

    recent_avg = daily["revenue"].tail(7).mean()
    prior_avg = daily["revenue"].head(max(len(daily) - 7, 1)).mean() or recent_avg
    growth_pct = round(((recent_avg - prior_avg) / prior_avg) * 100, 1) if prior_avg else 0.0
    trend = "increasing" if growth_pct > 3 else "decreasing" if growth_pct < -3 else "stable"

    return schemas.ForecastResponse(
        history=history, forecast=forecast_points, trend=trend, growth_pct=growth_pct,
        mae=mae, rmse=rmse, r2=r2,
    )


# ---------------------------------------------------------------------------
# 2. Segmentation — K-Means on RFM-style features
# ---------------------------------------------------------------------------
SEGMENT_LABELS = ["Low Engagement Customers", "Occasional Customers", "Regular Customers", "High Value Customers"]


@router.get("/segmentation", response_model=schemas.SegmentationResponse)
def segmentation(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    df = _sales_dataframe(db).dropna(subset=["customer_id"])
    if df.empty:
        return schemas.SegmentationResponse(segments=[], customers=[])

    now = df["sale_date"].max()
    agg = df.groupby("customer_id").agg(
        frequency=("id", "count"),
        monetary=("total_amount", "sum"),
        last_purchase=("sale_date", "max"),
    ).reset_index()
    agg["recency_days"] = (now - agg["last_purchase"]).dt.days

    n_clusters = min(4, agg["customer_id"].nunique())
    if n_clusters < 2:
        agg["cluster"] = 0
        silhouette = None
    else:
        features = agg[["recency_days", "frequency", "monetary"]]
        scaled = StandardScaler().fit_transform(features)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        agg["cluster"] = kmeans.fit_predict(scaled)
        try:
            silhouette = round(float(silhouette_score(scaled, agg["cluster"])), 3)
        except ValueError:
            silhouette = None

    cluster_order = agg.groupby("cluster")["monetary"].mean().sort_values().index.tolist()
    label_map = {cluster: SEGMENT_LABELS[min(i, len(SEGMENT_LABELS) - 1)] for i, cluster in enumerate(cluster_order)}
    agg["segment"] = agg["cluster"].map(label_map)

    names = {c.id: c.name for c in db.query(models.Customer).all()}

    segment_summaries = []
    for label in agg["segment"].unique():
        sub = agg[agg["segment"] == label]
        segment_summaries.append(schemas.SegmentSummary(
            segment=label,
            customer_count=int(len(sub)),
            avg_purchase_value=round(float(sub["monetary"].mean()), 2),
            avg_purchase_frequency=round(float(sub["frequency"].mean()), 1),
        ))
    segment_summaries.sort(key=lambda s: SEGMENT_LABELS.index(s.segment) if s.segment in SEGMENT_LABELS else 99)

    customers_out = [
        {
            "customer_id": int(row["customer_id"]),
            "customer_name": names.get(int(row["customer_id"]), "Unknown"),
            "segment": row["segment"],
            "frequency": int(row["frequency"]),
        }
        for _, row in agg.iterrows()
    ]

    return schemas.SegmentationResponse(segments=segment_summaries, silhouette_score=silhouette, customers=customers_out)


# ---------------------------------------------------------------------------
# 3. Churn Prediction — Random Forest Classifier on inactivity/engagement
# ---------------------------------------------------------------------------
CHURN_INACTIVITY_DAYS = 45


def _risk_category(prob: float) -> str:
    if prob >= 0.7:
        return "High"
    if prob >= 0.4:
        return "Medium"
    return "Low"


def _recommendation(risk: str) -> str:
    return {
        "High": "Reach out with a personalized win-back offer before they churn.",
        "Medium": "Send a re-engagement email or loyalty discount to boost activity.",
        "Low": "No action needed — customer is actively engaged.",
    }[risk]


@router.get("/churn", response_model=schemas.ChurnResponse)
def churn(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    df = _sales_dataframe(db).dropna(subset=["customer_id"])
    if df.empty:
        return schemas.ChurnResponse(rows=[])

    now = df["sale_date"].max()
    agg = df.groupby("customer_id").agg(
        frequency=("id", "count"),
        monetary=("total_amount", "sum"),
        avg_order_value=("total_amount", "mean"),
        last_purchase=("sale_date", "max"),
    ).reset_index()
    agg["recency_days"] = (now - agg["last_purchase"]).dt.days
    agg["churned"] = (agg["recency_days"] > CHURN_INACTIVITY_DAYS).astype(int)

    features = agg[["recency_days", "frequency", "monetary", "avg_order_value"]]
    labels = agg["churned"]

    accuracy = precision = recall = f1 = None
    if labels.nunique() >= 2 and len(agg) >= 6:
        X_train, X_test, y_train, y_test = train_test_split(features, labels, test_size=0.25, random_state=42, stratify=labels)
        clf = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42)
        clf.fit(X_train, y_train)
        preds = clf.predict(X_test)
        accuracy = round(float(accuracy_score(y_test, preds)), 3)
        precision = round(float(precision_score(y_test, preds, zero_division=0)), 3)
        recall = round(float(recall_score(y_test, preds, zero_division=0)), 3)
        f1 = round(float(f1_score(y_test, preds, zero_division=0)), 3)
        clf.fit(features, labels)
        agg["churn_probability"] = clf.predict_proba(features)[:, 1]
    else:
        max_recency = max(agg["recency_days"].max(), 1)
        agg["churn_probability"] = (agg["recency_days"] / max_recency).clip(0, 1)

    names = {c.id: c.name for c in db.query(models.Customer).all()}
    rows = []
    for _, row in agg.iterrows():
        risk = _risk_category(float(row["churn_probability"]))
        rows.append(schemas.ChurnRow(
            customer_id=int(row["customer_id"]),
            customer_name=names.get(int(row["customer_id"]), "Unknown"),
            churn_probability=round(float(row["churn_probability"]), 3),
            risk_category=risk,
            recommendation=_recommendation(risk),
        ))
    rows.sort(key=lambda r: r.churn_probability, reverse=True)

    return schemas.ChurnResponse(rows=rows, accuracy=accuracy, precision=precision, recall=recall, f1=f1)


# ---------------------------------------------------------------------------
# 4. Recommendations — item-based collaborative filtering
# ---------------------------------------------------------------------------
@router.get("/recommendations", response_model=schemas.RecommendationResponse)
def recommendations(top_k: int = 3, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    df = _sales_dataframe(db).dropna(subset=["customer_id", "product_id"])
    if df.empty:
        return schemas.RecommendationResponse(rows=[])

    matrix = df.pivot_table(index="customer_id", columns="product_id", values="quantity", aggfunc="sum", fill_value=0)
    product_names = {p.id: p.name for p in db.query(models.Product).all()}
    customer_names = {c.id: c.name for c in db.query(models.Customer).all()}

    rows = []
    if matrix.shape[1] < 2:
        return schemas.RecommendationResponse(rows=[])

    item_sim = cosine_similarity(matrix.T)
    item_sim_df = pd.DataFrame(item_sim, index=matrix.columns, columns=matrix.columns)

    for customer_id in matrix.index:
        vector = matrix.loc[customer_id]
        purchased = vector[vector > 0].index.tolist()
        if not purchased:
            continue
        scores = pd.Series(0.0, index=matrix.columns)
        for pid in purchased:
            scores = scores.add(item_sim_df[pid] * vector[pid], fill_value=0)
        scores = scores.drop(labels=purchased, errors="ignore").sort_values(ascending=False).head(top_k)
        if scores.empty:
            continue
        recommended = [product_names.get(int(pid), f"#{pid}") for pid in scores.index]
        top_purchase = product_names.get(int(purchased[0]), "their past purchases")
        rows.append(schemas.RecommendationRow(
            customer_id=int(customer_id),
            customer_name=customer_names.get(int(customer_id), "Unknown"),
            recommended_products=recommended,
            reason=f"Frequently bought alongside {top_purchase} by similar customers.",
        ))

    return schemas.RecommendationResponse(rows=rows)


# ---------------------------------------------------------------------------
# 5. Anomaly Detection — Isolation Forest on transactions + inventory rules
# ---------------------------------------------------------------------------
@router.get("/anomalies", response_model=schemas.AnomalyResponse)
def anomalies(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    df = _sales_dataframe(db)
    new_alerts = []

    if len(df) >= 10:
        features = df[["quantity", "unit_price", "total_amount"]].fillna(0)
        model = IsolationForest(contamination=0.05, random_state=42)
        df = df.copy()
        df["flag"] = model.fit_predict(features)
        flagged = df[df["flag"] == -1]
        for _, row in flagged.iterrows():
            exists = db.query(models.AnomalyAlert).filter(
                models.AnomalyAlert.category == "sales", models.AnomalyAlert.related_id == int(row["id"])
            ).first()
            if exists:
                continue
            severity = "high" if row["total_amount"] > (flagged["total_amount"].median() * 2 or 1) else "medium"
            alert = models.AnomalyAlert(
                category="sales",
                description=f"Unusual transaction: {int(row['quantity'])} units at ₹{row['unit_price']:.2f} (₹{row['total_amount']:.2f} total).",
                severity=severity,
                score=round(float(abs(model.score_samples(features.loc[[row.name]])[0])), 3),
                related_id=int(row["id"]),
            )
            db.add(alert)
            new_alerts.append(alert)

    low_stock = db.query(models.Product).filter(models.Product.stock_quantity <= models.Product.reorder_threshold).all()
    for p in low_stock:
        exists = db.query(models.AnomalyAlert).filter(
            models.AnomalyAlert.category == "inventory", models.AnomalyAlert.related_id == p.id
        ).first()
        if exists:
            continue
        alert = models.AnomalyAlert(
            category="inventory",
            description=f"'{p.name}' stock is critically low ({p.stock_quantity} left).",
            severity="high" if p.stock_quantity == 0 else "medium",
            score=1.0,
            related_id=p.id,
        )
        db.add(alert)
        new_alerts.append(alert)

    if new_alerts:
        db.commit()

    alerts = db.query(models.AnomalyAlert).order_by(models.AnomalyAlert.created_at.desc()).limit(50).all()
    # No ground-truth fraud labels exist for real uploaded data, so we don't
    # fabricate an accuracy/false-positive figure — the UI shows "—" instead.
    detection_accuracy = None
    false_positive_rate = None

    return schemas.AnomalyResponse(alerts=alerts, detection_accuracy=detection_accuracy, false_positive_rate=false_positive_rate)
