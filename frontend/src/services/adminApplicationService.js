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

export async function decideAdminApplication(id, decision) {
  return authenticatedRequest(`/api/admin-applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}
