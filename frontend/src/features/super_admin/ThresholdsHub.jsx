import { useCallback, useEffect, useRef, useState } from 'react'
import { Recycle, Users } from 'lucide-react'
import { listWasteThresholds } from '../../services/wasteService'
import { listCrowdThresholds } from '../../services/locationService'
import LoadingScreen from '../../components/LoadingScreen'
import CrowdThresholds from './CrowdThresholds'
import WasteThresholds from './WasteThresholds'

const tabs = [
  { id: 'crowd', label: 'Crowd Thresholds', icon: Users },
  { id: 'waste', label: 'Waste Thresholds', icon: Recycle },
]

export default function ThresholdsHub({ locations = [], metrics = [], ...sharedProps }) {
  const [activeTab, setActiveTab] = useState('crowd')
  const [thresholds, setThresholds] = useState([])
  const [thresholdLoading, setThresholdLoading] = useState(true)
  const [thresholdError, setThresholdError] = useState('')
  const requestRef = useRef(0)

  const loadThresholds = useCallback(async () => {
    const request = ++requestRef.current
    setThresholdLoading(true)
    setThresholdError('')
    try {
      const rows = await (activeTab === 'crowd' ? listCrowdThresholds() : listWasteThresholds())
      if (request === requestRef.current) setThresholds(rows)
    } catch (error) {
      if (request === requestRef.current) setThresholdError(error.message || 'Unable to load thresholds.')
    } finally {
      if (request === requestRef.current) setThresholdLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return loadThresholds() })
    return () => {
      active = false
      requestRef.current += 1
    }
  }, [loadThresholds])

  function selectTab(id) {
    if (id === activeTab) return
    requestRef.current += 1
    setThresholdLoading(true)
    setThresholdError('')
    setActiveTab(id)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Threshold Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Configure crowd and waste alert levels for each ecological location.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm" aria-label="Threshold categories">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = activeTab === id
          return (
            <button key={id} type="button" onClick={() => selectTab(id)} aria-current={selected ? 'page' : undefined} className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${selected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Icon size={16} />{label}
            </button>
          )
        })}
      </nav>

      {thresholdLoading ? (
        <LoadingScreen tone="blue" label={`Loading ${activeTab} thresholds...`} />
      ) : thresholdError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{thresholdError}</p>
          <button type="button" onClick={loadThresholds} className="mt-2 font-semibold underline">Retry</button>
        </div>
      ) : activeTab === 'crowd' ? (
        <CrowdThresholds locations={locations} metrics={metrics} {...sharedProps} thresholds={thresholds} embedded />
      ) : (
        <WasteThresholds locations={locations} metrics={metrics} thresholds={thresholds} loading={false} onThresholdSaved={loadThresholds} />
      )}
    </div>
  )
}
