// Keep this spreadsheet private. Web App runs as the owner; customers do not get Sheet access.
const ORDER_CONFIG = {
  sheetName: 'IAD SHOP ORDERS',
  storefrontUrl: 'https://iadshop.github.io/IAD.SHOP/',
  allowedOrigins: ['https://iadshop.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173'],
  adminEmail: '',
  sendEmail: false,
  maxOrdersPerEmailPer10Minutes: 5,
  maxOrdersPerHour: 100,
  bank: {name:'永豐銀行', code:'807', holder:'網癮中年企業社李文傑', account:'19201800126419'}
};
