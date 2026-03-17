# Product Requirement Document (PRD)

> **Project Name**: RZFrame Workstation Pro
> **Version**: 1.0 (Refactored)
> **Status**: In Development
> **Date**: 2026-01-18

## 1. Product Overview (产品概述)
RZFrame Workstation Pro 是一款基于 Electron 的桌面端应用程序，旨在为摄影师和摄影爱好者提供高效、专业且极具美感的 EXIF 边框生成工具。它支持读取照片的元数据（Exif），将其以高度可定制的方式展示在照片周围，赋予照片画廊级的展示效果。

### 1.1 Core Value (核心价值)
- **专业性**: 基于 `exiftool` 的强大元数据读取能力，支持绝大多数相机和镜头组合。
- **美学**: 提供多种精心设计的边框模版 (Classic, Cinema, Float)，提升照片观感。
- **高效**: 支持批量处理、拖拽上传，通过本地客户端提供流畅的操作体验。
- **隐私**: 所有处理均在本地完成，无需上传服务器，保障用户照片隐私。

## 2. User Stories (用户故事)
- **作为一名摄影师**，我希望批量给我的扫街照片添加带有拍摄参数（光圈、快门、ISO、镜头）的边框，以便在社交媒体上分享时展现专业度。
- **作为一名胶片爱好者**，我希望使用“Cinema”模版，模拟宽银幕电影的质感，并手动输入胶片型号。
- **作为一名内容创作者**，我希望能够保存我的常用边框设置（字体、颜色、Logo）为模版，以便下次快速调用。
- **作为一名Mac/Win双平台用户**，我希望应用在不同系统上都能有一致且流畅的体验。

## 3. Functional Requirements (功能需求)

### 3.1 Image Management (图片管理)
- **P0** 支持拖拽上传单张或多张图片 (JPG/PNG/WebP)。
- **P0** 底部“胶卷带” (Filmstrip) 预览，支持点击切换当前编辑图片。
- **P0** 支持移除单张或清空所有图片。
- **P1** 加载高分辨率大图时需有加载状态提示 (Loading Overlay)。

### 3.2 Immersive Editor (沉浸式编辑器)
- **P0 Canvas 渲染**: 实时预览添加边框后的效果。
- **P0 模版切换**:
    - **Classic**: 经典的底部留白 Exif 信息样式。
    - **Cinema**: 电影感黑框样式。
    - **Float**: 悬浮阴影样式，背景模糊处理。
- **P0 参数调整**:
    - 字体大小 (Font Scale)
    - 边框宽度 (Border Width)
    - 圆角大小 (Radius) - *特定模版*
    - 背景亮度 (BG Brightness) - *Float 模版*
- **P0 画幅调整 (Canvas Ratio)**:
    - Original (原始比例 + 边框)
    - 1:1, 4:5, 16:9, 9:16, 2:3, 3:4 等常用社交媒体比例。
    - 支持按比例缩放/裁剪原图 (Image Zoom & Pan)。
- **P0 样式定制**:
    - 边框颜色 (黑/白)
    - 文字颜色 (黑/白/自动)
    - 字体选择 (内置 Inter/Serif/Mono + **系统字体调用**)

### 3.3 Metadata (元数据)
- **P0 自动读取**: 使用 ExifTool 读取 Make, Model, Lens, Focal, Aperture, Shutter, ISO, Date。
- **P0 智能解析**: 自动尝试解析镜头名称（优先读取 LensID/LensModel，失败则尝试正则匹配）。
- **P0 品牌/Logo**:
    - **P0 智能匹配**: 根据照片 Exif `Make` 标签自动识别相机品牌，并匹配本地资产库中的 Logo。
    - **P0 样式切换 (Cycle)**: 支持同一品牌下的多种 Logo 样式（如 Black, White, Alpha）循环切换。
    - **P0 自定义上传**: 支持上传单张自定义 Logo。
    - **P1 持久化存储**: 用户上传的自定义 Logo 可保存为该品牌的默认配置，并在下次该品牌照片导入时自动应用。
    - **P1 批量库导入**: 支持一键导入整理好的 Logo 文件夹到应用的 `userData` 目录。
    - **P0 视觉控制**: Logo 缩放、反色 (Invert)、重置。
    - **Text Mode**: 显示可编辑的品牌文字（作为 Logo 缺失时的回退）。

### 3.4 Export (导出)
- **P0 单图导出**: 保存当前编辑后的图片，自动命名。
- **P0 批量导出**: 将当前设置应用到列表中的所有图片并批量保存到指定文件夹。
- **P1 模版库**:
    - 保存当前参数组合为模版。
    - 从模版库加载配置。
    - 导入/导出模版文件 (.json/.rzf)。

### 3.5 System (系统)
- **P1 国际化**: 支持 EN/JP/CN 语言切换。
- **P1 主题切换**: 支持 Light/Dark 模式。
- **P1 窗口控制**: 自定义标题栏 (无边框窗口)，支持最小化、最大化、关闭。
- **P2 日志系统**: 自动记录运行日志到本地，支持轮转 (Log Rotation)。

## 4. Non-Functional Requirements (非功能需求)
- **Performance**: 图片加载和渲染应在 100ms 内响应（视觉无卡顿）。批量处理应有进度反馈。
- **Security**: 严格限制文件读写权限，仅允许写入用户明确选择的目录（白名单机制）。
- **Compatibility**: Windows 10/11, macOS 12+。
- **Tech Stack**:
    - Core: Electron
    - Frontend: HTML5 Canvas, Tailwind CSS, Vanilla JS (No Framework overhead for performance)
    - Exif Engine: `exiftool-vendored` (Perl process management)

## 5. UI/UX Design (界面设计)
- **风格**: 极简、现代、玻璃拟态 (Glassmorphism)。
- **布局**: 左侧样式控制，中间画布预览，右侧参数/Exif详情，底部图片列表。
- **交互**: 全局支持键盘快捷键 (TBD)，滑动条实时反馈。

## 6. Iteration Plan (迭代计划)

### v2.7.3: Logo Logic Overhaul (当前迭代 - 已完成)
- **F01 [New] 自动品牌识别**: 基于模糊匹配的 Exif 品牌 Logo 自动应用。
- **F02 [New] 多款式循环**: 支持预览框内一键循环切换品牌下的黑白等款式。
- **F03 [New] Logo 持久化**: 支持自定义图片上传并保存为品牌默认。
- **F04 [New] 批量库管理**: 后端扫描内置与自定义 Logo 目录。

### v1.1.x: Core Refinements (规划中)
- **F05 [Fix] 字体兼容性修复**: 解决 Windows 下中文字体乱码问题。
- **F06 [New] 时间精度提升**: Exif 时间读取精确到秒。
- **F07 [New] 自定义文字颜色**: 接入色盘选择。

### v1.2: Creative Toolkit (规划中)
- **F05 [New] 更多模版**: 新增拍立得、胶片连拍等风格。
- **F06 [New] 贴纸系统**: 支持在画布上添加装饰贴纸。
- **F07 [New] 模版导入导出**: 支持 .rzf 配置文件的分享与加载。

## 7. Future Roadmap (未来规划)
- **v2.0**: 引入 AI 智能配色，根据图片内容自动推荐边框颜色。
- **v2.1**: 支持更多格式 (TIFF, HEIC)。
- **v2.5**: 社区模版分享平台。
- **v3.0**: 地理位置标记与地图可视化。
- **v3.1**: 社交媒体一键发布集成。
