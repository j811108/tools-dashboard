# 部署流程

## 部署目標

GitHub Pages：https://j811108.github.io/tools-dashboard

## 部署指令

```bash
npm run deploy
```

此指令會依序執行：
1. `npm run build`：產生 `build/` 靜態檔案
2. `gh-pages -d build`：推送至 `gh-pages` 分支

## 設定說明

`package.json` 中的設定：

```json
{
  "homepage": "https://j811108.github.io/tools-dashboard",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```

`src/App.js` 中 Router 的 basename 需對應 homepage 路徑：

```jsx
<Router basename="/tools-dashboard">
```

## 注意事項

- 部署前確認本地 `npm start` 正常運作
- `gh-pages` 套件需已安裝（`devDependencies` 中）
- 部署後約 1-2 分鐘生效
