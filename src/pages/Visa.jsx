import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Info, ArrowRight, X } from 'lucide-react'

import { VISA_TYPES, REGIONS, visaStats } from '../data/visas.js'
import { usePassportServices, useVisas } from '../lib/content.js'
import { waLink } from '../data/site.js'
import { useHashScroll } from '../components/SmoothScroll.jsx'
import { Reveal, SectionHeading, PageHero } from '../components/ui.jsx'
import EnquiryForm from '../components/EnquiryForm.jsx'
import { Parallax } from '../components/motion.jsx'
import { ImageReveal, Marquee, FlightPath, Stamp, ArrowDoodle, introDone } from '../components/fx.jsx'
import { gsap, useGSAP, reduceMotion, enterTrigger } from '../lib/gsap.js'
import { photo } from '../lib/img.js'

const PASSPORT_IMG = photo(
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1000&q=72',
  { sizes: '(min-width: 1240px) 540px, (min-width: 1024px) 45vw, calc(100vw - 40px)', widths: [480, 768, 1080, 1440], quality: 72 },
)
const TIPS_BG = photo(
  'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=1800&q=70',
  { sizes: '100vw', widths: [640, 1080, 1440, 1920], quality: 70 },
)

/* One colour per visa type, used by the filter dots, the ticker and
   the stamps. Tailwind needs literal class strings. */
const DOT = {
  free: 'bg-palm',
  arrival: 'bg-brand-500',
  evisa: 'bg-gold-500',
  embassy: 'bg-clay',
}
const INK = {
  free: 'text-palm border-palm',
  arrival: 'text-brand-500 border-brand-500',
  evisa: 'text-gold-600 border-gold-600',
  embassy: 'text-clay border-clay',
}
/* What the rubber stamp on each card says: [small top line, main word, bottom line] */
const STAMP_WORDS = {
  free: ['Entry', 'Visa free', 'India'],
  arrival: ['Visa', 'On arrival', 'India'],
  evisa: ['Online', 'e-Visa', 'India'],
  embassy: ['Apply at', 'Embassy', 'or VFS'],
}

/* Faint security-paper wave lines, like the background of a passport page. */
const GUILLOCHE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="22"><path d="M0 11 C 15 2, 25 2, 30 11 S 45 20, 60 11 S 75 2, 90 11 S 105 20, 120 11" fill="none" stroke="rgb(15 94 158 / 0.075)" stroke-width="1"/><path d="M0 11 C 15 20, 25 20, 30 11 S 45 2, 60 11 S 75 20, 90 11 S 105 2, 120 11" fill="none" stroke="rgb(11 110 79 / 0.06)" stroke-width="1"/></svg>'
)}")`

/* Machine-readable-zone style strip, purely decorative. */
const mrz = (s) => `V<IND${s.toUpperCase().replace(/[^A-Z]+/g, '<')}${'<'.repeat(44)}`.slice(0, 44)

/* A small, stable tilt per country so the stamps don't all sit at one angle. */
const tilt = (s) => {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997
  const r = (h % 15) - 9
  return Math.abs(r) < 3 ? r - 4 : r
}

/* "Up to 30 days" reads well; "Up to Unlimited" or "Up to 7+ days" does not. */
const stayText = (s) => (/^\d/.test(s) && !s.includes('+') ? `Up to ${s}` : s)

const TIPS = [
  ['Funds that look real', 'Six months of bank statements with a steady pattern beat a large last-minute deposit every time.'],
  ['A reason to return', 'Employment letter, business proof, property or family ties. The case for coming home matters most.'],
  ['A coherent itinerary', 'Flights, hotels and a day plan that actually fit the dates you have applied for.'],
  ['Correct insurance', 'Schengen requires €30,000 medical cover for the full stay. The wrong cover means a rejected file.'],
  ['Enough lead time', 'Apply early. A rushed application leaves no room for an extra document request.'],
]

const PASSPORT_SERVICES = [
  'Fresh application, re-issue and renewal',
  'Tatkal applications when you are travelling at short notice',
  'Lost, damaged or exhausted-pages replacement',
  'Minors, post-marriage name change and address correction',
  'PSK appointment slots and document verification before you go',
]

/* Resolves when the intro curtain lifts, or after a ceiling. */
const heroReady = () => Promise.race([introDone, new Promise((r) => setTimeout(r, 3400))])

/* ============================================================
   HeroStat: counts up once the intro has lifted, with a thin
   meter showing its share of all destinations. The numbers are
   computed from the visa list, not typed in.
   ============================================================ */
function HeroStat({ value, total, label, dot, delay = 0 }) {
  const root = useRef(null)
  const num = useRef(null)
  const bar = useRef(null)
  const share = total ? value / total : 0

  useGSAP((ctx, contextSafe) => {
    const el = num.current
    if (!el || reduceMotion()) return
    const obj = { n: 0 }
    el.textContent = '0'
    gsap.set(bar.current, { scaleX: 0 })
    let dead = false
    const go = contextSafe(() => {
      if (dead) return
      gsap.to(obj, {
        n: value, duration: 1.8, delay: 0.55 + delay, ease: 'power3.out',
        onUpdate: () => { el.textContent = Math.round(obj.n) },
      })
      gsap.to(bar.current, { scaleX: share, duration: 1.9, delay: 0.55 + delay, ease: 'expo.out' })
    })
    heroReady().then(go)
    return () => { dead = true }
  }, { scope: root, dependencies: [value, total] })

  return (
    <div ref={root} className="min-w-[7.5rem] rounded-lg border border-white/15 bg-navy-950/75 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span ref={num} className="font-display text-[1.6rem] leading-none font-extrabold text-white tabular-nums">{value}</span>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
      </div>
      <div className="mt-1 text-[0.86rem] text-white/70">{label}</div>
      <div aria-hidden="true" className="mt-2.5 h-[2px] bg-white/12">
        <span ref={bar} className="block h-full origin-left bg-gold-500" style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  )
}

/* Sliding highlight shared across a pill group (Framer layoutId). */
function PillBg({ id, className }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden="true"
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className={`absolute inset-0 -z-10 rounded-full ${className}`}
    />
  )
}

/* ============================================================
   VisaStamp: the entry type, inked on the card like a rubber
   stamp. It thuds down as the card appears (Framer, because the
   cards themselves are Framer-animated on every filter change).
   ============================================================ */
function VisaStamp({ type, country, delay = 0 }) {
  const [top, main, bottom] = STAMP_WORDS[type]
  const r = tilt(country)
  /* No matchMedia during render (SSR-safe and hydration-stable): the app's
     <MotionConfig reducedMotion="user"> already skips the thud for
     visitors who ask for reduced motion. */
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0, scale: 1.7, rotate: r - 12 }}
      animate={{ opacity: 0.9, scale: 1, rotate: r }}
      transition={{ duration: 0.42, delay: delay + 0.22, ease: [0.34, 1.56, 0.64, 1] }}
      className={`pointer-events-none absolute top-4 right-4 inline-flex select-none flex-col items-center rounded-md border-2 p-[3px] text-center mix-blend-multiply ${INK[type]}`}
    >
      <span className="rounded-[4px] border border-current px-2 py-1">
        <span className="block font-display text-[0.52rem] leading-tight font-extrabold tracking-[0.24em] uppercase">{top}</span>
        <span className="block font-display text-[0.84rem] leading-tight font-black tracking-[0.04em] whitespace-nowrap uppercase">{main}</span>
        <span className="block font-display text-[0.52rem] leading-tight font-extrabold tracking-[0.24em] uppercase">{bottom}</span>
      </span>
    </motion.span>
  )
}

/* A visa result, laid out like a page in a passport. */
function VisaCard({ v, i }) {
  const meta = VISA_TYPES[v.t]
  const delay = Math.min(i * 0.03, 0.3)
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-[translate,box-shadow,border-color] duration-500 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[var(--shadow-lift)]"
      style={{ backgroundImage: GUILLOCHE }}
    >
      <div className="flex flex-1 flex-col p-6 pb-5">
        <span className="text-[0.68rem] font-bold tracking-[0.22em] text-slate-500 uppercase">Visa · {v.r}</span>
        <h4 className="mt-1.5 pr-28 font-display text-[1.18rem] leading-snug font-bold text-ink">{v.c}</h4>
        <span className="sr-only">Entry type: {meta.label}.</span>
        <VisaStamp type={v.t} country={v.c} delay={delay} />

        <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-dashed border-slate-300 py-3">
          <div className="min-w-0">
            <dt className="text-[0.66rem] font-bold tracking-[0.18em] text-slate-500 uppercase">Processing</dt>
            <dd className="mt-0.5 text-[0.95rem] leading-snug font-semibold text-ink">{v.time}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.66rem] font-bold tracking-[0.18em] text-slate-500 uppercase">Stay</dt>
            <dd className="mt-0.5 text-[0.95rem] leading-snug font-semibold text-ink">{stayText(v.stay)}</dd>
          </div>
        </dl>

        <p className="mt-4 flex-1 text-[0.95rem] leading-relaxed text-pretty">{v.note}</p>

        <a
          href={waLink(`Hello Pro Tours & Travel Solutions, I need visa assistance for ${v.c}. Please share the checklist and current processing time. My travel dates are:`)}
          target="_blank" rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 self-start font-display text-[0.95rem] font-bold text-brand-500"
        >
          Ask about this visa<span className="sr-only"> for {v.c} on WhatsApp</span>
          <ArrowRight size={14} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </a>
      </div>
      <div aria-hidden="true" className="overflow-hidden border-t border-slate-200 bg-sand/70 px-6 py-1.5 font-mono text-[0.66rem] tracking-[0.14em] whitespace-nowrap text-slate-500">
        {mrz(v.c)}
      </div>
    </motion.article>
  )
}

/* Tips: a numbered, handwritten notepad. The circles round each
   number ink in one after another as it scrolls into view. */
function TipsPad() {
  const ref = useRef(null)
  useGSAP(() => {
    const el = ref.current
    if (!el) return
    const rings = el.querySelectorAll('path[data-ring]')
    if (reduceMotion()) { gsap.set(rings, { drawSVG: '100%' }); return }
    gsap.fromTo(rings, { drawSVG: '0%' }, {
      drawSVG: '100%', duration: 0.7, ease: 'power2.inOut', stagger: 0.32, delay: 0.25,
      scrollTrigger: enterTrigger(el, { start: 'top 72%' }),
    })
  }, { scope: ref })

  return (
    <div ref={ref} className="relative">
      <span aria-hidden="true" className="absolute -top-3 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rotate-[3deg] bg-gold-400/50" />
      <ol
        className="relative -rotate-[0.8deg] bg-white px-6 pt-8 pb-6 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] sm:px-9"
      >
        {TIPS.map(([t, d], i) => (
          <li key={t} className="flex gap-4 border-b border-slate-200/70 py-4 last:border-0 sm:gap-5">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center">
              <span className="note text-[1.55rem] leading-none text-navy-900">{i + 1}</span>
              <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" className="absolute inset-0 h-full w-full overflow-visible">
                <path data-ring d="M33 7C22 3 7 9 6 24c-1 14 13 20 24 17 11-3 15-15 10-25-3-6-9-9-15-8" stroke="#b4532a" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="note text-[1.4rem] leading-tight text-navy-900">{t}</p>
              <p className="mt-1.5 text-[1rem] leading-relaxed text-pretty">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function Visa() {
  useHashScroll() // /visa#passport
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('All')
  const [type, setType] = useState('all')
  const visas = useVisas()
  const stats = useMemo(() => visaStats(visas), [visas])
  const ticker = useMemo(() => visas.filter((_, i) => i % 3 === 0), [visas]) // one ticker row of destination names
  const passportServices = usePassportServices(PASSPORT_SERVICES)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return visas.filter((v) => {
      const okQ = !needle || v.c.toLowerCase().includes(needle) || v.r.toLowerCase().includes(needle)
      const okR = region === 'All' || v.r === region
      const okT = type === 'all' || v.t === type
      return okQ && okR && okT
    })
  }, [q, region, type, visas])

  // Group the filtered results by region for readable output.
  const grouped = useMemo(() => {
    const map = new Map()
    list.forEach((v) => {
      if (!map.has(v.r)) map.set(v.r, [])
      map.get(v.r).push(v)
    })
    return [...map.entries()]
  }, [list])

  return (
    <>
      <PageHero
        img="https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1800&q=74"
        alt="An Indian passport with travel documents, ready for a visa application"
        eyebrow="Visa & passport help, Bengaluru"
        title="Visa requirements for every country we book"
        sub="Visa assistance in Bengaluru, from our office in Shivaji Nagar. Most rejections come from paperwork, not from the applicant, so we check every file line by line before it goes in."
      >
        <div className="flex flex-wrap gap-3">
          {[
            [stats.free, 'Visa free', DOT.free],
            [stats.arrival, 'On arrival', DOT.arrival],
            [stats.evisa, 'e-Visa', DOT.evisa],
            [stats.embassy, 'Embassy', DOT.embassy],
          ].map(([n, l, d], i) => (
            <HeroStat key={l} value={n} total={stats.total} label={l} dot={d} delay={i * 0.12} />
          ))}
        </div>
      </PageHero>

      {/* ---------- Destination ticker (the page's only marquee) ---------- */}
      <div aria-hidden="true" className="border-b border-white/10 bg-navy-950 py-5 md:py-6">
        <Marquee speed={90} className="[mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          {ticker.map((v) => (
            <span key={v.c} className="flex shrink-0 items-center gap-3 px-5 md:px-7">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[v.t]}`} />
              <span className="note text-[1.3rem] whitespace-nowrap text-white/85 md:text-[1.5rem]">{v.c}</span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* ---------- Browser ---------- */}
      <section aria-label="Visa requirements by country" className="section paper bg-paper">
        <div className="wrap">
          <div className="mb-10 grid gap-6 md:mb-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <SectionHeading
              eyebrow={`${stats.total} destinations, one list`}
              title="Visa rules for Indian passport holders"
              className="!mb-0 md:!mb-0"
            />
            <Reveal delay={0.1}>
              <p className="max-w-md text-[1.05rem] text-pretty lg:ml-auto">
                Indicative timelines and entry types. Rules and fees change often, so we confirm the current position
                for your exact case before you pay anything.
              </p>
            </Reveal>
          </div>

          {/* Controls */}
          <Reveal>
            <div className="mb-10 rounded-2xl border border-slate-200 bg-sand p-5 md:p-6">
              <div className="relative mb-5" role="search">
                <label htmlFor="visa-search" className="sr-only">Search visa requirements by country or region</label>
                <Search size={19} aria-hidden="true" className="absolute top-1/2 left-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="visa-search"
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  aria-controls="visa-results"
                  aria-describedby="visa-count"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search a country: Dubai, Japan, Kenya…"
                  className="field !rounded-xl !border-slate-300 !bg-white !py-3.5 !pr-12 !pl-12 !text-[1rem] md:!py-4 md:!pl-14 md:!text-[1.1rem]"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-4 grid -translate-y-1/2 place-items-center p-1 text-slate-500 hover:text-ink"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Type filter: a navy highlight slides between the active pill */}
              <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by visa type">
                <span aria-hidden="true" className="note mr-1 text-[1.1rem] text-slate-600">Entry type</span>
                <button
                  type="button"
                  onClick={() => setType('all')}
                  aria-pressed={type === 'all'}
                  className={`relative isolate rounded-full border px-4 py-2 text-[0.92rem] font-semibold transition-colors duration-300 ${
                    type === 'all' ? 'border-navy-950 text-white' : 'border-slate-300 bg-white text-ink hover:border-navy-900'
                  }`}
                >
                  {type === 'all' && <PillBg id="visa-type-pill" className="bg-navy-950" />}
                  All types
                </button>
                {Object.entries(VISA_TYPES).map(([k, v]) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setType(type === k ? 'all' : k)}
                    aria-pressed={type === k}
                    className={`relative isolate flex items-center gap-2 rounded-full border px-4 py-2 text-[0.92rem] font-semibold transition-colors duration-300 ${
                      type === k ? 'border-navy-950 text-white' : 'border-slate-300 bg-white text-ink hover:border-navy-900'
                    }`}
                  >
                    {type === k && <PillBg id="visa-type-pill" className="bg-navy-950" />}
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[k]}`} />
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Region filter */}
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by region">
                <span aria-hidden="true" className="note mr-1 text-[1.1rem] text-slate-600">Region</span>
                {['All', ...REGIONS].map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRegion(r)}
                    aria-pressed={region === r}
                    className={`relative isolate rounded-full px-4 py-2 text-[0.9rem] font-semibold transition-colors duration-300 ${
                      region === r ? 'text-white' : 'bg-white/70 text-body hover:text-brand-500'
                    }`}
                  >
                    {region === r && <PillBg id="visa-region-pill" className="bg-brand-500" />}
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Results */}
          <p id="visa-count" className="mb-7 text-[1.01rem] text-slate-500" role="status" aria-live="polite" aria-atomic="true">
            Showing{' '}
            <motion.b
              key={list.length}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block text-ink tabular-nums"
            >
              {list.length}
            </motion.b>{' '}
            of {stats.total} destinations
          </p>

          <div id="visa-results">
          {grouped.map(([r, items]) => (
            <div key={r} className="mb-12">
              <h3 className="mb-5 flex items-center gap-4 text-[1.3rem]">
                {r}
                <svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true" fill="none" className="h-3 min-w-0 flex-1">
                  <motion.path
                    d="M2 7 C 60 3, 120 10, 180 6 S 270 4, 298 7"
                    stroke="rgb(15 94 158 / 0.45)" strokeWidth="1.6" strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
                  />
                </svg>
                <span className="note text-[1.1rem] font-semibold text-slate-500">
                  {items.length}<span className="sr-only"> {items.length === 1 ? 'destination' : 'destinations'}</span>
                </span>
              </h3>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {items.map((v, i) => <VisaCard key={v.c} v={v} i={i} />)}
              </div>
            </div>
          ))}
          </div>

          {!list.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-sand/60 px-6 py-16 text-center">
              <p className="text-[1.12rem]">
                No match for &ldquo;<b className="text-ink">{q}</b>&rdquo;.
              </p>
              <p className="mt-2 text-[1.02rem]">
                We handle destinations beyond this list too.{' '}
                <a
                  href={waLink(`Hello Pro Tours & Travel Solutions, I need visa assistance for ${q || 'a destination not on your list'}.`)}
                  target="_blank" rel="noopener noreferrer" className="font-bold text-brand-500 underline underline-offset-4"
                >
                  Ask us on WhatsApp
                </a>
              </p>
            </div>
          )}

          <Reveal>
            <div className="mt-6 flex gap-4 rounded-xl border border-clay/30 bg-sand p-5 md:p-6">
              <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-clay" />
              <p className="text-[0.99rem] text-ink/85 text-pretty">
                <b>Please note:</b> this list is indicative and maintained for guidance only. Visa rules, fees and
                processing times change frequently and vary by individual profile. Always confirm the current
                requirement with us before booking flights. We do this check free of charge.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Passport ---------- */}
      <section id="passport" aria-label="Passport services" className="section paper scroll-mt-24 bg-sand">
        <div className="wrap grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="relative min-w-0">
            <div className="rounded-2xl shadow-[var(--shadow-lift)]">
              {/* curtain reveal, then the photo drifts slowly inside its frame */}
              <ImageReveal className="rounded-2xl" from="left">
                <Parallax speed={0.1}>
                  <img
                    {...PASSPORT_IMG}
                    alt="Passport application forms and supporting documents laid out on a desk"
                    width={1000}
                    height={825}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3.3] w-full scale-110 object-cover"
                  />
                </Parallax>
              </ImageReveal>
            </div>
            <div className="absolute -top-7 left-3 z-10 sm:-left-5">
              <Stamp top="Fresh · Renewal" main="Tatkal" bottom="Re-issue" tone="navy" rotate={-11} className="bg-paper/80" />
            </div>
          </div>

          <div className="min-w-0">
            <SectionHeading eyebrow="Passport services" title="Fresh, renewal and tatkal passports" className="!mb-5 md:!mb-6" />
            <Reveal delay={0.1}>
              <p className="text-pretty">
                The passport process is straightforward until something is unusual: a name change, a lost booklet, a
                minor without both parents present, or an address that does not match your documents. That is where
                we are most useful, whether it is a routine renewal or passport tatkal help when you need to travel
                at short notice.
              </p>
              <p className="mt-4 text-pretty">
                Renewing for a pilgrimage? Umrah visas need six months or more of passport validity; our{' '}
                <Link to="/umrah" className="link-grow font-bold text-navy-900 hover:text-brand-500">
                  Umrah packages from Bengaluru
                </Link>{' '}
                page lists what else to keep ready.
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <div className="mt-8 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[var(--shadow-lift)]" style={{ backgroundImage: GUILLOCHE }}>
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-2.5 text-[0.68rem] font-bold tracking-[0.24em] text-slate-500 uppercase sm:px-6">
                  <span>What we help with</span>
                  <span aria-hidden="true">Page 01</span>
                </div>
                <ul className="divide-y divide-dashed divide-slate-300 px-5 sm:px-6">
                  {passportServices.map((x, i) => (
                    <li key={x} className="flex gap-4 py-3.5">
                      <span aria-hidden="true" className="pt-0.5 font-mono text-[0.8rem] text-gold-600">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-[1.04rem] leading-snug text-ink/90 text-pretty">{x}</span>
                    </li>
                  ))}
                </ul>
                <div aria-hidden="true" className="overflow-hidden border-t border-slate-200 bg-sand/70 px-5 py-1.5 font-mono text-[0.66rem] tracking-[0.14em] whitespace-nowrap text-slate-500 sm:px-6">
                  P&lt;IND&lt;&lt;FRESH&lt;RENEWAL&lt;TATKAL&lt;REISSUE&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.22}>
              <a
                href={waLink('Hello Pro Tours & Travel Solutions, I need help with a passport (fresh / renewal / tatkal / re-issue). My situation is:')}
                target="_blank" rel="noopener noreferrer" className="btn btn-brand mt-8"
              >
                Ask about your passport <span className="sr-only">on WhatsApp</span> <ArrowRight size={16} aria-hidden="true" />
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Tips ---------- */}
      <section aria-label="Visa application tips" className="relative isolate overflow-hidden bg-navy-950 py-20 md:py-28">
        <img
          {...TIPS_BG}
          alt="" aria-hidden="true" loading="lazy" decoding="async"
          width={1800} height={1200}
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-navy-950/60" />
        <FlightPath className="absolute inset-x-0 top-6 -z-[5] opacity-40 md:top-10" start="top 80%" end="bottom 40%" />

        <div className="wrap relative z-10 grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHeading light eyebrow="Before you apply" title="Five things that decide most visa outcomes" className="!mb-5 md:!mb-6" />
            <Reveal delay={0.1}>
              <p className="text-[1.08rem] text-white/75 text-pretty">
                Most refusals trace back to one of these. Send us your file before it goes in and we will go
                through it against this list.
              </p>
              <a
                href={waLink('Hello Pro Tours & Travel Solutions, could you check my visa file before I apply? Destination and travel dates:')}
                target="_blank" rel="noopener noreferrer" className="btn btn-gold mt-8"
              >
                Get your file checked
              </a>
            </Reveal>
          </div>
          <TipsPad />
        </div>
      </section>

      {/* ---------- Form ---------- */}
      <section aria-label="Visa enquiry" className="section paper bg-paper">
        <div className="wrap grid items-start gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
          <div className="relative min-w-0">
            <SectionHeading
              eyebrow="Start here"
              title="Tell us where you are headed"
              sub="Share a few details and we will send you the exact checklist for your destination and profile."
              className="!mb-0 md:!mb-0"
            />
            <ArrowDoodle className="mt-6 hidden h-20 w-28 rotate-[8deg] text-clay lg:block" />
          </div>
          <Reveal>
            <div className="rounded-2xl border border-slate-200 bg-sand p-6 md:p-10">
              <EnquiryForm defaultService="Visa Services" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
