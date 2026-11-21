/**
 * TBO Air API V11 certification runner (STAGING ONLY): the five mandatory cases, Search + FareRule + FareUpsell.
 *
 *   node --env-file=.env --env-file=.env.local.test scripts/tbo-v11-cert.mjs          # cases 1-5
 *   node --env-file=.env --env-file=.env.local.test scripts/tbo-v11-cert.mjs 2 4      # chosen cases
 *
 * TBO asks only for the Search, FareRule and FareUpsell request/response logs for V11, case by case, so nothing is booked.
 * Search and FareUpsell go to the V11 host (see api/_lib/tbo.js); FareRule keeps its old URL with the new MiniFareRules.
 * Output: certification-v11/Case-<n>_<title>/ with the JSON files numbered in call order, a README, and a zip per case.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

if ((process.env.TBO_ENV || 'staging') !== 'staging') {
  console.error('Refusing to run: certification cases must run on TBO staging.')
  process.exit(1)
}
const { search } = await import('../api/_lib/flights.js')
const { air, unseal, usesV11 } = await import('../api/_lib/tbo.js')
if (!usesV11('Search')) { console.error('V11 is not configured for this mode (Search would use the old endpoint).'); process.exit(1) }

const OUT = path.resolve('certification-v11')
const LOGS = path.resolve('.data', 'tbo-logs')
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

// TBO's five mandatory cases. lcc: which fares to use (true LCC, false GDS).
const CASES = {
  1: { title: 'GDS Domestic Oneway - 1 Adult', journeyType: 'oneway', sectors: [['DEL', 'BOM'], ['DEL', 'BLR'], ['BOM', 'DEL']], pax: [1, 0, 0], lcc: false },
  2: { title: 'LCC Domestic Oneway - 1 Adult + 1 Child + 1 Infant (With SSR)', journeyType: 'oneway', sectors: [['DEL', 'BOM'], ['BLR', 'DEL']], pax: [1, 1, 1], lcc: true },
  3: { title: 'LCC Domestic Return - 2 Adults + 2 Child + 1 Infant', journeyType: 'return', sectors: [['DEL', 'BOM'], ['BLR', 'DEL']], pax: [2, 2, 1], lcc: true },
  4: { title: 'LCC International Oneway - 1 Adult + 1 Child + 1 Infant (With SSR)', journeyType: 'oneway', sectors: [['DEL', 'DXB'], ['BOM', 'DXB'], ['BLR', 'DXB']], pax: [1, 1, 1], lcc: true },
  5: { title: 'GDS International Return - 2 Adults + 2 Child + 1 Infant', journeyType: 'return', sectors: [['DEL', 'DXB'], ['DEL', 'BKK'], ['BOM', 'DXB']], pax: [2, 2, 1], lcc: false },
}
const KEEP = /-(Authenticate|Search|FareRule|FareUpsell)-(request|response)\.json$/

async function runCase(id) {
  const C = CASES[id]
  const notes = []
  for (const [from, to] of C.sectors) for (const ahead of [21, 35]) {
    let s
    try {
      s = await search({ journeyType: C.journeyType, segments: [{ from, to, date: day(ahead) }], returnDate: day(ahead + 5), adults: C.pax[0], children: C.pax[1], infants: C.pax[2], cabin: 'economy' })
    } catch (e) { notes.push(`${from}-${to} +${ahead}d search: ${e.message}`); continue }
    const picks = s.lists.map((l) => l.filter((r) => r.isLCC === C.lcc))
    if (!picks.length || picks.some((p) => !p.length)) { notes.push(`${from}-${to} +${ahead}d: no ${C.lcc ? 'LCC' : 'GDS'} fare (trace ${s.traceId})`); continue }
    const sess = unseal(s.session)
    const chosen = picks.map((p) => p[0])
    const calls = []
    for (const r of chosen) {
      const rule = await air('FareRule', sess, { ResultIndex: r.resultIndex }, { allowError: true }).catch((e) => ({ Error: { ErrorMessage: e.message } }))
      calls.push({ method: 'FareRule', ok: !rule?.Error?.ErrorCode, rules: (rule?.FareRules || []).length, mini: (rule?.FareRules || []).some((f) => f.MiniFareRules?.Rules?.length) })
    }
    // one FareUpsell for the chosen fares (V11 takes up to 10 ResultIndexes)
    const up = await air('FareUpsell', sess, { ResultIndexes: chosen.map((r) => r.resultIndex) }, { allowError: true }).catch((e) => ({ Error: { ErrorMessage: e.message } }))
    calls.push({ method: 'FareUpsell', ok: !up?.Error?.ErrorCode, results: (up?.Results || []).length, error: up?.Error?.ErrorMessage || '' })
    return { id, ...C, ok: true, sector: `${from}-${to}`, date: day(ahead), traceId: s.traceId, airlines: chosen.map((r) => `${r.airline} (${r.airlineCode})`), calls, notes }
  }
  return { id, ...C, ok: false, notes }
}

function pack(r) {
  const folder = `Case-${r.id}_${r.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '')}`
  const dir = path.join(OUT, folder)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const src = path.join(LOGS, r.traceId)
  const auth = fs.existsSync(path.join(LOGS, 'no-trace')) ? fs.readdirSync(path.join(LOGS, 'no-trace')).filter((f) => f.includes('Authenticate')).sort().slice(-2).map((f) => path.join(LOGS, 'no-trace', f)) : []
  const files = [...auth, ...fs.readdirSync(src).filter((f) => KEEP.test(f)).sort().map((f) => path.join(src, f))]
  files.forEach((f, i) => fs.copyFileSync(f, path.join(dir, `${String(i + 1).padStart(2, '0')}_${path.basename(f).replace(/^\d+-\d+-/, '')}`)))
  fs.writeFileSync(path.join(dir, 'README.txt'), [
    `TBO Air API V11 certification - [Case ${r.id}]: ${r.title}`,
    'Agency: PRO TOURS AND TRAVEL SOLUTIONS | Environment: STAGING (test)',
    '',
    `TraceId:   ${r.traceId}`,
    `Sector:    ${r.sector}, travel date ${r.date}${r.journeyType === 'return' ? ' (return +5 days)' : ''}`,
    `Fare used: ${r.airlines.join(' / ')}`,
    `Calls:     ${r.calls.map((c) => `${c.method} ${c.ok ? 'OK' : 'ERROR'}${c.results != null ? ` (${c.results} results)` : ''}${c.mini ? ' (MiniFareRules)' : ''}`).join(', ')}`,
    '',
    'Search and FareUpsell: V11 endpoint (apiv11.tektravels.com/extapi/v1). FareRule: existing endpoint, V11 MiniFareRules.',
    'Files are numbered in call order (request, then response).',
    '',
  ].join('\n'))
  zipDir(dir, path.join(OUT, `${folder}.zip`), folder)
  return { folder, files: files.length }
}

/** Minimal zip writer (stored + deflate), so the runner needs no extra package. */
function zipDir(dir, zipPath, prefix) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const parts = [], central = []
  let offset = 0
  for (const name of fs.readdirSync(dir).sort()) {
    const data = fs.readFileSync(path.join(dir, name)), comp = zlib.deflateRawSync(data), fname = Buffer.from(`${prefix}/${name}`)
    const crc = crc32(data)
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(fname.length, 26)
    parts.push(local, fname, comp)
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(fname.length, 28); cen.writeUInt32LE(offset, 42)
    central.push(cen, fname)
    offset += 30 + fname.length + comp.length
  }
  const cenSize = central.reduce((t, b) => t + b.length, 0)
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16)
  fs.writeFileSync(zipPath, Buffer.concat([...parts, ...central, end]))
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES)
fs.mkdirSync(OUT, { recursive: true })
const results = []
for (const id of ids) {
  if (!CASES[id]) { console.log(`Unknown case ${id}`); continue }
  process.stdout.write(`Case ${id}: ${CASES[id].title} ... `)
  const r = await runCase(id)
  if (r.ok) { const p = pack(r); console.log(`OK ${r.sector} ${r.airlines.join(' / ')} | trace ${r.traceId} | ${r.calls.map((c) => `${c.method}:${c.ok ? 'ok' : 'ERR ' + (c.error || '')}`).join(' ')} | ${p.files} files -> ${p.folder}.zip`) }
  else console.log(`NOT DONE: ${r.notes.slice(-3).join(' | ')}`)
  results.push(r)
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results.map(({ id, title, ok, sector, date, traceId, airlines, calls, notes }) => ({ id, title, ok, sector, date, traceId, airlines, calls, notes })), null, 1))
