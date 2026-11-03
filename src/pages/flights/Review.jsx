import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronUp, Armchair, Clock, Loader2, Luggage, Lock, ShieldCheck, Utensils, Zap } from 'lucide-react'

import { useAccount } from '../account/session.js'
import { AirlineMark, FEE_TYPE, PenaltyBar, cityOf, dateLabel, dur, inr, longDate, minutesBetween, time, todayIso, ui } from './shared.jsx'

/* Review + travellers: itinerary and fare rules, traveller forms, meal/baggage cards, contact,
   and a sticky fare summary with a countdown (TBO holds a search for 15 minutes).
   The payload handed to onPay() is the same as before. */

const TYPE_NAME = { 1: 'Adult', 2: 'Child', 3: 'Infant' }
const TITLES = { 1: ['Mr', 'Mrs', 'Ms'], 2: ['Mstr', 'Miss'], 3: ['Mstr', 'Miss'] }
const HOLD_MS = 15 * 60 * 1000
// The server refuses to start a payment with under 4 minutes of the airline's 15-minute hold left (paying and ticketing take time),
// so the page stops offering to pay at the same moment instead of letting the customer click and fail.
const SAFE_MS = 4 * 60 * 1000 + 15_000

const findSsr = (leg, key) => [...(leg.ssr?.baggage || []), ...(leg.ssr?.meals || []), ...(leg.ssr?.priority || []), ...seatsOf(leg)].find((x) => x.key === key)
const seatsOf = (leg) => (leg.ssr?.seatMaps || []).flatMap((m) => m.rows.flatMap((r) => Object.values(r.seats)))

function Section({ n, title, children, right }) {
  return (
    <section className={`${ui.card} p-4 md:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-display text-[1.2rem] font-bold text-ink">{n && <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-950 text-[0.85rem] text-white">{n}</span>}{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

/* ---------------- countdown ---------------- */

function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => expiresAt - Date.now())
  useEffect(() => {
    const id = setInterval(() => setLeft(expiresAt - Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return Math.max(0, left)
}
const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/* ---------------- steps + penalty timeline ---------------- */

const STEPS = ['Trip summary', 'Traveller details', 'Seats, meals & baggage', 'Contact & pay']

function StepBar({ addOns }) {
  const steps = addOns ? STEPS : STEPS.filter((x) => x !== STEPS[2])
  return (
    <ol aria-label="Booking steps" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] font-semibold text-slate-500">
      {steps.map((x, i) => <li key={x} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-navy-950 text-[0.7rem] text-white">{i + 1}</span>{x}{i < steps.length - 1 && <span aria-hidden className="text-slate-300">/</span>}</li>)}
    </ol>
  )
}

/* ---------------- itinerary + rules ---------------- */

function Itinerary({ q }) {
  return (
    <div className="grid gap-4">
      {q.legs.map((leg, li) => leg.journeys.map((j, ji) => (
        <div key={`${li}-${ji}`} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <AirlineMark code={j.flights[0].code} name={j.flights[0].airline} size={36} />
            <p className="font-display text-[1.05rem] font-bold text-ink">{cityOf(j.from)} → {cityOf(j.to)}</p>
            <p className="text-[0.85rem] text-slate-600">{longDate(j.dep)}</p>
            <p className="ml-auto text-[0.82rem] font-semibold text-slate-600">{dur(j.minutes)} · {j.stops ? `${j.stops} stop${j.stops > 1 ? 's' : ''}` : 'Non-stop'}</p>
          </div>
          {j.flights.map((g, gi) => (
            <div key={gi}>
              {gi > 0 && <p className="my-2 rounded-lg bg-sand px-3 py-1.5 text-center text-[0.8rem] font-semibold text-gold-600">Change of plane at {cityOf(g.from)} · {dur(minutesBetween(j.flights[gi - 1].arr, g.dep))} layover</p>}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div><p className="font-display text-[1.3rem] font-bold">{time(g.dep)}</p><p className="text-[0.82rem] text-slate-600">{g.from}{g.fromTerminal ? ` · T${g.fromTerminal}` : ''}</p></div>
                <div className="text-center text-[0.75rem] text-slate-500"><p className="font-semibold text-ink">{g.airline}</p><p className="font-mono">{g.code}-{g.number}</p><p>{dur(g.minutes)}</p></div>
                <div className="text-right"><p className="font-display text-[1.3rem] font-bold">{time(g.arr)}</p><p className="text-[0.82rem] text-slate-600">{g.to}{g.toTerminal ? ` · T${g.toTerminal}` : ''}</p></div>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-4 text-[0.8rem] text-slate-600"><span className="inline-flex items-center gap-1"><Luggage size={13} /> Check-in {g.baggage || 'as per airline'}</span><span>Cabin {g.cabinBaggage || 'as per airline'}</span></p>
            </div>
          ))}
        </div>
      )))}
    </div>
  )
}

function FareRules({ legs }) {
  const [open, setOpen] = useState(false)
  const rules = legs.flatMap((l) => l.rules || [])
  return (
    <div className="mt-4 rounded-xl border border-slate-200">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-bold text-ink" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Full fare rules {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      <div className="px-4 pb-4">
        <p className="text-[0.95rem] font-bold text-ink">Cancellation &amp; date-change fees</p>
        {legs.some((l) => (l.rules || []).some((r) => r.mini?.Rules?.length)) ? (
          <>
            {legs.flatMap((l, li) => (l.rules || []).filter((r) => r.mini?.Rules?.length).map((r, ri) => (
              <div key={`${li}-${ri}`} className="mt-2 rounded-xl bg-sand/60 p-3"><p className="text-[0.8rem] font-semibold text-slate-600">{r.origin} → {r.destination}</p><PenaltyBar rules={r.mini.Rules} type={FEE_TYPE.cancel} title="Cancellation fee" /><PenaltyBar rules={r.mini.Rules} type={FEE_TYPE.change} title="Date change fee" /></div>
            )))}
            <p className="mt-2 text-[0.78rem] text-slate-500">Airline fee per traveller.</p>
          </>
        ) : <p className="mt-1 text-[0.85rem] text-slate-600">The airline has not published these fees for this fare. Our team confirms them with you before ticketing.</p>}
      </div>
      {open && (
        <div className="max-h-80 overflow-auto border-t border-slate-200 bg-sand/60 p-4 text-[0.85rem]">
          {!rules.length && <p>The airline's fare rules were not returned for this fare. Our team will confirm them with you before ticketing.</p>}
          {rules.map((r, i) => (
            <div key={i} className="mb-3">
              <p className="font-bold">{r.airline} {r.origin}–{r.destination} · {r.fareBasis}</p>
              {(r.mini?.Rules || []).map((m, k) => (
                <p key={k}>{m.Type === FEE_TYPE.cancel ? 'Cancellation' : m.Type === FEE_TYPE.change ? 'Date change' : 'Rule'} {m.FromDuration ? `from ${m.FromDuration.replace(/^P(T)?/, '')}` : ''}{m.ToDuration ? ` to ${m.ToDuration.replace(/^P(T)?/, '')}` : ''} before departure: {(m.PaxPenalties || []).map((p) => inr(p.AirlineFee)).join(', ')} airline fee</p>
              ))}
              {/* Fare rule text from TBO is airline-supplied HTML; render as text only. */}
              <p className="mt-1 whitespace-pre-line text-slate-700">{String(r.text || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim().slice(0, 1800)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- add-ons: meals and baggage as cards ---------------- */

function sectorsOf(items) {
  const m = new Map()
  for (const x of items || []) {
    const k = `${x.origin}|${x.destination}|${x.wayType}|`
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return [...m.entries()]
}

/* Seat map, coloured by price like a heatmap: free → cheap → pricier. Taken seats are greyed out. */
const TIERS = [
  ['Free', 'border-emerald-400 bg-emerald-50 text-emerald-800'],
  ['Low', 'border-sky-400 bg-sky-50 text-sky-800'],
  ['Mid', 'border-amber-400 bg-amber-50 text-amber-800'],
  ['High', 'border-rose-400 bg-rose-50 text-rose-800'],
]

function SeatMap({ map, chosen, takenByOthers, onPick }) {
  const tierOf = useMemo(() => {
    const paid = [...new Set(map.rows.flatMap((r) => Object.values(r.seats)).filter((s) => s.open && s.price > 0).map((s) => s.price))].sort((a, b) => a - b)
    const cut = (f) => paid[Math.floor((paid.length - 1) * f)] ?? 0
    const [c1, c2] = [cut(1 / 3), cut(2 / 3)]
    return (p) => (!p ? 0 : p <= c1 ? 1 : p <= c2 ? 2 : 3)
  }, [map])
  const range = (t) => {
    const ps = map.rows.flatMap((r) => Object.values(r.seats)).filter((s) => s.open && tierOf(s.price) === t).map((s) => s.price)
    if (!ps.length) return null
    const lo = Math.min(...ps), hi = Math.max(...ps)
    return !hi ? 'Free' : lo === hi ? inr(lo) : `${inr(lo)}–${inr(hi)}`
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.78rem] font-semibold text-slate-600">
        {TIERS.map(([name, cls], t) => range(t) && <span key={name} className="inline-flex items-center gap-1.5"><span className={`h-4 w-4 rounded border-2 ${cls}`} />{range(t)}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded border-2 border-slate-200 bg-slate-200" />Taken</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded border-2 border-navy-950 bg-navy-950" />Your pick</span>
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-sand/40 p-3">
        <p className="mb-2 text-center text-[0.72rem] font-semibold tracking-wide text-slate-500 uppercase">Front · {map.flight}{map.craft ? ` · ${map.craft}` : ''}</p>
        <div className="mx-auto grid w-fit gap-1.5">
          <div className="flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-500">
            <span className="w-6" />
            {map.cols.map((c) => <span key={c} className={`w-8 text-center ${map.aisleAfter.includes(c) ? 'mr-4' : ''}`}>{c}</span>)}
          </div>
          {map.rows.map((r) => (
            <div key={r.row} className="flex items-center gap-1.5">
              <span className="w-6 text-right text-[0.7rem] font-bold text-slate-500">{r.row}</span>
              {map.cols.map((c) => {
                const s = r.seats[c]
                const gap = map.aisleAfter.includes(c) ? 'mr-4' : ''
                if (!s) return <span key={c} className={`h-8 w-8 ${gap}`} />
                const mine = chosen === s.key
                const free = s.open && !takenByOthers.has(s.key)
                const cls = mine ? 'border-navy-950 bg-navy-950 text-white' : free ? `${TIERS[tierOf(s.price)][1]} hover:scale-110` : 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400'
                return (
                  <button key={c} type="button" disabled={!free && !mine} onClick={() => onPick(mine ? '' : s.key)} aria-pressed={mine}
                    title={`Seat ${s.code}${s.type === 1 ? ' · window' : s.type === 2 ? ' · aisle' : ''} · ${free || mine ? (s.price ? inr(s.price) : 'free') : 'taken'}`}
                    className={`h-8 w-8 rounded-md border-2 text-[0.65rem] font-bold transition ${cls} ${gap}`}>
                    {mine ? <Check size={14} className="mx-auto" /> : c}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AddOns({ q, pax, choices, pick, n }) {
  const groups = useMemo(() => {
    const out = { seats: [], meals: [], baggage: [], priority: [] }
    q.legs.forEach((leg, li) => {
      if (!leg.ssr?.available || !leg.ssr.isLCC) return
      for (const m of leg.ssr.seatMaps || []) out.seats.push({ li, key: m.key, from: m.from, to: m.to, map: m })
      for (const kind of ['meals', 'baggage', 'priority']) {
        for (const [k, list] of sectorsOf(leg.ssr[kind])) {
          const real = list.filter((x) => x.price > 0 || !/^No/.test(x.code))
          if (real.length) out[kind].push({ li, key: k, from: list[0].origin, to: list[0].destination, list: real })
        }
      }
    })
    return out
  }, [q])
  const kinds = ['seats', 'meals', 'baggage', 'priority'].filter((k) => groups[k].length)
  const [kind, setKind] = useState(kinds[0])
  const [si, setSi] = useState(0)
  const [pi, setPi] = useState(0)
  if (!kinds.length) return null
  const active = kinds.includes(kind) ? kind : kinds[0]
  const sector = groups[active][Math.min(si, groups[active].length - 1)]
  const people = pax.map((p, i) => ({ p, i })).filter(({ p }) => active === 'meals' || p.paxType !== 3)
  const who = people.find((x) => x.i === pi) ? pi : people[0].i
  const leg = q.legs[sector.li]
  const chosen = choices[sector.li][who][active].find((x) => x.startsWith(sector.key)) || ''
  const nameOf = (i) => `${TYPE_NAME[pax[i].paxType]} ${pax.slice(0, i + 1).filter((x) => x.paxType === pax[i].paxType).length}`
  const countFor = (kd) => choices.reduce((n, l) => n + l.reduce((s, c) => s + c[kd].length, 0), 0)
  const KIND = { seats: [Armchair, 'Seats', 'Seat'], meals: [Utensils, 'Meals', 'Meal'], baggage: [Luggage, 'Extra baggage', 'Extra baggage'], priority: [Zap, 'Priority check-in', 'Priority check-in'] }
  const Icon = KIND[active][0]
  // seats other travellers on this booking already hold on this flight
  const takenByOthers = new Set(choices[sector.li].flatMap((c, i) => (i === who ? [] : c.seats)))

  return (
    <Section n={n} title={`Add ${kinds.map((k) => KIND[k][1].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' & $1')}`} right={<span className="text-[0.8rem] font-semibold text-slate-500">Optional</span>}>
      <div className="flex flex-wrap gap-2" role="tablist">
        {kinds.map((k) => {
          const KI = KIND[k][0]
          return (
            <button key={k} type="button" role="tab" aria-selected={active === k} onClick={() => { setKind(k); setSi(0) }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.92rem] font-bold ${active === k ? 'bg-navy-950 text-white' : 'bg-sand text-navy-900'}`}>
              <KI size={15} /> {KIND[k][1]}{countFor(k) > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[0.72rem] text-navy-950">{countFor(k)}</span>}
            </button>
          )
        })}
      </div>
      {groups[active].length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">{groups[active].map((s, i) => (
          <button key={s.key} type="button" onClick={() => setSi(i)} className={`rounded-lg border px-3 py-1.5 text-[0.85rem] font-semibold ${sector === s ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-slate-300'}`}>{s.from} → {s.to}</button>
        ))}</div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">{people.map(({ i }) => (
        <button key={i} type="button" onClick={() => setPi(i)} className={`rounded-full border px-3.5 py-1.5 text-[0.85rem] font-semibold ${who === i ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-300'}`}>{pax[i].firstName ? pax[i].firstName : nameOf(i)}</button>
      ))}</div>

      <p className="mt-4 mb-2 text-[0.85rem] text-slate-600"><Icon size={14} className="mr-1 inline" />{KIND[active][2]} for <strong>{pax[who].firstName || nameOf(who)}</strong>, {sector.from} → {sector.to}{active === 'seats' && chosen && <> · seat <strong>{findSsr(leg, chosen)?.code}</strong></>}</p>
      {active === 'seats' ? (
        <>
          <SeatMap map={sector.map} chosen={chosen} takenByOthers={takenByOthers} onPick={(key) => pick(sector.li, who, 'seats', sector.key, key)} />
          <p className="mt-2 text-[0.78rem] text-slate-500">{leg.seatRequired ? 'This fare includes a seat: if you skip this, the airline gives you a free one.' : 'Skip this and the airline assigns a seat at check-in.'}</p>
        </>
      ) : <div className="grid gap-2 sm:grid-cols-2">
        <OptionCard on={!chosen} onClick={() => pick(sector.li, who, active, sector.key, '')} title={active === 'priority' ? 'No priority check-in' : active === 'baggage' ? 'No extra baggage' : leg.mealRequired ? 'Free meal (included in this fare)' : 'No meal'} sub="Included" />
        {sector.list.map((x) => (
          <OptionCard key={x.key} on={chosen === x.key} onClick={() => pick(sector.li, who, active, sector.key, x.key)} title={x.label} sub={x.price ? inr(x.price) : 'Included'} />
        ))}
      </div>}
    </Section>
  )
}

/* Full-service (GDS) airlines send no seat map, only seat and meal preferences. Free, and the airline
   confirms them at check-in. */
function Preferences({ q, pax, choices, setPref }) {
  const legs = q.legs.map((leg, li) => ({ leg, li })).filter(({ leg }) => leg.ssr?.available && !leg.ssr.isLCC && (leg.ssr.seats?.length || leg.ssr.meals?.length))
  if (!legs.length) return null
  const nameOf = (i) => pax[i].firstName || `${TYPE_NAME[pax[i].paxType]} ${pax.slice(0, i + 1).filter((x) => x.paxType === pax[i].paxType).length}`
  return (
    <Section title="Seat & meal preference" right={<span className="text-[0.8rem] font-semibold text-slate-500">Free · optional</span>}>
      <p className="mb-3 text-[0.85rem] text-slate-600">This airline does not share a seat map. Tell us what you prefer and we pass it on. The airline confirms it at check-in, subject to availability.</p>
      <div className="grid gap-4">
        {legs.map(({ leg, li }) => (
          <div key={li} className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 font-bold text-ink">{cityOf(leg.journeys[0].from)} → {cityOf(leg.journeys.at(-1).to)}</p>
            <div className="grid gap-3">
              {pax.map((p, pi) => (
                <div key={pi} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr] sm:items-center">
                  <p className="text-[0.88rem] font-semibold">{nameOf(pi)}</p>
                  {leg.ssr.seats?.length > 0 && p.paxType !== 3 ? (
                    <select aria-label={`Seat preference for ${nameOf(pi)}`} className={ui.input} value={choices[li][pi].seat || ''} onChange={(e) => setPref(li, pi, 'seat', e.target.value)}>
                      <option value="">Any seat</option>
                      {leg.ssr.seats.map((s) => <option key={s.key} value={s.code}>{s.label}</option>)}
                    </select>
                  ) : <span />}
                  {leg.ssr.meals?.length > 0 && (
                    <select aria-label={`Meal preference for ${nameOf(pi)}`} className={ui.input} value={choices[li][pi].meal || ''} onChange={(e) => setPref(li, pi, 'meal', e.target.value)}>
                      <option value="">Any meal</option>
                      {leg.ssr.meals.map((m) => <option key={m.key} value={m.code}>{m.label}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function OptionCard({ on, onClick, title, sub }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${on ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20' : 'border-slate-300 hover:border-slate-500'}`}>
      <span className="min-w-0 text-[0.9rem] font-semibold text-ink">{title}</span>
      <span className="flex shrink-0 items-center gap-2 text-[0.88rem] font-bold text-navy-900">{sub}{on && <Check size={16} className="text-brand-500" />}</span>
    </button>
  )
}

/* ---------------- fare summary ---------------- */

function FareLines({ q }) {
  const base = q.legs.reduce((t, l) => t + (l.paxFares || []).reduce((a, f) => a + (Number(f.base) || 0), 0), 0)
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 grid gap-2 text-[0.9rem]">
      <p className="flex justify-between text-slate-700"><span>Base fare</span><span>{inr(base)}</span></p>
      <p className="flex justify-between text-slate-700"><span>Taxes, fees &amp; service charge</span><span>{inr(q.total - base)}</span></p>
      <button type="button" className="w-fit text-[0.8rem] font-bold text-brand-500" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'} per-flight breakdown</button>
      {open && q.legs.map((leg, li) => (
        <div key={li} className="rounded-lg bg-sand/60 p-2 text-slate-600">
          <p className="font-semibold text-ink">{leg.journeys[0].from} → {leg.journeys.at(-1).to} · {dateLabel(leg.journeys[0].dep)}</p>
          {(leg.paxFares || []).map((f, k) => <p key={k} className="flex justify-between"><span>{TYPE_NAME[f.type] || 'Traveller'} × {f.count}</span><span>{inr(f.base)}</span></p>)}
          <p className="flex justify-between font-bold text-ink"><span>Flight fare</span><span>{inr(leg.price)}</span></p>
        </div>
      ))}
    </div>
  )
}

function FareSummary({ q, extras, left, expired, agree, setAgree, busy, form }) {
  const total = q.total + extras
  return (
    <aside className={`${ui.card} h-fit p-5 lg:sticky lg:top-24`}>
      <h2 className="font-display text-[1.15rem] font-bold text-ink">Fare summary</h2>
      <p className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[0.85rem] font-semibold ${expired ? 'bg-red-50 text-red-700' : left < 180000 ? 'bg-gold-500/15 text-gold-600' : 'bg-palm/10 text-palm'}`}>
        <Clock size={15} /> {expired ? (left > 0 ? 'Too little time is left to pay safely. Please go back and search again.' : 'This fare has timed out. Please search again.') : <>Fare held for <span className="font-mono">{mmss(left)}</span></>}
      </p>
      <FareLines q={q} />
      {extras > 0 && <p className="mt-3 flex justify-between text-[0.92rem]"><span>Seats, meals &amp; baggage</span><span className="font-semibold">{inr(extras)}</span></p>}
      <p className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3"><span className="font-bold text-ink">Total amount</span><span className="font-display text-[1.6rem] font-bold text-navy-950">{inr(total)}</span></p>
      <label className="mt-4 flex items-start gap-2 text-[0.85rem]"><input type="checkbox" className="mt-1 h-4 w-4" required checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>Names match the {q.international ? 'passport' : 'government ID'}, and I accept the fare rules, <Link className="underline" to="/terms">Terms</Link> and <Link className="underline" to="/refund-policy">Refund Policy</Link>.</span></label>
      <button className="btn btn-gold mt-4 hidden w-full py-3.5 text-[1.05rem] lg:inline-flex" disabled={!!busy || expired}>
        {busy ? <><Loader2 className="animate-spin" size={18} /> Please wait…</> : <><Lock size={17} /> Pay {inr(total)}</>}
      </button>
      <ul className="mt-4 grid gap-1.5 text-[0.78rem] text-slate-600">
        <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-palm" /> Secure payment. Card details never touch our servers.</li>
        <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-palm" /> Ticketed on the airline's system, e-ticket by email.</li>
        <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-palm" /> Help from our Bengaluru desk, before and after you fly.</li>
      </ul>
    </aside>
  )
}

/* ---------------- the page ---------------- */

export default function Review({ q, searchedAt, onBack, onPay, busy }) {
  const intl = q.international
  const needPassport = intl || q.legs.some((l) => l.passportRequired)
  const panNeeded = q.legs.some((l) => l.panRequired)
  const passportFull = q.legs.some((l) => l.passportFull)
  const detailChange = q.legs.map((l) => l.detailChange).filter(Boolean)
  const gstMandatory = q.legs.some((l) => l.isGSTMandatory)
  const gstAllowed = gstMandatory || q.legs.some((l) => l.gstAllowed)

  const initial = []
  for (const [t, n] of [[1, q.pax.adults], [2, q.pax.children], [3, q.pax.infants]]) for (let i = 0; i < n; i++) initial.push({ paxType: t, title: TITLES[t][0], firstName: '', lastName: '', dob: '', passportNo: '', passportExpiry: '', passportIssue: '', passportCountry: 'IN', nationality: 'IN', ffAirline: '', ffNumber: '', pan: '', guardian: { title: 'Mr', firstName: '', lastName: '', pan: '' } })
  const [pax, setPax] = useState(initial)
  // frequent flyer: the airlines flying this trip
  const ffAirlines = [...new Map(q.legs.flatMap((l) => l.journeys.flatMap((j) => j.flights)).map((g) => [g.code, { code: g.code, name: g.airline }])).values()]
  const account = useAccount()
  const [contact, setContact] = useState({ phone: account?.profile?.phone || '', email: account?.profile?.email || '', address: '', city: 'Bengaluru' })
  // signing in (here or in another tab) fills the e-mail and mobile, but never overwrites what was already typed
  useEffect(() => { if (account?.profile) setContact((c) => ({ ...c, email: c.email || account.profile.email || '', phone: c.phone || account.profile.phone || '' })) }, [account])
  const [gstOn, setGstOn] = useState(gstMandatory)
  const [gst, setGst] = useState({ number: '', company: '', address: '', phone: '', email: '' })
  const [choices, setChoices] = useState(q.legs.map(() => initial.map(() => ({ baggage: [], meals: [], seats: [], priority: [] }))))
  const [agree, setAgree] = useState(false)

  const addOnsAvailable = q.legs.some((leg) => leg.ssr?.available && leg.ssr.isLCC && ((leg.ssr.seatMaps || []).length || ['meals', 'baggage', 'priority'].some((k) => (leg.ssr[k] || []).some((x) => x.price > 0 || !/^No/.test(x.code)))))
  const expiresAt = searchedAt + HOLD_MS
  const left = useCountdown(expiresAt)
  const expired = left <= SAFE_MS

  const setP = (i, k, v) => setPax((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const setG = (i, k, v) => setPax((p) => p.map((x, j) => (j === i ? { ...x, guardian: { ...x.guardian, [k]: v } } : x)))
  const pick = (li, pi, kind, sectorKey, key) =>
    setChoices((c) => c.map((leg, a) => (a !== li ? leg : leg.map((p, b) => (b !== pi ? p : { ...p, [kind]: [...p[kind].filter((k) => !k.startsWith(sectorKey)), ...(key ? [key] : [])] })))))
  const setPref = (li, pi, k, v) => setChoices((c) => c.map((leg, a) => (a !== li ? leg : leg.map((p, b) => (b !== pi ? p : { ...p, [k]: v })))))
  const extras =q.legs.reduce((t, leg, li) => t + choices[li].reduce((s, c) => s + [...c.baggage, ...c.meals, ...c.seats, ...c.priority].reduce((a, key) => a + (findSsr(leg, key)?.price || 0), 0), 0), 0)

  const submit = (e) => {
    e.preventDefault()
    if (expired) return
    onPay({ passengers: pax.map((p) => ({ ...p, ffAirline: p.ffNumber ? p.ffAirline || ffAirlines[0]?.code : '' })), contact, gst: gstOn ? gst : undefined, choices })
  }
  const label = ui.label, input = ui.input

  return (
    <form id="review-form" onSubmit={submit} className="grid gap-5 pb-24 lg:grid-cols-[1fr_22rem] lg:pb-0">
      <div className="grid content-start gap-5">
        <StepBar addOns={addOnsAvailable} />
        <button type="button" className="inline-flex w-fit items-center gap-1.5 font-bold text-brand-500" onClick={onBack}><ArrowLeft size={17} /> Back to flights</button>

        {detailChange.length > 0 && <p role="status" className="flex gap-2 rounded-xl bg-gold-500/15 p-3 font-semibold text-navy-900"><AlertTriangle size={18} className="shrink-0" />The airline updated this flight ({detailChange.join(', ')}). Please check the details below before paying.</p>}
        {q.legs.some((l) => l.priceChanged) && <p role="status" className="flex gap-2 rounded-xl bg-gold-500/15 p-3 font-semibold text-navy-900"><AlertTriangle size={18} className="shrink-0" />The airline updated this fare. The price shown is the latest.</p>}

        <Section n="1" title="Review your flights">
          <Itinerary q={q} />
          <FareRules legs={q.legs} />
        </Section>

        <Section n="2" title="Traveller details" right={<span className="text-[0.8rem] font-semibold text-slate-500">{pax.length} traveller{pax.length > 1 ? 's' : ''} · <span className="text-red-600">*</span> mandatory</span>}>
          <p className="mb-4 rounded-lg bg-sand px-3 py-2 text-[0.85rem] text-slate-700">Enter names <strong>exactly as on the {intl ? 'passport' : 'government photo ID'}</strong>, letters only. Name changes after booking are not allowed by most airlines.</p>
          <div className="grid gap-4">
            {pax.map((p, i) => (
              <fieldset key={i} className="rounded-xl border border-slate-200 p-4">
                <legend className="flex items-center gap-2 px-2 font-bold text-ink"><span className="rounded-full bg-navy-950 px-2.5 py-0.5 text-[0.75rem] text-white">{TYPE_NAME[p.paxType]} {pax.slice(0, i + 1).filter((x) => x.paxType === p.paxType).length}</span>{i === 0 && <span className="text-[0.78rem] font-semibold text-slate-500">Lead traveller</span>}</legend>
                <div className="grid gap-3 sm:grid-cols-[6.5rem_1fr_1fr]">
                  <div><label className={label} htmlFor={`t${i}`}>Title</label><select id={`t${i}`} className={input} value={p.title} onChange={(e) => setP(i, 'title', e.target.value)}>{TITLES[p.paxType].map((t) => <option key={t}>{t}</option>)}</select></div>
                  <div><label className={label} htmlFor={`f${i}`}>First &amp; middle name</label><input id={`f${i}`} className={input} required maxLength={32} pattern="[A-Za-z ]+" value={p.firstName} onChange={(e) => setP(i, 'firstName', e.target.value)} autoComplete="given-name" /></div>
                  <div><label className={label} htmlFor={`l${i}`}>Last name</label><input id={`l${i}`} className={input} required minLength={2} maxLength={32} pattern="[A-Za-z ]+" value={p.lastName} onChange={(e) => setP(i, 'lastName', e.target.value)} autoComplete="family-name" /></div>
                </div>
                {(p.paxType !== 1 || intl) && <div className="mt-3 sm:w-52"><label className={label} htmlFor={`b${i}`}>Date of birth</label><input id={`b${i}`} type="date" className={input} required max={todayIso()} value={p.dob} onChange={(e) => setP(i, 'dob', e.target.value)} /></div>}
                {needPassport && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div><label className={label} htmlFor={`pn${i}`}>Passport no.</label><input id={`pn${i}`} className={input} required value={p.passportNo} onChange={(e) => setP(i, 'passportNo', e.target.value.toUpperCase())} /></div>
                    <div><label className={label} htmlFor={`pe${i}`}>Passport expiry</label><input id={`pe${i}`} type="date" className={input} required min={todayIso()} value={p.passportExpiry} onChange={(e) => setP(i, 'passportExpiry', e.target.value)} /></div>
                    <div><label className={label} htmlFor={`na${i}`}>Nationality</label><input id={`na${i}`} className={input} maxLength={2} value={p.nationality} onChange={(e) => setP(i, 'nationality', e.target.value.toUpperCase())} /></div>
                  </div>
                )}
                {passportFull && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><label className={label} htmlFor={`pi${i}`}>Passport issue date</label><input id={`pi${i}`} type="date" className={input} required max={todayIso()} value={p.passportIssue} onChange={(e) => setP(i, 'passportIssue', e.target.value)} /></div>
                    <div><label className={label} htmlFor={`pc${i}`}>Issuing country (2 letters)</label><input id={`pc${i}`} className={input} required maxLength={2} value={p.passportCountry} onChange={(e) => setP(i, 'passportCountry', e.target.value.toUpperCase())} /></div>
                  </div>
                )}
                {p.paxType !== 3 && (
                  <details className="mt-3 rounded-lg bg-sand/60 px-3 py-2" open={!!p.ffNumber}>
                    <summary className="cursor-pointer text-[0.88rem] font-semibold text-navy-900">Add frequent flyer number (optional)</summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-[12rem_1fr]">
                      <div><label className={label} htmlFor={`ffa${i}`}>Airline programme</label>
                        <select id={`ffa${i}`} className={input} value={p.ffAirline || ffAirlines[0]?.code || ''} onChange={(e) => setP(i, 'ffAirline', e.target.value)}>
                          {ffAirlines.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
                        </select></div>
                      <div><label className={label} htmlFor={`ffn${i}`}>Membership number</label><input id={`ffn${i}`} className={input} maxLength={20} pattern="[A-Za-z0-9 \-]{4,20}" value={p.ffNumber} onChange={(e) => setP(i, 'ffNumber', e.target.value.toUpperCase())} /></div>
                    </div>
                    <p className="mt-1.5 text-[0.75rem] text-slate-500">Miles are credited by the airline. The name must match your membership.</p>
                  </details>
                )}
                {panNeeded && p.paxType === 1 && <div className="mt-3 sm:w-64"><label className={label} htmlFor={`pan${i}`}>PAN (as on card)</label><input id={`pan${i}`} className={input} required maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" value={p.pan} onChange={(e) => setP(i, 'pan', e.target.value.toUpperCase())} /></div>}
                {panNeeded && p.paxType !== 1 && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[6rem_1fr_1fr_10rem]">
                    <p className="text-[0.85rem] text-slate-600 sm:col-span-4">Parent / guardian PAN details (exactly as on the PAN card)</p>
                    <div><label className={label} htmlFor={`gt${i}`}>Title</label><select id={`gt${i}`} className={input} value={p.guardian.title} onChange={(e) => setG(i, 'title', e.target.value)}>{['Mr', 'Mrs', 'Ms'].map((t) => <option key={t}>{t}</option>)}</select></div>
                    <div><label className={label} htmlFor={`gf${i}`}>First name</label><input id={`gf${i}`} className={input} required value={p.guardian.firstName} onChange={(e) => setG(i, 'firstName', e.target.value)} /></div>
                    <div><label className={label} htmlFor={`gl${i}`}>Last name</label><input id={`gl${i}`} className={input} required value={p.guardian.lastName} onChange={(e) => setG(i, 'lastName', e.target.value)} /></div>
                    <div><label className={label} htmlFor={`gp${i}`}>PAN</label><input id={`gp${i}`} className={input} required maxLength={10} value={p.guardian.pan} onChange={(e) => setG(i, 'pan', e.target.value.toUpperCase())} /></div>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
        </Section>

        <AddOns q={q} pax={pax} choices={choices} pick={pick} n="3" />
        <Preferences q={q} pax={pax} choices={choices} setPref={setPref} />

        <Section n={addOnsAvailable ? '4' : '3'} title="Contact details" right={<span className="text-[0.8rem] font-semibold text-slate-500">Your e-ticket is sent here</span>}>
          {account ? (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-palm/10 px-3 py-2 text-[0.85rem] font-semibold text-palm"><ShieldCheck size={15} /> Signed in as {account.profile?.email}. This booking will appear in My trips.</p>
          ) : (
            <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-[0.85rem] text-slate-700">Have an account? <Link className="font-bold text-brand-500 underline" to="/account" target="_blank" rel="noopener">Sign in</Link> (opens in a new tab, your details here stay) to see this booking in My trips. Or continue as a guest.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="em">Email</label><input id="em" type="email" className={input} required autoComplete="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} /></div>
            <div><label className={label} htmlFor="ph">Mobile number</label><input id="ph" type="tel" className={input} required inputMode="numeric" autoComplete="tel" pattern="\+?[0-9 \(\)\-]{10,18}" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} /></div>
            <div><label className={label} htmlFor="ad">Address</label><input id="ad" className={input} required autoComplete="street-address" value={contact.address} onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))} /></div>
            <div><label className={label} htmlFor="ci">City</label><input id="ci" className={input} required autoComplete="address-level2" value={contact.city} onChange={(e) => setContact((c) => ({ ...c, city: e.target.value }))} /></div>
          </div>
          {gstAllowed && (
            <div className="mt-4 rounded-xl bg-sand/70 p-3">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-4 w-4" checked={gstOn} disabled={gstMandatory} onChange={(e) => setGstOn(e.target.checked)} /> {gstMandatory ? 'GST details (required for this fare)' : 'I have a GST number to add to this booking'}</label>
              {gstOn && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[['number', 'GSTIN'], ['company', 'Company name'], ['address', 'Company address'], ['phone', 'Company phone'], ['email', 'Company email']].map(([k, l]) => (
                    <div key={k}><label className={label} htmlFor={`g${k}`}>{l}</label><input id={`g${k}`} className={input} required value={gst[k]} onChange={(e) => setGst((g) => ({ ...g, [k]: k === 'number' ? e.target.value.toUpperCase() : e.target.value }))} /></div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      <FareSummary q={q} extras={extras} left={left} expired={expired} agree={agree} setAgree={setAgree} busy={busy} />

      {/* phones: the pay button stays reachable at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200 bg-white p-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] lg:hidden">
        <div><p className="text-[0.72rem] text-slate-500">Total</p><p className="font-display text-[1.3rem] leading-none font-bold text-navy-950">{inr(q.total + extras)}</p></div>
        <button className="btn btn-gold px-6 py-3" form="review-form" disabled={!!busy || expired}>{busy ? <Loader2 className="animate-spin" size={18} /> : <><Lock size={16} /> Pay now</>}</button>
      </div>
    </form>
  )
}
