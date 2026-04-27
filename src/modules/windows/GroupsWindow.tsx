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

  return (
    <div className="groups-window">
      <div className="groups-toolbar projector-hide">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn primary"
            onClick={handleGenerate}
            disabled={!configurationReady}
          >
            Skapa grupper
          </button>
          <button type="button" className="toolbar-btn" onClick={handleReshuffle} disabled={!groups.length}>
            Slumpa igen
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" onClick={handleCopy} disabled={!groups.length}>
            Kopiera
          </button>
          <button type="button" className="toolbar-btn outline" onClick={handleExportCSV} disabled={!groups.length}>
            CSV
          </button>
          <button type="button" className="toolbar-btn outline" onClick={handleExportPDF} disabled={!groups.length}>
            PDF
          </button>
        </div>
      </div>

      <div className="groups-stepper projector-hide" role="tablist" aria-label="Steg för Arbetsgrupper">
        {stepMeta.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={activeStep === step.id ? 'step-button active' : 'step-button'}
            onClick={() => setActiveStep(step.id)}
            aria-current={activeStep === step.id ? 'step' : undefined}
          >
            <span className="step-index">{index + 1}</span>
            <span className="step-copy">
              <strong>{step.label}</strong>
              <small>{step.helper}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="groups-stage">
        {activeStep === 'names' && renderNamesStep()}
        {activeStep === 'setup' && renderSetupStep()}
        {activeStep === 'results' && renderResultsStep()}
      </div>

      {statusMessage && <p className="status-message global-status">{statusMessage}</p>}
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
