import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isWasteScheduleConflict,
  normalizeWasteCollection,
  normalizeWasteSchedule,
  validateWasteCollection,
  validateWasteThresholds,
  wasteLevelFor,
  WASTE_COLLECTION_STATUSES,
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

const validCollection = {
  location_id: 1, collected_at: '2000-01-01T12:00:00Z', total_kg: 12,
  recycled_kg: 4, waste_type: 'mixed', status: 'completed', source: 'manual', notes: '',
}

test('new collection and filter status choices exclude partial', () => {
  assert.deepEqual(WASTE_COLLECTION_STATUSES, ['completed', 'missed'])
  assert.ok(validateWasteCollection({ ...validCollection, status: 'partial' }).status)
  assert.deepEqual(validateWasteCollection(validCollection), {})
  assert.deepEqual(validateWasteCollection({ ...validCollection, status: 'missed', total_kg: 0, recycled_kg: 0, notes: 'Vehicle unavailable' }), {})
})

test('missed attempts require a meaningful reason and zero quantities', () => {
  const missed = { ...validCollection, status: 'missed', total_kg: 0, recycled_kg: 0, notes: '  ' }
  assert.match(validateWasteCollection(missed).notes, /reason/)
  assert.deepEqual(validateWasteCollection({ ...missed, notes: 'Collection vehicle unavailable' }), {})
  assert.match(validateWasteCollection({ ...validCollection, notes: 'a'.repeat(1001) }).notes, /1,000/)
})

test('missed collection time cannot precede the end of its schedule', () => {
  const missed = { ...validCollection, status: 'missed', total_kg: 0, recycled_kg: 0, notes: 'Vehicle unavailable' }
  assert.match(validateWasteCollection(missed, { schedule: { scheduled_until: '2000-01-01T12:00:01Z' } }).collected_at, /window ends/)
  assert.deepEqual(validateWasteCollection(missed, { schedule: { scheduled_until: '2000-01-01T12:00:00Z' } }), {})
})

test('alert-linked collection time cannot precede its alert', () => {
  assert.match(validateWasteCollection(validCollection, { alert: { created_at: '2000-01-01T12:01:00Z' } }).collected_at, /linked alert/)
  assert.deepEqual(validateWasteCollection(validCollection, { alert: { created_at: '2000-01-01T12:00:00Z' } }), {})
})

test('normalization persists a supplied alert link without inventing links for existing records', () => {
  assert.equal(normalizeWasteCollection({ ...validCollection, alert_id: '17' }).alert_id, 17)
  assert.equal(Object.hasOwn(normalizeWasteCollection(validCollection), 'alert_id'), false)
  const values = { location_id: 1, scheduled_for: '2030-01-01T10:00:00Z', scheduled_until: '2030-01-01T11:00:00Z', waste_type: 'mixed', assigned_team: ' Team A ' }
  assert.equal(normalizeWasteSchedule({ ...values, alert_id: '17' }).alert_id, 17)
  assert.equal(Object.hasOwn(normalizeWasteSchedule(values), 'alert_id'), false)
})
