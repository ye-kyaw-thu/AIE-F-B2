-- Phase 7: recipient-specific gate disruption alerts, Admin broadcasts and
-- Trader read markers. All mutations derive identity from the session.

create function private.create_gate_disruption_alerts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status and new.status in ('delayed','closed') then
    insert into public.alerts(trader_id,shipment_id,gate_id,title,message)
    select s.trader_id,s.id,new.id,
      new.gate_name || ' Gate ' || initcap(new.status::text),
      case when new.status='closed' then 'Route closed' else 'Route delayed' end ||
        ': ' || new.reason || '. Shipment ' || s.shipment_number || ' may be affected.'
    from public.shipments s
    where s.route_gate_id=new.id and s.status<>'delivered';
  end if;
  return new;
end;
$$;
create trigger create_gate_disruption_alerts after update of status on public.gate_statuses
for each row execute function private.create_gate_disruption_alerts();

create function public.broadcast_alert(p_title text,p_message text) returns bigint
language plpgsql security definer set search_path='' as $$
declare inserted bigint;
begin
  if (select private.current_role())<>'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  p_title:=btrim(coalesce(p_title,''));p_message:=btrim(coalesce(p_message,''));
  if length(p_title) not between 1 and 160 or length(p_message) not between 1 and 2000 then
    raise exception 'Title and message are required and exceed the allowed length' using errcode='22023';
  end if;
  insert into public.alerts(trader_id,title,message)
  select id,p_title,p_message from public.profiles where role='trader';
  get diagnostics inserted=row_count;
  return inserted;
end;
$$;

create function public.mark_alert_read(p_id uuid,p_is_read boolean) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if (select private.current_role())<>'trader' then
    raise exception 'Trader access required' using errcode='42501';
  end if;
  if p_id is null or p_is_read is null then
    raise exception 'Alert and read state are required' using errcode='22023';
  end if;
  update public.alerts set is_read=p_is_read
  where id=p_id and trader_id=(select auth.uid());
  if not found then raise exception 'Alert not found' using errcode='PT404'; end if;
  return p_id;
end;
$$;

revoke all on function private.create_gate_disruption_alerts() from public,anon,authenticated;
revoke all on function public.broadcast_alert(text,text),public.mark_alert_read(uuid,boolean) from public,anon,authenticated;
grant execute on function public.broadcast_alert(text,text),public.mark_alert_read(uuid,boolean) to authenticated;
