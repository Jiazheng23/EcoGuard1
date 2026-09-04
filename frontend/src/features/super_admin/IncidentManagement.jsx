import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileCheck2, MapPin, Megaphone, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react'
import { closeIncident, listManagedIncidents, reviewIncident, saveIncidentResponse, subscribeToIncidents, uploadResolutionEvidence } from '../../services/incidentService'
import AdvisoryEditor from './AdvisoryEditor'

const categoryLabels = {
  water_pollution: 'Water pollution', overflowing_rubbish: 'Overflowing rubbish',
  damaged_facilities_or_trail: 'Damaged facilities or trail', wildlife_disturbance: 'Wildlife disturbance',
  smoke_or_haze: 'Smoke or haze', overcrowding: 'Overcrowding',
}
const statusStyles = { submitted: 'bg-amber-50 text-amber-700', verified: 'bg-blue-50 text-blue-700', rejected: 'bg-red-50 text-red-700', closed: 'bg-emerald-50 text-emerald-700' }

export default function IncidentManagement({ user }) {
  const [incidents, setIncidents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const selectedIdRef = useRef(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [response, setResponse] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState({ text: '', error: false })
  const [advisorySource, setAdvisorySource] = useState(null)

  async function refresh(silent = false) {
    if (!silent) setLoading(true)
    try {
      const rows = await listManagedIncidents()
      setIncidents(rows)
      const current = selectedIdRef.current
      if (!current || !rows.some((item) => item.id === current)) {
        const first = rows[0] || null
        selectedIdRef.current = first?.id || null
        setSelectedId(first?.id || null)
        setResponse(first?.response_action || '')
        setReason(first?.rejection_reason || '')
      }
    } catch (error) { setNotice({ text: error.message || 'Unable to load incident reports.', error: true }) }
    finally { if (!silent) setLoading(false) }
  }

  useEffect(() => {
    void Promise.resolve().then(() => refresh())
    return subscribeToIncidents(() => refresh(true))
  }, [])

  const selected = incidents.find((item) => item.id === selectedId) || null
  const filtered = useMemo(() => incidents.filter((item) => {
    const term = query.trim().toLowerCase()
    return (status === 'all' || item.status === status) && (!term || [item.description, categoryLabels[item.category], item.ecological_locations?.name].some((value) => String(value || '').toLowerCase().includes(term)))
  }), [incidents, query, status])

  function select(item) {
    selectedIdRef.current = item.id
    setSelectedId(item.id); setResponse(item.response_action || ''); setReason(item.rejection_reason || ''); setFile(null); setNotice({ text: '', error: false })
  }

  async function act(action) {
    if (!selected || saving) return
    setSaving(true); setNotice({ text: '', error: false })
    try {
      if (action === 'verify') await reviewIncident(selected.id, 'verified')
      if (action === 'reject') await reviewIncident(selected.id, 'rejected', reason)
      if (action === 'response') await saveIncidentResponse(selected.id, response)
      if (action === 'evidence') await uploadResolutionEvidence(selected, user.id, file)
      if (action === 'close') await closeIncident(selected.id)
      await refresh(true)
      setFile(null)
      setNotice({ text: action === 'response' ? 'Response action saved.' : action === 'evidence' ? 'Resolution evidence uploaded.' : `Incident ${action === 'verify' ? 'verified' : action === 'reject' ? 'rejected' : 'closed'}.`, error: false })
    } catch (error) { setNotice({ text: error.message || 'Unable to update incident.', error: true }) }
    finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Community reports</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900"><ShieldAlert className="text-orange-500" />Environmental incidents</h1><p className="mt-1 text-sm text-slate-500">Review reports submitted by tourists and document verified incident responses.</p></div><button type="button" onClick={() => refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button></header>
    {notice.text && <p role={notice.error ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm ${notice.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.text}</p>}
    <section className="mt-5 grid min-h-[570px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:grid-cols-[minmax(320px,.9fr)_minmax(440px,1.4fr)]">
      <div className="border-b border-slate-100 lg:border-b-0 lg:border-r"><div className="flex gap-2 border-b border-slate-100 p-4"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><span className="sr-only">Search incident reports</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none" /></label><select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"><option value="all">All</option><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select></div>
        <div className="max-h-[620px] overflow-y-auto p-2">{loading ? <p className="p-10 text-center text-sm text-slate-400">Loading reports...</p> : filtered.length ? filtered.map((item) => <button key={item.id} type="button" onClick={() => select(item)} className={`mb-1 w-full rounded-xl p-3 text-left ${selectedId === item.id ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'}`}><div className="flex justify-between gap-2"><b className="text-sm text-slate-800">{categoryLabels[item.category]}</b><Status value={item.status} /></div><p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{item.ecological_locations?.name || `Location ${item.location_id}`}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p><p className="mt-2 text-[11px] text-slate-400">{formatDate(item.created_at)}</p></button>) : <p className="p-10 text-center text-sm text-slate-400">No matching reports.</p>}</div>
      </div>
      <div className="p-5 md:p-6">{!selected ? <div className="grid h-full place-items-center text-sm text-slate-400">Select an incident report.</div> : <><div className="flex flex-wrap items-center gap-2"><Status value={selected.status} /><span className="text-xs text-slate-400">Report #{selected.id}</span></div><h2 className="mt-3 text-xl font-bold text-slate-900">{categoryLabels[selected.category]}</h2><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{selected.ecological_locations?.name}</p><p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.description}</p>
        {selected.photo_url ? <a href={selected.photo_url} target="_blank" rel="noreferrer"><img src={selected.photo_url} alt="Tourist incident evidence" className="mt-4 max-h-72 w-full rounded-xl bg-slate-100 object-contain" /></a> : <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Submitted photo is unavailable.</p>}
        {selected.status === 'submitted' && <div className="mt-5 border-t border-slate-100 pt-5"><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => act('verify')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><CheckCircle2 size={16} />Verify incident</button></div><label className="mt-4 block text-xs font-semibold text-slate-500">Reason for rejection<textarea rows="2" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none" placeholder="Explain why this report is invalid or a duplicate" /></label><button type="button" disabled={saving || !reason.trim()} onClick={() => act('reject')} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-40"><XCircle size={16} />Reject report</button></div>}
        {selected.status === 'rejected' && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><b>Rejection reason</b><p className="mt-1">{selected.rejection_reason}</p></div>}
        {['verified', 'closed'].includes(selected.status) && <div className="mt-5 border-t border-slate-100 pt-5">{selected.status === 'verified' && <button type="button" onClick={() => setAdvisorySource(selected)} className="mb-5 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white"><Megaphone size={16} />Create Tourist Advisory</button>}<h3 className="font-bold text-slate-800">Incident response</h3><label className="mt-3 block text-xs font-semibold text-slate-500">Response action<textarea disabled={selected.status === 'closed'} rows="4" value={response} onChange={(e) => setResponse(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal leading-6 outline-none" placeholder="Describe containment, cleanup, repairs, communication, and follow-up..." /></label>{selected.status === 'verified' && <button type="button" disabled={saving || response.trim().length < 5} onClick={() => act('response')} className="mt-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Save response action</button>}
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileCheck2 size={16} />Resolution evidence</p>{selected.resolution_url && <a href={selected.resolution_url} target="_blank" rel="noreferrer"><img src={selected.resolution_url} alt="Incident resolution evidence" className="mt-3 max-h-56 w-full rounded-lg bg-slate-50 object-contain" /></a>}{selected.status === 'verified' && <><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-3 block w-full text-xs" /><button type="button" disabled={saving || !file} onClick={() => act('evidence')} className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40">Upload evidence</button></>}</div>
          {selected.status === 'verified' && <button type="button" disabled={saving || !selected.response_action || !selected.resolution_evidence_path} onClick={() => act('close')} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Close resolved incident</button>}</div>}
      </>}</div>
    </section>{advisorySource && <AdvisoryEditor source={advisorySource} onClose={() => setAdvisorySource(null)} onSaved={() => setNotice({ text: 'Tourist advisory published.', error: false })} />}
  </div>
}

function Status({ value }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[value] || 'bg-slate-100 text-slate-600'}`}>{value}</span> }
function formatDate(value) { return value ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available' }
