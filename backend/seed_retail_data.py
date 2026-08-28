import os
import sys
import pandas as pd
from datetime import datetime

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from app.database import SessionLocal
from app.models import Business, Customer, Product, Category, Sale, SaleItem, Inventory

def run_seed():
    print("Loading dataset...")
    df = pd.read_excel(os.path.join(backend_dir, "app", "datasets", "Online Retail.xlsx"))
    
    # Preprocessing
    print("Preprocessing data...")
    # Drop rows without CustomerID
    df = df.dropna(subset=['CustomerID'])
    # Convert CustomerID to int
    df['CustomerID'] = df['CustomerID'].astype(int)
    # Remove negative quantities (returns/cancellations)
    df = df[df['Quantity'] > 0]
    
    # Sample the data to make ingestion faster (e.g., first 5000 invoices)
    # Get unique invoices and take a subset
    unique_invoices = df['InvoiceNo'].unique()[:2000] # Let's do 2000 invoices for demo
    df = df[df['InvoiceNo'].isin(unique_invoices)]
    
    db = SessionLocal()
    
    try:
        # Create a Demo Business
        print("Creating demo business...")
        demo_business = db.query(Business).filter(Business.company_name == "Retail Demo Ltd").first()
        if not demo_business:
            demo_business = Business(company_name="Retail Demo Ltd")
            db.add(demo_business)
            db.commit()
            db.refresh(demo_business)
        business_id = demo_business.id
        
        # Create a general Category
        general_cat = db.query(Category).filter(Category.business_id == business_id, Category.category_name == "General").first()
        if not general_cat:
            general_cat = Category(business_id=business_id, category_name="General")
            db.add(general_cat)
            db.commit()
            db.refresh(general_cat)
        
        # Extract unique customers
        print("Inserting customers...")
        unique_customers = df['CustomerID'].unique()
        
        # To avoid conflicts, let's create a mapping from original CustomerID to internal Customer ID
        customer_map = {}
        for cust_id in unique_customers:
            c = Customer(
                business_id=business_id,
                full_name=f"Customer {cust_id}",
                total_orders=0,
                total_spent=0.0
            )
            db.add(c)
            db.flush()
            customer_map[cust_id] = c.id
            
        db.commit()
        
        # Extract unique products
        print("Inserting products...")
        unique_products = df.drop_duplicates(subset=['StockCode'])
        product_map = {}
        
        for _, row in unique_products.iterrows():
            stock_code = str(row['StockCode'])
            desc = str(row['Description']) if pd.notna(row['Description']) else "Unknown Product"
            price = float(row['UnitPrice'])
            
            p = Product(
                business_id=business_id,
                category_id=general_cat.id,
                name=desc,
                sku=stock_code,
                selling_price=price,
                purchase_price=price * 0.5, # mock
            )
            db.add(p)
            db.flush()
            product_map[stock_code] = p.id
            
            # Add inventory
            inv = Inventory(
                product_id=p.id,
                quantity_available=1000,
                reorder_level=10
            )
            db.add(inv)
            
        db.commit()
        
        # Insert Sales and SaleItems
        print("Inserting sales...")
        # Group by InvoiceNo
        grouped = df.groupby('InvoiceNo')
        for invoice_no, group in grouped:
            # All items in an invoice share the same customer
            orig_cust_id = group.iloc[0]['CustomerID']
            internal_cust_id = customer_map[orig_cust_id]
            invoice_date = group.iloc[0]['InvoiceDate']
            
            # Calculate totals
            subtotal = 0.0
            for _, row in group.iterrows():
                subtotal += float(row['UnitPrice']) * int(row['Quantity'])
                
            sale = Sale(
                business_id=business_id,
                invoice_number=str(invoice_no),
                customer_id=internal_cust_id,
                subtotal=subtotal,
                tax=subtotal * 0.1,
                discount=0.0,
                total_amount=subtotal * 1.1,
                sale_date=invoice_date
            )
            db.add(sale)
            db.flush()
            
            for _, row in group.iterrows():
                stock_code = str(row['StockCode'])
                internal_prod_id = product_map.get(stock_code)
                if not internal_prod_id:
                    continue
                    
                quantity = int(row['Quantity'])
                unit_price = float(row['UnitPrice'])
                total = quantity * unit_price
                
                sale_item = SaleItem(
                    sale_id=sale.id,
                    product_id=internal_prod_id,
                    quantity=quantity,
                    unit_price=unit_price,
                    discount=0.0,
                    total=total
                )
                db.add(sale_item)
                
        db.commit()
        print("Seeding complete!")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
