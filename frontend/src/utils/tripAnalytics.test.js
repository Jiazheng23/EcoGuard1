import assert from 'node:assert/strict'
import test from 'node:test'

import { getTripTransportLabel } from './tripAnalytics.js'

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
