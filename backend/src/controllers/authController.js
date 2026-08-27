import { supabase, supabaseAdmin } from '../services/supabase.js'

const allowedDocumentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const maxDocumentBytes = 5 * 1024 * 1024
const stateAliases = new Map([
  ['pulau pinang', 'Penang'],
  ['federal territory of kuala lumpur', 'Kuala Lumpur'],
  ['wilayah persekutuan kuala lumpur', 'Kuala Lumpur'],
  ['federal territory of putrajaya', 'Putrajaya'],
  ['wilayah persekutuan putrajaya', 'Putrajaya'],
  ['malacca', 'Melaka'],
])

function normalizeState(value) {
  const state = String(value || '').trim()
  return stateAliases.get(state.toLowerCase()) || state
}

function requireAdminClient(res) {
  if (supabaseAdmin) return true
  res.status(503).json({ error: 'Privileged Supabase access is not configured.' })
  return false
}

async function requireSuperAdmin(req, res) {
  if (!requireAdminClient(res)) return null
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Authentication is required.' })
    return null
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'The login session is invalid or expired.' })
    return null
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'super_admin') {
    res.status(403).json({ error: 'Super administrator access is required.' })
    return null
  }

  // Profiles are the canonical role record. Keep the trusted Auth claim in sync
  // so subsequent RLS checks receive the same authorization after token refresh.
  if (data.user.app_metadata?.role !== 'super_admin') {
    const { error: syncError } = await supabaseAdmin.auth.admin.updateUserById(
      data.user.id,
      { app_metadata: { ...data.user.app_metadata, role: 'super_admin' } },
    )
    if (syncError) {
      res.status(500).json({ error: 'The super administrator Auth role could not be synchronized.' })
      return null
    }
  }
  return data.user
}

async function requirePendingLocationAdmin(req, res) {
  if (!requireAdminClient(res)) return null
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Authentication is required.' })
    return null
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'The login session is invalid or expired.' })
    return null
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (profileError || profile?.role !== 'pending_location_admin') {
    res.status(403).json({ error: 'A pending location administrator account is required.' })
    return null
  }
  return data.user
}

export async function register(req, res) {
  const name = req.body?.name?.trim()
  const email = req.body?.email?.trim().toLowerCase()
  const password = req.body?.password
  const requestedRole = req.body?.role === 'location_admin'
    ? 'location_admin'
    : 'tourist'

  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Name, email, and password are required.',
    })
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must contain at least 6 characters.',
    })
  }

  try {
    if (requestedRole === 'location_admin' && !requireAdminClient(res)) return

    const authClient = requestedRole === 'location_admin' ? supabaseAdmin : supabase
    const authRequest = requestedRole === 'location_admin'
      ? authClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: name },
          app_metadata: { role: 'pending_location_admin' },
        })
      : authClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })

    const { data, error } = await authRequest

    if (error) {
      return res.status(400).json({
        error: error.message,
      })
    }


    if (requestedRole === 'location_admin') {
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        full_name: name,
        role: 'pending_location_admin',
        location_id: null,
      })

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id)
        return res.status(400).json({ error: profileError.message })
      }
    }

    return res.status(201).json({
      success: true,
      userId: data.user?.id,
      requiresEmailConfirmation:
        requestedRole === 'tourist' && !data.session,
      message: requestedRole === 'location_admin'
        ? 'Account created. Complete your location and document application next.'
        : data.session ? 'Account created successfully.'
        : 'Account created. Please confirm your email before signing in.',
    })
  } catch (error) {
    console.error('Registration error:', error)

    return res.status(500).json({
      error: 'An unexpected registration error occurred.',
    })
  }
}

export async function listUnassignedLocations(req, res) {
  const user = await requirePendingLocationAdmin(req, res)
  if (!user) return
  const { data: ownApplication } = await supabaseAdmin.from('location_admin_applications')
    .select('id, status').eq('user_id', user.id).maybeSingle()
  const { data, error } = await supabaseAdmin.from('ecological_locations')
    .select('id, name, state').eq('is_active', true).order('name')
  if (error) return res.status(400).json({ error: error.message })
  const { data: assigned } = await supabaseAdmin.from('profiles').select('location_id')
    .eq('role', 'location_admin').not('location_id', 'is', null)
  const { data: reserved } = await supabaseAdmin.from('location_admin_applications')
    .select('requested_location_id').eq('status', 'pending').not('requested_location_id', 'is', null)
  const unavailable = new Set([...(assigned || []), ...(reserved || [])].map((row) => Number(row.location_id || row.requested_location_id)))
  return res.json({
    hasApplication: Boolean(ownApplication),
    applicationStatus: ownApplication?.status || null,
    locations: (data || []).filter((row) => !unavailable.has(Number(row.id))),
  })
}

export async function submitAdminApplication(req, res) {
  const user = await requirePendingLocationAdmin(req, res)
  if (!user) return
  const method = req.body?.locationMethod
  const locationId = Number(req.body?.locationId)
  const custom = req.body?.customLocation || {}
  const document = req.body?.companyDocument
  if (!['existing', 'search', 'address'].includes(method)) return res.status(400).json({ error: 'Choose a location method.' })
  if (method === 'existing' && (!Number.isInteger(locationId) || locationId < 1)) return res.status(400).json({ error: 'Choose an unassigned location.' })
  if (method !== 'existing' && (!custom.name?.trim() || !Number.isFinite(Number(custom.latitude)) || !Number.isFinite(Number(custom.longitude)))) {
    return res.status(400).json({ error: 'Select an address found by OpenStreetMap.' })
  }
  if (method !== 'existing' && custom.name.trim().length > 120) {
    return res.status(400).json({ error: 'The location name must be 120 characters or fewer.' })
  }
  if (method !== 'existing' && !(Number(custom.latitude) >= 1 && Number(custom.latitude) <= 6.85 && Number(custom.longitude) >= 99.5 && Number(custom.longitude) <= 104.8)) {
    return res.status(400).json({ error: 'The requested location must be within Peninsular Malaysia.' })
  }
  if (!document?.name || !allowedDocumentTypes.has(document.type)) return res.status(400).json({ error: 'Upload a PDF, JPG, or PNG company document.' })
  const documentBuffer = Buffer.from(document.base64 || '', 'base64')
  if (!documentBuffer.length || documentBuffer.length > maxDocumentBytes) return res.status(400).json({ error: 'The company document must be 5 MB or smaller.' })
  const { data: previous } = await supabaseAdmin.from('location_admin_applications')
    .select('id, status, company_document_path').eq('user_id', user.id).maybeSingle()
  if (previous && previous.status !== 'rejected') {
    return res.status(409).json({ error: 'You already have an active application.' })
  }
  if (method === 'existing') {
    const { data: conflict } = await supabaseAdmin.from('profiles').select('id').eq('location_id', locationId).maybeSingle()
    const { data: reservation } = await supabaseAdmin.from('location_admin_applications').select('id').eq('requested_location_id', locationId).eq('status', 'pending').maybeSingle()
    if (conflict || reservation) return res.status(409).json({ error: 'That location is no longer available. Please choose another.' })
  }
  const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const documentPath = `${user.id}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabaseAdmin.storage.from('company-documents')
    .upload(documentPath, documentBuffer, { contentType: document.type, upsert: false })
  if (uploadError) return res.status(400).json({ error: uploadError.message })
  const payload = {
    user_id: user.id,
    requested_location_id: method === 'existing' ? locationId : null,
    requested_location_name: method === 'existing' ? null : custom.name.trim(),
    requested_location_address: method === 'existing' ? null : (custom.address || custom.name).trim(),
    requested_latitude: method === 'existing' ? null : Number(custom.latitude),
    requested_longitude: method === 'existing' ? null : Number(custom.longitude),
    requested_state: method === 'existing' ? null : normalizeState(custom.state) || null,
    location_method: method,
    company_document_path: documentPath,
    company_document_name: document.name,
  }
  const applicationQuery = previous
    ? supabaseAdmin.from('location_admin_applications').update({
        ...payload,
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      }).eq('id', previous.id).eq('status', 'rejected')
    : supabaseAdmin.from('location_admin_applications').insert(payload)
  const { error } = await applicationQuery.select('id').single()
  if (error) {
    await supabaseAdmin.storage.from('company-documents').remove([documentPath])
    return res.status(400).json({ error: error.message })
  }
  if (previous?.company_document_path) {
    await supabaseAdmin.storage.from('company-documents').remove([previous.company_document_path])
  }
  return res.status(previous ? 200 : 201).json({
    success: true,
    message: previous
      ? 'Application resubmitted for super administrator review.'
      : 'Application submitted for super administrator review.',
  })
}

export async function listAdminApplications(req, res) {
  if (!await requireSuperAdmin(req, res)) return
  const { data, error } = await supabaseAdmin
    .from('location_admin_applications')
    .select('*, profiles!location_admin_applications_user_id_fkey(full_name), ecological_locations!location_admin_applications_requested_location_id_fkey(name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const applications = await Promise.all((data || []).map(async (item) => {
    const { data: signed } = await supabaseAdmin.storage
      .from('company-documents').createSignedUrl(item.company_document_path, 600)
    return { ...item, documentUrl: signed?.signedUrl || null }
  }))
  return res.json({ applications })
}

export async function decideAdminApplication(req, res) {
  const reviewer = await requireSuperAdmin(req, res)
  if (!reviewer) return
  const applicationId = Number(req.params.id)
  const decision = req.body?.decision
  if (!Number.isInteger(applicationId) || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'A valid application and decision are required.' })
  }
  const { data: application, error } = await supabaseAdmin
    .from('location_admin_applications').select('*')
    .eq('id', applicationId).eq('status', 'pending').single()
  if (error) return res.status(404).json({ error: 'Pending application not found.' })

  if (decision === 'rejected') {
    const { error: rejectionError } = await supabaseAdmin.from('location_admin_applications')
      .update({ status: 'rejected', reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId).eq('status', 'pending')
    if (rejectionError) return res.status(400).json({ error: rejectionError.message })
    return res.json({ success: true, status: 'rejected' })
  }

  const role = 'location_admin'
  let locationId = application.requested_location_id
  let createdLocationId = null
  if (!locationId) {
    const { data: location, error: locationError } = await supabaseAdmin.from('ecological_locations').insert({
      name: application.requested_location_name,
      state: application.requested_state || 'Kuala Lumpur',
      location_type: 'Tourist attractions',
      description: application.requested_location_address,
      latitude: application.requested_latitude,
      longitude: application.requested_longitude,
      max_capacity: 1,
      is_active: true,
      created_by: reviewer.id,
    }).select('id').single()
    if (locationError) return res.status(400).json({ error: `Could not create the requested location: ${locationError.message}` })
    locationId = location.id
    createdLocationId = location.id
  }
  const { error: profileError } = await supabaseAdmin.from('profiles')
    .update({ role, location_id: locationId }).eq('id', application.user_id)
  if (profileError) {
    if (createdLocationId) await supabaseAdmin.from('ecological_locations').delete().eq('id', createdLocationId)
    return res.status(400).json({ error: profileError.message })
  }
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(application.user_id, {
    app_metadata: { role, location_id: locationId },
  })
  if (authError) {
    await supabaseAdmin.from('profiles')
      .update({ role: 'pending_location_admin', location_id: null }).eq('id', application.user_id)
    if (createdLocationId) await supabaseAdmin.from('ecological_locations').delete().eq('id', createdLocationId)
    return res.status(400).json({ error: authError.message })
  }
  const { error: decisionError } = await supabaseAdmin.from('location_admin_applications')
    .update({ status: decision, reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId)
  if (decisionError) return res.status(400).json({ error: decisionError.message })
  return res.json({ success: true, status: decision })
}
