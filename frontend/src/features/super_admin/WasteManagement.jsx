import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  listWasteOperations,
  listWasteAlertHistory,
  subscribeToWasteOperations,
  listWasteReportExports,
} from '../../services/wasteService'
import { DEFAULT_WASTE_COLLECTION_FILTERS } from '../../utils/wasteAnalytics'
import WasteAnalytics from './waste/WasteAnalytics'
import WasteCollectionForm from './waste/WasteCollectionForm'
import WasteCollectionHistory from './waste/WasteCollectionHistory'
import WasteScheduleManager from './waste/WasteScheduleManager'
import WasteAlertHistory from './waste/WasteAlertHistory'
import WasteScheduleForm from './waste/WasteScheduleForm'
import { filterWasteAlerts } from '../../utils/wasteWorkflow'
import LoadingScreen from '../../components/LoadingScreen'

export default function WasteManagement({ locations, loading, error, onDataChange, isSuperAdmin, profile, section = 'schedules', onSectionChange, embedded = false }) {
  const [selectedId, setSelectedId] = useState('')
  const [schedules, setSchedules] = useState([])
  const [collections, setCollections] = useState([])
  const [exportAudits, setExportAudits] = useState([])
  const [collectionFilters, setCollectionFilters] = useState(() => ({ ...DEFAULT_WASTE_COLLECTION_FILTERS }))
  const [wasteLoading, setWasteLoading] = useState(true)
  const [wasteError, setWasteError] = useState('')
  const [collectionEditor, setCollectionEditor] = useState(null)
  const [operationMessage, setOperationMessage] = useState('')
  const [alerts, setAlerts] = useState([])
  const [alertError, setAlertError] = useState('')
  const [exportError, setExportError] = useState('')
  const [scheduleAlert, setScheduleAlert] = useState(null)
  const [focusedAlertId, setFocusedAlertId] = useState(null)
  const [loadedScope, setLoadedScope] = useState('')
  const requestRef = useRef(0)
  const assignedLocationId = String(profile?.location_id || '')
  const accessibleLocations = isSuperAdmin ? locations : locations.filter((item) => String(item.id) === assignedLocationId)
  const scopeKey = JSON.stringify(accessibleLocations.map((item) => String(item.id)).sort())

  const refreshWasteData = useCallback(async () => {
    const request = ++requestRef.current
    setWasteLoading(true)
    const ids = JSON.parse(scopeKey)
    const [operations, exports, alertResult] = await Promise.allSettled([
      listWasteOperations(ids),
      listWasteReportExports(),
      listWasteAlertHistory(ids),
    ])
    if (request !== requestRef.current) return
    if (operations.status === 'fulfilled') {
      setSchedules(operations.value.schedules)
      setCollections(operations.value.collections)
      setWasteError('')
    } else {
      setSchedules([])
      setCollections([])
      setWasteError(operations.reason.message || 'Unable to load waste operations.')
    }
    if (exports.status === 'fulfilled') { setExportAudits(exports.value); setExportError('') }
    else { setExportAudits([]); setExportError(exports.reason.message || 'Unable to load report export history.') }
    if (alertResult.status === 'fulfilled') { setAlerts(alertResult.value); setAlertError('') }
    else { setAlerts([]); setAlertError(alertResult.reason.message || 'Unable to load waste alert history.') }
    setWasteLoading(false)
    setLoadedScope(scopeKey)
  }, [scopeKey])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return refreshWasteData() })
    const unsubscribe = subscribeToWasteOperations(refreshWasteData)
    const timer = window.setInterval(refreshWasteData, 60000)
    return () => { active = false; requestRef.current += 1; unsubscribe(); window.clearInterval(timer) }
  }, [refreshWasteData])

  const selected = accessibleLocations.find((item) => String(item.id) === String(selectedId)) || accessibleLocations[0] || null
  const selectedSchedules = selected
    ? schedules.filter((item) => String(item.location_id) === String(selected.id))
    : []
  const selectedCollections = selected
    ? collections.filter((item) => String(item.location_id) === String(selected.id))
    : []
  const selectedExportAudits = selected
    ? exportAudits.filter((item) => String(item.location_id) === String(selected.id))
    : []

  const selectedAlerts = selected ? filterWasteAlerts(alerts, [selected.id]) : []

  function viewAlert(alertId) {
    setFocusedAlertId(alertId)
    onSectionChange?.('alerts')
  }

  async function refreshAllData() {
    await Promise.all([refreshWasteData(), onDataChange?.()])
  }

  function openCollectionForm(schedule = null, alert = null, initialStatus = 'completed') {
    setOperationMessage('')
    setCollectionEditor({ schedule, alert: alert || selectedAlerts.find((item) => String(item.id) === String(schedule?.alert_id)), initialStatus })
  }

  async function collectionSaved(_record, scheduled) {
    await refreshWasteData()
    setCollectionEditor(null)
    onSectionChange?.('history')
    setOperationMessage(scheduled ? 'Scheduled collection recorded and its schedule status was updated.' : 'Unscheduled collection recorded successfully.')
  }

  const content = {
    alerts: selected && <WasteAlertHistory key={String(selected.id) + '-' + (focusedAlertId || '')} location={selected} alerts={selectedAlerts} schedules={selectedSchedules} collections={selectedCollections} loading={wasteLoading} error={alertError || wasteError} focusId={focusedAlertId} onSchedule={setScheduleAlert} onCollect={openCollectionForm} onRefresh={refreshWasteData} />,
    schedules: (
      <WasteScheduleManager
        key={selected?.id}
        location={selected}
        schedules={selectedSchedules}
        loading={wasteLoading}
        onRefresh={refreshWasteData}
        onRecordCollection={openCollectionForm}
        onViewAlert={viewAlert}
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
        onViewAlert={viewAlert}
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

  if (loading || (loadedScope !== scopeKey && wasteLoading)) {
    return <LoadingScreen tone="blue" label="Loading waste management..." />
  }

  return (
    <div className={`${embedded ? '' : 'mx-auto max-w-6xl'} flex flex-col gap-6`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg' : 'text-2xl'} font-bold text-slate-900`}>{embedded ? 'Waste Collection Reports' : 'Waste Management'}</h2>
          <p className="mt-1 text-sm text-slate-500">{embedded ? 'Analytics calculated from persisted collection records.' : 'Location-scoped schedules, collection history, sensor readings, analytics, and reports'}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {isSuperAdmin && accessibleLocations.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Location
              <select aria-label="Monitored location" value={selected?.id || ''} onChange={(event) => { setSelectedId(event.target.value); setFocusedAlertId(null); setCollectionEditor(null); setScheduleAlert(null) }} className="max-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500">
                {accessibleLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={refreshAllData} disabled={loading || wasteLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading || wasteLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {!embedded && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setFocusedAlertId(null); onSectionChange?.('alerts') }} className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">{focusedAlertId && section === 'alerts' ? 'Show all waste alerts' : 'Alert History'} ({selectedAlerts.filter((item) => !item.resolved_at).length} unresolved)</button>{section === 'alerts' && <><button type="button" onClick={() => onSectionChange?.('schedules')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">Collection schedules</button><button type="button" onClick={() => onSectionChange?.('history')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">Collection history</button></>}</div>}
      {error && <ModuleNotice message={error} />}
      {wasteError && <ModuleNotice message={wasteError} />}
      {section === 'analytics' && exportError && <ModuleNotice message={exportError} />}
      {operationMessage && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{operationMessage}</div>}
      {!loading && !selected && <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">{isSuperAdmin ? 'Add an ecological location before managing waste operations.' : 'No ecological location is assigned to this administrator.'}</div>}
      {selected && content}
      {scheduleAlert && selected && <WasteScheduleForm key={scheduleAlert.id} location={selected} schedules={selectedSchedules} alert={scheduleAlert} onClose={() => setScheduleAlert(null)} onSaved={async () => { setScheduleAlert(null); await refreshWasteData(); onSectionChange?.('schedules') }} />}
      {collectionEditor && selected && <WasteCollectionForm key={collectionEditor.schedule?.id || `unscheduled-${selected.id}`} location={selected} schedule={collectionEditor.schedule} alert={collectionEditor.alert} initialStatus={collectionEditor.initialStatus} onClose={() => setCollectionEditor(null)} onSaved={collectionSaved} />}
    </div>
  )
}

function ModuleNotice({ message }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{message}</div>
}
