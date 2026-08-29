import { useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Edit3, Leaf, MapPin, Plus, Search, Trash2, X } from 'lucide-react'
import {
  createEcologicalLocation,
  deleteEcologicalLocation,
  updateEcologicalLocation,
} from '../../services/locationService'
import WestMalaysiaLocationPicker from './WestMalaysiaLocationPicker'
import { isWestMalaysiaCoordinate, isWestMalaysiaLocation } from '../../utils/westMalaysia'
import { deleteLocationImages, MAX_GALLERY_IMAGES, uploadLocationImages } from '../../services/locationImageService'

const locationTypes = ['Cultural Site', 'World Heritage Site', 'National Park', 'Tourist attractions', 'Geopark', 'Marine Park', 'Highland Reserve']
const localImagePreviewUrls = new WeakMap()
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0')
  const minutes = index % 2 ? '30' : '00'
  return `${hours}:${minutes}`
})

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
  operating_start: '08:00',
  operating_end: '18:00',
  visit_start: '09:00',
  visit_end: '16:00',
  location_confirmed: false,
  wallpaper_url: '',
  gallery_urls: [],
  is_active: true,
})

export default function EcologicalLocations({ user, isSuperAdmin, locations, loading, error, onDataChange, embedded = false, showFilters = true }) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [galleryFiles, setGalleryFiles] = useState([])
  const [newWallpaperIndex, setNewWallpaperIndex] = useState(null)
  const [removedGalleryUrls, setRemovedGalleryUrls] = useState([])

  const westMalaysiaLocations = useMemo(
    () => locations.filter(isWestMalaysiaLocation),
    [locations],
  )

  const filtered = useMemo(() => {
    if (!showFilters) return westMalaysiaLocations

    const needle = query.trim().toLowerCase()
    return westMalaysiaLocations.filter((item) => {
      const matchesQuery = !needle || [item.name, item.state, item.location_type]
        .some((value) => value?.toLowerCase().includes(needle))
      const matchesState = stateFilter === 'all' || item.state === stateFilter
      const matchesType = typeFilter === 'all' || item.location_type === typeFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'visible' ? item.is_active : !item.is_active)
      return matchesQuery && matchesState && matchesType && matchesStatus
    })
  }, [query, showFilters, stateFilter, statusFilter, typeFilter, westMalaysiaLocations])

  const states = [...new Set(westMalaysiaLocations.map((item) => item.state))].sort()
  const types = [...new Set(westMalaysiaLocations.map((item) => item.location_type))].sort()
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
    setGalleryFiles([])
    setNewWallpaperIndex(null)
    setRemovedGalleryUrls([])
  }

  function openEdit(location) {
    const operatingRange = parseTimeRange(location.operating_hours, '08:00', '18:00')
    const visitRange = parseTimeRange(location.best_visit_time, '09:00', '16:00')
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
      operating_start: operatingRange.start,
      operating_end: operatingRange.end,
      visit_start: visitRange.start,
      visit_end: visitRange.end,
      location_confirmed: true,
      wallpaper_url: location.wallpaper_url || '',
      gallery_urls: Array.isArray(location.gallery_urls) ? location.gallery_urls : [],
      is_active: location.is_active,
    })
    setMessage('')
    setGalleryFiles([])
    setNewWallpaperIndex(null)
    setRemovedGalleryUrls([])
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function saveLocation(event) {
    event.preventDefault()
    if (!form.location_confirmed || !isWestMalaysiaCoordinate(form.latitude, form.longitude) || !form.state) {
      setMessage('Search for and confirm a valid destination within West Malaysia before saving.')
      return
    }
    if (form.operating_start >= form.operating_end || form.visit_start >= form.visit_end) {
      setMessage('Each end time must be later than its start time.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const values = {
        ...form,
        operating_hours: `${form.operating_start} - ${form.operating_end}`,
        best_visit_time: `${form.visit_start} - ${form.visit_end}`,
      }
      const savedLocation = editing === 'new'
        ? await createEcologicalLocation(user.id, values)
        : { id: editing }
      const uploadedGalleryUrls = await uploadLocationImages(savedLocation.id, galleryFiles)
      const finalValues = {
        ...values,
        wallpaper_url: isSuperAdmin && newWallpaperIndex != null
          ? uploadedGalleryUrls[newWallpaperIndex]
          : values.wallpaper_url,
        gallery_urls: [...values.gallery_urls, ...uploadedGalleryUrls],
      }
      await updateEcologicalLocation(savedLocation.id, finalValues)
      await deleteLocationImages(removedGalleryUrls)
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
    <div className={embedded ? 'flex flex-col gap-6' : 'mx-auto flex max-w-6xl flex-col gap-6'}>
      {!embedded && <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ecological Locations</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the protected places shown on the Tourist map</p>
        </div>
        {isSuperAdmin && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600">
          <Plus size={17} /> Add new location
        </button>}
      </header>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Managed locations" value={westMalaysiaLocations.length} icon={MapPin} color="#3b82f6" loading={loading} />
        <Stat label="Active on map" value={westMalaysiaLocations.filter((item) => item.is_active).length} icon={Leaf} color="#22c55e" loading={loading} />
        <Stat label="West Malaysia states" value={new Set(westMalaysiaLocations.map((item) => item.state)).size} icon={MapPin} color="#8b5cf6" loading={loading} />
        <Stat label="Total capacity" value={westMalaysiaLocations.reduce((sum, item) => sum + Number(item.max_capacity || 0), 0).toLocaleString()} icon={Leaf} color="#14b8a6" loading={loading} />
      </div>

      {(error || message) && <Notice message={error || message} error={Boolean(error) || /unable|error/i.test(message)} />}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold text-slate-800">Location directory</h2><p className="text-xs text-slate-400">Coordinates become selectable points in Tourist monitoring</p></div>
          {showFilters && <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, state or type" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>}
          </div>
          {showFilters && <div className="mt-3 flex flex-wrap gap-2">
            <FilterSelect label="All states" value={stateFilter} onChange={setStateFilter} options={states} />
            <FilterSelect label="All types" value={typeFilter} onChange={setTypeFilter} options={types} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-500"><option value="all">All map statuses</option><option value="visible">Visible on map</option><option value="hidden">Hidden from map</option></select>
            {filtersActive && <button type="button" onClick={clearFilters} className="rounded-xl px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50">Clear filters</button>}
            <span className="ml-auto self-center text-xs text-slate-400">Showing {filtered.length} of {westMalaysiaLocations.length}</span>
          </div>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Location</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Coordinates</th><th className="px-5 py-3">Capacity</th><th className="px-5 py-3">Map status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((location) => (
                <tr key={location.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4"><div className="flex items-center gap-2.5">{location.wallpaper_url ? <img src={location.wallpaper_url} alt="" className="size-10 rounded-xl object-cover" /> : <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-500"><MapPin size={16} /></span>}<div><p className="font-semibold text-slate-800">{location.name}</p><p className="text-xs text-slate-400">{location.state}</p></div></div></td>
                  <td className="px-5 py-4 text-slate-600">{location.location_type}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{Number(location.latitude).toFixed(4)}, {Number(location.longitude).toFixed(4)}</td>
                  <td className="px-5 py-4 text-slate-600">{Number(location.max_capacity).toLocaleString()}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${location.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{location.is_active ? 'Visible' : 'Hidden'}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(location)} aria-label={`Edit ${location.name}`} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50"><Edit3 size={16} /></button>{isSuperAdmin && <button type="button" onClick={() => setDeleteTarget(location)} aria-label={`Delete ${location.name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !filtered.length && <p className="p-10 text-center text-sm text-slate-400">No managed ecological locations found.</p>}
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-[2000] grid place-items-center overflow-hidden bg-slate-950/45 px-4 pb-4 pt-20"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}
          onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null) }}
        >
          <form onSubmit={saveLocation} role="dialog" aria-modal="true" aria-labelledby="location-dialog-title" className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4"><div><h2 id="location-dialog-title" className="text-lg font-bold text-slate-900">{editing === 'new' ? 'Add ecological location' : 'Edit ecological location'}</h2><p className="mt-1 text-sm text-slate-500">This information is shared with the Tourist map.</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="mt-5">
              <WestMalaysiaLocationPicker latitude={form.latitude} longitude={form.longitude} state={form.state} onConfirmationChange={(confirmed) => setForm((current) => ({ ...current, location_confirmed: confirmed }))} onChange={(location) => setForm((current) => ({ ...current, latitude: location.lat, longitude: location.lng, state: location.state, location_confirmed: true }))} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="Location display name" name="name" value={form.name} onChange={updateField} placeholder="Example: KLCC Park" />
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">State</span><input readOnly required value={form.state} placeholder="Filled automatically after destination confirmation" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none" /></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Location type</span><select required name="location_type" value={form.location_type} onChange={updateField} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">{locationTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <Input label="Maximum capacity" name="max_capacity" type="number" min="1" value={form.max_capacity} onChange={updateField} />
              <TimeRangeField label="Operating hours" startName="operating_start" endName="operating_end" start={form.operating_start} end={form.operating_end} onChange={updateField} />
              <TimeRangeField label="Best visit time" startName="visit_start" endName="visit_end" start={form.visit_start} end={form.visit_end} onChange={updateField} />
              <label className="flex items-end"><span className="flex h-[42px] w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700"><input name="is_active" type="checkbox" checked={form.is_active} onChange={updateField} className="size-4 accent-blue-500" /> Display on Tourist map</span></label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Description</span><textarea name="description" value={form.description} onChange={updateField} rows="3" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
              <ImageFields
                form={form}
                galleryFiles={galleryFiles}
                isSuperAdmin={isSuperAdmin}
                newWallpaperIndex={newWallpaperIndex}
                onGalleryChange={setGalleryFiles}
                onSelectSavedWallpaper={(url) => { setForm((current) => ({ ...current, wallpaper_url: url })); setNewWallpaperIndex(null) }}
                onSelectNewWallpaper={setNewWallpaperIndex}
                onClearWallpaper={() => {
                  if (form.wallpaper_url && !form.gallery_urls.includes(form.wallpaper_url)) {
                    setRemovedGalleryUrls((current) => [...current, form.wallpaper_url])
                  }
                  setForm((current) => ({ ...current, wallpaper_url: '' }))
                  setNewWallpaperIndex(null)
                }}
                onRemoveGallery={(url) => {
                  if (url === form.wallpaper_url) {
                    setMessage('Choose another wallpaper before removing the current wallpaper image.')
                    return
                  }
                  setRemovedGalleryUrls((current) => [...current, url])
                  setForm((current) => ({ ...current, gallery_urls: current.gallery_urls.filter((item) => item !== url) }))
                }}
              />
            </div>
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4"><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving || !form.location_confirmed} className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : 'Save location'}</button></div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-slate-950/45 px-4 pb-4 pt-20" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null) }} onKeyDown={(event) => { if (event.key === 'Escape') setDeleteTarget(null) }}><section role="dialog" aria-modal="true" aria-labelledby="delete-location-title" className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><h2 id="delete-location-title" className="text-lg font-bold text-slate-900">Delete {deleteTarget.name}?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Its crowd thresholds and environmental snapshots will also be removed. This cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={removeLocation} disabled={saving} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Deleting...' : 'Delete location'}</button></div></section></div>
      )}
    </div>
  )
}

function ImageFields({ form, galleryFiles, isSuperAdmin, newWallpaperIndex, onGalleryChange, onSelectSavedWallpaper, onSelectNewWallpaper, onRemoveGallery }) {
  const fileInputRef = useRef(null)
  const [selectionError, setSelectionError] = useState('')

  function chooseGallery(event) {
    const files = [...(event.target.files || [])]
    const existingKeys = new Set(galleryFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
    const newFiles = files.filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
    if (form.gallery_urls.length + galleryFiles.length + newFiles.length > MAX_GALLERY_IMAGES) {
      setSelectionError(`A location can have up to ${MAX_GALLERY_IMAGES} gallery images.`)
      event.target.value = ''
      return
    }
    onGalleryChange([...galleryFiles, ...newFiles])
    setSelectionError('')
    event.target.value = ''
  }

  return <fieldset className="space-y-4 sm:col-span-2">
    <legend className="text-sm font-bold text-slate-800">Location images</legend>
    <p className="text-xs text-slate-400">Add multiple JPG, PNG or WebP thumbnails, up to 5 MB each and {MAX_GALLERY_IMAGES} images total.</p>
    {/* {form.wallpaper_url && <div>
      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-600">Current wallpaper</p>{!isSuperAdmin && <span className="text-xs text-slate-400">Only a super administrator can change it</span>}</div>
      <div className="w-40"><ImagePreview url={form.wallpaper_url} label="Wallpaper" isWallpaper canRemove={isSuperAdmin} onRemove={onClearWallpaper} /></div>
    </div>} */}
    <div>
      <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-600">Location thumbnails</p>{isSuperAdmin && <p className="text-xs font-semibold text-blue-600">Click an image to set it as the wallpaper</p>}</div>
      <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={chooseGallery} className="hidden" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {form.gallery_urls.map((url, index) => <ImagePreview key={url} url={url} label={`Image ${index + 1}`} isWallpaper={url === form.wallpaper_url} canSelectWallpaper={isSuperAdmin} onSelectWallpaper={() => onSelectSavedWallpaper(url)} onRemove={() => onRemoveGallery(url)} />)}
        {galleryFiles.map((file, index) => <FileImagePreview key={`${file.name}-${file.lastModified}`} file={file} label={`New ${index + 1}`} isWallpaper={newWallpaperIndex === index} canSelectWallpaper={isSuperAdmin} onSelectWallpaper={() => onSelectNewWallpaper(index)} onRemove={() => { onGalleryChange(galleryFiles.filter((_, itemIndex) => itemIndex !== index)); if (newWallpaperIndex === index) onSelectNewWallpaper(null); else if (newWallpaperIndex > index) onSelectNewWallpaper(newWallpaperIndex - 1) }} />)}
        {form.gallery_urls.length + galleryFiles.length < MAX_GALLERY_IMAGES && <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 text-blue-600 transition hover:border-blue-400 hover:bg-blue-50">
          <span className="grid size-10 place-items-center rounded-full bg-blue-100"><Plus size={22} /></span>
          <span className="mt-2 text-sm font-semibold">Add images</span>
          <span className="mt-0.5 text-[11px] text-blue-400">Select one or many</span>
        </button>}
      </div>
    </div>
    {selectionError && <p className="text-xs font-semibold text-red-500">{selectionError}</p>}
  </fieldset>
}

function ImagePreview({ url, label, isWallpaper, canSelectWallpaper, canRemove = true, onSelectWallpaper, onRemove }) {
  return <div className={`relative overflow-hidden rounded-xl border bg-slate-50 transition ${isWallpaper ? 'border-blue-500 ring-4 ring-inset ring-blue-500/40' : 'border-slate-200'} ${canSelectWallpaper ? 'cursor-pointer hover:border-blue-400 hover:shadow-md' : ''}`}>
    <img src={url} alt={label} className="h-28 w-full object-cover" />
    {canSelectWallpaper && <button type="button" onClick={onSelectWallpaper} aria-label={`Use ${label} as wallpaper`} className="absolute inset-0 z-10" />}
    <span className={`pointer-events-none absolute bottom-1 left-1 z-20 rounded px-2 py-1 text-[10px] font-bold text-white ${isWallpaper ? 'bg-blue-600' : 'bg-slate-950/70'}`}>{isWallpaper ? '✓ Selected wallpaper' : label}</span>
    {isWallpaper && <span className="pointer-events-none absolute left-2 top-2 z-20 grid size-7 place-items-center rounded-full bg-blue-600 text-white shadow"><CheckCircle2 size={17} /></span>}
    {canRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="absolute right-1 top-1 z-30 rounded-full bg-white/95 p-1.5 text-red-500 shadow hover:bg-red-50"><X size={14} /></button>}
  </div>
}

function FileImagePreview({ file, ...props }) {
  let url = localImagePreviewUrls.get(file)
  if (!url) {
    url = URL.createObjectURL(file)
    localImagePreviewUrls.set(file, url)
  }
  return <ImagePreview {...props} url={url} />
}

function Input({ label, required = true, ...props }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input required={required} {...props} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
}

function TimeRangeField({ label, startName, endName, start, end, onChange }) {
  return <fieldset><legend className="mb-1.5 text-xs font-semibold text-slate-600">{label}</legend><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><label><span className="sr-only">{label} start time</span><select name={startName} value={start} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">{timeOptions.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}</select></label><span className="text-xs font-semibold text-slate-400">to</span><label><span className="sr-only">{label} end time</span><select name={endName} value={end} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">{timeOptions.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}</select></label></div></fieldset>
}

function formatTimeLabel(value) {
  const [hours, minutes] = value.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

function parseTimeRange(value, fallbackStart, fallbackEnd) {
  const match = String(value || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  if (!match || !timeOptions.includes(match[1]) || !timeOptions.includes(match[2])) return { start: fallbackStart, end: fallbackEnd }
  return { start: match[1], end: match[2] }
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
