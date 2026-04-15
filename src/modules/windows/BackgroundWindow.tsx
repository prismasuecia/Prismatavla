import { useBoardStore, type ThemeId } from '../../store/useBoardStore'

const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: 'aurora', label: 'Aurora', description: 'Sand + mint' },
  { id: 'skiffer', label: 'Skiffer', description: 'Mörk tavla' },
  { id: 'krita', label: 'Krita', description: 'Ljus tavla' },
]

export function BackgroundWindow() {
  const currentTheme = useBoardStore((state) => state.theme)
  const actions = useBoardStore((state) => state.actions)

  return (
    <div className="background-window">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className={theme.id === currentTheme ? 'active' : ''}
          onClick={() => actions.setTheme(theme.id)}
        >
          <span>{theme.label}</span>
          <small>{theme.description}</small>
        </button>
      ))}
    </div>
  )
}
