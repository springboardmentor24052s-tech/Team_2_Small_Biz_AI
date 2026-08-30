import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../services/api";
import {
  Loading,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

import {
  Plus,
  PackagePlus,
  PackageMinus,
  Upload,
  Search,
  ShoppingCart,
  AlertTriangle,
  X,
  Download,
} from "lucide-react";

import { downloadCSV } from "../utils/csv";

const emptyForm = {
  name: "",
  category_id: "",
  selling_price: "",
  purchase_price: "",
  stock_quantity: 0,
  reorder_level: 10,
  warehouse_location: "",
};

// ================================================================
// REORDER MODAL (NEW)
//
// Replaces the old window.prompt()-based flow with a proper dialog
// that shows current stock, reorder level, and a suggested quantity
// the user can adjust before confirming. Used from every entry
// point that needs a reorder action: Low Stock Alerts (out-of-stock
// and low-stock rows), the bulk "Reorder All" button, and each row
// in the main table.
// ================================================================

function ReorderModal({ product, defaultQty, onConfirm, onClose, submitting }) {
  const [qty, setQty] = useState(defaultQty);

  if (!product) return null;

  const stock = Number(product?.inventory?.quantity_available ?? 0);
  const reorderLevel = Number(product?.inventory?.reorder_level ?? 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity <= 0) return;
    onConfirm(quantity);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Reorder Stock
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {product?.name || "This product"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Current Stock</p>
            <p className={`font-semibold ${stock === 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>
              {stock}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Reorder Level</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{reorderLevel}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Reorder Quantity
          </label>
          <input
            type="number"
            min="1"
            step="1"
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-1.5 text-xs"
              disabled={submitting}
            >
              <ShoppingCart size={14} />
              {submitting ? "Placing order..." : "Confirm Reorder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const { hasRole } = useAuth();

  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [error, setError] = useState(null);
  const [uploadMsg, setUploadMsg] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [reorderTarget, setReorderTarget] = useState(null); // product being reordered via modal
  const [reorderSubmitting, setReorderSubmitting] = useState(false);
  const [reorderingAll, setReorderingAll] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const canCreate = hasRole(
    "business_owner",
    "store_manager",
    "admin"
  );

  // ============================================================
  // LOAD INVENTORY
  // ============================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        productsRes,
        stockRes,
        alertsRes,
        categoriesRes,
      ] = await Promise.all([
        api.get("/inventory/products"),
        api.get("/inventory/stock"),
        api.get("/inventory/alerts"),
        api.get("/categories/"),
      ]);

      const categoriesData = Array.isArray(categoriesRes?.data)
        ? categoriesRes.data
        : [];

      setCategories(categoriesData);

      const categoryMap = {};

      categoriesData.forEach((category) => {
        const categoryId = category?.id ?? category?._id;
        const categoryName =
          category?.category_name ||
          category?.name ||
          category?.title;

        if (categoryId != null && categoryName) {
          categoryMap[String(categoryId)] = categoryName;
        }
      });

      const stockMap = {};

      const stockData = Array.isArray(stockRes?.data)
        ? stockRes.data
        : [];

      stockData.forEach((stock) => {
        const productId =
          stock?.product_id ??
          stock?.productId ??
          stock?.product?.id ??
          stock?.product?._id;

        if (productId != null) {
          stockMap[String(productId)] = stock;
        }
      });

      const productData = Array.isArray(productsRes?.data)
        ? productsRes.data
        : [];

      const mergedProducts = productData.map((product) => {
        const productId = product?.id ?? product?._id;

        let categoryName = null;

        if (product?.category_name) {
          categoryName = product.category_name;
        } else if (
          typeof product?.category === "object" &&
          product?.category !== null
        ) {
          categoryName =
            product.category?.name ||
            product.category?.category_name ||
            product.category?.title ||
            null;
        } else {
          const rawCategoryId = product?.category_id ?? product?.category;

          const categoryId =
            typeof rawCategoryId === "object"
              ? rawCategoryId?.id ?? rawCategoryId?._id
              : rawCategoryId;

          if (categoryId != null && categoryMap[String(categoryId)]) {
            categoryName = categoryMap[String(categoryId)];
          }
        }

        if (!categoryName || categoryName.toLowerCase() === "uncategorized") {
          const title = String(product?.name || "").toLowerCase();

          if (title.includes("tea") || title.includes("coffee")) {
            categoryName = "Beverages";
          } else if (title.includes("soap") || title.includes("shampoo")) {
            categoryName = "Personal Care";
          } else if (
            title.includes("oil") ||
            title.includes("rice") ||
            title.includes("dal") ||
            title.includes("atta")
          ) {
            categoryName = "Groceries";
          } else if (title.includes("pan") || title.includes("bottle")) {
            categoryName = "Kitchenware";
          } else if (title.includes("bulb")) {
            categoryName = "Electronics";
          } else if (title.includes("notebook")) {
            categoryName = "Stationery";
          } else {
            categoryName = "Uncategorized";
          }
        }

        const stockRecord = productId != null ? stockMap[String(productId)] : null;

        const quantity =
          stockRecord?.quantity_available ??
          stockRecord?.stock_quantity ??
          product?.stock_quantity ??
          product?.quantity_available ??
          0;

        const reorderLevel =
          stockRecord?.reorder_level ??
          product?.reorder_level ??
          10;

        const warehouseLocation =
          stockRecord?.warehouse_location ??
          product?.warehouse_location ??
          null;

        return {
          ...product,
          id: productId,
          category_name: categoryName,
          inventory: {
            quantity_available: Number(quantity) || 0,
            reorder_level: Number(reorderLevel) || 0,
            warehouse_location: warehouseLocation,
          },
        };
      });

      setProducts(mergedProducts);
      setAlerts(Array.isArray(alertsRes?.data) ? alertsRes.data : []);
    } catch (err) {
      console.error("Inventory load error:", err);
      setError(err.response?.data?.detail || err.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ============================================================
  // LOW STOCK / OUT OF STOCK
  // ============================================================

  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = Number(product?.inventory?.quantity_available ?? 0);
      const reorderLevel = Number(product?.inventory?.reorder_level ?? 0);
      return stock > 0 && stock <= reorderLevel;
    });
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = Number(product?.inventory?.quantity_available ?? 0);
      return stock === 0;
    });
  }, [products]);

  const needsRestock = useMemo(
    () => [...outOfStockProducts, ...lowStockProducts],
    [outOfStockProducts, lowStockProducts]
  );

  // ============================================================
  // FILTER PRODUCTS -- reads `products` directly, one row per real
  // product/batch, same source the alerts widget uses.
  // ============================================================

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const name = String(product?.name || "").toLowerCase();
      const sku = String(product?.sku || "").toLowerCase();
      const category = String(product?.category_name || "").toLowerCase();
      const stock = Number(product?.inventory?.quantity_available ?? 0);
      const reorderLevel = Number(product?.inventory?.reorder_level ?? 0);

      const matchesSearch =
        !query || name.includes(query) || sku.includes(query) || category.includes(query);

      let matchesStatus = true;

      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "low_stock") {
        matchesStatus = stock > 0 && stock <= reorderLevel;
      } else if (statusFilter === "out_of_stock") {
        matchesStatus = stock === 0;
      } else if (statusFilter === "in_stock") {
        matchesStatus = stock > reorderLevel;
      }

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  // ============================================================
  // STOCK STATUS
  // ============================================================

  const getStatus = (product) => {
    const stock = Number(product?.inventory?.quantity_available ?? 0);
    const reorderLevel = Number(product?.inventory?.reorder_level ?? 0);

    if (stock === 0) {
      return {
        label: "Out of Stock",
        className:
          "bg-red-100 text-red-800 border border-red-200 " +
          "dark:bg-red-950/80 dark:text-red-300 dark:border-red-800/60",
      };
    }

    if (stock <= reorderLevel) {
      return {
        label: `${stock} · Low Stock`,
        className:
          "bg-amber-100 text-amber-800 border border-amber-200 " +
          "dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/60",
      };
    }

    return {
      label: `${stock} · In Stock`,
      className:
        "bg-emerald-100 text-emerald-800 border border-emerald-200 " +
        "dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60",
    };
  };

  // ============================================================
  // CSV UPLOAD / EXPORT
  // ============================================================

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadMsg("Uploading products...");
    setError(null);

    const data = new FormData();
    data.append("file", file);

    try {
      const response = await api.post("/inventory/products/upload-csv", data);
      const result = response.data || {};

      setUploadMsg(
        `Import complete: ${result.unique_products ?? 0} unique products, ${
          result.products_created ?? 0
        } created, ${result.products_updated ?? 0} updated.`
      );

      await load();
    } catch (err) {
      console.error("CSV upload error:", err);
      setUploadMsg(null);
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      event.target.value = "";
    }
  };

  const handleExport = () => {
    const rows = filteredProducts.map((product) => [
      product?.name || "",
      product?.category_name || "",
      Number(product?.selling_price || 0),
      Number(product?.inventory?.quantity_available ?? 0),
      Number(product?.inventory?.reorder_level ?? 0),
      product?.inventory?.warehouse_location || "",
    ]);

    downloadCSV(
      "inventory.csv",
      ["Name", "Category", "Price", "Stock", "Reorder Level", "Warehouse Location"],
      rows
    );
  };

  // ============================================================
  // CREATE PRODUCT
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    try {
      await api.post("/inventory/products", {
        name: form.name.trim(),
        category_id: form.category_id ? String(form.category_id) : null,
        selling_price: Number(form.selling_price),
        purchase_price: Number(form.purchase_price || 0),
        stock_quantity: Number(form.stock_quantity),
        reorder_level: Number(form.reorder_level),
        warehouse_location: form.warehouse_location.trim() || null,
      });

      setForm({ ...emptyForm });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error("Create product error:", err);
      setError(err.response?.data?.detail || "Could not create product.");
    }
  };

  // ============================================================
  // ADJUST STOCK (+1 / -1 quick buttons)
  // ============================================================

  const adjustStock = async (productId, delta) => {
    if (!productId) {
      setError("Product ID is missing. Cannot update stock.");
      return;
    }

    try {
      setError(null);

      await api.patch(`/inventory/products/${productId}/stock`, {
        quantity_delta: delta,
        transaction_type: delta > 0 ? "IN" : "OUT",
        remarks: delta > 0 ? "Manual stock addition" : "Manual stock deduction",
      });

      await load();
    } catch (err) {
      console.error("Stock update error:", err);
      setError(err.response?.data?.detail || "Could not update stock.");
    }
  };

  // ============================================================
  // REORDER -- single product, via modal
  //
  // Every low-stock or out-of-stock item (in the alerts widget, the
  // bulk action, and every row of the main table) opens this same
  // modal instead of a plain browser prompt.
  // ============================================================

  const suggestedReorderQty = (product) => {
    const stock = Number(product?.inventory?.quantity_available ?? 0);
    const reorderLevel = Number(product?.inventory?.reorder_level ?? 10);

    // If stock = 0 and reorder level = 10 -> suggested = 20
    // If stock = 3 and reorder level = 10 -> suggested = 17
    // If stock = 15 and reorder level = 10 -> suggested = 10
    return Math.max(reorderLevel * 2 - stock, reorderLevel, 1);
  };

  const openReorderModal = (product) => {
    setError(null);
    setReorderTarget(product);
  };

  const closeReorderModal = () => {
    if (reorderSubmitting) return;
    setReorderTarget(null);
  };

  const confirmReorder = async (quantity) => {
    const product = reorderTarget;
    const productId = product?.id ?? product?._id;

    if (!productId) {
      setError("Product ID is missing. Cannot reorder this product.");
      setReorderTarget(null);
      return;
    }

    try {
      setReorderSubmitting(true);
      setError(null);

      await api.post(`/inventory/products/${productId}/reorder`, null, {
        params: { quantity },
      });

      await load();

      setUploadMsg(
        `${product?.name || "Product"}: ${quantity} units reordered successfully.`
      );
      setReorderTarget(null);
    } catch (err) {
      console.error("Reorder error:", err);
      setError(err.response?.data?.detail || "Could not reorder product.");
    } finally {
      setReorderSubmitting(false);
    }
  };

  // ============================================================
  // REORDER ALL -- bulk action for every low/out-of-stock item
  // ============================================================

  const handleReorderAll = async () => {
    if (needsRestock.length === 0) return;

    const confirmed = window.confirm(
      `Reorder suggested quantities for all ${needsRestock.length} item(s) that need restocking?`
    );

    if (!confirmed) return;

    setReorderingAll(true);
    setError(null);

    const failures = [];

    for (const product of needsRestock) {
      const productId = product?.id ?? product?._id;

      if (!productId) {
        failures.push(product?.name || "Unnamed product");
        continue;
      }

      const quantity = suggestedReorderQty(product);

      try {
        await api.post(`/inventory/products/${productId}/reorder`, null, {
          params: { quantity },
        });
      } catch (err) {
        console.error("Bulk reorder error:", err);
        failures.push(product?.name || `#${productId}`);
      }
    }

    await load();
    setReorderingAll(false);

    if (failures.length === 0) {
      setUploadMsg(`Reordered suggested quantities for all ${needsRestock.length} item(s).`);
    } else {
      setError(
        `Reordered ${needsRestock.length - failures.length} item(s); failed for: ${failures.join(", ")}.`
      );
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return <Loading label="Loading inventory..." />;
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-100">
      <PageHeader
        title="Inventory"
        subtitle="Stock monitoring, reorder alerts, and warehouse tracking."
        action={
          canCreate && (
            <div className="flex items-center gap-2">
              <label className="btn-secondary flex cursor-pointer items-center gap-2 text-xs">
                <Upload size={14} />
                Upload CSV
                <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
              </label>

              <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-xs">
                <Download size={14} />
                Export CSV
              </button>

              <button
                onClick={() => setShowForm((value) => !value)}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                <Plus size={14} />
                {showForm ? "Cancel" : "Add Product"}
              </button>
            </div>
          )
        }
      />

      <ErrorBanner message={error} />

      {uploadMsg && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
          <span>{uploadMsg}</span>
          <button
            onClick={() => setUploadMsg(null)}
            className="text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ======================================================
          LOW STOCK ALERTS -- Reorder button on every row, plus a
          bulk "Reorder All" for the whole list.
          ====================================================== */}

      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle size={15} />
            Low Stock Alerts
          </h3>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
              {needsRestock.length} items needing restock
            </span>

            {canCreate && needsRestock.length > 0 && (
              <button
                onClick={handleReorderAll}
                disabled={reorderingAll}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                <ShoppingCart size={11} />
                {reorderingAll ? "Reordering..." : "Reorder All"}
              </button>
            )}
          </div>
        </div>

        {lowStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            All products are above their reorder level.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* OUT OF STOCK -- Reorder button */}
            {outOfStockProducts.map((product) => (
              <div
                key={`out-${product.id}`}
                className="flex items-center justify-between rounded-md border border-red-200/60 bg-white px-2.5 py-1.5 dark:border-red-900/50 dark:bg-slate-900"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                    {product.name || "Unnamed Product"}
                  </p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {product.category_name || "Uncategorized"} · Reorder: {product.inventory?.reorder_level}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950/80 dark:text-red-300">
                    Out
                  </span>

                  {canCreate && (
                    <button
                      onClick={() => openReorderModal(product)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-200 dark:border dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300 dark:hover:bg-amber-900"
                    >
                      <ShoppingCart size={11} />
                      Reorder
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* LOW STOCK -- Reorder button */}
            {lowStockProducts.map((product) => {
              const stock = Number(product.inventory?.quantity_available ?? 0);
              const reorder = Number(product.inventory?.reorder_level ?? 0);

              return (
                <div
                  key={`low-${product.id}`}
                  className="flex items-center justify-between rounded-md border border-amber-200/50 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                      {product.name || "Unnamed Product"}
                    </p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {product.category_name || "Uncategorized"} · Reorder: {reorder}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                      Qty: {stock}
                    </span>

                    {canCreate && (
                      <button
                        onClick={() => openReorderModal(product)}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-200 dark:border dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300 dark:hover:bg-amber-900"
                      >
                        <ShoppingCart size={11} />
                        Reorder
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================
          ADD PRODUCT FORM
          ====================================================== */}

      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-xs font-semibold text-slate-900 dark:text-slate-100">Add Product</h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 items-end gap-2.5 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Product Name</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map((category) => {
                  const id = category.id ?? category._id;
                  const name = category.category_name || category.name || category.title;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Selling Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Purchase Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Initial Stock</label>
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Reorder Level</label>
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.reorder_level}
                onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Warehouse Location</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.warehouse_location}
                onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })}
              />
            </div>

            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="btn-primary">Save Product</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================
          INVENTORY TABLE -- Reorder button on every row
          ====================================================== */}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Search products or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800">
            {[
              ["all", "All"],
              ["low_stock", "Low Stock"],
              ["out_of_stock", "Out of Stock"],
              ["in_stock", "In Stock"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-md px-2 py-0.5 transition-all ${
                  statusFilter === value
                    ? "bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <EmptyState
            message={
              statusFilter === "out_of_stock"
                ? "No out-of-stock products found."
                : statusFilter === "low_stock"
                ? "No low-stock products found."
                : "No matching products in inventory."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Price</th>
                  <th className="pb-2 pr-3">Stock</th>
                  <th className="pb-2 pr-3">Location</th>
                  <th className="pb-2 pr-3">Status</th>
                  {canCreate && <th className="pb-2 pr-3">Actions</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredProducts.map((product) => {
                  const status = getStatus(product);
                  const stock = Number(product.inventory?.quantity_available ?? 0);
                  const reorderLevel = Number(product.inventory?.reorder_level ?? 0);
                  const productId = product?.id ?? product?._id;
                  const needsReorder = stock <= reorderLevel; // low stock OR out of stock

                  return (
                    <tr
                      key={productId ?? product.name}
                      className="text-slate-700 hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                        {product.name || "Unnamed Product"}
                        {product.sku && (
                          <div className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            SKU: {product.sku}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 pr-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {product.category_name || "Uncategorized"}
                        </span>
                      </td>

                      <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100">
                        ₹
                        {Number(product.selling_price || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-200">{stock}</td>

                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">
                        {product.inventory?.warehouse_location || "—"}
                      </td>

                      <td className="py-2.5 pr-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>

                      {canCreate && (
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1">
                            {/* REORDER -- shown for low stock & out of stock,
                                always available for every product either way */}
                            <button
                              onClick={() => openReorderModal(product)}
                              title={needsReorder ? "Reorder stock (needed)" : "Reorder stock"}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                                needsReorder
                                  ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300 dark:hover:bg-amber-900"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              <ShoppingCart size={12} />
                              Reorder
                            </button>

                            <button
                              onClick={() => adjustStock(productId, 1)}
                              title="Increase stock by 1"
                              className="rounded-md p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <PackagePlus size={15} />
                            </button>

                            <button
                              onClick={() => adjustStock(productId, -1)}
                              title="Decrease stock by 1"
                              disabled={stock <= 0}
                              className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <PackageMinus size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REORDER MODAL */}
      <ReorderModal
        product={reorderTarget}
        defaultQty={reorderTarget ? suggestedReorderQty(reorderTarget) : 1}
        onConfirm={confirmReorder}
        onClose={closeReorderModal}
        submitting={reorderSubmitting}
      />
    </div>
  );
}