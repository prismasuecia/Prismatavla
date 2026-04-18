import { useState } from 'react'
import { useBoardStore, getActiveStudents } from '../../store/useBoardStore'
import { ClassListPrompt } from '../../components/ClassListPrompt'

export function RandomizerWindow() {
  const randomizer = useBoardStore((state) => state.randomizer)
  const classState = useBoardStore((state) => state.classLists)
  const actions = useBoardStore((state) => state.actions)
  const [isAnimating, setIsAnimating] = useState(false)

  const students = getActiveStudents({ classLists: classState })
  const activeList = classState.lists.find((list) => list.id === classState.activeId)

  if (!students.length || !activeList) {
    return <ClassListPrompt />
  }

  const handlePick = () => {
    if (isAnimating) return
    setIsAnimating(true)
    actions.pickRandomStudent()
    setTimeout(() => setIsAnimating(false), 400)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      height: '100%',
      padding: '32px 24px',
      gap: 28,
      fontFamily: 'var(--font-sans)',
      textAlign: 'center',
    }}>

      {/* Resultat */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minHeight: 100, justifyContent: 'center' }}>
        {randomizer.lastPick ? (
          <>
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Vald elev
            </div>
            <div style={{
              fontSize: 52,
              fontWeight: 300,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              transition: 'opacity 300ms ease',
              opacity: isAnimating ? 0 : 1,
            }}>
              {randomizer.lastPick}
            </div>
          </>
        ) : (
          <div style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-tertiary)',
            lineHeight: 1.7,
          }}>
            {students.length} elever i<br />
            <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{activeList.name}</strong>
          </div>
        )}
      </div>

      {/* Knapp */}
      <button
        type="button"
        onClick={handlePick}
        disabled={isAnimating}
        style={{
          padding: '12px 36px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          cursor: isAnimating ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'transform 120ms ease, background 120ms ease',
          transform: isAnimating ? 'scale(0.97)' : 'scale(1)',
          boxShadow: '0 2px 12px rgba(45,92,69,0.25)',
        }}
        onMouseEnter={e => { if(!isAnimating) (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
      >
        {randomizer.lastPick ? 'Välj igen' : 'Välj slumpmässigt'}
      </button>

      {/* Info */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
        {activeList.name} · {students.length} elever
      </div>
    </div>
  )
}
