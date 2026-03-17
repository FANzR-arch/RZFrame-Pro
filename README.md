# 画外 (RZFrame) - 极简摄影边框工具

> **专业级 EXIF 边框生成方案**  
> **Status**: `v2.7.3 Stable` | **Stack**: `Electron` + `Vanilla JS`

---

## 📸 项目愿景
**画外 (RZFrame)** 是一款为摄影师量身定制的桌面工具，旨在为作品提供极致纯净、信息丰富的 EXIF 边框。我们坚持 **“纯本地、零上传”**，确保您的原片数据与隐私安全。

---

## ✨ 核心特性

- 🛡️ **数据隐私**：所有照片处理、EXIF 读取均在本地完成，无网络上传。
- 🔍 **专业级解析**：基于 `exiftool`，深度支持光圈、快门、ISO、焦距、镜头型号。
- 🎨 **高度定制化**：
  - 支持 **Leica/Fujifilm/Hasselblad** 等品牌 Logo 智能识别。
  - 支持自定义字体、背景色、边框宽度及圆角设置。
  - 提供 **Classic (经典)** / **Cinema (宽银幕)** / **Float (漂浮)** 多套模版。
- 🚀 **批处理导出**：支持多张照片一键拖拽，高效并发导出。
- 🖼️ **智能 Logo**：自动匹配品牌 Logo，支持黑白切换及用户自定义 Logo 库。

---

## 📥 快速开始 (Photographers)

### 1. 下载安装
前往 [GitHub Releases](https://github.com/FANzR-arch/RZFrame-Pro/releases) 下载最新版本的 Windows `.exe` 安装包。

### 2. 使用步骤
1. **拖拽**：将您的照片（JPG/PNG）直接拖入窗口。
2. **选择**：在右侧面板选择心仪的预设模版。
3. **导出**：点击“导出”，照片将保存至原文件夹下的 `RZFrame_Output`。

---

## 🛠️ 开发者指南 (Developers)

### 环境依赖
- **Node.js**: v18.0 或更高版本
- **ExifTool**: 已内置于 `vendor` 目录，无需额外安装

### 开发流程
```bash
# 安装依赖
npm install

# 进入开发模式 (带热更新)
npm run dev

# 构建生产包 (生成安装程序)
npm run dist
```

### 技术架构
- **Main**: `main.js` - 处理本地 I/O、内核进程与窗口生命周期。
- **Renderer**: `renderer.js` - 基于原生 Canvas 的渲染引擎，极致轻量。
- **Bridge**: `preload.js` - 安全的 IPC 通信层。

---

## 📖 知识库与文档

- 📚 [**RAG PM 知识库**](./docs/rag_pm_kb_rzframe/README.md)：关于项目治理与产品逻辑的深度文档。
- 🏗️ [**PRD 文档**](./docs/PRD.md)：核心功能设计草案。
- 📝 [**更新日志**](./CHANGELOG.md)：详细的版本演进记录。

---

## ⚖️ 协议与声明
- **核心原则 (Antigravity Rules)**：局部修改必更新文档，保持系统一致性。
- **License**: MIT
