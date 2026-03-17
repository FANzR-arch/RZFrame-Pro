# 画外 (RZFrame) - 极简摄影边框工具

> **版本 Status**: 2.7.3 (Stable / Governance Complete)
> **架构**: Electron + Vanilla JS (Native DOM)

## 0. 核心原则 (Antigravity Rules)
1. **分形文档**: 修改代码前必读/更新 `.folder.md`。
2. **三段式交付**: MVP -> 理解 -> 决策。
3. **安全优先**: 涉及文件系统操作需谨慎。

---

## 1. 下载与使用 (For Photographers)
**无需懂代码，开箱即用。**

RZFrame 专为追求极致画质的摄影师设计，所有照片处理均在**本地电脑**完成，确保您的原片绝对安全。

### 📥 获取软件
请访问 [Releases 页面](https://github.com/FANzR-arch/RZFrame-Pro/releases) 下载最新版本的安装包：
- **Windows**: 下载 `.exe` 安装包
- **macOS**: 下载 `.dmg` 安装包 (暂未发布)

### 🚀 首次使用
1. 安装并运行 RZFrame。
2. 将照片直接**拖拽**到窗口中。
3. 选择右侧预设的 "Leica 经典" 或 "Fujifilm 胶片" 模版。
4. 点击 "导出" 即可生成带EXIF参数的展示图。

---

## 2. 项目简介 (Project Overview)
**画外 (RZFrame)** 是一款基于 Electron 的专业 EXIF 边框生成工具。

### 核心特性
- **纯本地化**: 0上传，保护隐私。
- **专业级 Exif 解析**: 基于 `exiftool-vendored`，支持光圈、快门、ISO、镜头型号等。
- **高度定制**: 支持自定义字体、边线粗细、Logo、圆角。
- **智能 Logo 识别**: 自动匹配相机品牌 Logo，支持手动切换 (Black/White) 与自定义上传。
- **批量并发**: 支持多图拖拽与队列导出。

---

## 3. 开发者指南 (For Developers)
如果您希望贡献代码或进行二次开发，请参考以下步骤。

### 环境要求
- Node.js (v18+)
- NPM / Yarn

### 开发流程
```bash
# 1. 安装依赖
npm install

# 2. 启动开发环境 (Hot Reload)
npm run dev

# 3. 打包构建 (生成 .exe/.dmg)
npm run dist
```

## 4. 架构说明 (Architecture)
- **Main Process**: `main.js` - 窗口管理、Native I/O、ExifTool 进程守护。
- **Renderer Process**: `renderer.js` - UI 渲染、Canvas 绘图、状态管理 (Vanilla JS)。
- **Bridge**: `preload.js` - 仅暴露必要的 IPC 接口 (Context Isolation enabled)。

## 5. 文档 (Documentation)
- [PRD (产品需求文档)](docs/PRD.md)
- [**PM 实战训练营 (60天计划)**](docs/PM_Practice/README.md) 👈 **New!**
- [目录结构说明](.folder.md)

## 6. 版权 (License)
MIT
