import { useState } from 'react'
import { AlertTriangle, Save, SlidersHorizontal } from 'lucide-react'
import { saveWasteThreshold } from '../../../services/wasteService'
import { validateWasteThresholds } from '../../../utils/wasteValidation'

const DEFAULT_THRESHOLDS = {
  moderate_kg: 25,
  high_risk_kg: 50,
  critical_kg: 75,
}

export default function WasteThresholdSettings({ location, threshold, onSaved }) {
  const [values, setValues] = useState(() => ({
    location_id: location.id,
    moderate_kg: threshold?.moderate_kg ?? DEFAULT_THRESHOLDS.moderate_kg,
    high_risk_kg: threshold?.high_risk_kg ?? DEFAULT_THRESHOLDS.high_risk_kg,
    critical_kg: threshold?.critical_kg ?? DEFAULT_THRESHOLDS.critical_kg,
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function updateValue(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateWasteThresholds(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setMessage('')
    try {
      await saveWasteThreshold(values)
      await onSaved?.()
      setMessage('Thresholds saved for this location.')
    } catch (saveError) {
      setMessage(saveError.message || 'Unable to save waste thresholds.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-800"><SlidersHorizontal size={18} className="text-amber-500" />Waste alert thresholds</h2>
          <p className="mt-1 text-xs text-slate-400">Configure the kilogram boundaries used to label sensor readings for {location.name}.</p>
        </div>
        {!threshold && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><AlertTriangle size={13} />Unsaved defaults</span>}
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-start">
        <ThresholdInput name="moderate_kg" label="Moderate from" value={values.moderate_kg} color="text-yellow-600" error={errors.moderate_kg} onChange={updateValue} />
        <ThresholdInput name="high_risk_kg" label="High Risk from" value={values.high_risk_kg} color="text-orange-600" error={errors.high_risk_kg} onChange={updateValue} />
        <ThresholdInput name="critical_kg" label="Critical from" value={values.critical_kg} color="text-red-600" error={errors.critical_kg} onChange={updateValue} />
        <button type="submit" disabled={saving} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} />{saving ? 'Saving...' : 'Save thresholds'}</button>
      </form>
      {message && <p className={`mt-3 text-sm ${/unable|permission|invalid/i.test(message) ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
    </section>
  )
}

function ThresholdInput({ name, label, value, color, error, onChange }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      <span className={color}>{label}</span>
      <span className="relative mt-1 block">
        <input name={name} type="number" min="0.01" step="0.01" value={value} onChange={onChange} className={`w-full rounded-xl border px-3 py-2.5 pr-9 text-sm outline-none focus:border-blue-500 ${error ? 'border-red-300' : 'border-slate-200'}`} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-normal text-slate-400">kg</span>
      </span>
      {error && <span className="mt-1 block font-normal text-red-500">{error}</span>}
    </label>
  )
}
