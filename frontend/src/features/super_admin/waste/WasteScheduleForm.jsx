import { useState } from 'react'
import { CalendarClock, Save, X } from 'lucide-react'
import { createWasteSchedule, updateWasteSchedule } from '../../../services/wasteService'
import { isWasteScheduleConflict, validateWasteSchedule, WASTE_TYPES } from '../../../utils/wasteValidation'
import { useToast } from '../../../components/toastContext'

export default function WasteScheduleForm({ location, schedule, schedules, onClose, onSaved }) {
  const toast = useToast()
  const editing = Boolean(schedule)
  const [values, setValues] = useState(() => initialValues(location, schedule))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function updateValue(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, conflict: undefined }))
    setSubmitError('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateWasteSchedule(values)
    if (isWasteScheduleConflict(values, schedules, schedule?.id)) {
      nextErrors.conflict = 'This collection window overlaps another active schedule at this location.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast.reminder('Please correct the highlighted schedule fields.')
      return
    }

    setSaving(true)
    setSubmitError('')
    try {
      const saved = editing
        ? await updateWasteSchedule(schedule.id, values)
        : await createWasteSchedule(values)
      await onSaved(saved, editing)
      toast.success(editing ? 'Collection schedule updated successfully.' : 'Collection schedule created successfully.')
    } catch (saveError) {
      const failure = saveError.message || 'Unable to save the collection schedule.'
      setSubmitError(failure)
      toast.error(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center overflow-hidden bg-slate-950/45 px-4 pb-4 pt-20" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }} onKeyDown={(event) => { if (event.key === 'Escape' && !saving) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="waste-schedule-title" className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-100 p-5">
          <div><h2 id="waste-schedule-title" className="flex items-center gap-2 text-lg font-bold text-slate-800"><CalendarClock size={20} className="text-blue-500" />{editing ? 'Edit collection schedule' : 'Create collection schedule'}</h2><p className="mt-1 text-xs text-slate-400">Collection windows cannot overlap at the same location.</p></div>
          <button type="button" onClick={onClose} aria-label="Close schedule form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <FormField label="Location"><input value={location.name} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" /></FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Collection starts" error={errors.scheduled_for}><input name="scheduled_for" type="datetime-local" value={values.scheduled_for} onChange={updateValue} className={inputClass(errors.scheduled_for)} /></FormField>
            <FormField label="Collection ends" error={errors.scheduled_until}><input name="scheduled_until" type="datetime-local" value={values.scheduled_until} onChange={updateValue} className={inputClass(errors.scheduled_until)} /></FormField>
            <FormField label="Waste type" error={errors.waste_type}><select name="waste_type" value={values.waste_type} onChange={updateValue} className={inputClass(errors.waste_type)}>{WASTE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></FormField>
            <FormField label="Assigned team" error={errors.assigned_team}><input name="assigned_team" value={values.assigned_team} onChange={updateValue} placeholder="Example: Team A" className={inputClass(errors.assigned_team)} /></FormField>
          </div>
          <FormField label="Notes (optional)"><textarea name="notes" rows="3" maxLength="1000" value={values.notes} onChange={updateValue} placeholder="Vehicle, route, or handling instructions" className={inputClass()} /></FormField>

          {errors.conflict && <Notice message={errors.conflict} />}
          {submitError && <Notice message={submitError} />}
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white p-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saving...' : editing ? 'Save changes' : 'Create schedule'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function initialValues(location, schedule) {
  const defaultStart = new Date(Date.now() + 60 * 60 * 1000)
  defaultStart.setMinutes(0, 0, 0)
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000)
  return {
    location_id: location.id,
    scheduled_for: toLocalInput(schedule?.scheduled_for || defaultStart),
    scheduled_until: toLocalInput(schedule?.scheduled_until || defaultEnd),
    waste_type: schedule?.waste_type || 'mixed',
    assigned_team: schedule?.assigned_team || '',
    status: schedule?.status || 'scheduled',
    notes: schedule?.notes || '',
  }
}

function FormField({ label, error, children }) {
  return <label className="block text-xs font-semibold text-slate-600"><span>{label}</span><span className="mt-1 block">{children}</span>{error && <span className="mt-1 block font-normal text-red-500">{error}</span>}</label>
}

function Notice({ message }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{message}</div>
}

function inputClass(error) {
  return `w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500'}`
}

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function titleCase(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
