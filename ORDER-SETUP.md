# IAD SHOP 輕量訂單系統：免費設定與人工操作

網站仍由 GitHub Pages 提供。現有 BAG、四步 Checkout、配送方式、商品視覺均沿用。

Cloudflare 免費 API 已部署至 `https://iad-shop-orders.iad-shop.workers.dev`，Gmail relay 已部署並完成授權；兩邊密鑰已核對一致。直接呼叫 Gmail relay，以及 Cloudflare 至 Gmail 的新訂單／付款回報通知測試均成功。暫時寄信測試入口已移除。`checkout-config.js` 已接上正式 `/orders` 網址，不需要 Google Sheet。

正式資料庫尚未建立訂單，第一筆流水號仍保留 088。本機隔離資料庫已驗證建立訂單、同單重試和付款回報。驗收通知只使用歷史測試識別，不使用正式訂單流水號。

## 方案與費用

- Cloudflare Workers **Free** + SQLite Durable Object：一個私有資料庫保存訂單、付款回報、全站流水號及寄信佇列。不需要網域，用免費 workers.dev URL。
- Google Apps Script **獨立指令碼**：只負責透過你的 Google 帳號寄通知到 `iad.og.2022@gmail.com`，不建立試算表。Google 個人帳號 MailApp 每日約 100 名收件人，配額由 Google 控制。
- 不加入信用卡、不升級付費方案；超過免費配額會停止或延後，不自動購買額度。
- 買家確認信預設關閉。Email 模板及私人回報連結已備妥，未來有驗證網域可用 Resend 等服務啟用。

## 1. 建立免費 Gmail 寄信入口（需要你操作）

1. 開啟 https://script.google.com/ ，用 `iad.og.2022@gmail.com` 登入，新增獨立專案，命名 `IAD SHOP MAIL`。不開 Google Sheets。
2. 將本專案 `server/GmailRelay.gs` 全部貼入 `Code.gs`，儲存。
3. 產生一段至少 32 bytes 的隨機字串，存在自己的密碼管理工具。這是新系統共用密鑰，**不是 Gmail 密碼**。
4. Apps Script → 專案設定 → 指令碼屬性，新增 `RELAY_SECRET`，填上剛生成的密鑰。不要貼在程式碼或 GitHub。
5. 選 `authorizeMail` → 執行，由你完成 Google 寄信授權。
6. 部署 → 新增部署 → 網頁應用程式；執行身分選「我」，存取選「所有人」。公開網址只接受正確密鑰、固定店家收件地址，不提供讀取訂單功能。
7. 取得以 `/exec` 結尾的部署網址，下一步設定在 Worker Secret `MAIL_RELAY_URL`。不要將 Google 密碼交給網站。

程式只在 Script Properties 保存短期寄信去重鍵（48 小時），沒有客戶訂單資料或流水號。正常重試不重寄；若寄信成功但 Google 在記錄去重鍵前中斷，極少數情況仍可能收到重複通知，可用相同訂單編號判讀。訂單本身不會重建。

## 2. 建立免費 Cloudflare API（需要你操作）

1. 開啟 https://dash.cloudflare.com/ ，建立免費帳號。維持 **Workers Free**，不要升級或設定付費方案。
2. 在本機安裝 Node.js LTS（若已有可略過）。於專案開啟終端機，執行：

```powershell
npx wrangler login
node scripts/export-order-catalog.mjs
npx wrangler deploy --config server/wrangler.toml
```

3. 程式會依 `server/wrangler.toml` 建立 SQLite Durable Object，首次資料庫流水號是 **87**，第一筆正式單得到 **088**。初始化採 INSERT OR IGNORE；後續部署不重設。不要刪除 namespace 或改 `iad-orders-production` 名稱，否則會建立新的資料庫。
4. 依序執行以下指令，**在互動提示裡**填值，不把密鑰寫在指令、公開檔案或聊天：

```powershell
npx wrangler secret put MAIL_RELAY_URL --config server/wrangler.toml
npx wrangler secret put MAIL_RELAY_SECRET --config server/wrangler.toml
npx wrangler secret put ADMIN_TOKEN --config server/wrangler.toml
```

- MAIL_RELAY_URL：上一步 Apps Script 的完整 `/exec` 網址。
- MAIL_RELAY_SECRET：與 Google Script Properties 的 RELAY_SECRET 完全相同。
- ADMIN_TOKEN：另一段独立的強隨機密鑰，僅店家用來更新已收款／出貨狀態，不提供給買家。

`server/wrangler.toml` 中的銀行資訊已沿用現有專案資料，請你核對，沒有自行捏造。網站公開銀行資訊在 `checkout-config.js`；兩處修改要同步。

## 3. 接上網站

將部署所得 `https://iad-shop-orders.你的帳號.workers.dev/orders` 填入 `checkout-config.js` 的 `orderApiUrl`。此網址不是密鑰，可以公開。不要把 MAIL_RELAY_SECRET、ADMIN_TOKEN 或 Email API Key 填入這個檔案。

本機測試 API 的付款回報與 Email 後再 push main。GitHub Pages workflow 只發布網站公開檔案，不包含 `server/`、訂單資料庫、Secret 或 Google 寄信程式。

不需要 GitHub Secret：API 使用你本機登入 Cloudflare 後部署，寄信密鑰使用 Cloudflare Worker Secrets。日後如要 CI 部署，另以 GitHub Secrets 保存 Cloudflare token，不提交到程式碼。

## 4. 第一次驗收（設定完成後才能進行）

1. 先測本機預覽，ADD → BAG → CONTACT → DELIVERY → PAYMENT → CONFIRM。
2. 填自己的聯絡資料、備註「系統測試，請勿出貨」。四種方式：銀行匯款、無卡存款、信用卡、LINE Pay。沒有貨到付款。
3. 確認單成立，Gmail 應收到 `[IAD SHOP 新訂單] IAD-YYYY-MMDD-088｜NT$...`。此第一筆測試會使用正式流水號 088，之後不倒退；若希望 088 留給真正客人，先在 Wrangler 本機 SQLite 環境做測試再正式部署。
4. 同一分頁快速連點、重試原單只保存一筆。換不同買家與日期，流水號 089、090 继续累加；日期以台灣實際建單時間計。
5. 付款回報填金額、時間；銀行匯款填末五碼，無卡存款填 ATM／分行與交易序號。**不必真的轉帳來測試**，備註寫測試。
6. Gmail 收到 `[IAD SHOP 付款回報] 相同訂單編號｜NT$...`。網站顯示等待人工確認，不是已付款。
7. 信用卡／LINE Pay 保留既有付款圖；沒有支付 API 或自動付款成功。買家務必核對金額，店家人工確認。
8. 測完從管理接口將測試單取消，保留紀錄。再測正式 GitHub Pages 網域和未登入 Google 的瀏覽器，確認買家不需 Google 授權。

目前買家 Email 關閉，請提醒买家保存訂單編號及原瀏覽器最近訂單入口。未來啟用買家信後，私人連結用 hash 帶訂單驗證碼，自動帶入編號／金額；不靠可猜的訂單編號取得權限。不要轉傳此私人連結。

## 5. 日常人工確認與寄信狀態

在 Gmail 搜尋完整訂單編號即可找到新訂單與回報。先到銀行／平台確認實際款項，再更新 PAID，不能只看付款回報。

伺服器提供受 ADMIN_TOKEN 保護的 `/admin` 接口，不提供公開訂單清單或大型管理後台。從終端機使用私密環境變數：

```powershell
# 先用終端機互動方式或密碼管理工具載入私密環境變數 IAD_ADMIN_TOKEN，勿儲存在公開檔案。
$iadHeaders = @{ Authorization = "Bearer $env:IAD_ADMIN_TOKEN" }
$iadBody = @{ action='adminStatus'; orderId='實際訂單編號'; paymentStatus='PAID' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'https://你的Worker網址/admin' -Headers $iadHeaders -ContentType 'application/json' -Body $iadBody
```

付款狀態：PENDING、PAYMENT_REPORTED、PAID、FAILED、REFUNDED。
訂單狀態：NEW、PREPARING、SHIPPED、COMPLETED、CANCELLED。相同接口的 orderStatus 欄位可更新出貨狀態。狀態更新不會付款、退款或叫物流。

查寄信佇列：以相同管理驗證呼叫 `{ "action": "adminEmails" }`，只回寄信識別碼、狀態、重試次數，不回客戶資料。
訂單保存後才由 alarm 寄信，寄信故障不會丟單。自動約每 10 分鐘重試，最多 8 次；超過上限標 FAILED，Cloudflare Logs 只記訂單／通知編號、不記客戶個資。若 FAILED，先到 Gmail 查是否已收到，處理服務／配額後人工補寄，不重新建單。

## 6. 商品資料更新與未來買家信

改商品後執行 `node scripts/export-order-catalog.mjs`，部署 Worker，再發布前端，確保商品版本一致。後端採自己的 catalog 重算價格、運費、選項，不接受買家自填總額。

未來有自己的寄件網域時，於 Resend Free 驗證網域，將 RESEND_API_KEY 設 Worker Secret、EMAIL_FROM 設後端設定；移除 Gmail relay 路徑後，將 BUYER_EMAIL_ENABLED 設 true。現階段不需要註冊 Resend、不買網域，也不要先啟用買家信。Gmail relay 固定拒絕其他收件人。

## 7. 本機驗證與限制

```powershell
node scripts/export-order-catalog.mjs
node --test --test-isolation=none scripts/catalog.test.mjs scripts/orders.test.mjs
```

測試使用記憶體 SQLite 與隔離寄信替身，不消耗正式流水號、不寄信、不保存真實個資。已涵蓋：跨日編號、重啟保存、並發去重、價格驗證、付款回報、Token 驗證、CORS／管理權限及寄信佇列。仍需完成實際 Cloudflare 部署及 Gmail 收件驗收。

CORS 和 IP 速率限制不是完整機器人防護，若出現濫用可再加入免費 Turnstile。無會員、庫存、ERP、物流或金流 API。不要把 SQLite 匯出、客戶 Email 或訂單備份提交到 GitHub；私有資料只留在 Cloudflare 與 Gmail。

官方文件：[Cloudflare 免費 SQLite](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Google 寄信配額](https://developers.google.com/apps-script/guides/services/quotas)、[Apps Script 部署](https://developers.google.com/apps-script/guides/web)。
