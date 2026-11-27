import { Rest } from 'ably'
import { handleFeedback } from './feedback.mjs'

const TOKEN_TTL = 10 * 60 * 1000

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/feedback') return handleFeedback(request, env)
    const origin = request.headers.get('Origin')
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' }
    const reply = (body, status = 200) => Response.json(body, { status, headers })
    if (!origin || !allowed.includes(origin)) return reply({ error: 'Origin not allowed' }, 403)
    Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    if (new URL(request.url).pathname !== '/token') return reply({ error: 'Not found' }, 404)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
      return reply({ error: 'JSON required' }, 415)
    }
    // Cloudflare supplies the IP; do not trust an address supplied in the body.
    if (!env.TOKEN_LIMITER) return reply({ error: 'Rate limiter not configured' }, 503)
    const { success } = await env.TOKEN_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
    if (!success) return reply({ error: 'Try again later' }, 429)
    const body = await request.text()
    if (body.length > 512) return reply({ error: 'Request too large' }, 413)
    let input
    try { input = JSON.parse(body) } catch { return reply({ error: 'Invalid JSON' }, 400) }
    if (!input || typeof input.code !== 'string' || !/^\d{4}$/.test(input.code) ||
        typeof input.clientId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.clientId)) {
      return reply({ error: 'Invalid code or client' }, 400)
    }
    if (!env.ABLY_API_KEY) return reply({ error: 'Service not configured' }, 503)
    try {
      const ably = new Rest({ key: env.ABLY_API_KEY })
      const token = await ably.auth.createTokenRequest({
        clientId: input.clientId,
        ttl: TOKEN_TTL,
        capability: JSON.stringify({ [`poll-${input.code}`]: ['publish', 'subscribe', 'presence'] }),
      })
      return reply(token)
    } catch {
      // Never return SDK errors: they may contain credential details.
      return reply({ error: 'Authorization unavailable' }, 503)
    }
  },
}
