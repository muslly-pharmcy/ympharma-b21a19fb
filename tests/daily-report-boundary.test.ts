import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({results:new Map<string,any>(),calls:[] as Array<{table:string;method:string;args:unknown[]}>,rpc:vi.fn(),insert:vi.fn(),modules:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{rpc:fixture.rpc,from(table:string){
 const builder:any={};for(const method of ['select','gte','lt','limit','eq','in','order'])builder[method]=(...args:unknown[])=>{fixture.calls.push({table,method,args});return builder;};
 let range:[number,number]|null=null;builder.range=(start:number,end:number)=>{range=[start,end];fixture.calls.push({table,method:'range',args:[start,end]});return builder;};
 builder.insert=fixture.insert;builder.then=(resolve:any,reject:any)=>{
  const result=fixture.results.get(table)??{data:[],count:0,error:null};
  const data=Array.isArray(result.data)?result.data.map((r:any,i:number)=>({id:`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`,...r})):result.data;
  return Promise.resolve({...result,data:range&&Array.isArray(data)?data.slice(range[0],range[1]+1):data}).then(resolve,reject);
 };return builder;
}}}));
vi.mock('@/lib/ai/runtime/telemetry.server',()=>({planetaryStatus:fixture.modules}));
import {buildDailyReport,dispatchDailyReport,renderReportHtml,renderWhatsAppSummary,whatsappLink} from '../src/lib/reports/daily-dispatcher.server';
import {acknowledgedQueueId,completeRows,exactCount,exactOrderTotal,reportRecipient} from '../src/lib/reports/report-source';
beforeEach(()=>{fixture.results.clear();fixture.calls.length=0;vi.clearAllMocks();fixture.rpc.mockResolvedValue({data:1,error:null});fixture.insert.mockResolvedValue({error:null});fixture.modules.mockResolvedValue([{moduleKey:'inventory',status:'idle',lastSeen:null}]);vi.stubEnv('EXEC_REPORT_EMAIL','');vi.stubEnv('EXEC_REPORT_DISPATCH_ENABLED','');vi.stubEnv('EXEC_REPORT_WHATSAPP','');});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe('source-backed daily report',()=>{
 it.each([{data:null,count:null,error:{message:'private database detail'}},{data:[],count:8,error:null},{data:[],count:null,error:null}])('refuses unavailable or truncated rows',result=>expect(()=>completeRows(result)).toThrow('REPORT_SOURCE_INCOMPLETE'));
 it.each([null,-1,1.5])('refuses an unknown or invalid count %s',count=>expect(()=>exactCount({count})).toThrow('REPORT_SOURCE_INCOMPLETE'));
 it('sums exact order values without rounding to whole riyals',()=>expect(exactOrderTotal([0.1,0.2,'999.1234'])).toBe('999.4234'));
 it.each([null,-1,'1e4','NaN','0.00001',Number.MAX_SAFE_INTEGER])('rejects ambiguous or unsafe amount %s',value=>expect(()=>exactOrderTotal([value])).toThrow('REPORT_INVALID_ORDER_AMOUNT'));
 it('retains a fixed window, labels totals correctly and discloses unobserved modules',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));fixture.results.set('orders',{data:[{total:0.1},{total:0.2}],count:2,error:null});
  const report=await buildDailyReport();expect(report.sales.orderTotal).toBe('0.3000');expect(report.source.from).toBe('2026-10-17T12:00:00.000Z');expect(report.source.to).toBe('2026-10-18T12:00:00.000Z');expect(report.source.currency).toBe('unverified');expect(report.health.unobservedModules).toEqual(['inventory']);
  expect(fixture.calls).toContainEqual({table:'orders',method:'lt',args:['created_at','2026-10-18T12:00:00.000Z']});const html=renderReportHtml(report);expect(html).toContain('ليس إيرادًا محاسبيًا');expect(html).not.toContain('كل الوحدات سليمة');expect(renderWhatsAppSummary(report)).toContain('0.3000');expect(whatsappLink('private draft')).toBe('');expect(fixture.rpc).not.toHaveBeenCalled();
 });
 it('fails closed on a source error before any queue write',async()=>{
  vi.stubEnv('EXEC_REPORT_DISPATCH_ENABLED','true');vi.stubEnv('EXEC_REPORT_EMAIL','approved@example.invalid');fixture.results.set('orders',{data:null,count:null,error:{message:'private upstream error'}});
  await expect(dispatchDailyReport()).rejects.toThrow('REPORT_SOURCE_INCOMPLETE');expect(fixture.rpc).not.toHaveBeenCalled();expect(fixture.insert).not.toHaveBeenCalled();
 });
 it('requires explicit dispatch configuration before even collecting data',async()=>{await expect(dispatchDailyReport()).rejects.toThrow('REPORT_DISPATCH_NOT_CONFIGURED');expect(fixture.calls).toEqual([]);expect(fixture.rpc).not.toHaveBeenCalled();});
 it('does not accept multiple recipients or header injection',()=>{for(const email of ['a@example.invalid,b@example.invalid','a@example.invalid\r\nBcc:b@example.invalid'])expect(()=>reportRecipient({EXEC_REPORT_EMAIL:email,EXEC_REPORT_DISPATCH_ENABLED:'true'})).toThrow();});
 it('validates the optional WhatsApp destination without sending anything',()=>{expect(()=>whatsappLink('draft','12345678?redirect=evil')).toThrow('REPORT_WHATSAPP_NOT_CONFIGURED');expect(whatsappLink('draft & test','967700000000')).toBe('https://wa.me/967700000000?text=draft%20%26%20test');});
 it('validates every destination before enqueue to avoid a post-send configuration failure',async()=>{vi.stubEnv('EXEC_REPORT_DISPATCH_ENABLED','true');vi.stubEnv('EXEC_REPORT_EMAIL','approved@example.invalid');vi.stubEnv('EXEC_REPORT_WHATSAPP','invalid');await expect(dispatchDailyReport()).rejects.toThrow('REPORT_WHATSAPP_NOT_CONFIGURED');expect(fixture.rpc).not.toHaveBeenCalled();});
 it('queues only the explicitly configured recipient when all mocked sources are complete',async()=>{vi.stubEnv('EXEC_REPORT_DISPATCH_ENABLED','true');vi.stubEnv('EXEC_REPORT_EMAIL','approved@example.invalid');const result=await dispatchDailyReport();expect(result.emailQueued).toBe(true);expect(fixture.rpc).toHaveBeenCalledTimes(1);expect(fixture.rpc.mock.calls[0][1].payload.to).toBe('approved@example.invalid');expect(result.whatsappUrl).toBe('');});
 it('telemetry refuses query failure instead of silently returning idle or healthy',async()=>{
  const actual=await vi.importActual<typeof import('../src/lib/ai/runtime/telemetry.server')>('../src/lib/ai/runtime/telemetry.server');fixture.results.set('kernel_module_telemetry',{data:null,count:null,error:{message:'denied'}});await expect(actual.planetaryStatus()).rejects.toThrow('REPORT_SOURCE_INCOMPLETE');
 });
});

describe('telemetry window and numeric integrity',()=>{
 const end=new Date('2026-10-18T12:00:00Z');
 const sample={module_key:'inventory',runs:10,failures:2,latency_ms:50,budget_used:'0.1250',observed_at:'2026-10-18T11:00:00Z'};
 async function read(rows:any[]){
  fixture.results.set('kernel_module_telemetry',{data:rows,count:rows.length,error:null});
  const actual=await vi.importActual<typeof import('../src/lib/ai/runtime/telemetry.server')>('../src/lib/ai/runtime/telemetry.server');return actual.planetaryStatus(24,end);
 }
 it('uses the report end for every source including telemetry',async()=>{vi.useFakeTimers();vi.setSystemTime(end);await buildDailyReport();expect(fixture.modules).toHaveBeenCalledWith(24,end);});
 it('aggregates valid observed data and excludes the end boundary in the query',async()=>{
  const rows=await read([sample,{...sample,runs:0,failures:0,latency_ms:null,budget_used:0,observed_at:'2026-10-18T14:30:00+03:00'}]);
  expect(rows.find(r=>r.moduleKey==='inventory')).toMatchObject({runs:10,failures:2,errorRate:0.2,avgLatencyMs:50,budgetUsed:0.125,status:'degraded',lastSeen:'2026-10-18T11:30:00.000Z'});
  expect(fixture.calls).toContainEqual({table:'kernel_module_telemetry',method:'lt',args:['observed_at',end.toISOString()]});
 });
 it.each([0,-1,169,NaN,Infinity])('rejects an invalid window %s before reading',async(hours)=>{const actual=await vi.importActual<typeof import('../src/lib/ai/runtime/telemetry.server')>('../src/lib/ai/runtime/telemetry.server');await expect(actual.planetaryStatus(hours,end)).rejects.toThrow('TELEMETRY_INVALID_WINDOW');expect(fixture.calls).toEqual([]);});
 it.each([{runs:null},{runs:-1},{runs:1.5},{runs:'10'},{failures:11},{failures:-1},{failures:null},{latency_ms:-1},{latency_ms:Infinity},{latency_ms:'20'},{budget_used:null},{budget_used:'NaN'},{budget_used:-1},{budget_used:'1e4'},{budget_used:Infinity},{observed_at:'bad'},{observed_at:'2026-10-17T11:59:59Z'},{observed_at:'2026-10-18T12:00:00Z'},{module_key:''}])('rejects malformed evidence %j',async patch=>{await expect(read([{...sample,...patch}])).rejects.toThrow('TELEMETRY_INVALID_SAMPLE');});
 it('rejects overflowing aggregate counts',async()=>{await expect(read([{...sample,runs:Number.MAX_SAFE_INTEGER},sample])).rejects.toThrow('TELEMETRY_AGGREGATE_OVERFLOW');});
});

describe('queue acknowledgment',()=>{
 it.each([1,'1','9223372036854775807'])('accepts a confirmed queue id %s',value=>expect(acknowledgedQueueId(value)).toBe(true));
 it.each([null,undefined,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'0','01','1e3','9223372036854775808',{},[]])('does not infer enqueue success from %j',value=>expect(acknowledgedQueueId(value)).toBe(false));
 it('does not claim an email is queued without a queue id',async()=>{vi.stubEnv('EXEC_REPORT_DISPATCH_ENABLED','true');vi.stubEnv('EXEC_REPORT_EMAIL','approved@example.invalid');fixture.rpc.mockResolvedValue({data:null,error:null});const warn=vi.spyOn(console,'error').mockImplementation(()=>{});try{const result=await dispatchDailyReport();expect(result.emailQueued).toBe(false);expect(fixture.rpc).toHaveBeenCalledTimes(1);}finally{warn.mockRestore();}});
});

describe('visitor report time semantics',()=>{
 const end=new Date('2026-10-18T12:00:00Z');
 const row={pages_viewed:['/old-page'],first_visit:true,created_at:'2026-10-16T12:00:00Z',last_seen_at:'2026-10-18T11:00:00Z'};
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(end);});
 it('does not call an old visitor new or count time before the report window',async()=>{fixture.results.set('visitor_sessions',{data:[row],count:1,error:null});const r=await buildDailyReport();expect(r.visitors.newVisitors).toBe(0);expect(r.visitors.avgDwellMinutes).toBe(1380);expect(r.source.pagesBasis).toBe('lifetime_pages_of_selected_records');expect(renderReportHtml(r)).toContain('ليست زمن التفاعل الفعلي');});
 it('counts a first-seen visitor created inside the window',async()=>{fixture.results.set('visitor_sessions',{data:[{...row,created_at:'2026-10-18T10:00:00Z'}],count:1,error:null});expect((await buildDailyReport()).visitors.newVisitors).toBe(1);});
 it.each([{created_at:null},{pages_viewed:null},{pages_viewed:[null]},{first_visit:null},{created_at:'2026-10-18T11:30:00Z'},{last_seen_at:'2026-10-18T12:00:00Z'}])('rejects contradictory or missing visitor evidence %j',async patch=>{fixture.results.set('visitor_sessions',{data:[{...row,...patch}],count:1,error:null});await expect(buildDailyReport()).rejects.toThrow(/REPORT_INVALID/);});
});

describe('large report sources',()=>{
 it('reads every order and post instead of silently capping the report',async()=>{
  fixture.results.set('orders',{data:Array.from({length:1001},()=>({total:'0.1000'})),count:1001,error:null});
  fixture.results.set('social_posts',{data:Array.from({length:501},()=>({status:'published'})),count:501,error:null});
  const report=await buildDailyReport();expect(report.sales.orders).toBe(1001);expect(report.sales.orderTotal).toBe('100.1000');expect(report.content.published).toBe(501);
  expect(fixture.calls.filter(c=>c.table==='orders'&&c.method==='range').map(c=>c.args)).toEqual([[0,499],[500,999],[1000,1499]]);
  for(const table of ['orders','visitor_sessions','social_posts'])expect(fixture.calls).toContainEqual({table,method:'order',args:['id',{ascending:true}]});
 });
});

it('aggregates telemetry across pages with the same fixed time window',async()=>{
 const observed_at='2026-10-21T10:00:00Z';fixture.results.set('kernel_module_telemetry',{data:Array.from({length:501},()=>({module_key:'inventory',runs:1,failures:0,latency_ms:10,budget_used:0,observed_at})),count:501,error:null});
 const actual=await vi.importActual<typeof import('../src/lib/ai/runtime/telemetry.server')>('../src/lib/ai/runtime/telemetry.server');const statuses=await actual.planetaryStatus(24,new Date('2026-10-21T12:00:00Z'));expect(statuses.find(m=>m.moduleKey==='inventory')?.runs).toBe(501);
 expect(fixture.calls.filter(c=>c.table==='kernel_module_telemetry'&&c.method==='range').map(c=>c.args)).toEqual([[0,499],[500,999]]);
});
