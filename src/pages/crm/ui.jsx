import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/* Small shared pieces for the CRM screens. */

export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const IST = { timeZone: 'Asia/Kolkata' }
export const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '')
export const whenFull = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '')
export const dayLabel = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')
export function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}

export const BOOKING_STATUS = {
  payment_pending: ['Awaiting payment', 'bg-amber-100 text-amber-900'],
  paid: ['Paid, ticketing', 'bg-sky-100 text-sky-900'],
  ticketed: ['Ticketed', 'bg-emerald-100 text-emerald-900'],
  needs_attention: ['Needs attention', 'bg-red-100 text-red-800'],
  failed: ['Failed', 'bg-red-200 text-red-900'],
  cancelled: ['Cancelled', 'bg-slate-200 text-slate-700'],
  refunded: ['Refunded', 'bg-violet-100 text-violet-900'],
}
export const PAYMENT_STATUS = {
  created: ['Started', 'bg-slate-100 text-slate-700'],
  authorized: ['Authorised', 'bg-sky-100 text-sky-900'],
  captured: ['Captured', 'bg-emerald-100 text-emerald-900'],
  failed: ['Failed', 'bg-red-100 text-red-800'],
  partially_refunded: ['Part refunded', 'bg-violet-100 text-violet-900'],
  refunded: ['Refunded', 'bg-violet-100 text-violet-900'],
}
/** Every service the business handles. Same keys as api/crm.js. */
export const SERVICE_LIST = [
  ['flights', 'Flight Booking'], ['hotels', 'Hotel Booking'], ['tailor', 'Tailor-Made Packages'], ['tours', 'Tour Packages'], ['visa', 'Visa Consultancy'],
  ['passport', 'Passport Assistance'], ['umrah', 'Umrah & Hajj'], ['corporate', 'Corporate Travel'], ['insurance', 'Travel Insurance'], ['other', 'Other'],
]
export const SERVICE_NAME = Object.fromEntries(SERVICE_LIST)
export const SOURCE_LIST = [['website', 'Website'], ['phone', 'Phone call'], ['walk-in', 'Walk-in'], ['whatsapp', 'WhatsApp'], ['referral', 'Referral'], ['email', 'E-mail'], ['social', 'Social media'], ['other', 'Other']]
export const SOURCE_NAME = Object.fromEntries(SOURCE_LIST)
export const ServiceTag = ({ service }) => <span className="inline-block rounded-md bg-navy-950/8 px-2 py-0.5 text-[0.72rem] font-bold text-navy-900">{SERVICE_NAME[service] || 'Other'}</span>

/** Follow-up date as a badge: overdue (red), today (amber), later (grey). */
export function FollowUp({ date, status }) {
  if (!date || ['won', 'lost'].includes(status)) return null
  const d = String(date).slice(0, 10), today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
  const cls = d < today ? 'bg-red-100 text-red-800' : d === today ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[0.72rem] font-bold ${cls}`}>{d < today ? 'Overdue ' : d === today ? 'Today ' : 'Follow up '}{dayLabel(d)}</span>
}

export const CASE_STATUS = {
  docs_pending: ['Documents pending', 'bg-amber-100 text-amber-900'],
  docs_received: ['Documents received', 'bg-sky-100 text-sky-900'],
  in_progress: ['In progress', 'bg-sky-100 text-sky-900'],
  submitted: ['Submitted', 'bg-violet-100 text-violet-900'],
  approved: ['Approved', 'bg-emerald-100 text-emerald-900'],
  delivered: ['Delivered', 'bg-emerald-200 text-emerald-900'],
  rejected: ['Rejected', 'bg-red-100 text-red-800'],
  cancelled: ['Cancelled', 'bg-slate-200 text-slate-700'],
}
export const PAY_MODE_LIST = [['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank transfer'], ['card', 'Card machine'], ['cheque', 'Cheque'], ['other', 'Other']]

/** Ready-to-send WhatsApp messages for an order. The customer's phone and the text are filled in; staff just press send. */
export function caseMessages(c) {
  const NL = '\n'
  const name = String(c.customer_name || '').split(' ')[0] || 'there'
  const what = c.title || SERVICE_NAME[c.service] || 'your booking'
  const missing = (c.checklist || []).filter((x) => !x.done).map((x) => `- ${x.item}`).join(NL)
  const due = Math.max(0, Number(c.amount_inr || 0) - Number(c.paid_inr || 0))
  const sign = `${NL}${NL}Pro Tours & Travel Solutions, Bengaluru`
  return [
    ['Documents needed', `Hi ${name}, for ${what} we still need these from you:${NL}${missing || '(nothing, we have everything)'}${NL}Please send them on this WhatsApp number.${sign}`],
    ['Documents received', `Hi ${name}, we have received your documents for ${what}. We will start the process and keep you updated.${sign}`],
    ['Application submitted', `Hi ${name}, your application for ${what} has been submitted (ref ${c.case_ref}). We will tell you as soon as there is an update.${sign}`],
    ['Approved / ready', `Hi ${name}, good news: ${what} is approved and ready. ${due > 0 ? `The balance of Rs ${due.toLocaleString('en-IN')} is due.` : 'Everything is paid, thank you.'}${sign}`],
    ['Payment reminder', `Hi ${name}, a gentle reminder: Rs ${due.toLocaleString('en-IN')} is pending for ${what} (ref ${c.case_ref}). You can pay by UPI or bank transfer, or at our office.${sign}`],
  ]
}

export const ENQUIRY_STATUS = {
  new: ['New', 'bg-sky-100 text-sky-900'],
  contacted: ['Contacted', 'bg-amber-100 text-amber-900'],
  quoted: ['Quoted', 'bg-violet-100 text-violet-900'],
  won: ['Won', 'bg-emerald-100 text-emerald-900'],
  lost: ['Lost', 'bg-slate-200 text-slate-700'],
}

export function Pill({ status, map }) {
  const [label, cls] = map[status] || [status, 'bg-slate-100 text-slate-700']
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold whitespace-nowrap ${cls}`}>{label}</span>
}

export const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-ink md:py-2 md:text-[0.95rem] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
export const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[0.9rem] md:min-h-0 font-bold transition disabled:opacity-50'
export const btnDark = `${btn} bg-navy-950 text-white hover:bg-navy-800`
export const btnLight = `${btn} border border-slate-300 bg-white text-ink hover:border-slate-500`

/** Icon-only button: a comfortable 44 px tap target on a phone. */
export const btnIcon = `${btnLight} !px-2.5 min-w-11`

/** True on phone-sized screens (under 640 px). */
export function useNarrow() {
  const q = '(max-width: 639px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setNarrow(m.matches)
    f(); m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return narrow
}

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || right) && <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><h2 className="font-display text-[1rem] font-bold text-ink">{title}</h2>{right}</header>}
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Slide-in panel from the right (full width on phones). Esc closes it. */
export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="flex h-full w-full max-w-2xl flex-col bg-paper shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <h2 className="min-w-0 truncate font-display text-[1.15rem] font-bold text-ink">{title}</h2>
          <button type="button" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </aside>
    </div>
  )
}

export const Empty = ({ children }) => <p className="rounded-xl bg-white p-8 text-center text-slate-500">{children}</p>
export const Err = ({ children }) => (children ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[0.9rem] font-semibold text-red-700">{children}</p> : null)

export function Pager({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-[0.88rem] text-slate-600">
      <span>{total ? `${(page - 1) * size + 1}–${Math.min(total, page * size)} of ${total}` : 'No results'}</span>
      <span className="flex gap-2"><button className={btnLight} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><button className={btnLight} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></span>
    </div>
  )
}

/** Timeline of crm_events: who did what and when. */
export function Timeline({ events }) {
  const text = (e) => {
    const d = e.data || {}
    switch (e.kind) {
      case 'created': return d.route ? `Booking started: ${d.route}, ${inr(d.amount)}` : d.topic ? `Enquiry received${d.topic ? ': ' + d.topic : ''}` : 'Created'
      case 'paid': return `Payment confirmed${d.paymentId ? ' (' + d.paymentId + ')' : ''}`
      case 'payment_failed': return `Payment not completed: ${d.message || ''}`
      case 'ticketed': return `Ticketed. PNR ${d.pnr || ''}`
      case 'failed': return `Ticketing problem${d.pnr ? ' (PNR ' + d.pnr + ')' : ''}: ${(d.errors || []).join('; ') || d.status || ''}`
      case 'payment': return `Payment ${d.paymentId || ''}: ${d.status}${d.method ? ' by ' + String(d.method).toUpperCase() : ''}${d.vpa ? ' (' + d.vpa + ')' : ''}${d.amount ? ', ' + inr(d.amount) : ''}${d.error ? ': ' + d.error : ''}`
      case 'refund': return `Refunded ${inr(d.amount)} to the customer's card${d.reason ? ': ' + d.reason : ''}${d.status && d.status !== 'processed' ? ` (${d.status})` : ''}`
      case 'details': return 'Details changed: ' + Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v?.[0] ?? '—'} → ${v?.[1] || '—'}`).join('; ')
      case 'payment_in': return `Payment received: ${inr(d.amount)} by ${String(d.mode || '').toUpperCase()}${d.ref ? ' (' + d.ref + ')' : ''}`
      case 'checklist': return `Checklist: ${d.done} of ${d.total} done`
      case 'invoice': return `Invoice ${d.invoice_no} created${d.total ? ' for ' + inr(d.total) : ''}`
      case 'status': return `Status changed: ${d.from} → ${d.to}`
      case 'assigned': return d.to ? `Assigned to ${d.to}` : 'Unassigned'
      case 'note': return d.text
      default: return e.kind
    }
  }
  if (!events?.length) return <p className="text-[0.9rem] text-slate-500">Nothing yet.</p>
  return (
    <ol className="grid gap-3 border-l-2 border-slate-200 pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ${e.kind === 'note' ? 'bg-gold-500' : e.kind.includes('fail') ? 'bg-red-500' : 'bg-brand-500'}`} />
          <p className={`text-[0.92rem] whitespace-pre-wrap ${e.kind === 'note' ? 'rounded-lg bg-gold-500/10 p-2 text-ink' : 'text-ink'}`}>{text(e)}</p>
          <p className="text-[0.75rem] text-slate-500">{whenFull(e.created_at)} · {e.actor || 'system'}</p>
        </li>
      ))}
    </ol>
  )
}

/** mailto: address with anything that could add recipients or headers (? & = / space ...) percent-encoded, '@' kept. */
export const mailTo = (email, subject) => `mailto:${String(email || '').replace(/[^A-Za-z0-9@._+-]/g, (c) => encodeURIComponent(c))}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`

/** wa.me link for a phone number typed any way (10-digit Indian numbers get +91). */
export const waTo = (phone, text) => {
  const d = String(phone || '').replace(/\D/g, '')
  const n = d.length === 10 ? '91' + d : d
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`
}
