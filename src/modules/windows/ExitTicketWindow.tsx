import { useMemo } from 'react'
import { useBoardStore, type ExitTicketState } from '../../store/useBoardStore'

const QUESTION_PRESETS = [
  'Hur trygg känner du dig med dagens mål?',
  'Vilken del behöver vi repetera i nästa lektion?',
  'Hur redo är du att börja på egen hand?',
]

export function ExitTicketWindow() {
  const exitTicket = useBoardStore((state) => state.exitTicket)
  const actions = useBoardStore((state) => state.actions)
  const questionSummary = useMemo(() => summarizeOptions(exitTicket), [exitTicket])

  if (!exitTicket) {
    return (
      <div className="panel-card">
        <p className="eyebrow">Exit ticket</p>
        <p>Laddar svarsmall...</p>
      </div>
    )
  }

  const totalResponses = exitTicket.totalResponses

  const handlePreset = (text: string) => actions.setExitTicketQuestion(text)

  return (
    <div className="exit-ticket-window">
      <header className="lesson-plan-header">
        <div>
          <p className="eyebrow">Exit ticket</p>
          <h2>Snabb temperatur</h2>
          <p className="exit-ticket-status">
            {totalResponses ? `${totalResponses} svar registrerade` : 'Inga svar ännu'}
          </p>
        </div>
        <div className="exit-ticket-controls">
          <button type="button" className="toolbar-btn outline" onClick={actions.resetExitTicket}>
            Nollställ svar
          </button>
          <button type="button" className="toolbar-btn" onClick={actions.shareExitTicketToInstructions} disabled={!totalResponses}>
            Visa i instruktionen
          </button>
        </div>
      </header>

      <div className="exit-ticket-question">
        <label>
          Fråga till klassen
          <textarea
            value={exitTicket.question}
            onChange={(event) => actions.setExitTicketQuestion(event.target.value)}
            rows={2}
          />
        </label>
        <div className="preset-row">
          {QUESTION_PRESETS.map((preset) => (
            <button key={preset} type="button" className="ghost-btn" onClick={() => handlePreset(preset)}>
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="exit-ticket-options">
        {exitTicket.options.map((option) => {
          const percentage = totalResponses ? Math.round((option.count / totalResponses) * 100) : 0
          return (
            <div key={option.id} className="exit-ticket-card">
              <button type="button" className="exit-ticket-button" onClick={() => actions.submitExitTicketResponse(option.id)}>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
              <div className="exit-ticket-meter">
                <span style={{ width: `${percentage}%` }} />
              </div>
              <div className="exit-ticket-meta">
                <input
                  type="text"
                  value={option.label}
                  onChange={(event) => actions.setExitTicketOptionLabel(option.id, event.target.value)}
                  aria-label={`Label för ${option.label}`}
                />
                <span>
                  {option.count} svar • {percentage}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="exit-ticket-summary">
        <p>{questionSummary}</p>
      </div>
    </div>
  )
}

function summarizeOptions(exitTicket: ExitTicketState | undefined) {
  if (!exitTicket || !exitTicket.totalResponses) {
    return 'Sammanfattning visas när svar har samlats in.'
  }
  const parts = exitTicket.options.map((option) => {
    const percentage = exitTicket.totalResponses
      ? Math.round((option.count / exitTicket.totalResponses) * 100)
      : 0
    return `${option.label}: ${percentage}%`
  })
  return parts.join(' · ')
}
