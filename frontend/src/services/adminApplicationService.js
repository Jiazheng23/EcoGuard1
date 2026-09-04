import { authenticatedRequest, refreshAccessToken } from './authenticatedRequest'

let roleClaimRefreshInFlight = null
let roleClaimRefreshed = false

async function refreshRoleClaimOnce() {
  if (roleClaimRefreshed) return
  if (!roleClaimRefreshInFlight) {
    roleClaimRefreshInFlight = refreshAccessToken()
      .then(() => {
        roleClaimRefreshed = true
      })
      .finally(() => {
        roleClaimRefreshInFlight = null
      })
  }
  return roleClaimRefreshInFlight
}

export async function listAdminApplications() {
  const data = await authenticatedRequest('/api/admin-applications')
  if (data.authRoleSynchronized) await refreshRoleClaimOnce()
  return data.applications || []
}

export async function decideAdminApplication(id, decision, rejectionReason = '') {
  return authenticatedRequest(`/api/admin-applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, rejectionReason }),
  })
}

export async function getAdminApplicationDocumentUrl(id) {
  const data = await authenticatedRequest(`/api/admin-applications/${id}/document-url`)
  if (!data.documentUrl) throw new Error('The application document is unavailable.')
  return data.documentUrl
}
