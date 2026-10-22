import {describe,it,expect,vi} from 'vitest'
import {canonicalTarget,signRequest,verifyRequest} from '../src/lib/erp/signature'
import {erpHandle,ERP_CATALOG_FLOW_ENABLED} from '../src/lib/erp/handler.server'
import {applyCatalogRequest,readCatalogPreview} from '../src/lib/erp/catalog.server'
const identity={keyId:'fixture-key',source:'ERP_TEST',idempotencyKey:'catalog-command-1'},secret='public-fixture-not-a-deployment-key'
describe('catalog protocol boundary',()=>{
 it.each(['apply','preview'])('binds %s to its exact route and keeps live execution closed',async(action)=>{
  const target='/api/public/erp/v1/catalog/'+action,ts=String(Math.floor(Date.now()/1000)),body=JSON.stringify({sourceSystem:identity.source}),bytes=new TextEncoder().encode(body)
  expect(canonicalTarget(target)).toBe(target);expect(()=>canonicalTarget(target+'?limit=1')).toThrow()
  const signature=signRequest(secret,ts,'POST',target,bytes,identity)
  expect(verifyRequest(secret,{ts,sig:signature},'POST',target.replace(action,action==='apply'?'preview':'apply'),bytes,identity).ok).toBe(false)
  const request=new Request('https://example.invalid'+target,{method:'POST',body,headers:{'content-type':'application/json','x-erp-protocol':'2','x-erp-key-id':identity.keyId,'x-erp-source':identity.source,'idempotency-key':identity.idempotencyKey,'x-erp-timestamp':ts,'x-erp-signature':signature}})
  const run=vi.fn();expect(ERP_CATALOG_FLOW_ENABLED).toBe(false)
  const result=await erpHandle(request,target,run,{env:{ERP_SYNC_ENABLED:'true',ERP_SYNC_CONTRACT_VERSION:'2',ERP_SYNC_HMAC_SECRET:secret,ERP_SYNC_SOURCE_ID:identity.source,ERP_SYNC_KEY_ID:identity.keyId},db:{}})
  expect(result.status).toBe(503);expect(run).not.toHaveBeenCalled()
 })
 it('rejects command/source mismatch before database access',async()=>{
  const db={rpc:vi.fn()},context={...identity,contentHash:'hash',target:'/api/public/erp/v1/catalog/apply'}
  expect((await applyCatalogRequest({sourceSystem:'OTHER',command_id:identity.idempotencyKey},db,context)).status).toBe(400)
  expect((await applyCatalogRequest({sourceSystem:identity.source,command_id:'another'},db,context)).status).toBe(400)
  expect((await readCatalogPreview({sourceSystem:identity.source,product:'A',organization:'spoof'},db,context)).status).toBe(400)
  expect(db.rpc).not.toHaveBeenCalled()
 })
})
