# 新增工具頁面指南

## 步驟

### 1. 建立頁面元件

在 `src/pages/` 新增 `YourToolName.jsx`：

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const YourToolName = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />返回工具首頁
            </button>
            <h1 className="text-xl font-semibold text-gray-900">工具名稱</h1>
            <div></div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 工具內容 */}
      </div>
    </div>
  );
};

export default YourToolName;
```

### 2. 在 App.js 新增路由

開啟 `src/App.js`，加入 import 與 Route：

```jsx
import YourToolName from './pages/YourToolName';

// 在 Routes 內新增：
<Route path="/your-tool-name" element={<YourToolName />} />
```

### 3. 在首頁新增工具卡片

開啟 `src/components/Homepage.jsx`，在 `tools` 陣列新增：

```js
{
  id: 'your-tool-name',
  name: '工具中文名稱',      // 卡片主標題
  description: 'Your Tool Name', // 卡片副標題，現況放英文代號
  path: '/your-tool-name',
  available: true,           // false 會顯示為停用（例如 Tester）
  icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {/* 自行放 path */}
    </svg>
  )
}
```

### 4. 新增操作說明文件

在 `docs/guides/` 新增 `your-tool-name.md`，說明輸入格式、操作步驟、輸出格式，並在根目錄 `README.md` 的工具列表加一列連過去。

## 撰寫慣例

- **CSV／訂單相關邏輯先看 `src/utils/orderUtils.js`**：解析、依母單分組、通路分類都已抽出，不要在頁面內重寫。
- **同一規則出現在多處要抽成函式**：欄位對應／計算邏輯常同時用在「畫面預覽」與「匯出 Excel」，兩邊必須呼叫同一個函式，避免預覽與輸出不一致（例：`ExcelMergeTool.jsx` 的 `getItemNumber`、`OUTPUT_COLUMNS`）。
- **樣式一律 Tailwind utility class**，不新增 CSS 檔。
- **Excel 欄位用索引存取**（如 `row[0]` 是商品代號），改欄位對應時同步更新註解說明是哪一欄。

## 目錄結構

```
src/
├── App.js                  # 路由設定
├── components/
│   └── Homepage.jsx        # 首頁工具卡片
├── pages/
│   └── YourToolName.jsx    # 工具頁面元件
└── utils/
    └── orderUtils.js       # 共用解析／分類邏輯
```
