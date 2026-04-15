import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ModuleId } from '../modules/moduleTypes'
import type { LayoutType, Seat, SeatAssignment, SeatingPlan } from '../lib/seatingLayouts'
import { generateLayout, LAYOUT_LABELS } from '../lib/seatingLayouts'

export type { LayoutType, Seat, SeatAssignment, SeatingPlan } from '../lib/seatingLayouts'

export type ThemeId = 'aurora' | 'skiffer' | 'krita'

export type TrafficNorm = 'tyst' | 'viska' | 'prata'
export type TurnMode = 'random' | 'ordered'
export type TurnStatus = 'done' | 'skipped'

export interface ModuleWindowLayout {
  moduleId: ModuleId
  position: { x: number; y: number }
  size: { width: number; height: number }
  minimized: boolean
  fullscreen: boolean
  zIndex: number
  lastActive: number
}

export interface ModuleWindowsState {
  openModuleIds: ModuleId[]
  windowsById: Partial<Record<ModuleId, ModuleWindowLayout>>
  activeModuleId?: ModuleId
  zCounter: number
}

interface TimerState {
  durationMs: number
  remainingMs: number
  isRunning: boolean
  targetAt?: number
  lastUpdated: number
}

interface InstructionState {
  text: string
  locked: boolean
}

export interface ClassListItem {
  id: string
  name: string
  students: string[]
  updatedAt: number
}

interface ClassListState {
  lists: ClassListItem[]
  activeId?: string
}

interface TurnEvent {
  id: string
  name: string
  status: TurnStatus
  timestamp: number
}

interface TurnState {
  mode: TurnMode
  queue: string[]
  completed: TurnEvent[]
  lastUpdated: number
}

export type TimerWarningMode = 'off' | 'tenPercent' | 'twoMinutes'
export type TimerEndSignal = 'visual' | 'tone'

interface TimerPreferences {
  showTime: boolean
  warningMode: TimerWarningMode
  endSignal: TimerEndSignal
}

interface GroupState {
  groupSize: number
  groups: string[][]
  locked: boolean
}

interface RandomizerState {
  lastPick?: string
  timestamp?: number
}

export interface LessonPhase {
  id: string
  name: string
  minutes: number
  targetModuleId: ModuleId
  done: boolean
}

interface LessonPlanState {
  phases: LessonPhase[]
  activePhaseId?: string
  showProgress: boolean
}

interface LessonPhasePatch {
  name?: string
  minutes?: number
  targetModuleId?: ModuleId
}

interface SeatingState {
  seatingPlansByClassId: Record<string, Record<string, SeatingPlan>>
  activeSeatingPlanIdByClassId: Record<string, string | null>
}

interface LegacySeatingSeat {
  id: string
  label: string
  row: number
  column: number
  student?: string
}

interface LegacySeatingState {
  rows: number
  columns: number
  seats: LegacySeatingSeat[]
  lastUpdated: number
}

export interface ExitTicketOption {
  id: string
  label: string
  description?: string
  count: number
}

export interface ExitTicketState {
  question: string
  options: ExitTicketOption[]
  totalResponses: number
  lastSharedAt?: number
}

export type SoundMeterStatus = 'idle' | 'listening' | 'denied' | 'unsupported'

export interface SoundMeterState {
  enabled: boolean
  level: number
  peakLevel: number
  sensitivity: number
  status: SoundMeterStatus
  message: string | null
  lastUpdated: number
}

export interface ModulePositionPayload {
  moduleId: ModuleId
  position: { x: number; y: number }
}

export interface ModuleSizePayload {
  moduleId: ModuleId
  size: { width: number; height: number }
}

const STORAGE_KEY = 'prisma_tavla_v2'
const STORAGE_VERSION = 13

const MIN_MODULE_WIDTH = 360
const MIN_MODULE_HEIGHT = 280

const toMilliseconds = (seconds: number) => Math.max(0, Math.round(seconds * 1000))

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

export const DEFAULT_SIZES: Record<ModuleId, { width: number; height: number }> = {
  background: { width: 560, height: 460 },
  timer: { width: 400, height: 420 },
  turntaking: { width: 760, height: 580 },
  groups: { width: 680, height: 740 },
  instructioncards: { width: 480, height: 520 },
  trafficlight: { width: 380, height: 340 },
  randomizer: { width: 380, height: 360 },
  clock: { width: 360, height: 320 },
  seating: { width: 600, height: 560 },
  lessonplan: { width: 540, height: 520 },
  exitticket: { width: 420, height: 420 },
  soundmeter: { width: 420, height: 360 },
}

const DEFAULT_TIMER_PREFERENCES: TimerPreferences = {
  showTime: true,
  warningMode: 'tenPercent',
  endSignal: 'visual',
}

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
}

const resolveStorage = () => (typeof window === 'undefined' ? noopStorage : window.localStorage)
const MAX_OPEN_MODULES = 3
const FALLBACK_VIEWPORT = { width: 1280, height: 720 }

const DEFAULT_POSITIONS: Record<ModuleId, { x: number; y: number }> = {
  background: { x: 72, y: 72 },
  timer: { x: 96, y: 120 },
  turntaking: { x: 420, y: 120 },
  groups: { x: 220, y: 240 },
  instructioncards: { x: 640, y: 120 },
  trafficlight: { x: 900, y: 80 },
  randomizer: { x: 860, y: 320 },
  clock: { x: 72, y: 360 },
  seating: { x: 520, y: 320 },
  lessonplan: { x: 320, y: 120 },
  exitticket: { x: 820, y: 260 },
  soundmeter: { x: 880, y: 420 },
}

interface LessonPhaseBlueprint {
  name: string
  minutes: number
  targetModuleId: ModuleId
}

const DEFAULT_LESSON_PLAN_BLUEPRINT: LessonPhaseBlueprint[] = [
  { name: 'Starta upp', minutes: 10, targetModuleId: 'timer' },
  { name: 'Tur i tur', minutes: 25, targetModuleId: 'turntaking' },
  { name: 'Grupparbete', minutes: 40, targetModuleId: 'groups' },
]

const LESSON_PLAN_TEMPLATE_75: LessonPhaseBlueprint[] = [
  { name: 'Start 5 min', minutes: 5, targetModuleId: 'timer' },
  { name: 'Mini-genomgång', minutes: 10, targetModuleId: 'instructioncards' },
  { name: 'Tur i tur', minutes: 15, targetModuleId: 'turntaking' },
  { name: 'Grupparbete', minutes: 30, targetModuleId: 'groups' },
  { name: 'Avslut', minutes: 15, targetModuleId: 'timer' },
]


const createExitTicketOption = (label: string, description?: string): ExitTicketOption => ({
  id: makeId(),
  label,
  description,
  count: 0,
})

const DEFAULT_EXIT_TICKET_QUESTION = 'Hur redo känner du dig inför nästa steg?'

const DEFAULT_EXIT_TICKET_OPTIONS = [
  createExitTicketOption('Trygg', 'Kan förklara för andra'),
  createExitTicketOption('Osäker', 'Behöver ett exempel till'),
  createExitTicketOption('Behöver hjälp', 'Förstår inte ännu'),
]

const DEFAULT_SOUND_METER_SENSITIVITY = 0.65

const clampSize = (size: { width: number; height: number }) => {
  const width = Math.max(MIN_MODULE_WIDTH, Math.round(size.width))
  const height = Math.max(MIN_MODULE_HEIGHT, Math.round(size.height))

  if (typeof window === 'undefined') {
    return { width, height }
  }

  const maxWidth = Math.max(MIN_MODULE_WIDTH, Math.floor(window.innerWidth * 0.9))
  const maxHeight = Math.max(MIN_MODULE_HEIGHT, Math.floor(window.innerHeight * 0.9))

  return {
    width: Math.min(width, maxWidth),
    height: Math.min(height, maxHeight),
  }
}

const clampPosition = (position: { x: number; y: number }, size?: { width: number; height: number }) => {
  if (typeof window === 'undefined') return position
  const moduleWidth = size?.width ?? MIN_MODULE_WIDTH
  const moduleHeight = size?.height ?? MIN_MODULE_HEIGHT
  const maxX = window.innerWidth - moduleWidth - 24
  const maxY = window.innerHeight - moduleHeight - 24
  return {
    x: Math.min(Math.max(24, position.x), Math.max(24, maxX)),
    y: Math.min(Math.max(24, position.y), Math.max(24, maxY)),
  }
}

const clampLessonMinutes = (minutes?: number) => {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) {
    return 5
  }
  return Math.min(180, Math.max(1, Math.round(minutes)))
}

const clampSeatingColumns = (columns?: number) => {
  if (typeof columns !== 'number' || Number.isNaN(columns)) {
    return DEFAULT_SEATING_COLUMNS
  }
  return Math.min(MAX_SEATING_COLUMNS, Math.max(MIN_SEATING_COLUMNS, Math.round(columns)))
}

const clampSeatingRows = (rows?: number) => {
  if (typeof rows !== 'number' || Number.isNaN(rows)) {
    return DEFAULT_SEATING_ROWS
  }
  return Math.min(MAX_SEATING_ROWS, Math.max(MIN_SEATING_ROWS, Math.round(rows)))
}

const getViewportSize = () =>
  typeof window === 'undefined'
    ? FALLBACK_VIEWPORT
    : { width: window.innerWidth, height: window.innerHeight }

const getCenteredPosition = (size: { width: number; height: number }) => {
  const viewport = getViewportSize()
  const baseX = Math.max(24, Math.round((viewport.width - size.width) / 2))
  const baseY = Math.max(24, Math.round((viewport.height - size.height) / 2))
  return clampPosition({ x: baseX, y: baseY }, size)
}

const getStackedPosition = (size: { width: number; height: number }, stackIndex: number) => {
  const offset = Math.min(Math.max(stackIndex, 0), MAX_OPEN_MODULES - 1) * 60
  const centered = getCenteredPosition(size)
  return clampPosition({ x: centered.x + offset, y: centered.y + offset }, size)
}

const getDefaultSize = (type: ModuleId) => {
  const fallback = DEFAULT_SIZES[type] ?? { width: MIN_MODULE_WIDTH, height: MIN_MODULE_HEIGHT }
  return clampSize(fallback)
}

const ensureWindowLayout = (moduleId: ModuleId, layout?: Partial<ModuleWindowLayout>): ModuleWindowLayout => {
  const baseSize = layout?.size ?? getDefaultSize(moduleId)
  const size = clampSize(baseSize)
  const basePosition = layout?.position ?? DEFAULT_POSITIONS[moduleId] ?? { x: 120, y: 120 }
  return {
    moduleId,
    size,
    position: clampPosition(basePosition, size),
    minimized: layout?.minimized ?? false,
    fullscreen: layout?.fullscreen ?? false,
    zIndex: layout?.zIndex ?? 1,
    lastActive: layout?.lastActive ?? Date.now(),
  }
}

const getNextActiveModuleId = (windows: ModuleWindowLayout[]) => {
  if (!windows.length) {
    return undefined
  }
  const visible = windows.filter((window) => !window.minimized)
  const pool = visible.length ? visible : windows
  return pool.reduce((top, current) => (current.zIndex > top.zIndex ? current : top)).moduleId
}

const getWindowList = (state: ModuleWindowsState) =>
  state.openModuleIds
    .map((moduleId) => state.windowsById[moduleId])
    .filter((window): window is ModuleWindowLayout => Boolean(window))

type LegacyModuleWindow = {
  id: string
  type: string
  position: { x: number; y: number }
  minimized: boolean
  zIndex: number
  lastActive: number
  size?: { width: number; height: number }
  fullscreen?: boolean
}

const normalizeLegacyModuleId = (type: string): ModuleId => {
  switch (type) {
    case 'wheel':
      return 'turntaking'
    case 'instruction':
      return 'instructioncards'
    case 'traffic':
      return 'trafficlight'
    default:
      return type in DEFAULT_SIZES ? (type as ModuleId) : 'background'
  }
}

const normalizeLessonTarget = (target?: string): ModuleId => {
  switch (target) {
    case 'timer':
      return 'timer'
    case 'groups':
      return 'groups'
    case 'wheel':
    case 'turns':
      return 'turntaking'
    default:
      return target && target in DEFAULT_SIZES ? (target as ModuleId) : 'timer'
  }
}

const ensureLegacyModuleGeometry = (module: LegacyModuleWindow): LegacyModuleWindow => {
  const moduleId = normalizeLegacyModuleId(module.type)
  const ensuredSize = module.size ?? getDefaultSize(moduleId)
  return {
    ...module,
    type: moduleId,
    size: ensuredSize,
    position: clampPosition(module.position, ensuredSize),
  }
}

const getNextLegacyActiveModuleId = (modules: LegacyModuleWindow[]) => {
  if (!modules.length) {
    return undefined
  }
  const visible = modules.filter((module) => !module.minimized)
  const pool = visible.length ? visible : modules
  return pool.reduce((top, current) => (current.zIndex > top.zIndex ? current : top)).id
}

const DEFAULT_STUDENTS = [
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

const shuffle = <T,>(arr: T[]) => {
  const clone = [...arr]
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }
  return clone
}

const createLessonPhase = (overrides?: Partial<LessonPhase>): LessonPhase => ({
  id: overrides?.id ?? makeId(),
  name: overrides?.name ?? 'Ny fas',
  minutes: clampLessonMinutes(overrides?.minutes ?? 5),
  targetModuleId: overrides?.targetModuleId ?? 'timer',
  done: overrides?.done ?? false,
})

const buildLessonPhases = (blueprint: LessonPhaseBlueprint[]): LessonPhase[] =>
  blueprint.map((phase) =>
    createLessonPhase({
      name: phase.name,
      minutes: phase.minutes,
      targetModuleId: phase.targetModuleId,
    }),
  )

const createLessonPlanFromBlueprint = (blueprint: LessonPhaseBlueprint[]): LessonPlanState => {
  const phases = buildLessonPhases(blueprint)
  return {
    phases,
    activePhaseId: phases[0]?.id,
    showProgress: true,
  }
}

const createDefaultLessonPlan = (): LessonPlanState => createLessonPlanFromBlueprint(DEFAULT_LESSON_PLAN_BLUEPRINT)

const ensureLessonPlanState = (lessonPlan?: LessonPlanState): LessonPlanState => lessonPlan ?? createDefaultLessonPlan()

const createEmptySeatingState = (): SeatingState => ({
  seatingPlansByClassId: {},
  activeSeatingPlanIdByClassId: {},
})

const createDefaultSeatingPlan = (
  classList: ClassListItem,
  layoutType?: LayoutType,
  seatCount?: number,
  name?: string,
): SeatingPlan => {
  const resolvedLayout: LayoutType = layoutType ?? (classList.students.length > 20 ? 'rutnat' : 'par')
  const desiredSeats = Math.max(12, seatCount ?? classList.students.length ?? 12)
  const seats = generateLayout(resolvedLayout, desiredSeats)
  const timestamp = Date.now()
  return {
    id: makeId(),
    name: name?.trim() || `${classList.name} · ${LAYOUT_LABELS[resolvedLayout]}`,
    layoutType: resolvedLayout,
    seatCount: seats.length,
    seats,
    assignments: seats.map((seat) => ({ seatId: seat.id, studentId: null })),
    lockedSeatIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

const createSeatingStateForClassLists = (classLists: ClassListState): SeatingState => {
  const seatingState = createEmptySeatingState()
  classLists.lists.forEach((classList) => {
    const plan = createDefaultSeatingPlan(classList)
    seatingState.seatingPlansByClassId[classList.id] = { [plan.id]: plan }
    seatingState.activeSeatingPlanIdByClassId[classList.id] = plan.id
  })
  return seatingState
}

const ensureSeatingState = (seating?: SeatingState, classLists?: ClassListState): SeatingState => {
  if (seating) {
    if (!classLists) {
      return seating
    }
    const next: SeatingState = {
      seatingPlansByClassId: { ...seating.seatingPlansByClassId },
      activeSeatingPlanIdByClassId: { ...seating.activeSeatingPlanIdByClassId },
    }
    classLists.lists.forEach((classList) => {
      if (!next.seatingPlansByClassId[classList.id]) {
        const plan = createDefaultSeatingPlan(classList)
        next.seatingPlansByClassId[classList.id] = { [plan.id]: plan }
        next.activeSeatingPlanIdByClassId[classList.id] = plan.id
      }
    })
    return next
  }
  return createSeatingStateForClassLists(classLists ?? { lists: [], activeId: undefined })
}

const getClassListById = (classLists: ClassListState, classListId?: string | null) =>
  classLists.lists.find((item) => item.id === classListId) ?? classLists.lists[0]

const ensureSeatingPlanForClass = (seating: SeatingState, classList: ClassListItem): SeatingState => {
  if (seating.seatingPlansByClassId[classList.id]) {
    return seating
  }
  const plan = createDefaultSeatingPlan(classList)
  return {
    seatingPlansByClassId: {
      ...seating.seatingPlansByClassId,
      [classList.id]: { [plan.id]: plan },
    },
    activeSeatingPlanIdByClassId: {
      ...seating.activeSeatingPlanIdByClassId,
      [classList.id]: plan.id,
    },
  }
}

const getPlanMapForClass = (seating: SeatingState, classListId: string) =>
  seating.seatingPlansByClassId[classListId] ?? {}

const getPlanForClass = (seating: SeatingState, classListId: string, planId?: string | null): SeatingPlan | undefined => {
  const plans = getPlanMapForClass(seating, classListId)
  if (planId && plans[planId]) {
    return plans[planId]
  }
  const activeId = seating.activeSeatingPlanIdByClassId[classListId]
  if (activeId && plans[activeId]) {
    return plans[activeId]
  }
  return Object.values(plans)[0]
}

const applyPlanUpdate = (
  seating: SeatingState,
  classListId: string,
  planId: string,
  updater: (plan: SeatingPlan) => SeatingPlan,
): SeatingState | null => {
  const planMap = seating.seatingPlansByClassId[classListId]
  if (!planMap) {
    return null
  }
  const plan = planMap[planId]
  if (!plan) {
    return null
  }
  return {
    seatingPlansByClassId: {
      ...seating.seatingPlansByClassId,
      [classListId]: {
        ...planMap,
        [planId]: updater(plan),
      },
    },
    activeSeatingPlanIdByClassId: { ...seating.activeSeatingPlanIdByClassId },
  }
}

const assignmentsToMap = (assignments: SeatAssignment[]) => {
  const map = new Map<string, SeatAssignment>()
  assignments.forEach((assignment) => map.set(assignment.seatId, assignment))
  return map
}

const syncAssignmentsToSeats = (assignments: SeatAssignment[], seats: Seat[]): SeatAssignment[] => {
  const assignmentMap = assignmentsToMap(assignments)
  return seats.map((seat) => assignmentMap.get(seat.id) ?? { seatId: seat.id, studentId: null })
}

const sanitizeAssignmentsForStudents = (plan: SeatingPlan, students: string[]): SeatingPlan => {
  if (!students.length) {
    return {
      ...plan,
      assignments: plan.assignments.map((assignment) => ({ ...assignment, studentId: null })),
      lockedSeatIds: [],
      updatedAt: Date.now(),
    }
  }
  const roster = new Set(students)
  const assignments = plan.assignments.map((assignment) => ({
    ...assignment,
    studentId: assignment.studentId && roster.has(assignment.studentId) ? assignment.studentId : null,
  }))
  const lockedSeatIds = plan.lockedSeatIds.filter((seatId) => assignments.some((assignment) => assignment.seatId === seatId))
  return {
    ...plan,
    assignments,
    lockedSeatIds,
    updatedAt: Date.now(),
  }
}

const patchSeatingPlan = (plan: SeatingPlan, patch: Partial<SeatingPlan>): SeatingPlan => {
  const seats = patch.seats ? [...patch.seats] : plan.seats
  const assignments = patch.seats
    ? syncAssignmentsToSeats(plan.assignments, seats)
    : patch.assignments
      ? [...patch.assignments]
      : plan.assignments
  const lockedSeatIds = (patch.lockedSeatIds ?? plan.lockedSeatIds).filter((seatId) => seats.some((seat) => seat.id === seatId))
  return {
    ...plan,
    ...patch,
    name: patch.name?.trim() ? patch.name.trim() : plan.name,
    seats,
    assignments,
    lockedSeatIds,
    seatCount: seats.length,
    updatedAt: Date.now(),
  }
}

const autoAssignPlan = (plan: SeatingPlan, students: string[]): SeatingPlan => {
  const locked = new Set(plan.lockedSeatIds)
  const lockedStudents = new Set(
    plan.assignments
      .filter((assignment) => locked.has(assignment.seatId) && assignment.studentId)
      .map((assignment) => assignment.studentId as string),
  )
  const queue = students.filter((student) => !lockedStudents.has(student))
  const assignments = plan.assignments.map((assignment) => {
    if (locked.has(assignment.seatId)) {
      return assignment
    }
    const studentId = queue.shift() ?? null
    return { ...assignment, studentId }
  })
  return {
    ...plan,
    assignments,
    updatedAt: Date.now(),
  }
}

const clearPlanAssignments = (plan: SeatingPlan): SeatingPlan => ({
  ...plan,
  assignments: plan.assignments.map((assignment) => ({ ...assignment, studentId: null })),
  updatedAt: Date.now(),
})

const shufflePlanAssignments = (plan: SeatingPlan): SeatingPlan => {
  const locked = new Set(plan.lockedSeatIds)
  const unlockedAssignments = plan.assignments.filter((assignment) => !locked.has(assignment.seatId) && assignment.studentId)
  const pool = shuffle(unlockedAssignments.map((assignment) => assignment.studentId as string))
  const assignments = plan.assignments.map((assignment) => {
    if (locked.has(assignment.seatId)) {
      return assignment
    }
    return {
      ...assignment,
      studentId: pool.shift() ?? null,
    }
  })
  return {
    ...plan,
    assignments,
    updatedAt: Date.now(),
  }
}

const assignStudentToSeat = (plan: SeatingPlan, seatId: string, studentId: string | null): SeatingPlan => {
  const normalizedId = studentId?.trim() || null
  const assignments = plan.assignments.map((assignment) => {
    if (assignment.seatId === seatId) {
      return { ...assignment, studentId: normalizedId }
    }
    if (normalizedId && assignment.studentId === normalizedId) {
      return { ...assignment, studentId: null }
    }
    return assignment
  })
  return {
    ...plan,
    assignments,
    updatedAt: Date.now(),
  }
}

const toggleSeatLockState = (plan: SeatingPlan, seatId: string): SeatingPlan => {
  const locked = new Set(plan.lockedSeatIds)
  if (locked.has(seatId)) {
    locked.delete(seatId)
  } else {
    locked.add(seatId)
  }
  return {
    ...plan,
    lockedSeatIds: Array.from(locked),
    updatedAt: Date.now(),
  }
}

const lockAllSeats = (plan: SeatingPlan, locked: boolean): SeatingPlan => ({
  ...plan,
  lockedSeatIds: locked ? plan.seats.map((seat) => seat.id) : [],
  updatedAt: Date.now(),
})

const getAssignmentsInSeatOrder = (plan: SeatingPlan) => {
  const assignmentMap = assignmentsToMap(plan.assignments)
  return plan.seats.map((seat) => assignmentMap.get(seat.id) ?? { seatId: seat.id, studentId: null })
}

const buildGroupsFromPlan = (plan: SeatingPlan): string[][] => {
  if (plan.layoutType !== 'grupper4') {
    return []
  }
  const ordered = getAssignmentsInSeatOrder(plan)
  const groups: string[][] = []
  for (let index = 0; index < ordered.length; index += 4) {
    const chunk = ordered.slice(index, index + 4)
    const members = chunk.map((assignment) => assignment.studentId).filter((name): name is string => Boolean(name))
    if (members.length) {
      groups.push(members)
    }
  }
  return groups
}

const buildTurnOrderFromPlan = (plan: SeatingPlan): string[] =>
  getAssignmentsInSeatOrder(plan)
    .map((assignment) => assignment.studentId)
    .filter((name): name is string => Boolean(name))

const migrateLegacySeatingState = (
  legacy: LegacySeatingState | undefined,
  classLists: ClassListState,
): SeatingState => {
  const seating = createSeatingStateForClassLists(classLists)
  if (!legacy || !Array.isArray(legacy.seats) || !legacy.seats.length) {
    return seating
  }
  const targetClass = getClassListById(classLists, classLists.activeId)
  if (!targetClass) {
    return seating
  }
  const layoutType: LayoutType = legacy.columns >= 5 ? 'rutnat' : 'par'
  const seatCount = legacy.seats.length || legacy.rows * legacy.columns || targetClass.students.length || 12
  const seats = generateLayout(layoutType, seatCount)
  const assignments = seats.map((seat, index) => ({
    seatId: seat.id,
    studentId: legacy.seats[index]?.student ?? null,
  }))
  const plan: SeatingPlan = {
    id: makeId(),
    name: `${targetClass.name} · Migrerad plan`,
    layoutType,
    seatCount: seats.length,
    seats,
    assignments,
    lockedSeatIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  seating.seatingPlansByClassId[targetClass.id] = { [plan.id]: plan }
  seating.activeSeatingPlanIdByClassId[targetClass.id] = plan.id
  return seating
}

const createExitTicketState = (): ExitTicketState => ({
  question: DEFAULT_EXIT_TICKET_QUESTION,
  options: DEFAULT_EXIT_TICKET_OPTIONS.map((option) => ({ ...option, id: makeId() })),
  totalResponses: 0,
  lastSharedAt: undefined,
})

const ensureExitTicketState = (state?: ExitTicketState): ExitTicketState => state ?? createExitTicketState()

const summarizeExitTicket = (exitTicket: ExitTicketState) => {
  if (!exitTicket.totalResponses) {
    return 'Inga svar ännu.'
  }
  const parts = exitTicket.options.map((option) => {
    const percentage = exitTicket.totalResponses ? Math.round((option.count / exitTicket.totalResponses) * 100) : 0
    return `${option.label}: ${option.count} st (${percentage}%)`
  })
  return `${exitTicket.question}
${parts.join('\n')}`
}

const createSoundMeterState = (): SoundMeterState => ({
  enabled: false,
  level: 0,
  peakLevel: 0,
  sensitivity: DEFAULT_SOUND_METER_SENSITIVITY,
  status: 'idle',
  message: null,
  lastUpdated: Date.now(),
})

const ensureSoundMeterState = (state?: SoundMeterState): SoundMeterState => {
  if (!state) {
    return createSoundMeterState()
  }
  return {
    ...createSoundMeterState(),
    ...state,
    message: state.message ?? null,
  }
}

const buildQueue = (students: string[], mode: TurnMode) =>
  mode === 'random' ? shuffle(students) : [...students]

interface BoardActions {
  setTheme: (theme: ThemeId) => void
  toggleProjector: () => void
  openModule: (moduleId: ModuleId) => void
  closeModule: (moduleId: ModuleId) => void
  minimizeModule: (moduleId: ModuleId) => void
  restoreModule: (moduleId: ModuleId) => void
  updateModulePosition: (payload: ModulePositionPayload) => void
  updateModuleSize: (payload: ModuleSizePayload) => void
  bringModuleToFront: (moduleId: ModuleId) => void
  setTrafficNorm: (norm: TrafficNorm) => void
  setTimerDuration: (seconds: number) => void
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void
  syncTimer: (timestamp?: number) => void
  setTimerPreferences: (prefs: Partial<TimerPreferences>) => void
  setInstructionText: (text: string) => void
  lockInstructions: (locked: boolean) => void
  applyInstructionPreset: (text: string) => void
  createClassList: (name: string, students: string[]) => void
  setActiveClass: (id: string) => void
  updateClassList: (id: string, students: string[]) => void
  removeClassList: (id: string) => void
  setTurnMode: (mode: TurnMode) => void
  advanceTurn: (status: TurnStatus) => void
  putTurnLast: () => void
  undoTurn: () => void
  endTurnSession: () => void
  refreshTurnsFromClass: () => void
  setGroupSize: (size: number) => void
  generateGroups: () => void
  shuffleGroups: () => void
  toggleGroupLock: () => void
  pickRandomStudent: () => void
  toggleModuleFullscreen: (moduleId: ModuleId) => void
  exitFullscreen: () => void
  setLessonPlanProgress: (visible: boolean) => void
  setActiveLessonPhase: (phaseId: string) => void
  toggleLessonPhaseDone: (phaseId: string) => void
  updateLessonPhase: (phaseId: string, patch: LessonPhasePatch) => void
  addLessonPhase: () => void
  removeLessonPhase: (phaseId: string) => void
  applyLessonPlanTemplate: () => void
  createSeatingPlan: (classListId: string, name: string, layoutType: LayoutType, seatCount: number) => string
  updateSeatingPlan: (classListId: string, planId: string, patch: Partial<SeatingPlan>) => void
  deleteSeatingPlan: (classListId: string, planId: string) => void
  setActiveSeatingPlan: (classListId: string, planId: string | null) => void
  generateSeatingLayout: (layoutType: LayoutType, seatCount: number) => Seat[]
  autoAssignSeats: (classListId: string, planId: string) => void
  clearAssignments: (classListId: string, planId: string) => void
  shuffleAssignments: (classListId: string, planId: string) => void
  assignStudentToSeat: (classListId: string, planId: string, seatId: string, studentId: string | null) => void
  toggleSeatLock: (classListId: string, planId: string, seatId: string) => void
  toggleAllSeatLocks: (classListId: string, planId: string, locked: boolean) => void
  createGroupsFromSeating: (classListId: string, planId: string) => void
  createTurnOrderFromSeating: (classListId: string, planId: string, replaceCurrent?: boolean) => void
  setExitTicketQuestion: (text: string) => void
  setExitTicketOptionLabel: (optionId: string, label: string) => void
  submitExitTicketResponse: (optionId: string) => void
  resetExitTicket: () => void
  shareExitTicketToInstructions: () => void
  setSoundMeterEnabled: (enabled: boolean) => void
  setSoundMeterSensitivity: (value: number) => void
  updateSoundMeterLevel: (value: number) => void
  setSoundMeterStatus: (status: SoundMeterStatus, message?: string | null) => void
  syncSoundMeterToTraffic: () => void
}

interface BoardState {
  theme: ThemeId
  projectorMode: boolean
  moduleWindows: ModuleWindowsState
  traffic: TrafficNorm
  timer: TimerState
  timerPreferences: TimerPreferences
  instructions: InstructionState
  classLists: ClassListState
  turns: TurnState
  groups: GroupState
  lessonPlan: LessonPlanState
  seating: SeatingState
  exitTicket: ExitTicketState
  soundMeter: SoundMeterState
  randomizer: RandomizerState
  actions: BoardActions
}

const defaultClassId = makeId()

const initialClassLists: ClassListState = {
  lists: [
    {
      id: defaultClassId,
      name: 'Basgrupp',
      students: DEFAULT_STUDENTS,
      updatedAt: Date.now(),
    },
  ],
  activeId: defaultClassId,
}

const initialState: Omit<BoardState, 'actions'> = {
  theme: 'aurora',
  projectorMode: false,
  moduleWindows: {
    openModuleIds: [],
    windowsById: {},
    activeModuleId: undefined,
    zCounter: 1,
  },
  traffic: 'prata',
  timer: {
    durationMs: 900_000,
    remainingMs: 900_000,
    isRunning: false,
    targetAt: undefined,
    lastUpdated: Date.now(),
  },
  timerPreferences: { ...DEFAULT_TIMER_PREFERENCES },
  instructions: {
    text: 'Välkommen! Starta i lugn takt och förklara målet för lektionen.',
    locked: false,
  },
  classLists: initialClassLists,
  turns: {
    mode: 'random',
    queue: buildQueue(DEFAULT_STUDENTS, 'random'),
    completed: [],
    lastUpdated: Date.now(),
  },
  groups: {
    groupSize: 4,
    groups: [],
    locked: false,
  },
  lessonPlan: createDefaultLessonPlan(),
  seating: createSeatingStateForClassLists(initialClassLists),
  exitTicket: createExitTicketState(),
  soundMeter: createSoundMeterState(),
  randomizer: {},
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      ...initialState,
      actions: {
        setTheme: (theme) => set({ theme }),
        toggleProjector: () => set((state) => ({ projectorMode: !state.projectorMode })),
        openModule: (moduleId) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const windowsById = { ...moduleWindows.windowsById }
            const existing = windowsById[moduleId]
            if (existing) {
              const updated = ensureWindowLayout(moduleId, {
                ...existing,
                minimized: false,
                fullscreen: false,
                lastActive: Date.now(),
                zIndex: moduleWindows.zCounter + 1,
              })
              windowsById[moduleId] = updated
              const openModuleIds = moduleWindows.openModuleIds.includes(moduleId)
                ? [...moduleWindows.openModuleIds]
                : [...moduleWindows.openModuleIds, moduleId]
              return {
                moduleWindows: {
                  ...moduleWindows,
                  windowsById,
                  openModuleIds,
                  activeModuleId: moduleId,
                  zCounter: moduleWindows.zCounter + 1,
                },
              }
            }

            let openModuleIds = [...moduleWindows.openModuleIds]
            const openWindows = getWindowList(moduleWindows)
            if (openWindows.length >= MAX_OPEN_MODULES) {
              const sorted = [...openWindows].sort((a, b) => a.lastActive - b.lastActive)
              const removed = sorted[0]
              if (removed) {
                delete windowsById[removed.moduleId]
                openModuleIds = openModuleIds.filter((id) => id !== removed.moduleId)
              }
            }

            const size = getDefaultSize(moduleId)
            const stackIndex = openModuleIds.length
            const preferredPosition =
              typeof window === 'undefined'
                ? DEFAULT_POSITIONS[moduleId] ?? { x: 120, y: 120 }
                : getStackedPosition(size, stackIndex)
            const layout = ensureWindowLayout(moduleId, {
              position: preferredPosition,
              size,
              minimized: false,
              fullscreen: false,
              lastActive: Date.now(),
              zIndex: moduleWindows.zCounter + 1,
            })

            openModuleIds = [...openModuleIds, moduleId]
            windowsById[moduleId] = layout

            return {
              moduleWindows: {
                openModuleIds,
                windowsById,
                activeModuleId: moduleId,
                zCounter: moduleWindows.zCounter + 1,
              },
            }
          }),
        closeModule: (moduleId) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            if (!moduleWindows.windowsById[moduleId]) {
              return state
            }
            const windowsById = { ...moduleWindows.windowsById }
            delete windowsById[moduleId]
            const openModuleIds = moduleWindows.openModuleIds.filter((id) => id !== moduleId)
            const remainingWindows = openModuleIds
              .map((id) => windowsById[id])
              .filter((window): window is ModuleWindowLayout => Boolean(window))
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
                openModuleIds,
                activeModuleId:
                  moduleWindows.activeModuleId === moduleId
                    ? getNextActiveModuleId(remainingWindows)
                    : moduleWindows.activeModuleId,
              },
            }
          }),
        minimizeModule: (moduleId) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const target = moduleWindows.windowsById[moduleId]
            if (!target) {
              return state
            }
            const windowsById = {
              ...moduleWindows.windowsById,
              [moduleId]: { ...target, minimized: true, fullscreen: false },
            }
            const remainingWindows = moduleWindows.openModuleIds
              .map((id) => windowsById[id])
              .filter((window): window is ModuleWindowLayout => Boolean(window))
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
                activeModuleId:
                  moduleWindows.activeModuleId === moduleId
                    ? getNextActiveModuleId(remainingWindows)
                    : moduleWindows.activeModuleId,
              },
            }
          }),
        restoreModule: (moduleId) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const target = moduleWindows.windowsById[moduleId]
            if (!target) {
              return state
            }
            const windowsById = {
              ...moduleWindows.windowsById,
              [moduleId]: ensureWindowLayout(moduleId, {
                ...target,
                minimized: false,
                fullscreen: false,
                lastActive: Date.now(),
                zIndex: moduleWindows.zCounter + 1,
              }),
            }
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
                activeModuleId: moduleId,
                zCounter: moduleWindows.zCounter + 1,
              },
            }
          }),
        updateModulePosition: ({ moduleId, position }) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const target = moduleWindows.windowsById[moduleId]
            if (!target) {
              return state
            }
            const windowsById = {
              ...moduleWindows.windowsById,
              [moduleId]: {
                ...target,
                position: clampPosition(position, target.size),
              },
            }
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
              },
            }
          }),
        updateModuleSize: ({ moduleId, size }) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const target = moduleWindows.windowsById[moduleId]
            if (!target) {
              return state
            }
            const nextSize = clampSize(size)
            const windowsById = {
              ...moduleWindows.windowsById,
              [moduleId]: {
                ...target,
                size: nextSize,
                position: clampPosition(target.position, nextSize),
              },
            }
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
              },
            }
          }),
        bringModuleToFront: (moduleId) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const target = moduleWindows.windowsById[moduleId]
            if (!target) {
              return state
            }
            const windowsById = {
              ...moduleWindows.windowsById,
              [moduleId]: {
                ...target,
                zIndex: moduleWindows.zCounter + 1,
                lastActive: Date.now(),
              },
            }
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
                activeModuleId: moduleId,
                zCounter: moduleWindows.zCounter + 1,
              },
            }
          }),
        toggleModuleFullscreen: (moduleId) =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const target = moduleWindows.windowsById[moduleId]
            if (!target) {
              return state
            }
            const windowsById: ModuleWindowsState['windowsById'] = {}
            Object.entries(moduleWindows.windowsById).forEach(([id, layout]) => {
              if (!layout) {
                return
              }
              if (id === moduleId) {
                windowsById[id as ModuleId] = {
                  ...layout,
                  minimized: false,
                  fullscreen: !layout.fullscreen,
                  lastActive: Date.now(),
                  zIndex: moduleWindows.zCounter + 1,
                }
              } else {
                windowsById[id as ModuleId] = { ...layout, fullscreen: false }
              }
            })
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
                activeModuleId: moduleId,
                zCounter: moduleWindows.zCounter + 1,
              },
            }
          }),
        exitFullscreen: () =>
          set((state) => {
            const moduleWindows = state.moduleWindows
            const windowsById: ModuleWindowsState['windowsById'] = {}
            Object.entries(moduleWindows.windowsById).forEach(([id, layout]) => {
              if (!layout) {
                return
              }
              windowsById[id as ModuleId] = { ...layout, fullscreen: false }
            })
            return {
              moduleWindows: {
                ...moduleWindows,
                windowsById,
              },
            }
          }),
        setTrafficNorm: (norm) => set({ traffic: norm }),
        setTimerDuration: (seconds) =>
          set(() => {
            const durationMs = toMilliseconds(seconds)
            return {
              timer: {
                durationMs,
                remainingMs: durationMs,
                isRunning: false,
                targetAt: undefined,
                lastUpdated: Date.now(),
              },
            }
          }),
        startTimer: () =>
          set((state) => {
            if (state.timer.isRunning || state.timer.remainingMs <= 0) {
              return state
            }
            const now = Date.now()
            return {
              timer: {
                ...state.timer,
                isRunning: true,
                targetAt: now + state.timer.remainingMs,
                lastUpdated: now,
              },
            }
          }),
        pauseTimer: () =>
          set((state) => {
            if (!state.timer.isRunning) {
              return state
            }
            const now = Date.now()
            const remainingMs = state.timer.targetAt ? Math.max(0, state.timer.targetAt - now) : state.timer.remainingMs
            return {
              timer: {
                ...state.timer,
                isRunning: false,
                remainingMs,
                targetAt: undefined,
                lastUpdated: now,
              },
            }
          }),
        resetTimer: () =>
          set((state) => ({
            timer: {
              ...state.timer,
              remainingMs: state.timer.durationMs,
              isRunning: false,
              targetAt: undefined,
              lastUpdated: Date.now(),
            },
          })),
        syncTimer: (timestamp) =>
          set((state) => {
            if (!state.timer.isRunning) {
              return state
            }
            const now = timestamp ?? Date.now()
            if (!state.timer.targetAt) {
              return {
                timer: {
                  ...state.timer,
                  isRunning: false,
                  targetAt: undefined,
                  remainingMs: 0,
                  lastUpdated: now,
                },
              }
            }
            const remainingMs = Math.max(0, state.timer.targetAt - now)
            const delta = Math.abs(remainingMs - state.timer.remainingMs)
            if (remainingMs > 0 && delta < 200) {
              return state
            }
            if (remainingMs === 0) {
              return {
                timer: {
                  ...state.timer,
                  remainingMs: 0,
                  isRunning: false,
                  targetAt: undefined,
                  lastUpdated: now,
                },
              }
            }
            return {
              timer: {
                ...state.timer,
                remainingMs,
                lastUpdated: now,
              },
            }
          }),
        setTimerPreferences: (prefs) =>
          set((state) => ({ timerPreferences: { ...state.timerPreferences, ...prefs } })),
        setInstructionText: (text) =>
          set((state) => ({ instructions: { ...state.instructions, text } })),
        lockInstructions: (locked) =>
          set((state) => ({ instructions: { ...state.instructions, locked } })),
        applyInstructionPreset: (text) =>
          set((state) => ({ instructions: { ...state.instructions, text } })),
        createClassList: (name, students) =>
          set((state) => {
            const trimmed = name.trim()
            if (!trimmed || !students.length) {
              return state
            }
            const entry: ClassListItem = {
              id: makeId(),
              name: trimmed,
              students,
              updatedAt: Date.now(),
            }
            const nextClassLists: ClassListState = {
              lists: [...state.classLists.lists, entry],
              activeId: entry.id,
            }
            const ensuredSeating = ensureSeatingState(state.seating, nextClassLists)
            const initialPlan = createDefaultSeatingPlan(entry)
            const seating: SeatingState = {
              seatingPlansByClassId: {
                ...ensuredSeating.seatingPlansByClassId,
                [entry.id]: { [initialPlan.id]: initialPlan },
              },
              activeSeatingPlanIdByClassId: {
                ...ensuredSeating.activeSeatingPlanIdByClassId,
                [entry.id]: initialPlan.id,
              },
            }
            return {
              classLists: nextClassLists,
              turns: {
                ...state.turns,
                queue: buildQueue(students, state.turns.mode),
                completed: [],
              },
              seating,
            }
          }),
        setActiveClass: (id) =>
          set((state) => {
            const list = state.classLists.lists.find((item) => item.id === id)
            if (!list) return state
            const nextClassLists = { ...state.classLists, activeId: id }
            const seatingBase = ensureSeatingState(state.seating, nextClassLists)
            const seating = ensureSeatingPlanForClass(seatingBase, list)
            return {
              classLists: nextClassLists,
              turns: {
                ...state.turns,
                queue: buildQueue(list.students, state.turns.mode),
                completed: [],
              },
              groups: { ...state.groups, groups: [] },
              seating,
            }
          }),
        updateClassList: (id, students) =>
          set((state) => {
            const lists = state.classLists.lists.map((item) =>
              item.id === id ? { ...item, students, updatedAt: Date.now() } : item,
            )
            const nextClassLists: ClassListState = { ...state.classLists, lists }
            const activeList = lists.find((item) => item.id === state.classLists.activeId)
            const seatingBase = ensureSeatingState(state.seating, nextClassLists)
            const targetList = lists.find((item) => item.id === id)
            let seating = seatingBase
            if (targetList && seatingBase.seatingPlansByClassId[id]) {
              const updatedPlans: Record<string, SeatingPlan> = {}
              Object.entries(seatingBase.seatingPlansByClassId[id]).forEach(([planId, plan]) => {
                updatedPlans[planId] = sanitizeAssignmentsForStudents(plan, targetList.students)
              })
              seating = {
                seatingPlansByClassId: {
                  ...seatingBase.seatingPlansByClassId,
                  [id]: updatedPlans,
                },
                activeSeatingPlanIdByClassId: { ...seatingBase.activeSeatingPlanIdByClassId },
              }
            }
            return {
              classLists: nextClassLists,
              turns: activeList
                ? { ...state.turns, queue: buildQueue(activeList.students, state.turns.mode), completed: [] }
                : state.turns,
              groups: { ...state.groups, groups: [] },
              seating,
            }
          }),
        removeClassList: (id) =>
          set((state) => {
            const lists = state.classLists.lists.filter((item) => item.id !== id)
            const activeId = state.classLists.activeId === id ? lists[0]?.id : state.classLists.activeId
            const activeList = lists.find((item) => item.id === activeId)
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const remainingPlans = { ...seatingBase.seatingPlansByClassId }
            delete remainingPlans[id]
            const remainingActive = { ...seatingBase.activeSeatingPlanIdByClassId }
            delete remainingActive[id]
            let seating: SeatingState = {
              seatingPlansByClassId: remainingPlans,
              activeSeatingPlanIdByClassId: remainingActive,
            }
            if (activeList) {
              seating = ensureSeatingPlanForClass(seating, activeList)
            }
            return {
              classLists: { lists, activeId },
              turns: activeList
                ? { ...state.turns, queue: buildQueue(activeList.students, state.turns.mode), completed: [] }
                : { ...state.turns, queue: [], completed: [] },
              groups: { ...state.groups, groups: [] },
              seating,
            }
          }),
        setTurnMode: (mode) =>
          set((state) => {
            const students = getActiveStudents(state)
            return {
              turns: {
                ...state.turns,
                mode,
                queue: buildQueue(students, mode),
                completed: [],
              },
            }
          }),
        advanceTurn: (status) =>
          set((state) => {
            const [current, ...rest] = state.turns.queue
            if (!current) return state
            const event: TurnEvent = {
              id: makeId(),
              name: current,
              status,
              timestamp: Date.now(),
            }
            return {
              turns: {
                ...state.turns,
                queue: rest,
                completed: [event, ...state.turns.completed].slice(0, 20),
              },
            }
          }),
        putTurnLast: () =>
          set((state) => {
            const [current, ...rest] = state.turns.queue
            if (!current) return state
            return {
              turns: {
                ...state.turns,
                queue: [...rest, current],
              },
            }
          }),
        undoTurn: () =>
          set((state) => {
            const [last, ...remaining] = state.turns.completed
            if (!last) return state
            return {
              turns: {
                ...state.turns,
                completed: remaining,
                queue: [last.name, ...state.turns.queue],
              },
            }
          }),
        endTurnSession: () =>
          set((state) => {
            const students = getActiveStudents(state)
            return {
              turns: {
                ...state.turns,
                queue: buildQueue(students, state.turns.mode),
                completed: [],
              },
            }
          }),
        refreshTurnsFromClass: () =>
          set((state) => {
            const students = getActiveStudents(state)
            return {
              turns: {
                ...state.turns,
                queue: buildQueue(students, state.turns.mode),
                completed: [],
              },
            }
          }),
        setGroupSize: (size) =>
          set((state) => ({ groups: { ...state.groups, groupSize: size } })),
        generateGroups: () =>
          set((state) => {
            if (state.groups.locked) return state
            const students = getActiveStudents(state)
            if (!students.length) return state
            const shuffled = shuffle(students)
            const chunked: string[][] = []
            for (let i = 0; i < shuffled.length; i += state.groups.groupSize) {
              chunked.push(shuffled.slice(i, i + state.groups.groupSize))
            }
            return {
              groups: {
                ...state.groups,
                groups: chunked,
              },
            }
          }),
        shuffleGroups: () =>
          set((state) => {
            if (!state.groups.groups.length || state.groups.locked) return state
            const flattened = state.groups.groups.flat()
            const shuffled = shuffle(flattened)
            const chunked: string[][] = []
            for (let i = 0; i < shuffled.length; i += state.groups.groupSize) {
              chunked.push(shuffled.slice(i, i + state.groups.groupSize))
            }
            return {
              groups: { ...state.groups, groups: chunked },
            }
          }),
        toggleGroupLock: () =>
          set((state) => ({ groups: { ...state.groups, locked: !state.groups.locked } })),
        pickRandomStudent: () =>
          set((state) => {
            const students = getActiveStudents(state)
            if (!students.length) return state
            const pick = students[Math.floor(Math.random() * students.length)]
            return {
              randomizer: {
                lastPick: pick,
                timestamp: Date.now(),
              },
            }
          }),
        setLessonPlanProgress: (visible) =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            if (!state.lessonPlan) {
              return {
                lessonPlan: {
                  ...lessonPlan,
                  showProgress: visible,
                },
              }
            }
            if (state.lessonPlan.showProgress === visible) {
              return state
            }
            return {
              lessonPlan: {
                ...state.lessonPlan,
                showProgress: visible,
              },
            }
          }),
        setActiveLessonPhase: (phaseId) =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            const phaseExists = lessonPlan.phases.some((phase) => phase.id === phaseId)
            if (!phaseExists) {
              return state.lessonPlan ? state : { lessonPlan }
            }
            if (state.lessonPlan?.activePhaseId === phaseId) {
              return state
            }
            const basePlan = state.lessonPlan ?? lessonPlan
            return {
              lessonPlan: {
                ...basePlan,
                activePhaseId: phaseId,
              },
            }
          }),
        toggleLessonPhaseDone: (phaseId) =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            const phases = lessonPlan.phases.map((phase) =>
              phase.id === phaseId ? { ...phase, done: !phase.done } : phase,
            )
            return {
              lessonPlan: {
                ...lessonPlan,
                phases,
              },
            }
          }),
        updateLessonPhase: (phaseId, patch) =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            const phases = lessonPlan.phases.map((phase) => {
              if (phase.id !== phaseId) {
                return phase
              }
              return {
                ...phase,
                name: patch.name ?? phase.name,
                minutes:
                  patch.minutes !== undefined ? clampLessonMinutes(patch.minutes) : phase.minutes,
                targetModuleId: patch.targetModuleId ?? phase.targetModuleId,
              }
            })
            return {
              lessonPlan: {
                ...lessonPlan,
                phases,
              },
            }
          }),
        addLessonPhase: () =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            return {
              lessonPlan: {
                ...lessonPlan,
                phases: [...lessonPlan.phases, createLessonPhase()],
              },
            }
          }),
        removeLessonPhase: (phaseId) =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            const phases = lessonPlan.phases.filter((phase) => phase.id !== phaseId)
            return {
              lessonPlan: {
                ...lessonPlan,
                phases,
                activePhaseId: lessonPlan.activePhaseId === phaseId ? phases[0]?.id : lessonPlan.activePhaseId,
              },
            }
          }),
        applyLessonPlanTemplate: () =>
          set((state) => {
            const lessonPlan = ensureLessonPlanState(state.lessonPlan)
            const nextPlan = createLessonPlanFromBlueprint(LESSON_PLAN_TEMPLATE_75)
            return {
              lessonPlan: {
                ...nextPlan,
                showProgress: lessonPlan.showProgress,
              },
            }
          }),
        createSeatingPlan: (classListId, name, layoutType, seatCount) => {
          let createdId = ''
          set((state) => {
            const classList = state.classLists.lists.find((item) => item.id === classListId)
            if (!classList) {
              return state
            }
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seats = generateLayout(layoutType, seatCount)
            const timestamp = Date.now()
            const plan: SeatingPlan = {
              id: makeId(),
              name: name.trim() || `${classList.name} · ${LAYOUT_LABELS[layoutType]}`,
              layoutType,
              seatCount: seats.length,
              seats,
              assignments: seats.map((seat) => ({ seatId: seat.id, studentId: null })),
              lockedSeatIds: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            }
            createdId = plan.id
            const existingPlans = seatingBase.seatingPlansByClassId[classList.id] ?? {}
            return {
              seating: {
                seatingPlansByClassId: {
                  ...seatingBase.seatingPlansByClassId,
                  [classList.id]: { ...existingPlans, [plan.id]: plan },
                },
                activeSeatingPlanIdByClassId: {
                  ...seatingBase.activeSeatingPlanIdByClassId,
                  [classList.id]: plan.id,
                },
              },
            }
          })
          return createdId
        },
        updateSeatingPlan: (classListId, planId, patch) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const classList = state.classLists.lists.find((item) => item.id === classListId)
            if (!classList) {
              return state
            }
            const updatedSeating = applyPlanUpdate(seatingBase, classListId, planId, (plan) =>
              patchSeatingPlan(plan, patch),
            )
            if (!updatedSeating) {
              return state
            }
            return {
              seating: updatedSeating,
            }
          }),
        deleteSeatingPlan: (classListId, planId) =>
          set((state) => {
            const classList = state.classLists.lists.find((item) => item.id === classListId)
            if (!classList) {
              return state
            }
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const planMap = seatingBase.seatingPlansByClassId[classListId]
            if (!planMap || !planMap[planId]) {
              return state
            }
            const remainingEntries = Object.entries(planMap).filter(([id]) => id !== planId)
            let nextPlans: Record<string, SeatingPlan>
            let activeId = seatingBase.activeSeatingPlanIdByClassId[classListId]
            if (!remainingEntries.length) {
              const fallback = createDefaultSeatingPlan(classList)
              nextPlans = { [fallback.id]: fallback }
              activeId = fallback.id
            } else {
              nextPlans = Object.fromEntries(remainingEntries)
              if (!activeId || !nextPlans[activeId]) {
                activeId = remainingEntries[0][0]
              }
            }
            return {
              seating: {
                seatingPlansByClassId: {
                  ...seatingBase.seatingPlansByClassId,
                  [classListId]: nextPlans,
                },
                activeSeatingPlanIdByClassId: {
                  ...seatingBase.activeSeatingPlanIdByClassId,
                  [classListId]: activeId,
                },
              },
            }
          }),
        setActiveSeatingPlan: (classListId, planId) =>
          set((state) => {
            if (!planId) {
              return state
            }
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            if (!seatingBase.seatingPlansByClassId[classListId]?.[planId]) {
              return state
            }
            return {
              seating: {
                ...seatingBase,
                activeSeatingPlanIdByClassId: {
                  ...seatingBase.activeSeatingPlanIdByClassId,
                  [classListId]: planId,
                },
              },
            }
          }),
        generateSeatingLayout: (layoutType, seatCount) => generateLayout(layoutType, seatCount),
        autoAssignSeats: (classListId, planId) =>
          set((state) => {
            const classList = state.classLists.lists.find((item) => item.id === classListId)
            if (!classList) {
              return state
            }
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seating = applyPlanUpdate(seatingBase, classListId, planId, (plan) =>
              autoAssignPlan(plan, classList.students),
            )
            if (!seating) {
              return state
            }
            return { seating }
          }),
        clearAssignments: (classListId, planId) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seating = applyPlanUpdate(seatingBase, classListId, planId, (plan) => clearPlanAssignments(plan))
            if (!seating) {
              return state
            }
            return { seating }
          }),
        shuffleAssignments: (classListId, planId) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seating = applyPlanUpdate(seatingBase, classListId, planId, (plan) => shufflePlanAssignments(plan))
            if (!seating) {
              return state
            }
            return { seating }
          }),
        assignStudentToSeat: (classListId, planId, seatId, studentId) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seating = applyPlanUpdate(seatingBase, classListId, planId, (plan) =>
              assignStudentToSeat(plan, seatId, studentId),
            )
            if (!seating) {
              return state
            }
            return { seating }
          }),
        toggleSeatLock: (classListId, planId, seatId) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seating = applyPlanUpdate(seatingBase, classListId, planId, (plan) => toggleSeatLockState(plan, seatId))
            if (!seating) {
              return state
            }
            return { seating }
          }),
        toggleAllSeatLocks: (classListId, planId, locked) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const seating = applyPlanUpdate(seatingBase, classListId, planId, (plan) => lockAllSeats(plan, locked))
            if (!seating) {
              return state
            }
            return { seating }
          }),
        createGroupsFromSeating: (classListId, planId) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const plan = getPlanForClass(seatingBase, classListId, planId)
            if (!plan || plan.layoutType !== 'grupper4') {
              return state
            }
            const groups = buildGroupsFromPlan(plan)
            if (!groups.length) {
              return state
            }
            return {
              groups: {
                ...state.groups,
                groups,
                groupSize: 4,
                locked: false,
              },
            }
          }),
        createTurnOrderFromSeating: (classListId, planId, replaceCurrent = true) =>
          set((state) => {
            const seatingBase = ensureSeatingState(state.seating, state.classLists)
            const plan = getPlanForClass(seatingBase, classListId, planId)
            if (!plan) {
              return state
            }
            const order = buildTurnOrderFromPlan(plan)
            if (!order.length) {
              return state
            }
            const queue = replaceCurrent ? [...order] : [...state.turns.queue, ...order]
            return {
              turns: {
                ...state.turns,
                mode: 'ordered',
                queue,
                completed: [],
              },
            }
          }),
        setExitTicketQuestion: (text) =>
          set((state) => ({
            exitTicket: {
              ...ensureExitTicketState(state.exitTicket),
              question: text.trim() || DEFAULT_EXIT_TICKET_QUESTION,
            },
          })),
        setExitTicketOptionLabel: (optionId, label) =>
          set((state) => {
            const exitTicket = ensureExitTicketState(state.exitTicket)
            const options = exitTicket.options.map((option) =>
              option.id === optionId ? { ...option, label: label.trim() || option.label } : option,
            )
            return {
              exitTicket: {
                ...exitTicket,
                options,
              },
            }
          }),
        submitExitTicketResponse: (optionId) =>
          set((state) => {
            const exitTicket = ensureExitTicketState(state.exitTicket)
            const options = exitTicket.options.map((option) =>
              option.id === optionId ? { ...option, count: option.count + 1 } : option,
            )
            const updatedResponses = exitTicket.totalResponses + 1
            return {
              exitTicket: {
                ...exitTicket,
                options,
                totalResponses: updatedResponses,
              },
            }
          }),
        resetExitTicket: () =>
          set(() => ({ exitTicket: createExitTicketState() })),
        shareExitTicketToInstructions: () =>
          set((state) => {
            const exitTicket = ensureExitTicketState(state.exitTicket)
            if (!exitTicket.totalResponses) {
              return state
            }
            const summary = summarizeExitTicket(exitTicket)
            return {
              exitTicket: {
                ...exitTicket,
                lastSharedAt: Date.now(),
              },
              instructions: {
                ...state.instructions,
                text: summary,
              },
            }
          }),
        setSoundMeterEnabled: (enabled) =>
          set((state) => ({
            soundMeter: {
              ...ensureSoundMeterState(state.soundMeter),
              enabled,
              status: enabled ? 'listening' : 'idle',
              message: null,
              lastUpdated: Date.now(),
            },
          })),
        setSoundMeterSensitivity: (value) =>
          set((state) => ({
            soundMeter: {
              ...ensureSoundMeterState(state.soundMeter),
              sensitivity: Math.min(1, Math.max(0.1, value)),
              lastUpdated: Date.now(),
            },
          })),
        updateSoundMeterLevel: (value) =>
          set((state) => {
            const soundMeter = ensureSoundMeterState(state.soundMeter)
            const level = Math.min(1, Math.max(0, value))
            if (Math.abs(level - soundMeter.level) < 0.02) {
              return state
            }
            return {
              soundMeter: {
                ...soundMeter,
                level,
                peakLevel: Math.max(soundMeter.peakLevel * 0.92, level),
                lastUpdated: Date.now(),
              },
            }
          }),
        setSoundMeterStatus: (status, message) =>
          set((state) => {
            const soundMeter = ensureSoundMeterState(state.soundMeter)
            return {
              soundMeter: {
                ...soundMeter,
                status,
                enabled: status === 'listening' ? soundMeter.enabled : false,
                message: message ?? null,
                lastUpdated: Date.now(),
              },
            }
          }),
        syncSoundMeterToTraffic: () =>
          set((state) => {
            const soundMeter = ensureSoundMeterState(state.soundMeter)
            const level = soundMeter.level
            let norm: TrafficNorm = 'prata'
            if (level < 0.35) {
              norm = 'tyst'
            } else if (level < 0.65) {
              norm = 'viska'
            }
            if (state.traffic === norm) {
              return state
            }
            return {
              traffic: norm,
            }
          }),
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(resolveStorage),
      merge: (persistedState, currentState) => {
        if (!persistedState) {
          return currentState
        }
        const merged = {
          ...currentState,
          ...(persistedState as BoardState),
        }
        return { ...merged, actions: currentState.actions }
      },
      partialize: (state) => {
        const { actions, ...rest } = state
        void actions
        return rest
      },
      migrate: async (persistedState, version) => {
        if (!persistedState) {
          return persistedState
        }

        let migrated = persistedState as BoardState

        if (version < 3) {
          const modules = (migrated.modules ?? []).map((module) => ensureLegacyModuleGeometry(module))
          migrated = {
            ...migrated,
            modules,
            activeModuleId: migrated.activeModuleId ?? getNextLegacyActiveModuleId(modules),
          }
        }

        if (version < 4) {
          const modules = (migrated.modules ?? []).map((module) => ({ ...module, fullscreen: false }))
          migrated = {
            ...migrated,
            modules,
            timer: {
              ...migrated.timer,
              lastUpdated: migrated.timer?.lastUpdated ?? Date.now(),
            },
            timerPreferences: migrated.timerPreferences ?? { ...DEFAULT_TIMER_PREFERENCES },
            activeModuleId: migrated.activeModuleId ?? getNextLegacyActiveModuleId(modules),
          }
        }

        if (version < 5) {
          const legacyPrefs = migrated.timerPreferences as TimerPreferences & { showTimeLabel?: boolean } | undefined
          migrated = {
            ...migrated,
            timerPreferences: {
              showTime: legacyPrefs?.showTime ?? legacyPrefs?.showTimeLabel ?? DEFAULT_TIMER_PREFERENCES.showTime,
              warningMode: legacyPrefs?.warningMode ?? DEFAULT_TIMER_PREFERENCES.warningMode,
              endSignal: legacyPrefs?.endSignal ?? DEFAULT_TIMER_PREFERENCES.endSignal,
            },
          }
        }

        if (version < 6) {
          const legacyTimer = migrated.timer as TimerState & {
            durationSec?: number
            remainingSec?: number
          }
          const legacyDurationSec =
            typeof legacyTimer?.durationSec === 'number'
              ? legacyTimer.durationSec
              : typeof legacyTimer?.durationMs === 'number'
                ? legacyTimer.durationMs / 1000
                : 0
          const legacyRemainingSec =
            typeof legacyTimer?.remainingSec === 'number'
              ? legacyTimer.remainingSec
              : typeof legacyTimer?.remainingMs === 'number'
                ? legacyTimer.remainingMs / 1000
                : legacyDurationSec
          const normalizedDurationMs = toMilliseconds(legacyDurationSec)
          const normalizedRemainingMs = normalizedDurationMs > 0
            ? Math.min(normalizedDurationMs, toMilliseconds(legacyRemainingSec))
            : toMilliseconds(legacyRemainingSec)
          const elapsedSinceUpdate =
            legacyTimer?.isRunning && legacyTimer?.lastUpdated ? Math.max(0, Date.now() - legacyTimer.lastUpdated) : 0
          const derivedRemaining = legacyTimer?.isRunning
            ? Math.max(0, normalizedRemainingMs - elapsedSinceUpdate)
            : normalizedRemainingMs
          const isRunning = Boolean(legacyTimer?.isRunning && derivedRemaining > 0)
          migrated = {
            ...migrated,
            timer: {
              durationMs: normalizedDurationMs,
              remainingMs: isRunning ? derivedRemaining : normalizedRemainingMs,
              isRunning,
              targetAt: isRunning ? Date.now() + derivedRemaining : undefined,
              lastUpdated: Date.now(),
            },
          }
        }

        if (version < 7) {
          const allowedModes: TimerWarningMode[] = ['off', 'tenPercent', 'twoMinutes']
          const currentMode = migrated.timerPreferences?.warningMode
          const normalizedMode = allowedModes.includes(currentMode as TimerWarningMode) ? currentMode : 'tenPercent'
          migrated = {
            ...migrated,
            timerPreferences: {
              ...migrated.timerPreferences,
              warningMode: normalizedMode,
            },
          }
        }

        if (version < 8) {
          const legacyModules = (migrated as BoardState & { modules?: LegacyModuleWindow[] }).modules ?? []
          const windowsById: ModuleWindowsState['windowsById'] = {}
          const openModuleIds: ModuleId[] = []
          let maxZ = 1
          legacyModules.forEach((module) => {
            if (!module) {
              return
            }
            const moduleId = normalizeLegacyModuleId(module.type)
            const layout = ensureWindowLayout(moduleId, {
              position: module.position,
              size: module.size,
              minimized: module.minimized,
              fullscreen: module.fullscreen,
              zIndex: module.zIndex,
              lastActive: module.lastActive,
            })
            windowsById[moduleId] = layout
            openModuleIds.push(moduleId)
            maxZ = Math.max(maxZ, layout.zIndex)
          })

          migrated = {
            ...migrated,
            moduleWindows: {
              openModuleIds,
              windowsById,
              activeModuleId: migrated.activeModuleId
                ? normalizeLegacyModuleId(migrated.activeModuleId as string)
                : undefined,
              zCounter: maxZ,
            },
          }

          delete (migrated as Partial<BoardState> & { modules?: unknown; activeModuleId?: unknown; zCounter?: unknown }).modules
          delete (migrated as Partial<BoardState> & { modules?: unknown; activeModuleId?: unknown; zCounter?: unknown }).activeModuleId
          delete (migrated as Partial<BoardState> & { modules?: unknown; activeModuleId?: unknown; zCounter?: unknown }).zCounter
        }

        if (version < 9) {
          const existingLessonPlan = (migrated as Partial<BoardState>).lessonPlan
          if (!existingLessonPlan || !Array.isArray(existingLessonPlan.phases) || !existingLessonPlan.phases.length) {
            migrated = {
              ...migrated,
              lessonPlan: createDefaultLessonPlan(),
            }
          } else {
            const normalizedPhases = existingLessonPlan.phases.map((phase) => {
              const blueprintTarget = (phase as LessonPhase & { targetStage?: string }).targetModuleId
                ?? (phase as { targetStage?: string }).targetStage
              return createLessonPhase({
                id: phase.id,
                name: phase.name,
                minutes: phase.minutes,
                targetModuleId: normalizeLessonTarget(blueprintTarget),
                done: Boolean(phase.done),
              })
            })
            const activePhaseId = existingLessonPlan.activePhaseId
            const hasActive = activePhaseId && normalizedPhases.some((phase) => phase.id === activePhaseId)
            migrated = {
              ...migrated,
              lessonPlan: {
                phases: normalizedPhases,
                activePhaseId: hasActive ? activePhaseId : normalizedPhases[0]?.id,
                showProgress:
                  typeof existingLessonPlan.showProgress === 'boolean'
                    ? existingLessonPlan.showProgress
                    : true,
              },
            }
          }
        }

        if (version < 10) {
          const existingSeating = (migrated as Partial<BoardState>).seating
          if (!existingSeating || !Array.isArray(existingSeating.seats) || !existingSeating.seats.length) {
            migrated = {
              ...migrated,
              seating: createSeatingState(),
            }
          } else {
            const safeRows = clampSeatingRows(existingSeating.rows)
            const safeColumns = clampSeatingColumns(existingSeating.columns)
            const students = existingSeating.seats
              .map((seat) => seat?.student)
              .filter((name): name is string => Boolean(name))
            migrated = {
              ...migrated,
              seating: {
                rows: safeRows,
                columns: safeColumns,
                seats: createSeatGrid(safeRows, safeColumns, students),
                lastUpdated: Date.now(),
              },
            }
          }
        }

        if (version < 11) {
          const existingExitTicket = (migrated as Partial<BoardState>).exitTicket
          const ensureOptions = (options?: ExitTicketOption[]) =>
            Array.isArray(options) && options.length >= 3
              ? options.map((option) => ({
                  id: option.id ?? makeId(),
                  label: option.label ?? 'Svar',
                  description: option.description,
                  count: option.count ?? 0,
                }))
              : createExitTicketState().options
          const normalizedExitTicket = existingExitTicket
            ? {
                question: existingExitTicket.question || DEFAULT_EXIT_TICKET_QUESTION,
                options: ensureOptions(existingExitTicket.options),
                totalResponses: existingExitTicket.totalResponses ?? 0,
                lastSharedAt: existingExitTicket.lastSharedAt,
              }
            : createExitTicketState()
          migrated = {
            ...migrated,
            exitTicket: normalizedExitTicket,
            soundMeter: createSoundMeterState(),
          }
        }

        if (version < 12) {
          const existingSoundMeter = (migrated as Partial<BoardState>).soundMeter as
            | (SoundMeterState & { message?: string | null })
            | undefined
          migrated = {
            ...migrated,
            soundMeter: existingSoundMeter
              ? {
                  ...createSoundMeterState(),
                  ...existingSoundMeter,
                  message: existingSoundMeter.message ?? null,
                }
              : createSoundMeterState(),
          }
        }

        if (version < 13) {
          const classLists = migrated.classLists ?? initialClassLists
          const legacySeating = (migrated as Partial<BoardState>).seating as SeatingState | LegacySeatingState | undefined
          const seating = legacySeating && 'seatingPlansByClassId' in legacySeating
            ? legacySeating
            : migrateLegacySeatingState(legacySeating as LegacySeatingState | undefined, classLists)
          migrated = {
            ...migrated,
            seating,
          }
        }

        return migrated
      },
    },
  ),
)

export const getActiveStudents = (state: Pick<BoardState, 'classLists'>) => {
  const active = state.classLists.lists.find((item) => item.id === state.classLists.activeId)
  return active ? active.students : []
}
