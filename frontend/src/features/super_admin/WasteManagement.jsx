import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarClock, ClipboardList, LayoutDashboard, RefreshCw, Search } from 'lucide-react'
import { latestMetricsByLocation } from '../../services/locationService'
import {
  listWasteCollections,
  listWasteReportExports,
  listWasteSchedules,
  listWasteThresholds,
} from '../../services/wasteService'
import { DEFAULT_WASTE_COLLECTION_FILTERS } from '../../utils/wasteAnalytics'
import WasteAnalytics from './waste/WasteAnalytics'
import WasteCollectionForm from './waste/WasteCollectionForm'
import WasteCollectionHistory from './waste/WasteCollectionHistory'
import WasteOverview from './waste/WasteOverview'
import WasteScheduleManager from './waste/WasteScheduleManager'

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'schedules', label: 'Collection Schedules', icon: CalendarClock },
  { id: 'history', label: 'Collection History', icon: ClipboardList },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
]

export default function WasteManagement({ locations, metrics, loading, error, onDataChange }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [schedules, setSchedules] = useState([])
  const [collections, setCollections] = useState([])
  const [thresholds, setThresholds] = useState([])
  const [exportAudits, setExportAudits] = useState([])
  const [collectionFilters, setCollectionFilters] = useState(() => ({ ...DEFAULT_WASTE_COLLECTION_FILTERS }))
  const [wasteLoading, setWasteLoading] = useState(true)
  const [wasteError, setWasteError] = useState('')
  const [collectionEditor, setCollectionEditor] = useState(null)
  const [operationMessage, setOperationMessage] = useState('')

  const refreshWasteData = useCallback(async () => {
    setWasteLoading(true)
    setWasteError('')
    try {
      const [scheduleRows, collectionRows, thresholdRows, exportRows] = await Promise.all([
        listWasteSchedules(),
        listWasteCollections(),
        listWasteThresholds(),
        listWasteReportExports(),
      ])
      setSchedules(scheduleRows)
      setCollections(collectionRows)
      setThresholds(thresholdRows)
      setExportAudits(exportRows)
    } catch (loadError) {
      setWasteError(loadError.message || 'Unable to load operational waste data.')
    } finally {
      setWasteLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      listWasteSchedules(),
      listWasteCollections(),
      listWasteThresholds(),
      listWasteReportExports(),
    ])
      .then(([scheduleRows, collectionRows, thresholdRows, exportRows]) => {
        if (!active) return
        setSchedules(scheduleRows)
        setCollections(collectionRows)
        setThresholds(thresholdRows)
        setExportAudits(exportRows)
      })
      .catch((loadError) => {
        if (active) setWasteError(loadError.message || 'Unable to load operational waste data.')
      })
      .finally(() => {
        if (active) setWasteLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const states = [...new Set(locations.map((item) => item.state))].sort()
  const filteredLocations = locations.filter((location) => {
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [location.name, location.state, location.location_type]
      .some((value) => value?.toLowerCase().includes(needle))
    return matchesQuery && (stateFilter === 'all' || location.state === stateFilter)
  })
  const selected = filteredLocations.find((item) => String(item.id) === String(selectedId)) || filteredLocations[0] || null
  const latest = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const thresholdMap = useMemo(
    () => Object.fromEntries(thresholds.map((item) => [String(item.location_id), item])),
    [thresholds],
  )
  const selectedSchedules = selected
    ? schedules.filter((item) => String(item.location_id) === String(selected.id))
    : []
  const selectedCollections = selected
    ? collections.filter((item) => String(item.location_id) === String(selected.id))
    : []
  const selectedExportAudits = selected
    ? exportAudits.filter((item) => String(item.location_id) === String(selected.id))
    : []

  async function refreshAllData() {
    await Promise.all([refreshWasteData(), onDataChange?.()])
  }

  function openCollectionForm(schedule = null) {
    setOperationMessage('')
    setCollectionEditor({ schedule })
  }

  async function collectionSaved(_record, scheduled) {
    await refreshWasteData()
    setCollectionEditor(null)
    setActiveTab('history')
    setOperationMessage(scheduled ? 'Scheduled collection recorded and its schedule status was updated.' : 'Unscheduled collection recorded successfully.')
  }

  const content = {
    overview: selected ? (
      <WasteOverview
        location={selected}
        baseline={latest[String(selected.id)]}
        threshold={thresholdMap[String(selected.id)]}
        schedules={selectedSchedules}
        collections={selectedCollections}
        loading={loading || wasteLoading}
        onDataChange={onDataChange}
        onThresholdSaved={refreshWasteData}
      />
    ) : null,
    schedules: (
      <WasteScheduleManager
        location={selected}
        schedules={selectedSchedules}
        loading={wasteLoading}
        onRefresh={refreshWasteData}
        onRecordCollection={openCollectionForm}
      />
    ),
    history: (
      <WasteCollectionHistory
        location={selected}
        collections={selectedCollections}
        filters={collectionFilters}
        onFiltersChange={setCollectionFilters}
        loading={wasteLoading}
        onRefresh={refreshWasteData}
        onCreateCollection={() => openCollectionForm()}
      />
    ),
    analytics: (
      <WasteAnalytics
        location={selected}
        collections={selectedCollections}
        filters={collectionFilters}
        onFiltersChange={setCollectionFilters}
        exportAudits={selectedExportAudits}
        onExported={refreshWasteData}
        loading={wasteLoading}
      />
    ),
  }[activeTab]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Waste Management</h1>
          <p className="mt-1 text-sm text-slate-500">Location-scoped schedules, collection history, simulated readings, analytics, and reports</p>
        </div>
        <button type="button" onClick={refreshAllData} disabled={loading || wasteLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm disabled:opacity-50">
          <RefreshCw size={16} className={loading || wasteLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search monitored location" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
            <option value="all">All states</option>
            {states.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Monitored location" value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500">
            <option value="" disabled>Select monitored location</option>
            {filteredLocations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.location_type}</option>)}
          </select>
          {(query || stateFilter !== 'all') && <button type="button" onClick={() => { setQuery(''); setStateFilter('all') }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Clear</button>}
        </div>
        <p className="mt-2 text-right text-xs text-slate-400">{filteredLocations.length} matching locations</p>
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm" aria-label="Waste Management sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === id ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {error && <ModuleNotice message={error} />}
      {wasteError && <ModuleNotice message={wasteError} />}
      {operationMessage && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{operationMessage}</div>}
      {!loading && !selected && <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">{locations.length ? 'No monitored location matches the current filters.' : 'Add an ecological location before managing waste operations.'}</div>}
      {selected && content}
      {collectionEditor && selected && <WasteCollectionForm key={collectionEditor.schedule?.id || `unscheduled-${selected.id}`} location={selected} schedule={collectionEditor.schedule} onClose={() => setCollectionEditor(null)} onSaved={collectionSaved} />}
    </div>
  )
}

function ModuleNotice({ message }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{message}</div>
}
