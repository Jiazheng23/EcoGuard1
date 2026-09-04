import { supabase } from './supabaseClient'

export const USE_MOCK_ADVISORIES = false
let sequence = 2
let mockAdvisories = [
  { id: 1, location_id: 2, source_incident_id: 102, source_warning_id: null, status: 'published', title: 'Poor water quality near lower trail', affected_area: 'Stream and lower walking trail', safety_instructions: 'Avoid contact with the stream and do not collect or drink water from this area.', recommended_visiting_time: 'Use the upper trail between 8:00 AM and 11:00 AM.', alternative_location: 'Mossy Forest boardwalk', starts_at: '2026-09-03T08:30:00+08:00', expires_at: '2026-09-10T18:00:00+08:00', published_at: '2026-09-03T08:35:00+08:00', created_at: '2026-09-03T08:30:00+08:00', ecological_locations: { name: 'Cameron Highlands Nature Reserve', state: 'Pahang' } },
  { id: 2, location_id: 3, source_incident_id: 103, source_warning_id: null, status: 'withdrawn', title: 'Temporary trail closure', affected_area: 'Elevated eastern trail', safety_instructions: 'Use the marked western trail while railing repairs are completed.', recommended_visiting_time: 'Visit after 9:00 AM and follow ranger signage.', alternative_location: 'Penang Botanic Gardens', starts_at: '2026-09-02T11:30:00+08:00', expires_at: '2026-09-04T18:00:00+08:00', published_at: '2026-09-02T11:30:00+08:00', withdrawn_at: '2026-09-02T16:45:00+08:00', created_at: '2026-09-02T11:25:00+08:00', ecological_locations: { name: 'Penang Hill', state: 'Penang' } },
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
