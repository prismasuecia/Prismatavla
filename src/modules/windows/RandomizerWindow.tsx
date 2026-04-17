import { useBoardStore, getActiveStudents } from '../../store/useBoardStore'

export function RandomizerWindow() {
  const classLists = useBoardStore((state) => state.classLists)
  const actions = useBoardStore((state) => state.actions)
  const students = getActiveStudents(classLists)
  const activeList = classLists.lists.find(l => l.id === classLists.activeId)

  const pick = () => {
    if (students.length === 0) return
    const idx = Math.floor(Math.random() * students.length)
    actions.setRandomResult(students[idx])
  }

  const result = useBoardStore((state) => state.randomResult)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32, gap: 24, textAlign: 'center' }}>

      {result ? (
        <div style={{ fontSize: 48, fontWeight: 300, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {result}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          {students.length === 0
            ? 'Lägg till elever via Tur i tur eller Klasslista'
            : `${students.length} elever i ${activeList?.name ?? 'aktiv lista'}`}
        </div>
      )}

      <button
        type="button"
        onClick={pick}
        disabled={students.length === 0}
        style={{
          padding: '11px 32px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: students.length === 0 ? 'var(--surface-secondary)' : 'var(--accent)',
          color: students.length === 0 ? 'var(--text-tertiary)' : '#fff',
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          cursor: students.length === 0 ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'all 200ms ease',
        }}
      >
        {result ? 'Välj igen' : 'Välj slumpmässigt'}
      </button>

      {activeList && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
          {activeList.name} · {students.length} elever
        </div>
      )}
    </div>
  )
}
