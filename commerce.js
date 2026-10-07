/* BAG → CHECKOUT → ORDER. Existing viewer, grid and option overlay stay in app.js. */
(() => {
  const shop = window.IADShopBridge, core = OrderCore, api = window.IADOrderAPI, config = window.IAD_CHECKOUT_CONFIG;
  const $ = s => document.querySelector(s), esc = shop.esc, money = shop.money;
  const products = Object.values(shop.catalog).flat();
  const labels = {BANK_TRANSFER:'銀行匯款',CASH_DEPOSIT:'無卡存款',LINE_PAY:'LINE PAY',CREDIT_CARD:'線上信用卡',STORE:'店到店',HOME:'宅配',SEVEN_ELEVEN:'7-ELEVEN',FAMILYMART:'FamilyMart'};
  let deliveryMethod = read('iad-delivery','STORE');
  if (!['STORE','HOME'].includes(deliveryMethod)) deliveryMethod='STORE';
  let step=0, busy=false, receipt=read('iad-last-order',null), pending=readSession('iad-pending-order',null), reportId='', reportSignature='';
  let draft={contact:{name:'',phone:'',email:''},delivery:{method:deliveryMethod,receiverName:'',receiverPhone:'',storeType:'SEVEN_ELEVEN',storeName:'',storeCode:'',postalCode:'',address:''},paymentMethod:'BANK_TRANSFER',buyerNote:''};
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function readSession(key,fallback){try{return JSON.parse(sessionStorage.getItem(key))??fallback;}catch{return fallback;}}
  function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  const rawItems = () => shop.getBag().map(p=>({productId:p.id,season:p.season,color:p.color||'',size:p.size||'',quantity:p.qty}));
  function quote(){return core.quote(rawItems(),products,deliveryMethod);}
  function synchronizeBag(){
    const updated=shop.getBag().map(item=>{const p=products.find(p=>p.id===item.id&&p.season===item.season);return p?{...item,name:p.name,price:Number(p.salePrice||p.price),image:p.coverImage||p.images[0]}:item;});
    shop.setBag(updated);
  }
  function shippingMarkup(){return `<fieldset class="delivery-choices"><legend>DELIVERY / 配送方式</legend>${['STORE','HOME'].map(method=>`<label><input type="radio" name="deliveryMethod" value="${method}" ${deliveryMethod===method?'checked':''}><span>${labels[method]}<small>${method==='STORE'?'滿 NT$599 免運；未滿 NT$70':'滿 NT$1,499 免運；未滿 NT$150'}</small></span></label>`).join('')}</fieldset>`;}
  function totals(q){return `<dl class="checkout-totals"><div><dt>SUBTOTAL / 商品小計</dt><dd>${money(q.subtotal)}</dd></div><div><dt>SHIPPING / 運費</dt><dd>${q.shippingFee?money(q.shippingFee):'免運'}</dd></div><div class="grand-total"><dt>TOTAL</dt><dd>${money(q.total)}</dd></div></dl>`;}
  function showBag(){
    synchronizeBag();const bag=shop.getBag();let q,error='';try{if(bag.length)q=quote();}catch(e){error=e.message;}
    shop.openModal(`<div class="bag-content commerce-bag"><h2 id="modal-title">BAG</h2>${bag.length?bag.map((p,i)=>`<article class="bag-row"><img src="${esc(p.image)}" alt="${esc(p.name)}"><div><strong>${esc(p.name)}</strong><p>${esc(p.color||'—')} / ${esc(p.size||'—')}</p><span>單價 ${money(p.price)}</span><div class="quantity"><button data-cqty="${i}" data-delta="-1" aria-label="減少 ${esc(p.name)} 數量">−</button><span>${p.qty}</span><button data-cqty="${i}" data-delta="1" aria-label="增加 ${esc(p.name)} 數量" ${p.qty>=99?'disabled':''}>+</button><button data-cremove="${i}" class="remove">刪除</button></div><p class="line-subtotal">小計 ${money(p.price*p.qty)}</p></div></article>`).join(''):'<p class="bag-note">購物袋還是空的。</p>'}${bag.length?shippingMarkup():''}<div id="bag-amounts" aria-live="polite">${q?totals(q):''}</div>${error?`<p class="checkout-error">${esc(error)}；請移除後重新選擇。</p>`:''}<button class="overlay-action" data-start-checkout ${!q?'disabled':''}>前往結帳 →</button>${pending?'<button class="text-action" data-resume>繼續處理上次送單</button>':''}${receipt?'<button class="text-action" data-recent>最近訂單 / 付款回報</button>':''}</div>`,'bag');
  }
  function input(label,name,value,type='text',attributes='') {return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value||'')}" ${attributes}></label>`;}
  function saveStep(){
    const form=$('#checkout-form');if(!form)return;const data=Object.fromEntries(new FormData(form));
    if(step===0)draft.contact={name:data.name||'',phone:data.phone||'',email:data.email||''};
    if(step===1)Object.assign(draft.delivery,{method:deliveryMethod},Object.fromEntries(['receiverName','receiverPhone','storeType','storeName','storeCode','postalCode','address'].filter(k=>k in data).map(k=>[k,data[k]])));
    if(step===2)draft.paymentMethod=data.paymentMethod||draft.paymentMethod;
    if(step===3)draft.buyerNote=data.buyerNote||'';
  }
  function validateStep(){if(step===0)draft.contact=core.contact(draft.contact);if(step===1)core.delivery(draft.delivery);if(step===2&&!core.paymentMethods.includes(draft.paymentMethod))throw new Error('請選擇付款方式');}
  function paymentMarkup(method,afterOrder=false){
    if(['BANK_TRANSFER','CASH_DEPOSIT'].includes(method))return `<section class="payment-instructions"><h3>${method==='CASH_DEPOSIT'?'CASH DEPOSIT / 無卡存款':'BANK TRANSFER / 銀行匯款'}</h3><p>${esc(config.bank.name)} · ${esc(config.bank.code)}</p><p>戶名：${esc(config.bank.holder)}</p><p class="account-number">${esc(config.bank.account)}</p><button type="button" class="text-action" data-copy-account>COPY ACCOUNT / 複製帳號</button><p>先付款後出貨；完成匯款或無卡存款後，請提交付款回報。</p></section>`;
    const src=config.qr[method];return `<section class="payment-instructions"><h3>${method==='LINE_PAY'?'LINE PAY':'CREDIT CARD / 信用卡'}</h3><img class="payment-qr" src="${esc(src)}" alt="${labels[method]} 正式付款 QR Code"><a class="text-action" href="${esc(src)}" target="_blank" rel="noopener">開啟完整付款圖</a><a class="text-action" href="${esc(src)}" download>儲存付款圖</a><p>請${method==='LINE_PAY'?'使用 LINE PAY 掃描 QR Code':'掃描 QR Code 完成信用卡付款'}，並輸入訂單總金額。完成後請提交付款回報。</p><p class="muted">尚未串接自動金流；此頁不會自動確認付款成功。使用同一支手機時，可先儲存圖片；若付款 App 不支援相簿掃碼，請在另一個螢幕開啟付款圖。</p></section>`;
  }
  function itemSummary(items){return `<div class="order-items">${items.map(p=>`<div><span>${esc(p.productName)}<small>${esc(p.color||'—')} / ${esc(p.size||'—')} × ${p.quantity}</small></span><strong>${money(p.subtotal)}</strong></div>`).join('')}</div>`;}
  function checkout(){
    if(!shop.getBag().length){showBag();return;}
    let q;try{q=quote();}catch(e){showBag();return;}
    let content='';const c=draft.contact,d=draft.delivery;
    if(step===0)content=`<p class="form-intro">訂單聯絡資料</p>${input('姓名','name',c.name,'text','required maxlength="100" autocomplete="name"')}${input('手機','phone',c.phone,'tel','required maxlength="30" autocomplete="tel" inputmode="tel" placeholder="09xxxxxxxx"')}${input('Email','email',c.email,'email','required maxlength="254" autocomplete="email"')}<p class="muted">僅用於處理本次訂單及聯絡，不需要註冊會員。</p>`;
    if(step===1)content=`${shippingMarkup()}<button type="button" class="text-action" data-use-contact>帶入聯絡人姓名與手機</button>${input(d.method==='STORE'?'取件人姓名':'收件人姓名','receiverName',d.receiverName,'text','required maxlength="100" autocomplete="shipping name"')}${input(d.method==='STORE'?'取件人手機':'收件人手機','receiverPhone',d.receiverPhone,'tel','required maxlength="30" autocomplete="shipping tel"')}${deliveryMethod==='STORE'?`<label class="field"><span>超商類型</span><select name="storeType"><option value="SEVEN_ELEVEN" ${d.storeType==='SEVEN_ELEVEN'?'selected':''}>7-ELEVEN</option><option value="FAMILYMART" ${d.storeType==='FAMILYMART'?'selected':''}>FamilyMart</option></select></label>${input('門市名稱','storeName',d.storeName,'text','required maxlength="100"')}${input('門市代碼','storeCode',d.storeCode,'text','required maxlength="12" inputmode="numeric"')}<p class="muted">請手動確認門市名稱與代碼；此版本不會查詢超商地圖。</p>`:`${input('郵遞區號','postalCode',d.postalCode,'text','required maxlength="6" inputmode="numeric" autocomplete="shipping postal-code"')}${input('完整地址','address',d.address,'text','required maxlength="300" autocomplete="shipping street-address"')}`}<div aria-live="polite">${totals(q)}</div>`;
    if(step===2)content=`<fieldset class="payment-choices"><legend>PAYMENT / 付款方式</legend>${core.paymentMethods.map(method=>`<label><input type="radio" name="paymentMethod" value="${method}" ${draft.paymentMethod===method?'checked':''}><span>${labels[method]}</span></label>`).join('')}</fieldset><p class="payment-notice">請先完成下一步「確認訂單」，取得訂單編號後再付款。</p><div id="payment-preview">${paymentMarkup(draft.paymentMethod)}</div>`;
    if(step===3)content=`${itemSummary(q.items)}<section class="confirm-info"><h3>CONTACT</h3><p>${esc(c.name)} · ${esc(c.phone)}<br>${esc(c.email)}</p><h3>DELIVERY / ${labels[deliveryMethod]}</h3><p>${esc(d.receiverName)} · ${esc(d.receiverPhone)}<br>${deliveryMethod==='STORE'?`${labels[d.storeType]} ${esc(d.storeName)}<br>門市代碼 ${esc(d.storeCode)}`:`${esc(d.postalCode)} ${esc(d.address)}`}</p><h3>PAYMENT</h3><p>${labels[draft.paymentMethod]}</p></section>${totals(q)}<label class="field"><span>訂單備註（選填）</span><textarea name="buyerNote" maxlength="500" rows="3">${esc(draft.buyerNote)}</textarea></label><p class="muted">確認後建立訂單，付款需由店家人工核對。</p>${!api.configured()?'<p class="checkout-error">目前尚未開放線上送單。表單可先檢查，尚不會建立訂單。</p>':''}`;
    shop.openModal(`<div class="checkout-content"><h2 id="modal-title">CHECKOUT</h2><ol class="checkout-steps" aria-label="結帳進度">${['CONTACT','DELIVERY','PAYMENT','CONFIRM'].map((label,i)=>`<li ${i===step?'aria-current="step"':''}><span>0${i+1}</span>${label}</li>`).join('')}</ol><form id="checkout-form">${content}<p class="checkout-error" id="checkout-error" role="alert"></p><div class="checkout-actions"><button type="button" class="secondary-action" data-checkout-back>${step?'上一步':'返回 BAG'}</button><button class="overlay-action" type="submit" ${step===3&&!api.configured()?'disabled':''}>${step===3?'確認訂單':'下一步 →'}</button></div></form></div>`,'checkout');
  }
  const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  function persistPending(value){if(value){try{sessionStorage.setItem('iad-pending-order',JSON.stringify(value));}catch{throw new Error('瀏覽器無法暫存送單識別資料，請允許此網站儲存資料後再試。');}}else{try{sessionStorage.removeItem('iad-pending-order');}catch{}}pending=value;}
  function lockUI(locked){busy=locked;$('#modal').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=locked);$('#modal').setAttribute('aria-busy',locked);}
  async function sendPending(){
    if(!pending||busy)return;
    const errorEl=$('#checkout-error');if(errorEl)errorEl.textContent='正在建立訂單，請稍候…';
    lockUI(true);
    try{
      const order=await api.request('createOrder',pending);
      const sent=pending;receipt={...order,accessToken:sent.accessToken};store('iad-last-order',receipt);
      // Remove only submitted quantities, preserving any additions made in another flow.
      const remaining=shop.getBag().map(item=>{const sentItem=sent.items.find(p=>p.productId===item.id&&p.season===item.season&&p.color===(item.color||'')&&p.size===(item.size||''));return {...item,qty:item.qty-(sentItem?.quantity||0)};}).filter(p=>p.qty>0);
      shop.setBag(remaining);persistPending(null);lockUI(false);showReceipt();
    }catch(e){lockUI(false);if(['PRICE_CHANGED','CATALOG_CHANGED','INVALID_FIELD','INVALID_PHONE','INVALID_EMAIL','INVALID_DELIVERY','INVALID_STORE','INVALID_ADDRESS','INVALID_PAYMENT','INVALID_ITEMS','UNKNOWN_PRODUCT','INVALID_QUANTITY','INVALID_OPTION','DUPLICATE_ITEM','UNAVAILABLE_PRODUCT','INVALID_TOTAL','RATE_LIMIT'].includes(e.code)){persistPending(null);step=3;checkout();$('#checkout-error').textContent=e.message;}else{if(errorEl)errorEl.textContent=e.message;showPending(e.message);}}
  }
  function showPending(message='上次送單尚未收到明確回覆。請先重試查明結果，以免重複下單。'){
    shop.openModal(`<div class="checkout-content"><h2 id="modal-title">訂單處理中</h2><p class="form-intro">${esc(message)}</p><p class="muted">重試會沿用同一筆送單識別碼；伺服器只會保存一筆訂單。請勿先付款。</p><p id="checkout-error" class="checkout-error" role="alert"></p><button class="overlay-action" data-retry-order>重試原訂單</button><button class="text-action" data-pending-edit>返回檢查原資料</button></div>`,'checkout');
  }
  async function submitCheckout(e){
    e.preventDefault();if(busy)return;
    try{saveStep();validateStep();if(step<3){step++;checkout();return;}
      const q=quote();const payload={items:rawItems(),contact:draft.contact,delivery:draft.delivery,paymentMethod:draft.paymentMethod,buyerNote:draft.buyerNote,expectedTotal:q.total,catalogVersion:window.IAD_ORDER_CATALOG_VERSION};
      core.validateOrder(payload,products);
      if(!api.configured())throw new Error('目前尚未開放線上送單');
      if(pending){showPending();return;}
      persistPending({...payload,requestId:crypto.randomUUID(),accessToken:randomToken()});await sendPending();
    }catch(error){$('#checkout-error').textContent=error.message;}
  }
  function showReceipt(){
    if(!receipt){showBag();return;}
    const status={PENDING:'等待付款',PAYMENT_REPORTED:'等待人工確認',PAID:'已確認收款',FAILED:'付款失敗',REFUNDED:'已退款'};
    const closed=receipt.orderStatus==='CANCELLED'||['PAID','FAILED','REFUNDED'].includes(receipt.paymentStatus);
    shop.openModal(`<div class="checkout-content order-receipt"><span class="eyebrow">IAD SHOP / ORDER</span><h2 id="modal-title">訂單成立</h2><p class="order-id">${esc(receipt.orderId)}</p><button class="text-action" data-copy-order>COPY ORDER ID / 複製訂單編號</button><dl class="checkout-totals"><div><dt>TOTAL</dt><dd>${money(receipt.total)}</dd></div><div><dt>PAYMENT</dt><dd>${labels[receipt.paymentMethod]}</dd></div><div><dt>STATUS</dt><dd>${receipt.orderStatus==='CANCELLED'?'訂單已取消':status[receipt.paymentStatus]||esc(receipt.paymentStatus)}</dd></div></dl><button class="text-action" data-refresh-order>更新訂單狀態</button><p class="muted">IAD SHOP 採先付款後出貨，完成付款並確認款項後才會安排出貨。請保存訂單編號；可從此瀏覽器的 BAG → 最近訂單返回付款頁。</p>${receipt.paymentStatus==='PAYMENT_REPORTED'?'<p class="payment-notice">已收到付款回報，店家尚待對帳。請勿重複付款。</p>':''}${!closed?paymentMarkup(receipt.paymentMethod,true):''}${!closed&&receipt.paymentStatus!=='PAYMENT_REPORTED'?`<section class="report-section"><h3>PAYMENT REPORT / 付款回報</h3><button class="overlay-action" data-open-report>完成付款後回報付款 →</button><form id="report-form" hidden>${input('訂單編號','orderId',receipt.orderId,'text','readonly')}${input('付款方式','paymentMethod',labels[receipt.paymentMethod],'text','readonly')}${receipt.paymentMethod==='BANK_TRANSFER'?input('匯款帳號後五碼','reference','','text','required pattern="[0-9]{5}" minlength="5" maxlength="5" inputmode="numeric"'):''}${input('付款金額','amount',receipt.total,'number','required min="1" step="1"')}${input('付款時間','paidAt','','datetime-local','required')}<label class="field"><span>付款備註${receipt.paymentMethod==='CASH_DEPOSIT'?'（必填：ATM／分行、交易序號等存款資訊）':'（選填）'}</span><textarea name="note" maxlength="300" rows="2" ${receipt.paymentMethod==='CASH_DEPOSIT'?'required':''}></textarea></label><p class="muted">付款回報不代表付款已確認，IAD SHOP 將於實際確認款項後處理訂單。</p><p id="report-error" class="checkout-error" role="alert"></p><button class="overlay-action" type="submit">我已完成付款／提交回報</button></form></section>`:''}<p id="order-feedback" role="status" class="muted"></p></div>`,'checkout');
  }
  async function report(e){e.preventDefault();if(busy)return;const errorEl=$('#report-error');try{
    const values=Object.fromEntries(new FormData(e.target));values.amount=Number(values.amount);
    if(values.paidAt)values.paidAt=new Date(values.paidAt).toISOString();
    core.paymentReport(values,receipt.paymentMethod);if(!values.paidAt)throw new Error('請填付款時間');if(values.amount!==receipt.total)throw new Error('付款金額需等於訂單總額');if(receipt.paymentMethod==='CASH_DEPOSIT'&&!values.note?.trim())throw new Error('請填無卡存款資訊');
    const signature=JSON.stringify(values);if(signature!==reportSignature){reportId=crypto.randomUUID();reportSignature=signature;}
    lockUI(true);errorEl.textContent='正在提交付款回報…';
    const order=await api.request('reportPayment',{...values,orderId:receipt.orderId,accessToken:receipt.accessToken,reportRequestId:reportId});
    receipt={...order,accessToken:receipt.accessToken};store('iad-last-order',receipt);lockUI(false);showReceipt();
  }catch(error){lockUI(false);errorEl.textContent=error.message;}}
  async function refreshOrder(){if(busy||!receipt)return;lockUI(true);try{const order=await api.request('getOrder',{orderId:receipt.orderId,accessToken:receipt.accessToken});receipt={...order,accessToken:receipt.accessToken};store('iad-last-order',receipt);lockUI(false);showReceipt();}catch(error){lockUI(false);$('#order-feedback').textContent=error.message;}}
  async function copy(value){try{await navigator.clipboard.writeText(value);const feedback=$('#order-feedback')||$('#checkout-error');if(feedback)feedback.textContent='已複製';else shop.notify('已複製');}catch{const feedback=$('#order-feedback')||$('#checkout-error');if(feedback)feedback.textContent='無法自動複製，請長按選取上方內容。';}}
  document.addEventListener('submit',e=>{if(e.target.id==='checkout-form')submitCheckout(e);if(e.target.id==='report-form')report(e);});
  document.addEventListener('change',e=>{
    if(e.target.name==='deliveryMethod'){saveStep();deliveryMethod=e.target.value;draft.delivery.method=deliveryMethod;store('iad-delivery',deliveryMethod);if($('#checkout-form'))checkout();else showBag();}
    if(e.target.name==='paymentMethod'){draft.paymentMethod=e.target.value;$('#payment-preview').innerHTML=paymentMarkup(draft.paymentMethod);}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||busy)return;
    if(b.hasAttribute('data-cqty')){const next=shop.getBag(),i=+b.dataset.cqty;next[i].qty+=+b.dataset.delta;shop.setBag(next.filter(p=>p.qty>0));showBag();}
    if(b.hasAttribute('data-cremove')){const next=shop.getBag();next.splice(+b.dataset.cremove,1);shop.setBag(next);showBag();}
    if(b.hasAttribute('data-start-checkout')){if(pending){showPending();return;}step=0;checkout();}
    if(b.hasAttribute('data-checkout-back')){saveStep();if(step){step--;checkout();}else showBag();}
    if(b.hasAttribute('data-use-contact')){saveStep();draft.delivery.receiverName=draft.contact.name;draft.delivery.receiverPhone=draft.contact.phone;checkout();}
    if(b.hasAttribute('data-copy-account'))copy(config.bank.account);
    if(b.hasAttribute('data-copy-order'))copy(receipt.orderId);
    if(b.hasAttribute('data-recent'))showReceipt();
    if(b.hasAttribute('data-refresh-order'))refreshOrder();
    if(b.hasAttribute('data-open-report')){b.hidden=true;$('#report-form').hidden=false;$('#report-form input[name=amount]').focus();}
    if(b.hasAttribute('data-resume'))showPending();
    if(b.hasAttribute('data-retry-order'))sendPending();
    if(b.hasAttribute('data-pending-edit')){draft={contact:pending.contact,delivery:pending.delivery,paymentMethod:pending.paymentMethod,buyerNote:pending.buyerNote};deliveryMethod=draft.delivery.method;step=3;checkout();}
  });
  $('#modal').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  async function openReportLink(){const params=new URLSearchParams(location.hash.slice(1));const orderId=params.get('order'),token=params.get('token');if(!orderId||!token)return;history.replaceState({},'',location.pathname+location.search);try{const order=await api.request('getOrder',{orderId,accessToken:token});receipt={...order,accessToken:token};store('iad-last-order',receipt);showReceipt();}catch(e){shop.notify(e.message);}}
  window.addEventListener('hashchange',openReportLink);openReportLink();
  window.IADCommerce={showBag};
})();
