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
  const blink = now.getSeconds() % 2 === 0

  const days = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag']
  const months = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december']
  const dayName = days[now.getDay()]
  const dateStr = now.getDate() + ' ' + months[now.getMonth()]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      height: '100%',
      gap: 8,
      padding: '20px 32px',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Dag + datum */}
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
        fontWeight: 400,
      }}>
        {dayName} {dateStr}
      </div>

      {/* Klocka */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 64,
        fontWeight: 300,
        color: 'var(--text-primary)',
        letterSpacing: '-0.04em',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: 0,
      }}>
        <span>{hh}</span>
        <span style={{
          opacity: blink ? 1 : 0.2,
          transition: 'opacity 80ms ease',
          margin: '0 2px',
          color: 'var(--text-tertiary)',
        }}>:</span>
        <span>{mm}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 28,
          fontWeight: 300,
          color: 'var(--text-tertiary)',
          marginLeft: 8,
          letterSpacing: '-0.02em',
          alignSelf: 'flex-end',
          marginBottom: 6,
        }}>{ss}</span>
      </div>

      {/* Vecka */}
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.06em',
        fontWeight: 500,
        textTransform: 'uppercase',
      }}>
        Vecka {getWeekNumber(now)}
      </div>
    </div>
  )
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
