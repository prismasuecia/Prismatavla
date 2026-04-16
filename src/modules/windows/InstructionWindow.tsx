import { Lock, Unlock } from 'lucide-react'
import { useBoardStore } from '../../store/useBoardStore'

const PRESETS = {
  Tystarbete: 'Tystarbete i 10 minuter. Läs tyst och skriv ner tre nyckelord.',
  Pararbete: 'Pararbete: Diskutera frågorna två och två och skriv ner ett gemensamt svar.',
  Diskussion: 'Helklassdiskussion: Räck upp handen, ett inlägg i taget. Lyssna aktivt.',
}

export function InstructionWindow() {
  const instructions = useBoardStore((state) => state.instructions)
  const actions = useBoardStore((state) => state.actions)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        alignItems: 'center',
      }}>
        {Object.entries(PRESETS).map(([label, text]) => (
          <button
            key={label}
            type="button"
            onClick={() => actions.applyInstructionPreset(text)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-medium)',
              background: 'transparent',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = 'transparent';
            }}
          >
            {label}
          </button>
        ))}

        {/* Lock toggle — ersätter HTML checkbox */}
        <button
          type="button"
          onClick={() => actions.lockInstructions(!instructions.locked)}
          aria-pressed={instructions.locked}
          title={instructions.locked ? 'Lås upp text' : 'Lås text'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px 5px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-medium)',
            background: instructions.locked ? 'var(--accent-muted)' : 'transparent',
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            fontWeight: instructions.locked ? 500 : 400,
            color: instructions.locked ? 'var(--accent)' : 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans)',
            marginLeft: 'auto',
            transition: 'all 120ms ease',
          }}
        >
          {instructions.locked
            ? <Lock size={12} aria-hidden="true" />
            : <Unlock size={12} aria-hidden="true" />
          }
          {instructions.locked ? 'Låst' : 'Lås text'}
        </button>
      </div>

      {/* Textyta */}
      <textarea
        value={instructions.text}
        onChange={(event) => actions.setInstructionText(event.target.value)}
        disabled={instructions.locked}
        placeholder="Skriv instruktioner här, eller välj en mall ovan..."
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          background: 'transparent',
          resize: 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-base)',
          lineHeight: 1.65,
          color: instructions.locked ? 'var(--text-tertiary)' : 'var(--text-primary)',
          padding: '16px',
          outline: 'none',
          cursor: instructions.locked ? 'default' : 'text',
          transition: 'color 200ms ease',
        }}
      />
    </div>
  )
}
