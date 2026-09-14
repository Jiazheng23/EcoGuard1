import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecordedDestinationSeries } from './environmentalTravelReport.js'
import { filterEnvironmentalReports, formatReading, sensorValue } from './reportFilters.js'
import { isWestMalaysiaLocation } from './westMalaysia.js'

test('recorded destinations merge exact case and spacing variants without fuzzy aliases or mutating trips', () => {
  const trips = [
    { destination: ' City  Square ', total_emission: 2 },
    { destination: 'city square', total_emission: 3 },
    { destination: 'City Squares', total_emission: 7 },
    { destination: 'Watermelon Highlands', total_emission: 11 },
    { destination: 'Cameron Highlands', total_emission: 13 },
  ]
  const original = structuredClone(trips)
  const rows = getRecordedDestinationSeries(trips)
  assert.equal(rows.length, 4)
  assert.equal(rows[0].name, 'City Square')
  assert.equal(rows[0].trips, 2)
  assert.equal(rows[0].emission, 5)
  assert.equal(rows.reduce((sum, row) => sum + row.emission, 0), 36)
  assert.deepEqual(trips, original)
})

test('managed locations without readings remain visible and missing values differ from recorded zero', () => {
  const locations = [
    { id: 1, name: 'Park', state: 'Pahang', latitude: 3.8, longitude: 103.3 },
    { id: 2, name: 'Lake', state: 'Perak', latitude: 4.6, longitude: 101.1 },
    { id: 3, name: 'Unmapped', state: 'Perak' },
  ].filter(isWestMalaysiaLocation)
  const selected = filterEnvironmentalReports(locations, [{ location_id: 1, waste_kg: 0 }], { query: '', location: 'all', dateRange: 'all' })
  assert.equal(selected.locations.length, 2)
  assert.equal(selected.metrics.length, 1)
  for (const value of [null, undefined, '', ' ', 'invalid']) {
    assert.equal(formatReading(sensorValue(value), 2, ' kg'), 'No data')
  }
  assert.equal(formatReading(sensorValue(0), 2, ' kg'), '0.00 kg')
  assert.equal(formatReading(sensorValue('0'), 2, ' kg'), '0.00 kg')
})
