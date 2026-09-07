import { supabase } from './supabaseClient'
import {
  WasteValidationError,
  assertWasteValidation,
  normalizeWasteCollection,
  normalizeWasteSchedule,
  normalizeWasteThresholds,
  validateWasteCollection,
  validateWasteSchedule,
  validateWasteThresholds,
} from '../utils/wasteValidation'
import { summarizeWasteCollections } from '../utils/wasteAnalytics'

export { summarizeWasteCollections } from '../utils/wasteAnalytics'

const DEFAULT_LIMIT = 500

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

function asIsoFilter(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new WasteValidationError({ date: 'Enter a valid filter date.' })
  return date.toISOString()
}

function parseLimit(value) {
  const limit = Number(value || DEFAULT_LIMIT)
  return Math.min(2000, Math.max(1, Number.isFinite(limit) ? Math.round(limit) : DEFAULT_LIMIT))
}

function throwFriendlyWasteError(error) {
  if (!error || error instanceof WasteValidationError) throw error

  const messages = {
    '23P01': 'This collection period conflicts with another active schedule for the location.',
    '23503': 'The selected location, schedule, or administrator record no longer exists.',
    '23505': 'A collection already exists for this schedule, or this alert already has an active schedule. Refresh and use the existing record.',
    '23514': error.message || 'The waste record violates one of the required status or quantity rules.',
    'PGRST204': 'The waste alert workflow is not installed. Apply supabase/waste_alert_workflow.sql first.',
    '22007': 'The selected date or time is not allowed.',
    '42501': 'You do not have permission to manage waste data for this location.',
    '42P01': 'Waste Management tables are not available. Apply supabase/waste_management.sql first.',
  }
  const friendly = new Error(messages[error.code] || error.message || 'The waste-management request failed.')
  friendly.code = error.code
  friendly.cause = error
  throw friendly
}

export async function listWasteAlertHistory(locationIds) {
  requireSupabase()
  if (!locationIds.length) return []
  return readWastePages(() => supabase.from('early_warning_alerts').select('*')
    .eq('category', 'waste').in('location_id', locationIds)
    .order('created_at', { ascending: false }).order('id', { ascending: false }))
}

async function readWastePages(makeQuery) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await makeQuery().range(offset, offset + 499)
    if (error) throwFriendlyWasteError(error)
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}

export async function listWasteOperations(locationIds) {
  requireSupabase()
  if (!locationIds.length) return { schedules: [], collections: [] }
  const [schedules, collections] = await Promise.all([
    readWastePages(() => supabase.from('waste_collection_schedules').select('*').in('location_id', locationIds).order('id', { ascending: false })),
    readWastePages(() => supabase.from('waste_collection_records').select('*').in('location_id', locationIds).order('id', { ascending: false })),
  ])
  return { schedules, collections }
}

export function subscribeToWasteOperations(onChange) {
  if (!supabase) return () => {}
  let timer
  const refresh = () => {
    globalThis.clearTimeout(timer)
    timer = globalThis.setTimeout(onChange, 300)
  }
  let channel = supabase.channel(`waste-operations-${crypto.randomUUID()}`)
  for (const table of ['early_warning_alerts', 'waste_collection_schedules', 'waste_collection_records']) {
    channel = channel.on('postgres_changes', {
      event: '*', schema: 'public', table,
      ...(table === 'early_warning_alerts' ? { filter: 'category=eq.waste' } : {}),
    }, refresh)
  }
  channel.subscribe()
  return () => { globalThis.clearTimeout(timer); void supabase.removeChannel(channel) }
}

export async function listWasteSchedules(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('waste_collection_schedules')
    .select('*')
    .order('scheduled_for', { ascending: false })
    .limit(parseLimit(filters.limit))

  if (filters.locationId && filters.locationId !== 'all') query = query.eq('location_id', Number(filters.locationId))
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.wasteType && filters.wasteType !== 'all') query = query.eq('waste_type', filters.wasteType)
  if (filters.from) query = query.gte('scheduled_until', asIsoFilter(filters.from))
  if (filters.to) query = query.lte('scheduled_for', asIsoFilter(filters.to))

  const { data, error } = await query
  if (error) throwFriendlyWasteError(error)
  return data || []
}

export async function createWasteSchedule(values) {
  requireSupabase()
  assertWasteValidation(validateWasteSchedule(values))
  const { data, error } = await supabase
    .from('waste_collection_schedules')
    .insert(normalizeWasteSchedule(values))
    .select('*')
    .single()

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function updateWasteSchedule(scheduleId, values) {
  requireSupabase()
  assertWasteValidation(validateWasteSchedule(values, { requireFuture: values.status === 'scheduled' }))
  const { data, error } = await supabase
    .from('waste_collection_schedules')
    .update(normalizeWasteSchedule(values))
    .eq('id', Number(scheduleId))
    .select('*')
    .single()

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function cancelWasteSchedule(scheduleId) {
  return updateWasteScheduleStatus(scheduleId, 'cancelled')
}

export async function linkWasteScheduleToAlert(scheduleId, alertId) {
  requireSupabase()
  const { data, error } = await supabase.from('waste_collection_schedules')
    .update({ alert_id: Number(alertId) }).eq('id', Number(scheduleId))
    .eq('status', 'scheduled').is('alert_id', null).select('*').single()
  if (error) throwFriendlyWasteError(error)
  return data
}

async function updateWasteScheduleStatus(scheduleId, status) {
  requireSupabase()
  const { data, error } = await supabase
    .from('waste_collection_schedules')
    .update({ status })
    .eq('id', Number(scheduleId))
    .eq('status', 'scheduled')
    .select('*')
    .single()

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function listWasteCollections(filters = {}) {
  requireSupabase()
  let query = supabase
    .from('waste_collection_records')
    .select('*')
    .order('collected_at', { ascending: false })
    .limit(parseLimit(filters.limit))

  if (filters.locationId && filters.locationId !== 'all') query = query.eq('location_id', Number(filters.locationId))
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.source && filters.source !== 'all') query = query.eq('source', filters.source)
  if (filters.wasteType && filters.wasteType !== 'all') query = query.eq('waste_type', filters.wasteType)
  if (filters.from) query = query.gte('collected_at', asIsoFilter(filters.from))
  if (filters.to) query = query.lte('collected_at', asIsoFilter(filters.to))

  const { data, error } = await query
  if (error) throwFriendlyWasteError(error)
  return data || []
}

export async function createWasteCollection(values) {
  if (values.schedule_id) return completeScheduledWasteCollection(values.schedule_id, values)
  return createUnscheduledWasteCollection(values)
}

export async function createUnscheduledWasteCollection(values) {
  requireSupabase()
  assertWasteValidation(validateWasteCollection(values))
  const payload = normalizeWasteCollection(values)
  delete payload.schedule_id
  const { data, error } = await supabase
    .from('waste_collection_records')
    .insert(payload)
    .select('*')
    .single()

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function completeScheduledWasteCollection(scheduleId, values) {
  requireSupabase()
  assertWasteValidation(validateWasteCollection(values, { requireLocation: false, requireWasteType: false }))
  const normalized = normalizeWasteCollection(values)
  const { data, error } = await supabase.rpc('complete_waste_collection', {
    p_schedule_id: Number(scheduleId),
    p_collected_at: normalized.collected_at,
    p_total_kg: normalized.total_kg,
    p_recycled_kg: normalized.recycled_kg,
    p_status: normalized.status,
    p_source: normalized.source,
    p_notes: normalized.notes,
  })

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function listWasteThresholds() {
  requireSupabase()
  const { data, error } = await supabase
    .from('waste_thresholds')
    .select('*')
    .order('location_id', { ascending: true })

  if (error) throwFriendlyWasteError(error)
  return data || []
}

export async function saveWasteThreshold(values) {
  requireSupabase()
  assertWasteValidation(validateWasteThresholds(values))
  const { data, error } = await supabase
    .from('waste_thresholds')
    .upsert(normalizeWasteThresholds(values), { onConflict: 'location_id' })
    .select('*')
    .single()

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function listWasteReportExports({ limit = 100 } = {}) {
  requireSupabase()
  const { data, error } = await supabase
    .from('waste_report_exports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(parseLimit(limit))

  if (error) throwFriendlyWasteError(error)
  return data || []
}

export async function recordWasteReportExport(values) {
  requireSupabase()
  const payload = {
    location_id: values.locationId && values.locationId !== 'all' ? Number(values.locationId) : null,
    export_format: values.format,
    period_start: values.periodStart ? asIsoFilter(values.periodStart) : null,
    period_end: values.periodEnd ? asIsoFilter(values.periodEnd) : null,
    record_count: Math.max(0, Math.round(Number(values.recordCount) || 0)),
    filters: values.filters || {},
  }
  const { data, error } = await supabase
    .from('waste_report_exports')
    .insert(payload)
    .select('*')
    .single()

  if (error) throwFriendlyWasteError(error)
  return data
}

export async function getWasteAnalytics(filters = {}) {
  const collections = await listWasteCollections(filters)
  return { collections, summary: summarizeWasteCollections(collections) }
}
