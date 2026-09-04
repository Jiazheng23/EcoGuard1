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

export default function AdvisoryEditor({ source, advisory, onClose, onSaved }) {
  const location = source?.ecological_locations || advisory?.ecological_locations
  const [form, setForm] = useState({
    title: advisory?.title || `${source?.category?.replaceAll('_', ' ') || 'Environmental'} advisory`,
    affected_area: advisory?.affected_area || '', safety_instructions: advisory?.safety_instructions || '',
    recommended_visiting_time: advisory?.recommended_visiting_time || '', alternative_location: advisory?.alternative_location || '',
    starts_at: localInput(advisory?.starts_at || DEFAULT_START), expires_at: localInput(advisory?.expires_at || DEFAULT_EXPIRY),
  })
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function submit() {
    if (Object.values(form).some((value) => !String(value).trim())) { setError('Complete every advisory field.'); return }
    if (new Date(form.expires_at) <= new Date(form.starts_at)) { setError('Expiry time must be after the start time.'); return }
    setSaving(true); setError('')
    try {
      const isWarning = source?._sourceType === 'warning'
      const saved = await saveAdvisory({ ...form, id: advisory?.id, location_id: source?.location_id || advisory.location_id, locationName: location?.name, source_incident_id: isWarning ? null : source?.id || advisory?.source_incident_id, source_warning_id: isWarning ? source.id : advisory?.source_warning_id || null, starts_at: new Date(form.starts_at).toISOString(), expires_at: new Date(form.expires_at).toISOString() })
      onSaved?.(saved); onClose()
    } catch (saveError) { setError(saveError.message || 'Unable to publish advisory.') }
    finally { setSaving(false) }
  }

  return createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/65 p-4" role="dialog" aria-modal="true"><section className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"><header className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">{advisory ? 'Update advisory' : 'Create tourist advisory'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{location?.name}</h2><p className="mt-1 text-sm text-slate-500">Source: {source?.description || advisory?.title}</p></div><button type="button" onClick={onClose} aria-label="Close advisory editor"><X className="text-slate-400" /></button></header>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Advisory title" value={form.title} onChange={(v) => change('title', v)} /><Field label="Affected area" value={form.affected_area} onChange={(v) => change('affected_area', v)} /><Field label="Safety instructions" value={form.safety_instructions} onChange={(v) => change('safety_instructions', v)} area /><Field label="Recommended visiting time" value={form.recommended_visiting_time} onChange={(v) => change('recommended_visiting_time', v)} area /><Field label="Alternative location" value={form.alternative_location} onChange={(v) => change('alternative_location', v)} /><Field label="Start time" type="datetime-local" value={form.starts_at} onChange={(v) => change('starts_at', v)} /><Field label="Expiry time" type="datetime-local" value={form.expires_at} onChange={(v) => change('expires_at', v)} /></div>
    {preview && <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-orange-950"><div className="flex gap-3"><Megaphone className="shrink-0 text-orange-600" /><div><h3 className="font-bold">{form.title || 'Advisory title'}</h3><p className="mt-1 text-sm"><b>{form.affected_area || 'Affected area'}:</b> {form.safety_instructions || 'Safety instructions'}</p><p className="mt-2 text-sm">Recommended: {form.recommended_visiting_time || 'Not entered'} Alternative: {form.alternative_location || 'Not entered'}.</p></div></div></div>}
    <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"><Eye size={16} />{preview ? 'Hide preview' : 'Preview message'}</button><button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Megaphone size={16} />{saving ? 'Publishing...' : advisory ? 'Update advisory' : 'Publish advisory'}</button></div></section></div>, document.body)
}

function Field({ label, value, onChange, area, type = 'text' }) { const Component = area ? 'textarea' : 'input'; return <label className={`text-xs font-semibold text-slate-500 ${area ? 'sm:col-span-2' : ''}`}>{label}<Component type={area ? undefined : type} rows={area ? 3 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-blue-500" /></label> }
