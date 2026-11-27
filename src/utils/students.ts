export const parseStudents = (value: string) =>
  value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)

export function distinctStudentNames(students: string[]): string[] {
  const reserved = new Set(students)
  const used = new Set<string>()
  return students.map((name) => {
    if (!used.has(name)) { used.add(name); return name }
    let index = 2
    let label = `${name} (${index})`
    while (used.has(label) || reserved.has(label)) label = `${name} (${++index})`
    used.add(label)
    return label
  })
}
