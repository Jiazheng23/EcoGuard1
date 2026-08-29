import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAR_POWERTRAINS,
  calculateTripEnvironmentalImpact,
  recommendedModeForDistance,
} from './tripEnvironmentalRules.js'

test('uses the supplied passenger-kilometre emission factors', () => {
  assert.deepEqual(
    calculateTripEnvironmentalImpact({ mode: 'car', distanceKm: 100 }),
    {
      factorG: 135.45,
      carbonEmissionKg: 13.55,
      totalEmissionKg: 13.55,
      ecoPoints: -9,
      recommendedMode: 'bus',
      isRecommended: false,
      breakdown: {
        modeDistancePoints: -6,
        emissionPoints: -3,
        recommendationPoints: 0,
      },
    },
  )

  assert.equal(
    calculateTripEnvironmentalImpact({
      mode: 'motorcycle',
      distanceKm: 100,
    }).carbonEmissionKg,
    4.16,
  )
})

test('supports petrol and electricity within the single car choice', () => {
  const petrolCar = calculateTripEnvironmentalImpact({
    mode: 'car',
    distanceKm: 100,
    carPowertrain: CAR_POWERTRAINS.petrol,
  })
  const electricCar = calculateTripEnvironmentalImpact({
    mode: 'car',
    distanceKm: 100,
    carPowertrain: CAR_POWERTRAINS.electricity,
  })

  assert.equal(petrolCar.factorG, 135.45)
  assert.equal(petrolCar.carbonEmissionKg, 13.55)
  assert.equal(electricCar.factorG, 92.45)
  assert.equal(electricCar.carbonEmissionKg, 9.25)
})

test('rewards short clean trips and the recommended choice', () => {
  assert.equal(recommendedModeForDistance(1.5), 'walking')
  assert.equal(recommendedModeForDistance(5), 'bicycle')
  assert.equal(recommendedModeForDistance(50), 'bus')

  assert.equal(
    calculateTripEnvironmentalImpact({ mode: 'bicycle', distanceKm: 5 }).ecoPoints,
    10,
  )
  assert.equal(
    calculateTripEnvironmentalImpact({ mode: 'bus', distanceKm: 100 }).ecoPoints,
    4,
  )
})

test('penalises cars and emissions above the thresholds', () => {
  assert.equal(
    calculateTripEnvironmentalImpact({ mode: 'car', distanceKm: 5 }).ecoPoints,
    -2,
  )
  assert.equal(
    calculateTripEnvironmentalImpact({ mode: 'bus', distanceKm: 400 }).ecoPoints,
    -2,
  )
  assert.equal(
    calculateTripEnvironmentalImpact({ mode: 'car', distanceKm: 400 }).ecoPoints,
    -10,
  )
})

test('round trips and group totals are calculated consistently', () => {
  const result = calculateTripEnvironmentalImpact({
    mode: 'motorcycle',
    distanceKm: 10,
    passengers: 2,
    roundTrip: true,
  })

  assert.equal(result.carbonEmissionKg, 0.83)
  assert.equal(result.totalEmissionKg, 1.66)
})
