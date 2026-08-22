import { useState } from 'react'
import { ClipboardCheck, Save, X } from 'lucide-react'
import { createWasteCollection } from '../../../services/wasteService'
import { validateWasteCollection, WASTE_COLLECTION_SOURCES, WASTE_COLLECTION_STATUSES, WASTE_TYPES } from '../../../utils/wasteValidation'

export default function WasteCollectionForm({ location, schedule, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    schedule_id: schedule?.id || null,
    location_id: location.id,
    collected_at: toLocalInput(new Date()),
    total_kg: schedule ? '' : '0',
    recycled_kg: schedule ? '' : '0',
    waste_type: schedule?.waste_type || 'mixed',
    status: 'completed',
    source: 'manual',
    notes: '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function updateValue(event) {
    const { name, value } = event.target
    setValues((current) => {
      if (name === 'status' && value === 'missed') {
        return { ...current, status: value, total_kg: '0', recycled_kg: '0' }
      }
      return { ...current, [name]: value }
    })
    setErrors((current) => name === 'status'
      ? { ...current, status: undefined, total_kg: undefined, recycled_kg: undefined }
      : { ...current, [name]: undefined })
    setSubmitError('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateWasteCollection(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setSubmitError('')
    try {
      const saved = await createWasteCollection(values)
      await onSaved(saved, Boolean(schedule))
    } catch (saveError) {
      setSubmitError(saveError.message || 'Unable to record this waste collection.')
    } finally {
      setSaving(false)
    }
  }

  const total = Number(values.total_kg) || 0
  const recycled = Number(values.recycled_kg) || 0
  const landfill = Math.max(0, total - recycled)
  const missed = values.status === 'missed'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="waste-collection-title">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 p-5">
          <div><h2 id="waste-collection-title" className="flex items-center gap-2 text-lg font-bold text-slate-800"><ClipboardCheck size={20} className="text-green-500" />Record waste collection</h2><p className="mt-1 text-xs text-slate-400">{schedule ? `Completes the ${formatDate(schedule.scheduled_for)} schedule atomically.` : 'Creates an unscheduled collection-history record.'}</p></div>
          <button type="button" onClick={onClose} aria-label="Close collection form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Location"><input value={location.name} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" /></FormField>
            <FormField label="Collection time" error={errors.collected_at}><input name="collected_at" type="datetime-local" max={toLocalInput(new Date())} value={values.collected_at} onChange={updateValue} className={inputClass(errors.collected_at)} /></FormField>
            <FormField label="Waste type" error={errors.waste_type}><select name="waste_type" value={values.waste_type} onChange={updateValue} disabled={Boolean(schedule)} className={`${inputClass(errors.waste_type)} disabled:bg-slate-50 disabled:text-slate-500`}>{WASTE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></FormField>
            <FormField label="Collection status" error={errors.status}><select name="status" value={values.status} onChange={updateValue} className={inputClass(errors.status)}>{WASTE_COLLECTION_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></FormField>
            <FormField label="Total collected" error={errors.total_kg}><div className="relative"><input name="total_kg" type="number" min="0" step="0.01" value={values.total_kg} onChange={updateValue} disabled={missed} className={`${inputClass(errors.total_kg)} pr-9 disabled:bg-slate-50`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kg</span></div></FormField>
            <FormField label="Recycled amount" error={errors.recycled_kg}><div className="relative"><input name="recycled_kg" type="number" min="0" step="0.01" value={values.recycled_kg} onChange={updateValue} disabled={missed} className={`${inputClass(errors.recycled_kg)} pr-9 disabled:bg-slate-50`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kg</span></div></FormField>
            <FormField label="Data source" error={errors.source}><select name="source" value={values.source} onChange={updateValue} className={inputClass(errors.source)}>{WASTE_COLLECTION_SOURCES.map((source) => <option key={source} value={source}>{source === 'simulated_sensor' ? 'Simulated sensor data' : 'Manual entry'}</option>)}</select></FormField>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Calculated landfill amount</p><p className="mt-1 text-lg font-bold text-slate-800">{landfill.toFixed(2)} kg</p><p className="text-[11px] text-slate-400">Total minus recycled</p></div>
          </div>

          {values.source === 'simulated_sensor' && <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-700"><b>Simulated data:</b> this record represents assignment-safe sensor output, not a real IoT device reading.</div>}
          {missed && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">A missed collection records zero kilograms. For a scheduled record, the schedule will also be marked missed.</div>}
          <FormField label="Notes (optional)"><textarea name="notes" rows="3" value={values.notes} onChange={updateValue} placeholder="Collection result, issue, vehicle, or reason for a missed collection" className={inputClass()} /></FormField>
          {submitError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{submitError}</div>}

          <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Recording...' : 'Record collection'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function FormField({ label, error, children }) {
  return <label className="block text-xs font-semibold text-slate-600"><span>{label}</span><span className="mt-1 block">{children}</span>{error && <span className="mt-1 block font-normal text-red-500">{error}</span>}</label>
}

function inputClass(error) {
  return `w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 ${error ? 'border-red-300' : 'border-slate-200'}`
}

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function titleCase(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
