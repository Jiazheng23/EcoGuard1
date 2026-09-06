import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./authController.js', import.meta.url), 'utf8')

async function run({ token = 'valid', google = true, role = 'tourist', concurrentRole = null, readError = null, freshlyCreated = false } = {}) {
  let storedRole = role
  let updates = 0
  const createdAt = new Date(freshlyCreated ? Date.now() - 1_000 : Date.now() - 86_400_000).toISOString()
  const lastSignInAt = new Date().toISOString()
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', created_at: createdAt, last_sign_in_at: lastSignInAt, identities: google ? [{ provider: 'google' }] : [] } } }) },
    from: () => ({
      select: () => ({ eq: (column, id) => {
        assert.equal(column, 'id')
        assert.equal(id, 'user-1')
        return { maybeSingle: async () => ({ data: storedRole ? { role: storedRole, created_at: createdAt } : null, error: readError }) }
      } }),
      update: (values) => ({ eq: (column, id) => {
        assert.equal(column, 'id')
        assert.equal(id, 'user-1')
        return { eq: async (roleColumn, expectedRole) => {
          assert.equal(roleColumn, 'role')
          if (storedRole === expectedRole) { storedRole = values.role; updates++ }
          return { error: null }
        } }
      } }),
      insert: async (values) => {
        assert.equal(values.id, 'user-1')
        if (concurrentRole) { storedRole = concurrentRole; return { error: { code: '23505' } } }
        assert.equal(storedRole, null)
        storedRole = values.role
        updates++
        return { error: null }
      },
    }),
  }
  const factorySource = source.replace("import { supabase, supabaseAdmin } from '../services/supabase.js'", '')
    .replaceAll('export async function ', 'async function ')
  const factory = new Function('supabase', 'supabaseAdmin', `${factorySource}\nreturn startGoogleApplication`)
  const handler = factory(client, client)
  const response = { code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await handler({
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: freshlyCreated ? { initialGoogleOnboarding: true } : {},
  }, response)
  return { storedRole, updates, response }
}

test('Google application requires an authenticated caller', async () => {
  const result = await run({ token: '' })
  assert.equal(result.response.code, 401)
  assert.equal(result.updates, 0)
})
test('Google application rejects accounts without a Google identity', async () => {
  const result = await run({ google: false })
  assert.equal(result.response.code, 403)
  assert.equal(result.updates, 0)
})
test('Google applicant receives only pending status', async () => {
  const result = await run({ role: null })
  assert.equal(result.storedRole, 'pending_location_admin')
  assert.equal(result.response.code, 200)
})
test('Google application preserves approved and pending roles', async () => {
  for (const role of ['super_admin', 'location_admin', 'pending_location_admin']) {
    const result = await run({ role })
    assert.equal(result.storedRole, role)
    assert.equal(result.updates, 0)
    assert.equal(result.response.code, role === 'super_admin' ? 409 : 200)
  }
})

test('an existing tourist cannot register as a location admin with Google', async () => {
  const result = await run()
  assert.equal(result.response.code, 409)
  assert.match(result.response.body.error, /already registered with another role/)
  assert.equal(result.storedRole, 'tourist')
  assert.equal(result.updates, 0)
})

test('a first-time Google user can choose location admin when a trigger created a tourist profile', async () => {
  const result = await run({ freshlyCreated: true })
  assert.equal(result.response.code, 200)
  assert.equal(result.storedRole, 'pending_location_admin')
  assert.equal(result.updates, 1)
})

test('concurrent tourist registration cannot be overwritten', async () => {
  const result = await run({ role: null, concurrentRole: 'tourist' })
  assert.equal(result.response.code, 409)
  assert.equal(result.storedRole, 'tourist')
  assert.equal(result.updates, 0)
})

test('concurrent location admin registration is idempotent', async () => {
  const result = await run({ role: null, concurrentRole: 'pending_location_admin' })
  assert.equal(result.response.code, 200)
  assert.equal(result.updates, 0)
})

test('profile lookup errors never create or change a role', async () => {
  const result = await run({ role: null, readError: { message: 'Database unavailable' } })
  assert.equal(result.response.code, 503)
  assert.equal(result.updates, 0)
})
