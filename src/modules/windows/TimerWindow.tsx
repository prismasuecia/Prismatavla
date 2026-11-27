import { useState } from 'react'
import { useBoardStore } from '../../store/useBoardStore'

const PRESETS = [1, 3, 5, 10, 15, 20, 30]
const RADIUS = 70

export function TimerWindow() {
  const timer = useBoardStore((state) => state.timer)
  const actions = useBoardStore((state) => state.actions)
  const fullscreen = useBoardStore((state) => Boolean(state.moduleWindows.windowsById.timer?.fullscreen))
  const [customMinutes, setCustomMinutes] = useState(8)
  const [timeError, setTimeError] = useState('')

  const scaleMinutes = Math.max(60, Math.ceil(timer.durationMs / 3600000) * 60)
  const ratio = Math.max(0, Math.min(1, timer.remainingMs / (scaleMinutes * 60000)))
  const angle = ratio * Math.PI * 2
  const endX = 100 - RADIUS * Math.sin(angle)
  const endY = 100 - RADIUS * Math.cos(angle)
  const sector = `M 100 100 L 100 ${100 - RADIUS} A ${RADIUS} ${RADIUS} 0 ${ratio > 0.5 ? 1 : 0} 0 ${endX} ${endY} Z`

  const minutesLeft = Math.ceil(timer.remainingMs / 60000)
  const formattedTime = timer.remainingMs > 0
    ? `${minutesLeft} min`
    : 'Klart'

  const statusText = timer.isRunning
    ? 'Pågår'
    : timer.remainingMs > 0 ? 'Pausad' : 'Redo'

  const applyPreset = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      setTimeError('Ange en tid mellan 1 och 180 minuter.')
      return
    }
    setTimeError('')
    actions.setTimerDuration(minutes * 60)
  }

  const currentPresetMinutes = timer.durationMs / 60000

  const presetBtn = (active: boolean): React.CSSProperties => ({
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
  }

  return (
    <div className="timer-editorial timer-material">

      {/* The fixed scale keeps equal durations visually comparable. */}
      <div className="timer-material-dial">
        <svg viewBox="0 0 200 200" width={200} height={200}
          style={{ width: '100%', height: '100%', overflow: 'visible' }} role="img" aria-label={`${formattedTime} kvar, skala ${scaleMinutes} minuter`}>
          <circle cx={100} cy={100} r={98} fill="var(--surface-primary)" stroke="var(--border-medium)" strokeWidth={1} />
          <circle cx={100} cy={100} r={RADIUS} fill="var(--timer-track)" opacity={0.35} />
          {ratio >= 1 ? <circle cx={100} cy={100} r={RADIUS} fill="#b65f52" /> : ratio > 0 ? <path d={sector} fill="#b65f52" /> : null}
          {Array.from({ length: 60 }, (_, i) => {
            const a = -i * Math.PI / 30
            const major = i % 5 === 0
            const inner = major ? 71 : 74
            return <line key={i} x1={100 + inner * Math.sin(a)} y1={100 - inner * Math.cos(a)} x2={100 + 79 * Math.sin(a)} y2={100 - 79 * Math.cos(a)} stroke="var(--text-secondary)" strokeWidth={major ? 1.5 : 0.65} />
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const a = -i * Math.PI / 6
            return <text key={i} x={100 + 88 * Math.sin(a)} y={100 - 88 * Math.cos(a)} textAnchor="middle" dominantBaseline="central" fill="var(--text-primary)" fontFamily="var(--font-sans)" fontWeight={600} fontSize={10}>{i * scaleMinutes / 12}</text>
          })}
          <circle cx={100} cy={100} r={4} fill="var(--text-primary)" />
        </svg>
      </div>
        <div className="timer-material-time" style={{ textAlign: 'center' }}>
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: fullscreen ? 44 : 30,
            fontWeight: 400,
            color: 'var(--text-primary)',
            letterSpacing: 0,
            lineHeight: 1,
          }}>
            {formattedTime}
          </span>
          <span style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginTop: 6,
            fontFamily: 'var(--font-sans)',
          }}>
            {statusText}
          </span>
        </div>

      {/* Preset-knappar */}
      <div className="timer-material-presets" role="group" aria-label="Förinställda tider">
        {PRESETS.map(min => (
          <button key={min} type="button"
            onClick={() => applyPreset(min)}
            aria-pressed={currentPresetMinutes === min}
            style={presetBtn(currentPresetMinutes === min)}>
            {min} min
          </button>
        ))}
      </div>

      {/* Kontrollknappar */}
      <div className="timer-material-actions">
        {!timer.isRunning ? (
          <button type="button" onClick={() => actions.startTimer()}
            disabled={timer.remainingMs === 0}
            style={{ ...primaryBtn, opacity: timer.remainingMs === 0 ? 0.4 : 1 }}>
            Starta
          </button>
        ) : (
          <button type="button" onClick={() => actions.pauseTimer()} style={primaryBtn}>
            Pausa
          </button>
        )}
        <button type="button" onClick={() => actions.resetTimer()} style={secondaryBtn}>
          Nollställ
        </button>
      </div>

      {timeError && <div role="alert">{timeError}</div>}
      {/* Egen tid */}
      <div className="timer-material-custom" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: 'var(--surface-secondary)',
        borderRadius: 'var(--radius-md)',
        width: '100%',
      }}>
        <label htmlFor="timer-custom-minutes" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
          Egna minuter
        </label>
        <input id="timer-custom-minutes" type="number" min={1} max={180} value={customMinutes}
          onChange={(e) => setCustomMinutes(Number(e.target.value))}
          style={{
            flex: 1, minWidth: 0,
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-primary)',
            padding: '5px 8px',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button type="button" onClick={() => applyPreset(customMinutes)} style={secondaryBtn}>
          Sätt
        </button>
      </div>
    </div>
  )
}
