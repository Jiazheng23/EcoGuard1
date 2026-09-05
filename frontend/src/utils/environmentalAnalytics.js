function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const HOUR_MS = 60 * 60 * 1000
const WEEK_MS = 7 * 24 * HOUR_MS

function bucketFor(value, granularity) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  let bucketDate
  let format
  if (granularity === 'month') {
    bucketDate = new Date(date.getFullYear(), date.getMonth(), 1)
    format = { month: 'short', year: '2-digit' }
  } else if (granularity === 'week') {
    bucketDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const day = bucketDate.getDay() || 7
    bucketDate.setDate(bucketDate.getDate() - day + 1)
    format = { day: '2-digit', month: 'short' }
  } else if (granularity === 'hour') {
    bucketDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours())
    format = { hour: '2-digit', minute: '2-digit' }
  } else {
    bucketDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    format = { day: '2-digit', month: 'short' }
  }

  return {
    key: bucketDate.toISOString(),
    timestamp: bucketDate.getTime(),
    label: new Intl.DateTimeFormat('en-MY', format).format(bucketDate),
  }
}

function metricBuckets(metrics, requestedGranularity) {
  const timestamps = (metrics || [])
    .map((metric) => new Date(metric.recorded_at).getTime())
    .filter(Number.isFinite)
  const spanDays = timestamps.length > 1
    ? (Math.max(...timestamps) - Math.min(...timestamps)) / (24 * 60 * 60 * 1000)
    : 0
  const validRequestedGranularity = ['hour', 'day', 'week', 'month'].includes(requestedGranularity)
    ? requestedGranularity
    : null
  const granularity = validRequestedGranularity || (spanDays <= 2 ? 'hour'
    : spanDays <= 45 ? 'day'
      : spanDays <= 180 ? 'week'
        : 'month')
  const buckets = new Map()
  for (const metric of metrics || []) {
    const bucket = bucketFor(metric.recorded_at, granularity)
    if (!bucket) continue
    if (!buckets.has(bucket.key)) buckets.set(bucket.key, { ...bucket, rows: [] })
    buckets.get(bucket.key).rows.push(metric)
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export function buildVisitorDensitySeries(metrics = [], locations = [], granularity) {
  const capacityByLocation = Object.fromEntries(
    locations.map((location) => [String(location.id), Math.max(1, numberValue(location.max_capacity))]),
  )

  return metricBuckets(metrics, granularity).map((bucket) => {
    const locationReadings = new Map()
    for (const row of bucket.rows) {
      const id = String(row.location_id)
      const current = locationReadings.get(id)
      const currentTime = new Date(current?.recorded_at || 0).getTime()
      const candidateTime = new Date(row.recorded_at || 0).getTime()
      if (!current || candidateTime >= currentTime) locationReadings.set(id, row)
    }

    let visitors = 0
    let capacity = 0
    for (const [locationId, reading] of locationReadings) {
      visitors += numberValue(reading.crowd_count)
      capacity += capacityByLocation[locationId] || 1
    }

    return {
      period: bucket.label,
      timestamp: bucket.timestamp,
      visitors: Math.round(visitors),
      occupancy: Number((capacity ? visitors / capacity * 100 : 0).toFixed(1)),
      locationCount: locationReadings.size,
      readingCount: bucket.rows.length,
    }
  })
}

export function buildLocationDensity(metrics = [], locations = []) {
  const latest = new Map()
  for (const metric of metrics) {
    const id = String(metric.location_id)
    const currentTime = new Date(latest.get(id)?.recorded_at || 0).getTime()
    const candidateTime = new Date(metric.recorded_at || 0).getTime()
    if (!latest.has(id) || candidateTime >= currentTime) latest.set(id, metric)
  }

  return locations.map((location) => {
    const metric = latest.get(String(location.id))
    const visitors = numberValue(metric?.crowd_count)
    const capacity = Math.max(1, numberValue(location.max_capacity))
    return {
      name: location.name,
      visitors: Math.round(visitors),
      occupancy: Number((visitors / capacity * 100).toFixed(1)),
      recordedAt: metric?.recorded_at || null,
      hasReading: Boolean(metric),
    }
  }).filter((item) => item.hasReading).sort((a, b) => b.visitors - a.visitors)
}

export function buildCrowdPrediction(metrics = [], locations = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  const nowTime = Number.isNaN(now.getTime()) ? Date.now() : now.getTime()
  const horizonHours = Math.min(24, Math.max(1, Math.round(Number(options.horizonHours) || 12)))
  const maxSamples = Math.min(24, Math.max(2, Math.round(Number(options.maxSamples) || 12)))
  const capacityByLocation = new Map(locations.map((location) => [
    String(location.id),
    Math.max(1, numberValue(location.max_capacity)),
  ]))
  const locationById = new Map(locations.map((location) => [String(location.id), location]))
  const eligibleRows = metrics.filter((metric) => {
    const recordedAt = new Date(metric.recorded_at).getTime()
    return capacityByLocation.has(String(metric.location_id))
      && Number.isFinite(recordedAt)
      && recordedAt < nowTime
      && Number.isFinite(Number(metric.crowd_count))
  })
  const observationsByLocation = hourlyCrowdObservations(eligibleRows, capacityByLocation)
  const hourlyObservationCount = [...observationsByLocation.values()]
    .reduce((total, observations) => total + observations.length, 0)
  const predictableLocations = locations.filter((location) => (
    (observationsByLocation.get(String(location.id)) || []).length >= 2
  ))

  if (!predictableLocations.length) {
    return {
      available: false,
      reason: 'At least two historical hourly observations are required for one location.',
      points: [],
      rawReadingCount: eligibleRows.length,
      hourlyObservationCount,
      locationCount: locations.length,
      locationsCovered: 0,
      backtestCount: 0,
      mae: null,
      maePercentCapacity: null,
      confidence: 'Insufficient data',
    }
  }

  const backtest = backtestCrowdModel(observationsByLocation, capacityByLocation, maxSamples)
  const firstTarget = new Date(nowTime)
  firstTarget.setMinutes(0, 0, 0)
  firstTarget.setHours(firstTarget.getHours() + 1)

  const points = Array.from({ length: horizonHours }, (_, index) => {
    const target = new Date(firstTarget.getTime() + index * HOUR_MS)
    const evidence = predictableLocations.map((location) => {
      const locationId = String(location.id)
      const prediction = predictCrowdForSlot(
        observationsByLocation.get(locationId) || [],
        target,
        capacityByLocation.get(locationId),
        maxSamples,
      )
      const backtestMae = backtest.perLocationMae.get(locationId) || 0
      const uncertainty = Math.max(1, prediction.spread, backtestMae)
      return {
        locationId,
        locationName: locationById.get(locationId)?.name || 'Location',
        ...prediction,
        lower: Math.max(0, prediction.predicted - uncertainty),
        upper: Math.min(capacityByLocation.get(locationId), prediction.predicted + uncertainty),
      }
    })
    const capacity = evidence.reduce((sum, item) => sum + capacityByLocation.get(item.locationId), 0)
    const predicted = evidence.reduce((sum, item) => sum + item.predicted, 0)
    const lower = evidence.reduce((sum, item) => sum + item.lower, 0)
    const upper = evidence.reduce((sum, item) => sum + item.upper, 0)
    const basisTypes = new Set(evidence.map((item) => item.basis))

    return {
      timestamp: target.getTime(),
      label: new Intl.DateTimeFormat('en-MY', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(target),
      fullLabel: new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(target),
      predicted: Math.round(predicted),
      lower: Math.round(lower),
      upper: Math.round(upper),
      occupancy: Number((capacity ? predicted / capacity * 100 : 0).toFixed(1)),
      capacity,
      sampleCount: evidence.reduce((sum, item) => sum + item.sampleCount, 0),
      basis: basisTypes.size === 1 ? evidence[0].basis : 'Mixed historical matches',
      evidence,
    }
  })

  const allObservations = [...observationsByLocation.values()].flat()
  const averageMatches = points.length
    ? points.reduce((sum, point) => sum + point.sampleCount / predictableLocations.length, 0) / points.length
    : 0
  const coverage = predictableLocations.length / Math.max(1, locations.length)
  const confidence = crowdPredictionConfidence({
    averageMatches,
    backtestCount: backtest.count,
    coverage,
    maePercentCapacity: backtest.maePercentCapacity,
  })

  return {
    available: true,
    points,
    rawReadingCount: eligibleRows.length,
    hourlyObservationCount,
    locationCount: locations.length,
    locationsCovered: predictableLocations.length,
    averageMatches: Number(averageMatches.toFixed(1)),
    historyStart: allObservations.length ? new Date(Math.min(...allObservations.map((item) => item.timestamp))).toISOString() : null,
    historyEnd: allObservations.length ? new Date(Math.max(...allObservations.map((item) => item.timestamp))).toISOString() : null,
    backtestCount: backtest.count,
    mae: backtest.mae == null ? null : Number(backtest.mae.toFixed(1)),
    maePercentCapacity: backtest.maePercentCapacity == null ? null : Number(backtest.maePercentCapacity.toFixed(1)),
    confidence,
    method: 'Recency-weighted average of historical hourly crowd counts. Same weekday and hour are preferred; same-hour or recent observations are used when exact matches are limited.',
  }
}

function hourlyCrowdObservations(metrics, capacityByLocation) {
  const buckets = new Map()
  metrics.forEach((metric) => {
    const date = new Date(metric.recorded_at)
    const locationId = String(metric.location_id)
    const hour = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime()
    const key = `${locationId}:${hour}`
    const bucket = buckets.get(key) || { locationId, timestamp: hour, total: 0, count: 0 }
    const capacity = capacityByLocation.get(locationId)
    bucket.total += Math.min(capacity, Math.max(0, numberValue(metric.crowd_count)))
    bucket.count += 1
    buckets.set(key, bucket)
  })

  const grouped = new Map()
  buckets.forEach((bucket) => {
    if (!grouped.has(bucket.locationId)) grouped.set(bucket.locationId, [])
    grouped.get(bucket.locationId).push({
      timestamp: bucket.timestamp,
      crowd: bucket.total / bucket.count,
      readingCount: bucket.count,
    })
  })
  grouped.forEach((observations) => observations.sort((left, right) => left.timestamp - right.timestamp))
  return grouped
}

function predictCrowdForSlot(observations, target, capacity, maxSamples) {
  const previous = observations.filter((item) => item.timestamp < target.getTime())
  const exact = previous.filter((item) => {
    const date = new Date(item.timestamp)
    return date.getDay() === target.getDay() && date.getHours() === target.getHours()
  })
  const sameHour = previous.filter((item) => new Date(item.timestamp).getHours() === target.getHours())
  const candidates = (exact.length >= 2 ? exact : sameHour.length >= 2 ? sameHour : previous)
    .slice(-maxSamples)
  const basis = exact.length >= 2 ? 'Same weekday + hour'
    : sameHour.length >= 2 ? 'Same hour across days'
      : 'Recent hourly observations'
  const weighted = candidates.map((item) => ({
    ...item,
    weight: 1 / (1 + Math.max(0, target.getTime() - item.timestamp) / WEEK_MS),
  }))
  const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0) || 1
  const weightedSum = weighted.reduce((sum, item) => sum + item.crowd * item.weight, 0)
  const predicted = Math.min(capacity, Math.max(0, weightedSum / weightTotal))
  const variance = weighted.reduce((sum, item) => sum + item.weight * ((item.crowd - predicted) ** 2), 0) / weightTotal

  return {
    predicted,
    spread: Math.sqrt(Math.max(0, variance)),
    sampleCount: candidates.length,
    readingCount: candidates.reduce((sum, item) => sum + item.readingCount, 0),
    weightedSum: Number(weightedSum.toFixed(2)),
    weightTotal: Number(weightTotal.toFixed(3)),
    basis,
  }
}

function backtestCrowdModel(observationsByLocation, capacityByLocation, maxSamples) {
  const errors = []
  const normalizedErrors = []
  const errorsByLocation = new Map()

  observationsByLocation.forEach((observations, locationId) => {
    observations.slice(-96).forEach((actual) => {
      const previous = observations.filter((item) => item.timestamp < actual.timestamp)
      if (previous.length < 2) return
      const forecast = predictCrowdForSlot(previous, new Date(actual.timestamp), capacityByLocation.get(locationId), maxSamples)
      const error = Math.abs(actual.crowd - forecast.predicted)
      errors.push(error)
      normalizedErrors.push(error / capacityByLocation.get(locationId) * 100)
      if (!errorsByLocation.has(locationId)) errorsByLocation.set(locationId, [])
      errorsByLocation.get(locationId).push(error)
    })
  })

  return {
    count: errors.length,
    mae: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    maePercentCapacity: normalizedErrors.length
      ? normalizedErrors.reduce((sum, value) => sum + value, 0) / normalizedErrors.length
      : null,
    perLocationMae: new Map([...errorsByLocation.entries()].map(([locationId, values]) => [
      locationId,
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ])),
  }
}

function crowdPredictionConfidence({ averageMatches, backtestCount, coverage, maePercentCapacity }) {
  if (coverage === 1 && averageMatches >= 4 && backtestCount >= 20 && maePercentCapacity != null && maePercentCapacity <= 10) return 'High'
  if (coverage >= 0.75 && averageMatches >= 2 && backtestCount >= 6 && maePercentCapacity != null && maePercentCapacity <= 20) return 'Medium'
  return 'Low'
}

export function buildEnvironmentalTrend(metrics = [], granularity) {
  return metricBuckets(metrics, granularity).map((bucket) => {
    const count = bucket.rows.length || 1
    return {
      period: bucket.label,
      timestamp: bucket.timestamp,
      aqi: Number((bucket.rows.reduce((sum, row) => sum + numberValue(row.air_quality_index), 0) / count).toFixed(1)),
      water: Number((bucket.rows.reduce((sum, row) => sum + numberValue(row.water_quality_score), 0) / count).toFixed(1)),
      temperature: Number((bucket.rows.reduce((sum, row) => sum + numberValue(row.temperature_c), 0) / count).toFixed(1)),
    }
  })
}

export function getEnvironmentalSummary(metrics = [], visitorDensity = []) {
  const count = metrics.length || 1
  return {
    averageVisitors: metrics.reduce((sum, row) => sum + numberValue(row.crowd_count), 0) / count,
    averageOccupancy: visitorDensity.length
      ? visitorDensity.reduce((sum, row) => sum + row.occupancy, 0) / visitorDensity.length
      : 0,
    averageAqi: metrics.reduce((sum, row) => sum + numberValue(row.air_quality_index), 0) / count,
    averageWater: metrics.reduce((sum, row) => sum + numberValue(row.water_quality_score), 0) / count,
    averageTemperature: metrics.reduce((sum, row) => sum + numberValue(row.temperature_c), 0) / count,
    peakPeriod: visitorDensity.reduce(
      (peak, row) => !peak || row.visitors > peak.visitors ? row : peak,
      null,
    ),
  }
}

export function buildCurrentEnvironmentalWarnings(metrics = [], locations = [], thresholds = []) {
  const latestByLocation = new Map()
  for (const metric of metrics) {
    const id = String(metric.location_id)
    const previousTime = new Date(latestByLocation.get(id)?.recorded_at || 0).getTime()
    const candidateTime = new Date(metric.recorded_at || 0).getTime()
    if (!latestByLocation.has(id) || candidateTime >= previousTime) latestByLocation.set(id, metric)
  }

  const thresholdByLocation = Object.fromEntries(
    thresholds.map((threshold) => [String(threshold.location_id), threshold]),
  )
  const severityRank = { critical: 3, warning: 2, caution: 1 }
  const warnings = []

  for (const location of locations) {
    const metric = latestByLocation.get(String(location.id))
    if (!metric) continue
    const threshold = thresholdByLocation[String(location.id)] || {}
    const capacity = Math.max(1, numberValue(location.max_capacity))
    const occupancy = numberValue(metric.crowd_count) / capacity * 100

    const crowdSeverity = occupancy >= numberValue(threshold.critical_percent || 90) ? 'critical'
      : occupancy >= numberValue(threshold.warning_percent || 80) ? 'warning'
        : occupancy >= numberValue(threshold.caution_percent || 60) ? 'caution'
          : null
    if (crowdSeverity) {
      warnings.push({
        key: `${location.id}-crowd`,
        location: location.name,
        category: 'Crowd',
        severity: crowdSeverity,
        title: `Crowd level at ${location.name}`,
        detail: `${Math.round(metric.crowd_count).toLocaleString()} visitors (${occupancy.toFixed(1)}% of capacity).`,
        recordedAt: metric.recorded_at,
      })
    }

    const aqi = numberValue(metric.air_quality_index)
    const aqiSeverity = aqi >= 200 ? 'critical' : aqi >= 150 ? 'warning' : aqi >= 100 ? 'caution' : null
    if (aqiSeverity) {
      warnings.push({
        key: `${location.id}-aqi`, location: location.name, category: 'Air quality', severity: aqiSeverity,
        title: `Air quality needs attention at ${location.name}`,
        detail: `The latest Air Quality Index is ${Math.round(aqi)}.`, recordedAt: metric.recorded_at,
      })
    }

    const water = numberValue(metric.water_quality_score)
    const waterSeverity = water <= 30 ? 'critical' : water <= 50 ? 'warning' : water <= 65 ? 'caution' : null
    if (waterSeverity) {
      warnings.push({
        key: `${location.id}-water`, location: location.name, category: 'Water quality', severity: waterSeverity,
        title: `Water quality needs attention at ${location.name}`,
        detail: `The latest water-quality score is ${water.toFixed(1)} out of 100.`, recordedAt: metric.recorded_at,
      })
    }

    const temperature = metric.temperature_c == null ? null : numberValue(metric.temperature_c)
    const temperatureSeverity = temperature != null
      ? temperature >= 45 ? 'critical' : temperature >= 40 ? 'warning' : temperature >= 35 ? 'caution' : null
      : null
    if (temperatureSeverity) {
      warnings.push({
        key: `${location.id}-temperature`, location: location.name, category: 'Temperature', severity: temperatureSeverity,
        title: `High temperature at ${location.name}`,
        detail: `The latest temperature is ${temperature.toFixed(1)} °C.`, recordedAt: metric.recorded_at,
      })
    }
  }

  return warnings.sort((a, b) => (
    severityRank[b.severity] - severityRank[a.severity]
    || new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime()
  ))
}
