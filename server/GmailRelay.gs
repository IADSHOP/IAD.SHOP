// Gmail notification relay only: no SpreadsheetApp, no order storage here.
// Set RELAY_SECRET in Script Properties. Deploy as Me / Anyone.
function doPost(e) {
 const respond=value=>ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
 let lock;
 try {
  const p=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties(),secret=props.getProperty('RELAY_SECRET');
  if(!secret||p.secret!==secret||!/^IAD-\d{4}-\d{4}-\d+-(new-[01]|report)$/.test(p.key))return respond({ok:false});
  const m=p.message;
  // Only mail the shop. Buyer emails stay disabled until an approved sender exists.
  if(m.to!=='iad.og.2022@gmail.com'||typeof m.subject!=='string'||m.subject.length>200||typeof m.text!=='string'||m.text.length>30000)return respond({ok:false});
  lock=LockService.getScriptLock();if(!lock.tryLock(10000))return respond({ok:false});
  const key='sent:'+p.key;
  if(props.getProperty(key))return respond({ok:true});
  const stored=props.getProperties();Object.keys(stored).filter(k=>k.startsWith('sent:')&&Number(stored[k])<Date.now()-172800000).forEach(k=>props.deleteProperty(k));
  if(MailApp.getRemainingDailyQuota()<1)return respond({ok:false});
  MailApp.sendEmail({to:m.to,subject:m.subject,body:m.text,htmlBody:m.html||m.text,name:'IAD SHOP'});
  props.setProperty(key,String(Date.now()));return respond({ok:true});
 } catch (_) {return respond({ok:false});} finally {if(lock)lock.releaseLock();}
}
function authorizeMail(){MailApp.getRemainingDailyQuota();}
function doGet(){return ContentService.createTextOutput('IAD SHOP Gmail relay');}
