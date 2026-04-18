import { useEffect, useState } from 'react'

const DAYS = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag']
const MONTHS = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']

export function ClockWindow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const blink = now.getSeconds() % 2 === 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      height: '100%',
      gap: 6,
      padding: '16px',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'capitalize' }}>
        {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 60,
        fontWeight: 300,
        color: 'var(--text-primary)',
        letterSpacing: '-0.04em',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'baseline',
      }}>
        <span>{hh}</span>
        <span style={{ opacity: blink ? 1 : 0.2, transition: 'opacity 80ms', margin: '0 1px', color: 'var(--text-tertiary)' }}>:</span>
        <span>{mm}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 300, color: 'var(--text-tertiary)', marginLeft: 6, marginBottom: 4 }}>{ss}</span>
      </div>
    </div>
  )
}
