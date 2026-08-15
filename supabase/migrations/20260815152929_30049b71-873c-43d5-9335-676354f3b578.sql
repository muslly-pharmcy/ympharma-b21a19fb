ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS family_name text;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first  text := nullif(btrim(NEW.raw_user_meta_data->>'first_name'), '');
  v_father text := nullif(btrim(NEW.raw_user_meta_data->>'father_name'), '');
  v_family text := nullif(btrim(NEW.raw_user_meta_data->>'family_name'), '');
  v_display text;
BEGIN
  v_display := nullif(btrim(concat_ws(' ', v_first, v_father, v_family)), '');
  v_display := COALESCE(
    v_display,
    nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(NEW.raw_user_meta_data->>'name'), ''),
    nullif(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    NEW.phone
  );

  INSERT INTO public.profiles (id, email, phone, display_name, first_name, father_name, family_name)
  VALUES (NEW.id, NEW.email, NEW.phone, v_display, v_first, v_father, v_family)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;