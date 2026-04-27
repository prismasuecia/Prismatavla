import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useBoardStore, getActiveStudents } from '../../store/useBoardStore'
import { shuffleList } from '../../utils/array'

type GroupMode = 'groups' | 'size' | null
type StepId = 'names' | 'setup' | 'results'

interface GroupResult {
  leader: string | null
  members: string[]
}

interface GroupSavePayload {
  names: string[]
  activeMode: GroupMode
  groupCount: number | null
  groupSize: number | null
  leaders: boolean
}

interface PersistedPayload {
  names?: string[]
  namesInput?: string
  activeMode?: GroupMode
  groupCount?: number | null
  groupSize?: number | null
  leaders?: boolean
  groups?: GroupResult[]
}

const STORAGE_KEYS = {
  saves: 'arbetsgrupper:saves',
  last: 'arbetsgrupper:last',
}

const GROUP_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10]
const GROUP_SIZES = [2, 3, 4, 5, 6, 7]

export function GroupsWindow() {
  const classLists = useBoardStore((state) => state.classLists)
  const activeStudents = useMemo(() => getActiveStudents({ classLists }), [classLists])
  const resultsRef = useRef<HTMLDivElement>(null)
  const [initialSession] = useState<PersistedPayload>(() => loadLastSession() ?? {})
  const [initialSaves] = useState(() => loadSavedLists())
  const derivedNamesInput =
    initialSession.namesInput ??
    (initialSession.names?.length ? initialSession.names.join('\n') : activeStudents.join('\n'))

  const [namesInput, setNamesInput] = useState(derivedNamesInput)
  const [names, setNames] = useState<string[]>(initialSession.names ?? parseNames(derivedNamesInput))
  const [activeMode, setActiveMode] = useState<GroupMode>(initialSession.activeMode ?? null)
  const [groupCount, setGroupCount] = useState<number | null>(initialSession.groupCount ?? null)
  const [groupSize, setGroupSize] = useState<number | null>(initialSession.groupSize ?? null)
  const [leaders, setLeaders] = useState(Boolean(initialSession.leaders))
  const [groups, setGroups] = useState<GroupResult[]>(initialSession.groups ?? [])
  const [activeStep, setActiveStep] = useState<StepId>((initialSession.groups?.length ?? 0) ? 'results' : 'names')
  const [saves, setSaves] = useState<Record<string, GroupSavePayload>>(initialSaves)
  const [saveName, setSaveName] = useState('')
  const [selectedSave, setSelectedSave] = useState(() => {
    const keys = Object.keys(initialSaves).sort((a, b) => a.localeCompare(b))
    return keys[0] ?? ''
  })
  const [hintVisible, setHintVisible] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')

  const participantCount = useMemo(() => parseNames(namesInput).length, [namesInput])
  const saveOptions = useMemo(() => Object.keys(saves).sort((a, b) => a.localeCompare(b)), [saves])
  const configurationReady =
    participantCount >= 2 &&
    !!activeMode &&
    ((activeMode === 'groups' && groupCount) || (activeMode === 'size' && groupSize))
  const setupHelper = (() => {
    if (activeMode === 'groups') {
      return groupCount ? `${groupCount} grupper` : 'Välj antal grupper'
    }
    if (activeMode === 'size') {
      return groupSize ? `${groupSize} per grupp` : 'Välj gruppstorlek'
    }
    return 'Välj strategi'
  })()
  const stepMeta: { id: StepId; label: string; helper: string }[] = [
    { id: 'names', label: 'Namn', helper: participantCount ? `${participantCount} elever` : 'Lägg till namn' },
    { id: 'setup', label: 'Strategi', helper: setupHelper },
    { id: 'results', label: 'Resultat', helper: groups.length ? `${groups.length} grupper` : 'Skapa grupper' },
  ]

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.saves, JSON.stringify(saves))
    } catch (error) {
      console.warn('Kunde inte spara listor', error)
    }
  }, [saves])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const payload: PersistedPayload = {
      names,
      namesInput,
      activeMode,
      groupCount,
      groupSize,
      leaders,
      groups,
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.last, JSON.stringify(payload))
    } catch (error) {
      console.warn('Kunde inte spara session', error)
    }
  }, [names, namesInput, activeMode, groupCount, groupSize, leaders, groups])

  const handleImportClass = () => {
    if (!activeStudents.length) {
      setStatusMessage('Ingen aktiv klasslista att hämta.')
      return
    }
    setNamesInput(activeStudents.join('\n'))
    setHintVisible(false)
    setStatusMessage('Aktiv klasslista inläst.')
  }

  const handleModeSelect = (mode: GroupMode) => {
    setActiveMode(mode)
    setStatusMessage('')
    if (mode === 'groups') {
      setGroupSize(null)
    } else if (mode === 'size') {
      setGroupCount(null)
    }
  }

  const handleGenerate = () => {
    const parsed = parseNames(namesInput)
    setNames(parsed)
    if (parsed.length < 2) {
      setHintVisible(true)
      setStatusMessage('Minst två elever krävs för att skapa grupper.')
      return
    }
    if (!activeMode) {
      setStatusMessage('Välj ett läge: antal grupper eller gruppstorlek.')
      return
    }
    if (activeMode === 'groups' && !groupCount) {
      setStatusMessage('Välj hur många grupper du vill skapa.')
      return
    }
    if (activeMode === 'size' && !groupSize) {
      setStatusMessage('Välj vilken storlek grupperna ska ha.')
      return
    }

    setHintVisible(false)
    setStatusMessage('')
    const generated = buildGroups(parsed, activeMode, { groupCount, groupSize }, leaders)
    setGroups(generated)
    setActiveStep('results')
  }

  const handleReshuffle = () => {
    const base = names.length ? names : parseNames(namesInput)
    if (!base.length) {
      setStatusMessage('Lägg till namn innan du blandar.')
      return
    }
    if (!activeMode || (activeMode === 'groups' && !groupCount) || (activeMode === 'size' && !groupSize)) {
      setStatusMessage('Komplettera inställningarna innan du blandar.')
      return
    }
    setStatusMessage('')
    const generated = buildGroups(base, activeMode, { groupCount, groupSize }, leaders)
    setGroups(generated)
    setActiveStep('results')
  }

  const handleCopy = async () => {
    if (!groups.length) {
      return
    }
    try {
      await navigator.clipboard.writeText(formatGroupResults(groups))
      setCopyFeedback('Kopierat!')
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch (error) {
      console.warn('Clipboard error', error)
      setCopyFeedback('Kunde inte kopiera')
    }
  }

  const handleSave = () => {
    const key = saveName.trim()
    if (!key) {
      setStatusMessage('Ge din lista ett namn innan du sparar.')
      return
    }
    const payload: GroupSavePayload = {
      names: parseNames(namesInput),
      activeMode,
      groupCount,
      groupSize,
      leaders,
    }
    setSaves((prev) => ({ ...prev, [key]: payload }))
    setSelectedSave(key)
    setSaveName('')
    setStatusMessage(`Sparade listan "${key}".`)
  }

  const handleLoad = () => {
    if (!selectedSave) {
      return
    }
    const payload = saves[selectedSave]
    if (!payload) {
      return
    }
    setNamesInput((payload.names ?? []).join('\n'))
    setNames(payload.names ?? [])
    setActiveMode(payload.activeMode ?? null)
    setGroupCount(payload.groupCount ?? null)
    setGroupSize(payload.groupSize ?? null)
    setLeaders(Boolean(payload.leaders))
    setGroups([])
    setActiveStep('names')
    setHintVisible(false)
    setStatusMessage(`Laddade ${selectedSave}.`)
  }

  const handleDelete = () => {
    if (!selectedSave) {
      return
    }
    setSaves((prev) => {
      const next = { ...prev }
      delete next[selectedSave]
      return next
    })
    setSelectedSave('')
    setStatusMessage('Listan togs bort.')
  }

  const handleExportCSV = () => {
    if (!groups.length) {
      return
    }
    const csv = groupsToCSV(groups)
    downloadFile(`grupper-${timestamp()}.csv`, 'text/csv;charset=utf-8', csv)
  }

  const handleExportPDF = async () => {
    if (!groups.length || !resultsRef.current) {
      return
    }
    try {
      const canvas = await html2canvas(resultsRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
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
      pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight)
      pdf.save(`arbetsgrupper-${timestamp()}.pdf`)
      setStatusMessage('PDF sparad.')
    } catch (error) {
      console.warn('Kunde inte skapa PDF', error)
      setStatusMessage('PDF-exporten misslyckades.')
    }
  }

  const renderNamesStep = () => (
    <div className="groups-editor">
      <section className="panel-card names-panel">
        <header>
          <p className="eyebrow">Deltagare</p>
          <h3>Klistra in namn (ett per rad)</h3>
        </header>
        <textarea
          value={namesInput}
          onChange={(event) => {
            setNamesInput(event.target.value)
            setHintVisible(false)
            setStatusMessage('')
          }}
          placeholder={'Aino\nBilal\nCarla'}
        />
        <div className="names-meta">
          <span>{participantCount} elever</span>
          {hintVisible && <span className="hint warning">Minst två namn behövs.</span>}
        </div>
        <div className="names-actions">
          <button type="button" onClick={handleImportClass} className="ghost-btn">
            Hämta aktiv klasslista
          </button>
        </div>
      </section>

      <section className="panel-card save-panel">
        <header>
          <p className="eyebrow">Sparade listor</p>
          <h3>Återanvänd grupperingar</h3>
        </header>
        <div className="save-grid">
          <div className="save-row">
            <input
              type="text"
              value={saveName}
              placeholder="Namn på listan"
              onChange={(event) => setSaveName(event.target.value)}
            />
            <button type="button" onClick={handleSave}>
              Spara
            </button>
          </div>
          <div className="save-row">
            <select value={selectedSave} onChange={(event) => setSelectedSave(event.target.value)}>
              <option value="">Välj sparad lista</option>
              {saveOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleLoad} disabled={!selectedSave}>
              Ladda
            </button>
            <button type="button" onClick={handleDelete} disabled={!selectedSave}>
              Ta bort
            </button>
          </div>
        </div>
      </section>

      <div className="step-footer">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setActiveStep('results')}
          disabled={!groups.length}
        >
          Visa resultat
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => setActiveStep('setup')}
          disabled={participantCount < 2}
        >
          Nästa: Strategi
        </button>
      </div>
    </div>
  )

  const renderSetupStep = () => (
    <div className="setup-step">
      <section className="panel-card mode-panel">
        <header>
          <p className="eyebrow">Strategi</p>
          <h3>Välj hur grupperna byggs</h3>
        </header>
        <div className="mode-grid">
          <article
            className="choice-card"
            data-active={activeMode === 'groups'}
            onClick={() => handleModeSelect('groups')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleModeSelect('groups')
              }
            }}
          >
            <div>
              <h4>Antal grupper</h4>
              <p>Jämn fördelning där du styr hur många lag som behövs.</p>
            </div>
            <div className="choice-options">
              {GROUP_COUNTS.map((count) => (
                <button
                  type="button"
                  key={`count-${count}`}
                  className={count === groupCount && activeMode === 'groups' ? 'choice-chip active' : 'choice-chip'}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleModeSelect('groups')
                    setGroupCount(count)
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </article>
          <article
            className="choice-card"
            data-active={activeMode === 'size'}
            onClick={() => handleModeSelect('size')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleModeSelect('size')
              }
            }}
          >
            <div>
              <h4>Gruppstorlek</h4>
              <p>Automatisk balans där du bara anger hur stora grupperna ska vara.</p>
            </div>
            <div className="choice-options">
              {GROUP_SIZES.map((size) => (
                <button
                  type="button"
                  key={`size-${size}`}
                  className={size === groupSize && activeMode === 'size' ? 'choice-chip active' : 'choice-chip'}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleModeSelect('size')
                    setGroupSize(size)
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </article>
          <article className="choice-card" data-active={leaders}>
            <div>
              <h4>Gruppledare</h4>
              <p>Första personen i varje grupp markeras som ansvarig.</p>
            </div>
            <button type="button" className={leaders ? 'choice-chip active' : 'choice-chip'} onClick={() => setLeaders((prev) => !prev)}>
              {leaders ? 'På' : 'Av'}
            </button>
          </article>
        </div>
      </section>
      <div className="step-footer">
        <button type="button" className="ghost-btn" onClick={() => setActiveStep('names')}>
          Tillbaka
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => setActiveStep('results')}
          disabled={!groups.length}
        >
          Gå till resultat
        </button>
      </div>
    </div>
  )

  const renderResultsStep = () => (
    <div className="groups-results">
      <div className="results-header">
        <div>
          <p className="eyebrow">Arbetsgrupper</p>
          <h3>
            {groups.length} grupper · {names.length || participantCount} elever
          </h3>
          <p className="micro-copy">Slumpad uppställning baserad på senaste inmatningen.</p>
        </div>
        <button type="button" className="ghost-btn projector-hide" onClick={() => setActiveStep('setup')}>
          Justera strategi
        </button>
      </div>
      {copyFeedback && <p className="micro-copy">{copyFeedback}</p>}
      <div className="results-grid" ref={resultsRef}>
        {groups.length === 0 && <p>Skapa grupper för att visa resultat här.</p>}
        {groups.map((group, index) => (
          <article key={`result-${index}`} className="result-card">
            <header>
              <span className="eyebrow">Grupp {index + 1}</span>
              {group.leader && <span className="leader-pill">Ansvarig</span>}
            </header>
            <ul>
              {group.leader && <li className="leader-row">{group.leader}</li>}
              {group.members.map((member) => (
                <li key={member}>{member}</li>
              ))}
              {!group.leader && group.members.length === 0 && <li>(tom grupp)</li>}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )

  const steps: {id: string, label: string}[] = [{id:'names',label:'Namn'},{id:'setup',label:'Strategi'},{id:'results',label:'Resultat'}]

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'var(--font-sans)', overflow:'hidden' }}>

      {/* Steg-indikator */}
      <div style={{ display:'flex', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
        {steps.map((step, i) => {
          const stepOrder = ['names','setup','results'];
          const done = stepOrder.indexOf(activeStep) > i;
          const active = activeStep === steps[i].id;
          return (
            <div key={step.id} style={{ display:'flex', alignItems:'center', flex: i < steps.length-1 ? 1 : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  background: done||active ? 'var(--accent)' : 'var(--surface-secondary)',
                  border: done||active ? 'none' : '1.5px solid var(--border-medium)',
                  fontSize:11, fontWeight:700, color: done||active ? '#fff' : 'var(--text-tertiary)', flexShrink:0,
                }}>
                  {done ? '✓' : i+1}
                </div>
                <span style={{ fontSize:13, fontWeight:active?600:400, color:active?'var(--text-primary)':done?'var(--accent)':'var(--text-tertiary)', whiteSpace:'nowrap' }}>
                  {step}
                </span>
              </div>
              {i < steps.length-1 && <div style={{ flex:1, height:1, background:done?'var(--accent)':'var(--border-subtle)', margin:'0 10px' }} />}
            </div>
          );
        })}
      </div>

      {/* Innehåll */}
      <div style={{ flex:1, overflow:'auto', padding:'20px 24px' }}>

        {/* STEG 1: Namn */}
        {activeStep === 'names' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:8 }}>Deltagare</div>
              <textarea value={namesInput} onChange={e => setNamesInput(e.target.value)}
                placeholder="Klistra in namn, ett per rad…" rows={8}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:13, color:'var(--text-primary)', fontFamily:'var(--font-sans)', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.7, display:'block' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
                <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>
                  {names.length > 0 ? names.length+' deltagare' : 'Inga namn ännu'}
                </span>
                <button type="button" onClick={handleImportClass}
                  style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  Hämta aktiv klass
                </button>
              </div>
            </div>
            <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:16 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:10 }}>Sparade listor</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                  placeholder="Namnge listan"
                  style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-sans)', outline:'none', boxSizing:'border-box' }} />
                <button type="button" onClick={handleSave}
                  style={{ padding:'7px 16px', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  Spara
                </button>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <select value={selectedSave} onChange={e => setSelectedSave(e.target.value)}
                  style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border-medium)', background:'var(--surface-secondary)', fontSize:12, color:selectedSave?'var(--text-primary)':'var(--text-tertiary)', fontFamily:'var(--font-sans)', outline:'none', appearance:'none', cursor:'pointer', boxSizing:'border-box' }}>
                  <option value="">Välj sparad lista…</option>
                  {Object.keys(saves).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <button type="button" onClick={handleLoad}
                  style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  Ladda
                </button>
                <button type="button" onClick={handleDelete}
                  style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid rgba(180,60,50,0.3)', background:'transparent', fontSize:12, color:'#B43C32', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  Ta bort
                </button>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:4 }}>
              <button type="button" onClick={() => setActiveStep('setup')} disabled={names.length < 2}
                style={{ padding:'9px 20px', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:14, fontWeight:600, cursor:names.length<2?'default':'pointer', opacity:names.length<2?0.4:1, fontFamily:'var(--font-sans)' }}>
                Nästa: Strategi →
              </button>
            </div>
          </div>
        )}

        {/* STEG 2: Strategi */}
        {activeStep === 'setup' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:420 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:12 }}>Hur vill du dela upp?</div>
              {(['count','size'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => handleModeSelect(mode)}
                  style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:activeMode===mode?'2px solid var(--accent)':'1.5px solid var(--border-medium)', background:activeMode===mode?'rgba(45,92,69,0.06)':'var(--surface-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:activeMode===mode?'var(--accent)':'var(--text-primary)' }}>
                      {mode==='count' ? 'Antal grupper' : 'Storlek per grupp'}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>
                      {mode==='count' ? 'Dela '+names.length+' elever i X grupper' : 'Varje grupp har X elever'}
                    </div>
                  </div>
                  {activeMode===mode && <span style={{ color:'var(--accent)', fontSize:18, fontWeight:700 }}>✓</span>}
                </button>
              ))}
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-tertiary)', marginBottom:10 }}>
                {activeMode==='count' ? 'Antal grupper' : 'Elever per grupp'}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <input type="range" min={2} max={Math.floor(names.length/2)}
                  value={activeMode==='count'?groupCount:groupSize}
                  onChange={e => activeMode==='count'?setGroupCount(Number(e.target.value)):setGroupSize(Number(e.target.value))}
                  style={{ flex:1, accentColor:'var(--accent)' }} />
                <div style={{ fontSize:32, fontWeight:700, color:'var(--accent)', minWidth:40, textAlign:'center', letterSpacing:'-0.02em' }}>
                  {activeMode==='count'?groupCount:groupSize}
                </div>
              </div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4, textAlign:'center' }}>
                {activeMode==='count'
                  ? 'Ca '+Math.ceil(names.length/groupCount)+' elever per grupp'
                  : 'Ca '+Math.ceil(names.length/groupSize)+' grupper totalt'}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
              onClick={() => setLeaders(v => !v)}>
              <div style={{ width:34, height:20, borderRadius:10, background:leaders?'var(--accent)':'var(--border-medium)', position:'relative', transition:'background 200ms', flexShrink:0 }}>
                <div style={{ position:'absolute', width:14, height:14, borderRadius:'50%', background:'#fff', top:3, left:leaders?17:3, transition:'left 200ms', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize:13, color:'var(--text-secondary)', userSelect:'none' }}>Utse gruppledare</span>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'space-between' }}>
              <button type="button" onClick={() => setActiveStep('names')}
                style={{ padding:'8px 16px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:13, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                ← Tillbaka
              </button>
              <button type="button" onClick={handleGenerate}
                style={{ padding:'9px 24px', borderRadius:20, border:'none', background:'var(--accent)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                Skapa grupper
              </button>
            </div>
          </div>
        )}

        {/* STEG 3: Resultat */}
        {activeStep === 'results' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)' }}>
                {groups.length} grupper · {names.length} elever
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[{label:'Slumpa igen',fn:handleReshuffle},{label:copyFeedback||'Kopiera',fn:handleCopy},{label:'CSV',fn:handleExportCSV},{label:'PDF',fn:handleExportPDF}].map(({label,fn})=>(
                  <button key={label} type="button" onClick={fn}
                    style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:12, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:10 }}>
              {groups.map((group: any, gi: number) => (
                <div key={gi} style={{ borderRadius:12, border:'1.5px solid var(--border-subtle)', background:'var(--surface-secondary)', overflow:'hidden' }}>
                  <div style={{ padding:'8px 12px', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.06em' }}>Grupp {gi+1}</span>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>{group.members?.length||0} st</span>
                  </div>
                  <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:3 }}>
                    {group.members?.map((m: string, mi: number) => (
                      <div key={mi} style={{ fontSize:13, color:mi===0&&group.leader?'var(--accent)':'var(--text-primary)', fontWeight:mi===0&&group.leader?600:400, display:'flex', alignItems:'center', gap:5 }}>
                        {mi===0&&group.leader&&<span style={{ fontSize:10 }}>★</span>}
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {statusMessage && <div style={{ fontSize:12, color:'var(--accent)', fontWeight:500, textAlign:'center' }}>{statusMessage}</div>}
            <div style={{ display:'flex', gap:10, justifyContent:'space-between' }}>
              <button type="button" onClick={() => setActiveStep('setup')}
                style={{ padding:'8px 16px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:13, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                ← Strategi
              </button>
              <button type="button" onClick={() => setActiveStep('names')}
                style={{ padding:'8px 16px', borderRadius:20, border:'1.5px solid var(--border-medium)', background:'transparent', fontSize:13, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                Börja om
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



function parseNames(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
}

function buildGroups(
  students: string[],
  mode: GroupMode,
  { groupCount, groupSize }: { groupCount: number | null; groupSize: number | null },
  leaders: boolean,
): GroupResult[] {
  if (!mode) {
    return []
  }
  const pool = shuffleList(students)
  let buckets: string[][] = []
  if (mode === 'groups' && groupCount) {
    buckets = distributeByCount(pool, groupCount)
  } else if (mode === 'size' && groupSize) {
    buckets = distributeBySize(pool, groupSize)
  }
  return buckets
    .filter((bucket) => bucket.length)
    .map((bucket) =>
      leaders
        ? { leader: bucket[0] ?? null, members: bucket.slice(1) }
        : { leader: null, members: bucket.slice() },
    )
}

function distributeByCount(students: string[], count: number): string[][] {
  const sanitized = Math.max(1, count)
  const groups: string[][] = Array.from({ length: sanitized }, () => [])
  students.forEach((student, index) => {
    groups[index % sanitized].push(student)
  })
  return groups
}

function distributeBySize(students: string[], size: number): string[][] {
  const sanitized = Math.max(1, size | 0)
  const total = students.length
  let groupTotal = Math.ceil(total / sanitized)
  const remainder = total % sanitized
  if (remainder === 1 && groupTotal > 1) {
    // Undvik en ensam elev i sista gruppen genom att minska antalet grupper.
    groupTotal -= 1
  }
  const groups: string[][] = Array.from({ length: Math.max(1, groupTotal) }, () => [])
  students.forEach((student, index) => {
    groups[index % groups.length].push(student)
  })
  return groups
}

function formatGroupResults(groups: GroupResult[]): string {
  return groups
    .map((group, index) => {
      const header = `Grupp ${index + 1}`
      const members = [group.leader, ...group.members].filter(Boolean).join(', ')
      return `${header}: ${members}`
    })
    .join('\n')
}

function groupsToCSV(groups: GroupResult[]): string {
  const rows = [['Grupp', 'Roll', 'Namn']]
  groups.forEach((group, index) => {
    const label = `Grupp ${index + 1}`
    if (group.leader) {
      rows.push([label, 'Ansvarig', group.leader])
    }
    group.members.forEach((member) => {
      rows.push([label, 'Medlem', member])
    })
  })
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function timestamp() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}-${hh}${min}`
}

function loadSavedLists(): Record<string, GroupSavePayload> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.saves)
    return raw ? (JSON.parse(raw) as Record<string, GroupSavePayload>) : {}
  } catch (error) {
    console.warn('Kunde inte läsa sparade listor', error)
    return {}
  }
}

function loadLastSession(): PersistedPayload | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.last)
    return raw ? (JSON.parse(raw) as PersistedPayload) : null
  } catch (error) {
    console.warn('Kunde inte läsa sessionen', error)
    return null
  }
}
