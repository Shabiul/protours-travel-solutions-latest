import { air, authenticate, TboError } from './tbo.js'
import { AIRPORTS } from './airports.js'
import { getMarkup, priceWith, ruleFor } from './markup.js'
import { bookingSummary, summarise } from './flights.js'

/*
 * After-ticketing changes a customer can start from "My trips", all through TBO:
 *   cancellation: GetCancellationCharges (what the airline keeps / refunds) -> SendChangeRequest (full or per passenger)
 *   date change:  Search with SearchType 1 (re-issue search on the same PNR) -> SendChangeRequest RequestType 3 (re-issuance)
 *   tracking:     GetChangeRequestStatus (status, final charge, refunded amount)
 * TBO's operations team processes every change request, so nothing here is instant: the customer sees "requested",
 * then the status TBO reports. The caller (api/account.js) has already checked that the booking belongs to the customer;
 * the booking ids sent to TBO always come from that stored booking, never from the browser.
 */

const REQUEST = { full: 1, partial: 2, reissue: 3 }
const REASON = { other: 3, noshow: 1, airlineCancelled: 2 }
const CR_STATUS = { 0: 'Not set', 1: 'Received', 2: 'Being processed', 3: 'Acknowledged', 4: 'Completed', 5: 'Rejected', 6: 'Closed', 7: 'Pending', 8: 'Other' }

const bad = (m, status = 400) => new TboError(m, { status })
const isDomestic = (legs) => legs.every((l) => (l.details?.segments || []).every((s) => AIRPORTS[s.from]?.country === 'IN' && AIRPORTS[s.to]?.country === 'IN'))
const firstDep = (leg) => (leg.details?.segments || []).map((s) => s.dep).filter(Boolean).sort()[0]

/** Departure times from TBO are airport-local without a zone; for India that is IST. */
const depMs = (iso) => Date.parse(`${String(iso).slice(0, 19)}+05:30`)

/** TBO: the request must reach them at least 2 h (domestic) / 4 h (international) before the airline's own cut-off. */
function checkTime(leg, domestic) {
  const dep = firstDep(leg)
  if (!dep) return
  const left = depMs(dep) - Date.now()
  if (left <= 0) throw bad('This flight has already left. For a no-show refund of taxes, please call or WhatsApp us.')
  if (left < (domestic ? 3 : 5) * 3600_000) throw bad(`It is too close to departure to change this online. Please call or WhatsApp us now.`)
}

const legOf = (booking, bookingId) => {
  const leg = (booking.legs || []).find((l) => String(l.bookingId) === String(bookingId))
  if (!leg?.bookingId) throw bad('This ticket was not found in your booking.', 404)
  return leg
}

/** Fresh details straight from TBO (ticket ids, current status), so a change is never built on a stale copy. */
async function liveDetails(tokenId, leg) {
  const d = await air('GetBookingDetails', { tokenId }, { BookingId: Number(leg.bookingId), PNR: leg.pnr || '' })
  const it = d?.FlightItinerary
  if (!it) throw bad('The airline did not return this booking. Please call us.', 502)
  return { it, summary: bookingSummary(d) }
}

/* ---------------- cancellation ---------------- */

/** What the airline would keep and refund if every ticket were cancelled now, per PNR. */
export async function cancelQuote(booking) {
  const { tokenId } = await authenticate()
  const legs = (booking.legs || []).filter((l) => l.bookingId)
  if (!legs.length) throw bad('This booking has no issued ticket to cancel.')
  const out = []
  for (const leg of legs) {
    const r = await air('GetCancellationCharges', { tokenId }, { RequestType: REQUEST.full, BookingId: Number(leg.bookingId), BookingMode: 5 }, { allowError: true }).catch(() => null)
    const ok = r && (!r.Error?.ErrorCode || r.Error.ErrorCode === 0) && r.ResponseStatus !== 2
    out.push({
      bookingId: leg.bookingId, pnr: leg.pnr, route: (leg.details?.segments || []).map((s) => `${s.from}-${s.to}`).join(' '),
      dep: firstDep(leg),
      // the airline's numbers; not every airline answers this online (the fee table on the ticket still applies)
      known: !!ok, charge: ok ? Number(r.CancellationCharge) || 0 : null, refund: ok ? Number(r.RefundAmount) || 0 : null,
      remarks: ok ? String(r.Remarks || '') : String(r?.Error?.ErrorMessage || ''),
      passengers: (leg.details?.passengers || []).map((p) => ({ name: p.name, type: p.type || 1 })),
    })
  }
  return { legs: out }
}

/**
 * Cancel one PNR: the whole booking, or only some passengers (partial cancellation).
 * Infants cannot stay booked without their adult, so cancelling an adult also needs the infant (the airline would reject it).
 */
export async function requestCancel(booking, { bookingId, passengers, reason, remarks }) {
  const domestic = isDomestic(booking.legs || [])
  const leg = legOf(booking, bookingId)
  checkTime(leg, domestic)
  const { tokenId } = await authenticate()
  const { it, summary } = await liveDetails(tokenId, leg)
  const all = (it.Passenger || []).filter((p) => p.Ticket?.TicketId)
  if (!all.length) throw bad('The ticket numbers are not issued yet. Please call us to cancel.')
  const wanted = Array.isArray(passengers) && passengers.length ? new Set(passengers.map((n) => String(n).toUpperCase())) : null
  const chosen = wanted ? all.filter((p) => wanted.has(`${p.Title} ${p.FirstName} ${p.LastName}`.toUpperCase())) : all
  if (!chosen.length) throw bad('Choose who to cancel.')
  const full = chosen.length === all.length
  if (!full) {
    const leftAdults = all.filter((p) => !chosen.includes(p) && Number(p.PaxType) === 1).length
    const leftInfants = all.filter((p) => !chosen.includes(p) && Number(p.PaxType) === 3).length
    if (leftInfants > leftAdults) throw bad('An infant cannot fly without an adult. Cancel the infant too, or keep an adult on the booking.')
  }
  const segs = it.Segments || []
  const body = {
    BookingId: Number(leg.bookingId),
    RequestType: full ? REQUEST.full : REQUEST.partial,
    CancellationType: REASON[reason] || REASON.other,
    TicketId: chosen.map((p) => p.Ticket.TicketId),
    ...(full ? {} : { Sectors: [{ Origin: segs[0]?.Origin?.Airport?.AirportCode, Destination: segs.at(-1)?.Destination?.Airport?.AirportCode }] }),
    Remarks: String(remarks || 'Cancellation requested by the customer online').slice(0, 200),
  }
  const r = await air('SendChangeRequest', { tokenId }, body)
  const info = [].concat(r.TicketCRInfo || [])
  if (!info.length) throw bad('The airline did not accept the request. Please call us.', 502)
  return {
    kind: 'cancel_requested',
    data: {
      bookingId: leg.bookingId, pnr: summary?.pnr || leg.pnr, full,
      passengers: chosen.map((p) => `${p.Title} ${p.FirstName} ${p.LastName}`),
      requests: info.map((x) => ({ id: x.ChangeRequestId, ticketId: x.TicketId ?? null, status: x.Status ?? null })),
    },
  }
}

/* ---------------- date change (re-issue) ---------------- */

/** Flights on a new date for the same route and passengers, priced for re-issue (SearchType 1 on the same PNR). */
export async function changeSearch(booking, { bookingId, date }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw bad('Choose the new travel date.')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  if (date < today) throw bad('The new date cannot be in the past.')
  const domestic = isDomestic(booking.legs || [])
  const leg = legOf(booking, bookingId)
  checkTime(leg, domestic)
  const segs = leg.details?.segments || []
  if (!segs.length) throw bad('The flight details of this ticket are missing. Please call us.')
  const pax = leg.details?.passengers || []
  const count = (t) => pax.filter((p) => (p.type || 1) === t).length
  const { tokenId } = await authenticate()
  const r = await air('Search', { tokenId }, {
    AdultCount: String(count(1) || 1), ChildCount: String(count(2)), InfantCount: String(count(3)),
    DirectFlight: 'false', OneStopFlight: 'false', JourneyType: '1', PreferredAirlines: null,
    Segments: [{ Origin: segs[0].from, Destination: segs.at(-1).to, FlightCabinClass: '1', PreferredDepartureTime: `${date}T00:00:00`, PreferredArrivalTime: `${date}T00:00:00` }],
    Sources: null,
    SearchType: 1, Pnr: leg.pnr, BookingId: Number(leg.bookingId),
  }, { allowError: true })
  if (r?.Error?.ErrorCode && r.Error.ErrorCode !== 0) {
    if (r.Error.ErrorCode === 25 || /no result/i.test(r.Error.ErrorMessage || '')) return { options: [] }
    throw bad(r.Error.ErrorMessage || 'This airline does not allow an online date change for this ticket. Please call us.', 422)
  }
  const rule = ruleFor(await getMarkup(), domestic)
  const ctx = { rule, pax: { adults: count(1) || 1, children: count(2), infants: count(3) } }
  const airline = String(segs[0].flight || '').split(' ')[0]
  const options = (r.Results || []).flat()
    .filter((x) => !airline || x.AirlineCode === airline) // a re-issue stays on the same airline
    .map((x) => ({
      ...summarise(x, ctx),
      // the airline's change fee for this option, when TBO sends it (FareBreakdown[].SupplierReissueCharges)
      changeFee: (x.FareBreakdown || []).reduce((t, b) => t + (Number(b.SupplierReissueCharges) || 0), 0),
    }))
    .sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12))
    .slice(0, 30)
  return { options, paid: Number(booking.amount_inr) || null }
}

/** Ask TBO to re-issue the ticket on the chosen flight. Our desk confirms the fare difference with the customer before it is done. */
export async function requestDateChange(booking, { bookingId, date, flight }) {
  const domestic = isDomestic(booking.legs || [])
  const leg = legOf(booking, bookingId)
  checkTime(leg, domestic)
  const f = flight && typeof flight === 'object' ? flight : null
  if (!f || !/^[A-Z0-9]{2}$/.test(String(f.code || '')) || !/^\d{1,5}$/.test(String(f.number || '')) || !/^\d{4}-\d{2}-\d{2}T/.test(String(f.dep || ''))) throw bad('Choose the new flight.')
  const { tokenId } = await authenticate()
  const { it } = await liveDetails(tokenId, leg)
  const tickets = (it.Passenger || []).map((p) => p.Ticket?.TicketId).filter(Boolean)
  if (!tickets.length) throw bad('The ticket numbers are not issued yet. Please call us.')
  const wanted = `${f.code} ${f.number} on ${String(f.dep).slice(0, 10)} at ${String(f.dep).slice(11, 16)} (${f.from}-${f.to})`
  const r = await air('SendChangeRequest', { tokenId }, {
    BookingId: Number(leg.bookingId),
    RequestType: REQUEST.reissue,
    CancellationType: 0,
    TicketId: tickets,
    Remarks: `Date change requested by the customer online: re-issue all passengers to ${wanted}.`.slice(0, 200),
  })
  const info = [].concat(r.TicketCRInfo || [])
  if (!info.length) throw bad('The airline did not accept the request. Please call us.', 502)
  return {
    kind: 'change_requested',
    data: {
      bookingId: leg.bookingId, pnr: leg.pnr, date: String(date || f.dep).slice(0, 10), flight: wanted, price: Number(f.price) || null, changeFee: Number(f.changeFee) || 0,
      requests: info.map((x) => ({ id: x.ChangeRequestId, ticketId: x.TicketId ?? null, status: x.Status ?? null })),
    },
  }
}

/* ---------------- status ---------------- */

/** Latest TBO status for each change request on the booking. */
export async function changeStatus(events) {
  const { tokenId } = await authenticate()
  const out = []
  for (const e of events || []) {
    const reqs = []
    for (const q of e.data?.requests || []) {
      if (!q.id) continue
      const r = await air('GetChangeRequestStatus', { tokenId }, { ChangeRequestId: Number(q.id) }, { allowError: true }).catch(() => null)
      reqs.push({
        id: q.id,
        status: r ? CR_STATUS[r.ChangeRequestStatus] || 'Pending' : 'Pending',
        done: r?.ChangeRequestStatus === 4, rejected: r?.ChangeRequestStatus === 5,
        charge: r ? Number(r.CancellationCharge) || 0 : null,
        refunded: r ? Number(r.RefundedAmount) || 0 : null,
      })
    }
    out.push({ kind: e.kind, created_at: e.created_at, ...e.data, requests: reqs })
  }
  return { changes: out }
}
