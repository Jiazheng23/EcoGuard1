import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Expand, FileCheck2, MapPin, Megaphone, Plus, RefreshCw, Search, ShieldAlert, X, XCircle } from 'lucide-react'
import { listManagedIncidents, removeResolutionEvidence, reviewIncident, reviewIncidentAudit, saveIncidentResponse, submitIncidentForAudit, subscribeToIncidents, uploadResolutionEvidence } from '../../services/incidentService'
import AdvisoryEditor from './AdvisoryEditor'
import LoadingScreen from '../../components/LoadingScreen'

const categoryLabels = {
  water_pollution: 'Water pollution', overflowing_rubbish: 'Overflowing rubbish',
  damaged_facilities_or_trail: 'Damaged facilities or trail', wildlife_disturbance: 'Wildlife disturbance',
  smoke_or_haze: 'Smoke or haze', overcrowding: 'Overcrowding',
}
const statusStyles = { submitted: 'bg-amber-50 text-amber-700', verified: 'bg-blue-50 text-blue-700', changes_requested: 'bg-orange-50 text-orange-700', rejected: 'bg-red-50 text-red-700', closed: 'bg-emerald-50 text-emerald-700' }
const displayStatus = (item) => item?.audit_status === 'changes_requested' ? 'changes_requested' : item?.status
const categoryLabel = (item) => item?.category === 'other' ? item.custom_category || 'Other' : categoryLabels[item?.category] || 'Other'

export default function IncidentManagement({ user, locations, isSuperAdmin, profile }) {
  const [incidents, setIncidents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const selectedIdRef = useRef(null)
  const evidenceInputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [response, setResponse] = useState('')
  const [reason, setReason] = useState('')
  const [auditComment, setAuditComment] = useState('')
  const [files, setFiles] = useState([])
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
        setAuditComment(first?.audit_comment || '')
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
    return (status === 'all' || displayStatus(item) === status) && (!term || [item.description, categoryLabel(item), item.ecological_locations?.name].some((value) => String(value || '').toLowerCase().includes(term)))
  }), [incidents, query, status])
  const filePreviews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files])

  useEffect(() => () => filePreviews.forEach((item) => URL.revokeObjectURL(item.url)), [filePreviews])

  function select(item) {
    selectedIdRef.current = item.id
    setSelectedId(item.id); setResponse(item.response_action || ''); setReason(item.rejection_reason || ''); setAuditComment(item.audit_comment || ''); setFiles([]); setNotice({ text: '', error: false })
  }

  async function act(action) {
    if (!selected || saving) return
    if (isSuperAdmin && ['verify', 'reject', 'response', 'submit-audit'].includes(action)) {
      setNotice({ text: 'Super administrators can only review a submitted resolution and approve it or request changes.', error: true })
      return
    }
    setSaving(true); setNotice({ text: '', error: false })
    try {
      if (action === 'verify') await reviewIncident(selected.id, 'verified')
      if (action === 'reject') await reviewIncident(selected.id, 'rejected', reason)
      if (action === 'response') await saveIncidentResponse(selected.id, response)
      if (action === 'submit-audit') {
        if (files.length) await uploadResolutionEvidence(selected, user.id, files)
        await submitIncidentForAudit(selected.id)
      }
      if (action === 'approve-audit') await reviewIncidentAudit(selected.id, 'approved', auditComment)
      if (action === 'request-changes') await reviewIncidentAudit(selected.id, 'changes_requested', auditComment)
      await refresh(true)
      setFiles([])
      setNotice({ text: action === 'response' ? 'Proposed response action saved. You can now add resolution evidence.' : action === 'submit-audit' ? 'Resolution submitted for super-admin approval.' : action === 'approve-audit' ? 'Resolution approved and incident closed.' : action === 'request-changes' ? 'Resolution returned to the location administrator.' : `Incident ${action === 'verify' ? 'verified' : 'rejected'}.`, error: false })
    } catch (error) { setNotice({ text: error.message || 'Unable to update incident.', error: true }) }
    finally { setSaving(false) }
  }

  async function removeEvidence(path) {
    if (!selected || saving) return
    setSaving(true)
    try { await removeResolutionEvidence(selected, path); await refresh(true); setNotice({ text: 'Resolution image removed.', error: false }) }
    catch (error) { setNotice({ text: error.message || 'Unable to remove resolution image.', error: true }) }
    finally { setSaving(false) }
  }

  function chooseEvidence(event) {
    const chosen = Array.from(event.target.files || [])
    if (chosen.length) setFiles((current) => [...current, ...chosen])
    event.target.value = ''
  }

  if (loading) return <LoadingScreen tone="blue" label="Loading incident reports..." />

  return <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col overflow-hidden">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Community reports</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900"><ShieldAlert className="text-orange-500" />Environmental incidents</h1><p className="mt-1 text-sm text-slate-500">Review reports submitted by tourists and document verified incident responses.</p></div><button type="button" onClick={() => refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button></header>
    {notice.text && <p role={notice.error ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm ${notice.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.text}</p>}
    <section className="mt-5 grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:grid-cols-[minmax(320px,.9fr)_minmax(440px,1.4fr)]">
      <div className="flex min-h-0 flex-col border-b border-slate-100 lg:border-b-0 lg:border-r"><div className="shrink-0 flex gap-2 border-b border-slate-100 p-4"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><span className="sr-only">Search incident reports</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none" /></label><select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"><option value="all">All</option><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">{filtered.length ? filtered.map((item) => <button key={item.id} type="button" onClick={() => select(item)} className={`mb-1 w-full rounded-xl p-3 text-left ${selectedId === item.id ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'}`}><div className="flex justify-between gap-2"><b className="text-sm text-slate-800">{categoryLabel(item)}</b><Status value={displayStatus(item)} /></div><p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{item.ecological_locations?.name || `Location ${item.location_id}`}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p><p className="mt-2 text-[11px] text-slate-400">{formatDate(item.created_at)}</p></button>) : <p className="p-10 text-center text-sm text-slate-400">No matching reports.</p>}</div>
      </div>
      <div className="min-h-0 overflow-y-auto p-5 md:p-6">{!selected ? <div className="grid h-full place-items-center text-sm text-slate-400">Select an incident report.</div> : <><div className="flex flex-wrap items-center gap-2"><Status value={displayStatus(selected)} /><span className="text-xs text-slate-400">Report #{selected.id}</span></div><h2 className="mt-3 text-xl font-bold text-slate-900">{categoryLabel(selected)}</h2>{selected.category === 'other' && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet-600">Custom issue category</p>}<p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{selected.ecological_locations?.name}</p><p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.description}</p>{selected.audit_status === 'changes_requested' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><b>Changes requested by super admin</b><p className="mt-1">{selected.audit_comment}</p></div>}
        <IncidentPhotoSlideshow key={selected.id} urls={selected.photo_urls?.length ? selected.photo_urls : [selected.photo_url].filter(Boolean)} />
        {selected.status === 'submitted' && !isSuperAdmin && <div className="mt-5 border-t border-slate-100 pt-5"><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => act('verify')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><CheckCircle2 size={16} />Verify incident</button></div><label className="mt-4 block text-xs font-semibold text-slate-500">Reason for rejection<textarea rows="2" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none" placeholder="Explain why this report is invalid or a duplicate" /></label><button type="button" disabled={saving || !reason.trim()} onClick={() => act('reject')} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-40"><XCircle size={16} />Reject report</button></div>}
        {selected.status === 'submitted' && isSuperAdmin && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><b>Awaiting location administrator verification</b><p className="mt-1 leading-6">Only the administrator assigned to this location can verify or reject this report. Super-admin review becomes available after the response action and resolution evidence are submitted for audit.</p></div>}
        {selected.status === 'rejected' && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><b>Rejection reason</b><p className="mt-1">{selected.rejection_reason}</p></div>}
        {['verified', 'closed'].includes(selected.status) && <div className="mt-5 border-t border-slate-100 pt-5">{selected.status === 'verified' && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-700">Optional step</p><p className="mt-1 text-sm text-orange-800">Publish safety guidance for tourists when public communication is needed.</p></div><button type="button" onClick={() => setAdvisorySource(selected)} className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-bold text-orange-700 hover:bg-orange-100"><Megaphone size={16} />Create tourist advisory</button></div>}<div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-800">Step 1 · Proposed response action</h3>{selected.response_action && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">Saved</span>}</div><p className="mt-1 text-xs text-slate-500">Save the action plan before adding resolution evidence.</p>{isSuperAdmin && !selected.response_action && <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"><Clock3 className="mt-0.5 shrink-0" size={18} /><div><p className="text-sm font-bold">Waiting for proposed response action</p><p className="mt-1 text-xs leading-5">The location administrator has not recorded the action taken or proposed solution yet. Super-admin review will be available after the complete resolution is submitted.</p></div></div>}<label className="mt-3 block text-xs font-semibold text-slate-500">Action taken or proposed<textarea disabled={selected.status === 'closed' || isSuperAdmin || selected.audit_status === 'pending'} rows="4" value={response} onChange={(e) => setResponse(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal leading-6 outline-none disabled:bg-slate-100" placeholder="Describe containment, cleanup, repairs, communication, and follow-up..." /></label>{selected.status === 'verified' && !isSuperAdmin && selected.audit_status !== 'pending' && <button type="button" disabled={saving || response.trim().length < 5} onClick={() => act('response')} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{selected.response_action ? 'Update response action' : 'Save response action'}</button>}</div>
          <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileCheck2 size={16} />Step 2 · Resolution evidence</p><span className="text-[11px] text-slate-400">Click an image to preview</span></div><input ref={evidenceInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={chooseEvidence} className="hidden" />{isSuperAdmin && !selected.resolution_urls?.length && <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"><Clock3 className="mt-0.5 shrink-0" size={18} /><div><p className="text-sm font-bold">Waiting for resolution evidence</p><p className="mt-1 text-xs leading-5">The location administrator has not submitted any resolution images yet. Audit controls will become available after the proposed response and evidence are submitted.</p></div></div>}<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{selected.resolution_urls?.map((url, index) => <div key={url} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><a href={url} target="_blank" rel="noreferrer" title="Open full-size preview"><img src={url} alt={`Incident resolution evidence ${index + 1}`} className="h-28 w-full object-cover" /></a><span className="pointer-events-none absolute bottom-1 left-1 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">Evidence {index + 1}</span>{selected.status === 'verified' && !isSuperAdmin && selected.audit_status !== 'pending' && <button type="button" disabled={saving} onClick={() => removeEvidence(selected.resolution_evidence_paths?.[index])} aria-label={`Remove evidence ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-white/95 p-1.5 text-red-500 shadow hover:bg-red-50"><X size={14} /></button>}</div>)}{filePreviews.map((item, index) => <div key={item.url} className="relative overflow-hidden rounded-xl border border-blue-300 bg-blue-50"><a href={item.url} target="_blank" rel="noreferrer" title="Open full-size preview"><img src={item.url} alt={`New resolution evidence ${index + 1}`} className="h-28 w-full object-cover" /></a><span className="pointer-events-none absolute bottom-1 left-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">New {index + 1}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove new evidence ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-white/95 p-1.5 text-red-500 shadow hover:bg-red-50"><X size={14} /></button></div>)}{selected.status === 'verified' && !isSuperAdmin && selected.audit_status !== 'pending' && selected.response_action && <button type="button" onClick={() => evidenceInputRef.current?.click()} className="flex min-h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 text-blue-600 hover:border-blue-400 hover:bg-blue-50"><Plus size={22} /><span className="mt-1 text-sm font-semibold">Add images</span><span className="text-[10px] text-blue-400">Select one or many</span></button>}</div>{!selected.response_action && selected.status === 'verified' && !isSuperAdmin && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-700">Save the proposed response action before adding evidence.</p>}</div>
          {selected.status === 'verified' && !isSuperAdmin && selected.audit_status !== 'pending' && <button type="button" disabled={saving || !selected.response_action || (!files.length && !selected.resolution_evidence_path && !selected.resolution_evidence_paths?.length)} onClick={() => act('submit-audit')} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? 'Submitting...' : 'Submit for audit'}</button>}
          {selected.status === 'verified' && selected.audit_status === 'pending' && !isSuperAdmin && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">Awaiting super-admin audit. The response is locked until reviewed.</p>}
          {isSuperAdmin && selected.status === 'verified' && selected.audit_status === 'pending' && <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4"><h3 className="font-bold text-violet-900">Super-admin review</h3><p className="mt-1 text-xs text-violet-700">Review the proposed action and every evidence image before deciding.</p><label className="mt-3 block text-xs font-semibold text-violet-800">Review comment <span className="font-normal text-violet-500">(required when requesting changes)</span><textarea rows="3" value={auditComment} onChange={(e) => setAuditComment(e.target.value)} className="mt-1 w-full rounded-xl border border-violet-200 bg-white p-3 text-sm font-normal outline-none" placeholder="Explain what must be corrected or add an approval note" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => act('approve-audit')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Approve resolution</button><button type="button" disabled={saving || !auditComment.trim()} onClick={() => act('request-changes')} className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-700 disabled:opacity-40">Request changes</button></div></div>}
          {selected.status === 'closed' && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><b>Audit approved</b><p className="mt-1">{selected.audit_comment || 'The resolution evidence was approved by a super administrator.'}</p><p className="mt-2 text-xs">Audited {formatDate(selected.audited_at || selected.closed_at)}</p></div>}</div>}
      </>}</div>
    </section>{advisorySource && <AdvisoryEditor source={advisorySource} locations={locations} isSuperAdmin={isSuperAdmin} profile={profile} onClose={() => setAdvisorySource(null)} onSaved={() => setNotice({ text: 'Tourist advisory published.', error: false })} />}
  </div>
}

function Status({ value }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[value] || 'bg-slate-100 text-slate-600'}`}>{String(value || '').replaceAll('_', ' ')}</span> }
function formatDate(value) { return value ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available' }

function IncidentPhotoSlideshow({ urls }) {
  const [index, setIndex] = useState(0)
  if (!urls.length) return <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Submitted photos are unavailable.</p>
  const activeUrl = urls[index] || urls[0]
  const move = (amount) => setIndex((current) => (current + amount + urls.length) % urls.length)

  return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tourist-submitted evidence</p><span className="text-xs font-semibold text-slate-400">{index + 1} / {urls.length}</span></div><div className="group relative overflow-hidden rounded-xl bg-slate-900"><img src={activeUrl} alt={`Tourist incident evidence ${index + 1}`} className="h-72 w-full object-contain" />{urls.length > 1 && <><button type="button" onClick={() => move(-1)} aria-label="Previous evidence image" className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-slate-950/70 text-white hover:bg-slate-950"><ChevronLeft size={20} /></button><button type="button" onClick={() => move(1)} aria-label="Next evidence image" className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-slate-950/70 text-white hover:bg-slate-950"><ChevronRight size={20} /></button></>}<a href={activeUrl} target="_blank" rel="noreferrer" aria-label="Open evidence image at full size" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-slate-950/70 text-white hover:bg-slate-950"><Expand size={17} /></a></div>{urls.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{urls.map((url, itemIndex) => <button key={url} type="button" onClick={() => setIndex(itemIndex)} aria-label={`View evidence image ${itemIndex + 1}`} className={`shrink-0 overflow-hidden rounded-lg border-2 ${itemIndex === index ? 'border-blue-500' : 'border-transparent opacity-70 hover:opacity-100'}`}><img src={url} alt="" className="h-14 w-20 object-cover" /></button>)}</div>}</div>
}
