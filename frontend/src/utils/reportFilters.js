export const environmentalDefaults = Object.freeze({ query: '', location: 'all', dateRange: '30' })
export const travelDefaults = Object.freeze({ query: '', transport: 'all', dateRange: '30' })

export function sensorValue(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function averageReadings(values) {
  const valid = values.map(sensorValue).filter((value) => value !== null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

export function formatReading(value, digits = 0, unit = '') {
  const parsed = sensorValue(value)
  return parsed === null ? 'No data' : `${parsed.toFixed(digits)}${unit}`
}

export function crowdOccupancy(row) {
  return sensorValue(row.current_value) === null ? 'Not recorded' : `${row.current_value}${row.unit || ''}`
}

function matchesDate(value, range, now) {
  return range === 'all' || new Date(value).getTime() >= now - Number(range) * 86400000
}

function matchesSearch(values, query) {
  const needle = query.trim().toLowerCase()
  return !needle || values.some((value) => String(value ?? '').toLowerCase().includes(needle))
}

// Inputs are already restricted to the administrator's authorized scope.
export function filterEnvironmentalReports(locations, metrics, filters, now = Date.now()) {
  const selected = locations.filter((location) => (
    (filters.location === 'all' || String(location.id) === filters.location)
    && matchesSearch([location.name, location.state], filters.query)
  ))
  const ids = new Set(selected.map((location) => String(location.id)))
  return {
    locations: selected,
    metrics: metrics.filter((row) => ids.has(String(row.location_id)) && matchesDate(row.recorded_at, filters.dateRange, now)),
  }
}

export function filterTravelReports(trips, filters, now = Date.now()) {
  return trips.filter((trip) => matchesDate(trip.travelled_at, filters.dateRange, now)
    && (filters.transport === 'all' || trip.transport_mode === filters.transport)
    && matchesSearch([trip.starting_location, trip.destination], filters.query))
}

export function reportScope(filters, locationScope) {
  return `${locationScope}; ${filters.dateRange === 'all' ? 'all dates' : `last ${filters.dateRange} days`}; search: ${filters.query.trim() || 'none'}${'transport' in filters ? `; transport: ${filters.transport}` : ''}`
}

export function reportCsvCell(value) {
  const raw = String(value ?? '')
  const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}
