# IAD SHOP — 正式版第一階段

純 HTML / CSS / JavaScript 靜態網站，可部署至 GitHub Pages。正式素材保留在原始資料夾，reference/ 只供參考，不會發布。

## 預覽與商品更新

安裝 Node.js 後執行：

    node scripts/build-catalog.mjs
    node scripts/server.mjs

開啟 http://127.0.0.1:4173 。驗證資料：

    node --test --test-isolation=none scripts/catalog.test.mjs

商品生成器讀取 SUMMER商品、WINTER商品 的各商品資料夾內「商品資訊.txt」。第一行為名稱，讀取編號、顏色、尺寸、售價、官網價，保留尺寸區塊及試穿報告。缺少的描述、材質、版型不自行補寫。

新增商品放入同樣結構後重新生成 catalog.js。可在商品資料夾增加 product.json 指定 id、sort、featured、description、material、fit、shipping、coverImage、cutoutImage。排序以 sort 優先，預設採資料夾列出順序。coverImage、cutoutImage 填該商品資料夾內的圖片檔名。請用穩定 id，以免日後新增商品影響分享連結。

## 操作

首頁只有原始 SUMMER / WINTER 影片，兩區各佔一半。手機滿版；桌機中央手機框。影片 autoplay / muted / loop / playsinline / cover。

進入季節後一次一件商品，拖曳主圖、觸控左右滑、觸控板水平滑、鍵盤左右鍵、畫面小箭頭切換。顏色與尺寸依商品保留。INFO 以白色 modal 開啟，背景遮罩，X / Escape / 點擊外圍可關閉。點季節名稱開啟兩欄總覽並跳至商品。

ADD TO CART 及 BUY NOW 都需要顏色及尺寸；購物袋存放在瀏覽器 localStorage。BUY NOW 只呈現購買預覽，不付款、不建立訂單。未串接金流、會員、物流或庫存。商品圖片點擊目前也開 INFO；images 資料保留未來照片展開用途，避免與商品 swipe 衝突。

## GitHub Pages 部署

1. 建立 GitHub repository（建議 iad-shop），上傳本專案至 main 分支。不要上傳 reference/。
2. Repository → Settings → Pages → Source 選 GitHub Actions。
3. Actions 中執行 Deploy GitHub Pages（push main 也會自動執行）。
4. 成功後網址為 https://你的帳號.github.io/iad-shop/ 。部署 workflow 會重新生成商品、驗證資料並發布必要網站及素材。

GitHub 連接器已確認 IADSHOP 帳號授權，但可用 repository 清單為空，連接器沒有建立 repository 或設定 Pages 工具。瀏覽器進入建立 repository 頁面時要求登入；本機也沒有 GitHub CLI。因此已建立本地 Git 版本，尚未 push 或取得正式網址。只差在 GitHub 登入並建立 iad-shop repository、連結遠端推送及啟用 Pages。HTML、圖片、影片都使用相對路徑，hash 商品連結可直接重新整理。

SUMMER 原影片約 68 MB，完整保留指定素材。下一階段可另產出保留同內容的壓縮版本，改善行動網路首次載入，並確認商品主圖、排序及品牌購買流程。

## 主要檔案

index.html：首頁及介面容器
style.css：手機 / 桌機、季節氛圍、RWD
app.js：商品瀏覽、選項、資訊、總覽、購物袋
catalog.js：由正式素材生成的商品資料
scripts/build-catalog.mjs：商品資料生成
scripts/catalog.test.mjs：四商品欄位及路徑驗證
scripts/server.mjs：支援影片 range 的預覽伺服器
.github/workflows/pages.yml：GitHub Pages 自動部署
.nojekyll：靜態檔案發布

