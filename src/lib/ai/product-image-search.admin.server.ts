/** Admin/owner gate for product image tooling. */
export async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'owner'])
    .limit(1)
  if (!data || data.length === 0) throw new Error('صلاحيات المشرف مطلوبة')
}
