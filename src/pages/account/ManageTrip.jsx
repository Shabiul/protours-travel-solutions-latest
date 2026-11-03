import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'

import { acct } from './session.js'

/* "Manage booking" on a trip in My trips: cancel (all travellers or some) and change the date, both sent to the airline
   through TBO, plus the live status of every request. TBO's team processes each request, so the customer sees
   "requested" first and the refund / new ticket follows. Server side: api/account.js + api/_lib/changes.js. */

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[1rem] text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const hm = (iso) => String(iso || '').slice(11, 16)
const dayOf = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '')

const Err = ({ children }) => (children ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[0.9rem] font-semibold text-red-700">{children}</p> : null)

export default function ManageTrip({ b, onChanged }) {
  const [mode, setMode] = useState('') // '' | 'cancel' | 'change'
  const [changes, setChanges] = useState(null)
  const [loading, setLoading] = useState(false)
  const legs = (b.legs || []).filter((l) => l.bookingId && l.details)

  const loadStatus = () => {
    setLoading(true)
    acct('changes', { orderRef: b.order_ref }).then((r) => setChanges(r.changes)).catch(() => setChanges([])).finally(() => setLoading(false))
  }
  useEffect(loadStatus, [b.order_ref])
  const done = () => { setMode(''); loadStatus(); onChanged?.() }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="font-display text-[1.1rem] font-bold text-ink">Manage booking</h3>
      {b.status === 'ticketed' && legs.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`btn ${mode === 'change' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setMode(mode === 'change' ? '' : 'change')}><CalendarClock size={17} /> Change date</button>
          <button type="button" className={`btn ${mode === 'cancel' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setMode(mode === 'cancel' ? '' : 'cancel')}><XCircle size={17} /> Cancel booking</button>
        </div>
      ) : <p className="mt-2 text-[0.9rem] text-slate-600">Online changes are available once the ticket is issued.</p>}

      {mode === 'cancel' && <Cancel b={b} legs={legs} onDone={done} />}
      {mode === 'change' && <ChangeDate b={b} legs={legs} onDone={done} />}

      {(changes?.length > 0 || loading) && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.95rem] font-bold text-ink">Your requests</p>
            <button type="button" className="inline-flex items-center gap-1 text-[0.82rem] font-bold text-brand-500" onClick={loadStatus} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
          </div>
          <ul className="grid gap-2">
            {(changes || []).map((c, i) => {
              const all = c.requests || []
              const isDone = all.length && all.every((q) => q.done), rejected = all.some((q) => q.rejected)
              const refunded = all.reduce((t, q) => t + (q.refunded || 0), 0), charge = all.reduce((t, q) => t + (q.charge || 0), 0)
              return (
                <li key={i} className="rounded-xl bg-sand/60 p-3 text-[0.88rem]">
                  <p className="flex flex-wrap items-center justify-between gap-2 font-semibold text-ink">
                    <span>{c.kind === 'cancel_requested' ? (c.full ? 'Cancellation' : 'Partial cancellation') : 'Date change'} · PNR <span className="font-mono">{c.pnr}</span></span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${rejected ? 'bg-red-100 text-red-800' : isDone ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{rejected ? 'Rejected' : isDone ? 'Completed' : all[0]?.status || 'Requested'}</span>
                  </p>
                  {c.kind === 'cancel_requested' && c.passengers?.length > 0 && <p className="mt-1 text-slate-600">{c.passengers.join(', ')}</p>}
                  {c.kind === 'change_requested' && <p className="mt-1 text-slate-600">New flight: {c.flight}</p>}
                  {isDone && c.kind === 'cancel_requested' && <p className="mt-1 text-slate-700">Airline charge {inr(charge)} · refund from the airline {inr(refunded)}. We refund you to the original payment method.</p>}
                  <p className="mt-1 text-[0.75rem] text-slate-500">Requested {when(c.created_at)} IST</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ---------------- cancel ---------------- */

function Cancel({ b, legs, onDone }) {
  const [quote, setQuote] = useState(null)
  const [err, setErr] = useState('')
  const [leg, setLeg] = useState(String(legs[0]?.bookingId || ''))
  const [who, setWho] = useState({}) // name -> true
  const [reason, setReason] = useState('other')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(null)

  useEffect(() => { acct('cancelQuote', { orderRef: b.order_ref }).then(setQuote).catch((e) => setErr(e.message)) }, [b.order_ref])
  const q = quote?.legs?.find((x) => String(x.bookingId) === leg)
  const pax = q?.passengers || []
  const picked = pax.filter((p) => who[p.name])
  const partial = picked.length > 0 && picked.length < pax.length

  const send = async () => {
    setBusy(true); setErr('')
    try {
      setOk(await acct('cancel', { orderRef: b.order_ref, bookingId: leg, passengers: partial ? picked.map((p) => p.name) : [], reason }))
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (ok) return (
    <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-[0.92rem] text-emerald-900">
      <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Cancellation requested</p>
      <p className="mt-1">The airline is processing it (request {ok.requests?.map((r) => r.id).join(', ')}). Your refund follows once they confirm; you can check the status below.</p>
      <button type="button" className="btn btn-ghost mt-3" onClick={onDone}>Done</button>
    </div>
  )
  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4">
      {!quote && !err && <p className="flex items-center gap-2 text-[0.9rem] text-slate-600"><Loader2 size={16} className="animate-spin" /> Asking the airline for the cancellation charges…</p>}
      {quote && (
        <>
          {quote.legs.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">{quote.legs.map((x) => (
              <button key={x.bookingId} type="button" onClick={() => { setLeg(String(x.bookingId)); setWho({}) }} className={`rounded-lg border px-3 py-1.5 text-[0.85rem] font-semibold ${leg === String(x.bookingId) ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-slate-300'}`}>{x.route} · PNR {x.pnr}</button>
            ))}</div>
          )}
          {q && (
            <>
              {q.known ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <p className="rounded-lg bg-red-50 p-3"><span className="block text-[0.75rem] font-bold text-red-800 uppercase">Airline cancellation charge</span><span className="font-display text-[1.3rem] font-bold text-red-800">{inr(q.charge)}</span></p>
                  <p className="rounded-lg bg-emerald-50 p-3"><span className="block text-[0.75rem] font-bold text-emerald-900 uppercase">Refund from the airline</span><span className="font-display text-[1.3rem] font-bold text-emerald-900">{inr(q.refund)}</span></p>
                </div>
              ) : <p className="rounded-lg bg-sand p-3 text-[0.88rem] text-slate-700">The airline does not quote the charge online for this ticket. The fees on your e-ticket apply; the exact amount is confirmed when the airline processes the request.</p>}
              <p className="mt-2 text-[0.78rem] text-slate-500">For all travellers on this PNR, if cancelled now.</p>

              <p className="mt-4 text-[0.9rem] font-bold text-ink">Who is cancelling?</p>
              <div className="mt-2 grid gap-1.5">
                {pax.map((p) => (
                  <label key={p.name} className="flex items-center gap-2 text-[0.92rem]"><input type="checkbox" className="h-4 w-4" checked={!!who[p.name]} onChange={(e) => setWho((w) => ({ ...w, [p.name]: e.target.checked }))} />{p.name}<span className="text-[0.75rem] text-slate-500">{({ 1: 'Adult', 2: 'Child', 3: 'Infant' })[p.type]}</span></label>
                ))}
              </div>
              <p className="mt-1 text-[0.78rem] text-slate-500">{!picked.length || !partial ? 'Everyone on this PNR will be cancelled.' : `Only ${picked.length} of ${pax.length} travellers will be cancelled (partial cancellation).`}</p>

              <label className="mt-4 block text-[0.9rem] font-bold text-ink" htmlFor="cx-reason">Reason</label>
              <select id="cx-reason" className={`${input} mt-1 sm:w-80`} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="other">I want to cancel</option>
                <option value="airlineCancelled">The airline cancelled my flight</option>
              </select>
              <label className="mt-4 flex items-start gap-2 text-[0.88rem]"><input type="checkbox" className="mt-1 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I understand a cancellation cannot be undone once the airline processes it.</label>
              <button type="button" className="btn mt-4 bg-red-600 text-white hover:bg-red-700" disabled={!agree || busy} onClick={send}>{busy ? <Loader2 size={17} className="animate-spin" /> : <XCircle size={17} />} Cancel {partial ? `${picked.length} traveller${picked.length > 1 ? 's' : ''}` : 'booking'}</button>
            </>
          )}
        </>
      )}
      <Err>{err}</Err>
    </div>
  )
}

/* ---------------- change date ---------------- */

function ChangeDate({ b, legs, onDone }) {
  const [leg, setLeg] = useState(String(legs[0]?.bookingId || ''))
  const [date, setDate] = useState('')
  const [res, setRes] = useState(null)
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(null)
  const L = legs.find((l) => String(l.bookingId) === leg)

  const find = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setRes(null); setPick(null)
    try { setRes(await acct('changeSearch', { orderRef: b.order_ref, bookingId: leg, date })) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const send = async () => {
    const f = pick.journeys[0].flights[0]
    setBusy(true); setErr('')
    try {
      setOk(await acct('changeRequest', { orderRef: b.order_ref, bookingId: leg, date, flight: { code: f.code, number: f.number, from: pick.journeys[0].from, to: pick.journeys[0].to, dep: pick.journeys[0].dep, price: pick.price, changeFee: pick.changeFee } }))
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  if (ok) return (
    <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-[0.92rem] text-emerald-900">
      <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Date change requested</p>
      <p className="mt-1">We have asked the airline to move your ticket to {ok.flight}. Our team will call you to confirm the fare difference and change fee before the new ticket is issued.</p>
      <button type="button" className="btn btn-ghost mt-3" onClick={onDone}>Done</button>
    </div>
  )
  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4">
      {legs.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">{legs.map((l) => (
          <button key={l.bookingId} type="button" onClick={() => { setLeg(String(l.bookingId)); setRes(null); setPick(null) }} className={`rounded-lg border px-3 py-1.5 text-[0.85rem] font-semibold ${leg === String(l.bookingId) ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-slate-300'}`}>{(l.details.segments || []).map((s) => `${s.from}-${s.to}`).join(' ')}</button>
        ))}</div>
      )}
      <p className="text-[0.88rem] text-slate-600">Now: {(L?.details?.segments || []).map((s) => `${s.flight} ${s.from}→${s.to}, ${dayOf(s.dep)} ${hm(s.dep)}`).join(' · ')}</p>
      <form onSubmit={find} className="mt-3 flex flex-wrap items-end gap-2">
        <div><label className="mb-1 block text-[0.78rem] font-bold tracking-wide text-slate-600 uppercase" htmlFor="cd-date">New date</label><input id="cd-date" type="date" required min={todayIst()} className={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <button className="btn btn-gold" disabled={busy || !date}>{busy && !res ? <Loader2 size={17} className="animate-spin" /> : null} Find flights</button>
      </form>
      {res && !res.options.length && <p className="mt-3 rounded-lg bg-sand p-3 text-[0.9rem]">No flights on this airline that day. Try another date, or call us.</p>}
      {res?.options?.length > 0 && (
        <>
          <ul className="mt-3 grid gap-2">
            {res.options.map((o) => {
              const j = o.journeys[0], f = j.flights[0]
              const on = pick?.resultIndex === o.resultIndex
              return (
                <li key={o.resultIndex}>
                  <button type="button" onClick={() => setPick(o)} aria-pressed={on} className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl border p-3 text-left ${on ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20' : 'border-slate-300'}`}>
                    <span><span className="block font-bold text-ink">{hm(j.dep)} → {hm(j.arr)} <span className="font-normal text-slate-600">{f.code}-{f.number}{j.stops ? ` · ${j.stops} stop` : ' · non-stop'}</span></span>
                      <span className="block text-[0.8rem] text-slate-500">{j.from}{f.fromTerminal ? ` T${f.fromTerminal}` : ''} → {j.to}{j.flights.at(-1).toTerminal ? ` T${j.flights.at(-1).toTerminal}` : ''} · {dayOf(j.dep)}</span></span>
                    <span className="text-right"><span className="block font-display text-[1.05rem] font-bold text-navy-950">{inr(o.price)}</span>{o.changeFee > 0 && <span className="block text-[0.75rem] text-slate-500">+ change fee {inr(o.changeFee)}</span>}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[0.78rem] text-slate-500">Prices are the new fare for everyone on this PNR. You pay the difference to what you paid ({inr(res.paid)}) plus the airline's change fee; our team confirms the exact amount with you before the new ticket is issued.</p>
          <button type="button" className="btn btn-gold mt-3" disabled={!pick || busy} onClick={send}>{busy ? <Loader2 size={17} className="animate-spin" /> : <CalendarClock size={17} />} Request this change</button>
        </>
      )}
      <Err>{err}</Err>
    </div>
  )
}
