CREATE OR REPLACE FUNCTION public.intercept_new_prescription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_image_url text := NULL;
BEGIN
  IF NEW.image_urls IS NOT NULL AND array_length(NEW.image_urls, 1) > 0 THEN
    v_image_url := NEW.image_urls[1];
  END IF;

  INSERT INTO public.agent_actions (
    agent_name, action_type, payload, status,
    originating_agent, target_pipeline, execution_status, priority_level,
    compiled_arabic_output
  ) VALUES (
    'pharmacist',
    'EXTRACT_AND_QUOTE',
    jsonb_build_object(
      'prescription_id', NEW.id,
      'customer_phone', NEW.customer_phone,
      'image_url', v_image_url,
      'image_urls', to_jsonb(NEW.image_urls)
    ),
    'pending',
    'pharmacist'::public.valid_agent_modes,
    'PRESCRIPTIONS'::public.action_target_pipeline,
    'PENDING_APPROVAL'::public.action_execution_status,
    'HIGH',
    'وصفة جديدة بانتظار الاستخراج والتسعير من الصيدلي الذكي.'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.error_logs (source, message, extra)
    VALUES (
      'intercept_new_prescription',
      SQLERRM,
      jsonb_build_object('prescription_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- never break the prescription insert because of logging
    NULL;
  END;
  RETURN NEW;
END;
$function$;
