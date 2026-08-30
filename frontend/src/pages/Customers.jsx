import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import {
  Loading,
  PageHeader,
  EmptyState,
  Badge,
  ErrorBanner,
} from '../components/ui.jsx'
import InteractiveTable, {
  DetailModal,
} from '../components/InteractiveTable.jsx'
import {
  Plus,
  Upload,
  Search,
  ArrowUpDown,
  Download,
  Users,
  Mail,
  Phone,
  IndianRupee,
  ShoppingCart,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { downloadCSV } from '../utils/csv'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [selected, setSelected] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)

  const { user } = useAuth()

  // --------------------------------------------------
  // PERMISSIONS
  // --------------------------------------------------

  const role =
    typeof user?.role === 'string'
      ? user.role
      : user?.role?.role_name || user?.role

  const canCreate = [
    'business_owner',
    'sales_executive',
    'admin',
  ].includes(role)

  // --------------------------------------------------
  // LOAD CUSTOMERS + SALES
  // --------------------------------------------------

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      api.get('/customers/'),
      api.get('/sales/'),
    ])
      .then(([customersResponse, salesResponse]) => {
        setCustomers(
          Array.isArray(customersResponse.data)
            ? customersResponse.data
            : []
        )

        setSales(
          Array.isArray(salesResponse.data)
            ? salesResponse.data
            : []
        )
      })
      .catch((err) => {
        setError(
          err.response?.data?.detail ||
            err.message ||
            'Failed to load customers.'
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // --------------------------------------------------
  // GET CUSTOMER NAME SAFELY
  // --------------------------------------------------

  const getCustomerName = (customer) => {
    return (
      customer?.name ||
      customer?.full_name ||
      customer?.customer_name ||
      ''
    )
  }

  // --------------------------------------------------
  // CUSTOMER STATISTICS
  // --------------------------------------------------

  const getCustomerStats = (customerId) => {
    const customerSales = sales.filter(
      (sale) => sale.customer_id === customerId
    )

    const totalSpent = customerSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total_amount || 0),
      0
    )

    return {
      orderCount: customerSales.length,
      totalSpent,
    }
  }

  const enriched = customers.map((customer) => {
    const stats = getCustomerStats(customer.id)

    return {
      ...customer,
      orders: stats.orderCount,
      total_spent: stats.totalSpent,
    }
  })

  const totalSpentAll = enriched.reduce(
    (sum, customer) =>
      sum + Number(customer.total_spent || 0),
    0
  )

  const avgSpend =
    customers.length > 0
      ? Math.round(totalSpentAll / customers.length)
      : 0

  // --------------------------------------------------
  // EXPORT CSV
  // --------------------------------------------------

  const handleExport = () => {
    const rows = customers.map((customer) => [
      getCustomerName(customer),
      customer.email || '',
      customer.phone || '',
      customer.created_at
        ? customer.created_at.slice(0, 10)
        : '',
    ])

    downloadCSV(
      'customers.csv',
      ['Name', 'Email', 'Phone', 'Joined'],
      rows
    )
  }

  // --------------------------------------------------
  // UPLOAD CSV
  // --------------------------------------------------

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMsg('Please upload a CSV file.')
      event.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploadMsg('Uploading...')
    setError(null)

    try {
      const response = await api.post(
        '/customers/upload-csv',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      const created =
        response.data?.customers_created ?? 0

      const skipped =
        response.data?.rows_skipped ?? 0

      setUploadMsg(
        `Uploaded: ${created} created, ${skipped} skipped (duplicates/invalid).`
      )

      load()
    } catch (err) {
      setUploadMsg(
        err.response?.data?.detail ||
          err.message ||
          'Upload failed.'
      )
    } finally {
      event.target.value = ''
    }
  }

  // --------------------------------------------------
  // CREATE CUSTOMER
  // --------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    try {
      await api.post('/customers/', form)

      setForm({
        name: '',
        email: '',
        phone: '',
      })

      setShowForm(false)
      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Could not create customer.'
      )
    }
  }

  // --------------------------------------------------
  // SORTING
  // --------------------------------------------------

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc((value) => !value)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  // --------------------------------------------------
  // SEARCH + SORT
  // --------------------------------------------------

  const processedCustomers = customers
    .filter((customer) => {
      const name =
        getCustomerName(customer).toLowerCase()

      const email = String(
        customer.email || ''
      ).toLowerCase()

      const phone = String(
        customer.phone || ''
      ).toLowerCase()

      const query = search.toLowerCase()

      return (
        name.includes(query) ||
        email.includes(query) ||
        phone.includes(query)
      )
    })
    .sort((a, b) => {
      let valueA
      let valueB

      if (sortField === 'name') {
        valueA = getCustomerName(a)
        valueB = getCustomerName(b)
      } else {
        valueA = a[sortField] || ''
        valueB = b[sortField] || ''
      }

      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase()
      }

      if (typeof valueB === 'string') {
        valueB = valueB.toLowerCase()
      }

      if (valueA === valueB) {
        return 0
      }

      if (sortAsc) {
        return valueA > valueB ? 1 : -1
      }

      return valueA < valueB ? 1 : -1
    })

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return <Loading label="Loading customers..." />
  }

  // --------------------------------------------------
  // INTERACTIVE TABLE COLUMNS
  // --------------------------------------------------

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (value) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {value || 'Unnamed Customer'}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (value) => (
        <span className="text-slate-500 dark:text-slate-400">
          {value || '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (value) => value || '—',
    },
    {
      key: 'orders',
      label: 'Orders',
      render: (value) => (
        <Badge tone={value > 0 ? 'blue' : 'slate'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'total_spent',
      label: 'Total Spent',
      render: (value) => (
        <span className="font-semibold text-emerald-600">
          ₹{Number(value || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
  ]

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="text-slate-800 dark:text-slate-100">
      <PageHeader
        title="Customers"
        subtitle="Customer profiles and contact directory."
        action={
          canCreate && (
            <div className="flex flex-wrap gap-2">
              {/* Upload */}
              <label className="btn-secondary cursor-pointer flex items-center gap-2 text-xs">
                <Upload size={14} />
                Upload CSV

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>

              {/* Export */}
              <button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2 text-xs"
              >
                <Download size={14} />
                Export CSV
              </button>

              {/* Add Customer */}
              <button
                onClick={() =>
                  setShowForm((value) => !value)
                }
                className="btn-primary flex items-center gap-2 text-xs"
              >
                <Plus size={14} />
                Add Customer
              </button>
            </div>
          )
        }
      />

      {/* ERROR */}
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* UPLOAD MESSAGE */}
      {uploadMsg && (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300">
          {uploadMsg}
        </div>
      )}

      {/* CUSTOMER SUMMARY */}
      <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
        <div className="card text-center p-4">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {customers.length}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Total Customers
          </p>
        </div>

        <div className="card text-center p-4">
          <p className="text-xl font-bold text-emerald-600">
            ₹{totalSpentAll.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Total Revenue
          </p>
        </div>

        <div className="card text-center p-4">
          <p className="text-xl font-bold text-blue-600">
            ₹{avgSpend.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Avg Spend/Customer
          </p>
        </div>
      </div>

      {/* ADD CUSTOMER FORM */}
      {showForm && canCreate && (
        <div className="card mb-6 bg-white dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add Customer
          </h3>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            {/* NAME */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>

              <input
                type="text"
                className="input mt-1"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                placeholder="Full name"
                required
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>

              <input
                type="email"
                className="input mt-1"
                value={form.email}
                onChange={(event) =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
                placeholder="email@example.com"
              />
            </div>

            {/* PHONE */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Phone
              </label>

              <input
                type="tel"
                className="input mt-1"
                value={form.phone}
                onChange={(event) =>
                  setForm({
                    ...form,
                    phone: event.target.value,
                  })
                }
                placeholder="Phone number"
              />
            </div>

            {/* BUTTONS */}
            <div className="md:col-span-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
              >
                Save Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOMERS TABLE */}
      <div className="card bg-white dark:bg-slate-900">
        {/* SEARCH */}
        <div className="mb-4 flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="input py-1.5 pl-8 text-xs"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          {processedCustomers.length === 0 ? (
            <EmptyState message="No customers found." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left dark:border-slate-700 dark:bg-slate-900">
                  {/* NAME */}
                  <th
                    className="cursor-pointer py-3 pr-4 text-slate-600 dark:text-slate-300"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* EMAIL */}
                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Email
                  </th>

                  {/* PHONE */}
                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Phone
                  </th>

                  {/* JOINED */}
                  <th
                    className="cursor-pointer py-3 pr-4 text-slate-600 dark:text-slate-300"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Joined
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {processedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    onClick={() => {
                      const enrichedCustomer =
                        enriched.find(
                          (item) =>
                            item.id === customer.id
                        )

                      setSelected(
                        enrichedCustomer || customer
                      )
                    }}
                  >
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {getCustomerName(customer) ||
                        'Unnamed Customer'}
                    </td>

                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                      {customer.email || '—'}
                    </td>

                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                      {customer.phone || '—'}
                    </td>

                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {customer.created_at
                        ? new Date(
                            customer.created_at
                          ).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CUSTOMER DETAIL MODAL */}
      <DetailModal
        title={selected?.name || ''}
        subtitle="Customer Profile"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div>
            <DetailModal.Row
              label="Name"
              value={
                getCustomerName(selected) ||
                'Unnamed Customer'
              }
              icon={Users}
              tone="brand"
            />

            <DetailModal.Row
              label="Email"
              value={
                selected.email || 'Not provided'
              }
              icon={Mail}
            />

            <DetailModal.Row
              label="Phone"
              value={
                selected.phone || 'Not provided'
              }
              icon={Phone}
            />

            <DetailModal.Row
              label="Total Orders"
              value={selected.orders || 0}
              icon={ShoppingCart}
              tone="blue"
            />

            <DetailModal.Row
              label="Total Spent"
              value={`₹${Number(
                selected.total_spent || 0
              ).toLocaleString('en-IN')}`}
              icon={IndianRupee}
              tone="green"
            />

            <DetailModal.Row
              label="Avg Order"
              value={`₹${
                selected.orders > 0
                  ? Math.round(
                      selected.total_spent /
                        selected.orders
                    ).toLocaleString('en-IN')
                  : '0'
              }`}
            />

            <DetailModal.Section title="Recent Sales">
              {sales
                .filter(
                  (sale) =>
                    sale.customer_id === selected.id
                )
                .slice(-5)
                .reverse()
                .map((sale) => (
                  <div
                    key={sale.id}
                    className="flex justify-between py-1 text-sm"
                  >
                    <span className="text-slate-500 dark:text-slate-400">
                      {sale.sale_date
                        ? new Date(
                            sale.sale_date
                          ).toLocaleDateString()
                        : '—'}
                    </span>

                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      ₹{Number(
                        sale.total_amount || 0
                      ).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}

              {sales.filter(
                (sale) =>
                  sale.customer_id === selected.id
              ).length === 0 && (
                <p className="py-2 text-xs text-slate-400">
                  No sales for this customer.
                </p>
              )}
            </DetailModal.Section>
          </div>
        )}
      </DetailModal>
    </div>
  )
}