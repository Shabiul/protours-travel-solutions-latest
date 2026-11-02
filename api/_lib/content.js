import { rpc } from './db.js'
import { REGIONS, VISA_TYPES } from '../../src/data/visas.js'

/**
 * Website content the owner edits in the CRM (tour packages, visa destinations, passport services).
 * Stored in site_content as { items, by, at }; `items: null` means "use the content that ships with the website".
 * Everything is checked here, because what is saved is shown to every visitor of the public site.
 */
export const KEYS = ['packages', 'visas', 'passport']
const TIERS = ['Economy', 'Deluxe', 'Premium']
const CATS = ['international', 'india', 'honeymoon', 'family', 'umrah']
const bad = (m) => Object.assign(new Error(m), { status: 400 })

const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)
const lines = (v, maxItems, maxLen) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => txt(x, maxLen)).filter(Boolean).slice(0, maxItems)

function imageUrl(v) {
  const s = String(v || '').trim()
  let u
  try { u = new URL(s) } catch { throw bad('The picture address must be a full web address starting with https://') }
  if (u.protocol !== 'https:' || s.length > 500) throw bad('The picture address must be a full web address starting with https://')
  return u.toString()
}

function packages(list) {
  if (!Array.isArray(list) || list.length > 60) throw bad('Too many packages (60 at most).')
  const seen = new Set()
  return list.map((p, i) => {
    const n = i + 1
    const id = txt(p?.id, 40).toLowerCase()
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw bad(`Package ${n}: the web name may only have letters, numbers and dashes.`)
    if (seen.has(id)) throw bad(`Package ${n}: another package already uses "${id}".`)
    seen.add(id)
    const name = txt(p.name, 90)
    if (name.length < 3) throw bad(`Package ${n}: enter the package name.`)
    if (txt(p.desc, 600).length < 10) throw bad(`${name}: write a short description.`)
    const tiers = {}
    for (const t of TIERS) {
      const x = p.tiers?.[t] || {}
      const inc = lines(x.inc, 10, 110)
      if (!txt(x.hotel, 90) || !inc.length) throw bad(`${name}: fill the hotel and what is included for ${t}.`)
      tiers[t] = { hotel: txt(x.hotel, 90), inc }
    }
    const out = {
      id, name, region: txt(p.region, 60), nights: txt(p.nights, 20),
      cats: (Array.isArray(p.cats) ? p.cats : []).filter((c) => CATS.includes(c)),
      img: imageUrl(p.img), desc: txt(p.desc, 600), exc: lines(p.exc, 8, 150), tiers,
    }
    if (!out.region || !out.nights) throw bad(`${name}: enter the region and the number of nights.`)
    const badge = txt(p.badge, 24)
    if (badge) out.badge = badge
    if (p.hidden === true) out.hidden = true
    return out
  })
}

function visas(list) {
  if (!Array.isArray(list) || list.length > 400) throw bad('Too many destinations (400 at most).')
  const seen = new Set()
  return list.map((v, i) => {
    const c = txt(v?.c, 60)
    if (c.length < 2) throw bad(`Destination ${i + 1}: enter the country.`)
    if (seen.has(c.toLowerCase())) throw bad(`${c} is listed twice.`)
    seen.add(c.toLowerCase())
    if (!REGIONS.includes(v.r)) throw bad(`${c}: choose a region.`)
    if (!Object.hasOwn(VISA_TYPES, v.t)) throw bad(`${c}: choose the visa type.`)
    return { c, r: v.r, t: v.t, time: txt(v.time, 40), stay: txt(v.stay, 40), note: txt(v.note, 220) }
  })
}

function passport(list) {
  const out = lines(list, 12, 160)
  if (!out.length) throw bad('Add at least one passport service.')
  return out
}

const CLEAN = { packages, visas, passport }

export const cleanContent = (key, items) => CLEAN[key](items)

/** What the public website gets: only the keys the owner has changed. */
export async function publicContent() {
  const rows = await Promise.all(KEYS.map((k) => rpc('crm_get_setting', { p_key: `content_${k}` }).catch(() => null)))
  const out = {}
  KEYS.forEach((k, i) => { const items = rows[i]?.value?.items; if (Array.isArray(items)) out[k] = items })
  return out
}

export async function readContent(key) {
  const row = await rpc('crm_get_setting', { p_key: `content_${key}` }).catch(() => null)
  const v = row?.value
  return { items: Array.isArray(v?.items) ? v.items : null, by: v?.by || null, at: row?.updated_at || null }
}

export async function writeContent(key, items, by) {
  await rpc('crm_set_setting', { p_key: `content_${key}`, p_value: { items, by } })
}
