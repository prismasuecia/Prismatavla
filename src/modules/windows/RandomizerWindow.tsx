import { useBoardStore, getActiveStudents } from '../../store/useBoardStore'
import { ClassListPrompt } from '../../components/ClassListPrompt'

export function RandomizerWindow() {
  const randomizer = useBoardStore((state) => state.randomizer)
  const classState = useBoardStore((state) => state.classLists)
  const actions = useBoardStore((state) => state.actions)

  const students = getActiveStudents({ classLists: classState })
  const activeList = classState.lists.find((list) => list.id === classState.activeId)

  if (!students.length || !activeList) {
    return <ClassListPrompt />
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: 32,
      gap: 24,
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
    }}>
      {randomizer.lastPick ? (
        <div
          className="randomizer-result"
          aria-live="polite"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Vald elev
          </span>
          <strong style={{
            fontSize: 48,
            fontWeight: 300,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            fontFamily: 'var(--font-sans)',
          }}>
            {randomizer.lastPick}
          </strong>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {students.length} elever i {activeList.name}
        </div>
      )}

      <button
        type="button"
        onClick={() => actions.pickRandomStudent()}
        style={{
          padding: '11px 32px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'background 200ms ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
      >
        {randomizer.lastPick ? 'Välj igen' : 'Välj slumpmässigt'}
      </button>

      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
        {activeList.name} · {students.length} elever
      </div>
    </div>
  )
}
