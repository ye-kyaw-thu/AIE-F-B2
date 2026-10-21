-- Admin-controlled Driver onboarding; public signup continues to create Traders.
alter table public.profiles add column driver_access text not null default 'active'
  check (driver_access in ('invited','active','disabled'));
alter table public.profiles add column phone text not null default '' check (length(phone)<=40);
alter table public.profiles add constraint non_driver_access_active check (role='driver' or driver_access='active');

create table public.driver_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email=lower(btrim(email)) and length(email) between 3 and 320),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  phone text not null default '' check (length(phone)<=40),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid unique references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','invited','accepted')),
  created_at timestamptz not null default clock_timestamp(),
  last_attempt_at timestamptz not null default clock_timestamp(),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  check ((status='pending' and driver_id is null) or (status in ('invited','accepted') and driver_id is not null)),
  check ((status='accepted')=(accepted_at is not null))
);
create index driver_invites_created_idx on public.driver_invitations(created_at desc,id);
alter table public.driver_invitations enable row level security;
revoke all on public.driver_invitations from public,anon,authenticated;
grant select on public.driver_invitations to authenticated;
grant all on public.driver_invitations to service_role;
create policy driver_invites_admin_read on public.driver_invitations for select to authenticated
using ((select private.current_role())='admin');

create or replace function private.current_role() returns public.app_role
language sql stable security definer set search_path='' as $$
  select role from public.profiles where id=(select auth.uid()) and (role<>'driver' or driver_access='active');
$$;

create function public.reserve_driver_invitation(p_full_name text,p_email text,p_phone text,p_retry_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.driver_invitations; caller uuid:=auth.uid();
begin
  if caller is null or private.current_role() is distinct from 'admin'::public.app_role then
    raise exception 'Administrator access is required.' using errcode='42501';
  end if;
  if p_retry_id is not null then
    select * into invitation from public.driver_invitations where id=p_retry_id for update;
    if not found then raise exception 'Invitation not found.' using errcode='PT404'; end if;
    if invitation.status='accepted' or exists(select 1 from public.profiles where id=invitation.driver_id and driver_access<>'invited') then
      raise exception 'Only pending invitations can be resent.' using errcode='PT422';
    end if;
    if invitation.last_attempt_at>clock_timestamp()-interval '60 seconds' then
      raise exception 'Wait one minute before resending this invitation.' using errcode='PT429';
    end if;
    update public.driver_invitations set last_attempt_at=clock_timestamp() where id=invitation.id;
    return invitation.id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  p_full_name:=btrim(coalesce(p_full_name,''));p_email:=lower(btrim(coalesce(p_email,'')));p_phone:=btrim(coalesce(p_phone,''));
  if length(p_full_name) not between 2 and 120 or length(p_email)>320 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_phone)>40 then
    raise exception 'Check the name, email and phone number.' using errcode='22023';
  end if;
  if exists(select 1 from public.profiles where lower(email)=p_email) then
    raise exception 'This email already has an account. Use another email.' using errcode='PT422';
  end if;
  if (select count(*) from public.driver_invitations where invited_by=caller and created_at>clock_timestamp()-interval '1 hour')>=20 then
    raise exception 'Invitation limit reached. Try again later.' using errcode='PT429';
  end if;
  insert into public.driver_invitations(email,full_name,phone,invited_by) values(p_email,p_full_name,p_phone,caller) returning * into invitation;
  return invitation.id;
exception when unique_violation then
  raise exception 'This email has a pending invitation. Resend it from the list.' using errcode='PT409';
end;
$$;

create function public.finalize_driver_invitation(p_invitation_id uuid,p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.driver_invitations; profile public.profiles;
begin
  if auth.uid() is null or private.current_role() is distinct from 'admin'::public.app_role then
    raise exception 'Administrator access is required.' using errcode='42501';
  end if;
  select * into invitation from public.driver_invitations where id=p_invitation_id for update;
  if not found or invitation.status='accepted' then raise exception 'Invitation is unavailable.' using errcode='PT422'; end if;
  select * into profile from public.profiles where id=p_user_id for update;
  if not found or lower(profile.email)<>invitation.email then raise exception 'Invitation identity does not match.' using errcode='42501'; end if;
  if invitation.driver_id is not null then
    if invitation.driver_id<>p_user_id or profile.role<>'driver' or profile.driver_access<>'invited' then
      raise exception 'Invitation identity does not match.' using errcode='42501';
    end if;
  else
    -- Auth evidence comes from Supabase's trusted users table, never user metadata.
    if profile.role<>'trader' or not exists(select 1 from auth.users u where u.id=p_user_id and lower(u.email)=invitation.email
      and u.invited_at is not null and u.created_at>=invitation.created_at)
      or exists(select 1 from public.shipments where trader_id=p_user_id)
      or exists(select 1 from public.alerts where trader_id=p_user_id) then
      raise exception 'An existing account cannot be converted into a Driver.' using errcode='42501';
    end if;
    update public.profiles set role='driver',driver_access='invited',full_name=invitation.full_name,phone=invitation.phone where id=p_user_id;
  end if;
  update public.driver_invitations set driver_id=p_user_id,status='invited',last_sent_at=clock_timestamp() where id=invitation.id;
  return p_user_id;
end;
$$;

create function public.activate_invited_driver() returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); invitation public.driver_invitations; profile public.profiles;
begin
  if caller is null then raise exception 'Driver access required' using errcode='42501'; end if;
  select * into invitation from public.driver_invitations where driver_id=caller for update;
  if not found then raise exception 'Driver invitation is unavailable.' using errcode='42501'; end if;
  select * into profile from public.profiles where id=caller for update;
  if profile.role is distinct from 'driver'::public.app_role or profile.driver_access='disabled'
    or not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null and lower(email)=invitation.email) then
    raise exception 'Confirm your Driver invitation before continuing.' using errcode='42501';
  end if;
  if invitation.status='accepted' and profile.driver_access='active' then return caller; end if;
  if invitation.status<>'invited' or profile.driver_access<>'invited' then raise exception 'Driver invitation is unavailable.' using errcode='42501'; end if;
  update public.profiles set driver_access='active' where id=caller;
  update public.driver_invitations set status='accepted',accepted_at=clock_timestamp() where id=invitation.id;
  return caller;
end;
$$;

create function public.set_driver_access(p_driver_id uuid,p_expected_access text,p_enable boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare profile public.profiles; next_access text;
begin
  if auth.uid() is null or private.current_role() is distinct from 'admin'::public.app_role then
    raise exception 'Administrator access is required.' using errcode='42501';
  end if;
  select * into profile from public.profiles where id=p_driver_id for update;
  if not found or profile.role<>'driver' then raise exception 'Driver not found.' using errcode='PT404'; end if;
  if p_expected_access is null or profile.driver_access<>p_expected_access then raise exception 'This record changed. Reload the page before saving again.' using errcode='PT409'; end if;
  if p_enable is null then raise exception 'Choose an access state.' using errcode='22023'; end if;
  next_access:=case when not p_enable then 'disabled'
    when exists(select 1 from public.driver_invitations where driver_id=p_driver_id and status<>'accepted') then 'invited' else 'active' end;
  update public.profiles set driver_access=next_access where id=p_driver_id;
  return p_driver_id;
end;
$$;

create function private.require_active_assigned_driver() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.driver_id is not null and (TG_OP='INSERT' or new.driver_id is distinct from old.driver_id or (old.status='requested' and new.status='approved'))
    and not exists(select 1 from public.profiles where id=new.driver_id and role='driver' and driver_access='active') then
    raise exception 'Choose an active Driver who has completed account setup.' using errcode='22023';
  end if;
  return new;
end;
$$;
create trigger require_active_assigned_driver before insert or update of driver_id,status on public.shipments
for each row execute function private.require_active_assigned_driver();

revoke all on function private.require_active_assigned_driver() from public,anon,authenticated;
revoke all on function public.reserve_driver_invitation(text,text,text,uuid),public.finalize_driver_invitation(uuid,uuid),
  public.activate_invited_driver(),public.set_driver_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_driver_invitation(text,text,text,uuid),public.finalize_driver_invitation(uuid,uuid),
  public.activate_invited_driver(),public.set_driver_access(uuid,text,boolean) to authenticated;
