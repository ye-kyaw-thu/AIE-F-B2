-- Return explicit client errors for expected workflow conflicts through PostgREST.
create or replace function public.edit_requested_shipment(p_shipment_id uuid, p_expected_updated_at timestamptz, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare input jsonb; shipment public.shipments; caller uuid := auth.uid();
begin
  if caller is null or private.current_role() is distinct from 'trader'::public.app_role then
    raise exception 'Only traders can edit transport requests' using errcode = '42501';
  end if;
  select * into shipment from public.shipments where id = p_shipment_id and trader_id = caller for update;
  if not found then raise exception 'Request not found' using errcode = '42501'; end if;
  if shipment.status <> 'requested' then
    raise exception 'Only requested shipments can be edited' using errcode = 'PT422';
  end if;
  if p_expected_updated_at is null or shipment.updated_at <> p_expected_updated_at then
    raise exception 'This request changed. Reload it before editing.' using errcode = 'PT409';
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

