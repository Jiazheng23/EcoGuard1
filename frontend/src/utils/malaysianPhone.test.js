import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidMalaysianPhone } from './malaysianPhone.js'

test('accepts Malaysian landline and mobile phone formats using +60', () => {
  assert.equal(isValidMalaysianPhone('+60 3-1234 5678'), true)
  assert.equal(isValidMalaysianPhone('+60 12-345 6789'), true)
  assert.equal(isValidMalaysianPhone('+60 (123) 4567 8901'), true)
})

test('allows an empty optional profile phone number', () => {
  assert.equal(isValidMalaysianPhone(''), true)
  assert.equal(isValidMalaysianPhone('   '), true)
})

test('rejects phone numbers without +60 or with invalid digit lengths', () => {
  assert.equal(isValidMalaysianPhone('012-345 6789'), false)
  assert.equal(isValidMalaysianPhone('+60123456'), false)
  assert.equal(isValidMalaysianPhone('+60123456789012'), false)
  assert.equal(isValidMalaysianPhone('+60 12-ABC 6789'), false)
})
