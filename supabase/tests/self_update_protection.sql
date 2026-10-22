-- Synthetic, rollback-only behavior test. Run only against an isolated storefront DB.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES
 ('11111111-1111-4111-8111-111111111111','scope-a@example.invalid','{}','{}'),
 ('22222222-2222-4222-8222-222222222222','scope-b@example.invalid','{}','{}'),
 ('33333333-3333-4333-8333-333333333333','scope-manager@example.invalid','{}','{}');
INSERT INTO public.organizations(id,name,type) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTHETIC A','PHARMACY'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SYNTHETIC B','PHARMACY');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','owner'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','owner'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','owner');
INSERT INTO public.hc_doctors(id,user_id,organization_id,slug,full_name_ar) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','scope-own-doctor','SYNTHETIC A'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','scope-other-doctor','SYNTHETIC B');
INSERT INTO storage.buckets(id,name,public) VALUES ('insurance-cards','insurance-cards',false)
 ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('insurance-cards','11111111-1111-4111-8111-111111111111/synthetic.txt'),
 ('insurance-cards','22222222-2222-4222-8222-222222222222/synthetic.txt');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
DO $$ BEGIN
 IF current_user<>'authenticated' OR (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
   RAISE EXCEPTION 'Test must use ordinary authenticated role';
 END IF;
END $$;
UPDATE public.profiles SET display_name='Allowed name' WHERE id=auth.uid();
DO $$ BEGIN
 IF (SELECT display_name FROM public.profiles WHERE id=auth.uid()) IS DISTINCT FROM 'Allowed name' THEN
   RAISE EXCEPTION 'Legitimate profile update failed';
 END IF;
END $$;
\echo PASS legitimate profile update

DO $$ BEGIN
 FOR n IN 1..4 LOOP
   UPDATE public.profiles SET status='suspended',metadata='{"privileged":true}',email='changed@example.invalid'
   WHERE id=auth.uid();
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active'
   AND metadata='{}' AND email='scope-a@example.invalid' AND display_name='Allowed name') THEN
   RAISE EXCEPTION 'Protected profile fields changed';
 END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.audit_events WHERE actor_user_id='11111111-1111-4111-8111-111111111111'
   AND action='self_update_reverted' AND resource_type='profiles'
   AND payload->'reverted' @> '["status","metadata","email"]')<>4 THEN
   RAISE EXCEPTION 'Every reverted profile update must have structured audit';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.staff_alerts WHERE kind='privilege_escalation_attempt'
   AND entity_id='11111111-1111-4111-8111-111111111111') THEN
   RAISE EXCEPTION 'Repeated attempts must raise a staff alert';
 END IF;
END $$;
\echo PASS protected profile fields, four audits and escalation alert

SET LOCAL ROLE authenticated;
UPDATE public.hc_doctors SET bio_ar='Allowed biography',trust_score=100,confidence_score=100,
 verification_status='verified',is_public=true,verified_at=now(),verified_by=auth.uid(),
 organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.hc_doctors WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND trust_score=0
   AND confidence_score=0 AND verification_status='pending' AND NOT is_public
   AND verified_at IS NULL AND verified_by IS NULL AND bio_ar='Allowed biography') THEN
   RAISE EXCEPTION 'Proposed-tenant permission bypass or legitimate field regression';
 END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.audit_events WHERE resource_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND action='self_update_reverted'
   AND payload->'reverted' @> '["organization_id","trust_score","confidence_score","verification_status","is_public","verified_at","verified_by"]') THEN
   RAISE EXCEPTION 'Doctor original-tenant audit missing';
 END IF;
END $$;
\echo PASS doctor tenant and score protection with original-tenant audit

SET LOCAL ROLE authenticated;
DO $$ DECLARE affected int; BEGIN
 IF EXISTS (SELECT 1 FROM public.profiles WHERE id='22222222-2222-4222-8222-222222222222')
    OR EXISTS (SELECT 1 FROM public.hc_doctors WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') THEN
   RAISE EXCEPTION 'Unrelated private profile visible';
 END IF;
 UPDATE public.hc_doctors SET bio_ar='Unauthorized' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Cross-tenant update succeeded'; END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='insurance-cards')<>1 THEN
   RAISE EXCEPTION 'Storage must expose exactly the actor-owned synthetic document';
 END IF;
 UPDATE storage.objects SET metadata='{"changed":true}'
 WHERE bucket_id='insurance-cards' AND name='22222222-2222-4222-8222-222222222222/synthetic.txt';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Cross-user storage update succeeded'; END IF;
 BEGIN
   INSERT INTO storage.objects(bucket_id,name) VALUES ('insurance-cards','22222222-2222-4222-8222-222222222222/forged.txt');
   RAISE EXCEPTION 'Cross-user storage insert succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 UPDATE storage.objects SET metadata='{"allowed":true}'
 WHERE bucket_id='insurance-cards' AND name='11111111-1111-4111-8111-111111111111/synthetic.txt';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Legitimate storage update failed'; END IF;
END $$;
\echo PASS populated cross-tenant/profile/storage negative checks and owner storage control

-- A real manager of both original and destination organizations retains permitted edits.
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
UPDATE public.hc_doctors SET organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',trust_score=25
WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.hc_doctors WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND trust_score=25) THEN
   RAISE EXCEPTION 'Authorized manager edit regressed';
 END IF;
END $$;
\echo PASS authorized manager control
RESET ROLE;
-- Changes are visible only within this rollback-only isolated transaction.
GRANT EXECUTE ON FUNCTION public.cancel_transfer(uuid,text) TO anon;
REVOKE EXECUTE ON FUNCTION public.cancel_transfer(uuid,text) FROM anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.audit_events WHERE action='privileged_grant_change'
   AND payload->>'signature'='public.cancel_transfer(uuid, text)')<>2 THEN
   RAISE EXCEPTION 'Real ACL grant and revoke must both produce an audit event';
 END IF;
 IF has_function_privilege('anon','public.cancel_transfer(uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Revoked function remained anonymous-callable';
 END IF;
END $$;
\echo PASS actual grant/revoke change auditing
ROLLBACK;
