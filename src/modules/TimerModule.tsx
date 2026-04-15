import { useEffect, useMemo, useState } from 'react'
import type { AppActions, TimerState } from '../state/AppStateProvider.tsx'

const PRESETS = [1, 3, 5, 10, 15, 20, 30]

interface TimerModuleProps {
  timer: TimerState
  actions: AppActions['timer']
}

export function TimerModule({ timer, actions }: TimerModuleProps) {
  const [customMinutes, setCustomMinutes] = useState(8)

  useEffect(() => {
    if (!timer.isRunning) {
      return
    }
    const id = window.setInterval(() => {
      actions.tick()
    }, 1000)
    return () => window.clearInterval(id)
  }, [timer.isRunning, actions])

  const ring = useMemo(() => {
    const radius = 86
    const circumference = 2 * Math.PI * radius
    const ratio = timer.durationSec === 0 ? 0 : timer.remainingSec / timer.durationSec
    return {
      radius,
      circumference,
      dashOffset: circumference * (1 - ratio),
    }
  }, [timer.durationSec, timer.remainingSec])

  const minutesLeft = Math.floor(timer.remainingSec / 60)
  const secondsLeft = timer.remainingSec % 60
  const formattedClock = `${minutesLeft.toString().padStart(2, '0')}:${secondsLeft
    .toString()
    .padStart(2, '0')}`

  const applyPreset = (minutes: number) => {
    const seconds = minutes * 60
    actions.setDuration(seconds, `${minutes} min`, true)
  }

  const handleCustomSet = (event: React.FormEvent) => {
    event.preventDefault()
    if (customMinutes <= 0) {
      return
    }
    actions.setDuration(customMinutes * 60, `${customMinutes} min`, false)
  }

  return (
    <div className="module timer-module">
      <header className="module-header">
        <div>
          <p className="eyebrow">Timer</p>
          <h2>Strukturerad tid</h2>
        </div>
        <div className="preset-row" aria-label="Snabbval minuter">
          {PRESETS.map((preset) => (
            <button key={preset} type="button" onClick={() => applyPreset(preset)}>
              {preset} min
            </button>
          ))}
        </div>
      </header>

      <div className="timer-body">
        <div className="ring">
          <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" role="presentation">
            <circle className="ring-track" cx="100" cy="100" r={ring.radius} />
            <circle
              className={`ring-progress ${timer.remainingSec <= 60 ? 'warning' : ''}`}
              cx="100"
              cy="100"
              r={ring.radius}
              strokeDasharray={ring.circumference}
              strokeDashoffset={ring.dashOffset}
            />
          </svg>
          <div className="ring-label">
            <span>{timer.label}</span>
            <strong>{formattedClock}</strong>
          </div>
        </div>

        <div className="timer-actions">
          <div className="button-row">
            <button type="button" onClick={() => actions.start()} disabled={timer.isRunning}>
              Starta
            </button>
            <button type="button" onClick={() => actions.pause()} disabled={!timer.isRunning}>
              Pausa
            </button>
            <button type="button" onClick={() => actions.reset()}>
              Nollställ
            </button>
          </div>
          <form className="custom-duration" onSubmit={handleCustomSet}>
            <label>
              Egen tid (min)
              <input
                type="number"
                min={1}
                max={180}
                value={customMinutes}
                onChange={(event) => setCustomMinutes(Number(event.target.value))}
              />
            </label>
            <button type="submit">Ställ in</button>
          </form>
          <p className="micro-copy">
            Ringen blir tjockare vid 60 sekunder kvar som en diskret påminnelse utan ljud eller
            blinkningar.
          </p>
        </div>
      </div>
    </div>
  )
}
