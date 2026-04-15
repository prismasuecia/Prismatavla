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
    <div className="randomizer-window">
      <p>Välj slumpmässigt namn från {activeList.name}</p>
      <button type="button" onClick={() => actions.pickRandomStudent()}>
        Välj slumpmässigt
      </button>
      {randomizer.lastPick && (
        <div className="randomizer-result" aria-live="polite">
          <span>Vald elev</span>
          <strong>{randomizer.lastPick}</strong>
        </div>
      )}
    </div>
  )
}
