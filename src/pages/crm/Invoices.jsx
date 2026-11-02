import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'

import { crm } from './api.js'
import { Card, Drawer, Empty, Err, Pager, btnDark, btnLight, dayLabel, inr, input } from './ui.jsx'

const GST = [0, 5, 12, 18, 28]
const r2 = (n) => Math.round(n * 100) / 100
const totals = (lines, gst) => {
  const sub = lines.reduce((t, l) => t + (l.desc.trim() && Number(l.rate) >= 0 ? r2(Number(l.qty || 1) * Number(l.rate || 0)) : 0), 0)
  const tax = r2((sub * gst) / 100)
  return { sub: r2(sub), tax, total: r2(sub + tax) }
}

/** Save the invoice PDF (jsPDF loads only now). */
export async function openInvoicePdf(id) {
  const [{ downloadInvoice }, data] = await Promise.all([import('./invoicePdf.js'), crm('invoice', { id })])
  await downloadInvoice({ invoice: data.invoice, business: data.business })
}

/** A new invoice. `seed` prefills the customer and lines (from an order or a flight booking). The database works out the final totals. */
export function InvoiceForm({ seed, onClose, onSaved }) {
  const [f, setF] = useState({ customer_name: seed.customer_name || '', phone: seed.phone || '', email: seed.email || '', address: '', customer_gstin: '', gst_percent: 0, notes: '' })
  const [lines, setLines] = useState(seed.lines?.length ? seed.lines : [{ desc: '', qty: 1, rate: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const t = totals(lines, Number(f.gst_percent))
  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const out = await crm('invoiceCreate', { ...f, gst_percent: Number(f.gst_percent), lines: lines.filter((l) => l.desc.trim()), case_id: seed.case_id || '', booking_id: seed.booking_id || '' }, 'POST')
      await openInvoicePdf(out.id).catch(() => {})
      onSaved(out)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Drawer title="New invoice" onClose={onClose}>
      <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card title="Customer">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[0.8rem] font-bold text-slate-600 uppercase sm:col-span-2">Name <span className="text-red-600">*</span><input className={`${input} mt-1 normal-case`} required minLength={2} maxLength={80} value={f.customer_name} onChange={set('customer_name')} /></label>
            <label className="text-[0.8rem] font-bold text-slate-600 uppercase">Phone<input className={`${input} mt-1 normal-case`} maxLength={20} value={f.phone} onChange={set('phone')} /></label>
            <label className="text-[0.8rem] font-bold text-slate-600 uppercase">E-mail<input className={`${input} mt-1 normal-case`} type="email" maxLength={120} value={f.email} onChange={set('email')} /></label>
            <label className="text-[0.8rem] font-bold text-slate-600 uppercase sm:col-span-2">Address<input className={`${input} mt-1 normal-case`} maxLength={300} value={f.address} onChange={set('address')} /></label>
            <label className="text-[0.8rem] font-bold text-slate-600 uppercase sm:col-span-2">Customer GSTIN (companies only)<input className={`${input} mt-1 normal-case`} maxLength={15} value={f.customer_gstin} onChange={set('customer_gstin')} placeholder="29ABCDE1234F1Z5" /></label>
          </div>
        </Card>
        <Card title="Items" right={<button type="button" className="text-[0.85rem] font-bold text-brand-500" onClick={() => setLines((l) => [...l, { desc: '', qty: 1, rate: '' }])}><Plus size={14} className="mr-1 inline" />Add line</button>}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_6.5rem_auto] items-center gap-2">
                <input aria-label="Description" className={input} maxLength={200} placeholder="Description" value={l.desc} onChange={(e) => setLine(i, 'desc', e.target.value)} />
                <input aria-label="Quantity" className={input} type="number" min="0.01" step="any" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} />
                <input aria-label="Rate" className={input} type="number" min="0" step="any" placeholder="Rate ₹" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} />
                <button type="button" aria-label="Remove line" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-sand" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-1 text-[0.92rem]">
            <label className="flex items-center justify-between gap-3"><span className="font-semibold">GST</span><select className={`${input} w-32`} value={f.gst_percent} onChange={set('gst_percent')}>{GST.map((g) => <option key={g} value={g}>{g === 0 ? 'No GST' : `${g}%`}</option>)}</select></label>
            <p className="flex justify-between text-slate-600"><span>Sub-total</span><span>{inr(t.sub)}</span></p>
            {t.tax > 0 && <p className="flex justify-between text-slate-600"><span>GST {f.gst_percent}%</span><span>{inr(t.tax)}</span></p>}
            <p className="flex justify-between border-t border-slate-200 pt-1 font-display text-[1.2rem] font-bold text-navy-950"><span>Total</span><span>{inr(t.total)}</span></p>
          </div>
          <p className="mt-2 text-[0.78rem] text-slate-500">The saved invoice gets the next number for this financial year. Ask your accountant which GST applies to your commission or service fee.</p>
        </Card>
        <Err>{err}</Err>
        <button className={btnDark} disabled={busy || t.total <= 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Create invoice and download PDF'}</button>
      </form>
    </Drawer>
  )
}

export default function Invoices({ admin }) {
  const [f, setF] = useState({ q: '', status: '' })
  const [d, setD] = useState(f)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [adding, setAdding] = useState(false)
  useEffect(() => { const t = setTimeout(() => { setD(f); setPage(1) }, 300); return () => clearTimeout(t) }, [f])
  const load = useCallback(async () => { setBusy('load'); setErr(''); try { setData(await crm('invoices', { ...d, page })) } catch (e) { setErr(e.message) } finally { setBusy('') } }, [d, page])
  useEffect(() => { load() }, [load])
  const pdf = async (id) => { setBusy('pdf' + id); setErr(''); try { await openInvoicePdf(id) } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const cancel = async (inv) => {
    const reason = window.prompt(`Cancel invoice ${inv.invoice_no}? Its number is never reused. Why is it being cancelled?`)
    if (!reason) return
    try { await crm('invoiceCancel', { id: inv.id, reason }, 'POST'); await load() } catch (e) { setErr(e.message) }
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_auto]">
          <label className="relative block"><span className="sr-only">Search invoices</span><Search size={16} className="absolute top-3 left-3 text-slate-400" /><input className={`${input} pl-9`} placeholder="Invoice number, customer, phone, e-mail" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} /></label>
          <select aria-label="Status" className={input} value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}><option value="">All</option><option value="issued">Issued</option><option value="cancelled">Cancelled</option></select>
          <div className="flex gap-2"><button className={btnLight} onClick={load} aria-label="Refresh"><RefreshCw size={16} className={busy === 'load' ? 'animate-spin' : ''} /></button><button className={btnDark} onClick={() => setAdding(true)}><Plus size={16} /> New invoice</button></div>
        </div>
      </Card>
      <Err>{err}</Err>
      {!data ? <Empty><Loader2 className="mx-auto animate-spin" /></Empty> : !data.rows.length ? <Empty>No invoices yet. Create one here, or from an order or a booking.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[46rem] text-left text-[0.88rem]">
            <thead className="bg-sand text-[0.72rem] tracking-wide text-slate-600 uppercase"><tr><th className="p-3">Number</th><th>Date</th><th>Customer</th><th className="text-right">Total</th><th>Status</th><th /></tr></thead>
            <tbody>{data.rows.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-[0.8rem] font-bold">{i.invoice_no}</td><td>{dayLabel(i.issued_on)}</td>
                <td><span className="font-semibold">{i.customer_name}</span><span className="block text-[0.78rem] text-slate-500">{i.phone || i.email}</span></td>
                <td className="text-right font-semibold">{inr(i.total)}{Number(i.gst_percent) > 0 ? <span className="block text-[0.72rem] font-normal text-slate-500">incl. GST {Number(i.gst_percent)}%</span> : null}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${i.status === 'cancelled' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-900'}`}>{i.status === 'cancelled' ? 'Cancelled' : 'Issued'}</span></td>
                <td className="whitespace-nowrap p-2 text-right"><button className={btnLight} disabled={busy === 'pdf' + i.id} onClick={() => pdf(i.id)}>{busy === 'pdf' + i.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF</button>{admin && i.status === 'issued' && <button className="ml-2 text-[0.82rem] font-bold text-red-700" onClick={() => cancel(i)}>Cancel</button>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      {adding && <InvoiceForm seed={{}} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </div>
  )
}
