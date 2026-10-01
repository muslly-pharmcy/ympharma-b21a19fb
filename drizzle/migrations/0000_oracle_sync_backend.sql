create table if not exists public.oracle_sync_runs (
  batch_id text primary key,
  source_system text not null,
  mode text not null check (mode in ('dry-run','apply')),
  status text not null default 'receiving' check (status in ('receiving','validated','completed','failed')),
  received_rows integer not null default 0,
  applied_rows integer not null default 0,
  skipped_rows integer not null default 0,
  error_rows integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.oracle_sync_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null references public.oracle_sync_runs(batch_id) on delete cascade,
  source_system text not null,
  entity_type text not null check (entity_type in ('product','barcode','warehouse','stock_batch')),
  source_key text not null,
  idempotency_key text not null unique,
  payload jsonb not null,
  source_updated_at timestamptz,
  status text not null default 'received' check (status in ('received','validated','applied','skipped','failed')),
  error text,
  received_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists oracle_sync_staging_batch_status_idx on public.oracle_sync_staging (batch_id, status);
revoke all on table public.oracle_sync_runs from public, anon, authenticated;
revoke all on table public.oracle_sync_staging from public, anon, authenticated;
grant select on public.oracle_sync_runs to authenticated;
grant all on public.oracle_sync_runs to service_role;
grant all on public.oracle_sync_staging to service_role;
alter table public.oracle_sync_runs enable row level security;
alter table public.oracle_sync_staging enable row level security;
create policy "admins read sync runs" on public.oracle_sync_runs for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'owner'));

create or replace function public.apply_oracle_sync_products(p_rows jsonb, p_org uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v integer := 0;
begin
  insert into public.catalog_products as p (organization_id, owner_org_id, store_code, name_ar, name_en, brand, generic_name, strength, dosage_form, manufacturer, barcode, status, is_public, requires_prescription, metadata, updated_at)
  select p_org, p_org, btrim(r.store_code), btrim(r.name_ar), nullif(btrim(r.name_en),''), nullif(btrim(r.brand),''), nullif(btrim(r.generic_name),''), nullif(btrim(r.strength),''), nullif(btrim(r.dosage_form),''), nullif(btrim(r.manufacturer),''), nullif(btrim(r.barcode),''),
    'draft'::public.catalog_status, false, true, jsonb_build_object('oracle_sync', true, 'requires_pharmacist_review', true), now()
  from jsonb_to_recordset(p_rows) as r(store_code text, name_ar text, name_en text, brand text, generic_name text, strength text, dosage_form text, manufacturer text, barcode text)
  where nullif(btrim(r.store_code),'') is not null and nullif(btrim(r.name_ar),'') is not null
  on conflict (organization_id, store_code) where store_code is not null do update set
    name_ar = excluded.name_ar, name_en = coalesce(excluded.name_en, p.name_en), brand = coalesce(excluded.brand, p.brand),
    generic_name = coalesce(excluded.generic_name, p.generic_name), strength = coalesce(excluded.strength, p.strength),
    dosage_form = coalesce(excluded.dosage_form, p.dosage_form), manufacturer = coalesce(excluded.manufacturer, p.manufacturer),
    barcode = coalesce(excluded.barcode, p.barcode),
    metadata = coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object('oracle_sync', true, 'last_synced_at', now()),
    updated_at = now();
  get diagnostics v = row_count;
  return v;
end $$;

create or replace function public.apply_oracle_sync_stock(p_rows jsonb, p_org uuid, p_warehouse uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare r record; v_pid uuid; v_bid uuid; n integer := 0;
begin
  for r in select * from jsonb_to_recordset(p_rows) as x(source_key text, store_code text, batch_no text, expiry_date date, qty_on_hand numeric, selling_price numeric) loop
    select id into v_pid from public.catalog_products where organization_id = p_org and store_code = btrim(r.store_code);
    continue when v_pid is null;
    select id into v_bid from public.inv_stock_batches where organization_id = p_org and metadata->>'oracle_source_key' = r.source_key limit 1;
    if v_bid is null then
      insert into public.inv_stock_batches (organization_id, warehouse_id, product_id, batch_no, expiry_date, qty_on_hand, selling_price, metadata)
      values (p_org, p_warehouse, v_pid, nullif(r.batch_no,'-'), r.expiry_date, greatest(coalesce(r.qty_on_hand,0),0), r.selling_price, jsonb_build_object('oracle_source_key', r.source_key));
    else
      update public.inv_stock_batches set qty_on_hand = greatest(coalesce(r.qty_on_hand,0),0), selling_price = coalesce(r.selling_price, selling_price), expiry_date = coalesce(r.expiry_date, expiry_date), updated_at = now() where id = v_bid;
    end if;
    if r.selling_price is not null and r.selling_price > 0 then
      update public.catalog_products set sbdma_official_price = r.selling_price, updated_at = now() where id = v_pid;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.apply_oracle_sync_products(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.apply_oracle_sync_stock(jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_oracle_sync_products(jsonb, uuid) to service_role;
grant execute on function public.apply_oracle_sync_stock(jsonb, uuid, uuid) to service_role;