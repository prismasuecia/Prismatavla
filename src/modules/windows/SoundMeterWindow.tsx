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
      actions.setSoundMeterStatus('unsupported', 'Din webbläsare saknar mikrofonstöd för den här funktionen.')
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
        actions.setSoundMeterStatus('denied', 'Ingen mikrofonåtkomst – ge tillstånd och försök igen.')
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
        return 'Inte tillgänglig'
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
    <div className="sound-meter-window">
      <header className="lesson-plan-header">
        <div>
          <p className="eyebrow">Ljudnivå</p>
          <h2>Ljudkoll i rummet</h2>
          <p className="sound-meter-status">{statusLabel}</p>
        </div>
        <div className="seating-config">
          <label>
            Känslighet
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={soundMeter?.sensitivity ?? 0.65}
              onChange={(event) => actions.setSoundMeterSensitivity(Number(event.target.value))}
            />
          </label>
          <button type="button" className="toolbar-btn" onClick={handleToggle}>
            {soundMeter?.enabled ? 'Stoppa mätning' : 'Starta mätning'}
          </button>
        </div>
      </header>

      <div className="sound-meter-gauge" aria-label="Aktuell ljudnivå">
        <div className="sound-meter-track">
          <span style={{ width: `${demand}%` }} />
        </div>
        <div className="sound-meter-values">
          <strong>{demand}%</strong>
          <span>
            Topp: {Math.round(peakLevel * 100)}% · Trafiknorm: {trafficNorm}
          </span>
        </div>
      </div>

      <div className="sound-meter-actions">
        <p>
          Rekommendation: <strong>{recommendation.toUpperCase()}</strong>
        </p>
        <button type="button" className="toolbar-btn outline" onClick={actions.syncSoundMeterToTraffic}>
          Uppdatera trafikljuset
        </button>
      </div>
    </div>
  )
}

function computeRms(buffer: Uint8Array) {
  let sumSquares = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const value = buffer[i] - 128
    sumSquares += value * value
  }
  return Math.sqrt(sumSquares / buffer.length) / 128
}
