import { useBoardStore, type LessonPhase } from '../../store/useBoardStore'
import type { ModuleId } from '../moduleTypes'

const TEMPLATES = {
  'Genomgång + Övning': [
    { name: 'Genomgång', minutes: 15, targetModuleId: 'timer' as ModuleId },
    { name: 'Parövning', minutes: 10, targetModuleId: 'groups' as ModuleId },
    { name: 'Redovisning', minutes: 10, targetModuleId: 'turntaking' as ModuleId },
  ],
  'Diskussionslektion': [
    { name: 'Introduktion', minutes: 5, targetModuleId: 'timer' as ModuleId },
    { name: 'Gruppdiskussion', minutes: 15, targetModuleId: 'groups' as ModuleId },
    { name: 'Helklass', minutes: 10, targetModuleId: 'turntaking' as ModuleId },
    { name: 'Exit ticket', minutes: 5, targetModuleId: 'exitticket' as ModuleId },
  ],
}

export function LessonPlanWindow() {
  const lessonPlan = useBoardStore((state) => state.lessonPlan)
  const moduleWindows = useBoardStore((state) => state.moduleWindows)
  const actions = useBoardStore((state) => state.actions)
  const phases: LessonPhase[] = lessonPlan?.phases ?? []
  const activeId = lessonPlan?.activePhaseId
  const totalMin = phases.reduce((s, p) => s + (p.minutes ?? 0), 0)
  const doneMin = phases.filter(p => p.done).reduce((s, p) => s + (p.minutes ?? 0), 0)
  const progress = totalMin === 0 ? 0 : Math.min(1, doneMin / totalMin)

  const s = (extra?: React.CSSProperties): React.CSSProperties => ({ fontFamily: 'var(--font-sans)', ...extra })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' }}>

      {/* Header med progress-cirkel */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={s({ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' })}>Lektionsfaser</div>
          <div style={s({ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 })}>{totalMin} min totalt</div>
        </div>
        {totalMin > 0 && (
          <div style={{ width: 44, height: 44, flexShrink: 0 }}>
            <svg viewBox="0 0 44 44" style={{ width: 44, height: 44, transform: 'rotate(-90deg)' }}>
              <circle cx={22} cy={22} r={17} fill="none" stroke="var(--border-medium)" strokeWidth={3.5} />
              <circle cx={22} cy={22} r={17} fill="none" stroke="var(--accent)" strokeWidth={3.5}
                strokeDasharray={106.8} strokeDashoffset={106.8 * (1 - progress)}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 400ms ease' }} />
            </svg>
          </div>
        )}
      </div>

      {/* Mallar */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' })}>Mall</span>
        {Object.keys(TEMPLATES).map(name => (
          <button key={name} type="button"
            onClick={() => actions.applyLessonPlanTemplate()}
            style={s({ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer' })}>
            {name}
          </button>
        ))}
      </div>

      {/* Faser */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {phases.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 }}>
            <span style={s({ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textAlign: 'center', lineHeight: 1.6 })}>
              Välj en mall ovan eller lägg till faser
            </span>
          </div>
        ) : (
          phases.map((phase, i) => {
            const isActive = phase.id === activeId
            return (
              <div key={phase.id}
                onClick={() => {
                  actions.setActiveLessonPhase(phase.id)
                  const mid = phase.targetModuleId
                  if (moduleWindows.windowsById[mid]) actions.restoreModule(mid)
                  else actions.openModule(mid)
                }}
                style={s({ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: i < phases.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: isActive ? 'var(--accent-muted)' : 'transparent', cursor: 'pointer', gap: 10, transition: 'background 120ms ease' })}>
                <span style={s({ width: 24, height: 24, borderRadius: '50%', background: phase.done ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--surface-secondary)', color: phase.done || isActive ? '#fff' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 600, flexShrink: 0 })}>
                  {phase.done ? '✓' : i + 1}
                </span>
                <span style={s({ flex: 1, fontSize: 'var(--text-base)', fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' })}>
                  {phase.name}
                </span>
                <input type="number" min={1} max={180} value={phase.minutes}
                  onChange={e => { e.stopPropagation(); const m = Number(e.target.value); if (!Number.isNaN(m)) actions.updateLessonPhase(phase.id, { minutes: m }) }}
                  onClick={e => e.stopPropagation()}
                  style={s({ width: 44, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-primary)', padding: '3px 5px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'center', outline: 'none', fontFamily: 'var(--font-mono)' })} />
                <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' })}>min</span>
                <button type="button" onClick={e => { e.stopPropagation(); actions.removeLessonPhase(phase.id) }}
                  style={s({ width: 22, height: 22, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 0, flexShrink: 0 })}>
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Lagg till fas */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 14px' }}>
        <button type="button" onClick={() => actions.addLessonPhase()}
          style={s({ width: '100%', padding: '8px', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', cursor: 'pointer' })}>
          + Lägg till fas
        </button>
      </div>
    </div>
  )
}
