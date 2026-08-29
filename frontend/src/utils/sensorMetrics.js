export function sensorReadingSummary(location, reading) {
  const capacity = Math.max(1, numericValue(location?.max_capacity, 1))
  const visitors = Math.max(0, numericValue(reading?.crowd_count))
  const waste = Math.max(0, numericValue(reading?.waste_kg))
  const recyclable = Math.max(0, numericValue(reading?.recycled_kg))

  return {
    capacity,
    visitors,
    occupancyPercent: (visitors / capacity) * 100,
    waste,
    recyclable,
    recyclablePercent: waste > 0 ? (recyclable / waste) * 100 : 0,
    airQualityIndex: Math.max(0, numericValue(reading?.air_quality_index)),
    waterQualityScore: Math.max(0, numericValue(reading?.water_quality_score)),
    temperatureC: reading?.temperature_c == null
      ? null
      : numericValue(reading.temperature_c),
    recordedAt: reading?.recorded_at || null,
  }
}

export function airQualityLabel(value) {
  const aqi = numericValue(value)
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for sensitive groups'
  return 'Unhealthy'
}

export function waterQualityLabel(value) {
  const score = numericValue(value)
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Moderate'
  return 'Needs attention'
}

function numericValue(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
