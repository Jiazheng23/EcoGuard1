import test from 'node:test'
import assert from 'node:assert/strict'
import { getEcoRecommendations } from './ecoRecommendations.js'

test('returns a history-building prompt when the tourist has no trips', () => {
  const recommendations = getEcoRecommendations([])

  assert.equal(recommendations.length, 1)
  assert.match(recommendations[0].text, /first journey/i)
})

test('uses actual mode, route, distance, and eco progress from trip history', () => {
  const trips = [
    trip({ mode: 'car', start: 'Home', destination: 'KLCC', distance: 8, emission: 2.4, points: -4 }),
    trip({ mode: 'car', start: 'Home', destination: 'KLCC', distance: 10, emission: 2.8, points: -5 }),
    trip({ mode: 'bus', start: 'Office', destination: 'Museum', distance: 4, emission: 0.2, points: 4 }),
  ]

  const recommendations = getEcoRecommendations(trips)

  assert.equal(recommendations.length, 3)
  assert.match(recommendations[0].text, /Car is your most-used mode \(2 of 3 trips, 67%\)/)
  assert.match(recommendations[0].text, /9\.0 km journeys/)
  assert.match(recommendations[1].text, /Home → KLCC is your most frequent route \(2 trips, 2\.6 kg CO₂ average\)/)
  assert.match(recommendations[2].text, /1 of your 3 recorded trips \(33%\)/)
})

test('compares the latest trips with the preceding trips', () => {
  const emissions = [1, 1, 1, 2, 2, 2]
  const trips = emissions.map((emission, index) => trip({
    mode: 'bus',
    start: 'A',
    destination: 'B',
    distance: 12,
    emission,
    points: 2,
    date: `2026-09-0${6 - index}T08:00:00.000Z`,
  }))

  const trend = getEcoRecommendations(trips)[2]

  assert.match(trend.text, /latest 3 trips averaged 1\.0 kg CO₂, 50% lower than the previous 3/i)
})

function trip({ mode, start, destination, distance, emission, points, date = '2026-09-01T08:00:00.000Z' }) {
  return {
    transport_mode: mode,
    starting_location: start,
    destination,
    distance_km: distance,
    total_emission: emission,
    eco_points: points,
    travelled_at: date,
  }
}
