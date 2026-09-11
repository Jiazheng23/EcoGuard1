import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterWestMalaysiaTrips, isWestMalaysiaReportLocation } from './reportFilters.js'

test('excludes East Malaysia locations and trips before report totals are calculated', () => {
  const locations = [
    { name: 'Batu Cave', state: 'Selangor', latitude: 3.24, longitude: 101.68 },
    { name: 'Kinabalu Park', state: 'Sabah' },
    { name: 'Gunung Mulu National Park', state: 'Sarawak' },
    { name: 'Island', latitude: 5.3, longitude: 115.2 },
  ]
  assert.deepEqual(locations.filter(isWestMalaysiaReportLocation).map((location) => location.name), ['Batu Cave'])
  const trips = [
    { destination: 'Batu Cave', total_emission: 3 },
    { destination: 'Kinabalu Park', total_emission: 10 },
    { destination: 'Gunung Mulu National Park', total_emission: 20 },
    { destination: 'Old island name', destination_lat: 5.3, destination_lng: 115.2, total_emission: 30 },
    { destination: 'Somewhere, Sarawak', total_emission: 40 },
    { destination: 'Labuan', total_emission: 50 },
  ]
  const result = filterWestMalaysiaTrips(trips, locations)
  assert.deepEqual(result, [trips[0]])
  assert.equal(getTripSummary(result).totalEmission, 3)
})
import { averageReadings, formatReading, crowdOccupancy, environmentalDefaults, travelDefaults, filterEnvironmentalReports, filterTravelReports, reportScope, reportCsvCell } from './reportFilters.js'
import { getTripSummary, getTransportSeries } from './tripAnalytics.js'
import { buildEnvironmentalPdfBytes, buildAdminTripPdfBytes } from './adminReport.js'

const now = Date.parse('2026-09-10T12:00:00Z')
const locations = [{ id: 1, name: 'Forest Park', state: 'Pahang' }, { id: 2, name: 'Lake Park', state: 'Perak' }]
const metrics = [{ location_id: 1, recorded_at: '2026-09-09', air_quality_index: 60, water_quality_score: 80, temperature_c: 30 }, { location_id: 2, recorded_at: '2026-08-20', air_quality_index: null, water_quality_score: '', temperature_c: 'bad' }]
const trips = [
  { id: 1, starting_location: 'Car park', destination: 'Forest Park', transport_mode: 'bus', travelled_at: '2026-09-09', total_emission: 7, carbon_emission: 999 },
  { id: 2, starting_location: 'KL', destination: 'Lake Park', transport_mode: 'car', travelled_at: '2026-08-20', total_emission: 13, carbon_emission: 999 },
  { id: 3, starting_location: 'KL', destination: 'Forest Park', transport_mode: 'walking', travelled_at: '2026-09-08', total_emission: 0 },
  { id: 4, starting_location: 'KL', destination: 'Forest Park', transport_mode: 'bicycle', travelled_at: '2026-09-08', total_emission: 0 },
]
const environment = (filters = environmentalDefaults) => filterEnvironmentalReports(locations, metrics, filters, now)
const travel = (filters = travelDefaults) => filterTravelReports(trips, filters, now)

test('stored crowd occupancy ignores mutable visitor readings and preserves its unit', () => {
  const row = { current_value: 82.5, unit: '%', location_metrics: { crowd_count: 200 } }
  assert.equal(crowdOccupancy(row), '82.5%')
  row.location_metrics.crowd_count = 900
  assert.equal(crowdOccupancy(row), '82.5%')
  assert.equal(crowdOccupancy({ current_value: null }), 'Not recorded')
  assert.equal(crowdOccupancy({ current_value: 0, unit: '%' }), '0%')
})

test('history table has seven columns, occupancy and existing status badges', () => {
  const source = readFileSync(new URL('../features/super_admin/CrowdAlertHistory.jsx', import.meta.url), 'utf8')
  assert.match(source, /Occupancy When Triggered/)
  assert.match(source, /crowdOccupancy\(row\)/)
  assert.match(source, /colSpan=\{7\}/)
  assert.doesNotMatch(source, /Action Taken|action_taken|location_metrics/)
  assert.match(source, /Resolved.*Unresolved/)
})

test('averages exclude missing values independently and preserve real zero', () => {
  for (const field of ['air_quality_index', 'water_quality_score', 'temperature_c']) {
    assert.equal(averageReadings(metrics.map(row => row[field])), metrics[0][field])
  }
  assert.equal(averageReadings([60, null, undefined, '', '  ', 'bad', NaN, Infinity, {}, false]), 60)
  assert.equal(averageReadings([60, '0']), 30)
  assert.equal(averageReadings([1, 2, 2]), 5 / 3)
})

test('no valid readings return no data', () => {
  assert.equal(averageReadings([]), null)
  assert.equal(averageReadings([null, undefined, '', 'invalid']), null)
  assert.equal(formatReading(null), 'No data')
  assert.equal(formatReading(0), '0')
})

test('environmental search, location and date filters select only matching readings', () => {
  assert.deepEqual(environment({ ...environmentalDefaults, query: ' PAHANG ' }).locations, [locations[0]])
  assert.deepEqual(environment({ ...environmentalDefaults, location: '2' }).metrics, [metrics[1]])
  assert.deepEqual(environment({ ...environmentalDefaults, dateRange: '7' }).metrics, [metrics[0]])
  assert.equal(environment({ ...environmentalDefaults, query: 'absent' }).metrics.length, 0)
  assert.equal(environment({ ...environmentalDefaults, dateRange: 'all' }).metrics.length, 2)
})

test('travel searches starting point and destination and filters transport and dates', () => {
  assert.deepEqual(travel({ ...travelDefaults, query: ' CAR PARK ' }), [trips[0]])
  assert.equal(travel({ ...travelDefaults, query: 'forest' }).length, 3)
  assert.deepEqual(travel({ ...travelDefaults, transport: 'car' }), [trips[1]])
  assert.equal(travel({ ...travelDefaults, dateRange: '7' }).length, 3)
  assert.equal(travel({ ...travelDefaults, dateRange: 'all' }).length, 4)
})

test('environmental and travel filters and resets remain independent', () => {
  let env = { ...environmentalDefaults, query: 'lake', location: '2', dateRange: '90' }
  let trip = { ...travelDefaults, query: 'forest', transport: 'walking', dateRange: '7' }
  const selectedTrips = travel(trip)
  environment(env)
  assert.deepEqual(travel(trip), selectedTrips)
  const selectedEnvironment = environment(env)
  trip = travelDefaults
  assert.deepEqual(environment(env), selectedEnvironment)
  assert.deepEqual(travel(trip), trips)
  env = environmentalDefaults
  assert.deepEqual(environment(env), { locations, metrics })
  assert.deepEqual(travel(trip), trips)
})

test('report UI connects each reset and export to its own filter group', () => {
  const source = readFileSync(new URL('../features/super_admin/Reports.jsx', import.meta.url), 'utf8')
  assert.match(source, /filters=\{environmentFilters\} onChange=\{setEnvironmentFilters\} defaults=\{environmentalDefaults\}/)
  assert.match(source, /filters=\{travelFilters\} onChange=\{setTravelFilters\} defaults=\{travelDefaults\}/)
  assert.match(source, /onClick=\{\(\) => onChange\(defaults\)\}/)
  assert.match(source, /isSuperAdmin && <label/)
  assert.match(source, /buildEnvironmentalPdfBytes\(filteredMetrics, filteredLocations/)
  assert.match(source, /buildAdminTripPdfBytes\(filteredTrips/)
  assert.match(source, /filteredTrips.map\(/)
  assert.match(source, /filteredMetrics.map\(/)
  assert.match(source, /No trips match the current filters/)
  assert.match(source, /Zero-emission trips/)
})

test('admin summaries use stored trip totals and handle empty and zero emission trips', () => {
  assert.equal(getTripSummary(travel()).totalEmission, 20)
  assert.equal(getTripSummary(travel()).averageEmission, 5)
  const empty = travel({ ...travelDefaults, query: 'missing' })
  assert.equal(getTripSummary(empty).totalTrips, 0)
  assert.equal(getTripSummary(empty).averageEmission, 0)
  assert.deepEqual(getTransportSeries(empty), [])
  const zero = travel().slice(2)
  assert.equal(getTripSummary(zero).totalEmission, 0)
  assert.deepEqual(getTransportSeries(zero).map(row => [row.mode, row.trips, row.emission]), [['walking', 1, 0], ['bicycle', 1, 0]])
})

test('PDF averages omit missing values and exports retain independent scopes', () => {
  const decode = bytes => new TextDecoder().decode(bytes)
  const scope = reportScope({ ...environmentalDefaults, query: 'Pahang' }, 'Forest Park')
  const pdf = decode(buildEnvironmentalPdfBytes(metrics, locations, { scope }))
  assert.match(pdf, /60.0/)
  assert.match(pdf, /80.0/)
  assert.match(pdf, /Forest Park; last 30 days; search: Pahang/)
  assert.match(decode(buildEnvironmentalPdfBytes([metrics[1]], locations)), /No data/)
  const tripScope = reportScope({ ...travelDefaults, transport: 'walking' }, 'Assigned location')
  assert.match(decode(buildAdminTripPdfBytes(travel({ ...travelDefaults, transport: 'walking' }), { scope: tripScope })), /transport: walking/)
})

test('report CSV cells escape quotes and neutralize spreadsheet formulas', () => {
  assert.equal(reportCsvCell('a,"b"'), '"a,""b"""')
  for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1']) assert.ok(reportCsvCell(value).startsWith('"\''))
  assert.equal(reportCsvCell(null), '""')
})

test('environmental summary and chart averages exclude missing readings, including temperature', async () => {
  const { getEnvironmentalSummary, buildEnvironmentalTrend } = await import('./environmentalAnalytics.js')
  const summary = getEnvironmentalSummary(metrics)
  assert.equal(summary.averageAqi, 60)
  assert.equal(summary.averageWater, 80)
  assert.equal(summary.averageTemperature, 30)
  assert.equal(getEnvironmentalSummary([]).averageTemperature, null)
  const series = buildEnvironmentalTrend(metrics.map(row => ({ ...row, recorded_at: '2026-09-09T12:00:00Z' })), 'day')
  assert.equal(series[0].aqi, 60)
  assert.equal(series[0].water, 80)
  assert.equal(series[0].temperature, 30)
  const empty = buildEnvironmentalTrend([metrics[1]], 'day')
  assert.equal(empty[0].temperature, null)
  assert.equal(empty[0].aqi, null)
})
