import { useMemo } from 'react'
import { useBoardStore, type LessonPhase } from '../../store/useBoardStore'
import type { ModuleId } from '../moduleTypes'
import { MODULE_CONFIG_MAP } from '../moduleRegistry'

const TARGETABLE_MODULES: ModuleId[] = ['timer', 'turntaking', 'groups', 'instructioncards', 'randomizer']

const TEMPLATES: { name: string; phases: { name: string; minutes: number; targetModuleId: ModuleId }[] }[] = [
  {
    name: 'GenomgÃ¥ng + Ãvning',
    phases: [
      { name: 'GenomgÃ¥ng', minutes: 15, targetModuleId: 'timer' },
      { name: 'ParÃ¶vning', minutes: 10, targetModuleId: 'groups' },
      { name: 'Redovisning', minutes: 10, targetModuleId: 'turntaking' },
    ],
  },
  {
    name: 'Diskussionslektion',
    phases: [
      { name: 'Introduktion', minutes: 5, targetModuleId: 'timer' },
      { name: 'Gruppdiskussion', minutes: 15, targetModuleId: 'groups' },
      { name: 'Helklass', minutes: 10, targetModuleId: 'turntaking' },
      { name: 'Exit ticket', minutes: 5, targetModuleId: 'exitticket' as ModuleId },
    ],
  },
]

export function LessonPlanWindow() {
  const lessonPlan = useBoardStore((state) => state.lessonPlan)
  const moduleWindows = useBoardStore((state) => state.moduleWindows)
  const actions = useBoardStore((state) => state.actions)
  const targetOptions = useMemo(
    () => TARGETABLE_MODULES.map((id) => MODULE_CONFIG_MAP[id]).filter(Boolean),
    []
  )

  if (!lessonPlan) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
        Initialiserar lektionsfaser...
      </div>
    )
  }

  const totalMinutes = lessonPlan.phases.reduce((sum, phase) => sum + phase.minutes, 0)
  const doneMinutes = lessonPlan.phases.filter((phase) => phase.done).reduce((sum, phase) => sum + phase.minutes, 0)
  const progress = totalMinutes === 0 ? 0 : Math.min(1, doneMinutes / totalMinutes)

  const handleActivate = (phase: LessonPhase) => {
    actions.setActiveLessonPhase(phase.id)
    const moduleId = phase.targetModuleId
    if (moduleWindows.windowsById[moduleId]) {
      actions.restoreModule(moduleId)
    } else {
      actions.openModule(moduleId)
    }
  }

  const handleMinutesChange = (phaseId: string, value: string) => {
    const minutes = Number(value)
    if (Number.isNaN(minutes)) return
    actions.updateLessonPhase(phaseId, { minutes })
  }

  const s = (extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: 'var(--font-sans)', ...extra
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={s({ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' })}>Lektionsfaser</div>
          <div style={s({ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 })}>
            {totalMinutes} min totalt
          </div>
        </div>
        {totalMinutes > 0 && (
          <div style={{ width: 48, height: 48, position: 'relative' }}>
            <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={18} cy={18} r={14} fill="none" stroke="var(--border-medium)" strokeWidth={3} />
              <circle cx={18} cy={18} r={14} fill="none" stroke="var(--accent)" strokeWidth={3}
                strokeDasharray={88} strokeDashoffset={88 * (1 - progress)} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 400ms ease' }} />
            </svg>
          </div>
        )}
      </div>

      {/* Mallar */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' })}>Mall</span>
        {TEMPLATES.map(t => (
          <button key={t.name} type="button"
            onClick={() => actions.applyLessonPlanTemplate()}
            style={s({ padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer' })}>
            {t.name}
          </button>
        ))}
      </div>

      {/* Faser */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {lessonPlan.phases.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 }}>
            <span style={s({ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textAlign: 'center', lineHeight: 1.6 })}>
              VÃ¤lj en mall ovan eller lÃ¤gg till faser manuellt
            </span>
          </div>
        ) : (
          lessonPlan.phases.map((phase, i) => {
            const isActive = phase.id === lessonPlan.activePhaseId
            return (
              <div key={phase.id}
                onClick={() => handleActivate(phase)}
                style={s({
                  display: 'flex', alignItems: 'center', padding: '12px 14px',
                  borderBottom: i < lessonPlan.phases.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                  cursor: 'pointer', gap: 10, transition: 'background 120ms ease',
                })}>
                <span style={s({
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: phase.done ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--surface-secondary)',
                  color: phase.done || isActive ? '#fff' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                })}>
                  {phase.done ? 'â' : i + 1}
                </span>
                <span style={s({ flex: 1, fontSize: 'var(--text-base)', fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' })}>
                  {phase.name}
                </span>
                <input type="number" min={1} max={180}
                  value={phase.minutes}
                  onChange={e => { e.stopPropagation(); handleMinutesChange(phase.id, e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  style={s({ width: 44, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-primary)', padding: '3px 5px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'center', outline: 'none' })} />
                <span style={s({ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' })}>min</span>
                <button type="button"
                  onClick={e => { e.stopPropagation(); actions.removeLessonPhase(phase.id); }}
                  style={s({ width: 22, height: 22, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 0, flexShrink: 0 })}>
                  Ã
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* LÃ¤gg till fas */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 14px' }}>
        <button type="button" onClick={() => actions.addLessonPhase()}
          style={s({ width: '100%', padding: '8px', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', cursor: 'pointer' })}>
          + LÃ¤gg till fas
        </button>
      </div>
    </div>
  )
}
