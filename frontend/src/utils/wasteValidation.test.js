import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isWasteScheduleConflict,
  validateWasteCollection,
  validateWasteThresholds,
  wasteLevelFor,
} from './wasteValidation.js'

test('rejects future collection timestamps and invalid missed quantities', () => {
  const errors = validateWasteCollection({
    location_id: 1,
    collected_at: new Date(Date.now() + 60_000).toISOString(),
    total_kg: 3,
    recycled_kg: 1,
    waste_type: 'mixed',
    status: 'missed',
    source: 'manual',
  })
  assert.equal(errors.collected_at, 'Collection time cannot be in the future.')
  assert.match(errors.total_kg, /zero collected quantities/)
})

test('detects active overlaps only within the same location', () => {
  const schedules = [{ id: 1, location_id: 1, scheduled_for: '2030-01-01T10:00:00Z', scheduled_until: '2030-01-01T12:00:00Z', status: 'scheduled' }]
  assert.equal(isWasteScheduleConflict({ location_id: 1, scheduled_for: '2030-01-01T11:00:00Z', scheduled_until: '2030-01-01T13:00:00Z', status: 'scheduled' }, schedules), true)
  assert.equal(isWasteScheduleConflict({ location_id: 2, scheduled_for: '2030-01-01T11:00:00Z', scheduled_until: '2030-01-01T13:00:00Z', status: 'scheduled' }, schedules), false)
})

test('validates ordered thresholds and maps configured warning levels', () => {
  assert.ok(validateWasteThresholds({ location_id: 1, moderate_kg: 50, high_risk_kg: 40, critical_kg: 75 }).high_risk_kg)
  assert.equal(wasteLevelFor(80, { moderate_kg: 25, high_risk_kg: 50, critical_kg: 75 }).key, 'critical')
})
