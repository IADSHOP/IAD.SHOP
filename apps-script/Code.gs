const ORDER_HEADERS = ['orderId','createdAt','customerName','customerPhone','customerEmail','deliveryMethod','receiverName','receiverPhone','storeType','storeName','storeCode','postalCode','address','paymentMethod','paymentStatus','subtotal','shippingFee','total','orderStatus','itemsJson','buyerNote','paymentReportedAt','paymentReference','paymentTime','paymentNote','requestId','requestHash','accessTokenHash','reportRequestId','emailStatus'];

// Run once from the bound spreadsheet's Apps Script editor. Private helpers end in _.
function setupOrders_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('請從訂單 Google Sheet 的「擴充功能 → Apps Script」開啟。');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',spreadsheet.getId());
  spreadsheet.setSpreadsheetTimeZone('Asia/Taipei');
  let sheet = spreadsheet.getSheetByName(ORDER_CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(ORDER_CONFIG.sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(ORDER_HEADERS);
  verifyHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,ORDER_HEADERS.length).setFontWeight('bold').setBackground('#30362d').setFontColor('#ffffff');
  const rangeFor = name => sheet.getRange(2,ORDER_HEADERS.indexOf(name)+1,Math.max(1,sheet.getMaxRows()-1),1);
  rangeFor('paymentStatus').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['PENDING','PAYMENT_REPORTED','PAID','FAILED','REFUNDED'],true).setAllowInvalid(false).build());
  rangeFor('orderStatus').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['NEW','PREPARING','SHIPPED','COMPLETED','CANCELLED'],true).setAllowInvalid(false).build());
  sheet.autoResizeColumns(1,ORDER_HEADERS.length);
}
function verifyHeaders_(sheet) {
  const actual = sheet.getRange(1,1,1,ORDER_HEADERS.length).getValues()[0];
  if (ORDER_HEADERS.some((name,i) => name !== actual[i])) throw new Error('訂單欄位不符，請核對第一列，勿在中間插入或刪除欄位。');
}
function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('請先執行 setupOrders_');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(ORDER_CONFIG.sheetName);
  if (!sheet) throw new Error('Missing order sheet');
  verifyHeaders_(sheet); return sheet;
}
function error_(code,message) { const error = new Error(message); error.code = code; throw error; }
function digest_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(b => (b+256).toString(16).slice(-2)).join(''); }
function validRequestId_(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{20,80}$/.test(value); }
function validToken_(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function constantEqual_(a,b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff === 0; }
function readRows_(sheet) { if (sheet.getLastRow() < 2) return []; return sheet.getRange(2,1,sheet.getLastRow()-1,ORDER_HEADERS.length).getValues().map((row,i) => ({row:i+2,record:Object.fromEntries(ORDER_HEADERS.map((key,n) => [key,row[n]]))})); }
function cell_(value) { return typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? "'"+value : value; }
function writeField_(sheet,row,key,value) { sheet.getRange(row,ORDER_HEADERS.indexOf(key)+1).setValue(cell_(value)); }
function publicOrder_(record) {
  return {orderId:record.orderId, createdAt:record.createdAt, paymentMethod:record.paymentMethod, paymentStatus:record.paymentStatus, orderStatus:record.orderStatus, deliveryMethod:record.deliveryMethod, subtotal:Number(record.subtotal), shippingFee:Number(record.shippingFee), total:Number(record.total), items:JSON.parse(record.itemsJson), paymentReportedAt:record.paymentReportedAt || '', emailStatus:record.emailStatus || 'DISABLED'};
}
function authorizeOrder_(rows,payload) {
  const found = rows.find(p => p.record.orderId === payload.orderId);
  if (!validToken_(payload.accessToken) || !found || !constantEqual_(found.record.accessTokenHash,digest_(payload.accessToken))) error_('NOT_FOUND','找不到訂單或驗證資料不正確，請從原下單瀏覽器開啟。');
  return found;
}
function enforceRate_(email) {
  const cache = CacheService.getScriptCache();
  const emailKey='orders-email-'+digest_(email), hourKey='orders-hour-'+Utilities.formatDate(new Date(),'Asia/Taipei','yyyyMMddHH');
  const emailCount=Number(cache.get(emailKey)||0), totalCount=Number(cache.get(hourKey)||0);
  if (emailCount >= ORDER_CONFIG.maxOrdersPerEmailPer10Minutes || totalCount >= ORDER_CONFIG.maxOrdersPerHour) error_('RATE_LIMIT','目前送單次數較多，請稍後再試。');
  cache.put(emailKey,String(emailCount+1),600); cache.put(hourKey,String(totalCount+1),3600);
}
function requestFingerprint_(payload) {
  return digest_(JSON.stringify({items:payload.items,contact:payload.contact,delivery:payload.delivery,paymentMethod:payload.paymentMethod,buyerNote:payload.buyerNote || '',expectedTotal:payload.expectedTotal,catalogVersion:payload.catalogVersion}));
}
function createOrder_(payload,sheet,rows) {
  if (!validRequestId_(payload.requestId) || !validToken_(payload.accessToken)) error_('INVALID_REQUEST','訂單識別資料不正確，請重新開啟結帳。');
  const fingerprint=requestFingerprint_(payload);
  const existing=rows.find(p=>p.record.requestId===payload.requestId);
  if(existing) {
    if(!constantEqual_(existing.record.accessTokenHash,digest_(payload.accessToken)) || existing.record.requestHash!==fingerprint) error_('REQUEST_CONFLICT','這筆訂單已處理，但內容不同。請先查看原訂單。');
    return {order:publicOrder_(existing.record),isNew:false};
  }
  if(payload.catalogVersion!==ORDER_CATALOG_VERSION) error_('CATALOG_CHANGED','商品資料已更新，請重新整理網站後再確認訂單。');
  const order=OrderCore.validateOrder(payload,ORDER_PRODUCTS);
  enforceRate_(order.contact.email);
  const now=new Date(), date=Utilities.formatDate(now,'Asia/Taipei','yyyyMMdd'), prefix='IAD-'+date+'-';
  const props=PropertiesService.getScriptProperties(), counterKey='ORDER_SEQUENCE_'+date;
  const existingMax=rows.reduce((max,p)=>p.record.orderId.startsWith(prefix)?Math.max(max,Number(p.record.orderId.slice(prefix.length))||0):max,0);
  const sequence=Math.max(Number(props.getProperty(counterKey)||0),existingMax)+1;
  props.setProperty(counterKey,String(sequence));
  const record={orderId:prefix+String(sequence).padStart(3,'0'), createdAt:now.toISOString(), customerName:order.contact.name, customerPhone:order.contact.phone, customerEmail:order.contact.email,
    deliveryMethod:order.delivery.method, receiverName:order.delivery.receiverName, receiverPhone:order.delivery.receiverPhone, storeType:order.delivery.storeType||'',storeName:order.delivery.storeName||'',storeCode:order.delivery.storeCode||'',postalCode:order.delivery.postalCode||'',address:order.delivery.address||'',
    paymentMethod:order.paymentMethod,paymentStatus:'PENDING',subtotal:order.subtotal,shippingFee:order.shippingFee,total:order.total,orderStatus:'NEW',itemsJson:JSON.stringify(order.items),buyerNote:order.buyerNote,paymentReportedAt:'',paymentReference:'',paymentTime:'',paymentNote:'',requestId:payload.requestId,requestHash:fingerprint,accessTokenHash:digest_(payload.accessToken),reportRequestId:'',emailStatus:ORDER_CONFIG.sendEmail?'QUEUED':'DISABLED'};
  sheet.appendRow(ORDER_HEADERS.map(key=>cell_(record[key] ?? '')));
  SpreadsheetApp.flush();
  return {order:publicOrder_(record),isNew:true,record,row:sheet.getLastRow()};
}
function reportPayment_(payload,sheet,rows) {
  const found=authorizeOrder_(rows,payload),record=found.record;
  if (!validRequestId_(payload.reportRequestId)) error_('INVALID_REQUEST','付款回報識別碼不正確');
  if (record.orderStatus==='CANCELLED' || ['FAILED','REFUNDED'].includes(record.paymentStatus)) error_('ORDER_CLOSED','此訂單目前不接受付款回報，請聯絡店家。');
  if (record.paymentStatus==='PAID' || record.reportRequestId===payload.reportRequestId) return publicOrder_(record);
  const report=OrderCore.paymentReport(payload,record.paymentMethod);
  const changes={paymentStatus:'PAYMENT_REPORTED',paymentReportedAt:new Date().toISOString(),paymentReference:report.reference,paymentTime:report.paidAt,paymentNote:report.note,reportRequestId:payload.reportRequestId};
  // Update only payment-report columns; leave all manual fulfilment fields intact.
  Object.keys(changes).forEach(key=>{writeField_(sheet,found.row,key,changes[key]);record[key]=changes[key];});
  SpreadsheetApp.flush();return publicOrder_(record);
}
function handleRequest_(payload) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000)) error_('BUSY','目前訂單較多，請使用原按鈕重試。');
  let result;
  try {
    const sheet=sheet_(),rows=readRows_(sheet);
    if(payload.action==='createOrder') result=createOrder_(payload,sheet,rows);
    else if(payload.action==='reportPayment') return reportPayment_(payload,sheet,rows);
    else if(payload.action==='getOrder') return publicOrder_(authorizeOrder_(rows,payload).record);
    else error_('INVALID_ACTION','不支援的操作');
  } finally {lock.releaseLock();}
  if(result.isNew && ORDER_CONFIG.sendEmail) {
    let status='SENT';
    try {sendConfirmation_(result.record);} catch {status='FAILED';}
    try {writeField_(sheet_(),result.row,'emailStatus',status);} catch { /* saved order remains authoritative */ }
    result.order.emailStatus=status;
  }
  return result.order;
}
function doPost(e) {
  let payload={},response;
  try {
    const raw=e?.parameter?.payload || '';
    if(raw.length>50000) error_('INVALID_REQUEST','訂單資料過長');
    payload=JSON.parse(raw);
    if(!payload || typeof payload!=='object' || Array.isArray(payload)){payload={};error_('INVALID_REQUEST','訂單資料格式不正確');}
    if(!ORDER_CONFIG.allowedOrigins.includes(payload.origin) || !validRequestId_(payload.correlationId)) error_('INVALID_ORIGIN','無法接受此來源');
    response={ok:true,order:handleRequest_(payload)};
  } catch(error) {
    response={ok:false,code:error.code||'SERVER_ERROR',message:error.code?error.message:'暫時無法處理訂單，請使用原按鈕稍後重試。'};
  }
  if(!ORDER_CONFIG.allowedOrigins.includes(payload.origin)) return ContentService.createTextOutput(JSON.stringify({ok:false,code:'INVALID_ORIGIN'})).setMimeType(ContentService.MimeType.JSON);
  response.channel='iad-orders-v1'; response.correlationId=payload.correlationId;
  const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  // No actionable UI is embedded. A strict target origin + random request nonce routes the response.
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage('+safe(response)+','+safe(payload.origin)+');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doGet() { return ContentService.createTextOutput(JSON.stringify({service:'IAD SHOP ORDERS',ready:!!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),catalogVersion:ORDER_CATALOG_VERSION})).setMimeType(ContentService.MimeType.JSON); }
function sendConfirmation_(record) {
  const lines=['IAD SHOP — ORDER CONFIRMATION','訂單編號：'+record.orderId,'',...JSON.parse(record.itemsJson).map(p=>`${p.productName} / ${p.color||'—'} / ${p.size||'—'} × ${p.quantity} — NT$${p.subtotal}`),'','配送：'+(record.deliveryMethod==='STORE'?'店到店':'宅配'),'付款：'+record.paymentMethod,'商品小計：NT$'+record.subtotal,'運費：NT$'+record.shippingFee,'TOTAL：NT$'+record.total,'付款狀態：等待付款'];
  if(record.paymentMethod==='BANK_TRANSFER') lines.push('',ORDER_CONFIG.bank.name+' ('+ORDER_CONFIG.bank.code+')','戶名：'+ORDER_CONFIG.bank.holder,'帳號：'+ORDER_CONFIG.bank.account);
  lines.push('','請回原下單瀏覽器的 BAG → 最近訂單，查看付款資訊及回報。',ORDER_CONFIG.storefrontUrl,'付款回報後由店家人工對帳，並非即時付款確認。');
  MailApp.sendEmail({to:record.customerEmail,subject:'IAD SHOP 訂單 '+record.orderId,body:lines.join('\n'),name:'IAD SHOP'});
  if(ORDER_CONFIG.adminEmail) MailApp.sendEmail({to:ORDER_CONFIG.adminEmail,subject:'新訂單 '+record.orderId,body:lines.join('\n'),name:'IAD SHOP'});
}
