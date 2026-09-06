import datetime as dt
from collections import defaultdict
from typing import Dict, List, Any
from sqlalchemy.orm import Session, joinedload
from .. import models

def generate_business_recommendations(db: Session, business_id: int) -> List[Dict[str, Any]]:
    """
    Intelligent recommendation engine combining:
    1. Item Co-occurrence & Association Rule Mining (Cross-Sell)
    2. Category Affinity & Premium Upgrades (Up-Sell)
    3. Revenue & Sales Volume Popularity (Cold-Start Fallback)
    
    All queries are strictly scoped by business_id for multi-tenancy.
    """
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == business_id)
        .all()
    )
    products = (
        db.query(models.Product)
        .options(joinedload(models.Product.category))
        .filter(
            models.Product.business_id == business_id,
            models.Product.is_active == True
        )
        .all()
    )

    if not customers or not products:
        return []

    product_map = {p.id: p for p in products}

    # 1. Fetch all completed sales and items for this business
    sales = (
        db.query(models.Sale)
        .options(joinedload(models.Sale.sale_items))
        .filter(models.Sale.business_id == business_id)
        .all()
    )

    # 2. Build Item Co-occurrence Matrix & Product Sales Frequencies
    product_sales_count = defaultdict(int)
    co_occurrence = defaultdict(lambda: defaultdict(int))
    customer_purchase_history = defaultdict(set)
    customer_category_history = defaultdict(lambda: defaultdict(int))

    for s in sales:
        sale_prod_ids = [item.product_id for item in s.sale_items if item.product_id in product_map]
        
        # Track product frequencies
        for p_id in sale_prod_ids:
            product_sales_count[p_id] += 1
            if s.customer_id:
                customer_purchase_history[s.customer_id].add(p_id)
                cat_id = product_map[p_id].category_id
                if cat_id:
                    customer_category_history[s.customer_id][cat_id] += 1

        # Track co-occurrences in the same sale
        unique_prods = list(set(sale_prod_ids))
        for i in range(len(unique_prods)):
            for j in range(i + 1, len(unique_prods)):
                p1, p2 = unique_prods[i], unique_prods[j]
                co_occurrence[p1][p2] += 1
                co_occurrence[p2][p1] += 1

    # Sort top-selling products for cold-start / popularity fallback
    sorted_popular_products = sorted(
        products, key=lambda p: product_sales_count[p.id], reverse=True
    )

    results = []

    for customer in customers:
        purchased_pids = customer_purchase_history[customer.id]
        category_counts = customer_category_history[customer.id]
        
        rec_list = []
        rec_pids = set()

        # Strategy A: Item Co-occurrence / Association Rules (Cross-Sell)
        for pid in purchased_pids:
            if pid in co_occurrence:
                # Find co-purchased items sorted by co-occurrence count
                related = sorted(
                    co_occurrence[pid].items(), key=lambda x: x[1], reverse=True
                )
                for rel_pid, freq in related:
                    if rel_pid not in purchased_pids and rel_pid not in rec_pids and rel_pid in product_map:
                        target_p = product_map[rel_pid]
                        source_p = product_map[pid]
                        total_source = max(product_sales_count[pid], 1)
                        confidence = round(freq / total_source, 2)
                        
                        rec_list.append({
                            "product_id": target_p.id,
                            "product_name": target_p.name,
                            "selling_price": float(target_p.selling_price),
                            "category": target_p.category.category_name if target_p.category else "General",
                            "recommendation_type": "Cross-Sell",
                            "score": max(confidence, 0.75),
                            "reason": f"Frequently co-purchased with {source_p.name} ({int(freq)} times)."
                        })
                        rec_pids.add(rel_pid)
                        if len(rec_list) >= 3:
                            break

        # Strategy B: Category Affinity & Up-sell
        if len(rec_list) < 3 and category_counts:
            top_category_id = max(category_counts, key=category_counts.get)
            same_cat_products = [
                p for p in products 
                if p.category_id == top_category_id and p.id not in purchased_pids and p.id not in rec_pids
            ]
            # Recommend higher price products in the same top category (Up-sell)
            same_cat_products.sort(key=lambda p: p.selling_price, reverse=True)
            for p in same_cat_products:
                cat_name = p.category.category_name if p.category else "Category"
                rec_list.append({
                    "product_id": p.id,
                    "product_name": p.name,
                    "selling_price": float(p.selling_price),
                    "category": cat_name,
                    "recommendation_type": "Up-Sell",
                    "score": 0.82,
                    "reason": f"High-demand premium pick in {customer.full_name}'s top category ({cat_name})."
                })
                rec_pids.add(p.id)
                if len(rec_list) >= 3:
                    break

        # Strategy C: Popularity & Revenue Fallback (Cold-Start)
        if len(rec_list) < 3:
            for p in sorted_popular_products:
                if p.id not in purchased_pids and p.id not in rec_pids:
                    cat_name = p.category.category_name if p.category else "General"
                    sales_cnt = product_sales_count[p.id]
                    reason_msg = (
                        f"Top selling item across store ({sales_cnt} units sold)."
                        if sales_cnt > 0
                        else "Trending new product addition."
                    )
                    rec_list.append({
                        "product_id": p.id,
                        "product_name": p.name,
                        "selling_price": float(p.selling_price),
                        "category": cat_name,
                        "recommendation_type": "Top Seller",
                        "score": 0.70,
                        "reason": reason_msg
                    })
                    rec_pids.add(p.id)
                    if len(rec_list) >= 3:
                        break

        # Fallback if catalog is very small and customer bought everything
        if not rec_list and products:
            p = products[0]
            rec_list.append({
                "product_id": p.id,
                "product_name": p.name,
                "selling_price": float(p.selling_price),
                "category": p.category.category_name if p.category else "General",
                "recommendation_type": "Featured",
                "score": 0.65,
                "reason": "Featured product recommendation."
            })

        prod_names = [item["product_name"] for item in rec_list]
        combined_reason = rec_list[0]["reason"] if rec_list else "Personalized store recommendation."

        results.append({
            "customer_id": customer.id,
            "customer_name": customer.full_name,
            "recommended_products": prod_names,
            "details": rec_list,
            "reason": combined_reason
        })

    return results
