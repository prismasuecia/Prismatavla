import { useEffect, useMemo } from 'react'
import clsx from 'clsx'
import type { AppActions, TurnState } from '../state/AppStateProvider.tsx'

interface TurnModuleProps {
  students: string[]
  turns: TurnState
  actions: AppActions['turns']
  onReloadClass: () => void
}

const PER_TIMER_RANGE = { min: 15, max: 180, step: 15 }

export function TurnModule({ students, turns, actions, onReloadClass }: TurnModuleProps) {
  const current = turns.queue[0]
  const hasStudents = students.length > 0

  useEffect(() => {
    if (!turns.perTimer.enabled || !turns.perTimer.isRunning) {
      return
    }
    const id = window.setInterval(() => actions.tickPerTimer(), 1000)
    return () => window.clearInterval(id)
  }, [turns.perTimer.enabled, turns.perTimer.isRunning, actions])

  const perTimerDisplay = useMemo(() => {
    const minutes = Math.floor(turns.perTimer.remainingSec / 60)
    const seconds = turns.perTimer.remainingSec % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [turns.perTimer.remainingSec])

  const completedPreview = turns.completed.slice(0, 6)

  const runAdvance = (status: 'done' | 'skipped') => {
    actions.next(status)
    if (turns.perTimer.enabled) {
      actions.restartPerTimer()
    }
  }

  const handleEnd = () => {
    actions.end()
    actions.syncWithStudents(students)
  }

  return (
    <div className="module turn-module">
      <header className="module-header">
        <div>
          <p className="eyebrow">Tur i tur</p>
          <h2>Fördela ordet rättvist</h2>
        </div>
        <div className="mode-toggle" role="radiogroup">
          {['random', 'ordered'].map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={turns.mode === mode}
              className={clsx({ active: turns.mode === mode })}
              onClick={() => actions.setMode(mode as TurnState['mode'], students)}
            >
              {mode === 'random' ? 'Slumpa' : 'Lista'}
            </button>
          ))}
          <button type="button" className="ghost" onClick={onReloadClass}>
            Ladda klasslista
          </button>
        </div>
      </header>

      <div className="turn-body">
        <div className="current-name" aria-live="polite">
          {!hasStudents && <p>Lägg till elever i klasslistan för att börja.</p>}
          {hasStudents && !current && <p>Alla är klara. Starta om eller byt lista.</p>}
          {current && (
            <>
              <span>Nästa elev</span>
              <strong>{current}</strong>
            </>
          )}
        </div>

        <div className="turn-actions">
          <button type="button" disabled={!current} onClick={() => runAdvance('done')}>
            Nästa
          </button>
          <button type="button" disabled={!current} onClick={() => runAdvance('skipped')}>
            Skippa
          </button>
          <button type="button" disabled={!current} onClick={() => actions.putLast()}>
            Sätt sist
          </button>
          <button type="button" disabled={!turns.completed.length} onClick={() => actions.undo()}>
            Ångra
          </button>
          <button type="button" onClick={handleEnd}>
            Avsluta
          </button>
        </div>

        <section className="per-student">
          <div className="per-header">
            <label className="switch">
              <input
                type="checkbox"
                checked={turns.perTimer.enabled}
                onChange={() => actions.togglePerTimer()}
              />
              <span>Elevtimer</span>
            </label>
            {turns.perTimer.enabled && (
              <span className="pill">{perTimerDisplay}</span>
            )}
          </div>
          {turns.perTimer.enabled && (
            <div className="per-slider">
              <input
                type="range"
                min={PER_TIMER_RANGE.min}
                max={PER_TIMER_RANGE.max}
                step={PER_TIMER_RANGE.step}
                value={turns.perTimer.durationSec}
                onChange={(event) => actions.setPerTimerDuration(Number(event.target.value))}
              />
              <button type="button" onClick={() => actions.restartPerTimer()}>
                Starta om elevtimer
              </button>
            </div>
          )}
        </section>

        <section className="teacher-log">
          <div className="log-header">
            <div>
              <p>Protokoll</p>
              <small>Synligt endast när läraren väljer det.</small>
            </div>
            <button type="button" onClick={() => actions.toggleTeacherLog()}>
              {turns.showTeacherLog ? 'Dölj logg' : 'Visa logg'}
            </button>
          </div>
          {turns.showTeacherLog && (
            <ul>
              {completedPreview.map((entry) => (
                <li key={entry.id} className={entry.status}>
                  <span>{entry.name}</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString([], { timeStyle: 'short' })}</span>
                  <span>{entry.status === 'done' ? 'klar' : 'skippad'}</span>
                </li>
              ))}
              {!completedPreview.length && <li>Ingen historik än.</li>}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
