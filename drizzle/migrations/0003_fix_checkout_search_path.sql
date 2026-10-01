-- gen_random_bytes lives in the extensions schema (pgcrypto).
alter function public.checkout_cart_fefo(text, text, text, uuid, text, text) set search_path = public, extensions;