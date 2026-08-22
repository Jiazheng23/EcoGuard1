import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterWasteCollections,
  getWasteSourceSeries,
  getWasteTrendSeries,
  summarizeWasteCollections,
} from './wasteAnalytics.js'

const records = [
  { id: 1, collected_at: '2026-08-01T02:00:00Z', total_kg: 40, recycled_kg: 10, landfill_kg: 30, waste_type: 'mixed', status: 'completed', source: 'manual' },
  { id: 2, collected_at: '2026-08-02T02:00:00Z', total_kg: 30, recycled_kg: 15, landfill_kg: 15, waste_type: 'recyclable', status: 'partial', source: 'simulated_sensor' },
  { id: 3, collected_at: '2026-08-03T02:00:00Z', total_kg: 0, recycled_kg: 0, landfill_kg: 0, waste_type: 'mixed', status: 'missed', source: 'manual' },
]

test('summarizes persisted waste quantities and statuses', () => {
  const summary = summarizeWasteCollections(records)
  assert.equal(summary.totalKg, 70)
  assert.equal(summary.recycledKg, 25)
  assert.equal(summary.landfillKg, 45)
  assert.equal(summary.completedCount, 1)
  assert.equal(summary.partialCount, 1)
  assert.equal(summary.missedCount, 1)
  assert.equal(summary.successfulCount, 2)
  assert.equal(summary.hasTrend, true)
  assert.equal(summary.recyclingRate, (25 / 70) * 100)
})

test('applies report filters without changing the source collection', () => {
  const filtered = filterWasteCollections(records, {
    from: '2026-08-02',
    to: '2026-08-03',
    wasteType: 'all',
    source: 'simulated_sensor',
    status: 'partial',
  })
  assert.deepEqual(filtered.map((item) => item.id), [2])
  assert.equal(records.length, 3)
})

test('creates date trends and clearly separated source counts', () => {
  const trend = getWasteTrendSeries(records)
  assert.equal(trend.length, 3)
  assert.equal(trend.reduce((total, item) => total + item.totalKg, 0), 70)
  assert.deepEqual(getWasteSourceSeries(records).map((item) => [item.source, item.count]), [
    ['manual', 2],
    ['simulated_sensor', 1],
  ])
})
