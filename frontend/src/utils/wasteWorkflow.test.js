import test from 'node:test'
import assert from 'node:assert/strict'
import { filterWasteAlerts, overdueDuration, wasteAlertResponse, wasteScheduleStatus } from './wasteWorkflow.js'

const start = Date.parse('2026-01-01T10:00:00Z')
const end = Date.parse('2026-01-01T11:00:00Z')
const schedule = { id: 1, status: 'scheduled', scheduled_for: new Date(start).toISOString(), scheduled_until: new Date(end).toISOString() }

test('schedule changes from upcoming to due to overdue at the exact boundaries', () => {
  assert.equal(wasteScheduleStatus(schedule, start - 1), 'scheduled')
  assert.equal(wasteScheduleStatus(schedule, start), 'due')
  assert.equal(wasteScheduleStatus(schedule, end - 1), 'due')
  assert.equal(wasteScheduleStatus(schedule, end), 'overdue')
  assert.equal(schedule.status, 'scheduled', 'the derived label must not mutate stored status')
})

test('completed, missed and cancelled schedules never become overdue', () => {
  for (const status of ['completed', 'missed', 'cancelled']) {
    assert.equal(wasteScheduleStatus({ ...schedule, status }, end + 86400000), status)
  }
})

test('overdue durations use minutes, hours and days', () => {
  assert.equal(overdueDuration(schedule, end), '1 min overdue')
  assert.equal(overdueDuration(schedule, end + 59 * 60000), '59 min overdue')
  assert.equal(overdueDuration(schedule, end + 60 * 60000), '1 hr overdue')
  assert.equal(overdueDuration(schedule, end + 1440 * 60000), '1 day(s) overdue')
})

const alerts = [
  { id: 1, category: 'waste', location_id: 10, severity: 'critical', title: 'Waste critical', detail: 'Waste above threshold', created_at: '2026-01-01T10:00:00Z', resolved_at: null },
  { id: 2, category: 'waste', location_id: '10', severity: 'warning', title: 'Waste high', detail: 'Waste above threshold', created_at: '2026-01-01T11:00:00Z', resolved_at: '2026-01-01T12:00:00Z' },
  { id: 3, category: 'waste', location_id: 20, severity: 'critical', title: 'Other location', created_at: '2026-01-01T13:00:00Z' },
  { id: 4, category: 'crowd', location_id: 10, severity: 'critical', created_at: '2026-01-01T14:00:00Z' },
  { id: 5, category: 'waste', location_id: 10, severity: 'caution', title: 'Waste moderate', created_at: '2026-01-01T11:00:00Z', resolved_at: null },
]

test('alert history scopes by location and waste category, newest first with a stable tie break', () => {
  assert.deepEqual(filterWasteAlerts(alerts, ['10']).map((row) => row.id), [5, 2, 1])
  assert.deepEqual(filterWasteAlerts(alerts, [10, 20]).map((row) => row.id), [3, 5, 2, 1])
  assert.deepEqual(filterWasteAlerts(alerts, []), [])
  assert.deepEqual(alerts.map((row) => row.id), [1, 2, 3, 4, 5], 'sorting does not mutate the source')
})

test('level, status and case-insensitive search filters work together', () => {
  assert.deepEqual(filterWasteAlerts(alerts, [10], { level: 'critical', status: 'unresolved', query: '  WASTE  ' }).map((row) => row.id), [1])
  assert.deepEqual(filterWasteAlerts(alerts, [10], { level: 'critical', status: 'resolved' }), [])
  assert.deepEqual(filterWasteAlerts(alerts, [10], { status: 'resolved', query: '2' }).map((row) => row.id), [2])
  assert.deepEqual(filterWasteAlerts(alerts, [10], { query: 'above threshold' }).map((row) => row.id), [2, 1])
})

test('responses retain every attempt and distinguish the current schedule from history', () => {
  const schedules = [
    { ...schedule, id: 3, alert_id: 1 },
    { ...schedule, id: 2, alert_id: 1, status: 'completed' },
    { ...schedule, id: 1, alert_id: 1, status: 'missed' },
    { ...schedule, id: 4, alert_id: 9 },
  ]
  const records = [
    { id: 1, schedule_id: 1, alert_id: 1, status: 'missed', total_kg: 0 },
    { id: 2, schedule_id: 2, status: 'partial', total_kg: 12 },
    { id: 3, alert_id: '1', status: 'completed', total_kg: 10 },
    { id: 4, schedule_id: 4, alert_id: 9 },
    { id: 5, schedule_id: null, alert_id: null },
  ]
  const result = wasteAlertResponse('1', schedules, records)
  assert.equal(result.activeSchedule.id, 3)
  assert.deepEqual(result.schedules.map((row) => row.id), [3, 2, 1])
  assert.deepEqual(result.collections.map((row) => row.id), [1, 2, 3], 'a record linked both directly and via schedule is counted once')
})

test('closed schedules remain in response history but do not block a follow-up', () => {
  const result = wasteAlertResponse(1, [{ ...schedule, alert_id: 1, status: 'cancelled' }], [])
  assert.equal(result.activeSchedule, null)
  assert.equal(result.schedules.length, 1)
  assert.deepEqual(wasteAlertResponse(999, [], []), { schedules: [], collections: [], activeSchedule: null })
})
