import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, MapPin, Plane, MessageCircle } from 'lucide-react'

import { BIZ, HERO_SLIDES, SERVICES, DESTINATIONS, REVIEWS, FACTS, FAQS, PHOTOS, waLink } from '../data/site.js'
import { usePackages } from '../lib/content.js'
import { Reveal, SectionHeading, SplitHeading, Stars, Accordion } from '../components/ui.jsx'
import { Parallax } from '../components/motion.jsx'
import {
  ImageReveal, Marquee, FlightPath, WordRotator, ScrubText, DrawLine,
  CircleMark, ArrowDoodle, Stamp, Polaroid, introDone,
} from '../components/fx.jsx'
import { gsap, useGSAP, SplitText, ScrollTrigger, EASE_EXPO, reduceMotion, enterTrigger } from '../lib/gsap.js'
import EnquiryForm from '../components/EnquiryForm.jsx'
import { photo } from '../lib/img.js'

const serviceLink = (id) =>
  id === 'umrah' ? '/umrah' : id === 'passport' ? '/visa#passport' : id === 'visa' ? '/visa' : `/services#${id}`

const HELLO = `Hello ${BIZ.name},`

/* Alt text describing what each photograph actually shows (keyed by the
   Unsplash photo id), so screen readers and image search get the scene,
   not just a place name. Falls back to the data file's own label. */
const ALT = {
  '1506905925346': 'Snow-capped mountain peaks rising above a sea of clouds at sunrise',
  '1512453979798': 'Dubai skyline with the Burj Khalifa at dusk',
  '1507525428034': 'Turquoise water rolling onto a sandy tropical beach at sunset',
  '1580418827493': 'The clock towers above Masjid al-Haram in Makkah',
  '1544551763': 'Scuba diver among a shoal of yellow fish on a Maldives reef',
  '1537996194471': 'Ulun Danu Beratan water temple on Lake Bratan, Bali',
  '1525625293386': 'Marina Bay Sands and the ArtScience Museum, Singapore',
  '1476514525535': 'Wooden rowing boat on an alpine lake beneath the mountains in Europe',
  '1528181304800': 'Gilded Buddhist temple spires against a blue sky in Thailand',
  '1602216056096': 'Houseboat on the palm-lined Kerala backwaters',
  '1591604129939': 'Masjid an-Nabawi with its green dome, Madinah',
  '1518684079': 'Aerial view of the Burj Al Arab on the Dubai coast',
  '1590523741831': 'Palm trees leaning over a white-sand beach in the Maldives',
}
const altFor = (url, fallback) => ALT[url?.match(/photo-(\d+)/)?.[1]] ?? fallback

/* Responsive sources, computed once at module load rather than per render. */
const HERO_SRC = HERO_SLIDES.map((s) => photo(s.img, { sizes: '100vw', widths: [768, 1080, 1440, 1920, 2560] }))
const SERVICE_FRAME = SERVICES.map((s) => photo(s.img, { sizes: '(min-width: 1280px) 460px, 36vw', widths: [480, 768, 1080] }))
const SERVICE_THUMB = SERVICES.map((s) => photo(s.img, { sizes: '48px', widths: [96, 160] }))
const DEST_SRC = DESTINATIONS.map((d) => photo(d.img, { sizes: '(min-width: 1024px) 23vw, 46vw', widths: [320, 480, 768] }))
const CTA_BG = photo('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70', {
  sizes: '(min-width: 1280px) 1240px, 100vw', widths: [768, 1080, 1440, 1920],
})

/* "Monday – Saturday: 10:00 AM – 8:00 PM" → reads as part of a sentence. */
const HOURS = BIZ.hours.replace(/^Monday – Saturday:\s*/, 'Monday to Saturday, ').replace(' – ', ' to ')

/* ============================================================
   Ticket edges — concave corners cut with radial-gradient masks.
   Two ticket pieces placed edge to edge form the half-moon notches
   of a real perforation. Masks clip box-shadow, so the drop shadow
   goes on the parent as a CSS filter instead.
   ============================================================ */
const notched = (r = 13) => {
  const c = (at, pos) => `radial-gradient(circle ${r}px at ${at}, #0000 97%, #000) ${pos} / 51% 51% no-repeat`
  const m = [c('0 0', 'top left'), c('100% 0', 'top right'), c('0 100%', 'bottom left'), c('100% 100%', 'bottom right')].join(',')
  return { WebkitMask: m, mask: m }
}
const TICKET_SHADOW = 'drop-shadow-[0_16px_22px_rgb(60_40_20/0.16)]'

/* ============================================================
   ClipGrow — a panel opens out of an inset clip window on enter.
   ============================================================ */
function ClipGrow({ children, className = '' }) {
  const ref = useRef(null)
  useGSAP(() => {
    const el = ref.current
    if (!el || reduceMotion()) return
    gsap.fromTo(
      el,
      { clipPath: 'inset(8% 6% 8% 6% round 28px)' },
      {
        clipPath: 'inset(0% 0% 0% 0% round 28px)',
        duration: 1.4,
        ease: EASE_EXPO,
        scrollTrigger: enterTrigger(el, { start: 'top 88%' }),
        onComplete: () => gsap.set(el, { clearProps: 'clipPath' }),
      }
    )
  }, { scope: ref })
  return <div ref={ref} className={className}>{children}</div>
}

/* ============================================================
   HERO — full-bleed photography, editorial type bottom-left,
   a rubber stamp and a photo caption instead of glass panels.
   ============================================================ */
function Hero() {
  const [i, setI] = useState(0)
  const root = useRef(null)
  const slidesRef = useRef([])
  const contentRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % HERO_SLIDES.length), 6500)
    return () => clearInterval(t)
  }, [])

  /* Crossfade + slow push-in on the active slide. */
  useGSAP(() => {
    const slides = slidesRef.current.filter(Boolean)
    if (!slides.length) return
    slides.forEach((el, k) => {
      const active = k === i
      gsap.to(el, { autoAlpha: active ? 1 : 0, duration: reduceMotion() ? 0 : 1.5, ease: 'power2.inOut', overwrite: 'auto' })
      if (active && !reduceMotion()) {
        gsap.fromTo(el, { scale: 1.14 }, { scale: 1.02, duration: 7.5, ease: 'none', overwrite: 'auto' })
      }
    })
  }, { dependencies: [i] })

  /* Intro — waits for fonts and the preloader curtain. Every step is a
     fromTo, so an interrupted tween still ends visible. */
  useGSAP(() => {
    const el = root.current
    if (!el) return
    const all = el.querySelectorAll(
      '[data-hero-badge],[data-hero-title],[data-hero-rotator],[data-hero-copy],[data-hero-btn],[data-hero-stamp],[data-hero-caption]'
    )
    if (reduceMotion()) { gsap.set(all, { autoAlpha: 1 }); return }

    let split
    let cancelled = false
    const q = gsap.utils.selector(el)

    const run = () => {
      if (cancelled) return
      const heading = q('[data-hero-title]')[0]
      split = SplitText.create(heading, { type: 'words,lines', mask: 'lines', linesClass: 'split-line' })
      gsap.set(heading, { autoAlpha: 1 })

      const tl = gsap.timeline({ defaults: { ease: EASE_EXPO } })
      tl.fromTo(q('[data-hero-badge]'), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 })
        .fromTo(split.words, { yPercent: 118, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.15, stagger: 0.045 }, '-=0.55')
        .fromTo(q('[data-hero-rotator]'), { x: -20, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9 }, '-=0.8')
        .fromTo(q('[data-hero-copy]'), { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, '-=0.75')
        .fromTo(q('[data-hero-btn]'), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, '-=0.6')
        .fromTo(q('[data-hero-caption]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, '-=0.5')
        // The stamp lands last, with a thud.
        .fromTo(q('[data-hero-stamp]'), { autoAlpha: 0, scale: 1.7, rotation: -12 },
          { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)' }, '-=0.35')
    }

    const bail = setTimeout(() => { if (!split) gsap.set(all, { autoAlpha: 1 }) }, 5000)
    Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      Promise.race([introDone, new Promise((r) => setTimeout(r, 3600))]),
    ]).then(run, run)

    return () => { cancelled = true; clearTimeout(bail); split?.revert() }
  }, { scope: root })

  /* Copy drifts up and dissolves as the hero scrolls away. */
  useGSAP(() => {
    if (!contentRef.current || reduceMotion()) return
    gsap.to(contentRef.current, {
      yPercent: -18, autoAlpha: 0, ease: 'none',
      scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom 35%', scrub: true },
    })
  }, { scope: root })

  return (
    /* -mt pulls the hero under the sticky nav so the bar floats over the photo. */
    <section ref={root} aria-labelledby="home-title" className="relative isolate -mt-[74px] flex min-h-[100svh] items-end overflow-hidden">
      {HERO_SLIDES.map((s, k) => (
        <img
          key={s.img}
          ref={(el) => { slidesRef.current[k] = el }}
          {...HERO_SRC[k]}
          alt={altFor(s.img, s.alt)}
          width={1920}
          height={1280}
          fetchPriority={k === 0 ? 'high' : 'low'}
          loading={k === 0 ? 'eager' : 'lazy'}
          decoding={k === 0 ? 'auto' : 'async'}
          style={{ opacity: k === 0 ? 1 : 0 }}
          className="absolute inset-0 -z-20 h-full w-full object-cover will-change-transform"
        />
      ))}
      {/* One quiet scrim for legibility — darkest where the type sits */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/85 via-navy-950/35 to-navy-950/40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/50 via-navy-950/10 to-transparent" />

      {/* Accreditation, as a rubber stamp on the photograph */}
      <div data-hero-stamp aria-hidden="true" className="js-hide absolute top-[21%] right-[6%] z-10 hidden xl:block">
        <div className="-rotate-[9deg] inline-flex flex-col items-center rounded-lg border-[2.5px] border-white/75 px-4 py-2 text-center text-white/85">
          <span className="rounded-md border border-current px-4 py-2">
            <span className="block font-display text-[0.62rem] font-extrabold tracking-[0.3em] uppercase">Accredited</span>
            <span className="block font-display text-[1.6rem] leading-tight font-black tracking-[0.12em]">IATA</span>
            <span className="block font-display text-[0.62rem] font-extrabold tracking-[0.3em] uppercase">Travel agent</span>
          </span>
        </div>
      </div>

      <div ref={contentRef} className="wrap relative z-10 pt-32 pb-24 md:pb-36">
        <div className="max-w-[52rem]">
          <p data-hero-badge className="js-hide eyebrow eyebrow-light !text-[1.2rem]">
            Hospital Road, Bengaluru · since {BIZ.since}
          </p>

          <h1 id="home-title" data-hero-title className="js-hide h-hero mt-6 !text-[clamp(2.35rem,6.2vw,4.6rem)] !text-white text-balance">
            One stop travel solutions for{' '}
            <span className="accent text-gold-400">all your travel needs</span>
          </h1>

          {/* Outside the h1 — SplitText would break a nested rotator */}
          <p data-hero-rotator className="js-hide mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-white/75">
            <span className="font-display text-[0.8rem] font-bold tracking-[0.2em] uppercase">Next stop</span>
            <WordRotator
              words={['Dubai', 'Bali', 'Makkah', 'Maldives', 'Europe', 'Singapore']}
              className="accent text-[1.9rem] leading-none text-gold-400 sm:text-[2.2rem]"
            />
          </p>

          <p data-hero-copy className="js-hide mt-6 max-w-[38rem] text-[1.2rem] text-white/80 text-pretty">
            An IATA-accredited travel agency in Bengaluru for flights, hotels, holidays and Umrah, and a consultant for visas,
            passports and travel insurance. Planned and booked by people you can call, message, or walk in and meet.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a
              href={waLink(`${HELLO} I'd like help planning a trip.\nDestination:\nDates:\nTravellers:`)}
              target="_blank" rel="noopener noreferrer"
              data-hero-btn className="js-hide btn btn-gold"
            >
              <MessageCircle size={18} /> Plan my trip on WhatsApp
            </a>
            <Link to="/packages" data-hero-btn className="js-hide link-grow inline-flex items-center gap-2 font-display text-[1.05rem] font-bold text-white">
              Browse tour packages <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Photo caption + slide control, like a credit line in a magazine */}
      <div data-hero-caption className="js-hide absolute right-5 bottom-24 z-10 hidden items-center gap-5 sm:right-7 sm:flex md:bottom-44">
        <p className="note text-right text-[1.1rem] text-white/80" aria-live="polite">
          <span className="mr-2 font-display text-[0.75rem] font-bold tracking-[0.18em] text-white/55 not-italic">
            {String(i + 1).padStart(2, '0')} / {String(HERO_SLIDES.length).padStart(2, '0')}
          </span>
          {HERO_SLIDES[i].alt}
        </p>
        <div className="flex gap-1.5">
          {HERO_SLIDES.map((s, k) => (
            <button
              key={s.img}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Show photo ${k + 1}: ${s.alt}`}
              aria-pressed={k === i}
              className="grid h-6 place-items-center px-0.5"
            >
              <span className={`block h-[2px] rounded-full transition-all duration-500 ${k === i ? 'w-7 bg-gold-400' : 'w-3.5 bg-white/45'}`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   QUICK ENQUIRY — a two-part ticket overlapping the hero:
   a navy stub and the form, joined by a perforation.
   ============================================================ */
function QuickEnquiry() {
  const ref = useRef(null)

  /* The stub is "torn off" and handed over: it slides in a beat
     after the ticket, with a small twist. */
  useGSAP(() => {
    const el = ref.current
    if (!el || reduceMotion()) return
    const q = gsap.utils.selector(el)
    const tl = gsap.timeline({ scrollTrigger: enterTrigger(el, { start: 'top 95%' }) })
    tl.fromTo(q('[data-ticket]'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: EASE_EXPO })
      .fromTo(q('[data-stub]'), { x: -24, rotation: -2.5 }, { x: 0, rotation: 0, duration: 0.9, ease: 'back.out(1.6)' }, '-=0.7')
  }, { scope: ref })

  return (
    <section ref={ref} aria-labelledby="enquiry-title" className="relative z-20 -mt-16">
      <div className="wrap">
        <div data-ticket className={`grid lg:grid-cols-[17.5rem_1fr] ${TICKET_SHADOW}`}>
          <div
            data-stub
            style={notched()}
            className="relative border-b-2 border-dashed border-white/25 bg-navy-950 px-7 py-6 text-white lg:border-r-2 lg:border-b-0 lg:py-8"
          >
            <span id="enquiry-title" className="font-display text-[0.72rem] font-bold tracking-[0.24em] text-white/60 uppercase">Trip enquiry</span>
            <div className="mt-2 flex items-center gap-3 font-display text-[2.1rem] leading-none font-black tracking-tight">
              BLR
              <Plane size={20} aria-hidden="true" className="rotate-45 text-gold-400" />
              <span className="accent text-[1.9rem] font-semibold text-gold-400">anywhere</span>
            </div>
            <p className="mt-3 text-[0.97rem] leading-relaxed text-white/70">
              Quotes are free. Your details open in WhatsApp, ready to send.
            </p>
          </div>
          <div style={notched()} className="bg-white px-6 py-6 sm:px-8 lg:py-8">
            <EnquiryForm layout="bar" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   DESTINATION STRIP — the page's one marquee: a quiet line of
   place names, set like a caption, between two hairlines.
   ============================================================ */
const TICKER = ['Dubai', 'Maldives', 'Bali', 'Singapore', 'Europe', 'Thailand', 'Kerala', 'Makkah', 'Madinah', 'Kashmir']

function DestinationStrip() {
  return (
    <section aria-label="Places we book trips to" className="mt-14 border-y border-slate-200 py-4 md:mt-20 md:py-5">
      <Marquee speed={70}>
        {TICKER.map((d) => (
          <span key={d} className="flex shrink-0 items-center gap-8 px-8 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-none">
            <span className="accent text-navy-900">{d}</span>
            <Plane size={14} aria-hidden="true" className="rotate-45 text-gold-600" />
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ============================================================
   SERVICES — an editorial numbered index. On desktop, hovering a
   row wipes its photo into a sticky frame beside the list.
   ============================================================ */
function ServicesSection() {
  const [active, setActive] = useState(0)
  const list = useRef(null)

  /* Rules draw across and rows settle in, a batch at a time. */
  useGSAP(() => {
    const el = list.current
    if (!el || reduceMotion()) return
    const rows = gsap.utils.toArray('[data-row]', el)
    rows.forEach((r) => {
      gsap.set(r.querySelector('[data-rule]'), { scaleX: 0 })
      gsap.set(r.querySelector('[data-body]'), { autoAlpha: 0, y: 18 })
    })
    ScrollTrigger.batch(rows, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => {
        gsap.to(batch.map((r) => r.querySelector('[data-rule]')), { scaleX: 1, duration: 1.1, ease: 'power3.inOut', stagger: 0.08 })
        gsap.to(batch.map((r) => r.querySelector('[data-body]')), { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE_EXPO, stagger: 0.08, delay: 0.15 })
      },
    })
  }, { scope: list })

  return (
    <section id="services" aria-labelledby="services-title" className="section scroll-mt-20">
      <div className="wrap grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <div className="lg:sticky lg:top-28">
            <Reveal><span className="eyebrow">What we do</span></Reveal>
            <Reveal delay={0.06}>
              <h2 id="services-title" className="h-sec mt-4 text-balance">
                Everything a trip needs, handled at <CircleMark className="ml-[0.18em]">one desk</CircleMark>
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 max-w-md text-[1.12rem] text-pretty">
                Flight booking, hotels, tour packages, visa and passport consultancy, and Umrah: seven
                services that cover a journey from the first enquiry to the day you land back in Bengaluru.
              </p>
            </Reveal>

            {/* Sticky photo frame (desktop) */}
            <ClipGrow className="relative mt-9 hidden aspect-[4/3.2] overflow-hidden rounded-3xl lg:block">
              <div aria-hidden="true" className="absolute inset-0">
                {SERVICES.map((s, k) => (
                  <img
                    key={s.id}
                    {...SERVICE_FRAME[k]}
                    alt=""
                    width={1080}
                    height={864}
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-[clip-path,scale] ease-[var(--ease-out-expo)] ${
                      k === active
                        ? 'z-10 scale-100 [clip-path:inset(0_0_0_0)] duration-[900ms]'
                        : 'z-0 scale-[1.08] [clip-path:inset(100%_0_0_0)] delay-[900ms] duration-0'
                    }`}
                  />
                ))}
              </div>
              <p className="note absolute bottom-0 left-0 z-20 rounded-tr-2xl bg-white px-4 py-2 text-[1.1rem] text-navy-900">
                {SERVICES[active].title}
              </p>
            </ClipGrow>
          </div>
        </div>

        <div>
          <ol ref={list} className="border-b border-slate-200">
            {SERVICES.map((s, k) => {
              const lead = k < 2
              return (
                <li key={s.id} data-row className="relative">
                  <span data-rule aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left bg-slate-300" />
                  <Link
                    to={serviceLink(s.id)}
                    onMouseEnter={() => setActive(k)}
                    onFocus={() => setActive(k)}
                    className={`group grid grid-cols-[auto_1fr_auto] items-start gap-x-5 ${lead ? 'py-7' : 'py-5'}`}
                  >
                    <span data-body className="accent pt-1 text-[1.25rem] leading-none text-gold-600">
                      {String(k + 1).padStart(2, '0')}
                    </span>
                    <div data-body className="min-w-0">
                      <div className="flex items-center gap-4">
                        <img {...SERVICE_THUMB[k]} alt="" aria-hidden="true" width={48} height={48} loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-lg object-cover lg:hidden" />
                        <div className="min-w-0">
                          <h3 className={`transition-colors group-hover:text-brand-500 ${lead ? 'text-[clamp(1.45rem,2.4vw,1.9rem)]' : 'text-[1.28rem]'}`}>
                            {s.title}
                          </h3>
                          <p className="mt-0.5 text-[0.98rem] text-slate-500">{s.short}</p>
                        </div>
                      </div>
                      {lead && <p className="mt-3 max-w-xl text-[1.04rem] text-pretty">{s.desc}</p>}
                    </div>
                    <ArrowUpRight
                      data-body
                      size={20}
                      aria-hidden="true"
                      className="mt-1.5 text-slate-400 transition-[translate,color] duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-brand-500"
                    />
                  </Link>
                </li>
              )
            })}
          </ol>

          <Reveal>
            <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-sm text-[1.04rem] text-pretty">
                <span className="note text-[1.2rem] text-ink">Not sure which one you need?</span>{' '}
                Describe the trip and we will tell you what it takes.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href={waLink(`${HELLO} I'm not sure which service I need. Here's my trip:`)}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-wa !py-3 !text-[1rem]"
                >
                  <MessageCircle size={17} /> Describe my trip
                </a>
                <Link to="/services" className="link-grow font-display text-[1rem] font-bold text-ink">All services<span className="sr-only"> we offer</span></Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   DESTINATIONS — postcards pinned at slight angles, not a grid
   of identical tiles. Alternate columns drift on desktop.
   ============================================================ */
const TILT = [-2.2, 1.6, -1.2, 2.4, 1.4, -1.8, 2, -1.4]
const SHAPE = ['aspect-[4/5]', 'aspect-[1/1]', 'aspect-[1/1]', 'aspect-[4/5]']

function DestinationsSection() {
  const grid = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray('[data-drift]', grid.current).forEach((el) => {
        gsap.fromTo(el, { y: 40 }, {
          y: -40, ease: 'none',
          scrollTrigger: { trigger: grid.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
        })
      })
    })
    return () => mm.revert()
  }, { scope: grid })

  return (
    <section aria-label="Popular destinations from Bengaluru" className="section paper relative overflow-hidden bg-sand">
      <div className="wrap">
        <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow="Where our travellers go" title="Popular destinations from Bengaluru" className="!mb-0" />
          <div className="relative flex items-end gap-2 md:max-w-[17rem] md:pb-2">
            <ArrowDoodle className="hidden h-12 w-20 shrink-0 -scale-y-100 text-gold-600 md:block" flip />
            <p className="note text-[1.2rem] leading-snug text-navy-900/80">
              Visa-friendly, and the trips we book most often from Bengaluru.
            </p>
          </div>
        </div>

        <div ref={grid} className="grid grid-cols-2 items-start gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-12">
          {DESTINATIONS.map((d, k) => (
            <div key={d.name} data-drift={k % 2 === 1 ? '' : undefined} className={k % 2 === 1 ? 'mt-8 lg:mt-14' : ''}>
              <Link
                to={d.name.startsWith('Makkah') ? '/umrah' : '/packages'}
                style={{ '--r': `${TILT[k]}deg` }}
                className="group block bg-white p-2 pb-3 shadow-[0_18px_30px_-20px_rgb(60_40_20/0.55),0_1px_3px_rgb(60_40_20/0.15)] transition-[rotate] duration-500 ease-[var(--ease-out-expo)] [rotate:var(--r)] hover:[rotate:0deg] sm:p-2.5 sm:pb-4"
              >
                <ImageReveal from={k % 2 ? 'top' : 'bottom'} delay={(k % 4) * 0.08} className={SHAPE[k % 4]}>
                  <img
                    {...DEST_SRC[k]}
                    alt={altFor(d.img, d.name)}
                    width={768}
                    height={k % 4 === 0 || k % 4 === 3 ? 960 : 768}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-out-expo)] group-hover:scale-105"
                  />
                </ImageReveal>
                <div className="flex items-start justify-between gap-2 px-1 pt-3">
                  <div className="min-w-0">
                    <h3 className="text-[1.02rem] leading-tight sm:text-[1.15rem]">{d.name}</h3>
                    <span className="mt-1 flex items-center gap-1 text-[0.8rem] text-slate-500 sm:text-[0.86rem]">
                      <MapPin size={12} aria-hidden="true" className="shrink-0" /> <span className="truncate">{d.country}</span>
                    </span>
                  </div>
                  <span className="hidden shrink-0 rounded border border-dashed border-slate-300 px-1.5 py-0.5 font-display text-[0.72rem] font-bold text-navy-900 sm:inline-block">
                    {d.nights}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>

        <Reveal>
          <div className="mt-14 flex justify-start md:mt-20 md:justify-center">
            <Link to="/packages" className="btn btn-brand">See packages for these <ArrowRight size={16} /></Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================
   FEATURED PACKAGES — boarding passes. One wide pass, then two
   upright ones; each stub is handed over as it enters.
   ============================================================ */
function PassField({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-[0.68rem] font-bold tracking-[0.2em] text-slate-500 uppercase">{label}</div>
      <div className="mt-0.5 font-display text-[1rem] font-bold text-ink">{children}</div>
    </div>
  )
}

function BoardingPass({ p, wide = false, index = 0, stamp }) {
  const ask = waLink(`${HELLO} I'd like details of the "${p.name}" package (${p.nights}).`)
  return (
    <article data-pass className={`grid h-full ${wide ? 'md:grid-cols-[1.35fr_1fr]' : 'grid-rows-[auto_1fr]'} ${TICKET_SHADOW}`}>
      <div style={notched()} className={`relative overflow-hidden ${wide ? 'min-h-[260px] md:min-h-[400px]' : 'aspect-[16/10]'}`}>
        <ImageReveal from={wide ? 'left' : 'bottom'} delay={index * 0.1} className="absolute inset-0">
          <img
            {...photo(p.img, {
              sizes: wide ? '(min-width: 768px) 55vw, 100vw' : '(min-width: 768px) 46vw, 100vw',
              widths: [480, 768, 1080, 1440],
            })}
            alt={altFor(p.img, p.name)}
            width={1080}
            height={675}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </ImageReveal>
        <span className="absolute top-4 left-4 rounded bg-white px-2.5 py-1 font-display text-[0.72rem] font-extrabold tracking-[0.1em] text-navy-900 uppercase">
          {p.badge}
        </span>
        {stamp}
      </div>

      <div
        data-stub
        style={notched()}
        className={`relative flex flex-col bg-white p-6 sm:p-7 ${wide ? 'border-t-2 border-dashed border-slate-200 md:border-t-0 md:border-l-2' : 'border-t-2 border-dashed border-slate-200'}`}
      >
        <div className="flex items-center gap-3 font-display text-[0.72rem] font-bold tracking-[0.2em] text-slate-500 uppercase">
          <span>Bengaluru</span>
          <span aria-hidden="true" className="relative h-px flex-1 bg-slate-300">
            <Plane size={13} className="absolute -top-[6px] left-1/2 -translate-x-1/2 rotate-45 bg-white text-gold-600" />
          </span>
          <span className="truncate">{p.region}</span>
        </div>

        <h3 className={`mt-4 text-balance ${wide ? 'text-[clamp(1.5rem,2.4vw,2rem)]' : 'text-[1.3rem]'}`}>{p.name}</h3>
        <p className="mt-2.5 text-[1.02rem] text-pretty">{p.desc}</p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <PassField label="Duration">{p.nights}</PassField>
          <PassField label="Class">Economy · Deluxe · Premium</PassField>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          <a href={ask} target="_blank" rel="noopener noreferrer" className="link-grow inline-flex items-center gap-2 font-display text-[1rem] font-bold text-palm">
            <MessageCircle size={16} /> Ask about this trip<span className="sr-only">: {p.name}</span>
          </a>
        </div>

      </div>
    </article>
  )
}

function PackagesSection() {
  const ref = useRef(null)
  const all = usePackages()
  const chosen = ['dubai', 'maldives', 'umrah-pkg'].map((id) => all.find((p) => p.id === id)).filter(Boolean)
  const [lead, ...rest] = chosen.length === 3 ? chosen : all.slice(0, 3) // a featured package was switched off or removed in the CRM: show the first three instead

  useGSAP(() => {
    const el = ref.current
    if (!el || reduceMotion()) return
    gsap.utils.toArray('[data-pass]', el).forEach((pass) => {
      const stub = pass.querySelector('[data-stub]')
      gsap.fromTo(stub, { y: 30, rotation: 1.8, autoAlpha: 0 }, {
        y: 0, rotation: 0, autoAlpha: 1, duration: 1, ease: EASE_EXPO, delay: 0.25,
        scrollTrigger: enterTrigger(pass, { start: 'top 85%' }),
      })
    })
  }, { scope: ref })

  return (
    <section ref={ref} aria-label="A few trips to start from" className="section">
      <div className="wrap">
        <div className="mb-10 grid gap-5 md:mb-14 md:grid-cols-[1fr_auto] md:items-end">
          <SectionHeading
            eyebrow="Handpicked holidays"
            title="A few trips to start from"
            sub="Tour packages from Bengaluru, each in Economy, Deluxe and Premium: same destination, your choice of comfort, on twin sharing."
            className="!mb-0"
          />
          <Reveal>
            <Link to="/packages" className="btn btn-ghost">View all packages <ArrowRight size={16} /></Link>
          </Reveal>
        </div>

        {lead && <BoardingPass p={lead} wide />}
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {rest.map((p, k) => (
            <BoardingPass
              key={p.id}
              p={p}
              index={k + 1}
              stamp={p.id === 'umrah-pkg' && (
                <div className="absolute top-4 right-4">
                  <Stamp top="Hajj &" main="Umrah" bottom="Division" tone="paper" rotate={-10} className="!mix-blend-normal" />
                </div>
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   REVIEWS — one review at a time, set as a pull-quote, with the
   names beside it like an index. No auto-scrolling rows.
   ============================================================ */
function ReviewsSection() {
  const [k, setK] = useState(0)
  const quote = useRef(null)
  const first = useRef(true)
  const r = REVIEWS[k]

  useGSAP(() => {
    if (first.current) { first.current = false; return }
    const el = quote.current
    if (!el || reduceMotion()) return
    gsap.fromTo(el.querySelectorAll('[data-q]'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE_EXPO, stagger: 0.06 })
  }, { dependencies: [k], scope: quote })

  return (
    <section aria-label="In our travellers' words" className="section paper overflow-hidden bg-sand">
      <div className="wrap">
        <div className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow="Client feedback" title="In our travellers' words" className="!mb-0" />
          <Reveal>
            <a href={BIZ.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-grow inline-flex items-center gap-1.5 font-display text-[1rem] font-bold text-brand-500">
              Read more reviews on Google <ArrowUpRight size={16} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Reveal>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.6fr] lg:gap-16">
          <figure ref={quote} aria-live="polite" className="relative lg:min-h-[21rem]">
            <span aria-hidden="true" className="accent absolute -top-10 -left-1 text-[7rem] leading-none text-gold-500 select-none sm:-left-4">“</span>
            <blockquote data-q className="quote relative pt-8 text-[clamp(1.4rem,2.3vw,1.95rem)] leading-[1.5] text-ink text-pretty">
              {r.text}
            </blockquote>
            <figcaption data-q className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 font-display text-[0.95rem] font-extrabold text-white">
                {r.initials}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.05rem] font-bold text-ink">{r.name}</span>
                <span className="block text-[0.9rem] text-slate-500">{r.place} · {r.when}</span>
              </span>
              <Stars n={r.stars} size={15} />
            </figcaption>
          </figure>

          <div>
            <p className="note mb-3 text-[1.15rem] text-navy-900/75">Read another</p>
            <ul className="border-t border-slate-300">
              {REVIEWS.map((rv, n) => (
                <li key={rv.name} className="border-b border-slate-300">
                  <button
                    type="button"
                    onClick={() => {
                      setK(n)
                      const top = quote.current?.getBoundingClientRect().top ?? 0
                      if (top < 80) quote.current.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" })
                    }}
                    aria-pressed={n === k}
                    className="group relative flex w-full items-baseline justify-between gap-4 py-3.5 pl-4 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 origin-center bg-gold-600 transition-transform duration-500 ${n === k ? 'scale-y-100' : 'scale-y-0'}`}
                    />
                    <span className={`font-display text-[1.02rem] font-bold transition-colors ${n === k ? 'text-ink' : 'text-slate-500 group-hover:text-ink'}`}>
                      {rv.name}
                    </span>
                    <span className="truncate text-[0.85rem] text-slate-500">{rv.place.split(',')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FROM OUR DESK — a short signed note with photo slots, and the
   four checkable facts laid along a hand-drawn route.
   Captions only claim "office"/"group" once real photos exist.
   ============================================================ */
function RouteLine() {
  const ref = useRef(null)
  useGSAP(() => {
    const p = ref.current?.querySelector('path[data-ink]')
    if (!p) return
    if (reduceMotion()) { gsap.set(p, { drawSVG: '100%' }); return }
    gsap.fromTo(p, { drawSVG: '0%' }, {
      drawSVG: '100%', duration: 1.8, ease: 'power2.inOut',
      scrollTrigger: enterTrigger(ref.current, { start: 'top 88%' }),
    })
  }, { scope: ref })
  return (
    <svg ref={ref} viewBox="0 0 1000 14" preserveAspectRatio="none" aria-hidden="true" fill="none" className="pointer-events-none absolute inset-x-0 top-0 hidden h-[14px] w-full lg:block">
      <path data-ink d="M6 7 C 120 13, 200 1, 300 7 S 480 13, 560 7 S 760 1, 820 7 S 950 12, 994 7" stroke="#cdbca4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function FromOurDesk() {
  const shot1 = PHOTOS.office
    ? { src: PHOTOS.office, alt: `${BIZ.name} office at A.M. Plaza, Hospital Road`, caption: 'Our office, A.M. Plaza' }
    : { src: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=700&q=72', alt: 'Houseboat on the Kerala backwaters', caption: 'Kerala' }
  const shot2 = PHOTOS.umrah
    ? { src: PHOTOS.umrah, alt: 'A Pro Tours Umrah group', caption: 'One of our Umrah groups' }
    : { src: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=700&q=72', alt: 'Masjid an-Nabawi, Madinah', caption: 'Makkah & Madinah' }

  return (
    <section aria-label="From our desk on Hospital Road" className="section overflow-hidden">
      <div className="wrap">
        <div className="grid items-start gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          {/* Two photos, pinned slightly overlapping */}
          <div className="relative mx-auto h-[25rem] w-full max-w-[26rem] sm:h-[30rem] lg:sticky lg:top-32 lg:mt-12 lg:max-w-none">
            <Polaroid {...shot1} rotate={-4} className="absolute top-0 left-0 w-[70%]" />
            <Parallax speed={0.35} className="absolute right-0 bottom-0 w-[60%]">
              <Polaroid {...shot2} rotate={5} />
            </Parallax>
          </div>

          <div className="relative bg-sand px-6 py-9 sm:px-10 sm:py-11">
            <span aria-hidden="true" className="absolute -top-3 left-10 h-6 w-24 -rotate-3 bg-paper/90 shadow-sm" />
            <Reveal><span className="eyebrow">A note from us</span></Reveal>
            <SplitHeading className="h-sec mt-4 text-balance">From our desk on Hospital Road</SplitHeading>

            <ScrubText className="mt-6 text-[1.22rem] leading-[1.7] text-ink text-pretty" dim={0.2}>
              We have been booking trips out of Shivaji Nagar, Bengaluru, since {BIZ.since}: flights, hotels, holidays and Umrah,
              plus visa, passport and insurance consultancy, all from the same office.
            </ScrubText>
            <Reveal delay={0.1}>
              <p className="mt-5 text-pretty">
                Most people reach us on WhatsApp or by phone. If you would rather sit across a desk and go through
                it together, we are on the ground floor of A.M. Plaza, Hospital Road, {HOURS}.
                We are an IATA-accredited agent, and our Hajj &amp; Umrah division handles pilgrimages from the visa
                to the Ziyarat.
              </p>
            </Reveal>

            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <Reveal delay={0.15}>
                <div>
                  <span className="relative inline-block">
                    <span className="note block text-[2rem] leading-none text-navy-900">{BIZ.owner}</span>
                    <DrawLine className="absolute -bottom-3 left-0 h-3 w-full" color="#b4532a" delay={0.6} />
                  </span>
                  <span className="mt-5 block text-[0.92rem] text-slate-500">Owner, {BIZ.name}</span>
                </div>
              </Reveal>
              <Stamp top="Accredited" main="IATA" bottom="Travel agent" tone="navy" rotate={7} className="self-start sm:self-auto" />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-300 pt-6">
              <Link to="/about" className="btn btn-ghost !py-3 !text-[1rem]">More about us <ArrowRight size={16} /></Link>
              <Link to="/contact" className="link-grow font-display text-[1rem] font-bold text-ink">Directions to our office</Link>
            </div>
          </div>
        </div>

        {/* Facts along a route */}
        <div className="relative mt-16 md:mt-24">
          <RouteLine />
          <ol className="relative grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4 lg:gap-10">
            {FACTS.map((f, n) => (
              <li key={f.big}>
                <Reveal delay={n * 0.1}>
                  <span aria-hidden="true" className="mb-4 hidden h-3.5 w-3.5 rounded-full border-2 border-gold-600 bg-paper lg:block" />
                  <span className="font-display text-[0.75rem] font-bold tracking-[0.2em] text-slate-500">0{n + 1}</span>
                  <div className="accent mt-1 text-[clamp(1.5rem,2.6vw,2.2rem)] leading-tight text-navy-900">{f.big}</div>
                  <div className="mt-1 text-[0.95rem] leading-snug sm:text-[1rem]">{f.label}</div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FAQ
   ============================================================ */
function FaqSection() {
  return (
    <section aria-label="Questions we get asked a lot" className="section paper bg-sand">
      <div className="wrap grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28">
          <Reveal><span className="eyebrow">Good to know</span></Reveal>
          <SplitHeading className="h-sec mt-4 text-balance">Questions we get asked a lot</SplitHeading>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-md text-pretty">
              If yours isn&apos;t here, send it on WhatsApp or call us. We are open {HOURS}.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex items-center gap-4">
              <a href={waLink(`${HELLO} I have a question:`)} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
                <MessageCircle size={17} /> Ask on WhatsApp
              </a>
              <ArrowDoodle className="hidden h-12 w-20 text-gold-600 lg:block" />
            </div>
          </Reveal>
        </div>
        <Accordion items={FAQS} />
      </div>
    </section>
  )
}

/* ============================================================
   CTA — navy panel with the page's one flight route.
   ============================================================ */
function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="paper bg-sand pb-24">
      <div className="wrap">
        <ClipGrow className="relative isolate overflow-hidden rounded-5xl bg-navy-950 px-7 py-14 sm:px-12 md:px-16 md:py-20">
          <Parallax speed={0.2} className="absolute inset-0 -z-20">
            <img
              {...CTA_BG}
              alt="" aria-hidden="true" width={1920} height={1280} loading="lazy" decoding="async"
              className="absolute -top-[15%] left-0 h-[130%] w-full object-cover opacity-45"
            />
          </Parallax>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/90 via-navy-950/65 to-navy-950/30" />

          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 opacity-75">
            <FlightPath
              viewBox="0 0 1200 300"
              d="M -30 250 C 240 300, 360 150, 600 200 S 960 280, 1230 60"
              start="top 90%"
              end="bottom 45%"
            />
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1.4fr_0.6fr]">
            <div>
              <Reveal>
                <h2 id="cta-title" className="h-sec !text-white text-balance">
                  Ready when <span className="accent text-gold-400">you are</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-5 max-w-xl text-[1.17rem] text-white/75 text-pretty">
                  Tell us where you want to go. We will come back with a clear plan and a date you can book, or{' '}
                  <Link to="/contact" className="text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">
                    visit our office in Shivaji Nagar
                  </Link>.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
                  <a
                    href={waLink(`${HELLO} I'd like to start planning a trip.\nDestination:\nDates:\nTravellers:`)}
                    target="_blank" rel="noopener noreferrer" className="btn btn-gold"
                  >
                    <MessageCircle size={18} /> Start on WhatsApp
                  </a>
                  <a href={`tel:${BIZ.phone}`} className="link-grow font-display text-[1.05rem] font-bold text-white">
                    or call {BIZ.phoneDisplay}
                  </a>
                </div>
              </Reveal>
            </div>

            <div className="flex lg:justify-end">
              <Stamp top="Open" main="Mon – Sat" bottom="10 AM – 8 PM" tone="paper" rotate={-6} className="!mix-blend-normal" />
            </div>
          </div>
        </ClipGrow>
      </div>
    </section>
  )
}

/* ============================================================
   PAGE — Hero → Enquiry ticket → Strip → Services → Destinations
          → Packages → Reviews → From our desk → FAQ → CTA
   ============================================================ */
export default function Home() {
  return (
    <>
      <Hero />
      <QuickEnquiry />
      <DestinationStrip />
      <ServicesSection />
      <DestinationsSection />
      <PackagesSection />
      <ReviewsSection />
      <FromOurDesk />
      <FaqSection />
      <CtaSection />
    </>
  )
}
