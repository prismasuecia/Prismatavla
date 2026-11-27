import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'

const KEYS = ['prisma_tavla_v2', 'turitur:state', 'turitur:classes', 'arbetsgrupper:saves', 'arbetsgrupper:last', 'prisma-teacher-poll']

export function BackupControls() {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const exportBackup = () => {
    try {
      const entries = Object.fromEntries(KEYS.map((key) => [key, localStorage.getItem(key)]))
      const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'Prisma Tavla', version: 1, entries }, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `prisma-tavla-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setMessage('Säkerhetskopian har hämtats.')
    } catch { setMessage('Kunde inte skapa säkerhetskopian.') }
  }
  const restore = async (file: File) => {
    try {
      if (file.size > 10_000_000) throw new Error('För stor fil.')
      const backup = JSON.parse(await file.text())
      if (backup.app !== 'Prisma Tavla' || backup.version !== 1 || !backup.entries ||
        !KEYS.every((key) => Object.hasOwn(backup.entries, key))) throw new Error('Ogiltig säkerhetskopia.')
      for (const key of KEYS) {
        const value = backup.entries[key]
        if (value !== null) {
          if (typeof value !== 'string') throw new Error('Ogiltig säkerhetskopia.')
          const parsed = JSON.parse(value)
          if (!parsed || typeof parsed !== 'object') throw new Error('Ogiltig säkerhetskopia.')
          if (key === 'prisma_tavla_v2' && (!parsed.state?.classLists?.lists || !parsed.state?.moduleWindows)) throw new Error('Ogiltig tavla.')
        }
      }
      if (!window.confirm('Ersätt nuvarande tavla med säkerhetskopian? Spara en säkerhetskopia först om du vill behålla nuvarande arbete.')) return
      const previous = KEYS.map((key) => [key, localStorage.getItem(key)] as const)
      try {
        for (const key of KEYS) {
          const value = backup.entries[key]
          if (value === null) localStorage.removeItem(key)
          else localStorage.setItem(key, value)
        }
      } catch (error) {
        for (const [key, value] of previous) {
          if (value === null) localStorage.removeItem(key)
          else localStorage.setItem(key, value)
        }
        throw error
      }
      window.location.reload()
    } catch { setMessage('Kunde inte återställa filen. Kontrollera att den är en säkerhetskopia från Prisma Tavla.') }
  }
  return <section style={{ padding: 16, borderTop: '1px solid var(--border-subtle)' }} aria-label="Säkerhetskopia">
    <strong>Säkerhetskopia</strong>
    <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '8px 0' }}>
      Spara dina klasslistor, sittplaner och förberedelser i en fil. Med filen kan du återställa ditt arbete eller flytta det till en annan dator.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <button type="button" onClick={exportBackup}><Download size={16} /> Hämta säkerhetskopia</button>
      <button type="button" onClick={() => input.current?.click()}><Upload size={16} /> Återställ från fil</button>
    </div>
    <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void restore(file)
    }} />
    <p role="status">{message}</p>
  </section>
}
