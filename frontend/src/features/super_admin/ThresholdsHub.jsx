import { useCallback, useEffect, useState } from 'react'
import { Recycle, Users } from 'lucide-react'
import { listWasteThresholds } from '../../services/wasteService'
import CrowdThresholds from './CrowdThresholds'
import WasteThresholds from './WasteThresholds'

const tabs = [
  { id: 'crowd', label: 'Crowd Thresholds', icon: Users },
  { id: 'waste', label: 'Waste Thresholds', icon: Recycle },
]

export default function ThresholdsHub({ locations = [], metrics = [], ...sharedProps }) {
  const [activeTab, setActiveTab] = useState('crowd')
  const [wasteThresholds, setWasteThresholds] = useState([])
  const [wasteLoading, setWasteLoading] = useState(false)
  const [wasteError, setWasteError] = useState('')

  const loadWasteThresholds = useCallback(async () => {
    setWasteLoading(true)
    setWasteError('')
    try {
      setWasteThresholds(await listWasteThresholds())
    } catch (error) {
      setWasteError(error.message || 'Unable to load waste thresholds.')
    } finally {
      setWasteLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    listWasteThresholds()
      .then((rows) => {
        if (active) setWasteThresholds(rows)
      })
      .catch((error) => {
        if (active) setWasteError(error.message || 'Unable to load waste thresholds.')
      })
      .finally(() => {
        if (active) setWasteLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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
            <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={selected ? 'page' : undefined} className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${selected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Icon size={16} />{label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'crowd' ? (
        <CrowdThresholds locations={locations} metrics={metrics} {...sharedProps} embedded />
      ) : (
        <WasteThresholds locations={locations} metrics={metrics} thresholds={wasteThresholds} loading={wasteLoading} error={wasteError} onThresholdSaved={loadWasteThresholds} />
      )}
    </div>
  )
}
