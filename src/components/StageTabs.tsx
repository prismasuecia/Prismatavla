import clsx from 'clsx'
import type { StageId } from '../state/AppStateProvider.tsx'

const STAGES: { id: StageId; label: string; helper: string }[] = [
  { id: 'timer', label: 'Timer', helper: 'Tempo & ring' },
  { id: 'wheel', label: 'Tur i tur', helper: 'Namn-hjul' },
  { id: 'turns', label: 'Talrunda', helper: 'Kö & logg' },
  { id: 'groups', label: 'Arbetsgrupper', helper: 'Skapa lag' },
]

interface StageTabsProps {
  activeStage: StageId
  onChange: (stage: StageId) => void
}

export function StageTabs({ activeStage, onChange }: StageTabsProps) {
  return (
    <div className="stage-tabs" role="tablist" aria-label="Modulval">
      {STAGES.map((stage) => (
        <button
          key={stage.id}
          type="button"
          className={clsx('stage-tab', { active: activeStage === stage.id })}
          role="tab"
          aria-selected={activeStage === stage.id}
          onClick={() => onChange(stage.id)}
        >
          <span className="stage-label">{stage.label}</span>
          <span className="stage-helper">{stage.helper}</span>
        </button>
      ))}
    </div>
  )
}
