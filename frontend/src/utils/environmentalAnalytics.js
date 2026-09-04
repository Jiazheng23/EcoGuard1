function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

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
