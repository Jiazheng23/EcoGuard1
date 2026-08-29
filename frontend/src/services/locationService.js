import { supabase } from './supabaseClient'

function throwIfError(error) {
  if (error) throw error
}

export async function listEcologicalLocations({ activeOnly = false } = {}) {
  let query = supabase
    .from('ecological_locations')
    .select('*')
    .order('name', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  throwIfError(error)
  return data || []
}

export async function createEcologicalLocation(userId, values) {
  const payload = normalizeLocation(values)
  const { data, error } = await supabase
    .from('ecological_locations')
    .insert({ ...payload, created_by: userId })
    .select()
    .single()

  throwIfError(error)
  return data
}

export async function updateEcologicalLocation(locationId, values) {
  const { data, error } = await supabase
    .from('ecological_locations')
    .update(normalizeLocation(values))
    .eq('id', locationId)
    .select()
    .single()

  throwIfError(error)
  return data
}

export async function deleteEcologicalLocation(locationId) {
  const { error } = await supabase
    .from('ecological_locations')
    .delete()
    .eq('id', locationId)

  throwIfError(error)
}

export async function listCrowdThresholds() {
  const { data, error } = await supabase
    .from('crowd_thresholds')
    .select('*')

  throwIfError(error)
  return data || []
}

export async function saveCrowdThreshold(userId, values) {
  const payload = {
    location_id: Number(values.location_id),
    caution_percent: Number(values.caution_percent),
    warning_percent: Number(values.warning_percent),
    critical_percent: Number(values.critical_percent),
    auto_alerts: Boolean(values.auto_alerts),
    notification_email: values.notification_email?.trim() || null,
    updated_by: userId,
  }
  const { data, error } = await supabase
    .from('crowd_thresholds')
    .upsert(payload, { onConflict: 'location_id' })
    .select()
    .single()

  throwIfError(error)
  return data
}

export async function listLocationMetrics({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from('location_metrics')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit)

  throwIfError(error)
  return data || []
}

export async function listLocationSensorControls() {
  const { data, error } = await supabase
    .from('location_sensor_controls')
    .select('*')
    .order('location_id', { ascending: true })

  throwIfError(error)
  return data || []
}

export async function saveLocationSensorControl(userId, locationId, isEnabled) {
  const payload = {
    location_id: Number(locationId),
    is_enabled: Boolean(isEnabled),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }
  const { data, error } = await supabase
    .from('location_sensor_controls')
    .upsert(payload, { onConflict: 'location_id' })
    .select()
    .single()

  throwIfError(error)
  return data
}

export async function listTouristEnvironmentalIndicators() {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('get_tourist_environmental_indicators')
  throwIfError(error)
  return data || []
}

export function subscribeToEnvironmentalIndicators(onChange) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel('tourist-environmental-indicators')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'location_metrics' },
      (payload) => onChange?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'location_metrics' },
      (payload) => onChange?.(payload.new),
    )
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}

export function latestMetricsByLocation(metrics) {
  return (metrics || []).reduce((latest, metric) => {
    const key = String(metric.location_id)
    const currentTimestamp = new Date(latest[key]?.recorded_at || 0).getTime()
    const candidateTimestamp = new Date(metric.recorded_at || 0).getTime()
    if (!latest[key] || candidateTimestamp >= currentTimestamp) latest[key] = metric
    return latest
  }, {})
}

function normalizeMetric(values) {
  return {
    location_id: Number(values.location_id),
    crowd_count: Math.max(0, Math.round(Number(values.crowd_count) || 0)),
    waste_kg: Math.max(0, Number(values.waste_kg) || 0),
    recycled_kg: Math.max(0, Number(values.recycled_kg) || 0),
    air_quality_index: clamp(Math.round(Number(values.air_quality_index) || 0), 0, 500),
    water_quality_score: clamp(Number(values.water_quality_score) || 0, 0, 100),
    temperature_c: values.temperature_c === '' || values.temperature_c == null
      ? null
      : Number(values.temperature_c),
    source: values.source || 'simulated',
    recorded_at: new Date().toISOString(),
  }
}

export async function saveCurrentLocationMetric(values) {
  const payload = {
    ...normalizeMetric(values),
  }

  let metricId = values.id ? Number(values.id) : null
  if (!metricId) {
    const { data: latest, error: lookupError } = await supabase
      .from('location_metrics')
      .select('id')
      .eq('location_id', payload.location_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    throwIfError(lookupError)
    metricId = latest?.id || null
  }

  if (metricId) {
    const { data, error } = await supabase
      .from('location_metrics')
      .update(payload)
      .eq('id', metricId)
      .eq('location_id', payload.location_id)
      .select()
      .single()

    throwIfError(error)
    return data
  }

  const { data, error } = await supabase
    .from('location_metrics')
    .insert(payload)
    .select()
    .single()

  throwIfError(error)
  return data
}

export function createSimulatedMetric(location, previous) {
  const baseline = previous || {
    crowd_count: Math.round(Number(location.max_capacity) * 0.35),
    waste_kg: Number(location.max_capacity) * 0.018,
    recycled_kg: Number(location.max_capacity) * 0.009,
    air_quality_index: 48,
    water_quality_score: 86,
    temperature_c: 27,
  }

  const drift = (value, amount, min, max, decimals = 0) => {
    const next = clamp(Number(value) + (Math.random() * 2 - 1) * amount, min, max)
    return Number(next.toFixed(decimals))
  }

  const waste = drift(baseline.waste_kg, 0.35, 0, Number(location.max_capacity) * 0.08, 2)
  const recycled = drift(baseline.recycled_kg, 0.22, 0, waste, 2)

  return {
    id: previous?.id,
    location_id: location.id,
    crowd_count: drift(baseline.crowd_count, Math.max(2, Number(location.max_capacity) * 0.012), 0, Number(location.max_capacity)),
    waste_kg: waste,
    recycled_kg: recycled,
    air_quality_index: drift(baseline.air_quality_index, 2, 0, 500),
    water_quality_score: drift(baseline.water_quality_score, 0.7, 0, 100, 1),
    temperature_c: drift(baseline.temperature_c ?? 27, 0.25, -10, 55, 1),
    source: 'simulated',
  }
}

function normalizeLocation(values) {
  return {
    name: values.name.trim(),
    state: values.state.trim(),
    location_type: values.location_type.trim(),
    description: values.description?.trim() || null,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    max_capacity: Math.max(1, Math.round(Number(values.max_capacity) || 1)),
    operating_hours: values.operating_hours?.trim() || null,
    best_visit_time: values.best_visit_time?.trim() || null,
    alternative_location: values.alternative_location?.trim() || null,
    wallpaper_url: values.wallpaper_url?.trim() || null,
    gallery_urls: Array.isArray(values.gallery_urls) ? values.gallery_urls.filter(Boolean) : [],
    is_active: values.is_active !== false,
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
