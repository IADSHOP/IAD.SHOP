/* Form + iframe bridge: never use no-cors fetch and mistake an opaque response for success. */
window.IADOrderAPI = {
  configured() { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(window.IAD_CHECKOUT_CONFIG.appsScriptUrl); },
  request(action, payload) {
    if (!this.configured()) return Promise.reject(new Error('目前尚未開放線上送單，請稍後再試。'));
    const correlationId = crypto.randomUUID();
    return new Promise((resolve,reject) => {
      const frame = document.createElement('iframe'), form = document.createElement('form');
      frame.name = 'iad_order_' + correlationId; frame.hidden = true; frame.title = '訂單安全傳送';
      form.method = 'POST'; form.action = window.IAD_CHECKOUT_CONFIG.appsScriptUrl; form.target = frame.name; form.hidden = true;
      const field = document.createElement('input'); field.type = 'hidden'; field.name = 'payload';
      field.value = JSON.stringify({action, correlationId, origin:location.origin, ...payload});
      form.append(field);
      const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); form.remove(); frame.remove(); };
      const receive = event => {
        if (!/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/.test(event.origin)) return;
        const data = event.data;
        if (!data || data.channel !== 'iad-orders-v1' || data.correlationId !== correlationId) return;
        cleanup();
        if (data.ok && data.order?.orderId) resolve(data.order);
        else { const error = new Error(data.message || '訂單未完成，請稍後再試。'); error.code = data.code; reject(error); }
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('尚未收到回覆，請按原按鈕重試；系統會使用同一識別碼避免重複訂單。')); },45000);
      window.addEventListener('message',receive);
      document.body.append(frame,form); form.submit();
    });
  }
};
