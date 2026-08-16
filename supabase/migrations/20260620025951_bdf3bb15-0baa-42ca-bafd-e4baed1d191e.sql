
CREATE OR REPLACE FUNCTION public.generate_marketing_campaigns()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_dormant int := 0; v_chronic int := 0; v_seasonal int := 0;
BEGIN
  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, message_text, payload)
  SELECT 'dormant_reactivation', cp.phone, cp.name, 'dormant',
    format('بدون طلب منذ %s يوم', EXTRACT(DAY FROM now()-cp.last_order_at)::int),
    format('مرحباً %s 👋 اشتقنا لك! خصم 10%% على طلبك القادم بكود WELCOME10. صيدلية مصلي.',
      COALESCE(cp.name,'عميلنا الكريم')),
    jsonb_build_object('discount_pct',10,'code','WELCOME10','days_inactive',EXTRACT(DAY FROM now()-cp.last_order_at)::int)
  FROM public.customer_profiles cp
  WHERE cp.last_order_at < now() - interval '30 days' AND cp.orders_count >= 1
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = cp.phone AND mq.campaign_kind = 'dormant_reactivation'
        AND mq.generated_at > now() - interval '14 days'
    )
  LIMIT 50;
  GET DIAGNOSTICS v_dormant = ROW_COUNT;

  -- chronic: bulletproof via CASE to avoid evaluating jsonb_array_length on non-arrays
  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, message_text, payload)
  SELECT 'chronic_refill', cp.phone, cp.name, 'chronic',
    'مريض مزمن - تذكير إعادة صرف',
    format('مرحباً %s 💊 حان وقت إعادة صرف أدويتك المزمنة. اطلب الآن مع توصيل مجاني.',
      COALESCE(cp.name,'عميلنا')),
    jsonb_build_object('discount_pct',15,'segment','chronic','flags',cp.chronic_flags)
  FROM public.customer_profiles cp
  WHERE jsonb_array_length(
          CASE WHEN jsonb_typeof(cp.chronic_flags) = 'array' THEN cp.chronic_flags ELSE '[]'::jsonb END
        ) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = cp.phone AND mq.campaign_kind = 'chronic_refill'
        AND mq.generated_at > now() - interval '30 days'
    )
  LIMIT 50;
  GET DIAGNOSTICS v_chronic = ROW_COUNT;

  INSERT INTO public.marketing_queue(campaign_kind, customer_phone, customer_name, segment, reason, message_text, payload)
  SELECT 'seasonal_offer', cp.phone, cp.name, 'engaged',
    'حملة موسمية',
    'عرض الموسم 🌟 خصم 12% على باقات الفيتامينات والمناعة. كود SEASON12',
    jsonb_build_object('discount_pct',12,'code','SEASON12','bundle','vitamins')
  FROM public.customer_profiles cp
  WHERE cp.last_order_at >= now() - interval '60 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_queue mq
      WHERE mq.customer_phone = cp.phone AND mq.campaign_kind = 'seasonal_offer'
        AND mq.generated_at > now() - interval '21 days'
    )
  LIMIT 30;
  GET DIAGNOSTICS v_seasonal = ROW_COUNT;

  RETURN jsonb_build_object('dormant',v_dormant,'chronic',v_chronic,'seasonal',v_seasonal,
    'total', v_dormant + v_chronic + v_seasonal);
END $fn$;
