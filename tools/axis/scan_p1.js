'use strict';
/** P1 转阶段时点扫描器（临时工具）：扫 barrierUntil / 政策参数，找 P1 最早击杀 */
const core = require('./core');
const team = require('./teams/pamwang-huanyu');
const CFG = team.CFG;
const END = 200;
// 绕过引擎 bug：stageInserts @81 用 CFG.units[k].name 取 P2 小怪名会崩，补占位
for (const k of ['p2hui','p2bm','p2chi','p2cy']) if (!CFG.units[k]) CFG.units[k] = { name: k, spd: 156.25, energy: { max:999, init:0, A:0, E:0, joy:0 } };

function runSim(mods, policyName) {
  for (const [k, v] of Object.entries(mods)) CFG.tough[k] = v;
  const s = core.createSim({ units: CFG.units, sp: CFG.sp });
  team.initState(s);
  const hooks = team.makeHooks(3, team.POLICIES[policyName]);
  hooks.stageInserts(s);
  core.run(s, END, hooks);
  return s;
}

const policies = Object.keys(team.POLICIES);
const barriers = [40, 50, 60, 70, 80, 88];
console.log('barrier\t政策\t\tP1kill\tP2kill\tbossHP余\t有效强普\t破韧');
for (const b of barriers) {
  for (const p of policies) {
    const s = runSim({ barrierUntil: b }, p);
    const st = team.stats(s);
    console.log(`${b}\t${p.padEnd(20)}\t${s.p1KillT != null ? s.p1KillT.toFixed(1) : '—'}\t${s.killT != null ? s.killT.toFixed(1) : '—'}\t${Math.round(s.bossHP).toLocaleString()}\t${st.validStrong}\t${st.broken}`);
  }
}
// restore
CFG.tough.barrierUntil = 88;
