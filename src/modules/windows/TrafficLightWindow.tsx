import { useBoardStore } from '../../store/useBoardStore'

const LEVELS = [
  { id: 'silent' as const,  label: 'Tyst',  sub: 'Ingen pratar', color: '#2D5C45', bg: '#EAF2EC', dot: '#2D5C45' },
  { id: 'whisper' as const, label: 'Viska', sub: 'Låg röst',   color: '#7A5C2E', bg: '#F5EFE6', dot: '#C4973F' },
  { id: 'talk' as const,    label: 'Prata', sub: 'Samtalston',  color: '#8C3F3F', bg: '#F5E8E8', dot: '#C43F3F' },
] as const

export function TrafficLightWindow() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)

  const active = LEVELS.find((l) => l.id === traffic) ?? LEVELS[2]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: 10, fontFamily: 'var(--font-sans)' }}>

      {/* Aktiv status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', borderRadius: 'var(--radius-lg)',
        background: active.bg, border: '1.5px solid ' + active.dot + '44',
        marginBottom: 4,
      }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: active.dot, flexShrink: 0, boxShadow: '0 0 0 4px ' + active.dot + '22' }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: active.color, lineHeight: 1.2 }}>{active.label}</div>
          <div style={{ fontSize: 12, color: active.color + '99', marginTop: 2 }}>{active.sub}</div>
        </div>
      </div>

      {/* Välj nivå */}
      {LEVELS.map((level) => {
        const isActive = traffic === level.id
        return (
          <button key={level.id} type="button"
            onClick={() => actions.setTrafficNorm(level.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              border: isActive ? '1.5px solid ' + level.dot : '1.5px solid var(--border-subtle)',
              background: isActive ? level.bg : 'transparent',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
              transition: 'all 150ms ease',
            }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: isActive ? level.dot : 'var(--border-medium)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400, color: isActive ? level.color : 'var(--text-primary)', lineHeight: 1.2 }}>
                {level.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                {level.sub}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
