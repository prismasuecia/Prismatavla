import { useMemo } from 'react'
import { useBoardStore, type LessonPhase } from '../../store/useBoardStore'
import type { ModuleId } from '../moduleTypes'
import { MODULE_CONFIG_MAP } from '../moduleRegistry'

const TARGETABLE_MODULES: ModuleId[] = ['timer', 'turntaking', 'groups', 'instructioncards', 'randomizer']

export function LessonPlanWindow() {
  const lessonPlan = useBoardStore((state) => state.lessonPlan)
  const moduleWindows = useBoardStore((state) => state.moduleWindows)
  const actions = useBoardStore((state) => state.actions)
  const targetOptions = useMemo(() => TARGETABLE_MODULES.map((id) => MODULE_CONFIG_MAP[id]).filter(Boolean), [])

  if (!lessonPlan) {
    return (
      <div className="panel-card">
        <p className="eyebrow">Lektionsplan</p>
        <p>Initialiserar lektionsfaser...</p>
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
    if (Number.isNaN(minutes)) {
      return
    }
    actions.updateLessonPhase(phaseId, { minutes })
  }

  return (
    <div className="lesson-plan-window">
      <header className="lesson-plan-header">
        <div>
          <p className="eyebrow">Lektionsfaser</p>
          <h2>Plan för tavlan</h2>
        </div>
        <div className="lesson-plan-actions">
          <button
            type="button"
            className="toolbar-btn outline"
            onClick={() => actions.setLessonPlanProgress(!lessonPlan.showProgress)}
          >
            {lessonPlan.showProgress ? 'Göm progress' : 'Visa progress'}
          </button>
          <button type="button" className="toolbar-btn outline" onClick={actions.applyLessonPlanTemplate}>
            75-min mall
          </button>
          <button type="button" className="toolbar-btn" onClick={actions.addLessonPhase}>
            Ny fas
          </button>
        </div>
      </header>

      {lessonPlan.showProgress && (
        <div className="lesson-plan-progress">
          <div className="lesson-plan-progress-bar" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <span>
            {doneMinutes} / {totalMinutes} min klara
          </span>
        </div>
      )}

      <div className="lesson-plan-body">
        {lessonPlan.phases.map((phase, index) => {
          const isActive = lessonPlan.activePhaseId === phase.id
          return (
            <article key={phase.id} className="lesson-phase" data-active={isActive} data-done={phase.done}>
              <header className="lesson-phase-header">
                <div className="lesson-phase-index">{index + 1}</div>
                <input
                  type="text"
                  value={phase.name}
                  onChange={(event) => actions.updateLessonPhase(phase.id, { name: event.target.value })}
                  aria-label={`Namn för fas ${index + 1}`}
                />
                <button type="button" className="ghost-btn" onClick={() => actions.removeLessonPhase(phase.id)}>
                  Ta bort
                </button>
              </header>
              <div className="lesson-phase-grid">
                <label>
                  Minuter
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={phase.minutes}
                    onChange={(event) => handleMinutesChange(phase.id, event.target.value)}
                  />
                </label>
                <label>
                  Målmodul
                  <select
                    value={phase.targetModuleId}
                    onChange={(event) =>
                      actions.updateLessonPhase(phase.id, { targetModuleId: event.target.value as ModuleId })
                    }
                  >
                    {targetOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="lesson-phase-footer">
                <button type="button" className="toolbar-btn outline" onClick={() => handleActivate(phase)}>
                  Aktivera fas
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => actions.toggleLessonPhaseDone(phase.id)}
                >
                  {phase.done ? 'Markera pågående' : 'Markera färdig'}
                </button>
              </div>
            </article>
          )
        })}

        {!lessonPlan.phases.length && (
          <div className="lesson-plan-empty">
            <p>Lägg till faser för att visa hur lektionen växlar mellan modulerna.</p>
            <button type="button" className="toolbar-btn" onClick={actions.addLessonPhase}>
              Lägg till första fasen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
