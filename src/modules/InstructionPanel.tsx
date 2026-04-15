import type { AppActions, InstructionState } from '../state/AppStateProvider.tsx'

const PRESETS = [
  {
    label: 'Tystarbete',
    text: 'Tyst arbete i femton minuter. Fokusera på egen uppgift och markera behov med handen.',
  },
  {
    label: 'Pararbete',
    text: 'Vänd er mot er partner och jobba två och två. Ställ minst tre frågor innan ni ber om hjälp.',
  },
  {
    label: 'Diskussion',
    text: 'Hela gruppen delar reflektioner i ytterst två minuter vardera. Lyssna aktivt och bygg vidare.',
  },
]

interface InstructionPanelProps {
  instructions: InstructionState
  actions: AppActions['instructions']
}

export function InstructionPanel({ instructions, actions }: InstructionPanelProps) {
  const handleChange = (value: string) => {
    actions.setText(value)
  }

  const applyPreset = (text: string) => {
    actions.setText(text)
  }

  return (
    <div className="module instruction-panel">
      <header className="module-header">
        <p className="eyebrow">Instruktion</p>
        <h2>Samlad blickpunkt</h2>
      </header>
      <div className="preset-row">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => applyPreset(preset.text)}>
            {preset.label}
          </button>
        ))}
      </div>
      <label className="instruction-field">
        <span>Text (visa på tavlan)</span>
        <textarea
          value={instructions.text}
          rows={6}
          onChange={(event) => handleChange(event.target.value)}
          style={{ maxWidth: '48ch' }}
        />
      </label>
      <p className="micro-copy">Linjelängden begränsas för att hålla texten lättläst även från bakre raden.</p>
    </div>
  )
}
