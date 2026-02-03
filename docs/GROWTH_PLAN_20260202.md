# RZFrame 商业化与增长战略 (Response to "Soul Torture")

> **基于 Skill**: `growth-monetization-strategy`
> **核心回应**: 针对“生成器困局”，执行从 **Tool (工具)** 向 **Workflow (工作流)** 的战略转型。

## A. 产品定位升级 (Product Positioning)

| 维度 | 旧定位 (v2.7) | **新定位 (v3.0 战略目标)** |
| :--- | :--- | :--- |
| **一句话定位** | 专业 EXIF 边框生成器 | **摄影师的“最后10公里”交付工作站** |
| **核心价值** | 美观的参数展示 | **作品的“品牌化封装”与多平台分发预处理** |
| **护城河** | 只有 UI/审美 (浅) | **数据资产 (EXIF偏好) + 品牌资产 (VI一致性)** |
| **竞品打击** | 比 Photoshop 快 | 比 LightRoom 更懂社交媒体分发 |

## B. 漏斗优化路线图 (Funnel Roadmap)

| 阶段 (Stage) | 关键动作 (Key Action) | 核心指标 (Metric) | 选项 1 (保守) | 选项 2 (激进) |
| :--- | :--- | :--- | :--- | :--- |
| **获客 (Acquisition)** | **水印飞轮** | 品牌曝光率 | 免费版强制带 "Made efficiently with RZFrame" 小尾巴 | 邀请制：邀请3人解锁“电影模式” |
| **激活 (Activation)** | **30秒即刻交付** | 首次导出时间 (TTFV) | 预置 5 套“大V同款”模版 (小红书/IG风) | 拖入照片自动识别相机品牌并匹配 Logo |
| **留存 (Retention)** | **资产管理化** | 周使用频次 | “最近导出”历史记录 (本地) | **“我的胶卷库”**: 按时间轴展示已加框作品 |
| **变现 (Revenue)** | **品牌溢价** | 付费转化率 | 买断制 (License) 解锁自定义 Logo | 订阅制 (SaaS) 解锁云端模版同步 |
| **推荐 (Referral)** | **模版分享** | K值 (病毒系数) | 导出 `.rzf` 模版文件分享给朋友 | 生成 "模版二维码"，扫码一键应用 |

## C. TTFV 设计 (Time To First Value)
*   **目标时间**: < 30秒
*   **首价值路径**: 打开 App -> 拖入照片 -> **自动检测到 Leica Q2** -> **自动应用 Leica 专用红标模版** -> 导出。
*   **关键触发器**: “智能识别” (Auto-Detect)。不要让用户手动选 LOGO，自动读 MakerNote。

## D. 留存机制设计 (Manager < Generator)
*   **短期 (D1-D7)**: **批量处理爽感**。一次搞定 50 张扫街废片，发朋友圈只需 1 分钟。
*   **中期 (D14-D30)**: **个性化资产沉淀**。用户开始建立自己的 "Dark Mode 模版"、"胶片模版"，离开成本变高。
*   **长期 (D30+)**: **数据洞察**。
    *   *Feature Idea*: "年度摄影报告" —— "这一年你用了 80% 的时间在 50mm 焦段，你是人文摄影师。" (利用 EXIF 数据做用户画像，极强的情感连接)。

## E. 变现能够性验证 (Monetization Validation)
> **假设**: 摄影师愿意为“个人品牌一致性”付费，而非单纯为“加框”付费。

*   **Paywall 设计**: 基础边框免费。**“品牌VI系统”** (自定义Logo、自定义中文字体、批量水印) 付费。
*   **MVP 测试**: 在 v2.8 中加入 "Pro Features" 按钮，点击弹出 "Coming Soon - 想要这个功能吗？"，统计点击率 (CTR)。

## F. 90天实验路线图 (90-Day Experiment Roadmap)

| Sprint | 周期 | 核心实验 (Core Experiment) | 验证指标 (Metric) | 成功标准 |
| :--- | :--- | :--- | :--- | :--- |
| **1-2** | W1-4 | **智能识别 (Magic Auto)** <br> 自动匹配相机品牌 Logo | 首次导出成功率 | > 85% 用户无需手动切换 Logo |
| **3-4** | W5-8 | **“我的胶卷” (Local Gallery)** <br> 在 App 内查看历史导出图 | 二次打开率 (Retention) | D7 留存提升 15% |
| **5-6** | W9-12| **年度数据报告 (Data Insight)** <br> 基于本地 EXIF 生成可视化报表 | 分享率 (Share Rate) | > 20% 用户截图分享报告 |

## G. 待办列表 (Backlog JSON)

```json
{
  "phase_1_magic_auto": [
    {"task": "集成 lens-id 映射库，自动匹配相机厂商 Logo", "metric": "Auto-Match Accuracy", "priority": "P0"},
    {"task": "重构 LogoManager，移除手动 Logo 选择的强引导", "metric": "Interaction Steps", "priority": "P1"}
  ],
  "phase_2_gallery": [
    {"task": "使用 IndexedDB 缓存导出历史 (本地路劲映射)", "metric": "Load Speed", "priority": "P1"},
    {"task": "新增 'Gallery' 视图界面", "metric": "View Count", "priority": "P1"}
  ]
}
```
