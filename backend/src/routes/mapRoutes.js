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
    const coordinatePath =
      `${originLng},${originLat};` +
      `${destinationLng},${destinationLat}`

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${coordinatePath}` +
      `?overview=full&geometries=geojson`

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