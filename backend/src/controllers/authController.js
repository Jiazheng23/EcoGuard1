import { supabase, supabaseAdmin } from '../services/supabase.js'

const allowedDocumentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const maxDocumentBytes = 5 * 1024 * 1024
const duplicateLocationRadiusMeters = 150
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

function normalizeLocationText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function distanceInMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const toRadians = (degrees) => degrees * Math.PI / 180
  const earthRadiusMeters = 6371000
  const latitudeDelta = toRadians(secondLatitude - firstLatitude)
  const longitudeDelta = toRadians(secondLongitude - firstLongitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLatitude)) * Math.cos(toRadians(secondLatitude))
    * Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isSameLocation(candidate, existing) {
  const candidateName = normalizeLocationText(candidate.name)
  const candidateAddress = normalizeLocationText(candidate.address)
  const existingName = normalizeLocationText(existing.name)
  const existingAddress = normalizeLocationText(existing.description)
  const sameText = Boolean(existingName && (
    candidateName === existingName
    || candidateAddress === existingName
    || (existingName.length >= 5 && candidateAddress.includes(existingName))
    || (candidateName.length >= 5 && existingAddress.includes(candidateName))
    || (existingAddress && candidateAddress === existingAddress)
  ))
  const coordinatesMatch = [candidate.latitude, candidate.longitude, existing.latitude, existing.longitude]
    .every((value) => Number.isFinite(Number(value)))
    && distanceInMeters(
      Number(candidate.latitude),
      Number(candidate.longitude),
      Number(existing.latitude),
      Number(existing.longitude),
    ) <= duplicateLocationRadiusMeters
  return sameText || coordinatesMatch
}

async function findUnavailableCustomLocation(custom, excludedApplicationId) {
  const { data: assignedProfiles, error: assignedError } = await supabaseAdmin
    .from('profiles')
    .select('location_id')
    .not('location_id', 'is', null)
  if (assignedError) throw assignedError

  const assignedIds = new Set((assignedProfiles || []).map((row) => Number(row.location_id)))
  const { data: existingLocations, error: locationsError } = await supabaseAdmin
    .from('ecological_locations')
    .select('id, name, description, latitude, longitude, is_active')
  if (locationsError) throw locationsError
  const existingLocation = (existingLocations || []).find((location) => isSameLocation(custom, location))
  if (existingLocation) {
    return {
      kind: assignedIds.has(Number(existingLocation.id)) ? 'assigned' : 'existing',
      name: existingLocation.name,
      isActive: existingLocation.is_active,
    }
  }

  let pendingQuery = supabaseAdmin
    .from('location_admin_applications')
    .select('id, requested_location_name, requested_location_address, requested_latitude, requested_longitude')
    .eq('status', 'pending')
    .is('requested_location_id', null)
  if (excludedApplicationId) pendingQuery = pendingQuery.neq('id', excludedApplicationId)
  const { data: pendingApplications, error: pendingError } = await pendingQuery
  if (pendingError) throw pendingError
  const reservation = (pendingApplications || []).find((application) => isSameLocation(custom, {
    name: application.requested_location_name,
    description: application.requested_location_address,
    latitude: application.requested_latitude,
    longitude: application.requested_longitude,
  }))
  return reservation ? { kind: 'pending', name: reservation.requested_location_name } : null
}

function requireAdminClient(res) {
  if (supabaseAdmin) return true
  res.status(503).json({ error: 'Privileged Supabase access is not configured.' })
  return false
}

function respondToAdminClientError(res, error) {
  console.error('Privileged Supabase request failed:', error?.message || 'Unknown Supabase error')
  res.status(503).json({
    error: 'Privileged Supabase access is unavailable. Check SUPABASE_SECRET_KEY and restart the backend.',
  })
}

async function requireAuthenticatedUser(req, res) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Authentication is required.' })
    return null
  }

  // Verify the caller with the public Auth client. The privileged client is
  // reserved for the database and Auth Admin operations below, so a backend
  // key configuration issue is not misreported as an expired user session.
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'The login session is invalid or expired.' })
    return null
  }

  return data.user
}

async function requireSuperAdmin(req, res) {
  if (!requireAdminClient(res)) return null
  const user = await requireAuthenticatedUser(req, res)
  if (!user) return null

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    respondToAdminClientError(res, profileError)
    return null
  }
  if (profile?.role !== 'super_admin') {
    res.status(403).json({ error: 'Super administrator access is required.' })
    return null
  }

  // Profiles are the canonical role record. Keep the trusted Auth claim in sync
  // so subsequent RLS checks receive the same authorization after token refresh.
  if (user.app_metadata?.role !== 'super_admin') {
    const { error: syncError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { app_metadata: { ...user.app_metadata, role: 'super_admin' } },
    )
    if (syncError) {
      respondToAdminClientError(res, syncError)
      return null
    }
    req.authRoleSynchronized = true
  }
  return user
}

async function requirePendingLocationAdmin(req, res) {
  if (!requireAdminClient(res)) return null
  const user = await requireAuthenticatedUser(req, res)
  if (!user) return null
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) {
    respondToAdminClientError(res, profileError)
    return null
  }
  if (profile?.role !== 'pending_location_admin') {
    res.status(403).json({ error: 'A pending location administrator account is required.' })
    return null
  }
  return user
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
      if (requestedRole === 'location_admin' && /unregistered|invalid api key/i.test(error.message || '')) {
        respondToAdminClientError(res, error)
        return
      }
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
  const { data: ownApplication, error: applicationError } = await supabaseAdmin.from('location_admin_applications')
    .select('id, status, rejection_reason').eq('user_id', user.id).maybeSingle()
  if (applicationError) return res.status(400).json({ error: applicationError.message })
  const { data, error } = await supabaseAdmin.from('ecological_locations')
    .select('id, name, state').eq('is_active', true).order('name')
  if (error) return res.status(400).json({ error: error.message })
  const { data: assigned, error: assignedError } = await supabaseAdmin.from('profiles').select('location_id')
    .not('location_id', 'is', null)
  if (assignedError) return res.status(400).json({ error: assignedError.message })
  const { data: reserved, error: reservedError } = await supabaseAdmin.from('location_admin_applications')
    .select('requested_location_id').eq('status', 'pending').not('requested_location_id', 'is', null)
  if (reservedError) return res.status(400).json({ error: reservedError.message })
  const unavailable = new Set([...(assigned || []), ...(reserved || [])].map((row) => Number(row.location_id || row.requested_location_id)))
  return res.json({
    hasApplication: Boolean(ownApplication),
    applicationStatus: ownApplication?.status || null,
    rejectionReason: ownApplication?.rejection_reason || null,
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
    const { data: location } = await supabaseAdmin.from('ecological_locations').select('id').eq('id', locationId).eq('is_active', true).maybeSingle()
    if (!location) return res.status(404).json({ error: 'That location does not exist or is inactive.' })
    const { data: conflict, error: conflictError } = await supabaseAdmin.from('profiles').select('id').eq('location_id', locationId).limit(1).maybeSingle()
    if (conflictError) return res.status(400).json({ error: conflictError.message })
    let reservationQuery = supabaseAdmin.from('location_admin_applications').select('id').eq('requested_location_id', locationId).eq('status', 'pending')
    if (previous?.id) reservationQuery = reservationQuery.neq('id', previous.id)
    const { data: reservation } = await reservationQuery.limit(1).maybeSingle()
    if (conflict || reservation) return res.status(409).json({ error: 'That location is no longer available. Please choose another.' })
  } else {
    try {
      const conflict = await findUnavailableCustomLocation(custom, previous?.id)
      if (conflict) {
        const reason = conflict.kind === 'assigned'
          ? 'already has a location administrator. Please request a different location.'
          : conflict.kind === 'existing' && conflict.isActive
            ? 'already exists in EcoGuard. Choose it from “Available location” instead of creating it again.'
            : conflict.kind === 'existing'
              ? 'already exists in EcoGuard but is inactive. Please contact a super administrator.'
              : 'already has an application awaiting review. Please request a different location.'
        return res.status(409).json({
          error: `${conflict.name || 'That location'} ${reason}`,
          code: 'LOCATION_UNAVAILABLE',
        })
      }
    } catch (error) {
      respondToAdminClientError(res, error)
      return
    }
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
        rejection_reason: null,
        created_at: new Date().toISOString(),
      }).eq('id', previous.id).eq('status', 'rejected')
    : supabaseAdmin.from('location_admin_applications').insert(payload)
  const { error } = await applicationQuery.select('id').single()
  if (error) {
    await supabaseAdmin.storage.from('company-documents').remove([documentPath])
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'That location was just requested by another applicant. Please choose another.',
        code: 'LOCATION_UNAVAILABLE',
      })
    }
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
    .select('id, user_id, requested_location_id, requested_location_name, requested_location_address, requested_latitude, requested_longitude, requested_state, location_method, company_document_name, status, rejection_reason, reviewed_by, reviewed_at, created_at, profiles!location_admin_applications_user_id_fkey(full_name), ecological_locations!location_admin_applications_requested_location_id_fkey(name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.set('Cache-Control', 'private, no-store')
  return res.json({
    applications: data || [],
    authRoleSynchronized: Boolean(req.authRoleSynchronized),
  })
}

export async function getAdminApplicationDocumentUrl(req, res) {
  if (!await requireSuperAdmin(req, res)) return
  const applicationId = Number(req.params.id)
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    return res.status(400).json({ error: 'A valid application is required.' })
  }

  const { data: application, error: applicationError } = await supabaseAdmin
    .from('location_admin_applications')
    .select('company_document_path')
    .eq('id', applicationId)
    .maybeSingle()
  if (applicationError) return res.status(400).json({ error: applicationError.message })
  if (!application?.company_document_path) return res.status(404).json({ error: 'Application document not found.' })

  const { data: signed, error: signedUrlError } = await supabaseAdmin.storage
    .from('company-documents')
    .createSignedUrl(application.company_document_path, 600)
  if (signedUrlError || !signed?.signedUrl) {
    return res.status(400).json({ error: signedUrlError?.message || 'Could not open the application document.' })
  }

  res.set('Cache-Control', 'private, no-store')
  return res.json({ documentUrl: signed.signedUrl, expiresIn: 600 })
}

export async function decideAdminApplication(req, res) {
  const reviewer = await requireSuperAdmin(req, res)
  if (!reviewer) return
  const applicationId = Number(req.params.id)
  const decision = req.body?.decision
  const rejectionReason = String(req.body?.rejectionReason || '').trim()
  if (!Number.isInteger(applicationId) || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'A valid application and decision are required.' })
  }
  if (decision === 'rejected' && !rejectionReason) {
    return res.status(400).json({ error: 'A rejection reason is required.' })
  }
  if (rejectionReason.length > 500) {
    return res.status(400).json({ error: 'The rejection reason must be 500 characters or fewer.' })
  }
  const { data: application, error } = await supabaseAdmin
    .from('location_admin_applications').select('*')
    .eq('id', applicationId).eq('status', 'pending').single()
  if (error) return res.status(404).json({ error: 'Pending application not found.' })

  if (decision === 'rejected') {
    const { error: rejectionError } = await supabaseAdmin.from('location_admin_applications')
      .update({ status: 'rejected', rejection_reason: rejectionReason, reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId).eq('status', 'pending')
    if (rejectionError) return res.status(400).json({ error: rejectionError.message })
    return res.json({ success: true, status: 'rejected' })
  }

  const role = 'location_admin'
  let locationId = application.requested_location_id
  let createdLocationId = null
  if (locationId) {
    const { data: assignedLocation, error: assignmentError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('location_id', locationId)
      .neq('id', application.user_id)
      .limit(1)
      .maybeSingle()
    if (assignmentError) return res.status(400).json({ error: assignmentError.message })
    if (assignedLocation) {
      return res.status(409).json({ error: 'This location already has an administrator. Reject the application and ask the applicant to choose another location.' })
    }
  }
  if (!locationId) {
    try {
      const conflict = await findUnavailableCustomLocation({
        name: application.requested_location_name,
        address: application.requested_location_address,
        latitude: application.requested_latitude,
        longitude: application.requested_longitude,
      }, application.id)
      if (conflict) {
        return res.status(409).json({
          error: `${conflict.name || 'This location'} is no longer available. Reject this application and ask the applicant to choose another location.`,
        })
      }
    } catch (conflictError) {
      respondToAdminClientError(res, conflictError)
      return
    }
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
    if (profileError.code === '23505') {
      return res.status(409).json({ error: 'This location already has an administrator. Reject the application and ask the applicant to choose another location.' })
    }
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
