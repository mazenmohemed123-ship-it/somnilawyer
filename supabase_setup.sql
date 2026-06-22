-- ============================================================================
--  Somni Lawyer (Somni Lawyer) — Complete Supabase setup
--  Run ONCE on a fresh Supabase project (SQL Editor).
--  Includes: Somni Lawyer schema + somni-chat schema (with case_id / office_id links),
--  indexes, functions, triggers, RLS, grants, realtime publication, storage buckets.
--  No legacy `messages` / `message_attachments` tables — chat is somni-chat only.
-- ============================================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================================
--  ENUM TYPES
-- ============================================================================
do $$ begin
  create type user_role as enum ('owner','partner','lawyer','assistant','secretary','accountant','client','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('free','pro','team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appt_status as enum ('pending','accepted','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;

-- somni-chat enums
do $$ begin create type conversation_type as enum ('direct','group','channel','support','ai'); exception when duplicate_object then null; end $$;
do $$ begin create type conversation_status as enum ('active','archived','deleted'); exception when duplicate_object then null; end $$;
do $$ begin create type participant_role as enum ('owner','admin','member','guest','bot'); exception when duplicate_object then null; end $$;
do $$ begin create type participant_status as enum ('active','left','banned','invited'); exception when duplicate_object then null; end $$;
do $$ begin create type message_type as enum ('text','attachment','system','reply','ai'); exception when duplicate_object then null; end $$;
do $$ begin create type message_status as enum ('pending','sent','delivered','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type attachment_file_type as enum ('image','video','audio','document','other'); exception when duplicate_object then null; end $$;
do $$ begin create type presence_status as enum ('online','away','busy','offline'); exception when duplicate_object then null; end $$;

-- ============================================================================
--  MOHKAM CORE TABLES
-- ============================================================================

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  role                     user_role not null default 'lawyer',
  tier                     plan_tier not null default 'free',
  full_name                text,
  avatar_url               text,
  bio                      text,
  phone                    text,
  email                    text,
  language                 text not null default 'ar',
  currency                 text not null default 'EGP',
  master_lawyer_id         uuid references public.profiles(id) on delete set null,
  can_view_billing         boolean not null default false,
  can_manage_appointments  boolean not null default false,
  can_edit_documents       boolean not null default false,
  can_reply_client_chats   boolean not null default false,
  fcm_token                text,
  emergency_enabled        boolean not null default true,
  frozen                   boolean not null default false,
  tier_expires_at          timestamptz,
  vodafone_cash            text,
  instapay                 text,
  bank_account             text,
  payment_qr_url           text,
  created_at               timestamptz not null default now()
);
create index if not exists idx_profiles_master on public.profiles(master_lawyer_id);
create index if not exists idx_profiles_email on public.profiles(lower(email));

-- ─── CASES ───────────────────────────────────────────────────────────────────
create table if not exists public.cases (
  id              uuid primary key default gen_random_uuid(),
  lawyer_id       uuid not null references public.profiles(id) on delete cascade,
  case_number     text,
  client_name     text,
  client_phone    text,
  case_type       text,
  verdict         text,
  fees            numeric,
  expenses        numeric,
  follower_phones text[] not null default '{}',
  extra           jsonb not null default '{}',
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_cases_lawyer on public.cases(lawyer_id);
create index if not exists idx_cases_phone on public.cases(client_phone);
create index if not exists idx_cases_followers on public.cases using gin(follower_phones);

-- ─── CASE EVENTS (permanent timeline; appointments never disappear) ───────────
create table if not exists public.case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references public.cases(id) on delete cascade,
  lawyer_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'note',
  title       text not null,
  body        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_case_events_case on public.case_events(case_id);
create index if not exists idx_case_events_lawyer on public.case_events(lawyer_id);

-- ─── CASE EMERGENCIES ─────────────────────────────────────────────────────────
create table if not exists public.case_emergencies (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references public.cases(id) on delete cascade,
  lawyer_id   uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid,
  note        text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_emergencies_lawyer on public.case_emergencies(lawyer_id);

-- ─── APPOINTMENT REQUESTS ─────────────────────────────────────────────────────
create table if not exists public.appointment_requests (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid references public.cases(id) on delete set null,
  lawyer_id     uuid not null references public.profiles(id) on delete cascade,
  client_id     uuid,
  client_name   text,
  requested_at  timestamptz not null,
  status        appt_status not null default 'pending',
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_appts_lawyer on public.appointment_requests(lawyer_id);
create index if not exists idx_appts_status on public.appointment_requests(lawyer_id, status);

-- ─── DOCUMENTS ────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid references public.cases(id) on delete cascade,
  lawyer_id     uuid not null references public.profiles(id) on delete cascade,
  uploader_id   uuid references public.profiles(id) on delete set null,
  name          text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_documents_case on public.documents(case_id);
create index if not exists idx_documents_lawyer_day on public.documents(lawyer_id, created_at);

-- ─── LAWYER AVAILABILITY ──────────────────────────────────────────────────────
create table if not exists public.lawyer_availability (
  lawyer_id   uuid not null references public.profiles(id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  enabled     boolean not null default true,
  start_time  time not null default '09:00',
  end_time    time not null default '17:00',
  primary key (lawyer_id, weekday)
);

-- ─── MEMBERSHIPS (office staff links; master_lawyer_id is the source of truth) ─
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.profiles(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  role        user_role not null default 'secretary',
  created_at  timestamptz not null default now(),
  unique (office_id, member_id)
);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  lawyer_id       uuid references public.profiles(id) on delete set null,
  payer_id        uuid,
  case_id         uuid references public.cases(id) on delete set null,
  kind            text not null default 'subscription', -- subscription | case_payment
  tier            plan_tier,
  amount          numeric not null,
  currency        text not null default 'EGP',
  status          payment_status not null default 'pending',
  coupon_code     text,
  provider        text not null default 'paymob',
  provider_ref    text,
  months          int default 1,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);
create index if not exists idx_payments_lawyer on public.payments(lawyer_id);
create index if not exists idx_payments_status on public.payments(status);

-- ─── COUPONS ─────────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  percent     int not null check (percent between 1 and 100),
  max_uses    int not null default 100,
  used_count  int not null default 0,
  tier        plan_tier,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ─── AI USAGE (daily caps to protect the HF token) ────────────────────────────
create table if not exists public.ai_usage_daily (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  day       date not null default current_date,
  task      text not null,
  count     int not null default 0,
  primary key (user_id, day, task)
);

-- ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  audience    text not null default 'all' check (audience in ('all','lawyers')),
  created_at  timestamptz not null default now()
);

-- ============================================================================
--  SOMNI-CHAT TABLES (with Somni Lawyer link columns: case_id / office_id)
-- ============================================================================

create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  type                 conversation_type not null,
  title                text,
  description          text,
  avatar_url           text,
  status               conversation_status not null default 'active',
  case_id              uuid references public.cases(id) on delete set null,   -- Somni Lawyer link
  office_id            uuid references public.profiles(id) on delete set null,-- Somni Lawyer link (= master_lawyer_id)
  metadata             jsonb not null default '{}',
  created_by           text not null,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);
create index if not exists idx_conversations_case on public.conversations(case_id);
create index if not exists idx_conversations_office on public.conversations(office_id);

create table if not exists public.participants (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references public.conversations(id) on delete cascade,
  user_id               text not null,
  role                  participant_role not null default 'member',
  status                participant_status not null default 'active',
  joined_at             timestamptz not null default now(),
  last_read_at          timestamptz,
  last_read_message_id  uuid,
  notifications_muted   boolean not null default false,
  metadata              jsonb not null default '{}'
);
create unique index if not exists idx_participants_unique on public.participants(conversation_id, user_id);
create index if not exists idx_participants_user_id on public.participants(user_id);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        text not null,
  type             message_type not null default 'text',
  content          text not null,
  status           message_status not null default 'sent',
  client_id        uuid not null,
  reply_to_id      uuid references public.messages(id) on delete set null,
  reply_to_preview text,
  created_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  read_at          timestamptz,
  edited_at        timestamptz,
  deleted_at       timestamptz,
  metadata         jsonb not null default '{}'
);
create unique index if not exists idx_messages_client_id on public.messages(conversation_id, client_id);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at desc);

create table if not exists public.attachments (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null references public.messages(id) on delete cascade,
  file_url         text not null,
  file_name        text not null,
  file_type        attachment_file_type not null default 'other',
  mime_type        text not null,
  file_size        bigint not null,
  thumbnail_url    text,
  width            integer,
  height           integer,
  duration_seconds numeric,
  created_at       timestamptz not null default now()
);
create index if not exists idx_attachments_message_id on public.attachments(message_id);

create table if not exists public.reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     text not null,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.user_presence (
  user_id      text primary key,
  status       presence_status not null default 'offline',
  last_seen_at timestamptz not null default now(),
  device       text,
  metadata     jsonb not null default '{}'
);

create table if not exists public.typing_indicators (
  conversation_id text not null,
  user_id         text not null,
  started_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- keep conversations.last_message_* fresh
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.content, 100),
         updated_at = now()
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_update_conversation_last_message on public.messages;
create trigger trg_update_conversation_last_message
after insert on public.messages
for each row execute function public.update_conversation_last_message();

-- ============================================================================
--  TRIGGER FUNCTIONS (internal — never callable from the API)
-- ============================================================================

-- Auto-create a profile when a new auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email, full_name)
  values (
    new.id,
    case when coalesce(new.is_anonymous, false) then 'client'::user_role
         else coalesce((new.raw_user_meta_data->>'role')::user_role, 'owner'::user_role) end,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
--  PUBLIC RPC FUNCTIONS (SECURITY DEFINER, fixed search_path)
-- ============================================================================

-- Office access gate for clients (callable by anon — visitor not signed in yet).
create or replace function public.check_office_access(p_lawyer_id uuid, p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases c
    where c.lawyer_id = p_lawyer_id
      and (
        c.client_phone = p_phone
        or p_phone = any(c.follower_phones)
      )
  );
$$;

-- Returns the matched case for a phone within an office (used right after gate).
create or replace function public.client_case_for_phone(p_lawyer_id uuid, p_phone text)
returns setof public.cases
language sql
security definer
set search_path = public
as $$
  select * from public.cases c
  where c.lawyer_id = p_lawyer_id
    and (c.client_phone = p_phone or p_phone = any(c.follower_phones))
  order by c.created_at desc
  limit 1;
$$;

-- Secure read-receipts: mark a conversation read for the caller.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.participants
    where conversation_id = p_conversation_id and user_id = auth.uid()::text
  ) then
    raise exception 'not a participant';
  end if;

  update public.participants
     set last_read_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid()::text;

  update public.messages
     set read_at = now(), status = 'delivered'
   where conversation_id = p_conversation_id
     and sender_id <> auth.uid()::text
     and read_at is null;
end $$;

-- Admin broadcast (verifies admin email from the JWT).
create or replace function public.post_announcement(p_title text, p_body text, p_audience text)
returns public.announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_row public.announcements;
begin
  if v_email not in ('mazenmohemed123@gmail.com')
     and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;
  insert into public.announcements (title, body, audience)
  values (p_title, p_body, coalesce(p_audience,'all'))
  returning * into v_row;
  return v_row;
end $$;

-- Atomic coupon counter (called by the paymob webhook with the service role).
create or replace function public.increment_coupon(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set used_count = used_count + 1 where code = upper(p_code);
$$;

-- Helper: is the current user an office member (or the owner) of an office?
create or replace function public.is_office_member(p_office uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (id = p_office or master_lawyer_id = p_office)
  );
$$;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.cases               enable row level security;
alter table public.case_events         enable row level security;
alter table public.case_emergencies    enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.documents           enable row level security;
alter table public.lawyer_availability enable row level security;
alter table public.memberships         enable row level security;
alter table public.payments            enable row level security;
alter table public.coupons             enable row level security;
alter table public.ai_usage_daily      enable row level security;
alter table public.announcements       enable row level security;
alter table public.conversations       enable row level security;
alter table public.participants        enable row level security;
alter table public.messages            enable row level security;
alter table public.attachments         enable row level security;
alter table public.reactions           enable row level security;
alter table public.user_presence       enable row level security;
alter table public.typing_indicators   enable row level security;

-- ---- PROFILES ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or master_lawyer_id = auth.uid()                 -- owner sees staff
  or id = (select master_lawyer_id from public.profiles me where me.id = auth.uid()) -- staff sees owner
  or role in ('owner','lawyer','partner','assistant','secretary','accountant')       -- lawyer cards (office link)
  or exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin')
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = auth.uid() or master_lawyer_id = auth.uid()
       or exists (select 1 from public.profiles a where a.id = auth.uid() and a.role='admin'))
with check (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
with check (id = auth.uid());

-- ---- CASES ---- (office members manage; clients read their own via portal RPCs)
drop policy if exists cases_all on public.cases;
create policy cases_all on public.cases for all to authenticated
using (public.is_office_member(lawyer_id))
with check (public.is_office_member(lawyer_id));

-- ---- CASE EVENTS ----
drop policy if exists case_events_all on public.case_events;
create policy case_events_all on public.case_events for all to authenticated
using (public.is_office_member(lawyer_id))
with check (public.is_office_member(lawyer_id));

-- ---- CASE EMERGENCIES ---- (clients may insert; office reads)
drop policy if exists emergencies_select on public.case_emergencies;
create policy emergencies_select on public.case_emergencies for select to authenticated
using (public.is_office_member(lawyer_id) or client_id = auth.uid());
drop policy if exists emergencies_insert on public.case_emergencies;
create policy emergencies_insert on public.case_emergencies for insert to authenticated
with check (client_id = auth.uid() or public.is_office_member(lawyer_id));
drop policy if exists emergencies_update on public.case_emergencies;
create policy emergencies_update on public.case_emergencies for update to authenticated
using (public.is_office_member(lawyer_id));

-- ---- APPOINTMENT REQUESTS ---- (clients insert; office manages)
drop policy if exists appts_select on public.appointment_requests;
create policy appts_select on public.appointment_requests for select to authenticated
using (public.is_office_member(lawyer_id) or client_id = auth.uid());
drop policy if exists appts_insert on public.appointment_requests;
create policy appts_insert on public.appointment_requests for insert to authenticated
with check (client_id = auth.uid() or public.is_office_member(lawyer_id));
drop policy if exists appts_update on public.appointment_requests;
create policy appts_update on public.appointment_requests for update to authenticated
using (public.is_office_member(lawyer_id));

-- ---- DOCUMENTS ----
drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents for all to authenticated
using (public.is_office_member(lawyer_id))
with check (public.is_office_member(lawyer_id));

-- ---- LAWYER AVAILABILITY ---- (office manages; clients can read to book)
drop policy if exists availability_select on public.lawyer_availability;
create policy availability_select on public.lawyer_availability for select to authenticated using (true);
drop policy if exists availability_write on public.lawyer_availability;
create policy availability_write on public.lawyer_availability for all to authenticated
using (public.is_office_member(lawyer_id))
with check (public.is_office_member(lawyer_id));

-- ---- MEMBERSHIPS ----
drop policy if exists memberships_all on public.memberships;
create policy memberships_all on public.memberships for all to authenticated
using (public.is_office_member(office_id))
with check (public.is_office_member(office_id));

-- ---- PAYMENTS ---- (office views own; clients view their own)
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
using (public.is_office_member(lawyer_id) or payer_id = auth.uid()
       or exists (select 1 from public.profiles a where a.id = auth.uid() and a.role='admin'));
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
with check (payer_id = auth.uid() or public.is_office_member(lawyer_id));

-- ---- COUPONS ---- (readable by authenticated to validate; only admin writes)
drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons for select to authenticated using (true);
drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all to authenticated
using (exists (select 1 from public.profiles a where a.id = auth.uid() and a.role='admin'))
with check (exists (select 1 from public.profiles a where a.id = auth.uid() and a.role='admin'));

-- ---- AI USAGE ----
drop policy if exists ai_usage_self on public.ai_usage_daily;
create policy ai_usage_self on public.ai_usage_daily for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- ANNOUNCEMENTS ---- (everyone reads; writes only via post_announcement RPC)
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated using (true);

-- ---- CONVERSATIONS ----
drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select to authenticated
using (exists (select 1 from public.participants p
               where p.conversation_id = id and p.user_id = auth.uid()::text and p.status='active'));
drop policy if exists conv_insert on public.conversations;
create policy conv_insert on public.conversations for insert to authenticated
with check (created_by = auth.uid()::text);
drop policy if exists conv_update on public.conversations;
create policy conv_update on public.conversations for update to authenticated
using (exists (select 1 from public.participants p
               where p.conversation_id = id and p.user_id = auth.uid()::text));

-- ---- PARTICIPANTS ----
drop policy if exists part_select on public.participants;
create policy part_select on public.participants for select to authenticated
using (
  user_id = auth.uid()::text
  or exists (select 1 from public.participants me
             where me.conversation_id = participants.conversation_id and me.user_id = auth.uid()::text)
);
drop policy if exists part_insert on public.participants;
create policy part_insert on public.participants for insert to authenticated
with check (
  user_id = auth.uid()::text
  or exists (select 1 from public.conversations c
             where c.id = conversation_id and c.created_by = auth.uid()::text)
);
drop policy if exists part_update on public.participants;
create policy part_update on public.participants for update to authenticated
using (user_id = auth.uid()::text);

-- ---- MESSAGES ----
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
using (exists (select 1 from public.participants p
               where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()::text and p.status='active'));
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()::text
  and exists (select 1 from public.participants p
              where p.conversation_id = conversation_id and p.user_id = auth.uid()::text and p.status='active')
);
drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages for update to authenticated
using (sender_id = auth.uid()::text);  -- edits/soft-delete own; read receipts via mark_conversation_read RPC

-- ---- ATTACHMENTS ----
drop policy if exists att_select on public.attachments;
create policy att_select on public.attachments for select to authenticated
using (exists (select 1 from public.messages m
               join public.participants p on p.conversation_id = m.conversation_id
               where m.id = attachments.message_id and p.user_id = auth.uid()::text));
drop policy if exists att_insert on public.attachments;
create policy att_insert on public.attachments for insert to authenticated
with check (exists (select 1 from public.messages m
                    where m.id = message_id and m.sender_id = auth.uid()::text));

-- ---- REACTIONS ----
drop policy if exists react_all on public.reactions;
create policy react_all on public.reactions for all to authenticated
using (user_id = auth.uid()::text
       or exists (select 1 from public.messages m
                  join public.participants p on p.conversation_id = m.conversation_id
                  where m.id = reactions.message_id and p.user_id = auth.uid()::text))
with check (user_id = auth.uid()::text);

-- ---- PRESENCE ----
drop policy if exists presence_select on public.user_presence;
create policy presence_select on public.user_presence for select to authenticated using (true);
drop policy if exists presence_write on public.user_presence;
create policy presence_write on public.user_presence for all to authenticated
using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- ---- TYPING INDICATORS ----
drop policy if exists typing_select on public.typing_indicators;
create policy typing_select on public.typing_indicators for select to authenticated using (true);
drop policy if exists typing_write on public.typing_indicators;
create policy typing_write on public.typing_indicators for all to authenticated
using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- ============================================================================
--  GRANTS
-- ============================================================================
-- Public RPCs
grant execute on function public.check_office_access(uuid, text) to anon, authenticated;
grant execute on function public.client_case_for_phone(uuid, text) to anon, authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.post_announcement(text, text, text) to authenticated;
grant execute on function public.is_office_member(uuid) to authenticated;

-- Internal trigger functions must NOT be callable from the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_conversation_last_message() from public, anon, authenticated;

-- ============================================================================
--  REALTIME PUBLICATION
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.participants; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_presence; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.appointment_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.case_emergencies; exception when duplicate_object then null; end $$;

-- ============================================================================
--  STORAGE BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- documents bucket: only the owning office (owner uid or staff whose master = first folder).
drop policy if exists documents_office_rw on storage.objects;
create policy documents_office_rw on storage.objects for all to authenticated
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = (select master_lawyer_id::text from public.profiles where id = auth.uid())
  )
)
with check (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = (select master_lawyer_id::text from public.profiles where id = auth.uid())
  )
);

-- chat-attachments bucket: public read; authenticated upload.
drop policy if exists chat_attach_read on storage.objects;
create policy chat_attach_read on storage.objects for select to public
using (bucket_id = 'chat-attachments');
drop policy if exists chat_attach_write on storage.objects;
create policy chat_attach_write on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments');
drop policy if exists chat_attach_modify on storage.objects;
create policy chat_attach_modify on storage.objects for update to authenticated
using (bucket_id = 'chat-attachments');

-- ============================================================================
--  DONE.
--  Next steps (see README): enable Anonymous sign-ins, enable Leaked Password
--  Protection, deploy edge functions, set secrets, make yourself an admin:
--    update public.profiles set role='admin' where email='you@example.com';
-- ============================================================================
