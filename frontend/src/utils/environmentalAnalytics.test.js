import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCurrentEnvironmentalWarnings,
  buildLocationDensity,
  buildVisitorDensitySeries,
  getEnvironmentalSummary,
} from './environmentalAnalytics.js'

const locations = [
  { id: 1, name: 'Taman Negara', max_capacity: 100 },
  { id: 2, name: 'Penang Hill', max_capacity: 200 },
]

test('visitor density averages repeated readings per location before combining locations', () => {
  const rows = [
    { location_id: 1, crowd_count: 40, recorded_at: '2026-08-20T08:00:00Z' },
    { location_id: 1, crowd_count: 60, recorded_at: '2026-08-20T09:00:00Z' },
    { location_id: 2, crowd_count: 100, recorded_at: '2026-08-20T09:00:00Z' },
  ]

  const result = buildVisitorDensitySeries(rows, locations, '30')
  assert.equal(result.length, 1)
  assert.equal(result[0].visitors, 150)
  assert.equal(result[0].occupancy, 50)
})

test('location density keeps the latest sensor reading for each location', () => {
  const rows = [
    { location_id: 1, crowd_count: 20, recorded_at: '2026-08-20T08:00:00Z' },
    { location_id: 1, crowd_count: 75, recorded_at: '2026-08-20T09:00:00Z' },
  ]

  const result = buildLocationDensity(rows, locations)
  assert.equal(result.length, 1)
  assert.equal(result[0].visitors, 75)
  assert.equal(result[0].occupancy, 75)
})

test('summary identifies the period with the highest visitor density', () => {
  const summary = getEnvironmentalSummary([], [
    { period: '20 Aug', visitors: 80, occupancy: 40 },
    { period: '21 Aug', visitors: 120, occupancy: 60 },
  ])

  assert.equal(summary.peakPeriod.period, '21 Aug')
  assert.equal(summary.averageOccupancy, 50)
})

test('current warnings exclude waste and use crowd and environmental thresholds', () => {
  const rows = [{
    location_id: 1,
    crowd_count: 95,
    air_quality_index: 160,
    water_quality_score: 45,
    temperature_c: 36,
    recorded_at: '2026-08-20T09:00:00Z',
  }]
  const thresholds = [{ location_id: 1, caution_percent: 60, warning_percent: 80, critical_percent: 90 }]

  const warnings = buildCurrentEnvironmentalWarnings(rows, locations, thresholds)
  assert.deepEqual(warnings.map((warning) => warning.category), [
    'Crowd', 'Air quality', 'Water quality', 'Temperature',
  ])
  assert.equal(warnings[0].severity, 'critical')
})
