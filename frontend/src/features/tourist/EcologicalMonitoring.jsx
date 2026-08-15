import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  latestMetricsByLocation,
  listCrowdThresholds,
  listEcologicalLocations,
  listLocationMetrics,
} from '../../services/locationService'

const MALAYSIA_CENTER = [4.2105, 101.9758]
const MALAYSIA_BOUNDS = [
  [0.8, 99.5],
  [7.6, 119.5],
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
}

const warningColor = {
  Safe: 'bg-green-50 text-green-700',
  Caution: 'bg-amber-50 text-amber-700',
  'High Risk': 'bg-orange-50 text-orange-700',
  Critical: 'bg-red-50 text-red-700',
}

const markerColor = {
  Safe: '#16a34a',
  Caution: '#f59e0b',
  'High Risk': '#f97316',
  Critical: '#dc2626',
}

const typeColor = {
  'National Park': 'bg-green-50 text-green-700',
  Beach: 'bg-cyan-50 text-cyan-700',
  'Recreational Forest': 'bg-lime-50 text-lime-700',
  'Eco Attraction': 'bg-violet-50 text-violet-700',
}

function managedDestination(location, metric, threshold, index) {
  const capacity = Math.max(1, Number(location.max_capacity || 1))
  const visitors = Number(metric?.crowd_count || 0)
  const occupancy = Math.round((visitors / capacity) * 100)
  const rules = threshold || { caution_percent: 60, warning_percent: 80, critical_percent: 90 }
  const warning = occupancy >= rules.critical_percent
    ? 'Critical'
    : occupancy >= rules.warning_percent
      ? 'High Risk'
      : occupancy >= rules.caution_percent
        ? 'Caution'
        : 'Safe'
  const crowd = warning === 'Critical' ? 'Critical' : warning === 'High Risk' ? 'High' : warning === 'Caution' ? 'Moderate' : 'Low'
  const aqi = Number(metric?.air_quality_index ?? 50)
  const water = Number(metric?.water_quality_score ?? 80)
  const environment = aqi <= 50 && water >= 80 ? 'Excellent' : aqi <= 100 && water >= 65 ? 'Good' : aqi <= 150 && water >= 50 ? 'Fair' : 'Poor'
  const wastePerCapacity = Number(metric?.waste_kg || 0) / capacity
  const waste = wastePerCapacity > 0.04 ? 'High' : wastePerCapacity > 0.02 ? 'Moderate' : 'Low'
  const airScore = Math.max(0, Math.min(100, 110 - aqi))
  const gradients = ['from-green-900 to-green-600', 'from-blue-900 to-blue-600', 'from-cyan-800 to-sky-500', 'from-violet-800 to-purple-500', 'from-emerald-900 to-emerald-600']

  return {
    id: `managed-${location.id}`,
    sourceId: location.id,
    name: location.name,
    state: location.state,
    type: location.location_type,
    lat: Number(location.latitude),
    lng: Number(location.longitude),
    crowd,
    environment,
    warning,
    visitors: visitors.toLocaleString(),
    waste,
    update: metric?.recorded_at ? new Date(metric.recorded_at).toLocaleString() : 'Awaiting first snapshot',
    distance: 'Managed map point',
    hours: location.operating_hours || 'Contact location operator',
    bestTime: location.best_visit_time || 'Visit during off-peak hours',
    alternative: location.alternative_location || 'Choose another low-crowd destination',
    gradient: gradients[index % gradients.length],
    description: location.description || 'A protected ecological location managed by EcoGuard administrators.',
    metrics: [
      ['Air quality', airScore],
      ['Water quality', Math.round(water)],
      ['Recycling rate', metric?.waste_kg ? Math.min(100, Math.round((Number(metric.recycled_kg || 0) / Number(metric.waste_kg)) * 100)) : 0],
      ['Visitor load', Math.min(100, occupancy)],
    ],
  }
}

export default function EcologicalMonitoring({ onNavigate }) {
  const [view, setView] = useState('map')
  const [search, setSearch] = useState('')
  const [state, setState] = useState('All States')
  const [warning, setWarning] = useState('All Warnings')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selected, setSelected] = useState(null)
  const [managedLocations, setManagedLocations] = useState([])
  const [managedThresholds, setManagedThresholds] = useState([])
  const [managedMetrics, setManagedMetrics] = useState([])
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    let active = true
    async function loadManagedLocations() {
      try {
        const [locationRows, thresholdRows, metricRows] = await Promise.all([
          listEcologicalLocations({ activeOnly: true }),
          listCrowdThresholds(),
          listLocationMetrics(),
        ])
        if (!active) return
        setManagedLocations(locationRows)
        setManagedThresholds(thresholdRows)
        setManagedMetrics(metricRows)
      } catch (loadError) {
        if (active) setDataError(`${loadError.message || 'Managed locations are unavailable.'} Showing prototype fallback data.`)
      }
    }
    loadManagedLocations()
    return () => { active = false }
  }, [])

  const visibleDestinations = useMemo(() => {
    if (!managedLocations.length) return destinations
    const latest = latestMetricsByLocation(managedMetrics)
    const thresholdMap = Object.fromEntries(managedThresholds.map((item) => [String(item.location_id), item]))
    return managedLocations.map((location, index) => managedDestination(
      location,
      latest[String(location.id)],
      thresholdMap[String(location.id)],
      index,
    ))
  }, [managedLocations, managedMetrics, managedThresholds])

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

  if (selected) {
    return (
      <DestinationDetails
        destination={selected}
        onBack={() => setSelected(null)}
        onNavigate={onNavigate}
      />
    )
  }

  const filtersActive =
    search ||
    state !== 'All States' ||
    warning !== 'All Warnings' ||
    selectedTypes.length > 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Explore Ecological Destinations
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor environmental conditions, crowd levels and warnings across Malaysia
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
        <MapView destinations={filtered} onSelect={setSelected} />
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
            onSelect={() => setSelected(item)}
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
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="h-96">
        <MapContainer
          center={MALAYSIA_CENTER}
          zoom={5}
          minZoom={5}
          maxBounds={MALAYSIA_BOUNDS}
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
                fillColor: markerColor[destination.warning],
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="min-w-40">
                  <b>{destination.name}</b>
                  <p>{destination.state}</p>
                  <p>Warning: {destination.warning}</p>
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
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`flex h-24 items-end justify-between bg-gradient-to-br ${destination.gradient} p-3`}
      >
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeColor[destination.type] || 'bg-emerald-50 text-emerald-700'}`}>
          {destination.type}
        </span>
        <span className="flex items-center gap-1 text-xs text-white/90">
          <MapPin size={13} /> {destination.state}
        </span>
      </div>

      <div className="p-3">
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
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
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

function DestinationDetails({ destination, onBack, onNavigate }) {
  const restricted = ['High Risk', 'Critical'].includes(destination.warning)

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
        <div className={`h-44 bg-gradient-to-br ${destination.gradient} p-6 text-white`}>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">
            {destination.type}
          </span>
          <h1 className="mt-4 text-3xl font-bold">{destination.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
            <MapPin size={15} /> {destination.state} · {destination.distance} from Kuala Lumpur
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
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

            <h2 className="font-bold text-slate-800">About this destination</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {destination.description}
            </p>

            <h2 className="mt-6 font-bold text-slate-800">Environmental condition</h2>
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
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-100 p-4">
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

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <b>Recommended visiting time</b>
              <p className="mt-1">{destination.bestTime}</p>
            </div>

            <button
              type="button"
              disabled={restricted}
              onClick={() => onNavigate('carbon')}
              className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {restricted ? 'Travel Not Recommended' : 'Calculate Trip to Here'}
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
    </div>
  )
}

function StatusRow({ label, value }) {
  return (
    <p className="flex justify-between gap-4 text-sm text-slate-600">
      <span>{label}</span>
      <b className="text-right">{value}</b>
    </p>
  )
}
