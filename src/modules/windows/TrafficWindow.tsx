import { useBoardStore, type TrafficNorm } from '../../store/useBoardStore'
import { BookOpen, UsersRound, MessagesSquare, Check } from 'lucide-react'

const OPTIONS: { id: TrafficNorm; label: string; description: string }[] = [
  { id: 'tyst', label: 'Tyst arbete', description: 'Jag arbetar utan att prata.' },
  { id: 'viska', label: 'Låg röst', description: 'Bara min arbetskamrat ska höra.' },
  { id: 'prata', label: 'Gruppsamtal', description: 'Bara min grupp ska höra.' },
]

export function TrafficWindow() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)
  const descriptions = useBoardStore((state) => state.trafficDescriptions)
  const fullscreen = useBoardStore((state) => Boolean(state.moduleWindows.windowsById.trafficlight?.fullscreen))
  const current = OPTIONS.find((option) => option.id === traffic) ?? OPTIONS[0]
  const Symbol = traffic === 'tyst' ? BookOpen : traffic === 'viska' ? UsersRound : MessagesSquare
  const color = traffic === 'tyst' ? '#456b83' : traffic === 'viska' ? '#806724' : '#2d624d'

  return (
    <div className="traffic-editorial" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
      <div role="group" aria-label="Välj samtalsnivå" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: 16, borderTop: '1px solid var(--border-subtle)' }}>
      {OPTIONS.map((option) => { const ChoiceIcon = option.id === 'tyst' ? BookOpen : option.id === 'viska' ? UsersRound : MessagesSquare; return (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === traffic}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 88, padding: 8, minWidth: 0, borderRadius: 6, border: option.id === traffic ? `2px solid ${color}` : '2px solid var(--border-subtle)', background: option.id === traffic ? 'var(--accent-muted)' : 'var(--surface-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, position: 'relative', overflowWrap: 'anywhere' }}
          onClick={() => actions.setTrafficNorm(option.id)}
        >
          <ChoiceIcon size={24} aria-hidden="true" />
          <span>{option.label}</span>
          {option.id === traffic && <Check size={14} aria-hidden="true" style={{ position: 'absolute', top: 5, right: 5 }} />}
        </button>
      )})}
      </div>
      <section aria-label="Aktuell samtalsnivå" style={{ order: -1, flex: 1, padding: fullscreen ? 40 : 24, textAlign: 'center', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: fullscreen ? 28 : 20, borderRadius: '50%', background: 'var(--surface-secondary)', border: `2px solid ${color}`, color }}><Symbol size={fullscreen ? 120 : 72} strokeWidth={1.5} aria-hidden="true" /></div>
        <h2 style={{ margin: '20px 0 12px', fontSize: fullscreen ? 56 : 32, overflowWrap: 'anywhere' }}>{current.label}</h2>
        <p style={{ margin: 0, fontSize: fullscreen ? 32 : 21, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{descriptions?.[traffic] ?? current.description}</p>
      </section>
      {!fullscreen && <div style={{ padding: 16 }}>
        <label htmlFor="conversation-message" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Anpassa text för {current.label.toLowerCase()}</label>
        <textarea id="conversation-message" aria-label={`Text för ${current.label}`} maxLength={160} value={descriptions?.[traffic] ?? current.description}
          onChange={(event) => { const value = event.target.value; useBoardStore.setState((state) => ({ trafficDescriptions: { ...state.trafficDescriptions, [traffic]: value } })) }}
          style={{ width: '100%', minHeight: 64, marginTop: 8, padding: 10, boxSizing: 'border-box', font: 'inherit', color: 'var(--text-primary)', background: 'var(--surface-secondary)', border: '1px solid var(--border-medium)', borderRadius: 6 }} />
      </div>}
    </div>
  )
}
