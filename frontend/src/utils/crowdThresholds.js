export const crowdLevels = {
  optimal: { label: 'Low', color: '#16a34a', background: '#f0fdf4' },
  caution: { label: 'Moderate', color: '#b45309', background: '#fffbeb' },
  warning: { label: 'High', color: '#ea580c', background: '#fff7ed' },
  critical: { label: 'Critical', color: '#dc2626', background: '#fef2f2' },
}

export function crowdLevel(visitors, capacity, threshold) {
  if (visitors == null || !(Number(capacity) > 0)) return null
  const occupancy = Number(visitors) / Number(capacity) * 100
  if (occupancy >= Number(threshold.critical_percent)) return 'critical'
  if (occupancy >= Number(threshold.warning_percent)) return 'warning'
  if (occupancy >= Number(threshold.caution_percent)) return 'caution'
  return 'optimal'
}

export function crowdRanges(capacity, threshold) {
  if (!(Number(capacity) > 0)) return ['—', '—', '—', '—']
  const boundaries = ['caution_percent', 'warning_percent', 'critical_percent'].map((key) => Math.ceil(Number(capacity) * Number(threshold[key]) / 100))
  const range = (start, end) => start <= end ? `${start.toLocaleString()}–${end.toLocaleString()}` : '—'
  return [range(0, boundaries[0] - 1), range(boundaries[0], boundaries[1] - 1), range(boundaries[1], boundaries[2] - 1), `≥ ${boundaries[2].toLocaleString()}`]
}

export function filterCrowdHistory(records, accessibleIds, { location = 'all', level = 'all', status = 'all' } = {}) {
  const allowed = new Set(accessibleIds.map(String))
  return records.filter((row) => row.category === 'crowd' && allowed.has(String(row.location_id))
    && (location === 'all' || String(row.location_id) === String(location))
    && (level === 'all' || row.severity === level)
    && (status === 'all' || (row.resolved_at ? 'resolved' : 'unresolved') === status))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }))
}
