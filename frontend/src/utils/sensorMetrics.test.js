import assert from 'node:assert/strict'
import test from 'node:test'
import {
  airQualityLabel,
  sensorReadingSummary,
  waterQualityLabel,
} from './sensorMetrics.js'

test('sensor reading summary keeps dashboard and sensor values consistent', () => {
  const summary = sensorReadingSummary(
    { max_capacity: 400 },
    {
      crowd_count: 120,
      waste_kg: 30,
      recycled_kg: 12,
      air_quality_index: 75,
      water_quality_score: 84.5,
      temperature_c: 29.4,
      recorded_at: '2026-08-29T00:00:00Z',
    },
  )

  assert.equal(summary.visitors, 120)
  assert.equal(summary.occupancyPercent, 30)
  assert.equal(summary.recyclablePercent, 40)
  assert.equal(summary.airQualityIndex, 75)
  assert.equal(summary.waterQualityScore, 84.5)
  assert.equal(summary.temperatureC, 29.4)
  assert.equal(summary.recordedAt, '2026-08-29T00:00:00Z')
})

test('sensor quality labels use the same thresholds everywhere', () => {
  assert.equal(airQualityLabel(50), 'Good')
  assert.equal(airQualityLabel(75), 'Moderate')
  assert.equal(waterQualityLabel(80), 'Good')
  assert.equal(waterQualityLabel(60), 'Moderate')
})
