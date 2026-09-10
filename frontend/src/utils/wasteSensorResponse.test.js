import test from 'node:test'
import assert from 'node:assert/strict'
import { previewWasteSensorResponse } from './wasteSensorResponse.js'

test('current collection reduces both readings using exact kilogram precision', () => {
  const reading = { waste_kg: '10.83', recycled_kg: '7.93' }
  const result = previewWasteSensorResponse(reading, { total_kg: 5, recycled_kg: 3 })
  assert.deepEqual(result, { errors: {}, wasteAfter: 5.83, recycledAfter: 4.93 })
  assert.equal(reading.waste_kg, '10.83', 'preview never mutates the saved reading')
})

test('full collection leaves both readings at zero', () => {
  assert.deepEqual(previewWasteSensorResponse({ waste_kg: 10.83, recycled_kg: 7.93 }, { total_kg: 10.83, recycled_kg: 7.93 }), { errors: {}, wasteAfter: 0, recycledAfter: 0 })
})

test('rejects a collection larger than the available waste', () => {
  assert.match(previewWasteSensorResponse({ waste_kg: 10, recycled_kg: 4 }, { total_kg: 11, recycled_kg: 4 }).errors.total_kg, /exceeds/)
})

test('rejects recycled or non-recycled removals exceeding their available quantities', () => {
  const reading = { waste_kg: 10, recycled_kg: 8 }
  assert.match(previewWasteSensorResponse(reading, { total_kg: 10, recycled_kg: 9 }).errors.recycled_kg, /recyclable material/)
  assert.match(previewWasteSensorResponse(reading, { total_kg: 5, recycled_kg: 0 }).errors.recycled_kg, /Non-recycled/)
})

test('requires a reading and valid positive collection quantities', () => {
  assert.ok(previewWasteSensorResponse(null, { total_kg: 1, recycled_kg: 0 }).errors.sensor)
  assert.ok(previewWasteSensorResponse({ waste_kg: 10, recycled_kg: 0 }, { total_kg: 'abc', recycled_kg: 0 }).errors.sensor)
  assert.ok(previewWasteSensorResponse({ waste_kg: 10, recycled_kg: 0 }, { total_kg: 0, recycled_kg: 0 }).errors.total_kg)
})

test('decimal subtraction does not incorrectly reject a boundary quantity', () => {
  assert.deepEqual(previewWasteSensorResponse({ waste_kg: 0.3, recycled_kg: 0.1 }, { total_kg: 0.2, recycled_kg: 0 }), { errors: {}, wasteAfter: 0.1, recycledAfter: 0.1 })
})
