import { useBoardStore } from '../../store/useBoardStore'
import type { TrafficNorm } from '../../store/useBoardStore'

const LEVELS: { id: TrafficNorm; label: string; description: string; color: string; activeColor: string; activeBg: string }[] = [
  { id: 'tyst',  label: 'Tyst',  description: 'Ingen pratar', color: '#4a8c6a', activeColor: '#2D5C45', activeBg: '#EAF2EC' },
  { id: 'viska', label: 'Viska', description: 'Låg röst',  color: '#8c7040', activeColor: '#6b5020', activeBg: '#F5EFE6' },
  { id: 'prata', label: 'Prata', description: 'Samtalston', color: '#8c4a4a', activeColor: '#6b2020', activeBg: '#F5E8E8' },
]

export function TrafficLightWindow() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px' }}>
      {LEVELS.map((level) => {
        const isActive = traffic === level.id
        return (
          <button
            key={level.id}
            type="button"
            onClick={() => actions.setTrafficNorm(level.id)}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: isActive
                ? '1.5px solid ' + level.activeColor
                : '1.5px solid var(--border-subtle)',
              background: isActive ? level.activeBg : 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              textAlign: 'left',
              transition: 'all 150ms ease',
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: isActive ? level.activeColor : 'var(--border-medium)',
              transition: 'background 150ms ease',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? level.activeColor : 'var(--text-primary)',
                lineHeight: 1.3,
              }}>
                {level.label}
              </span>
              <span style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                lineHeight: 1.3,
              }}>
                {level.description}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
