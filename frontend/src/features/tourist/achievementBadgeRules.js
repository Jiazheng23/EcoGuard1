import { numberValue } from '../../utils/tripAnalytics'

export function getAchievementBadges(trips = [], profile = {}) {
  const savedCarbon = numberValue(profile?.total_carbon_saved)
  const ecoScore = numberValue(profile?.eco_score)
  const streak = numberValue(profile?.current_streak)
  const destinations = new Set(trips.map((trip) => trip.destination).filter(Boolean)).size
  const hasZeroEmissionTrip = trips.some((trip) => ['walking', 'bicycle'].includes(trip.transport_mode))

  return [
    { name: 'Green Traveler', icon: '🌿', earned: trips.length >= 1, progress: `${Math.min(trips.length, 1)} / 1 trip` },
    { name: 'Carbon Saver', icon: '💚', earned: savedCarbon >= 1, progress: `${Math.min(savedCarbon, 1).toFixed(1)} / 1 kg saved` },
    { name: 'Eco Hero', icon: '🦸', earned: ecoScore >= 80, progress: `${ecoScore} / 80 score` },
    { name: 'Daily Streak', icon: '🔥', earned: streak >= 3, progress: `${Math.min(streak, 3)} / 3 days` },
    { name: 'Zero Emission', icon: '♻️', earned: hasZeroEmissionTrip, progress: hasZeroEmissionTrip ? 'Completed' : 'Walk or cycle once' },
    { name: 'Trail Blazer', icon: '🏞️', earned: destinations >= 3, progress: `${Math.min(destinations, 3)} / 3 destinations` },
  ]
}
