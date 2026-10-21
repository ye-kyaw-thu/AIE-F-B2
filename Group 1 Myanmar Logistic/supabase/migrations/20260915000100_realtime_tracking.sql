-- This project's publication contains only logistics data. Delete events cannot
-- be authorized against a deleted row, so publish only inserts and updates.
do $$
declare target text;
begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime with (publish='insert,update');
  end if;
  if exists(select 1 from pg_publication where pubname='supabase_realtime' and puballtables)
    or exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and (schemaname<>'public' or tablename not in ('shipments','shipment_updates','gate_statuses','documents','alerts'))) then
    raise exception 'Realtime publication contains unrelated tables. Review publication scope before applying.';
  end if;
  alter publication supabase_realtime set (publish='insert,update');
  foreach target in array array['shipments','shipment_updates','gate_statuses','documents','alerts'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
      execute format('alter publication supabase_realtime add table public.%I',target);
    end if;
  end loop;
end;
$$;

-- Aggregate the complete authorized history: recent-event pagination must not
-- erase earlier milestones or imply that skipped stages were recorded.
create function public.shipment_milestones(p_shipment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.can_view_shipment(p_shipment_id) then
    raise exception 'Shipment not found' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(m) order by m.status),'[]'::jsonb) from (
    select status,min(created_at) as first_at,max(created_at) as last_at,count(*) as event_count
    from public.shipment_updates where shipment_id=p_shipment_id group by status
  ) m);
end;
$$;
revoke all on function public.shipment_milestones(uuid) from public,anon,authenticated;
grant execute on function public.shipment_milestones(uuid) to authenticated;
