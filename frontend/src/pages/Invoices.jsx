import { useEffect, useState, useCallback } from 'react'

import api from '../services/api'

import {
  Loading,
  PageHeader,
  Badge,
  EmptyState,
  ErrorBanner,
} from '../components/ui.jsx'

import { DetailModal } from '../components/InteractiveTable.jsx'

import {
  FileText,
  IndianRupee,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Filter,
} from 'lucide-react'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [sales, setSales] = useState([])
  const [customers, setCustomers] = useState([])

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    sale_id: '',
    due_date: '',
  })

  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  // ============================================================
  // STATUS TONES
  // ============================================================

  const STATUS_TONE = {
    paid: 'green',
    pending: 'amber',
    overdue: 'red',
  }

  // ============================================================
  // LOAD DATA
  // ============================================================

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [invoiceRes, salesRes, customerRes] =
        await Promise.all([
          api.get('/invoices/'),
          api.get('/sales/'),
          api.get('/customers/'),
        ])

      setInvoices(
        Array.isArray(invoiceRes.data)
          ? invoiceRes.data
          : invoiceRes.data?.items || []
      )

      setSales(
        Array.isArray(salesRes.data)
          ? salesRes.data
          : salesRes.data?.items || []
      )

      setCustomers(
        Array.isArray(customerRes.data)
          ? customerRes.data
          : customerRes.data?.items || []
      )
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to load invoice data.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ============================================================
  // CUSTOMER NAME
  // ============================================================

  const getCustomerName = (customerId) => {
    const customer = customers.find(
      (c) => c.id === customerId
    )

    return (
      customer?.full_name ||
      customer?.name ||
      customer?.customer_name ||
      'Unknown Customer'
    )
  }

  // ============================================================
  // SALE CUSTOMER
  // ============================================================

  const getSaleCustomerName = (sale) => {
    return getCustomerName(sale.customer_id)
  }

  // ============================================================
  // SALE AMOUNT
  // ============================================================

  const getSaleAmount = (sale) => {
    return Number(
      sale.total_amount ??
        sale.total ??
        sale.subtotal ??
        sale.amount ??
        0
    )
  }

  // ============================================================
  // CREATE INVOICE
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.sale_id) {
      setError('Please select a sale.')
      return
    }

    try {
      setCreating(true)

      await api.post('/invoices/', {
        sale_id: Number(form.sale_id),
        due_date: form.due_date || null,
      })

      setForm({
        sale_id: '',
        due_date: '',
      })

      setShowForm(false)

      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Could not create invoice.'
      )
    } finally {
      setCreating(false)
    }
  }

  // ============================================================
  // UPDATE STATUS
  // ============================================================

  const updateStatus = async (id, status) => {
    try {
      setError(null)

      await api.patch(
        `/invoices/${id}/status`,
        { status }
      )

      await load()

      // Update selected modal if it is open
      setSelected((current) => {
        if (!current || current.id !== id) {
          return current
        }

        return {
          ...current,
          status,
          invoice_status: status,
        }
      })
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Could not update invoice status.'
      )
    }
  }

  // ============================================================
  // AVAILABLE SALES
  // ============================================================

  const invoiceSaleIds = new Set(
    invoices
      .map((invoice) => invoice.sale_id)
      .filter(Boolean)
  )

  const availableSales = sales.filter(
    (sale) => !invoiceSaleIds.has(sale.id)
  )

  // ============================================================
  // FILTER INVOICES
  // ============================================================

  const filtered = invoices.filter((invoice) => {
    const status =
      invoice.status ||
      invoice.invoice_status ||
      'pending'

    if (
      statusFilter !== 'all' &&
      status !== statusFilter
    ) {
      return false
    }

    if (search.trim()) {
      const q = search.toLowerCase()

      const invoiceNumber =
        invoice.invoice_number ||
        `INV-${invoice.id}`

      const customerName =
        invoice.customer_name ||
        (() => {
          const sale = sales.find(
            (s) => s.id === invoice.sale_id
          )

          return sale
            ? getSaleCustomerName(sale)
            : ''
        })()

      return (
        invoiceNumber
          .toLowerCase()
          .includes(q) ||
        customerName
          .toLowerCase()
          .includes(q)
      )
    }

    return true
  })

  // ============================================================
  // SUMMARY
  // ============================================================

  const totalCount = invoices.length

  const paidCount = invoices.filter(
    (i) =>
      (i.status || i.invoice_status) === 'paid'
  ).length

  const pendingCount = invoices.filter(
    (i) =>
      (i.status || i.invoice_status) === 'pending'
  ).length

  const overdueCount = invoices.filter(
    (i) =>
      (i.status || i.invoice_status) === 'overdue'
  ).length

  const totalAmount = invoices.reduce(
    (sum, invoice) => {
      const sale = sales.find(
        (s) => s.id === invoice.sale_id
      )

      const amount =
        invoice.amount ??
        invoice.total_amount ??
        (sale ? getSaleAmount(sale) : 0)

      return sum + Number(amount || 0)
    },
    0
  )

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return <Loading label="Loading invoices..." />
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="w-full text-slate-900 dark:text-slate-100">

      {/* PAGE HEADER */}

      <PageHeader
        title="Invoices"
        subtitle="Track payment status and manage billing."
        action={
          <button
            type="button"
            onClick={() => {
              setShowForm((value) => !value)
              setError(null)
            }}
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              bg-slate-900
              px-4
              py-2
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-slate-800
              dark:bg-white
              dark:text-slate-900
              dark:hover:bg-slate-100
            "
          >
            <Plus size={15} />

            {showForm
              ? 'Cancel'
              : 'New Invoice'}
          </button>
        }
      />

      <ErrorBanner message={error} />

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {totalCount}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Total
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-emerald-600">
            {paidCount}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Paid
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-amber-600">
            {pendingCount}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Pending
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-red-600">
            {overdueCount}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Overdue
          </p>
        </div>

        <div className="card text-center p-3">
          <p className="text-xl font-bold text-blue-600">
            ₹{totalAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Total Amount
          </p>
        </div>

      </div>

      {/* CREATE INVOICE FORM */}

      {showForm && (
        <div
          className="
            mb-6
            rounded-xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
            dark:border-slate-700
            dark:bg-slate-900
          "
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Create New Invoice
            </h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Select an existing sale and assign a due date.
            </p>
          </div>

          {availableSales.length === 0 ? (
            <div
              className="
                rounded-lg
                border
                border-amber-300
                bg-amber-50
                px-4
                py-4
                text-sm
                font-medium
                text-amber-800
                dark:border-amber-700
                dark:bg-amber-900/20
                dark:text-amber-300
              "
            >
              No sales are available for invoicing.
              Create a sale first from the Sales page.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-5 md:grid-cols-2"
            >

              {/* SALE */}

              <div>
                <label
                  htmlFor="sale_id"
                  className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Sale
                </label>

                <select
                  id="sale_id"
                  value={form.sale_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sale_id: e.target.value,
                    })
                  }
                  required
                  className="
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    bg-white
                    px-3
                    py-2.5
                    text-sm
                    font-medium
                    text-slate-900
                    outline-none
                    focus:border-blue-500
                    focus:ring-2
                    focus:ring-blue-500/20
                    dark:border-slate-600
                    dark:bg-slate-800
                    dark:text-white
                  "
                >
                  <option value="">
                    Select a sale
                  </option>

                  {availableSales.map((sale) => (
                    <option
                      key={sale.id}
                      value={sale.id}
                    >
                      {sale.invoice_number ||
                        `Sale #${sale.id}`}
                      {' — '}
                      {getSaleCustomerName(sale)}
                      {' — ₹'}
                      {getSaleAmount(
                        sale
                      ).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {/* DUE DATE */}

              <div>
                <label
                  htmlFor="due_date"
                  className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Due Date
                </label>

                <input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      due_date: e.target.value,
                    })
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    bg-white
                    px-3
                    py-2.5
                    text-sm
                    font-medium
                    text-slate-900
                    outline-none
                    focus:border-blue-500
                    focus:ring-2
                    focus:ring-blue-500/20
                    dark:border-slate-600
                    dark:bg-slate-800
                    dark:text-white
                  "
                />
              </div>

              {/* CREATE */}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-blue-600
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    shadow-sm
                    transition
                    hover:bg-blue-700
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <Plus size={15} />

                  {creating
                    ? 'Creating...'
                    : 'Create Invoice'}
                </button>
              </div>

            </form>
          )}
        </div>
      )}

      {/* INVOICE TABLE */}

      <div className="card overflow-hidden">

        {/* FILTER BAR */}

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search invoices..."
              className="
                w-full
                px-3
                py-2
                text-xs
                bg-white
                dark:bg-slate-800
                border
                border-slate-200
                dark:border-slate-700
                rounded-lg
                focus:outline-none
                focus:ring-2
                focus:ring-indigo-500/20
                dark:text-slate-100
              "
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="
                  absolute
                  right-2
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                  hover:text-slate-600
                "
              >
                ✕
              </button>
            )}
          </div>

          <div
            className="
              flex
              items-center
              gap-1
              bg-slate-100
              p-1
              rounded-lg
              text-xs
              font-medium
              dark:bg-slate-800
            "
          >
            <Filter
              size={14}
              className="ml-1 mr-1 text-slate-500"
            />

            {[
              'all',
              'pending',
              'paid',
              'overdue',
            ].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  setStatusFilter(status)
                }
                className={`
                  px-3
                  py-1
                  rounded-md
                  capitalize
                  transition-all
                  ${
                    statusFilter === status
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {status}
              </button>
            ))}
          </div>

        </div>

        {/* TABLE */}

        {filtered.length === 0 ? (
          <EmptyState message="No invoices found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">

                  <th className="py-2.5 pr-4">
                    Invoice #
                  </th>

                  <th className="py-2.5 pr-4">
                    Customer
                  </th>

                  <th className="py-2.5 pr-4">
                    Amount
                  </th>

                  <th className="py-2.5 pr-4">
                    Due Date
                  </th>

                  <th className="py-2.5 pr-4">
                    Status
                  </th>

                  <th className="py-2.5 pr-4">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>

                {filtered.map((invoice) => {
                  const sale = sales.find(
                    (s) =>
                      s.id === invoice.sale_id
                  )

                  const customerName =
                    invoice.customer_name ||
                    (sale
                      ? getSaleCustomerName(sale)
                      : '—')

                  const amount = Number(
                    invoice.amount ??
                      invoice.total_amount ??
                      (sale
                        ? getSaleAmount(sale)
                        : 0)
                  )

                  const status =
                    invoice.status ||
                    invoice.invoice_status ||
                    'pending'

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() =>
                        setSelected(invoice)
                      }
                      className="
                        border-b
                        border-slate-100
                        dark:border-slate-700/60
                        cursor-pointer
                        hover:bg-indigo-50/50
                        dark:hover:bg-indigo-950/20
                        transition-colors
                      "
                    >

                      <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-100">
                        {invoice.invoice_number ||
                          `INV-${invoice.id}`}
                      </td>

                      <td className="py-2.5 pr-4">
                        {customerName}
                      </td>

                      <td className="py-2.5 pr-4 font-semibold">
                        ₹
                        {amount.toLocaleString(
                          'en-IN'
                        )}
                      </td>

                      <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">
                        {invoice.due_date
                          ? new Date(
                              invoice.due_date
                            ).toLocaleDateString(
                              'en-IN'
                            )
                          : '—'}
                      </td>

                      <td className="py-2.5 pr-4">
                        <Badge
                          tone={
                            STATUS_TONE[status] ||
                            'slate'
                          }
                        >
                          {status}
                        </Badge>
                      </td>

                      <td className="py-2.5 pr-4">

                        {status !== 'paid' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateStatus(
                                invoice.id,
                                'paid'
                              )
                            }}
                            className="
                              text-xs
                              font-medium
                              text-emerald-600
                              hover:text-emerald-700
                              dark:text-emerald-400
                            "
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Paid
                          </span>
                        )}

                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}

      {selected && (
        <DetailModal
          title={
            selected.invoice_number ||
            `INV-${selected.id}`
          }
          subtitle="Invoice Details"
          onClose={() => setSelected(null)}
        >
          <div>

            <DetailModal.Row
              label="Invoice #"
              value={
                selected.invoice_number ||
                `INV-${selected.id}`
              }
              icon={FileText}
              tone="brand"
            />

            <DetailModal.Row
              label="Customer"
              value={
                selected.customer_name ||
                (() => {
                  const sale = sales.find(
                    (s) =>
                      s.id ===
                      selected.sale_id
                  )

                  return sale
                    ? getSaleCustomerName(sale)
                    : 'Unknown'
                })()
              }
            />

            <DetailModal.Row
              label="Amount"
              value={`₹${Number(
                selected.amount ??
                  selected.total_amount ??
                  (() => {
                    const sale = sales.find(
                      (s) =>
                        s.id ===
                        selected.sale_id
                    )

                    return sale
                      ? getSaleAmount(sale)
                      : 0
                  })()
              ).toLocaleString('en-IN')}`}
              icon={IndianRupee}
              tone="green"
            />

            <DetailModal.Row
              label="Due Date"
              value={
                selected.due_date
                  ? new Date(
                      selected.due_date
                    ).toLocaleDateString(
                      'en-IN',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }
                    )
                  : 'No due date'
              }
              icon={Calendar}
            />

            <DetailModal.Row
              label="Status"
              value={
                <Badge
                  tone={
                    STATUS_TONE[
                      selected.status ||
                        selected.invoice_status ||
                        'pending'
                    ] || 'slate'
                  }
                >
                  {selected.status ||
                    selected.invoice_status ||
                    'pending'}
                </Badge>
              }
              icon={
                (selected.status ||
                  selected.invoice_status) ===
                'paid'
                  ? CheckCircle
                  : (selected.status ||
                      selected.invoice_status) ===
                    'overdue'
                  ? AlertTriangle
                  : Clock
              }
              tone={
                STATUS_TONE[
                  selected.status ||
                    selected.invoice_status ||
                    'pending'
                ] || 'slate'
              }
            />

            {(selected.status ||
              selected.invoice_status) !==
              'paid' && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={async () => {
                    await updateStatus(
                      selected.id,
                      'paid'
                    )
                    setSelected(null)
                  }}
                  className="
                    w-full
                    btn-primary
                    flex
                    items-center
                    justify-center
                    gap-2
                  "
                >
                  <CheckCircle size={16} />
                  Mark as Paid
                </button>
              </div>
            )}

          </div>
        </DetailModal>
      )}
    </div>
  )
}