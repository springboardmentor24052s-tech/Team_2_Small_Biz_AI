import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import {
  Loading,
  PageHeader,
  Badge,
  EmptyState,
  ErrorBanner,
} from '../components/ui.jsx'
import { Plus, Filter } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const STATUS_TONE = {
  pending: 'amber',
  paid: 'green',
  overdue: 'red',
}

export default function Invoices() {
  const { hasRole } = useAuth()

  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    customer_id: '',
    amount: '',
    due_date: '',
  })

  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      api.get('/invoices/'),
      api.get('/customers/'),
    ])
      .then(([invoiceRes, customerRes]) => {
        setInvoices(invoiceRes.data)
        setCustomers(customerRes.data)
      })
      .catch((err) => {
        setError(
          err.response?.data?.detail ||
            err.message ||
            'Failed to load invoices.'
        )
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const canCreate = hasRole(
    'business_owner',
    'sales_executive',
    'admin'
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      await api.post('/invoices/', {
        customer_id: Number(form.customer_id),
        amount: Number(form.amount),
        due_date: form.due_date,
      })

      setShowForm(false)

      setForm({
        customer_id: '',
        amount: '',
        due_date: '',
      })

      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not create invoice.'
      )
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/invoices/${id}/status`, { status })
      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not update invoice status.'
      )
    }
  }

  const filteredInvoices = invoices.filter(
    (inv) =>
      statusFilter === 'all' ||
      inv.status === statusFilter
  )

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Invoice generation, tracking, and payment monitoring."
        action={
          canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary flex items-center gap-2 text-xs"
            >
              <Plus size={14} />
              New Invoice
            </button>
          )
        }
      />

      <ErrorBanner message={error} />

      {showForm && (
        <div className="card mb-6">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
          >
            <div>
              <label className="text-xs font-medium text-slate-600">
                Customer
              </label>

              <select
                className="input mt-1"
                value={form.customer_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    customer_id: e.target.value,
                  })
                }
                required
              >
                <option value="">
                  Select a customer
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

            <div>
              <label className="text-xs font-medium text-slate-600">
                Amount (₹)
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                className="input mt-1"
                value={form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: e.target.value,
                  })
                }
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Due Date
              </label>

              <input
                type="date"
                className="input mt-1"
                value={form.due_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    due_date: e.target.value,
                  })
                }
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary md:col-span-1"
            >
              Create Invoice
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Invoices List
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
            <Filter
              size={14}
              className="ml-1 text-slate-400"
            />

            {['all', 'pending', 'paid', 'overdue'].map(
              (st) => (
                <button
                  key={st}
                  onClick={() =>
                    setStatusFilter(st)
                  }
                  className={`px-2.5 py-1 rounded-md capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <EmptyState message="No matching invoices found." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">
                    Invoice #
                  </th>

                  <th className="py-2 pr-4">
                    Customer
                  </th>

                  <th className="py-2 pr-4">
                    Amount
                  </th>

                  <th className="py-2 pr-4">
                    Due Date
                  </th>

                  <th className="py-2 pr-4">
                    Status
                  </th>

                  <th className="py-2 pr-4">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((inv) => {
                  const customer = customers.find(
                    (c) =>
                      c.id === inv.customer_id
                  )

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {inv.invoice_number}
                      </td>

                      <td className="py-2 pr-4">
                        {customer?.name ||
                          customer?.full_name ||
                          '—'}
                      </td>

                      <td className="py-2 pr-4 font-semibold">
                        ₹
                        {Number(
                          inv.amount || 0
                        ).toLocaleString('en-IN')}
                      </td>

                      <td className="py-2 pr-4 text-slate-500">
                        {inv.due_date
                          ? new Date(
                              inv.due_date
                            ).toLocaleDateString()
                          : '—'}
                      </td>

                      <td className="py-2 pr-4">
                        <Badge
                          tone={
                            STATUS_TONE[
                              inv.status
                            ] || 'slate'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>

                      <td className="py-2 pr-4">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() =>
                              updateStatus(
                                inv.id,
                                'paid'
                              )
                            }
                            className="text-xs text-brand-600 font-medium hover:underline"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}