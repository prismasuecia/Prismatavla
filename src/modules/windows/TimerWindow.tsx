import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useBoardStore, type TimerEndSignal, type TimerWarningMode } from '../../store/useBoardStore'

const PRESETS = [1, 3, 5, 10, 15, 20, 30]
const WARNING_OPTIONS: { id: TimerWarningMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'tenPercent', label: '10 %' },
  { id: 'twoMinutes', label: '2 min' },
]

const END_SIGNAL_OPTIONS: { id: TimerEndSignal; label: string; helper: string }[] = [
  { id: 'visual', label: 'Visual only', helper: 'Tyst avslut' },
  { id: 'tone', label: 'Soft tone', helper: 'Diskret ton' },
]

export function TimerWindow() {
  const timer = useBoardStore((state) => state.timer)
  const preferences = useBoardStore((state) => state.timerPreferences)
  const actions = useBoardStore((state) => state.actions)
  const audioRef = useRef<AudioContext | null>(null)
  const previousRemainingRef = useRef(timer.remainingMs)
  const [customMinutes, setCustomMinutes] = useState(10)
  const [frameTimestamp, setFrameTimestamp] = useState(() => Date.now())

  useEffect(() => {
    if (!timer.isRunning) {
      return
    }
    let raf: number
    const update = () => {
      setFrameTimestamp(Date.now())
      raf = window.requestAnimationFrame(update)
    }
    raf = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(raf)
  }, [timer.isRunning])

  const playTone = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      return
    }
    if (!audioRef.current) {
      audioRef.current = new AudioContext()
    }
    const ctx = audioRef.current
    if (!ctx) {
      return
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined)
    }
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 640
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.65)
  }, [])

  useEffect(() => {
    const justCompleted = previousRemainingRef.current > 0 && timer.remainingMs === 0
    if (justCompleted && preferences.endSignal === 'tone') {
      playTone()
    }
    previousRemainingRef.current = timer.remainingMs
  }, [timer.remainingMs, preferences.endSignal, playTone])

  const frameRemaining = timer.isRunning && timer.targetAt ? Math.max(0, timer.targetAt - frameTimestamp) : timer.remainingMs
  const duration = Math.max(timer.durationMs, 1)
  const normalizedProgress = Math.min(1, Math.max(0, frameRemaining / duration))
  const minutesRemaining = Math.max(0, Math.ceil(frameRemaining / 60000))
  const statusLabel =
    frameRemaining === 0 ? 'Klart' : timer.isRunning ? 'Pågår' : timer.remainingMs === timer.durationMs ? 'Redo' : 'Paus'
  const warningThreshold = getWarningThreshold(preferences.warningMode, duration)
  const warningActive = typeof warningThreshold === 'number' && frameRemaining <= warningThreshold
  const wedgeState = frameRemaining === 0 || timer.durationMs === 0 ? 'done' : 'active'
  const wedgeStyle: CSSProperties = {
    '--timer-progress': `${normalizedProgress * 360}deg`,
  }

  const handlePreset = (minutes: number) => {
    actions.setTimerDuration(minutes * 60)
  }

  const handleCustomSet = () => {
    const minutes = Number.isFinite(customMinutes) ? Math.min(240, Math.max(1, customMinutes)) : 1
    actions.setTimerDuration(minutes * 60)
    setCustomMinutes(minutes)
  }

  return (
    <div className="timer-window">
      <section className="timer-shell">
        <div className="timer-visual" role="img" aria-label="Timer i form av fylld sektor">
          <div className="timer-wedge" style={wedgeStyle} data-state={wedgeState} />
          <div className="timer-warning-ring" data-active={warningActive ? 'true' : 'false'} />
          <div className="timer-core" data-complete={frameRemaining === 0 ? 'true' : 'false'}>
            {preferences.showTime && <span className="timer-minutes">{minutesRemaining} min</span>}
            <span className="timer-status">{statusLabel}</span>
          </div>
        </div>

        <div className="timer-panel">
          <div className="preset-grid">
            {PRESETS.map((minutes) => (
              <button key={minutes} type="button" onClick={() => handlePreset(minutes)}>
                {minutes} min
              </button>
            ))}
          </div>

          <div className="custom-row">
            <label>
              Anpassa
              <input
                type="number"
                min={1}
                max={240}
                value={customMinutes}
                onChange={(event) => setCustomMinutes(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={handleCustomSet}>
              Sätt tid
            </button>
          </div>

          <div className="timer-actions">
            <button type="button" onClick={() => actions.startTimer()}>
              Starta
            </button>
            <button type="button" onClick={() => actions.pauseTimer()}>
              Pausa
            </button>
            <button type="button" onClick={() => actions.resetTimer()}>
              Nollställ
            </button>
          </div>

          <div className="teacher-settings projector-hide">
            <header>
              <p>Teacher settings</p>
              <span className="micro-copy">Endast för dig</span>
            </header>
            <label className="toggle">
              <span>Visa tid</span>
              <input
                type="checkbox"
                checked={preferences.showTime}
                onChange={(event) => actions.setTimerPreferences({ showTime: event.target.checked })}
              />
              <span className="toggle-visual" aria-hidden="true" />
            </label>

            <div className="setting-group">
              <span>Warning style</span>
              <div className="radio-grid">
                {WARNING_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={preferences.warningMode === option.id ? 'active' : ''}
                    onClick={() => actions.setTimerPreferences({ warningMode: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <span>End signal</span>
              <div className="radio-stack">
                {END_SIGNAL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={preferences.endSignal === option.id ? 'active' : ''}
                    onClick={() => actions.setTimerPreferences({ endSignal: option.id })}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.helper}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function getWarningThreshold(mode: TimerWarningMode, durationMs: number) {
  switch (mode) {
    case 'tenPercent':
      return durationMs * 0.1
    case 'twoMinutes':
      return Math.min(durationMs, 120_000)
    default:
      return undefined
  }
}
