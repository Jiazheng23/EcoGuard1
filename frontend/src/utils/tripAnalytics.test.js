import assert from 'node:assert/strict'
import test from 'node:test'
import { getDestinationSeries, resolveTripDestinations } from './tripAnalytics.js'

test('merges the confirmed old destination name with current trips without changing totals', () => {
  const trips = [
    { destination: 'Watermelon Highlands', total_emission: 12 },
    { destination: 'Cameron Highlands', total_emission: 5 },
  ]
  const resolved = resolveTripDestinations(trips, [{ name: 'Cameron Highlands' }])
  const series = getDestinationSeries(resolved)
  assert.equal(series.length, 1)
  assert.equal(series[0].name, 'Cameron Highlands')
  assert.equal(series[0].emission, 17)
  assert.equal(series[0].trips, 2)
  assert.equal(trips[0].destination, 'Watermelon Highlands')
})

test('resolves renamed locations by the same coordinates or exact address', () => {
  const locations = [{ name: 'Current park', address: 'Park entrance road', latitude: 4.5, longitude: 101.4 }]
  const trips = [
    { destination: 'Old park', destination_lat: '4.5', destination_lng: '101.4' },
    { destination: 'Park entrance road' },
    { destination: 'Nearby cafe', destination_lat: 4.501, destination_lng: 101.401 },
    { destination: 'Unknown destination' },
  ]
  assert.deepEqual(resolveTripDestinations(trips, locations).map((trip) => trip.destination),
    ['Current park', 'Current park', 'Nearby cafe', 'Unknown destination'])
  assert.equal(resolveTripDestinations([trips[0]], [...locations, { ...locations[0], name: 'Another park' }])[0].destination, 'Old park')
  assert.equal(resolveTripDestinations([trips[3]], [{ name: 'Missing coordinates' }])[0].destination, 'Unknown destination')
})

test('resolves the supplied Batu Cave legacy name only when its current location exists', () => {
  const trips = [{ destination: 'Black Widow Hole', total_emission: 4 }, { destination: 'Batu Caves', total_emission: 2 }]
  const series = getDestinationSeries(resolveTripDestinations(trips, [{ name: 'Batu Cave' }]))
  assert.equal(series.length, 1)
  assert.equal(series[0].name, 'Batu Cave')
  assert.equal(series[0].emission, 6)
  assert.equal(resolveTripDestinations(trips, [])[0].destination, 'Black Widow Hole')
})

import { formatEcoPoints, formatTransportFilterLabel, formatTransportModeLabel, getTripTransportFilterValue, getTripTransportLabel, tripMatchesEcologicalLocation } from './tripAnalytics.js'

test('formats trip eco-point changes consistently', () => {
  assert.equal(formatEcoPoints(4), '+4')
  assert.equal(formatEcoPoints(0), '0')
  assert.equal(formatEcoPoints(-2), '-2')
})

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

test('matches location-admin trips by destination name or nearby coordinates', () => {
  const location = {
    name: 'Taman Negara',
    latitude: 4.381,
    longitude: 102.401,
  }

  assert.equal(tripMatchesEcologicalLocation({ destination: 'Taman Negara, Pahang' }, location), true)
  assert.equal(tripMatchesEcologicalLocation({ destination: 'Nearby entrance', destination_lat: 4.382, destination_lng: 102.402 }, location), true)
  assert.equal(tripMatchesEcologicalLocation({ destination: 'KLCC Park', destination_lat: 3.153, destination_lng: 101.715 }, location), false)
  assert.equal(tripMatchesEcologicalLocation({ destination: 'Unknown place' }, { name: 'Another location' }), false)
})
