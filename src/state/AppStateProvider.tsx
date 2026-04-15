/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { shuffleList } from '../utils/array'

const APP_VERSION = '2026.02.24'
const STORAGE_KEY = 'prisma-tavla-state'

export type StageId = 'timer' | 'wheel' | 'turns' | 'groups'
export type ThemeId = 'aurora' | 'slate' | 'chalk'
export type TurnMode = 'random' | 'ordered'
export type TurnStatus = 'done' | 'skipped'

export interface TimerState {
  durationSec: number
  remainingSec: number
  isRunning: boolean
  label: string
}

export interface InstructionState {
  text: string
}

export interface ClassListItem {
  id: string
  name: string
  students: string[]
  updatedAt: number
}

interface ClassListState {
  lists: ClassListItem[]
  activeListId: string
}

export interface TimelinePhase {
  id: string
  name: string
  minutes: number
  targetStage: StageId
  done: boolean
}

interface TimelineState {
  phases: TimelinePhase[]
  activePhaseId?: string
  visible: boolean
}

interface TurnEvent {
  id: string
  name: string
  timestamp: number
  status: TurnStatus
}

export interface TurnState {
  mode: TurnMode
  queue: string[]
  completed: TurnEvent[]
  showTeacherLog: boolean
  perTimer: {
    enabled: boolean
    durationSec: number
    remainingSec: number
    isRunning: boolean
  }
}

export interface GroupState {
  strategy: 'size' | 'count'
  groupSize: number
  groupCount: number
  groups: string[][]
  locked: boolean
}

export interface UIState {
  theme: ThemeId
  projectorMode: boolean
  activeStage: StageId
}

export interface AppState {
  timer: TimerState
  instructions: InstructionState
  classLists: ClassListState
  timeline: TimelineState
  turns: TurnState
  groups: GroupState
  ui: UIState
}

interface ClassListInput {
  id?: string
  name: string
  students: string[]
}

interface TimelinePhaseInput {
  id?: string
  name: string
  minutes: number
  targetStage: StageId
}

export interface AppActions {
  ui: {
    setTheme: (theme: ThemeId) => void
    setStage: (stage: StageId) => void
    toggleProjector: () => void
  }
  timer: {
    setDuration: (seconds: number, label?: string, autoStart?: boolean) => void
    start: () => void
    pause: () => void
    reset: () => void
    tick: () => void
  }
  instructions: {
    setText: (text: string) => void
  }
  classLists: {
    upsert: (payload: ClassListInput) => ClassListItem
    remove: (id: string) => void
    setActive: (id: string) => void
  }
  timeline: {
    setVisible: (visible: boolean) => void
    setActivePhase: (id: string) => void
    toggleDone: (id: string) => void
    upsertPhase: (phase: TimelinePhaseInput) => void
    removePhase: (id: string) => void
    applyTemplate: (phases: TimelinePhaseInput[]) => void
  }
  turns: {
    setMode: (mode: TurnMode, students: string[]) => void
    syncWithStudents: (students: string[]) => void
    next: (status: TurnStatus) => void
    putLast: () => void
    undo: () => void
    end: () => void
    toggleTeacherLog: () => void
    togglePerTimer: () => void
    setPerTimerDuration: (seconds: number) => void
    restartPerTimer: () => void
    tickPerTimer: () => void
  }
  groups: {
    setStrategy: (strategy: 'size' | 'count') => void
    setGroupSize: (size: number) => void
    setGroupCount: (count: number) => void
    setGroups: (groups: string[][]) => void
    toggleLock: () => void
  }
}

interface AppContextValue {
  state: AppState
  actions: AppActions
  persistence: {
    warning?: string
    enabled: boolean
    confirm: () => void
  }
}

const AppStateContext = createContext<AppContextValue | null>(null)

const defaultStudents = [
  'Aino',
  'Bilal',
  'Carla',
  'David',
  'Emil',
  'Fatima',
  'Greta',
  'Hugo',
  'Ines',
  'Jamal',
  'Klara',
  'Leo',
]

const defaultTimeline: TimelinePhase[] = [
  { id: 'phase-1', name: 'Starta upp', minutes: 10, targetStage: 'timer', done: false },
  { id: 'phase-2', name: 'Tur i tur', minutes: 25, targetStage: 'wheel', done: false },
  { id: 'phase-3', name: 'Grupparbete', minutes: 40, targetStage: 'groups', done: false },
]

function createDefaultState(): AppState {
  const classId = cryptoId()
  return {
    timer: {
      durationSec: 900,
      remainingSec: 900,
      isRunning: false,
      label: '15 min',
    },
    instructions: {
      text: 'Välkommen! Starta lektionen med tydligt fokus och lugn ton.',
    },
    classLists: {
      lists: [
        {
          id: classId,
          name: 'Basgrupp',
          students: defaultStudents,
          updatedAt: Date.now(),
        },
      ],
      activeListId: classId,
    },
    timeline: {
      phases: defaultTimeline,
      activePhaseId: defaultTimeline[0]?.id,
      visible: true,
    },
    turns: {
      mode: 'random',
      queue: shuffleList(defaultStudents),
      completed: [],
      showTeacherLog: false,
      perTimer: {
        enabled: false,
        durationSec: 60,
        remainingSec: 60,
        isRunning: false,
      },
    },
    groups: {
      strategy: 'size',
      groupSize: 3,
      groupCount: 4,
      groups: [],
      locked: false,
    },
    ui: {
      theme: 'aurora',
      projectorMode: false,
      activeStage: 'timer',
    },
  }
}

interface StoredPayload {
  version: string
  state: AppState
}

function loadInitialState(): { initialState: AppState; warning?: string } {
  const fallback = createDefaultState()
  if (typeof window === 'undefined') {
    return { initialState: fallback }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { initialState: fallback }
    }

    const parsed = JSON.parse(raw) as StoredPayload
    const merged = mergeState(fallback, parsed.state)
    const warning = parsed.version === APP_VERSION ? undefined : parsed.version
    return { initialState: merged, warning }
  } catch (error) {
    console.warn('Failed to load saved data', error)
    return { initialState: fallback }
  }
}

function mergeState(base: AppState, stored: AppState): AppState {
  return {
    timer: { ...base.timer, ...stored.timer },
    instructions: { ...base.instructions, ...stored.instructions },
    classLists: stored.classLists?.lists?.length ? stored.classLists : base.classLists,
    timeline: {
      ...base.timeline,
      ...stored.timeline,
      phases: stored.timeline?.phases?.length ? stored.timeline.phases : base.timeline.phases,
    },
    turns: {
      ...base.turns,
      ...stored.turns,
      queue: stored.turns?.queue?.length ? stored.turns.queue : base.turns.queue,
      completed: stored.turns?.completed ?? [],
      perTimer: { ...base.turns.perTimer, ...stored.turns?.perTimer },
    },
    groups: {
      ...base.groups,
      ...stored.groups,
      groups: stored.groups?.groups ?? base.groups.groups,
    },
    ui: { ...base.ui, ...stored.ui },
  }
}

const cryptoId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 11)
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { initialState, warning } = useMemo(() => loadInitialState(), [])
  const [state, setState] = useState<AppState>(initialState)
  const [persistWarning, setPersistWarning] = useState<string | undefined>(warning)
  const [persistEnabled, setPersistEnabled] = useState<boolean>(!warning)

  const updateState = useCallback((recipe: (draft: Draft<AppState>) => void) => {
    setState((prev) => produce(prev, recipe))
  }, [])

  const confirmPersist = useCallback(() => {
    setPersistEnabled(true)
    setPersistWarning(undefined)
    if (typeof window !== 'undefined') {
      try {
        const payload: StoredPayload = { version: APP_VERSION, state }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch (error) {
        console.warn('Kunde inte spara data', error)
      }
    }
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined' || !persistEnabled) {
      return
    }
    try {
      const payload: StoredPayload = {
        version: APP_VERSION,
        state,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('Kunde inte spara data', error)
    }
  }, [state, persistEnabled])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    document.documentElement.dataset.theme = state.ui.theme
    document.documentElement.dataset.projector = state.ui.projectorMode ? 'on' : 'off'
  }, [state.ui.theme, state.ui.projectorMode])

  const actions = useMemo<AppActions>(() => ({
    ui: {
      setTheme: (theme) => updateState((draft) => {
        draft.ui.theme = theme
      }),
      setStage: (stage) => updateState((draft) => {
        draft.ui.activeStage = stage
      }),
      toggleProjector: () => updateState((draft) => {
        draft.ui.projectorMode = !draft.ui.projectorMode
      }),
    },
    timer: {
      setDuration: (seconds, label = formatDuration(seconds), autoStart = true) =>
        updateState((draft) => {
          draft.timer.durationSec = seconds
          draft.timer.remainingSec = seconds
          draft.timer.label = label
          draft.timer.isRunning = autoStart && seconds > 0
        }),
      start: () =>
        updateState((draft) => {
          if (draft.timer.remainingSec > 0) {
            draft.timer.isRunning = true
          }
        }),
      pause: () =>
        updateState((draft) => {
          draft.timer.isRunning = false
        }),
      reset: () =>
        updateState((draft) => {
          draft.timer.remainingSec = draft.timer.durationSec
          draft.timer.isRunning = false
        }),
      tick: () =>
        updateState((draft) => {
          if (!draft.timer.isRunning) {
            return
          }
          draft.timer.remainingSec = Math.max(0, draft.timer.remainingSec - 1)
          if (draft.timer.remainingSec === 0) {
            draft.timer.isRunning = false
          }
        }),
    },
    instructions: {
      setText: (text) => updateState((draft) => {
        draft.instructions.text = text
      }),
    },
    classLists: {
      upsert: (payload) => {
        let created: ClassListItem | undefined
        updateState((draft) => {
          const incoming = normalizeStudents(payload.students)
          if (payload.id) {
            const existing = draft.classLists.lists.find((item) => item.id === payload.id)
            if (existing) {
              existing.name = payload.name
              existing.students = incoming
              existing.updatedAt = Date.now()
              created = existing
              return
            }
          }
          const match = draft.classLists.lists.find((item) => item.name === payload.name)
          const id = payload.id ?? match?.id ?? cryptoId()
          const nextItem: ClassListItem = {
            id,
            name: payload.name,
            students: incoming,
            updatedAt: Date.now(),
          }
          if (match) {
            match.students = incoming
            match.updatedAt = Date.now()
            created = match
            draft.classLists.activeListId = match.id
          } else {
            draft.classLists.lists.push(nextItem)
            draft.classLists.activeListId = id
            created = nextItem
          }
        })
        return created as ClassListItem
      },
      remove: (id) =>
        updateState((draft) => {
          draft.classLists.lists = draft.classLists.lists.filter((item) => item.id !== id)
          if (draft.classLists.activeListId === id) {
            draft.classLists.activeListId = draft.classLists.lists[0]?.id || ''
          }
        }),
      setActive: (id) =>
        updateState((draft) => {
          draft.classLists.activeListId = id
        }),
    },
    timeline: {
      setVisible: (visible) =>
        updateState((draft) => {
          draft.timeline.visible = visible
        }),
      setActivePhase: (id) =>
        updateState((draft) => {
          draft.timeline.activePhaseId = id
          const phase = draft.timeline.phases.find((item) => item.id === id)
          if (phase) {
            draft.ui.activeStage = phase.targetStage
          }
        }),
      toggleDone: (id) =>
        updateState((draft) => {
          const phase = draft.timeline.phases.find((item) => item.id === id)
          if (phase) {
            phase.done = !phase.done
          }
        }),
      upsertPhase: (phase) =>
        updateState((draft) => {
          if (phase.id) {
            const match = draft.timeline.phases.find((item) => item.id === phase.id)
            if (match) {
              match.name = phase.name
              match.minutes = phase.minutes
              match.targetStage = phase.targetStage
              return
            }
          }
          draft.timeline.phases.push({
            id: cryptoId(),
            name: phase.name,
            minutes: phase.minutes,
            targetStage: phase.targetStage,
            done: false,
          })
        }),
      removePhase: (id) =>
        updateState((draft) => {
          draft.timeline.phases = draft.timeline.phases.filter((phase) => phase.id !== id)
          if (draft.timeline.activePhaseId === id) {
            draft.timeline.activePhaseId = draft.timeline.phases[0]?.id
          }
        }),
      applyTemplate: (phases) =>
        updateState((draft) => {
          draft.timeline.phases = phases.map((phase) => ({
            id: cryptoId(),
            name: phase.name,
            minutes: phase.minutes,
            targetStage: phase.targetStage,
            done: false,
          }))
          draft.timeline.activePhaseId = draft.timeline.phases[0]?.id
        }),
    },
    turns: {
      setMode: (mode, students) =>
        updateState((draft) => {
          draft.turns.mode = mode
          draft.turns.completed = []
          draft.turns.queue = buildQueue(students, mode)
        }),
      syncWithStudents: (students) =>
        updateState((draft) => {
          if (!students.length) {
            draft.turns.queue = []
            draft.turns.completed = []
            return
          }
          draft.turns.queue = buildQueue(students, draft.turns.mode)
          draft.turns.completed = []
        }),
      next: (status) =>
        updateState((draft) => {
          const current = draft.turns.queue.shift()
          if (!current) {
            return
          }
          draft.turns.completed.unshift({
            id: cryptoId(),
            name: current,
            timestamp: Date.now(),
            status,
          })
        }),
      putLast: () =>
        updateState((draft) => {
          const current = draft.turns.queue.shift()
          if (current) {
            draft.turns.queue.push(current)
          }
        }),
      undo: () =>
        updateState((draft) => {
          const event = draft.turns.completed.shift()
          if (event) {
            draft.turns.queue = [event.name, ...draft.turns.queue]
          }
        }),
      end: () =>
        updateState((draft) => {
          draft.turns.queue = []
          draft.turns.completed = []
          draft.turns.perTimer.isRunning = false
          draft.turns.perTimer.remainingSec = draft.turns.perTimer.durationSec
        }),
      toggleTeacherLog: () =>
        updateState((draft) => {
          draft.turns.showTeacherLog = !draft.turns.showTeacherLog
        }),
      togglePerTimer: () =>
        updateState((draft) => {
          draft.turns.perTimer.enabled = !draft.turns.perTimer.enabled
          draft.turns.perTimer.isRunning = draft.turns.perTimer.enabled
          draft.turns.perTimer.remainingSec = draft.turns.perTimer.durationSec
        }),
      setPerTimerDuration: (seconds) =>
        updateState((draft) => {
          draft.turns.perTimer.durationSec = seconds
          draft.turns.perTimer.remainingSec = seconds
        }),
      restartPerTimer: () =>
        updateState((draft) => {
          if (draft.turns.perTimer.enabled) {
            draft.turns.perTimer.remainingSec = draft.turns.perTimer.durationSec
            draft.turns.perTimer.isRunning = true
          }
        }),
      tickPerTimer: () =>
        updateState((draft) => {
          const timer = draft.turns.perTimer
          if (!timer.enabled || !timer.isRunning) {
            return
          }
          timer.remainingSec = Math.max(0, timer.remainingSec - 1)
          if (timer.remainingSec === 0) {
            timer.isRunning = false
          }
        }),
    },
    groups: {
      setStrategy: (strategy) =>
        updateState((draft) => {
          draft.groups.strategy = strategy
        }),
      setGroupSize: (size) =>
        updateState((draft) => {
          draft.groups.groupSize = size
        }),
      setGroupCount: (count) =>
        updateState((draft) => {
          draft.groups.groupCount = count
        }),
      setGroups: (groups) =>
        updateState((draft) => {
          draft.groups.groups = groups
        }),
      toggleLock: () =>
        updateState((draft) => {
          draft.groups.locked = !draft.groups.locked
        }),
    },
  }), [updateState])

  const contextValue = useMemo<AppContextValue>(
    () => ({
      state,
      actions,
      persistence: {
        warning: persistWarning,
        enabled: persistEnabled,
        confirm: confirmPersist,
      },
    }),
    [state, actions, persistWarning, persistEnabled, confirmPersist],
  )

  return <AppStateContext.Provider value={contextValue}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState must be used inside AppStateProvider')
  }
  return ctx
}

function buildQueue(students: string[], mode: TurnMode) {
  if (!students.length) {
    return []
  }
  const clean = normalizeStudents(students)
  if (mode === 'ordered') {
    return clean
  }
  return shuffleList(clean)
}

function normalizeStudents(students: string[]) {
  const trimmed = students
    .map((name) => name.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(trimmed))
  return unique
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds % 60 === 0) {
    return `${Math.round(totalSeconds / 60)} min`
  }
  return `${Math.floor(totalSeconds / 60)}:${`${totalSeconds % 60}`.padStart(2, '0')}`
}
