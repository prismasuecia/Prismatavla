import { useBoardStore, type TrafficNorm } from '../store/useBoardStore'

const LABELS: Record<TrafficNorm, string> = {
  tyst: 'Tyst',
  viska: 'Viska',
  prata: 'Prata',
}

export function TrafficBadge() {
  const traffic = useBoardStore((state) => state.traffic)

  return (
    <div className={`traffic-badge traffic-${traffic}`}>
      <span>Ljudnivå</span>
      <strong>{LABELS[traffic]}</strong>
    </div>
  )
}
