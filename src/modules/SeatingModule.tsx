import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { FileDown, FileSpreadsheet, Lock, RefreshCcw, Shuffle as ShuffleIcon, Unlock, Users } from 'lucide-react'
import { useBoardStore, type LayoutType, type SeatingPlan } from '../store/useBoardStore'
import { LAYOUT_LABELS } from '../lib/seatingLayouts'

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

  const activeClassId = classLists.activeId ?? classLists.lists[0]?.id ?? null
  const currentClass = classLists.lists.find((entry) => entry.id === activeClassId)
  const planMap = activeClassId ? seating?.seatingPlansByClassId[activeClassId] ?? {} : {}
  const planList = [...Object.values(planMap)].sort((a, b) => a.createdAt - b.createdAt)
  const activePlanId = activeClassId ? seating?.activeSeatingPlanIdByClassId[activeClassId] : null
  const plan = planList.find((item) => item.id === activePlanId) ?? planList[0]

  useEffect(() => {
    if (!plan) {
      setPlanNameDraft('')
      setSelectedSeatId(null)
      return
    }
    setPlanNameDraft(plan.name)
    setLayoutDraft(plan.layoutType)
    if (SEAT_COUNT_CHOICES.includes(plan.seatCount)) {
      setSeatCountChoice(`${plan.seatCount}`)
    } else {
      setSeatCountChoice('custom')
      setCustomSeatCount(plan.seatCount)
    }
    setSelectedSeatId(null)
  }, [plan])

  const students = useMemo(() => currentClass?.students ?? [], [currentClass])
  const seatAssignments = buildSeatDescriptors(plan)
  const assignedSet = new Set(seatAssignments.map((seat) => seat.student).filter(Boolean))
  const assignedCount = seatAssignments.filter((seat) => seat.student).length
  const unassignedStudents = students.filter((student) => !assignedSet.has(student))
  const overflowCount = Math.max(0, students.length - (plan?.seatCount ?? 0))
  const selectedSeat = seatAssignments.find((seat) => seat.id === selectedSeatId) ?? null
  const layoutOptions = Object.entries(LAYOUT_LABELS)

  const resolvedSeatCount = (() => {
    if (seatCountChoice === 'match') {
      return Math.max(students.length, 1)
    }
    if (seatCountChoice === 'custom') {
      return Math.max(4, customSeatCount)
    }
    return Number(seatCountChoice) || 12
  })()

  const handleClassChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = event.target.value
    if (targetId) {
      actions.setActiveClass(targetId)
      setSelectedSeatId(null)
    }
  }

  const handleSyncClassList = () => {
    if (!activeClassId || !plan) {
      return
    }
    actions.clearAssignments(activeClassId, plan.id)
    actions.autoAssignSeats(activeClassId, plan.id)
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
    actions.updateSeatingPlan(activeClassId, plan.id, {
      layoutType: layoutDraft,
      seats,
    })
    setSelectedSeatId(null)
  }

  const handleSeatClick = (seatId: string) => {
    if (!activeClassId || !plan) {
      return
    }
    if (lockMode) {
      actions.toggleSeatLock(activeClassId, plan.id, seatId)
      return
    }
    setSelectedSeatId((current) => (current === seatId ? null : seatId))
  }

  const handleAssignStudent = (student: string) => {
    if (!activeClassId || !plan || !selectedSeatId) {
      return
    }
    actions.assignStudentToSeat(activeClassId, plan.id, selectedSeatId, student)
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
    actions.autoAssignSeats(activeClassId, plan.id)
  }

  const handleShuffle = () => {
    if (!activeClassId || !plan) {
      return
    }
    actions.shuffleAssignments(activeClassId, plan.id)
  }

  const handleClear = () => {
    if (!activeClassId || !plan) {
      return
    }
    actions.clearAssignments(activeClassId, plan.id)
    setSelectedSeatId(null)
  }

  const handleExportCSV = () => {
    if (!plan || !currentClass) {
      return
    }
    const rows = plan.seats.map((seat) => {
      const assignment = plan.assignments.find((item) => item.seatId === seat.id)
      const student = assignment?.studentId ?? ''
      return `${seat.id},${csvValue(student)},${plan.layoutType},${csvValue(plan.name)},${csvValue(currentClass.name)}`
    })
    const header = 'seatId,studentName,layoutType,planName,classListName'
    downloadFile(`sittplats-${slugify(plan.name)}.csv`, 'text/csv;charset=utf-8', [header, ...rows].join('\n'))
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
          <h2>Ingen klasslista</h2>
          <p>Skapa en klasslista för att planera sittplatser.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="seating-module">
      <section className="control-row">
        <label>
          Klasslista
          <select value={activeClassId ?? ''} onChange={handleClassChange}>
            {classLists.lists.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleSyncClassList}>
          Hämta aktiv klasslista
        </button>
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
        <button type="button" onClick={handleCreatePlan}>
          Ny plan
        </button>
        <button type="button" onClick={handleDeletePlan}>
          Ta bort
        </button>
      </section>

      <section className="control-row layout">
        <label>
          Layouttyp
          <select value={layoutDraft} onChange={(event) => setLayoutDraft(event.target.value as LayoutType)}>
            {layoutOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
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
        <button type="button" onClick={handleGenerateLayout}>
          Generera layout
        </button>
      </section>

      <section className="control-row actions">
        <button type="button" onClick={handleAutoAssign}>
          <Users size={16} aria-hidden="true" /> Auto-placera
        </button>
        <button type="button" onClick={handleShuffle}>
          <ShuffleIcon size={16} aria-hidden="true" /> Blanda om
        </button>
        <button type="button" onClick={handleClear}>
          <RefreshCcw size={16} aria-hidden="true" /> Töm
        </button>
        <button type="button" className={clsx({ active: lockMode })} onClick={handleGlobalLockToggle}>
          {lockMode ? <Unlock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />} Lås platsläge
        </button>
        <button type="button" onClick={handleExportPDF}>
          <FileDown size={16} aria-hidden="true" /> PDF
        </button>
        <button type="button" onClick={handleExportCSV}>
          <FileSpreadsheet size={16} aria-hidden="true" /> CSV
        </button>
      </section>

      <section className="control-row bridge">
        <button type="button" onClick={handleCreateGroups} disabled={plan.layoutType !== 'grupper4' || assignedCount === 0}>
          Skapa grupper från borden
        </button>
        <button type="button" onClick={handleCreateTurnOrder} disabled={assignedCount === 0}>
          Skapa turordning från sittordning
        </button>
      </section>

      <div className="seating-canvas-wrapper">
        <div className="seating-stage" ref={canvasRef}>
          <div className="teacher-desk">Lärarbord</div>
          {seatAssignments.map((seat) => (
            <button
              key={seat.id}
              type="button"
              className={clsx('seat-card', {
                'is-empty': !seat.student,
                'is-selected': selectedSeatId === seat.id,
              })}
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
              data-locked={seat.locked ? 'true' : 'false'}
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
        <aside className="seating-side-panel">
          <header>
            <p className="eyebrow">Placering</p>
            <h3>
              {assignedCount} av {Math.max(plan.seatCount, students.length)} elever
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
                    <button type="button" onClick={() => handleAssignStudent(student)}>
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
        </aside>
      </div>
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

function handleLockClick(event: React.MouseEvent<HTMLSpanElement>, onToggle: () => void) {
  event.preventDefault()
  event.stopPropagation()
  onToggle()
}

function csvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}
