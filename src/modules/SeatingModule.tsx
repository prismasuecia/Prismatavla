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
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'var(--font-sans)', overflow:'hidden' }}>

      {/* === TOPBAR: Plan-val + kontroller === */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
        {/* Klassval */}
        <select value={activeClassId??''} onChange={handleClassChange}
          style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', cursor:'pointer' }}>
          {classLists.lists.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" onClick={handleSyncClassList}
          style={{ padding:'6px 12px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
          Hämta klass
        </button>

        <div style={{ width:1, height:20, background:'var(--border-subtle)', margin:'0 2px' }} />

        {/* Planval */}
        <select value={plan.id} onChange={e=>actions.setActiveSeatingPlan(activeClassId,e.target.value)}
          style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', cursor:'pointer' }}>
          {planList.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input type="text" value={planNameDraft} onChange={e=>setPlanNameDraft(e.target.value)}
          placeholder="Nytt plannamn"
          style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', width:120 }} />
        <button type="button" onClick={handleSavePlan}
          style={{ padding:'6px 12px', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Spara
        </button>
        <button type="button" onClick={handleCreatePlan}
          style={{ padding:'6px 12px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Ny plan
        </button>
        <button type="button" onClick={handleDeletePlan}
          style={{ padding:'6px 12px', borderRadius:20, border:'1.5px solid rgba(180,60,50,0.3)', background:'transparent', fontSize:12, color:'#B43C32', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Ta bort
        </button>
      </div>

      {/* === LAYOUT-KONTROLLER === */}
      <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
        <select value={layoutDraft} onChange={e=>setLayoutDraft(e.target.value as LayoutType)}
          style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', cursor:'pointer' }}>
          {Object.entries(LAYOUT_LABELS).map(([k,v])=><option key={k} value={k}>{v as string}</option>)}
        </select>
        <select value={seatCountChoice} onChange={e=>setSeatCountChoice(e.target.value as SeatCountChoice)}
          style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', cursor:'pointer' }}>
          <option value="match">Matcha klass</option>
          {SEAT_COUNT_CHOICES.map(n=><option key={n} value={String(n)}>{n} platser</option>)}
          <option value="custom">Anpassat</option>
        </select>
        {seatCountChoice==='custom' && (
          <input type="number" value={customSeatCount} onChange={e=>setCustomSeatCount(Number(e.target.value))} min={1} max={60}
            style={{ width:60, padding:'5px 8px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, fontFamily:'var(--font-sans)', outline:'none' }} />
        )}
        <button type="button" onClick={handleGenerateLayout}
          style={{ padding:'6px 14px', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Generera layout
        </button>

        <div style={{ flex:1 }} />

        {/* Åtgärder */}
        {[
          {label:'Auto-placera', fn:handleAutoAssign},
          {label:'Blanda om', fn:handleShuffle},
          {label:'Töm', fn:handleClear},
        ].map(({label,fn})=>(
          <button key={label} type="button" onClick={fn}
            style={{ padding:'5px 12px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            {label}
          </button>
        ))}
        <button type="button" onClick={handleGlobalLockToggle}
          style={{ padding:'5px 12px', borderRadius:20, border:'1.5px solid '+(lockMode?'var(--accent)':'var(--border-medium)'), background:lockMode?'rgba(45,92,69,0.08)':'transparent', fontSize:12, color:lockMode?'var(--accent)':'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)', fontWeight:lockMode?600:400 }}>
          {lockMode ? '🔒 Låsläge' : 'Lås platser'}
        </button>
        <button type="button" onClick={handleExportCSV} style={{ padding:'5px 10px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>CSV</button>
        <button type="button" onClick={handleExportPDF} style={{ padding:'5px 10px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>PDF</button>
      </div>

      {/* === HUVUD: Platserna + sidopanel === */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Platskarta */}
        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          {seatDescriptors.length === 0 ? (
            <div style={{ textAlign:'center', paddingTop:60, color:'var(--text-tertiary)' }}>
              <div style={{ fontSize:40, opacity:0.15, marginBottom:12 }}>◻</div>
              <div style={{ fontSize:14, fontWeight:500 }}>Generera en layout för att börja</div>
            </div>
          ) : (
            <div>
              {Array.from(new Set(seatDescriptors.map(s=>s.group))).map(group=>(
                <div key={group} style={{ marginBottom:16 }}>
                  {group && <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:8 }}>{group}</div>}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {seatDescriptors.filter(s=>s.group===group).map(seat=>{
                      const isSelected = selectedSeatId === seat.id
                      const isLocked = plan.lockedSeatIds?.includes(seat.id)
                      const student = seat.studentName
                      return (
                        <button key={seat.id} type="button" onClick={()=>handleSeatClick(seat.id)}
                          style={{
                            width:80, minHeight:52, borderRadius:10, padding:'6px 8px',
                            border: isSelected ? '2px solid var(--accent)' : isLocked ? '1.5px solid var(--text-tertiary)' : '1.5px solid var(--border-medium)',
                            background: isSelected ? 'rgba(45,92,69,0.1)' : student ? 'var(--surface-secondary)' : 'transparent',
                            cursor:'pointer', fontFamily:'var(--font-sans)',
                            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                          }}>
                          <div style={{ fontSize:9, color:'var(--text-tertiary)', fontWeight:600 }}>{seat.label}</div>
                          <div style={{ fontSize:11, fontWeight:student?600:400, color:student?'var(--text-primary)':'var(--border-medium)', wordBreak:'break-word', textAlign:'center', lineHeight:1.2 }}>
                            {student || '–'}
                          </div>
                          {isLocked && <div style={{ fontSize:9, color:'var(--text-tertiary)' }}>🔒</div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidopanel: Lediga elever */}
        <div style={{ width:160, borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:4 }}>Lediga elever</div>
            <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{unassignedStudents.length} av {allStudents.length}</div>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:'8px 12px' }}>
            {unassignedStudents.length === 0 ? (
              <div style={{ fontSize:12, color:'var(--text-tertiary)', textAlign:'center', paddingTop:16 }}>Alla placerade ✓</div>
            ) : (
              unassignedStudents.map(name=>(
                <button key={name} type="button"
                  onClick={()=>selectedSeatId ? handleAssignStudent(name) : undefined}
                  style={{ display:'block', width:'100%', padding:'6px 8px', borderRadius:8, border:'1.5px solid '+(selectedSeatId?'var(--accent)':'var(--border-medium)'), background:selectedSeatId?'rgba(45,92,69,0.06)':'transparent', fontSize:12, color:'var(--text-primary)', cursor:selectedSeatId?'pointer':'default', fontFamily:'var(--font-sans)', textAlign:'left', marginBottom:4, transition:'all 120ms' }}>
                  {name}
                </button>
              ))
            )}
          </div>
          {selectedSeatId && (
            <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border-subtle)', flexShrink:0 }}>
              <button type="button" onClick={()=>handleUnassignSeat(selectedSeatId)}
                style={{ width:'100%', padding:'6px 0', borderRadius:20, border:'1.5px solid rgba(180,60,50,0.3)', background:'transparent', fontSize:11, color:'#B43C32', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                Avplacera
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === BOTTEN: Exportera === */}
      <div style={{ padding:'8px 16px', borderTop:'1px solid var(--border-subtle)', display:'flex', gap:8, flexShrink:0 }}>
        <button type="button" onClick={handleCreateGroups}
          style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Skapa grupper från borden
        </button>
        <button type="button" onClick={handleCreateTurnOrder}
          style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Turordning från sittordning
        </button>
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
