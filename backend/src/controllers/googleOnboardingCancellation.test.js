import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./authController.js', import.meta.url), 'utf8')

async function run({ role = 'tourist', fresh = true, google = true } = {}) {
  let storedRole = role
  let deletes = 0
  const createdAt = new Date(fresh ? Date.now() - 1_000 : Date.now() - 86_400_000).toISOString()
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'user-1',
            created_at: createdAt,
            last_sign_in_at: new Date().toISOString(),
            identities: google ? [{ provider: 'google' }] : [],
          },
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: storedRole ? { role: storedRole } : null, error: null }) }),
      }),
      delete: () => ({
        eq: (column, id) => ({
          eq: async (roleColumn, expectedRole) => {
            assert.equal(column, 'id')
            assert.equal(id, 'user-1')
            assert.equal(roleColumn, 'role')
            if (storedRole === expectedRole) { storedRole = null; deletes++ }
            return { error: null }
          },
        }),
      }),
    }),
  }
  const factorySource = source.replace("import { supabase, supabaseAdmin } from '../services/supabase.js'", '')
    .replaceAll('export async function ', 'async function ')
  const factory = new Function('supabase', 'supabaseAdmin', `${factorySource}\nreturn cancelGoogleOnboarding`)
  const response = { code: 200, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await factory(client, client)({ headers: { authorization: 'Bearer valid' } }, response)
  return { response, storedRole, deletes }
}

test('cancelling first Google onboarding removes only its temporary tourist profile', async () => {
  const result = await run()
  assert.equal(result.response.code, 200)
  assert.equal(result.storedRole, null)
  assert.equal(result.deletes, 1)
})

test('cancellation cannot remove an established tourist profile', async () => {
  const result = await run({ fresh: false })
  assert.equal(result.response.code, 409)
  assert.equal(result.storedRole, 'tourist')
  assert.equal(result.deletes, 0)
})

test('cancellation cannot remove a protected role', async () => {
  const result = await run({ role: 'pending_location_admin' })
  assert.equal(result.response.code, 409)
  assert.equal(result.storedRole, 'pending_location_admin')
  assert.equal(result.deletes, 0)
})

test('cancellation requires a Google-only identity', async () => {
  const result = await run({ google: false })
  assert.equal(result.response.code, 409)
  assert.equal(result.deletes, 0)
})
