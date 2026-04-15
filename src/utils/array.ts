export function shuffleList<T>(source: T[]): T[] {
  const list = [...source]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

export function chunkBySize<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items]
  }
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }
  return groups.filter((group) => group.length)
}

export function chunkIntoCount<T>(items: T[], count: number): T[][] {
  if (count <= 0) {
    return [items]
  }
  const baseSize = Math.ceil(items.length / count)
  return chunkBySize(items, baseSize)
}

export function formatGroups(groups: string[][]): string {
  return groups
    .map((group, index) => `Grupp ${index + 1}: ${group.join(', ')}`)
    .join('\n')
}
