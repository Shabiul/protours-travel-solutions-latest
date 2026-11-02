import { lazy, Suspense, useEffect, useState } from 'react'
import { ClipboardList, CreditCard, FileText, Luggage, Receipt, Users, LayoutDashboard, Loader2, MessageSquareText, Plane, ScrollText, Settings as Cog } from 'lucide-react'

import { crm, getSession, loadRole, onSession, signOut } from './crm/api.js'
import Login from './crm/Login.jsx'

const Dashboard = lazy(() => import('./crm/Dashboard.jsx'))
const Bookings = lazy(() => import('./crm/Bookings.jsx'))
const Enquiries = lazy(() => import('./crm/Enquiries.jsx'))
const Cases = lazy(() => import('./crm/Cases.jsx'))
const Invoices = lazy(() => import('./crm/Invoices.jsx'))
const Customers = lazy(() => import('./crm/Customers.jsx'))
const Payments = lazy(() => import('./crm/Payments.jsx'))
const Logs = lazy(() => import('./crm/Logs.jsx'))
const Settings = lazy(() => import('./crm/Settings.jsx'))
const PackagesAdmin = lazy(() => import('./crm/Packages.jsx'))
const VisaAdmin = lazy(() => import('./crm/VisaAdmin.jsx'))

const TABS = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['bookings', 'Bookings', Plane],
  ['cases', 'Orders', ClipboardList],
  ['customers', 'Customers', Users],
  ['payments', 'Payments', CreditCard],
  ['invoices', 'Invoices', Receipt],
  ['enquiries', 'Enquiries', MessageSquareText],
  ['packages', 'Tours & packages', Luggage],
  ['visas', 'Visa & passport', FileText],
  ['logs', 'TBO logs', ScrollText],
  ['settings', 'Settings', Cog],
]

/** Back office: all flight bookings, all website enquiries, and the TBO call logs. Staff sign-in only. */
export default function Crm() {
  const [session, setSession] = useState(getSession)
  const [tab, setTab] = useState('dashboard')
  const [booking, setBooking] = useState(null)
  const [enquiry, setEnquiry] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [seed, setSeed] = useState(null) // an enquiry being turned into an order
  const [role, setRole] = useState('staff')
  const [badges, setBadges] = useState(null)
  useEffect(() => { if (session) loadRole().then(setRole); else setBadges(null) }, [session])
  // Alerts: counts on the tabs and in the browser tab title, refreshed every 3 minutes while this tab is open and visible.
  useEffect(() => {
    if (!session) return undefined
    let live = true
    const load = () => { if (!document.hidden) crm('badges').then((b) => live && setBadges(b)).catch(() => {}) }
    load()
    const t = setInterval(load, 3 * 60_000)
    document.addEventListener('visibilitychange', load)
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [session])
  const alerts = badges ? { bookings: badges.bookingsAttention, enquiries: badges.enquiriesNew + badges.followupsDue, cases: badges.casesDue } : {}
  const alertTotal = Object.values(alerts).reduce((t, n) => t + (n || 0), 0)
  useEffect(() => { const prev = document.title; if (session) document.title = `${alertTotal ? `(${alertTotal}) ` : ''}Back office | Pro Tours`; return () => { document.title = prev } }, [session, alertTotal])

  useEffect(() => onSession(setSession), [])
  // A shared or unattended computer must not stay signed in: sign out after 30 minutes without activity.
  useEffect(() => {
    if (!session) return
    let t
    const reset = () => { clearTimeout(t); t = setTimeout(signOut, 30 * 60_000) }
    const events = ['pointerdown', 'keydown', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(t); events.forEach((e) => window.removeEventListener(e, reset)) }
  }, [session])
  useEffect(() => {
    // the back office must never show up in search results
    const m = document.createElement('meta')
    m.name = 'robots'; m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])

  const goBooking = (id) => { setBooking(id); if (tab !== 'bookings') setTab('bookings') }
  const goEnquiry = (id) => { setEnquiry(id); if (tab !== 'enquiries') setTab('enquiries') }

  return (
    <section className="min-h-screen bg-paper pt-28 pb-16 md:pt-36">
      <div className="wrap">
        {!session ? <Login /> : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-[1.6rem] font-bold text-ink">Back office</h1>
              <p className="text-[0.85rem] text-slate-500">{session.email}</p>
            </div>
            <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
            <nav aria-label="CRM sections" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm lg:sticky lg:top-28 lg:mb-0 lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:p-2">
              {TABS.map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-left text-[0.92rem] font-bold lg:w-full ${tab === id ? 'bg-navy-950 text-white' : 'text-slate-700 hover:bg-sand'}`}><Icon size={17} /> {label}{alerts[id] > 0 && <span className="ml-1 rounded-full bg-red-600 lg:ml-auto px-1.5 py-0.5 text-[0.7rem] leading-none text-white" aria-label={`${alerts[id]} need attention`}>{alerts[id]}</span>}</button>
              ))}
            </nav>
            <div className="min-w-0"><Suspense fallback={<Loader2 className="mx-auto mt-10 animate-spin" />}>
              {tab === 'dashboard' && <Dashboard go={setTab} onOpenBooking={goBooking} onOpenEnquiry={goEnquiry} onFollowUps={(due) => { setEnquiry(null); setTab('enquiries'); window.__crmDue = due }} />}
              {tab === 'bookings' && <Bookings openId={booking} onOpen={setBooking} admin={role === 'admin'} />}
              {tab === 'cases' && <Cases openId={orderId} onOpen={setOrderId} seedFromEnquiry={seed} onSeedUsed={() => setSeed(null)} />}
              {tab === 'invoices' && <Invoices admin={role === 'admin'} />}
              {tab === 'customers' && <Customers onOpenBooking={goBooking} onOpenEnquiry={goEnquiry} onOpenOrder={(id) => { setOrderId(id); setTab('cases') }} />}
              {tab === 'payments' && <Payments onOpenOrder={() => setTab('bookings')} />}
              {tab === 'enquiries' && <Enquiries openId={enquiry} onOpen={setEnquiry} onMakeOrder={(s) => { setEnquiry(null); setSeed(s); setTab('cases') }} />}
              {tab === 'packages' && <PackagesAdmin admin={role === 'admin'} />}
              {tab === 'visas' && <VisaAdmin admin={role === 'admin'} />}
              {tab === 'logs' && <Logs onOpenBooking={goBooking} />}
              {tab === 'settings' && <Settings admin={role === 'admin'} role={role} />}
            </Suspense></div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
