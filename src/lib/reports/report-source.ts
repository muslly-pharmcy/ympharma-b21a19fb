type SourceResult<T> = {data: T[] | null; count: number | null; error?: unknown};
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
