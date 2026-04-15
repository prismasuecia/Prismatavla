import type { AppActions, TimelinePhase } from '../state/AppStateProvider.tsx'

const TEMPLATE_75: Omit<TimelinePhase, 'id' | 'done'>[] = [
  { name: 'Start 5 min', minutes: 5, targetStage: 'timer' },
  { name: 'Mini-genomgång', minutes: 10, targetStage: 'timer' },
  { name: 'Tur i tur', minutes: 15, targetStage: 'wheel' },
  { name: 'Grupparbete', minutes: 30, targetStage: 'groups' },
  { name: 'Avslut', minutes: 15, targetStage: 'timer' },
]

interface TimelinePanelProps {
  phases: TimelinePhase[]
  activePhaseId?: string
  visible: boolean
  actions: AppActions['timeline']
}

export function TimelinePanel({ phases, activePhaseId, visible, actions }: TimelinePanelProps) {
  const total = phases.reduce((sum, phase) => sum + phase.minutes, 0)
  const done = phases
    .filter((phase) => phase.done)
    .reduce((sum, phase) => sum + phase.minutes, 0)
  const progress = total === 0 ? 0 : Math.min(1, done / total)

  const addPhase = () => {
    actions.upsertPhase({ name: 'Ny fas', minutes: 5, targetStage: 'timer' })
  }

  const applyTemplate = () => {
    actions.applyTemplate(
      TEMPLATE_75.map((phase) => ({ ...phase, minutes: phase.minutes })),
    )
  }

  return (
    <div className="module timeline-panel">
      <header className="module-header">
        <div>
          <p className="eyebrow">Lektionsfaser</p>
          <h2>Synlig tidslinje</h2>
        </div>
        <div className="timeline-actions">
          <button type="button" onClick={() => actions.setVisible(!visible)}>
            {visible ? 'Göm progress' : 'Visa progress'}
          </button>
          <button type="button" onClick={applyTemplate}>
            75-min mall
          </button>
          <button type="button" onClick={addPhase}>
            Ny fas
          </button>
        </div>
      </header>

      {visible && (
        <div className="timeline-progress">
          <div className="bar" style={{ width: `${progress * 100}%` }} />
          <span>
            {done} / {total} min
          </span>
        </div>
      )}

      <div className="phase-list">
        {phases.map((phase) => (
          <article key={phase.id} className={phase.id === activePhaseId ? 'active' : ''}>
            <header>
              <input
                type="text"
                value={phase.name}
                onChange={(event) =>
                  actions.upsertPhase({ ...phase, name: event.target.value, id: phase.id })
                }
              />
              <button type="button" onClick={() => actions.removePhase(phase.id)}>
                Ta bort
              </button>
            </header>
            <div className="phase-grid">
              <label>
                Minuter
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={phase.minutes}
                  onChange={(event) =>
                    actions.upsertPhase({ ...phase, minutes: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Modul
                <select
                  value={phase.targetStage}
                  onChange={(event) =>
                    actions.upsertPhase({
                      ...phase,
                      targetStage: event.target.value as TimelinePhase['targetStage'],
                    })
                  }
                >
                  <option value="timer">Timer</option>
                  <option value="wheel">Tur i tur (hjul)</option>
                  <option value="turns">Talrunda</option>
                  <option value="groups">Grupper</option>
                </select>
              </label>
            </div>
            <div className="phase-actions">
              <button type="button" onClick={() => actions.setActivePhase(phase.id)}>
                Aktivera fas
              </button>
              <button type="button" onClick={() => actions.toggleDone(phase.id)}>
                {phase.done ? 'Markera som pågående' : 'Markera färdig'}
              </button>
            </div>
          </article>
        ))}
        {!phases.length && <p>Lägg till faser för att visa progression.</p>}
      </div>
    </div>
  )
}
