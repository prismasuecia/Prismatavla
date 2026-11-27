import * as Ably from 'ably'

export type PollOption = {
  id: string
  label: string
}

export type PollStateMessage = {
  sessionId: string
  kind: 'state'
  code: string
  question: string
  options: PollOption[]
  open: boolean
  updatedAt: number
}

export type PollAnswerMessage = {
  sessionId: string
  kind: 'answer'
  code: string
  optionId: string
  studentId: string
  sentAt: number
}

export type PollJoinMessage = {
  kind: 'join'
  code: string
  studentId: string
  sentAt: number
}

export const createPollCode = () => String(Math.floor(1000 + Math.random() * 9000))

export const createStudentId = () => {
  const existing = window.localStorage.getItem('prisma-poll-student-id')
  if (existing) return existing
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12)
  window.localStorage.setItem('prisma-poll-student-id', id)
  return id
}

export const getPollChannelName = (code: string) => `poll-${code.trim()}`

export const createPollClient = (clientId: string, code: string) =>
  new Ably.Realtime({
    clientId,
    authCallback: (_params, callback) => {
      const authorize = async () => {
        const endpoint = import.meta.env.VITE_POLL_AUTH_URL
        if (!endpoint) throw new Error('Omröstningens anslutning är inte konfigurerad.')
        const url = new URL(endpoint)
        if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
          throw new Error('Omröstningen kräver en säker anslutning.')
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, code }),
          credentials: 'omit',
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw new Error('Kunde inte ansluta till omröstningen.')
        return response.json() as Promise<Ably.TokenRequest>
      }
      authorize().then((token) => callback(null, token), (error: unknown) => {
        callback(error instanceof Error ? error.message : 'Anslutningen misslyckades.', null)
      })
    },
  })

export const waitForPollConnection = (client: Ably.Realtime) =>
  new Promise<void>((resolve, reject) => {
    if (client.connection.state === 'connected') {
      resolve()
      return
    }
    if (client.connection.state === 'failed' || client.connection.state === 'closed') {
      reject(new Error(`Ably connection is ${client.connection.state}`))
      return
    }
    const onConnected = () => {
      client.connection.off('failed', onFailed)
      client.connection.off('closed', onClosed)
      resolve()
    }
    const onFailed = () => {
      client.connection.off('connected', onConnected)
      client.connection.off('closed', onClosed)
      reject(new Error('Ably connection failed'))
    }
    const onClosed = () => {
      client.connection.off('connected', onConnected)
      client.connection.off('failed', onFailed)
      reject(new Error('Ably connection closed'))
    }
    client.connection.once('connected', onConnected)
    client.connection.once('failed', onFailed)
    client.connection.once('closed', onClosed)
  })
