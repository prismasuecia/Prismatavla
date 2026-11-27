export async function handleFeedback(request, env, sendRequest = fetch) {
  const origin = request.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim())
  const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' }
  const reply = (body, status = 200) => Response.json(body, { status, headers })
  if (!origin || !allowed.includes(origin)) return reply({ error: 'Not allowed' }, 403)
  Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({ error: 'JSON required' }, 415)
  if (!env.FEEDBACK_LIMITER || !env.RESEND_API_KEY || !env.FEEDBACK_TO || !env.FEEDBACK_FROM) return reply({ error: 'Feedback unavailable' }, 503)
  const limit = await env.FEEDBACK_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
  if (!limit.success) return reply({ error: 'Try later' }, 429)
  // Bound the stream before decoding to avoid allocating an arbitrary request body.
  const reader = request.body?.getReader()
  if (!reader) return reply({ error: 'Body required' }, 400)
  const chunks = []; let length = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 20000) { await reader.cancel(); return reply({ error: 'Too large' }, 413) }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  let input
  try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return reply({ error: 'Invalid JSON' }, 400) }
  if (!input || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 4000 ||
      (input.email !== undefined && typeof input.email !== 'string') || (input.website !== undefined && typeof input.website !== 'string')) return reply({ error: 'Invalid message' }, 400)
  if (input.website) return reply({ error: 'Not allowed' }, 400)
  const email = (input.email ?? '').trim()
  if (email && (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) return reply({ error: 'Invalid email' }, 400)
  try {
    const response = await sendRequest('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: env.FEEDBACK_FROM, to: [env.FEEDBACK_TO],
        subject: 'Feedback från Prisma Tavla',
        text: input.message.trim(),
        ...(email ? { reply_to: email } : {}),
      }),
    })
    if (!response.ok) return reply({ error: 'Sending failed' }, 502)
    const result = await response.json()
    if (!result?.id) return reply({ error: 'Delivery not confirmed' }, 502)
    return reply({ sent: true })
  } catch { return reply({ error: 'Sending failed' }, 502) }
}
