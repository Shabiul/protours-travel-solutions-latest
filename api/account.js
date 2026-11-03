import { rpc, dbConfigured, DbError } from './_lib/db.js'
import { AuthError } from './_lib/auth.js'
import { sessionForEmail, verifyGoogleToken } from './_lib/google.js'
import { cancelQuote, requestCancel, changeSearch, requestDateChange, changeStatus } from './_lib/changes.js'
import { TboError, flushLogs, withEndUserIp } from './_lib/tbo.js'
import { EMAIL, checkPassword, passwordLogin, refreshSession, requireUser, saveProfile, sendReset, setPassword, signUp, verifiedEmail } from './_lib/customer.js'

/**
 * Customer accounts: sign up, sign in, reset password, and "My trips" (the customer's own bookings).
 * POST /api/account { action, ... }. Signing in is Supabase Auth; every "my trips" call carries the
 * Supabase token, which is verified here, and the database functions (acct_*) only ever return rows
 * that belong to that verified user.
 *
 * Free-tier cost: one database round trip per call; sign-in/sign-up are single Supabase Auth calls.
 */
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s })
const REF = /^[A-Z0-9]{6,30}$/
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)

/* A speed bump per server instance (Supabase Auth rate-limits too): sign-in guesses, sign-ups and reset mails. */
const hits = new Map()
function limit(key, max, windowMs, message) {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (recent.length >= max) throw new AuthError(message, 429)
  hits.set(key, [...recent, now])
  if (hits.size > 3000) hits.clear()
}
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
const siteOrigin = (req) => String(process.env.SITE_URL || '').replace(/\/$/, '') || `https://${req.headers.host}`
const audit = (action, extra = {}) => console.log(JSON.stringify({ audit: `acct_${action}`, ...extra }))

const ACTIONS = {
  async signup(b, req) {
    const email = clip(b.email, 120).toLowerCase()
    if (!EMAIL.test(email)) throw bad('Please enter a valid e-mail address.')
    const pwProblem = checkPassword(b.password, email)
    if (pwProblem) throw bad(pwProblem)
    const name = clip(b.name, 80)
    if (name.length < 2) throw bad('Please enter your name.')
    const phone = clip(b.phone, 20)
    if (phone && !/^[0-9+ ()-]{8,20}$/.test(phone)) throw bad('Please enter a valid mobile number.')
    limit(`su:${ipOf(req)}`, 5, 60 * 60_000, 'Too many sign-ups from this network. Please try again later.')
    const out = await signUp({ email, password: b.password, name, phone, redirect: `${siteOrigin(req)}/account` })
    audit('signup', { ip: ipOf(req) })
    return out
  },

  async login(b, req) {
    const email = clip(b.email, 120).toLowerCase()
    const keys = [`ip:${ipOf(req)}`, `em:${email}`]
    const fails = (k) => (hits.get(`fail|${k}`) || []).filter((t) => Date.now() - t < 10 * 60_000)
    if (keys.some((k) => fails(k).length >= 8)) throw new AuthError('Too many attempts. Please wait ten minutes.', 429)
    try {
      const out = await passwordLogin(email, String(b.password || ''))
      audit('login')
      return out
    } catch (e) {
      if (e.status === 401) { for (const k of keys) hits.set(`fail|${k}`, [...fails(k), Date.now()]); await new Promise((r) => setTimeout(r, 600)) }
      throw e
    }
  },

  refresh: (b) => refreshSession(b.refreshToken),

  /** "Continue with Google": a Firebase ID token in, a normal account session out (see api/_lib/google.js). */
  async google(b, req) {
    limit(`gg:${ipOf(req)}`, 20, 10 * 60_000, 'Too many sign-in attempts. Please wait a few minutes.')
    const who = await verifyGoogleToken(b.idToken)
    const out = await sessionForEmail(who.email, who.name)
    audit('google_login')
    return out
  },

  async forgot(b, req) {
    const email = clip(b.email, 120).toLowerCase()
    if (!EMAIL.test(email)) throw bad('Please enter a valid e-mail address.')
    limit(`fg:${ipOf(req)}`, 4, 60 * 60_000, 'Too many requests. Please try again later.')
    limit(`fg:${email}`, 2, 60 * 60_000, 'A reset e-mail was sent recently. Please check your inbox, or try again in an hour.')
    await sendReset(email, `${siteOrigin(req)}/account`)
    return { ok: true } // the same answer whether or not the address has an account
  },

  async reset(b) {
    const pwProblem = checkPassword(b.password)
    if (pwProblem) throw bad(pwProblem)
    if (!b.accessToken || typeof b.accessToken !== 'string') throw bad('This link has expired. Please ask for a new one.', 401)
    await setPassword(b.accessToken, b.password)
    audit('password_reset')
    return { ok: true }
  },

  async me(_b, req) {
    const u = await requireUser(req)
    return { email: u.email, name: u.name, phone: u.phone }
  },

  async profile(b, req) {
    await requireUser(req)
    const name = clip(b.name, 80)
    if (name.length < 2) throw bad('Please enter your name.')
    const phone = clip(b.phone, 20)
    if (phone && !/^[0-9+ ()-]{8,20}$/.test(phone)) throw bad('Please enter a valid mobile number.')
    const token = String(req.headers.authorization).slice(7)
    return saveProfile(token, { name, phone })
  },

  async bookings(_b, req) {
    const u = await requireUser(req)
    if (!dbConfigured()) return { bookings: [] }
    // Older guest bookings made with the same e-mail show up too, but only once that e-mail is confirmed.
    const rows = await rpc('acct_bookings', { p_user: u.sub, p_email: await verifiedEmail(u) })
    return { bookings: rows || [] }
  },

  async booking(b, req) {
    const u = await requireUser(req)
    const ref = clip(b.orderRef, 40).toUpperCase()
    if (!REF.test(ref)) throw bad('Booking not found.', 404)
    if (!dbConfigured()) throw bad('Booking not found.', 404)
    const r = await rpc('acct_booking', { p_user: u.sub, p_email: await verifiedEmail(u), p_ref: ref })
    if (!r) throw bad('Booking not found.', 404)
    return r
  },

  /* ---- cancellation and date change of an issued ticket (through TBO; see api/_lib/changes.js) ---- */

  async cancelQuote(b, req) {
    const { booking } = await ownTicketed(b, req)
    return cancelQuote(booking)
  },

  async cancel(b, req) {
    const { user, booking } = await ownTicketed(b, req)
    limit(`cx:${booking.order_ref}`, 4, 60 * 60_000, 'Several requests were sent for this booking already. Please call us.')
    const ev = await requestCancel(booking, { bookingId: b.bookingId, passengers: b.passengers, reason: b.reason === 'airlineCancelled' ? 'airlineCancelled' : 'other', remarks: clip(b.remarks, 150) })
    await saveEvent(user, booking.order_ref, ev)
    audit('cancel_requested', { ref: booking.order_ref })
    return { ok: true, ...ev.data }
  },

  async changeSearch(b, req) {
    const { booking } = await ownTicketed(b, req)
    limit(`cs:${booking.order_ref}`, 20, 60 * 60_000, 'Too many searches for this booking. Please wait a while or call us.')
    return changeSearch(booking, { bookingId: b.bookingId, date: clip(b.date, 10) })
  },

  async changeRequest(b, req) {
    const { user, booking } = await ownTicketed(b, req)
    limit(`cr:${booking.order_ref}`, 3, 60 * 60_000, 'Several requests were sent for this booking already. Please call us.')
    const ev = await requestDateChange(booking, { bookingId: b.bookingId, date: clip(b.date, 10), flight: b.flight })
    await saveEvent(user, booking.order_ref, ev)
    audit('change_requested', { ref: booking.order_ref })
    return { ok: true, ...ev.data }
  },

  /** Live TBO status of every cancellation / date-change request on the booking. */
  async changes(b, req) {
    const { events } = await ownBooking(b, req)
    const list = (events || []).filter((e) => e.kind === 'cancel_requested' || e.kind === 'change_requested')
    return list.length ? changeStatus(list) : { changes: [] }
  },
}

/** The signed-in customer's own booking (the same check as "My trips"), with the user for saving events. */
async function ownBooking(b, req) {
  const u = await requireUser(req)
  const ref = clip(b.orderRef, 40).toUpperCase()
  if (!REF.test(ref) || !dbConfigured()) throw bad('Booking not found.', 404)
  const email = await verifiedEmail(u)
  const r = await rpc('acct_booking', { p_user: u.sub, p_email: email, p_ref: ref })
  if (!r?.booking) throw bad('Booking not found.', 404)
  return { user: { sub: u.sub, email }, booking: r.booking, events: r.events }
}

async function ownTicketed(b, req) {
  const own = await ownBooking(b, req)
  if (own.booking.status !== 'ticketed') throw bad('Only an issued ticket can be changed or cancelled online. Please call us.')
  return own
}

async function saveEvent(user, ref, ev) {
  // TBO has the request already; if this note fails the desk still sees it in TBO, so never fail the customer's request here
  try { await rpc('acct_add_event', { p_user: user.sub, p_email: user.email, p_ref: ref, p_kind: ev.kind, p_data: ev.data }) } catch (e) { console.error('[account] could not save', ev.kind, e.message) }
}

const TBO_ACTIONS = new Set(['cancelQuote', 'cancel', 'changeSearch', 'changeRequest', 'changes'])

export const config = { maxDuration: 120 } // a re-issue search can take up to 120 s (TBO guide)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return res.status(503).json({ error: 'Accounts are not switched on yet.' })
  const { action, ...body } = req.body || {}
  const fn = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null
  if (!fn) return res.status(400).json({ error: 'Unknown action.' })
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  try {
    const out = TBO_ACTIONS.has(action) ? await withEndUserIp(ip, () => fn(body, req)).finally(flushLogs) : await fn(body, req)
    return res.status(200).json(out)
  } catch (e) {
    const known = e instanceof AuthError || e instanceof DbError || e instanceof TboError || e.status
    if (!known) console.error('[account]', action, e)
    return res.status(known ? e.status || 500 : 500).json({ error: e instanceof DbError ? 'Something went wrong. Please try again.' : known ? e.message : 'Something went wrong. Please try again.' })
  }
}
