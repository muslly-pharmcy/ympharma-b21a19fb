import {describe,it,expect,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {readAllReportRows} from '../src/lib/reports/report-source';
const row=(n:number)=>({id:`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,total:'1.0000'});
describe('bounded report pagination',()=>{
 it('accepts an explicitly counted empty source',async()=>expect(await readAllReportRows(async()=>({data:[],count:0}))).toEqual({data:[],count:0,error:null}));
 it('continues from actual returned length when a server caps rows below 500',async()=>{
  const data=Array.from({length:7},(_,i)=>row(i+1));const fetch=vi.fn(async(start:number)=>({data:data.slice(start,start+2),count:7}));
  expect((await readAllReportRows(fetch)).data).toEqual(data);expect(fetch.mock.calls.map(x=>x[0])).toEqual([0,2,4,6]);
 });
 it.each([{data:null,count:0},{data:[],count:null},{data:[],count:-1},{data:[],count:1.5},{data:[],count:1},{data:[row(1)],count:0},{data:[],count:0,error:{message:'denied'}}])('rejects incomplete evidence %j',async result=>{await expect(readAllReportRows(async()=>result)).rejects.toThrow('REPORT_SOURCE_INCOMPLETE');});
 it('rejects a count change between pages',async()=>{let n=0;await expect(readAllReportRows(async()=>++n===1?{data:[row(1)],count:2}:{data:[row(2)],count:3})).rejects.toThrow('REPORT_SOURCE_CHANGED');});
 it('rejects a repeated page even when its count stays unchanged',async()=>{await expect(readAllReportRows(async()=>({data:[row(1)],count:2}))).rejects.toThrow('REPORT_SOURCE_CHANGED');});
 it('rejects out-of-order identities',async()=>{await expect(readAllReportRows(async()=>({data:[row(2),row(1)],count:2}))).rejects.toThrow('REPORT_SOURCE_CHANGED');});
 it.each([null,'',123,'not-a-uuid'])('rejects an invalid identity %j',async id=>{await expect(readAllReportRows(async()=>({data:[{id} as any],count:1}))).rejects.toThrow('REPORT_INVALID_ROW_ID');});
 it('propagates a later transport failure without returning partial data',async()=>{const fetch=vi.fn().mockResolvedValueOnce({data:[row(1)],count:2}).mockRejectedValueOnce(Error('transport unavailable'));await expect(readAllReportRows(fetch)).rejects.toThrow('transport unavailable');});
 it('rejects oversized sources before accumulating data',async()=>{await expect(readAllReportRows(async()=>({data:[],count:50001}))).rejects.toThrow('REPORT_SOURCE_TOO_LARGE');});
 it('rejects an oversized individual response',async()=>{await expect(readAllReportRows(async()=>({data:Array.from({length:501},(_,i)=>row(i+1)),count:501}))).rejects.toThrow('REPORT_SOURCE_INCOMPLETE');});
 it('bounds requests when the server returns too few rows per page',async()=>{const fetch=vi.fn(async(start:number)=>({data:[row(start+1)],count:1000}));await expect(readAllReportRows(fetch)).rejects.toThrow('REPORT_SOURCE_PAGE_LIMIT');expect(fetch).toHaveBeenCalledTimes(200);});
 it('uses actual installed Supabase range/count protocol without network access',async()=>{
  const requested:string[]=[];const all=[row(1),row(2),row(3)];
  const db=createClient('http://127.0.0.1:1','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
   const url=new URL(String(input));requested.push(url.searchParams.get('offset')??'0');
   expect(url.searchParams.get('order')).toBe('id.asc');expect(url.searchParams.get('limit')).toBe('500');expect(new Headers(init?.headers).get('prefer')).toContain('count=exact');
   const start=Number(url.searchParams.get('offset')??0),data=all.slice(start,start+2);
   return new Response(JSON.stringify(data),{status:206,headers:{'content-type':'application/json','content-range':`${start}-${start+data.length-1}/3`}});
  }}});
  const result=await readAllReportRows((start,end)=>db.from('orders').select('id,total',{count:'exact'}).order('id',{ascending:true}).range(start,end));
  expect(result.data).toEqual(all);expect(requested).toEqual(['0','2']);
 });
});
