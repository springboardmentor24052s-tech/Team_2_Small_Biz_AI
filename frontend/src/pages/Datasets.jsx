import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Trash2,
  Upload,
  FileText,
} from 'lucide-react'

import api from '../services/api'

import {
  Loading,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '../components/ui.jsx'

export default function Datasets() {
  const [datasets, setDatasets] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState(null)

  const [uploading, setUploading] =
    useState(false)

  const [uploadMsg, setUploadMsg] =
    useState(null)

  const [deletingId, setDeletingId] =
    useState(null)

  // --------------------------------------------------
  // LOAD DATASETS
  // --------------------------------------------------

  const loadDatasets =
    useCallback(async () => {
      setLoading(true)
      setError(null)

      try {
        const response =
          await api.get('/datasets/')

        setDatasets(
          Array.isArray(response.data)
            ? response.data
            : []
        )
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            err.message ||
            'Failed to load datasets.'
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  // --------------------------------------------------
  // DETECT DATASET TYPE
  // --------------------------------------------------

  const detectDatasetType = (
    dataset
  ) => {
    const fileName = (
      dataset.file_name ||
      dataset.filename ||
      dataset.name ||
      dataset.file_path ||
      ''
    ).toLowerCase()

    if (
      fileName.includes('sales') ||
      fileName.includes('sale') ||
      fileName.includes('transaction')
    ) {
      return 'Sales'
    }

    if (
      fileName.includes('inventory') ||
      fileName.includes('stock')
    ) {
      return 'Inventory'
    }

    if (
      fileName.includes('customer') ||
      fileName.includes('client')
    ) {
      return 'Customers'
    }

    if (
      fileName.includes('product') ||
      fileName.includes('catalog')
    ) {
      return 'Products'
    }

    return 'Other'
  }

  // --------------------------------------------------
  // UPLOAD CSV
  // --------------------------------------------------

  const handleUpload = async (
    event
  ) => {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith('.csv')
    ) {
      setUploadMsg(
        'Please upload a CSV file.'
      )

      event.target.value = ''
      return
    }

    const formData =
      new FormData()

    formData.append(
      'file',
      file
    )

    setUploading(true)
    setUploadMsg(null)
    setError(null)

    try {
      const response =
        await api.post(
          '/datasets/upload',
          formData,
          {
            headers: {
              'Content-Type':
                'multipart/form-data',
            },
          }
        )

      setUploadMsg(
        response.data?.message ||
          `${file.name} uploaded successfully.`
      )

      await loadDatasets()
    } catch (err) {
      setUploadMsg(
        err.response?.data?.detail ||
          err.message ||
          'Dataset upload failed.'
      )
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  // --------------------------------------------------
  // DELETE DATASET
  // --------------------------------------------------

  const handleDelete = async (
    dataset
  ) => {
    const datasetId =
      dataset.id ||
      dataset.dataset_id

    if (!datasetId) {
      setError(
        'Unable to identify this dataset.'
      )
      return
    }

    const fileName =
      dataset.file_name ||
      dataset.filename ||
      dataset.name ||
      'this dataset'

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    setDeletingId(datasetId)
    setError(null)

    try {
      await api.delete(
        `/datasets/${datasetId}`
      )

      setDatasets(
        (current) =>
          current.filter(
            (item) =>
              (
                item.id ||
                item.dataset_id
              ) !== datasetId
          )
      )
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to delete dataset.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <Loading
        label="Loading datasets..."
      />
    )
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="text-slate-800 dark:text-slate-100">
      <PageHeader
        title="Datasets"
        subtitle="Manage and view uploaded datasets."
        action={
          <label
            className={`btn-primary cursor-pointer flex items-center gap-2 text-xs ${
              uploading
                ? 'pointer-events-none opacity-60'
                : ''
            }`}
          >
            <Upload size={14} />

            {uploading
              ? 'Uploading...'
              : 'Upload CSV'}

            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        }
      />

      {/* ERROR */}
      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
          />
        </div>
      )}

      {/* UPLOAD MESSAGE */}
      {uploadMsg && (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300">
          {uploadMsg}
        </div>
      )}

      {/* DATASETS TABLE */}
      <div className="card bg-white dark:bg-slate-900">
        {datasets.length === 0 ? (
          <EmptyState
            message="No datasets uploaded yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white text-sm dark:bg-slate-900">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left dark:border-slate-700 dark:bg-slate-900">
                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Dataset Name
                  </th>

                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Type
                  </th>

                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Total Records
                  </th>

                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Valid
                  </th>

                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Invalid
                  </th>

                  <th className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Upload Date
                  </th>

                  <th className="py-3 pr-4 text-center text-slate-600 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {datasets.map(
                  (dataset) => {
                    const id =
                      dataset.id ||
                      dataset.dataset_id

                    const fileName =
                      dataset.file_name ||
                      dataset.filename ||
                      dataset.name ||
                      (
                        dataset.file_path
                          ? dataset.file_path
                              .split(
                                /[\\/]+/
                              )
                              .pop()
                          : 'Unnamed dataset'
                      )

                    const type =
                      dataset.dataset_type ||
                      detectDatasetType(
                        dataset
                      )

                    const totalRecords =
                      dataset.total_records ??
                      dataset.totalRows ??
                      dataset.total ??
                      0

                    const validRecords =
                      dataset.valid_records ??
                      dataset.validRows ??
                      dataset.valid ??
                      0

                    const invalidRecords =
                      dataset.invalid_records ??
                      dataset.invalidRows ??
                      dataset.invalid ??
                      0

                    const uploadDate =
                      dataset.upload_date ||
                      dataset.uploaded_at ||
                      dataset.created_at

                    return (
                      <tr
                        key={id}
                        className="border-b border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                      >
                        {/* DATASET NAME */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                              <FileText
                                size={15}
                              />
                            </div>

                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {fileName}
                            </span>
                          </div>
                        </td>

                        {/* TYPE */}
                        <td className="py-3 pr-4">
                          <span
                            className={`
                              inline-flex
                              items-center
                              rounded-full
                              px-2.5
                              py-1
                              text-xs
                              font-medium
                              ${
                                type ===
                                'Sales'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : type ===
                                    'Inventory'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : type ===
                                    'Customers'
                                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                  : type ===
                                    'Products'
                                  ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }
                            `}
                          >
                            {type}
                          </span>
                        </td>

                        {/* TOTAL */}
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                          {totalRecords}
                        </td>

                        {/* VALID */}
                        <td className="py-3 pr-4 font-medium text-emerald-600">
                          {validRecords}
                        </td>

                        {/* INVALID */}
                        <td className="py-3 pr-4 font-medium text-red-500">
                          {invalidRecords}
                        </td>

                        {/* UPLOAD DATE */}
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                          {uploadDate
                            ? new Date(
                                uploadDate
                              ).toLocaleString()
                            : '—'}
                        </td>

                        {/* DELETE */}
                        <td className="py-3 pr-4">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  dataset
                                )
                              }
                              disabled={
                                deletingId ===
                                id
                              }
                              title="Delete dataset"
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}