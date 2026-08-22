export const WASTE_TYPES = ['mixed', 'recyclable', 'organic', 'hazardous']
export const WASTE_SCHEDULE_STATUSES = ['scheduled', 'completed', 'cancelled', 'missed']
export const WASTE_COLLECTION_STATUSES = ['completed', 'partial', 'missed']
export const WASTE_COLLECTION_SOURCES = ['manual', 'simulated_sensor']

export class WasteValidationError extends Error {
  constructor(errors) {
    const firstMessage = Object.values(errors)[0] || 'Waste data is invalid.'
    super(firstMessage)
    this.name = 'WasteValidationError'
    this.errors = errors
  }
}

export function validateWasteSchedule(values, { requireFuture = true } = {}) {
  const errors = {}
  const locationId = Number(values.location_id)
  const start = parseDate(values.scheduled_for)
  const end = parseDate(values.scheduled_until)
  const status = values.status || 'scheduled'

  if (!Number.isInteger(locationId) || locationId < 1) {
    errors.location_id = 'Select a valid ecological location.'
  }
  if (!start) errors.scheduled_for = 'Enter a valid collection start time.'
  if (!end) errors.scheduled_until = 'Enter a valid collection end time.'
  if (start && end && end <= start) {
    errors.scheduled_until = 'The collection end time must be after the start time.'
  }
  if (requireFuture && status === 'scheduled' && start && start <= new Date()) {
    errors.scheduled_for = 'An active collection schedule must start in the future.'
  }
  if (!WASTE_TYPES.includes(values.waste_type)) {
    errors.waste_type = 'Select a supported waste type.'
  }
  if (!WASTE_SCHEDULE_STATUSES.includes(status)) {
    errors.status = 'Select a valid schedule status.'
  }
  if (!values.assigned_team?.trim()) {
    errors.assigned_team = 'Enter the assigned collection team.'
  }

  return errors
}

export function validateWasteCollection(values, { requireLocation = true, requireWasteType = true } = {}) {
  const errors = {}
  const locationId = Number(values.location_id)
  const collectedAt = parseDate(values.collected_at)
  const totalKg = Number(values.total_kg)
  const recycledKg = Number(values.recycled_kg)
  const status = values.status

  if (requireLocation && (!Number.isInteger(locationId) || locationId < 1)) {
    errors.location_id = 'Select a valid ecological location.'
  }
  if (!collectedAt) {
    errors.collected_at = 'Enter a valid collection time.'
  } else if (collectedAt > new Date()) {
    errors.collected_at = 'Collection time cannot be in the future.'
  }
  if (requireWasteType && !WASTE_TYPES.includes(values.waste_type)) {
    errors.waste_type = 'Select a supported waste type.'
  }
  if (!WASTE_COLLECTION_STATUSES.includes(status)) {
    errors.status = 'Select a valid collection status.'
  }
  if (!WASTE_COLLECTION_SOURCES.includes(values.source)) {
    errors.source = 'Select a valid collection data source.'
  }
  if (!Number.isFinite(totalKg) || totalKg < 0) {
    errors.total_kg = 'Total waste must be zero or greater.'
  }
  if (!Number.isFinite(recycledKg) || recycledKg < 0) {
    errors.recycled_kg = 'Recycled waste must be zero or greater.'
  } else if (Number.isFinite(totalKg) && recycledKg > totalKg) {
    errors.recycled_kg = 'Recycled waste cannot exceed total waste.'
  }
  if (status === 'missed' && (totalKg !== 0 || recycledKg !== 0)) {
    errors.total_kg = 'A missed collection must have zero collected quantities.'
  }
  if (['completed', 'partial'].includes(status) && Number.isFinite(totalKg) && totalKg <= 0) {
    errors.total_kg = 'A completed or partial collection must contain more than zero kilograms.'
  }

  return errors
}

export function validateWasteThresholds(values) {
  const errors = {}
  const locationId = Number(values.location_id)
  const moderate = Number(values.moderate_kg)
  const highRisk = Number(values.high_risk_kg)
  const critical = Number(values.critical_kg)

  if (!Number.isInteger(locationId) || locationId < 1) {
    errors.location_id = 'Select a valid ecological location.'
  }
  if (!(moderate > 0)) errors.moderate_kg = 'The Moderate threshold must be greater than zero.'
  if (!(highRisk > moderate)) errors.high_risk_kg = 'High Risk must be greater than Moderate.'
  if (!(critical > highRisk)) errors.critical_kg = 'Critical must be greater than High Risk.'

  return errors
}

export function assertWasteValidation(errors) {
  if (Object.keys(errors).length) throw new WasteValidationError(errors)
}

export function normalizeWasteSchedule(values) {
  return {
    location_id: Number(values.location_id),
    scheduled_for: toIsoString(values.scheduled_for),
    scheduled_until: toIsoString(values.scheduled_until),
    waste_type: values.waste_type,
    assigned_team: values.assigned_team.trim(),
    status: values.status || 'scheduled',
    notes: values.notes?.trim() || null,
  }
}

export function normalizeWasteCollection(values) {
  return {
    schedule_id: values.schedule_id ? Number(values.schedule_id) : null,
    location_id: values.location_id ? Number(values.location_id) : undefined,
    collected_at: toIsoString(values.collected_at),
    total_kg: roundKilograms(values.total_kg),
    recycled_kg: roundKilograms(values.recycled_kg),
    waste_type: values.waste_type,
    status: values.status,
    source: values.source,
    notes: values.notes?.trim() || null,
  }
}

export function normalizeWasteThresholds(values) {
  return {
    location_id: Number(values.location_id),
    moderate_kg: roundKilograms(values.moderate_kg),
    high_risk_kg: roundKilograms(values.high_risk_kg),
    critical_kg: roundKilograms(values.critical_kg),
  }
}

export function isWasteScheduleConflict(candidate, schedules, excludedId = null) {
  if ((candidate.status || 'scheduled') !== 'scheduled') return false
  const start = parseDate(candidate.scheduled_for)
  const end = parseDate(candidate.scheduled_until)
  if (!start || !end) return false

  return schedules.some((schedule) => {
    if (excludedId != null && String(schedule.id) === String(excludedId)) return false
    if (schedule.status !== 'scheduled') return false
    if (String(schedule.location_id) !== String(candidate.location_id)) return false

    const existingStart = parseDate(schedule.scheduled_for)
    const existingEnd = parseDate(schedule.scheduled_until)
    return existingStart && existingEnd && start < existingEnd && existingStart < end
  })
}

export function wasteLevelFor(wasteKg, threshold) {
  const quantity = Math.max(0, Number(wasteKg) || 0)
  if (!threshold) return { key: 'unconfigured', label: 'Threshold not configured', color: '#64748b' }
  if (quantity >= Number(threshold.critical_kg)) return { key: 'critical', label: 'Critical', color: '#dc2626' }
  if (quantity >= Number(threshold.high_risk_kg)) return { key: 'high_risk', label: 'High Risk', color: '#f97316' }
  if (quantity >= Number(threshold.moderate_kg)) return { key: 'moderate', label: 'Moderate', color: '#eab308' }
  return { key: 'normal', label: 'Normal', color: '#22c55e' }
}

function parseDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoString(value) {
  const date = parseDate(value)
  return date ? date.toISOString() : null
}

function roundKilograms(value) {
  return Number(Number(value).toFixed(2))
}
