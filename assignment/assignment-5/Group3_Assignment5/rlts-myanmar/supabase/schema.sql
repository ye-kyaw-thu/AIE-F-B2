-- RLTS-MM Supabase schema.
-- Taken from project_detail.md section 5, with one addition: a UNIQUE constraint on
-- shipment_telemetry_logs.event_uuid plus an idempotent upsert helper. This is the
-- server-side half of the idempotency pattern borrowed from Open mSupply's sync design
-- (github.com/msupply-foundation/open-msupply) — a client that retries a batch push
-- after a dropped connection must be able to send the same event_uuid twice and have
-- the second attempt be a safe no-op instead of creating duplicate checkpoint history.

create extension if not exists pgcrypto;

-- 1. BORDER GATES & STRATEGIC CHOKEPOINTS
create table border_gates (
    id uuid primary key default gen_random_uuid(),
    code varchar(30) unique not null,          -- e.g. 'GATE_MUSE_105', 'GATE_MYAWADDY_FRIENDSHIP'
    name varchar(100) not null,
    corridor varchar(100) not null,            -- 'Northern (China)', 'Eastern (Thailand)'
    status varchar(30) not null default 'OPEN', -- 'OPEN', 'CONGESTED', 'CLOSED', 'ARMED_INSPECTION', 'FLOODING', 'EMERGENCY_HALT'
    closure_reason text,
    coordinates_lat double precision not null,
    coordinates_lng double precision not null,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id)
);

-- 2. SHIPMENTS
create table shipments (
    id uuid primary key default gen_random_uuid(),
    tracking_number varchar(50) unique not null, -- 'MM-TRK-8842'
    trader_id uuid references auth.users(id),
    trader_username varchar(50), -- demo-account link; real deployments would use trader_id only
    driver_id uuid references auth.users(id),
    driver_username varchar(50), -- demo-account link; real deployments would use driver_id only
    cargo_type varchar(100) not null,
    cargo_weight_tons numeric(8,2),
    cargo_value numeric(14,2) default 0,
    cargo_value_currency varchar(3) default 'USD', -- 'USD', 'CNY', 'MMK'
    created_by varchar(50), -- username of the data_entry_clerk who created this record
    origin_name varchar(100) not null,
    destination_name varchar(100) not null,
    target_gate_id uuid references border_gates(id),
    current_status varchar(40) not null default 'PICKED_UP',
    -- 'PICKED_UP', 'IN_TRANSIT', 'HELD_AT_CHECKPOINT', 'CUSTOMS_PROCESSING', 'DELIVERED', 'REROUTED'
    current_lat double precision,
    current_lng double precision,
    route_progress numeric(4,3) not null default 0, -- 0..1, drives the simulated GPS marker
    is_delayed boolean not null default false,
    delay_reason text,
    created_at timestamptz not null default now(),
    estimated_arrival timestamptz
);

-- 3. CHECKPOINT & TELEMETRY AUDIT LOGS (OFFLINE-SYNC READY, APPEND-ONLY)
create table shipment_telemetry_logs (
    id uuid primary key default gen_random_uuid(),
    event_uuid uuid unique not null,             -- client-generated idempotency key
    shipment_id uuid references shipments(id) on delete cascade,
    checkpoint_name varchar(100) not null,
    event_type varchar(50) not null,             -- 'ARRIVED', 'CLEARED', 'DELAY_REPORTED', 'GPS_PING', 'REROUTED'
    notes text,
    photo_url text,
    location_lat double precision,
    location_lng double precision,
    client_recorded_at timestamptz not null,     -- the real event time, set on the driver device
    server_synced_at timestamptz not null default now() -- when it reached this table — never backdated
);

-- 4. EMERGENCY ALERTS & BROADCASTS
create table emergency_broadcasts (
    id uuid primary key default gen_random_uuid(),
    title varchar(200) not null,
    message text not null,
    severity varchar(20) not null default 'CRITICAL', -- 'INFO', 'WARNING', 'CRITICAL'
    gate_id uuid references border_gates(id),
    route_affected varchar(100),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- Idempotent batch insert for the driver sync engine: retried event_uuids are silently
-- dropped rather than erroring or duplicating (mirrors mSupply's changelog de-duplication).
create or replace function apply_telemetry_event(
    p_event_uuid uuid,
    p_shipment_id uuid,
    p_checkpoint_name varchar,
    p_event_type varchar,
    p_notes text,
    p_photo_url text,
    p_lat double precision,
    p_lng double precision,
    p_client_recorded_at timestamptz
) returns void as $$
begin
    insert into shipment_telemetry_logs (
        event_uuid, shipment_id, checkpoint_name, event_type,
        notes, photo_url, location_lat, location_lng, client_recorded_at
    ) values (
        p_event_uuid, p_shipment_id, p_checkpoint_name, p_event_type,
        p_notes, p_photo_url, p_lat, p_lng, p_client_recorded_at
    )
    on conflict (event_uuid) do nothing; -- <-- the idempotency guarantee
end;
$$ language plpgsql security definer;

-- Realtime: enable so Trader dashboards get instant gate-status pushes.
alter publication supabase_realtime add table border_gates;
alter publication supabase_realtime add table shipments;
alter publication supabase_realtime add table emergency_broadcasts;
alter publication supabase_realtime add table shipment_telemetry_logs;

-- Seed data matching the live demo script (project_detail.md section 7).
insert into border_gates (code, name, corridor, status, coordinates_lat, coordinates_lng) values
    ('GATE_MUSE_105', 'Muse Border Gate (China)', 'Northern (China)', 'OPEN', 23.9833, 97.9167),
    ('GATE_MYAWADDY_FRIENDSHIP', 'Myawaddy Border Gate (Thailand)', 'Eastern (Thailand)', 'OPEN', 16.6833, 98.5333),
    ('GATE_CHINSHWEHAW', 'Chinshwehaw Gate (China)', 'Northern (China)', 'OPEN', 23.35, 98.75);

insert into shipments (tracking_number, cargo_type, cargo_weight_tons, origin_name, destination_name, target_gate_id, current_status, current_lat, current_lng, route_progress)
select 'MM-TRK-8842', 'Agricultural Produce', 18.5, 'Yangon Hlaing Tharyar Depot', 'Muse 105-Mile Border Trade Zone', id, 'IN_TRANSIT', 21.9588, 96.0891, 0.33
from border_gates where code = 'GATE_MUSE_105';

-- Row Level Security: enable and lock down as a starting point. Tighten per role
-- (logistics_admin / cargo_trader / truck_driver) before using this in production —
-- these permissive starter policies are only meant to unblock local development.
alter table border_gates enable row level security;
alter table shipments enable row level security;
alter table shipment_telemetry_logs enable row level security;
alter table emergency_broadcasts enable row level security;

create policy "read all - authenticated" on border_gates for select using (auth.role() = 'authenticated');
create policy "read all - authenticated" on shipments for select using (auth.role() = 'authenticated');
create policy "read all - authenticated" on shipment_telemetry_logs for select using (auth.role() = 'authenticated');
create policy "read all - authenticated" on emergency_broadcasts for select using (auth.role() = 'authenticated');
