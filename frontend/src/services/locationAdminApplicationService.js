import { authenticatedRequest } from './authenticatedRequest'

export function getApplicationSetup() {
  return authenticatedRequest('/api/location-admin/unassigned-locations')
}

export function submitLocationAdminApplication(values) {
  return authenticatedRequest('/api/location-admin/application', {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('Could not read the company document.'))
    reader.readAsDataURL(file)
  })
}
