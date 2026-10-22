import type { ErpContext } from './handler.server'
export async function applyStockRequest(body: any, db: any, context: ErpContext) {
    if(body?.projection){
      const {data,error}=await db.rpc('erp_bridge_ingest_projection',{p_source:context.source,p_key:context.idempotencyKey,p_hash:context.contentHash,p_body:body});
      return error||!data?{status:503,body:{error:'projection_unconfirmed'}}:{status:data.status,body:data.body};
    }
    if (!body || Object.keys(body).some(k => !['sourceSystem','sourceEpoch','rows'].includes(k)) || typeof body.sourceEpoch !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(body.sourceEpoch) || !Array.isArray(body.rows) || !body.rows.length || body.rows.length > 500) return { status: 400, body: { error: 'invalid_envelope' } }
    const { data, error } = await db.rpc('erp_v2_apply_stock', { p_source: context.source, p_key: context.idempotencyKey, p_hash: context.contentHash, p_epoch: body.sourceEpoch, p_rows: body.rows })
    if (error || !data || !Number.isInteger(data.status) || !data.body) return { status: 503, body: { error: 'apply_unconfirmed_retry_same_request' } }
    return { status: data.status, body: data.body }
}
