import { useMemo, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'

const PRESETS = [1, 3, 5, 10, 15, 20, 30]
const RADIUS = 88
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TimerModule() {
  const timer = useBoardStore((state) => state.timer)
  const actions = useBoardStore((state) => state.actions)
  const [customMinutes, setCustomMinutes] = useState(8)

  const ring = useMemo(() => {
    const ratio = timer.durationMs === 0 ? 0 : timer.remainingMs / timer.durationMs
    return {
      dashOffset: CIRCUMFERENCE * (1 - ratio),
      isWarning: timer.remainingMs <= 60000 && timer.isRunning,
    }
  }, [timer.durationMs, timer.remainingMs, timer.isRunning])

  const minutesLeft = Math.floor(timer.remainingMs / 60000)
  const secondsLeft = Math.floor((timer.remainingMs % 60000) / 1000)
  const formattedTime = timer.remainingMs > 0
    ? `${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`
    : timer.isRunning ? 'Klart' : '--:--'

  const statusText = timer.isRunning
    ? (ring.isWarning ? 'Snart klart' : 'Pågår')
    : timer.remainingMs > 0 ? 'Pausad' : 'Redo'

  const applyPreset = (minutes: number) => {
    actions.setTimerDuration(minutes * 60)
  }

  const currentPresetMinutes = timer.durationMs / 60000

  const btnStyle = (active = false): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border-medium)',
    background: active ? 'var(--accent-muted)' : 'transparent',
    fontSize: 'var(--text-sm)',
    fontWeight: active ? 500 : 400,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 120ms ease',
  })

  const primaryBtn: React.CSSProperties = {
    padding: '9px 24px',
    borderRadius: 'var(--radius-full)',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'background 120ms ease',
  }

  const secondaryBtn: React.CSSProperties = {
    padding: '9px 18px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border-medium)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 120ms ease',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 16px', gap: 16 }}>

      {/* SVG Ring */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 200 200" width={200} height={200} style={{ transform: 'rotate(-90deg)' }} role="presentation">
          <circle cx={100} cy={100} r={RADIUS} fill="none" stroke="var(--timer-track)" strokeWidth={14} />
          <circle
            cx={100} cy={100} r={RADIUS} fill="none"
            stroke={ring.isWarning ? 'var(--timer-warning)' : 'var(--timer-fill)'}
            strokeWidth={ring.isWarning ? 18 : 14}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={ring.dashOffset}
            style={{ transition: 'stroke-dashoffset 1000ms linear, stroke-width 300ms ease, stroke 300ms ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {formattedTime}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Preset-knappar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {PRESETS.map(min => (
          <button key={min} type="button" onClick={() => applyPreset(min)} style={btnStyle(currentPresetMinutes === min)}>
            {min} min
          </button>
        ))}
      </div>

      {/* Kontrollknappar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!timer.isRunning ? (
          <button type="button" onClick={() => actions.startTimer()} disabled={timer.remainingMs === 0}
            style={{ ...primaryBtn, opacity: timer.remainingMs === 0 ? 0.4 : 1 }}>
            Starta
          </button>
        ) : (
          <button type="button" onClick={() => actions.pauseTimer()} style={primaryBtn}>Pausa</button>
        )}
        <button type="button" onClick={() => actions.resetTimer()} style={secondaryBtn}>Nollställ</button>
      </div>

      {/* Egen tid */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', width: '100%' }}>
        <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
          Egna minuter
        </label>
        <input
          type="number" min={1} max={180} value={customMinutes}
          onChange={(e) => setCustomMinutes(Number(e.target.value))}
          style={{ flex: 1, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-primary)', padding: '5px 8px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', outline: 'none', width: 56 }}
        />
        <button type="button" onClick={() => applyPreset(customMinutes)} style={secondaryBtn}>Sätt</button>
      </div>
    </div>
  )
}
