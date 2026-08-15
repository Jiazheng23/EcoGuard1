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
].join(', ')

export async function createTrip(payload) {
  const { data, error } = await supabase
    .from('trips')
    .insert(payload)
    .select(tripColumns)
    .single()

  if (error) throw error
  return data
}

export async function listOwnTrips(touristId, limit = 250) {
  const { data, error } = await supabase
    .from('trips')
    .select(tripColumns)
    .eq('tourist_id', touristId)
    .order('travelled_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function listAllTrips(limit = 2000) {
  const { data, error } = await supabase
    .from('trips')
    .select(tripColumns)
    .order('travelled_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
