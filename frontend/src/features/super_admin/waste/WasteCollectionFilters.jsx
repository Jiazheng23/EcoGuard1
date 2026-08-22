import { FilterX } from 'lucide-react'
import { WASTE_COLLECTION_SOURCES, WASTE_COLLECTION_STATUSES, WASTE_TYPES } from '../../../utils/wasteValidation'
import { DEFAULT_WASTE_COLLECTION_FILTERS } from '../../../utils/wasteAnalytics'

export default function WasteCollectionFilters({ filters, onChange }) {
  const filtersActive = Object.entries(filters).some(([key, value]) => value !== DEFAULT_WASTE_COLLECTION_FILTERS[key])

  function updateFilter(event) {
    const { name, value } = event.target
    onChange({ ...filters, [name]: value })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <FilterField label="From"><input name="from" type="date" value={filters.from} onChange={updateFilter} className={filterClass()} /></FilterField>
      <FilterField label="To"><input name="to" type="date" value={filters.to} onChange={updateFilter} className={filterClass()} /></FilterField>
      <FilterField label="Waste type"><select name="wasteType" value={filters.wasteType} onChange={updateFilter} className={filterClass()}><option value="all">All types</option>{WASTE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></FilterField>
      <FilterField label="Source"><select name="source" value={filters.source} onChange={updateFilter} className={filterClass()}><option value="all">All sources</option>{WASTE_COLLECTION_SOURCES.map((source) => <option key={source} value={source}>{source === 'simulated_sensor' ? 'Simulated sensor' : 'Manual'}</option>)}</select></FilterField>
      <FilterField label="Status"><select name="status" value={filters.status} onChange={updateFilter} className={filterClass()}><option value="all">All statuses</option>{WASTE_COLLECTION_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></FilterField>
      <div className="flex items-end"><button type="button" onClick={() => onChange({ ...DEFAULT_WASTE_COLLECTION_FILTERS })} disabled={!filtersActive} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 disabled:opacity-40"><FilterX size={14} />Clear filters</button></div>
    </div>
  )
}

function FilterField({ label, children }) {
  return <label className="block text-[11px] font-semibold text-slate-500"><span>{label}</span><span className="mt-1 block">{children}</span></label>
}

function filterClass() {
  return 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 outline-none focus:border-blue-500'
}

function titleCase(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
