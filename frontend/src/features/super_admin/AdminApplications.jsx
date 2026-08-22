import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, FileText, RefreshCw, Search, X } from 'lucide-react'
import { decideAdminApplication, listAdminApplications } from '../../services/adminApplicationService'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const statusStyles = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  approved: 'bg-green-50 text-green-700 ring-green-100',
  rejected: 'bg-red-50 text-red-600 ring-red-100',
}

export default function AdminApplications() {
  const [applications, setApplications] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [decidingId, setDecidingId] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  async function refresh(clearMessage = true) {
    setLoading(true)
    if (clearMessage) setMessage('')
    try {
      setApplications(await listAdminApplications())
      return true
    } catch (error) {
      setMessageType('error')
      setMessage(error.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    listAdminApplications()
      .then((rows) => { if (active) setApplications(rows) })
      .catch((error) => {
        if (active) {
          setMessageType('error')
          setMessage(error.message)
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filteredApplications = useMemo(() => {
    const term = query.trim().toLowerCase()

    return applications.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const searchableValues = [
        item.profiles?.full_name,
        item.ecological_locations?.name,
        item.company_document_name,
        item.status,
      ]
      const matchesSearch = !term || searchableValues.some((value) => String(value || '').toLowerCase().includes(term))
      return matchesStatus && matchesSearch
    })
  }, [applications, query, statusFilter])

  async function decide(id, decision) {
    setMessage('')
    setDecidingId(id)
    try {
      await decideAdminApplication(id, decision)
      const refreshed = await refresh(false)
      if (refreshed) {
        setMessageType('success')
        setMessage(`Application ${decision}.`)
      }
    } catch (error) {
      setMessageType('error')
      setMessage(error.message)
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Location admin applications</h1>
          <p className="mt-1 text-sm text-slate-500">Review company documents before granting access to one location.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </header>

      {message && <p role={messageType === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm ${messageType === 'error' ? 'border-red-200 bg-red-50 text-red-600' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>{message}</p>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search applications</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicant, location, document, or status" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500" />
          </label>
          <label>
            <span className="sr-only">Filter application status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 sm:w-48">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="p-10 text-center text-sm text-slate-400">Loading applications...</p>
        ) : filteredApplications.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Applicant</th>
                  <th className="px-5 py-3 font-semibold">Location</th>
                  <th className="px-5 py-3 font-semibold">Document</th>
                  <th className="px-5 py-3 font-semibold">Created At</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplications.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{item.profiles?.full_name || 'Unnamed applicant'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.ecological_locations?.name || item.requested_location_id}</td>
                    <td className="px-5 py-4">
                      {item.documentUrl ? (
                        <a href={item.documentUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-56 items-center gap-1.5 text-blue-600 hover:text-blue-700">
                          <FileText size={15} className="shrink-0" /><span className="truncate">{item.company_document_name}</span><ExternalLink size={13} className="shrink-0" />
                        </a>
                      ) : <span className="text-slate-600">{item.company_document_name}</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600" title={item.created_at}>{formatApplicationDate(item.created_at)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[item.status] || 'bg-slate-50 text-slate-600 ring-slate-100'}`}>{item.status}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {item.status === 'pending' ? <>
                          <button type="button" onClick={() => decide(item.id, 'approved')} disabled={decidingId === item.id} className="rounded-lg bg-green-50 p-2 text-green-700 transition hover:bg-green-100 disabled:opacity-40" aria-label={`Approve ${item.profiles?.full_name || 'application'}`}><Check size={17} /></button>
                          <button type="button" onClick={() => decide(item.id, 'rejected')} disabled={decidingId === item.id} className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-40" aria-label={`Reject ${item.profiles?.full_name || 'application'}`}><X size={17} /></button>
                        </> : <span className="text-xs text-slate-400">Completed</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-600">No matching applications</p>
            <p className="mt-1 text-xs text-slate-400">Try another search term or status filter.</p>
          </div>
        )}

        {!loading && applications.length > 0 && <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Showing {filteredApplications.length} of {applications.length} applications</div>}
      </section>
    </div>
  )
}

function formatApplicationDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
