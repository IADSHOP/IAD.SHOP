# IAD SHOP 第一版訂單系統：設定與操作

這次接在現有網站後面：商品 → OPTION → BAG → 四步 CHECKOUT → 訂單 → 付款回報。首頁、商品瀏覽、季節、INFO 與原本視覺保留。

目前程式已備妥，但尚未替你建立 Google Sheet 或部署 Apps Script。`checkout-config.js` 的 `appsScriptUrl` 故意留白；設定前可操作購物袋與表單，但最後「確認訂單」停用，不會假裝存單成功。下面完成後才能正式收單。

## 1. 建立試算表

1. 用要管理訂單的 Google 帳號開啟 [Google Sheets](https://sheets.google.com)。
2. 新增「空白試算表」，左上角名稱改成 **IAD SHOP ORDERS**。
3. 不用公開分享，維持「限制存取」。只有你與實際處理訂單的人需要試算表權限。
4. 先不用自己逐欄打標題。第 3 節執行初始化後，程式會自動新增名為 **IAD SHOP ORDERS** 的工作表、建立第一列與狀態下拉選單。
5. 若想先手動貼標題，開啟專案的 `apps-script/headers.tsv`，全選複製，再貼到該工作表的 A1。分隔符號是 Tab，會分成 30 欄。順序不可改，也不要只貼舊版的 23 欄。

第一列完整欄位（依序）：

```text
orderId, createdAt, customerName, customerPhone, customerEmail, deliveryMethod, receiverName, receiverPhone, storeType, storeName, storeCode, postalCode, address, paymentMethod, paymentStatus, subtotal, shippingFee, total, orderStatus, itemsJson, buyerNote, paymentReportedAt, paymentReference, paymentTime, paymentNote, requestId, requestHash, accessTokenHash, reportRequestId, emailStatus
```

後面幾欄是重試防重複與驗證資料，請保留，不要手動改。可以隱藏不常用的欄位。不要公開試算表連結，也不要把真實訂單匯出後提交到 GitHub。

## 2. 從試算表開啟 Apps Script，貼入四個檔案

1. 在剛剛的 Google Sheet 選上方 **擴充功能 → Apps Script**。
2. 專案名稱改成 **IAD SHOP ORDERS**。
3. 編輯器通常已有 `Code.gs`（有些介面顯示「程式碼.gs」）。刪除裡面的預設內容，貼入本專案 `apps-script/Code.gs` 的**全部內容**。
4. 左側「檔案」旁按 **＋ → 指令碼**，名稱輸入 `Config`，貼入 `apps-script/Config.gs` 的全部內容。
5. 同樣新增 `Core`，貼入 `apps-script/Core.gs`。
6. 同樣新增 `Catalog`，貼入 `apps-script/Catalog.gs`。
7. 檢查最後共有這四份指令碼，不要把同一段重複貼兩次。`headers.tsv` 與網站 JavaScript 不需要另外貼入 Apps Script。
8. 按儲存。請使用目前預設的 V8 執行階段。

| 本機來源 | Apps Script 檔案 | 用途 |
| --- | --- | --- |
| apps-script/Code.gs | Code.gs | 建單、編號、寫表、付款回報、選用寄信 |
| apps-script/Config.gs | Config.gs | 工作表名稱、允許的網站網址、寄信開關 |
| apps-script/Core.gs | Core.gs | 商品、選項、數量、配送、金額驗證 |
| apps-script/Catalog.gs | Catalog.gs | 從網站商品資料產生的可信售價清單 |

`Config.gs` 目前允許 `https://iadshop.github.io`、`http://127.0.0.1:4173`、`http://localhost:4173`。GitHub 專案路徑 `/IAD.SHOP/` 不要寫在 allowedOrigins 裡；這裡只填協定＋網域＋必要連接埠。若改成自己的網域，再把正式網域加入。`storefrontUrl` 則是完整網站網址，供 Email 使用。

## 3. 初始化工作表

1. 編輯器上方的函式下拉選單，選 **setupOrders_**（最後有底線）。
2. 按 **執行**。不要執行 `doPost`，它需要由網站帶入訂單。
3. 第一次 Google 會要求授權。確認這就是你剛建立、貼入自己程式的專案，再以管理訂單的帳號授權。如果帳號管理政策禁止部署，需由帳號管理員開放或使用可部署的帳號。
4. 執行成功後回到 Google Sheet，應看到 **IAD SHOP ORDERS** 分頁及第一列 30 個欄位。付款與訂單狀態欄應有下拉選單。
5. 這一步也會把這張表的 ID 存在 Apps Script 的 Script Properties；不必貼到公開網站。

請勿更改這個分頁名稱、第一列欄名或中間插入欄位。初始化可以重跑，已有訂單不會被清空；欄位不吻合時會停止並報錯。

## 4. 部署成 Web App

1. Apps Script 右上角 **部署 → 新增部署作業**。
2. 類型選擇旁的齒輪，選 **網頁應用程式 / Web app**。
3. 說明可填 `IAD SHOP orders v1`。
4. **執行身分 / Execute as：我 / Me**，也就是擁有試算表的帳號。
5. **誰可以存取 / Who has access：所有人 / Anyone**。要讓沒有登入 Google 的買家也能送單，不能選只有自己或只有已登入 Google 的使用者。
6. 按部署，完成要求的授權。
7. 複製 **網頁應用程式網址 / Web app URL**。它應以 `https://script.google.com/macros/s/` 開頭、以 **`/exec`** 結尾。不要使用 `/dev` 測試網址，也不要貼 Script 編輯器網址或試算表網址。
8. 在瀏覽器開啟這個 `/exec` 網址，應看到簡單文字，內有 `service: IAD SHOP ORDERS`、`ready: true` 與 `catalogVersion`。`ready: true` 表示已記住工作表 ID；真正寫表仍要用下一節的測試確認。

Web App 對外接受訂單，不等於公開 Google Sheet。程式只提供建單、持有訂單驗證碼者的狀態查詢與付款回報，不提供全部訂單清單。

## 5. 把 Web App URL 接到網站

開啟網站根目錄 `checkout-config.js`，找到：

```js
appsScriptUrl: '',
```

把完整 `/exec` 網址貼在引號中，例如：

```js
appsScriptUrl: 'https://script.google.com/macros/s/你的部署ID/exec',
```

儲存後重新整理本機網站。銀行資料與兩張付款圖的相對路徑也在同一個設定檔。這個 URL 本來就會公開，不是密鑰；不要另塞任何 API secret、Google 帳密或私人金鑰。

## 6. 實際測一筆訂單

1. 先在本機預覽 `http://127.0.0.1:4173/`，選一件商品、選顏色與尺寸、按 ADD。應留在商品頁且 BAG 數字增加。立即購買則應直接開 BAG。
2. 開 BAG，測試 `+`、`−`、刪除。數量減到 0 會移除；空袋不能結帳。
3. 切換店到店／宅配，金額立即變更。店到店小計 <599 加 70，≥599 免運；宅配小計 <1499 加 150，≥1499 免運。
4. 前往結帳。CONTACT 填自己的可接收 Email、手機與姓名。DELIVERY 填自己的資料；超商門市手動填，不會查詢門市是否存在。
5. PAYMENT 先選銀行匯款。CONFIRM 檢查商品、配送、運費、總額，備註填「系統測試，請勿出貨」。這時才按「確認訂單」。**不需要真的匯款來測試存單。**
6. 成功後應顯示 THANK YOU、`IAD-YYYYMMDD-001` 類型編號與等待付款。回 Google Sheet，確認新增一列，金額相符，`paymentStatus=PENDING`、`orderStatus=NEW`。
7. 測試付款回報時填測試後五碼、備註註明測試；送出後同一列變成 `PAYMENT_REPORTED`，並有回報時間、後五碼。這只是流程測試，不代表真的收到錢。
8. 在 Google Sheet 手動將測試列 `paymentStatus` 改 `PAID`，回網站按「更新訂單狀態」，應顯示已確認收款且不再提供付款回報。測試完把此筆 `orderStatus` 改 `CANCELLED` 並保留測試備註。
9. 另外測 LINE PAY、信用卡的圖片顯示與付款回報（付款時間或備註至少一項），不用為了測網站真的付款。
10. 用手機與桌機，以及未登入 Google 的瀏覽器各測一次。Google 授權頁、隱私外掛或錯誤部署權限可能阻止跨站回覆，務必確認正式網域也可完整送單。
11. 如果送單逾時，使用「重試原訂單」。同一筆請求會回傳已保存的原訂單，不會再新增一筆。結果還不明確時，不要清除瀏覽器資料或另開一筆重下；先到 Sheet 查驗。

買家最近一筆成功訂單的回報入口存在原瀏覽器 BAG → 最近訂單。這版沒有會員或跨裝置訂單搜尋；清掉瀏覽器資料、換裝置、或下一筆訂單取代最近一筆後，需提供訂單編號給店家人工協助。暫存中的送單識別在同一分頁保留，關掉分頁可能遺失，所以未確認結果前請先重試。

## 7. 你每天怎麼處理

- 打開 Sheet 查看新訂單；`itemsJson` 是可解析的商品陣列，每件包含編號、名稱、顏色、尺寸、數量、單價、小計、圖片與季節。
- 看到 `PAYMENT_REPORTED` 後，去自己的銀行／收款平台人工確認金額與付款資訊。確認收到才把 `paymentStatus` 改成 `PAID`。
- 備貨時 `orderStatus=PREPARING`，寄出改 `SHIPPED`，結案改 `COMPLETED`，取消改 `CANCELLED`。
- `FAILED`、`REFUNDED` 也由你人工管理。這些狀態只記錄處理進度，改成 REFUNDED 不會真的退錢，改成 SHIPPED 不會呼叫物流。
- 不要更動訂單編號、金額、驗證欄或刪除處理中的訂單。用篩選檢視查找較合適，避免送單中搬動資料列。

## 8. Email（選用，預設關閉）

在 Apps Script 的 `Config.gs` 把 `sendEmail: false` 改成 `true`。如需店家通知，把 `adminEmail: ''` 填上自己的 Email；留白就只寄給買家。重新部署新版本，必要時完成 MailApp 授權。

信件包含訂單編號、商品、配送與付款方式、小計、運費、總額、付款狀態；銀行匯款附帳戶，其他方式提示回網站查看付款圖。`emailStatus` 顯示 `DISABLED`、`QUEUED`、`SENT` 或 `FAILED`。寄信失敗仍保留訂單，不會要求買家重下；這版沒有自動重寄。Google 帳號寄信配額及垃圾信過濾仍可能影響收件，Sheet 才是訂單依據。

## 9. 之後上架、改價，必須同步後端

在專案資料夾執行：

```powershell
npm run build
npm test
```

這台電腦目前可直接使用 Node，但找不到 npm 指令，可改執行同樣的腳本：

    node scripts/build-catalog.mjs
    node scripts/export-order-catalog.mjs
    node --test scripts/catalog.test.mjs scripts/orders.test.mjs

build 先從現有商品資料夾生成 `catalog.js`，再生成 `apps-script/Catalog.gs`、`apps-script/Core.gs` 與網站的 `order-catalog-version.js`。不要手改生成檔當作長期資料來源。

1. 把重新生成的 `Catalog.gs` 複製到 Apps Script 對應檔案；若驗證規則改了，也同步 `Core.gs`（後端程式有改則一起更新）。
2. Apps Script **部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署**。用同一部署更新，通常可保留既有 `/exec` URL。只按儲存不會更新已部署版本。
3. 發布對應網站檔案。這個 repository 的 main push 會觸發既有 GitHub Pages Actions；本次尚未代你 push。
4. 在正式網址實測一筆。前後端商品版本不一致時會擋住新單，避免用錯價格。即使有人從 DevTools 修改單價或總額，後端仍依自己的 catalog 重算，不接受自填金額。

編號按台灣日期 `IAD-YYYYMMDD-XXX` 產生，使用 Apps Script lock 與每日序號，並檢查表內既有最大值。999 之後自然延伸為 1000。失敗可留下跳號，但不會故意重用舊號碼。

## 10. 檔案位置與完成範圍

修改：`app.js`（BAG 接口）、`index.html`（載入模組）、`package.json`（build/test）、`.github/workflows/pages.yml`（發布新增前端資源）、`README.md`。

新增：`commerce.js` / `commerce.css`（BAG、四步表單、訂單、回報）、`order-core.js`（共用驗證與計價）、`order-api.js`（Google 回覆通訊）、`checkout-config.js`（公開設定）、`order-catalog-version.js`（商品版本）、`scripts/export-order-catalog.mjs`、`scripts/orders.test.mjs`、本說明，以及 `apps-script/` 內四份程式與 `headers.tsv`。

原圖完整複製，沒有重畫 QR：

- LINE PAY：`assets/payment/line-pay.jpg`，來源 `S__113106950_0.jpg`。
- 信用卡：`assets/payment/credit-card.jpg`，來源 `S__113106952_0.jpg`。
- 網站銀行資料：`checkout-config.js`；Email 使用的相同銀行資料：`apps-script/Config.gs`。日後若換帳號請兩處同步。

真正已實作：購物袋持久保存、數量／移除、運費、四步驗證、三種付款資訊、摘要、送單通訊、Apps Script 重算與寫表、唯一編號、付款回報、狀態查詢、防重複重試、選用 Email。

沒有假的成功訂單或示範付款成功。尚未設定 Google 時，雲端存單與回報不可使用；自動化測試使用隔離的模擬 Google 服務，不能代表你的 Google 帳號已部署成功。需要依第 6 節完成實際端到端驗收。

付款是人工收款與對帳：QR 不會自動帶訂單金額、不會自動知道付款成功；請買家核對金額並回報。沒有金流 API、會員、庫存、物流 API、發票、折扣碼，也沒有自動退款。這符合此版本範圍。

跨站通訊使用表單 POST＋Google HTML 回覆，不使用無法讀回成功狀態的 opaque `no-cors` 請求。回覆檢查 Google origin 與隨機關聯碼。付款回報另需該訂單的隨機驗證 token；Google Sheet 只存雜湊，不靠可猜的訂單編號授權。沒有在前端藏假 secret。公開建單端點有基本送單頻率限制，但不是完整防機器人服務。

## 11. 常見問題

| 現象 | 處理 |
| --- | --- |
| 最後的確認按鈕不能按 | `checkout-config.js` 尚未填合法 `/exec` URL；儲存並重新整理。 |
| 網址要求買家登入 | Web App access 應選 Anyone，並確認部署身分是 Me。 |
| ready 為 false | 從綁定 Sheet 的 Apps Script 執行 `setupOrders_`，再檢查。 |
| 送單逾時或無法回覆 | 檢查部署授權、allowedOrigins、Google 執行紀錄與 Sheet 是否已存單；沿用原訂單重試。 |
| 商品資料已更新 | 同步前後端 catalog 並部署新版本，再刷新網站。不要任意更改版本字串繞過檢查。 |
| Sheet 欄位錯誤 | 對照 headers.tsv 恢復正確欄名及順序；先備份已有訂單。 |
| 付款回報無法驗證 | 使用原下單瀏覽器的最近訂單入口；驗證資料遺失時由店家人工處理。 |
| 沒收到 Email | 檢查 sendEmail、授權、emailStatus、Google 配額及垃圾信；不影響已存的訂單。 |

官方參考：[Web App 部署](https://developers.google.com/apps-script/guides/web)、[HTML iframe 限制](https://developers.google.com/apps-script/guides/html/restrictions)、[LockService](https://developers.google.com/apps-script/reference/lock/lock-service)。
