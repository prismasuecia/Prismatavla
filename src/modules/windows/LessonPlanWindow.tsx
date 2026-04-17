import { useMemo } from 'react'
import { useBoardStore, type LessonPhase } from '../../store/useBoardStore'
import type { ModuleId } from '../moduleTypes'
import { MODULE_CONFIG_MAP } from '../moduleRegistry'

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

  if (!lessonPlan) return null

  const phases = lessonPlan.phases ?? []
  const activeId = lessonPlan.activePhaseId
  const totalMin = phases.reduce((sum, p) => sum + (p.durationMin ?? 0), 0)

  const s = (extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: 'var(--font-sans)',
    ...extra,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Mallar */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginRight: 2 })}>Mall:</span>
        {Object.keys(TEMPLATES).map(name => (
          <button key={name} type="button"
            onClick={() => actions.applyLessonPlanTemplate(TEMPLATES[name as keyof typeof TEMPLATES])}
            style={s({ padding: '5px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 120ms ease' })}>
            {name}
          </button>
        ))}
        <div style={s({ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' })}>
          {totalMin} min
        </div>
      </div>

      {/* Faser */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {phases.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: 32, textAlign: 'center' }}>
            Välj en mall ovan eller lägg till faser manuellt
          </div>
        ) : phases.map((phase, i) => {
          const isActive = phase.id === activeId
          return (
            <div key={phase.id}
              onClick={() => actions.setActiveLessonPhase(phase.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 120ms ease',
              }}>
              {/* Fas-nummer */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--accent)' : 'var(--surface-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-xs)', fontWeight: 600,
                color: isActive ? '#fff' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
              }}>
                {phase.done ? '✓' : i + 1}
              </div>

              {/* Titel */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={phase.title}
                  onChange={(e) => actions.updateLessonPhase({ id: phase.id, title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={s({ border: 'none', background: 'transparent', fontSize: 'var(--text-sm)', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)', outline: 'none', width: '100%' })}
                />
              </div>

              {/* Tid */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <input
                  type="number"
                  value={phase.durationMin ?? ''}
                  onChange={(e) => actions.updateLessonPhase({ id: phase.id, durationMin: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  style={s({ width: 40, border: 'none', background: 'transparent', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'right', outline: 'none' })}
                />
                <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' })}>min</span>
              </div>

              {/* Ta bort */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); actions.removeLessonPhase(phase.id); }}
                style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 4, padding: 0 }}
              >×</button>
            </div>
          )
        })}
      </div>

      {/* Botten */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
        <button type="button"
          onClick={() => actions.addLessonPhase({ title: 'Ny fas', durationMin: 10 })}
          style={s({ padding: '7px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 })}>
          + Lägg till fas
        </button>
      </div>
    </div>
  )
}
