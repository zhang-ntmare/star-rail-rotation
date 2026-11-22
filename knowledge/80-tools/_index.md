---
id: 80-tools/_index
type: branch
title: 数据与工具区
parent: null
game_ver: "4.7"
tags: [数据源, 字段, 引擎, 导入, 别名, 复查, 工具]
triggers: [数据源, 接口, StarRailRes, Mihomo, 米游社, 字段, 引擎, 脚本, 导入, UID, 别名, 复查]
status: active
confidence: high
updated: 2026-11-22
source: docs/research/07-数据源清单.md, docs/uid-import.md, docs/别名对照表.md
---

# 80 数据与工具区

**管**：数从哪来、字段有什么坑、引擎怎么跑、结论被复查过几轮。
**不管**：数本身（→ 各区）。

## 数据源

| 用途 | 源 | 说明 | 状态 |
|---|---|---|---|
| 角色/光锥/遗器/技能数值 | StarRailRes（AGPL） | 17 个 JSON，无敌方数据；`params` 分档 | ✅ |
| 成品面板 | Mihomo `sr_info_parsed` | 支持国服，返回已汇总面板，无需 key | ✅ |
| 自己 box | 米游社（经本地代理） | 需 Cookie，浏览器直连被 CORS 拦 | ✅ |
| **敌方数值（HP/弱点/SPD/韧性/环境buff）** | **hsr-trend.cduyzh.top** | ⭐ 历期四模式，SSR 可直接 curl；**韧性 ×1.2 = 显示值**；SPD 未校 | ✅ 2026-11-22 建档 |
| 敌方数值（本期 data-mine 明细） | sr.appfeng.com | 本期具体数 | ✅ |
| 公式校验 | HoYoWiki + Reko Wiki + GameVika | 社区只作旁证 | ✅ |

> 三站组合（同作者）见 `数据源-cduyzh三站.md`：**trend 给数值 / hsr 给配速引擎（可做对照）/ archive 给竞速样本**。

合规：Dimbreath/StarRailData 已被 DMCA 下架，本项目**不自己解包**，只用社区成品数据。

## 字段坑（踩过的）

| 坑 | 真相 |
|---|---|
| `max_sp` | 是**能量上限**，不是战技点上限 |
| `params` | 是分级数组，`desc` 里 `#1[i]` / `#2[f1]` 按序代入 |
| `character_skill_trees` 2.4MB | 会截断，行迹原文改走 BWIKI |
| 同角色敌方形态 | 独立词条，别混进角色卡 |
| 拆包 `stance_base` | ÷2.5 = 显示韧条 |

## 引擎

| 脚本 | 作用 |
|---|---|
| `tools/axis-sim.js` | v0.1 静态格点推演（先行排 AV） |
| `tools/axis-sim2.js` | v0.3 动态调度 + 拉条算子 + 资源台账 + 政策对比 |
| `tools/kb/kb.py` | 本库的索引/查询/召回 |
| `tools/mys_proxy.py` | 米游社本地转发（仅标准库） |

## 录像验收

| 节点/素材 | 作用 | 状态 |
|---|---|---|
| **`录像验收法.md`** | 1x 实录能钉死哪些 L2 参数：能读什么 / 三个换算套路 / 逐项判定表 / 操作流程 | ✅ 2026-11-22 |
| `videos/manual-1x/` | 8:35 手动局 516 帧 @1fps（队列 AV 数字可读实证 f0030/f0060） | ✅ 主素材 |
| `videos/weak-test/` | 8:21 弱队降压局 502 帧（boss 活得久，技能池采样） | ✅ |
| `videos/auto-test/` | 4:27 自动局 268 帧 | ✅ |
| `videos/BV*`、`douyin-0T-pam*` | B 站/抖音参考局 | 📦 采样备用 |

## 外部数据站 / 工具站

| 节点 | 内容 | 状态 |
|---|---|---|
| **`数据源-cduyzh三站.md`** | ⭐ trend（历期血量/弱点/SPD/韧性/环境buff 原文）+ hsr 配速计算器（第三方排轴引擎，可对照）+ archive 竞速档案；含 URL 规律、韧性 ×1.2 口径、SPD 待核判别式、curl 抓法 | ✅ 2026-11-22 |
| `录像验收法.md` | 1x 实录能钉死哪些 L2 参数（队列自带 AV 数字） | ✅ 2026-11-22 |

## 复查记录

`research/09` → `10` → `11` → `12` 四轮递进。**以 12 为准**，前几轮留作"错是怎么来的"证据。
教训：凡出现「两套体系 / 有分歧」，先怀疑是不是同一公式的不同单位记法。
