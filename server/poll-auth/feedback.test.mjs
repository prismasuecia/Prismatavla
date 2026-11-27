import test from 'node:test'
import assert from 'node:assert/strict'
import { handleFeedback } from './feedback.mjs'

const origin = 'https://tavla.prismautbildning.se'
const request = (data = { message: 'Test av feedback' }, headers = {}) => new Request('https://auth.example/feedback', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
})
const setup = () => {
  const sent = []
  const env = { ALLOWED_ORIGINS: origin, FEEDBACK_TO: 'private-recipient@example.test', FEEDBACK_FROM: 'sender@example.test',
    FEEDBACK_LIMITER: { limit: async () => ({ success: true }) },
    FEEDBACK_MAILER: { send: async (message) => { sent.push(message); return { messageId: 'test-message' } } },
  }
  return { env, sent }
}

test('sends to server recipient only; recipient never appears in response', async () => {
  const { env, sent } = setup()
  const response = await handleFeedback(request({ message: '  Hej  ', email: 'teacher@example.test', to: 'attacker@example.test' }), env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { sent: true })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, env.FEEDBACK_TO)
  assert.equal(sent[0].text, 'Hej')
  assert.equal(sent[0].replyTo, 'teacher@example.test')
})
test('optional reply address may be omitted', async () => {
  const { env, sent } = setup()
  assert.equal((await handleFeedback(request(), env)).status, 200)
  assert.equal(sent[0].replyTo, undefined)
})
test('rejects invalid messages, header injection, bots and oversized bodies', async () => {
  const { env, sent } = setup()
  for (const body of [null, {}, { message: ' ' }, { message: 'a'.repeat(4001) }, { message: 'hi', email: 'x@y.test\r\nBcc:x@y.test' }, { message: 'hi', website: 'spam' }]) {
    assert.equal((await handleFeedback(request(body), env)).status, 400)
  }
  assert.equal((await handleFeedback(request({ message: 'a'.repeat(21000) }), env)).status, 413)
  assert.equal(sent.length, 0)
})
test('fails closed for unknown origins, missing service and rate limiting', async () => {
  const { env, sent } = setup()
  assert.equal((await handleFeedback(request(undefined, { Origin: 'https://attacker.test' }), env)).status, 403)
  assert.equal((await handleFeedback(request(), { ...env, FEEDBACK_MAILER: null })).status, 503)
  assert.equal((await handleFeedback(request(), { ...env, FEEDBACK_LIMITER: { limit: async () => ({ success: false }) } })).status, 429)
  assert.equal(sent.length, 0)
})
test('provider failures never produce a success message or disclose details', async () => {
  const { env } = setup()
  env.FEEDBACK_MAILER.send = async () => { throw new Error('private-recipient@example.test') }
  const response = await handleFeedback(request(), env)
  assert.equal(response.status, 502)
  assert.ok(!(await response.text()).includes(env.FEEDBACK_TO))
})
