-- Admin mutations retain session authorization, row locking and atomic history.
create function public.manage_shipment(p_id uuid, p_expected_updated_at timestamptz,
  p_action text, p_driver_id uuid, p_status public.shipment_status, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare shipment public.shipments; caller uuid := auth.uid(); note text := btrim(coalesce(p_note,''));
begin
  if caller is null or private.current_role() is distinct from 'admin'::public.app_role then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select * into shipment from public.shipments where id=p_id for update;
  if not found then raise exception 'Shipment not found' using errcode='PT404'; end if;
  if p_expected_updated_at is null or shipment.updated_at <> p_expected_updated_at then
    raise exception 'Shipment changed. Reload before saving.' using errcode='PT409';
  end if;
  if length(note)>1800 then raise exception 'Note is too long' using errcode='22023'; end if;
  if p_action = 'assign' then
    if shipment.status not in ('requested','approved') or exists (
      select 1 from public.shipment_updates where shipment_id=p_id and status not in ('requested','approved')) then
      raise exception 'Assignment cannot change after pickup' using errcode='PT422';
    end if;
    if p_driver_id is null or not exists(select 1 from public.profiles where id=p_driver_id and role='driver') then
      raise exception 'Choose an existing driver' using errcode='22023';
    end if;
    if shipment.driver_id is not distinct from p_driver_id then raise exception 'Driver already assigned' using errcode='PT422'; end if;
    update public.shipments set driver_id=p_driver_id where id=p_id;
    note := 'Driver assigned: ' || (select full_name from public.profiles where id=p_driver_id) || '. ' || note;
  elsif p_action = 'approve' then
    if shipment.status <> 'requested' or shipment.driver_id is null then
      raise exception 'Approval requires a requested shipment with an assigned driver' using errcode='PT422';
    end if;
    update public.shipments set status='approved' where id=p_id;
    shipment.status := 'approved'; note := 'Transport request approved. ' || note;
  elsif p_action = 'status' then
    if shipment.status='requested' or shipment.driver_id is null or p_status is null or p_status='requested' then
      raise exception 'Approve the assigned request before correcting progress' using errcode='PT422';
    end if;
    if note='' then raise exception 'A reason is required for status corrections' using errcode='22023'; end if;
    if p_status=shipment.status then raise exception 'Choose a different status' using errcode='PT422'; end if;
    note := 'Admin correction (' || shipment.status::text || ' → ' || p_status::text || '): ' || note;
    update public.shipments set status=p_status where id=p_id;
    shipment.status := p_status;
  else raise exception 'Unknown operation' using errcode='22023';
  end if;
  insert into public.shipment_updates(shipment_id,actor_id,status,note) values(p_id,caller,shipment.status,note);
  return p_id;
end;
$$;

create function public.change_gate_status(p_id uuid, p_expected_updated_at timestamptz,
  p_status public.gate_status, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gate public.gate_statuses; caller uuid := auth.uid(); clean_reason text := btrim(coalesce(p_reason,''));
begin
  if caller is null or private.current_role() is distinct from 'admin'::public.app_role then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  select * into gate from public.gate_statuses where id=p_id for update;
  if not found then raise exception 'Gate not found' using errcode='PT404'; end if;
  if p_expected_updated_at is null or gate.updated_at <> p_expected_updated_at then
    raise exception 'Gate changed. Reload before saving.' using errcode='PT409';
  end if;
  if p_status is null or length(clean_reason)>1000 or (p_status<>'open' and clean_reason='') then
    raise exception 'Delayed or closed gates require a reason (maximum 1000 characters)' using errcode='22023';
  end if;
  update public.gate_statuses set status=p_status,reason=clean_reason,updated_by=caller,updated_at=clock_timestamp() where id=p_id;
  return p_id;
end;
$$;
revoke all on function public.manage_shipment(uuid,timestamptz,text,uuid,public.shipment_status,text),
  public.change_gate_status(uuid,timestamptz,public.gate_status,text) from public,anon,authenticated;
grant execute on function public.manage_shipment(uuid,timestamptz,text,uuid,public.shipment_status,text),
  public.change_gate_status(uuid,timestamptz,public.gate_status,text) to authenticated;
