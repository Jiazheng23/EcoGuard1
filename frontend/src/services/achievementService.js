import { numberValue } from '../utils/tripAnalytics.js'

export function getAchievementBadges(trips = [], profile = {}) {
  const validTrips = Array.isArray(trips) ? trips : []
  const tripCount = validTrips.length
  const busTrips = countTrips(validTrips, (trip) => trip.transport_mode === 'bus')
  const zeroEmissionTrips = countTrips(validTrips, (trip) => ['walking', 'bicycle'].includes(trip.transport_mode))
  const bicycleTrips = countTrips(validTrips, (trip) => trip.transport_mode === 'bicycle')
  const roundTrips = countTrips(validTrips, (trip) => Boolean(trip.round_trip))
  const activeDays = new Set(validTrips.map((trip) => dateKey(trip.travelled_at)).filter(Boolean)).size
  const destinations = new Set(validTrips.map((trip) => trip.destination?.trim().toLowerCase()).filter(Boolean)).size
  const totalDistance = validTrips.reduce((total, trip) => total + numberValue(trip.distance_km), 0)
  const ecoPoints = validTrips.reduce((total, trip) => total + numberValue(trip.eco_points), 0)
  const savedCarbon = numberValue(profile?.total_carbon_saved)

  return [
    badge('first-trip', 'Green Traveler', 'Save your first journey in EcoGuard.', 'route', 'green', tripCount, 1, 'trip'),
    badge('trip-regular', 'Eco Regular', 'Record 10 journeys and make sustainable tracking a habit.', 'calendar', 'lime', tripCount, 10, 'trips'),
    badge('public-transport', 'Bus Champion', 'Complete 5 journeys by bus.', 'bus', 'blue', busTrips, 5, 'bus trips'),
    badge('zero-emission', 'Zero-Emission Explorer', 'Complete 3 walking or bicycle journeys.', 'sparkles', 'sky', zeroEmissionTrips, 3, 'trips'),
    badge('zero-emission-pro', 'Clean Travel Pro', 'Complete 10 walking or bicycle journeys.', 'leaf', 'emerald', zeroEmissionTrips, 10, 'trips'),
    badge('cycling-starter', 'Cycling Starter', 'Record 3 bicycle journeys.', 'bike', 'cyan', bicycleTrips, 3, 'bike trips'),
    badge('carbon-saver', 'Carbon Saver', 'Save 5 kg of carbon through greener choices.', 'wind', 'teal', savedCarbon, 5, 'kg saved', 1),
    badge('consistent-traveler', 'Consistent Traveler', 'Record journeys on 7 different days.', 'zap', 'orange', activeDays, 7, 'days'),
    badge('destination-explorer', 'Destination Explorer', 'Travel to 5 different destinations.', 'mapPin', 'violet', destinations, 5, 'destinations'),
    badge('distance-voyager', 'Distance Voyager', 'Record a total of 100 kilometres.', 'gauge', 'indigo', totalDistance, 100, 'km', 1),
    badge('points-collector', 'Eco Points Collector', 'Build a balance of 50 Eco Points.', 'award', 'amber', ecoPoints, 50, 'points'),
    badge('round-trip-planner', 'Round-Trip Planner', 'Complete 5 round-trip journeys.', 'repeat', 'rose', roundTrips, 5, 'round trips'),
  ]
}

function countTrips(trips, predicate) {
  return trips.filter(predicate).length
}

function dateKey(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function badge(id, name, description, icon, color, rawCurrent, target, unit, digits = 0) {
  const current = Math.max(0, numberValue(rawCurrent))
  const displayedCurrent = Math.min(current, target)
  const format = (value) => digits ? value.toFixed(digits) : Math.floor(value).toLocaleString()

  return {
    id, name, description, icon, color, current, target,
    earned: current >= target,
    progress: `${format(displayedCurrent)} / ${format(target)} ${unit}`,
    progressPercent: Math.min((current / target) * 100, 100),
  }
}
