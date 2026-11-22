'use strict';
/**
 * 分步出轴 CLI（大人定的工作方式：一步一步走，一个轴一个轴出，方便根源纠错）
 *
 *   node tools/axis/run.js --step=1                V1 粗排骨架（纯行动条，全排轴通用）
 *   node tools/axis/run.js --step=2                V2 +拉条算子与资源触发（敌方机制关，全排轴通用）
 *   node tools/axis/run.js --step=3                V3 +队伍/环境机制（默认 S4 政策，执行轴）
 *   node tools/axis/run.js --step=4                V4 政策对比 + 选中政策明细（对账优化）
 *
 * 可选：--policy=S1_现轴|S2_爻光早开|S3_贪心能放就放|S4_早开_大等力场（step 3/4 用）
 *       --until=170（推演终点 AV）
 *
 * 纪律：先跑 step=1 逐格验收，过了再 step=2……每层只看自己那版轴；
 *       下层的所有提前量都要对着上层的表算差分（L1-排轴前清单）。
 */

const core = require('./core');
const team = require('./teams/pamwang-huanyu');

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : dflt;
};
const num = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : dflt;
};

const step = num('step', 3);
const END = num('until', 170);
const policyName = arg('policy', team.DEFAULT_POLICY);

function detail(s, endAV) {
  for (const l of s.log) {
    if (l.t > endAV) continue;
    console.log(`${l.t.toFixed(1).padStart(6)} | ${l.who.padEnd(4)}｜${l.msg}`);
  }
}

const mkSim = () => { const s = core.createSim({ units: team.CFG.units, sp: team.CFG.sp }); team.initState(s); return s; };

/** 伤害账汇总（2026-11-22 伤害层接入） */
function dmgReport(s) {
  const mobStr = Object.entries(s.mobs).map(([k, m]) => {
    const hp = m.hp == null ? team.DMG.mobHP[k] : m.hp;
    return `${k}:${Math.max(0, Math.round(hp)).toLocaleString()}${m.dead ? '(轮数判死)' : ''}`;
  }).join(' / ');
  console.log(`\n【伤害账】（并行记账，控制流不变）`);
  console.log(`P1 理论击杀 @${s.p1KillT != null ? s.p1KillT.toFixed(1) : '未'}（实测锚 89）｜P2 理论击杀 @${s.killT != null ? s.killT.toFixed(1) : '未'}${s.killT != null ? ` → 分数 ${Math.round(4000 - s.killT)}` : ''}`);
  console.log(`bossHP 余 ${Math.max(0, Math.round(s.bossHP)).toLocaleString()}（phase ${s.phase}）｜累计对 boss ${Math.round(s.dmgDealt.boss).toLocaleString()}／对小怪 ${Math.round(s.dmgDealt.mob).toLocaleString()}`);
  console.log(`小怪HP余：${mobStr}`);
  if (s.strongRounds && s.strongRounds.length) {
    console.log(`强普轮明细（校准锚：破韧窗单段实测 24,508 → 单轮≈245×万×档差）：`);
    for (const r of s.strongRounds) console.log(`  @${r.t.toFixed(1)} → ${r.tgt === 'boss' ? '帕姆王' : (team.CFG.units[r.tgt] || {}).name || r.tgt}  ${r.d.toLocaleString()}`);
  }
}

if (step === 1) {
  const s = mkSim();
  core.run(s, END, team.makeHooks(1));
  console.log(`【第 1 层】V1 纯行动条骨架（零拉条、零机制；SPD+进场条+SP 口径，全排轴通用）`);
  detail(s, END);
  core.mdRows(s, END);
} else if (step === 2) {
  const s = mkSim();
  core.run(s, END, team.makeHooks(2, team.GREEDY));
  const st = team.stats(s);
  console.log(`【第 2 层】V2 +拉条算子与资源触发（敌方机制关闭；开大=能放就放；全排轴通用）`);
  console.log(`阿哈 ${st.aha} 次 @${st.ahaTimes}｜狼首Q @${st.langQ1}｜真珠首Q @${st.zhenQ1}\n`);
  detail(s, END);
  core.mdRows(s, END);
} else if (step === 3) {
  const s = mkSim();
  const hooks = team.makeHooks(3, team.POLICIES[policyName]);
  hooks.stageInserts(s);
  core.run(s, END, hooks);
  const st = team.stats(s);
  console.log(`【第 3 层】V3 +队伍/环境机制（${policyName}，执行轴）`);
  console.log(`阿哈 ${st.aha} 次 @${st.ahaTimes}｜狼首Q @${st.langQ1}｜真珠首Q @${st.zhenQ1}｜有效强普 ${st.validStrong}｜破韧 @${st.broken}`);
  dmgReport(s);
  detail(s, END);
  core.mdRows(s, END);
} else if (step === 4) {
  const rows = [];
  let keep = null;
  for (const [name, p] of Object.entries(team.POLICIES)) {
    const s = mkSim();
    const hooks = team.makeHooks(3, p);
    hooks.stageInserts(s);
    core.run(s, END, hooks);
    const st = team.stats(s);
    rows.push({ name, ...st });
    if (name === policyName) keep = s;
  }
  console.log('【第 4 层】V4 政策对比（0→' + END + ' AV）\n');
  console.log('政策'.padEnd(24) + '阿哈数 阿哈时刻AV      狼首Q  真珠首Q 真珠Q次 有效强普 破韧 终局隐藏分');
  for (const r of rows) {
    console.log(
      r.name.padEnd(22) +
      String(r.aha).padStart(4) + '  ' + r.ahaTimes.padEnd(14) +
      String(r.langQ1).padStart(6) + String(r.zhenQ1).padStart(8) +
      String(r.zhenQn).padStart(7) + String(r.validStrong).padStart(8) +
      String(r.broken).padStart(8) + String(r.hiddenEnd).padStart(8)
    );
  }
  console.log(`\n\n【${policyName} 明细】\n` + '='.repeat(80));
  detail(keep, END);
  core.mdRows(keep, END);
} else {
  console.log('用法：node tools/axis/run.js --step=1|2|3|4 [--policy=...] [--until=...]（见文件头注释）');
}
