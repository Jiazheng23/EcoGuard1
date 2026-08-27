import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasPasswordRecoveryEvidence,
  passwordRecoveryError,
  validateNewPassword,
} from './passwordValidation.js'

test('new passwords require length, uppercase, lowercase, number, and confirmation', () => {
  assert.match(validateNewPassword('Short1', 'Short1'), /8 characters/)
  assert.match(validateNewPassword('lowercase1', 'lowercase1'), /uppercase/)
  assert.match(validateNewPassword('UPPERCASE1', 'UPPERCASE1'), /lowercase/)
  assert.match(validateNewPassword('NoNumbers', 'NoNumbers'), /number/)
  assert.match(validateNewPassword('ValidPass1', 'Different1'), /do not match/)
  assert.equal(validateNewPassword('ValidPass1', 'ValidPass1'), '')
})

test('recognizes Supabase recovery query and hash links', () => {
  assert.equal(hasPasswordRecoveryEvidence('http://localhost:5173/reset-password?code=recovery-code'), true)
  assert.equal(hasPasswordRecoveryEvidence('http://localhost:5173/reset-password#type=recovery&access_token=token'), true)
  assert.equal(hasPasswordRecoveryEvidence('http://localhost:5173/reset-password'), false)
})

test('extracts recovery errors returned by the authentication provider', () => {
  assert.equal(
    passwordRecoveryError('http://localhost:5173/reset-password?error_description=Link+has+expired'),
    'Link has expired',
  )
})
