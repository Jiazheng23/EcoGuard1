import test from 'node:test'
import assert from 'node:assert/strict'
import { adminReportFilename, buildAdminTripPdfBytes, buildEnvironmentalPdfBytes } from './adminReport.js'

test('administrator trip PDF contains summary and detail rows', () => {
  const bytes = buildAdminTripPdfBytes([{ starting_location: 'KL', destination: 'Taman Negara', transport_mode: 'bus', distance_km: 10, total_emission: 1.2, eco_points: 5, travelled_at: '2026-08-25T00:00:00Z' }])
  const content = new TextDecoder().decode(bytes)
  assert.match(content, /^%PDF-1.4/)
  assert.match(content, /EcoGuard Trip Report/)
  assert.match(content, /Taman Negara/)
})

test('environmental PDF contains aggregate and location information', () => {
  const bytes = buildEnvironmentalPdfBytes([{ location_id: 1, crowd_count: 20, waste_kg: 4, air_quality_index: 42, water_quality_score: 88, recorded_at: '2026-08-25T00:00:00Z' }], [{ id: 1, name: 'Eco Park' }])
  const content = new TextDecoder().decode(bytes)
  assert.match(content, /EcoGuard Environmental Report/)
  assert.match(content, /Eco Park/)
})

test('administrator report filename identifies report type and format', () => {
  assert.equal(adminReportFilename('environment', 'pdf', new Date('2026-08-25T00:00:00Z')), 'ecoguard-environment-report-2026-08-25.pdf')
})
