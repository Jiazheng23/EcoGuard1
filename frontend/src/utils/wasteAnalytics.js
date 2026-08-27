export const DEFAULT_WASTE_COLLECTION_FILTERS = Object.freeze({
  from: '',
  to: '',
  wasteType: 'all',
  source: 'all',
  status: 'all',
})

export function filterWasteCollections(collections = [], filters = DEFAULT_WASTE_COLLECTION_FILTERS) {
  const from = filters.from ? startOfLocalDay(filters.from) : null
  const to = filters.to ? endOfLocalDay(filters.to) : null

  return collections.filter((record) => {
    const collectedAt = new Date(record.collected_at)
    if (Number.isNaN(collectedAt.getTime())) return false
    if (from && collectedAt < from) return false
    if (to && collectedAt > to) return false
    if (filters.wasteType && filters.wasteType !== 'all' && record.waste_type !== filters.wasteType) return false
    if (filters.source && filters.source !== 'all' && record.source !== filters.source) return false
    if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false
    return true
  })
}

export function summarizeWasteCollections(collections = []) {
  const totals = collections.reduce((summary, item) => {
    const total = positiveNumber(item.total_kg)
    const recycled = Math.min(total, positiveNumber(item.recycled_kg))
    summary.totalKg += total
    summary.recycledKg += recycled
    summary.landfillKg += Math.max(0, Number(item.landfill_kg) || total - recycled)
    if (item.status === 'completed') summary.completedCount += 1
    if (item.status === 'partial') summary.partialCount += 1
    if (item.status === 'missed') summary.missedCount += 1
    if (item.source === 'simulated_sensor') summary.simulatedCount += 1
    if (item.source === 'manual') summary.manualCount += 1
    return summary
  }, {
    totalKg: 0,
    recycledKg: 0,
    landfillKg: 0,
    completedCount: 0,
    partialCount: 0,
    missedCount: 0,
    simulatedCount: 0,
    manualCount: 0,
  })

  const successfulCount = totals.completedCount + totals.partialCount
  const trend = getWasteTrendSeries(collections)
  const peak = trend.reduce((current, item) => !current || item.totalKg > current.totalKg ? item : current, null)

  return {
    ...totals,
    successfulCount,
    recordCount: collections.length,
    recyclingRate: totals.totalKg > 0 ? (totals.recycledKg / totals.totalKg) * 100 : 0,
    averageKg: successfulCount > 0 ? totals.totalKg / successfulCount : 0,
    hasTrend: successfulCount >= 2,
    peakPeriod: peak?.label || null,
    peakKg: peak?.totalKg || 0,
  }
}

export function getWasteTrendSeries(collections = []) {
  const grouped = new Map()

  collections.forEach((item) => {
    const date = new Date(item.collected_at)
    if (Number.isNaN(date.getTime())) return
    const key = localDateKey(date)
    const current = grouped.get(key) || {
      key,
      label: new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short' }).format(date),
      fullLabel: new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(date),
      totalKg: 0,
      recycledKg: 0,
      landfillKg: 0,
      records: 0,
    }
    const total = positiveNumber(item.total_kg)
    const recycled = Math.min(total, positiveNumber(item.recycled_kg))
    current.totalKg += total
    current.recycledKg += recycled
    current.landfillKg += Math.max(0, Number(item.landfill_kg) || total - recycled)
    current.records += 1
    grouped.set(key, current)
  })

  return [...grouped.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(roundSeriesValues)
}

export function getWasteTypeSeries(collections = []) {
  const grouped = new Map()
  collections.forEach((item) => {
    grouped.set(item.waste_type, (grouped.get(item.waste_type) || 0) + positiveNumber(item.total_kg))
  })
  return [...grouped.entries()]
    .map(([type, totalKg]) => ({ type, label: titleCase(type), totalKg: round(totalKg) }))
    .sort((left, right) => right.totalKg - left.totalKg)
}

export function getWasteSourceSeries(collections = []) {
  return [
    { source: 'manual', label: 'Manual', count: collections.filter((item) => item.source === 'manual').length, color: '#64748b' },
    { source: 'simulated_sensor', label: 'Automated sensor', count: collections.filter((item) => item.source === 'simulated_sensor').length, color: '#8b5cf6' },
  ].filter((item) => item.count > 0)
}

export function wasteFilterDescription(filters = DEFAULT_WASTE_COLLECTION_FILTERS) {
  const parts = []
  if (filters.from) parts.push(`from ${filters.from}`)
  if (filters.to) parts.push(`to ${filters.to}`)
  if (filters.wasteType && filters.wasteType !== 'all') parts.push(`${titleCase(filters.wasteType)} waste`)
  if (filters.source && filters.source !== 'all') parts.push(filters.source === 'simulated_sensor' ? 'automated sensor source' : 'manual source')
  if (filters.status && filters.status !== 'all') parts.push(`${titleCase(filters.status)} status`)
  return parts.length ? parts.join(', ') : 'All available collection records'
}

function startOfLocalDay(value) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfLocalDay(value) {
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function positiveNumber(value) {
  return Math.max(0, Number(value) || 0)
}

function round(value) {
  return Number(value.toFixed(2))
}

function roundSeriesValues(item) {
  return {
    ...item,
    totalKg: round(item.totalKg),
    recycledKg: round(item.recycledKg),
    landfillKg: round(item.landfillKg),
  }
}

function titleCase(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
