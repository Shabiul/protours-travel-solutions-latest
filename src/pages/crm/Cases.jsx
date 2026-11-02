import { useCallback, useEffect, useState } from 'react'
import { Check, FileText, Loader2, MessageCircle, Phone, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'

import { crm } from './api.js'
import { InvoiceForm, openInvoicePdf } from './Invoices.jsx'
import { CASE_STATUS, Card, Drawer, Empty, Err, Pager, PAY_MODE_LIST, Pill, SERVICE_LIST, ServiceTag, Timeline, btnDark, btnLight, caseMessages, dayLabel, inr, input, waTo, whenFull } from './ui.jsx'

const STATUSES = Object.keys(CASE_STATUS)
const lab = 'text-[0.8rem] font-bold text-slate-600 uppercase'

/** A due date as a small badge: late (red), within 2 days (amber). Closed orders show nothing. */
function Due({ date, status }) {
  if (!date || ['delivered', 'rejected', 'cancelled'].includes(status)) return null
  const d = String(date).slice(0, 10), today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10), soon = new Date(Date.now() + 5.5 * 3600_000 + 2 * 864e5).toISOString().slice(0, 10)
  const cls = d < today ? 'bg-red-100 text-red-800' : d <= soon ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[0.72rem] font-bold ${cls}`}>{d < today ? 'Late: ' : 'Due '}{dayLabel(d)}</span>
}

export default function Cases({ openId, onOpen, seedFromEnquiry, onSeedUsed }) {
  const [f, setF] = useState({ q: '', status: '', service: '', open: '' })
  const [d, setD] = useState(f)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(null) // null | seed object
  useEffect(() => { const t = setTimeout(() => { setD(f); setPage(1) }, 300); return () => clearTimeout(t) }, [f])
  useEffect(() => { if (seedFromEnquiry) { setAdding(seedFromEnquiry); onSeedUsed?.() } }, [seedFromEnquiry, onSeedUsed])
  const load = useCallback(async () => { setBusy(true); setErr(''); try { setData(await crm('cases', { ...d, page })) } catch (e) { setErr(e.message) } finally { setBusy(false) } }, [d, page])
  useEffect(() => { load() }, [load])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Order status">
          {[['', 'All'], ...STATUSES.map((s) => [s, CASE_STATUS[s][0]])].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={f.status === v} onClick={() => setF((x) => ({ ...x, status: v }))} className={`rounded-full px-3.5 py-1.5 text-[0.85rem] font-bold ${f.status === v ? 'bg-navy-950 text-white' : 'bg-sand text-navy-900 hover:bg-slate-200'}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_auto]">
          <label className="relative block"><span className="sr-only">Search orders</span><Search size={16} className="absolute top-3 left-3 text-slate-400" /><input className={`${input} pl-9`} placeholder="Order number, customer, phone, e-mail, title" value={f.q} onChange={set('q')} /></label>
          <select aria-label="Service" className={input} value={f.service} onChange={set('service')}><option value="">All services</option>{SERVICE_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <div className="flex gap-2"><button className={btnLight} onClick={load} aria-label="Refresh"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /></button><button className={btnDark} onClick={() => setAdding({})}><Plus size={16} /> New order</button></div>
        </div>
        <p className="mt-2 text-[0.8rem] text-slate-500">Orders are for visas, passports, Umrah and Hajj, hotels, tours, insurance and corporate travel. Online flight bookings are under Bookings.</p>
      </Card>
      <Err>{err}</Err>
      {!data ? <Empty><Loader2 className="mx-auto animate-spin" /></Empty> : !data.rows.length ? <Empty>No orders yet. Create one with "New order", or turn an enquiry into an order.</Empty> : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {data.rows.map((c) => (
            <li key={c.id}>
              <button onClick={() => onOpen(c.id)} className="grid w-full gap-1 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 md:grid-cols-[1.3fr_1fr_auto] md:items-center md:gap-4">
                <span><span className="block font-semibold text-ink">{c.customer_name}</span><span className="text-[0.82rem] text-slate-500">{c.title || '—'}</span><span className="mt-1 flex flex-wrap gap-1"><ServiceTag service={c.service} /><Due date={c.due_date} status={c.status} /></span></span>
                <span className="font-mono text-[0.8rem] text-slate-600">{c.case_ref}<span className="block font-sans text-slate-500">{c.phone}</span></span>
                <span className="flex items-center justify-between gap-3 md:flex-col md:items-end md:gap-1"><Pill status={c.status} map={CASE_STATUS} /><span className="text-[0.8rem] font-bold text-navy-900">{c.amount_inr ? `${inr(c.paid_inr)} of ${inr(c.amount_inr)}` : '—'}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      {openId && <CaseDrawer id={openId} onClose={() => onOpen(null)} onChanged={load} />}
      {adding && <NewCase seed={adding} onClose={() => setAdding(null)} onSaved={(id) => { setAdding(null); load(); onOpen(id) }} />}
    </div>
  )
}

/** A new order. Opened from an enquiry it is prefilled with that person, and the enquiry is marked won. */
export function NewCase({ seed, onClose, onSaved }) {
  const [f, setF] = useState({ service: seed.service && seed.service !== 'other' ? seed.service : 'visa', customer_name: seed.customer_name || '', phone: seed.phone || '', email: seed.email || '', title: seed.title || '', amount_inr: seed.amount_inr ?? '', due_date: '', travel_date: '', notes: seed.notes || '' })
  const [trav, setTrav] = useState([{ name: seed.customer_name || '', type: 'adult' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const r = await crm('caseCreate', { ...f, enquiry_id: seed.enquiry_id || '', travellers: trav.filter((t) => t.name.trim()) }, 'POST'); onSaved(r.id) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Drawer title="New order" onClose={onClose}>
      <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {seed.enquiry_id && <p className="rounded-lg bg-sand px-3 py-2 text-[0.85rem] text-slate-700">Made from an enquiry. Saving marks that enquiry as <strong>won</strong> at this order's amount.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lab}>Service <span className="text-red-600">*</span><select className={`${input} mt-1 normal-case`} value={f.service} onChange={set('service')}>{SERVICE_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className={lab}>Amount the customer pays (₹)<input className={`${input} mt-1`} type="number" min="0" value={f.amount_inr} onChange={set('amount_inr')} /></label>
          <label className={`${lab} sm:col-span-2`}>What is it <span className="font-normal normal-case">(for example "Dubai tourist visa, 2 adults")</span><input className={`${input} mt-1 normal-case`} maxLength={140} value={f.title} onChange={set('title')} /></label>
          <label className={lab}>Customer name <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required minLength={2} maxLength={80} value={f.customer_name} onChange={set('customer_name')} /></label>
          <label className={lab}>Phone<input className={`${input} mt-1 normal-case`} type="tel" maxLength={20} value={f.phone} onChange={set('phone')} /></label>
          <label className={`${lab} sm:col-span-2`}>E-mail<input className={`${input} mt-1 normal-case`} type="email" maxLength={120} value={f.email} onChange={set('email')} /></label>
          <label className={lab}>Paperwork due by<input className={`${input} mt-1`} type="date" value={f.due_date} onChange={set('due_date')} /></label>
          <label className={lab}>Travel date<input className={`${input} mt-1`} type="date" value={f.travel_date} onChange={set('travel_date')} /></label>
        </div>
        <Travellers value={trav} onChange={setTrav} />
        <label className={lab}>Notes<textarea className={`${input} mt-1 normal-case`} rows={3} maxLength={2000} value={f.notes} onChange={set('notes')} /></label>
        <p className="text-[0.8rem] text-slate-500">The document checklist for this service is added automatically. Passport numbers are not kept here.</p>
        <Err>{err}</Err>
        <button className={btnDark} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Create order'}</button>
      </form>
    </Drawer>
  )
}

function Travellers({ value, onChange }) {
  const set = (i, k, v) => onChange(value.map((t, j) => (j === i ? { ...t, [k]: v } : t)))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><span className={lab}>Travellers / applicants</span><button type="button" className="text-[0.82rem] font-bold text-brand-500" onClick={() => onChange([...value, { name: '', type: 'adult' }])}><Plus size={13} className="mr-1 inline" />Add</button></div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{value.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_6.5rem_auto] gap-2">
          <input aria-label="Traveller name" className={input} maxLength={80} placeholder="Name as on the passport" value={t.name} onChange={(e) => set(i, 'name', e.target.value)} />
          <select aria-label="Type" className={input} value={t.type || 'adult'} onChange={(e) => set(i, 'type', e.target.value)}><option value="adult">Adult</option><option value="child">Child</option><option value="infant">Infant</option></select>
          <button type="button" aria-label="Remove" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-sand" onClick={() => onChange(value.length > 1 ? value.filter((_, j) => j !== i) : value)}><Trash2 size={15} /></button>
        </div>))}</div>
    </div>
  )
}

function CaseDrawer({ id, onClose, onChanged }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [pay, setPay] = useState({ amount: '', mode: 'cash', ref: '' })
  const [inv, setInv] = useState(null)
  const load = useCallback(async () => { try { setD(await crm('case', { id })) } catch (e) { setErr(e.message) } }, [id])
  useEffect(() => { load() }, [load])
  const run = async (what, fn) => { setBusy(what); setErr(''); try { await fn(); await load(); onChanged?.() } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const c = d?.case
  if (!c) return <Drawer title="Order" onClose={onClose}>{err ? <Err>{err}</Err> : <Loader2 className="mx-auto animate-spin" />}</Drawer>
  const update = (body) => run('upd', () => crm('caseUpdate', { id, ...body }, 'POST'))
  const toggle = (i) => update({ checklist: c.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
  const done = c.checklist.filter((x) => x.done).length
  const owed = Math.max(0, Number(c.amount_inr || 0) - Number(c.paid_inr || 0))
  return (
    <Drawer title={`${c.case_ref} · ${c.customer_name}`} onClose={onClose}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex flex-wrap items-center gap-2"><Pill status={c.status} map={CASE_STATUS} /><ServiceTag service={c.service} /><Due date={c.due_date} status={c.status} /><span className="text-[0.8rem] text-slate-500">Created {whenFull(c.created_at)}</span></div>
        <Err>{err}</Err>

        <Card title={c.title || 'Order'}>
          <p className="text-[0.92rem] text-slate-600">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-2">{c.phone && <a className={btnLight} href={`tel:${c.phone}`}><Phone size={16} /> Call</a>}</div>
          <label className={`${lab} mt-3 block`}>Status<select className={`${input} mt-1 normal-case`} value={c.status} disabled={busy === 'upd'} onChange={(e) => update({ status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{CASE_STATUS[s][0]}</option>)}</select></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className={lab}>Paperwork due<input type="date" className={`${input} mt-1`} defaultValue={c.due_date || ''} onBlur={(e) => e.target.value !== (c.due_date || '') && update({ due_date: e.target.value })} /></label>
            <label className={lab}>Travel date<input type="date" className={`${input} mt-1`} defaultValue={c.travel_date || ''} onBlur={(e) => e.target.value !== (c.travel_date || '') && update({ travel_date: e.target.value })} /></label>
            <label className={lab}>Amount (₹)<input type="number" min="0" className={`${input} mt-1`} defaultValue={c.amount_inr ?? ''} onBlur={(e) => String(e.target.value) !== String(c.amount_inr ?? '') && update({ amount_inr: e.target.value })} /></label>
          </div>
        </Card>

        <Card title={`Checklist: ${done} of ${c.checklist.length} done`}>
          {!c.checklist.length ? <p className="text-[0.9rem] text-slate-500">No checklist for this service.</p> : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">{c.checklist.map((x, i) => (
              <li key={i}><button type="button" onClick={() => toggle(i)} disabled={busy === 'upd'} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-sand"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${x.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400'}`}>{x.done && <Check size={13} />}</span><span className={x.done ? 'text-slate-400 line-through' : 'text-ink'}>{x.item}</span></button></li>))}</ul>
          )}
        </Card>

        <Card title="Travellers">
          {!c.travellers.length ? <p className="text-[0.9rem] text-slate-500">None added.</p> : <ul className="grid gap-1 text-[0.92rem]">{c.travellers.map((t, i) => <li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0"><span className="font-semibold">{t.name}</span><span className="text-slate-500">{t.type}</span></li>)}</ul>}
        </Card>

        <Card title="Money" right={<span className="text-[0.85rem] font-bold text-navy-900">{inr(c.paid_inr)} of {inr(c.amount_inr)} received{owed > 0 ? ` · ${inr(owed)} due` : ''}</span>}>
          {c.payments.length > 0 && <ul className="mb-3 grid gap-1 text-[0.88rem]">{c.payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1"><span>{whenFull(p.at)} · {String(p.mode).toUpperCase()}{p.ref ? ` · ${p.ref}` : ''}</span><span className="font-semibold">{inr(p.amount)}</span></li>)}</ul>}
          <form className="grid gap-2 sm:grid-cols-[7rem_9rem_1fr_auto]" onSubmit={(e) => { e.preventDefault(); run('pay', async () => { await crm('casePayment', { id, ...pay }, 'POST'); setPay({ amount: '', mode: 'cash', ref: '' }) }) }}>
            <input aria-label="Amount received" className={input} type="number" min="1" step="any" required placeholder="Amount ₹" value={pay.amount} onChange={(e) => setPay((x) => ({ ...x, amount: e.target.value }))} />
            <select aria-label="Mode" className={input} value={pay.mode} onChange={(e) => setPay((x) => ({ ...x, mode: e.target.value }))}>{PAY_MODE_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input aria-label="Reference" className={input} maxLength={60} placeholder="Reference / UPI id (optional)" value={pay.ref} onChange={(e) => setPay((x) => ({ ...x, ref: e.target.value }))} />
            <button className={btnDark} disabled={busy === 'pay'}>{busy === 'pay' ? <Loader2 size={15} className="animate-spin" /> : 'Record payment'}</button>
          </form>
          <p className="mt-2 text-[0.78rem] text-slate-500">For money received outside the website: cash, UPI, bank transfer, cheque or card machine.</p>
        </Card>

        <Card title="Invoices" right={<button className="text-[0.85rem] font-bold text-brand-500" onClick={() => setInv({ case_id: c.id, customer_name: c.customer_name, phone: c.phone, email: c.email, lines: [{ desc: c.title || `${c.service} service`, qty: 1, rate: c.amount_inr || '' }] })}><FileText size={14} className="mr-1 inline" />New invoice</button>}>
          {!d.invoices.length ? <p className="text-[0.9rem] text-slate-500">No invoice yet.</p> : <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">{d.invoices.map((i) => <li key={i.id} className="flex items-center justify-between gap-2"><span className="font-mono text-[0.82rem]">{i.invoice_no}{i.status === 'cancelled' ? ' (cancelled)' : ''} · {inr(i.total)}</span><button className={btnLight} onClick={() => openInvoicePdf(i.id).catch((e) => setErr(e.message))}>PDF</button></li>)}</ul>}
        </Card>

        {c.phone && (
          <Card title="Message the customer on WhatsApp">
            <div className="flex flex-wrap gap-2">{caseMessages(c).map(([label, text]) => <a key={label} className={btnLight} href={waTo(c.phone, text)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {label}</a>)}</div>
            <p className="mt-2 text-[0.78rem] text-slate-500">Opens WhatsApp with the message already written. You press send.</p>
          </Card>
        )}

        <Card title="Add a note"><form className="grid grid-cols-[minmax(0,1fr)] gap-2" onSubmit={(e) => { e.preventDefault(); run('note', async () => { await crm('caseUpdate', { id, note }, 'POST'); setNote('') }) }}><textarea className={`${input} normal-case`} rows={2} maxLength={2000} placeholder="Called the embassy, appointment on Friday..." value={note} onChange={(e) => setNote(e.target.value)} /><button className={btnDark} disabled={!note.trim() || busy === 'note'}>Save note</button></form></Card>
        <Card title="Timeline"><Timeline events={d.events} /></Card>
      </div>
      {inv && <InvoiceForm seed={inv} onClose={() => setInv(null)} onSaved={() => { setInv(null); load() }} />}
    </Drawer>
  )
}
