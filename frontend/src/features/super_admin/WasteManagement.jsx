import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'
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

export default function WasteManagement({ locations, metrics, loading, error, onDataChange, onMetricCreated, isSuperAdmin, profile, section = 'overview', onSectionChange }) {
  const [selectedId, setSelectedId] = useState('')
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

  const assignedLocationId = String(profile?.location_id || '')
  const selected = isSuperAdmin
    ? locations.find((item) => String(item.id) === String(selectedId)) || locations[0] || null
    : locations.find((item) => String(item.id) === assignedLocationId) || locations[0] || null
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
    onSectionChange?.('history')
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
        onMetricCreated={onMetricCreated}
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
  }[section]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Waste Management</h1>
          <p className="mt-1 text-sm text-slate-500">Location-scoped schedules, collection history, sensor readings, analytics, and reports</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {isSuperAdmin && locations.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Location
              <select aria-label="Monitored location" value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="max-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500">
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={refreshAllData} disabled={loading || wasteLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading || wasteLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {selected && !isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <MapPin size={16} className="shrink-0" />
          <span><span className="font-semibold">Assigned location:</span> {selected.name}</span>
        </div>
      )}

      {error && <ModuleNotice message={error} />}
      {wasteError && <ModuleNotice message={wasteError} />}
      {operationMessage && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{operationMessage}</div>}
      {!loading && !selected && <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">{isSuperAdmin ? 'Add an ecological location before managing waste operations.' : 'No ecological location is assigned to this administrator.'}</div>}
      {selected && content}
      {collectionEditor && selected && <WasteCollectionForm key={collectionEditor.schedule?.id || `unscheduled-${selected.id}`} location={selected} schedule={collectionEditor.schedule} onClose={() => setCollectionEditor(null)} onSaved={collectionSaved} />}
    </div>
  )
}

function ModuleNotice({ message }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{message}</div>
}
