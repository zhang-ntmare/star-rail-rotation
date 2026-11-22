/**
 * 末日幻影 P22 节点一 · 行动条推演引擎 v0.1（排轴器 v0.3 核心 seed）
 *
 * 原则：轴 = 纯计算输出。输入只有 速度表 + 进场条进度 + 机制开关。
 * 录像只用于 ①拟合未知参数（小怪/保姆 SPD、boss 进场条）②验收预测。
 *
 * 模型：
 *   每实体一条行动条，周期 = 10000/SPD；进度满 → 出手，归零重来。
 *   翁瓦克 = 进场条进度 40%；boss 进场条进度由首动时点反解；
 *   阿哈 = 独立实体（速度公式 80+216/5+199/10+187/20+181/50 = 156.07）；
 *   boss「扫除」链 = 正式回合（单体普攻）+ 蓄力插入（AOE 释放延后 CHARGE AV）。
 *
 * 运行：node tools/axis-sim.js [endAV]
 */

// ---------- 输入参数（全部带来源标注） ----------
const PARAMS = {
  // 我方（§1 速度表，愿力 Lv.3 SPD+12 已计入）
  lang:  { name: '狼尊',   spd: 216,   start: 0,     src: '速度表' },
  yao:   { name: '爻光',   spd: 199,   start: 0.40,  src: '速度表+翁瓦克40%' },
  zhen:  { name: '真珠',   spd: 187,   start: 0.40,  src: '速度表+翁瓦克40%' },
  huan:  { name: '欢愉主', spd: 181,   start: 0.40,  src: '速度表+翁瓦克40%' },
  aha:   { name: '阿哈',   spd: 156.07, start: 0,    src: '阿哈速度公式' },
  // 敌方 / NPC
  boss:  { name: 'boss',   spd: 177,   start: null,  src: 'SPD177 队列帧实测；start 由首动@2 反解' },
  hui:   { name: '灰烬',   spd: 263.2, start: 0,     src: '🟡拟合：首动@38、二动@76（p=38）' },
  chi:   { name: '赤焰',   spd: 263.2, start: 2 / 38, src: '🟡拟合：首动@40（+2AV 错位）' },
  baomu: { name: '保姆',   spd: 232.6, start: 0,     src: '🟡首动elapsed42~43已钉(@42@剩余2000与@12@剩余1969同一动)；周期候选23/43；@128强普=充能插入非bar行动，旧"p≈43闭合"作废' },
  // boss 扫除蓄力链：正式回合后插入，AOE 释放延后 N AV
  saochu: { slot: 3, chargeAV: 14, src: '🟡拟合：大人实测释放落在保姆@128 之后、阿哈②之前' },
};

// ---------- 引擎 ----------
function simulate(endAV = 250) {
  const ents = [];
  for (const [key, p] of Object.entries(PARAMS)) {
    if (key === 'saochu') continue;
    const period = 10000 / p.spd;
    let start = p.start;
    if (key === 'boss' && start === null) {
      // boss 首动 @2 反解进场条进度
      start = (period - 2) / period;
    }
    ents.push({ key, ...p, period, start });
  }

  const actions = [];
  for (const e of ents) {
    let t = (1 - e.start) * e.period;
    let n = 1;
    while (t <= endAV) {
      actions.push({ av: t, who: e.name, n, key: e.key });
      t += e.period;
      n++;
    }
  }

  // boss 扫除链：第 slot 个正式回合后插入 AOE 释放
  const bossActs = actions.filter(a => a.key === 'boss').sort((a, b) => a.av - b.av);
  if (bossActs.length >= PARAMS.saochu.slot) {
    const anchor = bossActs[PARAMS.saochu.slot - 1];
    actions.push({
      av: anchor.av + PARAMS.saochu.chargeAV,
      who: 'boss·扫除AOE',
      n: 0,
      key: 'boss-insert',
      note: `「值日准备中」蓄力 ${PARAMS.saochu.chargeAV} AV 后释放（插入，非正式回合）`,
    });
  }

  actions.sort((a, b) => a.av - b.av || a.key.localeCompare(b.key));
  return actions;
}

// ---------- 输出 ----------
const endAV = Number(process.argv[2]) || 250;
const actions = simulate(endAV);

console.log(`末日幻影 P22 节点一 · 引擎推演 0→${endAV} AV\n`);
console.log('AV(战斗时钟) | 实体        | 第n动 | 备注');
console.log('-'.repeat(64));
for (const a of actions) {
  const tag = a.key === 'boss-insert' ? ' ⚡插入' : '';
  console.log(
    `${a.av.toFixed(1).padStart(8)} | ${a.who.padEnd(8)} | ${String(a.n || '-').padStart(3)} |${a.note || ''}${tag}`
  );
}

// 关键段落切片（对账用）
const seg = actions.filter(a => a.av >= 110 && a.av <= 150);
console.log('\n—— @110-150 切片（对账段）——');
for (const a of seg) console.log(`${a.av.toFixed(1).padStart(7)}  ${a.who}`);
