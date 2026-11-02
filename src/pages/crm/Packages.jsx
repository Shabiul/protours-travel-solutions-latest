import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'

import { PACKAGES, TIERS } from '../../data/site.js'
import { crm } from './api.js'
import { Card, Drawer, Empty, Err, btnDark, btnLight, input } from './ui.jsx'

const CATS = [['international', 'International'], ['india', 'India'], ['honeymoon', 'Honeymoon'], ['family', 'Family'], ['umrah', 'Umrah']]
const LABEL = 'text-[0.8rem] font-bold text-slate-600 uppercase'
const slug = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const blank = () => ({ id: '', name: '', region: '', nights: '', cats: ['international'], badge: '', img: '', desc: '', exc: ['Personal expenses and shopping', 'Tips and gratuities', 'Travel insurance (we can advise you on a policy)'], hidden: false, tiers: Object.fromEntries(TIERS.map((t) => [t, { hotel: '', inc: [] }])) })

/** The tour packages shown on the website's Packages page and home page. What is saved here appears there within about a minute. */
export default function PackagesAdmin({ admin }) {
  const [items, setItems] = useState(null)
  const [custom, setCustom] = useState(false)
  const [meta, setMeta] = useState(null)
  const [edit, setEdit] = useState(null) // { p, isNew }
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    crm('content', { key: 'packages' }).then((r) => { setItems(r.items || PACKAGES); setCustom(!!r.items); setMeta(r) }).catch((e) => setErr(e.message))
  }, [])

  const save = async (next, done = 'Saved. It is on the website now (allow up to a minute).') => {
    setBusy(true); setErr(''); setMsg('')
    try { await crm('contentSave', { key: 'packages', items: next }, 'POST'); setItems(next); setCustom(true); setMsg(done); return true } catch (e) { setErr(e.message); return false } finally { setBusy(false) }
  }
  const reset = async () => {
    if (!window.confirm('Go back to the packages the website shipped with? Your changes and added packages will be removed.')) return
    setBusy(true); setErr(''); setMsg('')
    try { await crm('contentReset', { key: 'packages' }, 'POST'); setItems(PACKAGES); setCustom(false); setMsg('Back to the original packages.') } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const move = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; save(n, 'Order saved.') }

  if (!items) return <Empty>{err ? <Err>{err}</Err> : <Loader2 className="mx-auto animate-spin" />}</Empty>
  return (
    <div className="grid gap-4">
      <Card title="Tours & packages" right={<a className="inline-flex items-center gap-1 text-[0.85rem] font-bold text-brand-500" href="/packages" target="_blank" rel="noreferrer">View on the website <ExternalLink size={14} /></a>}>
        <p className="text-[0.9rem] text-slate-600">Everything here is what visitors see on the website&apos;s Packages page and the home page. {custom ? `Last saved by ${meta?.by || 'staff'}.` : 'You have not changed anything yet: this is the list the website shipped with.'}</p>
        {!admin && <p className="mt-2 text-[0.85rem] font-semibold text-slate-700">Only an administrator can change the website. You can look but not edit.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {admin && <button className={btnDark} onClick={() => setEdit({ p: blank(), isNew: true })}><Plus size={16} /> Add a package</button>}
          {admin && custom && <button className={btnLight} onClick={reset} disabled={busy}><RotateCcw size={16} /> Back to the original list</button>}
        </div>
        <Err>{err}</Err>
        {msg && <p role="status" className="mt-2 text-[0.9rem] font-semibold text-emerald-700">{msg}</p>}
      </Card>
      <ul className="grid gap-2">
        {items.map((p, i) => (
          <li key={p.id} className={`grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm ${p.hidden ? 'border-dashed border-slate-300 opacity-70' : 'border-slate-200'}`}>
            <img src={p.img} alt="" loading="lazy" className="h-14 w-[4.5rem] rounded-lg bg-sand object-cover" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{p.name} {p.badge && <span className="ml-1 rounded-full bg-sand px-2 py-0.5 text-[0.7rem] font-bold uppercase">{p.badge}</span>}{p.hidden && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[0.7rem] font-bold uppercase">Hidden</span>}</p>
              <p className="truncate text-[0.82rem] text-slate-500">{p.region} · {p.nights} · {(p.cats || []).join(', ')}</p>
            </div>
            {admin && (
              <div className="flex items-center gap-1">
                <button className={`${btnLight} !px-2`} aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                <button className={`${btnLight} !px-2`} aria-label="Move down" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                <button className={`${btnLight} !px-2`} aria-label={p.hidden ? 'Show on the website' : 'Hide from the website'} title={p.hidden ? 'Show on the website' : 'Hide from the website'} disabled={busy} onClick={() => save(items.map((x) => (x.id === p.id ? { ...x, hidden: !x.hidden } : x)), p.hidden ? 'Now shown on the website.' : 'Now hidden from the website.')}>{p.hidden ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                <button className={`${btnLight} !px-2`} aria-label={`Edit ${p.name}`} onClick={() => setEdit({ p: JSON.parse(JSON.stringify(p)), isNew: false })}><Pencil size={15} /></button>
                <button className={`${btnLight} !px-2 text-red-700`} aria-label={`Delete ${p.name}`} disabled={busy} onClick={() => { if (window.confirm(`Delete "${p.name}" from the website?`)) save(items.filter((x) => x.id !== p.id), 'Deleted.') }}><Trash2 size={15} /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {edit && <PackageForm start={edit.p} isNew={edit.isNew} taken={items.map((x) => x.id)} onClose={() => setEdit(null)} onSave={async (p) => { const next = edit.isNew ? [...items, p] : items.map((x) => (x.id === edit.p.id ? p : x)); if (await save(next)) setEdit(null) }} />}
    </div>
  )
}

function PackageForm({ start, isNew, taken, onClose, onSave }) {
  const [p, setP] = useState(() => ({ ...start, highlights: (start.highlights || []).join('\n'), bestTime: start.bestTime || '', notes: start.notes || '',
    stops: (start.stops || []).map((x) => ({ ...x, activities: (x.activities || []).join('\n') })), days: (start.days || []).map((x) => ({ ...x })), exc: (start.exc || []).join('\n'), tiers: Object.fromEntries(TIERS.map((t) => [t, { hotel: start.tiers?.[t]?.hotel || '', inc: (start.tiers?.[t]?.inc || []).join('\n') }])) }))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }))
  const setTier = (t, k, v) => setP((x) => ({ ...x, tiers: { ...x.tiers, [t]: { ...x.tiers[t], [k]: v } } }))
  const id = isNew ? slug(p.id || p.name) : p.id
  const setStop = (i, k, v) => setP((x) => ({ ...x, stops: x.stops.map((y, j) => (j === i ? { ...y, [k]: v } : y)) }))
  const moveStop = (i, d) => setP((x) => { const n = [...x.stops]; const j = i + d; if (j < 0 || j >= n.length) return x; [n[i], n[j]] = [n[j], n[i]]; return { ...x, stops: n } })
  const setDay = (i, k, v) => setP((x) => ({ ...x, days: x.days.map((y, j) => (j === i ? { ...y, [k]: v } : y)) }))
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (isNew && taken.includes(id)) return setErr('Another package already has that web name. Change the name a little.')
    setBusy(true)
    const out = { ...p, id, highlights: p.highlights.split('\n').map((x) => x.trim()).filter(Boolean), stops: p.stops.map((x) => ({ ...x, activities: x.activities.split('\n').map((a) => a.trim()).filter(Boolean) })), exc: p.exc.split('\n').map((s) => s.trim()).filter(Boolean), tiers: Object.fromEntries(TIERS.map((t) => [t, { hotel: p.tiers[t].hotel, inc: p.tiers[t].inc.split('\n').map((s) => s.trim()).filter(Boolean) }])) }
    await onSave(out).catch((x) => setErr(x.message))
    setBusy(false)
  }
  return (
    <Drawer title={isNew ? 'Add a package' : `Edit ${start.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <Card title="The basics">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${LABEL} sm:col-span-2`}>Package name <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required maxLength={90} value={p.name} onChange={set('name')} placeholder="Dubai City Break & Desert Safari" /></label>
            <label className={LABEL}>Country / region <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required maxLength={60} value={p.region} onChange={set('region')} placeholder="United Arab Emirates" /></label>
            <label className={LABEL}>Length <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required maxLength={20} value={p.nights} onChange={set('nights')} placeholder="4N / 5D" /></label>
            <label className={LABEL}>Badge (optional)<input className={`${input} mt-1 normal-case`} maxLength={24} value={p.badge || ''} onChange={set('badge')} placeholder="Best Seller" /></label>
            <label className={LABEL}>Web name {isNew ? '(made from the name)' : '(fixed)'}<input className={`${input} mt-1 normal-case`} value={id} disabled={!isNew} onChange={isNew ? (e) => setP((x) => ({ ...x, id: slug(e.target.value) })) : undefined} /></label>
          </div>
          <fieldset className="mt-3"><legend className={LABEL}>Shown under these filters</legend>
            <div className="mt-1 flex flex-wrap gap-2">{CATS.map(([v, l]) => <label key={v} className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-[0.88rem] font-semibold"><input type="checkbox" checked={(p.cats || []).includes(v)} onChange={(e) => setP((x) => ({ ...x, cats: e.target.checked ? [...x.cats, v] : x.cats.filter((c) => c !== v) }))} />{l}</label>)}</div>
          </fieldset>
        </Card>
        <Card title="Picture and description">
          <label className={LABEL}>Picture address (https://…) <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required type="url" maxLength={500} value={p.img} onChange={set('img')} placeholder="https://images.unsplash.com/photo-…" /></label>
          {p.img && <img src={p.img} alt="" className="mt-2 h-36 w-full rounded-xl bg-sand object-cover" />}
          <label className={`${LABEL} mt-3 block`}>Description <span className="text-red-600">*</span><textarea className={`${input} mt-1 normal-case`} required rows={3} maxLength={600} value={p.desc} onChange={set('desc')} /></label>
          <label className={`${LABEL} mt-3 block`}>Not included (one per line)<textarea className={`${input} mt-1 normal-case`} rows={4} value={p.exc} onChange={set('exc')} /></label>
        </Card>
        <Card title={`Destinations in this package (${p.stops.length})`} right={<button type="button" className="text-[0.85rem] font-bold text-brand-500" onClick={() => setP((x) => ({ ...x, stops: [...x.stops, { name: '', nights: '', hotel: '', desc: '', activities: '' }] }))}><Plus size={14} className="mr-1 inline" />Add a destination</button>}>
          <p className="text-[0.85rem] text-slate-500">For a trip that visits several places (for example Dubai, then Abu Dhabi), add each place in the order of travel, with its nights, stay and activities. Visitors see them under &ldquo;See the full itinerary&rdquo;.</p>
          <div className="mt-3 grid gap-3">
            {p.stops.map((st, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-bold text-ink">Destination {i + 1}</p>
                  <span className="flex gap-1"><button type="button" className={`${btnLight} !px-2`} aria-label="Move destination up" disabled={i === 0} onClick={() => moveStop(i, -1)}><ArrowUp size={14} /></button><button type="button" className={`${btnLight} !px-2`} aria-label="Move destination down" disabled={i === p.stops.length - 1} onClick={() => moveStop(i, 1)}><ArrowDown size={14} /></button><button type="button" className={`${btnLight} !px-2 text-red-700`} aria-label={`Remove destination ${i + 1}`} onClick={() => setP((x) => ({ ...x, stops: x.stops.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button></span></div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input aria-label="Destination name" className={`${input} normal-case sm:col-span-2`} required maxLength={60} placeholder="Place (Abu Dhabi)" value={st.name} onChange={(e) => setStop(i, 'name', e.target.value)} />
                  <input aria-label="Nights here" className={`${input} normal-case`} maxLength={20} placeholder="2 nights" value={st.nights} onChange={(e) => setStop(i, 'nights', e.target.value)} />
                </div>
                <input aria-label="Stay here" className={`${input} normal-case`} maxLength={90} placeholder="Where you stay here (optional)" value={st.hotel} onChange={(e) => setStop(i, 'hotel', e.target.value)} />
                <textarea aria-label="About this destination" className={`${input} normal-case`} rows={2} maxLength={500} placeholder="A line or two about this stop" value={st.desc} onChange={(e) => setStop(i, 'desc', e.target.value)} />
                <textarea aria-label="Activities here" className={`${input} normal-case`} rows={3} placeholder={'Activities, one per line\nDesert safari with BBQ\nBurj Khalifa level 124'} value={st.activities} onChange={(e) => setStop(i, 'activities', e.target.value)} />
              </div>
            ))}
            {!p.stops.length && <p className="text-[0.88rem] text-slate-500">Nothing added: the package shows only its country / region.</p>}
          </div>
        </Card>
        <Card title={`Day-by-day plan (${p.days.length})`} right={<button type="button" className="text-[0.85rem] font-bold text-brand-500" onClick={() => setP((x) => ({ ...x, days: [...x.days, { title: '', details: '' }] }))}><Plus size={14} className="mr-1 inline" />Add a day</button>}>
          <div className="grid gap-3">
            {p.days.map((d, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-bold text-ink">Day {i + 1}</p><button type="button" className={`${btnLight} !px-2 text-red-700`} aria-label={`Remove day ${i + 1}`} onClick={() => setP((x) => ({ ...x, days: x.days.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button></div>
                <input aria-label="Day title" className={`${input} normal-case`} required maxLength={100} placeholder="Arrive in Dubai, Dhow dinner" value={d.title} onChange={(e) => setDay(i, 'title', e.target.value)} />
                <textarea aria-label="Day details" className={`${input} normal-case`} rows={2} maxLength={700} placeholder="What happens on this day" value={d.details} onChange={(e) => setDay(i, 'details', e.target.value)} />
              </div>
            ))}
            {!p.days.length && <p className="text-[0.88rem] text-slate-500">Optional. Leave empty if you do not want a day-wise plan.</p>}
          </div>
        </Card>
        <Card title="Highlights and good to know">
          <label className={LABEL}>Highlights (one per line, up to 10)<textarea className={`${input} mt-1 normal-case`} rows={4} value={p.highlights} onChange={set('highlights')} placeholder={'Burj Khalifa level 124\nRed-dune desert safari'} /></label>
          <label className={`${LABEL} mt-3 block`}>Best time to go<input className={`${input} mt-1 normal-case`} maxLength={100} value={p.bestTime} onChange={set('bestTime')} placeholder="November to March" /></label>
          <label className={`${LABEL} mt-3 block`}>Important notes (visa, age limits, how to pay…)<textarea className={`${input} mt-1 normal-case`} rows={3} maxLength={900} value={p.notes} onChange={set('notes')} /></label>
        </Card>
        {TIERS.map((t) => (
          <Card key={t} title={`${t} tier`}>
            <label className={LABEL}>Hotel <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required maxLength={90} value={p.tiers[t].hotel} onChange={(e) => setTier(t, 'hotel', e.target.value)} placeholder="4★ Downtown / Marina" /></label>
            <label className={`${LABEL} mt-3 block`}>Included (one per line, up to 10) <span className="text-red-600">*</span><textarea className={`${input} mt-1 normal-case`} required rows={5} value={p.tiers[t].inc} onChange={(e) => setTier(t, 'inc', e.target.value)} /></label>
          </Card>
        ))}
        <Err>{err}</Err>
        <div className="flex gap-2"><button className={btnDark} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Save to the website'}</button><button type="button" className={btnLight} onClick={onClose}>Cancel</button></div>
      </form>
    </Drawer>
  )
}
