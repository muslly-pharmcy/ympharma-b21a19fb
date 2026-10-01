alter policy "payment_methods staff manage" on public.payment_methods to authenticated;
alter policy "shipping_zones staff manage" on public.shipping_zones to authenticated;
grant select on public.payment_methods to anon, authenticated;
grant select on public.shipping_zones to anon, authenticated;
grant insert, update, delete on public.payment_methods to authenticated;
grant insert, update, delete on public.shipping_zones to authenticated;