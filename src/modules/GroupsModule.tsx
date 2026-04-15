import clsx from 'clsx'
import type { AppActions, GroupState } from '../state/AppStateProvider.tsx'
import { chunkBySize, chunkIntoCount, formatGroups, shuffleList } from '../utils/array.ts'

interface GroupsModuleProps {
  students: string[]
  groups: GroupState
  actions: AppActions['groups']
}

export function GroupsModule({ students, groups, actions }: GroupsModuleProps) {
  const disabled = !students.length || groups.locked

  const handleGenerate = () => {
    const nextGroups = computeGroups(students, groups)
    actions.setGroups(nextGroups)
  }

  const handleShuffle = () => {
    if (!groups.groups.length) {
      handleGenerate()
      return
    }
    const flattened = groups.groups.flat()
    const shuffled = shuffleList(flattened)
    const next = groups.strategy === 'size'
      ? chunkBySize(shuffled, Math.max(2, groups.groupSize))
      : chunkIntoCount(shuffled, Math.max(2, groups.groupCount))
    actions.setGroups(next)
  }

  const handleCopy = async () => {
    if (!navigator.clipboard) {
      return
    }
    await navigator.clipboard.writeText(formatGroups(groups.groups))
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      return
    }
    const html = `<!doctype html><html><head><title>Arbetsgrupper</title><style>
      body { font-family: 'Space Grotesk', 'DM Sans', sans-serif; padding: 40px; }
      h1 { margin-bottom: 24px; }
      ul { list-style: none; padding: 0; columns: 2; }
      li { margin-bottom: 12px; }
    </style></head><body>
    <h1>Arbetsgrupper</h1>
    <ul>
      ${groups.groups
        .map(
          (group, index) => `<li><strong>Grupp ${index + 1}</strong><br/>${group.join(', ')}</li>`,
        )
        .join('')}
    </ul>
    </body></html>`
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="module groups-module">
      <header className="module-header">
        <div>
          <p className="eyebrow">Arbetsgrupper</p>
          <h2>Balansera energi</h2>
        </div>
        <div className="strategy-row">
          <label>
            <input
              type="radio"
              name="group-strategy"
              checked={groups.strategy === 'size'}
              onChange={() => actions.setStrategy('size')}
            />
            Gruppstorlek
          </label>
          <input
            type="number"
            min={2}
            max={8}
            value={groups.groupSize}
            onChange={(event) => actions.setGroupSize(Number(event.target.value))}
            disabled={groups.strategy !== 'size'}
          />
          <label>
            <input
              type="radio"
              name="group-strategy"
              checked={groups.strategy === 'count'}
              onChange={() => actions.setStrategy('count')}
            />
            Antal grupper
          </label>
          <input
            type="number"
            min={2}
            max={12}
            value={groups.groupCount}
            onChange={(event) => actions.setGroupCount(Number(event.target.value))}
            disabled={groups.strategy !== 'count'}
          />
        </div>
      </header>

      <div className="group-actions">
        <button type="button" disabled={!students.length || groups.locked} onClick={handleGenerate}>
          Skapa grupper
        </button>
        <button type="button" disabled={disabled} onClick={handleShuffle}>
          Slumpa om
        </button>
        <button type="button" onClick={() => actions.toggleLock()} className={clsx({ active: groups.locked })}>
          {groups.locked ? 'Lås upp' : 'Lås grupper'}
        </button>
        <button type="button" disabled={!groups.groups.length} onClick={handleCopy}>
          Kopiera
        </button>
        <button type="button" disabled={!groups.groups.length} onClick={handlePrint}>
          Utskriftsvy
        </button>
      </div>

      <div className="groups-grid">
        {groups.groups.length === 0 && <p>Skapa grupper från aktiv klasslista.</p>}
        {groups.groups.map((group, index) => (
          <article key={`group-${index}`} className="group-card">
            <header>
              <span>Grupp {index + 1}</span>
            </header>
            <ol>
              {group.map((student) => (
                <li key={student}>{student}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  )
}

function computeGroups(students: string[], groups: GroupState) {
  if (!students.length) {
    return []
  }
  const shuffled = shuffleList(students)
  if (groups.strategy === 'size') {
    return chunkBySize(shuffled, Math.max(2, groups.groupSize))
  }
  return chunkIntoCount(shuffled, Math.max(2, groups.groupCount))
}
