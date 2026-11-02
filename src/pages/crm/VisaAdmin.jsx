import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'

import { REGIONS, VISAS, VISA_TYPES } from '../../data/visas.js'
import { crm } from './api.js'
import { Card, Drawer, Empty, Err, btnDark, btnLight, input } from './ui.jsx'

const LABEL = 'text-[0.8rem] font-bold text-slate-600 uppercase'
const DEFAULT_PASSPORT = [
  'Fresh application, re-issue and renewal',
  'Tatkal applications when you are travelling at short notice',
  'Lost, damaged or exhausted-pages replacement',
  'Minors, post-marriage name change and address correction',
  'PSK appointment slots and document verification before you go',
]
const TONE = { free: 'bg-emerald-100 text-emerald-800', arrival: 'bg-sky-100 text-sky-800', evisa: 'bg-amber-100 text-amber-800', embassy: 'bg-rose-100 text-rose-800' }

/** The visa destinations list and the passport services shown on the website's Visa & Passport page. */
export default function VisaAdmin({ admin }) {
  const [visas, setVisas] = useState(null)
  const [visaCustom, setVisaCustom] = useState(false)
  const [passport, setPassport] = useState(null)
  const [pp, setPp] = useState('')
  const [ppCustom, setPpCustom] = useState(false)
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('All')
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([crm('content', { key: 'visas' }), crm('content', { key: 'passport' })]).then(([v, p]) => {
      setVisas(v.items || VISAS); setVisaCustom(!!v.items)
      setPassport(p.items || DEFAULT_PASSPORT); setPp((p.items || DEFAULT_PASSPORT).join('\n')); setPpCustom(!!p.items)
    }).catch((e) => setErr(e.message))
  }, [])

  const run = async (fn, ok) => { setBusy(true); setErr(''); setMsg(''); try { await fn(); setMsg(ok); return true } catch (e) { setErr(e.message); return false } finally { setBusy(false) } }
  const saveVisas = (next, ok = 'Saved. It is on the website now (allow up to a minute).') => run(async () => { await crm('contentSave', { key: 'visas', items: next }, 'POST'); setVisas(next); setVisaCustom(true) }, ok)
  const resetVisas = () => { if (window.confirm('Go back to the destination list the website shipped with? Your changes will be removed.')) run(async () => { await crm('contentReset', { key: 'visas' }, 'POST'); setVisas(VISAS); setVisaCustom(false) }, 'Back to the original list.') }
  const savePassport = (e) => { e.preventDefault(); const items = pp.split('\n').map((s) => s.trim()).filter(Boolean); run(async () => { await crm('contentSave', { key: 'passport', items }, 'POST'); setPassport(items); setPp(items.join('\n')); setPpCustom(true) }, 'Saved. It is on the website now (allow up to a minute).') }
  const resetPassport = () => { if (window.confirm('Go back to the original passport services?')) run(async () => { await crm('contentReset', { key: 'passport' }, 'POST'); setPassport(DEFAULT_PASSPORT); setPp(DEFAULT_PASSPORT.join('\n')); setPpCustom(false) }, 'Back to the original list.') }

  const shown = useMemo(() => (visas || []).filter((v) => (region === 'All' || v.r === region) && (!q.trim() || `${v.c} ${v.r}`.toLowerCase().includes(q.trim().toLowerCase()))), [visas, q, region])

  if (!visas) return <Empty>{err ? <Err>{err}</Err> : <Loader2 className="mx-auto animate-spin" />}</Empty>
  return (
    <div className="grid gap-4">
      <Card title="Passport services" right={<a className="inline-flex items-center gap-1 text-[0.85rem] font-bold text-brand-500" href="/visa#passport" target="_blank" rel="noreferrer">View on the website <ExternalLink size={14} /></a>}>
        <form onSubmit={savePassport} className="grid gap-2">
          <label className={LABEL}>What we do for passports (one per line, up to 12)<textarea className={`${input} mt-1 normal-case`} rows={6} maxLength={2000} value={pp} onChange={(e) => setPp(e.target.value)} disabled={!admin} /></label>
          {admin && <div className="flex flex-wrap gap-2"><button className={btnDark} disabled={busy}>Save to the website</button>{ppCustom && <button type="button" className={btnLight} onClick={resetPassport} disabled={busy}><RotateCcw size={16} /> Back to the original</button>}</div>}
        </form>
      </Card>

      <Card title={`Visa destinations (${visas.length})`} right={<a className="inline-flex items-center gap-1 text-[0.85rem] font-bold text-brand-500" href="/visa" target="_blank" rel="noreferrer">View on the website <ExternalLink size={14} /></a>}>
        <p className="text-[0.9rem] text-slate-600">The country list, visa type, processing time and notes visitors see on the Visa page. {visaCustom ? 'You have changed this list.' : 'You have not changed anything yet: this is the list the website shipped with.'}</p>
        {!admin && <p className="mt-2 text-[0.85rem] font-semibold text-slate-700">Only an administrator can change the website. You can look but not edit.</p>}
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_12rem_auto_auto]">
          <label className="relative block"><span className="sr-only">Search destinations</span><Search size={16} className="absolute top-3 left-3 text-slate-400" /><input className={`${input} pl-9`} placeholder="Search a country" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <select aria-label="Region" className={input} value={region} onChange={(e) => setRegion(e.target.value)}><option>All</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
          {admin && <button className={btnDark} onClick={() => setEdit({ v: { c: '', r: region === 'All' ? REGIONS[0] : region, t: 'evisa', time: '', stay: '', note: '' }, isNew: true })}><Plus size={16} /> Add a country</button>}
          {admin && visaCustom && <button className={btnLight} onClick={resetVisas} disabled={busy}><RotateCcw size={16} /> Original list</button>}
        </div>
        <Err>{err}</Err>
        {msg && <p role="status" className="mt-2 text-[0.9rem] font-semibold text-emerald-700">{msg}</p>}
      </Card>

      <ul className="grid gap-2">
        {shown.map((v) => (
          <li key={v.c} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{v.c} <span className={`ml-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase ${TONE[v.t]}`}>{VISA_TYPES[v.t]?.label}</span></p>
              <p className="truncate text-[0.82rem] text-slate-500">{v.r} · {v.time} · stay {v.stay}</p>
              <p className="truncate text-[0.82rem] text-slate-600">{v.note}</p>
            </div>
            {admin && <div className="flex gap-1">
              <button className={`${btnLight} !px-2`} aria-label={`Edit ${v.c}`} onClick={() => setEdit({ v: { ...v }, isNew: false })}><Pencil size={15} /></button>
              <button className={`${btnLight} !px-2 text-red-700`} aria-label={`Delete ${v.c}`} disabled={busy} onClick={() => { if (window.confirm(`Remove ${v.c} from the website list?`)) saveVisas(visas.filter((x) => x.c !== v.c), 'Removed.') }}><Trash2 size={15} /></button>
            </div>}
          </li>
        ))}
        {!shown.length && <Empty>No destinations match.</Empty>}
      </ul>
      {edit && <VisaForm start={edit.v} isNew={edit.isNew} onClose={() => setEdit(null)} onSave={async (v) => {
        const next = edit.isNew ? [...visas, v] : visas.map((x) => (x.c === edit.v.c ? v : x))
        next.sort((a, b) => REGIONS.indexOf(a.r) - REGIONS.indexOf(b.r)) // stable: keeps the order inside a region
        if (await saveVisas(next)) setEdit(null)
      }} />}
    </div>
  )
}

function VisaForm({ start, isNew, onClose, onSave }) {
  const [v, setV] = useState(start)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => { e.preventDefault(); setBusy(true); await onSave(v); setBusy(false) }
  return (
    <Drawer title={isNew ? 'Add a country' : `Edit ${start.c}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <label className={LABEL}>Country <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required minLength={2} maxLength={60} value={v.c} onChange={set('c')} /></label>
        <label className={LABEL}>Region<select className={`${input} mt-1`} value={v.r} onChange={set('r')}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className={LABEL}>Visa type<select className={`${input} mt-1`} value={v.t} onChange={set('t')}>{Object.entries(VISA_TYPES).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}</select></label>
        <label className={LABEL}>Processing time<input className={`${input} mt-1 normal-case`} maxLength={40} value={v.time} onChange={set('time')} placeholder="3–5 working days" /></label>
        <label className={LABEL}>Length of stay<input className={`${input} mt-1 normal-case`} maxLength={40} value={v.stay} onChange={set('stay')} placeholder="30 days" /></label>
        <label className={LABEL}>Note for visitors<textarea className={`${input} mt-1 normal-case`} rows={3} maxLength={220} value={v.note} onChange={set('note')} /></label>
        <div className="flex gap-2"><button className={btnDark} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Save to the website'}</button><button type="button" className={btnLight} onClick={onClose}>Cancel</button></div>
      </form>
    </Drawer>
  )
}
