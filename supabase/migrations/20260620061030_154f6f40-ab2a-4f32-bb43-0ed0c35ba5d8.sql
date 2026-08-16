DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'valid_agent_modes') THEN
    CREATE TYPE public.valid_agent_modes AS ENUM (
      'pharmacist', 'inventory', 'procurement', 'refill', 'marketing',
      'import_excel_classifier', 'bi', 'ceo', 'cto', 'cx',
      'operations', 'sales', 'whatsapp'
    );
  END IF;
END $$;

UPDATE public.agent_runs SET agent = 'bi' WHERE agent = 'intel.nightly';
UPDATE public.agent_runs SET agent = 'inventory'
  WHERE agent NOT IN (
    'pharmacist','inventory','procurement','refill','marketing',
    'import_excel_classifier','bi','ceo','cto','cx','operations','sales','whatsapp'
  );

ALTER TABLE public.agent_runs
  ALTER COLUMN agent TYPE public.valid_agent_modes
  USING agent::public.valid_agent_modes;
