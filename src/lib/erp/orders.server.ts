export async function pendingBridgeOrders(target:string,db:any,source:string){
 const cursor=new URL(target,'http://127.0.0.1').searchParams.get('cursor')??'0';
 if(!/^(0|[1-9][0-9]{0,17})$/.test(cursor))return{status:400,body:{error:'invalid_cursor'}};
 const {data,error}=await db.rpc('erp_bridge_pending',{p_source:source,p_after:cursor});return error||!Array.isArray(data)?{status:503,body:{error:'pending_unavailable'}}:{status:200,body:{events:data}};
}
export async function acknowledgeBridgeOrder(body:any,db:any,source:string){
 if(!body||Object.keys(body).some(k=>!['sourceSystem','event_id','result'].includes(k))||typeof body.event_id!=='string'||!body.result)return{status:400,body:{error:'invalid_ack'}};
 const {data,error}=await db.rpc('erp_bridge_ack',{p_source:source,p_event:body.event_id,p_result:body.result});return error?{status:409,body:{error:'ack_conflict'}}:{status:200,body:data};
}
