import { useEffect, useMemo, useRef, useState } from 'react'
import type * as Ably from 'ably'
import {
  createPollClient,
  createStudentId,
  getPollChannelName,
  waitForPollConnection,
  type PollAnswerMessage,
  type PollJoinMessage,
  type PollStateMessage,
} from '../lib/ablyPoll'

export function StudentPollPage() {
  const [code, setCode] = useState('')
  const [activeCode, setActiveCode] = useState('')
  const [poll, setPoll] = useState<PollStateMessage | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [status, setStatus] = useState('Skriv koden som visas på tavlan.')
  const studentId = useMemo(() => createStudentId(), [])
  const clientRef = useRef<Ably.Realtime | null>(null)
  const localChannelRef = useRef<BroadcastChannel | null>(null)
  const pollRef = useRef<PollStateMessage | null>(null)

  useEffect(() => {
    if (!activeCode) return

    const readStoredState = () => {
      try {
        const raw = window.localStorage.getItem(`prisma-poll-state-${activeCode}`)
        if (raw) {
          const data = JSON.parse(raw) as PollStateMessage
          if (data?.kind === 'state' && data.code === activeCode) {
            applyState(data)
          }
        }
      } catch (error) {
        console.warn('Kunde inte läsa lokal omröstning.', error)
      }
    }

    const client = createPollClient(`student-${studentId}`, activeCode)
    const channel = client.channels.get(getPollChannelName(activeCode))
    const localChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(getPollChannelName(activeCode))
    clientRef.current = client
    localChannelRef.current = localChannel

    const applyState = (data: PollStateMessage) => {
      if (data?.kind !== 'state') return
      if (data.code !== activeCode) return
      const changed = pollRef.current?.sessionId !== data.sessionId
      pollRef.current = data
      setPoll(data)
      if (changed || !data.open) {
        setStatus(data.open ? 'Välj ett svar.' : 'Omröstningen är stängd.')
        setSelectedOptionId('')
      }
    }

    const handleState = (message: Ably.Message) => applyState(message.data as PollStateMessage)
    const handleLocalMessage = (event: MessageEvent<{ name?: string; data?: unknown }>) => {
      if (event.data?.name === 'poll-state') {
        applyState(event.data.data as PollStateMessage)
      }
    }

    setStatus('Väntar på fråga...')
    channel.subscribe('poll-state', handleState)
    localChannel?.addEventListener('message', handleLocalMessage)
    readStoredState()
    const localPollInterval = window.setInterval(readStoredState, 1000)
    localChannel?.postMessage({
      name: 'poll-join',
      data: {
        kind: 'join',
        code: activeCode,
        studentId,
        sentAt: Date.now(),
      } satisfies PollJoinMessage,
    })
    waitForPollConnection(client)
      .then(() =>
        channel.publish('poll-join', {
          kind: 'join',
          code: activeCode,
          studentId,
          sentAt: Date.now(),
        } satisfies PollJoinMessage),
      )
      .catch(() => setStatus('Kunde inte ansluta. Försök igen.'))

    return () => {
      localChannel?.removeEventListener('message', handleLocalMessage)
      localChannel?.close()
      window.clearInterval(localPollInterval)
      channel.unsubscribe('poll-state', handleState)
      client.close()
      if (localChannelRef.current === localChannel) {
        localChannelRef.current = null
      }
      if (clientRef.current === client) {
        clientRef.current = null
      }
    }
  }, [activeCode, studentId])

  const handleJoin = () => {
    const normalized = code.replace(/\D/g, '').slice(0, 4)
    if (normalized.length !== 4) {
      setStatus('Koden ska ha fyra siffror.')
      return
    }
    setPoll(null)
    setSelectedOptionId('')
    setActiveCode(normalized)
  }

  const handleAnswer = async (optionId: string) => {
    if (!activeCode || !poll?.open || !clientRef.current) return
    setSelectedOptionId(optionId)
    setStatus('Skickar svar...')
    const answer = {
      sessionId: poll.sessionId,
      kind: 'answer',
      code: activeCode,
      optionId,
      studentId,
      sentAt: Date.now(),
    } satisfies PollAnswerMessage
    window.localStorage.setItem(`prisma-poll-answer-${activeCode}-${studentId}`, JSON.stringify(answer))
    localChannelRef.current?.postMessage({ name: 'poll-answer', data: answer })
    try {
      await waitForPollConnection(clientRef.current)
      const channel = clientRef.current.channels.get(getPollChannelName(activeCode))
      await channel.publish('poll-answer', answer)
      setStatus('Svar skickat.')
    } catch (error) {
      setSelectedOptionId('')
      setStatus('Svaret kunde inte skickas. Försök igen.')
      console.warn('Kunde inte skicka svar via Ably.', error)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--board-bg)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: 'min(480px, 100%)',
          background: 'var(--surface-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(31, 42, 36, 0.16)',
          padding: 22,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Prisma Tavla
        </div>
        {!activeCode && (
          <>
            <h1 style={{ fontSize: 28, margin: '0 0 16px', letterSpacing: 0 }}>Omröstning</h1>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Kod från tavlan
            </label>
            <input
              value={code}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleJoin()
              }}
              autoFocus
              style={{
                width: '100%',
                height: 64,
                borderRadius: 14,
                border: '1.5px solid var(--border-medium)',
                background: 'var(--surface-secondary)',
                fontSize: 34,
                textAlign: 'center',
                letterSpacing: 8,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button type="button" onClick={handleJoin} style={primaryButtonStyle}>
              Gå med
            </button>
          </>
        )}

        {activeCode && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Kod</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700 }}>{activeCode}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveCode('')
                  setPoll(null)
                  setStatus('Skriv koden som visas på tavlan.')
                }}
                style={secondaryButtonStyle}
              >
                Byt kod
              </button>
            </div>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14 }}>{status}</p>
            {poll && (
              <>
                <h1 style={{ fontSize: 25, lineHeight: 1.2, margin: '0 0 18px', letterSpacing: 0 }}>
                  {poll.question}
                </h1>
                <div style={{ display: 'grid', gap: 10 }}>
                  {poll.options.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!poll.open}
                      onClick={() => handleAnswer(option.id)}
                      style={{
                        ...answerButtonStyle,
                        borderColor: selectedOptionId === option.id ? 'var(--accent)' : 'var(--border-medium)',
                        background: selectedOptionId === option.id ? 'rgba(45, 92, 69, 0.08)' : 'var(--surface-secondary)',
                        opacity: poll.open ? 1 : 0.55,
                      }}
                    >
                      <strong>{String.fromCharCode(65 + index)}</strong>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 14,
  border: 'none',
  borderRadius: 999,
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  padding: '14px 18px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border-medium)',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 12px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const answerButtonStyle: React.CSSProperties = {
  minHeight: 58,
  borderRadius: 14,
  border: '1.5px solid var(--border-medium)',
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: 17,
  fontFamily: 'var(--font-sans)',
}
