export function validateNewPassword(password, confirmation) {
  if (password.length < 8) return 'Password must contain at least 8 characters.'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  if (password !== confirmation) return 'Passwords do not match. Please check and try again.'
  return ''
}

export function hasPasswordRecoveryEvidence(urlValue) {
  const url = urlValue instanceof URL ? urlValue : new URL(urlValue)
  const query = url.searchParams
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  return query.has('code')
    || query.get('type') === 'recovery'
    || hash.get('type') === 'recovery'
    || hash.has('access_token')
}

export function passwordRecoveryError(urlValue) {
  const url = urlValue instanceof URL ? urlValue : new URL(urlValue)
  const query = url.searchParams
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  return query.get('error_description') || hash.get('error_description') || ''
}
