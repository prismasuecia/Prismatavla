import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore, getActiveStudents } from '../../store/useBoardStore'

interface SavedClass {
  names: string[]
  savedAt: number
}

interface DrawOptions {
  names: string[]
  rotation: number
  size: number
  isSpinning: boolean
  selectedIndex: number
}

interface PersistedWheelState {
  names: string[]
  drawnNames: string[]
  history: string[]
  rotation: number
  excludeDrawn: boolean
}

const STORAGE_KEYS = {
  state: 'turitur:state',
  classes: 'turitur:classes',
}

const COLOR_PALETTE = [
  { light: '#5B7C99', dark: '#4A6E88' },
  { light: '#9EC1D9', dark: '#8DB3CE' },
  { light: '#7FAF8A', dark: '#6F9F7A' },
  { light: '#C89B5C', dark: '#B88B4C' },
  { light: '#C66A5A', dark: '#B65A4A' },
  { light: '#8C79A8', dark: '#7C6998' },
  { light: '#B8A489', dark: '#A89479' },
]

const MAX_HISTORY = 16
const TAU = Math.PI * 2
const DEFAULT_WHEEL_STATE: PersistedWheelState = {
  names: [],
  drawnNames: [],
  history: [],
  rotation: 0,
  excludeDrawn: true,
}

export function TurnWindow() {
  const classLists = useBoardStore((state) => state.classLists)
  const activeStudents = useMemo(() => getActiveStudents({ classLists }), [classLists])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const [canvasSize, setCanvasSize] = useState(360)
  const persistedState = useMemo(() => loadWheelState(), [])
  const persistedClasses = useMemo(() => loadSavedClasses(), [])
  const initialClassSelection = useMemo(() => {
    const keys = Object.keys(persistedClasses).sort((a, b) => a.localeCompare(b))
    return keys[0] ?? ''
  }, [persistedClasses])
  const [namesInput, setNamesInput] = useState('')
  const [names, setNames] = useState<string[]>(persistedState.names)
  const [drawnNames, setDrawnNames] = useState<string[]>(persistedState.drawnNames)
  const [history, setHistory] = useState<string[]>(persistedState.history)
  const [excludeDrawn, setExcludeDrawn] = useState(persistedState.excludeDrawn)
  const [classes, setClasses] = useState<Record<string, SavedClass>>(persistedClasses)
  const [selectedClass, setSelectedClass] = useState(initialClassSelection)
  const [className, setClassName] = useState('')
  const [rotation, setRotation] = useState(persistedState.rotation)
  const [isSpinning, setIsSpinning] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const updateNames = (updater: string[] | ((prev: string[]) => string[])) => {
    setNames((prev) => {
      const next = typeof updater === 'function' ? (updater as (prevNames: string[]) => string[])(prev) : updater
      setDrawnNames((prevDrawn) => prevDrawn.filter((name) => next.includes(name)))
      setHistory((prevHistory) => prevHistory.filter((name) => next.includes(name)))
      return next
    })
  }

  const availableNames = useMemo(() => {
    if (!excludeDrawn) {
      return names
    }
    const remaining = names.filter((name) => !drawnNames.includes(name))
    return remaining
  }, [names, drawnNames, excludeDrawn])

  const selectedIndex = useMemo(() => getSelectedIndex(availableNames, rotation), [availableNames, rotation])
  const lastDrawn = history[0] ?? null
  const classOptions = useMemo(() => Object.keys(classes).sort((a, b) => a.localeCompare(b)), [classes])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      const payload = {
        names,
        drawnNames,
        history,
        rotation,
        excludeDrawn,
      }
      window.localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(payload))
    } catch (error) {
      console.warn('Kunde inte spara Tur i tur-data', error)
    }
  }, [names, drawnNames, history, rotation, excludeDrawn])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.classes, JSON.stringify(classes))
    } catch (error) {
      console.warn('Kunde inte spara klasslistor', error)
    }
  }, [classes])

  useEffect(() => {
    const node = stageRef.current
    if (!node) {
      return
    }
    const updateSize = (width: number) => {
      const size = Math.max(260, Math.min(width - 24, 520))
      setCanvasSize(size)
    }
    updateSize(node.clientWidth)

    const supportsResizeObserver = typeof window !== 'undefined' && 'ResizeObserver' in window
    if (supportsResizeObserver) {
      const observer = new ResizeObserver((entries) => {
        if (!entries.length) {
          return
        }
        updateSize(entries[0].contentRect.width)
      })
      observer.observe(node)
      return () => observer.disconnect()
    }

    if (typeof window !== 'undefined') {
      const handler = () => updateSize(node.clientWidth)
      window.addEventListener('resize', handler)
      return () => window.removeEventListener('resize', handler)
    }
  }, [])

  useEffect(() => {
    drawWheel(canvasRef.current, {
      names: availableNames,
      rotation,
      size: canvasSize,
      isSpinning,
      selectedIndex,
    })
  }, [availableNames, rotation, canvasSize, isSpinning, selectedIndex])

  useEffect(() => () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleAddNames = () => {
    const parsed = parseNames(namesInput)
    if (!parsed.length) {
      setStatusMessage('Lägg till minst ett namn.')
      return
    }
    let added = 0
    let duplicates = 0
    updateNames((prev) => {
      const next = [...prev]
      parsed.forEach((name) => {
        if (next.includes(name)) {
          duplicates += 1
          return
        }
        next.push(name)
        added += 1
      })
      return next
    })
    setNamesInput('')
    if (added) {
      setStatusMessage(
        duplicates ? `${added} namn tillagda. ${duplicates} fanns redan.` : `${added} namn tillagda.`,
      )
    } else {
      setStatusMessage('Alla namn fanns redan i listan.')
    }
  }

  const handleSpin = () => {
    if (isSpinning) {
      return
    }
    if (!names.length) {
      setStatusMessage('Lägg till namn för att snurra hjulet.')
      return
    }
    if (!availableNames.length) {
      setStatusMessage('Alla namn är dragna. Återställ dragna för att fortsätta.')
      return
    }
    setStatusMessage('')
    setIsSpinning(true)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    const spinPool = [...availableNames]
    const spins = 5 + Math.random() * 4
    const randomAngle = Math.random() * TAU
    const startRotation = rotation
    const targetRotation = startRotation + spins * TAU + randomAngle
    const duration = 1800
    let startTime: number | null = null

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp
      }
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextRotation = startRotation + (targetRotation - startRotation) * eased
      setRotation(nextRotation)
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step)
        return
      }
      const normalized = normalizeAngle(nextRotation)
      const sliceAngle = TAU / spinPool.length
      const pointerAngle = -Math.PI / 2
      const relativeAngle = (pointerAngle - normalized + TAU) % TAU
      const index = Math.floor(relativeAngle / sliceAngle) % spinPool.length
      const midpoint = (index + 0.5) * sliceAngle
      const snappedRotation = normalizeAngle(pointerAngle - midpoint + 1e-4)
      setRotation(snappedRotation)
      const winner = spinPool[index]
      if (winner) {
        setHistory((prev) => [winner, ...prev].slice(0, MAX_HISTORY))
        setDrawnNames((prev) => (prev.includes(winner) ? prev : [winner, ...prev]))
        setStatusMessage(`Drog ${winner}.`)
      }
      setIsSpinning(false)
    }

    animationRef.current = requestAnimationFrame(step)
  }

  const handleRemoveName = (name: string) => {
    updateNames((prev) => prev.filter((item) => item !== name))
    setStatusMessage(`Tog bort ${name}.`)
  }

  const handleResetWheel = () => {
    if (!names.length) {
      return
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm('Är du säker på att du vill tömma hjulet?')
      if (!confirmed) {
        return
      }
    }
    updateNames([])
    setDrawnNames([])
    setHistory([])
    setRotation(0)
    setStatusMessage('Hjulet är tömt.')
  }

  const handleClearDrawn = () => {
    if (!drawnNames.length) {
      return
    }
    setDrawnNames([])
    setHistory([])
    setStatusMessage('Alla namn är tillbaka i hjulet.')
  }

  const handleUseActiveClass = () => {
    if (!activeStudents.length) {
      setStatusMessage('Ingen aktiv klasslista att hämta.')
      return
    }
    const next = Array.from(new Set(activeStudents.map((name) => name.trim()).filter(Boolean)))
    if (!next.length) {
      setStatusMessage('Klasslistan saknar namn att hämta.')
      return
    }
    updateNames(next)
    setDrawnNames([])
    setHistory([])
    setRotation(0)
    setStatusMessage('Aktiv klasslista inläst.')
  }

  const handleSaveClass = () => {
    const key = className.trim()
    if (!key) {
      setStatusMessage('Ge klasslistan ett namn innan du sparar.')
      return
    }
    if (!names.length) {
      setStatusMessage('Lägg till namn innan du sparar listan.')
      return
    }
    setClasses((prev) => ({
      ...prev,
      [key]: { names: [...names], savedAt: Date.now() },
    }))
    setSelectedClass(key)
    setClassName('')
    setStatusMessage(`Sparade ${key}.`)
  }

  const handleLoadClass = () => {
    if (!selectedClass) {
      setStatusMessage('Välj en klasslista att ladda.')
      return
    }
    const payload = classes[selectedClass]
    if (!payload) {
      setStatusMessage('Klasslistan hittades inte.')
      return
    }
    updateNames(payload.names)
    setDrawnNames([])
    setHistory([])
    setRotation(0)
    setStatusMessage(`Laddade ${selectedClass}.`)
  }

  const handleCopyClass = async () => {
    if (!selectedClass) {
      setStatusMessage('Välj en klasslista att kopiera.')
      return
    }
    const payload = classes[selectedClass]
    if (!payload) {
      setStatusMessage('Klasslistan hittades inte.')
      return
    }
    const text = payload.names.join('\n')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setStatusMessage(`Kopierade ${payload.names.length} namn från ${selectedClass}.`)
    } catch (error) {
      console.warn('Clipboard error', error)
      setStatusMessage('Kunde inte kopiera namnlistan.')
    }
  }

  const handleDuplicateClass = () => {
    if (!selectedClass) {
      setStatusMessage('Välj en klasslista att duplicera.')
      return
    }
    const payload = classes[selectedClass]
    if (!payload) {
      setStatusMessage('Klasslistan hittades inte.')
      return
    }
    let nextName = `${selectedClass} (kopia)`
    let counter = 1
    while (classes[nextName]) {
      counter += 1
      nextName = `${selectedClass} (kopia ${counter})`
    }
    setClasses((prev) => ({
      ...prev,
      [nextName]: { names: [...payload.names], savedAt: Date.now() },
    }))
    setSelectedClass(nextName)
    setStatusMessage(`Duplicerade ${selectedClass}.`)
  }

  const handleDeleteClass = () => {
    if (!selectedClass) {
      setStatusMessage('Välj en klasslista att radera.')
      return
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(`Radera ${selectedClass}? Detta går inte att ångra.`)
      if (!confirmed) {
        return
      }
    }
    setClasses((prev) => {
      const next = { ...prev }
      delete next[selectedClass]
      return next
    })
    setSelectedClass('')
    setStatusMessage('Klasslistan togs bort.')
  }



  // Beräkna storlek för PERFEKT cirkel
  const wheelDiameter = Math.min(canvasSize, 220)

  return (
    <div style={{ display:'flex', height:'100%', fontFamily:'var(--font-sans)', overflow:'hidden' }}>

      {/* === VÄNSTER: Hjulet === */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Header-rad */}
        <div style={{ padding:'12px 16px 8px', display:'flex', alignItems:'baseline', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <span style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>{names.length}</span>
            <span style={{ fontSize:13, color:'var(--text-tertiary)', marginLeft:4 }}>namn</span>
            {drawnNames.length > 0 && (
              <span style={{ fontSize:12, color:'var(--text-tertiary)', marginLeft:8 }}>· {drawnNames.length} dragna</span>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {drawnNames.length > 0 && (
              <button type="button" onClick={handleResetWheel}
                style={{ padding:'4px 12px', borderRadius:20, border:'1px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                Återställ
              </button>
            )}
            <button type="button" onClick={handleClearDrawn}
              style={{ padding:'4px 12px', borderRadius:20, border:'1px solid rgba(180,60,50,0.25)', background:'transparent', fontSize:12, color:'#B43C32', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              Töm
            </button>
          </div>
        </div>

        {/* Hjul-area — ALLTID kvadratisk */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 16px 12px', overflow:'hidden' }}>
          {names.length === 0 ? (
            <div style={{ textAlign:'center', padding:32 }}>
              <div style={{ fontSize:56, opacity:0.08 }}>◎</div>
              <div style={{ fontSize:15, fontWeight:500, color:'var(--text-secondary)', marginTop:12 }}>Lägg till namn</div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>och tryck Snurra</div>
            </div>
          ) : (
            <>
              {/* Canvas med exakt kvadratisk container — detta fixar oval-problemet */}
              <div style={{ width:wheelDiameter, height:wheelDiameter, flexShrink:0, position:'relative', cursor:isSpinning?'default':'pointer' }}
                onClick={isSpinning ? undefined : handleSpin}>
                <canvas ref={canvasRef} width={canvasSize} height={canvasSize}
                  style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', borderRadius:'50%' }} />
              </div>

              {/* Vald */}
              <div style={{ marginTop:14, textAlign:'center', minHeight:52 }}>
                {lastDrawn ? (
                  <>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Vald</div>
                    <div style={{ fontSize:26, fontWeight:700, color:'var(--accent)', letterSpacing:'-0.02em', marginTop:2 }}>{lastDrawn}</div>
                  </>
                ) : (
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>Tryck på hjulet eller knappen</div>
                )}
              </div>

              {/* Snurra-knapp */}
              <button type="button" onClick={handleSpin} disabled={isSpinning}
                style={{ marginTop:10, padding:'10px 36px', borderRadius:24, border:'none', background:isSpinning?'var(--surface-secondary)':'var(--accent)', color:isSpinning?'var(--text-tertiary)':'#fff', fontSize:15, fontWeight:600, cursor:isSpinning?'default':'pointer', fontFamily:'var(--font-sans)', transition:'all 150ms', letterSpacing:'-0.01em' }}>
                {isSpinning ? 'Snurrar…' : 'Snurra'}
              </button>
            </>
          )}
        </div>

        {/* Toggle + status */}
        <div style={{ padding:'8px 16px 12px', borderTop:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
            onClick={() => setExcludeDrawn(v => !v)}>
            <div style={{ width:36, height:20, borderRadius:10, background:excludeDrawn?'var(--accent)':'var(--border-medium)', position:'relative', transition:'background 220ms', flexShrink:0 }}>
              <div style={{ position:'absolute', width:16, height:16, borderRadius:'50%', background:'#fff', top:2, left:excludeDrawn?18:2, transition:'left 220ms ease', boxShadow:'0 1px 4px rgba(0,0,0,0.18)' }} />
            </div>
            <span style={{ fontSize:12, color:'var(--text-secondary)', userSelect:'none' }}>Exkludera dragna</span>
          </div>
          {statusMessage && <span style={{ fontSize:11, color:'var(--accent)', fontWeight:500 }}>{statusMessage}</span>}
        </div>
      </div>

      {/* === HÖGER: Panel === */}
      <div style={{ width:200, borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>

        {/* Lägg till */}
        <div style={{ padding:'14px 14px 12px', borderBottom:'1px solid var(--border-subtle)' }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:8 }}>Lägg till namn</div>
          <textarea value={namesInput} onChange={e => setNamesInput(e.target.value)}
            placeholder="Klistra in namn, ett per rad…"
            rows={5}
            style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', resize:'none', outline:'none', boxSizing:'border-box', lineHeight:1.7, display:'block' }} />
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button type="button" onClick={handleAddNames}
              style={{ flex:2, padding:'7px 0', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              Lägg till
            </button>
            <button type="button" onClick={handleUseActiveClass}
              style={{ flex:1, padding:'7px 0', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              Klass
            </button>
          </div>
        </div>

        {/* Sparade listor */}
        <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-subtle)' }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:8 }}>Sparade listor</div>
          <input type="text" value={className} onChange={e => setClassName(e.target.value)}
            placeholder="Namnge listan"
            style={{ width:'100%', padding:'7px 10px', borderRadius:10, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', boxSizing:'border-box', display:'block', marginBottom:7 }} />
          <button type="button" onClick={handleSaveClass}
            style={{ width:'100%', padding:'7px 0', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', marginBottom:8, display:'block', boxSizing:'border-box' }}>
            Spara
          </button>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            style={{ width:'100%', padding:'7px 10px', borderRadius:10, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:selectedClass?'var(--text-primary)':'var(--text-tertiary)', fontFamily:'var(--font-sans)', outline:'none', boxSizing:'border-box', appearance:'none', cursor:'pointer', marginBottom:7, display:'block' }}>
            <option value="">Välj sparad lista…</option>
            {classOptions.map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <div style={{ display:'flex', gap:5 }}>
            <button type="button" onClick={handleLoadClass}
              style={{ flex:1, padding:'6px 0', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', color:'var(--text-secondary)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              Ladda
            </button>
            <button type="button" onClick={handleDeleteClass}
              style={{ flex:1, padding:'6px 0', borderRadius:20, border:'1.5px solid var(--border-subtle)', background:'transparent', color:'var(--text-tertiary)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              Ta bort
            </button>
          </div>
        </div>

        {/* Namn på hjulet */}
        {names.length > 0 && (
          <div style={{ flex:1, overflow:'auto', padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:8 }}>På hjulet</div>
            {names.map((name, i) => {
              const drawn = drawnNames.includes(name);
              return (
                <div key={i} style={{ fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--border-subtle)', color:drawn?'var(--text-tertiary)':'var(--text-primary)', textDecoration:drawn?'line-through':'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>{name}</span>
                  {drawn && <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}


function parseNames(input: string) {
  return input
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

function getSelectedIndex(names: string[], rotation: number) {
  if (!names.length) {
    return -1
  }
  const sliceAngle = TAU / names.length
  const pointerAngle = -Math.PI / 2
  const normalizedRotation = normalizeAngle(rotation)
  const relativeAngle = (pointerAngle - normalizedRotation + TAU) % TAU
  return Math.floor(relativeAngle / sliceAngle) % names.length
}

function normalizeAngle(value: number) {
  let angle = value % TAU
  if (angle < 0) {
    angle += TAU
  }
  return angle
}

function drawWheel(canvas: HTMLCanvasElement | null, options: DrawOptions) {
  if (!canvas) {
    return
  }
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const { names, rotation, size, isSpinning, selectedIndex } = options
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)

  const center = size / 2
  const radius = size * 0.45

  if (!names.length) {
    context.fillStyle = 'rgba(0, 0, 0, 0.45)'
    context.font = `600 ${Math.max(14, size * 0.045)}px "Inter", "Segoe UI", sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('Lägg till namn för att börja', center, center)
    drawPointer(context, center, size)
    return
  }

  context.save()
  context.translate(center, center)
  context.rotate(rotation)
  const sliceAngle = TAU / names.length

  names.forEach((name, index) => {
    const startAngle = index * sliceAngle
    const endAngle = startAngle + sliceAngle
    const color = COLOR_PALETTE[index % COLOR_PALETTE.length]
    const gradient = context.createLinearGradient(
      Math.cos(startAngle) * radius,
      Math.sin(startAngle) * radius,
      Math.cos(endAngle) * radius,
      Math.sin(endAngle) * radius,
    )
    gradient.addColorStop(0, color.light)
    gradient.addColorStop(1, color.dark)
    context.beginPath()
    context.moveTo(0, 0)
    context.arc(0, 0, radius, startAngle, endAngle)
    context.closePath()
    context.fillStyle = gradient
    context.fill()
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    context.lineWidth = Math.max(2, size * 0.005)
    context.stroke()

    if (!isSpinning && index !== selectedIndex) {
      context.save()
      context.globalAlpha = 0.2
      context.fillStyle = '#000'
      context.beginPath()
      context.moveTo(0, 0)
      context.arc(0, 0, radius, startAngle, endAngle)
      context.closePath()
      context.fill()
      context.restore()
    }

    const textAngle = startAngle + sliceAngle / 2
    const textRadius = radius * 0.85
    const x = Math.cos(textAngle) * textRadius
    const y = Math.sin(textAngle) * textRadius
    const fontSize = Math.max(12, Math.min(16, size * 0.03))
    context.save()
    context.translate(x, y)
    context.rotate(textAngle + Math.PI / 2)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const parts = name.split(' ')
    const first = parts[0] ?? ''
    const rest = parts.slice(1).join(' ')
    const hasRest = Boolean(rest)
    const weight = !isSpinning && index === selectedIndex ? 600 : 500
    context.font = `${weight} ${fontSize}px "Inter", "Segoe UI", sans-serif`
    const lineHeight = fontSize + 2
    const offsets = hasRest ? [-lineHeight / 2, lineHeight / 2] : [0]

    if (!isSpinning && index === selectedIndex) {
      const metrics = context.measureText(hasRest ? rest : first)
      const width = Math.max(metrics.width, context.measureText(first).width)
      const paddingX = 10
      const paddingY = hasRest ? 10 : 6
      const height = (hasRest ? lineHeight * 2 : lineHeight) + paddingY
      const rectWidth = width + paddingX
      const rectHeight = height
      const radius = 8
      context.save()
      context.beginPath()
      context.moveTo(-rectWidth / 2 + radius, -rectHeight / 2)
      context.lineTo(rectWidth / 2 - radius, -rectHeight / 2)
      context.quadraticCurveTo(rectWidth / 2, -rectHeight / 2, rectWidth / 2, -rectHeight / 2 + radius)
      context.lineTo(rectWidth / 2, rectHeight / 2 - radius)
      context.quadraticCurveTo(rectWidth / 2, rectHeight / 2, rectWidth / 2 - radius, rectHeight / 2)
      context.lineTo(-rectWidth / 2 + radius, rectHeight / 2)
      context.quadraticCurveTo(-rectWidth / 2, rectHeight / 2, -rectWidth / 2, rectHeight / 2 - radius)
      context.lineTo(-rectWidth / 2, -rectHeight / 2 + radius)
      context.quadraticCurveTo(-rectWidth / 2, -rectHeight / 2, -rectWidth / 2 + radius, -rectHeight / 2)
      context.closePath()
      context.fillStyle = 'rgba(0, 0, 0, 0.6)'
      context.fill()
      context.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      context.lineWidth = 1
      context.stroke()
      context.restore()
    }

    context.fillStyle = '#fff'
    context.lineWidth = 2
    context.strokeStyle = 'rgba(0, 0, 0, 0.8)'
    offsets.forEach((offset, lineIndex) => {
      const text = lineIndex === 0 ? first : rest
      if (!text) {
        return
      }
      context.strokeText(text, 0, offset)
      context.fillText(text, 0, offset)
    })
    context.restore()
  })

  context.restore()
  drawPointer(context, center, size)
}

function drawPointer(context: CanvasRenderingContext2D, center: number, size: number) {
  const pointerWidth = size * 0.12
  const pointerHeight = size * 0.12
  context.save()
  context.fillStyle = '#4A6F8A'
  context.shadowColor = 'rgba(74, 111, 138, 0.25)'
  context.shadowBlur = 20
  context.shadowOffsetY = 6
  context.beginPath()
  context.moveTo(center - pointerWidth / 2, 12)
  context.lineTo(center + pointerWidth / 2, 12)
  context.lineTo(center, 12 + pointerHeight)
  context.closePath()
  context.fill()
  context.shadowBlur = 0
  context.strokeStyle = '#fff'
  context.lineWidth = 2.5
  context.stroke()
  context.restore()
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function loadWheelState(): PersistedWheelState {
  if (typeof window === 'undefined') {
    return DEFAULT_WHEEL_STATE
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.state)
    if (!stored) {
      return DEFAULT_WHEEL_STATE
    }
    const parsed = JSON.parse(stored)
    return {
      names: Array.isArray(parsed?.names) ? parsed.names : [],
      drawnNames: Array.isArray(parsed?.drawnNames) ? parsed.drawnNames : [],
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      rotation: typeof parsed?.rotation === 'number' ? parsed.rotation : 0,
      excludeDrawn: typeof parsed?.excludeDrawn === 'boolean' ? parsed.excludeDrawn : true,
    }
  } catch (error) {
    console.warn('Kunde inte läsa sparad hjuldata', error)
    return DEFAULT_WHEEL_STATE
  }
}

function loadSavedClasses(): Record<string, SavedClass> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.classes)
    if (!stored) {
      return {}
    }
    const parsed = JSON.parse(stored)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch (error) {
    console.warn('Kunde inte läsa sparade klasslistor', error)
    return {}
  }
}
