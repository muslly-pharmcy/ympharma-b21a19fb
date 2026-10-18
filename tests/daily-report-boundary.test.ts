import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({results:new Map<string,any>(),calls:[] as Array<{table:string;method:string;args:unknown[]}>,rpc:vi.fn(),insert:vi.fn(),modules:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{rpc:fixture.rpc,from(table:string){
 const builder:any={};for(const method of ['select','gte','lt','limit','eq','in'])builder[method]=(...args:unknown[])=>{fixture.calls.push({table,method,args});return builder;};
 builder.insert=fixture.insert;builder.then=(resolve:any,reject:any)=>Promise.resolve(fixture.results.get(table)??{data:[],count:0,error:null}).then(resolve,reject);return builder;
}}}));
vi.mock('@/lib/ai/runtime/telemetry.server',()=>({planetaryStatus:fixture.modules}));
import {buildDailyReport,dispatchDailyReport,renderReportHtml,renderWhatsAppSummary,whatsappLink} from '../src/lib/reports/daily-dispatcher.server';
import {completeRows,exactCount,exactOrderTotal,reportRecipient} from '../src/lib/reports/report-source';
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
