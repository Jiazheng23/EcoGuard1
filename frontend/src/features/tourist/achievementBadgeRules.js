import { numberValue } from '../../utils/tripAnalytics'

export function getAchievementBadges(trips = [], profile = {}) {
  const savedCarbon = numberValue(profile?.total_carbon_saved)
  const activeDays = new Set(trips.map((trip) => new Date(trip.travelled_at).toISOString().slice(0, 10))).size
  const publicTransportTrips = trips.filter((trip) => ['bus', 'mrt', 'train'].includes(trip.transport_mode)).length
  const zeroEmissionTrips = trips.filter((trip) => ['walking', 'bicycle'].includes(trip.transport_mode)).length
  const destinations = new Set(trips.map((trip) => trip.destination?.trim()).filter(Boolean)).size

  return [
    { name: 'Green Traveler', icon: '🌿', earned: trips.length >= 1, progress: `${Math.min(trips.length, 1)} / 1 trip` },
    { name: 'Public Transport Champion', icon: '🎫', earned: publicTransportTrips >= 5, progress: `${Math.min(publicTransportTrips, 5)} / 5 trips` },
    { name: 'Zero-Emission Explorer', icon: '✨', earned: zeroEmissionTrips >= 3, progress: `${Math.min(zeroEmissionTrips, 3)} / 3 trips` },
    { name: 'Carbon Saver', icon: '💚', earned: savedCarbon >= 5, progress: `${Math.min(savedCarbon, 5).toFixed(1)} / 5 kg saved` },
    { name: 'Consistent Traveler', icon: '⚡', earned: activeDays >= 7, progress: `${Math.min(activeDays, 7)} / 7 days` },
    { name: 'Eco Destination Explorer', icon: '📍', earned: destinations >= 5, progress: `${Math.min(destinations, 5)} / 5 destinations` },
  ]
}
