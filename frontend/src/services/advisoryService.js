import { supabase } from './supabaseClient'

export const USE_MOCK_ADVISORIES = true
const relativeTime = (hours) => new Date(Date.now() + hours * 3600000).toISOString()
let sequence = 7
let mockAdvisories = [
  { id: 1, location_id: 1, source_incident_id: null, source_warning_id: null, status: 'published', title: 'Weekend entrance traffic guidance', affected_area: 'Main entrance and visitor parking area', safety_instructions: 'Use the signed overflow parking area and keep emergency access lanes clear.', recommended_visiting_time: '08:00 – 11:00', alternative_location: 'No alternative specified', starts_at: relativeTime(-2), expires_at: relativeTime(70), published_at: relativeTime(-2), created_at: relativeTime(-3), ecological_locations: { name: 'Taman Negara National Park', state: 'Pahang' } },
  { id: 2, location_id: 2, source_incident_id: null, source_warning_id: 501, status: 'published', title: 'High visitor volume advisory', affected_area: 'Viewing deck and main access road', safety_instructions: 'Expect delays, follow crowd-control signs, and avoid stopping in restricted areas.', recommended_visiting_time: '07:00 – 09:30', alternative_location: 'Penang National Park', starts_at: relativeTime(-1), expires_at: relativeTime(23), published_at: relativeTime(-1), created_at: relativeTime(-2), ecological_locations: { name: 'Cameron Highlands Nature Reserve', state: 'Pahang' } },
  { id: 3, location_id: 3, source_incident_id: 102, source_warning_id: null, status: 'published', title: 'Poor water quality near lower trail', affected_area: 'Stream and lower walking trail', safety_instructions: 'Avoid contact with the stream and do not collect or drink water from this area.', recommended_visiting_time: '09:00 – 16:00', alternative_location: 'Mossy Forest boardwalk', starts_at: relativeTime(-4), expires_at: relativeTime(44), published_at: relativeTime(-4), created_at: relativeTime(-5), ecological_locations: { name: 'Penang Hill', state: 'Penang' } },
  { id: 4, location_id: 4, source_incident_id: null, source_warning_id: null, status: 'published', title: 'Scheduled maintenance advisory', affected_area: 'Northern visitor information centre', safety_instructions: 'Use the temporary information counter beside the main gate.', recommended_visiting_time: '10:00 – 17:00', alternative_location: 'No alternative specified', starts_at: relativeTime(24), expires_at: relativeTime(72), published_at: relativeTime(-1), created_at: relativeTime(-1), ecological_locations: { name: 'Langkawi Geopark', state: 'Kedah' } },
  { id: 5, location_id: 5, source_incident_id: null, source_warning_id: 498, status: 'published', title: 'Expired smoke and haze advisory', affected_area: 'Eastern ridge trail', safety_instructions: 'Visitors with respiratory conditions were advised to avoid strenuous activity.', recommended_visiting_time: '08:00 – 10:00', alternative_location: 'Taman Negara National Park', starts_at: relativeTime(-72), expires_at: relativeTime(-24), published_at: relativeTime(-72), created_at: relativeTime(-73), ecological_locations: { name: 'Penang National Park', state: 'Penang' } },
  { id: 6, location_id: 6, source_incident_id: 99, source_warning_id: null, status: 'withdrawn', title: 'Withdrawn temporary trail closure', affected_area: 'Elevated eastern trail', safety_instructions: 'The restriction is no longer active after repairs passed inspection.', recommended_visiting_time: '09:00 – 17:00', alternative_location: 'Penang Botanic Gardens', starts_at: relativeTime(-48), expires_at: relativeTime(24), published_at: relativeTime(-48), withdrawn_at: relativeTime(-20), created_at: relativeTime(-49), ecological_locations: { name: 'Kuala Lumpur City Centre', state: 'Kuala Lumpur' } },
  { id: 7, location_id: 1, source_incident_id: 107, source_warning_id: null, status: 'published', title: 'Temporary riverside path restriction', affected_area: 'Riverside path near the main entrance', safety_instructions: 'Use the signed upper path while inspection work is in progress.', recommended_visiting_time: '08:00 - 15:00', alternative_location: 'Canopy walkway', starts_at: relativeTime(-1), expires_at: relativeTime(30), published_at: relativeTime(-1), created_at: relativeTime(-2), ecological_locations: { name: 'Taman Negara National Park', state: 'Pahang' } },
]
const listeners = new Set()
const clone = (item) => ({ ...item, ecological_locations: item.ecological_locations ? { ...item.ecological_locations } : null })
const active = (item) => item.status === 'published' && new Date(item.starts_at) <= new Date() && new Date(item.expires_at) > new Date()
function notify() { listeners.forEach((listener) => listener()) }

export async function listActiveAdvisories() {
  if (USE_MOCK_ADVISORIES) return mockAdvisories.filter(active).map(clone)
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('tourist_advisories').select('*, ecological_locations(name,state)').eq('status', 'published').lte('starts_at', now).gt('expires_at', now).order('published_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listManagedAdvisories() {
  if (USE_MOCK_ADVISORIES) return mockAdvisories.map(clone)
  const { data, error } = await supabase.from('tourist_advisories').select('*, ecological_locations(name,state)').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveAdvisory(values) {
  if (USE_MOCK_ADVISORIES) {
    const now = new Date().toISOString()
    let saved
    if (values.id) {
      mockAdvisories = mockAdvisories.map((item) => item.id === values.id ? (saved = { ...item, ...values, updated_at: now }) : item)
    } else {
      saved = { ...values, id: ++sequence, status: 'published', published_at: now, created_at: now, updated_at: now, ecological_locations: { name: values.locationName, state: '' } }
      mockAdvisories = [saved, ...mockAdvisories]
    }
    notify(); return clone(saved)
  }
  const { data, error } = await supabase.rpc('publish_tourist_advisory', {
    target_advisory_id: values.id || null, target_location_id: values.location_id,
    target_incident_id: values.source_incident_id || null, target_warning_id: values.source_warning_id || null,
    target_title: values.title, target_affected_area: values.affected_area,
    target_safety_instructions: values.safety_instructions, target_recommended_time: values.recommended_visiting_time,
    target_alternative_location: values.alternative_location, target_starts_at: values.starts_at, target_expires_at: values.expires_at,
  })
  if (error) throw error
  return data
}

export async function withdrawAdvisory(id) {
  if (USE_MOCK_ADVISORIES) { mockAdvisories = mockAdvisories.map((item) => item.id === id ? { ...item, status: 'withdrawn', withdrawn_at: new Date().toISOString() } : item); notify(); return }
  const { error } = await supabase.rpc('withdraw_tourist_advisory', { target_advisory_id: id })
  if (error) throw error
}

export function subscribeToAdvisories(onChange) {
  if (USE_MOCK_ADVISORIES) { listeners.add(onChange); return () => listeners.delete(onChange) }
  const channel = supabase.channel(`tourist-advisories-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tourist_advisories' }, onChange).subscribe()
  return () => { void supabase.removeChannel(channel) }
}
