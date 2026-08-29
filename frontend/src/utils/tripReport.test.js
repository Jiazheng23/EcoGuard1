import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTripHistoryCsv, buildTripHistoryPdfBytes, tripHistoryFilename, tripHistoryReportFilename } from './tripReport.js'

const trip = {
  travelled_at: '2026-08-25T04:30:00Z',
  starting_location: 'Kuala Lumpur',
  destination: 'Taman Negara, Pahang',
  transport_mode: 'train',
  distance_km: 241.5,
  carbon_emission: 8.75,
  total_emission: 17.5,
  eco_points: 30,
  passengers: 2,
  round_trip: true,
}

test('trip CSV has readable headings and sustainability details', () => {
  const csv = buildTripHistoryCsv([trip])
  assert.match(csv, /"Date","Origin \/ Start Location","Destination","Ecological Location"/)
  assert.match(csv, /"Kuala Lumpur","Taman Negara, Pahang","","ETS Train"/)
  assert.match(csv, /"241.50","8.75","17.50","30","2","Round trip"/)
  assert.equal(csv.split('\r\n').length, 2)
})

test('trip CSV safely handles empty history', () => {
  const csv = buildTripHistoryCsv([])
  assert.equal(csv.split('\r\n').length, 1)
  assert.match(csv, /Calculated Total Carbon Emission/)
})

test('trip CSV identifies electric car history', () => {
  const csv = buildTripHistoryCsv([{
    ...trip,
    transport_mode: 'car',
    car_powertrain: 'electricity',
  }])

  assert.match(csv, /"Car · Electricity"/)
})

test('trip CSV escapes spreadsheet formulas and quotes', () => {
  const csv = buildTripHistoryCsv([{ ...trip, starting_location: '=CMD()', destination: 'A "quoted" place' }])
  assert.match(csv, /"'=CMD\(\)"/)
  assert.match(csv, /"A ""quoted"" place"/)
})

test('trip report filename is deterministic by date', () => {
  assert.equal(tripHistoryFilename(new Date('2026-08-25T04:30:00Z')), 'ecoguard-my-trip-history-2026-08-25.csv')
  assert.equal(tripHistoryReportFilename('pdf', new Date('2026-08-25T04:30:00Z')), 'ecoguard-my-trip-history-2026-08-25.pdf')
})

test('trip PDF contains an organized summary and detailed history', () => {
  const bytes = buildTripHistoryPdfBytes([trip], { generatedAt: new Date('2026-08-25T04:30:00Z') })
  const content = new TextDecoder().decode(bytes)
  assert.equal(content.startsWith('%PDF-1.4'), true)
  assert.match(content, /EcoGuard Personal Trip History/)
  assert.match(content, /Total carbon emission/)
  assert.match(content, /Kuala Lumpur/)
  assert.equal(content.endsWith('%%EOF'), true)
})
