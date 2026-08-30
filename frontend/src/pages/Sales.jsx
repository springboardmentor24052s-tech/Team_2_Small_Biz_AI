import { useEffect, useState } from 'react'
import api from '../services/api'

import {
  Loading,
  PageHeader,
  Badge,
  ErrorBanner,
} from '../components/ui.jsx'

import InteractiveTable, {
  DetailModal,
} from '../components/InteractiveTable.jsx'

import {
  Upload,
  Plus,
  Download,
  ShoppingCart,
  IndianRupee,
  Users,
  Calendar,
} from 'lucide-react'

import { downloadCSV } from '../utils/csv'

export default function Sales() {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])

  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [uploadMsg, setUploadMsg] = useState(null)
  const [error, setError] = useState(null)

  const [selectedSale, setSelectedSale] = useState(null)

  const [form, setForm] = useState({
    product_id: '',
    customer_id: '',
    quantity: 1,
    unit_price: '',
  })

  const [refreshKey, setRefreshKey] = useState(0)

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  useEffect(() => {
    let active = true

    const fetchData = async () => {
      try {
        const [salesRes, productsRes, customersRes] =
          await Promise.all([
            api.get('/sales/'),
            api.get('/inventory/products'),
            api.get('/customers/'),
          ])

        if (active) {
          setSales(
            Array.isArray(salesRes.data)
              ? salesRes.data
              : []
          )

          setProducts(
            Array.isArray(productsRes.data)
              ? productsRes.data
              : []
          )

          setCustomers(
            Array.isArray(customersRes.data)
              ? customersRes.data
              : []
          )

          setError(null)
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.detail ||
              err.message ||
              'Failed to load sales data.'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      active = false
    }
  }, [refreshKey])

  const load = () => {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  // --------------------------------------------------
  // PRODUCT CHANGE
  // --------------------------------------------------

  const handleProductChange = (e) => {
    const productId = e.target.value

    const product = products.find(
      (p) => String(p.id) === productId
    )

    setForm((current) => ({
      ...current,
      product_id: productId,
      unit_price:
        product?.selling_price ??
        product?.price ??
        '',
    }))
  }

  // --------------------------------------------------
  // FORM SUBMIT
  // --------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      await api.post('/sales/', {
        product_id: form.product_id
          ? Number(form.product_id)
          : null,

        customer_id: form.customer_id
          ? Number(form.customer_id)
          : null,

        quantity: Number(form.quantity),

        unit_price: Number(form.unit_price),
      })

      setShowForm(false)

      setForm({
        product_id: '',
        customer_id: '',
        quantity: 1,
        unit_price: '',
      })

      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Could not record sale.'
      )
    }
  }

  // --------------------------------------------------
  // CSV UPLOAD
  // --------------------------------------------------

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]

    if (!file) return

    const data = new FormData()
    data.append('file', file)

    setUploadMsg('Uploading...')
    setError(null)

    try {
      const res = await api.post(
        '/sales/upload-csv',
        data,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setUploadMsg(
        `Uploaded: ${
          res.data.sales_created
        } sales created, ${
          res.data.rows_skipped
        } rows skipped.`
      )

      load()
    } catch (err) {
      setUploadMsg(
        err.response?.data?.detail ||
          'Upload failed.'
      )
    }

    e.target.value = ''
  }

  // --------------------------------------------------
  // CSV EXPORT
  // --------------------------------------------------

  const handleExport = () => {
    const rows = sales.map((sale) => {
      const product = products.find(
        (p) => p.id === sale.product_id
      )

      const customer = customers.find(
        (c) => c.id === sale.customer_id
      )

      return [
        sale.sale_date
          ? sale.sale_date.slice(0, 10)
          : '',

        product?.name || '',

        customer?.name ||
          customer?.full_name ||
          '',

        sale.quantity,

        sale.unit_price,

        sale.total_amount,

        sale.source,
      ]
    })

    downloadCSV(
      'sales.csv',
      [
        'Date',
        'Product',
        'Customer',
        'Qty',
        'Unit Price',
        'Total',
        'Source',
      ],
      rows
    )
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return <Loading label="Loading sales..." />
  }

  // --------------------------------------------------
  // SUMMARY
  // --------------------------------------------------

  const totalRevenue = sales.reduce(
    (total, sale) =>
      total + Number(sale.total_amount || 0),
    0
  )

  const avgSale =
    sales.length > 0
      ? Math.round(totalRevenue / sales.length)
      : 0

  // --------------------------------------------------
  // TABLE COLUMNS
  // --------------------------------------------------

  const columns = [
    {
      key: 'sale_date',
      label: 'Date',
      render: (value) => (
        <span className="text-slate-500 dark:text-slate-400">
          {value
            ? new Date(value).toLocaleDateString()
            : '—'}
        </span>
      ),
    },

    {
      key: 'product_name',
      label: 'Product',
      render: (value) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {value || '—'}
        </span>
      ),
    },

    {
      key: 'customer_name',
      label: 'Customer',
    },

    {
      key: 'quantity',
      label: 'Qty',
    },

    {
      key: 'unit_price',
      label: 'Price',
      render: (value) =>
        `₹${Number(value || 0).toLocaleString(
          'en-IN'
        )}`,
    },

    {
      key: 'total_amount',
      label: 'Total',
      render: (value) => (
        <span className="font-semibold">
          ₹
          {Number(value || 0).toLocaleString(
            'en-IN'
          )}
        </span>
      ),
    },

    {
      key: 'source',
      label: 'Source',
      render: (value) => (
        <Badge
          tone={
            value === 'csv_upload'
              ? 'blue'
              : value === 'seed'
              ? 'slate'
              : 'green'
          }
        >
          {value || '—'}
        </Badge>
      ),
    },
  ]

  // --------------------------------------------------
  // ENRICH SALES
  // --------------------------------------------------

  const enrichedSales = sales.map((sale) => {
    const product = products.find(
      (p) => p.id === sale.product_id
    )

    const customer = customers.find(
      (c) => c.id === sale.customer_id
    )

    return {
      ...sale,

      product_name:
        sale.product_name ||
        product?.name ||
        (sale.product_id
          ? `#${sale.product_id}`
          : '—'),

      customer_name:
        sale.customer_name ||
        customer?.name ||
        customer?.full_name ||
        '—',
    }
  })

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Sales data upload, transaction records, and history."
        action={
          <div className="flex gap-2">
            {/* Upload CSV */}
            <label className="btn-secondary cursor-pointer flex items-center gap-2">
              <Upload size={16} />

              Upload CSV

              <input
                type="file"
                accept=".csv"
                onChange={handleUpload}
                className="hidden"
              />
            </label>

            {/* Export CSV */}
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2"
            >
              <Download size={16} />

              Export CSV
            </button>

            {/* Add Sale */}
            <button
              onClick={() => {
                setShowForm((value) => !value)
                setError(null)
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />

              {showForm ? 'Cancel' : 'Add Sale'}
            </button>
          </div>
        }
      />

      {/* Summary Stats */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card text-center p-3">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {sales.length}
          </p>

          <p className="text-[10px] text-slate-500 uppercase">
            Total Sales
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-emerald-600">
            ₹
            {totalRevenue.toLocaleString('en-IN')}
          </p>

          <p className="text-[10px] text-slate-500 uppercase">
            Total Revenue
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-blue-600">
            ₹
            {avgSale.toLocaleString('en-IN')}
          </p>

          <p className="text-[10px] text-slate-500 uppercase">
            Avg Sale Value
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-purple-600">
            {customers.length}
          </p>

          <p className="text-[10px] text-slate-500 uppercase">
            Customers
          </p>
        </div>
      </div>

      {/* Upload message */}

      {uploadMsg && (
        <div className="bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-4 py-3 text-sm mb-4 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900/60">
          {uploadMsg}
        </div>
      )}

      {/* Error */}

      {error && !showForm && (
        <ErrorBanner message={error} />
      )}

      {/* Add Sale Form */}

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
          >
            {/* Product */}

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Product
              </label>

              <select
                className="input mt-1"
                value={form.product_id}
                onChange={handleProductChange}
                required
              >
                <option value="">
                  Select product
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer */}

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Customer
              </label>

              <select
                className="input mt-1"
                value={form.customer_id}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    customer_id: e.target.value,
                  }))
                }
              >
                <option value="">
                  Walk-in / none
                </option>

                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name ||
                      customer.full_name ||
                      'Unnamed Customer'}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Quantity
              </label>

              <input
                type="number"
                min="1"
                className="input mt-1"
                value={form.quantity}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    quantity: e.target.value,
                  }))
                }
                required
              />
            </div>

            {/* Unit Price */}

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Unit Price (₹)
              </label>

              <input
                type="number"
                step="0.01"
                className="input mt-1"
                value={form.unit_price}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    unit_price: e.target.value,
                  }))
                }
                required
              />
            </div>

            {/* Submit */}

            <button
              type="submit"
              className="btn-primary col-span-2 md:col-span-1"
            >
              Record Sale
            </button>
          </form>
        </div>
      )}

      {/* Sales Table */}

      <div className="card">
        <InteractiveTable
          data={enrichedSales}
          columns={columns}
          searchableKeys={[
            'product_name',
            'customer_name',
            'source',
          ]}
          onRowClick={setSelectedSale}
          emptyMessage="No sales recorded yet."
        />
      </div>

      {/* Sale Detail Modal */}

      <DetailModal
        title={
          selectedSale
            ? `Sale #${selectedSale.id}`
            : ''
        }
        subtitle={
          selectedSale?.sale_date
            ? new Date(
                selectedSale.sale_date
              ).toLocaleString()
            : ''
        }
        onClose={() => setSelectedSale(null)}
      >
        {selectedSale && (
          <div>
            <DetailModal.Row
              label="Product"
              value={selectedSale.product_name}
              icon={ShoppingCart}
              tone="brand"
            />

            <DetailModal.Row
              label="Customer"
              value={
                selectedSale.customer_name ||
                '—'
              }
              icon={Users}
            />

            <DetailModal.Row
              label="Quantity"
              value={selectedSale.quantity}
            />

            <DetailModal.Row
              label="Unit Price"
              value={`₹${Number(
                selectedSale.unit_price || 0
              ).toLocaleString('en-IN')}`}
              icon={IndianRupee}
              tone="green"
            />

            <DetailModal.Row
              label="Total"
              value={`₹${Number(
                selectedSale.total_amount || 0
              ).toLocaleString('en-IN')}`}
              icon={IndianRupee}
              tone="green"
            />

            <DetailModal.Row
              label="Source"
              value={
                <Badge
                  tone={
                    selectedSale.source ===
                    'csv_upload'
                      ? 'blue'
                      : selectedSale.source ===
                        'seed'
                      ? 'slate'
                      : 'green'
                  }
                >
                  {selectedSale.source || '—'}
                </Badge>
              }
            />

            <DetailModal.Row
              label="Date"
              value={
                selectedSale.sale_date
                  ? new Date(
                      selectedSale.sale_date
                    ).toLocaleDateString(
                      'en-IN',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }
                    )
                  : '—'
              }
              icon={Calendar}
            />
          </div>
        )}
      </DetailModal>
    </div>
  )
}