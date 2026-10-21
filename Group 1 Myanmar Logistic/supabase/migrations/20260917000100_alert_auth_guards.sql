-- Reject missing identities/profiles explicitly: SQL NULL <> role does not return true.
create or replace function public.broadcast_alert(p_title text,p_message text) returns bigint
language plpgsql security definer set search_path='' as $$
declare inserted bigint;
begin
  if (select auth.uid()) is null or (select private.current_role()) is distinct from 'admin'::public.app_role then
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

create or replace function public.mark_alert_read(p_id uuid,p_is_read boolean) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or (select private.current_role()) is distinct from 'trader'::public.app_role then
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
