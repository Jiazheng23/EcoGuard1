const MALAYSIAN_PHONE_PATTERN = /^\+60(?:\d{1}\d{7,8}|\d{2,3}\d{7,8})$/

export const MALAYSIAN_PHONE_ERROR = 'Enter a Malaysian phone number starting with +60, followed by a 1-digit area code or 2-to-3-digit mobile prefix and a 7-to-8-digit subscriber number.'

export function isValidMalaysianPhone(value) {
  const phone = String(value || '').trim()
  if (!phone) return true

  const compactPhone = phone.replace(/[\s()-]/g, '')
  return MALAYSIAN_PHONE_PATTERN.test(compactPhone)
}
