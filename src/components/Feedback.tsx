import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageSquare, Send, X } from 'lucide-react'

export function Feedback() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (status === 'sending') return
    if (!message.trim()) { setError('Skriv ett meddelande först.'); setStatus('error'); return }
    setStatus('sending')
    setError('')
    const controller = new AbortController()
    request.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const authUrl = import.meta.env.VITE_POLL_AUTH_URL
      const endpoint = import.meta.env.VITE_FEEDBACK_URL || (authUrl ? new URL('/feedback', authUrl).href : '')
      if (!endpoint) throw new Error('Feedback är inte aktiverat ännu. Ditt meddelande finns kvar här.')
      const url = new URL(endpoint)
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Feedback kräver en säker anslutning.')
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal,
        body: JSON.stringify({ message: message.trim(), email: email.trim(), website }),
      })
      if (!response.ok) throw new Error(response.status === 429
        ? 'För många försök just nu. Vänta en minut och försök igen.'
        : 'Meddelandet kunde inte skickas. Texten finns kvar så att du kan försöka igen.')
      const result = await response.json()
      if (result.sent !== true) throw new Error('Meddelandet kunde inte bekräftas. Texten finns kvar.')
      setStatus('sent'); setMessage(''); setEmail(''); setWebsite('')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Anslutningen tog för lång tid. Texten finns kvar; försök igen.')
    } finally { window.clearTimeout(timeout); request.current = null }
  }

  return <>
    <button className="board-feedback" type="button" onClick={() => { if (status === 'sent') setStatus('idle'); dialog.current?.showModal() }}><MessageSquare size={18} aria-hidden="true" />Lämna feedback</button>
    <dialog className="feedback-dialog" ref={dialog} aria-labelledby="feedback-heading" onCancel={(event) => { if (status === 'sending') event.preventDefault() }}>
      <header><h2 id="feedback-heading">Lämna feedback</h2><button type="button" aria-label="Stäng feedback" title="Stäng" disabled={status === 'sending'} onClick={() => dialog.current?.close()}><X size={22} /></button></header>
      {status === 'sent' ? <div className="feedback-success"><p role="status">Tack! Ditt meddelande har skickats.</p><button type="button" onClick={() => dialog.current?.close()}>Klart</button></div> : <form onSubmit={submit} aria-busy={status === 'sending'}>
        <p id="feedback-privacy">Skriv inte elevnamn eller känsliga personuppgifter.</p>
        <label htmlFor="feedback-message">Ditt meddelande</label>
        <textarea id="feedback-message" required maxLength={4000} rows={7} value={message} disabled={status === 'sending'} onChange={(event) => setMessage(event.target.value)} aria-describedby="feedback-privacy" />
        <label htmlFor="feedback-email">Din e-post <span>(frivilligt, om du vill ha svar)</span></label>
        <input id="feedback-email" type="email" autoComplete="email" maxLength={254} value={email} disabled={status === 'sending'} onChange={(event) => setEmail(event.target.value)} />
        <div className="feedback-trap" aria-hidden="true"><label htmlFor="feedback-website">Webbplats</label><input id="feedback-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
        <p className="feedback-processing">Meddelandet och eventuell e-postadress skickas till Prisma Tavlas ansvarige via Cloudflare och Resend.</p>
        {status === 'error' && <p role="alert">{error}</p>}
        <footer><button type="button" disabled={status === 'sending'} onClick={() => dialog.current?.close()}>Avbryt</button><button type="submit" className="feedback-submit" disabled={status === 'sending'}><Send size={17} aria-hidden="true" />{status === 'sending' ? 'Skickar…' : 'Skicka feedback'}</button></footer>
      </form>}
    </dialog>
  </>
}
