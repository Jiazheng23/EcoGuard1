import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Megaphone, X } from 'lucide-react'
import { saveAdvisory } from '../../services/advisoryService'

const DEFAULT_START = new Date()
const DEFAULT_EXPIRY = new Date(DEFAULT_START.getTime() + 3 * 86400000)

function localInput(date) {
  if (!date) return ''
  const value = new Date(date); value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

function visitingRange(value) {
  const matches = String(value || '').match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/)
  return { start: matches?.[1] || '09:00', end: matches?.[2] || '17:00' }
}

function previewDate(value) {
  if (!value) return 'Not selected'
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AdvisoryEditor({ source, advisory, locations = [], activeWarnings = [], isSuperAdmin = false, profile, onClose, onSaved }) {
  const [warningId, setWarningId] = useState(source?._sourceType === 'warning' ? String(source.id) : '')
  const selectedWarning = activeWarnings.find((item) => String(item.id) === warningId)
  const sourceLocked = Boolean(source?.id && source?._sourceType !== 'standalone') || Boolean(selectedWarning)
  const initialLocationId = source?.location_id || advisory?.location_id || profile?.location_id || locations[0]?.id || ''
  const [locationId, setLocationId] = useState(String(initialLocationId))
  const location = locations.find((item) => String(item.id) === locationId) || source?.ecological_locations || advisory?.ecological_locations
  const initialVisitingRange = visitingRange(advisory?.recommended_visiting_time)
  const [form, setForm] = useState({
    title: advisory?.title || `${source?.category?.replaceAll('_', ' ') || 'Environmental'} advisory`,
    affected_area: advisory?.affected_area || '', safety_instructions: advisory?.safety_instructions || '',
    recommended_start_time: initialVisitingRange.start, recommended_end_time: initialVisitingRange.end,
    alternative_location: advisory?.alternative_location === 'No alternative specified' ? '' : advisory?.alternative_location || '',
    starts_at: localInput(advisory?.starts_at || DEFAULT_START), expires_at: localInput(advisory?.expires_at || DEFAULT_EXPIRY),
  })
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  function chooseWarning(value) {
    setWarningId(value)
    const warning = activeWarnings.find((item) => String(item.id) === value)
    if (warning) setLocationId(String(warning.location_id))
  }

  async function submit() {
    if (!locationId) { setError('Select an advisory location.'); return }
    const requiredFields = ['title', 'affected_area', 'safety_instructions', 'recommended_start_time', 'recommended_end_time', 'starts_at', 'expires_at']
    if (requiredFields.some((key) => !String(form[key]).trim())) { setError('Complete all required advisory fields.'); return }
    if (form.recommended_end_time <= form.recommended_start_time) { setError('Recommended visiting end time must be after the start time.'); return }
    if (new Date(form.expires_at) <= new Date(form.starts_at)) { setError('Expiry time must be after the start time.'); return }
    setSaving(true); setError('')
    try {
      const isWarning = source?._sourceType === 'warning' || Boolean(selectedWarning)
      const standalone = source?._sourceType === 'standalone'
      const saved = await saveAdvisory({ ...form, recommended_visiting_time: `${form.recommended_start_time} – ${form.recommended_end_time}`, alternative_location: form.alternative_location.trim() || 'No alternative specified', id: advisory?.id, location_id: Number(locationId), locationName: location?.name, source_incident_id: standalone || isWarning ? null : source?.id || advisory?.source_incident_id, source_warning_id: isWarning ? selectedWarning?.id || source.id : advisory?.source_warning_id || null, starts_at: new Date(form.starts_at).toISOString(), expires_at: new Date(form.expires_at).toISOString() })
      onSaved?.(saved); onClose()
    } catch (saveError) { setError(saveError.message || 'Unable to publish advisory.') }
    finally { setSaving(false) }
  }

  return createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true"><header className="flex shrink-0 justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">{advisory ? 'Update advisory' : 'Create tourist advisory'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{location?.name}</h2><p className="mt-1 text-sm text-slate-500">Source: {source?.description || advisory?.title || 'General location advisory'}</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close advisory editor"><X className="text-slate-400" /></button></header><div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{!advisory && source?._sourceType === 'standalone' && <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Link to active warning <span className="font-normal text-slate-400">(optional)</span><select value={warningId} onChange={(event) => chooseWarning(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700"><option value="">No warning — general location advisory</option>{activeWarnings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}<label className="text-xs font-semibold text-slate-500">Advisory location<select value={locationId} disabled={!isSuperAdmin || sourceLocked || Boolean(advisory)} onChange={(event) => setLocationId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 disabled:bg-slate-100"><option value="">Select location</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-slate-400">{sourceLocked ? 'Automatically routed from the selected source.' : isSuperAdmin ? 'Choose any managed destination.' : 'Locked to your assigned destination.'}</span></label><Field label="Advisory title" value={form.title} onChange={(v) => change('title', v)} /><Field label="Affected area within this destination" value={form.affected_area} onChange={(v) => change('affected_area', v)} /><Field label="Alternative location (optional)" value={form.alternative_location} onChange={(v) => change('alternative_location', v)} placeholder="Leave blank if no suitable alternative is known" /><Field label="Safety instructions" value={form.safety_instructions} onChange={(v) => change('safety_instructions', v)} area /><div className="sm:col-span-2"><p className="text-xs font-semibold text-slate-500">Recommended visiting time range</p><div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><Field label="From" type="time" value={form.recommended_start_time} onChange={(v) => change('recommended_start_time', v)} /><span className="mt-5 text-sm font-semibold text-slate-400">to</span><Field label="Until" type="time" value={form.recommended_end_time} onChange={(v) => change('recommended_end_time', v)} /></div></div><Field label="Advisory start date and time" type="datetime-local" value={form.starts_at} onChange={(v) => change('starts_at', v)} /><Field label="Advisory expiry date and time" type="datetime-local" value={form.expires_at} onChange={(v) => change('expires_at', v)} /></div>
    {preview && <div className="mt-5 overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 text-orange-950"><div className="flex items-center justify-between gap-3 border-b border-orange-200 px-5 py-3"><div className="flex items-center gap-2"><Megaphone className="text-orange-600" size={19} /><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Tourist advisory preview</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-orange-700">{location?.name || 'Location'}</span></div><div className="p-5"><h3 className="text-lg font-bold">{form.title || 'Advisory title'}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><PreviewItem label="Affected area" value={form.affected_area || 'Not provided'} /><PreviewItem label="Recommended visiting time" value={`${form.recommended_start_time || '--:--'} - ${form.recommended_end_time || '--:--'}`} /></div><div className="mt-3"><PreviewItem label="Safety instructions" value={form.safety_instructions || 'Not provided'} /></div>{form.alternative_location && <div className="mt-3"><PreviewItem label="Alternative location" value={form.alternative_location} /></div>}<p className="mt-4 text-xs text-orange-700">Active from {previewDate(form.starts_at)} until {previewDate(form.expires_at)}</p></div></div>}
    </div><footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4"><button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"><Eye size={16} />{preview ? 'Hide preview' : 'Preview message'}</button><button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Megaphone size={16} />{saving ? 'Publishing...' : advisory ? 'Update advisory' : 'Publish advisory'}</button></footer></section></div>, document.body)
}

function Field({ label, value, onChange, area, type = 'text', placeholder }) { const Component = area ? 'textarea' : 'input'; const picker = ['date', 'time', 'datetime-local'].includes(type); return <label className={`text-xs font-semibold text-slate-500 ${area ? 'sm:col-span-2' : ''}`}>{label}<Component type={area ? undefined : type} rows={area ? 3 : undefined} value={value} placeholder={placeholder} onClick={picker ? (event) => event.currentTarget.showPicker?.() : undefined} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-blue-500" /></label> }

function PreviewItem({ label, value }) { return <div className="min-w-0 max-w-full overflow-hidden rounded-xl bg-white/70 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-orange-600">{label}</p><p className="mt-1 max-w-full whitespace-pre-wrap text-sm leading-6" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</p></div> }
