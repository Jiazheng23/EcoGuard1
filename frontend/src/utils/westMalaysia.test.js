import test from 'node:test'
import assert from 'node:assert/strict'
import { inferWestMalaysiaState, isWestMalaysiaCoordinate, normalizeWestMalaysiaState, westMalaysiaStates } from './westMalaysia.js'

test('West Malaysia validation accepts peninsula coordinates', () => {
  assert.equal(isWestMalaysiaCoordinate(3.139, 101.6869), true)
  assert.equal(isWestMalaysiaCoordinate(5.4141, 100.3288), true)
})

test('location service state names normalize to form values', () => {
  assert.equal(normalizeWestMalaysiaState('Pulau Pinang'), 'Penang')
  assert.equal(normalizeWestMalaysiaState('Federal Territory of Kuala Lumpur'), 'Kuala Lumpur')
  assert.equal(normalizeWestMalaysiaState('Sabah'), '')
  assert.equal(inferWestMalaysiaState('KLCC, Kuala Lumpur, Malaysia'), 'Kuala Lumpur')
})

test('West Malaysia validation rejects Sabah and Sarawak coordinates', () => {
  assert.equal(isWestMalaysiaCoordinate(5.9804, 116.0735), false)
  assert.equal(isWestMalaysiaCoordinate(1.5533, 110.3592), false)
  assert.equal(westMalaysiaStates.includes('Sabah'), false)
  assert.equal(westMalaysiaStates.includes('Sarawak'), false)
})
