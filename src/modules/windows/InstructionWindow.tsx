import { useState } from 'react'
import { Pencil, Eye, Save } from 'lucide-react'
import { useBoardStore } from '../../store/useBoardStore'

const PRESETS = {
  Starta: 'Dags att börja\n\n1. Ta fram boken och en penna.\n2. Öppna sidan 24.\n3. Börja med fråga 1.\n\nVi arbetar: själva.\nNär du är klar: läs vidare på nästa sida.',
  Arbeta: 'Arbeta tillsammans\n\n1. Läs uppgiften.\n2. Diskutera frågorna två och två.\n3. Skriv ett gemensamt svar.\n\nVi arbetar: i par.\nNär ni är klara: kontrollera svaren.',
  Avsluta: 'Dags att avsluta\n\n1. Skriv klart meningen.\n2. Spara och lämna in.\n3. Lägg undan materialet.\n\nSedan: invänta nästa aktivitet.',
}

export function InstructionWindow() {
  const instructions = useBoardStore((state) => state.instructions)
  const fullscreen = useBoardStore((state) => Boolean(state.moduleWindows.windowsById.instructioncards?.fullscreen))
  const actions = useBoardStore((state) => state.actions)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState('')
  const cards = instructions.savedCards ?? []
  const lines = instructions.text.split('\n')
  const title = lines[0] || 'Nu gör vi'
  const button = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--surface-primary)', color: 'var(--text-primary)', cursor: 'pointer' } as const
  return <div className="instruction-editorial" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 14 }}>
      <button type="button" style={button} onClick={() => actions.lockInstructions(!instructions.locked)}>
        {instructions.locked ? <Pencil size={16} /> : <Eye size={16} />}{instructions.locked ? 'Redigera' : 'Visa uppgiften'}
      </button>
    </div>
    {instructions.locked ? <article aria-label="Aktuell uppgift" style={{ padding: fullscreen ? 32 : 20, color: 'var(--text-primary)' }}>
      <h2 style={{ fontSize: fullscreen ? 36 : 24, margin: '0 0 24px', overflowWrap: 'anywhere' }}>{title}</h2>
      {lines.slice(1).map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />
        const step = line.match(/^(\d+)[.)]\s+(.+)$/)
        const className = step ? 'instruction-step' : /^(När |Sedan:)/i.test(line) ? 'instruction-finish' : undefined
        return <p key={i} className={className} style={{ fontSize: fullscreen ? 28 : 20, lineHeight: 1.6, margin: '12px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {step ? <><span>{step[1].padStart(2, '0')}</span><span>{step[2]}</span></> : line}
        </p>
      })}
    </article> : <>
      <div role="group" aria-label="Välj mall" style={{ display: 'flex', gap: 8, padding: '0 16px 14px', flexWrap: 'wrap' }}>
        {Object.entries(PRESETS).map(([label, text]) => <button type="button" key={label} style={button} onClick={() => {
          if (instructions.text.trim() && !window.confirm('Ersätt aktuell text med mallen?')) return
          actions.applyInstructionPreset(text); setStatus('')
        }}>{label}</button>)}
      </div>
      <textarea aria-label="Uppgift" value={instructions.text} onChange={(event) => actions.setInstructionText(event.target.value)}
        style={{ margin: '0 16px 16px', minHeight: 220, flex: 1, resize: 'vertical', padding: 14, font: 'inherit', lineHeight: 1.7, color: 'var(--text-primary)', background: 'var(--surface-secondary)', border: '1px solid var(--border-medium)', borderRadius: 6 }} />
      <details style={{ padding: '0 16px 16px' }}>
        <summary>Sparade kort</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <input aria-label="Kortets namn" placeholder="Kortets namn" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" style={button} onClick={() => {
            if (!instructions.text.trim()) { setStatus('Skriv en uppgift först.'); return }
            const label = name.trim() || title
            const existing = cards.find((card) => card.name === label)
            if (existing && !window.confirm('Ersätt det sparade kortet?')) return
            const card = { id: existing?.id ?? crypto.randomUUID(), name: label, text: instructions.text }
            useBoardStore.setState((state) => ({ instructions: { ...state.instructions, savedCards: [...(state.instructions.savedCards ?? []).filter((item) => item.id !== card.id), card] } }))
            setSelected(card.id); setStatus('Kortet är sparat.')
          }}><Save size={16} /> Spara kort</button>
          <select aria-label="Sparade kort" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Välj kort</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
          </select>
          <button type="button" style={button} disabled={!selected} onClick={() => {
            const card = cards.find((item) => item.id === selected)
            if (!card || (instructions.text.trim() && !window.confirm('Ersätt aktuell text med det sparade kortet?'))) return
            actions.setInstructionText(card.text); setName(card.name); setStatus('Kortet är öppnat.')
          }}>Öppna kort</button>
        </div>
      </details>
    </>}
    {status && <p role="status" style={{ padding: '0 16px' }}>{status}</p>}
  </div>
}
