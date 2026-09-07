import test from 'node:test'
import assert from 'node:assert/strict'
import { crowdLevel, crowdRanges, filterCrowdHistory } from './crowdThresholds.js'

const threshold = { caution_percent: 60, warning_percent: 80, critical_percent: 90 }

test('crowd levels use exact boundaries without rounding up occupancy', () => {
  assert.equal(crowdLevel(5999, 10000, threshold), 'optimal')
  assert.equal(crowdLevel(6000, 10000, threshold), 'caution')
  assert.equal(crowdLevel(8000, 10000, threshold), 'warning')
  assert.equal(crowdLevel(9000, 10000, threshold), 'critical')
  assert.equal(crowdLevel(11000, 10000, threshold), 'critical')
  assert.equal(crowdLevel(null, 10000, threshold), null)
  assert.equal(crowdLevel(12, 0, threshold), null)
})

test('displayed integer visitor ranges match percentage classifications', () => {
  assert.deepEqual(crowdRanges(101, threshold), ['0–60', '61–80', '81–90', '≥ 91'])
  assert.equal(crowdLevel(60, 101, threshold), 'optimal')
  assert.equal(crowdLevel(61, 101, threshold), 'caution')
})

test('history combines filters, enforces accessible scope, and sorts newest first', () => {
  const rows = [
    { id: 1, category: 'crowd', location_id: 1, severity: 'warning', created_at: '2026-09-01', resolved_at: null },
    { id: 2, category: 'crowd', location_id: 2, severity: 'critical', created_at: '2026-09-02', resolved_at: '2026-09-03' },
    { id: 3, category: 'crowd', location_id: 1, severity: 'warning', created_at: '2026-09-03', resolved_at: null },
    { id: 4, category: 'waste', location_id: 1, severity: 'warning', created_at: '2026-09-04' },
    { id: 5, category: 'crowd', location_id: 99, severity: 'warning', created_at: '2026-09-05' },
  ]
  assert.deepEqual(filterCrowdHistory(rows, [1, 2]).map((row) => row.id), [3, 2, 1])
  assert.deepEqual(filterCrowdHistory(rows, [1, 2], { location: '1', level: 'warning', status: 'unresolved' }).map((row) => row.id), [3, 1])
  assert.deepEqual(filterCrowdHistory(rows, [1], { location: '2' }), [])
  assert.equal(filterCrowdHistory(rows, [1, 2], { status: 'resolved' }).length, 1)
  assert.equal(rows[0].id, 1)
})
