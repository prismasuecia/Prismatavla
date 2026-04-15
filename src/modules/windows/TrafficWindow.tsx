import { useBoardStore, type TrafficNorm } from '../../store/useBoardStore'

const OPTIONS: { id: TrafficNorm; label: string; description: string }[] = [
  { id: 'tyst', label: 'Tyst', description: 'Ingen pratar' },
  { id: 'viska', label: 'Viska', description: 'Låg röst' },
  { id: 'prata', label: 'Prata', description: 'Samtalston' },
]

export function TrafficWindow() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)

  return (
    <div className="traffic-window">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === traffic ? 'active' : ''}
          onClick={() => actions.setTrafficNorm(option.id)}
        >
          <span>{option.label}</span>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  )
}
