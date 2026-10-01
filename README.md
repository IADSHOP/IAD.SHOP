# IAD SHOP — Interactive Lookbook

正式網站：https://iadshop.github.io/IAD.SHOP/
Repository：https://github.com/IADSHOP/IAD.SHOP

此版本在既有第一階段專案上簡化商品體驗，保留原有 SUMMER / WINTER 入口、字體、細線、動畫與 PC 中央手機架構。

## 五個核心狀態

- SEASON GATE：兩支影片上下各佔一半，首頁只顯示 SUMMER / WINTER。
- PRODUCT VIEWER：一次一件商品；只常駐主視覺、INFO、小箭頭、優惠價格、ADD 與立即購買。
- SEASON GRID：頂部季節按鈕開啟同季節兩欄商品牆，顯示 cover、名稱、優惠價，可上下捲動。
- INFO OVERLAY：手機範圍內黑霧 / blur / 白字，沒有白色卡片或方框。資料過長時只有浮層內部捲動。
- BAG：同一手機範圍的浮層，顯示商品、顏色、尺寸、單價、數量、移除、TOTAL 與 CHECKOUT。

## 首頁影片載入

原始 SUMMER(上方).mp4 與 WINTE(下方).mp4 完整保留。播放檔改用相同原始影片產生的 720px / H.264 / 24fps / faststart 網頁版本，不更換畫面内容，移除無需播放的音軌：summer-web.mp4 約 0.77 MB，winter-web.mp4 約 0.55 MB。

兩支影片均有 autoplay、muted、loop、playsinline、preload=auto、cover。開啟時整個入口隱藏且不能點擊，只顯示 LOADING。Promise.all 等待兩支都到 canplay（readyState >= 3），重設播放時間後同一批開始播放，再讓整個 gate 一次淡入。

每支最多等待 9 秒；播放啟動另有 1.5 秒上限。任何一支失敗、逾時或 autoplay 被阻擋，兩支一起停止、一起使用由原影片擷取的 poster，不會讓一半播放、一半空白，也不會事後讓其中一半突然冒出影片。仍可直接點入商品。

## 商品與照片操作

首頁季節入口直接進入該季第一件商品，不先進 grid。

圖片區：水平手指 swipe / 滑鼠 drag / 觸控板橫滑換商品；垂直操作換同商品照片。方向必須超過另一軸的 1.35 倍才鎖定，鎖定後只有一軸作用，避免斜滑同時切換。鍵盤左右鍵換商品，上下鍵換照片；小箭頭也可換商品。第一件僅顯示下一件箭頭，最後一件只顯示上一件；商品不循環，照片循環。

每個商品的照片位置、顏色、尺寸在本次頁面工作階段中記憶。INFO 開關不重建商品畫面；grid 點商品直接返回 viewer 指定位置；頂部 HOME icon 在 viewer 與 grid 都直接回 SEASON GATE。重新整理會重置照片與選項；購物袋透過 localStorage 保留。

## INFO 與購買

原本常駐的商品名稱、原價、COLOR / SIZE 表格與大塊選項全部移入 INFO。僅顯示正式來源已有資料，不補寫缺少的材質、描述或出貨資訊。

INFO 裡可以選色與尺寸。若直接按 ADD 或立即購買而尚未選齊，開啟同款黑霧選項浮層，確認選項後才加入袋子。立即購買選完必要選項後直接開啟 BAG；CHECKOUT 沒有金流、付款或正式訂單。

BAG 支援 +/- 數量、REMOVE、TOTAL，保存至該瀏覽器。舊版數字價格的購物袋可相容讀入。

## PC / MOBILE

手機佔滿 viewport，無手機外框與外圍裝飾，使用 100dvh / 100svh 與 safe-area；正常商品畫面不能上下捲動。桌機（寬度 > 760px）僅中央手機框，外圍維持抽象季節背景，所有浮層也限制在手機內。

## 商品資料更新

    node scripts/build-catalog.mjs
    node --test --test-isolation=none scripts/catalog.test.mjs
    node scripts/server.mjs

預覽：http://127.0.0.1:4173/

商品來源仍為 SUMMER商品 / WINTER商品 的各子資料夾：商品資訊.txt 與圖片。讀取名稱、編號、價格、官網價、顏色、尺寸、尺寸表及試穿報告。尺寸資訊提供 sizeGuide / sizeInfo 相容欄位；試穿提供 fitReport / tryOn。

可選 product.json 支援 id、name、sort、featured、description、material、fit、delivery、coverImage、cutoutImage、images 等欄位。coverImage / cutoutImage / images 都填該商品資料夾內的檔名，生成器轉成相對網址，優先 cutout 作为 viewer 第一張，cover 作为 grid 圖片。sort 優先排序，沒有時依資料夾列出順序；同排序時 featured 優先。沒有推薦演算法。

建議新增商品時固定 id 與 sort，讓分享網址與策展排序穩定。新增資料夾、素材後重新生成 catalog.js，即可擴充到 30–50 件以上。

## 部署

Pages Source 已設定 GitHub Actions，push main 後 .github/workflows/pages.yml 會生成資料、驗證並部署。所有網站資源均為相對路徑；不發布 reference/ 或 .tools/。素材生成結果已提交，CI 不需要影片處理套件。

若需要重產影片，scripts/prepare-video.py 使用 imageio-ffmpeg；本地套件位於忽略的 .tools/python-packages，原片不被覆寫。

## 此輪修改檔案

index.html、style.css、app.js、catalog.js、scripts/build-catalog.mjs、scripts/catalog.test.mjs、README.md。
新增 scripts/prepare-video.py 與 首頁影片/ 下 summer-web.mp4、winter-web.mp4、summer-poster.jpg、winter-poster.jpg。

驗證涵蓋四件正式商品資料 / 路徑，策展排序與 metadata 欄位；瀏覽器驗證正常雙影片播放、單影片失敗的雙 poster fallback、商品與照片拖曳、INFO 保留選項、grid 跳轉、BAG 與手機 / 桌機版型。沒有實作付款、會員、正式庫存、物流或後台。


## 商品牆 / Viewer 精修

HOME 以細線 house icon 呈現，一律回真正首頁。Grid 中季節名稱是純文字標題；viewer 中季節名称維持進 grid 的按鈕。每張 grid cover 都在固定 3:4 容器，以 contain 置中避免裁到商品；優先 coverImage，沒有時採 images 第一張。名稱最多兩行截斷（完整名稱保留可存取標籤），價格改為更小更淡的 9px。

Viewer 一般圖水平內距由 30px 改為 18px，390px 畫面可用寬度由 330px 增至 354px（約 +7%）；去背圖內距改為 8px，可用寬度 374px（約 +13%）。所有圖片讀取 naturalWidth / naturalHeight，自動保持 contain；只有原圖與容器比例幾乎一致時採 cover，避免硬裁或變形。原始圖片內容有留白時不自行偽造去背。

商品箭頭在左右中間，第一件僅右箭頭、最後一件僅左箭頭。完成水平拖曳或觸控板水平 swipe 後，透明度由 .48 降至 .2，並在本次工作階段持續保留。上下照片提示在左側中下，可直接點擊小 ↑ / ↓，垂直 swipe 後也降低透明度。圖片索引 01 / XX 位於主視覺底部附近並隨照片更新；單張商品不顯示垂直提示或索引。

ⓘ INFO 移到主畫面右下側，距右側 12%，位於畫面約 70%–75% 高度，小手機稍上移，保持與底部購買操作區的間距。INFO 本身沿用原有黑霧、blur、白字與狀態保留。

OPTION OVERLAY 與 INFO 分開內容但沿用同一種霧黑視覺：SELECT OPTION / SELECT SIZE，仅呈現需要挑選的多選項，沒有額外尺寸表。顏色與尺寸由商品資訊.txt 或 product.json 生成；支援 S / M / L、全形斜線、換行、ONE SIZE、NONE。ONE SIZE 保留為一個完整值；NONE / 空值生成空陣列。單一尺寸（包含 F）或顏色自動選定，多個值且尚未選定才開浮層。ADD 確認後關閉浮層並留在商品；立即購買則加入後直接開 BAG。

本輪變更：index.html、style.css、app.js、catalog.js、scripts/build-catalog.mjs、scripts/catalog.test.mjs、README.md。首頁影片、loading 與 PC 中央手機架構不變。
