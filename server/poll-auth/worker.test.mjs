import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import worker from './worker.mjs'

const origin = 'https://prismasuecia.github.io'
const secret = 'test-secret-not-a-real-key'
const env = {
  ALLOWED_ORIGINS: origin,
  ABLY_API_KEY: `test.key:${secret}`,
  TOKEN_LIMITER: { limit: async () => ({ success: true }) },
}
const request = (data = { code: '1234', clientId: 'student-test' }, options = {}) =>
  new Request('https://auth.example/token', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(data),
  })

test('signed request is short lived and restricted to one poll', async () => {
  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  const token = await response.json()
  assert.equal(token.clientId, 'student-test')
  assert.equal(token.ttl, 600000)
  assert.deepEqual(JSON.parse(token.capability), { 'poll-1234': ['presence', 'publish', 'subscribe'] })
  const signed = [token.keyName, token.ttl, token.capability, token.clientId, token.timestamp, token.nonce, ''].join('\n')
  assert.equal(token.mac, createHmac('sha256', secret).update(signed).digest('base64'))
  assert.ok(!JSON.stringify(token).includes(secret))
})

test('unapproved origins and missing origin are denied', async () => {
  for (const headers of [{ Origin: 'https://other.example' }, { Origin: '' }]) {
    const response = await worker.fetch(request(undefined, { headers }), env)
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
  }
})

test('preflight succeeds, other methods do not', async () => {
  const options = await worker.fetch(new Request('https://auth.example/token', { method: 'OPTIONS', headers: { Origin: origin } }), env)
  assert.equal(options.status, 204)
  const get = await worker.fetch(new Request('https://auth.example/token', { headers: { Origin: origin } }), env)
  assert.equal(get.status, 405)
})

test('wildcards, arbitrary capabilities and invalid identities cannot widen access', async () => {
  for (const data of [null, {}, { code: '*', clientId: 'student-test' }, { code: '1234', clientId: '*' }]) {
    assert.equal((await worker.fetch(request(data), env)).status, 400)
  }
  const response = await worker.fetch(request({ code: '1234', clientId: 'student-test', capability: { '*': ['*'] }, ttl: 99999999 }), env)
  const token = await response.json()
  assert.equal(token.ttl, 600000)
  assert.deepEqual(Object.keys(JSON.parse(token.capability)), ['poll-1234'])
})

test('missing configuration and rate limiting fail closed', async () => {
  assert.equal((await worker.fetch(request(), { ...env, ABLY_API_KEY: '' })).status, 503)
  assert.equal((await worker.fetch(request(), { ...env, TOKEN_LIMITER: null })).status, 503)
  const blocked = { ...env, TOKEN_LIMITER: { limit: async () => ({ success: false }) } }
  assert.equal((await worker.fetch(request(), blocked)).status, 429)
})
