import { useBoardStore } from '../../store/useBoardStore'

const LEVELS = [
  { id: 'tyst'  as const, label: 'Tyst',  sub: 'Ingen pratar', dot: '#2D5C45', bg: '#EAF2EC', color: '#1a3d2e' },
  { id: 'viska' as const, label: 'Viska', sub: 'Låg röst',   dot: '#C4973F', bg: '#F5EFE6', color: '#5c4010' },
  { id: 'prata' as const, label: 'Prata', sub: 'Samtalston',  dot: '#C43F3F', bg: '#F5E8E8', color: '#5c1010' },
]

export function TrafficLightWindow() {
  const traffic = useBoardStore(s => s.traffic)
  const actions  = useBoardStore(s => s.actions)
  const active   = LEVELS.find(l => l.id === traffic) ?? LEVELS[2]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: active.bg, border: '1.5px solid ' + active.dot + '55',
        borderRadius: 12, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4,
      }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: active.dot, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: active.color }}>{active.label}</div>
          <div style={{ fontSize: 12, color: active.color, opacity: 0.7, marginTop: 2 }}>{active.sub}</div>
        </div>
      </div>

      {LEVELS.map(lv => {
        const on = traffic === lv.id
        return (
          <button key={lv.id} type="button" onClick={() => actions.setTrafficNorm(lv.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', borderRadius: 10,
              border: on ? '1.5px solid ' + lv.dot : '1.5px solid #e0ddd8',
              background: on ? lv.bg : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: on ? lv.dot : '#ccc', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? lv.color : '#333' }}>{lv.label}</span>
              <span style={{ fontSize: 11, color: '#999' }}>{lv.sub}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
