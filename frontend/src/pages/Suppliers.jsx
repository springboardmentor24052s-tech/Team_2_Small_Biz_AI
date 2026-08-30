import { useCallback, useEffect, useState } from 'react'

import { Plus, Trash2, X, Truck, Mail, Phone, MapPin } from 'lucide-react'

import api from '../services/api'

import {
  Loading,
  PageHeader,
  EmptyState,
} from '../components/ui.jsx'

import InteractiveTable, {
  DetailModal,
} from '../components/InteractiveTable.jsx'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])

  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  const [selected, setSelected] = useState(null)

  const [form, setForm] = useState({
    supplier_name: '',
    phone: '',
    email: '',
    address: '',
  })

  // --------------------------------------------------
  // LOAD SUPPLIERS
  // --------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/suppliers/')

      setSuppliers(
        Array.isArray(response.data)
          ? response.data
          : []
      )
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to load suppliers.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // --------------------------------------------------
  // FORM CHANGE
  // --------------------------------------------------

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  // --------------------------------------------------
  // CREATE SUPPLIER
  // --------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.supplier_name.trim()) {
      setError('Supplier name is required.')
      return
    }

    try {
      setSaving(true)
      setError('')

      await api.post('/suppliers/', {
        supplier_name:
          form.supplier_name.trim(),

        phone:
          form.phone.trim() || null,

        email:
          form.email.trim() || null,

        address:
          form.address.trim() || null,
      })

      setForm({
        supplier_name: '',
        phone: '',
        email: '',
        address: '',
      })

      setShowForm(false)

      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to create supplier.'
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // DELETE SUPPLIER
  // --------------------------------------------------

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      'Delete this supplier?'
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')

      await api.delete(`/suppliers/${id}`)

      if (selected?.id === id) {
        setSelected(null)
      }

      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to delete supplier.'
      )
    }
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <Loading label="Loading suppliers..." />
    )
  }

  // --------------------------------------------------
  // TABLE COLUMNS
  // --------------------------------------------------

  const columns = [
    {
      key: 'supplier_name',
      label: 'Name',

      render: (value) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
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
      key: 'email',
      label: 'Email',

      render: (value) => (
        <span className="text-slate-500 dark:text-slate-400">
          {value || '—'}
        </span>
      ),
    },

    {
      key: 'address',
      label: 'Address',

      render: (value) => (
        <span className="text-slate-500 dark:text-slate-400">
          {value || '—'}
        </span>
      ),
    },

    {
      key: 'actions',
      label: '',
      sortable: false,

      render: (_, row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleDelete(row.id)
          }}
          className="text-red-500 hover:text-red-700 p-1"
          title="Delete supplier"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ]

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PageHeader
        title="Suppliers"
        subtitle="Manage product suppliers and vendors."
      />

      {/* Top section */}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {suppliers.length}
          </p>

          <p className="text-xs uppercase tracking-wide text-slate-500">
            Total Suppliers
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current)
            setError('')
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
            hover:bg-slate-800
            dark:bg-white
            dark:text-slate-900
            dark:hover:bg-slate-200
          "
        >
          {showForm ? (
            <>
              <X size={16} />
              Cancel
            </>
          ) : (
            <>
              <Plus size={16} />
              Add Supplier
            </>
          )}
        </button>
      </div>

      {/* Error */}

      {error && (
        <div
          className="
            mb-6
            rounded-lg
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            font-medium
            text-red-700
            dark:border-red-900
            dark:bg-red-950/40
            dark:text-red-300
          "
        >
          {error}
        </div>
      )}

      {/* Add Supplier Form */}

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
          <h2
            className="
              mb-5
              text-lg
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            Add Supplier
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* NAME */}

              <div>
                <label
                  className="
                    mb-1.5
                    block
                    text-sm
                    font-semibold
                    text-slate-800
                    dark:text-slate-200
                  "
                >
                  Supplier Name *
                </label>

                <input
                  type="text"
                  name="supplier_name"
                  value={form.supplier_name}
                  onChange={handleChange}
                  placeholder="Enter supplier name"
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
                    text-slate-900
                    placeholder:text-slate-400
                    outline-none
                    focus:border-slate-500
                    focus:ring-2
                    focus:ring-slate-200
                    dark:border-slate-600
                    dark:bg-slate-800
                    dark:text-white
                    dark:placeholder:text-slate-500
                    dark:focus:border-slate-400
                    dark:focus:ring-slate-700
                  "
                />
              </div>

              {/* PHONE */}

              <div>
                <label
                  className="
                    mb-1.5
                    block
                    text-sm
                    font-semibold
                    text-slate-800
                    dark:text-slate-200
                  "
                >
                  Phone
                </label>

                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className="
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    bg-white
                    px-3
                    py-2.5
                    text-sm
                    text-slate-900
                    placeholder:text-slate-400
                    outline-none
                    focus:border-slate-500
                    focus:ring-2
                    focus:ring-slate-200
                    dark:border-slate-600
                    dark:bg-slate-800
                    dark:text-white
                    dark:placeholder:text-slate-500
                    dark:focus:border-slate-400
                    dark:focus:ring-slate-700
                  "
                />
              </div>

              {/* EMAIL */}

              <div>
                <label
                  className="
                    mb-1.5
                    block
                    text-sm
                    font-semibold
                    text-slate-800
                    dark:text-slate-200
                  "
                >
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className="
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    bg-white
                    px-3
                    py-2.5
                    text-sm
                    text-slate-900
                    placeholder:text-slate-400
                    outline-none
                    focus:border-slate-500
                    focus:ring-2
                    focus:ring-slate-200
                    dark:border-slate-600
                    dark:bg-slate-800
                    dark:text-white
                    dark:placeholder:text-slate-500
                    dark:focus:border-slate-400
                    dark:focus:ring-slate-700
                  "
                />
              </div>

              {/* ADDRESS */}

              <div>
                <label
                  className="
                    mb-1.5
                    block
                    text-sm
                    font-semibold
                    text-slate-800
                    dark:text-slate-200
                  "
                >
                  Address
                </label>

                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Enter address"
                  className="
                    w-full
                    rounded-lg
                    border
                    border-slate-300
                    bg-white
                    px-3
                    py-2.5
                    text-sm
                    text-slate-900
                    placeholder:text-slate-400
                    outline-none
                    focus:border-slate-500
                    focus:ring-2
                    focus:ring-slate-200
                    dark:border-slate-600
                    dark:bg-slate-800
                    dark:text-white
                    dark:placeholder:text-slate-500
                    dark:focus:border-slate-400
                    dark:focus:ring-slate-700
                  "
                />
              </div>
            </div>

            {/* SAVE */}

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-lg
                  bg-slate-900
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  hover:bg-slate-800
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  dark:bg-white
                  dark:text-slate-900
                  dark:hover:bg-slate-200
                "
              >
                {saving
                  ? 'Saving...'
                  : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Supplier Table */}

      <div className="card">
        {suppliers.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No suppliers yet." />
          </div>
        ) : (
          <InteractiveTable
            data={suppliers}
            columns={columns}
            searchableKeys={[
              'supplier_name',
              'email',
              'address',
              'phone',
            ]}
            onRowClick={setSelected}
            emptyMessage="No suppliers yet."
          />
        )}
      </div>

      {/* Supplier Details */}

      <DetailModal
        title={selected?.supplier_name || ''}
        subtitle="Supplier Details"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div>
            <DetailModal.Row
              label="Name"
              value={
                selected.supplier_name ||
                'Not provided'
              }
              icon={Truck}
              tone="brand"
            />

            <DetailModal.Row
              label="Phone"
              value={
                selected.phone ||
                'Not provided'
              }
              icon={Phone}
            />

            <DetailModal.Row
              label="Email"
              value={
                selected.email ||
                'Not provided'
              }
              icon={Mail}
            />

            <DetailModal.Row
              label="Address"
              value={
                selected.address ||
                'Not provided'
              }
              icon={MapPin}
            />
          </div>
        )}
      </DetailModal>
    </div>
  )
}