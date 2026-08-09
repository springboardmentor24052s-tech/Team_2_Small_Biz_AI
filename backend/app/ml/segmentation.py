import datetime as dt
from collections import defaultdict
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sqlalchemy.orm import Session

from .. import models

SEGMENT_LABELS = {
    0: "High Value Customers",
    1: "Regular Customers",
    2: "Occasional Customers",
    3: "Low Engagement Customers",
}


def run_segmentation(db: Session, n_clusters: int = 4) -> dict:
    customers = db.query(models.Customer).all()
    sales = db.query(models.Sale).all()

    by_customer = defaultdict(list)
    for s in sales:
        if s.customer_id:
            by_customer[s.customer_id].append(s)

    rows = []
    for c in customers:
        c_sales = by_customer.get(c.id, [])
        frequency = len(c_sales)
        monetary = sum(s.total_amount for s in c_sales)
        if c_sales:
            last_purchase = max(s.sale_date for s in c_sales)
            recency_days = (dt.datetime.utcnow() - last_purchase).days
        else:
            recency_days = 9999
        rows.append(
            {
                "customer_id": c.id,
                "customer_name": c.name,
                "frequency": frequency,
                "monetary": monetary,
                "recency_days": recency_days,
            }
        )

    active_rows = [r for r in rows if r["frequency"] > 0]
    if len(active_rows) < max(n_clusters, 2):
        return {"segments": [], "silhouette_score": None, "customers": rows}

    X = np.array([[r["frequency"], r["monetary"], r["recency_days"]] for r in active_rows])
    X_scaled = StandardScaler().fit_transform(X)

    k = min(n_clusters, len(active_rows) - 1) if len(active_rows) - 1 >= 2 else 2
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    sil = None
    if len(set(labels)) > 1:
        sil = float(silhouette_score(X_scaled, labels))

    # Rank clusters by monetary value descending so label 0 = highest value.
    cluster_monetary = defaultdict(list)
    for r, label in zip(active_rows, labels):
        cluster_monetary[label].append(r["monetary"])
    ranked_clusters = sorted(cluster_monetary.keys(), key=lambda l: -np.mean(cluster_monetary[l]))
    rank_map = {cluster_id: rank for rank, cluster_id in enumerate(ranked_clusters)}

    for r, label in zip(active_rows, labels):
        r["segment"] = SEGMENT_LABELS.get(rank_map[label], f"Segment {rank_map[label]}")

    segment_summary = defaultdict(lambda: {"count": 0, "monetary": [], "frequency": []})
    for r in active_rows:
        seg = segment_summary[r["segment"]]
        seg["count"] += 1
        seg["monetary"].append(r["monetary"])
        seg["frequency"].append(r["frequency"])

    segments = [
        {
            "segment": seg_name,
            "customer_count": data["count"],
            "avg_purchase_value": round(float(np.mean(data["monetary"])), 2),
            "avg_purchase_frequency": round(float(np.mean(data["frequency"])), 2),
        }
        for seg_name, data in segment_summary.items()
    ]
    segments.sort(key=lambda s: -s["avg_purchase_value"])

    inactive_rows = [r for r in rows if r["frequency"] == 0]
    for r in inactive_rows:
        r["segment"] = "No Purchase History"

    return {
        "segments": segments,
        "silhouette_score": round(sil, 3) if sil is not None else None,
        "customers": active_rows + inactive_rows,
    }
