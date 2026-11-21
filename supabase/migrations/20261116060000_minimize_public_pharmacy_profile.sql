-- Preserve the existing EXECUTE ACL. Do not reopen anonymous access.
-- Explicit fields prevent future administrative columns leaking through this RPC.
CREATE OR REPLACE FUNCTION public.pn_get_pharmacy_public(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pharmacy', jsonb_build_object(
      'id', p.id, 'slug', p.slug, 'name_ar', p.name_ar, 'name_en', p.name_en,
      'phone', p.phone, 'whatsapp', p.whatsapp, 'email', p.email,
      'city', p.city, 'district', p.district, 'address', p.address,
      'lat', p.lat, 'lng', p.lng, 'logo_url', p.logo_url,
      'cover_url', p.cover_url, 'bio_ar', p.bio_ar,
      'is_public', p.is_public, 'is_24_7', p.is_24_7,
      'verification_status', p.verification_status
    ),
    'hours', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'weekday', h.weekday, 'open_time', h.open_time,
      'close_time', h.close_time, 'is_closed', h.is_closed
    ) ORDER BY h.weekday)
      FROM public.pn_pharmacy_hours h WHERE h.pharmacy_id = p.id), '[]'::jsonb),
    'product_count', (SELECT count(*) FROM public.pn_pharmacy_stock s
      WHERE s.pharmacy_id = p.id AND s.availability <> 'out')
  )
  FROM public.pn_pharmacies p
  WHERE p.slug = _slug AND p.is_public = true AND p.verification_status = 'verified'
$$;
