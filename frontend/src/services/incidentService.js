import { supabase } from './supabaseClient'

const BUCKET = 'incident-evidence'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Set to false after applying supabase/environmental_incident_reporting.sql.
export const USE_MOCK_INCIDENTS = false

function placeholder(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="100%" height="100%" fill="${color}"/><circle cx="450" cy="220" r="90" fill="white" opacity=".16"/><path d="M250 390l130-130 85 85 70-70 120 115z" fill="white" opacity=".4"/><text x="450" y="480" fill="white" font-family="Arial" font-size="32" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

let mockSequence = 104
let mockIncidents = [
  {
    id: 101, location_id: 1, reporter_id: 'demo-tourist-1', category: 'overflowing_rubbish', status: 'submitted',
    description: 'Several rubbish bins beside the main visitor entrance are overflowing and waste is spreading onto the footpath.',
    photo_path: 'mock/submitted-rubbish', photo_url: placeholder('Overflowing rubbish report', '#b45309'),
    resolution_evidence_path: null, resolution_url: null, response_action: null, rejection_reason: null,
    created_at: '2026-09-03T09:25:00+08:00', updated_at: '2026-09-03T09:25:00+08:00',
    ecological_locations: { name: 'Taman Negara National Park', state: 'Pahang' },
  },
  {
    id: 102, location_id: 2, reporter_id: 'demo-tourist-2', category: 'water_pollution', status: 'verified',
    description: 'The stream near the lower walking trail looks cloudy and has an unusual oily film close to the bank.',
    photo_path: 'mock/water-pollution', photo_url: placeholder('Water pollution report', '#0369a1'),
    resolution_evidence_path: null, resolution_url: null,
    response_action: 'The affected section was cordoned off and a water sample was sent to the local environmental laboratory.',
    reviewed_at: '2026-09-03T08:20:00+08:00', created_at: '2026-09-03T07:50:00+08:00', updated_at: '2026-09-03T08:35:00+08:00',
    ecological_locations: { name: 'Cameron Highlands Nature Reserve', state: 'Pahang' },
  },
  {
    id: 103, location_id: 3, reporter_id: 'demo-tourist-3', category: 'damaged_facilities_or_trail', status: 'closed',
    description: 'A timber railing is broken along the elevated trail and could cause visitors to fall from the walkway.',
    photo_path: 'mock/damaged-trail', photo_url: placeholder('Damaged trail railing', '#7c2d12'),
    resolution_evidence_path: 'mock/repaired-trail', resolution_url: placeholder('Repaired trail railing', '#047857'),
    response_action: 'The trail section was closed temporarily. Maintenance replaced the damaged railing and completed a safety inspection.',
    reviewed_at: '2026-09-02T11:15:00+08:00', closed_at: '2026-09-02T16:40:00+08:00',
    created_at: '2026-09-02T10:30:00+08:00', updated_at: '2026-09-02T16:40:00+08:00',
    ecological_locations: { name: 'Penang Hill', state: 'Penang' },
  },
  {
    id: 104, location_id: 4, reporter_id: 'demo-tourist-4', category: 'wildlife_disturbance', status: 'rejected',
    description: 'A group of monkeys was making noise near the picnic tables during the afternoon.',
    photo_path: 'mock/wildlife', photo_url: placeholder('Wildlife report', '#4d7c0f'), resolution_evidence_path: null, resolution_url: null,
    response_action: null, rejection_reason: 'Duplicate report; normal wildlife activity was already assessed by the ranger team.',
    reviewed_at: '2026-09-01T15:25:00+08:00', created_at: '2026-09-01T15:05:00+08:00', updated_at: '2026-09-01T15:25:00+08:00',
    ecological_locations: { name: 'Langkawi Geopark', state: 'Kedah' },
  },
]
const mockListeners = new Set()

function publishMockChange() {
  mockListeners.forEach((listener) => listener())
}

function updateMock(id, updater) {
  let updated
  mockIncidents = mockIncidents.map((item) => {
    if (String(item.id) !== String(id)) return item
    updated = { ...updater(item), updated_at: new Date().toISOString() }
    return updated
  })
  if (!updated) throw new Error('Mock incident was not found.')
  publishMockChange()
  return updated
}

function validateImage(file) {
  if (!file || !ALLOWED_TYPES.has(file.type)) throw new Error('Please choose a JPG, PNG, or WebP image.')
  if (file.size > MAX_FILE_BYTES) throw new Error('The image must be 10 MB or smaller.')
}

function extension(file) {
  return file.name.split('.').pop()?.toLowerCase() || 'jpg'
}

async function signedUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return error ? null : data?.signedUrl
}

export async function submitEnvironmentalIncident({ locationId, locationName, reporterId, category, description, photo }) {
  validateImage(photo)
  if (USE_MOCK_INCIDENTS) {
    const now = new Date().toISOString()
    const report = {
      id: ++mockSequence, location_id: locationId, reporter_id: reporterId, category,
      description: description.trim(), status: 'submitted', photo_path: `mock/${mockSequence}`,
      photo_url: URL.createObjectURL(photo), resolution_evidence_path: null, resolution_url: null,
      response_action: null, rejection_reason: null, created_at: now, updated_at: now,
      ecological_locations: { name: locationName || `Location ${locationId}`, state: '' },
    }
    mockIncidents = [report, ...mockIncidents]
    publishMockChange()
    return report
  }
  const { data: report, error } = await supabase.from('environmental_incidents').insert({
    location_id: locationId,
    reporter_id: reporterId,
    category,
    description: description.trim(),
  }).select().single()
  if (error) throw error

  const path = `${locationId}/${reporterId}/${report.id}/report.${extension(photo)}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, photo, {
    contentType: photo.type,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { error: attachError } = await supabase.rpc('attach_incident_photo', {
    target_incident_id: report.id,
    target_photo_path: path,
  })
  if (attachError) throw attachError
  return report
}

export async function listManagedIncidents() {
  if (USE_MOCK_INCIDENTS) return mockIncidents.map((item) => ({ ...item, ecological_locations: { ...item.ecological_locations } }))
  const { data, error } = await supabase.from('environmental_incidents')
    .select('*, ecological_locations(name, state)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return Promise.all((data || []).map(async (item) => ({
    ...item,
    photo_url: await signedUrl(item.photo_path),
    resolution_url: await signedUrl(item.resolution_evidence_path),
  })))
}

export async function reviewIncident(id, decision, reason = '') {
  if (USE_MOCK_INCIDENTS) {
    if (decision === 'rejected' && !reason.trim()) throw new Error('Enter a reason for rejection.')
    return updateMock(id, (item) => ({ ...item, status: decision, rejection_reason: decision === 'rejected' ? reason.trim() : null, reviewed_at: new Date().toISOString() }))
  }
  const { data, error } = await supabase.rpc('review_environmental_incident', {
    target_incident_id: id,
    target_decision: decision,
    target_reason: reason.trim() || null,
  })
  if (error) throw error
  return data
}

export async function saveIncidentResponse(id, responseAction) {
  if (USE_MOCK_INCIDENTS) return updateMock(id, (item) => ({ ...item, response_action: responseAction.trim() }))
  const { data, error } = await supabase.rpc('save_incident_response', {
    target_incident_id: id,
    target_response_action: responseAction.trim(),
  })
  if (error) throw error
  return data
}

export async function uploadResolutionEvidence(incident, adminId, file) {
  validateImage(file)
  if (USE_MOCK_INCIDENTS) return updateMock(incident.id, (item) => ({ ...item, resolution_evidence_path: `mock/resolution-${Date.now()}`, resolution_url: URL.createObjectURL(file) }))
  const path = `${incident.location_id}/${adminId}/${incident.id}/resolution-${Date.now()}.${extension(file)}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.rpc('attach_incident_resolution', {
    target_incident_id: incident.id,
    target_evidence_path: path,
  })
  if (error) throw error
  return data
}

export async function closeIncident(id) {
  if (USE_MOCK_INCIDENTS) return updateMock(id, (item) => {
    if (!item.response_action || !item.resolution_evidence_path) throw new Error('Record a response action and upload resolution evidence before closing.')
    return { ...item, status: 'closed', closed_at: new Date().toISOString() }
  })
  const { data, error } = await supabase.rpc('close_environmental_incident', { target_incident_id: id })
  if (error) throw error
  return data
}

export function subscribeToIncidents(onChange) {
  if (USE_MOCK_INCIDENTS) {
    mockListeners.add(onChange)
    return () => { mockListeners.delete(onChange) }
  }
  const channel = supabase.channel(`environmental-incidents-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'environmental_incidents' }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
