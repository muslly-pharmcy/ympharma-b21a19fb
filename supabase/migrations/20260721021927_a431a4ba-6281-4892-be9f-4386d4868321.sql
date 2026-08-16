INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES ('11111111-1111-1111-1111-000000000001', '47dd6048-07bb-4b64-b71b-94140a30d81d', 'owner', 'active')
ON CONFLICT DO NOTHING;