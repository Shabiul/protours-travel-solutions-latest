/**
 * TBO certification runner (STAGING ONLY).
 *
 *   node --env-file=.env.local scripts/tbo-cert.mjs            # all cases
 *   node --env-file=.env.local scripts/tbo-cert.mjs 2 4        # chosen cases
 *
 * Each case runs the website's own server code end to end —
 * Authenticate → Search → FareRule → FareQuote → SSR → (Book) → Ticket → GetBookingDetails —
 * with one TokenId + TraceId, then copies that trace's JSON request/response
 * logs into certification/<case>/ and writes certification/SUMMARY.md, which is
 * what TBO's support team asks for (logs as JSON attachments, case by case).
 */
import fs from 'node:fs'
import path from 'node:path'

if ((process.env.TBO_ENV || 'staging') !== 'staging') {
  console.error('Refusing to run: certification cases must run on TBO staging.')
  process.exit(1)
}
process.env.ALLOW_FAKE_PAYMENTS = 'true'
process.env.RAZORPAY_KEY_ID = ''
process.env.RAZORPAY_KEY_SECRET = ''

const { search, quote, checkout, ticket, calendar } = await import('../api/_lib/flights.js')

const OUT = path.resolve('certification')
const LOGS = path.resolve('.data', 'tbo-logs')
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

// Mandatory cases per TBO's Certification page; "S" = sample verification case.
const CASES = {
  S: { title: 'Sample: Domestic Return (2 Adult + 1 Child + 1 Infant)', journeyType: 'return', sectors: [['DEL', 'BOM'], ['BLR', 'DEL'], ['BLR', 'BOM']], pax: [2, 1, 1], lcc: true, intl: false },
  1: { title: 'GDS Domestic Oneway (1 Adult)', journeyType: 'oneway', sectors: [['DEL', 'BOM'], ['DEL', 'BLR'], ['BLR', 'BOM'], ['BOM', 'DEL'], ['DEL', 'MAA'], ['DEL', 'CCU'], ['BOM', 'BLR']], pax: [1, 0, 0], lcc: false, intl: false },
  2: { title: 'LCC Domestic Oneway with SSR (1 Adult + 1 Child + 1 Infant)', journeyType: 'oneway', sectors: [['DEL', 'BOM'], ['BLR', 'DEL']], pax: [1, 1, 1], lcc: true, intl: false, ssr: true },
  3: { title: 'LCC Domestic Return (2 Adult + 2 Child + 1 Infant)', journeyType: 'return', sectors: [['DEL', 'BOM'], ['BLR', 'DEL']], pax: [2, 2, 1], lcc: true, intl: false },
  4: { title: 'LCC International Oneway with SSR (1 Adult + 1 Child + 1 Infant)', journeyType: 'oneway', sectors: [['DEL', 'DXB'], ['BOM', 'DXB'], ['DEL', 'BKK'], ['BLR', 'DXB']], pax: [1, 1, 1], lcc: true, intl: true, ssr: true },
  5: { title: 'GDS International Return (2 Adult + 2 Child + 1 Infant)', journeyType: 'return', sectors: [['DEL', 'DXB'], ['DEL', 'BKK'], ['DEL', 'LHR'], ['BOM', 'DXB']], pax: [2, 2, 1], lcc: false, intl: true },
  6: { title: 'LCC Domestic Special Return (2 Adult + 1 Child)', journeyType: 'special', sectors: [['BOM', 'DEL'], ['DEL', 'GOI'], ['BLR', 'HYD'], ['DEL', 'CCU'], ['BOM', 'BLR'], ['DEL', 'MAA']], pax: [2, 1, 0], lcc: true, intl: false, sourceSets: [['6E'], ['SG'], ['G8']] },
  7: { title: 'GDS Domestic Special Return with SSR (2 Adult + 2 Child + 1 Infant)', journeyType: 'special', sectors: [['DEL', 'BOM'], ['BLR', 'DEL'], ['DEL', 'BLR']], pax: [2, 2, 1], lcc: false, intl: false, sources: ['GDS'], ssr: true },
  8: { title: 'GDS Multiway (2 Adult)', journeyType: 'multicity', sectors: [['DEL', 'BOM', 'BLR'], ['DEL', 'BLR', 'BOM'], ['BLR', 'DEL', 'BOM']], pax: [2, 0, 0], lcc: false, intl: false },
  9: { title: 'Domestic Oneway Air Fare Calendar (2 Adult)', journeyType: 'oneway', sectors: [['DEL', 'BOM'], ['BLR', 'DEL']], pax: [2, 0, 0], lcc: null, intl: false, calendar: true },
  10: { title: 'GDS Advance Search with PriceRBD (2 Adult)', journeyType: 'advance', sectors: [['DEL', 'BOM'], ['DEL', 'DXB'], ['BLR', 'DEL']], pax: [2, 0, 0], lcc: false, intl: null, sources: ['GDS'] },
  // NDC (TBO NewReleases): BA / LH DEL-LON, SQ DEL-SIN, departure more than 3 months out. NDC fares come under the GDS source.
  11: { title: 'NDC International Oneway with SSR (2 Adult + 2 Child)', journeyType: 'oneway', sectors: [['DEL', 'LHR'], ['DEL', 'SIN'], ['DEL', 'FRA'], ['BOM', 'LHR']], pax: [2, 2, 0], lcc: false, ndc: true, intl: true, ssr: true, ahead: [100, 120] },
  12: { title: 'NDC International Return (2 Adult + 2 Child)', journeyType: 'return', sectors: [['DEL', 'LHR'], ['DEL', 'SIN'], ['DEL', 'FRA'], ['BOM', 'LHR']], pax: [2, 2, 0], lcc: false, ndc: true, intl: true, ahead: [100, 120] },
}

// Airlines TBO sells through NDC (TBO docs: BA, LH, SQ, Saudia, Oman Air, Emirates, Etihad; online cancellation list adds WY, GF, AI).
const NDC = new Set(['BA', 'LH', 'SQ', 'SV', 'WY', 'EK', 'EY'])

const NAMES = { 1: [['Mr', 'Rahul'], ['Mrs', 'Ayesha']], 2: [['Mstr', 'Ayaan'], ['Miss', 'Sara']], 3: [['Miss', 'Zoya']] }
const DOB = { 1: ['1988-04-12', '1991-09-23'], 2: ['2017-06-15', '2019-02-08'], 3: ['2026-02-10'] }
const SURNAMES = ['Sharma', 'Khan', 'Rao', 'Iyer', 'Patel', 'Reddy', 'Nair', 'Gupta']

function passengers([a, c, i], intl, caseId) {
  const surname = SURNAMES[Math.abs(hash(caseId + Date.now())) % SURNAMES.length] + 'test'
  const list = []
  const add = (type, n) => {
    for (let k = 0; k < n; k++) {
      const [title, first] = NAMES[type][k]
      list.push({
        paxType: type, title, firstName: first, lastName: surname, dob: DOB[type][k],
        ...(intl ? { passportNo: `Z${7000000 + list.length * 1111 + (hash(caseId) % 999)}`, passportExpiry: '2032-12-31', passportCountry: 'IN', passportIssue: DOB[type][k] > '2022-01-01' ? new Date(Date.parse(DOB[type][k]) + 30 * 864e5).toISOString().slice(0, 10) : '2022-01-01', nationality: 'IN' } : {}),
      })
    }
  }
  add(1, a); add(2, c); add(3, i)
  return list
}

/** Pick the first priced SSR item per sector (baggage for non-infants, meal for all). */
function ssrChoices(leg, pax) {
  if (!leg.ssr?.available) return pax.map(() => ({}))
  // Non-LCC: free meal preference (passed in Book).
  if (!leg.ssr.isLCC) return pax.map(() => ({ meal: leg.ssr.meals?.[0]?.code }))
  const firstPaid = (items) => {
    const seen = new Set(), keys = []
    for (const x of items || []) {
      const s = x.origin + x.destination + x.wayType
      if (!seen.has(s) && x.price > 0) { seen.add(s); keys.push(x.key) }
    }
    return keys
  }
  // no paid item (e.g. NDC meals all at 0): take the first real one, so the case still books an SSR
  const firstReal = (items) => {
    const seen = new Set(), keys = []
    for (const x of items || []) {
      const s = x.origin + x.destination + x.wayType
      if (!seen.has(s) && !/^No/.test(x.code)) { seen.add(s); keys.push(x.key) }
    }
    return keys
  }
  const pick = (items) => (firstPaid(items).length ? firstPaid(items) : firstReal(items))
  const bag = pick(leg.ssr.baggage), meal = pick(leg.ssr.meals)
  return pax.map((p) => ({ baggage: p.paxType === 3 ? [] : bag, meals: meal }))
}

async function runCase(id) {
  const C = CASES[id]
  // Work in a scratch folder; only replace case-<id> if this run succeeds or none succeeded before.
  const final = path.join(OUT, `case-${id}`)
  const dir = path.join(OUT, `.run-case-${id}`)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const pax0 = passengers(C.pax, C.intl, id)
  const note = []
  const calTraces = []

  for (const sources of C.sourceSets || [C.sources]) for (const sector of C.sectors) {
    const [from, to] = sector
    const intl = C.intl ?? sector.some((c) => !['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU'].includes(c))
    const pax = intl === C.intl ? pax0 : passengers(C.pax, intl, id)
    for (const ahead of C.ahead || [21, 35]) {
      let s
      let date = day(ahead)
      try {
        if (C.calendar) {
          const cal = await calendar({ from, to, date })
          calTraces.push(cal.traceId)
          const best = cal.days.find((d) => d.lowest) || cal.days[0]
          if (best?.date) {
            const [dd, mm, yy] = best.date.slice(0, 10).split('-')
            const iso = `${yy}-${mm}-${dd}`
            if (iso > day(1)) date = iso
          }
          note.push(`calendar ${from}-${to}: ${cal.days.length} days, lowest ${best?.date} ${best?.price}`)
        }
        const segments = C.journeyType === 'multicity'
          ? sector.slice(0, -1).map((c, i) => ({ from: c, to: sector[i + 1], date: day(ahead + i * 3) }))
          : [{ from, to, date }]
        s = await search({
          journeyType: C.journeyType,
          segments,
          returnDate: day(ahead + (C.ndc ? 10 : 5)),
          sources,
          adults: C.pax[0], children: C.pax[1], infants: C.pax[2], cabin: 'economy',
        })
      } catch (e) {
        note.push(`${from}-${to} +${ahead}d search: ${e.message}`)
        continue
      }
      const picks = s.lists.map((list) => list.filter((r) => (C.lcc == null || r.isLCC === C.lcc) && (!C.ndc || NDC.has(String(r.airlineCode || '').toUpperCase()))))
      if (picks.some((p) => !p.length)) {
        note.push(`${from}-${to} +${ahead}d: no ${C.ndc ? 'NDC' : C.lcc ? 'LCC' : 'GDS'} result (trace ${s.traceId}; airlines: ${[...new Set(s.lists.flat().map((r) => r.airlineCode))].slice(0, 12).join(' ')})`)
        continue
      }
      // Try a few fares in case one fails at quote/ticket on staging.
      for (let n = 0; n < 3; n++) {
        const chosen = picks.map((p) => p[Math.min(n, p.length - 1)])
        try {
          const q = await quote({ session: s.session, resultIndexes: chosen.map((r) => r.resultIndex), rbd: chosen[0].rbd })
          const choices = C.ssr ? q.legs.map((l) => ssrChoices(l, pax)) : []
          const gst = q.legs.some((l) => l.isGSTMandatory) ? { number: '29AAAAA0000A1Z5', company: 'Pro Tours and Travel Solutions', address: 'Shivaji Nagar Bengaluru', phone: '9900517604', email: 'protours@protours.co.in' } : undefined
          const c = await checkout({ quote: q.quote, passengers: pax, contact: { phone: '9900517604', email: 'protours@protours.co.in', address: '21 1 Plain Street Shivaji Nagar', city: 'Bengaluru' }, gst, choices })
          const t = await ticket({ checkout: c.checkout, payment: { orderId: c.payment.orderId } })
          const ok = t.results.every((r) => r.bookingId && !r.error)
          copyLogs(s.traceId, dir)
          for (const t of calTraces) copyLogs(t, dir)
          const result = { case: id, title: C.title, ok, sector: `${from}-${to}`, traceId: s.traceId, amount: c.amount, ssrTotal: c.ssrTotal, legs: t.results, notes: note }
          fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2))
          if (ok) return result
          note.push(`${from}-${to} fare ${n + 1}: ${t.results.map((r) => r.error || `status ${r.ticketStatus}`).join('; ')}`)
        } catch (e) {
          note.push(`${from}-${to} fare ${n + 1}: ${e.message}`)
        }
      }
      copyLogs(s.traceId, dir)
    }
  }
  const result = { case: id, title: C.title, ok: false, notes: note }
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2))
  return result
}

function copyLogs(traceId, dir) {
  const src = path.join(LOGS, traceId)
  if (!fs.existsSync(src)) return
  const dst = path.join(dir, 'logs', traceId)
  fs.mkdirSync(dst, { recursive: true })
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f))
  // Authenticate is logged without a trace; include the latest one for completeness.
  const auth = path.join(LOGS, 'no-trace')
  if (fs.existsSync(auth)) for (const f of fs.readdirSync(auth).filter((x) => x.includes('Authenticate')).slice(-2)) fs.copyFileSync(path.join(auth, f), path.join(dst, f))
}

function hash(s) {
  let h = 0
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}

function commit(id, ok) {
  const final = path.join(OUT, `case-${id}`), dir = path.join(OUT, `.run-case-${id}`)
  let prevOk = false
  try { prevOk = JSON.parse(fs.readFileSync(path.join(final, 'result.json'), 'utf8')).ok } catch {}
  if (ok || !prevOk) { fs.rmSync(final, { recursive: true, force: true }); fs.cpSync(dir, final, { recursive: true }); fs.rmSync(dir, { recursive: true, force: true }) } else fs.rmSync(dir, { recursive: true, force: true })
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES)
fs.mkdirSync(OUT, { recursive: true })
const all = []
for (const id of ids) {
  if (!CASES[id]) { console.log(`Unknown case ${id}`); continue }
  process.stdout.write(`Case ${id}: ${CASES[id].title} … `)
  const r = await runCase(id)
  commit(id, r.ok)
  all.push(r)
  console.log(r.ok ? `OK  ${r.legs.map((l) => `PNR ${l.pnr} / BookingId ${l.bookingId}`).join(' + ')}` : `FAILED\n   ${r.notes.slice(-3).join('\n   ')}`)
}

const lines = ['# TBO certification run', '', `Run: ${new Date().toISOString()} (staging)`, '', '| Case | Scenario | Result | Sector | TraceId | PNR / BookingId |', '|---|---|---|---|---|---|']
for (const r of all) lines.push(`| ${r.case} | ${r.title} | ${r.ok ? 'Ticketed' : 'Not done'} | ${r.sector || '—'} | ${r.traceId || '—'} | ${(r.legs || []).map((l) => `${l.pnr || '—'} / ${l.bookingId || '—'}`).join('<br>')} |`)
lines.push('', 'Logs for each case are in `certification/case-<n>/logs/<TraceId>/` as JSON request/response pairs.', '')
for (const r of all.filter((x) => !x.ok)) lines.push(`## Case ${r.case} notes`, '', ...r.notes.map((n) => `- ${n}`), '')
fs.writeFileSync(path.join(OUT, `SUMMARY-${ids.join('-')}.md`), lines.join('\n'))
console.log(`\nWrote ${path.join(OUT, `SUMMARY-${ids.join('-')}.md`)}`)
