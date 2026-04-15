import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import './WheelModule.css'

const STORAGE_KEY = 'nameWheelData'
const TWO_PI = Math.PI * 2

interface WheelClass {
  names: string[]
  savedAt: string
}

interface StoredWheelState {
  names?: string[]
  drawnNames?: string[]
  drawingHistory?: string[]
  rotation?: number
  classes?: Record<string, WheelClass>
  excludeDrawn?: boolean
}

interface WheelModuleProps {
  students: string[]
}

function loadWheelState(): StoredWheelState {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredWheelState) : {}
  } catch (error) {
    console.warn('Kunde inte läsa Tur i tur-data', error)
    return {}
  }
}

export function WheelModule({ students }: WheelModuleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const [initialWheelState] = useState<StoredWheelState>(() => loadWheelState())
  const rotationRef = useRef(initialWheelState.rotation ?? 0)

  const [names, setNames] = useState<string[]>(initialWheelState.names ?? [])
  const [drawnNames, setDrawnNames] = useState<string[]>(initialWheelState.drawnNames ?? [])
  const [history, setHistory] = useState<string[]>(initialWheelState.drawingHistory ?? [])
  const [classes, setClasses] = useState<Record<string, WheelClass>>(initialWheelState.classes ?? {})
  const [selectedClass, setSelectedClass] = useState(
    Object.keys(initialWheelState.classes ?? {})[0] ?? '',
  )
  const [classNameInput, setClassNameInput] = useState('')
  const [excludeDrawn, setExcludeDrawn] = useState(initialWheelState.excludeDrawn ?? true)
  const [nameInput, setNameInput] = useState('')
  const [isSpinning, setIsSpinning] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [canvasSize, setCanvasSize] = useState(640)

  useEffect(() => {
    try {
      const payload: StoredWheelState = {
        names,
        drawnNames,
        drawingHistory: history,
        rotation: rotationRef.current,
        classes,
        excludeDrawn,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('Kunde inte spara Tur i tur-data', error)
    }
  }, [names, drawnNames, history, classes, excludeDrawn])

  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 640) {
        setCanvasSize(300)
      } else if (window.innerWidth < 960) {
        setCanvasSize(420)
      } else if (window.innerWidth < 1280) {
        setCanvasSize(540)
      } else {
        setCanvasSize(640)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const listener = () => {
      const target = document.fullscreenElement
      const root = containerRef.current
      if (!root) {
        return
      }
      if (target !== root && animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
        setIsSpinning(false)
      }
    }
    document.addEventListener('fullscreenchange', listener)
    return () => document.removeEventListener('fullscreenchange', listener)
  }, [])

  const displayNames = useMemo(() => {
    if (!excludeDrawn) {
      return names
    }
    return names.filter((name) => !drawnNames.includes(name))
  }, [names, drawnNames, excludeDrawn])

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize * dpr
    canvas.height = canvasSize * dpr
    canvas.style.width = `${canvasSize}px`
    canvas.style.height = `${canvasSize}px`
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, canvasSize, canvasSize)

    const center = canvasSize / 2
    const radius = canvasSize * 0.4

    if (!names.length) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.font = '600 18px "Space Grotesk", "DM Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Lägg till namn för att börja', center, center)
      return
    }

    if (!displayNames.length) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.font = '600 18px "Space Grotesk", "DM Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Alla namn är dragna', center, center)
      return
    }

    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(rotationRef.current)

    const palette = [
      ['#5B7C99', '#4A6E88'],
      ['#9EC1D9', '#8DB3CE'],
      ['#7FAF8A', '#6F9F7A'],
      ['#C89B5C', '#B88B4C'],
      ['#C66A5A', '#B65A4A'],
      ['#8C79A8', '#7C6998'],
      ['#B8A489', '#A89479'],
    ]

    const slice = TWO_PI / displayNames.length
    const pointerAngle = -Math.PI / 2
    const relative = (pointerAngle - rotationRef.current + TWO_PI) % TWO_PI
    const selectedIndex = Math.floor(relative / slice) % displayNames.length

    displayNames.forEach((name, index) => {
      const start = index * slice
      const end = start + slice
      const [light, dark] = palette[index % palette.length]
      const gradient = ctx.createLinearGradient(
        Math.cos(start) * radius,
        Math.sin(start) * radius,
        Math.cos(end) * radius,
        Math.sin(end) * radius,
      )
      gradient.addColorStop(0, light)
      gradient.addColorStop(1, dark)

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, start, end)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      if (index !== selectedIndex && !isSpinning) {
        ctx.save()
        ctx.globalAlpha = 0.2
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, radius, start, end)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.lineWidth = 1
      ctx.stroke()

      const angle = start + slice / 2
      const textX = Math.cos(angle) * radius * 0.85
      const textY = Math.sin(angle) * radius * 0.85

      ctx.save()
      ctx.translate(textX, textY)
      ctx.rotate(angle + Math.PI / 2)
      ctx.font = `${index === selectedIndex && !isSpinning ? '600' : '500'} 14px "Space Grotesk", "DM Sans", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.fillStyle = '#fff'
      ctx.strokeText(name, 0, 0)
      ctx.fillText(name, 0, 0)
      ctx.restore()
    })

    ctx.restore()

    ctx.fillStyle = '#4A6F8A'
    ctx.shadowColor = 'rgba(74,111,138,0.25)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 6
    ctx.beginPath()
    ctx.moveTo(center - 18, 26)
    ctx.lineTo(center + 18, 26)
    ctx.lineTo(center, 62)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [canvasSize, names.length, displayNames, isSpinning])

  useEffect(() => {
    drawWheel()
  }, [drawWheel])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const handleFullscreen = async () => {
    const root = containerRef.current
    if (!root) return
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.warn('Fullskärm misslyckades', error)
    }
  }

  const parseNames = (input: string) => {
    return input
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean)
  }

  const handleAdd = () => {
    const cleaned = parseNames(nameInput)
    if (!cleaned.length) {
      window.alert('Skriv eller klistra in minst ett namn')
      return
    }
    setNames((prev) => {
      const next = [...prev]
      cleaned.forEach((name) => {
        if (!next.includes(name)) {
          next.push(name)
        }
      })
      return next
    })
    setHistory([])
    setNameInput('')
  }

  const handleRemove = (name: string) => {
    setNames((prev) => prev.filter((item) => item !== name))
    setDrawnNames((prev) => prev.filter((item) => item !== name))
  }

  const handleReset = () => {
    if (!window.confirm('Är du säker på att du vill tömma hjulet?')) {
      return
    }
    setNames([])
    setDrawnNames([])
    setHistory([])
    rotationRef.current = 0
    drawWheel()
  }

  const getSelectedIndex = useCallback(
    (list: string[], rotationValue: number) => {
      if (!list.length) {
        return -1
      }
      const slice = TWO_PI / list.length
      let normalized = rotationValue % TWO_PI
      if (normalized < 0) {
        normalized += TWO_PI
      }
      const pointer = -Math.PI / 2
      const relative = (pointer - normalized + TWO_PI) % TWO_PI
      return Math.floor(relative / slice) % list.length
    },
    [],
  )

  const finishSpin = useCallback(
    (list: string[]) => {
      if (!list.length) {
        setIsSpinning(false)
        return
      }
      const slice = TWO_PI / list.length
      const pointer = -Math.PI / 2
      const selectedIndex = getSelectedIndex(list, rotationRef.current)
      const mid = (selectedIndex + 0.5) * slice
      let snapped = pointer - mid + 1e-6
      snapped = ((snapped % TWO_PI) + TWO_PI) % TWO_PI
      rotationRef.current = snapped
      setIsSpinning(false)
      drawWheel()
      const selectedName = list[selectedIndex]
      setHistory((prev) => [selectedName, ...prev].slice(0, 25))
      setDrawnNames((prev) => [selectedName, ...prev.filter((item) => item !== selectedName)])
    },
    [drawWheel, getSelectedIndex],
  )

  const handleSpin = () => {
    if (isSpinning || !names.length) {
      return
    }
    if (!displayNames.length) {
      window.alert('Inga namn kvar att välja – återställ eller avmarkera "Exkludera dragna namn".')
      return
    }
    setIsSpinning(true)
    const listSnapshot = [...displayNames]
    const startRotation = rotationRef.current
    const spins = 5 + Math.random() * 5
    const randomAngle = Math.random() * TWO_PI
    const totalRotation = spins * TWO_PI + randomAngle
    const duration = 1200
    const startTime = performance.now()

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = startRotation + totalRotation * eased
      rotationRef.current = value
      drawWheel()
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        finishSpin(listSnapshot)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const handleSaveClass = () => {
    const trimmedName = classNameInput.trim()
    if (!trimmedName) {
      window.alert('Skriv ett namn på klasslistan')
      return
    }
    if (!names.length) {
      window.alert('Du måste ha minst ett namn på hjulet')
      return
    }
    const payload: WheelClass = {
      names: [...names],
      savedAt: new Date().toLocaleString('sv-SE'),
    }
    setClasses((prev) => ({ ...prev, [trimmedName]: payload }))
    setClassNameInput('')
    setSelectedClass(trimmedName)
  }

  const handleLoadClass = () => {
    if (!selectedClass) {
      window.alert('Välj en klasslista att ladda')
      return
    }
    const target = classes[selectedClass]
    if (!target) {
      return
    }
    setNames([...target.names])
    setDrawnNames([])
    setHistory([])
    rotationRef.current = 0
    drawWheel()
  }

  const handleCopyClass = async () => {
    if (!selectedClass) {
      window.alert('Välj en klasslista att kopiera')
      return
    }
    const target = classes[selectedClass]
    if (!target) {
      return
    }
    try {
      await navigator.clipboard.writeText(target.names.join('\n'))
      window.alert(`Kopierade ${target.names.length} namn till urklipp`)
    } catch (error) {
      console.warn('Urklipp misslyckades', error)
      window.alert('Kunde inte kopiera till urklipp')
    }
  }

  const handleDuplicateClass = () => {
    if (!selectedClass) {
      window.alert('Välj en klasslista att duplicera')
      return
    }
    const target = classes[selectedClass]
    if (!target) {
      return
    }
    let name = `${selectedClass} (kopia)`
    let counter = 1
    while (classes[name]) {
      name = `${selectedClass} (kopia ${counter})`
      counter += 1
    }
    setClasses((prev) => ({ ...prev, [name]: { ...target, savedAt: new Date().toLocaleString('sv-SE') } }))
    setSelectedClass(name)
  }

  const handleDeleteClass = () => {
    if (!selectedClass) {
      window.alert('Välj en klasslista att radera')
      return
    }
    if (!window.confirm(`Radera ${selectedClass}?`)) {
      return
    }
    setClasses((prev) => {
      const copy = { ...prev }
      delete copy[selectedClass]
      return copy
    })
    setSelectedClass('')
  }

  const handleImportStudents = () => {
    if (!students.length) {
      window.alert('Det finns ingen aktiv klasslista att importera')
      return
    }
    const cleaned = students.map((student) => student.trim()).filter(Boolean)
    setNames(cleaned)
    setDrawnNames([])
    setHistory([])
    rotationRef.current = 0
    drawWheel()
  }

  const classOptions = useMemo(() => Object.keys(classes).sort(), [classes])

  return (
    <div className="wheel-module" ref={containerRef}>
      <header className="module-header">
        <div>
          <p className="eyebrow">Tur i tur</p>
          <h2>Namn-hjul för hela klassen</h2>
        </div>
        <div className="wheel-actions">
          <button type="button" onClick={handleImportStudents}>
            Importera från Prisma-listan
          </button>
          <button type="button" onClick={handleFullscreen}>
            Fullskärm
          </button>
        </div>
      </header>

      <div className="wheel-layout">
        <section className="wheel-section">
          <div className="wheel-canvas">
            <canvas ref={canvasRef} width={canvasSize} height={canvasSize} aria-label="Namn-hjul" />
            <button type="button" className="spin-button" onClick={handleSpin} disabled={isSpinning || !displayNames.length}>
              Snurra!
            </button>
          </div>
          <div className="wheel-footer">
            <button type="button" className="reset-button" onClick={handleReset}>
              ↺ Börja om (töm hjulet)
            </button>
          </div>
        </section>

        <section className="wheel-controls">
          <div className="control-card">
            <h3>Lägg till namn</h3>
            <textarea
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Ett namn per rad eller kommaseparerat"
            />
            <button type="button" onClick={handleAdd}>
              Lägg till
            </button>
          </div>

          <div className="control-card">
            <div className="section-header">
              <h3>Klasslistor</h3>
              <button type="button" className="info-toggle" onClick={() => setShowInfo((prev) => !prev)}>
                Hjälp
              </button>
            </div>
            {showInfo && (
              <div className="info-box">
                <p><strong>📋 Kopiera</strong> skickar alla namn till urklipp.</p>
                <p><strong>📌 Duplicera</strong> skapar en kopia utan att röra originalet.</p>
              </div>
            )}
            <div className="class-input">
              <input
                type="text"
                value={classNameInput}
                placeholder="Namn på klasslistan"
                onChange={(event) => setClassNameInput(event.target.value)}
              />
              <button type="button" onClick={handleSaveClass}>
                Spara
              </button>
            </div>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="">Välj klasslista...</option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="class-buttons">
              <button type="button" onClick={handleLoadClass}>
                Ladda
              </button>
              <button type="button" onClick={handleCopyClass}>
                Kopiera
              </button>
              <button type="button" onClick={handleDuplicateClass}>
                Duplicera
              </button>
            </div>
            <button type="button" className="danger" onClick={handleDeleteClass}>
              Radera
            </button>
          </div>

          <div className="control-card">
            <h4>Inställningar</h4>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={excludeDrawn}
                onChange={(event) => setExcludeDrawn(event.target.checked)}
              />
              Exkludera dragna namn
            </label>
            <small>Avmarkera om samma elev ska kunna få flera chanser.</small>
          </div>

          <div className="control-card">
            <div className="names-header">
              <h3>Namn på hjulet</h3>
              <span className="count">{names.length}</span>
            </div>
            <ul className="names-list">
              {names.map((name) => (
                <li key={name} className={clsx({ drawn: drawnNames.includes(name) })}>
                  <span>{name}</span>
                  <button type="button" onClick={() => handleRemove(name)}>
                    Ta bort
                  </button>
                </li>
              ))}
              {!names.length && <li className="empty">Inga namn ännu.</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
