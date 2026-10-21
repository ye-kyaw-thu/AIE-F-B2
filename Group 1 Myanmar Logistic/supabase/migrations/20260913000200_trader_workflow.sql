-- Phase 3: constrained trader mutations; no direct table-write grants.
create function private.validate_shipment_request(p_input jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare field text; normalized jsonb; quantity numeric; pickup date;
begin
  if jsonb_typeof(p_input) is distinct from 'object' then
    raise exception 'Request must be an object' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_input) k where k not in
    ('origin','destination','cargo_type','cargo_description','quantity','quantity_unit','pickup_date','route_gate_id','special_notes')) then
    raise exception 'Unexpected request field' using errcode = '22023';
  end if;
  foreach field in array array['origin','destination','cargo_type','cargo_description','quantity_unit','pickup_date','route_gate_id','special_notes'] loop
    if jsonb_typeof(p_input->field) is distinct from 'string' then
      raise exception 'Invalid or missing request field: %', field using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(p_input->'quantity') is distinct from 'number' then
    raise exception 'Quantity must be a number' using errcode = '22023';
  end if;
  quantity := (p_input->>'quantity')::numeric;
  if quantity <= 0 or quantity > 9999999999.99 or quantity <> round(quantity, 2) then
    raise exception 'Quantity must be positive with at most two decimal places' using errcode = '22023';
  end if;
  normalized := p_input;
  foreach field in array array['origin','destination','cargo_type','cargo_description','special_notes'] loop
    normalized := jsonb_set(normalized, array[field], to_jsonb(btrim(p_input->>field)));
  end loop;
  if length(normalized->>'origin') not between 1 and 160
    or length(normalized->>'destination') not between 1 and 160
    or length(normalized->>'cargo_type') not between 1 and 80
    or length(normalized->>'cargo_description') not between 1 and 2000
    or length(normalized->>'special_notes') > 2000 then
    raise exception 'Request text is empty or too long' using errcode = '22023';
  end if;
  if lower(normalized->>'origin') = lower(normalized->>'destination') then
    raise exception 'Origin and destination must differ' using errcode = '22023';
  end if;
  if normalized->>'quantity_unit' not in ('tonnes','kg','packages') then
    raise exception 'Invalid quantity unit' using errcode = '22023';
  end if;
  if (normalized->>'pickup_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid pickup date' using errcode = '22023';
  end if;
  begin
    pickup := (normalized->>'pickup_date')::date;
    if pickup < (now() at time zone 'Asia/Yangon')::date then
      raise exception 'Pickup date cannot be in the past in Myanmar' using errcode = '22023';
    end if;
    if not exists (select 1 from public.gate_statuses where id = (normalized->>'route_gate_id')::uuid) then
      raise exception 'Choose an existing border gate' using errcode = '22023';
    end if;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'Invalid pickup date or border gate' using errcode = '22023';
  end;
  return normalized;
end;
$$;

-- Definer rights are needed because callers have no table write privileges.
-- Every entry point checks the verified caller's role/ownership itself.
create function public.create_shipment(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare input jsonb; shipment_id uuid; caller uuid := auth.uid();
begin
  if caller is null or private.current_role() is distinct from 'trader'::public.app_role then
    raise exception 'Only traders can request transport' using errcode = '42501';
  end if;
  input := private.validate_shipment_request(p_input);
  insert into public.shipments(trader_id, origin, destination, cargo_type, cargo_description,
    quantity, quantity_unit, pickup_date, route_gate_id, special_notes)
  values(caller, input->>'origin', input->>'destination', input->>'cargo_type', input->>'cargo_description',
    (input->>'quantity')::numeric, input->>'quantity_unit', (input->>'pickup_date')::date,
    (input->>'route_gate_id')::uuid, input->>'special_notes') returning id into shipment_id;
  insert into public.shipment_updates(shipment_id, actor_id, status, note)
  values(shipment_id, caller, 'requested', 'Transport request submitted.');
  return shipment_id;
end;
$$;

create function public.edit_requested_shipment(p_shipment_id uuid, p_expected_updated_at timestamptz, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare input jsonb; shipment public.shipments; caller uuid := auth.uid();
begin
  if caller is null or private.current_role() is distinct from 'trader'::public.app_role then
    raise exception 'Only traders can edit transport requests' using errcode = '42501';
  end if;
  select * into shipment from public.shipments where id = p_shipment_id and trader_id = caller for update;
  if not found then raise exception 'Request not found' using errcode = '42501'; end if;
  if shipment.status <> 'requested' then
    raise exception 'Only requested shipments can be edited' using errcode = '55000';
  end if;
  if p_expected_updated_at is null or shipment.updated_at <> p_expected_updated_at then
    raise exception 'This request changed. Reload it before editing.' using errcode = '40001';
  end if;
  input := private.validate_shipment_request(p_input);
  update public.shipments set origin = input->>'origin', destination = input->>'destination',
    cargo_type = input->>'cargo_type', cargo_description = input->>'cargo_description',
    quantity = (input->>'quantity')::numeric, quantity_unit = input->>'quantity_unit',
    pickup_date = (input->>'pickup_date')::date, route_gate_id = (input->>'route_gate_id')::uuid,
    special_notes = input->>'special_notes' where id = shipment.id;
  insert into public.shipment_updates(shipment_id, actor_id, status, note)
  values(shipment.id, caller, 'requested', 'Request details updated by trader.');
  return shipment.id;
end;
$$;

create function public.shipment_driver_name(p_shipment_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_shipment(p_shipment_id) then
    raise exception 'Shipment not found' using errcode = '42501';
  end if;
  return (select p.full_name from public.shipments s join public.profiles p on p.id = s.driver_id where s.id = p_shipment_id);
end;
$$;

revoke all on function private.validate_shipment_request(jsonb) from public, anon, authenticated;
revoke all on function public.create_shipment(jsonb), public.edit_requested_shipment(uuid,timestamptz,jsonb),
  public.shipment_driver_name(uuid) from public, anon, authenticated;
grant execute on function public.create_shipment(jsonb), public.edit_requested_shipment(uuid,timestamptz,jsonb),
  public.shipment_driver_name(uuid) to authenticated;
