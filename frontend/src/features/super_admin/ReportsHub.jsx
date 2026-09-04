import { Leaf, Recycle } from 'lucide-react'
import Reports from './Reports'
import WasteManagement from './WasteManagement'

const tabs = [
  { id: 'environment', label: 'Environmental & Travel', icon: Leaf },
  { id: 'waste', label: 'Waste Collections', icon: Recycle },
]

export default function ReportsHub({ activeTab, onTabChange, ...sharedProps }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Review environmental, travel, and waste collection performance in one place.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm" aria-label="Report categories">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={selected ? 'page' : undefined}
              className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${selected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <Icon size={16} />{label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'waste' ? (
        <WasteManagement {...sharedProps} section="analytics" embedded />
      ) : (
        <Reports {...sharedProps} embedded />
      )}
    </div>
  )
}
