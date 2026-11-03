import { db, rpc, dbConfigured, DbError, clean } from './_lib/db.js'
import { requireStaff, signIn, refresh, AuthError } from './_lib/auth.js'
import { PayError, refundPayment, razorpayConfigured } from './_lib/pay.js'
import { bookingForRefund, recordRefund } from './_lib/store.js'
import { getMarkup, saveMarkup, LIMITS } from './_lib/markup.js'
import { KEYS as CONTENT_KEYS, cleanContent, readContent, writeContent } from './_lib/content.js'

const ADMIN_ONLY = new Set(['refund', 'markupSave', 'purge', 'businessSave', 'invoiceCancel', 'export', 'contentSave', 'contentReset'])

/**
 * Back office (CRM) API: flight bookings, website enquiries, the TBO call logs and the TBO wallet.
 * One endpoint: GET /api/crm?action=...  or  POST /api/crm {action, ...}.
 *
 * Access: staff sign in with their Supabase account (action=login). Every other action needs that
 * token AND the e-mail must be on CRM_ALLOWED_EMAILS (see api/_lib/auth.js).
 *
 * Cost on the free tiers: each action is ONE database round trip (single queries or the functions in
 * supabase/schema.sql), responses carry only what the screen shows, and the TBO client is loaded
 * only for the two actions that talk to TBO, so ordinary calls start fast.
 */
const BOOKING_STATUS = ['payment_pending', 'paid', 'ticketed', 'needs_attention', 'failed', 'cancelled', 'refunded']
const ENQUIRY_STATUS = ['new', 'contacted', 'quoted', 'won', 'lost']
// every service the business handles (the website's services plus corporate travel and insurance); flights bookings are tracked as bookings
const SERVICES = ['flights', 'hotels', 'tailor', 'tours', 'visa', 'passport', 'umrah', 'corporate', 'insurance', 'other']
const CASE_STATUS = ['docs_pending', 'docs_received', 'in_progress', 'submitted', 'approved', 'delivered', 'rejected', 'cancelled']
const PAY_MODES = ['cash', 'upi', 'bank', 'card', 'cheque', 'other']
const GST_RATES = [0, 5, 12, 18, 28]
// Document / task checklists copied into a new order, per service. Staff can edit the list on each order.
const CHECKLISTS = {
  visa: ['Passport copy (valid 6+ months)', 'Passport-size photographs', 'Bank statements (last 6 months)', 'Salary slips / ITR / business proof', 'Employment or business letter', 'Travel itinerary', 'Hotel booking', 'Application form signed', 'Fees paid', 'Application submitted / appointment booked'],
  passport: ['Aadhaar copy', 'Proof of address', 'Proof of date of birth', 'Photographs', 'Old passport (for renewal)', 'Application filed on Passport Seva', 'Appointment booked', 'Fees paid'],
  umrah: ['Passport copy (valid 6+ months)', 'Photograph, white background', 'Vaccination certificate', 'Mahram details (for women travelling)', 'Visa applied', 'Hotels confirmed', 'Flights ticketed', 'Transport arranged', 'Final payment received', 'Documents handed to the pilgrim'],
  hotels: ['Guest names', 'Check-in and check-out dates', 'Room type and meal plan', 'Booking confirmed', 'Voucher sent', 'Payment received'],
  tours: ['Itinerary finalised', 'Traveller names and ages', 'ID copies', 'Hotels confirmed', 'Transport confirmed', 'Activities confirmed', 'Final payment received', 'Vouchers and tickets sent'],
  tailor: ['Itinerary finalised', 'Traveller names and ages', 'ID copies', 'Hotels confirmed', 'Transport confirmed', 'Activities confirmed', 'Final payment received', 'Vouchers and tickets sent'],
  corporate: ['Company GST details', 'Traveller list', 'Approval from the company', 'Booking confirmed', 'Invoice sent'],
  insurance: ['Traveller dates of birth and passports', 'Plan chosen', 'Premium received', 'Policy issued', 'Policy sent to the customer'],
  flights: ['Names exactly as on ID', 'Fare confirmed with the customer', 'Payment received', 'Ticket issued', 'Ticket sent'],
  other: [],
}
const SOURCES = ['website', 'phone', 'walk-in', 'whatsapp', 'referral', 'email', 'social', 'other']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TRACE = /^[A-Za-z0-9-]{1,64}$/
const istDay = (t) => new Date(new Date(t).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s })
const isLive = () => String(process.env.TBO_ENV).toLowerCase() === 'live'
const tbo = () => import('./_lib/tbo.js')

// Columns added by later versions of supabase/schema.sql. If the database has not had that file re-run yet, the booking list drops them
// (see withLegacyFallback) instead of failing, so the CRM never goes blank during an upgrade.
const NEWER_COLUMNS = ['fare_inr', 'markup_inr', 'paid_inr', 'refunded_inr']
const BOOKING_LIST = 'id,created_at,updated_at,order_ref,env,status,amount_inr,fare_inr,markup_inr,paid_inr,refunded_inr,customer_name,contact_phone,contact_email,route,journey,travel_date,return_date,pax_count,pnr,booking_ids,assigned_to'

/** One JSON line per sensitive action in the Vercel logs: who did what (never passwords or tokens). */
const audit = (who, action, extra = {}) => console.log(JSON.stringify({ audit: action, by: who, ...extra }))

/* ---------------- login (public) ---------------- */

// In-memory, per server instance: a speed bump, not the only defence (Supabase Auth rate-limits sign-ins too).
const fails = new Map()
async function login(_q, body, req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120)
  const keys = [`ip:${ip}`, `em:${email}`]
  const recent = (k) => (fails.get(k) || []).filter((t) => Date.now() - t < 10 * 60_000)
  if (keys.some((k) => recent(k).length >= 8)) throw new AuthError('Too many attempts. Please wait ten minutes.', 429)
  try {
    const out = await signIn(email, String(body.password || ''))
    audit(out.email, 'login')
    return out
  } catch (e) {
    for (const k of keys) fails.set(k, [...recent(k), Date.now()])
    if (fails.size > 2000) fails.clear()
    audit(email || '?', 'login_failed', { ip })
    await new Promise((r) => setTimeout(r, 700)) // slows password guessing
    throw e
  }
}

/* ---------------- filters ---------------- */

function filters(q, kind) {
  const f = []
  const statuses = kind === 'booking' ? BOOKING_STATUS : ENQUIRY_STATUS
  if (q.status && statuses.includes(q.status)) f.push(`status=eq.${q.status}`)
  const s = clean(q.q)
  if (s) {
    const cols = kind === 'booking' ? ['order_ref', 'pnr', 'booking_ids', 'contact_phone', 'contact_email', 'customer_name', 'route'] : ['name', 'phone', 'email', 'message', 'topic']
    f.push(`or=(${cols.map((c) => `${c}.ilike.*${encodeURIComponent(s)}*`).join(',')})`)
  }
  if (kind === 'enquiry') {
    if (SERVICES.includes(q.service)) f.push(`service=eq.${q.service}`)
    if (q.due === 'today') f.push(`follow_up_at=eq.${istDay(Date.now())}`)
    if (q.due === 'overdue') f.push(`follow_up_at=lt.${istDay(Date.now())}`, 'status=in.(new,contacted,quoted)')
    if (q.due === 'any') f.push('follow_up_at=not.is.null', 'status=in.(new,contacted,quoted)')
  }
  if (DATE.test(q.from || '')) f.push(`created_at=gte.${q.from}T00:00:00%2B05:30`)
  if (DATE.test(q.to || '')) f.push(`created_at=lte.${q.to}T23:59:59%2B05:30`)
  return f
}

/** One query for a page of rows plus the total (Prefer: count=exact rides along in the same call). */
let legacyUntil = 0 // after one "column does not exist", skip the failing query for a minute
async function withLegacyFallback(select, run) {
  const older = select.split(',').filter((c) => !NEWER_COLUMNS.includes(c)).join(',')
  if (older === select) return run(select)
  if (Date.now() < legacyUntil) return run(older)
  try {
    return await run(select)
  } catch (e) {
    if (!/does not exist|schema cache|could not find/i.test(String(e.message))) throw e
    console.error('[crm] database is missing newer columns: re-run supabase/schema.sql. Showing bookings without them.')
    legacyUntil = Date.now() + 60_000
    return run(older)
  }
}

async function page(table, select, q, kind) {
  const size = Math.min(100, Math.max(1, Number(q.size) || 25))
  const pg = Math.max(1, Number(q.page) || 1)
  const { rows, count } = await withLegacyFallback(select, (sel) => db(`${table}?select=${sel}&${filters(q, kind).join('&')}&order=created_at.desc&limit=${size}&offset=${(pg - 1) * size}`, { prefer: 'count=exact' }))
  return { rows: rows || [], total: count ?? (rows || []).length, page: pg, size }
}

/* ---------------- dashboard, bookings, enquiries ---------------- */

async function overview() {
  const o = await rpc('crm_overview') // every number aggregated inside the database: 1 trip, a few KB back
  return {
    env: isLive() ? 'live' : 'staging',
    payments: process.env.RAZORPAY_KEY_ID ? 'razorpay' : !isLive() && String(process.env.ALLOW_FAKE_PAYMENTS).toLowerCase() === 'true' ? 'test mode (no real payment)' : 'off',
    markup: await getMarkup(),
    ...o,
  }
}

const PAYMENT_STATUS = ['created', 'authorized', 'captured', 'failed', 'partially_refunded', 'refunded']
const PAYMENT_METHOD = ['upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater']
function paymentFilters(q) {
  const f = []
  if (PAYMENT_STATUS.includes(q.status)) f.push(`status=eq.${q.status}`)
  if (PAYMENT_METHOD.includes(q.method)) f.push(`method=eq.${q.method}`)
  const s = clean(q.q)
  if (s) f.push(`or=(${['payment_id', 'order_id', 'order_ref', 'vpa', 'upi_ref', 'bank_ref', 'contact', 'email'].map((c) => `${c}.ilike.*${encodeURIComponent(s)}*`).join(',')})`)
  if (DATE.test(q.from || '')) f.push(`initiated_at=gte.${q.from}T00:00:00%2B05:30`)
  if (DATE.test(q.to || '')) f.push(`initiated_at=lte.${q.to}T23:59:59%2B05:30`)
  return f
}
async function payments(q) {
  const size = Math.min(100, Math.max(1, Number(q.size) || 25)), pg = Math.max(1, Number(q.page) || 1)
  const { rows, count } = await db(`payments?select=*&${paymentFilters(q).join('&')}&order=initiated_at.desc.nullslast&limit=${size}&offset=${(pg - 1) * size}`, { prefer: 'count=exact' })
  return { rows: rows || [], total: count ?? (rows || []).length, page: pg, size }
}

const bookings = (q) => page('flight_bookings', BOOKING_LIST, q, 'booking')
const enquiries = (q) => page('enquiries', '*', q, 'enquiry')

async function booking(q) {
  const id = Number(q.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad booking id')
  const r = await rpc('crm_booking_detail', { p_id: id }) // row + timeline + TBO call list in one trip
  if (!r) throw bad('Booking not found', 404)
  return r
}

async function enquiry(q) {
  const id = Number(q.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad enquiry id')
  const [row, ev] = await Promise.all([db(`enquiries?id=eq.${id}&select=*`), db(`crm_events?entity=eq.enquiry&entity_id=eq.${id}&order=created_at.asc&limit=200`)])
  if (!row.rows?.[0]) throw bad('Enquiry not found', 404)
  return { enquiry: row.rows[0], events: ev.rows || [] }
}

/** A lead staff typed in (phone call, walk-in, WhatsApp, referral). */
async function enquiryCreate(_q, body, _req, staff) {
  const name = clean(body.name, 80), phone = String(body.phone || '').replace(/[^\d+ ()-]/g, '').trim().slice(0, 20)
  if (name.length < 2) throw bad('Enter the customer\'s name.')
  if (phone.replace(/\D/g, '').length < 8) throw bad('Enter a phone number.')
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120)
  if (email && !/^[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email)) throw bad('That e-mail address does not look right.')
  const service = SERVICES.includes(body.service) ? body.service : null
  const source = SOURCES.includes(body.source) ? body.source : 'phone'
  const follow = DATE.test(body.follow_up_at || '') ? body.follow_up_at : ''
  const quoted = body.quoted_inr === '' || body.quoted_inr == null ? '' : Number(body.quoted_inr)
  if (quoted !== '' && (!Number.isFinite(quoted) || quoted < 0 || quoted > 1e8)) throw bad('The quoted amount does not look right.')
  const id = await rpc('crm_staff_add_enquiry', { p: { name, phone, email, topic: clean(body.topic, 80) || (SERVICES.includes(body.service) ? body.service : ''), service, source, message: String(body.message || '').slice(0, 2000), follow_up_at: follow, quoted_inr: quoted }, p_actor: staff.email })
  audit(staff.email, 'enquiry.create', { id, service, source })
  return { ok: true, id }
}

/** Service, source, follow-up date and the money on a lead. */
async function enquiryFields(_q, body, _req, staff) {
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad enquiry id')
  const p = {}
  if ('service' in body) { if (body.service && !SERVICES.includes(body.service)) throw bad('Unknown service.'); p.service = body.service || '' }
  if ('source' in body) { if (!SOURCES.includes(body.source)) throw bad('Unknown source.'); p.source = body.source }
  if ('follow_up_at' in body) { if (body.follow_up_at && !DATE.test(body.follow_up_at)) throw bad('That follow-up date does not look right.'); p.follow_up_at = body.follow_up_at || '' }
  for (const k of ['quoted_inr', 'final_inr']) if (k in body) {
    const v = body[k] === '' || body[k] == null ? '' : Number(body[k])
    if (v !== '' && (!Number.isFinite(v) || v < 0 || v > 1e8)) throw bad('That amount does not look right.')
    p[k] = v
  }
  const out = await rpc('crm_enquiry_fields', { p_id: id, p, p_actor: staff.email })
  if (!out?.found) throw bad('Not found', 404)
  audit(staff.email, 'enquiry.fields', { id, fields: Object.keys(p) })
  return { ok: true, changed: out.changed }
}

/** Customers: bookings and enquiries together, searchable; one customer's full history. */
async function customers(q) {
  const size = Math.min(100, Math.max(1, Number(q.size) || 25)), pg = Math.max(1, Number(q.page) || 1)
  const out = await rpc('crm_customers', { p_q: clean(q.q), p_limit: size, p_offset: (pg - 1) * size })
  return { rows: out?.rows || [], total: out?.total || 0, page: pg, size }
}
async function customer(q) {
  const key = String(q.key || '').trim()
  if (!/^\d{10}$/.test(key) && !/^[^\s@]{1,64}@[^\s@]+$/.test(key)) throw bad('Bad customer')
  return rpc('crm_customer', { p_key: key })
}

/* ---------------- orders for every other service ---------------- */

const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)
const money = (v, label) => {
  if (v === '' || v == null) return ''
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 1e8) throw bad(`${label} does not look right.`)
  return Math.round(n * 100) / 100
}
const dateOrBlank = (v, label) => { if (!v) return ''; if (!DATE.test(v)) throw bad(`${label} does not look right.`); return v }
const travellersOf = (list) => (Array.isArray(list) ? list.slice(0, 30).map((t) => ({ name: txt(t?.name, 80), type: ['adult', 'child', 'infant'].includes(t?.type) ? t.type : 'adult', note: txt(t?.note, 200) })).filter((t) => t.name) : [])
const checklistOf = (list) => (Array.isArray(list) ? list.slice(0, 40).map((c) => ({ item: txt(c?.item, 140), done: c?.done === true })).filter((c) => c.item) : [])

const CASE_LIST = 'id,created_at,case_ref,service,customer_name,phone,email,title,status,travel_date,due_date,amount_inr,paid_inr,assigned_to,enquiry_id'
function caseFilters(q) {
  const f = []
  if (CASE_STATUS.includes(q.status)) f.push(`status=eq.${q.status}`)
  if (SERVICES.includes(q.service)) f.push(`service=eq.${q.service}`)
  if (q.open === '1') f.push('status=not.in.(delivered,rejected,cancelled)')
  if (q.due === 'soon') f.push(`due_date=lte.${istDay(Date.now() + 2 * 864e5)}`, 'status=not.in.(delivered,rejected,cancelled)')
  if (q.unpaid === '1') f.push('status=not.in.(rejected,cancelled)')
  const s = clean(q.q)
  if (s) f.push(`or=(${['case_ref', 'customer_name', 'phone', 'email', 'title'].map((c) => `${c}.ilike.*${encodeURIComponent(s)}*`).join(',')})`)
  if (DATE.test(q.from || '')) f.push(`created_at=gte.${q.from}T00:00:00%2B05:30`)
  if (DATE.test(q.to || '')) f.push(`created_at=lte.${q.to}T23:59:59%2B05:30`)
  return f
}
async function cases(q) {
  const size = Math.min(100, Math.max(1, Number(q.size) || 25)), pg = Math.max(1, Number(q.page) || 1)
  const { rows, count } = await db(`cases?select=${CASE_LIST}&${caseFilters(q).join('&')}&order=created_at.desc&limit=${size}&offset=${(pg - 1) * size}`, { prefer: 'count=exact' })
  return { rows: rows || [], total: count ?? (rows || []).length, page: pg, size }
}
async function caseDetail(q) {
  const id = Number(q.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad order id')
  const r = await rpc('crm_case_detail', { p_id: id })
  if (!r) throw bad('Order not found', 404)
  return { ...r, checklistTemplate: CHECKLISTS[r.case.service] || [] }
}
async function caseCreate(_q, body, _req, staff) {
  const service = SERVICES.includes(body.service) ? body.service : null
  if (!service) throw bad('Choose the service.')
  const name = txt(body.customer_name, 80)
  if (name.length < 2) throw bad("Enter the customer's name.")
  const phone = String(body.phone || '').replace(/[^\d+ ()-]/g, '').trim().slice(0, 20)
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120)
  if (!phone && !email) throw bad('Enter a phone number or an e-mail.')
  if (email && !/^[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email)) throw bad('That e-mail address does not look right.')
  const enquiry = body.enquiry_id ? Number(body.enquiry_id) : ''
  if (enquiry !== '' && (!Number.isInteger(enquiry) || enquiry <= 0)) throw bad('Bad enquiry.')
  const given = checklistOf(body.checklist)
  const p = {
    service, enquiry_id: enquiry, customer_name: name, phone, email, title: txt(body.title, 140), travellers: travellersOf(body.travellers),
    travel_date: dateOrBlank(body.travel_date, 'The travel date'), due_date: dateOrBlank(body.due_date, 'The deadline'), amount_inr: money(body.amount_inr, 'The amount'),
    checklist: given.length ? given : (CHECKLISTS[service] || []).map((item) => ({ item, done: false })), assigned_to: clean(body.assigned_to, 60), notes: txt(body.notes, 2000),
  }
  const id = await rpc('crm_case_create', { p, p_actor: staff.email })
  audit(staff.email, 'case.create', { id, service })
  return { ok: true, id }
}
async function caseUpdate(_q, body, _req, staff) {
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad order id')
  const p = {}
  if ('status' in body) { if (!CASE_STATUS.includes(body.status)) throw bad('Unknown status.'); p.status = body.status }
  if ('title' in body) p.title = txt(body.title, 140)
  if ('travel_date' in body) p.travel_date = dateOrBlank(body.travel_date, 'The travel date')
  if ('due_date' in body) p.due_date = dateOrBlank(body.due_date, 'The deadline')
  if ('amount_inr' in body) p.amount_inr = money(body.amount_inr, 'The amount')
  if ('assigned_to' in body) p.assigned_to = clean(body.assigned_to, 60)
  if ('travellers' in body) p.travellers = travellersOf(body.travellers)
  if ('checklist' in body) p.checklist = checklistOf(body.checklist)
  if ('notes' in body) p.notes = txt(body.notes, 2000)
  if (body.note) p.note = txt(body.note, 2000)
  const out = await rpc('crm_case_update', { p_id: id, p, p_actor: staff.email })
  if (!out?.found) throw bad('Not found', 404)
  audit(staff.email, 'case.update', { id, fields: Object.keys(p) })
  return { ok: true }
}
async function casePayment(_q, body, _req, staff) {
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad order id')
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e8) throw bad('Enter the amount received.')
  const mode = PAY_MODES.includes(body.mode) ? body.mode : 'cash'
  const out = await rpc('crm_case_payment', { p_id: id, p: { amount: Math.round(amount * 100) / 100, mode, ref: txt(body.ref, 60), note: txt(body.note, 200) }, p_actor: staff.email })
  if (!out?.found) throw bad('Not found', 404)
  if (!out.ok) throw bad('Enter the amount received.')
  audit(staff.email, 'case.payment', { id, amount, mode })
  return { ok: true, paid: out.paid }
}

/* ---------------- invoices ---------------- */

const INVOICE_LIST = 'id,created_at,invoice_no,issued_on,customer_name,phone,email,subtotal,gst_percent,gst_amount,total,status,case_id,booking_id'
async function invoices(q) {
  const size = Math.min(100, Math.max(1, Number(q.size) || 25)), pg = Math.max(1, Number(q.page) || 1)
  const f = []
  if (['issued', 'cancelled'].includes(q.status)) f.push(`status=eq.${q.status}`)
  const s = clean(q.q)
  if (s) f.push(`or=(${['invoice_no', 'customer_name', 'phone', 'email'].map((c) => `${c}.ilike.*${encodeURIComponent(s)}*`).join(',')})`)
  if (Number(q.case_id) > 0) f.push(`case_id=eq.${Number(q.case_id)}`)
  if (Number(q.booking_id) > 0) f.push(`booking_id=eq.${Number(q.booking_id)}`)
  const { rows, count } = await db(`invoices?select=${INVOICE_LIST}&${f.join('&')}&order=created_at.desc&limit=${size}&offset=${(pg - 1) * size}`, { prefer: 'count=exact' })
  return { rows: rows || [], total: count ?? (rows || []).length, page: pg, size }
}
async function invoice(q) {
  const id = Number(q.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad invoice id')
  const { rows } = await db(`invoices?id=eq.${id}&select=*`)
  if (!rows?.[0]) throw bad('Invoice not found', 404)
  return { invoice: rows[0], business: await business() }
}
async function invoiceCreate(_q, body, _req, staff) {
  const name = txt(body.customer_name, 80)
  if (name.length < 2) throw bad("Enter the customer's name.")
  const gst = Number(body.gst_percent || 0)
  if (!GST_RATES.includes(gst)) throw bad('Choose a GST rate: 0, 5, 12, 18 or 28.')
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 30).map((l) => ({ desc: txt(l?.desc, 200), qty: Number(l?.qty ?? 1), rate: Number(l?.rate) })).filter((l) => l.desc)
  if (!lines.length) throw bad('Add at least one line with a description and an amount.')
  for (const l of lines) if (!Number.isFinite(l.qty) || l.qty <= 0 || l.qty > 1000 || !Number.isFinite(l.rate) || l.rate < 0 || l.rate > 1e8) throw bad('A line has a quantity or an amount that does not look right.')
  const gstin = String(body.customer_gstin || '').trim().toUpperCase()
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw bad('The customer GST number is not valid.')
  const out = await rpc('crm_invoice_create', {
    p: { case_id: Number(body.case_id) > 0 ? Number(body.case_id) : '', booking_id: Number(body.booking_id) > 0 ? Number(body.booking_id) : '', customer_name: name, phone: txt(body.phone, 20), email: txt(body.email, 120), address: txt(body.address, 300), customer_gstin: gstin, gst_percent: gst, lines, notes: txt(body.notes, 500) },
    p_actor: staff.email,
  })
  if (!out?.ok) throw bad('The invoice amounts do not look right. Every invoice needs a total above zero.')
  audit(staff.email, 'invoice.create', { invoice_no: out.invoice_no, total: out.total })
  return out
}
async function invoiceCancel(_q, body, _req, staff) {
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad invoice id')
  const reason = txt(body.reason, 200)
  if (reason.length < 4) throw bad('Write why the invoice is being cancelled.')
  const out = await rpc('crm_invoice_cancel', { p_id: id, p_actor: staff.email, p_reason: reason })
  if (!out?.ok) throw bad('That invoice is already cancelled or does not exist.', 404)
  audit(staff.email, 'invoice.cancel', { invoice_no: out.invoice_no })
  return out
}

/** The business details printed on invoices (legal name, GSTIN, address...). Kept in site_content. */
async function business() {
  const row = await rpc('crm_get_setting', { p_key: 'business' }).catch(() => null)
  return row?.value || { legal_name: 'Pro Tours and Travel Solutions', gstin: '', pan: '', address: '21/1 G-2 Plain Street, A.M. Plaza, Hospital Road, Bangalore - 560 001', state: 'Karnataka', phone: '+91 99005 17604', email: 'luckysaj@gmail.com', terms: '' }
}
async function businessSave(_q, body, _req, staff) {
  const gstin = String(body.gstin || '').trim().toUpperCase(), pan = String(body.pan || '').trim().toUpperCase()
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw bad('That GST number is not valid.')
  if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) throw bad('That PAN is not valid.')
  const v = { legal_name: txt(body.legal_name, 120), gstin, pan, address: txt(body.address, 300), state: txt(body.state, 60), phone: txt(body.phone, 30), email: txt(body.email, 120), terms: txt(body.terms, 600) }
  if (v.legal_name.length < 2) throw bad('Enter the business name.')
  await rpc('crm_set_setting', { p_key: 'business', p_value: v })
  audit(staff.email, 'business.save', {})
  return v
}

/** Website content the owner edits here (tour packages, visa destinations, passport services): what is saved shows on the public site. */
const contentKey = (v) => { const k = String(v || ''); if (!CONTENT_KEYS.includes(k)) throw bad('Unknown content.'); return k }
const content = (q) => readContent(contentKey(q.key))
async function contentSave(_q, body, _req, staff) {
  const key = contentKey(body.key)
  const items = cleanContent(key, body.items)
  await writeContent(key, items, staff.email)
  audit(staff.email, 'content.save', { key, count: items.length })
  return { ok: true, count: items.length }
}
async function contentReset(_q, body, _req, staff) {
  const key = contentKey(body.key)
  await writeContent(key, null, staff.email)
  audit(staff.email, 'content.reset', { key })
  return { ok: true }
}

/** Small counts for the tab badges (new enquiries, follow-ups due, bookings needing attention, orders needing documents...). */
const badges = () => rpc('crm_badges')

/** Staff say two customer records are the same person. */
async function customerLink(_q, body, _req, staff) {
  const norm = (v) => { const s = String(v || '').trim().toLowerCase(); const d = s.replace(/\D/g, ''); return s.includes('@') ? s : d.length >= 10 ? d.slice(-10) : '' }
  const a = norm(body.a), b = norm(body.b)
  if (!a || !b) throw bad('Enter a phone number (10 digits) or an e-mail for the other record.')
  const out = await rpc('crm_link_customers', { p_a: a, p_b: b, p_actor: staff.email })
  if (!out?.ok) throw bad('Those are the same record already.')
  audit(staff.email, 'customer.link', {})
  return out
}

/** Status / assignee / note for a booking or an enquiry: the change and its timeline entries in one transaction. */
async function update(entity, statuses, body, staff) {
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad id')
  let status = null
  if (body.status !== undefined && body.status !== null) {
    if (!statuses.includes(body.status)) throw bad('Unknown status')
    status = body.status
  }
  const setAssigned = body.assigned_to !== undefined
  const note = String(body.note || '').trim().slice(0, 2000)
  const out = await rpc('crm_apply_update', {
    p_entity: entity, p_id: id, p_status: status,
    p_assigned: setAssigned ? clean(body.assigned_to, 60) || null : null, p_set_assigned: setAssigned,
    p_note: note || null, p_actor: staff.email,
  })
  if (!out?.found) throw bad('Not found', 404)
  audit(staff.email, `${entity}.update`, { id, status: status || undefined, note: Boolean(note) || undefined })
  return { ok: true }
}

/** The price markup staff can change (Settings): percentage and flat amount, domestic and international. */
const markup = async () => ({ ...(await getMarkup({ fresh: true })), limits: LIMITS })

async function markupSave(_q, body, _req, staff) {
  if (body.confirm !== true) throw bad('Confirm the change first.')
  const saved = await saveMarkup({ domestic: body.domestic, international: body.international }, staff.email) // validates; throws a readable 400
  audit(staff.email, 'markup.save', { domestic: saved.domestic, international: saved.international })
  return { ...saved, limits: LIMITS }
}

/**
 * Refund a booking's card payment (all of it, or part) through Razorpay. Staff only, a reason is mandatory, every refund is
 * written to the booking's timeline and the audit log, and the amount can never exceed what was paid minus what was refunded.
 * A double click or a retry is harmless: the same request carries the same idempotency key, so Razorpay returns the same refund.
 * NOTE: this returns the money to the customer's card; it does NOT cancel the airline ticket (do that with TBO / the airline).
 */
async function refund(_q, body, _req, staff) {
  if (body.confirm !== true) throw bad('Confirm the refund first.')
  if (!razorpayConfigured()) throw bad('Card payments are not connected on this server.', 503)
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) throw bad('Bad booking id')
  const reason = String(body.reason || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 200)
  if (reason.length < 4) throw bad('Please write the reason for the refund.')
  const row = await bookingForRefund(id)
  if (!row) throw bad('Booking not found', 404)
  if (!row.payment_id || String(row.payment_id).startsWith('test_')) throw bad('This booking has no card payment to refund.')
  const paid = Number(row.paid_inr), refunded = Number(row.refunded_inr) || 0
  if (!(paid > 0)) throw bad('No payment amount is recorded for this booking.')
  const remaining = Math.round((paid - refunded) * 100) / 100
  if (remaining <= 0) throw bad('This booking has already been refunded in full.')
  const amount = body.amount === undefined || body.amount === '' || body.amount === null ? remaining : Math.round(Number(body.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount < 1) throw bad('Enter a refund amount of at least ₹1.')
  if (amount > remaining + 0.001) throw bad(`You can refund at most ₹${remaining} (paid ₹${paid}, already refunded ₹${refunded}).`)
  const paise = Math.round(amount * 100)
  let out
  try {
    out = await refundPayment({
      paymentId: row.payment_id, amountPaise: paise, receipt: `RF-${row.order_ref}`, notes: { order_ref: row.order_ref, by: staff.email, reason },
      idempotencyKey: `${row.order_ref}:${paise}:${Math.round(refunded * 100)}`,
    })
  } catch (e) {
    audit(staff.email, 'refund_failed', { id, amount, why: e.message })
    if (e instanceof PayError) throw bad(`Razorpay refused the refund: ${e.message}`, e.status >= 500 ? 502 : 400)
    throw e
  }
  const rec = await recordRefund({ order_ref: row.order_ref, refund_id: out.id, amount_inr: paise / 100, actor: staff.email, reason, status: out.status })
  audit(staff.email, 'refund', { id, order_ref: row.order_ref, amount, refundId: out.id, status: out.status })
  return { ok: true, refundId: out.id, status: out.status, amount, refundedTotal: rec?.refunded ?? refunded + amount, full: Boolean(rec?.full) }
}

/** The Privacy Policy promises enquiries that did not become a booking are deleted within 12 months. */
async function purge(_q, body, _req, staff) {
  if (body.confirm !== true) throw bad('Confirm the clean-up first.')
  const months = Math.min(60, Math.max(3, Number(body.months) || 12))
  const out = await rpc('crm_cleanup', { p_log_days: null, p_enq_months: months })
  audit(staff.email, 'purge_enquiries', { months, deleted: out.enquiriesDeleted })
  return { deleted: out.enquiriesDeleted, months }
}

/* ---------------- TBO logs + live lookups ---------------- */

const traces = () => rpc('crm_traces', { p_limit: 60, p_days: 60 }) // grouped in the database: 60 rows back, not 1,500

async function trace(q) {
  if (!TRACE.test(q.id || '')) throw bad('Bad trace id')
  return (await db(`tbo_logs?trace_id=eq.${q.id}&select=id,created_at,method,kind,body&order=created_at.asc&limit=300`)).rows || []
}

async function balance(_q, _b, _r, staff) {
  const { agencyBalance, flushLogs } = await tbo()
  try {
    const out = await agencyBalance()
    audit(staff.email, 'wallet_check')
    return out
  } finally {
    await flushLogs()
  }
}

/** What TBO itself says about a booking right now (ticket numbers, status). */
async function live(q, _b, _r, staff) {
  const bookingId = Number(q.id)
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw bad('Bad booking id')
  const { authenticate, air, flushLogs } = await tbo()
  const a = await authenticate()
  const r = await air('GetBookingDetails', { tokenId: a.tokenId }, { BookingId: bookingId }, { allowError: true })
  await flushLogs()
  audit(staff.email, 'tbo_live_lookup', { bookingId })
  return r
}

/* ---------------- CSV export ---------------- */

// A cell that starts with = + - @ would run as a formula when the file is opened in Excel; enquiry text
// comes from the public, so neutralise it.
const cell = (v) => {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function exportCsv(q, _b, _r, staff) {
  const kind = q.entity === 'enquiries' ? 'enquiry' : q.entity === 'payments' ? 'payment' : q.entity === 'orders' ? 'order' : q.entity === 'invoices' ? 'invoice' : 'booking'
  const table = kind === 'enquiry' ? 'enquiries' : kind === 'payment' ? 'payments' : kind === 'order' ? 'cases' : kind === 'invoice' ? 'invoices' : 'flight_bookings'
  const select = ['enquiry', 'payment', 'order', 'invoice'].includes(kind) ? '*' : BOOKING_LIST
  const { rows } = kind === 'order' || kind === 'invoice' ? await db(`${table}?select=*&order=created_at.desc&limit=5000`) : kind === 'payment' ? await db(`payments?select=*&${paymentFilters(q).join('&')}&order=initiated_at.desc.nullslast&limit=5000`) : await withLegacyFallback(select, (sel) => db(`${table}?select=${sel}&${filters(q, kind).join('&')}&order=created_at.desc&limit=5000`))
  const list = rows || []
  const cols = list.length ? Object.keys(list[0]) : []
  const csv = [cols.join(','), ...list.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')
  audit(staff.email, 'export', { table, rows: list.length })
  return { csv, filename: `${table}-${istDay(Date.now())}.csv` }
}

/* ---------------- routing ---------------- */

const PUBLIC = { login, refresh: (_q, body) => refresh(String(body.refreshToken || '')) }
const READ = {
  me: (_q, _b, _r, staff) => ({ email: staff.email, role: staff.role, env: isLive() ? 'live' : 'staging' }),
  overview, bookings, booking, payments, customers, customer, cases, case: caseDetail, invoices, invoice, business, badges, content, enquiries, enquiry, traces, trace, balance, live, markup, export: exportCsv,
}
const WRITE = {
  bookingUpdate: (_q, b, _r, s) => update('booking', BOOKING_STATUS, b, s),
  enquiryUpdate: (_q, b, _r, s) => update('enquiry', ENQUIRY_STATUS, b, s),
  purge,
  refund,
  markupSave,
  enquiryCreate,
  enquiryFields,
  caseCreate,
  caseUpdate,
  casePayment,
  invoiceCreate,
  invoiceCancel,
  businessSave,
  customerLink,
  contentSave,
  contentReset,
}

const SAFE_ERRORS = new Set(['DbError', 'AuthError', 'TboError', 'PayError'])

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const action = req.method === 'POST' ? body.action : q.action
  try {
    if (!dbConfigured() || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new DbError('The CRM database is not connected yet.', 503)
    const open = req.method === 'POST' && PUBLIC[action]
    const fn = open || (req.method === 'POST' ? WRITE[action] : READ[action])
    if (!fn) return res.status(400).json({ error: 'Unknown action' })
    const staff = open ? null : await requireStaff(req)
    if (staff && ADMIN_ONLY.has(action) && staff.role !== 'admin') throw bad('This needs an administrator. Ask the owner.', 403)
    const out = await fn(q, body, req, staff)
    if (out && out.csv !== undefined) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
      return res.status(200).send('﻿' + out.csv)
    }
    return res.status(200).json(out)
  } catch (e) {
    // a database function or column from a newer schema.sql that has not been applied yet: say what to do, not a raw SQL error
    if (e instanceof DbError && /could not find the function|function .* does not exist|column .* does not exist/i.test(e.message)) {
      console.error('[crm] database is behind the code:', e.message)
      return res.status(503).json({ error: 'The database needs the latest supabase/schema.sql. Open the Supabase SQL editor, paste that file, and run it once; then this works.' })
    }
    const status = e.status || 500
    const known = SAFE_ERRORS.has(e?.constructor?.name) || (status < 500 && e.status)
    if (!known) console.error('[crm]', e)
    return res.status(status).json({ error: known ? e.message : 'CRM error' })
  }
}
