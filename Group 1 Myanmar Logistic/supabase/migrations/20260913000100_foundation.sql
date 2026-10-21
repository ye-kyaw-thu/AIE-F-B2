-- Phase 2: schema, Auth profile lifecycle and read isolation.
-- Operational mutations are deliberately granted only as their validated RPCs arrive.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('admin', 'trader', 'driver');
create type public.shipment_status as enum (
  'requested', 'approved', 'picked_up', 'in_transit',
  'arrived_at_checkpoint', 'customs', 'delivered'
);
create type public.gate_status as enum ('open', 'delayed', 'closed');
create type public.sync_status as enum ('pending', 'synced');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  email text not null check (length(btrim(email)) between 3 and 320),
  role public.app_role not null default 'trader',
  created_at timestamptz not null default now()
);
create unique index profiles_email_lower_key on public.profiles(lower(email));

create table public.gate_statuses (
  id uuid primary key default gen_random_uuid(),
  gate_name text not null unique check (length(btrim(gate_name)) between 1 and 120),
  location text not null check (length(btrim(location)) between 1 and 200),
  status public.gate_status not null default 'open',
  reason text not null default '' check (length(reason) <= 1000),
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (status = 'open' or length(btrim(reason)) > 0)
);

create sequence public.shipment_number_seq;
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text not null unique default ('MMT-' || to_char(nextval('public.shipment_number_seq'), 'FM000000')),
  trader_id uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid references public.profiles(id) on delete restrict,
  origin text not null check (length(btrim(origin)) between 1 and 160),
  destination text not null check (length(btrim(destination)) between 1 and 160),
  cargo_type text not null check (length(btrim(cargo_type)) between 1 and 80),
  cargo_description text not null check (length(btrim(cargo_description)) between 1 and 2000),
  quantity numeric(12,2) not null check (quantity > 0 and quantity <> 'NaN'::numeric),
  quantity_unit text not null default 'tonnes' check (quantity_unit in ('tonnes', 'kg', 'packages')),
  pickup_date date not null,
  route_gate_id uuid not null references public.gate_statuses(id) on delete restrict,
  status public.shipment_status not null default 'requested',
  current_lat double precision,
  current_lng double precision,
  special_notes text not null default '' check (length(special_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lower(btrim(origin)) <> lower(btrim(destination))),
  check ((current_lat is null and current_lng is null) or
    (current_lat is not null and current_lng is not null and current_lat between -90 and 90 and current_lng between -180 and 180)),
  check (status = 'requested' or driver_id is not null)
);
alter sequence public.shipment_number_seq owned by public.shipments.shipment_number;

create table public.shipment_updates (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  status public.shipment_status not null,
  note text not null default '' check (length(note) <= 2000),
  latitude double precision,
  longitude double precision,
  sync_status public.sync_status not null default 'synced' check (sync_status = 'synced'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180))
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  trader_id uuid not null references public.profiles(id) on delete restrict,
  shipment_id uuid references public.shipments(id) on delete cascade,
  gate_id uuid references public.gate_statuses(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 160),
  message text not null check (length(btrim(message)) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  document_type text not null check (document_type in ('photo', 'delivery_receipt', 'customs', 'other')),
  file_url text not null unique,
  original_name text not null check (length(btrim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now(),
  check (file_url ~ ('^' || shipment_id::text || '/' || driver_id::text || '/' || id::text || '\.(jpg|jpeg|png|pdf)$'))
);

create index shipments_trader_created_idx on public.shipments(trader_id, created_at desc);
create index shipments_driver_updated_idx on public.shipments(driver_id, updated_at desc);
create index shipments_gate_status_idx on public.shipments(route_gate_id, status);
create index updates_shipment_created_idx on public.shipment_updates(shipment_id, created_at desc);
create index updates_driver_idx on public.shipment_updates(driver_id);
create index updates_actor_idx on public.shipment_updates(actor_id);
create index alerts_trader_read_created_idx on public.alerts(trader_id, is_read, created_at desc);
create index alerts_shipment_idx on public.alerts(shipment_id);
create index alerts_gate_idx on public.alerts(gate_id);
create index documents_shipment_created_idx on public.documents(shipment_id, created_at desc);
create index documents_driver_idx on public.documents(driver_id);
create index gates_updated_by_idx on public.gate_statuses(updated_by);

create function private.current_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function private.can_view_shipment(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shipments s where s.id = target_id and (
      private.current_role() = 'admin'
      or (private.current_role() = 'trader' and s.trader_id = (select auth.uid()))
      or (private.current_role() = 'driver' and s.driver_id = (select auth.uid()))
    )
  );
$$;

create function private.handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null then
    raise exception 'An email address is required';
  end if;
  if TG_OP = 'INSERT' then
    insert into public.profiles(id, full_name, email, role)
    values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 120), new.email, 'trader');
  else
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_auth_user();
create trigger on_auth_user_email_changed after update of email on auth.users
for each row when (old.email is distinct from new.email) execute function private.handle_auth_user();

create function private.validate_shipment_participants() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.trader_id and role = 'trader') then
    raise exception 'Shipment owner must be a trader' using errcode = '23514';
  end if;
  if new.driver_id is not null and not exists (select 1 from public.profiles where id = new.driver_id and role = 'driver') then
    raise exception 'Assigned profile must be a driver' using errcode = '23514';
  end if;
  if TG_OP = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end;
$$;
create trigger validate_shipment_participants before insert or update on public.shipments
for each row execute function private.validate_shipment_participants();

create function private.validate_related_records() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target public.shipments;
begin
  if new.shipment_id is not null then
    select * into target from public.shipments where id = new.shipment_id;
  end if;
  if TG_TABLE_NAME = 'alerts' then
    if not exists (select 1 from public.profiles where id = new.trader_id and role = 'trader') then
      raise exception 'Alert recipient must be a trader' using errcode = '23514';
    end if;
    if new.shipment_id is not null and (target.id is null or target.trader_id <> new.trader_id) then
      raise exception 'Alert shipment does not belong to recipient' using errcode = '23514';
    end if;
    if new.gate_id is not null and (new.shipment_id is null or target.route_gate_id <> new.gate_id) then
      raise exception 'Alert gate must match shipment route' using errcode = '23514';
    end if;
  elsif TG_TABLE_NAME = 'documents' then
    if target.id is null or new.driver_id is distinct from target.driver_id then
      raise exception 'Document uploader must be the assigned driver' using errcode = '23514';
    end if;
  elsif TG_TABLE_NAME = 'shipment_updates' then
    if target.id is null then raise exception 'Shipment not found' using errcode = '23503'; end if;
    if new.driver_id is not null then
      if new.driver_id is distinct from target.driver_id or new.actor_id <> new.driver_id then
        raise exception 'Update must belong to its assigned driver' using errcode = '23514';
      end if;
    elsif not exists (select 1 from public.profiles where id = new.actor_id and
      (role = 'admin' or (role = 'trader' and id = target.trader_id and new.status = 'requested'))) then
      raise exception 'Invalid timeline author' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_alert before insert or update of trader_id, shipment_id, gate_id on public.alerts
for each row execute function private.validate_related_records();
create trigger validate_document before insert on public.documents
for each row execute function private.validate_related_records();
create trigger validate_update before insert on public.shipment_updates
for each row execute function private.validate_related_records();

alter table public.profiles enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_updates enable row level security;
alter table public.gate_statuses enable row level security;
alter table public.alerts enable row level security;
alter table public.documents enable row level security;

revoke all on public.profiles, public.shipments, public.shipment_updates,
  public.gate_statuses, public.alerts, public.documents from anon, authenticated;
revoke all on sequence public.shipment_number_seq from anon, authenticated;
grant select on public.profiles, public.shipments, public.shipment_updates,
  public.gate_statuses, public.alerts, public.documents to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant update(is_read) on public.alerts to authenticated;
grant all on public.profiles, public.shipments, public.shipment_updates,
  public.gate_statuses, public.alerts, public.documents to service_role;
grant usage, select on sequence public.shipment_number_seq to service_role;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.current_role()) = 'admin');
create policy profiles_rename_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy shipments_read on public.shipments for select to authenticated
using (
  (select private.current_role()) = 'admin'
  or ((select private.current_role()) = 'trader' and trader_id = (select auth.uid()))
  or ((select private.current_role()) = 'driver' and driver_id = (select auth.uid()))
);
create policy updates_read on public.shipment_updates for select to authenticated
using (private.can_view_shipment(shipment_id));
create policy gates_read on public.gate_statuses for select to authenticated
using ((select private.current_role()) is not null);
create policy alerts_read on public.alerts for select to authenticated
using ((select private.current_role()) = 'admin' or
  ((select private.current_role()) = 'trader' and trader_id = (select auth.uid())));
create policy alerts_mark_own on public.alerts for update to authenticated
using ((select private.current_role()) = 'trader' and trader_id = (select auth.uid()))
with check ((select private.current_role()) = 'trader' and trader_id = (select auth.uid()));
create policy documents_read on public.documents for select to authenticated
using (private.can_view_shipment(shipment_id));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_role(), private.can_view_shipment(uuid) to authenticated;

-- Files remain inaccessible publicly. Phase 5 adds validated upload permissions.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('shipment-documents', 'shipment-documents', false, 10485760,
  array['image/jpeg', 'image/png', 'application/pdf']);
create policy shipment_evidence_read on storage.objects for select to authenticated
using (bucket_id = 'shipment-documents' and exists (
  select 1 from public.documents d where d.file_url = name and private.can_view_shipment(d.shipment_id)
));

insert into public.gate_statuses(id, gate_name, location) values
  ('10000000-0000-4000-8000-000000000001', 'Muse', 'Northern Shan State, Myanmar / China border'),
  ('10000000-0000-4000-8000-000000000002', 'Myawaddy', 'Kayin State, Myanmar / Thailand border');

comment on column public.documents.file_url is 'Private Storage object path; generate signed URLs only after authorization.';
comment on table public.shipment_updates is 'Append-only via future validated RPCs. Pending events are held locally, never committed here.';
