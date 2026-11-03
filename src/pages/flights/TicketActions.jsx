import { useState } from 'react'
import { CheckCircle2, Download, Loader2, Mail, MessageCircle, Printer } from 'lucide-react'

import { downloadTicket, emailTicket, printTicket, shareTicketWhatsApp } from './ticket.js'

/* The four things a customer does with a fresh e-ticket, all with the same PDF: download, print, send on WhatsApp,
   e-mail. Used on the confirmation page and in My trips. `done` = { orderRef, amount, results, contact, billing? }. */

const ACTIONS = [
  ['download', Download, 'Download PDF', downloadTicket],
  ['print', Printer, 'Print', printTicket],
  ['whatsapp', MessageCircle, 'WhatsApp', shareTicketWhatsApp],
  ['email', Mail, 'E-mail ticket', emailTicket],
]

export default function TicketActions({ done, className = '' }) {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const run = async (id, fn) => {
    setBusy(id); setErr(''); setMsg('')
    try {
      const out = await fn(done)
      if (id === 'email') setMsg(`E-ticket sent to ${out || 'your e-mail'}. Check your inbox (and spam folder).`)
      if (id === 'whatsapp' && out === 'downloaded') setMsg('The PDF is downloaded. Attach it in the WhatsApp chat that just opened.')
    } catch (e) {
      setErr(e.message || 'Could not create the PDF. Please try again.')
    } finally { setBusy('') }
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map(([id, Icon, label, fn]) => (
          <button key={id} type="button" disabled={!!busy} onClick={() => run(id, fn)}
            className={`btn !px-3 ${id === 'download' ? 'btn-gold' : id === 'whatsapp' ? 'btn-wa' : 'btn-ghost'}`}>
            {busy === id ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} />} {label}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="mt-3 flex items-center justify-center gap-2 text-[0.9rem] font-semibold text-palm"><CheckCircle2 size={16} /> {msg}</p>}
      {err && <p role="alert" className="mt-3 text-center text-[0.9rem] font-semibold text-red-700">{err}</p>}
      <p className="mt-2 text-center text-[0.75rem] text-slate-500">All four use the same PDF e-ticket. E-mail goes to the address on the booking.</p>
    </div>
  )
}
