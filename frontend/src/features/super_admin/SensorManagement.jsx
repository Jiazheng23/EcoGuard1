import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CloudSun,
  Clock3,
  Database,
  Droplets,
  MapPin,
  Power,
  RadioTower,
  Recycle,
  ThermometerSun,
  Trash2,
  Users,
} from 'lucide-react'
import {
  latestMetricsByLocation,
  listLocationSensorControls,
  saveLocationSensorControl,
} from '../../services/locationService'

export default function SensorManagement({ locations, metrics, loading, error, isSuperAdmin, user }) {
  const [selectedId, setSelectedId] = useState('')
  const [controls, setControls] = useState([])
  const [controlLoading, setControlLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  useEffect(() => {
    let active = true
    listLocationSensorControls()
      .then((rows) => { if (active) setControls(rows) })
      .catch((loadError) => {
        if (!active) return
        setMessageType('error')
        setMessage(loadError.message || 'Unable to load sensor controls.')
      })
      .finally(() => { if (active) setControlLoading(false) })
    return () => { active = false }
  }, [])

  const latest = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const controlMap = useMemo(
    () => Object.fromEntries(controls.map((control) => [String(control.location_id), control])),
    [controls],
  )
  const selected = locations.find((location) => String(location.id) === String(selectedId)) || locations[0] || null
  const reading = selected ? latest[String(selected.id)] : null
  const selectedControl = selected ? controlMap[String(selected.id)] : null
  const sensorEnabled = selectedControl?.is_enabled !== false
  const enabledCount = locations.filter((location) => controlMap[String(location.id)]?.is_enabled !== false).length

  async function toggleSensor() {
    if (!selected || !user?.id || saving) return
    setSaving(true)
    setMessage('')
    try {
      const saved = await saveLocationSensorControl(user.id, selected.id, !sensorEnabled)
      setControls((current) => [
        saved,
        ...current.filter((control) => String(control.location_id) !== String(saved.location_id)),
      ])
      setMessageType('success')
      setMessage(`${selected.name} sensor is now ${saved.is_enabled ? 'on' : 'off'}.`)
    } catch (saveError) {
      setMessageType('error')
      setMessage(saveError.message || 'Unable to update the sensor status.')
    } finally {
      setSaving(false)
    }
  }

  const capacity = Math.max(1, Number(selected?.max_capacity) || 1)
  const crowdCount = Number(reading?.crowd_count || 0)
  const occupancy = (crowdCount / capacity) * 100
  const waste = Number(reading?.waste_kg || 0)
  const recycled = Number(reading?.recycled_kg || 0)
  const recycledRate = waste > 0 ? (recycled / waste) * 100 : 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Environmental data control</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900"><RadioTower size={24} className="text-blue-500" />Sensors</h1>
          <p className="mt-1 text-sm text-slate-500">Select a location to inspect every current reading and control its background updates.</p>
        </div>

        {selected && isSuperAdmin && locations.length > 1 ? (
          <label className="min-w-64 text-xs font-semibold text-slate-500">
            Location
            <select
              aria-label="Sensor location"
              value={selected.id}
              onChange={(event) => {
                setSelectedId(event.target.value)
                setMessage('')
              }}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
        ) : selected ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"><MapPin size={16} className="text-blue-500" />{selected.name}</span>
        ) : null}
      </header>

      {error && <Notice message={error} error />}
      {message && <Notice message={message} error={messageType === 'error'} />}

      {!loading && !selected && (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">
          {isSuperAdmin ? 'Add an ecological location before starting sensor monitoring.' : 'No ecological location is assigned to this administrator.'}
        </div>
      )}

      {selected && (
        <>
          <section className={`rounded-3xl border p-6 shadow-sm ${sensorEnabled ? 'border-blue-100 bg-gradient-to-br from-blue-50 to-white' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className={`relative grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg ${sensorEnabled ? 'bg-blue-500 shadow-blue-500/20' : 'bg-slate-400 shadow-slate-400/20'}`}>
                  <RadioTower size={22} />
                  <span className={`absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white ${sensorEnabled ? 'bg-green-400' : 'bg-slate-300'}`} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${sensorEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{sensorEnabled ? 'Sensor on' : 'Sensor off'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{sensorEnabled ? 'The backend updates this location every 5 minutes.' : 'Updates are paused. The latest stored reading remains available.'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSensor}
                disabled={saving || controlLoading}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${sensorEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
              >
                <Power size={17} />{saving ? 'Saving…' : sensorEnabled ? 'Turn off' : 'Turn on'}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatusCard icon={Clock3} label="Update interval" value="Every 5 minutes" />
              <StatusCard icon={Database} label="Active locations" value={controlLoading ? 'Loading…' : `${enabledCount} of ${locations.length}`} />
              <StatusCard icon={RadioTower} label="Last reading" value={formatDate(reading?.recorded_at)} />
            </div>
          </section>

          {reading ? (
            <section aria-labelledby="sensor-readings-heading">
              <div className="mb-3">
                <h2 id="sensor-readings-heading" className="font-bold text-slate-900">Current environmental readings</h2>
                <p className="mt-0.5 text-xs text-slate-400">All available data for the selected location</p>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <MetricCard icon={Users} label="Visitors" value={crowdCount.toLocaleString()} detail={`${occupancy.toFixed(1)}% of ${capacity.toLocaleString()} capacity`} color="#3b82f6" />
                <MetricCard icon={Trash2} label="Waste" value={`${waste.toFixed(2)} kg`} detail="Current detected level" color="#f97316" />
                <MetricCard icon={Recycle} label="Recyclable material" value={`${recycled.toFixed(2)} kg`} detail={`${recycledRate.toFixed(1)}% of waste`} color="#22c55e" />
                <MetricCard icon={CloudSun} label="Air quality index" value={Number(reading.air_quality_index || 0)} detail={airQualityLabel(reading.air_quality_index)} color="#8b5cf6" />
                <MetricCard icon={Droplets} label="Water quality" value={`${Number(reading.water_quality_score || 0).toFixed(1)} / 100`} detail={waterQualityLabel(reading.water_quality_score)} color="#06b6d4" />
                <MetricCard icon={ThermometerSun} label="Temperature" value={reading.temperature_c == null ? 'Unavailable' : `${Number(reading.temperature_c).toFixed(1)} °C`} detail="Current sensor temperature" color="#ef4444" />
              </div>
            </section>
          ) : !loading && (
            <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Database className="mx-auto text-slate-300" size={28} />
              <h2 className="mt-3 font-bold text-slate-700">No sensor reading yet</h2>
              <p className="mt-1 text-sm text-slate-400">Turn the sensor on and wait for the next five-minute update.</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function StatusCard({ icon: Icon, label, value }) {
  return <article className="rounded-2xl border border-white bg-white/80 p-4"><span className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Icon size={15} className="text-blue-500" />{label}</span><p className="mt-2 text-lg font-bold text-slate-800">{value}</p></article>
}

function MetricCard({ icon: Icon, label, value, detail, color }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><span className="grid size-9 place-items-center rounded-xl" style={{ color, backgroundColor: `${color}15` }}><Icon size={18} /></span><p className="mt-3 text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value}</p><p className="mt-1 text-xs" style={{ color }}>{detail}</p></article>
}

function Notice({ message, error }) {
  return <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`} role={error ? 'alert' : 'status'}><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{message}</p></div>
}

function airQualityLabel(value) {
  const aqi = Number(value || 0)
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for sensitive groups'
  return 'Unhealthy'
}

function waterQualityLabel(value) {
  const score = Number(value || 0)
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Moderate'
  return 'Needs attention'
}

function formatDate(value) {
  if (!value) return 'Waiting for data'
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
