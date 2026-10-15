import type { ErpContext } from './handler.server'
export async function readCatalogPreview(body: any, db: any, context: ErpContext) {
  if (!body || Object.keys(body).some(k => !['sourceSystem', 'product'].includes(k)) || body.sourceSystem !== context.source || typeof body.product !== 'string' || !body.product || body.product.length > 200) return { status: 400, body: { error: 'invalid_catalog_preview' } }
  const {data,error}=await db.rpc('erp_catalog_preview',{p_source:context.source,p_product:body.product})
  return error||!data?{status:503,body:{error:'catalog_preview_unavailable'}}:{status:200,body:data}
}
export async function applyCatalogRequest(body: any, db: any, context: ErpContext) {
  if (!body || body.command_id !== context.idempotencyKey || body.sourceSystem !== context.source) {
    return { status: 400, body: { error: 'catalog_identity_mismatch' } }
  }
  const { data, error } = await db.rpc('erp_catalog_apply', { p_source: context.source, p_body: body })
  return error || !data ? { status: 503, body: { error: 'catalog_result_unconfirmed' } } : { status: 200, body: data }
}
