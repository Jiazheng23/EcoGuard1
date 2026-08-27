import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet'
import { CheckCircle2, MapPin, RotateCcw, Search, XCircle } from 'lucide-react'
import { searchMalaysiaLocations } from '../../services/mapService'
import { inferWestMalaysiaState, isWestMalaysiaCoordinate, normalizeWestMalaysiaState } from '../../utils/westMalaysia'
import 'leaflet/dist/leaflet.css'

const WEST_MALAYSIA_BOUNDS = [[1.0, 99.5], [6.85, 104.8]]
const WEST_MALAYSIA_CENTER = [3.8, 102.1]

function FocusSelection({ selection }) {
  const map = useMap()
  useEffect(() => {
    if (selection) map.flyTo([selection.lat, selection.lng], 14, { duration: 0.7 })
  }, [map, selection])
  return null
}

export default function WestMalaysiaLocationPicker({ latitude, longitude, state, onChange, onConfirmationChange }) {
  const saved = isWestMalaysiaCoordinate(latitude, longitude)
    ? { lat: Number(latitude), lng: Number(longitude), name: 'Saved destination', state, confirmed: true }
    : null
  const [selection, setSelection] = useState(saved)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function searchDestination() {
    if (query.trim().length < 4) return setError('Enter the full destination name and location before searching.')
    setLoading(true)
    setError('')
    onConfirmationChange(false)
    try {
      const matches = (await searchMalaysiaLocations(query.trim()))
        .filter((item) => isWestMalaysiaCoordinate(item.lat, item.lng))
        .map((item) => ({ ...item, state: normalizeWestMalaysiaState(item.state) || inferWestMalaysiaState(item.name) }))
        .filter((item) => item.state)
      if (!matches.length) {
        setSelection(null)
        setError('No matching destination was found in West Malaysia. Include the destination, town, and state in your search.')
        return
      }
      setSelection({ ...matches[0], confirmed: false })
    } catch (searchError) {
      setError(searchError.message || 'Unable to search for this destination.')
    } finally {
      setLoading(false)
    }
  }

  function confirmSelection() {
    const confirmed = { ...selection, confirmed: true }
    setSelection(confirmed)
    onConfirmationChange(true)
    onChange(confirmed)
  }

  return (
    <section className="sm:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-600"><MapPin size={17} /></span><div><h3 className="text-sm font-bold text-slate-800">Find the destination</h3><p className="mt-1 text-xs leading-5 text-slate-500">Enter the complete destination name, town, and state. Only confirmed West Malaysia results will be saved.</p></div></div>
      <div className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchDestination() } }} placeholder="Example: KLCC, Kuala Lumpur" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div><button type="button" onClick={() => void searchDestination()} disabled={loading} className="rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Searching...' : 'Search'}</button></div>

      <div className="mt-3 h-72 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <MapContainer center={selection ? [selection.lat, selection.lng] : WEST_MALAYSIA_CENTER} zoom={selection ? 13 : 7} minZoom={6} maxBounds={WEST_MALAYSIA_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom className="h-full w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Rectangle bounds={WEST_MALAYSIA_BOUNDS} pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.02 }} />
          <FocusSelection selection={selection} />
          {selection && <CircleMarker center={[selection.lat, selection.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: selection.confirmed ? '#22c55e' : '#f59e0b', fillOpacity: 1 }} />}
        </MapContainer>
      </div>

      {selection && !selection.confirmed && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Is this the correct destination?</p><p className="mt-1 text-sm leading-6 text-amber-800">{selection.name}</p><p className="mt-1 text-xs text-amber-700">Detected state: {selection.state} · {selection.lat.toFixed(6)}, {selection.lng.toFixed(6)}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={confirmSelection} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Yes, this is correct</button><button type="button" onClick={() => { setSelection(null); onConfirmationChange(false); setError('Search again using a more complete destination address.') }} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800"><XCircle size={16} /> No, search again</button></div></div>}

      {selection?.confirmed && <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"><p><b>Confirmed destination</b><span className="mt-1 block">{selection.name}</span><span className="mt-1 block text-xs">{selection.state} · {selection.lat.toFixed(6)}, {selection.lng.toFixed(6)}</span></p><button type="button" onClick={() => { setSelection(null); setQuery(''); onConfirmationChange(false) }} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold"><RotateCcw size={14} /> Change</button></div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    </section>
  )
}
