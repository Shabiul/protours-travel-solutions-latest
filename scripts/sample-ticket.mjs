/* Builds public/demo/sample-e-ticket.pdf with the real ticket code (src/pages/flights/ticket.js), made-up travellers
   and a SAMPLE watermark. Run: node scripts/sample-ticket.mjs
   ticket.js imports a .jsx helper, so it is bundled with esbuild (already installed with Vite) before running. */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'node_modules', '.cache', 'sample-ticket.mjs')
await build({
  stdin: { contents: "export * from './src/pages/flights/ticket.js'", resolveDir: root, loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', outfile: out, loader: { '.jsx': 'jsx' }, jsx: 'automatic', logLevel: 'error',
})
const { drawTickets } = await import(pathToFileURL(out).href)
const { jsPDF } = await import('jspdf')
const bwip = (await import('bwip-js')).default

const logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public', 'logo.png')).toString('base64')}`
// jsPDF cannot read .webp: the airline logo is turned into PNG with Python's Pillow (the browser uses a canvas instead)
const airlineLogo = (code) => {
  const py = "import sys,io,base64;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGBA');bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);b=io.BytesIO();bg.convert('RGB').save(b,'PNG');print(im.size[1]/im.size[0]);print(base64.b64encode(b.getvalue()).decode())"
  const [ratio, b64] = execFileSync('python', ['-I', '-c', py, path.join(root, 'public', 'airlines', `${code}.webp`)], { encoding: 'utf8' }).trim().split(/\s+/)
  return { img: `data:image/png;base64,${b64}`, ratio: Number(ratio) }
}
const airlineLogos = { IX: airlineLogo('IX') }
const png = async (opts, w) => {
  const buf = await bwip.toBuffer({ scale: 3, ...opts })
  const h = buf.readUInt32BE(20) / buf.readUInt32BE(16) * w // PNG header: width at 16, height at 20
  return { img: `data:image/png;base64,${buf.toString('base64')}`, w, h: Math.min(22, h) }
}
const bcbp = (name, pnr, from, to, flight, seat) => `M1${name.padEnd(20).slice(0, 20)} ${pnr} ${from}${to}${flight.padEnd(8)}312Y${(seat || '000').padStart(4, '0')}0001 100`

const pax = [
  { name: 'Mr RAHUL SHARMA', title: 'Mr', first: 'RAHUL', last: 'SHARMA', type: 1, ticket: '2281234567890', seats: ['14C', '6A'], seatsBy: [{ sector: 'BLR-BOM', code: '14C' }, { sector: 'BOM-BLR', code: '6A' }],
    meals: ['BLR-BOM: Veg Biryani Combo', 'BOM-BLR: Trail Mix'], excess: ['BLR-BOM: +10 kg'], services: ['BLR-BOM: Priority check-in'], ff: 'IX 1029384756', gst: '', endorsement: 'VALID IX/ NO CHNG FEE /REFUND FEE APPLY / NO SHOWFEE APPLY' },
  { name: 'Mrs PRIYA SHARMA', title: 'Mrs', first: 'PRIYA', last: 'SHARMA', type: 1, ticket: '2281234567891', seats: ['14D', '6B'], seatsBy: [{ sector: 'BLR-BOM', code: '14D' }, { sector: 'BOM-BLR', code: '6B' }],
    meals: ['BLR-BOM: Paneer Tikka Sandwich', 'BOM-BLR: Trail Mix'], excess: [], services: [], ff: '', gst: '' },
  { name: 'Miss ANAYA SHARMA', title: 'Miss', first: 'ANAYA', last: 'SHARMA', type: 3, ticket: '2281234567892', seats: [], seatsBy: [], meals: [], excess: [], services: [], ff: '', gst: '' },
]
const barcodes = [await Promise.all(pax.map(async (p) => [
  { ...(await png({ bcid: 'pdf417', text: bcbp(`${p.last}/${p.first}`, 'O44WXJ', 'BLR', 'BOM', 'IX 1548', p.seats[0]), columns: 4, eclevel: 2 }, 70)), label: 'Boarding pass barcode (IATA)' },
  { ...(await png({ bcid: 'pdf417', text: bcbp(`${p.last}/${p.first}`, 'O44WXJ', 'BOM', 'BLR', 'IX 2973', p.seats[1]), columns: 4, eclevel: 2 }, 70)), label: 'Boarding pass barcode (IATA)' },
]))]

const doc = drawTickets(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), {
  orderRef: 'PTSAMPLE7Q2', amount: 9480, logo, sample: 'SAMPLE', barcodes, airlineLogos, issuedOn: new Date('2026-11-01T10:30:00Z'),
  contact: { phone: '+91 98450 00000', email: 'rahul.sharma@example.com' },
  tickets: [{
    pnr: 'O44WXJ', bookingId: '2017734',
    details: {
      passengers: pax,
      segments: [{
        flight: 'IX 1548', airline: 'Air India Express', from: 'BLR', to: 'BOM', fromCity: 'Bengaluru', toCity: 'Mumbai',
        fromAirport: 'Kempegowda International Airport Bengaluru', toAirport: 'Chhatrapati Shivaji International Airport',
        dep: '2026-11-08T17:00:00', arr: '2026-11-08T18:45:00', fromTerminal: '2', toTerminal: '2',
        baggage: '15 kg', cabinBaggage: '7 kg', minutes: 105, craft: 'Boeing 737-8', fareClass: 'Value',
      }, {
        flight: 'IX 2973', airline: 'Air India Express', from: 'BOM', to: 'BLR', fromCity: 'Mumbai', toCity: 'Bengaluru',
        fromAirport: 'Chhatrapati Shivaji International Airport', toAirport: 'Kempegowda International Airport Bengaluru',
        dep: '2026-11-12T09:10:00', arr: '2026-11-12T10:55:00', fromTerminal: '2', toTerminal: '2',
        baggage: '15 kg', cabinBaggage: '7 kg', minutes: 105, craft: 'Boeing 737-8', fareClass: 'Value', returnLeg: true,
      }],
      fare: {
        base: 4050, tax: 3540, other: 0, addOns: 1850, published: 9440,
        taxes: [{ key: 'YQTax', amount: 1800 }, { key: 'UDF', amount: 1062 }, { key: 'PSF', amount: 472 }, { key: 'K3', amount: 206 }],
      },
    },
  }],
  billing: {
    billedTo: { company: 'Sharma Traders Pvt Ltd', gstin: '29ABCDE1234F1Z5', email: 'rahul.sharma@example.com', phone: '+91 98450 00000', address: 'MG Road', city: 'Bengaluru' },
    fare: { base: 4050, other: 5430, total: 9480 }, paymentId: 'pay_SAMPLE12345',
    rules: [{
      route: 'BLR - BOM', airline: 'IX', fareBasis: 'VALUE',
      cancel: [{ from: 72, to: null, fee: 2999 }, { from: 4, to: 72, fee: 3499 }, { from: 0, to: 4, fee: 3999 }],
      change: [{ from: 72, to: null, fee: 2250 }, { from: 0, to: 72, fee: 2999 }],
    }],
  },
})
const dest = path.join(root, 'public', 'demo', 'sample-e-ticket.pdf')
fs.writeFileSync(dest, Buffer.from(doc.output('arraybuffer')))
console.log('wrote', path.relative(root, dest), `(${doc.getNumberOfPages()} pages)`)
