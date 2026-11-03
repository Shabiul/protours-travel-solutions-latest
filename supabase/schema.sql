-- Pro Tours & Travel Solutions: Supabase schema for the website and the CRM.
-- Safe to run more than once (everything is "if not exists"). Run it in the Supabase SQL editor
-- or with `node scripts/db-apply.mjs`.
-- The server writes with the secret (service) key; the browser never gets direct table access:
-- RLS is on and there are no public policies.

create or replace function set_updated_at() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end $$;

-- Every TBO API request/response (TBO wants these kept as JSON). Big Search replies are trimmed by the server.
create table if not exists tbo_logs (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  env         text not null,               -- staging | live
  trace_id    text,
  method      text not null,               -- Authenticate, Search, FareQuote, Ticket...
  kind        text not null check (kind in ('request', 'response')),
  body        jsonb not null
);
create index if not exists tbo_logs_trace on tbo_logs (trace_id, created_at);
create index if not exists tbo_logs_created on tbo_logs (created_at desc);

-- One row per flight booking attempt, from the moment payment starts. Shown in the CRM.
create table if not exists flight_bookings (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  order_ref        text unique not null,
  env              text not null,
  trace_id         text,
  status           text not null default 'payment_pending'
                   check (status in ('payment_pending', 'paid', 'ticketed', 'needs_attention', 'failed', 'cancelled', 'refunded')),
  amount_inr       numeric(12,2),
  payment_id       text,
  razorpay_order_id text,
  customer_name    text,
  contact_phone    text,
  contact_email    text,
  journey          text,                    -- oneway | return | multicity ...
  route            text,                    -- BLR-DEL | DEL-BLR
  travel_date      date,
  return_date      date,
  pax_count        int,
  pax              jsonb not null default '[]',   -- [{type, name, ticket?}] (no passport / date of birth)
  pnr              text,                    -- all PNRs, comma separated (searchable)
  booking_ids      text,                    -- TBO booking ids, comma separated
  legs             jsonb not null default '[]',   -- [{pnr, bookingId, ticketStatus, error, details}]
  assigned_to      text,
  notes            text
);
-- Customer accounts: the Supabase Auth user who booked while signed in (guests leave it null).
alter table flight_bookings add column if not exists user_id uuid;
create index if not exists flight_bookings_user on flight_bookings (user_id, created_at desc) where user_id is not null;
create index if not exists flight_bookings_email on flight_bookings (lower(contact_email));
-- Payments. checkout_token is the sealed (AES-GCM) booking data the webhook needs to issue the ticket if the customer's browser
-- closed after paying; it is cleared the moment ticketing finishes and never shown in the CRM or to customers.
alter table flight_bookings add column if not exists checkout_token text;
alter table flight_bookings add column if not exists paid_inr numeric(12,2);
alter table flight_bookings add column if not exists refunded_inr numeric(12,2) not null default 0;
-- the airline's own fare (incl. taxes) and our markup on it, so earnings can be added up exactly
alter table flight_bookings add column if not exists fare_inr numeric(12,2);
alter table flight_bookings add column if not exists markup_inr numeric(12,2);
-- one Razorpay payment can only ever pay for one booking
create unique index if not exists flight_bookings_payment_unique on flight_bookings (payment_id) where payment_id is not null;
create index if not exists flight_bookings_rzp_order on flight_bookings (razorpay_order_id) where razorpay_order_id is not null;
create index if not exists flight_bookings_status on flight_bookings (status, created_at desc);
create index if not exists flight_bookings_created on flight_bookings (created_at desc);
create index if not exists flight_bookings_phone on flight_bookings (contact_phone);
create index if not exists flight_bookings_pnr on flight_bookings (pnr);
create index if not exists flight_bookings_trace on flight_bookings (trace_id);
drop trigger if exists flight_bookings_updated on flight_bookings;
create trigger flight_bookings_updated before update on flight_bookings for each row execute function set_updated_at();

-- Website enquiries, for the CRM (the sender agrees on the form; see the Privacy Policy).
create table if not exists enquiries (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text,
  phone       text,
  email       text,
  topic       text,
  message     text,
  page        text,                          -- page the enquiry was sent from
  consent     boolean not null default false,
  status      text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  assigned_to text,
  notes       text
);
-- Which service the enquiry is for, where it came from, when to follow up, and the money: what we quoted, what it finally came to.
alter table enquiries add column if not exists service text;
alter table enquiries add column if not exists source text not null default 'website';
alter table enquiries add column if not exists follow_up_at date;
alter table enquiries add column if not exists quoted_inr numeric(12,2);
alter table enquiries add column if not exists final_inr numeric(12,2);
create index if not exists enquiries_service on enquiries (service, created_at desc);
create index if not exists enquiries_followup on enquiries (follow_up_at) where follow_up_at is not null;
create index if not exists enquiries_status on enquiries (status, created_at desc);
create index if not exists enquiries_created on enquiries (created_at desc);
create index if not exists enquiries_phone on enquiries (phone);
drop trigger if exists enquiries_updated on enquiries;
create trigger enquiries_updated before update on enquiries for each row execute function set_updated_at();

-- Timeline for bookings and enquiries: created, paid, ticketed, status changes, staff notes.
create table if not exists crm_events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  entity     text not null check (entity in ('booking', 'enquiry')),
  entity_id  bigint not null,
  kind       text not null,                 -- created | paid | ticketed | failed | status | assigned | note | payment_failed
  actor      text,                          -- staff email, or 'system' / 'customer'
  data       jsonb not null default '{}'
);
create index if not exists crm_events_entity on crm_events (entity, entity_id, created_at);

-- Editable site content for the CRM (packages, notices, settings).
create table if not exists site_content (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Payment ledger: one row per Razorpay payment ATTEMPT (successful, failed or abandoned at the bank), with who paid how and when.
-- Card numbers are never stored (Razorpay only gives us network, type and the last 4 digits).
create table if not exists payments (
  payment_id         text primary key,            -- Razorpay pay_...
  order_id           text,                        -- Razorpay order_...
  order_ref          text,                        -- our booking reference
  status             text not null,               -- created | authorized | captured | failed | partially_refunded | refunded
  method             text,                        -- upi | card | netbanking | wallet | emi | paylater
  amount_inr         numeric(12,2),
  currency           text,
  vpa                text,                        -- the customer's UPI ID
  upi_ref            text,                        -- UPI transaction id
  bank_ref           text,                        -- bank reference number (RRN)
  card_network       text,
  card_type          text,
  card_last4         text,
  card_issuer        text,
  bank               text,
  wallet             text,
  email              text,
  contact            text,
  fee_inr            numeric(12,2),
  tax_inr            numeric(12,2),
  error_code         text,
  error_description  text,
  error_reason       text,
  error_step         text,
  initiated_at       timestamptz,                 -- when the customer started this attempt (Razorpay's own time)
  authorized_at      timestamptz,
  captured_at        timestamptz,
  failed_at          timestamptz,
  refunded_inr       numeric(12,2) not null default 0,
  source             text,                        -- how we learned of it: browser | webhook | daily-check
  first_seen         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists payments_order_ref on payments (order_ref);
create index if not exists payments_order_id on payments (order_id);
create index if not exists payments_initiated on payments (initiated_at desc);
create index if not exists payments_status on payments (status, initiated_at desc);
create index if not exists payments_vpa on payments (lower(vpa));
alter table payments enable row level security;


-- The timeline also serves orders ("cases") and invoices.
do $$ begin
  alter table crm_events drop constraint if exists crm_events_entity_check;
  alter table crm_events add constraint crm_events_entity_check check (entity in ('booking', 'enquiry', 'case', 'invoice'));
end $$;

-- Orders for every service that is not an online flight booking: visa, passport, Umrah / Hajj, hotels, tours, insurance, corporate, offline flights.
-- One row per customer order, with its document checklist, travellers, and the payments received by cash, UPI or bank transfer.
create table if not exists cases (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  case_ref     text unique,
  service      text not null,
  enquiry_id   bigint,
  customer_name text not null,
  phone        text,
  email        text,
  title        text,                                   -- "Dubai tourist visa, 2 adults"
  status       text not null default 'docs_pending'
               check (status in ('docs_pending', 'docs_received', 'in_progress', 'submitted', 'approved', 'delivered', 'rejected', 'cancelled')),
  travellers   jsonb not null default '[]',            -- [{name, type, note}]  (no passport numbers kept here)
  travel_date  date,
  due_date     date,                                   -- deadline for the paperwork
  amount_inr   numeric(12,2),                          -- what the customer pays us
  paid_inr     numeric(12,2) not null default 0,
  payments     jsonb not null default '[]',            -- [{id, at, amount, mode, ref, note, by}]
  checklist    jsonb not null default '[]',            -- [{item, done}]
  assigned_to  text,
  notes        text
);
create index if not exists cases_status on cases (status, created_at desc);
create index if not exists cases_service on cases (service, created_at desc);
create index if not exists cases_due on cases (due_date) where due_date is not null;
create index if not exists cases_phone on cases (phone);
drop trigger if exists cases_updated on cases;
create trigger cases_updated before update on cases for each row execute function set_updated_at();

-- Invoices. Numbers run in order inside each financial year (April to March) and are never reused: a wrong invoice is cancelled, not deleted.
create table if not exists invoice_counters (fy text primary key, n int not null default 0);
create table if not exists invoices (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  invoice_no    text unique not null,
  issued_on     date not null,
  case_id       bigint,
  booking_id    bigint,
  customer_name text not null,
  phone         text,
  email         text,
  address       text,
  customer_gstin text,
  lines         jsonb not null,                        -- [{desc, qty, rate, amount}]
  subtotal      numeric(12,2) not null,
  gst_percent   numeric(5,2) not null default 0,
  gst_amount    numeric(12,2) not null default 0,
  total         numeric(12,2) not null,
  status        text not null default 'issued' check (status in ('issued', 'cancelled')),
  notes         text,
  created_by    text
);
create index if not exists invoices_created on invoices (created_at desc);
create index if not exists invoices_case on invoices (case_id);
create index if not exists invoices_booking on invoices (booking_id);

-- Staff can say "these two customer records are the same person" (for example a phone number and an e-mail that never appear together).
create table if not exists customer_aliases (
  alias_key     text primary key,
  canonical_key text not null,
  created_by    text,
  created_at    timestamptz not null default now()
);

alter table cases             enable row level security;
alter table invoices          enable row level security;
alter table invoice_counters  enable row level security;
alter table customer_aliases  enable row level security;

-- Every Razorpay webhook delivery, once (their X-Razorpay-Event-Id): retries and replays are recognised and ignored.
create table if not exists payment_events (
  event_id    text primary key,
  received_at timestamptz not null default now(),
  event       text,
  payment_id  text,
  order_id    text,
  outcome     text
);
create index if not exists payment_events_received on payment_events (received_at);

alter table payment_events   enable row level security;
alter table tbo_logs        enable row level security;
alter table flight_bookings enable row level security;
alter table enquiries       enable row level security;
alter table crm_events      enable row level security;
alter table site_content    enable row level security;
-- No public policies: only the server (secret key) reads/writes.

-- =====================================================================================
-- Optimised server-side functions: one database round trip per CRM / booking action.
-- (Vercel -> Supabase crosses a region; every extra query costs time on the booking path.)
-- Only the server's secret key (service_role) may run them: PUBLIC, anon and authenticated
-- are revoked below, because functions are callable through the public API by default.
-- =====================================================================================

create index if not exists flight_bookings_attention on flight_bookings (created_at desc) where status in ('needs_attention', 'failed');

-- Checkout: create (or refresh) the booking row and log "created" once.
create or replace function crm_record_checkout(p jsonb) returns bigint language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint; v_new boolean;
begin
  insert into flight_bookings (order_ref, env, trace_id, status, amount_inr, razorpay_order_id, customer_name, contact_phone, contact_email, journey, route, travel_date, return_date, pax_count, pax, user_id, checkout_token, fare_inr, markup_inr)
  values (p->>'order_ref', p->>'env', p->>'trace_id', 'payment_pending', (p->>'amount_inr')::numeric, p->>'razorpay_order_id', p->>'customer_name', p->>'contact_phone', p->>'contact_email',
          p->>'journey', p->>'route', nullif(p->>'travel_date', '')::date, nullif(p->>'return_date', '')::date, nullif(p->>'pax_count', '')::int, coalesce(p->'pax', '[]'::jsonb), nullif(p->>'user_id', '')::uuid, nullif(p->>'checkout_token', ''), nullif(p->>'fare_inr', '')::numeric, nullif(p->>'markup_inr', '')::numeric)
  on conflict (order_ref) do update set trace_id = excluded.trace_id, amount_inr = excluded.amount_inr, razorpay_order_id = excluded.razorpay_order_id,
    customer_name = excluded.customer_name, contact_phone = excluded.contact_phone, contact_email = excluded.contact_email, journey = excluded.journey,
    route = excluded.route, travel_date = excluded.travel_date, return_date = excluded.return_date, pax_count = excluded.pax_count, pax = excluded.pax,
    user_id = coalesce(excluded.user_id, flight_bookings.user_id), checkout_token = coalesce(excluded.checkout_token, flight_bookings.checkout_token),
    fare_inr = excluded.fare_inr, markup_inr = excluded.markup_inr
  returning id, (xmax = 0) into v_id, v_new;
  if v_new then
    insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, 'created', 'customer', jsonb_build_object('amount', p->'amount_inr', 'route', p->>'route'));
  end if;
  return v_id;
end $$;

-- Payment confirmed (never overwrites a later status).
create or replace function crm_record_paid(p_ref text, p_payment text) returns void language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  update flight_bookings set status = 'paid', payment_id = p_payment where order_ref = p_ref and status in ('payment_pending', 'paid') returning id into v_id;
  if v_id is not null then
    insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, 'paid', 'system', jsonb_build_object('paymentId', p_payment));
  end if;
end $$;

create or replace function crm_record_payment_failed(p_ref text, p_message text) returns void language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  select id into v_id from flight_bookings where order_ref = p_ref;
  if v_id is not null then
    insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, 'payment_failed', 'system', jsonb_build_object('message', left(coalesce(p_message, ''), 300)));
  end if;
end $$;

-- Ticketing finished: final status, PNRs, ticket numbers merged into the passenger list, timeline entry.
create or replace function crm_record_outcome(p jsonb) returns text language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint; v_pnr text;
begin
  update flight_bookings f set
    status = p->>'status',
    payment_id = coalesce(p->>'payment_id', f.payment_id),
    legs = coalesce(p->'legs', '[]'::jsonb),
    checkout_token = null,
    pnr = nullif(p->>'pnr', ''),
    booking_ids = nullif(p->>'booking_ids', ''),
    pax = coalesce((select jsonb_agg(x || jsonb_build_object('ticket', coalesce(p->'tickets'->>upper(x->>'name'), x->>'ticket', ''))) from jsonb_array_elements(f.pax) x), f.pax)
  where f.order_ref = p->>'order_ref'
  returning f.id, f.pnr into v_id, v_pnr;
  if v_id is not null then
    insert into crm_events (entity, entity_id, kind, actor, data)
    values ('booking', v_id, case when p->>'status' = 'ticketed' then 'ticketed' else 'failed' end, 'system',
            jsonb_build_object('status', p->>'status', 'pnr', v_pnr, 'errors', coalesce(p->'errors', '[]'::jsonb)));
  end if;
  return p->>'status';
end $$;

-- Website enquiry: drops a double-click (same phone within 10 minutes), refuses a flood (150 in 10 minutes).
-- Returns the new id, 0 for a duplicate, -1 when busy.
create or replace function crm_add_enquiry(p jsonb) returns bigint language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if (select count(*) from enquiries where created_at > now() - interval '10 minutes') >= 150 then return -1; end if;
  if exists (select 1 from enquiries where phone = p->>'phone' and created_at > now() - interval '10 minutes') then return 0; end if;
  insert into enquiries (name, phone, email, topic, message, page, consent, service)
  values (p->>'name', p->>'phone', nullif(p->>'email', ''), nullif(p->>'topic', ''), nullif(p->>'message', ''), nullif(p->>'page', ''), true, crm_service_of(p->>'topic'))
  returning id into v_id;
  insert into crm_events (entity, entity_id, kind, actor, data) values ('enquiry', v_id, 'created', 'customer', jsonb_build_object('page', p->>'page', 'topic', p->>'topic'));
  return v_id;
end $$;


-- The service an enquiry is about, from the free-text topic the website form sends ("Visa Services", "Umrah & Hajj"...).
create or replace function crm_service_of(t text) returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when t ~* 'tailor|custom' then 'tailor'
    when t ~* 'umrah|hajj|\mhaj\M' then 'umrah'
    when t ~* 'visa' then 'visa'
    when t ~* 'passport' then 'passport'
    when t ~* 'insurance' then 'insurance'
    when t ~* 'corporate|business travel' then 'corporate'
    when t ~* 'flight|air ?ticket' then 'flights'
    when t ~* 'hotel|resort|accommodation' then 'hotels'
    when t ~* 'tour|package|holiday' then 'tours'
    else 'other' end
$$;

-- Per-service picture for the dashboard, and the follow-ups that are due.
create or replace function crm_services_summary() returns jsonb language sql stable set search_path = public, pg_temp as $$
  with tz as (select (now() at time zone 'Asia/Kolkata')::date as today)
  select jsonb_build_object(
    'services', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select coalesce(service, 'other') as service, count(*) as total,
               count(*) filter (where status = 'new') as "new",
               count(*) filter (where status in ('new', 'contacted', 'quoted')) as open,
               count(*) filter (where status = 'won') as won,
               count(*) filter (where status = 'lost') as lost,
               coalesce(sum(coalesce(final_inr, quoted_inr)) filter (where status = 'won'), 0) as won_value,
               coalesce(sum(quoted_inr) filter (where status in ('contacted', 'quoted')), 0) as pipeline_value
        from enquiries where created_at >= now() - interval '365 days' group by 1) x),
    'followups', (select jsonb_build_object(
        'today', count(*) filter (where follow_up_at = (select today from tz)),
        'overdue', count(*) filter (where follow_up_at < (select today from tz)),
        'next', coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'service', service, 'follow_up_at', follow_up_at, 'phone', phone) order by follow_up_at) filter (where rn <= 8), '[]'::jsonb))
      from (select e.*, row_number() over (order by follow_up_at) rn from enquiries e
             where follow_up_at is not null and follow_up_at <= (select today from tz) + 3 and status in ('new', 'contacted', 'quoted')) f)
  )
$$;

-- A lead entered by staff (phone call, walk-in, WhatsApp, referral). No duplicate / flood limits: a person is typing it.
create or replace function crm_staff_add_enquiry(p jsonb, p_actor text) returns bigint language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  insert into enquiries (name, phone, email, topic, message, page, consent, service, source, follow_up_at, quoted_inr, status)
  values (p->>'name', p->>'phone', nullif(p->>'email', ''), nullif(p->>'topic', ''), nullif(p->>'message', ''), 'staff', true,
          coalesce(nullif(p->>'service', ''), crm_service_of(p->>'topic')), coalesce(nullif(p->>'source', ''), 'phone'),
          nullif(p->>'follow_up_at', '')::date, nullif(p->>'quoted_inr', '')::numeric, 'new')
  returning id into v_id;
  insert into crm_events (entity, entity_id, kind, actor, data) values ('enquiry', v_id, 'created', p_actor, jsonb_build_object('page', 'staff', 'topic', p->>'topic', 'source', p->>'source'));
  return v_id;
end $$;

-- Staff edit of the lead's details (service, source, follow-up date, quote, final amount); every change goes on the timeline.
create or replace function crm_enquiry_fields(p_id bigint, p jsonb, p_actor text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare o enquiries%rowtype; ch jsonb := '{}'::jsonb;
begin
  select * into o from enquiries where id = p_id for update;
  if not found then return jsonb_build_object('found', false); end if;
  if p ? 'service' and nullif(p->>'service', '') is distinct from o.service then ch := ch || jsonb_build_object('service', jsonb_build_array(o.service, p->>'service')); end if;
  if p ? 'source' and nullif(p->>'source', '') is distinct from o.source then ch := ch || jsonb_build_object('source', jsonb_build_array(o.source, p->>'source')); end if;
  if p ? 'follow_up_at' and nullif(p->>'follow_up_at', '')::date is distinct from o.follow_up_at then ch := ch || jsonb_build_object('follow_up_at', jsonb_build_array(o.follow_up_at, nullif(p->>'follow_up_at', ''))); end if;
  if p ? 'quoted_inr' and nullif(p->>'quoted_inr', '')::numeric is distinct from o.quoted_inr then ch := ch || jsonb_build_object('quoted_inr', jsonb_build_array(o.quoted_inr, nullif(p->>'quoted_inr', ''))); end if;
  if p ? 'final_inr' and nullif(p->>'final_inr', '')::numeric is distinct from o.final_inr then ch := ch || jsonb_build_object('final_inr', jsonb_build_array(o.final_inr, nullif(p->>'final_inr', ''))); end if;
  if ch <> '{}'::jsonb then
    update enquiries set
      service = case when p ? 'service' then nullif(p->>'service', '') else service end,
      source = case when p ? 'source' and nullif(p->>'source', '') is not null then p->>'source' else source end,
      follow_up_at = case when p ? 'follow_up_at' then nullif(p->>'follow_up_at', '')::date else follow_up_at end,
      quoted_inr = case when p ? 'quoted_inr' then nullif(p->>'quoted_inr', '')::numeric else quoted_inr end,
      final_inr = case when p ? 'final_inr' then nullif(p->>'final_inr', '')::numeric else final_inr end
    where id = p_id;
    insert into crm_events (entity, entity_id, kind, actor, data) values ('enquiry', p_id, 'details', p_actor, ch);
  end if;
  return jsonb_build_object('found', true, 'changed', ch <> '{}'::jsonb);
end $$;

-- Customer directory. One person = the last 10 digits of the phone; an e-mail is folded into the phone it was ever seen with; staff links on top.
create or replace function crm_customers(p_q text, p_limit int, p_offset int) returns jsonb language sql stable set search_path = public, pg_temp as $$
  with src as (
    select 'booking' as kind, id, customer_name as name, contact_phone as phone, contact_email as email, created_at,
           case when status = 'ticketed' then coalesce(amount_inr, 0) else 0 end as spent, 'flights' as service
      from flight_bookings where status <> 'payment_pending' or created_at > now() - interval '2 days'
    union all
    select 'enquiry', id, name, phone, email, created_at, case when status = 'won' then coalesce(final_inr, quoted_inr, 0) else 0 end, coalesce(service, 'other') from enquiries
    union all
    select 'order', id, customer_name, phone, email, created_at, coalesce(paid_inr, 0), service from cases where status <> 'cancelled'
  ), p10 as (
    select *, case when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10 then right(regexp_replace(phone, '\D', '', 'g'), 10) end as ph, lower(nullif(email, '')) as em from src
  ), email_phone as (
    select em, max(ph) as ph from p10 where em is not null and ph is not null group by em
  ), keyed as (
    select p10.*, coalesce(al.canonical_key, base.k) as ck
      from p10
      left join email_phone ep on ep.em = p10.em
      cross join lateral (select coalesce(p10.ph, ep.ph, p10.em) as k) base
      left join customer_aliases al on al.alias_key = base.k
  ), grouped as (
    select ck, (array_agg(name order by created_at desc) filter (where name is not null and name <> ''))[1] as name,
           (array_agg(phone order by created_at desc) filter (where phone is not null and phone <> ''))[1] as phone,
           (array_agg(email order by created_at desc) filter (where email is not null and email <> ''))[1] as email,
           count(*) filter (where kind = 'booking') as bookings, count(*) filter (where kind = 'enquiry') as enquiries, count(*) filter (where kind = 'order') as orders,
           sum(spent) as spent, array_agg(distinct service) as services, max(created_at) as last_at, min(created_at) as first_at
      from keyed where ck is not null group by ck
  ), found as (
    select * from grouped where coalesce(p_q, '') = '' or concat_ws(' ', name, phone, email) ilike '%' || p_q || '%'
  )
  select jsonb_build_object('total', (select count(*) from found),
    'rows', coalesce((select jsonb_agg(to_jsonb(r)) from (select * from found order by last_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) r), '[]'::jsonb))
$$;

-- One customer's whole history. The key is what the list gave (phone digits or e-mail); every identity linked to it is searched too.
create or replace function crm_customer(p_key text) returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare ids text[]; phones text[]; emails text[];
begin
  ids := array[lower(trim(p_key))] || coalesce((select array_agg(alias_key) from customer_aliases where canonical_key = any (array[lower(trim(p_key))] || coalesce((select array_agg(canonical_key) from customer_aliases where alias_key = lower(trim(p_key))), '{}'))), '{}')
         || coalesce((select array_agg(canonical_key) from customer_aliases where alias_key = lower(trim(p_key))), '{}');
  phones := array(select distinct i from unnest(ids) i where i ~ '^\d{10}$');
  emails := array(select distinct i from unnest(ids) i where i like '%@%');
  -- an e-mail seen together with one of these phones (or the other way round) is the same person
  emails := array(select distinct e from unnest(emails || coalesce((select array_agg(lower(x.email)) from (
      select contact_email as email, contact_phone as phone from flight_bookings union all select email, phone from enquiries union all select email, phone from cases) x
      where lower(x.email) is not null and right(regexp_replace(coalesce(x.phone, ''), '\D', '', 'g'), 10) = any (phones)), '{}')) e where e is not null);
  phones := array(select distinct ph from unnest(phones || coalesce((select array_agg(right(regexp_replace(x.phone, '\D', '', 'g'), 10)) from (
      select contact_email as email, contact_phone as phone from flight_bookings union all select email, phone from enquiries union all select email, phone from cases) x
      where length(regexp_replace(coalesce(x.phone, ''), '\D', '', 'g')) >= 10 and lower(x.email) = any (emails)), '{}')) ph where ph is not null);
  return jsonb_build_object(
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (
        select id, order_ref, status, amount_inr, route, travel_date, pnr, created_at, customer_name, contact_phone, contact_email from flight_bookings
         where right(regexp_replace(coalesce(contact_phone, ''), '\D', '', 'g'), 10) = any (phones) or lower(contact_email) = any (emails)) b), '[]'::jsonb),
    'enquiries', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
        select id, name, phone, email, topic, service, status, quoted_inr, final_inr, follow_up_at, created_at from enquiries
         where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = any (phones) or lower(email) = any (emails)) e), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (
        select id, case_ref, service, title, status, amount_inr, paid_inr, created_at from cases
         where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = any (phones) or lower(email) = any (emails)) c), '[]'::jsonb),
    'linked', ids);
end $$;


-- ======================================================= orders (cases) =======================================================
create or replace function crm_case_create(p jsonb, p_actor text) returns bigint language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  insert into cases (service, enquiry_id, customer_name, phone, email, title, status, travellers, travel_date, due_date, amount_inr, checklist, assigned_to, notes)
  values (p->>'service', nullif(p->>'enquiry_id', '')::bigint, p->>'customer_name', nullif(p->>'phone', ''), nullif(p->>'email', ''), nullif(p->>'title', ''),
          coalesce(nullif(p->>'status', ''), 'docs_pending'), coalesce(p->'travellers', '[]'::jsonb), nullif(p->>'travel_date', '')::date, nullif(p->>'due_date', '')::date,
          nullif(p->>'amount_inr', '')::numeric, coalesce(p->'checklist', '[]'::jsonb), nullif(p->>'assigned_to', ''), nullif(p->>'notes', ''))
  returning id into v_id;
  update cases set case_ref = 'PTC-' || lpad(v_id::text, 5, '0') where id = v_id;
  insert into crm_events (entity, entity_id, kind, actor, data) values ('case', v_id, 'created', p_actor, jsonb_build_object('service', p->>'service', 'title', p->>'title'));
  if nullif(p->>'enquiry_id', '') is not null then
    -- the enquiry it came from is now a won deal worth what this order is worth
    update enquiries set status = 'won', final_inr = coalesce(nullif(p->>'amount_inr', '')::numeric, final_inr) where id = (p->>'enquiry_id')::bigint and status <> 'won';
    insert into crm_events (entity, entity_id, kind, actor, data) values ('enquiry', (p->>'enquiry_id')::bigint, 'note', p_actor, jsonb_build_object('text', 'Order created: ' || 'PTC-' || lpad(v_id::text, 5, '0')));
  end if;
  return v_id;
end $$;

create or replace function crm_case_update(p_id bigint, p jsonb, p_actor text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare o cases%rowtype; ch jsonb := '{}'::jsonb; new_status text; done_before int; done_after int;
begin
  select * into o from cases where id = p_id for update;
  if not found then return jsonb_build_object('found', false); end if;
  new_status := nullif(p->>'status', '');
  if new_status is not null and new_status <> o.status then
    update cases set status = new_status where id = p_id;
    insert into crm_events (entity, entity_id, kind, actor, data) values ('case', p_id, 'status', p_actor, jsonb_build_object('from', o.status, 'to', new_status));
  end if;
  if p ? 'checklist' then
    select count(*) into done_before from jsonb_array_elements(o.checklist) x where (x->>'done')::boolean;
    select count(*) into done_after from jsonb_array_elements(p->'checklist') x where (x->>'done')::boolean;
    update cases set checklist = p->'checklist' where id = p_id;
    if done_after <> done_before then insert into crm_events (entity, entity_id, kind, actor, data) values ('case', p_id, 'checklist', p_actor, jsonb_build_object('done', done_after, 'total', jsonb_array_length(p->'checklist'))); end if;
  end if;
  if p ? 'title' and p->>'title' is distinct from o.title then ch := ch || jsonb_build_object('title', jsonb_build_array(o.title, p->>'title')); end if;
  if p ? 'due_date' and nullif(p->>'due_date', '')::date is distinct from o.due_date then ch := ch || jsonb_build_object('due_date', jsonb_build_array(o.due_date, nullif(p->>'due_date', ''))); end if;
  if p ? 'travel_date' and nullif(p->>'travel_date', '')::date is distinct from o.travel_date then ch := ch || jsonb_build_object('travel_date', jsonb_build_array(o.travel_date, nullif(p->>'travel_date', ''))); end if;
  if p ? 'amount_inr' and nullif(p->>'amount_inr', '')::numeric is distinct from o.amount_inr then ch := ch || jsonb_build_object('amount_inr', jsonb_build_array(o.amount_inr, nullif(p->>'amount_inr', ''))); end if;
  if p ? 'assigned_to' and nullif(p->>'assigned_to', '') is distinct from o.assigned_to then ch := ch || jsonb_build_object('assigned_to', jsonb_build_array(o.assigned_to, nullif(p->>'assigned_to', ''))); end if;
  update cases set
    title = case when p ? 'title' then nullif(p->>'title', '') else title end,
    due_date = case when p ? 'due_date' then nullif(p->>'due_date', '')::date else due_date end,
    travel_date = case when p ? 'travel_date' then nullif(p->>'travel_date', '')::date else travel_date end,
    amount_inr = case when p ? 'amount_inr' then nullif(p->>'amount_inr', '')::numeric else amount_inr end,
    assigned_to = case when p ? 'assigned_to' then nullif(p->>'assigned_to', '') else assigned_to end,
    travellers = case when p ? 'travellers' then p->'travellers' else travellers end,
    notes = case when p ? 'notes' then nullif(p->>'notes', '') else notes end
  where id = p_id;
  if ch <> '{}'::jsonb then insert into crm_events (entity, entity_id, kind, actor, data) values ('case', p_id, 'details', p_actor, ch); end if;
  if coalesce(p->>'note', '') <> '' then insert into crm_events (entity, entity_id, kind, actor, data) values ('case', p_id, 'note', p_actor, jsonb_build_object('text', p->>'note')); end if;
  return jsonb_build_object('found', true);
end $$;

-- A payment received for an order (cash, UPI, bank transfer, card machine...). paid_inr is always the sum of the list.
create or replace function crm_case_payment(p_id bigint, p jsonb, p_actor text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_amt numeric := (p->>'amount')::numeric; v_paid numeric; v_entry jsonb;
begin
  if v_amt is null or v_amt <= 0 then return jsonb_build_object('found', true, 'ok', false, 'error', 'amount'); end if;
  perform 1 from cases where id = p_id for update;
  if not found then return jsonb_build_object('found', false); end if;
  v_entry := jsonb_build_object('id', substr(md5(random()::text || clock_timestamp()::text), 1, 8), 'at', now(), 'amount', v_amt, 'mode', coalesce(nullif(p->>'mode', ''), 'cash'),
                                'ref', nullif(p->>'ref', ''), 'note', nullif(p->>'note', ''), 'by', p_actor);
  update cases set payments = payments || jsonb_build_array(v_entry),
                   paid_inr = (select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(payments || jsonb_build_array(v_entry)) x)
   where id = p_id returning paid_inr into v_paid;
  insert into crm_events (entity, entity_id, kind, actor, data) values ('case', p_id, 'payment_in', p_actor, jsonb_build_object('amount', v_amt, 'mode', v_entry->>'mode', 'ref', v_entry->>'ref'));
  return jsonb_build_object('found', true, 'ok', true, 'paid', v_paid);
end $$;

create or replace function crm_case_detail(p_id bigint) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('case', to_jsonb(c),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at, e.id) from crm_events e where e.entity = 'case' and e.entity_id = c.id), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'invoice_no', i.invoice_no, 'total', i.total, 'status', i.status, 'issued_on', i.issued_on) order by i.created_at desc) from invoices i where i.case_id = c.id), '[]'::jsonb))
  from cases c where c.id = p_id
$$;

-- ======================================================= invoices =======================================================
create or replace function crm_invoice_create(p jsonb, p_actor text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_day date := (now() at time zone 'Asia/Kolkata')::date; v_fy text; v_n int; v_lines jsonb; v_sub numeric; v_gst numeric := coalesce(nullif(p->>'gst_percent', '')::numeric, 0);
        v_gst_amt numeric; v_id bigint; v_no text;
begin
  -- recompute every line and the totals here: the totals on an invoice are never taken from the browser
  select coalesce(jsonb_agg(jsonb_build_object('desc', x->>'desc', 'qty', q, 'rate', r, 'amount', round(q * r, 2)) order by ord), '[]'::jsonb), coalesce(sum(round(q * r, 2)), 0)
    into v_lines, v_sub
    from (select x, ord, coalesce(nullif(x->>'qty', '')::numeric, 1) as q, (x->>'rate')::numeric as r from jsonb_array_elements(p->'lines') with ordinality t(x, ord)) l
   where coalesce(x->>'desc', '') <> '';
  if v_sub is null or jsonb_array_length(v_lines) = 0 or v_sub <= 0 then return jsonb_build_object('ok', false, 'error', 'lines'); end if;
  if v_gst < 0 or v_gst > 28 then return jsonb_build_object('ok', false, 'error', 'gst'); end if;
  v_gst_amt := round(v_sub * v_gst / 100, 2);
  v_fy := case when extract(month from v_day) >= 4 then extract(year from v_day)::int || '-' || lpad(((extract(year from v_day)::int + 1) % 100)::text, 2, '0')
               else (extract(year from v_day)::int - 1) || '-' || lpad((extract(year from v_day)::int % 100)::text, 2, '0') end;
  insert into invoice_counters (fy, n) values (v_fy, 1) on conflict (fy) do update set n = invoice_counters.n + 1 returning n into v_n;
  v_no := 'PT/' || v_fy || '/' || lpad(v_n::text, 4, '0');
  insert into invoices (invoice_no, issued_on, case_id, booking_id, customer_name, phone, email, address, customer_gstin, lines, subtotal, gst_percent, gst_amount, total, notes, created_by)
  values (v_no, v_day, nullif(p->>'case_id', '')::bigint, nullif(p->>'booking_id', '')::bigint, p->>'customer_name', nullif(p->>'phone', ''), nullif(p->>'email', ''), nullif(p->>'address', ''),
          nullif(upper(p->>'customer_gstin'), ''), v_lines, v_sub, v_gst, v_gst_amt, v_sub + v_gst_amt, nullif(p->>'notes', ''), p_actor)
  returning id into v_id;
  if nullif(p->>'case_id', '') is not null then insert into crm_events (entity, entity_id, kind, actor, data) values ('case', (p->>'case_id')::bigint, 'invoice', p_actor, jsonb_build_object('invoice_no', v_no, 'total', v_sub + v_gst_amt)); end if;
  if nullif(p->>'booking_id', '') is not null then insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', (p->>'booking_id')::bigint, 'invoice', p_actor, jsonb_build_object('invoice_no', v_no, 'total', v_sub + v_gst_amt)); end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'invoice_no', v_no, 'total', v_sub + v_gst_amt);
end $$;

create or replace function crm_invoice_cancel(p_id bigint, p_actor text, p_reason text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_no text;
begin
  update invoices set status = 'cancelled', notes = coalesce(notes || E'\n', '') || 'Cancelled by ' || p_actor || ': ' || left(coalesce(p_reason, ''), 200) where id = p_id and status = 'issued' returning invoice_no into v_no;
  if v_no is null then return jsonb_build_object('ok', false); end if;
  insert into crm_events (entity, entity_id, kind, actor, data) values ('invoice', p_id, 'cancelled', p_actor, jsonb_build_object('invoice_no', v_no, 'reason', left(coalesce(p_reason, ''), 200)));
  return jsonb_build_object('ok', true, 'invoice_no', v_no);
end $$;

-- ======================================================= alerts for the CRM tabs =======================================================
create or replace function crm_badges() returns jsonb language sql stable set search_path = public, pg_temp as $$
  with tz as (select (now() at time zone 'Asia/Kolkata')::date as today)
  select jsonb_build_object(
    'enquiriesNew', (select count(*) from enquiries where status = 'new'),
    'followupsDue', (select count(*) from enquiries where follow_up_at <= (select today from tz) and status in ('new', 'contacted', 'quoted')),
    'bookingsAttention', (select count(*) from flight_bookings where status in ('needs_attention', 'failed')),
    'casesDocs', (select count(*) from cases where status in ('docs_pending', 'docs_received')),
    'casesDue', (select count(*) from cases where due_date <= (select today from tz) + 2 and status not in ('delivered', 'rejected', 'cancelled')),
    'casesUnpaid', (select count(*) from cases where status in ('approved', 'delivered') and coalesce(amount_inr, 0) > paid_inr))
$$;

-- ======================================================= merging customers =======================================================
create or replace function crm_link_customers(p_a text, p_b text, p_actor text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare a text := lower(trim(p_a)); b text := lower(trim(p_b)); ca text; cb text;
begin
  if a = '' or b = '' or a = b then return jsonb_build_object('ok', false); end if;
  ca := coalesce((select canonical_key from customer_aliases where alias_key = a), a);
  cb := coalesce((select canonical_key from customer_aliases where alias_key = b), b);
  if ca = cb then return jsonb_build_object('ok', true, 'already', true); end if;
  insert into customer_aliases (alias_key, canonical_key, created_by) values (cb, ca, p_actor) on conflict (alias_key) do update set canonical_key = excluded.canonical_key;
  update customer_aliases set canonical_key = ca where canonical_key = cb;
  return jsonb_build_object('ok', true);
end $$;

-- Dashboard: every number in one query, aggregated in the database (no rows shipped to the server).
create or replace function crm_overview() returns jsonb language sql stable set search_path = public, pg_temp as $$
  with tz as (select (now() at time zone 'Asia/Kolkata')::date as today),
  b as (select status, amount_inr, markup_inr, created_at, (created_at at time zone 'Asia/Kolkata')::date as day from flight_bookings where created_at >= now() - interval '120 days'),
  e as (select status, (created_at at time zone 'Asia/Kolkata')::date as day from enquiries where created_at >= now() - interval '120 days'),
  days as (select generate_series((select today from tz) - 13, (select today from tz), interval '1 day')::date as day)
  select jsonb_build_object(
    'today', (select today from tz),
    'serviceSummary', crm_services_summary(),
    'bookings', (select jsonb_build_object(
        'ticketed', count(*) filter (where status = 'ticketed'),
        'attention', count(*) filter (where status in ('needs_attention', 'failed')),
        'pending', count(*) filter (where status = 'payment_pending'),
        'abandoned', count(*) filter (where status = 'payment_pending' and created_at < now() - interval '30 minutes'),
        'total', count(*),
        'revenueToday', coalesce(sum(amount_inr) filter (where status = 'ticketed' and day = (select today from tz)), 0),
        'revenue7', coalesce(sum(amount_inr) filter (where status = 'ticketed' and created_at >= now() - interval '7 days'), 0),
        'revenue30', coalesce(sum(amount_inr) filter (where status = 'ticketed' and created_at >= now() - interval '30 days'), 0),
        'markupToday', coalesce(sum(markup_inr) filter (where status = 'ticketed' and day = (select today from tz)), 0),
        'markup7', coalesce(sum(markup_inr) filter (where status = 'ticketed' and created_at >= now() - interval '7 days'), 0),
        'markup30', coalesce(sum(markup_inr) filter (where status = 'ticketed' and created_at >= now() - interval '30 days'), 0)) from b),
    'enquiries', (select jsonb_build_object(
        'new', count(*) filter (where status = 'new'), 'contacted', count(*) filter (where status = 'contacted'), 'quoted', count(*) filter (where status = 'quoted'),
        'won', count(*) filter (where status = 'won'), 'lost', count(*) filter (where status = 'lost'), 'total', count(*)) from e),
    'daily', (select jsonb_agg(jsonb_build_object('date', d.day,
        'bookings', (select count(*) from b where b.day = d.day and b.status = 'ticketed'),
        'revenue', (select coalesce(sum(amount_inr), 0) from b where b.day = d.day and b.status = 'ticketed'),
        'enquiries', (select count(*) from e where e.day = d.day)) order by d.day) from days d),
    'recentBookings', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (select id, order_ref, status, amount_inr, customer_name, route, created_at from flight_bookings order by created_at desc limit 8) r),
    'recentEnquiries', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (select id, name, phone, topic, status, created_at from enquiries order by created_at desc limit 8) r),
    'needsAttention', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (select id, order_ref, status, customer_name, route, contact_phone, created_at from flight_bookings where status in ('needs_attention', 'failed') order by created_at desc limit 10) r)
  )
$$;

-- Booking panel: the row, its timeline and its TBO calls in one trip (null when not found).
create or replace function crm_booking_detail(p_id bigint) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'booking', to_jsonb(b) - 'checkout_token',
    'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.initiated_at desc nulls last) from payments x where x.order_id = b.razorpay_order_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at, e.id) from crm_events e where e.entity = 'booking' and e.entity_id = b.id), '[]'::jsonb),
    'calls', case when b.trace_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'created_at', l.created_at, 'method', l.method, 'kind', l.kind) order by l.created_at, l.id)
              from (select id, created_at, method, kind from tbo_logs where trace_id = b.trace_id order by created_at, id limit 300) l), '[]'::jsonb) end)
  from flight_bookings b where b.id = p_id
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Payments. Exactly one caller (the customer's browser OR the Razorpay webhook) may start ticketing a paid booking:
-- the status flips payment_pending -> paid in ONE statement, and only the caller whose update changed a row gets 'claimed'.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function crm_claim_ticketing(p_ref text, p_payment text, p_paid numeric) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint; v_status text; v_pay text;
begin
  update flight_bookings set status = 'paid', payment_id = p_payment, paid_inr = p_paid
   where order_ref = p_ref and status = 'payment_pending' and (payment_id is null or payment_id = p_payment)
   returning id into v_id;
  if v_id is not null then
    insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, 'paid', 'system', jsonb_build_object('paymentId', p_payment, 'amount', p_paid));
    return jsonb_build_object('claimed', true, 'status', 'paid');
  end if;
  select status, payment_id into v_status, v_pay from flight_bookings where order_ref = p_ref;
  if not found then return jsonb_build_object('claimed', false, 'status', null); end if;
  return jsonb_build_object('claimed', false, 'status', v_status, 'paymentId', v_pay);
end $$;

-- The booking a Razorpay order belongs to, with the sealed checkout data (server only).
create or replace function crm_for_order(p_order text) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('order_ref', order_ref, 'status', status, 'amount_inr', amount_inr, 'payment_id', payment_id, 'checkout_token', checkout_token, 'env', env)
  from flight_bookings where razorpay_order_id = p_order
$$;

-- What the customer's browser (or a retry) should be shown for a booking that is already being / has been ticketed.
create or replace function crm_outcome(p_ref text) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('status', status, 'amount_inr', amount_inr, 'legs', legs, 'contact_email', contact_email, 'customer_name', customer_name, 'pnr', pnr) from flight_bookings where order_ref = p_ref
$$;

-- A webhook delivery seen for the first time returns true; a retry / replay returns false.
create or replace function crm_webhook_seen(p_event_id text, p_event text, p_payment text, p_order text) returns boolean language plpgsql set search_path = public, pg_temp as $$
begin
  insert into payment_events (event_id, event, payment_id, order_id) values (p_event_id, p_event, p_payment, p_order) on conflict (event_id) do nothing;
  return found;
end $$;

create or replace function crm_webhook_done(p_event_id text, p_outcome text) returns void language sql set search_path = public, pg_temp as $$
  update payment_events set outcome = left(p_outcome, 200) where event_id = p_event_id
$$;

-- A payment event worth showing on the booking's timeline (failed attempt, paid but could not be ticketed, refund).
create or replace function crm_payment_note(p_order text, p_kind text, p_data jsonb) returns void language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  select id into v_id from flight_bookings where razorpay_order_id = p_order;
  if v_id is not null then insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, p_kind, 'razorpay', coalesce(p_data, '{}'::jsonb)); end if;
end $$;

-- Paid, but the sealed checkout data had expired (the customer paid after the 15-minute hold): needs a person, probably a refund.
create or replace function crm_mark_unfulfilled(p_order text, p_payment text, p_paid numeric, p_reason text) returns void language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  update flight_bookings set status = 'needs_attention', payment_id = coalesce(payment_id, p_payment), paid_inr = coalesce(paid_inr, p_paid), checkout_token = null
   where razorpay_order_id = p_order and status = 'payment_pending' returning id into v_id;
  if v_id is not null then
    insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, 'failed', 'razorpay', jsonb_build_object('status', 'needs_attention', 'errors', jsonb_build_array(p_reason), 'paymentId', p_payment));
  end if;
end $$;

-- Settings kept in site_content (key, value): read and written only by the server. Used for the price markup.
create or replace function crm_get_setting(p_key text) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('value', value, 'updated_at', updated_at) from site_content where key = p_key
$$;

create or replace function crm_set_setting(p_key text, p_value jsonb) returns void language sql set search_path = public, pg_temp as $$
  insert into site_content (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now()
$$;

-- Bookings still "awaiting payment" 20 minutes to 3 days after they started: the daily check asks Razorpay whether any were actually paid.
create or replace function crm_stale_pending(p_limit int) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('order_ref', order_ref, 'razorpay_order_id', razorpay_order_id, 'amount_inr', amount_inr)), '[]'::jsonb)
  from (select order_ref, razorpay_order_id, amount_inr from flight_bookings
         where status = 'payment_pending' and razorpay_order_id is not null and razorpay_order_id not like 'test\_%'
           and created_at < now() - interval '20 minutes' and created_at > now() - interval '3 days'
         order by created_at limit least(greatest(p_limit, 1), 50)) x
$$;

-- What a refund needs to know (staff only, called from the CRM).
create or replace function crm_booking_for_refund(p_id bigint) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('id', id, 'order_ref', order_ref, 'status', status, 'payment_id', payment_id, 'paid_inr', paid_inr, 'refunded_inr', refunded_inr, 'env', env)
  from flight_bookings where id = p_id
$$;

-- A refund Razorpay accepted (or later confirmed): once per refund id, adds to refunded_inr, marks 'refunded' when all of it is back.
create or replace function crm_record_refund(p jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint; v_paid numeric; v_refunded numeric; v_amount numeric := (p->>'amount_inr')::numeric;
begin
  select id, paid_inr into v_id, v_paid from flight_bookings
   where (p->>'order_ref' is not null and order_ref = p->>'order_ref') or (p->>'order_ref' is null and payment_id = p->>'payment_id') for update;
  if not found then return jsonb_build_object('found', false); end if;
  if exists (select 1 from crm_events where entity = 'booking' and entity_id = v_id and kind = 'refund' and data->>'refundId' = p->>'refund_id') then
    return jsonb_build_object('found', true, 'duplicate', true);
  end if;
  update flight_bookings set refunded_inr = refunded_inr + v_amount where id = v_id returning refunded_inr into v_refunded;
  if v_paid is not null and v_refunded >= v_paid then update flight_bookings set status = 'refunded' where id = v_id; end if;
  update payments set refunded_inr = v_refunded, status = case when v_paid is not null and v_refunded >= v_paid then 'refunded' else 'partially_refunded' end, updated_at = now()
   where payment_id = (select payment_id from flight_bookings where id = v_id);
  insert into crm_events (entity, entity_id, kind, actor, data)
  values ('booking', v_id, 'refund', coalesce(p->>'actor', 'razorpay'), jsonb_build_object('refundId', p->>'refund_id', 'amount', v_amount, 'reason', p->>'reason', 'status', p->>'status'));
  return jsonb_build_object('found', true, 'duplicate', false, 'refunded', v_refunded, 'full', v_paid is not null and v_refunded >= v_paid);
end $$;

-- Record what Razorpay says about one payment (insert, or move it forward: a payment never goes back to an earlier status).
create or replace function crm_upsert_payment(p jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_old payments%rowtype; v_new text := p->>'status'; v_ref text; v_bid bigint; v_changed boolean := false;
  v_rank jsonb := '{"created":1,"failed":2,"authorized":3,"captured":4,"partially_refunded":5,"refunded":6}';
  v_at timestamptz := coalesce(nullif(p->>'event_at', '')::timestamptz, now());
begin
  if coalesce(p->>'payment_id', '') = '' or v_new is null then return jsonb_build_object('ok', false); end if;
  select order_ref, id into v_ref, v_bid from flight_bookings where razorpay_order_id = p->>'order_id';
  select * into v_old from payments where payment_id = p->>'payment_id' for update;
  if not found then
    insert into payments (payment_id, order_id, order_ref, status, method, amount_inr, currency, vpa, upi_ref, bank_ref, card_network, card_type, card_last4, card_issuer, bank, wallet,
      email, contact, fee_inr, tax_inr, error_code, error_description, error_reason, error_step, initiated_at, authorized_at, captured_at, failed_at, source)
    values (p->>'payment_id', p->>'order_id', v_ref, v_new, p->>'method', (p->>'amount_inr')::numeric, p->>'currency', nullif(p->>'vpa', ''), nullif(p->>'upi_ref', ''), nullif(p->>'bank_ref', ''),
      p->>'card_network', p->>'card_type', p->>'card_last4', p->>'card_issuer', p->>'bank', p->>'wallet', p->>'email', p->>'contact', (p->>'fee_inr')::numeric, (p->>'tax_inr')::numeric,
      p->>'error_code', left(p->>'error_description', 300), p->>'error_reason', p->>'error_step', nullif(p->>'initiated_at', '')::timestamptz,
      case when v_new in ('authorized', 'captured') then v_at end, case when v_new = 'captured' then v_at end, case when v_new = 'failed' then v_at end, p->>'source');
    v_changed := true;
  else
    update payments set
      order_ref = coalesce(order_ref, v_ref),
      status = case when (v_rank->>v_new)::int > (v_rank->>v_old.status)::int then v_new else status end,
      method = coalesce(p->>'method', method), vpa = coalesce(nullif(p->>'vpa', ''), vpa), upi_ref = coalesce(nullif(p->>'upi_ref', ''), upi_ref), bank_ref = coalesce(nullif(p->>'bank_ref', ''), bank_ref),
      card_network = coalesce(p->>'card_network', card_network), card_type = coalesce(p->>'card_type', card_type), card_last4 = coalesce(p->>'card_last4', card_last4),
      card_issuer = coalesce(p->>'card_issuer', card_issuer), bank = coalesce(p->>'bank', bank), wallet = coalesce(p->>'wallet', wallet),
      email = coalesce(p->>'email', email), contact = coalesce(p->>'contact', contact),
      fee_inr = coalesce((p->>'fee_inr')::numeric, fee_inr), tax_inr = coalesce((p->>'tax_inr')::numeric, tax_inr),
      error_code = coalesce(p->>'error_code', error_code), error_description = coalesce(left(p->>'error_description', 300), error_description),
      error_reason = coalesce(p->>'error_reason', error_reason), error_step = coalesce(p->>'error_step', error_step),
      initiated_at = coalesce(initiated_at, nullif(p->>'initiated_at', '')::timestamptz),
      authorized_at = coalesce(authorized_at, case when v_new in ('authorized', 'captured') then v_at end),
      captured_at = coalesce(captured_at, case when v_new = 'captured' then v_at end),
      failed_at = coalesce(failed_at, case when v_new = 'failed' then v_at end),
      updated_at = now()
    where payment_id = p->>'payment_id';
    v_changed := (v_rank->>v_new)::int > (v_rank->>v_old.status)::int;
  end if;
  if v_changed and v_bid is not null then
    insert into crm_events (entity, entity_id, kind, actor, data)
    values ('booking', v_bid, 'payment', coalesce(p->>'source', 'razorpay'), jsonb_build_object('paymentId', p->>'payment_id', 'status', v_new, 'method', p->>'method', 'vpa', nullif(p->>'vpa', ''), 'amount', (p->>'amount_inr')::numeric, 'error', left(p->>'error_description', 200)));
  end if;
  return jsonb_build_object('ok', true, 'changed', v_changed);
end $$;

-- All payment attempts of one booking (by its Razorpay order), newest first.
create or replace function crm_booking_payments(p_order text) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.initiated_at desc nulls last), '[]'::jsonb) from payments x where x.order_id = p_order
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Customer accounts ("My trips"). The API passes the user id from the VERIFIED login token, and the e-mail only
-- when that e-mail is verified, so a customer sees their own bookings and nobody else's. Only customer-safe
-- columns come back: no staff notes, assignee, internal status history or TBO error text.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function acct_bookings(p_user uuid, p_email text) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
    select b.order_ref, b.created_at, b.status, b.amount_inr, b.route, b.journey, b.travel_date, b.return_date, b.pax_count, b.pnr, b.customer_name, b.env
    from flight_bookings b
    where p_user is not null and (b.user_id = p_user or (nullif(p_email, '') is not null and lower(b.contact_email) = lower(p_email)))
    order by b.created_at desc limit 60
  ) x
$$;

create or replace function acct_booking(p_user uuid, p_email text, p_ref text) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'booking', jsonb_build_object(
      'order_ref', b.order_ref, 'created_at', b.created_at, 'status', b.status, 'amount_inr', b.amount_inr, 'route', b.route, 'journey', b.journey,
      'travel_date', b.travel_date, 'return_date', b.return_date, 'pax_count', b.pax_count, 'pnr', b.pnr, 'customer_name', b.customer_name, 'env', b.env,
      'contact_email', b.contact_email, 'contact_phone', b.contact_phone,
      'pax', (select coalesce(jsonb_agg(jsonb_build_object('type', x->>'type', 'name', x->>'name', 'ticket', x->>'ticket')), '[]'::jsonb) from jsonb_array_elements(b.pax) x),
      'legs', (select coalesce(jsonb_agg(jsonb_build_object('pnr', l->>'pnr', 'bookingId', l->'bookingId', 'details', l->'details')), '[]'::jsonb) from jsonb_array_elements(b.legs) l)),
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'created_at', e.created_at,
                                                            'data', case when e.kind in ('cancel_requested', 'change_requested') then e.data else null end) order by e.created_at, e.id)
                        from crm_events e where e.entity = 'booking' and e.entity_id = b.id
                         and e.kind in ('created', 'paid', 'payment_failed', 'ticketed', 'failed', 'cancel_requested', 'change_requested')), '[]'::jsonb))
  from flight_bookings b
  where p_user is not null and b.order_ref = p_ref and (b.user_id = p_user or (nullif(p_email, '') is not null and lower(b.contact_email) = lower(p_email)))
$$;

-- A customer's cancellation / date-change request from "My trips" (sent to TBO first; this keeps the TBO change request ids
-- on the booking's timeline so the status can be checked and the CRM sees it). Same ownership rule as acct_booking.
create or replace function acct_add_event(p_user uuid, p_email text, p_ref text, p_kind text, p_data jsonb) returns boolean language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if p_kind not in ('cancel_requested', 'change_requested') then return false; end if;
  select b.id into v_id from flight_bookings b
   where p_user is not null and b.order_ref = p_ref and (b.user_id = p_user or (nullif(p_email, '') is not null and lower(b.contact_email) = lower(p_email)));
  if v_id is null then return false; end if;
  insert into crm_events (entity, entity_id, kind, actor, data) values ('booking', v_id, p_kind, 'customer', coalesce(p_data, '{}'::jsonb));
  return true;
end $$;

-- Staff edit (status / assignee / note) for a booking or an enquiry: change + timeline in one transaction.
create or replace function crm_apply_update(p_entity text, p_id bigint, p_status text, p_assigned text, p_set_assigned boolean, p_note text, p_actor text) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare cur_status text; cur_assigned text;
begin
  if p_entity = 'booking' then select status, assigned_to into cur_status, cur_assigned from flight_bookings where id = p_id for update;
  elsif p_entity = 'enquiry' then select status, assigned_to into cur_status, cur_assigned from enquiries where id = p_id for update;
  else raise exception 'bad entity'; end if;
  if not found then return jsonb_build_object('found', false); end if;
  if p_status is not null and p_status <> cur_status then
    if p_entity = 'booking' then update flight_bookings set status = p_status where id = p_id; else update enquiries set status = p_status where id = p_id; end if;
    insert into crm_events (entity, entity_id, kind, actor, data) values (p_entity, p_id, 'status', p_actor, jsonb_build_object('from', cur_status, 'to', p_status));
  end if;
  if p_set_assigned and coalesce(p_assigned, '') <> coalesce(cur_assigned, '') then
    if p_entity = 'booking' then update flight_bookings set assigned_to = nullif(p_assigned, '') where id = p_id; else update enquiries set assigned_to = nullif(p_assigned, '') where id = p_id; end if;
    insert into crm_events (entity, entity_id, kind, actor, data) values (p_entity, p_id, 'assigned', p_actor, jsonb_build_object('from', cur_assigned, 'to', nullif(p_assigned, '')));
  end if;
  if coalesce(p_note, '') <> '' then
    insert into crm_events (entity, entity_id, kind, actor, data) values (p_entity, p_id, 'note', p_actor, jsonb_build_object('text', p_note));
  end if;
  return jsonb_build_object('found', true);
end $$;

-- TBO traces: grouped in the database (60 rows back instead of 1,500).
create or replace function crm_traces(p_limit int, p_days int) returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(t order by t."at" desc), '[]'::jsonb) from (
    select l.trace_id as "traceId",
           count(*) filter (where l.kind = 'request') as calls,
           array_agg(distinct l.method) as methods,
           min(l.created_at) as "at", max(l.created_at) as last,
           (select jsonb_build_object('id', b.id, 'order_ref', b.order_ref, 'status', b.status) from flight_bookings b where b.trace_id = l.trace_id limit 1) as booking
    from tbo_logs l
    where l.trace_id is not null and l.created_at >= now() - make_interval(days => p_days)
    group by l.trace_id order by min(l.created_at) desc limit p_limit
  ) t
$$;

-- Housekeeping, run daily by the cron job (and by the Settings clean-up button): keeps the free 500 MB database small
-- and honours the Privacy Policy (enquiries that did not become a booking go after 12 months; "won" ones stay).
create or replace function crm_cleanup(p_log_days int, p_enq_months int) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare n_logs bigint := 0; n_enq bigint := 0; ids bigint[];
begin
  if p_log_days is not null then
    delete from tbo_logs where created_at < now() - make_interval(days => p_log_days);
    get diagnostics n_logs = row_count;
  end if;
  if p_enq_months is not null then
    select array_agg(id) into ids from enquiries where created_at < now() - make_interval(months => p_enq_months) and status <> 'won';
    if ids is not null then
      delete from crm_events where entity = 'enquiry' and entity_id = any(ids);
      delete from enquiries where id = any(ids);
      n_enq := array_length(ids, 1);
    end if;
  end if;
  update flight_bookings set checkout_token = null where checkout_token is not null and created_at < now() - interval '1 day';
  delete from payment_events where received_at < now() - interval '90 days';
  return jsonb_build_object('tboLogsDeleted', n_logs, 'enquiriesDeleted', n_enq);
end $$;

-- enquiries that arrived before the service column existed
update enquiries set service = crm_service_of(topic) where service is null;

-- ---- lock everything to the server's secret key (service_role) only ----
revoke all on table tbo_logs, flight_bookings, enquiries, crm_events, site_content, payment_events, payments, cases, invoices, invoice_counters, customer_aliases from anon, authenticated;
revoke all on sequence cases_id_seq, invoices_id_seq from anon, authenticated;
revoke all on sequence tbo_logs_id_seq, flight_bookings_id_seq, enquiries_id_seq, crm_events_id_seq from anon, authenticated;
revoke all on function crm_record_checkout(jsonb), crm_record_paid(text, text), crm_record_payment_failed(text, text), crm_record_outcome(jsonb), crm_add_enquiry(jsonb),
  crm_overview(), crm_booking_detail(bigint), crm_apply_update(text, bigint, text, text, boolean, text, text), crm_traces(int, int), crm_cleanup(int, int), set_updated_at(),
  acct_bookings(uuid, text), acct_booking(uuid, text, text), acct_add_event(uuid, text, text, text, jsonb),
  crm_claim_ticketing(text, text, numeric), crm_for_order(text), crm_outcome(text), crm_webhook_seen(text, text, text, text), crm_webhook_done(text, text),
  crm_payment_note(text, text, jsonb), crm_mark_unfulfilled(text, text, numeric, text), crm_booking_for_refund(bigint), crm_record_refund(jsonb), crm_stale_pending(int), crm_get_setting(text), crm_set_setting(text, jsonb), crm_upsert_payment(jsonb), crm_booking_payments(text),
  crm_service_of(text), crm_services_summary(), crm_staff_add_enquiry(jsonb, text), crm_enquiry_fields(bigint, jsonb, text), crm_customers(text, int, int), crm_customer(text),
  crm_case_create(jsonb, text), crm_case_update(bigint, jsonb, text), crm_case_payment(bigint, jsonb, text), crm_case_detail(bigint), crm_invoice_create(jsonb, text), crm_invoice_cancel(bigint, text, text), crm_badges(), crm_link_customers(text, text, text)
  from public, anon, authenticated;
grant execute on function crm_record_checkout(jsonb), crm_record_paid(text, text), crm_record_payment_failed(text, text), crm_record_outcome(jsonb), crm_add_enquiry(jsonb),
  crm_overview(), crm_booking_detail(bigint), crm_apply_update(text, bigint, text, text, boolean, text, text), crm_traces(int, int), crm_cleanup(int, int),
  acct_bookings(uuid, text), acct_booking(uuid, text, text), acct_add_event(uuid, text, text, text, jsonb),
  crm_claim_ticketing(text, text, numeric), crm_for_order(text), crm_outcome(text), crm_webhook_seen(text, text, text, text), crm_webhook_done(text, text),
  crm_payment_note(text, text, jsonb), crm_mark_unfulfilled(text, text, numeric, text), crm_booking_for_refund(bigint), crm_record_refund(jsonb), crm_stale_pending(int), crm_get_setting(text), crm_set_setting(text, jsonb), crm_upsert_payment(jsonb), crm_booking_payments(text),
  crm_service_of(text), crm_services_summary(), crm_staff_add_enquiry(jsonb, text), crm_enquiry_fields(bigint, jsonb, text), crm_customers(text, int, int), crm_customer(text),
  crm_case_create(jsonb, text), crm_case_update(bigint, jsonb, text), crm_case_payment(bigint, jsonb, text), crm_case_detail(bigint), crm_invoice_create(jsonb, text), crm_invoice_cancel(bigint, text, text), crm_badges(), crm_link_customers(text, text, text) to service_role;