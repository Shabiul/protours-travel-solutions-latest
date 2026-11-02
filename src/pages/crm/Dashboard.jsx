import { useEffect, useState } from 'react'
import { AlertTriangle, CreditCard, Loader2, MessageSquareText, Plane, TrendingUp } from 'lucide-react'

import { crm } from './api.js'
import { BOOKING_STATUS, Card, ENQUIRY_STATUS, Err, FollowUp, Pill, SERVICE_NAME, ServiceTag, ago, inr, useNarrow } from './ui.jsx'

function Kpi({ icon: Icon, label, value, sub, tone = 'text-navy-950', onClick, wide }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-[0.78rem] font-bold tracking-wide text-slate-500 uppercase"><Icon size={15} /> {label}</span>
      <span className={`mt-1 block font-display text-[1.5rem] leading-tight font-bold sm:text-[1.8rem] ${tone}`}>{value}</span>
      {sub && <span className="text-[0.8rem] text-slate-500">{sub}</span>}
    </>
  )
  const cls = `min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm sm:p-4 ${wide ? 'col-span-2 sm:col-span-1' : ''}`
  return onClick ? <button className={`${cls} transition hover:border-brand-500`} onClick={onClick}>{body}</button> : <div className={cls}>{body}</div>
}

/** 14 days of ticketed bookings and enquiries. Drawn by hand: two series, labelled, no library. */
/** Every service at a glance (last 12 months of enquiries) with the follow-ups that are due. */
function Services({ s, flights, onOpenEnquiry, onFollowUps }) {
  const rows = s.services || []
  const f = s.followups || { today: 0, overdue: 0, next: [] }
  return (
    <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
      <Card title="Services" right={<span className="text-[0.78rem] text-slate-500">Enquiries, last 12 months</span>}>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:hidden">
          {[
            { key: 'flights', name: 'Flight Booking', sub: 'online bookings', stats: [['Open', flights.pending], ['Won', flights.ticketed]], value: inr(flights.revenue30), note: '30 days, ticketed' },
            ...rows.map((r) => ({ key: r.service, name: SERVICE_NAME[r.service] || 'Other', stats: [['New', r.new], ['Open', r.open], ['Won', r.won], ['Lost', r.lost]], value: inr(r.won_value), note: `${inr(r.pipeline_value)} in pipeline` })),
          ].map((x) => (
            <li key={x.key} className="rounded-xl border border-slate-200 p-3">
              <p className="flex items-baseline justify-between gap-2"><span className="font-semibold text-ink">{x.name}{x.sub && <span className="ml-1 text-[0.72rem] font-normal text-slate-500">({x.sub})</span>}</span><span className="font-bold text-navy-900">{x.value}</span></p>
              <p className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[0.82rem] text-slate-600"><span className="flex gap-3">{x.stats.map(([k, v]) => <span key={k}>{k} <b className="text-ink">{v}</b></span>)}</span><span className="text-slate-500">{x.note}</span></p>
            </li>
          ))}
          {!rows.length && <li className="text-[0.88rem] text-slate-500">No enquiries yet. They appear here by service as they arrive.</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[34rem] text-left text-[0.88rem]">
            <thead className="text-[0.72rem] tracking-wide text-slate-500 uppercase"><tr><th className="py-1">Service</th><th>New</th><th>Open</th><th>Won</th><th>Lost</th><th className="text-right">Won value</th><th className="text-right">In pipeline</th></tr></thead>
            <tbody>
              <tr className="border-t border-slate-100"><td className="py-2 font-semibold">Flight Booking <span className="text-[0.72rem] font-normal text-slate-500">(online bookings)</span></td><td>—</td><td>{flights.pending}</td><td>{flights.ticketed}</td><td>—</td><td className="text-right font-semibold">{inr(flights.revenue30)}</td><td className="text-right text-[0.75rem] text-slate-500">30 days, ticketed</td></tr>
              {rows.map((r) => (
                <tr key={r.service} className="border-t border-slate-100"><td className="py-2 font-semibold">{SERVICE_NAME[r.service] || 'Other'}</td><td>{r.new}</td><td>{r.open}</td><td>{r.won}</td><td>{r.lost}</td><td className="text-right font-semibold">{inr(r.won_value)}</td><td className="text-right text-slate-600">{inr(r.pipeline_value)}</td></tr>
              ))}
              {!rows.length && <tr><td colSpan="7" className="py-3 text-slate-500">No enquiries yet. They appear here by service as they arrive.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Follow-ups" right={<button className="inline-flex min-h-10 items-center px-2 text-[0.85rem] font-bold text-brand-500" onClick={() => onFollowUps('any')}>Open</button>}>
        <div className="mb-2 flex gap-4 text-[0.9rem]"><button className="text-left" onClick={() => onFollowUps('overdue')}><span className={`block font-display text-[1.5rem] font-bold ${f.overdue ? 'text-red-700' : 'text-navy-950'}`}>{f.overdue}</span>overdue</button><button className="text-left" onClick={() => onFollowUps('today')}><span className="block font-display text-[1.5rem] font-bold text-navy-950">{f.today}</span>due today</button></div>
        {!f.next?.length ? <p className="text-[0.88rem] text-slate-500">Nothing due in the next 3 days. Set a follow-up date on a lead to be reminded here.</p> : <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">{f.next.map((x) => <li key={x.id}><button className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg px-2 py-2.5 text-left hover:bg-sand" onClick={() => onOpenEnquiry(x.id)}><span className="min-w-0 max-w-full truncate"><span className="font-semibold">{x.name}</span> <ServiceTag service={x.service} /></span><FollowUp date={x.follow_up_at} status="new" /></button></li>)}</ul>}
      </Card>
    </div>
  )
}

function Chart({ daily: all }) {
  const narrow = useNarrow()
  const daily = narrow ? all.slice(-7) : all
  const W = narrow ? 360 : 720, H = narrow ? 200 : 170, pad = narrow ? 26 : 24, fs = narrow ? 12 : 10
  const max = Math.max(1, ...daily.map((d) => Math.max(d.bookings, d.enquiries)))
  const step = (W - pad * 2) / daily.length, bw = Math.min(narrow ? 18 : 16, step / 2 - 2)
  const y = (v) => H - 28 - (v / max) * (H - 50)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ticketed bookings and enquiries per day, last 14 days. ${daily.map((d) => `${d.date}: ${d.bookings} bookings, ${d.enquiries} enquiries`).join('; ')}`} className="w-full">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={pad} x2={W - 6} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" /><text x={pad - 6} y={y(max * t) + 4} textAnchor="end" fontSize={fs} fill="#64748b">{Math.round(max * t)}</text></g>)}
      {daily.map((d, i) => {
        const x = pad + i * step + step / 2
        return (
          <g key={d.date}>
            <title>{`${d.date}: ${d.bookings} ticketed, ${d.enquiries} enquiries`}</title>
            <rect x={x - bw - 1} y={y(d.bookings)} width={bw} height={Math.max(0, H - 28 - y(d.bookings))} rx="2" fill="#0f5e9e" />
            <rect x={x + 1} y={y(d.enquiries)} width={bw} height={Math.max(0, H - 28 - y(d.enquiries))} rx="2" fill="#f5bc48" />
            <text x={x} y={H - 10} textAnchor="middle" fontSize={fs} fill="#64748b">{d.date.slice(8)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Dashboard({ go, onOpenBooking, onOpenEnquiry, onFollowUps }) {
  const [o, setO] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    // Refresh every 5 minutes, but only while the tab is visible, and straight away when you come back to a stale one.
    // (Every refresh is a function call on a metered free plan; a hidden tab should cost nothing.)
    let live = true, last = 0
    const load = () => { last = Date.now(); crm('overview').then((r) => live && (setO(r), setErr(''))).catch((e) => live && setErr(e.message)) }
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 5 * 60_000)
    const onVisible = () => { if (!document.hidden && Date.now() - last > 2 * 60_000) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  if (!o) return err ? <Err>{err}</Err> : <Loader2 className="mx-auto mt-10 animate-spin" />
  const b = o.bookings, e = o.enquiries
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {o.env !== 'live' && <p className="flex items-center gap-2 rounded-xl bg-gold-500/15 px-4 py-2.5 text-[0.9rem] font-semibold text-navy-900"><AlertTriangle size={16} /> Test mode: these are TBO staging bookings, not real tickets.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi wide icon={TrendingUp} label="Revenue today" value={inr(b.revenueToday)} sub={`${inr(b.revenue7)} in 7 days · ${inr(b.revenue30)} in 30 days`} />
        <Kpi wide icon={TrendingUp} label="Markup earned" value={inr(b.markupToday)} sub={`${inr(b.markup7)} in 7 days · ${inr(b.markup30)} in 30 days (ticketed)`} tone="text-emerald-800" />
        <Kpi icon={Plane} label="Ticketed (120 days)" value={b.ticketed} sub={`${b.total} booking attempts`} onClick={() => go('bookings')} />
        <Kpi icon={AlertTriangle} label="Needs attention" value={b.attention} tone={b.attention ? 'text-red-700' : 'text-navy-950'} sub="Paid but not ticketed, or failed" onClick={() => go('bookings')} />
        <Kpi wide icon={CreditCard} label="Awaiting payment" value={b.pending} sub={`${b.abandoned} older than 30 min (likely abandoned)`} onClick={() => go('bookings')} />
      </div>
      {o.serviceSummary && <Services s={o.serviceSummary} flights={b} onOpenEnquiry={onOpenEnquiry} onFollowUps={onFollowUps} />}
      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="Last 14 days" right={<span className="flex items-center gap-3 text-[0.78rem] text-slate-600"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#0f5e9e]" />Ticketed</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#f5bc48]" />Enquiries</span></span>}><Chart daily={o.daily} /></Card>
        <Card title="Enquiry pipeline" right={<button className="inline-flex min-h-10 items-center px-2 text-[0.85rem] font-bold text-brand-500" onClick={() => go('enquiries')}>Open</button>}>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">{['new', 'contacted', 'quoted', 'won', 'lost'].map((s) => <li key={s} className="flex items-center justify-between"><Pill status={s} map={ENQUIRY_STATUS} /><span className="font-display text-[1.2rem] font-bold">{e[s]}</span></li>)}</ul>
        </Card>
      </div>
      {o.needsAttention.length > 0 && (
        <Card title="Needs attention" className="border-red-200">
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">{o.needsAttention.map((r) => <li key={r.id}><button className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sand" onClick={() => onOpenBooking(r.id)}><span><span className="font-mono text-[0.8rem]">{r.order_ref}</span> <span className="font-semibold">{r.customer_name}</span> <span className="text-slate-500">{r.route}</span></span><span className="flex items-center gap-2"><Pill status={r.status} map={BOOKING_STATUS} /><span className="text-[0.75rem] text-slate-500">{ago(r.created_at)}</span></span></button></li>)}</ul>
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Latest bookings" right={<button className="inline-flex min-h-10 items-center px-2 text-[0.85rem] font-bold text-brand-500" onClick={() => go('bookings')}>All</button>}>
          {!o.recentBookings.length ? <p className="text-[0.9rem] text-slate-500">No bookings yet.</p> : <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">{o.recentBookings.map((r) => <li key={r.id}><button className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg px-2 py-2.5 text-left hover:bg-sand" onClick={() => onOpenBooking(r.id)}><span className="min-w-0 max-w-full truncate"><span className="font-semibold">{r.customer_name || r.order_ref}</span> <span className="text-[0.82rem] text-slate-500">{r.route} · {inr(r.amount_inr)}</span></span><span className="flex shrink-0 items-center gap-2"><Pill status={r.status} map={BOOKING_STATUS} /><span className="w-16 text-right text-[0.75rem] text-slate-500">{ago(r.created_at)}</span></span></button></li>)}</ul>}
        </Card>
        <Card title="Latest enquiries" right={<button className="inline-flex min-h-10 items-center px-2 text-[0.85rem] font-bold text-brand-500" onClick={() => go('enquiries')}>All</button>}>
          {!o.recentEnquiries.length ? <p className="flex items-center gap-2 text-[0.9rem] text-slate-500"><MessageSquareText size={16} /> No enquiries yet.</p> : <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">{o.recentEnquiries.map((r) => <li key={r.id}><button className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg px-2 py-2.5 text-left hover:bg-sand" onClick={() => onOpenEnquiry(r.id)}><span className="min-w-0 max-w-full truncate"><span className="font-semibold">{r.name}</span> <span className="text-[0.82rem] text-slate-500">{r.topic || r.phone}</span></span><span className="flex shrink-0 items-center gap-2"><Pill status={r.status} map={ENQUIRY_STATUS} /><span className="w-16 text-right text-[0.75rem] text-slate-500">{ago(r.created_at)}</span></span></button></li>)}</ul>}
        </Card>
      </div>
    </div>
  )
}
