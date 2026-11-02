/* ============================================================
   VISA REFERENCE — for Indian passport holders
   Indicative only. Rules, fees and processing times change
   frequently; we confirm current requirements for every case.
   type:  'free' | 'arrival' | 'evisa' | 'embassy'
   ============================================================ */

export const VISA_TYPES = {
  free:    { label: 'Visa Free',        tone: 'emerald' },
  arrival: { label: 'Visa on Arrival',  tone: 'sky' },
  evisa:   { label: 'e-Visa',           tone: 'amber' },
  embassy: { label: 'Embassy / VFS',    tone: 'rose' },
}

export const REGIONS = [
  'Middle East',
  'Southeast Asia',
  'South Asia',
  'East Asia',
  'Europe',
  'Americas',
  'Africa',
  'Oceania',
  'Caribbean & Indian Ocean',
]

export const VISAS = [
  /* ---------------- Middle East ---------------- */
  { c: 'United Arab Emirates', r: 'Middle East', t: 'evisa', time: '3–5 working days', stay: '30 / 60 days', note: 'Tourist e-visa arranged by us; pre-approved before departure.' },
  { c: 'Saudi Arabia', r: 'Middle East', t: 'evisa', time: '5–10 working days', stay: '30 days–1 year', note: 'Tourist e-visa and Umrah visa both handled in-house.' },
  { c: 'Qatar', r: 'Middle East', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Free entry for Indian nationals with confirmed hotel and return ticket.' },
  { c: 'Oman', r: 'Middle East', t: 'evisa', time: '3–7 working days', stay: '10 / 30 days', note: 'e-Visa; also visa-free if you hold a valid US/UK/Schengen visa.' },
  { c: 'Bahrain', r: 'Middle East', t: 'evisa', time: '3–5 working days', stay: '14 / 30 days', note: 'eVisa available; visa on arrival for eligible travellers.' },
  { c: 'Kuwait', r: 'Middle East', t: 'embassy', time: '2–4 weeks', stay: '30 days', note: 'Tourist visas restricted; family visit and business more common.' },
  { c: 'Jordan', r: 'Middle East', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Jordan Pass waives the visa fee if bought before travel.' },
  { c: 'Israel', r: 'Middle East', t: 'embassy', time: '2–3 weeks', stay: '90 days', note: 'Interview may be required at the embassy.' },
  { c: 'Turkey', r: 'Middle East', t: 'evisa', time: '3–7 working days', stay: '30 days', note: 'e-Visa for holders of valid Schengen/US/UK visa; otherwise sticker visa.' },
  { c: 'Iran', r: 'Middle East', t: 'free', time: 'Visa free', stay: '15 days', note: 'Visa-free entry for Indian tourists arriving by air.' },
  { c: 'Azerbaijan', r: 'Middle East', t: 'evisa', time: '3–5 working days', stay: '30 days', note: 'ASAN e-visa, straightforward documentation.' },
  { c: 'Armenia', r: 'Middle East', t: 'evisa', time: '3–5 working days', stay: '21 / 120 days', note: 'e-Visa online, low documentation.' },
  { c: 'Georgia', r: 'Middle East', t: 'embassy', time: '2–4 weeks', stay: '30 days', note: 'Visa-free if you hold a valid Schengen, US or UK visa.' },

  /* ---------------- Southeast Asia ---------------- */
  { c: 'Thailand', r: 'Southeast Asia', t: 'free', time: 'Visa free', stay: '60 days', note: 'Visa exemption currently extended to Indian passport holders.' },
  { c: 'Malaysia', r: 'Southeast Asia', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa exemption in place; MDAC arrival card required before travel.' },
  { c: 'Indonesia (Bali)', r: 'Southeast Asia', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'e-VOA can be bought online to skip the airport queue.' },
  { c: 'Singapore', r: 'Southeast Asia', t: 'evisa', time: '5–7 working days', stay: '30 days', note: 'Applied through an authorised agent — we file it for you.' },
  { c: 'Vietnam', r: 'Southeast Asia', t: 'evisa', time: '5–7 working days', stay: '30 / 90 days', note: 'Single and multiple entry e-visas available.' },
  { c: 'Cambodia', r: 'Southeast Asia', t: 'evisa', time: '3–5 working days', stay: '30 days', note: 'e-Visa or visa on arrival at Siem Reap and Phnom Penh.' },
  { c: 'Laos', r: 'Southeast Asia', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival at major entry points.' },
  { c: 'Philippines', r: 'Southeast Asia', t: 'embassy', time: '5–10 working days', stay: '30 days', note: 'Visa-free entry if you hold a valid US, Schengen, UK, AU, CA or JP visa.' },
  { c: 'Myanmar', r: 'Southeast Asia', t: 'evisa', time: '3–5 working days', stay: '28 days', note: 'e-Visa for tourism; entry points restricted.' },
  { c: 'Brunei', r: 'Southeast Asia', t: 'arrival', time: 'On arrival', stay: '14 days', note: 'Visa on arrival for Indian nationals.' },
  { c: 'Timor-Leste', r: 'Southeast Asia', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival at Dili airport.' },

  /* ---------------- South Asia ---------------- */
  { c: 'Nepal', r: 'South Asia', t: 'free', time: 'Visa free', stay: 'Unlimited', note: 'No visa or passport needed — voter ID or Aadhaar accepted by air.' },
  { c: 'Bhutan', r: 'South Asia', t: 'free', time: 'Permit on arrival', stay: '7+ days', note: 'Entry permit plus Sustainable Development Fee per night.' },
  { c: 'Sri Lanka', r: 'South Asia', t: 'evisa', time: '2–4 working days', stay: '30 days', note: 'ETA applied online; quick turnaround.' },
  { c: 'Maldives', r: 'South Asia', t: 'arrival', time: 'On arrival', stay: '90 days', note: 'Free visa on arrival with confirmed hotel and return ticket.' },
  { c: 'Bangladesh', r: 'South Asia', t: 'embassy', time: '1–3 weeks', stay: '30 days', note: 'Applied at the High Commission; documentation varies by purpose.' },

  /* ---------------- East Asia ---------------- */
  { c: 'Japan', r: 'East Asia', t: 'evisa', time: '5–10 working days', stay: '15 / 30 / 90 days', note: 'e-Visa now available for Indian tourists; financial documents required.' },
  { c: 'South Korea', r: 'East Asia', t: 'embassy', time: '2–3 weeks', stay: '30 / 90 days', note: 'Group tourist visas available through designated agencies.' },
  { c: 'China', r: 'East Asia', t: 'embassy', time: '1–3 weeks', stay: '30 / 60 days', note: 'Biometrics required in person at the visa centre.' },
  { c: 'Hong Kong', r: 'East Asia', t: 'evisa', time: '3–5 working days', stay: '14 days', note: 'Pre-arrival registration online, free of charge.' },
  { c: 'Taiwan', r: 'East Asia', t: 'evisa', time: '5–7 working days', stay: '30 days', note: 'Travel authority certificate if you hold a valid US/UK/Schengen/JP/AU visa.' },
  { c: 'Macau', r: 'East Asia', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival for Indian passport holders.' },
  { c: 'Mongolia', r: 'East Asia', t: 'evisa', time: '5–10 working days', stay: '30 days', note: 'e-Visa system available for tourism.' },
  { c: 'Kazakhstan', r: 'East Asia', t: 'evisa', time: '5–7 working days', stay: '14 / 30 days', note: 'e-Visa; invitation may be needed for some categories.' },
  { c: 'Uzbekistan', r: 'East Asia', t: 'evisa', time: '3–5 working days', stay: '30 days', note: 'Simple e-visa process, popular Silk Road circuit.' },
  { c: 'Kyrgyzstan', r: 'East Asia', t: 'evisa', time: '5–7 working days', stay: '30 days', note: 'e-Visa applied online.' },

  /* ---------------- Europe (Schengen + others) ---------------- */
  { c: 'France', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Biometrics at VFS; full financial documentation.' },
  { c: 'Germany', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Appointment slots book out early in summer.' },
  { c: 'Italy', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Detailed itinerary and hotel proof required.' },
  { c: 'Switzerland', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Strong financial profile expected.' },
  { c: 'Spain', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Apply well ahead in peak season.' },
  { c: 'Netherlands', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Popular for transit-plus-tourism trips.' },
  { c: 'Austria', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Greece', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Island-hopping itineraries need clear hotel proof.' },
  { c: 'Portugal', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Belgium', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Czech Republic', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Prague is a popular first-Europe choice.' },
  { c: 'Hungary', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Poland', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Norway', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Northern-lights season books out early.' },
  { c: 'Sweden', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Denmark', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Finland', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C.' },
  { c: 'Iceland', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C. Applied via the Danish embassy.' },
  { c: 'Croatia', r: 'Europe', t: 'embassy', time: '15–30 working days', stay: '90 days', note: 'Schengen Type C since 2023.' },
  { c: 'United Kingdom', r: 'Europe', t: 'embassy', time: '3–6 weeks', stay: '6 months', note: 'Standard Visitor visa. Priority processing available at extra cost.' },
  { c: 'Ireland', r: 'Europe', t: 'embassy', time: '4–8 weeks', stay: '90 days', note: 'Separate from Schengen. Short-stay C visa.' },
  { c: 'Russia', r: 'Europe', t: 'evisa', time: '4–20 working days', stay: '16 days', note: 'Unified e-visa for tourism through major entry points.' },
  { c: 'Serbia', r: 'Europe', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free entry for Indian passport holders.' },
  { c: 'Albania', r: 'Europe', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free with a valid multi-entry Schengen, US or UK visa.' },
  { c: 'Moldova', r: 'Europe', t: 'evisa', time: '5–10 working days', stay: '90 days', note: 'e-Visa available online.' },
  { c: 'Ukraine', r: 'Europe', t: 'evisa', time: '5–10 working days', stay: '30 days', note: 'Subject to current travel advisories — check before planning.' },

  /* ---------------- Americas ---------------- */
  { c: 'United States', r: 'Americas', t: 'embassy', time: 'Interview-slot dependent', stay: 'Up to 6 months', note: 'B1/B2 visitor visa. Slot availability drives the real timeline — start early.' },
  { c: 'Canada', r: 'Americas', t: 'embassy', time: '4–10 weeks', stay: 'Up to 6 months', note: 'Visitor visa (TRV). Biometrics required; strong ties documentation.' },
  { c: 'Mexico', r: 'Americas', t: 'evisa', time: '5–10 working days', stay: '180 days', note: 'Visa-free if you hold a valid US visa or permanent residence.' },
  { c: 'Brazil', r: 'Americas', t: 'evisa', time: '5–10 working days', stay: '90 days', note: 'e-Visa system for Indian tourists.' },
  { c: 'Argentina', r: 'Americas', t: 'embassy', time: '2–4 weeks', stay: '90 days', note: 'AVE electronic authorisation if you hold a valid US visa.' },
  { c: 'Chile', r: 'Americas', t: 'embassy', time: '2–4 weeks', stay: '90 days', note: 'Tourist visa through the consulate.' },
  { c: 'Peru', r: 'Americas', t: 'embassy', time: '2–4 weeks', stay: '90 days', note: 'Visa-free with a valid US, Schengen, UK, CA or AU visa.' },
  { c: 'Colombia', r: 'Americas', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free with a valid US or Schengen visa.' },
  { c: 'Panama', r: 'Americas', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free with a valid US, UK, Schengen, CA or AU visa.' },
  { c: 'Costa Rica', r: 'Americas', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free with a valid US, Schengen, CA, JP or KR visa.' },
  { c: 'Ecuador', r: 'Americas', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry for Indian passport holders.' },
  { c: 'Bolivia', r: 'Americas', t: 'arrival', time: 'On arrival', stay: '90 days', note: 'Visa on arrival with yellow fever certificate.' },
  { c: 'Suriname', r: 'Americas', t: 'evisa', time: '3–7 working days', stay: '90 days', note: 'e-Visa / tourist card available online.' },
  { c: 'Guyana', r: 'Americas', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival for Indian nationals.' },

  /* ---------------- Africa ---------------- */
  { c: 'Egypt', r: 'Africa', t: 'evisa', time: '5–10 working days', stay: '30 days', note: 'e-Visa online; visa on arrival if you hold a valid US/UK/Schengen visa.' },
  { c: 'Morocco', r: 'Africa', t: 'embassy', time: '2–3 weeks', stay: '90 days', note: 'Consular visa; e-visa available for holders of Schengen/US visas.' },
  { c: 'South Africa', r: 'Africa', t: 'embassy', time: '2–4 weeks', stay: '90 days', note: 'Applied through VFS; detailed financial documentation.' },
  { c: 'Kenya', r: 'Africa', t: 'evisa', time: '3–7 working days', stay: '90 days', note: 'Electronic Travel Authorisation (eTA) required for all visitors.' },
  { c: 'Tanzania', r: 'Africa', t: 'evisa', time: '5–10 working days', stay: '90 days', note: 'e-Visa or visa on arrival — Zanzibar included.' },
  { c: 'Mauritius', r: 'Africa', t: 'free', time: 'Visa free', stay: '90 days', note: 'Free entry permit on arrival with hotel and return ticket.' },
  { c: 'Seychelles', r: 'Africa', t: 'free', time: 'Travel authorisation', stay: '30 days', note: 'No visa — an online travel authorisation is required before boarding.' },
  { c: 'Ethiopia', r: 'Africa', t: 'evisa', time: '3–5 working days', stay: '30 / 90 days', note: 'e-Visa online; popular as a stopover destination.' },
  { c: 'Rwanda', r: 'Africa', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival for all nationalities.' },
  { c: 'Uganda', r: 'Africa', t: 'evisa', time: '3–7 working days', stay: '90 days', note: 'e-Visa online; yellow fever certificate mandatory.' },
  { c: 'Zimbabwe', r: 'Africa', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival; KAZA univisa covers Zambia too.' },
  { c: 'Zambia', r: 'Africa', t: 'evisa', time: '3–7 working days', stay: '90 days', note: 'e-Visa; Victoria Falls circuit.' },
  { c: 'Namibia', r: 'Africa', t: 'arrival', time: 'On arrival', stay: '90 days', note: 'Visa on arrival introduced for Indian passport holders.' },
  { c: 'Botswana', r: 'Africa', t: 'evisa', time: '5–10 working days', stay: '90 days', note: 'e-Visa available online.' },
  { c: 'Tunisia', r: 'Africa', t: 'embassy', time: '2–3 weeks', stay: '90 days', note: 'Consular visa; group tours may qualify for easier entry.' },
  { c: 'Ghana', r: 'Africa', t: 'embassy', time: '1–3 weeks', stay: '30 / 90 days', note: 'Consular visa; yellow fever certificate required.' },
  { c: 'Nigeria', r: 'Africa', t: 'embassy', time: '2–4 weeks', stay: '90 days', note: 'Business visas most common; invitation letter needed.' },
  { c: 'Madagascar', r: 'Africa', t: 'arrival', time: 'On arrival', stay: '30 / 60 days', note: 'Visa on arrival at Antananarivo.' },
  { c: 'Cape Verde', r: 'Africa', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Pre-registration online, visa issued on arrival.' },

  /* ---------------- Oceania ---------------- */
  { c: 'Australia', r: 'Oceania', t: 'evisa', time: '3–6 weeks', stay: '3 / 6 / 12 months', note: 'Visitor visa subclass 600, applied online.' },
  { c: 'New Zealand', r: 'Oceania', t: 'evisa', time: '3–8 weeks', stay: '9 months', note: 'Visitor visa online; medical may be requested for longer stays.' },
  { c: 'Fiji', r: 'Oceania', t: 'free', time: 'Visa free', stay: '120 days', note: 'Visa-free entry for Indian passport holders.' },
  { c: 'Vanuatu', r: 'Oceania', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free entry.' },
  { c: 'Samoa', r: 'Oceania', t: 'arrival', time: 'On arrival', stay: '60 days', note: 'Entry permit issued on arrival.' },
  { c: 'Palau', r: 'Oceania', t: 'arrival', time: 'On arrival', stay: '30 days', note: 'Visa on arrival; diving destination.' },
  { c: 'Micronesia', r: 'Oceania', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free entry for Indian nationals.' },
  { c: 'Cook Islands', r: 'Oceania', t: 'free', time: 'Visa free', stay: '31 days', note: 'Visa-free entry.' },

  /* ---------------- Caribbean & Indian Ocean ---------------- */
  { c: 'Jamaica', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free entry for Indian passport holders.' },
  { c: 'Barbados', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry.' },
  { c: 'Trinidad & Tobago', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry for Indian nationals.' },
  { c: 'Dominica', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '180 days', note: 'Visa-free entry.' },
  { c: 'Grenada', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry.' },
  { c: 'St. Kitts & Nevis', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry.' },
  { c: 'St. Lucia', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '42 days', note: 'Visa-free entry.' },
  { c: 'St. Vincent & Grenadines', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free entry.' },
  { c: 'Bahamas', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry for Indian passport holders.' },
  { c: 'Cuba', r: 'Caribbean & Indian Ocean', t: 'evisa', time: '5–10 working days', stay: '30 days', note: 'Tourist card required before travel.' },
  { c: 'Dominican Republic', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '30 days', note: 'Visa-free with tourist card on arrival.' },
  { c: 'Haiti', r: 'Caribbean & Indian Ocean', t: 'free', time: 'Visa free', stay: '90 days', note: 'Visa-free entry — check advisories before booking.' },
]

/* Quick counts for the page header */
export const visaStats = (list = VISAS) => {
  const by = (t) => list.filter((v) => v.t === t).length
  return {
    total: list.length,
    free: by('free'),
    arrival: by('arrival'),
    evisa: by('evisa'),
    embassy: by('embassy'),
  }
}
