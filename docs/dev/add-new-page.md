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
  name: 'Your Tool Name',
  description: '工具中文描述',
  path: '/your-tool-name',
  available: true
}
```

### 4. 新增操作說明文件

在 `docs/guides/` 新增 `your-tool-name.md`，說明輸入格式、操作步驟、輸出格式。

## 目錄結構

```
src/
├── App.js                  # 路由設定
├── components/
│   └── Homepage.jsx        # 首頁工具卡片
└── pages/
    └── YourToolName.jsx    # 工具頁面元件
```
