import { useEffect, useState } from 'react'

export function ClockWindow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="clock-window">
      <strong>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
      <span>{now.toLocaleDateString()}</span>
    </div>
  )
}
