import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, Badge } from '../components/ui.jsx'

export default function Datasets() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await api.get('/datasets/')
      setDatasets(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to load datasets:', err)
      setError(
        err.response?.data?.detail ||
        'Failed to load datasets.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <Loading label="Loading datasets..." />
  }

  return (
    <div>
      <PageHeader
        title="Datasets"
        subtitle="Manage and view uploaded datasets."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card">
        {datasets.length === 0 ? (
          <EmptyState message="No datasets uploaded yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Dataset Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Rows Count</th>
                <th className="py-2">Upload Date</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-medium">{d.file_name}</td>
                  <td className="py-2">
                    <Badge tone="blue">{d.file_name?.toLowerCase().includes('sale') ? 'Sales' : 'Inventory'}</Badge>
                  </td>
                  <td className="py-2">{d.total_records || '—'}</td>
                  <td className="py-2 text-slate-500">{new Date(d.upload_date).toLocaleString()}</td>
                </tr>
              </thead>

              <tbody>
                {datasets.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-2 font-medium">
                      {d.file_name || 'Unnamed dataset'}
                    </td>

                    <td className="py-3 px-2">
                      <Badge
                        tone={
                          d.validation_status?.toLowerCase() === 'valid'
                            ? 'green'
                            : 'blue'
                        }
                      >
                        {d.validation_status || 'Pending'}
                      </Badge>
                    </td>

                    <td className="py-3 px-2">
                      {d.total_records ?? 0}
                    </td>

                    <td className="py-3 px-2 text-green-600">
                      {d.valid_records ?? 0}
                    </td>

                    <td className="py-3 px-2 text-red-600">
                      {d.invalid_records ?? 0}
                    </td>

                    <td className="py-3 px-2 text-slate-500">
                      {d.upload_date
                        ? new Date(d.upload_date).toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}