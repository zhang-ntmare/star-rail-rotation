'use strict';
/**
 * 伤害乘区机器（通用层）——欢愉式/直伤式逐区计算，不认识具体角色/怪，数值由 teams 提供。
 *
 * 依据：docs/characters/欢愉战舰-乘区与倍率总账.md（地基文档，2026-11-22，
 *       狼强普单段 24508 实测复算闭合，残差 ≤±12%）
 *
 * 欢愉式 = 基础值7535.107 × 倍率 × (1+欢愉度) × 笑点乘区 × 双爆区 × (1+增笑)
 *          × 防御区 × 抗性区 × 易伤区 × 受伤修正 × 强普档(独立乘区,仅强普)
 *
 * 并行记账模式：teams 在各伤害事件处调用 deal()，本层只算数+扣血+留痕，
 * 不改变行动条控制流——击杀时点由 HP 账反推，与实测锚点对账。
 */

const BASE = 7535.107;  // 80 级欢愉基础值 = 击破基数 376.75 × 20

/** 笑点/好活乘区 1 + 5×LP/(240+LP) ✅总账§1.4 */
function laughZone(lp) { return 1 + (5 * lp) / (240 + lp); }

/** 狼尊双爆区（全动态）：面板82.9%爆率/107.4%爆伤 + 朋克洛德+52%爆伤 + 愿力+30%爆伤 + 隐藏分转化 ✅总账§1.5
 *  暴击率 = 82.9% + 0.4%×X（X≥43 满暴）；满暴后每点转 0.8% 爆伤 */
function wolfCrit(X) {
  const rate = Math.min(1, 0.829 + 0.004 * X);
  const cd = 1.074 + 0.52 + 0.30 + 0.008 * Math.max(0, X - 43);
  return { rate, cd, zone: 1 + rate * cd };  // 期望口径（暴段≈满暴时 zone≈1+cd）
}

/** 通用双爆区（面板角色）：期望口径 1 + 爆率×爆伤 */
function panelCrit(rate, cd) { return 1 + rate * cd; }

/** 防御区 (200+10×Lv80=1000)/[(1−无视)×DEF+1000] ✅总账§1.7 闭合口径（1100/0.40 → 0.6024） */
function defZone(def, pen) { const B = 1000; return B / ((1 - pen) * def + B); }

/** 强普隐藏分档：每 60 分 +15%，≤2 层，2魂含初始保底 1 档 ✅总账§1.10 */
function strongBonus(X) { return 1 + 0.15 * Math.min(2, Math.max(1, Math.floor(X / 60))); }

/**
 * 欢愉式单目标伤害。
 * p = { mult, joyFactor, laughLP, critZone, zengxiao=1.15, defZone, res, vuln, taken, strong=null }
 */
function joyHit(p) {
  let d = BASE * p.mult;
  d *= p.joyFactor;
  d *= laughZone(p.laughLP);
  d *= p.critZone;
  d *= p.zengxiao != null ? p.zengxiao : 1.15;
  d *= p.defZone;
  d *= p.res;
  d *= p.vuln;
  d *= p.taken;
  if (p.strong != null) d *= p.strong;
  return d;
}

module.exports = { BASE, laughZone, wolfCrit, panelCrit, defZone, strongBonus, joyHit };
