/* Shared validation and pricing, also copied to Apps Script Core.gs. */
globalThis.OrderCore = (() => {
  const paymentMethods = ['BANK_TRANSFER', 'CASH_DEPOSIT', 'CREDIT_CARD', 'LINE_PAY'];
  const deliveryMethods = ['STORE', 'HOME'];
  function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
  function text(value, label, max = 100, required = true) {
    if (typeof value !== 'string') value = '';
    value = value.trim();
    if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('INVALID_FIELD', `${label}格式不正確`);
    return value;
  }
  function phone(value, label) {
    value = text(value, label, 30).replace(/[\s()-]/g, '');
    if (!/^(09\d{8}|\+8869\d{8})$/.test(value)) fail('INVALID_PHONE', `${label}請填台灣手機號碼`);
    return value;
  }
  function contact(value = {}) {
    const name = text(value.name, '姓名');
    const mobile = phone(value.phone, '手機');
    const email = text(value.email, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('INVALID_EMAIL', '請填寫有效的 Email');
    if (value.website) fail('INVALID_REQUEST', '無法接受此筆訂單');
    return {name, phone:mobile, email};
  }
  function delivery(value = {}) {
    if (!deliveryMethods.includes(value.method)) fail('INVALID_DELIVERY', '請選擇配送方式');
    const result = {method:value.method, receiverName:text(value.receiverName, '收件人姓名'), receiverPhone:phone(value.receiverPhone, '收件人手機')};
    if (value.method === 'STORE') {
      if (!['SEVEN_ELEVEN','FAMILYMART'].includes(value.storeType)) fail('INVALID_STORE', '請選擇超商類型');
      Object.assign(result, {storeType:value.storeType, storeName:text(value.storeName,'門市名稱'), storeCode:text(value.storeCode,'門市代碼',12)});
      if (!/^[a-zA-Z0-9-]{4,12}$/.test(result.storeCode)) fail('INVALID_STORE', '請確認門市代碼');
    } else {
      Object.assign(result, {postalCode:text(value.postalCode,'郵遞區號',6), address:text(value.address,'完整地址',300)});
      if (!/^\d{3}(\d{2,3})?$/.test(result.postalCode)) fail('INVALID_ADDRESS','郵遞區號請填 3、5 或 6 碼');
    }
    return result;
  }
  function shipping(subtotal, method) {
    if (!Number.isSafeInteger(subtotal) || subtotal < 0) fail('INVALID_TOTAL','商品金額不正確');
    if (!deliveryMethods.includes(method)) fail('INVALID_DELIVERY','請選擇配送方式');
    return method === 'STORE' ? (subtotal >= 599 ? 0 : 70) : (subtotal >= 1499 ? 0 : 150);
  }
  function quote(rawItems, products, method) {
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) fail('INVALID_ITEMS','購物袋需有 1–50 項商品');
    const seen = new Set();
    const items = rawItems.map(item => {
      const p = products.find(p => p.id === item.productId && p.season === item.season);
      if (!p) fail('UNKNOWN_PRODUCT','商品已不存在，請重新加入購物袋');
      const quantity = item.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) fail('INVALID_QUANTITY','每項商品數量需為 1–99');
      const color = typeof item.color === 'string' ? item.color : '';
      const size = typeof item.size === 'string' ? item.size : '';
      if ((p.colors.length ? !p.colors.includes(color) : color !== '') || (p.sizes.length ? !p.sizes.includes(size) : size !== '')) fail('INVALID_OPTION',`${p.name} 的顏色或尺寸無效，請重新選擇`);
      const key = JSON.stringify([p.season,p.id,color,size]);
      if (seen.has(key)) fail('DUPLICATE_ITEM','重複商品規格，請整理購物袋後重試');
      seen.add(key);
      const unitPrice = Number(p.salePrice || p.price);
      if (!Number.isSafeInteger(unitPrice) || unitPrice < 1) fail('UNAVAILABLE_PRODUCT',`${p.name} 尚未開放購買`);
      return {productId:p.id, season:p.season, productName:p.name, color, size, quantity, unitPrice, subtotal:unitPrice * quantity, image:p.coverImage || p.images[0]};
    });
    const subtotal = items.reduce((sum,p) => sum + p.subtotal,0);
    const shippingFee = shipping(subtotal,method), total = subtotal + shippingFee;
    if (!Number.isSafeInteger(total) || total > 1000000) fail('INVALID_TOTAL','訂單金額超過可接受範圍');
    return {items, subtotal, shippingFee, total};
  }
  function validateOrder(payload, products) {
    if (!payload || typeof payload !== 'object') fail('INVALID_REQUEST','訂單格式不正確');
    const customer = contact(payload.contact), destination = delivery(payload.delivery);
    if (!paymentMethods.includes(payload.paymentMethod)) fail('INVALID_PAYMENT','請選擇付款方式');
    const amounts = quote(payload.items, products, destination.method);
    if (payload.expectedTotal !== amounts.total) fail('PRICE_CHANGED','商品金額有變動，請重新整理並確認金額');
    return {...amounts, contact:customer, delivery:destination, paymentMethod:payload.paymentMethod, buyerNote:text(payload.buyerNote,'訂單備註',500,false)};
  }
  function paymentReport(payload, method) {
    const reference = text(payload.reference,'付款參考資訊',100,false);
    const paidAt = text(payload.paidAt,'付款時間',40,false);
    const note = text(payload.note,'付款備註',300,false);
    if (method === 'BANK_TRANSFER' && !/^\d{5}$/.test(reference)) fail('INVALID_REFERENCE','請填匯款帳號後五碼');
    if (method !== 'BANK_TRANSFER' && !paidAt && !note) fail('INVALID_REFERENCE','請填付款時間或付款備註');
    if (paidAt && !Number.isFinite(Date.parse(paidAt))) fail('INVALID_TIME','付款時間格式不正確');
    return {reference, paidAt, note};
  }
  return {contact, delivery, shipping, quote, validateOrder, paymentReport, paymentMethods, deliveryMethods};
})();
if (typeof module !== 'undefined') module.exports = globalThis.OrderCore;
