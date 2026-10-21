create function public.append_driver_update(p_id uuid,p_shipment_id uuid,p_expected_updated_at timestamptz,
  p_status public.shipment_status,p_note text,p_latitude double precision,p_longitude double precision,p_occurred_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare shipment public.shipments; previous public.shipment_updates; caller uuid:=auth.uid(); clean_note text:=btrim(coalesce(p_note,''));
begin
  if caller is null or private.current_role() is distinct from 'driver'::public.app_role then raise exception 'Driver access required' using errcode='42501'; end if;
  select * into shipment from public.shipments where id=p_shipment_id and driver_id=caller for update;
  if not found then raise exception 'Assigned shipment not found' using errcode='42501'; end if;
  if p_id is null or p_status is null or length(clean_note)>2000 or p_occurred_at is null or not isfinite(p_occurred_at) or p_occurred_at>now()+interval '5 minutes' then raise exception 'Invalid update fields' using errcode='22023'; end if;
  if (p_latitude is null)<>(p_longitude is null) or (p_latitude is not null and not(p_latitude between -90 and 90 and p_longitude between -180 and 180)) then raise exception 'Coordinates must be a valid pair' using errcode='22023'; end if;
  select * into previous from public.shipment_updates where id=p_id;
  if found then
    if previous.shipment_id=p_shipment_id and previous.actor_id=caller and previous.status=p_status and previous.note=clean_note
      and previous.latitude is not distinct from p_latitude and previous.longitude is not distinct from p_longitude and previous.occurred_at=p_occurred_at then return p_id; end if;
    raise exception 'Update ID already used for different data' using errcode='PT409';
  end if;
  if shipment.status='requested' or shipment.status='delivered' or p_status='requested' or p_status<shipment.status then raise exception 'Shipment must be approved; progress cannot go backward or change after delivery' using errcode='PT422'; end if;
  if p_expected_updated_at is null or shipment.updated_at<>p_expected_updated_at then raise exception 'Shipment changed. Reload before updating.' using errcode='PT409'; end if;
  if p_status=shipment.status and clean_note='' and p_latitude is null then raise exception 'Add a note or GPS position, or choose a new status' using errcode='22023'; end if;
  update public.shipments set status=p_status,current_lat=coalesce(p_latitude,current_lat),current_lng=coalesce(p_longitude,current_lng) where id=p_shipment_id;
  insert into public.shipment_updates(id,shipment_id,driver_id,actor_id,status,note,latitude,longitude,occurred_at)
    values(p_id,p_shipment_id,caller,caller,p_status,clean_note,p_latitude,p_longitude,p_occurred_at);
  return p_id;
exception when unique_violation then raise exception 'Update ID already used' using errcode='PT409';
end;
$$;

create function private.driver_upload_path(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_role()='driver' and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|pdf)$'
    and split_part(object_name,'/',2)=auth.uid()::text and exists(select 1 from public.shipments
      where id::text=split_part(object_name,'/',1) and driver_id=auth.uid() and status<>'requested');
$$;
create function private.driver_orphan_path(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_role()='driver' and split_part(object_name,'/',2)=auth.uid()::text
    and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|pdf)$'
    and not exists(select 1 from public.documents where file_url=object_name);
$$;
grant insert,delete on storage.objects to authenticated;
create policy driver_evidence_insert on storage.objects for insert to authenticated
  with check(bucket_id='shipment-documents' and private.driver_upload_path(name));
create policy driver_orphan_read on storage.objects for select to authenticated
  using(bucket_id='shipment-documents' and private.driver_orphan_path(name));
create policy driver_orphan_delete on storage.objects for delete to authenticated
  using(bucket_id='shipment-documents' and private.driver_orphan_path(name));

create function public.register_shipment_document(p_id uuid,p_shipment_id uuid,p_document_type text,p_original_name text,p_mime_type text,p_size_bytes bigint,p_extension text) returns uuid
language plpgsql security definer set search_path='' as $$
declare shipment public.shipments; existing public.documents; object_meta jsonb; caller uuid:=auth.uid(); object_path text;
begin
  if caller is null or private.current_role() is distinct from 'driver'::public.app_role then raise exception 'Driver access required' using errcode='42501'; end if;
  select * into shipment from public.shipments where id=p_shipment_id and driver_id=caller for update;
  if not found then raise exception 'Assigned shipment not found' using errcode='42501'; end if;
  if shipment.status='requested' then raise exception 'Wait for shipment approval before uploading evidence' using errcode='PT422'; end if;
  if p_id is null or p_document_type is null or p_document_type not in ('photo','delivery_receipt','customs','other')
    or p_original_name is null or length(btrim(p_original_name)) not between 1 and 255
    or p_size_bytes is null or p_size_bytes not between 1 and 10485760
    or p_mime_type is null or p_extension is null or not((p_mime_type='image/jpeg' and p_extension in ('jpg','jpeg')) or (p_mime_type='image/png' and p_extension='png') or (p_mime_type='application/pdf' and p_extension='pdf')) then
    raise exception 'Invalid evidence metadata; use JPEG, PNG or PDF up to 10 MiB' using errcode='22023';
  end if;
  object_path:=p_shipment_id::text||'/'||caller::text||'/'||p_id::text||'.'||p_extension;
  select * into existing from public.documents where id=p_id;
  if found then
    if existing.shipment_id=p_shipment_id and existing.driver_id=caller and existing.document_type=p_document_type and existing.original_name=btrim(p_original_name)
      and existing.file_url=object_path and existing.mime_type=p_mime_type and existing.size_bytes=p_size_bytes then return p_id; end if;
    raise exception 'Document ID already used' using errcode='PT409';
  end if;
  select metadata into object_meta from storage.objects where bucket_id='shipment-documents' and name=object_path for update;
  if not found then raise exception 'Upload the file before registering evidence' using errcode='PT422'; end if;
  if object_meta->>'mimetype' is distinct from p_mime_type or (object_meta->>'size')::bigint is distinct from p_size_bytes then raise exception 'Uploaded file does not match the evidence metadata' using errcode='22023'; end if;
  insert into public.documents(id,shipment_id,driver_id,document_type,file_url,original_name,mime_type,size_bytes)
    values(p_id,p_shipment_id,caller,p_document_type,object_path,btrim(p_original_name),p_mime_type,p_size_bytes);
  return p_id;
exception when unique_violation then raise exception 'Document ID already used' using errcode='PT409';
end;
$$;
revoke all on function private.driver_upload_path(text),private.driver_orphan_path(text),
  public.append_driver_update(uuid,uuid,timestamptz,public.shipment_status,text,double precision,double precision,timestamptz),
  public.register_shipment_document(uuid,uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function private.driver_upload_path(text),private.driver_orphan_path(text),
  public.append_driver_update(uuid,uuid,timestamptz,public.shipment_status,text,double precision,double precision,timestamptz),
  public.register_shipment_document(uuid,uuid,text,text,text,bigint,text) to authenticated;
