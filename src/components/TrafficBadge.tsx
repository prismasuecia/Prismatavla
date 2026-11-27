import { useBoardStore, type TrafficNorm } from '../store/useBoardStore'
import { BookOpen, UsersRound, MessagesSquare } from 'lucide-react'

const LABELS: Record<TrafficNorm, string> = {
  tyst: 'Tyst arbete',
  viska: 'Låg röst',
  prata: 'Gruppsamtal',
}

export function TrafficBadge() {
  const traffic = useBoardStore((state) => state.traffic)
  const actions = useBoardStore((state) => state.actions)
  const Icon = traffic === 'tyst' ? BookOpen : traffic === 'viska' ? UsersRound : MessagesSquare

  const cycle = () => {
    const order: TrafficNorm[] = ['tyst', 'viska', 'prata']
    const next = order[(order.indexOf(traffic) + 1) % order.length]
    actions.setTrafficNorm(next)
  }

  return (
    <div
      className={`traffic-badge traffic-${traffic}`}
      data-norm={traffic}
      onClick={cycle}
      role="button"
      tabIndex={0}
      aria-label={`Samtalsnivå: ${LABELS[traffic]}. Klicka för att byta.`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle() } }}
    >
      <Icon size={32} strokeWidth={1.8} aria-hidden="true" />
      <div><span>Samtalsnivå</span><strong>{LABELS[traffic]}</strong></div>
    </div>
  )
}
