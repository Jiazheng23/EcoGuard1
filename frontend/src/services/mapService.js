async function request(url) {
  const response = await fetch(url)

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error || 'Map service request failed.',
    )
  }

  return data
}

export async function searchMalaysiaLocations(query) {
  const data = await request(
    `/api/maps/search?q=${encodeURIComponent(query)}`,
  )

  return data.locations
}

export async function reverseMalaysiaLocation(lat, lng) {
  const data = await request(
    `/api/maps/reverse?lat=${lat}&lng=${lng}`,
  )

  return data.location
}

export async function calculateMalaysiaRoute(
  origin,
  destination,
  mode = 'car',
) {
  const params = new URLSearchParams({
    originLat: String(origin.lat),
    originLng: String(origin.lng),
    destinationLat: String(destination.lat),
    destinationLng: String(destination.lng),
    mode,
  })

  return request(`/api/maps/route?${params.toString()}`)
}
