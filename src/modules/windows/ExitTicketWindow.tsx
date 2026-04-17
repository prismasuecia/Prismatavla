import { useMemo } from 'react'
import { useBoardStore, type ExitTicketState } from '../../store/useBoardStore'

const PRESETS = [
  'Hur trygg känner du dig med dagens mål?',
  'Vilken del behöver vi repetera nästa lektion?',
  'Hur redo är du att börja på egen hand?',
]

export function ExitTicketWindow() {
  const exitTicket = useBoardStore((state) => state.exitTicket)
  const actions = useBoardStore((state) => state.actions)

  if (!exitTicket) return null

  const total = exitTicket.totalResponses

  const s: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Fråga */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, ...s }}>
          Fråga till klassen
        </div>
        <textarea
          value={exitTicket.question}
          onChange={(e) => actions.setExitTicketQuestion(e.target.value)}
          rows={2}
          placeholder="Skriv din fråga..."
          style={{ width: '100%', border: 'none', background: 'transparent', resize: 'none', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', outline: 'none', lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {PRESETS.map(p => (
            <button key={p} type="button" onClick={() => actions.setExitTicketQuestion(p)}
              style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'all 120ms ease' }}>
              {p.substring(0, 28)}…
            </button>
          ))}
        </div>
      </div>

      {/* Svarsalternativ */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {exitTicket.options.map((opt) => {
          const pct = total ? Math.round((opt.count / total) * 100) : 0
          return (
            <div key={opt.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <input
                  value={opt.label}
                  onChange={(e) => actions.setExitTicketOptionLabel(opt.id, e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                />
                {/* Progress bar */}
                <div style={{ height: 4, background: 'var(--surface-secondary)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: 2, transition: 'width 300ms ease' }} />
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {opt.count} · {pct}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Botten */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', flex: 1 }}>
          {total ? total + ' svar' : 'Inga svar ännu'}
        </div>
        <button type="button" onClick={actions.resetExitTicket}
          style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Nollställ
        </button>
        <button type="button" onClick={actions.shareExitTicketToInstructions} disabled={!total}
          style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: 'none', background: total ? 'var(--accent)' : 'var(--surface-secondary)', color: total ? '#fff' : 'var(--text-tertiary)', fontSize: 'var(--text-xs)', cursor: total ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          Visa i instruktion
        </button>
      </div>
    </div>
  )
}
