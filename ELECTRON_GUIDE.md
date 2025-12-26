# Electron 打包指南

## 已完成的配置

✅ 创建了 `electron/main.js` 主进程文件
✅ 修改了 `vite.config.js`，设置 `base: './'`
✅ 修改了 `package.json`，添加了 Electron 相关配置和脚本
✅ 创建了 `.npmrc` 配置文件（使用淘宝镜像）
✅ 创建了 `build/` 目录用于存放图标

## 安装依赖

由于网络问题，Electron 之前安装失败。请尝试以下方法：

### 方法 1：使用代理（推荐）
如果您有代理，设置代理后安装：
```bash
npm install
```

### 方法 2：手动下载 Electron
1. 访问 https://npmmirror.com/mirrors/electron/
2. 下载对应版本的 ZIP 文件
3. 放到缓存目录：`%USERPROFILE\AppData\Local\electron\Cache`

### 方法 3：仅安装其他依赖
```bash
npm install --save-dev electron-builder concurrently wait-on cross-env electron-is-dev
```
然后单独安装 Electron（可能需要重试多次）：
```bash
npm install --save-dev electron
```

## 开发调试

安装完成后，运行以下命令启动开发模式：
```bash
npm run electron:dev
```

## 打包命令

### 打包为 NSIS 安装程序（.exe）
```bash
npm run electron:build
```
输出文件位于 `release/` 目录

### 打包为绿色版（无需安装）
```bash
npm run electron:build:portable
```

## 图标设置

1. 准备您的 logo 图片（PNG 格式，建议 512x512）
2. 使用在线工具转换为 ICO：https://www.icoconverter.com/
3. 将生成的 `icon.ico` 文件放到 `build/` 目录下
4. 重新运行打包命令

## 自定义配置

### 修改应用名称
编辑 `package.json` 中的 `productName`：
```json
"productName": "您的应用名称"
```

### 修改应用 ID
编辑 `package.json` 中的 `appId`：
```json
"appId": "com.yourcompany.lottery"
```

### 修改窗口大小
编辑 `electron/main.js` 中的 `BrowserWindow` 配置：
```javascript
mainWindow = new BrowserWindow({
  width: 1920,  // 修改窗口宽度
  height: 1080, // 修改窗口高度
  ...
});
```

## 分发说明

打包完成后，`release/` 目录会包含：

1. **抽奖系统 Setup 1.0.0.exe** - NSIS 安装程序
   - 双击安装
   - 会创建桌面快捷方式和开始菜单项

2. **抽奖系统 1.0.0.exe** - 绿色版
   - 无需安装，直接运行
   - 适合 U 盘分发

## 故障排查

### 打包后白屏
- 确保 `vite.config.js` 中设置了 `base: './'`
- 确保先运行 `npm run build` 生成了 `dist` 目录

### 图标未生效
- 确保 ICO 文件在 `build/` 目录下
- 确保文件名是 `icon.ico`
- 尝试清理缓存后重新打包

### 安装程序太大
- Electron 应用本身就有约 100-200MB
- 这是正常的，无法避免
