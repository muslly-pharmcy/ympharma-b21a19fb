type SourceResult<T> = {data: T[] | null; count: number | null; error?: unknown};
/** Bounded pagination for UUID-keyed sources ordered by id ascending.
 * Count/identity drift fails closed; this is not a transactional snapshot.
 */
export async function readAllReportRows<T extends {id:string}>(
 fetchPage:(from:number,to:number)=>PromiseLike<SourceResult<T>>,
):Promise<SourceResult<T>> {
 const pageSize=500,maxRows=50000,maxPages=200;
 const rows:T[]=[];let expected:number|undefined,lastId='';
 for(let page=0;page<maxPages;page++){
  const result=await fetchPage(rows.length,rows.length+pageSize-1);
  const count=exactCount(result);
  if(count>maxRows)throw Error('REPORT_SOURCE_TOO_LARGE');
  if(expected!==undefined&&count!==expected)throw Error('REPORT_SOURCE_CHANGED');
  expected=count;
  if(!Array.isArray(result.data)||result.data.length>pageSize||rows.length+result.data.length>count)throw Error('REPORT_SOURCE_INCOMPLETE');
  if(!result.data.length&&rows.length<count)throw Error('REPORT_SOURCE_INCOMPLETE');
  for(const row of result.data){
   if(!row||typeof row.id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(row.id))throw Error('REPORT_INVALID_ROW_ID');
   const id=row.id.toLowerCase();
   if(id<=lastId)throw Error('REPORT_SOURCE_CHANGED');
   lastId=id;rows.push(row);
  }
  if(rows.length===count)return {data:rows,count,error:null};
 }
 throw Error('REPORT_SOURCE_PAGE_LIMIT');
}
/** Missing, denied or truncated source data must never become a zero metric. */
export function completeRows<T>(result: SourceResult<T>): T[] {
 if(result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count !== result.data.length) throw Error('REPORT_SOURCE_INCOMPLETE');
 return result.data;
}
export function exactCount(result: {count: number | null; error?: unknown}): number {
 if(result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw Error('REPORT_SOURCE_INCOMPLETE');
 return result.count;
}
/** Order face values only; never recognized accounting revenue or cash collected. */
export function exactOrderTotal(values: unknown[]): string {
 let total=0n;
 for(const value of values){
  if(typeof value!=='string'&&typeof value!=='number')throw Error('REPORT_INVALID_ORDER_AMOUNT');
  if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER/10000))throw Error('REPORT_INVALID_ORDER_AMOUNT');
  const match=/^(0|[1-9]\d*)(?:\.(\d{1,4}))?$/.exec(String(value));
  if(!match)throw Error('REPORT_INVALID_ORDER_AMOUNT');
  total+=BigInt(match[1])*10000n+BigInt((match[2]??'').padEnd(4,'0'));
 }
 return (total/10000n).toString()+'.'+(total%10000n).toString().padStart(4,'0');
}
export function reportRecipient(env:Record<string,string|undefined>):string {
 const recipient=env.EXEC_REPORT_EMAIL?.trim();
 if(env.EXEC_REPORT_DISPATCH_ENABLED!=='true'||!recipient||!(/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/).test(recipient))throw Error('REPORT_DISPATCH_NOT_CONFIGURED');
 return recipient;
}
export function configuredWhatsAppLink(summary:string,phone:string|undefined):string {
 if(!phone)return '';
 if(!/^[1-9]\d{7,14}$/.test(phone))throw Error('REPORT_WHATSAPP_NOT_CONFIGURED');
 return `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`;
}

/** pgmq.send returns a positive PostgreSQL bigint; missing data is not an acknowledgment. */
export function acknowledgedQueueId(value:unknown):boolean {
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0;
 return typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
}
