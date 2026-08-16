
-- 1) Add 'owner' to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
