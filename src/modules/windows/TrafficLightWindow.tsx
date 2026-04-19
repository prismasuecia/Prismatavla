import { useBoardStore } from '../../store/useBoardStore'

const LEVELS = [
  {
    id: 'silent' as const,
    label: 'Tyst',
    sub: 'Ingen pratar',
    color: '#2D5C45',
    bg: '#EAF2EC',
    dot: '#2D5C45',
  },
  {
    id: 'whisper' as const,
    label: 'Viska',
    sub: 'Låg röst',
    color: '#8C6D3F',
    bg: '#F5EFE6',
    dot: '#C4973F',
  },
  {
    id: 'talk' as const,
    label: 'Prata',
    sub: 'Samtalston',
    color: '#8C3F3F',
    bg: '#F5E8E8',
    dot: '#C43F3F',
  },
]

export function TrafficLightWindow() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)

  const active = LEVELS.find((l) => l.id === traffic) ?? LEVELS[2]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px 16px',
      gap: 12,
      fontFamily: 'var(--font-sans)',
    }}>

      {/* Aktiv status — stor display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        background: active.bg,
        border: '1.5px solid ' + active.dot + '33',
        marginBottom: 4,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: active.dot, flexShrink: 0,
          boxShadow: '0 0 0 4px ' + active.dot + '22',
        }} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: active.color, lineHeight: 1.2 }}>
            {active.label}
          </div>
          <div style={{ fontSize: 13, color: active.color + 'aa', marginTop: 2 }}>
            {active.sub}
          </div>
        </div>
      </div>

      {/* Knappar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {LEVELS.map((level) => {
          const isActive = traffic === level.id
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => actions.setTrafficLevel(level.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 16px',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1.5px solid ' + level.dot : '1.5px solid var(--border-subtle)',
                background: isActive ? level.bg : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms ease',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: isActive ? level.dot : 'var(--border-medium)',
                flexShrink: 0, transition: 'background 150ms',
              }} />
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
    </div>
  )
}
