import { useMemo, useState } from 'react'
import type { AppActions, ClassListItem } from '../state/AppStateProvider.tsx'

interface ClassListManagerProps {
  lists: ClassListItem[]
  activeListId: string
  actions: AppActions['classLists']
}

export function ClassListManager({ lists, activeListId, actions }: ClassListManagerProps) {
  const activeList = useMemo(
    () => lists.find((item) => item.id === activeListId) ?? lists[0],
    [lists, activeListId],
  )

  const [draftId, setDraftId] = useState<string | undefined>(activeList?.id)
  const [name, setName] = useState(activeList?.name ?? 'Ny klass')
  const [body, setBody] = useState((activeList?.students ?? []).join('\n'))

  const hydrate = (list?: ClassListItem) => {
    setDraftId(list?.id)
    setName(list?.name ?? 'Ny klass')
    setBody((list?.students ?? []).join('\n'))
  }

  const saveList = () => {
    if (!name.trim()) {
      return
    }
    const entries = body.split('\n').map((line) => line.trim()).filter(Boolean)
    const clash = lists.find((list) => list.name === name && list.id !== draftId)
    if (clash) {
      const confirmed = window.confirm('En lista med samma namn finns redan. Vill du skriva över?')
      if (!confirmed) {
        return
      }
    }
    const next = actions.upsert({ id: draftId, name: name.trim(), students: entries })
    actions.setActive(next.id)
    hydrate(next)
  }

  const deleteList = () => {
    if (!draftId) {
      return
    }
    const confirmed = window.confirm('Ta bort listan permanent?')
    if (!confirmed) {
      return
    }
    actions.remove(draftId)
    if (lists.length > 1) {
      const fallback = lists.find((list) => list.id !== draftId)
      if (fallback) {
        actions.setActive(fallback.id)
        hydrate(fallback)
        return
      }
    }
    hydrate(undefined)
  }

  const startNew = () => {
    hydrate(undefined)
  }

  return (
    <div className="class-manager">
      <header>
        <p className="eyebrow">Klasslistor</p>
        <h2>Lokalt sparade listor</h2>
      </header>

      <div className="list-selector">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={list.id === activeListId ? 'active' : ''}
            onClick={() => {
              actions.setActive(list.id)
              hydrate(list)
            }}
          >
            {list.name}
            <span className="pill-helper micro-icon">{list.students.length} elever</span>
          </button>
        ))}
        <button type="button" onClick={startNew}>
          + Ny lista
        </button>
      </div>

      <label>
        Klassnamn
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <label className="instruction-field">
        Elever (en per rad)
        <textarea value={body} rows={8} onChange={(event) => setBody(event.target.value)} />
      </label>

      <div className="button-row">
        <button type="button" onClick={saveList}>
          Spara
        </button>
        <button type="button" onClick={deleteList} disabled={!draftId || lists.length === 0}>
          Ta bort
        </button>
      </div>
      <p className="micro-copy">
        Listorna sparas lokalt med versionshantering. Vid app-uppdateringar får du en tydlig
        varning innan något skrivs över.
      </p>
    </div>
  )
}
