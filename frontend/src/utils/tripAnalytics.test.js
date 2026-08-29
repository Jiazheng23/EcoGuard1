import assert from 'node:assert/strict'
import test from 'node:test'

import { formatTransportFilterLabel, formatTransportModeLabel, getTripTransportFilterValue, getTripTransportLabel } from './tripAnalytics.js'

test('labels car trips with their saved power source', () => {
  assert.equal(
    getTripTransportLabel({ transport_mode: 'car', car_powertrain: 'petrol' }),
    'Car · Petrol',
  )
  assert.equal(
    getTripTransportLabel({ transport_mode: 'car', car_powertrain: 'electricity' }),
    'Car · Electricity',
  )
})

test('treats legacy car trips without a power source as petrol', () => {
  assert.equal(getTripTransportLabel({ transport_mode: 'car' }), 'Car · Petrol')
  assert.equal(getTripTransportLabel({ transport_mode: 'bus' }), 'Bus')
})

test('formats newly added database transport modes without a hard-coded label', () => {
  assert.equal(formatTransportModeLabel('electric_scooter'), 'Electric Scooter')
  assert.equal(getTripTransportLabel({ transport_mode: 'river-ferry' }), 'River Ferry')
})

test('separates petrol and electric cars for transport filtering', () => {
  assert.equal(getTripTransportFilterValue({ transport_mode: 'car', car_powertrain: 'petrol' }), 'car:petrol')
  assert.equal(getTripTransportFilterValue({ transport_mode: 'car', car_powertrain: 'electricity' }), 'car:electricity')
  assert.equal(getTripTransportFilterValue({ transport_mode: 'car' }), 'car:petrol')
  assert.equal(formatTransportFilterLabel('car:petrol'), 'Car · Petrol')
  assert.equal(formatTransportFilterLabel('car:electricity'), 'Car · Electricity')
})
