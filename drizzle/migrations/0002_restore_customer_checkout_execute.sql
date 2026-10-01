-- checkout_cart_fefo only acts on auth.uid()'s own cart; customers must be able to call it.
grant execute on function public.checkout_cart_fefo(text, text, text, uuid, text, text) to authenticated;