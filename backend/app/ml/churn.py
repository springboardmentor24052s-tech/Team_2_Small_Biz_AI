import datetime as dt
from collections import defaultdict
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sqlalchemy.orm import Session

from .. import models


def _risk_category(prob: float) -> str:
    if prob >= 0.66:
        return "High"
    if prob >= 0.33:
        return "Medium"
    return "Low"


def _recommendation(prob: float, customer_name: str) -> str:
    if prob >= 0.66:
        return f"{customer_name} has a high churn probability. Consider a personalized retention discount or outreach call."
    if prob >= 0.33:
        return f"{customer_name} shows moderate churn risk. A check-in email or loyalty offer may help re-engage them."
    return f"{customer_name} is currently a low churn-risk, engaged customer."


def run_churn_prediction(db: Session) -> dict:
    customers = db.query(models.Customer).all()
    sales = db.query(models.Sale).all()

    by_customer = defaultdict(list)
    for s in sales:
        if s.customer_id:
            by_customer[s.customer_id].append(s)

    features, names, ids = [], [], []
    for c in customers:
        c_sales = sorted(by_customer.get(c.id, []), key=lambda s: s.sale_date)
        frequency = len(c_sales)
        if c_sales:
            last_purchase = max(s.sale_date for s in c_sales)
            inactivity_days = (dt.datetime.utcnow() - last_purchase).days
            avg_gap = (
                (c_sales[-1].sale_date - c_sales[0].sale_date).days / max(1, len(c_sales) - 1)
                if len(c_sales) > 1
                else inactivity_days
            )
        else:
            inactivity_days = 365
            avg_gap = 365
        engagement_score = frequency / max(1, inactivity_days / 30)

        features.append([inactivity_days, frequency, avg_gap, engagement_score])
        names.append(c.name)
        ids.append(c.id)

    if len(features) < 4:
        return {"rows": [], "accuracy": None, "precision": None, "recall": None, "f1": None}

    X = np.array(features)

    # Heuristic churn label for supervised training: customers inactive >60 days with low frequency = churned.
    y = np.array([1 if (f[0] > 60 and f[1] <= 2) else 0 for f in features])

    metrics = {"accuracy": None, "precision": None, "recall": None, "f1": None}
    if len(set(y)) > 1 and len(X) >= 6:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
        clf = RandomForestClassifier(n_estimators=200, random_state=42, max_depth=6).fit(X_train, y_train)
        preds = clf.predict(X_test)
        metrics = {
            "accuracy": round(float(accuracy_score(y_test, preds)), 3),
            "precision": round(float(precision_score(y_test, preds, zero_division=0)), 3),
            "recall": round(float(recall_score(y_test, preds, zero_division=0)), 3),
            "f1": round(float(f1_score(y_test, preds, zero_division=0)), 3),
        }
        final_clf = RandomForestClassifier(n_estimators=200, random_state=42, max_depth=6).fit(X, y)
    else:
        final_clf = RandomForestClassifier(n_estimators=200, random_state=42, max_depth=6).fit(X, y) if len(set(y)) > 1 else None

    rows = []
    if final_clf is not None:
        probs = final_clf.predict_proba(X)
        churn_col = list(final_clf.classes_).index(1) if 1 in final_clf.classes_ else None
        for i, cid in enumerate(ids):
            prob = float(probs[i][churn_col]) if churn_col is not None else 0.0
            rows.append(
                {
                    "customer_id": cid,
                    "customer_name": names[i],
                    "churn_probability": round(prob, 3),
                    "risk_category": _risk_category(prob),
                    "recommendation": _recommendation(prob, names[i]),
                }
            )
    else:
        for i, cid in enumerate(ids):
            rows.append(
                {
                    "customer_id": cid,
                    "customer_name": names[i],
                    "churn_probability": 0.0,
                    "risk_category": "Low",
                    "recommendation": _recommendation(0.0, names[i]),
                }
            )

    rows.sort(key=lambda r: -r["churn_probability"])
    return {"rows": rows, **metrics}
