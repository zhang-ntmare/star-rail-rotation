# tools/axis —— 分层排轴引擎

> 2026-11-22 按大人指令拆分：**一步一步走，一个轴一个轴出**（方便根源纠错），不再一次性吐 4 版。

## 分层规矩

| 层 | 内容 | 通用性 | 代码位置 |
|---|---|---|---|
| 1 | 纯行动条骨架（SPD/进场条/轮转/SP） | **所有排轴通用** | `core.js` |
| 2 | 拉条算子 + 资源触发（回能/行动提前/额外回合/受击回能） | **所有排轴通用** | `core.js`（原语）+ 队伍文件接线 |
| 3 | 队伍/环境特异机制（敌方插入、力场、韧性、保姆充能、笑点/阿哈） | 每队每环境一份 | `teams/*.js` |
| 4 | 政策对比 + 对账优化 | 每队每环境一份 | `teams/*.js`（POLICIES）+ `run.js --step=4` |

**纪律**：新队伍 = 复制 `teams/` 写一份新配置，`core.js` 不动；先跑 step=1 逐格验收，过了才准跑 step=2。

## 用法

```
node tools/axis/run.js --step=1                # V1 骨架
node tools/axis/run.js --step=2                # V2 +拉条与资源（贪心）
node tools/axis/run.js --step=3                # V3 +机制执行轴（默认 S4）
node tools/axis/run.js --step=4                # V4 政策对比
可选：--policy=S1_现轴|S2_爻光早开|S3_贪心能放就放|S4_早开_大等力场   --until=170
```

## 文件

- `core.js`：行动条机器 + 资源原语（createSim/gainEnergy/hit/advance/insertTurn/insert/run/mdRows）。保留 falsy-zero 修复（`best === null` 判空）。
- `teams/pamwang-huanyu.js`：欢愉战舰 × 帕姆王节点一的全部特异配置与钩子（含敌方时序参数及其帧证出处）。
- `run.js`：分步 CLI。

## 已知待钉（改动参数前先看 L2-待钉总账）

- 灰烬周期 64 ✅（首动38→二动102 帧证）；赤焰周期 64 ✅（首动77→二动140 帧证，同速）
- 破晓清场 @112 🟡（toast 帧可钉）；boss@58 单体部分命中对象/受击档 🟡
- 阿哈读数 ±1 取整方向未定（64~65）
