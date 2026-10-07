/* HTTPS JSON API. All credentials and durable state live on the server. */
window.IADOrderAPI = {
 configured(){try{const url=new URL(window.IAD_CHECKOUT_CONFIG.orderApiUrl);return url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));}catch{return false;}},
 async request(action,payload){
  if(!this.configured())throw new Error('目前尚未開放線上送單。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{const res=await fetch(window.IAD_CHECKOUT_CONFIG.orderApiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:controller.signal,credentials:'omit',cache:'no-store'});const data=await res.json();if(!res.ok||!data.ok){const e=new Error(data.message||'訂單未完成，請重試原訂單。');e.code=data.code;throw e;}if(!data.order?.orderId)throw new Error('服務回覆不完整，請重試原訂單。');return data.order;
  }catch(e){if(e.name==='AbortError')throw new Error('尚未收到回覆，請重試原訂單；不要重新下單。');throw e;}finally{clearTimeout(timer);}
 }
};
