import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  List,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { listEcologicalLocations, listTouristEnvironmentalIndicators, subscribeToEnvironmentalIndicators } from '../../services/locationService'
import { isWestMalaysiaLocation } from '../../utils/westMalaysia'
import { submitEnvironmentalIncident } from '../../services/incidentService'
import { listActiveAdvisories, subscribeToAdvisories } from '../../services/advisoryService'
import LoadingScreen from '../../components/LoadingScreen'
import { useToast } from '../../components/toastContext'

const WEST_MALAYSIA_CENTER = [4.2105, 101.9758]
const WEST_MALAYSIA_BOUNDS = [
  [0.8, 99.5],
  [7.6, 104.8],
]

const destinations = [
  {
    id: 1,
    name: 'Taman Negara',
    state: 'Pahang',
    type: 'National Park',
    lat: 4.381,
    lng: 102.401,
    crowd: 'Moderate',
    environment: 'Good',
    warning: 'Caution',
    visitors: '4,200',
    waste: 'Moderate',
    update: '2 hours ago',
    distance: '260 km',
    hours: '8:00 AM – 5:00 PM',
    bestTime: 'Weekday mornings',
    alternative: 'Endau-Rompin National Park',
    gradient: 'from-green-900 to-green-600',
    description: "One of the world's oldest tropical rainforests, home to rich wildlife and more than 3,000 plant species.",
    metrics: [['Air quality', 82], ['Water quality', 75], ['Flora health', 90], ['Visitor load', 55]],
  },
  {
    id: 2,
    name: 'Kinabalu Park',
    state: 'Sabah',
    type: 'National Park',
    lat: 6.075,
    lng: 116.558,
    crowd: 'Low',
    environment: 'Excellent',
    warning: 'Safe',
    visitors: '1,800',
    waste: 'Low',
    update: '1 hour ago',
    distance: '1,540 km',
    hours: '7:00 AM – 5:00 PM',
    bestTime: 'Early mornings',
    alternative: 'Crocker Range Park',
    gradient: 'from-blue-900 to-blue-600',
    description: 'A UNESCO World Heritage Site featuring Mount Kinabalu and extraordinary biodiversity across 754 km².',
    metrics: [['Air quality', 96], ['Water quality', 94], ['Flora health', 98], ['Visitor load', 25]],
  },
  {
    id: 3,
    name: 'Penang Hill',
    state: 'Penang',
    type: 'Eco Attraction',
    lat: 5.424,
    lng: 100.269,
    crowd: 'High',
    environment: 'Fair',
    warning: 'High Risk',
    visitors: '8,700',
    waste: 'High',
    update: '30 min ago',
    distance: '330 km',
    hours: '6:30 AM – 11:00 PM',
    bestTime: 'Weekdays before 9:00 AM',
    alternative: 'Penang Botanic Gardens',
    gradient: 'from-violet-800 to-purple-500',
    description: 'A hill resort at 833 m elevation with panoramic views, rich biodiversity, and a historic funicular railway.',
    metrics: [['Air quality', 65], ['Water quality', 70], ['Flora health', 72], ['Visitor load', 82]],
  },
  {
    id: 4,
    name: 'Tioman Island',
    state: 'Pahang',
    type: 'Beach',
    lat: 2.79,
    lng: 104.169,
    crowd: 'Moderate',
    environment: 'Good',
    warning: 'Caution',
    visitors: '3,100',
    waste: 'Moderate',
    update: '3 hours ago',
    distance: '185 km',
    hours: 'Open daily',
    bestTime: 'March to October',
    alternative: 'Endau-Rompin National Park',
    gradient: 'from-cyan-800 to-sky-500',
    description: 'An ASEAN Heritage Park with coral reefs, lush rainforest, sea turtles, and clear coastal waters.',
    metrics: [['Air quality', 88], ['Water quality', 80], ['Flora health', 85], ['Visitor load', 52]],
  },
  {
    id: 5,
    name: 'Redang Island',
    state: 'Terengganu',
    type: 'Beach',
    lat: 5.784,
    lng: 103.006,
    crowd: 'Critical',
    environment: 'Poor',
    warning: 'Critical',
    visitors: '9,200',
    waste: 'High',
    update: '20 min ago',
    distance: '450 km',
    hours: 'Open daily',
    bestTime: 'Visit after the warning is cleared',
    alternative: 'Perhentian Kecil',
    gradient: 'from-red-900 to-orange-600',
    description: 'A marine conservation area known for turquoise water, coral reefs, and protected biodiversity.',
    metrics: [['Air quality', 72], ['Water quality', 48], ['Flora health', 61], ['Visitor load', 94]],
  },
  {
    id: 6,
    name: 'Endau-Rompin',
    state: 'Johor',
    type: 'National Park',
    lat: 2.53,
    lng: 103.35,
    crowd: 'Low',
    environment: 'Excellent',
    warning: 'Safe',
    visitors: '890',
    waste: 'Low',
    update: '5 hours ago',
    distance: '220 km',
    hours: '8:00 AM – 5:00 PM',
    bestTime: 'Weekday mornings',
    alternative: 'Taman Negara',
    gradient: 'from-emerald-900 to-emerald-600',
    description: "One of Malaysia's remaining lowland dipterocarp rainforests and a protected wilderness area.",
    metrics: [['Air quality', 95], ['Water quality', 92], ['Flora health', 96], ['Visitor load', 18]],
  },
  {
    id: 7,
    name: 'FRIM Kepong',
    state: 'Selangor',
    type: 'Recreational Forest',
    lat: 3.235,
    lng: 101.635,
    crowd: 'Moderate',
    environment: 'Good',
    warning: 'Caution',
    visitors: '5,400',
    waste: 'Low',
    update: '45 min ago',
    distance: '16 km',
    hours: '8:00 AM – 5:00 PM',
    bestTime: 'Before 10:00 AM',
    alternative: 'Kanching Eco Forest Park',
    gradient: 'from-lime-800 to-lime-500',
    description: 'A forest sanctuary outside Kuala Lumpur featuring canopy walkways, waterfalls, and nature trails.',
    metrics: [['Air quality', 80], ['Water quality', 82], ['Flora health', 78], ['Visitor load', 58]],
  },
  {
    id: 8,
    name: 'Gunung Mulu',
    state: 'Sarawak',
    type: 'National Park',
    lat: 4.05,
    lng: 114.81,
    crowd: 'Low',
    environment: 'Excellent',
    warning: 'Safe',
    visitors: '1,200',
    waste: 'Low',
    update: '2 hours ago',
    distance: '1,610 km',
    hours: '8:00 AM – 5:00 PM',
    bestTime: 'March to September',
    alternative: 'Niah National Park',
    gradient: 'from-amber-900 to-amber-600',
    description: "A UNESCO World Heritage Site featuring large cave systems and protected rainforest.",
    metrics: [['Air quality', 97], ['Water quality', 95], ['Flora health', 99], ['Visitor load', 22]],
  },
]

const warningLevels = ['Safe', 'Caution', 'High Risk', 'Critical']

const crowdColor = {
  Low: 'bg-green-50 text-green-700',
  Moderate: 'bg-amber-50 text-amber-700',
  High: 'bg-orange-50 text-orange-700',
  Critical: 'bg-red-50 text-red-700',
  'Awaiting data': 'bg-slate-100 text-slate-600',
}

const warningColor = {
  Safe: 'bg-green-50 text-green-700',
  Caution: 'bg-amber-50 text-amber-700',
  'High Risk': 'bg-orange-50 text-orange-700',
  Critical: 'bg-red-50 text-red-700',
  'Awaiting data': 'bg-slate-100 text-slate-600',
}

const markerColor = {
  Safe: '#16a34a',
  Caution: '#f59e0b',
  'High Risk': '#f97316',
  Critical: '#dc2626',
  'Awaiting data': '#64748b',
}

const wasteColor = {
  Normal: 'bg-green-50 text-green-700',
  Moderate: 'bg-amber-50 text-amber-700',
  'High Risk': 'bg-orange-50 text-orange-700',
  Critical: 'bg-red-50 text-red-700',
  'Not configured': 'bg-slate-100 text-slate-600',
  'Awaiting data': 'bg-slate-100 text-slate-600',
  Low: 'bg-green-50 text-green-700',
  High: 'bg-orange-50 text-orange-700',
}

const typeColor = {
  'National Park': 'bg-green-50 text-green-700',
  Beach: 'bg-cyan-50 text-cyan-700',
  'Recreational Forest': 'bg-lime-50 text-lime-700',
  'Eco Attraction': 'bg-violet-50 text-violet-700',
}

function managedDestination(location, indicator, index) {
  const recyclingRate = indicator?.recycling_rate == null ? null : Math.max(0, Math.min(100, Number(indicator.recycling_rate)))
  const gradients = ['from-green-900 to-green-600', 'from-blue-900 to-blue-600', 'from-cyan-800 to-sky-500', 'from-violet-800 to-purple-500', 'from-emerald-900 to-emerald-600']

  return {
    id: `managed-${location.id}`,
    sourceId: location.id,
    name: location.name,
    state: location.state,
    type: location.location_type,
    lat: Number(location.latitude),
    lng: Number(location.longitude),
    crowd: indicator?.crowd_level || 'Awaiting data',
    environment: indicator?.environment_condition || 'Awaiting data',
    warning: indicator?.warning_level || 'Awaiting data',
    visitors: indicator?.visitor_count == null ? 'Awaiting data' : Number(indicator.visitor_count).toLocaleString(),
    waste: indicator?.waste_level || 'Awaiting data',
    update: indicator?.recorded_at ? new Date(indicator.recorded_at).toLocaleString() : 'Awaiting first stored estimate',
    wasteDataSource: indicator?.data_source === 'simulated' ? 'Automated sensor estimate' : indicator?.data_source === 'stored_estimate' ? 'Stored aggregate estimate' : 'Unavailable',
    aggregateOnly: true,
    distance: 'Managed map point',
    hours: location.operating_hours || 'Contact location operator',
    bestTime: location.best_visit_time || 'Visit during off-peak hours',
    alternative: location.alternative_location || 'Choose another low-crowd destination',
    gradient: gradients[index % gradients.length],
    wallpaper: location.wallpaper_url || '',
    images: [...new Set([location.wallpaper_url, ...(location.gallery_urls || [])].filter(Boolean))],
    description: location.description || 'A protected ecological location managed by EcoGuard administrators.',
    metrics: recyclingRate == null ? [] : [['Estimated recycling rate', Math.round(recyclingRate)]],
  }
}

export default function EcologicalMonitoring({ onNavigate, user }) {
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState('map')
  const [search, setSearch] = useState('')
  const [state, setState] = useState('All States')
  const [warning, setWarning] = useState('All Warnings')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [managedLocations, setManagedLocations] = useState([])
  const [managedIndicators, setManagedIndicators] = useState([])
  const [dataError, setDataError] = useState('')
  const [advisories, setAdvisories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = () => listActiveAdvisories().then((rows) => { if (active) setAdvisories(rows) }).catch(() => { if (active) setAdvisories([]) })
    void load()
    const unsubscribe = subscribeToAdvisories(load)
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    async function loadManagedLocations() {
      try {
        const [locationsResult, indicatorsResult] = await Promise.allSettled([
          listEcologicalLocations({ activeOnly: true }),
          listTouristEnvironmentalIndicators(),
        ])
        if (!active) return
        if (locationsResult.status === 'rejected') throw locationsResult.reason
        setManagedLocations(locationsResult.value)
        if (indicatorsResult.status === 'fulfilled') {
          setManagedIndicators(indicatorsResult.value)
          setDataError('')
        }
        else setDataError(`${indicatorsResult.reason?.message || 'Aggregate environmental indicators are unavailable.'} Apply the latest ecological monitoring migration.`)
      } catch (loadError) {
        if (active) setDataError(`${loadError.message || 'Managed locations are unavailable.'} Showing prototype fallback data.`)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadManagedLocations()
    const unsubscribe = subscribeToEnvironmentalIndicators(loadManagedLocations)
    const refreshTimer = window.setInterval(loadManagedLocations, 60_000)
    return () => {
      active = false
      unsubscribe()
      window.clearInterval(refreshTimer)
    }
  }, [])

  const visibleDestinations = useMemo(() => {
    const advisoryMap = advisories.reduce((groups, item) => ({ ...groups, [String(item.location_id)]: [...(groups[String(item.location_id)] || []), item] }), {})
    if (!managedLocations.length) return destinations.filter(isWestMalaysiaLocation).map((item) => ({ ...item, advisories: advisoryMap[String(item.id)] || [] }))
    const indicatorMap = Object.fromEntries(managedIndicators.map((item) => [String(item.location_id), item]))
    return managedLocations
      .filter(isWestMalaysiaLocation)
      .map((location, index) => ({ ...managedDestination(
        location,
        indicatorMap[String(location.id)],
        index,
      ), advisories: advisoryMap[String(location.id)] || [] }))
  }, [advisories, managedIndicators, managedLocations])
  const selectedLocationId = searchParams.get('location')
  const selected = selectedLocationId
    ? visibleDestinations.find((item) => String(item.id) === selectedLocationId) || null
    : null

  const states = ['All States', ...new Set(visibleDestinations.map((item) => item.state))]
  const availableTypes = [...new Set(visibleDestinations.map((item) => item.type))]

  const filtered = useMemo(
    () =>
      visibleDestinations.filter((item) => {
        const query = search.toLowerCase()
        const matchesSearch =
          item.name.toLowerCase().includes(query) ||
          item.state.toLowerCase().includes(query)
        const matchesState = state === 'All States' || item.state === state
        const matchesWarning = warning === 'All Warnings' || item.warning === warning
        const matchesType = !selectedTypes.length || selectedTypes.includes(item.type)

        return matchesSearch && matchesState && matchesWarning && matchesType
      }),
    [search, state, warning, selectedTypes, visibleDestinations],
  )

  function toggleType(type) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    )
  }

  function clearFilters() {
    setSearch('')
    setState('All States')
    setWarning('All Warnings')
    setSelectedTypes([])
  }

  function openDestination(destination) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('location', String(destination.id))
    setSearchParams(nextParams, { state: { ...routeLocation.state, ecoMonitoringDetail: true } })
  }

  function closeDestination() {
    if (routeLocation.state?.ecoMonitoringDetail) {
      navigate(-1)
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('location')
    setSearchParams(nextParams, { replace: true })
  }

  if (loading) {
    return <LoadingScreen label="Loading ecological destinations..." />
  }

  if (selected) {
    return (
      <DestinationDetails
        destination={selected}
        onBack={closeDestination}
        onNavigate={onNavigate}
        user={user}
      />
    )
  }

  const filtersActive =
    search ||
    state !== 'All States' ||
    warning !== 'All Warnings' ||
    selectedTypes.length > 0

  return (
    <div className="tourist-monitoring-page mx-auto flex max-w-6xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Explore Ecological Destinations
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor tourist-safe environmental, crowd, and aggregate waste indicators across Malaysia
        </p>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-52 flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={17}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-500"
              placeholder="Search destinations or states"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <SelectFilter value={state} onChange={setState} options={states} />
          <SelectFilter
            value={warning}
            onChange={setWarning}
            options={['All Warnings', ...warningLevels]}
          />

          <div className="flex overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setView('map')}
              className={`flex items-center gap-1 px-3 text-xs font-semibold ${
                view === 'map' ? 'bg-green-50 text-green-700' : 'text-slate-500'
              }`}
            >
              <MapIcon size={15} /> Map
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`flex items-center gap-1 border-l border-slate-200 px-3 text-xs font-semibold ${
                view === 'list' ? 'bg-green-50 text-green-700' : 'text-slate-500'
              }`}
            >
              <List size={15} /> List
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
            <SlidersHorizontal size={13} /> Type:
          </span>
          {availableTypes.map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                selectedTypes.includes(type)
                  ? `${typeColor[type]} border-current`
                  : 'border-slate-200 text-slate-500'
              }`}
            >
              {type}
            </button>
          ))}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {dataError && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p>{dataError}</p></div>}

      <p className="text-xs font-medium text-slate-500">
        Showing <b className="text-slate-700">{filtered.length}</b> of{' '}
        {visibleDestinations.length} destinations
      </p>

      {view === 'map' && (
        <MapView destinations={filtered} onSelect={openDestination} />
      )}

      <div
        className={`grid gap-4 ${
          view === 'map'
            ? 'md:grid-cols-2 xl:grid-cols-4'
            : 'md:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {filtered.map((item) => (
          <DestinationCard
            destination={item}
            onSelect={() => openDestination(item)}
            key={item.id}
          />
        ))}
      </div>

      {!filtered.length && (
        <div className="rounded-2xl bg-white py-16 text-center text-slate-400">
          <MapPin className="mx-auto mb-2 opacity-40" size={38} />
          <p className="text-sm font-medium">No destinations match your filters</p>
        </div>
      )}
    </div>
  )
}

function SelectFilter({ value, onChange, options }) {
  return (
    <label className="relative">
      <select
        className="h-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        size={15}
      />
    </label>
  )
}

function FitVisibleDestinations({ destinations }) {
  const map = useMap()

  useEffect(() => {
    if (!destinations.length) return

    if (destinations.length === 1) {
      map.flyTo([destinations[0].lat, destinations[0].lng], 11)
      return
    }

    map.fitBounds(
      destinations.map((item) => [item.lat, item.lng]),
      { padding: [30, 30], maxZoom: 9 },
    )
  }, [map, destinations])

  return null
}

function MapView({ destinations, onSelect }) {
  return (
    <section className="tourist-eco-map overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="h-96">
        <MapContainer
          center={WEST_MALAYSIA_CENTER}
          zoom={5}
          minZoom={5}
          maxBounds={WEST_MALAYSIA_BOUNDS}
          maxBoundsViscosity={1}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitVisibleDestinations destinations={destinations} />

          {destinations.map((destination) => (
            <CircleMarker
              key={destination.id}
              center={[destination.lat, destination.lng]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: markerColor[destination.warning] || markerColor['Awaiting data'],
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="min-w-40">
                  <b>{destination.name}</b>
                  <p>{destination.state}</p>
                  {!destination.sourceId && <p>Source: Prototype fallback data</p>}
                  <p>Warning: {destination.warning}</p>
                  {destination.advisories?.length === 1 && <p><b>Active advisory:</b> {destination.advisories[0].title}</p>}
                  {destination.advisories?.length > 1 && <div className="mt-2 rounded-lg bg-orange-50 p-2 text-orange-800"><b>{destination.advisories.length} active advisories</b><p className="mt-1 text-xs">Open the location details to read all safety guidance.</p></div>}
                  <p>Waste: {destination.waste}{destination.wasteDataSource === 'Automated sensor estimate' ? ' (sensor aggregate)' : ''}</p>
                  <button
                    type="button"
                    onClick={() => onSelect(destination)}
                    className="mt-2 font-semibold text-green-700"
                  >
                    View details
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <b>Warning Level:</b>
        {warningLevels.map((level) => (
          <span className="flex items-center gap-1.5" key={level}>
            <i
              className="size-3 rounded-full"
              style={{ backgroundColor: markerColor[level] }}
            />
            {level}
          </span>
        ))}
        <span className="ml-auto text-slate-400">Click a marker for details</span>
      </div>
    </section>
  )
}

function DestinationCard({ destination, onSelect }) {
  const WarningIcon = destination.warning === 'Safe' ? CheckCircle2 : AlertTriangle

  return (
    <button
      type="button"
      onClick={onSelect}
      className="tourist-destination-card flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`relative flex h-32 w-full shrink-0 items-end justify-between overflow-hidden bg-gradient-to-br ${destination.gradient} p-3`}
      >
        {destination.wallpaper && <img src={destination.wallpaper} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />}
        {destination.wallpaper && <span className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />}
        <span className={`relative rounded-full px-2 py-0.5 text-xs font-semibold ${typeColor[destination.type] || 'bg-emerald-50 text-emerald-700'}`}>
          {destination.type}
        </span>
        <span className="relative flex items-center gap-1 text-xs text-white/90">
          <MapPin size={13} /> {destination.state}
        </span>
      </div>

      <div className="flex w-full flex-1 flex-col p-3">
        <h2 className="font-bold text-slate-800">{destination.name}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            icon={Users}
            value={destination.crowd}
            color={crowdColor[destination.crowd]}
          />
          <Badge
            icon={WarningIcon}
            value={destination.warning}
            color={warningColor[destination.warning]}
          />
          <Badge
            icon={Trash2}
            value={`Waste: ${destination.waste}${destination.wasteDataSource === 'Automated sensor estimate' ? ' - sensor' : ''}`}
            color={wasteColor[destination.waste] || 'bg-slate-100 text-slate-600'}
          />
          {!destination.sourceId && <Badge icon={AlertTriangle} value="Prototype data" color="bg-violet-50 text-violet-700" />}
          {!!destination.advisories?.length && <Badge icon={Megaphone} value={`${destination.advisories.length} active advisory`} color="bg-orange-50 text-orange-700" />}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <Clock3 size={12} /> {destination.update}
          </span>
          <span className="flex items-center gap-0.5 font-semibold text-green-600">
            View Details <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </button>
  )
}

function Badge({ icon: Icon, value, color }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      <Icon size={12} /> {value}
    </span>
  )
}

function DestinationDetails({ destination, onBack, onNavigate, user }) {
  const restricted = ['High Risk', 'Critical'].includes(destination.warning)
  const [reportOpen, setReportOpen] = useState(false)

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-green-700"
      >
        <ArrowLeft size={16} /> Back to exploring
      </button>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 p-4 md:p-6">
          {destination.images?.length ? <ImageSlideshow images={destination.images} locationName={destination.name} featured /> : <div className={`grid h-64 place-items-center rounded-2xl bg-gradient-to-br ${destination.gradient} text-white`}><div className="text-center"><MapPin className="mx-auto opacity-80" size={30} /><p className="mt-2 text-sm font-semibold">No gallery images available</p></div></div>}
        </div>
        <div
          className="border-b border-slate-100 px-6 py-5 md:px-8 md:py-6"
        >
          <div>
          <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            {destination.type}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{destination.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <MapPin size={15} /> {destination.state} · {destination.distance} from Kuala Lumpur
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{destination.description}</p>
          </div>
        </div>

        <div className="grid min-w-0 max-w-full gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 max-w-full overflow-hidden">
            <div className="min-w-0 max-w-full overflow-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}><AdvisoryCarousel advisories={destination.advisories || []} /></div>
            {restricted && (
              <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <AlertTriangle className="shrink-0" size={20} />
                <div>
                  <b>{destination.warning} warning</b>
                  <p className="mt-1 text-sm">
                    Avoid visiting now. Recommended alternative: {destination.alternative}.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-green-600">Live overview</p><h2 className="mt-1 text-lg font-bold text-slate-800">Environmental condition</h2></div><span className="text-xs text-slate-400">Updated {destination.update}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {destination.metrics.map(([metric, value]) => (
                <div className="rounded-xl bg-slate-50 p-3" key={metric}>
                  <p className="text-xs text-slate-500">{metric}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-700">{value}%</p>
                </div>
              ))}
              {!destination.metrics.length && <p className="col-span-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-400">No aggregate environmental metric is available yet.</p>}
            </div>
          </div>

          <aside className="space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-slate-800">Current status</h2>
              <div className="mt-3 space-y-2">
                <StatusRow label="Warning level" value={destination.warning} />
                <StatusRow label="Environmental condition" value={destination.environment} />
                <StatusRow label="Crowd level" value={destination.crowd} />
                <StatusRow label="Visitors" value={destination.visitors} />
                <StatusRow label="Waste level" value={destination.waste} />
                <StatusRow label="Operating hours" value={destination.hours} />
                <StatusRow label="Last update" value={destination.update} />
              </div>
            </div>

            {/* {destination.aggregateOnly && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
                <b>Tourist aggregate view</b>
                <p className="mt-1">Waste source: {destination.wasteDataSource}. Exact quantities, collection schedules, history, staff assignments, and internal notes remain available only to authorized administrators.</p>
              </div>
            )} */}

            {!destination.sourceId && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
                <b>Prototype fallback data</b>
                <p className="mt-1">These values are assignment demonstration content shown only when managed Supabase destinations are unavailable.</p>
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <b>Recommended visiting time</b>
              <p className="mt-1">{destination.bestTime}</p>
            </div>

            <button
              type="button"
              disabled={restricted}
              onClick={() => onNavigate('carbon', { destination })}
              className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {restricted ? 'Travel Not Recommended' : 'Calculate Trip to Here'}
            </button>

            <button type="button" disabled={!destination.sourceId} onClick={() => setReportOpen(true)} title={!destination.sourceId ? 'Reporting is available for managed EcoGuard destinations.' : undefined} className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
              <Camera size={16} />Report Environmental Issue
            </button>

            <button
              type="button"
              onClick={onBack}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 py-3 text-sm font-semibold text-green-700"
            >
              <Calendar size={16} /> View another destination
            </button>
          </aside>
        </div>
      </section>
      {reportOpen && <IncidentReportDialog destination={destination} user={user} onClose={() => setReportOpen(false)} />}
    </div>
  )
}

function AdvisoryCarousel({ advisories }) {
  const [index, setIndex] = useState(0)
  if (!advisories.length) return null
  const advisory = advisories[index] || advisories[0]
  const move = (amount) => setIndex((current) => (current + amount + advisories.length) % advisories.length)

  return <section className="mb-5 flex h-80 flex-col overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 text-orange-950"><header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-orange-200 px-5 py-3"><div className="flex items-center gap-2"><Megaphone className="text-orange-600" size={19} /><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Tourist advisory</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-orange-700">{advisory.ecological_locations?.name || 'Destination'}</span>{advisories.length > 1 && <><span className="text-xs font-semibold text-orange-700">{index + 1} / {advisories.length}</span><button type="button" onClick={() => move(-1)} aria-label="Previous advisory" className="grid size-8 place-items-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-100"><ChevronLeft size={17} /></button><button type="button" onClick={() => move(1)} aria-label="Next advisory" className="grid size-8 place-items-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-100"><ChevronRight size={17} /></button></>}</div></header><div className="min-h-0 flex-1 overflow-y-auto p-5"><h2 className="text-lg font-bold">{advisory.title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><AdvisoryDetail label="Affected area" value={advisory.affected_area || 'Not provided'} /><AdvisoryDetail label="Recommended visiting time" value={advisory.recommended_visiting_time || 'Not provided'} /></div><div className="mt-3"><AdvisoryDetail label="Safety instructions" value={advisory.safety_instructions || 'Not provided'} /></div>{advisory.alternative_location && advisory.alternative_location !== 'No alternative specified' && <div className="mt-3"><AdvisoryDetail label="Alternative location" value={advisory.alternative_location} /></div>}<p className="mt-4 text-xs text-orange-700">Active from {new Date(advisory.starts_at).toLocaleString()} until {new Date(advisory.expires_at).toLocaleString()}</p></div></section>
}

function AdvisoryDetail({ label, value }) {
  return <div className="min-w-0 max-w-full overflow-hidden rounded-xl bg-white/70 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-orange-600">{label}</p><p className="mt-1 max-w-full whitespace-pre-wrap text-sm leading-6" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</p></div>
}

const incidentCategories = [
  ['overflowing_rubbish', 'Overflowing rubbish'],
  ['damaged_facilities_or_trail', 'Damaged facilities or trail'],
  ['wildlife_disturbance', 'Wildlife disturbance'],
  ['smoke_or_haze', 'Smoke or haze'],
  ['other', 'Other'],
]

function IncidentReportDialog({ destination, user, onClose }) {
  const toast = useToast()
  const photoInputRef = useRef(null)
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, saving])

  function choosePhotos(files) {
    const selected = Array.from(files || [])
    if (!selected.length) return
    const invalid = selected.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
    if (invalid) {
      setFieldErrors((current) => ({ ...current, photos: 'Each photo must be a JPG, PNG, or WebP file no larger than 10 MB.' }))
      toast.reminder('One or more selected photos are invalid.')
      return
    }
    setPhotos((current) => [...current, ...selected])
    setPreviews((current) => [...current, ...selected.map((file) => URL.createObjectURL(file))])
    setFieldErrors((current) => ({ ...current, photos: undefined }))
  }

  function removePhoto(index) {
    URL.revokeObjectURL(previews[index])
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!category) nextErrors.category = 'Choose an issue category.'
    if (category === 'other' && customCategory.trim().length < 3) nextErrors.customCategory = 'Enter at least 3 characters.'
    if (description.trim().length < 10) nextErrors.description = 'Enter at least 10 characters describing the issue.'
    if (!photos.length) nextErrors.photos = 'Attach at least one photo.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setError('Choose a category, enter at least 10 characters, and attach at least one photo.')
      toast.reminder('Please correct the highlighted incident report fields.')
      return
    }
    setSaving(true); setError('')
    try {
      await submitEnvironmentalIncident({ locationId: destination.sourceId, locationName: destination.name, reporterId: user.id, category, customCategory, description, photos })
      setSubmitted(true)
      toast.success('Environmental incident report submitted successfully.')
    } catch (submitError) { const failure = submitError.message || 'Unable to submit the report.'; setError(failure); toast.error(failure) }
    finally { setSaving(false) }
  }

  return createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-labelledby="incident-report-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className={submitted ? 'relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl' : 'flex h-[calc(100dvh-2rem)] max-h-[760px] min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-2xl md:p-6'}>
      {!submitted && <div className="flex shrink-0 items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-green-600">Environmental incident</p><h2 id="incident-report-title" className="mt-1 text-xl font-bold text-slate-900">Report an issue</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close report form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>}
      {submitted ? <div className="py-5 text-center"><button type="button" onClick={onClose} aria-label="Close confirmation" className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button><span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50"><CheckCircle2 size={34} className="text-emerald-500" /></span><p className="mt-5 text-xs font-bold uppercase tracking-widest text-green-600">Environmental incident</p><h3 className="mt-2 text-xl font-bold text-slate-900">Report submitted</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Your report was routed to the administrator responsible for {destination.name}.</p><button type="button" onClick={onClose} className="mt-6 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700">Done</button></div> : <form onSubmit={submit} noValidate className="mt-5 min-h-0 space-y-4 overflow-y-auto pr-1">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="block text-xs font-semibold text-slate-500">Location<input readOnly value={destination.name} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600" /></label>
        <label className="block text-xs font-semibold text-slate-500">Issue category<select required value={category} onChange={(event) => { setCategory(event.target.value); setFieldErrors((current) => ({ ...current, category: undefined })) }} aria-invalid={Boolean(fieldErrors.category)} className={`mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${fieldErrors.category ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-green-500'}`}><option value="">Select a category</option>{incidentCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{fieldErrors.category && <span className="mt-1 block font-normal text-red-500">{fieldErrors.category}</span>}</label>
        {category === 'other' && <label className="block text-xs font-semibold text-slate-500">Custom issue category<input required minLength="3" maxLength="80" value={customCategory} onChange={(event) => { setCustomCategory(event.target.value); setFieldErrors((current) => ({ ...current, customCategory: undefined })) }} placeholder="Enter the type of environmental issue" aria-invalid={Boolean(fieldErrors.customCategory)} className={`mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none ${fieldErrors.customCategory ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-green-500'}`} />{fieldErrors.customCategory && <span className="mt-1 block font-normal text-red-500">{fieldErrors.customCategory}</span>}</label>}
        <label className="block text-xs font-semibold text-slate-500">Description<textarea required minLength="10" maxLength="2000" rows="5" value={description} onChange={(event) => { setDescription(event.target.value); setFieldErrors((current) => ({ ...current, description: undefined })) }} placeholder="Describe what you observed and where within the destination it occurred." aria-invalid={Boolean(fieldErrors.description)} className={`mt-1 w-full resize-y rounded-xl border p-3 text-sm font-normal leading-6 outline-none ${fieldErrors.description ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-green-500'}`} />{fieldErrors.description && <span className="mt-1 block font-normal text-red-500">{fieldErrors.description}</span>}<span className="mt-1 block text-right text-[11px] text-slate-400">{description.length}/2000</span></label>
        <div className={`rounded-xl border p-4 text-sm ${fieldErrors.photos ? 'border-red-400 bg-red-50/40 ring-2 ring-red-100' : 'border-slate-200'}`}><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-700">Photo evidence</span><span className="text-xs text-slate-400">JPG, PNG or WebP · 10 MB each</span></div><input ref={photoInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { choosePhotos(event.target.files); event.target.value = '' }} className="hidden" /><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{previews.map((url, index) => <div key={url} className="relative overflow-hidden rounded-xl border border-orange-200 bg-orange-50"><img src={url} alt={`Selected incident evidence ${index + 1}`} className="h-28 w-full object-cover" /><span className="pointer-events-none absolute bottom-1 left-1 rounded bg-orange-600 px-2 py-1 text-[10px] font-bold text-white">Image {index + 1}</span><button type="button" onClick={() => removePhoto(index)} aria-label={`Remove image ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-white/95 p-1.5 text-red-500 shadow hover:bg-red-50"><X size={14} /></button></div>)}<button type="button" onClick={() => photoInputRef.current?.click()} className="flex min-h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 text-orange-600 hover:border-orange-400 hover:bg-orange-50"><Plus size={22} /><span className="mt-1 font-semibold">Add images</span><span className="text-[10px] text-orange-400">Select one or many</span></button></div>{fieldErrors.photos ? <p className="mt-2 text-xs text-red-500">{fieldErrors.photos}</p> : !photos.length && <p className="mt-2 text-xs text-slate-400">At least one photo is required.</p>}</div>
        <button type="submit" disabled={saving} className="sticky bottom-0 w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/10 hover:bg-green-700 disabled:opacity-50">{saving ? 'Submitting report...' : 'Submit environmental report'}</button>
      </form>}
    </section>
  </div>, document.body)
}

function ImageSlideshow({ images, locationName, featured = false }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const activeImage = images[activeIndex]

  useEffect(() => {
    if (!previewOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event) {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [previewOpen])

  function previous() {
    setActiveIndex((current) => (current - 1 + images.length) % images.length)
  }

  function next() {
    setActiveIndex((current) => (current + 1) % images.length)
  }

  return <section className={featured ? '' : 'mt-6'}>
    <div className="flex items-end justify-between gap-3">
      <div><h2 className="font-bold text-slate-800">Location gallery</h2><p className="mt-1 text-xs text-slate-400">Select a thumbnail or use the arrows to preview each image.</p></div>
      <span className="text-xs font-semibold text-slate-500">{activeIndex + 1} / {images.length}</span>
    </div>
    <div className="group relative mt-3 overflow-hidden rounded-2xl bg-slate-950 shadow-sm">
      <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full" aria-label={`Preview ${locationName} image ${activeIndex + 1}`}>
        <img src={activeImage} alt={`${locationName} ${activeIndex + 1}`} className={`${featured ? 'h-72 sm:h-[30rem]' : 'h-72 sm:h-96'} w-full object-contain`} />
        <span className="absolute right-3 top-3 rounded-full bg-slate-950/65 p-2 text-white"><Expand size={17} /></span>
      </button>
      {images.length > 1 && <>
        <SlideshowButton label="Previous image" position="left-3" onClick={previous}><ChevronLeft size={22} /></SlideshowButton>
        <SlideshowButton label="Next image" position="right-3" onClick={next}><ChevronRight size={22} /></SlideshowButton>
      </>}
    </div>
    {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {images.map((url, index) => <button type="button" onClick={() => setActiveIndex(index)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${index === activeIndex ? 'border-green-500' : 'border-transparent opacity-70 hover:opacity-100'}`} aria-label={`Show image ${index + 1}`} key={url}><img src={url} alt="" loading="lazy" className="h-16 w-24 object-cover" /></button>)}
    </div>}
    {previewOpen && createPortal(<div className="fixed inset-0 z-[9999] flex h-dvh w-screen items-center justify-center overflow-hidden bg-slate-950" role="dialog" aria-modal="true" aria-label={`${locationName} image preview`} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false) }}>
      <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close image preview" className="absolute right-4 top-4 z-20 rounded-full bg-slate-950/70 p-3 text-white shadow-lg ring-1 ring-white/20 hover:bg-slate-800"><X size={26} /></button>
      <img src={activeImage} alt={`${locationName} ${activeIndex + 1}`} className="h-full w-full select-none object-contain" />
      {images.length > 1 && <><SlideshowButton label="Previous image" position="left-5" onClick={previous}><ChevronLeft size={28} /></SlideshowButton><SlideshowButton label="Next image" position="right-5" onClick={next}><ChevronRight size={28} /></SlideshowButton></>}
      <span className="absolute bottom-5 rounded-full bg-slate-950/70 px-3 py-1 text-sm font-semibold text-white ring-1 ring-white/20">{activeIndex + 1} / {images.length}</span>
    </div>, document.body)}
  </section>
}

function SlideshowButton({ label, position, onClick, children }) {
  return <button type="button" onClick={(event) => { event.stopPropagation(); onClick() }} aria-label={label} className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-slate-950/60 p-2 text-white transition hover:bg-slate-950/80 ${position}`}>{children}</button>
}

function StatusRow({ label, value }) {
  return (
    <p className="flex justify-between gap-4 text-sm text-slate-600">
      <span>{label}</span>
      <b className="text-right">{value}</b>
    </p>
  )
}
