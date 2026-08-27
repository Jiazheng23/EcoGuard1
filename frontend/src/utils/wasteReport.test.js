import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWasteCsv, buildWastePdfBytes, wasteReportFilename } from './wasteReport.js'

const record = {
  id: 1,
  schedule_id: 8,
  collected_at: '2026-08-01T02:00:00Z',
  total_kg: 40,
  recycled_kg: 10,
  landfill_kg: 30,
  waste_type: 'mixed',
  status: 'completed',
  source: 'simulated_sensor',
  notes: 'Labelled automated sensor record',
}

test('CSV includes filtered detail fields and an explicit sensor-source label', () => {
  const csv = buildWasteCsv([record], { locationName: 'Taman Test' })
  assert.match(csv, /AUTOMATED SENSOR/)
  assert.match(csv, /Schedule #8/)
  assert.match(csv, /"Labelled automated sensor record"/)
  assert.equal(csv.split('\r\n').length, 2)
})

test('PDF generator creates a complete PDF document with disclosure and history', () => {
  const bytes = buildWastePdfBytes([record], {
    locationName: 'Taman Test',
    filters: { from: '', to: '', wasteType: 'all', source: 'all', status: 'all' },
    generatedAt: new Date('2026-08-22T08:00:00Z'),
  })
  const content = new TextDecoder().decode(bytes)
  assert.equal(content.startsWith('%PDF-1.4'), true)
  assert.match(content, /SENSOR DATA SOURCE/)
  assert.match(content, /EcoGuard Waste Collection History/)
  assert.equal(content.endsWith('%%EOF'), true)
})

test('report filenames are filesystem safe and deterministic by date', () => {
  assert.equal(wasteReportFilename('Taman Negara / Pahang', 'pdf', new Date('2026-08-22T08:00:00Z')), 'ecoguard-waste-taman-negara-pahang-2026-08-22.pdf')
})
