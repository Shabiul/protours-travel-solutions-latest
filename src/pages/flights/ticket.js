/* The downloadable e-ticket: an A4 PDF, one page per ticket, with the agency's logo and address on top.
   Built in the browser with jsPDF (loaded only when the customer taps Download), so nothing is stored or sent anywhere. */

import { FEE_TYPE, airportName, cityOf, segsOf } from './shared.jsx'

export const TICKET_AGENCY = {
  name: 'PRO TOURS AND TRAVEL SOLUTIONS',
  lines: ['# 21/1 G-2 Plain Street, A.M. Plaza, Hospital Road,', 'Bangalore - 560 001.', 'Mob: +91-9900517604', 'Email: luckysaj@gmail.com', 'Website: www.protoursandtravelsolutions.com'],
}
/** Airline web check-in pages, by IATA code: [name, url, when it opens/closes]. Unknown airlines get a general line. */
export const WEB_CHECKIN = {
  '6E': ['IndiGo', 'https://www.goindigo.in/web-check-in.html', '48 hours to 60 minutes'],
  SG: ['SpiceJet', 'https://www.spicejet.com/check-in', '48 hours to 60 minutes'],
  QP: ['Akasa Air', 'https://www.akasaair.com/check-in', '48 hours to 60 minutes'],
  AI: ['Air India', 'https://www.airindia.com/in/en/manage/web-checkin.html', '48 hours to 60 minutes'],
  UK: ['Air India', 'https://www.airindia.com/in/en/manage/web-checkin.html', '48 hours to 60 minutes'],
  IX: ['Air India Express', 'https://www.airindiaexpress.com/checkin-home', '14 days to 60 minutes (international: 3 hours)'],
  I5: ['Air India Express', 'https://www.airindiaexpress.com/checkin-home', '14 days to 60 minutes (international: 3 hours)'],
  EK: ['Emirates', 'https://www.emirates.com/in/english/manage-booking/online-check-in/', '48 hours to 90 minutes'],
  EY: ['Etihad', 'https://www.etihad.com/en-in/manage/check-in', '30 hours to 90 minutes'],
  QR: ['Qatar Airways', 'https://www.qatarairways.com/en-in/manage-booking/check-in.html', '48 hours to 90 minutes'],
  FZ: ['flydubai', 'https://www.flydubai.com/en/plan/check-in/', '48 hours to 75 minutes'],
  G9: ['Air Arabia', 'https://www.airarabia.com/en/manage-booking', '48 hours to 4 hours'],
  J9: ['Jazeera Airways', 'https://www.jazeeraairways.com/en-in/manage/check-in', '24 hours to 90 minutes'],
  SQ: ['Singapore Airlines', 'https://www.singaporeair.com/en_UK/in/travel-info/check-in/', '48 hours to 90 minutes'],
  LH: ['Lufthansa', 'https://www.lufthansa.com/in/en/online-check-in', '23 hours to 60 minutes'],
  BA: ['British Airways', 'https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_in', '24 hours to 60 minutes'],
  TG: ['Thai Airways', 'https://www.thaiairways.com/en_IN/manage/check_in.page', '24 hours to 60 minutes'],
  AK: ['AirAsia', 'https://www.airasia.com/check-in/en/gb', '14 days to 60 minutes'],
}

export const TICKET_INFO = [
  'Complete check-in before departure. Have a safe and pleasant journey.',
  'Carry a valid government-issued photo ID for airport check-in.',
  'International travellers should carry a valid passport, applicable visa (including transit visa, if required), and immigration clearance.',
  'For a safer journey, travel insurance is recommended.',
  "Travel is subject to the airline's Conditions of Carriage. International rules may limit the airline's liability for injury, delay or baggage loss.",
  'Baggage dimensions may vary depending on airline policies. Please confirm with the airline in advance.',
]

export const TICKET_TERMS = [
  'Tickets are non-transferable and names cannot be changed after issue. Visas and travel documents are the traveller\'s responsibility.',
  'The airline can change flight times, terminals and aircraft. Check your flight status before leaving for the airport.',
  "Cancellations and date changes follow the airline's fare rules shown on the cancellation policy page. A no-show may forfeit the fare except refundable taxes.",
  'Seats, meals, extra baggage and priority check-in bought as add-ons are non-refundable unless the airline cancels the flight.',
  'Frequent flyer miles are credited by the airline under its own programme rules.',
  'Refunds are made to the original payment method after the airline refunds us, usually within 7 to 21 working days.',
  'Pro Tours & Travel Solutions acts as an agent of the airline. Disputes are subject to Bengaluru jurisdiction.',
  'Full terms: www.protoursandtravelsolutions.com/terms   |   Refund policy: www.protoursandtravelsolutions.com/refund-policy',
]

const LOGO_RATIO = 209 / 1200 // public/logo.png is 1200 x 209

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const part = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], mo: +m[2], d: +m[3], h: m[4], mi: m[5] } : null }
const dayText = (s) => { const p = part(s); return p ? `${DAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]}, ${p.d} ${MONTHS[p.mo - 1]} ${p.y}` : '' }
const timeText = (s) => { const p = part(s); return p ? `${p.h}:${p.mi}` : '' }
// Standard PDF fonts have no rupee sign or accented letters; keep everything plain.
const plain = (v) => String(v ?? '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()

const NAVY = [8, 28, 52], GREY = [90, 100, 112], LINE = [210, 214, 220], BLUE = [15, 94, 158]

/** A faint diagonal word behind the page, so a demo file can never be mistaken for a real booking. */
function watermark(doc, word) {
  doc.saveGraphicsState?.()
  doc.setFont('helvetica', 'bold').setFontSize(84).setTextColor(236, 240, 245)
  doc.text(word, 105, 175, { align: 'center', angle: 35 })
  doc.restoreGraphicsState?.()
}

const PAX_TYPE = { 1: 'Adult', 2: 'Child', 3: 'Infant' }
const SOFT = [244, 247, 250], BAND = [232, 243, 249], GREEN = [22, 120, 70], TEAL = [20, 150, 180], CARD = [214, 220, 228]
const TAX_NAME = {
  K3: 'GST (K3)', YQTax: 'Fuel charge (YQ)', YQ: 'Fuel charge (YQ)', YR: 'Carrier surcharge (YR)', PSF: 'Passenger service fee', UDF: 'User development fee',
  INTax: 'Airport tax (IN)', TransactionFee: 'Transaction fee', OtherTaxes: 'Other taxes',
}
const durText = (m) => (m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : '')
const minsBetween = (a, b) => (a && b ? Math.round((Date.parse(String(b).slice(0, 19) + 'Z') - Date.parse(String(a).slice(0, 19) + 'Z')) / 60000) : 0)
const rs = (n) => `INR ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
/** '15 kg' / '15 Kilograms' / '15KG' -> '15'; anything else (e.g. '1 piece') stays as it is. */
const kg = (v) => { const t = plain(v); const m = /^(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?)?$/i.exec(t); return m ? m[1] : t }

/*
 * The e-ticket, in three parts (the agreed layout):
 *   1. letterhead, "Booking confirmed", PNR, a card per flight, then PASSENGER DETAILS & INCLUDED SERVICES:
 *      a card per traveller with a row per journey (baggage cabin / check-in / excess, seat, meal, special service, barcode)
 *   2. PAYMENT, CONTACT & TRAVEL INFORMATION: fare details & payment | other details & remarks,
 *      contact & billing details | general information, then web check-in
 *   3. FULL FARE RULES & TERMS AND CONDITIONS: cancellation and date-change fees, then the terms
 * Parts 1 and 2 repeat per ticket (a domestic return can have two PNRs); part 3 comes once at the end.
 */
export function drawTickets(doc, { orderRef, amount, tickets, logo, issuedOn = new Date(), billing, contact, sample = '', barcodes = [], airlineLogos = {} }) {
  const W = 210, M = 14, CW = W - 2 * M, BOTTOM = 274
  let y = 0
  const newPage = () => { doc.addPage(); if (sample) watermark(doc, sample); y = 16 }
  const need = (h) => { if (y + h > BOTTOM) newPage() }

  /** Pages 2 and 3: small agency line, booking ref, a big title and a blue rule. */
  const pageHeader = (title) => {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY).text('PRO TOURS & TRAVEL SOLUTIONS', M, 17)
    doc.setFont('helvetica', 'normal').setFontSize(8.6).setTextColor(...GREY).text(`Booking ref: ${plain(orderRef)}`, W - M, 17, { align: 'right' })
    doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...NAVY).text(title, M, 30)
    doc.setDrawColor(...BLUE).setLineWidth(0.6).line(M, 34, W - M, 34)
    y = 42
  }
  /** A rounded card with a navy title band; returns the y where its body starts. */
  const navyCard = (x, top, w, h, title) => {
    doc.setDrawColor(...CARD).setLineWidth(0.3).setFillColor(255, 255, 255).roundedRect(x, top, w, h, 3, 3, 'FD')
    doc.setFillColor(...NAVY).roundedRect(x, top, w, 10, 3, 3, 'F').rect(x, top + 5, w, 5, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9.2).setTextColor(255, 255, 255).text(title, x + 5, top + 6.6)
    return top + 16
  }

  tickets.forEach((r, ti) => {
    const pax = r.details?.passengers || []
    const segs = r.details?.segments || []
    const lead = pax.find((p) => (p.type || 1) === 1) || pax[0]

    /* ===================== part 1: booking, flights, passengers ===================== */
    if (ti) doc.addPage()
    if (sample) watermark(doc, sample)
    if (logo) doc.addImage(logo, /^data:image\/jpe?g/.test(logo) ? 'JPEG' : 'PNG', M, 11, 60, 60 * LOGO_RATIO, 'logo', 'FAST')
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...NAVY).text(TICKET_AGENCY.name, W - M, 14, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(7.4).setTextColor(...GREY)
    const [l1, l2, mob, mail, web] = TICKET_AGENCY.lines
    ;[l1, `${l2} | ${mob}`, `${String(mail).replace(/^Email:\s*/, '')} | ${String(web).replace(/^Website:\s*/, '')}`].forEach((l, i) => doc.text(l, W - M, 19 + i * 3.8, { align: 'right' }))
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, 30, W - M, 30)

    y = 33
    doc.setFillColor(225, 243, 232).roundedRect(M, y, 40, 7, 3.5, 3.5, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(7.4).setTextColor(...GREEN).text('BOOKING CONFIRMED', M + 20, y + 4.7, { align: 'center' })
    doc.setFont('helvetica', 'bold').setFontSize(8.6).setTextColor(...NAVY).text(`Booking ref: ${plain(orderRef)}  |  Booking ID: ${plain(r.bookingId) || '-'}`, W - M, y + 4.7, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(8.2).setTextColor(...GREY).text(`E-ticket issued on ${dayText(issuedOn.toISOString().slice(0, 19))}${tickets.length > 1 ? `  |  Ticket ${ti + 1} of ${tickets.length}` : ''}`, W - M, y + 11, { align: 'right' })
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...NAVY).text(`Dear ${plain(lead?.first || String(lead?.name || '').split(' ')[1] || 'Traveller').toUpperCase()},`, M, y + 15)
    doc.setFont('helvetica', 'normal').setFontSize(8.6).setTextColor(...GREY).text('Your booking is confirmed!', M, y + 19.5)
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY).text(`PNR: ${plain(r.pnr) || 'PENDING'}`, M, y + 26.5)
    y += 31

    // a card per flight
    segs.forEach((s) => {
      need(31)
      const top = y, h = 28
      doc.setDrawColor(...CARD).setLineWidth(0.3).setFillColor(255, 255, 255).roundedRect(M, top, CW, h, 3, 3, 'FD')
      doc.setFillColor(...BAND).roundedRect(M, top, CW, 8, 3, 3, 'F').rect(M, top + 4, CW, 4, 'F')
      const code = String(s.flight || '').split(' ')[0]
      const al = airlineLogos[code]
      let tx = M + 5
      if (al?.img) {
        doc.setFillColor(255, 255, 255).roundedRect(M + 3, top + 1, 21, 6, 1.2, 1.2, 'F')
        const lh = Math.min(4.6, 19 * al.ratio), lw = lh / al.ratio
        doc.addImage(al.img, 'PNG', M + 3 + (21 - lw) / 2, top + 1 + (6 - lh) / 2, lw, lh, `al-${code}`, 'FAST')
        tx = M + 27
      }
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY).text(`${plain(s.flight)}   ${dayText(s.dep)}`, tx, top + 5.5)
      doc.setFontSize(8.6).text(s.returnLeg ? 'RETURN' : 'ONWARD', W - M - 5, top + 5.5, { align: 'right' })
      doc.setFont('helvetica', 'normal').setFontSize(7.6).setTextColor(...GREY).text(`Operated by ${plain(s.operatedBy || s.airline) || 'the airline'}${s.craft ? `  |  ${plain(s.craft)}` : ''}${s.fareClass ? `  |  Class ${plain(s.fareClass)}` : ''}`, M + 5, top + 12.3)
      const L = M + 6, R = W - M - 6
      doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...NAVY).text(timeText(s.dep), L, top + 18.3)
      if (s.arr) doc.text(timeText(s.arr), R, top + 18.3, { align: 'right' })
      doc.setDrawColor(...LINE).setLineDashPattern([0.8, 0.8], 0).setLineWidth(0.3).line(L + 26, top + 16.8, R - 26, top + 16.8).setLineDashPattern([], 0)
      doc.setFillColor(245, 130, 32).circle(L + 26, top + 16.8, 1, 'F')
      doc.setFillColor(...TEAL).circle(R - 26, top + 16.8, 1, 'F')
      const d = durText(s.minutes || minsBetween(s.dep, s.arr))
      if (d) { doc.setFont('helvetica', 'bold').setFontSize(8.2); const dw = doc.getTextWidth(d) + 4; doc.setFillColor(255, 255, 255).rect(W / 2 - dw / 2, top + 14.3, dw, 4.6, 'F'); doc.setTextColor(...NAVY).text(d, W / 2, top + 17.9, { align: 'center' }) }
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY).text([plain(s.from), plain(s.fromCity || (cityOf(s.from) !== s.from ? cityOf(s.from) : ''))].filter(Boolean).join(', '), L, top + 22.8)
      doc.text([plain(s.to), plain(s.toCity || (cityOf(s.to) !== s.to ? cityOf(s.to) : ''))].filter(Boolean).join(', '), R, top + 22.8, { align: 'right' })
      doc.setFont('helvetica', 'normal').setFontSize(6.8).setTextColor(...GREY)
      const ap = (n, t) => [plain(n), t ? `T${plain(t)}` : ''].filter(Boolean).join(', ')
      doc.text(ap(s.fromAirport || airportName(s.from), s.fromTerminal), L, top + 26)
      doc.text(ap(s.toAirport || airportName(s.to), s.toTerminal), R, top + 26, { align: 'right' })
      y += h + 3
    })

    // PASSENGER DETAILS & INCLUDED SERVICES: a card per traveller, a row per journey
    need(30)
    y += 4
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY).text('PASSENGER DETAILS & INCLUDED SERVICES', M, y)
    doc.setFont('helvetica', 'normal').setFontSize(7.4).setTextColor(...GREY).text('Baggage values are listed as Cabin / Check-in / Excess (kg).', M, y + 4.5)
    y += 8.5
    const journeys = []
    segs.forEach((s) => { const key = s.returnLeg ? 'ret' : 'dep'; const j = journeys.find((x) => x.key === key); if (j) j.segs.push(s); else journeys.push({ key, segs: [s] }) })
    const C = { flight: M + 5, bag: M + 30, seat: M + 74, meal: M + 92, spec: M + 128, code: M + 160 }
    const inSeg = (list, js) => (list || []).filter((x) => js.segs.some((s) => String(x).startsWith(`${s.from}-${s.to}`))).map((x) => String(x).replace(/^[A-Z]{3}-[A-Z]{3}:\s*/, ''))
    pax.forEach((p, pi) => {
      const infant = p.type === 3
      const rows = journeys.map((js, jx) => {
        const seat = (p.seatsBy || []).filter((x) => js.segs.some((s) => x.sector === `${s.from}-${s.to}`)).map((x) => x.code)
        const seats = seat.length ? seat : jx === 0 && !(p.seatsBy || []).length ? p.seats || [] : []
        const meals = inSeg(p.meals, js).length ? inSeg(p.meals, js) : jx === 0 ? (p.meals || []).filter((m) => !/^[A-Z]{3}-[A-Z]{3}:/.test(m)) : []
        const excess = inSeg(p.excess, js).map((x) => x.replace(/\s*kg$/i, ''))
        const special = [...inSeg(p.services, js), ...(p.priority && !inSeg(p.services, js).length && jx === 0 ? ['Priority check-in'] : []), ...(p.ff ? [`FF ${plain(p.ff)}`] : [])]
        const one = (k) => [...new Set(js.segs.map((s) => kg(s[k])).filter(Boolean))].join('/') || '--'
        doc.setFont('helvetica', 'normal').setFontSize(7.8)
        const mealL = meals.length ? doc.splitTextToSize(meals.map(plain).join(', '), 33) : ['--']
        const specL = special.length ? doc.splitTextToSize(special.join(' '), 30) : ['--']
        const codes = (barcodes[ti]?.[pi] || []).filter((b) => b.img)
        return {
          label: js.key === 'ret' ? 'RETURN' : 'ONWARD', sector: `${js.segs[0].from} - ${js.segs.at(-1).to}`,
          bag: `${infant ? '--' : one('cabinBaggage')} / ${one('baggage')} / ${excess.length ? excess.join(', ') : '--'}`,
          seat: seats.join(', ') || '--', mealL, specL, bc: codes[jx] || (journeys.length === 1 ? codes[0] : null),
          h: Math.max(13, 4 + Math.max(mealL.length, specL.length) * 3.6),
        }
      })
      const cardH = 14.5 + rows.reduce((t, r2) => t + r2.h, 0) + 1
      need(cardH + 3)
      const top = y
      doc.setDrawColor(...CARD).setLineWidth(0.3).setFillColor(255, 255, 255).roundedRect(M, top, CW, cardH, 3, 3, 'FD')
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY).text(plain(p.name).toUpperCase(), M + 5, top + 5.8)
      const nw = doc.getTextWidth(plain(p.name).toUpperCase())
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text(`${PAX_TYPE[p.type] || 'Adult'}  |  Ticket ${plain(p.ticket) || 'being issued'}`, M + 7 + nw, top + 5.8)
      doc.setFillColor(...SOFT).rect(M + 0.2, top + 8.5, CW - 0.4, 6, 'F')
      doc.setFont('helvetica', 'bold').setFontSize(7.6).setTextColor(...GREY)
      ;[['Flight', C.flight], ['Baggage (kg)', C.bag], ['Seat', C.seat], ['Meal', C.meal], ['Special service', C.spec], ['Barcode', C.code]].forEach(([t, x]) => doc.text(t, x, top + 12.6))
      let ry = top + 14.5
      rows.forEach((r2) => {
        doc.setFont('helvetica', 'bold').setFontSize(7.6).setTextColor(...BLUE).text(r2.label, C.flight, ry + 5)
        doc.setFontSize(8).setTextColor(...NAVY).text(r2.sector, C.flight, ry + 8.8)
        doc.setFont('helvetica', 'normal').setFontSize(8).text(r2.bag, C.bag, ry + 7)
        doc.setFont('helvetica', 'bold').setFontSize(8.6).text(r2.seat, C.seat, ry + 7)
        doc.setFont('helvetica', 'normal').setFontSize(7.8).text(r2.mealL, C.meal, ry + 5).text(r2.specL, C.spec, ry + 5)
        if (r2.bc) {
          const bh = Math.min(r2.h - 2.5, 11), bw = r2.bc.w <= 30 ? bh : Math.min(16, bh * 1.35)
          doc.addImage(r2.bc.img, 'PNG', C.code + 1, ry + (r2.h - bh) / 2, bw, bh, undefined, 'FAST')
        } else {
          doc.setFontSize(7).setTextColor(...GREY).text('At check-in', C.code + 1, ry + 7)
        }
        ry += r2.h
      })
      y = top + cardH + 3
    })

    /* ===================== part 2: payment, contact & travel information ===================== */
    newPage()
    pageHeader('PAYMENT, CONTACT & TRAVEL INFORMATION')
    const colW = (CW - 6) / 2, XL = M, XR = M + colW + 6

    // fare lines
    const f = r.details?.fare
    const paidAll = Number(amount) || 0
    const lines = []
    if (f && tickets.length === 1) {
      lines.push(['Base airfare', f.base])
      if (f.taxes.length) f.taxes.forEach((t) => lines.push([TAX_NAME[t.key] || t.key, t.amount]))
      else if (f.tax) lines.push(['Taxes and airport fees', f.tax])
      if (f.other) lines.push(['Other airline charges', f.other])
      if (f.addOns) lines.push(['Seats, meals, baggage & services', f.addOns])
      const rest = paidAll - lines.reduce((t, [, v]) => t + v, 0)
      if (rest > 0.5) lines.push(['Service & convenience fee', rest])
    } else if (billing?.fare) {
      lines.push(['Base airfare', billing.fare.base], ['Taxes, fees & add-ons', billing.fare.other])
    }
    // remarks
    const tour = plain(r.details?.tourCode || pax.find((p) => p.tourCode)?.tourCode || '') || 'Not stated'
    const endorse = plain(pax.find((p) => p.endorsement)?.endorsement || r.details?.airlineRemark || '') || 'Not stated'
    const ffs = pax.filter((p) => p.ff).map((p) => plain(p.ff).replace(/^([A-Z0-9]{2})\s+/, '$1-')).join(', ') || '--'
    doc.setFont('helvetica', 'normal').setFontSize(8.2)
    const endL = doc.splitTextToSize(endorse, colW - 10)
    doc.setFont('helvetica', 'bold').setFontSize(8.2)
    const fixedL = ['CANCELLATION PENALTY WILL APPLY AS PER AIRLINE POLICY', 'RECONFIRM ALL FLIGHT/TIMINGS 72 HRS BEFORE DEPARTURE'].map((t) => doc.splitTextToSize(t, colW - 10))
    const fareH = 16 + lines.length * 5.6 + 26
    const remH = 16 + 6 + 8 + endL.length * 4 + 9 + fixedL.reduce((t, l) => t + l.length * 4 + 3, 0) + 4
    const row1 = Math.max(fareH, remH)

    let fy = navyCard(XL, y, colW, row1, 'FARE DETAILS & PAYMENT') + 1
    doc.setFont('helvetica', 'normal').setFontSize(8.4)
    lines.forEach(([k, v]) => { doc.setTextColor(...GREY).text(k, XL + 5, fy); doc.setTextColor(...NAVY).text(rs(v), XL + colW - 5, fy, { align: 'right' }); fy += 5.6 })
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(XL + 5, fy - 2.6, XL + colW - 5, fy - 2.6)
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY).text(tickets.length > 1 ? 'PAID (ALL)' : 'PAID', XL + 5, fy + 5).text(rs(paidAll), XL + colW - 5, fy + 5, { align: 'right' })
    doc.setFontSize(7.4).setTextColor(...BLUE).text('MODE OF PAYMENT', XL + 5, fy + 12)
    doc.setFont('helvetica', 'normal').setFontSize(8.4).setTextColor(...NAVY).text('Online payment (Razorpay)', XL + 5, fy + 17)
    doc.setFont('helvetica', 'bold').text(rs(paidAll), XL + colW - 5, fy + 17, { align: 'right' })
    if (billing?.paymentId) doc.setFont('helvetica', 'normal').setFontSize(7.6).setTextColor(...GREY).text(`Payment ID: ${plain(billing.paymentId)}`, XL + 5, fy + 21.5)

    let ryy = navyCard(XR, y, colW, row1, 'OTHER DETAILS & REMARKS') + 1
    const kv = (k, v, yy) => { doc.setFont('helvetica', 'bold').setFontSize(8.2).setTextColor(...GREY).text(k, XR + 5, yy); doc.setFont('helvetica', 'normal').setTextColor(...NAVY).text(v, XR + 5 + doc.getTextWidth(k) + 4, yy) }
    kv('Tour code:', tour, ryy)
    ryy += 9
    doc.setFont('helvetica', 'bold').setFontSize(8.2).setTextColor(...GREY).text('Endorsement information:', XR + 5, ryy)
    doc.setFont('helvetica', 'normal').setTextColor(...NAVY).text(endL, XR + 5, ryy + 4.6)
    ryy += 4.6 + endL.length * 4 + 4
    kv('Frequent flyer number:', ffs, ryy)
    ryy += 9
    doc.setFont('helvetica', 'bold').setFontSize(8.2).setTextColor(...NAVY)
    fixedL.forEach((l) => { doc.text(l, XR + 5, ryy); ryy += l.length * 4 + 3 })
    y += row1 + 6

    // contact & billing | general information
    const b = billing?.billedTo || {}
    const contactRows = [
      ['Billed to / Company', plain(b.company), true], ['GSTIN', plain(b.gstin || pax.find((p) => p.gst)?.gst)], ['Email', plain(b.email || contact?.email)],
      ['Mobile / Contact', plain(b.phone || contact?.phone)], ['Billing address', plain([b.address, b.city].filter(Boolean).join(', '))],
    ].filter(([, v]) => v)
    doc.setFont('helvetica', 'normal').setFontSize(7.9)
    const infoL = TICKET_INFO.map((t) => doc.splitTextToSize(t, colW - 15))
    const contactH = 16 + contactRows.length * 9 + 2
    const infoH = 16 + infoL.reduce((t, l) => t + l.length * 3.7 + 2.4, 0) + 2
    const row2 = Math.max(contactH, infoH, 50)
    need(row2 + 40)
    let cy = navyCard(XL, y, colW, row2, 'CONTACT & BILLING DETAILS') + 1
    contactRows.forEach(([k, v, bold]) => {
      doc.setFont('helvetica', 'normal').setFontSize(7.6).setTextColor(...GREY).text(k, XL + 5, cy)
      doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(9).setTextColor(...NAVY).text(doc.splitTextToSize(v, colW - 10)[0], XL + 5, cy + 4.3)
      cy += 9
    })
    let gy = navyCard(XR, y, colW, row2, 'GENERAL INFORMATION') + 1
    infoL.forEach((l) => {
      doc.setFillColor(...TEAL).circle(XR + 6.2, gy - 1, 0.8, 'F')
      doc.setFont('helvetica', 'normal').setFontSize(7.9).setTextColor(...NAVY).text(l, XR + 10, gy)
      gy += l.length * 3.7 + 2.4
    })
    y += row2 + 6

    // web check-in
    const airlines = [...new Set(segs.map((s) => String(s.flight || '').split(' ')[0]).filter(Boolean))]
    const wc = [...new Map(airlines.map((c) => WEB_CHECKIN[c]).filter(Boolean).map((x) => [x[1], x])).values()]
    doc.setFont('helvetica', 'normal').setFontSize(8.4)
    const wcText = wc.length ? wc.map(([n, , win]) => `${n} web check-in opens ${win} before departure.`) : ["Web check-in on the airline's website or app, with your PNR and last name."]
    const wcL = wcText.flatMap((t) => doc.splitTextToSize(t, 108))
    const wcH = 16 + wcL.length * 4.2 + 5
    need(wcH + 14)
    doc.setDrawColor(200, 230, 212).setLineWidth(0.3).setFillColor(234, 246, 239).roundedRect(M, y, CW, wcH, 3, 3, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...GREEN).text('WEB CHECK-IN', M + 6, y + 8)
    doc.setFont('helvetica', 'normal').setFontSize(8.4).setTextColor(...NAVY).text(wcL, M + 6, y + 14)
    wc.forEach(([, url], i) => doc.setFont('helvetica', 'bold').setFontSize(8.6).setTextColor(...BLUE).textWithLink(url.replace(/^https:\/\//, ''), W - M - 6 - doc.getTextWidth(url.replace(/^https:\/\//, '')), y + 14 + i * 5, { url }))
    y += wcH + 10
    doc.setFont('helvetica', 'bold').setFontSize(8.6).setTextColor(...GREY).text('Help: call or WhatsApp Pro Tours on +91 99005 17604  |  luckysaj@gmail.com', M, y)
  })

  /* ===================== part 3: full fare rules & terms and conditions ===================== */
  newPage()
  pageHeader('FULL FARE RULES & TERMS AND CONDITIONS')
  drawFareRules(doc, { y, M, W, CW, billing, sample, need: (h) => { if (y + h > BOTTOM) { newPage(); pageHeader('FULL FARE RULES & TERMS AND CONDITIONS') } return y }, setY: (v) => { y = v }, getY: () => y })

  // terms: a navy-titled card, numbered items
  doc.setFont('helvetica', 'normal').setFontSize(8.4)
  const termL = TICKET_TERMS.map((t) => doc.splitTextToSize(t, CW - 22))
  const termH = 16 + termL.reduce((t, l) => t + l.length * 4 + 3, 0) + 4
  if (y + termH > BOTTOM) newPage()
  let ty = navyCard(M, y, CW, termH, 'TERMS & CONDITIONS') + 1
  termL.forEach((l, i) => {
    doc.setFont('helvetica', 'bold').setFontSize(8.6).setTextColor(...BLUE).text(`${i + 1}.`, M + 6, ty)
    doc.setFont('helvetica', 'normal').setFontSize(8.4).setTextColor(...NAVY).text(l, M + 16, ty)
    ty += l.length * 4 + 3
  })

  // footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, 282, W - M, 282)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GREY)
    doc.text('Computer-generated e-ticket issued by Pro Tours & Travel Solutions, Bengaluru. This is not a GST invoice. No signature required.', M, 287)
    doc.text(`Page ${i} of ${pages}`, W - M, 287, { align: 'right' })
  }
  return doc
}

/** The sand card with each fare's cancellation and date-change fees (bars + one row per time window). */
function drawFareRules(doc, { M, W, CW, billing, setY, getY }) {
  let y = getY()
  const rules = billing?.rules || []
  doc.setFont('helvetica', 'normal').setFontSize(7.6)
  const fine = doc.splitTextToSize("Fees above are the airline's own, per traveller and per direction, taken from the fare rules when you booked. The fee that applies is the one for the time of the cancellation request, so cancel as early as possible. Refunds of the remaining amount are made to the original payment method; see our Cancellation & Refund Policy at www.protoursandtravelsolutions.com. Airlines may change fare rules; for any change call or WhatsApp +91 99005 17604.", CW - 12)
  const none = doc.splitTextToSize('The airline did not publish cancellation or date-change fees for this fare online. Fees are set by the airline and depend on how close to departure you cancel or change. Call or WhatsApp us on +91 99005 17604 before you cancel and we will confirm the exact amount.', CW - 12)
  const ruleH = (r) => 8 + [r.cancel, r.change].reduce((t, segs) => t + 14 + Math.max(1, segs?.length || 0) * 8.6, 0)
  const h = 16 + (rules.length ? rules.reduce((t, r) => t + ruleH(r), 0) : none.length * 4 + 2) + fine.length * 3.6 + 10
  doc.setDrawColor(235, 225, 205).setLineWidth(0.3).setFillColor(250, 246, 239).roundedRect(M, y, CW, h, 4, 4, 'FD')
  let cy = y + 10
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY).text('Cancellation & date-change fees', M + 6, cy)
  cy += 7
  if (!rules.length) { doc.setFont('helvetica', 'normal').setFontSize(8.4).text(none, M + 6, cy); cy += none.length * 4 + 2 }
  rules.forEach((r) => {
    doc.setFont('helvetica', 'normal').setFontSize(8.2).setTextColor(...GREY).text([r.route, r.airline, r.fareBasis && `Fare ${r.fareBasis}`].filter(Boolean).join('  |  '), M + 6, cy)
    cy += 8
    ;[['Cancellation fee', r.cancel], ['Date change fee', r.change]].forEach(([title, segs]) => {
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...NAVY).text(title, M + 6, cy)
      cy += 4
      const list = segs || []
      if (!list.length) { doc.setFont('helvetica', 'normal').setFontSize(8.2).setTextColor(...GREY).text('Not published by the airline for this fare. Please contact us.', M + 8, cy + 5); cy += 18.6; return }
      const bw = (CW - 12) / list.length
      list.forEach((x, i) => doc.setFillColor(...(i === list.length - 1 && list.length > 1 && x.fee > 0 ? RED : x.fee === 0 ? PALM : GOLD)).rect(M + 6 + i * bw, cy, bw, 2.4, 'F'))
      cy += 5.4
      list.forEach((x) => {
        doc.setFillColor(243, 237, 226).roundedRect(M + 6, cy, CW - 12, 7.2, 1.6, 1.6, 'F')
        doc.setFont('helvetica', 'normal').setFontSize(8.2).setTextColor(...GREY).text(windowText(x), M + 10, cy + 4.8)
        doc.setFont('helvetica', 'bold').setTextColor(...NAVY).text(x.fee === 0 ? 'Free' : rupees(x.fee), W - M - 10, cy + 4.8, { align: 'right' })
        cy += 8.6
      })
      cy += 4.6
    })
  })
  doc.setFont('helvetica', 'normal').setFontSize(7.6).setTextColor(...GREY).text(fine, M + 6, cy + 1)
  setY(y + h + 8)
}

/* ---------- billing details and the airline's cancellation policy (last page of the PDF) ---------- */

const BILLING_KEY = (ref) => `pt_billing_${ref}`

/** What the customer paid for and the airline's cancellation / date-change fees for the fare, kept as plain data. */
export function makeBilling({ q, details, payment, amount }) {
  const base = q.legs.reduce((t, l) => t + (l.paxFares || []).reduce((a, f) => a + (Number(f.base) || 0), 0), 0)
  const rules = q.legs.flatMap((l) => (l.rules || []).filter((r) => r.mini?.Rules?.length).map((r) => ({
    route: `${plain(r.origin)} - ${plain(r.destination)}`, airline: plain(r.airline), fareBasis: plain(r.fareBasis),
    cancel: segsOf(r.mini.Rules, FEE_TYPE.cancel), change: segsOf(r.mini.Rules, FEE_TYPE.change),
  })))
  const g = details?.gst, c = details?.contact || {}
  return {
    billedTo: { company: g?.company || '', gstin: g?.number || '', email: c.email || '', phone: c.phone || '', address: g?.address || c.address || '', city: c.city || '' },
    fare: { base, other: Math.max(0, (Number(amount) || 0) - base), total: Number(amount) || 0 },
    paymentId: payment?.paymentId || '',
    rules,
  }
}

export const saveBilling = (ref, billing) => { try { localStorage.setItem(BILLING_KEY(ref), JSON.stringify(billing)) } catch { /* private mode */ } }
export const loadBilling = (ref) => { try { return JSON.parse(localStorage.getItem(BILLING_KEY(ref)) || 'null') } catch { return null } }

const hrs = (h) => (h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${Math.round(h)} hours` : `${Math.round(h * 60)} minutes`)
const windowText = (x) => (x.to == null ? `More than ${hrs(x.from)} before departure` : x.from ? `${hrs(x.from)} to ${hrs(x.to)} before departure` : `Up to ${hrs(x.to)} before departure`)
const PALM = [22, 120, 70], GOLD = [214, 162, 38], RED = [220, 38, 38], SAND = [246, 241, 231]
const rupees = (n) => `INR ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

/* ---------- the payment receipt: what was paid, how, and for which booking ---------- */

const IST = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }
const istText = (d) => (d ? new Date(d).toLocaleString('en-IN', IST).replace(/\bam\b/, 'AM').replace(/\bpm\b/, 'PM') : '')

/**
 * r: { receiptNo, orderRef, paidAt, status, amount, fare: {base, other}, payer: {name, email, phone},
 *      payment: {id, orderId, method, vpa, upiRef, bankRef, cardNetwork, cardLast4, bank},
 *      trip: {route, date, pax, pnr} }
 * Card numbers are never shown (only the network and last 4 digits, which Razorpay gives us).
 */
export function drawReceipt(doc, r, { logo, sample = '' } = {}) {
  const W = 210, M = 14
  if (sample) watermark(doc, sample)
  let y = 12
  if (logo) doc.addImage(logo, /^data:image\/jpe?g/.test(logo) ? 'JPEG' : 'PNG', M, y, 66, 66 * LOGO_RATIO, 'logo', 'FAST')
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(8.5).text(TICKET_AGENCY.name, W - M, y + 2, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
  TICKET_AGENCY.lines.forEach((l, i) => doc.text(l, W - M, y + 6.5 + i * 3.7, { align: 'right' }))
  y = 36
  doc.setDrawColor(...BLUE).setLineWidth(0.6).line(M, y, W - M, y)

  y += 10
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(16).text('PAYMENT RECEIPT', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY)
  doc.text(`Receipt no: ${plain(r.receiptNo)}`, W - M, y - 4, { align: 'right' })
  doc.text(`Date: ${istText(r.paidAt)} IST`, W - M, y + 1, { align: 'right' })

  // the big "paid" panel
  y += 8
  const paid = r.status === 'captured'
  doc.setFillColor(...(paid ? [232, 245, 238] : [253, 236, 234])).roundedRect(M, y, W - 2 * M, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...(paid ? [22, 120, 70] : [170, 40, 30])).text(paid ? 'PAYMENT RECEIVED' : plain(String(r.status).toUpperCase()), M + 6, y + 8)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text('AMOUNT PAID', W - M - 6, y + 7, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY).text(`INR ${Math.round(Number(r.amount) || 0).toLocaleString('en-IN')}`, W - M - 6, y + 17, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY).text(`for booking ${plain(r.orderRef)}`, M + 6, y + 16)
  y += 30

  const head = (t) => { doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...BLUE).text(t, M, y); y += 2; doc.setDrawColor(...BLUE).setLineWidth(0.4).line(M, y, W - M, y); y += 6 }
  const row = (k, v, bold) => {
    if (!v && v !== 0) return
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GREY).text(k, M + 2, y)
    doc.setFont(bold ? 'helvetica' : 'helvetica', bold ? 'bold' : 'normal').setTextColor(...NAVY).text(plain(v), W - M - 2, y, { align: 'right' })
    y += 6.2
  }
  const pay = r.payment || {}
  const method = String(pay.method || '').toLowerCase()
  head('RECEIVED FROM')
  row('Name', r.payer?.name); row('E-mail', r.payer?.email); row('Mobile', r.payer?.phone)
  y += 4
  head('PAYMENT DETAILS')
  row('Payment ID', pay.id); row('Gateway order ID', pay.orderId)
  row('Paid by', method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : method === 'netbanking' ? 'Net banking' : method ? method.toUpperCase() : '')
  if (method === 'upi') { row('UPI ID', pay.vpa); row('UPI reference', pay.upiRef) }
  if (method === 'card') row('Card', [pay.cardNetwork, pay.cardLast4 ? `ending ${pay.cardLast4}` : ''].filter(Boolean).join(' '))
  if (method === 'netbanking') row('Bank', pay.bank)
  row('Bank reference (RRN)', pay.bankRef)
  row('Status', paid ? 'Captured (successful)' : r.status)
  row('Paid on', `${istText(r.paidAt)} IST`)
  y += 4
  head('WHAT THE PAYMENT IS FOR')
  row('Booking reference', r.orderRef); row('Airline PNR', r.trip?.pnr); row('Flight', r.trip?.route)
  row('Travel date', r.trip?.date); row('Travellers', r.trip?.pax ? String(r.trip.pax) : '')
  y += 2
  if (r.fare) {
    row('Base fare', `INR ${Math.round(r.fare.base).toLocaleString('en-IN')}`)
    row('Taxes, fees, service charge and add-ons', `INR ${Math.round(r.fare.other).toLocaleString('en-IN')}`)
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, y - 3, W - M, y - 3)
  }
  row('Total paid', `INR ${Math.round(Number(r.amount) || 0).toLocaleString('en-IN')}`, true)

  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
  const note = doc.splitTextToSize('This receipt confirms that the payment above was received by Pro Tours & Travel Solutions through Razorpay. Your e-ticket is a separate document. This is not a GST tax invoice; ask us if you need one. For refunds, see our Cancellation & Refund Policy on www.protoursandtravelsolutions.com or call or WhatsApp +91 99005 17604. Card numbers are never stored: only the card network and last 4 digits are shown.', W - 2 * M - 4)
  doc.text(note, M + 2, y)

  doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, 282, W - M, 282)
  doc.setFontSize(7.5).setTextColor(...GREY)
  doc.text('Computer-generated receipt issued by Pro Tours & Travel Solutions, Bengaluru. No signature required.', M, 287)
  return doc
}

export async function downloadReceipt(r) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), logoDataUrl()])
  const doc = drawReceipt(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), r, { logo })
  doc.save(`Receipt-${plain(r.receiptNo) || plain(r.orderRef)}.pdf`)
}

/** The logo, shrunk to what an A4 letterhead needs (about 66 mm wide: 540 px is plenty) and saved as a JPEG: a few KB instead of ~900 KB. */
export async function logoDataUrl() {
  try {
    const blob = await (await fetch('/logo.png')).blob()
    const bmp = await createImageBitmap(blob)
    const w = 540, h = Math.round((bmp.height / bmp.width) * w)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.82)
  } catch { return null } // the ticket is still valid without the logo
}

/** { code: { img: PNG data URL, ratio: height / width } } for every airline on the tickets; a missing logo is simply left out. */
export async function airlineLogosFor(tickets) {
  const codes = [...new Set(tickets.flatMap((t) => (t.details?.segments || []).map((s) => String(s.flight || '').split(' ')[0])).filter((c) => /^[A-Z0-9]{2}$/.test(c)))]
  const out = {}
  await Promise.all(codes.map(async (c) => {
    try {
      const res = await fetch(`/airlines/${c}.webp`)
      if (!res.ok) return
      const bmp = await createImageBitmap(await res.blob())
      const w = Math.min(320, bmp.width), h = Math.round((bmp.height / bmp.width) * w)
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h)
      out[c] = { img: cv.toDataURL('image/png'), ratio: h / w }
    } catch { /* no logo: the ticket shows the flight number alone */ }
  }))
  return out
}

/** The e-ticket PDF for a finished booking: { doc (jsPDF), filename }. */
export async function buildTicketPdf(done) {
  const tickets = (done.results || []).filter((r) => r.bookingId && !r.error)
  if (!tickets.length) throw new Error('The ticket is not issued yet.')
  const [{ jsPDF }, logo, barcodes, airlineLogos] = await Promise.all([import('jspdf'), logoDataUrl(), ticketBarcodes(tickets), airlineLogosFor(tickets)])
  const doc = drawTickets(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), { orderRef: done.orderRef, amount: done.amount, tickets, logo, barcodes, airlineLogos, billing: done.billing || loadBilling(done.orderRef), contact: done.contact })
  return { doc, filename: `E-ticket-${plain(tickets[0].pnr) || plain(done.orderRef)}.pdf`, pnr: plain(tickets[0].pnr) }
}

export async function downloadTicket(done) {
  const { doc, filename } = await buildTicketPdf(done)
  doc.save(filename)
}

/** Opens the PDF itself in the browser's print dialog (an invisible frame), so what prints is the real e-ticket. */
export async function printTicket(done) {
  const { doc } = await buildTicketPdf(done)
  const url = URL.createObjectURL(doc.output('blob'))
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.src = url
  frame.onload = () => {
    try { frame.contentWindow.focus(); frame.contentWindow.print() } catch { window.open(url, '_blank') } // some browsers block printing a PDF frame: open it instead
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 60_000)
  }
  document.body.appendChild(frame)
}

/**
 * WhatsApp: phones share the PDF file itself (the share sheet lists WhatsApp). Where files cannot be shared
 * (most desktops), the PDF is downloaded and WhatsApp opens with a message, so the customer attaches the file there.
 */
export async function shareTicketWhatsApp(done) {
  const { doc, filename, pnr } = await buildTicketPdf(done)
  const text = `E-ticket${pnr ? ` for PNR ${pnr}` : ''} (booking ${done.orderRef}), Pro Tours & Travel Solutions.`
  const file = new File([doc.output('blob')], filename, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename, text }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  doc.save(filename)
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} The PDF is attached.`)}`, '_blank', 'noopener')
  return 'downloaded'
}

/** E-mails the PDF to the address on the booking (the server never sends it anywhere else). */
export async function emailTicket(done) {
  const { doc } = await buildTicketPdf(done)
  const pdf = doc.output('datauristring').split(',')[1]
  const res = await fetch('/api/flights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'emailTicket', orderRef: done.orderRef, pdf }) })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out.error || 'The e-mail could not be sent. Please download the PDF instead.')
  return out.sentTo
}

/* ---------- barcodes ---------- */

const BCID = { PDF417: 'pdf417', QRCODE: 'qrcode', QR: 'qrcode', AZTEC: 'azteccode', DATAMATRIX: 'datamatrix', CODE128: 'code128' }

/** One PNG per barcode, sized in mm for the PDF: [ticket][passenger] -> [{ img, w, h, label }].
 *  The airline's own boarding-pass barcode (IATA BCBP, the one airport gates and kiosks scan) when TBO sends it;
 *  otherwise a Code 128 of the PNR and ticket number, which check-in counters and our desk can scan to look the booking up. */
export async function ticketBarcodes(tickets) {
  let bwip
  try { bwip = (await import('bwip-js/browser')).default } catch { return [] } // the ticket is still valid without barcodes
  const render = (bcid, text, opts = {}) => {
    const c = document.createElement('canvas')
    bwip.toCanvas(c, { bcid, text, scale: 3, ...opts })
    return { img: c.toDataURL('image/png'), ratio: c.height / c.width }
  }
  const sized = async (b, label) => {
    if (b.image) {
      const img = /^data:/.test(b.image) ? b.image : `data:image/png;base64,${b.image}`
      const bmp = await createImageBitmap(await (await fetch(img)).blob()).catch(() => null)
      if (bmp) return { img, w: 70, h: Math.min(30, 70 * (bmp.height / bmp.width)), label }
    }
    const bcid = BCID[String(b.format || '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || 'pdf417'
    const square = bcid !== 'pdf417' && bcid !== 'code128'
    const r = render(bcid, b.content, bcid === 'pdf417' ? { columns: 4, eclevel: 2 } : bcid === 'code128' ? { height: 10 } : {})
    const w = square ? 28 : 70
    return { img: r.img, w, h: Math.min(30, w * r.ratio), label }
  }
  return Promise.all(tickets.map((t) => Promise.all((t.details?.passengers || []).map(async (p) => {
    try {
      const own = p.barcodes || []
      if (own.length) return await Promise.all(own.map((b, i) => sized(b, `Boarding pass barcode${own.length > 1 ? ` ${i + 1}` : ''} (IATA)`)))
      const text = [plain(t.pnr), plain(p.ticket)].filter(Boolean).join(' ')
      return text ? [await sized({ format: 'CODE128', content: text }, `PNR ${text}  |  booking barcode, not a boarding pass`)] : []
    } catch { return [] }
  }))))
}
