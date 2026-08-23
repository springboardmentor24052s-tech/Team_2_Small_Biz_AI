from collections import defaultdict, Counter
from itertools import combinations
from sqlalchemy.orm import Session

from .. import models


def _build_baskets(db: Session):
    sales = db.query(models.Sale).filter(models.Sale.customer_id.isnot(None)).all()
    baskets = defaultdict(set)  # customer_id -> set(product_id)
    for s in sales:
        if s.product_id:
            baskets[s.customer_id].add(s.product_id)
    return baskets


def _build_cooccurrence(baskets) -> Counter:
    co = Counter()
    for products in baskets.values():
        for a, b in combinations(sorted(products), 2):
            co[(a, b)] += 1
    return co


def run_recommendations(db: Session, top_k: int = 3) -> dict:
    customers = {c.id: c.name for c in db.query(models.Customer).all()}
    products = {p.id: p.name for p in db.query(models.Product).all()}
    baskets = _build_baskets(db)

    if not baskets or not products:
        return {"rows": []}

    co_occurrence = _build_cooccurrence(baskets)

    # Global popularity fallback for customers with very small purchase history (cold-start).
    popularity = Counter()
    for products_set in baskets.values():
        for p in products_set:
            popularity[p] += 1
    popular_products = [pid for pid, _ in popularity.most_common(top_k)]

    rows = []
    for customer_id, owned in baskets.items():
        candidate_scores = Counter()
        for owned_pid in owned:
            for (a, b), count in co_occurrence.items():
                if a == owned_pid and b not in owned:
                    candidate_scores[b] += count
                elif b == owned_pid and a not in owned:
                    candidate_scores[a] += count

        if candidate_scores:
            recommended_ids = [pid for pid, _ in candidate_scores.most_common(top_k)]
            reason = "Based on products frequently purchased together with this customer's history (collaborative filtering)."
        else:
            recommended_ids = [pid for pid in popular_products if pid not in owned][:top_k]
            reason = "Trending / best-selling products (cold-start recommendation)."

        recommended_names = [products.get(pid, f"Product #{pid}") for pid in recommended_ids]
        if recommended_names:
            rows.append(
                {
                    "customer_id": customer_id,
                    "customer_name": customers.get(customer_id, f"Customer #{customer_id}"),
                    "recommended_products": recommended_names,
                    "reason": reason,
                }
            )

    return {"rows": rows}
