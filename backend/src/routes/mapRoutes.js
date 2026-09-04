import { Router } from 'express'

const router = Router()

const MALAYSIA_LIMITS = {
  minLat: 0.8,
  maxLat: 7.6,
  minLng: 99.5,
  maxLng: 119.5,
}

const cache = new Map()
const CACHE_DURATION = 24 * 60 * 60 * 1000

const ROUTING_MODES = {
  car: {
    profile: 'driving',
    endpointEnv: 'OSRM_DRIVING_URL',
    defaultEndpoint: 'https://router.project-osrm.org/route/v1/driving',
  },
  motorcycle: {
    profile: 'driving',
    endpointEnv: 'OSRM_DRIVING_URL',
    defaultEndpoint: 'https://router.project-osrm.org/route/v1/driving',
  },
  bicycle: {
    profile: 'cycling',
    endpointEnv: 'OSRM_CYCLING_URL',
    defaultEndpoint: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  },
  walking: {
    profile: 'walking',
    endpointEnv: 'OSRM_WALKING_URL',
    defaultEndpoint: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  },
  bus: {
    profile: 'public-transport',
    provider: 'transitous',
    transitModes: 'BUS',
  },
  mrt: {
    profile: 'public-transport',
    provider: 'transitous',
    // Transitous may need to consider walking and feeder services before it can
    // build a rail journey. We still prefer an itinerary containing rail below.
    transitModes: 'TRANSIT',
    preferredTransitModes: ['RAIL', 'SUBWAY', 'TRAM', 'METRO', 'MONORAIL'],
  },
  mixed: {
    profile: 'mixed-transport',
    provider: 'transitous',
    transitModes: 'TRANSIT',
    preTransitModes: 'WALK,CAR',
    postTransitModes: 'WALK',
  },
}

let nominatimQueue = Promise.resolve()
let lastNominatimRequest = 0

function isValidCoordinate(value) {
  return Number.isFinite(Number(value))
}

function isInsideMalaysiaBox(lat, lng) {
  return (
    lat >= MALAYSIA_LIMITS.minLat &&
    lat <= MALAYSIA_LIMITS.maxLat &&
    lng >= MALAYSIA_LIMITS.minLng &&
    lng <= MALAYSIA_LIMITS.maxLng
  )
}

function getCachedValue(key) {
  const cached = cache.get(key)

  if (!cached) return null

  if (Date.now() - cached.savedAt > CACHE_DURATION) {
    cache.delete(key)
    return null
  }

  return cached.data
}

function saveCache(key, data) {
  cache.set(key, {
    data,
    savedAt: Date.now(),
  })
}

export function resolveRoutingMode(value) {
  const requestedMode = String(value || 'car').trim().toLowerCase()
  const aliases = {
    bike: 'bicycle',
    cycling: 'bicycle',
    foot: 'walking',
    lrt: 'mrt',
    'mrt/lrt': 'mrt',
    'lrt/mrt': 'mrt',
    mix: 'mixed',
    multimodal: 'mixed',
    'mixed transport': 'mixed',
  }
  const mode = aliases[requestedMode] || requestedMode

  if (mode === 'public-transport' || mode === 'public_transport' || mode === 'transit') {
    return { mode: 'bus', ...ROUTING_MODES.bus }
  }

  return ROUTING_MODES[mode] ? { mode, ...ROUTING_MODES[mode] } : undefined
}

export function decodePolyline(encoded = '', precision = 5) {
  const coordinates = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    const deltas = []
    for (let coordinate = 0; coordinate < 2; coordinate += 1) {
      let result = 0
      let shift = 0
      let byte
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20 && index <= encoded.length)
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1)
    }
    latitude += deltas[0]
    longitude += deltas[1]
    const factor = 10 ** precision
    coordinates.push([latitude / factor, longitude / factor])
  }

  return coordinates
}

function coordinateDistanceMeters([lat1, lng1], [lat2, lng2]) {
  const radians = (degrees) => degrees * Math.PI / 180
  const earthRadius = 6371000
  const latitudeDelta = radians(lat2 - lat1)
  const longitudeDelta = radians(lng2 - lng1)
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function polylineDistanceMeters(coordinates) {
  return coordinates.slice(1).reduce(
    (total, coordinate, index) => total + coordinateDistanceMeters(coordinates[index], coordinate),
    0,
  )
}

export function mapTransitousItinerary(itinerary, requestedMode = 'bus') {
  const legs = itinerary.legs || []
  const decodedLegs = legs.map((leg) => ({
    leg,
    coordinates: decodePolyline(
      leg.legGeometry?.points,
      Number(leg.legGeometry?.precision) || 6,
    ),
  }))
  const coordinates = decodedLegs.flatMap(({ coordinates: legCoordinates }, index) => {
    return index > 0 && legCoordinates.length ? legCoordinates.slice(1) : legCoordinates
  })
  const distanceMeters = decodedLegs.reduce(
    (total, { leg, coordinates: legCoordinates }) =>
      total + (Number(leg.distance) || polylineDistanceMeters(legCoordinates)),
    0,
  )

  return {
    mode: requestedMode,
    profile: 'public-transport',
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(Number(itinerary.duration || 0) / 60)),
    coordinates,
    provider: 'Transitous',
    legs: decodedLegs.map(({ leg, coordinates: legCoordinates }) => ({
      mode: String(leg.mode || '').toLowerCase(),
      route: leg.routeShortName || leg.displayName || leg.routeLongName || null,
      transportLabel: transitLegLabel(leg),
      headsign: leg.headsign || null,
      from: leg.from?.name || null,
      to: leg.to?.name || null,
      distanceKm: Number(((Number(leg.distance) || polylineDistanceMeters(legCoordinates)) / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(Number(leg.duration || 0) / 60)),
    })),
  }
}

function transitLegLabel(leg) {
  const mode = String(leg.mode || '').toUpperCase()
  const routeName = `${leg.routeLongName || ''} ${leg.displayName || ''}`.toUpperCase()

  if (mode === 'WALK' || mode === 'FOOT') return 'Walk'
  if (mode === 'CAR') return 'Car'
  if (mode === 'BUS' || mode === 'COACH') return 'Bus'
  if (routeName.includes('LRT') || routeName.includes('LIGHT RAIL')) return 'LRT'
  if (routeName.includes('MRT') || routeName.includes('MASS RAPID')) return 'MRT'
  if (mode === 'MONORAIL') return 'Monorail'
  if (['RAIL', 'SUBWAY', 'TRAM', 'METRO'].includes(mode)) return 'LRT / MRT'
  return mode ? mode.charAt(0) + mode.slice(1).toLowerCase() : 'Public transport'
}

export function estimateTransitousItineraryEmissionG(itinerary) {
  const factorByLabel = {
    Car: 135.45,
    Bus: 45.45,
    LRT: 70,
    MRT: 70,
    'LRT / MRT': 70,
    Monorail: 70,
  }

  return (itinerary.legs || []).reduce((total, leg) => {
    const coordinates = decodePolyline(
      leg.legGeometry?.points,
      Number(leg.legGeometry?.precision) || 6,
    )
    const distanceKm = (Number(leg.distance) || polylineDistanceMeters(coordinates)) / 1000
    return total + distanceKm * (factorByLabel[transitLegLabel(leg)] || 0)
  }, 0)
}

export function selectTransitousItinerary(itineraries = [], routingMode) {
  if (routingMode.mode === 'mixed') {
    return [...itineraries].sort((left, right) => {
      const emissionDifference = estimateTransitousItineraryEmissionG(left) -
        estimateTransitousItineraryEmissionG(right)
      return emissionDifference || Number(left.duration || 0) - Number(right.duration || 0)
    })[0] || null
  }

  if (routingMode.mode !== 'mrt') return itineraries[0] || null

  const preferredModes = new Set(routingMode.preferredTransitModes || [])
  return itineraries.find((itinerary) =>
    itinerary.legs?.some((leg) => preferredModes.has(String(leg.mode || '').toUpperCase())),
  ) || null
}

async function fetchTransitousRoute({ originLat, originLng, destinationLat, destinationLng, routingMode }) {
  const endpoint = process.env.TRANSITOUS_API_URL || 'https://api.transitous.org/api/v6/plan'
  const contactEmail = process.env.MAP_CONTACT_EMAIL
  if (!contactEmail) throw new Error('MAP_CONTACT_EMAIL is required by the Transitous usage policy.')
  const params = new URLSearchParams({
    fromPlace: `${originLat},${originLng}`,
    toPlace: `${destinationLat},${destinationLng}`,
    time: new Date().toISOString(),
    transitModes: routingMode.transitModes,
    directModes: '',
    preTransitModes: routingMode.preTransitModes || 'WALK',
    postTransitModes: routingMode.postTransitModes || 'WALK',
    arriveBy: 'false',
    numItineraries: ['mrt', 'mixed'].includes(routingMode.mode) ? '5' : '1',
    maxItineraries: ['mrt', 'mixed'].includes(routingMode.mode) ? '5' : '1',
    maxPreTransitTime: routingMode.mode === 'mixed' ? '1800' : '900',
    detailedLegs: 'true',
    language: 'en',
  })
  const url = `${endpoint.replace(/\/?$/, '')}?${params.toString()}`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': `EcoGuard-EEWS/1.0 (academic project; contact: ${contactEmail})`,
    },
    signal: AbortSignal.timeout(30000),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Transitous returned ${response.status}.`)
  }

  const itinerary = selectTransitousItinerary(data.itineraries, routingMode)
  if (!itinerary) return null
  return mapTransitousItinerary(itinerary, routingMode.mode)
}

export function buildOsrmRouteUrl(routingMode, coordinatePath) {
  const endpoint = (
    process.env[routingMode.endpointEnv] || routingMode.defaultEndpoint
  ).replace(/\/+$/, '')

  return `${endpoint}/${coordinatePath}?overview=full&geometries=geojson`
}

function queueNominatimRequest(task) {
  const run = async () => {
    const elapsed = Date.now() - lastNominatimRequest
    const waitTime = Math.max(0, 1100 - elapsed)

    if (waitTime > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, waitTime)
      })
    }

    lastNominatimRequest = Date.now()
    return task()
  }

  const result = nominatimQueue.then(run, run)

  nominatimQueue = result.catch(() => {})

  return result
}

async function fetchNominatim(url) {
  const cached = getCachedValue(url)

  if (cached) return cached

  const contactEmail = process.env.MAP_CONTACT_EMAIL

  if (!contactEmail) {
    throw new Error('MAP_CONTACT_EMAIL is not configured.')
  }

  const data = await queueNominatimRequest(async () => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en,ms;q=0.9',
        'User-Agent':
          `EcoGuard-EEWS/1.0 ` +
          `(academic project; contact: ${contactEmail})`,
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(
        `Location service returned ${response.status}.`,
      )
    }

    return response.json()
  })

  saveCache(url, data)

  return data
}

router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim()

  if (query.length < 2) {
    return res.status(400).json({
      error: 'Enter at least 2 characters.',
    })
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'my',
      limit: '5',
      bounded: '1',
      viewbox: '99.5,7.6,119.5,0.8',
    })

    const url =
      `https://nominatim.openstreetmap.org/search?` +
      params.toString()

    const data = await fetchNominatim(url)

    const locations = data
      .filter(
        (item) =>
          item.address?.country_code?.toLowerCase() === 'my',
      )
      .map((item) => ({
        id: item.place_id,
        name: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        type: item.type,
        state: item.address?.state || item.address?.territory || item.address?.region || '',
      }))

    return res.json({ locations })
  } catch (error) {
    console.error('Location search failed:', error)

    return res.status(502).json({
      error:
        error.message || 'Unable to search for locations.',
    })
  }
})

router.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)

  if (
    !isValidCoordinate(lat) ||
    !isValidCoordinate(lng)
  ) {
    return res.status(400).json({
      error: 'Valid latitude and longitude are required.',
    })
  }

  if (!isInsideMalaysiaBox(lat, lng)) {
    return res.status(400).json({
      error: 'Please select a location within Malaysia.',
    })
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
    })

    const url =
      `https://nominatim.openstreetmap.org/reverse?` +
      params.toString()

    const data = await fetchNominatim(url)

    if (
      data.address?.country_code?.toLowerCase() !== 'my'
    ) {
      return res.status(400).json({
        error: 'Please select a location within Malaysia.',
      })
    }

    return res.json({
      location: {
        id: data.place_id,
        name:
          data.display_name ||
          `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      },
    })
  } catch (error) {
    console.error('Reverse geocoding failed:', error)

    return res.status(502).json({
      error:
        error.message ||
        'Unable to retrieve the location name.',
    })
  }
})

router.get('/route', async (req, res) => {
  const originLat = Number(req.query.originLat)
  const originLng = Number(req.query.originLng)
  const destinationLat = Number(req.query.destinationLat)
  const destinationLng = Number(req.query.destinationLng)
  const routingMode = resolveRoutingMode(req.query.mode)

  if (!routingMode) {
    return res.status(400).json({
      error: 'Unsupported transport mode. Use car, motorcycle, bicycle, walking, bus, mrt, or mixed.',
    })
  }

  const coordinates = [
    originLat,
    originLng,
    destinationLat,
    destinationLng,
  ]

  if (!coordinates.every(isValidCoordinate)) {
    return res.status(400).json({
      error: 'Valid origin and destination are required.',
    })
  }

  if (
    !isInsideMalaysiaBox(originLat, originLng) ||
    !isInsideMalaysiaBox(
      destinationLat,
      destinationLng,
    )
  ) {
    return res.status(400).json({
      error: 'Both locations must be within Malaysia.',
    })
  }

  try {
    if (routingMode.provider === 'transitous') {
      const route = await fetchTransitousRoute({
        originLat,
        originLng,
        destinationLat,
        destinationLng,
        routingMode,
      })

      if (!route) {
        return res.status(404).json({
          error: 'No scheduled public-transport route was found for these locations and departure time.',
          code: 'NO_TRANSIT_ITINERARY',
        })
      }

      return res.json(route)
    }

    const coordinatePath =
      `${originLng},${originLat};` +
      `${destinationLng},${destinationLat}`

    const url = buildOsrmRouteUrl(routingMode, coordinatePath)

    const cached = getCachedValue(url)

    let data = cached

    if (!data) {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20000),
      })

      if (!response.ok) {
        throw new Error(
          `Routing service returned ${response.status}.`,
        )
      }

      data = await response.json()
      saveCache(url, data)
    }

    const route = data.routes?.[0]

    if (!route) {
      return res.status(404).json({
        error:
          'No road route was found between these locations.',
      })
    }

    return res.json({
      mode: routingMode.mode,
      profile: routingMode.profile,
      distanceKm: Number(
        (route.distance / 1000).toFixed(2),
      ),
      durationMinutes: Math.round(route.duration / 60),
      coordinates: route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng],
      ),
    })
  } catch (error) {
    console.error('Route calculation failed:', error)

    return res.status(502).json({
      error:
        error.message || 'Unable to calculate the route.',
    })
  }
})

export default router
