import {
  formatTransportModeLabel,
  numberValue,
} from './tripAnalytics.js'
import { recommendedModeForDistance } from './tripEnvironmentalRules.js'

const LOW_EMISSION_MODES = new Set(['walking', 'bicycle', 'bus', 'mrt', 'train', 'mixed'])

export function getEcoRecommendations(trips = []) {
  const history = Array.isArray(trips) ? trips.filter(Boolean) : []

  if (!history.length) {
    return [{
      id: 'first-trip',
      type: 'start',
      tone: 'text-green-500',
      title: 'Unlock personalised advice',
      summary: 'Record your first journey to get started.',
      metrics: ['Routes', 'Emissions'],
      text: 'Save your first journey to unlock recommendations based on your routes, transport choices, and emissions.',
    }]
  }

  const recommendations = [modeRecommendation(history), routeRecommendation(history)]
  const trend = trendRecommendation(history)
  recommendations.push(trend || progressRecommendation(history))

  return recommendations
}

function modeRecommendation(trips) {
  const modes = new Map()

  trips.forEach((trip) => {
    const mode = trip.transport_mode || 'unknown'
    const current = modes.get(mode) || { count: 0, emission: 0, distance: 0 }
    current.count += 1
    current.emission += numberValue(trip.total_emission)
    current.distance += numberValue(trip.distance_km)
    modes.set(mode, current)
  })

  const [mode, values] = [...modes.entries()].sort((left, right) => (
    right[1].count - left[1].count || right[1].emission - left[1].emission
  ))[0]
  const label = formatTransportModeLabel(mode)
  const share = Math.round((values.count / trips.length) * 100)
  const averageDistance = values.distance / values.count
  const alternative = formatTransportModeLabel(recommendedModeForDistance(averageDistance))

  return {
    id: 'transport-pattern',
    type: LOW_EMISSION_MODES.has(mode) ? 'positive' : 'transport',
    tone: LOW_EMISSION_MODES.has(mode) ? 'text-green-500' : 'text-amber-500',
    title: `${label} is your top mode`,
    summary: LOW_EMISSION_MODES.has(mode)
      ? 'Keep choosing it where practical.'
      : `Try ${alternative} for similar journeys.`,
    metrics: [`${values.count}/${trips.length} trips`, `${share}% of history`],
    text: LOW_EMISSION_MODES.has(mode)
      ? `${label} is your most-used mode (${values.count} of ${trips.length} trips, ${share}%). Keep using it where practical to maintain this lower-carbon pattern.`
      : `${label} is your most-used mode (${values.count} of ${trips.length} trips, ${share}%). For similar ${averageDistance.toFixed(1)} km journeys, consider ${alternative}.`,
  }
}

function routeRecommendation(trips) {
  const routes = new Map()

  trips.forEach((trip) => {
    const start = String(trip.starting_location || '').trim()
    const destination = String(trip.destination || '').trim()
    const label = start && destination ? `${start} → ${destination}` : destination || start || 'Your recorded route'
    const key = label.toLocaleLowerCase()
    const current = routes.get(key) || { label, count: 0, emission: 0, distance: 0 }
    current.count += 1
    current.emission += numberValue(trip.total_emission)
    current.distance += numberValue(trip.distance_km)
    routes.set(key, current)
  })

  const route = [...routes.values()].sort((left, right) => (
    right.count - left.count || right.emission - left.emission
  ))[0]
  const averageEmission = route.emission / route.count
  const averageDistance = route.distance / route.count
  const alternative = formatTransportModeLabel(recommendedModeForDistance(averageDistance))

  return {
    id: 'route-pattern',
    type: 'route',
    tone: 'text-blue-500',
    title: `Frequent route to ${shortLocation(route.label)}`,
    summary: `Consider ${alternative} when this route allows it.`,
    metrics: [`${route.count} trip${route.count === 1 ? '' : 's'}`, `${averageEmission.toFixed(1)} kg CO₂ avg`],
    text: route.count > 1
      ? `${route.label} is your most frequent route (${route.count} trips, ${averageEmission.toFixed(1)} kg CO₂ average). Try ${alternative} when that route allows it.`
      : `Your ${route.label} trip recorded ${averageEmission.toFixed(1)} kg CO₂ over ${averageDistance.toFixed(1)} km. On a similar journey, ${alternative} is the recommended lower-carbon option.`,
  }
}

function trendRecommendation(trips) {
  if (trips.length < 6) return null

  const ordered = [...trips].sort((left, right) => (
    new Date(right.travelled_at).getTime() - new Date(left.travelled_at).getTime()
  ))
  const latestAverage = averageEmission(ordered.slice(0, 3))
  const previousAverage = averageEmission(ordered.slice(3, 6))

  if (previousAverage === 0) return null

  const difference = Math.round(Math.abs((latestAverage - previousAverage) / previousAverage) * 100)
  const improved = latestAverage <= previousAverage

  return {
    id: 'recent-trend',
    type: improved ? 'positive' : 'trend',
    tone: improved ? 'text-green-500' : 'text-violet-500',
    title: `Emissions are trending ${improved ? 'down' : 'up'}`,
    summary: improved ? 'Keep this momentum going.' : 'Choose a cleaner mode next time.',
    metrics: [`${latestAverage.toFixed(1)} kg CO₂ avg`, `${improved ? '↓' : '↑'} ${difference}%`],
    text: `Your latest 3 trips averaged ${latestAverage.toFixed(1)} kg CO₂, ${difference}% ${improved ? 'lower' : 'higher'} than the previous 3. ${improved ? 'Keep this momentum going.' : 'Choose a lower-carbon mode for your next suitable trip.'}`,
  }
}

function progressRecommendation(trips) {
  const ecoTrips = trips.filter((trip) => (
    ['walking', 'bicycle'].includes(trip.transport_mode) || numberValue(trip.eco_points) > 0
  )).length
  const share = Math.round((ecoTrips / trips.length) * 100)

  return {
    id: 'eco-progress',
    type: 'positive',
    tone: 'text-green-500',
    title: ecoTrips ? 'Your eco-positive share' : 'Build your eco-positive share',
    summary: ecoTrips ? 'Aim to raise it on your next journey.' : 'Try a cleaner mode on your next trip.',
    metrics: [`${ecoTrips}/${trips.length} trips`, `${share}% positive`],
    text: ecoTrips
      ? `${ecoTrips} of your ${trips.length} recorded trips (${share}%) earned positive eco points or used a zero-emission mode. Aim to improve that share on your next journey.`
      : `None of your ${trips.length} recorded trips has earned positive eco points yet. Your next suitable walking, bicycle, or public-transport trip can start improving that pattern.`,
  }
}

function averageEmission(trips) {
  return trips.reduce((total, trip) => total + numberValue(trip.total_emission), 0) / trips.length
}

function shortLocation(routeLabel) {
  const destination = String(routeLabel).split('→').at(-1).trim()
  const shortName = destination.split(',')[0].trim()
  return shortName || 'your regular destination'
}
