import { useEffect, useState } from 'react'
import { Activity, AlertCircle, CloudOff, CloudSun, Database, Power, Recycle, Save, ThermometerSun, Trash2, Users, Waves } from 'lucide-react'
import { createLocationMetric, createSimulatedMetric } from '../../../services/locationService'
import { wasteLevelFor } from '../../../utils/wasteValidation'

export default function WasteSimulator({ location, baseline, threshold, onDataChange }) {
  const [metric, setMetric] = useState(() => createSimulatedMetric(location, baseline))
  const [history, setHistory] = useState(() => [Number(baseline?.waste_kg || metric.waste_kg)])
  const [sensorOnline, setSensorOnline] = useState(true)
  const [lastSimulatedAt, setLastSimulatedAt] = useState(() => new Date())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!sensorOnline) return undefined

    const timer = window.setInterval(() => {
      setMetric((current) => {
        const next = createSimulatedMetric(location, current)
        setHistory((items) => [...items.slice(-17), next.waste_kg])
        setLastSimulatedAt(new Date())
        return next
      })
    }, 3500)
    return () => window.clearInterval(timer)
  }, [location, sensorOnline])

  function toggleSensor() {
    setMessage('')
    if (sensorOnline) {
      if (baseline) {
        const storedMetric = metricFromStoredReading(location, baseline)
        setMetric(storedMetric)
        setHistory([storedMetric.waste_kg])
      }
      setSensorOnline(false)
      return
    }

    const next = createSimulatedMetric(location, baseline || metric)
    setMetric(next)
    setHistory((items) => [...items.slice(-17), next.waste_kg])
    setLastSimulatedAt(new Date())
    setSensorOnline(true)
  }

  async function saveSnapshot() {
    if (!sensorOnline) return
    setSaving(true)
    setMessage('')
    try {
      await createLocationMetric(metric)
      await onDataChange?.()
      setMessage('Simulated snapshot saved to Supabase and is now available to shared environmental views.')
    } catch (saveError) {
      setMessage(saveError.message || 'Unable to save the simulated snapshot.')
    } finally {
      setSaving(false)
    }
  }

  const fallbackUnavailable = !sensorOnline && !baseline
  const recycledRate = metric.waste_kg > 0 ? (metric.recycled_kg / metric.waste_kg) * 100 : 0
  const capacity = Math.max(1, Number(location.max_capacity) || 1)
  const occupancy = (metric.crowd_count / capacity) * 100
  const wasteLevel = wasteLevelFor(metric.waste_kg, threshold)

  return (
    <>
      <section className={`rounded-2xl border p-4 ${sensorOnline ? 'border-blue-100 bg-blue-50/60' : 'border-amber-200 bg-amber-50/70'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`relative grid size-10 place-items-center rounded-xl bg-white ${sensorOnline ? 'text-blue-500' : 'text-amber-600'}`}>
              {sensorOnline ? <Activity size={18} /> : <CloudOff size={18} />}
              <span className={`absolute right-0 top-0 size-2 rounded-full ring-2 ring-white ${sensorOnline ? 'bg-green-400' : 'bg-amber-400'}`} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-800">Waste simulator - {location.name}</p>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Simulated data</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sensorOnline ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{sensorOnline ? 'Sensor online' : 'Sensor offline'}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {sensorOnline
                  ? `Updates every 3.5 seconds. Last simulated update: ${formatDate(lastSimulatedAt)}`
                  : baseline
                    ? `Showing latest stored fallback from ${formatDate(baseline.recorded_at)}.`
                    : 'No stored fallback is available for this location.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={toggleSensor} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${sensorOnline ? 'border-amber-200 bg-white text-amber-700' : 'border-green-200 bg-white text-green-700'}`}><Power size={16} />{sensorOnline ? 'Simulate offline' : 'Restore sensor'}</button>
            <button type="button" onClick={saveSnapshot} disabled={saving || !sensorOnline} title={!sensorOnline ? 'Restore the simulated sensor before saving.' : undefined} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} />{saving ? 'Saving...' : 'Save simulated snapshot'}</button>
          </div>
        </div>
      </section>

      {message && <Notice message={message} error={/unable|error/i.test(message)} />}

      {fallbackUnavailable ? (
        <section className="rounded-2xl border border-dashed border-amber-300 bg-white p-10 text-center">
          <Database className="mx-auto text-amber-500" size={28} />
          <h2 className="mt-3 font-bold text-slate-800">Stored fallback unavailable</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">This demonstrates a sensor outage before any snapshot has been stored. Restore the sensor, save a simulated snapshot, and then test offline mode again.</p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Estimated waste level" value={`${metric.waste_kg.toFixed(2)} kg`} detail={wasteLevel.label} icon={Trash2} color={wasteLevel.color} />
            <MetricCard label="Estimated recyclable material" value={`${metric.recycled_kg.toFixed(2)} kg`} detail={`${recycledRate.toFixed(0)}% of estimated waste`} icon={Recycle} color="#22c55e" />
            <MetricCard label="Estimated visitors" value={metric.crowd_count} detail={`${occupancy.toFixed(0)}% of capacity`} icon={Users} color="#3b82f6" />
            <MetricCard label="Estimated air quality index" value={metric.air_quality_index} detail={metric.air_quality_index <= 50 ? 'Good' : metric.air_quality_index <= 100 ? 'Moderate' : 'Unhealthy'} icon={CloudSun} color="#8b5cf6" />
          </div>

          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between"><div><h2 className="font-bold text-slate-800">{sensorOnline ? 'Simulated waste trend' : 'Stored fallback reading'}</h2><p className="mt-1 text-xs text-slate-400">{sensorOnline ? 'Temporary browser readings; persisted analytics use collection records.' : 'The trend is paused while the sensor is offline.'}</p></div><Trash2 size={20} className="text-orange-500" /></div>
              <MiniChart values={history} />
              <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{sensorOnline ? 'Earlier' : 'Stored snapshot'}</span><span>Latest {metric.waste_kg.toFixed(2)} kg</span></div>
            </article>
            <article className="rounded-2xl bg-gradient-to-br from-teal-600 to-blue-600 p-6 text-white shadow-lg shadow-blue-600/15"><Waves size={27} /><h2 className="mt-4 text-xl font-bold">{sensorOnline ? 'Simulated environmental snapshot' : 'Stored environmental fallback'}</h2><div className="mt-5 space-y-3"><Reading icon={Waves} label="Water quality" value={`${metric.water_quality_score.toFixed(1)} / 100`} /><Reading icon={ThermometerSun} label="Temperature" value={metric.temperature_c == null ? 'Not available' : `${metric.temperature_c.toFixed(1)} C`} /><Reading icon={Users} label="Location capacity" value={capacity.toLocaleString()} /></div><p className="mt-5 text-xs leading-5 text-white/70">{sensorOnline ? 'Saving creates a timestamped location metric with source marked as simulated.' : 'Read-only fallback; restore the sensor to generate or save readings.'}</p></article>
          </section>
        </>
      )}
    </>
  )
}

function metricFromStoredReading(location, baseline) {
  return {
    location_id: location.id,
    crowd_count: Number(baseline.crowd_count || 0),
    waste_kg: Number(baseline.waste_kg || 0),
    recycled_kg: Number(baseline.recycled_kg || 0),
    air_quality_index: Number(baseline.air_quality_index || 0),
    water_quality_score: Number(baseline.water_quality_score || 0),
    temperature_c: baseline.temperature_c == null ? null : Number(baseline.temperature_c),
    source: 'simulated',
  }
}

function MiniChart({ values }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100
    const y = max === min ? 50 : 90 - ((value - min) / (max - min)) * 75
    return `${x},${y}`
  }).join(' ')
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-5 h-40 w-full overflow-visible"><defs><linearGradient id="waste-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity=".28" /><stop offset="100%" stopColor="#f97316" stopOpacity="0" /></linearGradient></defs><polyline points={`0,100 ${points} 100,100`} fill="url(#waste-fill)" stroke="none" /><polyline points={points} fill="none" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function MetricCard({ label, value, detail, icon: Icon, color }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><span className="grid size-9 place-items-center rounded-xl" style={{ color, background: `${color}12` }}><Icon size={18} /></span><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value}</p><p className="mt-1 text-xs" style={{ color }}>{detail}</p></article>
}

function Reading({ icon: Icon, label, value }) {
  return <div className="flex items-center justify-between rounded-xl bg-white/10 p-3"><span className="flex items-center gap-2 text-sm text-white/80"><Icon size={16} />{label}</span><b className="text-sm">{value}</b></div>
}

function Notice({ message, error }) {
  return <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{message}</p></div>
}

function formatDate(value) {
  if (!value) return 'not available'
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
