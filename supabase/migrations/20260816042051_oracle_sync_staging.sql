begin;

create table if not exists public.oracle_sync_runs (
  batch_id text primary key,
  source_system text not null,
  mode text not null check (mode in ('dry-run', 'apply')),
  status text not null default 'receiving'
    check (status in ('receiving', 'validated', 'completed', 'failed')),
  received_rows integer not null default 0 check (received_rows >= 0),
  applied_rows integer not null default 0 check (applied_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.oracle_sync_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null references public.oracle_sync_runs(batch_id) on delete cascade,
  source_system text not null,
  entity_type text not null
    check (entity_type in ('product', 'barcode', 'warehouse', 'stock_batch')),
  source_key text not null,
  idempotency_key text not null unique,
  payload jsonb not null,
  source_updated_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'validated', 'applied', 'skipped', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists oracle_sync_staging_batch_status_idx
  on public.oracle_sync_staging (batch_id, status);

create index if not exists oracle_sync_staging_source_lookup_idx
  on public.oracle_sync_staging (source_system, entity_type, source_key);

comment on table public.oracle_sync_runs is
  'Read-only Oracle connector batches received through the signed ingest Edge Function.';
comment on table public.oracle_sync_staging is
  'Validated Oracle payloads. Public clients have no grants; only service_role may access it.';

alter table public.oracle_sync_runs enable row level security;
alter table public.oracle_sync_staging enable row level security;

revoke all on table public.oracle_sync_runs from public, anon, authenticated;
revoke all on table public.oracle_sync_staging from public, anon, authenticated;
grant select, insert, update, delete on table public.oracle_sync_runs to service_role;
grant select, insert, update, delete on table public.oracle_sync_staging to service_role;

create or replace function public.apply_oracle_sync_products(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_affected integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  insert into public.catalog_products as product (
    store_code,
    name_ar,
    name_en,
    brand,
    generic_name,
    strength,
    dosage_form,
    manufacturer,
    barcode,
    status,
    is_public,
    requires_prescription,
    metadata,
    updated_at
  )
  select
    nullif(btrim(source_row.store_code), ''),
    nullif(btrim(source_row.name_ar), ''),
    nullif(btrim(source_row.name_en), ''),
    nullif(btrim(source_row.brand), ''),
    nullif(btrim(source_row.generic_name), ''),
    nullif(btrim(source_row.strength), ''),
    nullif(btrim(source_row.dosage_form), ''),
    nullif(btrim(source_row.manufacturer), ''),
    nullif(btrim(source_row.barcode), ''),
    'draft'::public.catalog_status,
    false,
    true,
    jsonb_build_object('oracle_sync', true, 'requires_pharmacist_review', true),
    now()
  from jsonb_to_recordset(p_rows) as source_row(
    store_code text,
    name_ar text,
    name_en text,
    brand text,
    generic_name text,
    strength text,
    dosage_form text,
    manufacturer text,
    barcode text
  )
  where nullif(btrim(source_row.store_code), '') is not null
    and nullif(btrim(source_row.name_ar), '') is not null
  on conflict (store_code) where store_code is not null
  do update set
    name_ar = excluded.name_ar,
    name_en = excluded.name_en,
    brand = excluded.brand,
    generic_name = excluded.generic_name,
    strength = excluded.strength,
    dosage_form = excluded.dosage_form,
    manufacturer = excluded.manufacturer,
    barcode = excluded.barcode,
    metadata = coalesce(product.metadata, '{}'::jsonb)
      || jsonb_build_object('oracle_sync', true, 'last_synced_at', now()),
    updated_at = now();

  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

revoke all on function public.apply_oracle_sync_products(jsonb) from public, anon, authenticated;
grant execute on function public.apply_oracle_sync_products(jsonb) to service_role;

commit;
