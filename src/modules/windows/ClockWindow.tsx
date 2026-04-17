import { useEffect, useState } from 'react'

export function ClockWindow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  const ss = now.getSeconds().toString().padStart(2, '0')

  const days = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag']
  const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']
  const dayName = days[now.getDay()]
  const dateStr = `${now.getDate()} ${months[now.getMonth()]}`

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '24px 32px',
      gap: 8,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 56,
        fontWeight: 400,
        color: 'var(--text-primary)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: 2,
      }}>
        <span>{hh}</span>
        <span style={{ color: 'var(--text-tertiary)', animation: 'blink 1s step-end infinite' }}>:</span>
        <span>{mm}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 32, marginLeft: 8 }}>{ss}</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.02em',
        textTransform: 'capitalize',
      }}>
        {dayName} {dateStr}
      </div>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
