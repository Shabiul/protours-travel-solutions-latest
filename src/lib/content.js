import { useEffect, useMemo, useState } from 'react'

import { PACKAGES } from '../data/site.js'
import { VISAS } from '../data/visas.js'

/* Content the owner edits in the CRM (tour packages, visa destinations, passport services).
   The pages start from what ships with the website (so the pre-rendered HTML and a slow or failed request still show everything),
   then swap in the CRM's version as soon as it arrives. One request per page load, shared by every component. */

let cache = null
let inflight = null
const load = () => (inflight ||= fetch('/api/enquiry', { headers: { Accept: 'application/json' } })
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}))
  .then((d) => (cache = d && typeof d === 'object' ? d : {})))

function useContent(key, fallback) {
  const [v, setV] = useState(() => cache?.[key] || fallback)
  useEffect(() => {
    let on = true
    load().then((d) => { if (on && Array.isArray(d[key])) setV(d[key]) })
    return () => { on = false }
  }, [key])
  return v
}

/** Packages visitors can see (the ones switched off in the CRM are left out). */
export function usePackages() {
  const all = useContent('packages', PACKAGES)
  return useMemo(() => all.filter((p) => !p.hidden), [all])
}
export const useVisas = (fallback = VISAS) => useContent('visas', fallback)
export const usePassportServices = (fallback) => useContent('passport', fallback)
