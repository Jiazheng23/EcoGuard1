export const westMalaysiaStates = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
  'Penang', 'Perak', 'Perlis', 'Selangor', 'Terengganu',
  'Kuala Lumpur', 'Putrajaya',
]

export function isWestMalaysiaCoordinate(lat, lng) {
  return Number(lat) >= 1 && Number(lat) <= 6.85 && Number(lng) >= 99.5 && Number(lng) <= 104.8
}

const stateAliases = {
  'pulau pinang': 'Penang',
  malacca: 'Melaka',
  'federal territory of kuala lumpur': 'Kuala Lumpur',
  'wilayah persekutuan kuala lumpur': 'Kuala Lumpur',
  'federal territory of putrajaya': 'Putrajaya',
  'wilayah persekutuan putrajaya': 'Putrajaya',
}

export function normalizeWestMalaysiaState(value) {
  const clean = String(value || '').trim()
  const alias = stateAliases[clean.toLowerCase()]
  if (alias) return alias
  return westMalaysiaStates.find((state) => state.toLowerCase() === clean.toLowerCase()) || ''
}

export function isWestMalaysiaLocation(location) {
  return Boolean(normalizeWestMalaysiaState(location?.state))
    && isWestMalaysiaCoordinate(location?.latitude ?? location?.lat, location?.longitude ?? location?.lng)
}

// Map search results use their coordinates as the stable identity for an
// address. Five decimal places is precise to roughly one metre in Malaysia.
export function isSameMappedAddress(first, second, tolerance = 0.00001) {
  const rawCoordinates = [
    first?.latitude ?? first?.lat,
    first?.longitude ?? first?.lng,
    second?.latitude ?? second?.lat,
    second?.longitude ?? second?.lng,
  ]
  if (rawCoordinates.some((value) => value === '' || value == null)) return false

  const [firstLatitude, firstLongitude, secondLatitude, secondLongitude] = rawCoordinates.map(Number)

  if (![firstLatitude, firstLongitude, secondLatitude, secondLongitude].every(Number.isFinite)) return false
  return Math.abs(firstLatitude - secondLatitude) <= tolerance
    && Math.abs(firstLongitude - secondLongitude) <= tolerance
}

export function inferWestMalaysiaState(address) {
  const normalized = String(address || '').toLowerCase()
  return westMalaysiaStates.find((state) => normalized.includes(state.toLowerCase()))
    || (normalized.includes('pulau pinang') ? 'Penang' : '')
}
