# RZFrame (Electron Edition)

> **版本 Status**: 2.7.2 (Stable / Governance Complete)
> **架构**: Electron + Vite + React (Vanilla JS Core)

## 0. 核心原则 (Antigravity Rules)
1. **分形文档**: 修改代码前必读/更新 `.folder.md`。
2. **三段式交付**: MVP -> 理解 -> 决策。
3. **安全优先**: 涉及文件系统操作需谨慎。

---

## 1. 项目简介 (Project Overview)
**RZFrame Workstation Pro** 是一款基于 Electron 的专业 EXIF 边框生成工具。它专为摄影师设计，支持读取照片元数据（光圈、快门、ISO、镜头等），并根据预设模版生成极具美感的展示图。

### 核心特性
- **本地化**: 所有处理均在本地完成，无隐私风险。
- **专业级 Exif 解析**: 基于 `exiftool-vendored`。
- **高度定制**: 支持字体、边框、Logo、圆角等多种参数调整。
- **批量处理**: 支持拖拽多图上传与批量导出。

## 2. 快速开始 (Quick Start)

### 环境要求
- Node.js (v18+)
- NPM / Yarn

### 安装与运行
```bash
# 1. 安装依赖
npm install

# 2. 启动开发环境
npm run dev

# 3. 打包构建
npm run dist
```

## 3. 架构说明 (Architecture)
- **Main Process**: `main.js` - 负责窗口管理、文件 I/O、ExifTool 进程管理。
- **Renderer Process**: `renderer.js` - 负责 UI 渲染、Canvas 绘图、状态管理 (Vanilla JS + Tailwind)。
- **Bridge**: `preload.js` - 安全的 IPC 通信桥梁。

## 4. 文档 (Documentation)
- [PRD (产品需求文档)](doc/PRD.md)
- [目录结构说明](.folder.md)

## 5. 版权 (License)
MIT
