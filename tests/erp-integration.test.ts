import { describe, expect, it } from 'vitest'
import fixtures from './fixtures/erp-v2.json'
import { sha256Hex, signRequest, toBaseUnits, verifyRequest, canonicalTarget } from '../src/lib/erp/signature'
import { erpHandle, ERP_ORDER_FLOW_ENABLED } from '../src/lib/erp/handler.server'
import { encodeCursor, decodeCursor, orderAfter } from '../src/lib/erp/cursor'
import { ReservationProjection } from '../src/lib/erp/reservation-projection'
const encode = (s:string) => new TextEncoder().encode(s)
const f=fixtures[0], now=Number(f.ts)
describe('ERP protocol2',()=>{
 for(const vector of fixtures)it('shared vector '+vector.name,()=>{expect(sha256Hex(encode(vector.body))).toBe(vector.bodyHash);expect(signRequest(vector.secret,vector.ts,vector.method,vector.target,encode(vector.body),vector.identity)).toBe(vector.signature);expect(verifyRequest(vector.secret,{ts:vector.ts,sig:vector.signature},vector.method,vector.target,encode(vector.body),vector.identity,now)).toEqual({ok:true})})
 it('binds query, method, raw bytes, source, key identity and request key',()=>{const g=fixtures[1];expect(verifyRequest(g.secret,{ts:g.ts,sig:g.signature},g.method,g.target.replace('limit=10','limit=11'),encode(g.body),g.identity,now).ok).toBe(false);for(const identity of[{...f.identity,source:'OTHER'},{...f.identity,keyId:'other'},{...f.identity,idempotencyKey:'other-request'}])expect(verifyRequest(f.secret,{ts:f.ts,sig:f.signature},f.method,f.target,encode(f.body),identity,now).ok).toBe(false);expect(verifyRequest(f.secret,{ts:f.ts,sig:f.signature},f.method,f.target,encode(f.body+' '),f.identity,now).ok).toBe(false)})
 it('rejects stale, fractional and millisecond timestamps; accepts boundary',()=>{expect(verifyRequest(f.secret,{ts:f.ts,sig:f.signature},f.method,f.target,encode(f.body),f.identity,now+301).ok).toBe(false);expect(verifyRequest(f.secret,{ts:f.ts,sig:f.signature},f.method,f.target,encode(f.body),f.identity,now+300).ok).toBe(true);for(const ts of['1800000000.1','1800000000000'])expect(verifyRequest(f.secret,{ts,sig:f.signature},f.method,f.target,encode(f.body),f.identity,now).ok).toBe(false)})
 it('rejects ambiguous query encodings and unsigned target variants',()=>{for(const q of['?limit=10&cursor=a','?cursor=a&cursor=b','?cursor=a+b','?cursor=%61','?after=x','?'])expect(()=>canonicalTarget('/api/public/erp/v1/reconcile'+q)).toThrow();expect(()=>canonicalTarget('/api/public/erp/v1/stock/')).toThrow()})
 it('converts exact decimal pack quantities only through verified explicit mapping',()=>{const map={unit_code:'BOX',units_per_pack:'12',verified:true};expect(toBaseUnits('0.5','BOX',map)).toBe('6');expect(()=>toBaseUnits('1','UNIT',map)).toThrow();expect(()=>toBaseUnits('0.1','BOX',map)).toThrow('fractional_base_unit');expect(()=>toBaseUnits('1','BOX',{...map,verified:false})).toThrow()})
 it('uses stable cursor tuple and keeps same-timestamp later orders',()=>{const a={at:'2026-10-08T00:00:00.000Z',id:'00000000-0000-4000-8000-000000000001'},b={...a,id:'00000000-0000-4000-8000-000000000002'};expect(orderAfter(b,a)).toBe(true);expect(orderAfter(a,a)).toBe(false);expect(decodeCursor(encodeCursor(a),'orders')).toEqual(a);expect(()=>decodeCursor(encodeCursor({item:'a',branch:'b'}),'orders')).toThrow()})
})
const env={ERP_SYNC_ENABLED:'true',ERP_SYNC_CONTRACT_VERSION:'2',ERP_SYNC_HMAC_SECRET:f.secret,ERP_SYNC_SOURCE_ID:f.identity.source,ERP_SYNC_KEY_ID:f.identity.keyId}
function request(path=f.target,body=f.body,method='POST',override:Record<string,string>={}) {const identity={...f.identity,idempotencyKey:method==='GET'?'':f.identity.idempotencyKey},bytes=encode(body);return new Request('https://example.invalid'+path,{method,headers:{'content-type':'application/json','x-erp-protocol':'2','x-erp-key-id':identity.keyId,'x-erp-source':identity.source,'idempotency-key':identity.idempotencyKey,'x-erp-timestamp':f.ts,'x-erp-signature':signRequest(f.secret,f.ts,method,path,bytes,identity),...override},...(method==='POST'?{body:bytes}:{})})}
describe('server fail-closed boundaries',()=>{
 it('keeps reservation projections closed on the stock endpoint while allowing ordinary stock',async()=>{
  const body=JSON.stringify({sourceSystem:f.identity.source,projection:{}})
  for(const localOrders of [false,true]) {
   let called=false
   const r=await erpHandle(request(f.target,body),f.target,async()=>{called=true;return{status:200,body:{}}},{env,db:{},nowSec:now,localOrders})
   expect(r.status).toBe(503);expect(called).toBe(false);expect(await r.json()).toEqual({error:'erp_order_flow_not_implemented'})
  }
  let called=false
  expect((await erpHandle(request(),f.target,async()=>{called=true;return{status:200,body:{}}},{env,db:{},nowSec:now})).status).toBe(200)
  expect(called).toBe(true)
 })
 it('permits a reservation projection only through the explicit loopback test dependency',async()=>{
  const body=JSON.stringify({sourceSystem:f.identity.source,projection:{}}),original=request(f.target,body)
  const local=new Request('http://127.0.0.1'+f.target,{method:'POST',headers:original.headers,body})
  let called=false
  const r=await erpHandle(local,f.target,async()=>{called=true;return{status:200,body:{}}},{env,db:{},nowSec:now,localOrders:true})
  expect(r.status).toBe(200);expect(called).toBe(true)
 })
 it('disabled by default without touching DB',async()=>{expect((await erpHandle(request(),f.target,async()=>{throw Error('must not run')},{env:{},db:null})).status).toBe(503)})
 it('accepts authenticated exact bytes and source only',async()=>{let called=false;const r=await erpHandle(request(),f.target,async(body,_db,ctx)=>{called=true;expect((body as any).sourceSystem).toBe(ctx.source);expect(ctx.contentHash).toBe(f.bodyHash);return{status:200,body:{ok:true}}},{env,db:{},nowSec:now});expect(r.status).toBe(200);expect(called).toBe(true);expect((await erpHandle(request(f.target,f.body,'POST',{'x-erp-source':'OTHER'}),f.target,async()=>{throw Error()},{env,db:{},nowSec:now})).status).toBe(401)})
 it('does not return cache or run callback for stale signature',async()=>{expect((await erpHandle(request(),f.target,async()=>{throw Error()},{env,db:{},nowSec:now+301})).status).toBe(401)})
 it('keeps pending and ack closed even with valid signature and feature env',async()=>{expect(ERP_ORDER_FLOW_ENABLED).toBe(false);for(const [path,method,body]of[['/api/public/erp/v1/orders/pending','GET',''],['/api/public/erp/v1/orders/ack','POST','{"sourceSystem":"ERP_TEST"}']]){const r=await erpHandle(request(path,body,method),path,async()=>{throw Error('must not run')},{env,db:null,nowSec:now});expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'erp_order_flow_not_implemented'})}})
 it('bounds raw byte size and rejects invalid UTF8 before JSON parsing',async()=>{const large='a'.repeat(1000001);expect((await erpHandle(request(f.target,large),f.target,async()=>{throw Error()},{env,db:{},nowSec:now})).status).toBe(413);const bytes=new Uint8Array([255]),r=request();r.headers.set('x-erp-signature',signRequest(f.secret,f.ts,'POST',f.target,bytes,f.identity));const invalid=new Request(r.url,{method:'POST',headers:r.headers,body:bytes});expect((await erpHandle(invalid,f.target,async()=>{throw Error()},{env,db:{},nowSec:now})).status).toBe(400)})
 it('turns unconfirmed processing into retryable503 without clearing request state',async()=>{expect((await erpHandle(request(),f.target,async()=>{throw Error('internal')},{env,db:{},nowSec:now})).status).toBe(503)})
})
describe('reservation projection reference ONLY; no live checkout',()=>{
 it('serializes last-unit attempts and does not resurrect sold quantity with old snapshot',async()=>{const p=new ReservationProjection();p.snapshot(1n,1n,0n,[]);const results=await Promise.all(['A','B'].map(id=>Promise.resolve().then(()=>p.reserve(id,1n))));expect(results).toEqual([true,false]);p.snapshot(2n,0n,1n,[{id:'A',qty:1n,sequence:1n}]);p.acknowledge('A',1n);expect(p.available()).toBe(0n);expect(()=>p.snapshot(1n,1n,0n,[])).toThrow();expect(p.available()).toBe(0n)})
 it.each(['ack-first','snapshot-first'])('avoids double subtraction with %s',order=>{const p=new ReservationProjection();p.snapshot(1n,10n,0n,[]);p.reserve('A',3n);expect(p.available()).toBe(7n);if(order==='ack-first')p.acknowledge('A',1n);p.snapshot(2n,7n,1n,[{id:'A',qty:3n,sequence:1n}]);if(order==='snapshot-first')p.acknowledge('A',1n);expect(p.available()).toBe(7n);p.acknowledge('A',1n);expect(p.available()).toBe(7n)})
 it('missing coverage fails closed and release lifecycle is explicitly unsupported',()=>{const p=new ReservationProjection();p.snapshot(1n,1n,0n,[]);p.reserve('A',1n);p.acknowledge('A',1n);expect(()=>p.snapshot(2n,1n,1n,[])).toThrow();expect(p.available()).toBe(0n);expect(()=>p.release()).toThrow('not_implemented')})
})
