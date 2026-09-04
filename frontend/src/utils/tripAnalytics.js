export const transportLabels = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  bus: 'Bus',
  mrt: 'MRT / LRT',
  train: 'ETS Train',
  walking: 'Walking',
  bicycle: 'Bicycle',
  flight: 'Flight',
}

export const transportColors = {
  car: '#ef4444',
  motorcycle: '#f97316',
  bus: '#f59e0b',
  mrt: '#22c55e',
  train: '#16a34a',
  walking: '#14b8a6',
  bicycle: '#0ea5e9',
  flight: '#8b5cf6',
}

export function formatTransportModeLabel(mode) {
  if (!mode) return 'Unknown transport'
  return transportLabels[mode] || String(mode)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function getTripTransportLabel(trip) {
  const mode = trip?.transport_mode
  const label = formatTransportModeLabel(mode)

  if (mode !== 'car') return label

  const powertrain = String(trip?.car_powertrain || '').toLowerCase()
  return `${label} · ${powertrain === 'electricity' ? 'Electricity' : 'Petrol'}`
}

export function getTripTransportFilterValue(trip) {
  if (trip?.transport_mode !== 'car') return trip?.transport_mode || ''
  return `car:${String(trip.car_powertrain || '').toLowerCase() === 'electricity' ? 'electricity' : 'petrol'}`
}

export function formatTransportFilterLabel(value) {
  if (value === 'car:petrol') return 'Car · Petrol'
  if (value === 'car:electricity') return 'Car · Electricity'
  return formatTransportModeLabel(value)
}

export function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatEcoPoints(value) {
  const points = numberValue(value)
  return `${points > 0 ? '+' : ''}${points.toLocaleString()}`
}

export function formatCarbon(value, digits = 1) {
  return `${numberValue(value).toFixed(digits)} kg CO₂`
}

export function formatTripDate(value, options = {}) {
  if (!value) return 'Unknown date'

  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(new Date(value))
}

export function getMonthlySeries(trips, monthCount = 7) {
  const formatter = new Intl.DateTimeFormat('en-MY', { month: 'short' })
  const now = new Date()

  return Array.from({ length: monthCount }, (_, index) => {
    const offset = monthCount - index - 1
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    const matching = trips.filter((trip) => {
      const date = new Date(trip.travelled_at)
      return date >= start && date < end
    })

    return {
      month: formatter.format(start),
      trips: matching.length,
      emission: Number(
        matching
          .reduce((total, trip) => total + numberValue(trip.total_emission), 0)
          .toFixed(2),
      ),
    }
  })
}

export function getDailySeries(trips, dayCount = 7) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const formatter = new Intl.DateTimeFormat('en-MY', { weekday: 'short' })

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (dayCount - index - 1))
    const end = new Date(date)
    end.setDate(date.getDate() + 1)
    const matching = trips.filter((trip) => {
      const tripDate = new Date(trip.travelled_at)
      return tripDate >= date && tripDate < end
    })

    return {
      day: formatter.format(date),
      trips: matching.length,
      emission: Number(
        matching
          .reduce((total, trip) => total + numberValue(trip.total_emission), 0)
          .toFixed(2),
      ),
    }
  })
}

export function getTransportSeries(trips) {
  const totals = new Map()

  trips.forEach((trip) => {
    const mode = trip.transport_mode || 'unknown'
    const current = totals.get(mode) || { trips: 0, emission: 0 }
    current.trips += 1
    current.emission += numberValue(trip.total_emission)
    totals.set(mode, current)
  })

  return [...totals.entries()]
    .map(([mode, values]) => ({
      mode,
      name: transportLabels[mode] || mode,
      value: values.trips,
      trips: values.trips,
      emission: Number(values.emission.toFixed(2)),
      color: transportColors[mode] || '#64748b',
    }))
    .sort((left, right) => right.trips - left.trips)
}

export function getDestinationSeries(trips) {
  const destinations = new Map()

  trips.forEach((trip) => {
    const name = trip.destination?.trim() || 'Unknown destination'
    const current = destinations.get(name) || {
      name,
      trips: 0,
      emission: 0,
      distance: 0,
      tourists: new Set(),
      latest: null,
      lat: null,
      lng: null,
    }

    current.trips += 1
    current.emission += numberValue(trip.total_emission)
    current.distance += numberValue(trip.distance_km)
    current.tourists.add(trip.tourist_id)
    current.lat ??= trip.destination_lat
    current.lng ??= trip.destination_lng

    if (!current.latest || new Date(trip.travelled_at) > new Date(current.latest)) {
      current.latest = trip.travelled_at
    }

    destinations.set(name, current)
  })

  return [...destinations.values()]
    .map((destination) => ({
      ...destination,
      emission: Number(destination.emission.toFixed(2)),
      averageEmission: Number((destination.emission / destination.trips).toFixed(2)),
      averageDistance: Number((destination.distance / destination.trips).toFixed(1)),
      touristCount: destination.tourists.size,
    }))
    .sort((left, right) => right.trips - left.trips)
}

export function getTripSummary(trips, profiles = []) {
  const totalEmission = trips.reduce(
    (total, trip) => total + numberValue(trip.total_emission),
    0,
  )

  return {
    totalTrips: trips.length,
    totalEmission: Number(totalEmission.toFixed(2)),
    averageEmission: trips.length
      ? Number((totalEmission / trips.length).toFixed(2))
      : 0,
    touristCount: profiles.filter((profile) => profile.role === 'tourist').length,
    destinationCount: getDestinationSeries(trips).length,
    highEmissionTrips: trips.filter(
      (trip) => numberValue(trip.carbon_emission) > 15,
    ).length,
  }
}

export function tripMatchesEcologicalLocation(trip, location, radiusKm = 1.5) {
  if (!trip || !location) return false

  const destination = normalizeLocationText(trip.destination)
  const locationNames = [location.name, location.address, location.full_address]
    .map(normalizeLocationText)
    .filter((value) => value.length >= 5)

  if (destination && locationNames.some((name) => (
    destination === name || destination.includes(name) || name.includes(destination)
  ))) {
    return true
  }

  const coordinateValues = [
    trip.destination_lat,
    trip.destination_lng,
    location.latitude,
    location.longitude,
  ]
  if (coordinateValues.some((value) => value == null || value === '')) {
    return false
  }

  const [destinationLat, destinationLng, locationLat, locationLng] = coordinateValues.map(Number)
  if (![destinationLat, destinationLng, locationLat, locationLng].every(Number.isFinite)) {
    return false
  }

  return coordinateDistanceKm(
    destinationLat,
    destinationLng,
    locationLat,
    locationLng,
  ) <= radiusKm
}

function normalizeLocationText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function coordinateDistanceKm(firstLat, firstLng, secondLat, secondLng) {
  const toRadians = (value) => value * (Math.PI / 180)
  const latitudeDifference = toRadians(secondLat - firstLat)
  const longitudeDifference = toRadians(secondLng - firstLng)
  const firstLatitude = toRadians(firstLat)
  const secondLatitude = toRadians(secondLat)
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude)
      * Math.sin(longitudeDifference / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}
