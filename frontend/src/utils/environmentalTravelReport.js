import { getDestinationSeries } from './tripAnalytics.js'

// Report-only grouping: retain saved names, merging only case/spacing variants.
// Similar spellings and different names remain separate without verified evidence.
export function getRecordedDestinationSeries(trips) {
  const names = new Map()
  const normalized = trips.map((trip) => {
    const name = String(trip.destination || '').trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    if (!names.has(key)) names.set(key, name)
    return { ...trip, destination: names.get(key) }
  })
  return getDestinationSeries(normalized)
}
