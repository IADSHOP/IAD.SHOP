import '../order-core.js';
import {PRODUCTS,CATALOG_VERSION} from './catalog.mjs';
import {orderNumber,newOrderEmails,reportEmail,sendEmail} from './email.mjs';
const core=globalThis.OrderCore;
const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const validToken=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(v);
export class Orders {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
 this.sql.exec('CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)');
 this.sql.exec('INSERT OR IGNORE INTO counter VALUES (1,87)');
 this.sql.exec('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, request_hash TEXT NOT NULL, token_hash TEXT NOT NULL, data TEXT NOT NULL)');
 this.sql.exec('CREATE TABLE IF NOT EXISTS reports (request_id TEXT PRIMARY KEY, order_id TEXT NOT NULL, signature TEXT NOT NULL, data TEXT NOT NULL)');
 this.sql.exec('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, data TEXT NOT NULL, state TEXT NOT NULL DEFAULT \'PENDING\', attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)');
 this.sql.exec('CREATE TABLE IF NOT EXISTS rate (ip TEXT NOT NULL, time INTEGER NOT NULL)');
 this.sql.exec('CREATE INDEX IF NOT EXISTS rate_ip ON rate(ip)');
 }
 rows(query,...args){return this.sql.exec(query,...args).toArray();}
 enqueue(id,message){this.sql.exec('INSERT OR IGNORE INTO outbox (id,data,created_at) VALUES (?,?,?)',id,JSON.stringify(message),Date.now());}
 public(o){const {contact,delivery,buyerNote,...safe}=o;return safe;}
 async perform(action,p,ip='test'){
  if(action==='createOrder'){
   if(!validId(p.requestId)||!validToken(p.accessToken))fail('INVALID_REQUEST','送單識別格式錯誤');
   if(p.catalogVersion!==CATALOG_VERSION)fail('CATALOG_CHANGED','商品資料已更新，請重新整理');
   const validated=core.validateOrder(p,PRODUCTS),signature=await hash(JSON.stringify(validated)),tokenHash=await hash(p.accessToken);
   const result=this.ctx.storage.transactionSync(()=>{
    const old=this.rows('SELECT * FROM orders WHERE request_id=?',p.requestId)[0];
    if(old){if(old.request_hash!==signature||old.token_hash!==tokenHash)fail('IDEMPOTENCY_CONFLICT','原訂單識別或內容不一致');return JSON.parse(old.data);}
    this.sql.exec('DELETE FROM rate WHERE time<?',Date.now()-3600000);
    if(this.rows('SELECT count(*) AS n FROM rate WHERE ip=?',ip)[0].n>=10)fail('RATE_LIMIT','送單過於頻繁，請稍後再試');
    this.sql.exec('INSERT INTO rate VALUES (?,?)',ip,Date.now());
    this.sql.exec('UPDATE counter SET value=value+1 WHERE id=1');
    const seq=this.rows('SELECT value FROM counter WHERE id=1')[0].value,now=new Date();
    const order={...validated,orderId:orderNumber(seq,now),createdAt:now.toISOString(),paymentStatus:'PENDING',orderStatus:'NEW'};
    this.sql.exec('INSERT INTO orders VALUES (?,?,?,?,?)',order.orderId,p.requestId,signature,tokenHash,JSON.stringify(order));
    newOrderEmails(order,p.accessToken,this.env).filter((m,i)=>i===0||this.env.BUYER_EMAIL_ENABLED==='true').forEach((m,i)=>this.enqueue(`${order.orderId}-new-${i}`,m));return order;
   });
   await this.ctx.storage.setAlarm(Date.now()+1000);return this.public(result);
  }
  if(!validToken(p.accessToken)||typeof p.orderId!=='string')fail('INVALID_ACCESS','訂單驗證失敗');
  const row=this.rows('SELECT * FROM orders WHERE id=?',p.orderId)[0];
  if(!row||row.token_hash!==await hash(p.accessToken))fail('INVALID_ACCESS','訂單驗證失敗');
  if(action==='getOrder')return this.public(JSON.parse(row.data));
  if(action!=='reportPayment')fail('INVALID_REQUEST','無效操作');
  if(!validId(p.reportRequestId))fail('INVALID_REQUEST','付款回報識別格式錯誤');
  const order=JSON.parse(row.data),report=core.paymentReport(p,order.paymentMethod);
  if(!report.paidAt)fail('INVALID_TIME','請填付款時間');
  if(p.amount!==order.total)fail('INVALID_TOTAL','付款回報金額需等於訂單總額');
  if(order.paymentMethod==='CASH_DEPOSIT'&&!report.note)fail('INVALID_REFERENCE','請填 ATM／分行與交易序號等無卡存款資訊');
  const signature=await hash(JSON.stringify({...report,amount:p.amount,orderId:p.orderId}));
  const result=this.ctx.storage.transactionSync(()=>{
   const latest=JSON.parse(this.rows('SELECT data FROM orders WHERE id=?',p.orderId)[0].data);
   const prior=this.rows('SELECT * FROM reports WHERE request_id=?',p.reportRequestId)[0];
   if(prior){if(prior.signature!==signature)fail('IDEMPOTENCY_CONFLICT','原付款回報內容不一致');return latest;}
   if(latest.orderStatus==='CANCELLED'||['PAID','FAILED','REFUNDED'].includes(latest.paymentStatus))fail('ORDER_CLOSED','此訂單不接受付款回報');
   if(latest.paymentStatus==='PAYMENT_REPORTED')return latest;
   const r={...report,amount:p.amount,createdAt:new Date().toISOString()};
   this.sql.exec('INSERT INTO reports VALUES (?,?,?,?)',p.reportRequestId,p.orderId,signature,JSON.stringify(r));
   latest.paymentStatus='PAYMENT_REPORTED';this.sql.exec('UPDATE orders SET data=? WHERE id=?',JSON.stringify(latest),p.orderId);
   this.enqueue(`${p.orderId}-report`,reportEmail(latest,r,this.env));return latest;
  });await this.ctx.storage.setAlarm(Date.now()+1000);return this.public(result);
 }
 async alarm(){
  const pending=this.rows("SELECT * FROM outbox WHERE state='PENDING'");
  for(const row of pending){
   if(row.attempts>=8||Date.now()-row.created_at>23*3600000){this.sql.exec("UPDATE outbox SET state='FAILED' WHERE id=?",row.id);console.error('Email needs manual attention',row.id);continue;}
   this.sql.exec('UPDATE outbox SET attempts=attempts+1 WHERE id=?',row.id);
   try{await sendEmail(JSON.parse(row.data),row.id,this.env);this.sql.exec("UPDATE outbox SET state='SENT' WHERE id=?",row.id);}catch{console.error('Email delivery retry',row.id);}
  }
  if(this.rows("SELECT id FROM outbox WHERE state='PENDING'").length)await this.ctx.storage.setAlarm(Date.now()+600000);
 }
 async fetch(req){try{const p=await req.json();
  if(p.action==='adminStatus'){
   const o=this.rows('SELECT data FROM orders WHERE id=?',p.orderId)[0];if(!o)fail('UNKNOWN_ORDER','找不到訂單');const order=JSON.parse(o.data);
   if(p.paymentStatus&&!['PENDING','PAYMENT_REPORTED','PAID','FAILED','REFUNDED'].includes(p.paymentStatus))fail('INVALID_STATUS','無效付款狀態');
   if(p.orderStatus&&!['NEW','PREPARING','SHIPPED','COMPLETED','CANCELLED'].includes(p.orderStatus))fail('INVALID_STATUS','無效訂單狀態');
   if(p.paymentStatus)order.paymentStatus=p.paymentStatus;if(p.orderStatus)order.orderStatus=p.orderStatus;
   this.sql.exec('UPDATE orders SET data=? WHERE id=?',JSON.stringify(order),p.orderId);return Response.json({ok:true,order:this.public(order)});
  }
  if(p.action==='adminEmails')return Response.json({ok:true,emails:this.rows('SELECT id,state,attempts FROM outbox ORDER BY created_at DESC LIMIT 100')});
  return Response.json({ok:true,order:await this.perform(p.action,p,p.ip)});
 }catch(e){return Response.json({ok:false,code:e.code||'SERVER_ERROR',message:e.code?e.message:'訂單服務暫時無法使用，請重試原訂單。'},{status:e.code?400:503});}}
}
export default {async fetch(req,env){
 const url=new URL(req.url),origin=req.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim());
 const headers={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
 if(req.method==='OPTIONS')return new Response(null,{status:allowed.includes(origin)?204:403,headers});
 if(req.method!=='POST')return new Response('IAD SHOP ORDERS',{headers:{'Cache-Control':'no-store'}});
 const admin=url.pathname==='/admin';
 if(admin){const auth=req.headers.get('Authorization');if(!env.ADMIN_TOKEN||auth!==`Bearer ${env.ADMIN_TOKEN}`)return new Response('Unauthorized',{status:401});}
 else if(url.pathname!=='/orders'||!allowed.includes(origin))return new Response('Forbidden',{status:403,headers});
 if(!(env.MAIL_RELAY_URL&&env.MAIL_RELAY_SECRET)&&!(env.RESEND_API_KEY&&env.EMAIL_FROM))return Response.json({ok:false,code:'NOT_CONFIGURED',message:'尚未開放線上收單'},{status:503,headers});
 if(Number(req.headers.get('Content-Length'))>65536)return new Response('Too large',{status:413,headers});
 let p;try{const raw=await req.text();if(raw.length>65536)return new Response('Too large',{status:413,headers});p=JSON.parse(raw);}catch{return Response.json({ok:false,code:'INVALID_REQUEST',message:'格式錯誤'},{status:400,headers});}
 if(!['createOrder','getOrder','reportPayment',...(admin?['adminStatus','adminEmails']:[])].includes(p?.action))return new Response('Invalid action',{status:400,headers});
 p.ip=await hash(req.headers.get('CF-Connecting-IP')||'unknown');
 const stub=env.ORDERS.get(env.ORDERS.idFromName('iad-orders-production'));
 const res=await stub.fetch(new Request('https://internal/',{method:'POST',body:JSON.stringify(p)}));return new Response(res.body,{status:res.status,headers:{...headers,'Content-Type':'application/json'}});
}};
