import os
import joblib
import pandas as pd
from sqlalchemy.orm import Session
from app.models import Sale, SaleItem, Product

from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "trained_models")
os.makedirs(MODEL_DIR, exist_ok=True)

def get_model_path(business_id: int):
    return os.path.join(MODEL_DIR, f"business_{business_id}_item_sim.pkl")

def train_recommendation_model(db: Session, business_id: int):
    """
    Trains an Item-Item Collaborative Filtering model based on purchase history
    (specifically Market Basket / co-occurrence data).
    """
    # Fetch all sale items for this business
    # We join SaleItem with Sale to get the customer_id
    records = db.query(SaleItem.product_id, Sale.customer_id, SaleItem.quantity)\
                .join(Sale, Sale.id == SaleItem.sale_id)\
                .filter(Sale.business_id == business_id)\
                .all()
                
    if not records:
        return {"status": "error", "message": "No sales data available for this business."}
        
    # Convert to DataFrame
    df = pd.DataFrame(records, columns=['product_id', 'customer_id', 'quantity'])
    
    # We want to know how many times each customer bought each product
    # Create a user-item matrix
    user_item_matrix = df.groupby(['customer_id', 'product_id'])['quantity'].sum().unstack(fill_value=0)
    
    # For basic market basket/CF, we can just use implicit feedback (1 if bought, 0 if not)
    # But since we have quantities, we can just use cosine similarity on the raw counts or binarized
    user_item_binary = (user_item_matrix > 0).astype(int)
    
    # Compute Item-Item Cosine Similarity
    # Transpose so rows are products
    item_item_matrix = user_item_binary.T
    
    # Calculate cosine similarity between items
    sim_matrix = cosine_similarity(item_item_matrix)
    
    # Convert to a DataFrame for easy lookup
    item_sim_df = pd.DataFrame(sim_matrix, index=item_item_matrix.index, columns=item_item_matrix.index)
    
    # Save the similarity matrix
    model_path = get_model_path(business_id)
    joblib.dump(item_sim_df, model_path)
    
    return {"status": "success", "message": "Model trained successfully."}


def get_personalized_recommendations(db: Session, business_id: int, customer_id: int, limit: int = 5):
    """
    Get top personalized product recommendations for a customer.
    If the customer has no history or model doesn't exist, return top sellers.
    """
    model_path = get_model_path(business_id)
    
    # Fallback to top sellers if no model
    if not os.path.exists(model_path):
        return get_top_sellers(db, business_id, limit)
        
    try:
        item_sim_df = joblib.load(model_path)
    except Exception:
        return get_top_sellers(db, business_id, limit)
        
    # Get user's purchase history
    history = db.query(SaleItem.product_id)\
                .join(Sale, Sale.id == SaleItem.sale_id)\
                .filter(Sale.business_id == business_id, Sale.customer_id == customer_id)\
                .all()
                
    purchased_product_ids = [h[0] for h in history]
    
    if not purchased_product_ids:
        # Cold start for this user -> return top sellers
        return get_top_sellers(db, business_id, limit)
        
    # Calculate score for all items based on similarity to purchased items
    scores = pd.Series(0.0, index=item_sim_df.index)
    
    for pid in purchased_product_ids:
        if pid in item_sim_df.index:
            # Add similarity scores
            scores += item_sim_df.loc[pid]
            
    # Remove already purchased items (if you only want to recommend new things)
    # Actually, for retail, repeat purchases are common, but let's exclude them for variety
    scores = scores.drop(purchased_product_ids, errors='ignore')
    
    # Get top N
    top_scores = scores.sort_values(ascending=False).head(limit)
    
    if top_scores.empty or top_scores.max() == 0:
        return get_top_sellers(db, business_id, limit)
        
    # Fetch product details
    recommended_product_ids = top_scores.index.tolist()
    products = db.query(Product).filter(Product.id.in_(recommended_product_ids)).all()
    
    # Maintain order
    prod_dict = {p.id: p for p in products}
    ordered_products = [prod_dict[pid] for pid in recommended_product_ids if pid in prod_dict]
    
    return [
        {
            "product_id": p.id,
            "name": p.name,
            "price": p.selling_price,
            "image_url": p.image_url,
            "category_id": p.category_id,
            "score": float(top_scores.loc[p.id])
        } for p in ordered_products
    ]


def get_cross_sell_recommendations(db: Session, business_id: int, product_ids: list[int], limit: int = 5):
    """
    Given a list of product IDs currently in the cart, recommend related products.
    """
    model_path = get_model_path(business_id)
    if not os.path.exists(model_path):
        return get_top_sellers(db, business_id, limit)
        
    try:
        item_sim_df = joblib.load(model_path)
    except Exception:
        return get_top_sellers(db, business_id, limit)
        
    scores = pd.Series(0.0, index=item_sim_df.index)
    
    for pid in product_ids:
        if pid in item_sim_df.index:
            scores += item_sim_df.loc[pid]
            
    # Drop items already in the cart
    scores = scores.drop(product_ids, errors='ignore')
    
    top_scores = scores.sort_values(ascending=False).head(limit)
    
    if top_scores.empty or top_scores.max() == 0:
        return get_top_sellers(db, business_id, limit)
        
    recommended_product_ids = top_scores.index.tolist()
    products = db.query(Product).filter(Product.id.in_(recommended_product_ids)).all()
    
    prod_dict = {p.id: p for p in products}
    ordered_products = [prod_dict[pid] for pid in recommended_product_ids if pid in prod_dict]
    
    return [
        {
            "product_id": p.id,
            "name": p.name,
            "price": p.selling_price,
            "image_url": p.image_url,
            "score": float(top_scores.loc[p.id])
        } for p in ordered_products
    ]


def get_top_sellers(db: Session, business_id: int, limit: int = 5):
    """
    Fallback method: Returns the top selling products across the business.
    """
    from sqlalchemy import func
    
    results = db.query(
        Product, 
        func.sum(SaleItem.quantity).label('total_sold')
    ).join(SaleItem, SaleItem.product_id == Product.id)\
     .join(Sale, Sale.id == SaleItem.sale_id)\
     .filter(Sale.business_id == business_id)\
     .group_by(Product.id)\
     .order_by(func.sum(SaleItem.quantity).desc())\
     .limit(limit)\
     .all()
     
    return [
        {
            "product_id": p.id,
            "name": p.name,
            "price": p.selling_price,
            "image_url": p.image_url,
            "score": 0.0 # Default score for top sellers
        } for p, _ in results
    ]
