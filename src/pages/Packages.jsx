import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion'
import { Check, Crown, Star, Sparkles, Plane, Car, MessageCircle } from 'lucide-react'

import { BIZ, TIERS, waLink } from '../data/site.js'
import { usePackages } from '../lib/content.js'
import { Reveal, SectionHeading, PageHero, Parallax } from '../components/ui.jsx'
import { Stamp, Polaroid, CircleMark, ArrowDoodle } from '../components/fx.jsx'
import { gsap, useGSAP, reduceMotion, enterTrigger, ScrollTrigger } from '../lib/gsap.js'
import { photo } from '../lib/img.js'

const FILTERS = [
  { k: 'all', label: 'Everything' },
  { k: 'international', label: 'International' },
  { k: 'india', label: 'India' },
  { k: 'honeymoon', label: 'Honeymoon' },
  { k: 'family', label: 'Family' },
  { k: 'umrah', label: 'Umrah' },
]

const TIER_META = {
  Economy: { icon: Star,     blurb: 'Good value, with everything essential covered.' },
  Deluxe:  { icon: Sparkles, blurb: 'Better hotels, more inclusions, private transfers.' },
  Premium: { icon: Crown,    blurb: 'Five-star stays, private guides, full board.' },
}

// "Best for" chips come straight from each package's own categories.
const BEST_FOR = { family: 'Families', honeymoon: 'Couples', umrah: 'Pilgrims' }

const INCLUDED = [
  ['Confirmed hotel vouchers', 'Issued before you travel, never “on request”.'],
  ['All listed transfers', 'Airport pickups and inter-city moves, with no surprise add-ons.'],
  ['Visa guidance', 'Checklist, forms and appointment support for the destination.'],
  ['On-trip WhatsApp support', 'A number that answers while you are actually travelling.'],
]

/* What each package photo actually shows (keyed by Unsplash photo id). */
const ALT = {
  '1518684079': 'Aerial view of the Burj Al Arab on the Dubai coast',
  '1590523741831': 'Palm trees leaning over a white-sand beach in the Maldives',
  '1537996194471': 'Ulun Danu Beratan water temple on Lake Bratan, Bali',
  '1525625293386': 'Marina Bay Sands and the ArtScience Museum, Singapore',
  '1476514525535': 'Wooden rowing boat on an alpine lake beneath the mountains in Europe',
  '1528181304800': 'Gilded Buddhist temple spires against a blue sky in Thailand',
  '1602216056096': 'Houseboat on the palm-lined Alleppey backwaters, Kerala',
  '1595815771614': 'Houseboats moored on Dal Lake below snowy mountains, Srinagar',
  '1524492412937': 'The Taj Mahal in Agra, seen along its reflecting pool',
  '1512343879784': 'Palm-lined beach and turquoise sea in Goa',
  '1580418827493': 'The clock towers above Masjid al-Haram in Makkah',
}

/* Card images: 1 column on phones, 2 from md, 3 from lg. */
const cardImg = (p) => ({
  ...photo(p.img, { sizes: '(min-width: 1024px) 31vw, (min-width: 768px) 46vw, 100vw', widths: [480, 768, 1080] }),
  alt: ALT[p.img.match(/photo-(\d+)/)?.[1]] ?? `${p.name}, ${p.region}`,
})

/* Where to read about the paperwork for each trip. India trips need no visa. */
function visaLink(p) {
  if (p.cats.includes('umrah')) return { to: '/umrah', text: 'Umrah packages from Bengaluru', ctx: '' }
  if (p.cats.includes('india')) return null
  return { to: '/visa', text: 'Visa checklist', ctx: ` for ${p.region}` }
}

const SPRING = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }
const EASE = [0.16, 1, 0.3, 1]
const STUB = 84 // px — height of the tear-off stub; the notches sit on its line

/* Ticket shape: two punched notches on the perforation line. Masks only
   change what's painted, never layout, so they're safe with `layout`. */
const TICKET_CSS = `
.pk-ticket {
  -webkit-mask:
    radial-gradient(circle 11px at 0 calc(100% - ${STUB}px), #0000 97%, #000) ,
    radial-gradient(circle 11px at 100% calc(100% - ${STUB}px), #0000 97%, #000);
  -webkit-mask-composite: source-in;
          mask:
    radial-gradient(circle 11px at 0 calc(100% - ${STUB}px), #0000 97%, #000) ,
    radial-gradient(circle 11px at 100% calc(100% - ${STUB}px), #0000 97%, #000);
          mask-composite: intersect;
}
`

/* How you get there — read off the package itself, never guessed. */
function modeIcon(p) {
  if (p.exc?.some((x) => /^Flights or train/i.test(x))) return Car
  return Plane
}

function stampTone(p) {
  if (p.cats.includes('umrah')) return 'palm'
  if (p.cats.includes('india')) return 'navy'
  return 'clay'
}

/* A ring + tick that ink themselves in, like a pen mark on a checklist. */
function DrawCheck({ delay = 0 }) {
  const ref = useRef(null)
  useGSAP(() => {
    const paths = ref.current?.querySelectorAll('path')
    if (!paths?.length) return
    if (reduceMotion()) { gsap.set(paths, { drawSVG: '100%' }); return }
    gsap.fromTo(paths, { drawSVG: '0%' }, {
      drawSVG: '100%', duration: 0.9, ease: 'power2.inOut', stagger: 0.3, delay,
      scrollTrigger: enterTrigger(ref.current, { start: 'top 90%' }),
    })
  }, { scope: ref })
  return (
    <svg ref={ref} viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11 shrink-0" fill="none">
      <path d="M40 12C33 4 17 3 9 12c-8 9-5 24 7 29 11 5 25 0 28-12 1-5 0-9-2-12" stroke="#8a5a00" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 25l6 6 13-14" stroke="#0f5e9e" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PackageCard({ p, tier, index }) {
  const t = p.tiers[tier]
  const Mode = modeIcon(p)
  const bestFor = p.cats.map((c) => BEST_FOR[c]).filter(Boolean)
  const delay = (index % 3) * 0.08
  const msg = `Hello Pro Tours & Travel Solutions, please share today's quote for ${p.name} — ${tier} tier (${p.nights}).\nTravel dates: \nNumber of travellers: `
  const img = cardImg(p)
  const visa = visaLink(p)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 48, rotate: index % 2 ? 1.2 : -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, y: -14, transition: { duration: 0.25 } }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className="pk-ticket group flex h-full flex-col border border-slate-200 bg-white"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          {...img}
          width={1080}
          height={675}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
        />
        <span className="absolute bottom-3 left-3 rounded-md bg-navy-950/85 px-2.5 py-1 font-display text-[0.8rem] font-bold tracking-wide text-white">
          {p.nights}
        </span>
      </div>

      <div className="relative flex flex-1 flex-col px-6 pt-5 pb-6">
        {/* The package badge, rubber-stamped in the corner */}
        <Stamp
          top={tier}
          main={p.badge}
          tone={stampTone(p)}
          rotate={[-7, 5, -4][index % 3]}
          className="absolute top-4 right-4 z-10 max-w-[9.5rem] [&_span]:!text-[0.58rem] [&>span>span:nth-child(2)]:!text-[0.86rem]"
        />
        <div className="min-h-[5rem] pr-[10rem]">
          <span className="block font-display text-[0.7rem] font-bold tracking-[0.2em] text-slate-500 uppercase">Destination</span>
          <span className="block font-display text-[0.98rem] leading-snug font-bold text-ink">{p.region}</span>
        </div>
        <h3 className="mt-3 text-[1.24rem] text-balance">{p.name}</h3>

        {/* Route line: draws once as the ticket lands */}
        <div aria-hidden="true" className="mt-4 flex items-center gap-2 text-slate-400">
          <span className="h-2 w-2 shrink-0 rounded-full border-2 border-brand-500" />
          <span className="relative h-px flex-1">
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: delay + 0.35, ease: EASE }}
              className="absolute inset-0 origin-left border-t-[1.5px] border-dashed border-slate-400"
            />
          </span>
          <motion.span
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: delay + 0.95, ease: EASE }}
            className="text-brand-500"
          >
            <Mode size={16} className={Mode === Plane ? 'rotate-45' : ''} />
          </motion.span>
        </div>

        <p className="mt-4 text-[1rem] text-pretty">{p.desc}</p>

        {bestFor.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-2">
            <span className="note text-[1.05rem] text-gold-600">Best for</span>
            {bestFor.map((b) => (
              <span key={b} className="rounded-md border border-slate-300 px-2 py-0.5 text-[0.82rem] font-semibold text-slate-600">
                {b}
              </span>
            ))}
          </p>
        )}

        {/* Tier detail, set out like the fields on a ticket */}
        <dl className="mt-5 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 border-t border-dashed border-slate-300 pt-4 text-[0.95rem]">
          <dt className="pt-0.5 font-display text-[0.7rem] font-bold tracking-[0.18em] text-slate-500 uppercase">Stay</dt>
          <dd className="font-display font-bold text-ink">{t.hotel}</dd>
          <dt className="pt-0.5 font-display text-[0.7rem] font-bold tracking-[0.18em] text-slate-500 uppercase">Includes</dt>
          <dd>
            <ul className="grid gap-1.5">
              {t.inc.map((x) => (
                <li key={x} className="flex gap-2">
                  <Check size={14} strokeWidth={3} className="mt-1 shrink-0 text-brand-500" aria-hidden="true" />
                  <span className="text-pretty">{x}</span>
                </li>
              ))}
            </ul>
          </dd>
          {p.exc?.length > 0 && (
            <>
              <dt className="pt-0.5 font-display text-[0.7rem] font-bold tracking-[0.18em] text-slate-500 uppercase">Not incl.</dt>
              <dd className="text-[0.88rem] leading-relaxed text-slate-500 text-pretty">{p.exc.join('; ')}.</dd>
            </>
          )}
          {visa && (
            <>
              <dt className="pt-0.5 font-display text-[0.7rem] font-bold tracking-[0.18em] text-slate-500 uppercase">
                {visa.ctx ? 'Visa' : 'More'}
              </dt>
              <dd>
                <Link to={visa.to} className="font-semibold text-brand-500 underline decoration-brand-500/30 underline-offset-4 hover:decoration-brand-500">
                  {visa.text}<span className="sr-only">{visa.ctx}</span>
                </Link>
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Tear-off stub — fixed height so the notches always sit on the perforation */}
      <div
        style={{ height: STUB }}
        className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-dashed border-slate-300 px-6"
      >
        <span className="leading-tight">
          <span className="block font-display text-[0.68rem] font-bold tracking-[0.2em] text-slate-500 uppercase">Tier</span>
          <span className="block font-display text-[0.98rem] font-extrabold text-ink">{tier}</span>
          <span className="block text-[0.78rem] text-slate-500">twin sharing</span>
        </span>
        <a
          href={waLink(msg)}
          target="_blank" rel="noopener noreferrer"
          aria-label={`Enquire on WhatsApp for today's quote: ${p.name}, ${tier} tier`}
          className="btn btn-wa !gap-2 !px-4 !py-2.5 !text-[0.95rem]"
        >
          <MessageCircle size={16} aria-hidden="true" /> Get today’s quote
        </a>
      </div>
    </motion.article>
  )
}

export default function Packages() {
  const [filter, setFilter] = useState('all')
  const [tier, setTier] = useState('Deluxe')

  const all = usePackages()
  const list = useMemo(
    () => (filter === 'all' ? all : all.filter((p) => p.cats.includes(filter))),
    [filter, all]
  )

  // Cards move when the filter or tier changes; re-measure scroll triggers
  // (the stamps) once the layout animation has settled.
  useEffect(() => {
    const id = setTimeout(() => ScrollTrigger.refresh(), 900)
    return () => clearTimeout(id)
  }, [filter, tier])

  return (
    <MotionConfig reducedMotion="user">
      <style>{TICKET_CSS}</style>

      <PageHero
        img="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=74"
        alt="Tropical beach at sunset"
        eyebrow="Tour packages"
        title="Tour packages from Bengaluru, each in three comfort levels"
        sub="Same itinerary, your choice of hotels and inclusions. Pick one below and send it to us on WhatsApp for today’s quote."
      />

      {/* ---- Tier selector ---- */}
      <section aria-label="Economy, Deluxe or Premium" className="bg-white pt-14 pb-10 md:pt-20">
        <div className="wrap grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-14">
          <SectionHeading
            className="!mb-0"
            eyebrow="First, choose your comfort"
            title="Economy, Deluxe or Premium"
            sub="Switch tier and every package below shows that hotel category and those inclusions."
          />

          <LayoutGroup id="tiers">
            <div role="group" aria-label="Choose a tier" className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {TIERS.map((t, i) => {
                const M = TIER_META[t]
                const active = tier === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={active}
                    className={`relative isolate rounded-xl border-[1.5px] p-3.5 text-left transition-[border-color] duration-300 sm:p-5 ${
                      active ? 'border-navy-950' : 'border-slate-300 bg-white hover:border-navy-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="tier-slab"
                        aria-hidden="true"
                        transition={SPRING}
                        className="absolute -inset-[1.5px] -z-10 rounded-xl bg-navy-950"
                      />
                    )}
                    <span className="mb-3 flex items-center justify-between">
                      <M.icon size={18} strokeWidth={2} aria-hidden="true" className={active ? 'text-gold-400' : 'text-brand-500'} />
                      {/* Comfort meter: one, two or three bars */}
                      <span aria-hidden="true" className="flex items-end gap-[3px]">
                        {[0, 1, 2].map((b) => (
                          <motion.span
                            key={b}
                            initial={false}
                            animate={{ scaleY: b <= i ? 1 : 0.45, opacity: b <= i ? 1 : 0.35 }}
                            transition={{ duration: 0.5, delay: active ? b * 0.08 : 0, ease: EASE }}
                            style={{ height: 8 + b * 5 }}
                            className={`block w-1 origin-bottom rounded-full ${
                              b <= i ? (active ? 'bg-gold-400' : 'bg-brand-500') : active ? 'bg-white/40' : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </span>
                    </span>
                    <span className={`block font-display text-[1.02rem] font-extrabold sm:text-[1.2rem] ${active ? 'text-white' : 'text-ink'}`}>
                      {t}
                    </span>
                    <span className={`mt-1 hidden text-[0.93rem] leading-snug text-pretty sm:block ${active ? 'text-white/75' : 'text-body'}`}>
                      {M.blurb}
                    </span>
                  </button>
                )
              })}
            </div>
          </LayoutGroup>
          {/* On phones the blurb sits under the row instead of inside each button */}
          <p aria-live="polite" className="note -mt-4 text-[1.1rem] text-navy-900/80 sm:hidden">
            {TIER_META[tier].blurb}
          </p>
        </div>
      </section>

      {/* ---- Filters + ticket grid ---- */}
      <section aria-labelledby="list-title" className="section paper overflow-x-clip bg-sand pt-12">
        <div className="wrap">
          <h2 id="list-title" className="sr-only">Holiday and Umrah packages from Bengaluru</h2>
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <LayoutGroup id="filters">
              <div role="group" aria-label="Filter packages" className="flex flex-wrap gap-2">
                {FILTERS.map((f) => {
                  const on = filter === f.k
                  return (
                    <button
                      key={f.k}
                      type="button"
                      onClick={() => setFilter(f.k)}
                      aria-pressed={on}
                      className={`relative isolate rounded-lg border-[1.5px] px-4 py-2 font-display text-[0.95rem] font-bold transition-colors duration-300 ${
                        on ? 'border-navy-950 text-white' : 'border-slate-300 bg-white text-body hover:border-navy-900 hover:text-ink'
                      }`}
                    >
                      {on && (
                        <motion.span
                          layoutId="filter-pill"
                          aria-hidden="true"
                          transition={SPRING}
                          className="absolute -inset-[1.5px] -z-10 rounded-lg bg-navy-950"
                        />
                      )}
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </LayoutGroup>

            <p aria-live="polite" className="flex flex-wrap items-center gap-x-1.5 text-[0.98rem] text-slate-600">
              Showing
              <motion.span
                key={`n-${list.length}-${filter}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="font-display font-extrabold text-ink"
              >
                {list.length}
              </motion.span>
              {list.length === 1 ? 'package' : 'packages'} in
              <span className="relative inline-grid overflow-hidden align-bottom">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={tier}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="font-display font-extrabold text-gold-600"
                  >
                    {tier}
                  </motion.span>
                </AnimatePresence>
              </span>
            </p>
          </div>

          <motion.div layout className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map((p, i) => (
                <PackageCard key={`${p.id}-${tier}`} p={p} tier={tier} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>

          {!list.length && (
            <p className="py-16 text-center">
              Nothing in this category yet, but we plan tailor-made trips too.{' '}
              <a href={waLink()} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-500 underline underline-offset-4">
                Tell us what you have in mind.
              </a>
            </p>
          )}
        </div>
      </section>

      {/* ---- Always included ---- */}
      <section aria-label="What’s always included" className="section overflow-x-clip bg-white">
        <div className="wrap grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="relative">
            <SectionHeading
              eyebrow="On every package"
              title="What’s always included"
              sub="Whichever tier you pick, these four come with it."
            />
            <div className="relative mx-auto max-w-xs sm:mx-0 sm:ml-6">
              <Parallax speed={-0.12}>
                <div>
                  <Polaroid
                    src="https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=72"
                    alt="Houseboat on the Alleppey backwaters, Kerala"
                    caption="Alleppey backwaters, Kerala"
                    rotate={-4}
                  />
                </div>
              </Parallax>
              <Stamp
                top="Hotel voucher"
                main="Confirmed"
                bottom="before you fly"
                tone="palm"
                rotate={9}
                className="absolute -top-8 -right-2 sm:-right-10"
              />
            </div>
          </div>

          <ol className="self-center">
            {INCLUDED.map(([t, d], i) => (
              <li key={t} className="border-t border-slate-200 py-7 first:border-t-0 first:pt-0 last:pb-0">
                <Reveal delay={i * 0.06} className="flex gap-5">
                  <DrawCheck delay={0.15 + i * 0.1} />
                  <div>
                    <span className="note text-[1.05rem] text-gold-600">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="mt-0.5 text-[1.3rem]">{t}</h3>
                    <p className="mt-1.5 text-[1.04rem] text-pretty">{d}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Somewhere else ---- */}
      <section aria-labelledby="custom-title" className="section paper bg-sand">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
            <Reveal>
              <h2 id="custom-title" className="h-sec text-balance">
                Somewhere{' '}
                <CircleMark color="#b4532a">not on this list?</CircleMark>
              </h2>
              <p className="mt-6 max-w-xl text-[1.12rem] text-pretty">
                The packages above are a starting point, not the full list. Tell us where, when
                and who is travelling, and we’ll plan the trip around that. See how{' '}
                <Link to="/services#tailor" className="font-semibold text-brand-500 underline decoration-brand-500/30 underline-offset-4 hover:decoration-brand-500">
                  tailor-made trips
                </Link>{' '}
                work, or{' '}
                <Link to="/visa" className="font-semibold text-brand-500 underline decoration-brand-500/30 underline-offset-4 hover:decoration-brand-500">
                  check visa requirements
                </Link>{' '}
                first.
              </p>
              <p className="mt-4 max-w-xl text-[1rem] text-slate-600 text-pretty">
                Every package here is planned and booked by {BIZ.name}, an IATA-accredited travel agency at
                A.M. Plaza, Hospital Road, Shivaji Nagar, Bengaluru, trading since {BIZ.since}.{' '}
                <Link to="/contact" className="font-semibold text-brand-500 underline decoration-brand-500/30 underline-offset-4 hover:decoration-brand-500">
                  Visit or call our office
                </Link>.
              </p>
            </Reveal>
            <Reveal delay={0.12} className="relative md:pb-2">
              <ArrowDoodle className="absolute -top-16 left-6 hidden h-16 w-24 text-clay md:block" />
              <a
                href={waLink('Hello Pro Tours & Travel Solutions, I would like a tailor-made trip. Destination: \nDates: \nTravellers: ')}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-wa"
              >
                <MessageCircle size={18} aria-hidden="true" /> Tell us on WhatsApp
              </a>
            </Reveal>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
