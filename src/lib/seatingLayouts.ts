export type LayoutType =
  | 'par'
  | 'rutnat'
  | 'rader'
  | 'grupper4'
  | 'u'
  | 'dubbeltU'
  | 'hastsko'
  | 'bankett'
  | 'konferens'

export interface Seat {
  id: string
  x: number
  y: number
  rotation?: number
  label?: string
}

export interface SeatAssignment {
  seatId: string
  studentId: string | null
}

export interface SeatingPlan {
  id: string
  name: string
  layoutType: LayoutType
  seatCount: number
  seats: Seat[]
  assignments: SeatAssignment[]
  lockedSeatIds: string[]
  createdAt: number
  updatedAt: number
}

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  par: 'Par',
  rutnat: 'Rutnät',
  rader: 'Rader',
  grupper4: 'Öar (4)',
  u: 'U-format',
  dubbeltU: 'Dubbelt U',
  hastsko: 'Hästsko',
  bankett: 'Bankett',
  konferens: 'Konferens',
}

interface SeatPosition {
  x: number
  y: number
  rotation?: number
  label?: string
}

const clamp = (value: number) => Math.max(4, Math.min(96, value))

const roundTo = (value: number, precision = 2) =>
  Math.round(value * 10 ** precision) / 10 ** precision

const normalizeCount = (seatCount: number) => Math.max(1, Math.round(seatCount))

const finalizeSeats = (positions: SeatPosition[], seatCount: number): Seat[] => {
  const total = normalizeCount(seatCount)
  const limited = positions.slice(0, total)
  return limited.map((position, index) => ({
    id: `seat-${index + 1}`,
    x: roundTo(clamp(position.x)),
    y: roundTo(clamp(position.y)),
    rotation: position.rotation,
    label: position.label ?? `Plats ${index + 1}`,
  }))
}

const toRange = (count: number) => Array.from({ length: count }, (_unused, index) => index)

export function generatePairsLayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const pairCount = Math.ceil(total / 2)
  const columns = pairCount <= 4 ? 2 : pairCount <= 6 ? 3 : 4
  const rows = Math.ceil(pairCount / columns)
  const colSpacing = 100 / (columns + 1)
  const rowSpacing = 100 / (rows + 1)
  const pairGap = colSpacing * 0.3
  const positions: SeatPosition[] = []
  let processedPairs = 0

  outer: for (const row of toRange(rows)) {
    for (const column of toRange(columns)) {
      if (processedPairs >= pairCount) {
        break outer
      }
      const centerX = colSpacing * (column + 1)
      const centerY = rowSpacing * (row + 1)
      positions.push({ x: centerX - pairGap * 0.5, y: centerY })
      if (positions.length >= total) {
        break outer
      }
      positions.push({ x: centerX + pairGap * 0.5, y: centerY })
      processedPairs += 1
    }
  }

  return finalizeSeats(positions, total)
}

export function generateGridLayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const presets: Record<number, number> = { 12: 4, 16: 4, 20: 5, 24: 6, 28: 7, 32: 8 }
  const columns = presets[total] ?? Math.max(3, Math.round(Math.sqrt(total)))
  const rows = Math.ceil(total / columns)
  const colSpacing = 100 / (columns + 1)
  const rowSpacing = 100 / (rows + 1)
  const positions: SeatPosition[] = []

  for (const row of toRange(rows)) {
    for (const column of toRange(columns)) {
      if (positions.length >= total) {
        break
      }
      positions.push({ x: colSpacing * (column + 1), y: rowSpacing * (row + 1) })
    }
  }

  return finalizeSeats(positions, total)
}

export function generateRowsLayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const columns = Math.min(12, Math.max(5, Math.ceil(total / 2.2)))
  const rows = Math.ceil(total / columns)
  const colSpacing = 100 / (columns + 1)
  const rowSpacing = 100 / (rows + 1.5)
  const positions: SeatPosition[] = []

  for (const row of toRange(rows)) {
    const offset = (row % 2 === 0 ? 0 : colSpacing * 0.35)
    for (const column of toRange(columns)) {
      if (positions.length >= total) {
        break
      }
      positions.push({ x: colSpacing * (column + 1) - offset, y: rowSpacing * (row + 1) + 4 })
    }
  }

  return finalizeSeats(positions, total)
}

export function generateGroups4Layout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const groupCount = Math.ceil(total / 4)
  const columns = Math.ceil(Math.sqrt(groupCount))
  const rows = Math.ceil(groupCount / columns)
  const colSpacing = 100 / (columns + 1)
  const rowSpacing = 100 / (rows + 1)
  const dx = colSpacing * 0.25
  const dy = rowSpacing * 0.25
  const offsets: SeatPosition[] = [
    { x: -dx, y: -dy },
    { x: dx, y: -dy },
    { x: dx, y: dy },
    { x: -dx, y: dy },
  ]
  const positions: SeatPosition[] = []
  let processedGroups = 0

  outer: for (const row of toRange(rows)) {
    for (const column of toRange(columns)) {
      if (processedGroups >= groupCount) {
        break outer
      }
      const centerX = colSpacing * (column + 1)
      const centerY = rowSpacing * (row + 1)
      offsets.forEach((offset, offsetIndex) => {
        if (positions.length >= total) {
          return
        }
        const labelSuffix = ['A', 'B', 'C', 'D'][offsetIndex] ?? 'A'
        positions.push({ x: centerX + offset.x, y: centerY + offset.y, label: `Bord ${processedGroups + 1}${labelSuffix}` })
      })
      processedGroups += 1
    }
  }

  return finalizeSeats(positions, total)
}

const buildUPath = (seatCount: number, bounds: { left: number; right: number; top: number; bottom: number }) => {
  const total = normalizeCount(seatCount)
  const verticalCount = Math.max(2, Math.round(total * 0.33))
  const remaining = Math.max(2, total - verticalCount * 2)
  const leftSpacing = (bounds.bottom - bounds.top) / (verticalCount + 1)
  const rightSpacing = leftSpacing
  const bottomSpacing = (bounds.right - bounds.left) / (remaining + 1)
  const positions: SeatPosition[] = []

  for (const index of toRange(verticalCount)) {
    if (positions.length >= total) {
      return positions
    }
    positions.push({ x: bounds.left, y: bounds.top + leftSpacing * (index + 1) })
  }

  for (const index of toRange(remaining)) {
    if (positions.length >= total) {
      return positions
    }
    positions.push({ x: bounds.left + bottomSpacing * (index + 1), y: bounds.bottom })
  }

  for (const index of toRange(verticalCount)) {
    if (positions.length >= total) {
      return positions
    }
    positions.push({ x: bounds.right, y: bounds.bottom - rightSpacing * (index + 1) })
  }

  return positions.slice(0, total)
}

export function generateUShapeLayout(seatCount: number): Seat[] {
  const positions = buildUPath(seatCount, { left: 18, right: 82, top: 12, bottom: 88 })
  return finalizeSeats(positions, seatCount)
}

export function generateDoubleULayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const outerCount = Math.min(total, Math.max(6, Math.round(total * 0.6)))
  const innerCount = Math.max(0, total - outerCount)
  const outer = buildUPath(outerCount, { left: 14, right: 86, top: 10, bottom: 90 })
  const inner = innerCount ? buildUPath(innerCount, { left: 32, right: 68, top: 28, bottom: 72 }) : []
  return finalizeSeats([...outer, ...inner], total)
}

export function generateHorseshoeLayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const positions: SeatPosition[] = []
  const startAngle = (210 * Math.PI) / 180
  const endAngle = (330 * Math.PI) / 180
  const angleRange = startAngle - endAngle
  const radius = 38
  const centerX = 50
  const centerY = 60

  for (const index of toRange(total)) {
    const t = total === 1 ? 0 : index / (total - 1)
    const angle = startAngle - angleRange * t
    positions.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      rotation: (angle * 180) / Math.PI,
    })
  }

  return finalizeSeats(positions, total)
}

export function generateBanquetLayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const topCount = Math.ceil(total / 2)
  const bottomCount = total - topCount
  const columns = Math.max(topCount, bottomCount)
  const spacing = 100 / (columns + 1)
  const positions: SeatPosition[] = []

  for (const index of toRange(topCount)) {
    positions.push({ x: spacing * (index + 1), y: 35, rotation: 0 })
  }

  for (const index of toRange(bottomCount)) {
    positions.push({ x: spacing * (index + 1), y: 65, rotation: 180 })
  }

  return finalizeSeats(positions, total)
}

export function generateConferenceLayout(seatCount: number): Seat[] {
  const total = normalizeCount(seatCount)
  const base = Math.max(2, Math.floor(total / 4))
  const counts = [base, base, base, base]
  for (let index = 0; index < total % 4; index += 1) {
    counts[index] += 1
  }
  const bounds = { left: 18, right: 82, top: 18, bottom: 82 }
  const positions: SeatPosition[] = []

  const pushLine = (
    length: number,
    axis: 'horizontal' | 'vertical',
    fixed: number,
    start: number,
    end: number,
    skipFirst: boolean,
  ) => {
    if (length <= 0) {
      return
    }
    const segments = length + 1
    for (let index = 1; index <= length; index += 1) {
      if (skipFirst && index === 1) {
        continue
      }
      if (axis === 'horizontal') {
        positions.push({ x: start + ((end - start) / segments) * index, y: fixed })
      } else {
        positions.push({ x: fixed, y: start + ((end - start) / segments) * index })
      }
    }
  }

  pushLine(counts[0], 'horizontal', bounds.top, bounds.left, bounds.right, false)
  pushLine(counts[1], 'vertical', bounds.right, bounds.top, bounds.bottom, true)
  pushLine(counts[2], 'horizontal', bounds.bottom, bounds.right, bounds.left, true)
  pushLine(counts[3], 'vertical', bounds.left, bounds.bottom, bounds.top, true)

  return finalizeSeats(positions, total)
}

export function generateLayout(layoutType: LayoutType, seatCount: number): Seat[] {
  switch (layoutType) {
    case 'par':
      return generatePairsLayout(seatCount)
    case 'rutnat':
      return generateGridLayout(seatCount)
    case 'rader':
      return generateRowsLayout(seatCount)
    case 'grupper4':
      return generateGroups4Layout(seatCount)
    case 'u':
      return generateUShapeLayout(seatCount)
    case 'dubbeltU':
      return generateDoubleULayout(seatCount)
    case 'hastsko':
      return generateHorseshoeLayout(seatCount)
    case 'bankett':
      return generateBanquetLayout(seatCount)
    case 'konferens':
    default:
      return generateConferenceLayout(seatCount)
  }
}

