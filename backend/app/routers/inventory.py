import io
import re
from typing import List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def normalize_product_name(value) -> str:
    """
    Normalize product names so values such as:

        Assam Black Tea 500g
        Assam Black Tea 500g 15
        Assam Black Tea 500g 27

    are treated as the same base product.

    Only removes a trailing numeric identifier when it looks like
    the generated duplicate suffix used in uploaded inventory data.
    """
    if value is None:
        return ""

    name = str(value).strip()

    # Remove repeated whitespace
    name = re.sub(r"\s+", " ", name)

    # Remove a trailing generated numeric suffix when the preceding
    # text contains a product-size/unit pattern.
    #
    # Examples:
    #   "Assam Black Tea 500g 15" -> "Assam Black Tea 500g"
    #   "Organic Basmati Rice 5kg 24" -> "Organic Basmati Rice 5kg"
    #
    # Do NOT remove meaningful numbers such as:
    #   "LED Bulb 9W"
    #   "Toor Dal 1kg"
    #   "Notebook Set of 5"
    match = re.match(
        r"^(.*\d+(?:kg|g|ml|l|L|W|w))\s+\d+$",
        name,
    )
    if match:
        name = match.group(1).strip()

    # Handle names such as:
    # "Notebook Set of 5 95"
    match = re.match(
        r"^(.*set of \d+)\s+\d+$",
        name,
        re.IGNORECASE,
    )
    if match:
        name = match.group(1).strip()

    # Handle names such as:
    # "Ayurvedic Soap Pack of 4 43"
    match = re.match(
        r"^(.*pack of \d+)\s+\d+$",
        name,
        re.IGNORECASE,
    )
    if match:
        name = match.group(1).strip()

    return name


def normalized_key(value) -> str:
    return normalize_product_name(value).casefold()


def get_category_name(row):
    """
    Accept different possible CSV column names.
    """
    possible_columns = [
        "category_name",
        "category",
        "product_category",
        "categoryname",
    ]

    for column in possible_columns:
        if column in row.index:
            value = row.get(column)

            if pd.notna(value):
                value = str(value).strip()

                if value:
                    return value

    return None


def get_supplier_name(row):
    possible_columns = [
        "supplier_name",
        "supplier",
        "suppliername",
    ]

    for column in possible_columns:
        if column in row.index:
            value = row.get(column)

            if pd.notna(value):
                value = str(value).strip()

                if value:
                    return value

    return None


def get_or_create_category(
    db: Session,
    category_name: str | None,
    business_id: int,
):
    """
    Find category for the current business.
    Create it if it doesn't exist.
    """
    if not category_name:
        return None

    normalized = category_name.strip()

    existing = (
        db.query(models.Category)
        .filter(
            models.Category.business_id == business_id,
            models.Category.category_name.ilike(normalized),
        )
        .first()
    )

    if existing:
        return existing

    category = models.Category(
        business_id=business_id,
        category_name=normalized,
    )

    db.add(category)
    db.flush()

    return category


def get_or_create_supplier(
    db: Session,
    supplier_name: str | None,
    business_id: int,
):
    """
    Find supplier for current business.
    Create it if it doesn't exist.
    """
    if not supplier_name:
        return None

    normalized = supplier_name.strip()

    existing = (
        db.query(models.Supplier)
        .filter(
            models.Supplier.business_id == business_id,
            models.Supplier.supplier_name.ilike(normalized),
        )
        .first()
    )

    if existing:
        return existing

    supplier = models.Supplier(
        business_id=business_id,
        supplier_name=normalized,
    )

    db.add(supplier)
    db.flush()

    return supplier


def _check_and_create_alert(
    db: Session,
    inventory: models.Inventory,
    product_name: str,
    business_id: int,
):
    """
    Keep inventory alerts synchronized with the current stock.

    - Creates an alert when stock is at/below reorder level.
    - Removes old unread inventory alerts when stock is above
      the reorder level.
    """

    # ---------------------------------------------------------
    # STOCK IS LOW
    # ---------------------------------------------------------

    if inventory.quantity_available <= inventory.reorder_level:

        existing = (
            db.query(models.Alert)
            .filter(
                models.Alert.alert_type == "inventory",
                models.Alert.business_id == business_id,
                models.Alert.title.like(
                    f"Low Stock: {product_name}%"
                ),
                models.Alert.is_read == False,
            )
            .first()
        )

        if not existing:

            priority = (
                "critical"
                if inventory.quantity_available == 0
                else "high"
            )

            alert = models.Alert(
                alert_type="inventory",
                title=f"Low Stock: {product_name}",
                description=(
                    f"Only {inventory.quantity_available} left "
                    f"(threshold: {inventory.reorder_level})."
                ),
                priority=priority,
                business_id=business_id,
                is_read=False,
            )

            db.add(alert)

    # ---------------------------------------------------------
    # STOCK IS NORMAL
    # ---------------------------------------------------------

    else:

        stale_alerts = (
            db.query(models.Alert)
            .filter(
                models.Alert.alert_type == "inventory",
                models.Alert.business_id == business_id,
                models.Alert.title.like(
                    f"Low Stock: {product_name}%"
                ),
                models.Alert.is_read == False,
            )
            .all()
        )

        for alert in stale_alerts:
            alert.is_read = True

def find_existing_product(
    db: Session,
    product_name: str,
    business_id: int,
):
    """
    Find an existing product using normalized name matching.
    """
    target = normalized_key(product_name)

    products = (
        db.query(models.Product)
        .filter(
            models.Product.business_id == business_id,
            models.Product.is_active == True,
        )
        .all()
    )

    for product in products:
        if normalized_key(product.name) == target:
            return product

    return None


# ---------------------------------------------------------------------------
# PRODUCTS
# ---------------------------------------------------------------------------

@router.get(
    "/products",
    response_model=List[schemas.ProductOut],
)
def list_products(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    products = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.category),
            joinedload(models.Product.supplier),
            joinedload(models.Product.inventory),
        )
        .filter(
            models.Product.business_id == current_user.business_id,
            models.Product.is_active == True,
        )
        .order_by(models.Product.name.asc())
        .all()
    )

    return products


# ---------------------------------------------------------------------------
# STOCK
# ---------------------------------------------------------------------------

@router.get(
    "/stock",
    response_model=List[schemas.InventoryOut],
)
def list_stock(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(models.Inventory)
        .join(models.Product)
        .filter(
            models.Product.business_id == current_user.business_id,
            models.Product.is_active == True,
        )
        .all()
    )


# ---------------------------------------------------------------------------
# CREATE PRODUCT MANUALLY
# ---------------------------------------------------------------------------

@router.post(
    "/products",
    response_model=schemas.ProductOut,
    status_code=201,
)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "store_manager",
            "admin",
        )
    ),
):
    # Prevent duplicate manual products
    existing = find_existing_product(
        db,
        payload.name,
        current_user.business_id,
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Product '{existing.name}' already exists.",
        )

    product_data = payload.model_dump(
        exclude={
            "stock_quantity",
            "reorder_level",
            "warehouse_location",
        }
    )

    product = models.Product(
        **product_data,
        business_id=current_user.business_id,
    )

    db.add(product)
    db.flush()

    inventory = models.Inventory(
        product_id=product.id,
        quantity_available=payload.stock_quantity,
        reorder_level=payload.reorder_level,
        warehouse_location=payload.warehouse_location,
    )

    db.add(inventory)

    if payload.stock_quantity > 0:
        tx = models.InventoryTransaction(
            product_id=product.id,
            user_id=current_user.id,
            transaction_type="IN",
            quantity=payload.stock_quantity,
            remarks="Initial stock setup",
        )

        db.add(tx)

    db.commit()
    db.refresh(product)

    _check_and_create_alert(
        db,
        inventory,
        product.name,
        current_user.business_id,
    )

    db.commit()

    return product


# ---------------------------------------------------------------------------
# UPDATE STOCK
# ---------------------------------------------------------------------------

@router.patch(
    "/products/{product_id}/stock",
    response_model=schemas.InventoryOut,
)
def update_stock(
    product_id: int,
    payload: schemas.StockUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "store_manager",
            "admin",
        )
    ),
):
    product = (
        db.query(models.Product)
        .filter(
            models.Product.id == product_id,
            models.Product.business_id == current_user.business_id,
            models.Product.is_active == True,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    inventory = (
        db.query(models.Inventory)
        .filter(
            models.Inventory.product_id == product_id
        )
        .first()
    )

    if not inventory:
        raise HTTPException(
            status_code=404,
            detail="Inventory record not found",
        )

    inventory.quantity_available = max(
        0,
        inventory.quantity_available + payload.quantity_delta,
    )

    tx = models.InventoryTransaction(
        product_id=product.id,
        user_id=current_user.id,
        transaction_type=payload.transaction_type,
        quantity=(
            abs(payload.quantity_delta)
            if payload.quantity_delta > 0
            else -abs(payload.quantity_delta)
        ),
        remarks=payload.remarks or "Manual adjustment",
    )

    db.add(tx)

    _check_and_create_alert(
        db,
        inventory,
        product.name,
        current_user.business_id,
    )

    db.commit()
    db.refresh(inventory)

    return inventory


# ---------------------------------------------------------------------------
# ALERTS
# ---------------------------------------------------------------------------

@router.get(
    "/alerts",
    response_model=List[schemas.AlertOut],
)
def list_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(models.Alert)
        .filter(
            models.Alert.is_read == False,
            models.Alert.business_id == current_user.business_id,
        )
        .order_by(models.Alert.created_at.desc())
        .all()
    )


@router.post("/alerts/clear")
@router.post("/alerts/mark-all-read")
def clear_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Mark all unread alerts as read for the user's business.

    Supports:
        POST /api/inventory/alerts/clear
        POST /api/inventory/alerts/mark-all-read
    """
    db.query(models.Alert).filter(
        models.Alert.business_id == current_user.business_id,
        models.Alert.is_read == False,
    ).update(
        {"is_read": True},
        synchronize_session=False,
    )

    db.commit()

    return {
        "message": "All inventory alerts cleared successfully."
    }


# ---------------------------------------------------------------------------
# CSV UPLOAD
# ---------------------------------------------------------------------------

@router.post("/products/upload-csv")
def upload_products_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "store_manager",
            "admin",
        )
    ),
):
    """
    Bulk-import a product catalog / inventory list from CSV.

    Required:
        name
        selling_price

    Optional:
        purchase_price
        category
        category_name
        supplier
        supplier_name
        stock_quantity
        reorder_level
        warehouse_location
        sku
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only .csv files are supported.",
        )

    raw = file.file.read()

    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse CSV: {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="CSV file is empty.",
        )

    # Normalize column names
    df.columns = [
        str(column)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        for column in df.columns
    ]

    # Support "price" as an old column name
    if (
        "price" in df.columns
        and "selling_price" not in df.columns
    ):
        df["selling_price"] = df["price"]

    # Support "category"
    if (
        "category" in df.columns
        and "category_name" not in df.columns
    ):
        df["category_name"] = df["category"]

    # Support "supplier"
    if (
        "supplier" in df.columns
        and "supplier_name" not in df.columns
    ):
        df["supplier_name"] = df["supplier"]

    required = {
        "name",
        "selling_price",
    }

    missing = required - set(df.columns)

    if missing:
        raise HTTPException(
            status_code=422,
            detail=(
                "CSV missing required columns: "
                f"{sorted(missing)}"
            ),
        )

    # Numeric conversion
    df["selling_price"] = pd.to_numeric(
        df["selling_price"],
        errors="coerce",
    )

    if "purchase_price" in df.columns:
        df["purchase_price"] = pd.to_numeric(
            df["purchase_price"],
            errors="coerce",
        )

    if "stock_quantity" in df.columns:
        df["stock_quantity"] = pd.to_numeric(
            df["stock_quantity"],
            errors="coerce",
        )

    if "reorder_level" in df.columns:
        df["reorder_level"] = pd.to_numeric(
            df["reorder_level"],
            errors="coerce",
        )

    # Remove invalid rows
    df = df.dropna(
        subset=[
            "name",
            "selling_price",
        ]
    )

    dataset = models.UploadedDataset(
        uploaded_by=current_user.id,
        business_id=current_user.business_id,
        file_name=file.filename,
        total_records=len(df),
        validation_status="processed",
    )

    db.add(dataset)
    db.flush()

    created = 0
    updated = 0
    skipped = 0

    # Cache categories and suppliers
    category_cache = {}
    supplier_cache = {}

    for _, row in df.iterrows():

        raw_name = str(row["name"]).strip()

        if not raw_name:
            skipped += 1
            continue

        # ---------------------------------------------------------------
        # PRODUCT NAME
        # ---------------------------------------------------------------

        product_name = normalize_product_name(raw_name)

        if not product_name:
            skipped += 1
            continue

        # ---------------------------------------------------------------
        # PRICE
        # ---------------------------------------------------------------

        selling_price = float(row["selling_price"])

        purchase_price = 0.0

        if (
            "purchase_price" in df.columns
            and pd.notna(row.get("purchase_price"))
        ):
            purchase_price = float(row["purchase_price"])

        # ---------------------------------------------------------------
        # STOCK
        # ---------------------------------------------------------------

        stock_qty = 0

        if (
            "stock_quantity" in df.columns
            and pd.notna(row.get("stock_quantity"))
        ):
            stock_qty = max(
                0,
                int(float(row["stock_quantity"])),
            )

        reorder = 10

        if (
            "reorder_level" in df.columns
            and pd.notna(row.get("reorder_level"))
        ):
            reorder = max(
                0,
                int(float(row["reorder_level"])),
            )

        # ---------------------------------------------------------------
        # CATEGORY
        # ---------------------------------------------------------------

        category_name = get_category_name(row)
        category = None

        if category_name:
            category_key = category_name.casefold()

            if category_key in category_cache:
                category = category_cache[category_key]
            else:
                category = get_or_create_category(
                    db,
                    category_name,
                    current_user.business_id,
                )

                category_cache[category_key] = category

        # ---------------------------------------------------------------
        # SUPPLIER
        # ---------------------------------------------------------------

        supplier_name = get_supplier_name(row)
        supplier = None

        if supplier_name:
            supplier_key = supplier_name.casefold()

            if supplier_key in supplier_cache:
                supplier = supplier_cache[supplier_key]
            else:
                supplier = get_or_create_supplier(
                    db,
                    supplier_name,
                    current_user.business_id,
                )

                supplier_cache[supplier_key] = supplier

        # ---------------------------------------------------------------
        # EXISTING PRODUCT
        # ---------------------------------------------------------------

        existing = find_existing_product(
            db,
            product_name,
            current_user.business_id,
        )

        if existing:

            # Update product
            existing.name = product_name
            existing.selling_price = selling_price
            existing.purchase_price = purchase_price

            if category:
                existing.category_id = category.id

            if supplier:
                existing.supplier_id = supplier.id

            # SKU if available
            if (
                "sku" in df.columns
                and pd.notna(row.get("sku"))
            ):
                sku = str(row["sku"]).strip()

                if sku:
                    existing.sku = sku

            # -----------------------------------------------------------
            # EXISTING INVENTORY
            # -----------------------------------------------------------

            inv = (
                db.query(models.Inventory)
                .filter(
                    models.Inventory.product_id
                    == existing.id
                )
                .first()
            )

            if not inv:
                warehouse_location = None

                if (
                    "warehouse_location" in df.columns
                    and pd.notna(
                        row.get("warehouse_location")
                    )
                ):
                    warehouse_location = str(
                        row["warehouse_location"]
                    ).strip()

                inv = models.Inventory(
                    product_id=existing.id,
                    quantity_available=stock_qty,
                    reorder_level=reorder,
                    warehouse_location=warehouse_location,
                )

                db.add(inv)

                if stock_qty > 0:
                    db.add(
                        models.InventoryTransaction(
                            product_id=existing.id,
                            user_id=current_user.id,
                            transaction_type="IN",
                            quantity=stock_qty,
                            remarks="CSV Upload",
                        )
                    )

            else:
                # Only replace stock if CSV actually contains it
                if (
                    "stock_quantity" in df.columns
                    and pd.notna(
                        row.get("stock_quantity")
                    )
                ):
                    inv.quantity_available = stock_qty

                inv.reorder_level = reorder

                if (
                    "warehouse_location" in df.columns
                    and pd.notna(
                        row.get("warehouse_location")
                    )
                ):
                    inv.warehouse_location = str(
                        row["warehouse_location"]
                    ).strip()

            _check_and_create_alert(
                db,
                inv,
                existing.name,
                current_user.business_id,
            )

            updated += 1

        else:

            # -----------------------------------------------------------
            # CREATE PRODUCT
            # -----------------------------------------------------------

            sku = None

            if (
                "sku" in df.columns
                and pd.notna(row.get("sku"))
            ):
                sku_value = str(row["sku"]).strip()

                if sku_value:
                    sku = sku_value

            product = models.Product(
                name=product_name,
                business_id=current_user.business_id,
                selling_price=selling_price,
                purchase_price=purchase_price,
                category_id=(
                    category.id
                    if category
                    else None
                ),
                supplier_id=(
                    supplier.id
                    if supplier
                    else None
                ),
                sku=sku,
            )

            db.add(product)
            db.flush()

            # -----------------------------------------------------------
            # CREATE INVENTORY
            # -----------------------------------------------------------

            warehouse_location = None

            if (
                "warehouse_location" in df.columns
                and pd.notna(
                    row.get("warehouse_location")
                )
            ):
                warehouse_location = str(
                    row["warehouse_location"]
                ).strip()

            inv = models.Inventory(
                product_id=product.id,
                quantity_available=stock_qty,
                reorder_level=reorder,
                warehouse_location=warehouse_location,
            )

            db.add(inv)

            # -----------------------------------------------------------
            # INVENTORY TRANSACTION
            # -----------------------------------------------------------

            if stock_qty > 0:
                db.add(
                    models.InventoryTransaction(
                        product_id=product.id,
                        user_id=current_user.id,
                        transaction_type="IN",
                        quantity=stock_qty,
                        remarks="CSV Upload",
                    )
                )

            _check_and_create_alert(
                db,
                inv,
                product.name,
                current_user.business_id,
            )

            created += 1

    dataset.valid_records = created + updated
    dataset.invalid_records = skipped



    db.commit()

    return {
        "message": (
            f"Inventory uploaded successfully. "
            f"{created} products created, "
            f"{updated} products updated, "
            f"{skipped} rows skipped."
        ),
        "rows_processed": int(len(df)),
        "products_created": created,
        "products_updated": updated,
        "rows_skipped": skipped,
        "dataset_id": dataset.id,
    }


# ---------------------------------------------------------------------------
# CLEAN EXISTING DUPLICATES
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# CLEAN EXISTING DUPLICATES
# ---------------------------------------------------------------------------

@router.post("/products/cleanup-duplicates")
def cleanup_duplicate_products(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "admin",
        )
    ),
):
    """
    Merge duplicate products using normalized product names.

    Example:

        Assam Black Tea 500g
        Assam Black Tea 500g 15
        Assam Black Tea 500g 27

    become one active product.

    The oldest product is retained.
    Inventory quantities are combined.
    """

    business_id = current_user.business_id

    # ------------------------------------------------------------
    # GET ACTIVE PRODUCTS
    # ------------------------------------------------------------

    products = (
        db.query(models.Product)
        .filter(
            models.Product.business_id == business_id,
            models.Product.is_active == True,
        )
        .order_by(models.Product.id.asc())
        .all()
    )

    groups = {}

    for product in products:
        key = normalized_key(product.name)

        if not key:
            continue

        groups.setdefault(key, []).append(product)

    merged_groups = 0
    removed_products = 0

    # ------------------------------------------------------------
    # MERGE DUPLICATES
    # ------------------------------------------------------------

    for key, group in groups.items():

        if len(group) <= 1:
            continue

        # Oldest product is retained
        primary = group[0]
        duplicates = group[1:]

        # --------------------------------------------------------
        # PRIMARY INVENTORY
        # --------------------------------------------------------

        primary_inventory = (
            db.query(models.Inventory)
            .filter(
                models.Inventory.product_id == primary.id
            )
            .first()
        )

        total_stock = 0

        if primary_inventory:
            total_stock = primary_inventory.quantity_available

        # --------------------------------------------------------
        # MERGE DUPLICATE INVENTORY
        # --------------------------------------------------------

        for duplicate in duplicates:

            duplicate_inventory = (
                db.query(models.Inventory)
                .filter(
                    models.Inventory.product_id == duplicate.id
                )
                .first()
            )

            if duplicate_inventory:

                total_stock += (
                    duplicate_inventory.quantity_available
                )

                db.delete(duplicate_inventory)

            # Deactivate duplicate product
            duplicate.is_active = False

            removed_products += 1

        # --------------------------------------------------------
        # CREATE / UPDATE PRIMARY INVENTORY
        # --------------------------------------------------------

        if primary_inventory:

            primary_inventory.quantity_available = total_stock

        else:

            primary_inventory = models.Inventory(
                product_id=primary.id,
                quantity_available=total_stock,
                reorder_level=10,
            )

            db.add(primary_inventory)

        # --------------------------------------------------------
        # NORMALIZE PRIMARY PRODUCT NAME
        # --------------------------------------------------------

        primary.name = normalize_product_name(primary.name)

        merged_groups += 1

    # ------------------------------------------------------------
    # REMOVE OLD INVENTORY ALERTS
    # ------------------------------------------------------------

    db.query(models.Alert).filter(
        models.Alert.business_id == business_id,
        models.Alert.alert_type == "inventory",
        models.Alert.is_read == False,
    ).delete(
        synchronize_session=False
    )

    db.flush()

    # ------------------------------------------------------------
    # RECREATE ALERTS FROM CLEAN INVENTORY
    # ------------------------------------------------------------

    active_inventory = (
        db.query(models.Inventory)
        .join(models.Product)
        .filter(
            models.Product.business_id == business_id,
            models.Product.is_active == True,
        )
        .all()
    )

    alerts_created = 0

    for inventory in active_inventory:

        product = inventory.product

        if not product:
            continue

        if inventory.quantity_available <= inventory.reorder_level:

            priority = (
                "critical"
                if inventory.quantity_available == 0
                else "high"
            )

            alert = models.Alert(
                alert_type="inventory",
                title=f"Low Stock: {product.name}",
                description=(
                    f"Only {inventory.quantity_available} left "
                    f"(threshold: {inventory.reorder_level})."
                ),
                priority=priority,
                business_id=business_id,
                is_read=False,
            )

            db.add(alert)
            alerts_created += 1

    # ------------------------------------------------------------
    # REMOVE ANY STALE ALERTS
    # ------------------------------------------------------------

    active_products = (
        db.query(models.Product)
        .filter(
            models.Product.business_id == business_id,
            models.Product.is_active == True,
        )
        .all()
    )

    stale_alerts = (
        db.query(models.Alert)
        .filter(
            models.Alert.business_id == business_id,
            models.Alert.alert_type == "inventory",
            models.Alert.is_read == False,
        )
        .all()
    )

    removed_alerts = 0

    for alert in stale_alerts:

        matched_product = None

        for product in active_products:

            expected_title = f"Low Stock: {product.name}"

            if alert.title == expected_title:
                matched_product = product
                break

        # Product no longer exists
        if matched_product is None:

            alert.is_read = True
            removed_alerts += 1
            continue

        inventory = (
            db.query(models.Inventory)
            .filter(
                models.Inventory.product_id == matched_product.id
            )
            .first()
        )

        # Product has normal stock
        if (
            inventory is None
            or inventory.quantity_available > inventory.reorder_level
        ):
            alert.is_read = True
            removed_alerts += 1

    # ------------------------------------------------------------
    # SAVE
    # ------------------------------------------------------------

    db.commit()

    return {
        "message": "Duplicate product cleanup completed.",
        "duplicate_groups_merged": merged_groups,
        "products_deactivated": removed_products,
        "inventory_alerts_recreated": alerts_created,
        "stale_alerts_removed": removed_alerts,
    }
    