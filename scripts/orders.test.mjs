import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../order-core.js');
const products=[{id:'TEE',season:'summer',name:'TEE',price:280,salePrice:249,colors:['白色','黑色'],sizes:['S','M'],images:['./tee.jpg']}];
function payload(overrides={}){return {action:'createOrder',origin:'http://127.0.0.1:4173',correlationId:crypto.randomUUID(),requestId:crypto.randomUUID(),accessToken:crypto.randomBytes(32).toString('hex'),catalogVersion:'test-version',items:[{productId:'TEE',season:'summer',color:'白色',size:'M',quantity:1}],contact:{name:'測試買家',phone:'0912345678',email:'buyer@example.com'},delivery:{method:'STORE',receiverName:'測試收件人',receiverPhone:'0912345678',storeType:'SEVEN_ELEVEN',storeName:'測試門市',storeCode:'123456'},paymentMethod:'BANK_TRANSFER',buyerNote:'',expectedTotal:319,...overrides};}
function backend(){
  const rows=[],props=new Map([['SPREADSHEET_ID','test-sheet']]),cache=new Map();let locked=false,mailCount=0;
  const range=(r,c,n=1,m=1)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[r-1+i]?.[c-1+j]??'')),setValue:v=>{rows[r-1][c-1]=v;}});
  const sheet={getLastRow:()=>rows.length,getRange:range,appendRow:values=>rows.push([...values])};
  const context={console,OrderCore:core,ORDER_PRODUCTS:products,ORDER_CATALOG_VERSION:'test-version',
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
    SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest(),b=>b>127?b-256:b),formatDate:(_,tz,format)=>format==='yyyyMMdd'?'20261002':'2026100218'},
    MailApp:{sendEmail:()=>{mailCount++;throw new Error('quota exceeded');}},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'all'},createHtmlOutput:content=>({content,setXFrameOptionsMode(){return this;}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:content=>({content,setMimeType(){return this;}})}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/Config.gs','utf8')+'\n'+fs.readFileSync('apps-script/Code.gs','utf8'),context);
  rows.push(vm.runInContext('ORDER_HEADERS.slice()',context));
  const call=p=>context.handleRequest_(p);
  return {call,rows,context,setLock:value=>locked=value,mailCount:()=>mailCount,enableEmail:()=>vm.runInContext('ORDER_CONFIG.sendEmail=true',context),record:n=>Object.fromEntries(rows[0].map((k,i)=>[k,rows[n][i]])),set:(n,key,value)=>rows[n][rows[0].indexOf(key)]=value};
}
test('shipping threshold boundaries and independent delivery modes',()=>{
  assert.equal(core.shipping(598,'STORE'),70);assert.equal(core.shipping(599,'STORE'),0);
  assert.equal(core.shipping(1498,'HOME'),150);assert.equal(core.shipping(1499,'HOME'),0);
  assert.throws(()=>core.shipping(10,'COD'));
});
test('server derives price and rejects a forged total',()=>{
  const p=payload();p.items[0].unitPrice=1;p.total=1;
  assert.equal(core.validateOrder(p,products).total,319);
  assert.throws(()=>core.validateOrder({...p,expectedTotal:1},products),/金額/);
});
test('reject invalid product, options, quantity and duplicate lines',()=>{
  for(const change of [{productId:'UNKNOWN'},{quantity:0},{quantity:-1},{quantity:1.5},{quantity:100},{color:'紅色'},{size:'XL'}]){
    const p=payload();Object.assign(p.items[0],change);assert.throws(()=>core.validateOrder(p,products));
  }
  const p=payload();p.items.push({...p.items[0]});assert.throws(()=>core.validateOrder(p,products));
});
test('contact and both delivery branches are validated',()=>{
  assert.throws(()=>core.contact({name:'',phone:'0912345678',email:'a@b.co'}));
  assert.throws(()=>core.contact({name:'A',phone:'0912345678',email:'not-email'}));
  assert.throws(()=>core.delivery({method:'HOME',receiverName:'A',receiverPhone:'0912345678',postalCode:'100',address:''}));
  assert.equal(core.delivery({method:'HOME',receiverName:'A',receiverPhone:'0912345678',postalCode:'100',address:'測試地址'}).method,'HOME');
});
test('order persisted once; retry reuses id; next order gets next number',()=>{
  const b=backend(),p=payload(),first=b.call(p),again=b.call(p);
  assert.equal(first.orderId,'IAD-20261002-001');assert.equal(again.orderId,first.orderId);assert.equal(b.rows.length,2);
  assert.equal(b.call(payload()).orderId,'IAD-20261002-002');
  assert.equal(b.record(1).paymentStatus,'PENDING');assert.equal(b.record(1).orderStatus,'NEW');
  assert.equal(JSON.parse(b.record(1).itemsJson)[0].unitPrice,249);
  assert.notEqual(b.record(1).accessTokenHash,p.accessToken);
});
test('idempotency token or contents cannot be replaced',()=>{
  const b=backend(),p=payload();b.call(p);
  assert.throws(()=>b.call({...p,accessToken:'b'.repeat(64)}));
  assert.throws(()=>b.call({...p,buyerNote:'changed'}));assert.equal(b.rows.length,2);
});
test('catalog mismatch and forged total never append an order',()=>{
  const b=backend();assert.throws(()=>b.call(payload({catalogVersion:'old'})));assert.throws(()=>b.call(payload({expectedTotal:1})));assert.equal(b.rows.length,1);
});
test('concurrent lock rejection creates no duplicate or partial row',()=>{
  const b=backend();b.setLock(true);assert.throws(()=>b.call(payload()),/訂單較多/);assert.equal(b.rows.length,1);b.setLock(false);assert.equal(b.call(payload()).orderId,'IAD-20261002-001');
});
test('payment report requires capability token and bank last five digits',()=>{
  const b=backend(),p=payload(),order=b.call(p),report={action:'reportPayment',orderId:order.orderId,accessToken:p.accessToken,reportRequestId:crypto.randomUUID(),reference:'12345'};
  assert.throws(()=>b.call({...report,accessToken:'a'.repeat(64)}));
  assert.throws(()=>b.call({...report,reference:'1234'}));
  assert.equal(b.call(report).paymentStatus,'PAYMENT_REPORTED');
  const time=b.record(1).paymentReportedAt;b.call(report);assert.equal(b.record(1).paymentReportedAt,time);
  assert.equal(b.record(1).paymentReference,'12345');
});
test('manual PAID status is never downgraded; cancelled orders cannot report',()=>{
  const b=backend(),p=payload(),order=b.call(p),report={action:'reportPayment',orderId:order.orderId,accessToken:p.accessToken,reportRequestId:crypto.randomUUID(),reference:'12345'};
  b.set(1,'paymentStatus','PAID');b.set(1,'orderStatus','SHIPPED');assert.equal(b.call(report).paymentStatus,'PAID');assert.equal(b.record(1).orderStatus,'SHIPPED');
  b.set(1,'orderStatus','CANCELLED');assert.throws(()=>b.call(report));
});
test('LINE PAY and card reports require time or note',()=>{
  for(const method of ['LINE_PAY','CREDIT_CARD']){assert.throws(()=>core.paymentReport({},method));assert.equal(core.paymentReport({note:'測試付款'},method).note,'測試付款');}
});
test('formula-looking customer input is stored as text',()=>{
  const b=backend(),p=payload({buyerNote:'=IMPORTXML("example")'});b.call(p);assert.ok(b.record(1).buyerNote.startsWith("'="));
});
test('email failure leaves saved order successful and never retries mail on duplicate',()=>{
  const b=backend();b.enableEmail();const p=payload(),order=b.call(p);assert.equal(order.emailStatus,'FAILED');assert.equal(b.rows.length,2);b.call(p);assert.equal(b.mailCount(),1);
});
test('private status lookup contains no contact information',()=>{
  const b=backend(),p=payload(),order=b.call(p),read=b.call({action:'getOrder',orderId:order.orderId,accessToken:p.accessToken});assert.equal(read.customerEmail,undefined);assert.equal(read.customerPhone,undefined);assert.equal(read.total,319);
});
test('bridge rejects unapproved origins and returns a correlated result to approved origin',()=>{
  const b=backend(),p=payload();const bad=b.context.doPost({parameter:{payload:JSON.stringify({...p,origin:'https://evil.example'})}});assert.match(bad.content,/INVALID_ORIGIN/);assert.equal(b.rows.length,1);
  const good=b.context.doPost({parameter:{payload:JSON.stringify(p)}});assert.match(good.content,/window.top.postMessage/);assert.ok(good.content.includes(p.correlationId));assert.ok(good.content.includes('IAD-20261002-001'));assert.ok(!good.content.includes(p.accessToken));
});
