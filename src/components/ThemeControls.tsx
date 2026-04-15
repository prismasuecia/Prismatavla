import clsx from 'clsx'
import type { ThemeId } from '../state/AppStateProvider.tsx'

const THEMES: { id: ThemeId; title: string; lead: string }[] = [
  { id: 'aurora', title: 'Aurora', lead: 'Sand & mint' },
  { id: 'slate', title: 'Skiffer', lead: 'Koppar & blå' },
  { id: 'chalk', title: 'Krita', lead: 'Mörk tavla' },
]

interface ThemeControlsProps {
  theme: ThemeId
  projectorMode: boolean
  onThemeChange: (theme: ThemeId) => void
  onProjectorToggle: () => void
}

export function ThemeControls({
  theme,
  projectorMode,
  onThemeChange,
  onProjectorToggle,
}: ThemeControlsProps) {
  return (
    <div className="theme-controls">
      <div className="theme-switcher" role="radiogroup" aria-label="Teman">
        {THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx('theme-pill', { active: theme === item.id })}
            role="radio"
            aria-checked={theme === item.id}
            onClick={() => onThemeChange(item.id)}
          >
            <span className="pill-title">{item.title}</span>
            <span className="pill-helper micro-icon">{item.lead}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={clsx('projector-toggle', { active: projectorMode })}
        onClick={onProjectorToggle}
      >
        Projektorläge
        <span className="pill-helper">{projectorMode ? '120% text' : 'Normal'}</span>
      </button>
    </div>
  )
}
