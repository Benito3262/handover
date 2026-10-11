-- Handover schema. All tables are prefixed ho_ so they can live in a shared project.
-- Access: the server talks to PostgREST with the publishable/anon key PLUS a secret
-- header (x-handover-key). RLS only lets requests through when that header matches.
-- Replace __HANDOVER_DB_KEY__ with the value of HANDOVER_DB_KEY before running.

create or replace function public.ho_ok() returns boolean
language sql stable as $$
  select coalesce(current_setting('request.headers', true)::json->>'x-handover-key', '') = '__HANDOVER_DB_KEY__'
$$;

create table if not exists public.ho_sellers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  email text,
  passcode_hash text not null,
  paypal_email text,
  auto_release_hours int not null default 48,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ho_orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.ho_sellers(id) on delete cascade,
  number int not null,
  public_token text unique not null,
  buyer_name text not null,
  buyer_email text,
  items jsonb not null default '[]',
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  delivery_date date,
  note text,
  status text not null default 'created',
  paypal_order_id text,
  authorization_id text,
  authorized_at timestamptz,
  auth_expires_at timestamptz,
  honor_expires_at timestamptz,
  simulated boolean not null default false,
  shipped_at timestamptz,
  carrier text,
  tracking text,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  settled_at timestamptz,
  captured_amount numeric(12,2),
  capture_id text,
  refunded_amount numeric(12,2),
  dispute jsonb,
  risk jsonb,
  reminders_sent int not null default 0,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, number)
);

create table if not exists public.ho_order_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.ho_orders(id) on delete cascade,
  seller_id uuid references public.ho_sellers(id) on delete cascade,
  type text not null,
  actor text not null default 'system',
  message text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ho_messages (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.ho_orders(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ho_evidence (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.ho_orders(id) on delete cascade,
  author text not null,
  kind text not null,
  caption text,
  image_data text,
  created_at timestamptz not null default now()
);

create index if not exists ho_orders_seller_idx on public.ho_orders(seller_id, created_at desc);
create index if not exists ho_events_order_idx on public.ho_order_events(order_id, created_at);
create index if not exists ho_events_seller_idx on public.ho_order_events(seller_id, created_at desc);
create index if not exists ho_messages_order_idx on public.ho_messages(order_id, created_at);
create index if not exists ho_evidence_order_idx on public.ho_evidence(order_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['ho_sellers','ho_orders','ho_order_events','ho_messages','ho_evidence'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ho_server_only on public.%I', t);
    execute format('create policy ho_server_only on public.%I for all to anon, authenticated using (public.ho_ok()) with check (public.ho_ok())', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;
grant usage on all sequences in schema public to anon, authenticated;
