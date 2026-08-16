
-- Enums
DO $$ BEGIN CREATE TYPE public.pn_verification_status AS ENUM ('pending','verified','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pn_availability AS ENUM ('in_stock','low','out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pn_transfer_reason AS ENUM ('near_expiry','shortage','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pn_transfer_status AS ENUM ('draft','pending','accepted','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pn_pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  phone text, whatsapp text, email text,
  city text, district text, address text,
  lat double precision, lng double precision,
  logo_url text, cover_url text, bio_ar text,
  is_public boolean NOT NULL DEFAULT false,
  is_24_7 boolean NOT NULL DEFAULT false,
  verification_status public.pn_verification_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz, verified_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pn_pharmacies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pn_pharmacies TO authenticated;
GRANT ALL ON public.pn_pharmacies TO service_role;
ALTER TABLE public.pn_pharmacies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn_pharmacies_public_read" ON public.pn_pharmacies FOR SELECT TO anon, authenticated
  USING (is_public = true AND verification_status = 'verified');
CREATE POLICY "pn_pharmacies_org_read" ON public.pn_pharmacies FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.organization_id = pn_pharmacies.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "pn_pharmacies_org_write" ON public.pn_pharmacies FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.organization_id = pn_pharmacies.organization_id
      AND m.user_id = auth.uid() AND m.role IN ('owner','admin','manager')))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.organization_id = pn_pharmacies.organization_id
      AND m.user_id = auth.uid() AND m.role IN ('owner','admin','manager')));
CREATE POLICY "pn_pharmacies_admin_all" ON public.pn_pharmacies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS pn_pharmacies_city_idx ON public.pn_pharmacies (city);
CREATE INDEX IF NOT EXISTS pn_pharmacies_public_idx ON public.pn_pharmacies (is_public, verification_status);
CREATE INDEX IF NOT EXISTS pn_pharmacies_geo_idx ON public.pn_pharmacies (lat, lng);

CREATE TABLE IF NOT EXISTS public.pn_pharmacy_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pn_pharmacies(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time time, close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, weekday)
);
GRANT SELECT ON public.pn_pharmacy_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pn_pharmacy_hours TO authenticated;
GRANT ALL ON public.pn_pharmacy_hours TO service_role;
ALTER TABLE public.pn_pharmacy_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn_hours_public_read" ON public.pn_pharmacy_hours FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.pn_pharmacies p WHERE p.id = pn_pharmacy_hours.pharmacy_id
                 AND p.is_public = true AND p.verification_status = 'verified'));
CREATE POLICY "pn_hours_org_write" ON public.pn_pharmacy_hours FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pn_pharmacies p
                 JOIN public.organization_members m ON m.organization_id = p.organization_id
                 WHERE p.id = pn_pharmacy_hours.pharmacy_id AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pn_pharmacies p
                      JOIN public.organization_members m ON m.organization_id = p.organization_id
                      WHERE p.id = pn_pharmacy_hours.pharmacy_id AND m.user_id = auth.uid()
                        AND m.role IN ('owner','admin','manager')));

CREATE TABLE IF NOT EXISTS public.pn_pharmacy_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pn_pharmacies(id) ON DELETE CASCADE,
  catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  availability public.pn_availability NOT NULL DEFAULT 'in_stock',
  price_yer numeric(12,2),
  price_visible boolean NOT NULL DEFAULT false,
  expiry_date date, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, catalog_product_id)
);
GRANT SELECT ON public.pn_pharmacy_stock TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pn_pharmacy_stock TO authenticated;
GRANT ALL ON public.pn_pharmacy_stock TO service_role;
ALTER TABLE public.pn_pharmacy_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn_stock_public_read" ON public.pn_pharmacy_stock FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.pn_pharmacies p WHERE p.id = pn_pharmacy_stock.pharmacy_id
                 AND p.is_public = true AND p.verification_status = 'verified'));
CREATE POLICY "pn_stock_org_write" ON public.pn_pharmacy_stock FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pn_pharmacies p
                 JOIN public.organization_members m ON m.organization_id = p.organization_id
                 WHERE p.id = pn_pharmacy_stock.pharmacy_id AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin','manager','pharmacist')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pn_pharmacies p
                      JOIN public.organization_members m ON m.organization_id = p.organization_id
                      WHERE p.id = pn_pharmacy_stock.pharmacy_id AND m.user_id = auth.uid()
                        AND m.role IN ('owner','admin','manager','pharmacist')));
CREATE INDEX IF NOT EXISTS pn_stock_product_idx ON public.pn_pharmacy_stock (catalog_product_id);
CREATE INDEX IF NOT EXISTS pn_stock_pharmacy_idx ON public.pn_pharmacy_stock (pharmacy_id);
CREATE INDEX IF NOT EXISTS pn_stock_expiry_idx ON public.pn_pharmacy_stock (expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pn_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pn_pharmacies(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status public.pn_verification_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid, reviewer_notes text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pn_verification_requests TO authenticated;
GRANT ALL ON public.pn_verification_requests TO service_role;
ALTER TABLE public.pn_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn_ver_org_read" ON public.pn_verification_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pn_pharmacies p
                 JOIN public.organization_members m ON m.organization_id = p.organization_id
                 WHERE p.id = pn_verification_requests.pharmacy_id AND m.user_id = auth.uid())
         OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pn_ver_org_insert" ON public.pn_verification_requests FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.pn_pharmacies p
    JOIN public.organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = pn_verification_requests.pharmacy_id AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin','manager')));
CREATE POLICY "pn_ver_admin_update" ON public.pn_verification_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.pn_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_pharmacy_id uuid NOT NULL REFERENCES public.pn_pharmacies(id) ON DELETE CASCADE,
  to_pharmacy_id uuid NOT NULL REFERENCES public.pn_pharmacies(id) ON DELETE CASCADE,
  catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  qty numeric(12,2) NOT NULL CHECK (qty > 0),
  reason public.pn_transfer_reason NOT NULL DEFAULT 'shortage',
  status public.pn_transfer_status NOT NULL DEFAULT 'draft',
  notes text,
  requested_by uuid NOT NULL, responded_by uuid, responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_pharmacy_id <> to_pharmacy_id)
);
GRANT SELECT, INSERT, UPDATE ON public.pn_transfer_requests TO authenticated;
GRANT ALL ON public.pn_transfer_requests TO service_role;
ALTER TABLE public.pn_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn_tr_involved_read" ON public.pn_transfer_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.pn_pharmacies p
               JOIN public.organization_members m ON m.organization_id = p.organization_id
               WHERE p.id IN (pn_transfer_requests.from_pharmacy_id, pn_transfer_requests.to_pharmacy_id)
                 AND m.user_id = auth.uid()));
CREATE POLICY "pn_tr_involved_write" ON public.pn_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.pn_pharmacies p
    JOIN public.organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = pn_transfer_requests.from_pharmacy_id AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin','manager','pharmacist')));
CREATE POLICY "pn_tr_involved_update" ON public.pn_transfer_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.pn_pharmacies p
               JOIN public.organization_members m ON m.organization_id = p.organization_id
               WHERE p.id IN (pn_transfer_requests.from_pharmacy_id, pn_transfer_requests.to_pharmacy_id)
                 AND m.user_id = auth.uid() AND m.role IN ('owner','admin','manager')))
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.pn_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN CREATE TRIGGER pn_pharmacies_touch BEFORE UPDATE ON public.pn_pharmacies FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER pn_hours_touch BEFORE UPDATE ON public.pn_pharmacy_hours FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER pn_stock_touch BEFORE UPDATE ON public.pn_pharmacy_stock FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER pn_ver_touch BEFORE UPDATE ON public.pn_verification_requests FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER pn_tr_touch BEFORE UPDATE ON public.pn_transfer_requests FOR EACH ROW EXECUTE FUNCTION public.pn_touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public: nearby search
CREATE OR REPLACE FUNCTION public.pn_search_medicine_nearby(
  _q text, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL,
  _radius_km int DEFAULT 25, _limit int DEFAULT 50
) RETURNS TABLE (
  pharmacy_id uuid, pharmacy_slug text, pharmacy_name_ar text,
  city text, district text, phone text, whatsapp text,
  lat double precision, lng double precision, distance_km double precision,
  catalog_product_id uuid, product_name text,
  availability public.pn_availability, price_yer numeric, price_visible boolean, expiry_date date
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH matched AS (
    SELECT cp.id, COALESCE(cp.name_ar, cp.name_en, cp.generic_name, cp.brand, '(بدون اسم)') AS name
    FROM public.catalog_products cp
    WHERE _q IS NULL OR _q = ''
       OR COALESCE(cp.name_ar,'') ILIKE '%'||_q||'%'
       OR COALESCE(cp.name_en,'') ILIKE '%'||_q||'%'
       OR COALESCE(cp.generic_name,'') ILIKE '%'||_q||'%'
       OR COALESCE(cp.brand,'') ILIKE '%'||_q||'%'
    LIMIT 200
  )
  SELECT p.id, p.slug, p.name_ar, p.city, p.district, p.phone, p.whatsapp, p.lat, p.lng,
    CASE WHEN _lat IS NULL OR _lng IS NULL OR p.lat IS NULL OR p.lng IS NULL THEN NULL
         ELSE 6371 * 2 * asin(sqrt(power(sin(radians((p.lat - _lat)/2)),2)
              + cos(radians(_lat)) * cos(radians(p.lat)) * power(sin(radians((p.lng - _lng)/2)),2))) END,
    m.id, m.name, s.availability, s.price_yer, s.price_visible, s.expiry_date
  FROM matched m
  JOIN public.pn_pharmacy_stock s ON s.catalog_product_id = m.id
  JOIN public.pn_pharmacies p ON p.id = s.pharmacy_id
  WHERE p.is_public = true AND p.verification_status = 'verified' AND s.availability <> 'out'
    AND (_lat IS NULL OR _lng IS NULL OR p.lat IS NULL OR p.lng IS NULL
         OR (6371 * 2 * asin(sqrt(power(sin(radians((p.lat - _lat)/2)),2)
             + cos(radians(_lat)) * cos(radians(p.lat)) * power(sin(radians((p.lng - _lng)/2)),2)))) <= _radius_km)
  ORDER BY CASE WHEN _lat IS NULL OR _lng IS NULL OR p.lat IS NULL OR p.lng IS NULL THEN 1 ELSE 0 END,
           10 NULLS LAST, s.availability
  LIMIT _limit
$$;
REVOKE ALL ON FUNCTION public.pn_search_medicine_nearby(text, double precision, double precision, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_search_medicine_nearby(text, double precision, double precision, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pn_get_pharmacy_public(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pharmacy', to_jsonb(p) - 'metadata',
    'hours', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.weekday)
                       FROM public.pn_pharmacy_hours h WHERE h.pharmacy_id = p.id), '[]'::jsonb),
    'product_count', (SELECT count(*) FROM public.pn_pharmacy_stock s WHERE s.pharmacy_id = p.id AND s.availability <> 'out')
  )
  FROM public.pn_pharmacies p
  WHERE p.slug = _slug AND p.is_public = true AND p.verification_status = 'verified'
$$;
REVOKE ALL ON FUNCTION public.pn_get_pharmacy_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_get_pharmacy_public(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pn_list_pharmacy_products(
  _slug text, _q text DEFAULT NULL, _limit int DEFAULT 100, _offset int DEFAULT 0
) RETURNS TABLE (
  catalog_product_id uuid, product_name text,
  availability public.pn_availability, price_yer numeric, price_visible boolean, expiry_date date
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.catalog_product_id,
         COALESCE(cp.name_ar, cp.name_en, cp.generic_name, cp.brand, '(بدون اسم)') AS product_name,
         s.availability, s.price_yer, s.price_visible, s.expiry_date
  FROM public.pn_pharmacies p
  JOIN public.pn_pharmacy_stock s ON s.pharmacy_id = p.id
  JOIN public.catalog_products cp ON cp.id = s.catalog_product_id
  WHERE p.slug = _slug AND p.is_public = true AND p.verification_status = 'verified'
    AND (_q IS NULL OR _q = ''
         OR COALESCE(cp.name_ar,'') ILIKE '%'||_q||'%'
         OR COALESCE(cp.name_en,'') ILIKE '%'||_q||'%'
         OR COALESCE(cp.generic_name,'') ILIKE '%'||_q||'%'
         OR COALESCE(cp.brand,'') ILIKE '%'||_q||'%')
  ORDER BY s.availability, product_name
  LIMIT _limit OFFSET _offset
$$;
REVOKE ALL ON FUNCTION public.pn_list_pharmacy_products(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_list_pharmacy_products(text, text, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pn_upsert_stock(
  _pharmacy_id uuid, _catalog_product_id uuid, _availability public.pn_availability,
  _price_yer numeric DEFAULT NULL, _price_visible boolean DEFAULT false,
  _expiry_date date DEFAULT NULL, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pn_pharmacies p
                 JOIN public.organization_members m ON m.organization_id = p.organization_id
                 WHERE p.id = _pharmacy_id AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin','manager','pharmacist'))
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.pn_pharmacy_stock (pharmacy_id, catalog_product_id, availability, price_yer, price_visible, expiry_date, notes)
  VALUES (_pharmacy_id, _catalog_product_id, _availability, _price_yer, _price_visible, _expiry_date, _notes)
  ON CONFLICT (pharmacy_id, catalog_product_id) DO UPDATE
    SET availability = EXCLUDED.availability, price_yer = EXCLUDED.price_yer,
        price_visible = EXCLUDED.price_visible, expiry_date = EXCLUDED.expiry_date,
        notes = EXCLUDED.notes, updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.pn_upsert_stock(uuid, uuid, public.pn_availability, numeric, boolean, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_upsert_stock(uuid, uuid, public.pn_availability, numeric, boolean, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pn_submit_verification(
  _pharmacy_id uuid, _documents jsonb DEFAULT '[]'::jsonb, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pn_pharmacies p
                 JOIN public.organization_members m ON m.organization_id = p.organization_id
                 WHERE p.id = _pharmacy_id AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin','manager')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.pn_verification_requests (pharmacy_id, submitted_by, documents, notes)
  VALUES (_pharmacy_id, auth.uid(), COALESCE(_documents, '[]'::jsonb), _notes)
  RETURNING id INTO _id;
  UPDATE public.pn_pharmacies SET verification_status = 'pending', updated_at = now() WHERE id = _pharmacy_id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.pn_submit_verification(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_submit_verification(uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pn_verify_pharmacy(
  _pharmacy_id uuid, _approved boolean, _reviewer_notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.pn_pharmacies
     SET verification_status = CASE WHEN _approved THEN 'verified'::public.pn_verification_status ELSE 'rejected'::public.pn_verification_status END,
         verified_at = CASE WHEN _approved THEN now() ELSE NULL END,
         verified_by = auth.uid(), updated_at = now()
   WHERE id = _pharmacy_id;
  UPDATE public.pn_verification_requests
     SET status = CASE WHEN _approved THEN 'verified'::public.pn_verification_status ELSE 'rejected'::public.pn_verification_status END,
         reviewer_id = auth.uid(), reviewer_notes = _reviewer_notes,
         reviewed_at = now(), updated_at = now()
   WHERE pharmacy_id = _pharmacy_id AND status = 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.pn_verify_pharmacy(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_verify_pharmacy(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pn_request_transfer(
  _from_pharmacy_id uuid, _to_pharmacy_id uuid, _catalog_product_id uuid,
  _qty numeric, _reason public.pn_transfer_reason DEFAULT 'shortage', _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pn_pharmacies p
                 JOIN public.organization_members m ON m.organization_id = p.organization_id
                 WHERE p.id = _from_pharmacy_id AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin','manager','pharmacist')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- NOTE: No stock movement. Marketplace / transfer execution intentionally disabled in this phase.
  INSERT INTO public.pn_transfer_requests
    (from_pharmacy_id, to_pharmacy_id, catalog_product_id, qty, reason, notes, requested_by, status)
  VALUES (_from_pharmacy_id, _to_pharmacy_id, _catalog_product_id, _qty, _reason, _notes, auth.uid(), 'pending')
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.pn_request_transfer(uuid, uuid, uuid, numeric, public.pn_transfer_reason, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_request_transfer(uuid, uuid, uuid, numeric, public.pn_transfer_reason, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pn_flag_near_expiry(_days int DEFAULT 90)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO _n FROM public.pn_pharmacy_stock s
   WHERE s.expiry_date IS NOT NULL
     AND s.expiry_date <= (current_date + (_days || ' days')::interval)::date;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.pn_flag_near_expiry(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pn_flag_near_expiry(int) TO authenticated;

-- Seed: 5 Aden pharmacies
DO $$
DECLARE
  slugs text[] := ARRAY['al-mualla-aden','crater-central-pharmacy','mansoura-24-pharmacy','khormaksar-family','tawahi-pharma'];
  names text[] := ARRAY['صيدلية المعلا','صيدلية كريتر المركزية','صيدلية المنصورة 24','صيدلية خورمكسر العائلية','صيدلية التواهي'];
  districts text[] := ARRAY['المعلا','كريتر','المنصورة','خورمكسر','التواهي'];
  lats double precision[] := ARRAY[12.7855, 12.7743, 12.8390, 12.8213, 12.7745];
  lngs double precision[] := ARRAY[44.9770, 45.0367, 45.0289, 45.0292, 44.9925];
  is24 boolean[] := ARRAY[false, false, true, false, false];
  i int; new_ph_id uuid; sample_products uuid[];
BEGIN
  SELECT array_agg(id) INTO sample_products FROM (
    SELECT id FROM public.catalog_products ORDER BY created_at DESC NULLS LAST LIMIT 15
  ) t;

  FOR i IN 1..array_length(slugs,1) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.pn_pharmacies WHERE slug = slugs[i]) THEN
      INSERT INTO public.pn_pharmacies
        (slug, name_ar, city, district, phone, whatsapp, lat, lng, is_public, is_24_7, verification_status, verified_at, bio_ar)
      VALUES
        (slugs[i], names[i], 'عدن', districts[i],
         '+96773' || (1000000 + i*11111)::text, '+96773' || (1000000 + i*11111)::text,
         lats[i], lngs[i], true, is24[i], 'verified', now(),
         'صيدلية موثّقة ضمن شبكة صيدليات اليمن — بيانات تجريبية.')
      RETURNING id INTO new_ph_id;

      INSERT INTO public.pn_pharmacy_hours (pharmacy_id, weekday, open_time, close_time, is_closed)
      SELECT new_ph_id, d,
        CASE WHEN is24[i] THEN time '00:00' ELSE time '08:00' END,
        CASE WHEN is24[i] THEN time '23:59' ELSE time '22:00' END,
        CASE WHEN NOT is24[i] AND d = 5 THEN true ELSE false END
      FROM generate_series(0,6) d;

      IF sample_products IS NOT NULL THEN
        INSERT INTO public.pn_pharmacy_stock (pharmacy_id, catalog_product_id, availability, price_visible)
        SELECT new_ph_id, p,
               CASE WHEN random() < 0.15 THEN 'low'::public.pn_availability ELSE 'in_stock'::public.pn_availability END, false
        FROM unnest(sample_products) p
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;
