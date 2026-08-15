import { useMemo, useState } from 'react'
import { AlertCircle, Edit3, Leaf, MapPin, Plus, Search, Trash2, X } from 'lucide-react'
import {
  createEcologicalLocation,
  deleteEcologicalLocation,
  updateEcologicalLocation,
} from '../../services/locationService'

const emptyForm = () => ({
  name: '',
  state: '',
  location_type: 'National Park',
  description: '',
  latitude: '',
  longitude: '',
  max_capacity: 500,
  operating_hours: '',
  best_visit_time: '',
  alternative_location: '',
  is_active: true,
})

export default function EcologicalLocations({ user, locations, loading, error, onDataChange }) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return locations.filter((item) => {
      const matchesQuery = !needle || [item.name, item.state, item.location_type]
        .some((value) => value?.toLowerCase().includes(needle))
      const matchesState = stateFilter === 'all' || item.state === stateFilter
      const matchesType = typeFilter === 'all' || item.location_type === typeFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'visible' ? item.is_active : !item.is_active)
      return matchesQuery && matchesState && matchesType && matchesStatus
    })
  }, [locations, query, stateFilter, statusFilter, typeFilter])

  const states = [...new Set(locations.map((item) => item.state))].sort()
  const types = [...new Set(locations.map((item) => item.location_type))].sort()
  const filtersActive = query || stateFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'

  function clearFilters() {
    setQuery('')
    setStateFilter('all')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  function openCreate() {
    setEditing('new')
    setForm(emptyForm())
    setMessage('')
  }

  function openEdit(location) {
    setEditing(location.id)
    setForm({
      name: location.name,
      state: location.state,
      location_type: location.location_type,
      description: location.description || '',
      latitude: location.latitude,
      longitude: location.longitude,
      max_capacity: location.max_capacity,
      operating_hours: location.operating_hours || '',
      best_visit_time: location.best_visit_time || '',
      alternative_location: location.alternative_location || '',
      is_active: location.is_active,
    })
    setMessage('')
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function saveLocation(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      if (editing === 'new') await createEcologicalLocation(user.id, form)
      else await updateEcologicalLocation(editing, form)
      await onDataChange()
      setEditing(null)
      setMessage('Location saved to Supabase. Tourist map data is now updated.')
    } catch (saveError) {
      setMessage(saveError.message || 'Unable to save this location.')
    } finally {
      setSaving(false)
    }
  }

  async function removeLocation() {
    setSaving(true)
    setMessage('')
    try {
      await deleteEcologicalLocation(deleteTarget.id)
      await onDataChange()
      setDeleteTarget(null)
      setMessage('Location and its linked thresholds/metrics were removed.')
    } catch (deleteError) {
      setMessage(deleteError.message || 'Unable to delete this location.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ecological Locations</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the protected places shown on the Tourist map</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600">
          <Plus size={17} /> Add new location
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Managed locations" value={locations.length} icon={MapPin} color="#3b82f6" loading={loading} />
        <Stat label="Active on map" value={locations.filter((item) => item.is_active).length} icon={Leaf} color="#22c55e" loading={loading} />
        <Stat label="Malaysian states" value={new Set(locations.map((item) => item.state)).size} icon={MapPin} color="#8b5cf6" loading={loading} />
        <Stat label="Total capacity" value={locations.reduce((sum, item) => sum + Number(item.max_capacity || 0), 0).toLocaleString()} icon={Leaf} color="#14b8a6" loading={loading} />
      </div>

      {(error || message) && <Notice message={error || message} error={Boolean(error) || /unable|error/i.test(message)} />}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold text-slate-800">Location directory</h2><p className="text-xs text-slate-400">Coordinates become selectable points in Tourist monitoring</p></div>
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, state or type" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterSelect label="All states" value={stateFilter} onChange={setStateFilter} options={states} />
            <FilterSelect label="All types" value={typeFilter} onChange={setTypeFilter} options={types} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-500"><option value="all">All map statuses</option><option value="visible">Visible on map</option><option value="hidden">Hidden from map</option></select>
            {filtersActive && <button type="button" onClick={clearFilters} className="rounded-xl px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50">Clear filters</button>}
            <span className="ml-auto self-center text-xs text-slate-400">Showing {filtered.length} of {locations.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Location</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Coordinates</th><th className="px-5 py-3">Capacity</th><th className="px-5 py-3">Map status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((location) => (
                <tr key={location.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4"><div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-500"><MapPin size={16} /></span><div><p className="font-semibold text-slate-800">{location.name}</p><p className="text-xs text-slate-400">{location.state}</p></div></div></td>
                  <td className="px-5 py-4 text-slate-600">{location.location_type}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{Number(location.latitude).toFixed(4)}, {Number(location.longitude).toFixed(4)}</td>
                  <td className="px-5 py-4 text-slate-600">{Number(location.max_capacity).toLocaleString()}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${location.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{location.is_active ? 'Visible' : 'Hidden'}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(location)} aria-label={`Edit ${location.name}`} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50"><Edit3 size={16} /></button><button type="button" onClick={() => setDeleteTarget(location)} aria-label={`Delete ${location.name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !filtered.length && <p className="p-10 text-center text-sm text-slate-400">No managed ecological locations found.</p>}
      </section>

      {editing && (
        <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="presentation">
          <form onSubmit={saveLocation} className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">{editing === 'new' ? 'Add ecological location' : 'Edit ecological location'}</h2><p className="mt-1 text-sm text-slate-500">This information is shared with the Tourist map.</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="Location name" name="name" value={form.name} onChange={updateField} />
              <Input label="State" name="state" value={form.state} onChange={updateField} />
              <Input label="Location type" name="location_type" value={form.location_type} onChange={updateField} />
              <Input label="Maximum capacity" name="max_capacity" type="number" min="1" value={form.max_capacity} onChange={updateField} />
              <Input label="Latitude" name="latitude" type="number" min="-90" max="90" step="any" value={form.latitude} onChange={updateField} />
              <Input label="Longitude" name="longitude" type="number" min="-180" max="180" step="any" value={form.longitude} onChange={updateField} />
              <Input label="Operating hours" name="operating_hours" value={form.operating_hours} onChange={updateField} required={false} />
              <Input label="Best visit time" name="best_visit_time" value={form.best_visit_time} onChange={updateField} required={false} />
              <Input label="Alternative location" name="alternative_location" value={form.alternative_location} onChange={updateField} required={false} />
              <label className="flex items-end"><span className="flex h-[42px] w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700"><input name="is_active" type="checkbox" checked={form.is_active} onChange={updateField} className="size-4 accent-blue-500" /> Display on Tourist map</span></label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Description</span><textarea name="description" value={form.description} onChange={updateField} rows="3" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save location'}</button></div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/45 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold text-slate-900">Delete {deleteTarget.name}?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Its crowd thresholds and environmental snapshots will also be removed. This cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={removeLocation} disabled={saving} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Deleting...' : 'Delete location'}</button></div></section></div>
      )}
    </div>
  )
}

function Input({ label, required = true, ...props }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input required={required} {...props} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
}

function Stat({ label, value, icon: Icon, color, loading }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><Icon size={18} style={{ color }} /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color }}>{loading ? '-' : value}</p></article>
}

function Notice({ message, error }) {
  return <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{message}</p></div>
}

function FilterSelect({ label, value, onChange, options }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-500"><option value="all">{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
}
