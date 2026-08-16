-- Target only the isolated Oracle gateway project: ybhrmcdlgyccywpmiucz.
-- Do not apply this migration to the storefront database.
--
-- The gateway has no application role registry. These experimental control
-- tower helpers previously returned true for every user, so they are locked
-- fail-closed until a real gateway authorization model is introduced.

begin;

create or replace function public.has_role(
  user_id uuid,
  required_role public.app_role
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select false;
$function$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.is_control_tower_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select false;
$function$;

revoke all on function public.is_control_tower_admin() from public, anon;
grant execute on function public.is_control_tower_admin() to authenticated, service_role;

create index if not exists system_audit_logs_admin_id_idx
  on public.system_audit_logs (admin_id);

create index if not exists system_settings_updated_by_idx
  on public.system_settings (updated_by);

commit;
