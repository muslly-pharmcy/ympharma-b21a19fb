
CREATE OR REPLACE FUNCTION public.run_marketing_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recs int := 0; v_dormant int; v_chronic int; v_engaged int; v_total int;
        v_engagement numeric; v_readiness numeric;
BEGIN
  SELECT COUNT(*) INTO v_dormant FROM public.customer_profiles
    WHERE last_order_at < now() - interval '60 days' AND orders_count >= 2;
  SELECT COUNT(*) INTO v_chronic FROM public.customer_profiles
    WHERE chronic_flags IS NOT NULL
      AND (CASE WHEN jsonb_typeof(chronic_flags) = 'array'
                THEN jsonb_array_length(chronic_flags) ELSE 0 END) > 0;
  SELECT COUNT(*) INTO v_engaged FROM public.customer_profiles
    WHERE last_order_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO v_total FROM public.customer_profiles;

  IF v_dormant > 0 THEN
    PERFORM public._agent_rec_upsert('marketing','marketing',
      format('حملة إيقاظ: %s عميل خامل', v_dormant),
      'عملاء بدون طلب منذ 60+ يوم — أرسل قسيمة 10% لتنشيطهم',
      jsonb_build_object('count',v_dormant,'segment','dormant','discount_pct',10),
      v_dormant * 800, 80,
      'mkt_dormant_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;
  IF v_chronic > 0 THEN
    PERFORM public._agent_rec_upsert('marketing','marketing',
      format('تذكير مزمن: %s مريض', v_chronic),
      'مرضى مزمنون يحتاجون إعادة صرف — استخدم الزر "إرسال تذكيرات المزمن"',
      jsonb_build_object('count',v_chronic,'segment','chronic','discount_pct',15),
      v_chronic * 1200, 90,
      'mkt_chronic_'||to_char(CURRENT_DATE,'IYYY-IW'));
    v_recs := v_recs + 1;
  END IF;

  v_engagement := CASE WHEN v_total>0 THEN v_engaged::numeric/v_total*100 ELSE 0 END;
  v_readiness := LEAST(100, v_recs*40 + LEAST(20, v_chronic*0.5));

  PERFORM public._agent_kpi_upsert('marketing','engagement_score', v_engagement,
    jsonb_build_object('engaged_30d',v_engaged,'total',v_total,'dormant',v_dormant));
  PERFORM public._agent_kpi_upsert('marketing','campaign_readiness_score', v_readiness,
    jsonb_build_object('campaigns_ready',v_recs,'chronic',v_chronic));

  RETURN jsonb_build_object('findings_count', v_dormant + v_chronic, 'recommendations_count', v_recs,
    'summary', format('%s خامل / %s مزمن / %s نشط — %s حملة جاهزة', v_dormant, v_chronic, v_engaged, v_recs),
    'details', jsonb_build_object('dormant',v_dormant,'chronic',v_chronic,'engaged',v_engaged));
END $$;
