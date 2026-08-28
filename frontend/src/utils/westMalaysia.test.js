import test from 'node:test'
import assert from 'node:assert/strict'
import { inferWestMalaysiaState, isWestMalaysiaCoordinate, isWestMalaysiaLocation, normalizeWestMalaysiaState, westMalaysiaStates } from './westMalaysia.js'

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

test('location validation requires a West Malaysia state and coordinates', () => {
  assert.equal(isWestMalaysiaLocation({ state: 'Pahang', latitude: 4.381, longitude: 102.401 }), true)
  assert.equal(isWestMalaysiaLocation({ state: 'Sabah', latitude: 6.075, longitude: 116.558 }), false)
  assert.equal(isWestMalaysiaLocation({ state: 'Sarawak', lat: 4.05, lng: 114.81 }), false)
})
