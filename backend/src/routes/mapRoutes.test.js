import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOsrmRouteUrl,
  decodePolyline,
  estimateTransitousItineraryEmissionG,
  isUsableLandLocation,
  mapTransitousItinerary,
  resolveRoutingMode,
  selectTransitousItinerary,
} from './mapRoutes.js'

test('maps tourist transport modes to the correct routing profile', () => {
  assert.equal(resolveRoutingMode('car').profile, 'driving')
  assert.equal(resolveRoutingMode('motorcycle').profile, 'driving')
  assert.equal(resolveRoutingMode('bicycle').profile, 'cycling')
  assert.equal(resolveRoutingMode('walking').profile, 'walking')
  assert.equal(resolveRoutingMode('bus').profile, 'public-transport')
  assert.equal(resolveRoutingMode('mrt').transitModes, 'TRANSIT')
  assert.equal(resolveRoutingMode('lrt').mode, 'mrt')
  assert.equal(resolveRoutingMode('mix').mode, 'mixed')
  assert.equal(resolveRoutingMode('mixed').preTransitModes, 'WALK,CAR')
})

test('keeps rail routing separate from bus routing', () => {
  const route = mapTransitousItinerary({ duration: 300, legs: [] }, 'mrt')
  assert.equal(route.mode, 'mrt')
  assert.equal(resolveRoutingMode('bus').transitModes, 'BUS')
})

test('selects a rail-containing itinerary for LRT/MRT combined journeys', () => {
  const busOnly = { id: 'bus-only', legs: [{ mode: 'BUS' }] }
  const combinedRail = {
    id: 'combined-rail',
    legs: [{ mode: 'WALK' }, { mode: 'SUBWAY', routeLongName: 'LRT Ampang Line' }],
  }

  assert.equal(
    selectTransitousItinerary([busOnly, combinedRail], resolveRoutingMode('mrt')),
    combinedRail,
  )
  assert.equal(selectTransitousItinerary([busOnly], resolveRoutingMode('mrt')), null)
})

test('selects the lowest-emission mixed itinerary before the fastest one', () => {
  const fasterCarRoute = {
    duration: 600,
    legs: [{ mode: 'CAR', distance: 10000 }],
  }
  const greenerTransitRoute = {
    duration: 1200,
    legs: [{ mode: 'BUS', distance: 2000 }, { mode: 'SUBWAY', distance: 8000 }],
  }

  assert.ok(
    estimateTransitousItineraryEmissionG(greenerTransitRoute) <
      estimateTransitousItineraryEmissionG(fasterCarRoute),
  )
  assert.equal(
    selectTransitousItinerary([fasterCarRoute, greenerTransitRoute], resolveRoutingMode('mixed')),
    greenerTransitRoute,
  )
})

test('maps a Transitous itinerary to the map route response', () => {
  const route = mapTransitousItinerary({
    duration: 900,
    legs: [{
      mode: 'BUS',
      routeShortName: 'T780',
      distance: 5200,
      duration: 900,
      from: { name: 'Origin stop' },
      to: { name: 'Destination stop' },
      legGeometry: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', precision: 5 },
    }],
  })

  assert.equal(route.distanceKm, 5.2)
  assert.equal(route.durationMinutes, 15)
  assert.equal(route.provider, 'Transitous')
  assert.equal(route.legs[0].route, 'T780')
  assert.equal(route.legs[0].transportLabel, 'Bus')
  assert.deepEqual(route.coordinates, decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'))
})

test('uses independent OSRM services for driving, cycling, and walking', () => {
  const coordinates = '101.1,3.1;101.2,3.2'
  const drivingUrl = buildOsrmRouteUrl(resolveRoutingMode('car'), coordinates)
  const cyclingUrl = buildOsrmRouteUrl(resolveRoutingMode('bicycle'), coordinates)
  const walkingUrl = buildOsrmRouteUrl(resolveRoutingMode('walking'), coordinates)

  assert.match(drivingUrl, /router\.project-osrm\.org\/route\/v1\/driving/)
  assert.match(cyclingUrl, /routed-bike\/route\/v1\/driving/)
  assert.match(walkingUrl, /routed-foot\/route\/v1\/driving/)
  assert.notEqual(drivingUrl, cyclingUrl)
  assert.notEqual(drivingUrl, walkingUrl)
})

test('rejects ocean and broad administrative reverse-geocoding matches', () => {
  assert.equal(isUsableLandLocation({
    type: 'administrative', lat: '3.1', lon: '101.6',
    address: { country_code: 'my', state: 'Selangor' },
  }, 3.1, 101.6), false)
  assert.equal(isUsableLandLocation({
    type: 'road', lat: '3.1001', lon: '101.6001',
    address: { country_code: 'my', road: 'Jalan Example', city: 'Kuala Lumpur' },
  }, 3.1, 101.6), true)
})
