import { useBoardStore, type ThemeId } from '../../store/useBoardStore'

const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: 'aurora', label: 'Aurora', description: 'Sand + mint' },
  { id: 'skiffer', label: 'Skiffer', description: 'Mörk tavla' },
  { id: 'krita', label: 'Krita', description: 'Ljus tavla' },
]

export function BackgroundWindow() {
  const theme = useBoardStore((state) => state.theme)
  const actions = useBoardStore((state) => state.actions)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {THEMES.map((t, i) => (
        <button
          key={t.id}
          type="button"
          onClick={() => actions.setTheme(t.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '13px 16px',
            borderBottom: i < THEMES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            border: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            background: theme === t.id ? 'var(--accent-muted)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            transition: 'background 120ms ease',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={e => {
            if (theme !== t.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = theme === t.id ? 'var(--accent-muted)' : 'transparent';
          }}
        >
          <span style={{
            fontSize: 'var(--text-base)',
            fontWeight: theme === t.id ? 500 : 400,
            color: theme === t.id ? 'var(--accent)' : 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          }}>
            {t.label}
          </span>
          <span style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans)',
          }}>
            {t.description}
          </span>
        </button>
      ))}
    </div>
  )
}
