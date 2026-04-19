import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore } from '../../store/useBoardStore'

export function SoundMeterWindow() {
  const soundMeter = useBoardStore((state) => state.soundMeter)
  const trafficNorm = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)
  const [liveLevel, setLiveLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)

  const cleanup = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    analyserRef.current?.disconnect()
    analyserRef.current = null
    sourceRef.current?.disconnect()
    sourceRef.current = null
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const level = soundMeter?.level ?? 0
  const peakLevel = soundMeter?.peakLevel ?? 0
  const status = soundMeter?.status ?? 'idle'
  const statusMessage = soundMeter?.message ?? null

  useEffect(() => {
    if (!soundMeter?.enabled) {
      cleanup()
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      actions.setSoundMeterStatus('unsupported', 'Din webblÃ¤sare saknar mikrofonstÃ¶d fÃ¶r den hÃ¤r funktionen.')
      cleanup()
      return
    }
    let cancelled = false
    const requestMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        audioContextRef.current = audioContext
        analyserRef.current = analyser
        sourceRef.current = source
        mediaStreamRef.current = stream
        actions.setSoundMeterStatus('listening')
        loop()
      } catch (micError) {
        console.error('Sound meter mic error', micError)
        actions.setSoundMeterStatus('denied', 'Ingen mikrofonÃ¥tkomst â ge tillstÃ¥nd och fÃ¶rsÃ¶k igen.')
      }
    }
    const loop = () => {
      const analyser = analyserRef.current
      if (!analyser) {
        return
      }
      const buffer = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(buffer)
      const normalized = computeRms(buffer)
      const adjusted = Math.min(1, normalized / Math.max(0.05, soundMeter?.sensitivity ?? 0.5))
      setLiveLevel(adjusted)
      actions.updateSoundMeterLevel(adjusted)
      frameRef.current = requestAnimationFrame(loop)
    }
    requestMic()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [soundMeter?.enabled, soundMeter?.sensitivity, actions])

  const statusLabel = useMemo(() => {
    if (statusMessage) {
      return statusMessage
    }
    switch (status) {
      case 'listening':
        return 'Lyssnar...'
      case 'denied':
        return 'Tillstånd nekades'
      case 'unsupported':
        return 'Inte tillgÃ¤nglig'
      default:
        return 'Avstängd'
    }
  }, [status, statusMessage])

  const handleToggle = () => {
    actions.setSoundMeterEnabled(!soundMeter?.enabled)
  }

  const meterLevel = soundMeter?.enabled ? liveLevel : level
  const demand = Math.round(meterLevel * 100)

  const recommendation = useMemo(() => {
    if (meterLevel < 0.35) return 'tyst'
    if (meterLevel < 0.65) return 'viska'
    return 'prata'
  }, [meterLevel])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Nivå-mätare — stor och tydlig */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', gap: 16 }}>

        {/* Cirkulär nivå-display */}
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            <circle cx={50} cy={50} r={40} fill="none" stroke="var(--border-medium)" strokeWidth={6} />
            <circle cx={50} cy={50} r={40} fill="none"
              stroke={liveLevel > 0.7 ? '#B43C32' : liveLevel > 0.4 ? 'var(--timer-fill)' : 'var(--accent)'}
              strokeWidth={6}
              strokeDasharray={251.2}
              strokeDashoffset={251.2 * (1 - Math.min(1, liveLevel))}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 80ms ease, stroke 200ms ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>
              {Math.round(liveLevel * 100)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>%</span>
          </div>
        </div>

        {/* Status */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>
            {statusLabel}
          </div>
          {recommendation && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>
              Rekommendation: <strong style={{ color: 'var(--accent)' }}>{recommendation}</strong>
            </div>
          )}
        </div>

        {/* Start/stopp-knapp */}
        <button type="button" onClick={handleToggle}
          style={{
            padding: '10px 28px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: soundMeter?.enabled ? 'var(--surface-secondary)' : 'var(--accent)',
            color: soundMeter?.enabled ? 'var(--text-secondary)' : '#fff',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'all 150ms ease',
          }}>
          {soundMeter?.enabled ? 'Stoppa mätning' : 'Starta mätning'}
        </button>
      </div>

      {/* Inställningar — kompakt botten */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
          Känslighet
        </span>
        <input type="range" min={0.2} max={1} step={0.05}
          value={soundMeter?.sensitivity ?? 0.65}
          onChange={e => actions.setSoundMeterSensitivity(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)', height: 3 }}
        />
        {soundMeter?.enabled && (
          <button type="button" onClick={() => actions.syncSoundMeterToTraffic()}
            style={{ padding: '5px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
            Uppdatera trafikljuset
          </button>
        )}
      </div>
    </div>
  )
}
