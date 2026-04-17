import { useBoardStore, type LessonPhase } from '../../store/useBoardStore'
import type { ModuleId } from '../moduleTypes'

const TEMPLATES = {
  'Genomgång + Övning': [
    { title: 'Genomgång', durationMin: 15, targetModuleId: 'timer' as ModuleId },
    { title: 'Parövning', durationMin: 10, targetModuleId: 'groups' as ModuleId },
    { title: 'Redovisning', durationMin: 10, targetModuleId: 'turntaking' as ModuleId },
  ],
  'Diskussionslektion': [
    { title: 'Introduktion', durationMin: 5, targetModuleId: 'timer' as ModuleId },
    { title: 'Gruppdiskussion', durationMin: 15, targetModuleId: 'groups' as ModuleId },
    { title: 'Helklass', durationMin: 10, targetModuleId: 'turntaking' as ModuleId },
    { title: 'Exit ticket', durationMin: 5, targetModuleId: 'exitticket' as ModuleId },
  ],
}

export function LessonPlanWindow() {
  const lessonPlan = useBoardStore((state) => state.lessonPlan)
  const actions = useBoardStore((state) => state.actions)
  const phases: LessonPhase[] = lessonPlan?.phases ?? []
  const activeId = lessonPlan?.activePhaseId

  const totalMin = phases.reduce((s, p) => s + (p.durationMin ?? 0), 0)

  const s = (extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: 'var(--font-sans)',
    ...extra,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Mallar */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' })}>Mall</span>
        {Object.keys(TEMPLATES).map(name => (
          <button
            key={name}
            type="button"
            onClick={() => actions.applyLessonPlanTemplate(TEMPLATES[name as keyof typeof TEMPLATES])}
            style={s({
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-medium)',
              background: 'transparent',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            })}
          >
            {name}
          </button>
        ))}
        <span style={s({ marginLeft: 'auto', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' })}>
          {totalMin} min
        </span>
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
              <div
                key={phase.id}
                onClick={() => actions.setActiveLessonPhase(phase.id)}
                style={s({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '13px 16px',
                  borderBottom: i < phases.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                  cursor: 'pointer',
                  gap: 12,
                  transition: 'background 120ms ease',
                })}
              >
                {/* Nummer */}
                <span style={s({
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: isActive ? 'var(--accent)' : 'var(--surface-secondary)',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  flexShrink: 0,
                })}>
                  {i + 1}
                </span>

                {/* Titel */}
                <span style={s({
                  flex: 1,
                  fontSize: 'var(--text-base)',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                })}>
                  {phase.title}
                </span>

                {/* Tid */}
                <span style={s({ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' })}>
                  {phase.durationMin} min
                </span>

                {/* Ta bort */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); actions.removeLessonPhase(phase.id); }}
                  style={s({
                    width: 24, height: 24,
                    border: 'none', background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, lineHeight: 1,
                    flexShrink: 0,
                  })}
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Lägg till fas */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 14px' }}>
        <button
          type="button"
          onClick={() => actions.addLessonPhase({ title: 'Ny fas', durationMin: 10, targetModuleId: 'timer' as ModuleId })}
          style={s({
            width: '100%',
            padding: '9px',
            border: '1px dashed var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          })}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
        >
          + Lägg till fas
        </button>
      </div>
    </div>
  )
}
