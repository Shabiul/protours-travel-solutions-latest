/* The downloadable e-ticket: an A4 PDF, one page per ticket, with the agency's logo and address on top.
   Built in the browser with jsPDF (loaded only when the customer taps Download), so nothing is stored or sent anywhere. */

import { FEE_TYPE, segsOf } from './shared.jsx'

export const TICKET_AGENCY = {
  name: 'PRO TOURS AND TRAVEL SOLUTIONS',
  lines: ['# 21/1 G-2 Plain Street, A.M. Plaza, Hospital Road,', 'Bangalore - 560 001.', 'Mob: +91-9900517604', 'Email: luckysaj@gmail.com', 'Website: www.protoursandtravelsolutions.com'],
}
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

/** doc: a jsPDF instance. tickets: done.results that were issued. logo: PNG data URL (or null). */
export function drawTickets(doc, { orderRef, amount, tickets, logo, issuedOn = new Date(), billing, contact, sample = '' }) {
  const W = 210, M = 14
  tickets.forEach((r, ti) => {
    if (ti) doc.addPage()
    if (sample) watermark(doc, sample)
    let y = 12

    // letterhead: logo left, address right
    if (logo) doc.addImage(logo, /^data:image\/jpe?g/.test(logo) ? 'JPEG' : 'PNG', M, y, 66, 66 * LOGO_RATIO, 'logo', 'FAST')
    doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(8.5)
    doc.text(TICKET_AGENCY.name, W - M, y + 2, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
    TICKET_AGENCY.lines.forEach((l, i) => doc.text(l, W - M, y + 6.5 + i * 3.7, { align: 'right' }))
    y = 36
    doc.setDrawColor(...BLUE).setLineWidth(0.6).line(M, y, W - M, y)

    // title row
    y += 9
    doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(15).text('E-TICKET / ITINERARY', M, y)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY)
    doc.text(`Booking reference: ${plain(orderRef)}`, W - M, y - 4, { align: 'right' })
    doc.text(`Issued: ${dayText(issuedOn.toISOString().slice(0, 19))}${tickets.length > 1 ? `   |   Ticket ${ti + 1} of ${tickets.length}` : ''}`, W - M, y + 1, { align: 'right' })

    // PNR panel
    y += 8
    doc.setFillColor(238, 243, 249).roundedRect(M, y, W - 2 * M, 17, 2, 2, 'F')
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text('AIRLINE PNR', M + 5, y + 6)
    doc.setFont('courier', 'bold').setFontSize(20).setTextColor(...NAVY).text(plain(r.pnr) || 'PENDING', M + 5, y + 14)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text('BOOKING ID', 80, y + 6)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY).text(plain(r.bookingId) || '-', 80, y + 13)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text('AMOUNT PAID (ALL TICKETS)', W - M - 5, y + 6, { align: 'right' })
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY).text(`INR ${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`, W - M - 5, y + 13, { align: 'right' })

    // flights
    y += 25
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...BLUE).text('FLIGHT DETAILS', M, y)
    y += 3
    ;(r.details?.segments || []).forEach((s) => {
      y += 3
      doc.setDrawColor(...LINE).setLineWidth(0.3).roundedRect(M, y, W - 2 * M, 26, 2, 2)
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...NAVY).text(plain(s.airline) ? `${plain(s.airline)}  ${plain(s.flight)}` : plain(s.flight), M + 5, y + 6)
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text(dayText(s.dep), W - M - 5, y + 6, { align: 'right' })
      doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...NAVY)
      doc.text(plain(s.from), M + 5, y + 17)
      doc.text(plain(s.to), 118, y + 17)
      doc.setFontSize(12).text(timeText(s.dep), M + 30, y + 17)
      if (s.arr) doc.text(timeText(s.arr), 118 + 25, y + 17)
      doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M + 52, y + 15, 108, y + 15)
      doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
      doc.text([s.fromTerminal && `Terminal ${plain(s.fromTerminal)}`, s.baggage && `Check-in ${plain(s.baggage)}`].filter(Boolean).join('   '), M + 5, y + 22.5)
      doc.text([s.toTerminal && `Terminal ${plain(s.toTerminal)}`, s.cabinBaggage && `Cabin ${plain(s.cabinBaggage)}`].filter(Boolean).join('   '), 118, y + 22.5)
      y += 26
    })

    // passengers
    y += 12
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...BLUE).text('TRAVELLERS', M, y)
    y += 4
    doc.setFillColor(238, 243, 249).rect(M, y, W - 2 * M, 7, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GREY).text('NAME', M + 3, y + 4.8).text('TICKET NUMBER', 120, y + 4.8)
    y += 7
    ;(r.details?.passengers || []).forEach((p) => {
      doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...NAVY).text(plain(p.name).toUpperCase(), M + 3, y + 6)
      doc.setFont('courier', 'normal').setFontSize(9.5).text(plain(p.ticket) || 'being issued', 120, y + 6)
      doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, y + 9, W - M, y + 9)
      y += 9
    })

    // notes
    y += 10
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...NAVY).text('Before you travel', M, y)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
    const notes = [
      'Carry a valid government photo ID (a passport for international travel). The name must match the ticket.',
      "All times are local to the airport. Web check-in opens on the airline's own website.",
      'Cancellation and date-change fees are set by the airline: see the last page for the fees of your fare. For any change, call or WhatsApp us on +91 99005 17604.',
    ]
    notes.forEach((n, i) => doc.text(doc.splitTextToSize(`${i + 1}. ${n}`, W - 2 * M - 4), M + 2, y + 5.5 + i * 8))

    // footer
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, 282, W - M, 282)
    doc.setFontSize(7.5).setTextColor(...GREY)
    doc.text('Computer-generated e-ticket issued by Pro Tours & Travel Solutions, Bengaluru. No signature required.', M, 287)
    doc.text(`Page ${ti + 1} of ${tickets.length + 1}`, W - M, 287, { align: 'right' })
  })
  drawBillingPage(doc, { orderRef, amount, billing, contact, pages: tickets.length + 1, sample })
  return doc
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
const windowText = (x) => (x.to == null ? `More than ${hrs(x.from)} before departure` : x.from ? `${hrs(x.from)} to ${hrs(x.to)} before departure` : `Within ${hrs(x.to)} of departure`)
const rupees = (n) => `INR ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

function drawBillingPage(doc, { orderRef, amount, billing, contact, pages, sample }) {
  const W = 210, M = 14
  doc.addPage()
  if (sample) watermark(doc, sample)
  let y = 16
  const need = (h) => { if (y + h > 276) { doc.addPage(); y = 16 } }
  const head = (t) => { need(14); doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...BLUE).text(t, M, y); y += 2; doc.setDrawColor(...BLUE).setLineWidth(0.4).line(M, y, W - M, y); y += 6 }
  const row = (k, v, bold) => { need(6); doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GREY).text(k, M + 2, y); doc.setFont('helvetica', bold ? 'bold' : 'normal').setTextColor(...NAVY).text(v, W - M - 2, y, { align: 'right' }); y += 6 }

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...NAVY).text('BILLING DETAILS & CANCELLATION POLICY', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY).text(`Booking reference: ${plain(orderRef)}`, W - M, y, { align: 'right' })
  y += 10

  head('BILLING DETAILS')
  const b = billing?.billedTo || {}
  const bc = { phone: b.phone || contact?.phone || '', email: b.email || contact?.email || '' }
  if (b.company) row('Billed to', plain(b.company), true)
  if (b.gstin) row('GSTIN', plain(b.gstin))
  if (bc.email) row('E-mail', plain(bc.email))
  if (bc.phone) row('Mobile', plain(bc.phone))
  if (b.address || b.city) row('Address', plain([b.address, b.city].filter(Boolean).join(', ')).slice(0, 70))
  y += 2
  if (billing?.fare) {
    row('Base fare', rupees(billing.fare.base))
    row('Taxes, fees, service charge and add-ons', rupees(billing.fare.other))
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, y - 3, W - M, y - 3)
    row('Total paid', rupees(billing.fare.total), true)
  } else {
    row('Total paid', rupees(amount), true)
  }
  row('Payment', billing?.paymentId ? `Paid online (Razorpay) | ${plain(billing.paymentId)}` : 'Paid online (Razorpay)')
  doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
  doc.text('All prices are in Indian rupees and include taxes. This is not a GST tax invoice; ask us if you need one.', M + 2, y + 1)
  y += 9

  head('CANCELLATION & DATE-CHANGE POLICY OF YOUR AIRLINE FARE')
  const rules = billing?.rules || []
  if (!rules.length) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...NAVY)
    const t = doc.splitTextToSize('The airline did not publish cancellation or date-change fees for this fare online. Fees are set by the airline and depend on the fare and on how close to departure you cancel or change. Call or WhatsApp us on +91 99005 17604 before you cancel and we will confirm the exact amount.', W - 2 * M - 4)
    doc.text(t, M + 2, y); y += t.length * 4.6 + 4
  }
  rules.forEach((r) => {
    need(20)
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...NAVY).text(`${r.route}${r.airline ? `  |  ${r.airline}` : ''}${r.fareBasis ? `  |  Fare ${r.fareBasis}` : ''}`, M + 2, y); y += 6
    ;[['Cancellation', r.cancel], ['Date change', r.change]].forEach(([title, segs]) => {
      need(8 + (segs?.length || 1) * 5.5)
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...BLUE).text(title.toUpperCase(), M + 2, y); y += 5
      if (!segs?.length) { doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY).text('Not published by the airline for this fare. Please contact us.', M + 4, y); y += 5.5; return }
      segs.forEach((x) => {
        doc.setFont('helvetica', 'normal').setFontSize(8.8).setTextColor(...NAVY).text(windowText(x), M + 4, y)
        doc.setFont('helvetica', 'bold').text(x.fee === 0 ? 'Free' : `${rupees(x.fee)} per traveller`, W - M - 2, y, { align: 'right' })
        doc.setDrawColor(...LINE).setLineWidth(0.15).line(M + 2, y + 1.8, W - M - 2, y + 1.8)
        y += 5.5
      })
      y += 1.5
    })
    y += 3
  })
  need(24)
  doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
  const fine = doc.splitTextToSize('Fees above are the airline\'s own, per traveller and per direction, taken from the fare rules when you booked. Our service fee is charged on top of the airline fee for a cancellation or change. The fee that applies is the one for the time of the cancellation request, so cancel as early as possible. Refunds of the remaining amount are made to the original payment method; see our Cancellation & Refund Policy on www.protoursandtravelsolutions.com. Airlines may change fare rules; for any change call or WhatsApp +91 99005 17604.', W - 2 * M - 4)
  doc.text(fine, M + 2, y)

  doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, 282, W - M, 282)
  doc.setFontSize(7.5).setTextColor(...GREY)
  doc.text('Computer-generated e-ticket issued by Pro Tours & Travel Solutions, Bengaluru. No signature required.', M, 287)
  doc.text(`Page ${pages} of ${pages}`, W - M, 287, { align: 'right' })
}

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

export async function downloadTicket(done) {
  const tickets = (done.results || []).filter((r) => r.bookingId && !r.error)
  if (!tickets.length) throw new Error('The ticket is not issued yet.')
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), logoDataUrl()])
  const doc = drawTickets(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), { orderRef: done.orderRef, amount: done.amount, tickets, logo, billing: done.billing || loadBilling(done.orderRef), contact: done.contact })
  doc.save(`E-ticket-${plain(tickets[0].pnr) || plain(done.orderRef)}.pdf`)
}
