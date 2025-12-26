# 图标文件说明

请将您的应用图标文件放在此目录下：

## Windows 图标
- 文件名：`icon.ico`
- 尺寸：建议 256x256 或更高
- 格式：ICO 格式

## 如何创建 ICO 文件？

1. **在线工具**：
   - 访问 https://www.icoconverter.com/
   - 上传 PNG/JPG 图片
   - 下载生成的 ICO 文件

2. **使用命令行工具**（如已安装 ImageMagick）：
   ```bash
   magick convert your-logo.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
   ```

## 注意事项
- 图标文件必须命名为 `icon.ico`
- 如果没有提供图标，Electron 会使用默认图标
