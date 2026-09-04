import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { listManagedAdvisories, subscribeToAdvisories, withdrawAdvisory } from '../../services/advisoryService'
import { listEarlyWarningNotifications } from '../../services/notificationService'
import AdvisoryEditor from './AdvisoryEditor'
import TablePagination from '../../components/TablePagination'
import useTablePagination from '../../hooks/useTablePagination'
import LoadingScreen from '../../components/LoadingScreen'

const FILTERS = [{ id: 'all', label: 'All advisories' }, { id: 'general', label: 'General' }, { id: 'warning', label: 'Warnings' }, { id: 'incident', label: 'Incidents' }]
const advisoryType = (item) => item.source_warning_id ? 'warning' : item.source_incident_id ? 'incident' : 'general'
const sourceLabel = (item) => item.source_warning_id ? `Warning #${item.source_warning_id}` : item.source_incident_id ? `Verified incident #${item.source_incident_id}` : 'General advisory'

function statusInfo(item) {
  const now = new Date()
  if (item.status === 'withdrawn') return { label: 'Withdrawn', style: 'bg-slate-100 text-slate-600' }
  if (new Date(item.expires_at) <= now) return { label: 'Expired', style: 'bg-amber-50 text-amber-700' }
  if (new Date(item.starts_at) > now) return { label: 'Scheduled', style: 'bg-blue-50 text-blue-700' }
  return { label: 'Active', style: 'bg-emerald-50 text-emerald-700' }
}

export default function AdvisoryManagement({ locations = [], user, isSuperAdmin, profile }) {
  const [items, setItems] = useState([])
  const [warnings, setWarnings] = useState([])
  const [filter, setFilter] = useState('all')
  const [editor, setEditor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [rows, alerts] = await Promise.all([listManagedAdvisories(), user?.id ? listEarlyWarningNotifications(user.id, 100) : []])
      setItems(rows)
      setWarnings(alerts.filter((item) => !item.resolved_at))
    } catch (error) { setMessage(error.message) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { void Promise.resolve().then(refresh); return subscribeToAdvisories(refresh) }, [refresh])

  const counts = useMemo(() => items.reduce((result, item) => {
    result.all += 1
    result[advisoryType(item)] += 1
    return result
  }, { all: 0, general: 0, warning: 0, incident: 0 }), [items])
  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => advisoryType(item) === filter), [filter, items])
  const advisoryPages = useTablePagination(visibleItems)

  async function withdraw(id) {
    try { await withdrawAdvisory(id); await refresh(); setMessage('Advisory withdrawn from tourist views.') }
    catch (error) { setMessage(error.message) }
  }

  function createStandalone() {
    const location = locations.find((item) => String(item.id) === String(profile?.location_id)) || locations[0]
    setEditor({ source: { _sourceType: 'standalone', location_id: location?.id, ecological_locations: location } })
  }

  const editorProps = { locations, activeWarnings: warnings, isSuperAdmin, profile, onClose: () => setEditor(null), onSaved: refresh }

  if (loading) return <LoadingScreen tone="blue" label="Loading advisories..." />

  return <div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Tourist communications</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900"><Megaphone className="text-orange-500" />Tourist advisories</h1><p className="mt-1 text-sm text-slate-500">Update, withdraw, and review the complete advisory history.</p></div><div className="flex gap-2"><button type="button" disabled={!locations.length} onClick={createStandalone} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Megaphone size={15} className="mr-2 inline" />Create advisory</button><button type="button" onClick={refresh} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500" aria-label="Refresh advisories"><RefreshCw size={17} /></button></div></header>
    {message && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
    <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Advisory types">{FILTERS.map((option) => <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${filter === option.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{option.label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${filter === option.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{counts[option.id]}</span></button>)}</nav>
    <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">{visibleItems.length ? <><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[800px] table-fixed text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="w-[39%] px-5 py-3">Advisory</th><th className="w-[21%] px-5 py-3">Location</th><th className="w-[16%] px-5 py-3">Schedule</th><th className="w-[12%] px-5 py-3">Status</th><th className="w-[12%] px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{advisoryPages.pageItems.map((item) => {
        const status = statusInfo(item)
        const canManage = item.status === 'published' && status.label !== 'Expired'
        return <tr key={item.id}><td className="min-w-0 px-5 py-4 align-top"><b className="block truncate text-slate-800" title={item.title}>{item.title}</b><div className="mt-1"><span className="inline-block max-w-full truncate rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700" title={sourceLabel(item)}>{sourceLabel(item)}</span></div><p className="mt-2 truncate text-xs text-slate-500" title={item.safety_instructions}>{item.safety_instructions}</p></td><td className="min-w-0 px-5 py-4 align-top text-slate-600"><p className="truncate" title={item.ecological_locations?.name}>{item.ecological_locations?.name}</p></td><td className="px-5 py-4 align-top text-xs text-slate-500">{new Date(item.starts_at).toLocaleString()}<br />to {new Date(item.expires_at).toLocaleString()}</td><td className="px-5 py-4 align-top"><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${status.style}`}>{status.label}</span></td><td className="px-5 py-4 align-top"><div className="flex flex-nowrap justify-end gap-2">{canManage && <><button type="button" onClick={() => setEditor({ advisory: item })} className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-700" aria-label="Edit advisory"><Pencil size={16} /></button><button type="button" onClick={() => withdraw(item.id)} className="shrink-0 rounded-lg bg-red-50 p-2 text-red-700" aria-label="Withdraw advisory"><Trash2 size={16} /></button></>}</div></td></tr>
      })}</tbody></table></div><TablePagination {...advisoryPages} onPageChange={advisoryPages.setPage} label="advisories" /></> : <p className="p-10 text-center text-sm text-slate-400">No {filter === 'all' ? '' : `${filter} `}advisories found.</p>}</section>
    {editor?.source && <AdvisoryEditor source={editor.source} {...editorProps} />}
    {editor?.advisory && <AdvisoryEditor advisory={editor.advisory} {...editorProps} />}
  </div>
}
