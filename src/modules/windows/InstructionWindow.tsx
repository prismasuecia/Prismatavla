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
    <div className="instruction-window">
      <div className="instruction-toolbar">
        <div className="preset-buttons">
          {Object.entries(PRESETS).map(([label, text]) => (
            <button key={label} type="button" onClick={() => actions.applyInstructionPreset(text)}>
              {label}
            </button>
          ))}
        </div>
        <label className="lock-toggle">
          <input
            type="checkbox"
            checked={instructions.locked}
            onChange={(event) => actions.lockInstructions(event.target.checked)}
          />
          Lås text
        </label>
      </div>
      <textarea
        value={instructions.text}
        onChange={(event) => actions.setInstructionText(event.target.value)}
        disabled={instructions.locked}
        rows={8}
      />
    </div>
  )
}
