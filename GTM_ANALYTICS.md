# GTM 與 Google Analytics 維護說明

本文件記錄 `econ115B` 網站目前的 Google Tag Manager（GTM）與 Google
Analytics 4（GA4）設定，供日後更新網站或擴充追蹤事件時使用。

## 目前設定

| 項目 | 設定值 |
| --- | --- |
| 網站 | `https://tpemartin.github.io/econ115B/` |
| GTM 容器 | `GTM-NT979B4` |
| GTM 帳戶 | `ntpuecon` |
| GTM 容器名稱 | `tpemartin.github.io` |
| GA4 資料串流 | `econ115B` |
| GA4 Measurement ID | `G-1B7QMCTMDR` |
| GA4 Stream ID | `15517021230` |
| GA4 Property ID | `382151769` |
| 首次正式發布版本 | Version 7 — `Add GA4 tracking for econ115B` |

## 架構概念

資料流程如下：

```text
使用者瀏覽 econ115B
        ↓
網頁載入 GTM-NT979B4
        ↓
GTM 檢查目前 Page Path
        ↓
若路徑以 /econ115B 開頭
        ↓
執行 GA4 Google tag（G-1B7QMCTMDR）
        ↓
資料送進 econ115B 的 GA4 資料串流
```

GTM 的主要元件：

- **Tag（標籤）**：決定要執行什麼，例如將瀏覽資料送到 GA4。
- **Trigger（觸發條件）**：決定 Tag 何時執行。
- **Variable（變數）**：提供 Trigger 判斷時所需的值，例如目前網址的
  `Page Path`。
- **Preview（預覽）**：在正式發布之前，用 Tag Assistant 測試哪些標籤有或
  沒有執行。

目前的 GA4 Tag 名稱為：

```text
GA4 - Google tag - econ115B
```

它使用下列 Trigger：

```text
Initialization - econ115B pages
Page Path starts with /econ115B
```

路徑限制很重要，因為 `GTM-NT979B4` 是共用於
`tpemartin.github.io` 的容器。如果改成 `All Pages`，其他專案的瀏覽資料也可能
被送進 econ115B 的 GA4 資料串流。

## 網站程式碼

GTM 安裝碼位於根目錄的 `index.html`：

- `<head>` 中的 GTM JavaScript snippet。
- `<body>` 開頭的 GTM `<noscript>` iframe。

一般更新 React 元件、CSS、學生資料或其他網頁內容時，不需要修改或重新發布
GTM。只要保留上述安裝碼與容器 ID，執行正式建置並部署即可：

```bash
npm run build
```

Vite 會將正式版本輸出至 `docs/`，再由 GitHub Pages 提供網站。

## GTM 變更與發布流程

只有在新增事件、修改 Tag、調整 Trigger 或更換 GA4 設定時，才需要更新 GTM。

1. 在 GTM 的 Default Workspace 建立或修改設定。
2. 按 **Preview** 開啟 Tag Assistant。
3. 使用測試網址 `https://tpemartin.github.io/econ115B/`；本機測試可使用
   `http://127.0.0.1:5173/econ115B/`。
4. 確認預期的 Tag 顯示在 **Tags Fired**。
5. 同時確認不應觸發的頁面沒有執行該 Tag。
6. 回到 GTM，按 **Submit**。
7. 選擇 **Publish and Create Version**，填寫可辨識的版本名稱與說明。
8. 發布後到 **Versions** 確認新版本顯示為 **Live, Latest**。

每次發布都應留下明確的版本說明，例如：

```text
Add card navigation analytics events
```

不要直接發布未經 Preview 驗證的變更。

## 驗證 GA4 是否收到資料

GTM 的 Tag 成功觸發，代表瀏覽器已執行送出資料的標籤；GA4 是否收到資料仍應
另外確認。

1. 開啟 GA4 對應的 Property。
2. 前往 **Reports → Realtime**，或在 Admin 使用 **DebugView**。
3. 以新的瀏覽器工作階段開啟網站並操作。
4. 確認出現 `page_view` 等預期事件。

Realtime 通常較快出現資料；一般報表可能需要較長的處理時間。瀏覽器的廣告
阻擋器、追蹤保護或同意設定也可能使事件沒有送出。

## 自訂互動事件的建議

React 已將卡片互動事件送進 GTM 的 `dataLayer`，但尚需在 GTM 建立對應的
Custom Event Trigger 與 GA4 Event Tag，事件才會傳到 GA4。例如：

```js
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: 'student_card_view',
  card_id: 'card_004',
  navigation_method: 'next_button',
});
```

建議的事件名稱：

- `student_card_view`：顯示一張具自我介紹的卡片，包含 `card_id` 與
  `navigation_method`。
- `student_card_view_end`：卡片停止顯示，包含 `card_id` 與
  `view_duration_ms`。

`navigation_method` 可能是 `initial_load`、`search`、`swipe`、`keyboard`、
`previous_button`、`next_button` 或 `first_button`。

`card_id` 依學生在來源 JSON 中的固定順序產生，例如第一位為 `card_001`。
因此不可任意重新排序 `students.json`；新增學生應附加於名單末端。老師用的
姓名對照表位於 `private/card-name-map.csv`，整個 `private/` 目錄已被 Git
忽略，不會推送到 GitHub。

由於姓名與卡片同時顯示在使用者瀏覽器中，熟悉網站程式的人仍可能推知代碼與
姓名的關係。這個設計是減少第三方分析平台收到的直接身分資料，屬於假名化，
不是完全匿名化。

目前 GTM Default Workspace 中的相關草稿項目為：

- Variables：`DLV - card_id`、`DLV - navigation_method`、
  `DLV - view_duration_ms`。
- Triggers：`Event - student_card_view`、
  `Event - student_card_view_end`。
- Tags：`GA4 - student_card_view`、`GA4 - student_card_view_end`。

這些項目必須先通過 Preview 驗證，才可發布。

事件名稱與參數應使用固定、簡短的英文 `snake_case`。避免因每次操作重複送出
不必要的事件，也應先在 GTM Preview 與 GA4 DebugView 驗證。

## 隱私原則

這個網站含有學生姓名與自我介紹，分析資料必須採取資料最小化原則：

- 不要將學生姓名、學號、Email、電話或自我介紹文字送到 GA4。
- 不要把上述資料放入事件名稱、事件參數、頁面網址或 query string。
- 若需區分卡片，只使用不具直接識別性的畫面順序，例如 `card_index`。
- 不應用 GA4 建立個別學生的瀏覽或互動紀錄。
- 新增追蹤前，應確認符合學校規範、適用的隱私要求與告知／同意需求。

GA4 Enhanced Measurement 主要記錄頁面與一般互動，但擴充設定前仍應檢查是否
可能收集不必要的資訊。

## 維護檢查清單

更新網站後：

- [ ] `index.html` 仍包含 `GTM-NT979B4` 的 `<script>` 與 `<noscript>`。
- [ ] 正式網址仍以 `/econ115B` 開頭。
- [ ] `npm run build` 成功，且輸出至 `docs/`。
- [ ] 正式網站可正常載入。
- [ ] 若有修改追蹤，已使用 GTM Preview 驗證。
- [ ] GA4 事件不含學生個人資料或自我介紹內容。
- [ ] `private/card-name-map.csv` 沒有被 Git 追蹤或上傳。
- [ ] GTM 新版本具有清楚的名稱與變更說明。

## 重要連結

- [Google Tag Manager](https://tagmanager.google.com/)
- [Google Analytics](https://analytics.google.com/)
- [Tag Assistant](https://tagassistant.google.com/)
- [正式網站](https://tpemartin.github.io/econ115B/)
