import test from 'node:test'
import assert from 'node:assert/strict'
import { getAchievementBadges } from '../services/achievementService.js'

const trip = (overrides = {}) => ({
  transport_mode: 'car',
  travelled_at: '2026-08-20T08:00:00Z',
  destination: 'Kuala Lumpur',
  distance_km: 10,
  eco_points: 5,
  round_trip: false,
  ...overrides,
})

test('provides one consistent expanded achievement catalog', () => {
  const badges = getAchievementBadges([], {})

  assert.equal(badges.length, 12)
  assert.equal(new Set(badges.map((badge) => badge.id)).size, badges.length)
  assert.ok(badges.every((badge) => badge.name && badge.description && badge.target > 0))
})

test('calculates badge progress using the current transport modes', () => {
  const trips = [
    ...Array.from({ length: 5 }, (_, index) => trip({ transport_mode: 'bus', travelled_at: `2026-08-${String(index + 1).padStart(2, '0')}T08:00:00Z` })),
    ...Array.from({ length: 3 }, (_, index) => trip({ transport_mode: 'bicycle', destination: `Destination ${index}`, travelled_at: `2026-08-${String(index + 10).padStart(2, '0')}T08:00:00Z` })),
    trip({ transport_mode: 'mrt' }),
  ]
  const badges = getAchievementBadges(trips, { total_carbon_saved: 6 })
  const byId = Object.fromEntries(badges.map((badge) => [badge.id, badge]))

  assert.equal(byId['public-transport'].current, 5)
  assert.equal(byId['public-transport'].earned, true)
  assert.equal(byId['cycling-starter'].earned, true)
  assert.equal(byId['carbon-saver'].earned, true)
  assert.equal(byId['consistent-traveler'].earned, true)
})

test('caps displayed progress and progress-bar width after earning a badge', () => {
  const badges = getAchievementBadges(Array.from({ length: 15 }, () => trip()), {})
  const firstTrip = badges.find((badge) => badge.id === 'first-trip')

  assert.equal(firstTrip.progress, '1 / 1 trip')
  assert.equal(firstTrip.progressPercent, 100)
})
