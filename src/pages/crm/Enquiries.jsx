import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Mail, MessageCircle, Phone, Plus, RefreshCw, Search } from 'lucide-react'

import { crm, download } from './api.js'
import { Card, Drawer, ENQUIRY_STATUS, Empty, Err, FollowUp, Pager, Pill, SERVICE_LIST, SOURCE_LIST, SOURCE_NAME, ServiceTag, Timeline, ago, btnDark, btnLight, inr, input, mailTo, waTo, whenFull } from './ui.jsx'

const STATUSES = Object.keys(ENQUIRY_STATUS)

export default function Enquiries({ openId, onOpen, onMakeOrder }) {
  const [f, setF] = useState({ q: '', status: '', service: '', due: '', from: '', to: '' })
  const [adding, setAdding] = useState(false)
  useEffect(() => { if (window.__crmDue) { const due = window.__crmDue; window.__crmDue = null; setF((x) => ({ ...x, due })) } }, [])
  const [debounced, setDebounced] = useState(f)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { const t = setTimeout(() => { setDebounced(f); setPage(1) }, 300); return () => clearTimeout(t) }, [f])
  const load = useCallback(async () => {
    setBusy(true); setErr('')
    try { setData(await crm('enquiries', { ...debounced, page })) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }, [debounced, page])
  useEffect(() => { load() }, [load])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Enquiry status">
          {[['', 'All'], ...STATUSES.map((s) => [s, ENQUIRY_STATUS[s][0]])].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={f.status === v} onClick={() => setF((x) => ({ ...x, status: v }))} className={`rounded-full px-3.5 py-1.5 text-[0.85rem] font-bold ${f.status === v ? 'bg-navy-950 text-white' : 'bg-sand text-navy-900 hover:bg-slate-200'}`}>{l}</button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Service">
          {[['', 'All services'], ...SERVICE_LIST].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={f.service === v} onClick={() => setF((x) => ({ ...x, service: v }))} className={`rounded-full border px-3 py-1 text-[0.8rem] font-bold ${f.service === v ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>{l}</button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {[['', 'Any follow-up'], ['today', 'Due today'], ['overdue', 'Overdue'], ['any', 'Has a follow-up']].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={f.due === v} onClick={() => setF((x) => ({ ...x, due: v }))} className={`rounded-full border px-3 py-1 text-[0.8rem] font-bold ${f.due === v ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_1fr_auto]">
          <label className="relative block"><span className="sr-only">Search enquiries</span><Search size={16} className="absolute top-3 left-3 text-slate-400" /><input className={`${input} pl-9`} placeholder="Search name, phone, e-mail, message" value={f.q} onChange={set('q')} /></label>
          <input aria-label="From date" type="date" className={input} value={f.from} onChange={set('from')} />
          <input aria-label="To date" type="date" className={input} value={f.to} onChange={set('to')} />
          <div className="flex gap-2"><button className={btnLight} onClick={load} aria-label="Refresh"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /></button><button className={btnLight} onClick={() => download('enquiries', debounced).catch((e) => setErr(e.message))}><Download size={16} /> CSV</button><button className={btnDark} onClick={() => setAdding(true)}><Plus size={16} /> Add lead</button></div>
        </div>
      </Card>
      <Err>{err}</Err>
      {!data ? <Empty><Loader2 className="mx-auto animate-spin" /></Empty> : !data.rows.length ? <Empty>No enquiries match.</Empty> : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {data.rows.map((e) => (
            <li key={e.id}>
              <button onClick={() => onOpen(e.id)} className="grid w-full gap-1 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 md:grid-cols-[14rem_1fr_auto] md:items-center md:gap-4">
                <span><span className="block font-semibold text-ink">{e.name}</span><span className="text-[0.82rem] text-slate-500">{e.phone}</span><span className="mt-1 flex flex-wrap gap-1"><ServiceTag service={e.service} /><FollowUp date={e.follow_up_at} status={e.status} /></span></span>
                <span className="min-w-0"><span className="block text-[0.82rem] font-bold text-brand-600">{e.topic || 'Enquiry'}{e.page ? <span className="font-normal text-slate-400"> · from {e.page}</span> : ''}</span><span className="line-clamp-2 text-[0.9rem] whitespace-pre-line text-slate-700">{e.message || '—'}</span></span>
                <span className="flex items-center gap-3 md:flex-col md:items-end md:gap-1"><Pill status={e.status} map={ENQUIRY_STATUS} /><span className="text-[0.75rem] text-slate-500">{ago(e.created_at)}{e.source && e.source !== 'website' ? ` · ${SOURCE_NAME[e.source] || e.source}` : ''}{e.assigned_to ? ` · ${e.assigned_to}` : ''}</span>{(e.final_inr || e.quoted_inr) ? <span className="text-[0.8rem] font-bold text-navy-900">{e.status === 'won' && e.final_inr ? inr(e.final_inr) : `Quote ${inr(e.quoted_inr)}`}</span> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      {openId && <EnquiryDrawer id={openId} onClose={() => onOpen(null)} onChanged={load} onMakeOrder={onMakeOrder} />}
      {adding && <AddLead onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); load(); onOpen(id) }} />}
    </div>
  )
}

function EnquiryDrawer({ id, onClose, onChanged, onMakeOrder }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')
  const [assigned, setAssigned] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { const r = await crm('enquiry', { id }); setD(r); setStatus(r.enquiry.status); setAssigned(r.enquiry.assigned_to || '') } catch (e) { setErr(e.message) }
  }, [id])
  useEffect(() => { load() }, [load])
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('')
    try { await crm('enquiryUpdate', { id, status, assigned_to: assigned, note }, 'POST'); setNote(''); await load(); onChanged?.() } catch (x) { setErr(x.message) } finally { setSaving(false) }
  }
  const q = d?.enquiry
  return (
    <Drawer title={q ? q.name : 'Enquiry'} onClose={onClose}>
      {!q ? (err ? <Err>{err}</Err> : <Loader2 className="mx-auto animate-spin" />) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <div className="flex flex-wrap items-center gap-3"><Pill status={q.status} map={ENQUIRY_STATUS} /><span className="text-[0.82rem] text-slate-500">Received {whenFull(q.created_at)}{q.page ? ` from ${q.page}` : ''}</span></div>
          <Card title="Contact">
            <p className="font-semibold text-ink">{q.name}</p>
            <p className="text-[0.92rem] text-slate-600">{q.phone}{q.email ? ` · ${q.email}` : ''}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className={btnLight} href={waTo(q.phone, `Hi ${q.name}, thanks for your enquiry${q.topic ? ' about ' + q.topic : ''}. `)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
              <a className={btnLight} href={`tel:${q.phone}`}><Phone size={16} /> Call</a>
              {q.email && <a className={btnLight} href={mailTo(q.email)}><Mail size={16} /> E-mail</a>}
            </div>
          </Card>
          <Card title={q.topic || 'Message'}><p className="text-[0.95rem] whitespace-pre-line text-ink">{q.message || 'No message.'}</p></Card>
          {q.status !== 'lost' && onMakeOrder && <button type="button" className={btnDark} onClick={() => onMakeOrder({ enquiry_id: q.id, service: q.service, customer_name: q.name, phone: q.phone, email: q.email, title: q.topic, amount_inr: q.final_inr ?? q.quoted_inr ?? '', notes: q.message })}>Turn this into an order</button>}
          <LeadDetails q={q} onSaved={async () => { await load(); onChanged?.() }} />
          <Card title="Update">
            <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Status<select className={`${input} mt-1 normal-case`} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{ENQUIRY_STATUS[s][0]}</option>)}</select></label>
                <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Assigned to<input className={`${input} mt-1 normal-case`} maxLength={60} value={assigned} onChange={(e) => setAssigned(e.target.value)} placeholder="Staff name" /></label>
              </div>
              <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Add a note<textarea className={`${input} mt-1 normal-case`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quote sent, call back Friday, ..." /></label>
              <Err>{err}</Err>
              <button className={btnDark} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}</button>
            </form>
          </Card>
          <Card title="Timeline"><Timeline events={d.events} /></Card>
        </div>
      )}
    </Drawer>
  )
}

/** Service, source, follow-up date and the money on a lead (what was quoted, what it finally came to). */
function LeadDetails({ q, onSaved }) {
  const [f, setF] = useState({ service: q.service || '', source: q.source || 'website', follow_up_at: q.follow_up_at || '', quoted_inr: q.quoted_inr ?? '', final_inr: q.final_inr ?? '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    try { const r = await crm('enquiryFields', { id: q.id, ...f }, 'POST'); setMsg(r.changed ? 'Saved.' : 'Nothing changed.'); await onSaved() } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Card title="Lead details">
      <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Service<select className={`${input} mt-1 normal-case`} value={f.service} onChange={set('service')}><option value="">Not set</option>{SERVICE_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Came from<select className={`${input} mt-1 normal-case`} value={f.source} onChange={set('source')}>{SOURCE_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Follow up on<input type="date" className={`${input} mt-1`} value={f.follow_up_at} onChange={set('follow_up_at')} /></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Quoted (₹)<input type="number" min="0" step="1" className={`${input} mt-1`} value={f.quoted_inr} onChange={set('quoted_inr')} /></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase sm:col-span-2">Final amount when won (₹)<input type="number" min="0" step="1" className={`${input} mt-1`} value={f.final_inr} onChange={set('final_inr')} placeholder="What the customer finally paid us" /></label>
        </div>
        <Err>{err}</Err>{msg && <p role="status" className="text-[0.9rem] font-semibold text-emerald-700">{msg}</p>}
        <button className={btnDark} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Save details'}</button>
      </form>
    </Card>
  )
}

/** A lead from a phone call, a walk-in, WhatsApp or a referral. */
function AddLead({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', service: 'flights', source: 'phone', message: '', follow_up_at: '', quoted_inr: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const r = await crm('enquiryCreate', { ...f, topic: SERVICE_LIST.find(([k]) => k === f.service)?.[1] || '' }, 'POST'); onSaved(r.id) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Drawer title="Add a lead" onClose={onClose}>
      <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <p className="rounded-lg bg-sand px-3 py-2 text-[0.85rem] text-slate-700">For customers who called, walked in or messaged you. Website enquiries arrive here by themselves.</p>
        <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Name <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required minLength={2} maxLength={80} value={f.name} onChange={set('name')} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Phone <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required type="tel" maxLength={20} value={f.phone} onChange={set('phone')} /></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">E-mail<input className={`${input} mt-1 normal-case`} type="email" maxLength={120} value={f.email} onChange={set('email')} /></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Service<select className={`${input} mt-1 normal-case`} value={f.service} onChange={set('service')}>{SERVICE_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Came from<select className={`${input} mt-1 normal-case`} value={f.source} onChange={set('source')}>{SOURCE_LIST.filter(([k]) => k !== 'website').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Follow up on<input type="date" className={`${input} mt-1`} value={f.follow_up_at} onChange={set('follow_up_at')} /></label>
          <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Quoted (₹)<input type="number" min="0" className={`${input} mt-1`} value={f.quoted_inr} onChange={set('quoted_inr')} /></label>
        </div>
        <label className="text-[0.8rem] font-bold text-slate-600 uppercase">What they want<textarea className={`${input} mt-1 normal-case`} rows={4} maxLength={2000} value={f.message} onChange={set('message')} placeholder="Dates, destination, travellers, budget..." /></label>
        <Err>{err}</Err>
        <button className={btnDark} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Save lead'}</button>
      </form>
    </Drawer>
  )
}
