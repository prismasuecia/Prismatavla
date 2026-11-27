import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { ArrowLeft, ArrowRight, Check, Plus, FolderOpen, FileDown, Lock, RefreshCcw, Shuffle as ShuffleIcon, Unlock, Users } from 'lucide-react'
import { useBoardStore, type LayoutType, type SeatingPlan } from '../store/useBoardStore'
import { generateLayout, LAYOUT_LABELS } from '../lib/seatingLayouts'
import { distinctStudentNames, parseStudents } from '../utils/students'

const SEAT_COUNT_CHOICES = [12, 16, 20, 24, 28, 32]
type SeatCountChoice = 'match' | 'custom' | `${number}`

type SeatDescriptor = {
  id: string
  label: string
  x: number
  y: number
  student: string | null
  locked: boolean
}

/* eslint-disable react-hooks/set-state-in-effect */

export function SeatingModule() {
  const classLists = useBoardStore((state) => state.classLists)
  const seating = useBoardStore((state) => state.seating)
  const actions = useBoardStore((state) => state.actions)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [lockMode, setLockMode] = useState(false)
  const [planNameDraft, setPlanNameDraft] = useState('')
  const [layoutDraft, setLayoutDraft] = useState<LayoutType>('rutnat')
  const [seatCountChoice, setSeatCountChoice] = useState<SeatCountChoice>('match')
  const [customSeatCount, setCustomSeatCount] = useState(24)
  const [notice, setNotice] = useState('')
  const [dropSeat, setDropSeat] = useState<string | null>(null)
  const drag = useRef<{ student: string; planId: string; classId: string } | null>(null)
  const [undo, setUndo] = useState<{ classId: string; planId: string; before: SeatingPlan; after: string } | null>(null)

  const activeClassId = classLists.activeId ?? classLists.lists[0]?.id ?? null
  const currentClass = classLists.lists.find((entry) => entry.id === activeClassId)
  const planMap = activeClassId ? seating?.seatingPlansByClassId[activeClassId] ?? {} : {}
  const planList = [...Object.values(planMap)].sort((a, b) => a.createdAt - b.createdAt)
  const activePlanId = activeClassId ? seating?.activeSeatingPlanIdByClassId[activeClassId] : null
  const plan = planList.find((item) => item.id === activePlanId) ?? planList[0]
  const [step, setStep] = useState(0)
  const [intent, setIntent] = useState<'new' | 'open'>('new')
  const [newDraft, setNewDraft] = useState(false)
  const [classSource, setClassSource] = useState<'saved' | 'new' | null>(null)
  const [classNameInput, setClassNameInput] = useState('')
  const [studentNamesInput, setStudentNamesInput] = useState('')
  const [classError, setClassError] = useState('')
  const matchNewClass = useRef(false)

  const newClassForm = <form className="seating-class-form" onSubmit={(event) => {
    event.preventDefault()
    const name = classNameInput.trim()
    const names = distinctStudentNames(parseStudents(studentNamesInput))
    if (!name || !names.length) {
      setClassError(!name ? 'Skriv ett namn på klassen.' : 'Skriv minst ett elevnamn, ett per rad.')
      return
    }
    if (classLists.lists.some((item) => item.name.toLocaleLowerCase('sv') === name.toLocaleLowerCase('sv'))) {
      setClassError('Det klassnamnet finns redan. Välj den sparade klassen eller använd ett annat namn.')
      return
    }
    matchNewClass.current = true
    actions.createClassList(name, names)
    setClassError('')
    setClassNameInput('')
    setStudentNamesInput('')
    setClassSource(null)
    setIntent('new')
    setNewDraft(true)
    setSeatCountChoice('match')
    setPlanNameDraft('')
    setStep(2)
  }}>
    <h2>Skriv in elever</h2>
    <label htmlFor="seating-class-name">Klassens namn</label>
    <input id="seating-class-name" value={classNameInput} onChange={(event) => setClassNameInput(event.target.value)} placeholder="Till exempel 4A" />
    <label htmlFor="seating-student-names">Elevnamn, ett per rad</label>
    <textarea id="seating-student-names" rows={7} value={studentNamesInput} onChange={(event) => setStudentNamesInput(event.target.value)} placeholder={'Anna\nBilal\nCarla'} />
    <span>{parseStudents(studentNamesInput).length} elever</span>
    <p className="seating-class-note">Klassen sparas och kan användas i tavlans andra verktyg. Lika namn får ett eget nummer.</p>
    {classError && <p role="alert">{classError}</p>}
    <button type="submit" className="primary">Spara klass och välj möblering <ArrowRight size={16} /></button>
  </form>

  useEffect(() => {
    if (!plan) {
      setPlanNameDraft('')
      setSelectedSeatId(null)
      return
    }
    setPlanNameDraft(plan.name)
    setLayoutDraft(plan.layoutType)
    if (matchNewClass.current) {
      setSeatCountChoice('match')
      matchNewClass.current = false
    } else if (SEAT_COUNT_CHOICES.includes(plan.seatCount)) {
      setSeatCountChoice(`${plan.seatCount}`)
    } else {
      setSeatCountChoice('custom')
      setCustomSeatCount(plan.seatCount)
    }
    setSelectedSeatId(null)
  }, [plan])

  const students = useMemo(() => distinctStudentNames(currentClass?.students ?? []), [currentClass])
  const seatAssignments = buildSeatDescriptors(plan)
  const board = getBoardGeometry(seatAssignments)
  const assignedSet = new Set(seatAssignments.map((seat) => seat.student).filter(Boolean))
  const assignedCount = seatAssignments.filter((seat) => seat.student).length
  const unassignedStudents = students.filter((student) => !assignedSet.has(student))
  const overflowCount = Math.max(0, students.length - (plan?.seatCount ?? 0))
  const selectedSeat = seatAssignments.find((seat) => seat.id === selectedSeatId) ?? null
  const layoutOptions = Object.entries(LAYOUT_LABELS) as [LayoutType, string][]

  const resolvedSeatCount = (() => {
    if (seatCountChoice === 'match') {
      return Math.max(students.length, 1)
    }
    if (seatCountChoice === 'custom') {
      return Math.max(4, customSeatCount)
    }
    return Number(seatCountChoice) || 12
  })()
  const previewSeats = useMemo(() => generateLayout(layoutDraft, resolvedSeatCount), [layoutDraft, resolvedSeatCount])
  const visibleSeats = step === 2
    ? previewSeats.map((seat) => ({ ...seat, label: seat.label ?? seat.id, student: null, locked: false }))
    : seatAssignments

  const handleClassChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = event.target.value
    if (targetId) {
      actions.setActiveClass(targetId)
      setSelectedSeatId(null)
    }
  }


  const handleSavePlan = () => {
    if (!activeClassId || !plan) {
      return
    }
    actions.updateSeatingPlan(activeClassId, plan.id, { name: planNameDraft })
  }

  const handleCreatePlan = () => {
    if (!activeClassId) {
      return
    }
    const name = planNameDraft.trim() || `${currentClass?.name ?? 'Plan'} · ${LAYOUT_LABELS[layoutDraft]}`
    actions.createSeatingPlan(activeClassId, name, layoutDraft, resolvedSeatCount)
    setSelectedSeatId(null)
  }

  const handleDeletePlan = () => {
    if (!activeClassId || !plan) {
      return
    }
    if (planList.length === 0) {
      return
    }
    const confirmed = window.confirm(`Ta bort planen "${plan.name}"?`)
    if (!confirmed) {
      return
    }
    actions.deleteSeatingPlan(activeClassId, plan.id)
    setSelectedSeatId(null)
  }

  const handleGenerateLayout = () => {
    if (!activeClassId || !plan) {
      return
    }
    const seats = actions.generateSeatingLayout(layoutDraft, resolvedSeatCount)
    const lost = plan.assignments.filter((item) => item.studentId && !seats.some((seat) => seat.id === item.seatId))
    if (lost.length && !window.confirm(`${lost.length} elever förlorar sin placering: ${lost.map((item) => item.studentId).join(', ')}. Fortsätt?`)) return false
    actions.updateSeatingPlan(activeClassId, plan.id, {
      layoutType: layoutDraft,
      seats,
    })
    setSelectedSeatId(null)
    return true
  }

  const handleSeatClick = (seatId: string) => {
    if (!activeClassId || !plan) {
      return
    }
    if (lockMode) {
      actions.toggleSeatLock(activeClassId, plan.id, seatId)
      return
    }
    const source = seatAssignments.find((seat) => seat.id === selectedSeatId)
    if (source?.student && source.id !== seatId) {
      moveStudent(source.student, seatId)
      return
    }
    setSelectedSeatId((current) => (current === seatId ? null : seatId))
  }

  const moveStudent = (student: string, seatId: string) => {
    if (!activeClassId || !plan || step !== 3) return
    const target = plan.assignments.find((item) => item.seatId === seatId)
    const source = plan.assignments.find((item) => item.studentId === student)
    if (!target || source?.seatId === seatId) return
    if (plan.lockedSeatIds.includes(seatId) || (source && plan.lockedSeatIds.includes(source.seatId))) {
      setNotice('Lås upp platsen först.'); return
    }
    const before = structuredClone(plan)
    actions.assignStudentToSeat(activeClassId, plan.id, seatId, student)
    const after = useBoardStore.getState().seating.seatingPlansByClassId[activeClassId][plan.id]
    setUndo({ classId: activeClassId, planId: plan.id, before, after: JSON.stringify(after.assignments) })
    setSelectedSeatId(null)
    setNotice(target.studentId && source ? `${student} och ${target.studentId} har bytt plats.` : `${student} har flyttats.`)
  }

  const handleAssignStudent = (student: string) => {
    if (!activeClassId || !plan || !selectedSeatId) {
      return
    }
    moveStudent(student, selectedSeatId)
  }

  const handleUnassignSeat = () => {
    if (!activeClassId || !plan || !selectedSeatId) {
      return
    }
    actions.assignStudentToSeat(activeClassId, plan.id, selectedSeatId, null)
  }

  const handleToggleSeatLock = (seatId: string) => {
    if (!activeClassId || !plan) {
      return
    }
    actions.toggleSeatLock(activeClassId, plan.id, seatId)
  }

  const handleGlobalLockToggle = () => {
    if (!activeClassId || !plan) {
      return
    }
    setLockMode((value) => !value)
  }

  const handleAutoAssign = () => {
    if (!activeClassId || !plan) {
      return
    }
    const before = structuredClone(plan)
    actions.autoAssignSeats(activeClassId, plan.id)
    rememberChange(before)
  }

  const handleShuffle = () => {
    if (!activeClassId || !plan) {
      return
    }
    const before = structuredClone(plan)
    actions.shuffleAssignments(activeClassId, plan.id)
    rememberChange(before)
  }

  const handleClear = () => {
    if (!activeClassId || !plan) {
      return
    }
    if (!window.confirm('Töm alla elevplaceringar, även låsta? Du kan ångra tömningen.')) return
    const before = structuredClone(plan)
    actions.clearAssignments(activeClassId, plan.id)
    rememberChange(before)
    setSelectedSeatId(null)
  }

  const rememberChange = (before: SeatingPlan) => {
    if (!activeClassId) return
    const after = useBoardStore.getState().seating.seatingPlansByClassId[activeClassId][before.id]
    setUndo({ classId: activeClassId, planId: before.id, before, after: JSON.stringify(after.assignments) })
    setNotice('Placeringen är uppdaterad. Du kan ångra ändringen.')
  }


  const handleExportPDF = async () => {
    if (!plan || !canvasRef.current || !currentClass) {
      return
    }
    const canvas = await html2canvas(canvasRef.current, { backgroundColor: '#ffffff', scale: 2 })
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 12
    const maxWidth = pageWidth - margin * 2
    const maxHeight = pageHeight - margin * 2
    const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
    const renderWidth = canvas.width * scale
    const renderHeight = canvas.height * scale
    const offsetX = (pageWidth - renderWidth) / 2
    const offsetY = (pageHeight - renderHeight) / 2
    const image = canvas.toDataURL('image/png')
    pdf.text(`${plan.name} · ${currentClass.name} · ${LAYOUT_LABELS[plan.layoutType]}`, margin, 10)
    pdf.addImage(image, 'PNG', offsetX, offsetY, renderWidth, renderHeight)
    pdf.save(`sittplats-${slugify(plan.name)}.pdf`)
  }

  const handleCreateGroups = () => {
    if (!activeClassId || !plan) {
      return
    }
    actions.createGroupsFromSeating(activeClassId, plan.id)
  }

  const handleCreateTurnOrder = () => {
    if (!activeClassId || !plan) {
      return
    }
    actions.createTurnOrderFromSeating(activeClassId, plan.id, true)
  }

  if (!currentClass || !plan) {
    return (
      <div className="seating-module">
        <div className="panel-card">
          <p className="eyebrow">Sittplats</p>
          {newClassForm}
        </div>
      </div>
    )
  }

  return (
    <div className="seating-module">
      {step !== 0 && <nav className="control-row" aria-label="Din sittplan">
        <button type="button" onClick={() => setStep(step === 1 ? 0 : step === 2 || step === 6 ? 1 : step === 5 ? 2 : step === 4 ? 3 : intent === 'open' ? 6 : 5)}><ArrowLeft size={16} /> Tillbaka</button>
        <span>{currentClass.name} · {students.length} elever</span>
      </nav>}
      {step === 0 && <section className="seating-guide">
        <h2>Vad vill du göra?</h2>
        <button type="button" onClick={() => { setIntent('new'); setNewDraft(true); setClassSource(null); setClassError(''); setStep(1) }}><Plus size={24} /> Skapa en ny sittplan</button>
        <button type="button" onClick={() => { setIntent('open'); setNewDraft(false); setStep(1) }}><FolderOpen size={24} /> Öppna en sparad sittplan</button>
      </section>}
      {step === 1 && intent === 'new' && <section className="seating-guide">
        <h2>Vilka elever ska vara med?</h2>
        <div className="seating-class-choices" role="group" aria-label="Välj elever">
          <button type="button" aria-pressed={classSource === 'saved'} onClick={() => { setClassSource('saved'); setClassError('') }}><FolderOpen size={20} /> Använd sparad klass</button>
          <button type="button" aria-pressed={classSource === 'new'} onClick={() => { setClassSource('new'); setClassError('') }}><Plus size={20} /> Skriv in elever</button>
        </div>
        {classSource === 'new' && newClassForm}
      </section>}
      {step === 1 && (intent === 'open' || classSource === 'saved') && <section className="control-row">
        <label>
          Vilken klass?
          <select value={activeClassId ?? ''} onChange={handleClassChange}>
            {classLists.lists.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <span>{students.length} elever</span>
        <button type="button" className="primary" onClick={() => { setSeatCountChoice('match'); setStep(intent === 'new' ? 2 : 6) }}>
          {intent === 'new' ? 'Nästa: välj möblering' : 'Visa sittplaner'}
        </button>
      </section>}
      {step === 6 && <section className="seating-guide">
        <h2>Vilken sittplan vill du öppna?</h2>
        {planList.map((item) => <button key={item.id} type="button" onClick={() => { actions.setActiveSeatingPlan(activeClassId, item.id); setStep(3) }}>
          <FolderOpen size={20} /> {item.name} · {item.assignments.filter((seat) => seat.studentId).length} placerade
        </button>)}
      </section>}
      {step === 5 && <section className="seating-guide">
        <h2>Hur vill du placera eleverna?</h2>
        <button type="button" onClick={() => { handleAutoAssign(); setStep(3) }}><Users size={24} /> Placera automatiskt</button>
        <button type="button" onClick={() => setStep(3)}><Plus size={24} /> Jag placerar själv</button>
      </section>}
      {step === 4 && <section className="control-row">
        <label>
          Planer
          <select
            value={plan.id}
            onChange={(event) => actions.setActiveSeatingPlan(activeClassId, event.target.value)}
          >
            {planList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          value={planNameDraft}
          onChange={(event) => setPlanNameDraft(event.target.value)}
          placeholder="Namn på plan"
        />
        <button type="button" onClick={handleSavePlan}>
          Spara
        </button>
        <button type="button" onClick={() => setStep(0)}>
          Ny plan
        </button>
        <button type="button" onClick={handleDeletePlan}>
          Ta bort
        </button>
      </section>}

      {step === 2 && <>
        <div className="seating-layout-workspace">
        <fieldset className="seating-layout-choices">
          <legend>Hur står borden?</legend>
          <div className="seating-layout-options" role="group" aria-label="Välj möblering">
            {layoutOptions.map(([value, label]) => <button key={value} type="button"
              className="seating-layout-choice" aria-pressed={layoutDraft === value} onClick={() => setLayoutDraft(value)}>
              <svg viewBox="0 0 120 90" aria-hidden="true" focusable="false">
                <rect x="42" y="2" width="36" height="4" rx="1" fill="currentColor" opacity="0.4" />
                {generateLayout(value, resolvedSeatCount).map((seat) => <rect key={seat.id}
                  x={12 + seat.x * 0.96 - 3} y={12 + seat.y * 0.66 - 2}
                  width="6" height="4" rx="1" fill="currentColor" />)}
              </svg>
              <span className="seating-choice-label">{label}<span className="seating-choice-check">{layoutDraft === value && <Check size={16} aria-label="Vald" />}</span></span>
            </button>)}
          </div>
        </fieldset>
        <section className="seating-layout-preview" aria-label={`Förhandsvisning: ${LAYOUT_LABELS[layoutDraft]}`}>
          <div className="seating-preview-heading"><h2>{LAYOUT_LABELS[layoutDraft]}</h2><span>{previewSeats.length} sittplatser</span></div>
          <svg viewBox="0 0 600 420" role="img" aria-label={`${LAYOUT_LABELS[layoutDraft]}, ${previewSeats.length} platser`} preserveAspectRatio="xMidYMid meet">
            <rect x="210" y="8" width="180" height="26" rx="4" fill="var(--surface-secondary)" stroke="var(--border-medium)" />
            <text x="300" y="26" textAnchor="middle" fontSize="13" fill="var(--text-secondary)">Lärarbord</text>
            {previewSeats.map((seat) => <rect key={seat.id} x={35 + seat.x * 5.3 - 12} y={50 + seat.y * 3.3 - 9} width="24" height="18" rx="3" fill="var(--accent-muted)" stroke="var(--accent)" strokeWidth="1.5" />)}
          </svg>
        </section>
        </div>
        <section className="control-row layout">
        <label>
          Platser
          <select value={seatCountChoice} onChange={(event) => setSeatCountChoice(event.target.value as SeatCountChoice)}>
            <option value="match">Matcha klasslista</option>
            {SEAT_COUNT_CHOICES.map((value) => (
              <option key={value} value={`${value}`}>
                {value} platser
              </option>
            ))}
            <option value="custom">Anpassat</option>
          </select>
        </label>
        {seatCountChoice === 'custom' && (
          <label>
            Antal
            <input
              type="number"
              min={4}
              max={64}
              value={customSeatCount}
              onChange={(event) => setCustomSeatCount(Number(event.target.value) || 4)}
            />
          </label>
        )}
        <button type="button" className="primary" onClick={() => {
          if (newDraft) { handleCreatePlan(); setNewDraft(false) }
          else if (!handleGenerateLayout()) return
          setStep(5)
        }}>
          Nästa: välj placering <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section></>}

      {step === 3 && <section className="control-row actions">
        <button type="button" disabled={!undo || undo.planId !== plan.id || undo.classId !== activeClassId || undo.after !== JSON.stringify(plan.assignments)} onClick={() => {
          if (!undo || undo.planId !== plan.id || undo.classId !== activeClassId || undo.after !== JSON.stringify(plan.assignments)) return
          actions.updateSeatingPlan(activeClassId, plan.id, { assignments: undo.before.assignments })
          setUndo(null); setNotice('Flytten är ångrad.')
        }}>Ångra ändring</button>
        <button type="button" onClick={handleAutoAssign}>
          <Users size={16} aria-hidden="true" /> Placera automatiskt
        </button>
        <button type="button" onClick={handleShuffle}>
          <ShuffleIcon size={16} aria-hidden="true" /> Blanda om
        </button>
        <details><summary>Fler placeringsval</summary><button type="button" onClick={handleClear}>
          <RefreshCcw size={16} aria-hidden="true" /> Töm
        </button>
        <button type="button" className={clsx({ active: lockMode })} onClick={handleGlobalLockToggle}>
          {lockMode ? <Unlock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />} Lås platsläge
        </button>
        </details>
        <button type="button" className="primary" onClick={() => setStep(4)}>Klar med placeringen</button>
      </section>}
      {step === 4 && <section className="control-row actions">
        <button type="button" onClick={handleExportPDF}>
          <FileDown size={16} aria-hidden="true" /> PDF
        </button>
      </section>}

      {step === 4 && <section className="control-row bridge">
        <button type="button" onClick={handleCreateGroups} disabled={plan.layoutType !== 'grupper4' || assignedCount === 0}>
          Skapa grupper från borden
        </button>
        <button type="button" onClick={handleCreateTurnOrder} disabled={assignedCount === 0}>
          Skapa turordning från sittordning
        </button>
      </section>}

      {notice && <p role="status" style={{ padding: '0 16px', margin: '8px 0' }}>{notice}</p>}
      {(step === 3 || step === 4) && <div className="seating-canvas-wrapper">
        <div className="seating-stage">
          <div className="seating-board" ref={canvasRef} style={{ width: board.width, height: board.height, position: 'relative', flexShrink: 0 }}>
          <div className="teacher-desk">Lärarbord</div>
          {visibleSeats.map((seat) => (
            <button
              key={seat.id}
              type="button"
              className={clsx('seat-card', {
                'is-empty': !seat.student,
                'is-selected': selectedSeatId === seat.id,
              })}
              style={{ left: 24 + seat.x * board.scaleX, top: 80 + seat.y * board.scaleY }}
              data-locked={seat.locked ? 'true' : 'false'}
              data-drop-target={dropSeat === seat.id ? 'true' : 'false'}
              draggable={step === 3 && !!seat.student && !seat.locked && !lockMode}
              onDragStart={(event) => {
                if (!seat.student || seat.locked || !activeClassId) { event.preventDefault(); return }
                drag.current = { student: seat.student, planId: plan.id, classId: activeClassId }
                event.dataTransfer.setData('text/plain', seat.student)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                if (!drag.current || seat.locked || step !== 3) return
                event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropSeat(seat.id)
              }}
              onDragLeave={() => setDropSeat(null)}
              onDrop={(event) => {
                event.preventDefault()
                const source = drag.current
                drag.current = null; setDropSeat(null)
                if (source?.planId === plan.id && source.classId === activeClassId) moveStudent(source.student, seat.id)
              }}
              onDragEnd={() => { drag.current = null; setDropSeat(null) }}
              disabled={step === 4}
              onClick={() => handleSeatClick(seat.id)}
            >
              <span className="seat-label">{seat.label}</span>
              <strong className="seat-student">{seat.student ?? 'Tom plats'}</strong>
              <span className="seat-lock" onClick={(event) => handleLockClick(event, () => handleToggleSeatLock(seat.id))}>
                {seat.locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
              </span>
            </button>
          ))}
          </div>
        </div>
        {step === 3 && <aside className="seating-side-panel">
          <header>
            <p className="eyebrow">Placering</p>
          <p className="placement-tip">Klicka på en plats → klicka sedan på ett namn nedan för att placera eleven</p>
            <h3>
              {assignedCount} av {students.length} elever placerade · {plan.seatCount} platser
            </h3>
            {overflowCount > 0 && <span className="hint">{overflowCount} elever saknar plats</span>}
          </header>
          <section className="unassigned-list">
            <h4>Lediga elever</h4>
            {unassignedStudents.length === 0 && <p>Alla elever har en plats.</p>}
            {unassignedStudents.length > 0 && (
              <ul>
                {unassignedStudents.map((student) => (
                  <li key={student}>
                    <button type="button" draggable onDragStart={(event) => {
                      if (!activeClassId) return
                      drag.current = { student, planId: plan.id, classId: activeClassId }
                      event.dataTransfer.setData('text/plain', student)
                      event.dataTransfer.effectAllowed = 'move'
                    }} onDragEnd={() => { drag.current = null; setDropSeat(null) }} onClick={() => handleAssignStudent(student)}>
                      {student}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {selectedSeat && (
            <section className="seat-details">
              <h4>
                {selectedSeat.label}
                {selectedSeat.locked && <Lock size={14} aria-hidden="true" />}
              </h4>
              <p>{selectedSeat.student ?? 'Tom plats'}</p>
              <div className="seat-detail-actions">
                <button type="button" onClick={handleUnassignSeat} disabled={!selectedSeat.student}>
                  Rensa plats
                </button>
                <button type="button" onClick={() => handleToggleSeatLock(selectedSeat.id)}>
                  {selectedSeat.locked ? 'Lås upp' : 'Lås plats'}
                </button>
              </div>
            </section>
          )}
        </aside>}
      </div>}
    </div>
  )
}

function buildSeatDescriptors(plan?: SeatingPlan): SeatDescriptor[] {
  if (!plan) {
    return []
  }
  const assignmentMap = new Map(plan.assignments.map((assignment) => [assignment.seatId, assignment.studentId]))
  const locked = new Set(plan.lockedSeatIds)
  return plan.seats.map((seat) => ({
    id: seat.id,
    label: seat.label ?? seat.id,
    x: seat.x,
    y: seat.y,
    student: assignmentMap.get(seat.id) ?? null,
    locked: locked.has(seat.id),
  }))
}

function getBoardGeometry(seats: { x: number; y: number }[]) {
  let scaleX = 7
  let scaleY = 4
  // Keep the arrangement, enlarging its scrollable surface to separate seats.
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const dx = Math.abs(seats[i].x - seats[j].x)
      const dy = Math.abs(seats[i].y - seats[j].y)
      const factor = Math.min(dx ? 120 / (dx * scaleX) : Infinity, dy ? 72 / (dy * scaleY) : Infinity)
      if (factor > 1 && Number.isFinite(factor)) { scaleX *= factor; scaleY *= factor }
    }
  }
  return { scaleX, scaleY, width: 100 * scaleX + 160, height: 100 * scaleY + 160 }
}

function handleLockClick(event: React.MouseEvent<HTMLSpanElement>, onToggle: () => void) {
  event.preventDefault()
  event.stopPropagation()
  onToggle()
}



function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}
