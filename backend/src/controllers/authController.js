import { supabase, supabaseAdmin } from '../services/supabase.js'

const allowedDocumentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const maxDocumentBytes = 5 * 1024 * 1024

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

export async function register(req, res) {
  const name = req.body?.name?.trim()
  const email = req.body?.email?.trim().toLowerCase()
  const password = req.body?.password
  const requestedRole = req.body?.role === 'location_admin'
    ? 'location_admin'
    : 'tourist'
  const locationId = Number(req.body?.locationId)

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

  if (requestedRole === 'location_admin' && (!Number.isInteger(locationId) || locationId < 1)) {
    return res.status(400).json({ error: 'A valid requested location is required.' })
  }

  try {
    if (requestedRole === 'location_admin' && !requireAdminClient(res)) return
    const document = req.body?.companyDocument
    if (requestedRole === 'location_admin' && (!document?.name || !allowedDocumentTypes.has(document.type))) {
      return res.status(400).json({ error: 'Upload a PDF, JPG, or PNG company document.' })
    }
    const documentBuffer = requestedRole === 'location_admin'
      ? Buffer.from(document.base64 || '', 'base64')
      : null
    if (documentBuffer && (!documentBuffer.length || documentBuffer.length > maxDocumentBytes)) {
      return res.status(400).json({ error: 'The company document must be 5 MB or smaller.' })
    }

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
      const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const documentPath = `${data.user.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('company-documents')
        .upload(documentPath, documentBuffer, { contentType: document.type, upsert: false })
      if (uploadError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id)
        return res.status(400).json({ error: uploadError.message })
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        full_name: name,
        role: 'pending_location_admin',
        location_id: null,
      })

      if (profileError) {
        await supabaseAdmin.storage.from('company-documents').remove([documentPath])
        await supabaseAdmin.auth.admin.deleteUser(data.user.id)
        return res.status(400).json({ error: profileError.message })
      }

      const { error: applicationError } = await supabaseAdmin
        .from('location_admin_applications')
        .insert({
          user_id: data.user.id,
          requested_location_id: locationId,
          company_document_path: documentPath,
          company_document_name: document.name,
        })
      if (applicationError) {
        await supabaseAdmin.storage.from('company-documents').remove([documentPath])
        await supabaseAdmin.auth.admin.deleteUser(data.user.id)
        return res.status(400).json({ error: applicationError.message })
      }
    }

    return res.status(201).json({
      success: true,
      userId: data.user?.id,
      requiresEmailConfirmation:
        requestedRole === 'tourist' && !data.session,
      message: requestedRole === 'location_admin'
        ? 'Application submitted. A super administrator must approve it before admin access is enabled.'
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

  const approved = decision === 'approved'
  const role = approved ? 'location_admin' : 'tourist'
  const locationId = approved ? application.requested_location_id : null
  const { error: profileError } = await supabaseAdmin.from('profiles')
    .update({ role, location_id: locationId }).eq('id', application.user_id)
  if (profileError) return res.status(400).json({ error: profileError.message })
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(application.user_id, {
    app_metadata: approved ? { role, location_id: locationId } : { role },
  })
  if (authError) {
    await supabaseAdmin.from('profiles')
      .update({ role: 'pending_location_admin', location_id: null }).eq('id', application.user_id)
    return res.status(400).json({ error: authError.message })
  }
  const { error: decisionError } = await supabaseAdmin.from('location_admin_applications')
    .update({ status: decision, reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId)
  if (decisionError) return res.status(400).json({ error: decisionError.message })
  return res.json({ success: true, status: decision })
}
