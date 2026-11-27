import { useEffect, useMemo, useRef, useState } from 'react'
import type * as Ably from 'ably'
import { useBoardStore } from '../../store/useBoardStore'
import {
  createPollClient,
  createPollCode,
  getPollChannelName,
  waitForPollConnection,
  type PollAnswerMessage,
  type PollJoinMessage,
  type PollOption,
  type PollStateMessage,
} from '../../lib/ablyPoll'

const DEFAULT_OPTIONS: PollOption[] = [
  { id: 'a', label: 'Trygg' },
  { id: 'b', label: 'Osäker' },
  { id: 'c', label: 'Behöver hjälp' },
]

const PRESETS = [
  'Hur trygg känner du dig med dagens mål?',
  'Vilken del behöver vi repetera nästa lektion?',
  'Hur redo är du att börja på egen hand?',
]

export function ExitTicketWindow() {
  const [saved] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem('prisma-teacher-poll') || 'null')
      return value && typeof value.code === 'string' && typeof value.sessionId === 'string' &&
        typeof value.question === 'string' && Array.isArray(value.options) &&
        value.options.every((o: PollOption) => o && typeof o.id === 'string' && typeof o.label === 'string')
        ? value : null
    } catch { return null }
  })
  const actions = useBoardStore((state) => state.actions)
  const [code, setCode] = useState<string>(() => saved?.code ?? createPollCode())
  const [sessionId, setSessionId] = useState<string>(() => saved?.sessionId ?? crypto.randomUUID())
  const [question, setQuestion] = useState<string>(saved?.question ?? 'Hur redo känner du dig inför nästa steg?')
  const [options, setOptions] = useState<PollOption[]>(saved?.options ?? DEFAULT_OPTIONS)
  const [isOpen, setIsOpen] = useState(Boolean(saved?.isOpen))
  const [status, setStatus] = useState('Redo att starta.')
  const [codeReady, setCodeReady] = useState(false)
  const [changingCode, setChangingCode] = useState(false)
  const ownerId = useRef(`teacher-${crypto.randomUUID()}`)
  const ownsCode = useRef(false)
  const [answersByStudent, setAnswersByStudent] = useState<Record<string, string>>(saved?.answersByStudent ?? {})
  const clientRef = useRef<Ably.Realtime | null>(null)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const localChannelRef = useRef<BroadcastChannel | null>(null)
  const pollStateRef = useRef<PollStateMessage | null>(null)

  const cleanOptions = useMemo(
    () =>
      options
        .map((option) => ({ ...option, label: option.label.trim() }))
        .filter((option) => option.label),
    [options],
  )

  const total = Object.keys(answersByStudent).length
  const counts = useMemo(() => {
    const next: Record<string, number> = {}
    cleanOptions.forEach((option) => {
      next[option.id] = 0
    })
    Object.values(answersByStudent).forEach((optionId) => {
      if (optionId in next) {
        next[optionId] += 1
      }
    })
    return next
  }, [answersByStudent, cleanOptions])

  const studentUrl =
    typeof window === 'undefined'
      ? '/rod'
      : `${window.location.origin}${import.meta.env.BASE_URL}rod`

  const pollState: PollStateMessage = {
    sessionId,
    kind: 'state',
    code,
    question: question.trim() || 'Omröstning',
    options: cleanOptions,
    open: isOpen,
    updatedAt: Date.now(),
  }
  pollStateRef.current = pollState

  useEffect(() => {
    localStorage.setItem('prisma-teacher-poll', JSON.stringify({ code, sessionId, question, options, isOpen, answersByStudent }))
  }, [code, sessionId, question, options, isOpen, answersByStudent])

  const publishState = async () => {
    if (!pollStateRef.current || !ownsCode.current) return
    window.localStorage.setItem(`prisma-poll-state-${code}`, JSON.stringify(pollStateRef.current))
    localChannelRef.current?.postMessage({ name: 'poll-state', data: pollStateRef.current })
    if (clientRef.current && channelRef.current) {
      await waitForPollConnection(clientRef.current)
      await channelRef.current.publish('poll-state', pollStateRef.current)
    }
  }

  useEffect(() => {
    let disposed = false
    ownsCode.current = false
    setCodeReady(false)
    const client = createPollClient(ownerId.current, code)
    const channel = client.channels.get(getPollChannelName(code))
    const localChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(getPollChannelName(code))
    clientRef.current = client
    channelRef.current = channel
    localChannelRef.current = localChannel

    const applyAnswer = (data: PollAnswerMessage) => {
      const current = pollStateRef.current
      if (!ownsCode.current || !current?.open || data?.sessionId !== current.sessionId ||
        !current.options.some((option) => option.id === data?.optionId)) return
      if (data?.kind !== 'answer' || data.code !== code || !data.studentId || !data.optionId) return
      setAnswersByStudent((prev) => prev[data.studentId] === data.optionId ? prev : ({ ...prev, [data.studentId]: data.optionId }))
    }

    const handleAnswer = (message: Ably.Message) => applyAnswer(message.data as PollAnswerMessage)

    const handleJoin = () => {
      publishState().catch((error) => console.warn('Kunde inte skicka fråga till elev.', error))
    }

    const handleLocalMessage = (event: MessageEvent<{ name?: string; data?: unknown }>) => {
      if (event.data?.name === 'poll-answer') {
        applyAnswer(event.data.data as PollAnswerMessage)
      }
      if (event.data?.name === 'poll-join') {
        const data = event.data.data as PollJoinMessage
        if (data?.kind === 'join' && data.code === code) {
          handleJoin()
        }
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith(`prisma-poll-answer-${code}-`) || !event.newValue) return
      try {
        applyAnswer(JSON.parse(event.newValue) as PollAnswerMessage)
      } catch (error) {
        console.warn('Kunde inte läsa lokalt omröstningssvar.', error)
      }
    }

    const readStoredAnswers = () => {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index)
        if (!key?.startsWith(`prisma-poll-answer-${code}-`)) continue
        const raw = window.localStorage.getItem(key)
        if (!raw) continue
        try {
          applyAnswer(JSON.parse(raw) as PollAnswerMessage)
        } catch (error) {
          console.warn('Kunde inte läsa lokalt omröstningssvar.', error)
        }
      }
    }

    channel.subscribe('poll-answer', handleAnswer)
    channel.subscribe('poll-join', (message: Ably.Message) => {
      const data = message.data as PollJoinMessage
      if (data?.kind === 'join' && data.code === code) {
        handleJoin()
      }
    })
    localChannel?.addEventListener('message', handleLocalMessage)
    window.addEventListener('storage', handleStorage)
    const localAnswerInterval = window.setInterval(readStoredAnswers, 1000)

    const checkOwnership = async () => {
      const members = await channel.presence.get()
      if (disposed) return
      const teachers = members.filter((member) => member.data?.kind === 'teacher')
        .sort((a, b) => (a.timestamp - b.timestamp) || (a.clientId ?? '').localeCompare(b.clientId ?? ''))
      const mine = teachers[0]?.clientId === ownerId.current
      ownsCode.current = mine
      setCodeReady(mine)
      if (!mine) {
        setIsOpen(false)
        setCode(createPollCode())
        setStatus('Koden var upptagen. Kontrollerar en ny kod…')
      }
    }
    const reserveCode = async () => {
      await waitForPollConnection(client)
      if (disposed) return
      await channel.presence.enter({ kind: 'teacher' })
      await checkOwnership()
      if (disposed || !ownsCode.current) return
      await channel.presence.subscribe(() => {
        checkOwnership().catch(() => {
          if (disposed) return
          ownsCode.current = false
          setCodeReady(false)
          setIsOpen(false)
          setStatus('Kunde inte kontrollera koden. Öppna om verktyget.')
        })
      })
      await publishState()
      if (!disposed) setStatus('Koden är klar att använda.')
    }
    reserveCode().catch(() => {
      if (disposed) return
      setStatus('Kunde inte kontrollera koden. Kontrollera anslutningen och öppna om verktyget.')
      setIsOpen(false)
    })

    return () => {
      disposed = true
      ownsCode.current = false
      channel.presence.unsubscribe()
      localChannel?.removeEventListener('message', handleLocalMessage)
      localChannel?.close()
      window.removeEventListener('storage', handleStorage)
      window.clearInterval(localAnswerInterval)
      channel.unsubscribe()
      client.close()
      if (localChannelRef.current === localChannel) localChannelRef.current = null
      if (clientRef.current === client) clientRef.current = null
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [code])

  useEffect(() => {
    publishState().catch((error) => console.warn('Kunde inte uppdatera omröstningen.', error))
  }, [code, sessionId, question, cleanOptions, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const interval = window.setInterval(() => {
      publishState().catch((error) => console.warn('Kunde inte uppdatera omröstningen.', error))
    }, 5000)
    return () => window.clearInterval(interval)
  }, [isOpen, code])

  const startPoll = () => {
    if (!ownsCode.current || changingCode) return
    if (!question.trim()) {
      setStatus('Skriv en fråga först.')
      return
    }
    if (cleanOptions.length < 2) {
      setStatus('Minst två svarsalternativ behövs.')
      return
    }
    setAnswersByStudent({})
    setSessionId(crypto.randomUUID())
    setIsOpen(true)
    setStatus('Omröstningen är öppen.')
  }

  const closePoll = () => {
    if (pollStateRef.current) pollStateRef.current.open = false
    setIsOpen(false)
    setStatus('Omröstningen är stängd.')
  }

  const newPoll = async () => {
    if (changingCode || !ownsCode.current) return
    setChangingCode(true)
    if (pollStateRef.current) pollStateRef.current.open = false
    setIsOpen(false)
    try {
      // Keep the old channel alive until its closed state has been delivered.
      await publishState()
    } catch {
      setStatus('Kunde inte meddela eleverna. Försök byta kod igen när anslutningen fungerar.')
      setChangingCode(false)
      return
    }
    setSessionId(crypto.randomUUID())
    setCode(createPollCode())
    setAnswersByStudent({})
    setIsOpen(false)
    setStatus('Ny kod skapad.')
    setChangingCode(false)
  }

  const setOptionLabel = (id: string, label: string) => {
    setOptions((prev) => prev.map((option) => (option.id === id ? { ...option, label } : option)))
  }

  const addOption = () => {
    if (options.length >= 4) return
    const id = crypto.randomUUID()
    setOptions((prev) => [...prev, { id, label: '' }])
  }

  const removeOption = (id: string) => {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((option) => option.id !== id))
    setAnswersByStudent((prev) => {
      const next = { ...prev }
      Object.entries(next).forEach(([studentId, optionId]) => {
        if (optionId === id) delete next[studentId]
      })
      return next
    })
  }

  const shareToInstructions = () => {
    const lines = cleanOptions.map((option, index) => {
      const count = counts[option.id] ?? 0
      const pct = total ? Math.round((count / total) * 100) : 0
      return `${String.fromCharCode(65 + index)}. ${option.label}: ${count} (${pct}%)`
    })
    actions.setInstructionText(`${question}\n\n${lines.join('\n')}`)
    setStatus('Resultatet visas i Instruktion.')
  }

  return (
    <div className="poll-editorial" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
        <div>
          <div style={eyebrowStyle}>Omröstningskod</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, lineHeight: 1, fontWeight: 700, color: 'var(--accent)', letterSpacing: 4 }}>
            {codeReady ? code : '…'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{studentUrl}</div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" disabled={!codeReady || changingCode} onClick={isOpen ? closePoll : startPoll} style={isOpen ? secondaryButtonStyle : primaryButtonStyle}>
            {isOpen ? 'Stäng' : 'Starta'}
          </button>
          <button type="button" disabled={!codeReady || changingCode} onClick={newPoll} style={secondaryButtonStyle}>
            Ny kod
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px', display: 'grid', gap: 14 }}>
        <section>
          <div style={eyebrowStyle}>Fråga</div>
          <textarea
            disabled={isOpen || changingCode}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={2}
            placeholder="Skriv din fråga..."
            style={questionStyle}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {PRESETS.map((preset) => (
              <button key={preset} type="button" disabled={isOpen || changingCode} onClick={() => setQuestion(preset)} style={chipButtonStyle}>
                {preset.substring(0, 28)}...
              </button>
            ))}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 8 }}>
          <div style={eyebrowStyle}>Svarsalternativ</div>
          {options.map((option, index) => (
            <div key={option.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={letterStyle}>{String.fromCharCode(65 + index)}</div>
              <input
                disabled={isOpen || changingCode}
                value={option.label}
                onChange={(event) => setOptionLabel(option.id, event.target.value)}
                placeholder="Svar..."
                style={optionInputStyle}
              />
              <button type="button" onClick={() => removeOption(option.id)} disabled={isOpen || changingCode || options.length <= 2} style={smallButtonStyle}>
                -
              </button>
            </div>
          ))}
          <button type="button" onClick={addOption} disabled={isOpen || changingCode || options.length >= 4} style={secondaryButtonStyle}>
            Lägg till alternativ
          </button>
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={eyebrowStyle}>Live-resultat</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{total} svar</div>
          </div>
          {cleanOptions.map((option, index) => {
            const count = counts[option.id] ?? 0
            const pct = total ? Math.round((count / total) * 100) : 0
            return (
              <div key={option.id} style={{ display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                  <span>
                    <strong>{String.fromCharCode(65 + index)}.</strong> {option.label}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {count} · {pct}%
                  </span>
                </div>
                <div style={{ height: 14, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-secondary)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--accent)', transition: 'width 240ms ease' }} />
                </div>
              </div>
            )
          })}
        </section>
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>{status}</div>
        <button type="button" onClick={shareToInstructions} disabled={!total} style={secondaryButtonStyle}>
          Visa i instruktion
        </button>
      </div>
    </div>
  )
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
}

const questionStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--border-medium)',
  background: 'var(--surface-secondary)',
  borderRadius: 12,
  resize: 'vertical',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  color: 'var(--text-primary)',
  outline: 'none',
  lineHeight: 1.5,
  padding: '10px 12px',
  boxSizing: 'border-box',
}

const optionInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: '1.5px solid var(--border-medium)',
  background: 'var(--surface-secondary)',
  borderRadius: 10,
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  padding: '9px 10px',
  boxSizing: 'border-box',
}

const letterStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  background: 'var(--accent)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 999,
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border-medium)',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 600,
  padding: '7px 12px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const smallButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  width: 34,
  height: 34,
  padding: 0,
}

const chipButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  fontSize: 11,
  padding: '5px 9px',
}
