import { supabase } from './supabaseClient'

const tripColumns = [
  'id',
  'tourist_id',
  'starting_location',
  'destination',
  'transport_mode',
  'distance_km',
  'passengers',
  'round_trip',
  'carbon_emission',
  'total_emission',
  'eco_points',
  'travelled_at',
  'origin_lat',
  'origin_lng',
  'destination_lat',
  'destination_lng',
  'route_legs',
].join(', ')

const tripColumnsWithCarPowertrain = `${tripColumns}, car_powertrain`

export async function createTrip(payload) {
  let { data, error } = await insertTrip(payload)

  if (error && payload.car_powertrain === 'petrol' && isMissingCarPowertrainColumn(error)) {
    const petrolFallback = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== 'car_powertrain'),
    )
    ;({ data, error } = await insertTrip(petrolFallback))
  }

  if (error && payload.car_powertrain === 'electricity' && isMissingCarPowertrainColumn(error)) {
    throw new Error(
      'Electric car saving is not enabled in the database yet. Apply supabase/trip_emissions_and_eco_score.sql when you are ready.',
    )
  }

  if (error) throw error
  return data && payload.car_powertrain
    ? { ...data, car_powertrain: payload.car_powertrain }
    : data
}

function insertTrip(payload) {
  return supabase
    .from('trips')
    .insert(payload)
    .select(tripColumns)
    .single()
}

function isMissingCarPowertrainColumn(error) {
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /car_powertrain/i.test(error?.message || '')
  )
}

export async function listOwnTrips(touristId, limit = 250) {
  let { data, error } = await selectOwnTrips(
    touristId,
    limit,
    tripColumnsWithCarPowertrain,
  )

  if (error && isMissingCarPowertrainColumn(error)) {
    ;({ data, error } = await selectOwnTrips(touristId, limit, tripColumns))
  }

  if (error) throw error
  return data || []
}

function selectOwnTrips(touristId, limit, columns) {
  return supabase
    .from('trips')
    .select(columns)
    .eq('tourist_id', touristId)
    .order('travelled_at', { ascending: false })
    .limit(limit)
}

export async function listAllTrips(limit = 2000) {
  let { data, error } = await selectAllTrips(limit, tripColumnsWithCarPowertrain)

  if (error && isMissingCarPowertrainColumn(error)) {
    ;({ data, error } = await selectAllTrips(limit, tripColumns))
  }

  if (error) throw error
  return data || []
}

function selectAllTrips(limit, columns) {
  return supabase
    .from('trips')
    .select(columns)
    .order('travelled_at', { ascending: false })
    .limit(limit)
}
