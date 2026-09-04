import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronDown, ExternalLink, FileText, RefreshCw, Search, X } from 'lucide-react'
import { decideAdminApplication, getAdminApplicationDocumentUrl, listAdminApplications } from '../../services/adminApplicationService'
import TablePagination from '../../components/TablePagination'
import useTablePagination from '../../hooks/useTablePagination'
import LoadingScreen from '../../components/LoadingScreen'

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

const rejectionReasons = [
  'The supporting document is missing, unclear, or invalid.',
  'The requested location already has an administrator.',
  'The location details do not match the supporting document.',
  'The requested location information is incomplete or inaccurate.',
]

export default function AdminApplications() {
  const [applications, setApplications] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [decidingId, setDecidingId] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [rejectingApplication, setRejectingApplication] = useState(null)
  const [rejectionPreset, setRejectionPreset] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [openingDocumentId, setOpeningDocumentId] = useState(null)

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
        item.requested_location_name,
        item.requested_location_address,
        item.company_document_name,
        item.status,
      ]
      const matchesSearch = !term || searchableValues.some((value) => String(value || '').toLowerCase().includes(term))
      return matchesStatus && matchesSearch
    })
  }, [applications, query, statusFilter])
  const applicationPages = useTablePagination(filteredApplications)

  async function decide(id, decision, reason = '') {
    setMessage('')
    setDecidingId(id)
    try {
      await decideAdminApplication(id, decision, reason)
      const refreshed = await refresh(false)
      if (refreshed) {
        setMessageType('success')
        setMessage(`Application ${decision}.`)
        if (decision === 'rejected') {
          setRejectingApplication(null)
          setRejectionPreset('')
          setRejectionReason('')
        }
      }
    } catch (error) {
      setMessageType('error')
      setMessage(error.message)
    } finally {
      setDecidingId(null)
    }
  }

  function openRejectionDialog(application) {
    setRejectingApplication(application)
    setRejectionPreset('')
    setRejectionReason('')
    setMessage('')
  }

  async function openDocument(application) {
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null
    setOpeningDocumentId(application.id)
    setMessage('')
    try {
      const documentUrl = await getAdminApplicationDocumentUrl(application.id)
      if (previewWindow) previewWindow.location.replace(documentUrl)
      else {
        const openedWindow = window.open(documentUrl, '_blank', 'noopener,noreferrer')
        if (!openedWindow) throw new Error('Your browser blocked the document window. Allow pop-ups for EcoGuard and try again.')
      }
    } catch (error) {
      previewWindow?.close()
      setMessageType('error')
      setMessage(error.message)
    } finally {
      setOpeningDocumentId(null)
    }
  }

  if (loading) {
    return <LoadingScreen tone="blue" label="Loading applications..." />
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
            <input value={query} onChange={(event) => { setQuery(event.target.value); applicationPages.setPage(1) }} placeholder="Search applicant, location, document, or status" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500" />
          </label>
          <label>
            <span className="sr-only">Filter application status</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); applicationPages.setPage(1) }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 sm:w-48">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        {filteredApplications.length ? (
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
                {applicationPages.pageItems.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{item.profiles?.full_name || 'Unnamed applicant'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600"><p className="font-medium">{item.ecological_locations?.name || item.requested_location_name || item.requested_location_id}</p>{item.requested_location_address && <p className="mt-1 max-w-xs text-xs text-slate-400">{item.requested_location_address}</p>}</td>
                    <td className="px-5 py-4">
                      <p className="max-w-56 truncate text-xs text-slate-500" title={item.company_document_name}>{item.company_document_name}</p>
                      <button type="button" onClick={() => openDocument(item)} disabled={openingDocumentId === item.id} className="mt-1.5 inline-flex items-center gap-1.5 text-left text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-wait disabled:opacity-50">
                        <FileText size={15} className="shrink-0" /><span>{openingDocumentId === item.id ? 'Opening...' : 'View document'}</span><ExternalLink size={13} className="shrink-0" />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600" title={item.created_at}>{formatApplicationDate(item.created_at)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[item.status] || 'bg-slate-50 text-slate-600 ring-slate-100'}`}>{item.status}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {item.status === 'pending' ? <>
                          <button type="button" onClick={() => decide(item.id, 'approved')} disabled={decidingId === item.id} className="rounded-lg bg-green-50 p-2 text-green-700 transition hover:bg-green-100 disabled:opacity-40" aria-label={`Approve ${item.profiles?.full_name || 'application'}`}><Check size={17} /></button>
                          <button type="button" onClick={() => openRejectionDialog(item)} disabled={decidingId === item.id} className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-40" aria-label={`Reject ${item.profiles?.full_name || 'application'}`}><X size={17} /></button>
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

        {!loading && filteredApplications.length > 0 && <TablePagination {...applicationPages} onPageChange={applicationPages.setPage} label="applications" />}
      </section>

      {rejectingApplication && createPortal(<RejectionDialog
        application={rejectingApplication}
        preset={rejectionPreset}
        details={rejectionReason}
        deciding={decidingId !== null}
        onPresetChange={setRejectionPreset}
        onDetailsChange={setRejectionReason}
        onClose={() => setRejectingApplication(null)}
        onConfirm={(reason) => decide(rejectingApplication.id, 'rejected', reason)}
      />, document.body)}
    </div>
  )
}

function RejectionDialog({ application, preset, details, deciding, onPresetChange, onDetailsChange, onClose, onConfirm }) {
  const [reasonsOpen, setReasonsOpen] = useState(false)
  const presetText = preset === 'custom' ? '' : preset
  const completeReason = [presetText, details.trim()].filter(Boolean).join(' ')
  const detailsLimit = Math.max(0, presetText ? 499 - presetText.length : 500)
  const reasonOptions = [...rejectionReasons.map((reason) => ({ value: reason, label: reason })), { value: 'custom', label: 'Other / custom reason' }]

  function chooseReason(nextPreset) {
    const nextPresetText = nextPreset === 'custom' ? '' : nextPreset
    onPresetChange(nextPreset)
    onDetailsChange(details.slice(0, Math.max(0, nextPresetText ? 499 - nextPresetText.length : 500)))
    setReasonsOpen(false)
  }

  return <div style={{ zIndex: 9999 }} className="fixed inset-0 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deciding) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="rejection-dialog-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={18} /></span><div className="min-w-0 flex-1"><h2 id="rejection-dialog-title" className="font-bold text-slate-900">Reject application</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">The reason will be shown to {application.profiles?.full_name || 'the applicant'} before resubmission.</p></div><button type="button" onClick={onClose} disabled={deciding} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close rejection dialog"><X size={17} /></button></header>
      <div className="space-y-4 px-5 py-4">
        <div className="relative"><span className="text-sm font-semibold text-slate-700">Common reason</span><button type="button" onClick={() => setReasonsOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={reasonsOpen} className={`mt-1.5 flex w-full items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2.5 text-left text-sm outline-none transition ${reasonsOpen ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}><span className={`min-w-0 flex-1 break-words ${preset ? 'text-slate-700' : 'text-slate-400'}`}>{preset ? preset === 'custom' ? 'Other / custom reason' : preset : 'Select a reason or type below'}</span><ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${reasonsOpen ? 'rotate-180' : ''}`} /></button>{reasonsOpen && <div role="listbox" aria-label="Common rejection reasons" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{reasonOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={preset === option.value} onClick={() => chooseReason(option.value)} className={`flex w-full items-start gap-2 whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm leading-5 transition ${preset === option.value ? 'bg-red-50 font-semibold text-red-700' : 'text-slate-600 hover:bg-slate-50'}`}><span className="min-w-0 flex-1">{option.label}</span>{preset === option.value && <Check size={15} className="mt-0.5 shrink-0" />}</button>)}</div>}</div>
        <label className="block"><span className="text-sm font-semibold text-slate-700">{preset === 'custom' || !preset ? 'Custom reason' : 'Additional details (optional)'}</span><textarea value={details} onChange={(event) => onDetailsChange(event.target.value)} maxLength={detailsLimit} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm leading-5 text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" placeholder={preset && preset !== 'custom' ? 'Add any details that will help the applicant correct it…' : 'Explain what must be corrected before resubmitting…'} /><span className="mt-1 flex justify-between text-xs text-slate-400"><span>{completeReason ? 'This message will be saved with the application.' : 'A reason is required.'}</span><span>{completeReason.length}/500</span></span></label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3"><button type="button" onClick={onClose} disabled={deciding} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button><button type="button" onClick={() => onConfirm(completeReason)} disabled={!completeReason || deciding} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{deciding ? 'Rejecting…' : 'Reject application'}</button></footer>
    </section>
  </div>
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
