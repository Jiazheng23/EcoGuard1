export const CAR_POWERTRAINS = {
  petrol: 'petrol',
  electricity: 'electricity',
}

export const CAR_POWERTRAIN_OPTIONS = [
  {
    id: CAR_POWERTRAINS.petrol,
    label: 'Petrol',
    factorG: 135.45,
  },
  {
    id: CAR_POWERTRAINS.electricity,
    label: 'Electricity',
    factorG: 92.45,
  },
]

export const TRANSPORT_EMISSION_FACTORS_G = {
  motorcycle: 41.57,
  bus: 45.45,
  walking: 0,
  bicycle: 0,
}

export function recommendedModeForDistance(distanceKm) {
  const distance = positiveNumber(distanceKm)

  if (distance <= 2) return 'walking'
  if (distance <= 10) return 'bicycle'
  return 'bus'
}

export function getEmissionFactorG(
  mode,
  carPowertrain = CAR_POWERTRAINS.petrol,
) {
  if (mode === 'car') {
    return carPowertrain === CAR_POWERTRAINS.electricity ? 92.45 : 135.45
  }

  return TRANSPORT_EMISSION_FACTORS_G[mode] ?? 0
}

export function calculateTripEnvironmentalImpact({
  mode,
  distanceKm,
  passengers = 1,
  roundTrip = false,
  carPowertrain = CAR_POWERTRAINS.petrol,
}) {
  const distance = positiveNumber(distanceKm)
  const passengerCount = Math.max(1, Math.trunc(positiveNumber(passengers) || 1))
  const distanceMultiplier = roundTrip ? 2 : 1
  const factorG = getEmissionFactorG(mode, carPowertrain)
  const carbonEmissionKg = roundToTwo((factorG * distance * distanceMultiplier) / 1000)
  const totalEmissionKg = roundToTwo(carbonEmissionKg * passengerCount)
  const recommendation = recommendedModeForDistance(distance)
  const modeDistancePoints = getModeDistancePoints(mode, distance)
  const emissionPoints = getEmissionPoints(carbonEmissionKg)
  const recommendationPoints = mode === recommendation ? 3 : 0
  const ecoPoints = clamp(
    modeDistancePoints + emissionPoints + recommendationPoints,
    -10,
    10,
  )

  return {
    factorG,
    carbonEmissionKg,
    totalEmissionKg,
    ecoPoints,
    recommendedMode: recommendation,
    isRecommended: mode === recommendation,
    breakdown: {
      modeDistancePoints,
      emissionPoints,
      recommendationPoints,
    },
  }
}

function getModeDistancePoints(mode, distanceKm) {
  switch (mode) {
    case 'walking':
      return distanceKm <= 2 ? 5 : 2
    case 'bicycle':
      return distanceKm <= 10 ? 5 : 2
    case 'bus':
      return distanceKm <= 10 ? 3 : 1
    case 'motorcycle':
      return distanceKm <= 10 ? 1 : 0
    case 'car':
      return distanceKm <= 10 ? -4 : -6
    default:
      return 0
  }
}

function getEmissionPoints(carbonEmissionKg) {
  if (carbonEmissionKg <= 1) return 2
  if (carbonEmissionKg <= 5) return 0
  if (carbonEmissionKg <= 15) return -3
  return -6
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function roundToTwo(value) {
  return Math.round((value + 1e-10) * 100) / 100
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}
