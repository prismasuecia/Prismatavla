import { useState, type ButtonHTMLAttributes } from 'react'
import { Play, Pause, Pencil, Eye, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Trash2, Plus, Square, Check } from 'lucide-react'
import { useBoardStore } from '../../store/useBoardStore'

const TEMPLATES = {
  'Genomgång och övning': [['Genomgång', 15], ['Parövning', 10], ['Redovisning', 10]],
  'Diskussionslektion': [['Introduktion', 5], ['Gruppdiskussion', 15], ['Helklass', 10], ['Avslut', 5]],
} as const

function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 40, padding: '8px 12px', border: '1px solid var(--border-medium)', borderRadius: 6, background: 'var(--surface-primary)', color: 'var(--text-primary)', cursor: props.disabled ? 'default' : 'pointer', opacity: props.disabled ? 0.45 : 1, font: 'inherit', fontSize: 14, ...props.style }}>{children}</button>
}

export function LessonPlanWindow() {
  const plan = useBoardStore((state) => state.lessonPlan)
  const actions = useBoardStore((state) => state.actions)
  const fullscreen = useBoardStore((state) => Boolean(state.moduleWindows.windowsById.lessonplan?.fullscreen))
  const status = plan.status ?? 'ready'
  const [editing, setEditing] = useState(status === 'ready')
  const phases = plan.phases
  const index = phases.findIndex((phase) => phase.id === plan.activePhaseId)
  const current = phases[index]
  const next = phases[index + 1]
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 6, border: '1px solid var(--border-medium)', color: 'var(--text-primary)', background: 'var(--surface-secondary)', font: 'inherit', marginTop: 6 } as const
  const start = () => {
    if (status !== 'ready' && !window.confirm('Börja om lektionen från första momentet?')) return
    useBoardStore.setState((state) => state.lessonPlan.phases.length ? { lessonPlan: { ...state.lessonPlan, status: 'running', activePhaseId: state.lessonPlan.phases[0].id, phases: state.lessonPlan.phases.map((phase) => ({ ...phase, done: false })) } } : state)
    setEditing(false)
  }
  const advance = (direction: number) => useBoardStore.setState((state) => {
    const p = state.lessonPlan
    const i = p.phases.findIndex((phase) => phase.id === p.activePhaseId)
    if (p.status !== 'running' || i < 0 || i + direction < 0) return state
    const target = p.phases[i + direction]
    return { lessonPlan: { ...p, status: target ? 'running' : 'finished', activePhaseId: target?.id,
      phases: p.phases.map((phase, n) => n === i ? { ...phase, done: direction > 0 } : direction < 0 && n === i - 1 ? { ...phase, done: false } : phase) } }
  })
  const move = (id: string, direction: number) => useBoardStore.setState((state) => {
    const list = [...state.lessonPlan.phases]
    const i = list.findIndex((phase) => phase.id === id)
    if (i < 0 || !list[i + direction]) return state
    ;[list[i], list[i + direction]] = [list[i + direction], list[i]]
    return { lessonPlan: { ...state.lessonPlan, phases: list } }
  })
  return <div className="lesson-editorial" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
      <strong role="status">{status === 'paused' ? 'Lektionen är pausad' : status === 'running' ? `Lektionen pågår · Moment ${index + 1} av ${phases.length}` : status === 'finished' ? 'Lektionen är klar' : 'Planera lektionen'}</strong>
      <Button onClick={() => setEditing(!editing)}>{editing ? <Eye size={16} /> : <Pencil size={16} />}{editing ? 'Visa lektionen' : 'Redigera'}</Button>
    </header>
    {editing ? <div className="lesson-editorial-edit" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <label>Dagens mål<input value={plan.goal ?? ''} onChange={(e) => { const goal = e.target.value; useBoardStore.setState((state) => ({ lessonPlan: { ...state.lessonPlan, goal } })) }} style={inputStyle} /></label>
      {status !== 'running' && status !== 'paused' && <div role="group" aria-label="Lektionsmallar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(TEMPLATES).map(([name, entries]) => <Button key={name} onClick={() => {
          if (phases.length && !window.confirm('Ersätt momenten med mallen?')) return
          useBoardStore.setState((state) => ({ lessonPlan: { ...state.lessonPlan, status: 'ready', activePhaseId: undefined, phases: entries.map(([title, minutes]) => ({ id: crypto.randomUUID(), name: title, minutes, done: false, targetModuleId: 'timer' as const })) } }))
        }}>{name}</Button>)}
      </div>}
      {phases.map((phase, i) => <section key={phase.id} aria-label={`Moment ${i + 1}`} style={{ paddingBottom: 18, borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label>Moment {i + 1}<input value={phase.name} onChange={(e) => actions.updateLessonPhase(phase.id, { name: e.target.value })} style={inputStyle} /></label>
        <label>Kort instruktion<textarea value={phase.description ?? ''} onChange={(e) => actions.updateLessonPhase(phase.id, { description: e.target.value })} style={inputStyle} rows={2} /></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label>Planerade minuter <input type="number" min={1} max={180} value={phase.minutes} onChange={(e) => actions.updateLessonPhase(phase.id, { minutes: Number(e.target.value) })} style={{ ...inputStyle, width: 70 }} /></label>
          <Button title="Flytta upp" aria-label={`Flytta upp ${phase.name}`} disabled={i === 0} onClick={() => move(phase.id, -1)}><ArrowUp size={18} /></Button>
          <Button title="Flytta ner" aria-label={`Flytta ner ${phase.name}`} disabled={i === phases.length - 1} onClick={() => move(phase.id, 1)}><ArrowDown size={18} /></Button>
          <Button disabled={(status === 'running' || status === 'paused') && phase.id === plan.activePhaseId} onClick={() => { if (window.confirm(`Ta bort ”${phase.name}”?`)) actions.removeLessonPhase(phase.id) }} style={{ color: '#a5332b', borderColor: '#b65048' }}><Trash2 size={18} /> Ta bort</Button>
        </div>
      </section>)}
      <Button onClick={() => actions.addLessonPhase()}><Plus size={18} /> Lägg till moment</Button>
      <span>{phases.reduce((sum, phase) => sum + phase.minutes, 0)} planerade minuter</span>
    </div> : <main className="lesson-editorial-live" style={{ padding: fullscreen ? 32 : 20, overflowWrap: 'anywhere' }}>
      {plan.goal && <div className="lesson-editorial-goal" style={{ paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}><strong>Dagens mål</strong><p style={{ margin: '8px 0', fontSize: fullscreen ? 26 : 18 }}>{plan.goal}</p></div>}
      {(status === 'running' || status === 'paused') && current ? <>
        <section className="lesson-editorial-now" style={{ padding: '24px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <strong style={{ color: 'var(--accent)' }}>{status === 'paused' ? 'Vi fortsätter med' : 'Nu'}</strong>
          <h2 style={{ fontSize: fullscreen ? 48 : 30, margin: '12px 0', lineHeight: 1.2 }}>{current.name}</h2>
          {current.description && <p style={{ fontSize: fullscreen ? 28 : 20, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{current.description}</p>}
        </section>
        {next && <section className="lesson-editorial-next" style={{ padding: '20px 0' }}><strong>Sedan</strong><p style={{ margin: '8px 0', fontSize: fullscreen ? 28 : 20 }}>{next.name}</p></section>}
      </> : <h2 className="lesson-editorial-title">{status === 'finished' ? 'Tack för idag' : 'Dagens lektion'}</h2>}
      <ol className="lesson-editorial-outline" style={{ paddingLeft: 24, lineHeight: 1.9, fontSize: fullscreen ? 22 : 16 }}>
        {phases.map((phase) => <li key={phase.id} aria-current={phase.id === plan.activePhaseId ? 'step' : undefined} style={{ fontWeight: phase.id === plan.activePhaseId ? 600 : 400 }}>{phase.done && <Check size={16} aria-label="Klart" />} {phase.name}</li>)}
      </ol>
      {!phases.length && <p>Lägg till ett moment för att börja.</p>}
    </main>}
    <footer style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16, borderTop: '1px solid var(--border-subtle)', marginTop: 'auto', background: 'var(--surface-primary)' }}>
      {status === 'ready' || status === 'finished' ? <Button disabled={!phases.length} onClick={start} style={{ background: 'var(--accent)', color: '#fff' }}><Play size={18} />{status === 'finished' ? 'Starta igen' : 'Starta lektionen'}</Button> : <>
        <Button disabled={index <= 0 || status === 'paused'} onClick={() => advance(-1)}><ArrowLeft size={18} /> Föregående</Button>
        <Button onClick={() => useBoardStore.setState((state) => ({ lessonPlan: { ...state.lessonPlan, status: state.lessonPlan.status === 'paused' ? 'running' : 'paused' } }))}>{status === 'paused' ? <Play size={18} /> : <Pause size={18} />}{status === 'paused' ? 'Fortsätt' : 'Pausa'}</Button>
        <Button disabled={!current || status === 'paused'} onClick={() => advance(1)} style={{ background: 'var(--accent)', color: '#fff' }}><ArrowRight size={18} />{next ? 'Nästa moment' : 'Slutför lektionen'}</Button>
        <Button onClick={() => { if (window.confirm('Avsluta lektionen nu?')) useBoardStore.setState((state) => ({ lessonPlan: { ...state.lessonPlan, status: 'finished', activePhaseId: undefined } })) }}><Square size={16} /> Avsluta</Button>
      </>}
    </footer>
  </div>
}
