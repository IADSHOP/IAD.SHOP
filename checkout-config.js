// Public settings only. Worker /orders URL goes here; never put secrets in this file.
window.IAD_CHECKOUT_CONFIG = Object.freeze({
  orderApiUrl: 'https://iad-shop-orders.iad-shop.workers.dev/orders',
  bank: {name:'永豐銀行', code:'807', holder:'網癮中年企業社李文傑', account:'19201800126419'},
  qr: {LINE_PAY:'./assets/payment/line-pay.jpg', CREDIT_CARD:'./assets/payment/credit-card.jpg'}
});
