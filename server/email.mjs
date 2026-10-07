export const labels={BANK_TRANSFER:'銀行匯款',CASH_DEPOSIT:'無卡存款',CREDIT_CARD:'線上信用卡',LINE_PAY:'LINE Pay',STORE:'店到店',HOME:'宅配',SEVEN_ELEVEN:'7-ELEVEN',FAMILYMART:'全家'};
const money=n=>'NT$'+Number(n).toLocaleString('en-US');
export function orderNumber(sequence,now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 return `IAD-${parts.year}-${parts.month}${parts.day}-${String(sequence).padStart(3,'0')}`;
}
export function reportLink(env,order,token){const url=new URL(env.STOREFRONT_URL);url.hash=new URLSearchParams({order:order.orderId,token}).toString();return url.href;}
export function newOrderEmails(order,token,env){
 const o=order,link=reportLink(env,o,token),d=o.delivery;
 const items=o.items.map(p=>`${p.productName}\n顏色 ${p.color||'—'} / 尺寸 ${p.size||'—'} / 數量 ${p.quantity}\n單價 ${money(p.unitPrice)} / 小計 ${money(p.subtotal)}`).join('\n\n');
 const address=d.method==='STORE'?`${labels[d.storeType]} ${d.storeName} / 門市代碼 ${d.storeCode}`:`${d.postalCode} ${d.address}`;
 const created=new Date(o.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 const text=`IAD SHOP\n訂單編號：${o.orderId}\n建立時間：${created}（台灣時間）\n付款方式：${labels[o.paymentMethod]}\n付款狀態：等待付款\n\n購買人：${o.contact.name}\n手機：${o.contact.phone}\nEmail：${o.contact.email}\n\n配送方式：${labels[d.method]}\n收件人：${d.receiverName}\n收件電話：${d.receiverPhone}\n配送資訊：${address}\n\n${items}\n\n商品總額：${money(o.subtotal)}\n運費：${money(o.shippingFee)}\n折扣：${money(0)}\n訂單總額：${money(o.total)}\n備註：${o.buyerNote||'—'}\n\nIAD SHOP 採先付款後出貨，完成付款並確認款項後才會安排出貨。`;
 const bank=['BANK_TRANSFER','CASH_DEPOSIT'].includes(o.paymentMethod)?`\n\n${labels[o.paymentMethod]}付款資訊\n${env.BANK_NAME} (${env.BANK_CODE})\n戶名：${env.BANK_HOLDER}\n帳號：${env.BANK_ACCOUNT}\n應付金額：${money(o.total)}\n銀行匯款請保留帳號末五碼；無卡存款請保留存款時間、ATM／分行與交易序號。`:'\n\n信用卡／LINE Pay 尚未串接自動付款確認。請依訂單頁提供的付款資訊操作，店家將人工確認收款。';
 return [{to:env.ADMIN_EMAIL,subject:`[IAD SHOP 新訂單] ${o.orderId}｜${money(o.total)}`,text}, {to:o.contact.email,subject:`IAD SHOP｜訂單成立｜${o.orderId}`,text:text+bank+'\n\n回報付款（請勿轉傳此私人連結）：\n'+link,button:{label:'回報付款',url:link}}];
}
export function reportEmail(o,r,env){return {to:env.ADMIN_EMAIL,subject:`[IAD SHOP 付款回報] ${o.orderId}｜${money(r.amount)}`,text:`IAD SHOP 付款回報\n訂單編號：${o.orderId}\n買家姓名：${o.contact.name}\n付款方式：${labels[o.paymentMethod]}\n付款金額：${money(r.amount)}\n付款時間：${new Date(r.paidAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}\n帳號末五碼／無卡存款資訊：${r.reference||r.note}\n備註：${r.note||'—'}\n回報提交時間：${r.createdAt}\n\n付款回報不代表付款已確認，IAD SHOP 將於實際確認款項後處理訂單。`};}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sendEmail(message,key,env,transport=fetch){
 const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#30362d"><h2>IAD SHOP</h2><div style="white-space:pre-wrap;line-height:1.8">${esc(message.text)}</div>${message.button?`<p><a style="display:inline-block;padding:12px 20px;background:#30362d;color:white;text-decoration:none" href="${esc(message.button.url)}">${esc(message.button.label)}</a></p>`:''}</div>`;
 if(env.MAIL_RELAY_URL){const relay=await transport(env.MAIL_RELAY_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({secret:env.MAIL_RELAY_SECRET,key,message:{...message,html}}),signal:AbortSignal.timeout(20000)});const result=await relay.json();if(!relay.ok||!result.ok)throw new Error('Mail relay rejected request');return;}
 const res=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.EMAIL_FROM,to:[message.to],reply_to:env.ADMIN_EMAIL,subject:message.subject,text:message.text,html})});
 if(!res.ok)throw new Error('Email provider rejected request');
}
