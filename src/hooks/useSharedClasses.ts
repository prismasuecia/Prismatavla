import { useEffect, useMemo, useState, type SetStateAction } from 'react'
import { useBoardStore } from '../store/useBoardStore'

type SavedNames = { names: string[] }

export function useSharedClasses<T extends SavedNames>(legacy: Record<string, T>, defaults: T) {
  const classLists = useBoardStore((state) => state.classLists)
  const [metadata, setMetadata] = useState(legacy)
  useEffect(() => {
    const originalId = useBoardStore.getState().classLists.activeId
    for (const [name, payload] of Object.entries(legacy)) {
      const state = useBoardStore.getState()
      const same = state.classLists.lists.some((list) =>
        JSON.stringify(list.students) === JSON.stringify(payload.names) &&
        (list.name === name || list.name.startsWith(`${name} (importerad)`)))
      if (same || !payload.names.length) continue
      let importedName = name
      while (useBoardStore.getState().classLists.lists.some((list) => list.name === importedName)) {
        importedName += ' (importerad)'
      }
      state.actions.createClassList(importedName, payload.names)
    }
    if (originalId) useBoardStore.getState().actions.setActiveClass(originalId)
  }, [])

  const lists = useMemo(() => Object.fromEntries(classLists.lists.map((list) =>
    [list.name, { ...defaults, ...metadata[list.name], names: list.students }])), [classLists, metadata]) as Record<string, T>

  const setLists = (updater: SetStateAction<Record<string, T>>) => {
    const next = typeof updater === 'function' ? updater(lists) : updater
    setMetadata(next)
    for (const [name, payload] of Object.entries(next)) {
      const state = useBoardStore.getState()
      const existing = state.classLists.lists.find((list) => list.name === name)
      if (existing) {
        if (JSON.stringify(existing.students) !== JSON.stringify(payload.names)) state.actions.updateClassList(existing.id, payload.names)
      } else state.actions.createClassList(name, payload.names)
    }
    for (const name of Object.keys(lists)) {
      if (!(name in next)) {
        const state = useBoardStore.getState()
        const existing = state.classLists.lists.find((list) => list.name === name)
        if (existing) state.actions.removeClassList(existing.id)
      }
    }
  }
  return [lists, setLists] as const
}

export function activateSharedClass(name: string) {
  const state = useBoardStore.getState()
  const list = state.classLists.lists.find((item) => item.name === name)
  if (list) state.actions.setActiveClass(list.id)
}
