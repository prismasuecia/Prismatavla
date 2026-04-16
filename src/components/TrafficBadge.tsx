import { useBoardStore, type TrafficNorm } from '../store/useBoardStore'

const LABELS: Record<TrafficNorm, string> = {
  tyst: 'Tyst',
  viska: 'Viska',
  prata: 'Prata',
}

export function TrafficBadge() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)

  const cycle = () => {
    const order: TrafficNorm[] = ['tyst', 'viska', 'prata']
    const next = order[(order.indexOf(traffic) + 1) % order.length]
    actions.setTraffic(next)
  }

  return (
    <div
      className={`traffic-badge traffic-${traffic}`}
      data-norm={traffic}
      onClick={cycle}
      role="button"
      tabIndex={0}
      aria-label={`Ljudnivå: ${LABELS[traffic]}. Klicka för att byta.`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') cycle() }}
    >
      <span>Ljudnivå</span>
      <strong>{LABELS[traffic]}</strong>
    </div>
  )
}
