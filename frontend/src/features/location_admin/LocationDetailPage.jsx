import CrowdThresholds from '../super_admin/CrowdThresholds'
import EcologicalLocations from '../super_admin/EcologicalLocations'

export default function LocationDetailPage(props) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Location Detail</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your assigned ecological location and manage its crowd warning levels.
        </p>
      </header>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Managed location</h2>
          <p className="mt-1 text-sm text-slate-500">
            Location information shared with the Tourist map.
          </p>
        </div>
        <EcologicalLocations {...props} embedded showFilters={false} />
      </section>

      <section className="border-t border-slate-200 pt-8">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Crowd thresholds</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor occupancy and configure caution, warning, and critical levels.
          </p>
        </div>
        <CrowdThresholds {...props} embedded showFilters={false} showSummary={false} />
      </section>
    </div>
  )
}
