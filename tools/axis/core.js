'use strict';
/**
 * 排轴引擎 · 通用核心（第 1/2 层）—— 所有排轴共用，不认识任何具体角色/怪
 *
 * 分层规矩（大人定，2026-11-22）：
 *   第 1 层 = 纯行动条骨架（SPD + 进场条 + 轮转），全模式通用
 *   第 2 层 = +拉条算子与资源触发（回能/SP/行动提前/额外回合/受击回能），全模式通用
 *   第 3/4 层 = 队伍/环境特异（敌方机制、场地、政策对比）——只准写在 teams/*.js
 *
 * 设计：core 只提供"行动条机器 + 资源原语"；谁在什么时候干什么，
 *       由队伍配置通过钩子（policy / cast / onTurn）注入。分步出轴见 run.js。
 *
 * 原语清单（第 2 层能力，队伍配置按需调用）：
 *   L(s, who, msg)            记账
 *   gainEnergy(s,k,n,why)     回能（按 units[k].energy 档位）
 *   hit(s, targets, why, n)   受击回能（群体/单体通用）
 *   advance(s,k,pct,why)      行动提前 pct×周期（拉条）
 *   insertTurn(s,k,tag,fn)    额外回合（插入，不占行动条）
 *   insert(s,t,label,fn)      定时插入（不占行动条）
 */

const T = (spd) => 10000 / spd;

const L = (s, who, msg) => s.log.push({ t: s.t, who, msg });

/** def = { units: {key:{name,spd,start,energy?}}, sp:{init,max} } */
function createSim(def) {
  const s = {
    t: 0, log: [], inserts: [], ents: {}, flags: {},
    sp: def.sp ? def.sp.init : 0, spMax: def.sp ? def.sp.max : 5,
    energy: {}, policy: null, def,
  };
  for (const [k, u] of Object.entries(def.units)) {
    s.ents[k] = { next: (1 - (u.start || 0)) * T(u.spd), period: T(u.spd), turns: 0 };
    if (u.energy) s.energy[k] = u.energy.init || 0;
  }
  return s;
}

function gainEnergy(s, k, n, why) {
  const u = s.def.units[k];
  if (!u || !u.energy) return;
  const before = s.energy[k];
  s.energy[k] = Math.min(u.energy.max, before + n);
  L(s, u.name, `能量+${(s.energy[k] - before).toFixed(1)}（${why}）→${s.energy[k].toFixed(1)}/${u.energy.max}`);
}

function hit(s, targets, why, n) {
  for (const k of targets) gainEnergy(s, k, n, why);
}

function advance(s, k, pct, why) {
  const e = s.ents[k];
  const cut = pct * T(s.def.units[k].spd);
  const before = e.next;
  e.next = Math.max(s.t, e.next - cut);
  L(s, s.def.units[k].name, `行动提前${(pct * 100).toFixed(0)}%${why ? `（${why}）` : ''}：@${before.toFixed(1)}→@${e.next.toFixed(1)}（−${(before - e.next).toFixed(1)}AV）`);
}

function insertTurn(s, k, tag, fn) {
  s.inserts.push({ t: s.t, fn: () => { s.ents[k].turns++; L(s, s.def.units[k].name, `【${tag}】额外回合`); fn && fn(); }, done: false });
}

function insert(s, t, label, fn) {
  s.inserts.push({ t, fn: () => { L(s, '事件', label); fn && fn(s); }, done: false });
}

/**
 * 主循环。hooks = { policy(s)->[act,...], cast(s,act), onTurn(s,k) }，全部由队伍配置提供。
 * 保留 falsy-zero 修复：best === null 判空（boss 首动 @0 时 next=0 不能被当成"空"）。
 */
function run(s, endAV, hooks) {
  let guard = 0;
  while (s.t <= endAV && guard++ < 20000) {
    // ① 到期插入事件（同刻按序处理）
    const due = s.inserts.filter((x) => !x.done && x.t <= s.t + 1e-9);
    if (due.length) { due.sort((a, b) => a.t - b.t); due[0].done = true; due[0].fn(); continue; }
    // ② 终结技（不占行动条，政策决定）
    const acts = hooks.policy ? hooks.policy(s) : [];
    if (acts.length) { hooks.cast(s, acts[0]); continue; }
    // ③ 下一个行动条单位
    let best = null, bestK = null;
    for (const k of Object.keys(s.ents)) {
      if (best === null || s.ents[k].next < best) { best = s.ents[k].next; bestK = k; }
    }
    const ins = s.inserts.filter((x) => !x.done).sort((a, b) => a.t - b.t)[0];
    if (ins && ins.t <= best) { s.t = Math.max(s.t, ins.t); ins.done = true; ins.fn(); continue; }
    s.t = Math.max(s.t, best);
    hooks.onTurn(s, bestK);
  }
  return s;
}

/** 九列表动作行（通用渲染；资源明细不单独成行） */
function mdRows(s, endAV) {
  let n = 0;
  const skipWho = new Set(['账', '事件']);
  const skipMsg = /^(能量\+|行动提前|★|欢愉技：)/;
  console.log('\n【九列表·动作行】（# | AV | 谁 | 做什么，供轴表直接引用；资源数字看上面的明细账）');
  console.log('| # | AV | 谁 | 做什么 |');
  console.log('|---|---|---|---|');
  for (const l of s.log) {
    if (l.t > endAV) continue;
    if (skipWho.has(l.who) || skipMsg.test(l.msg)) continue;
    n++;
    console.log(`| ${n} | ${l.t.toFixed(1)} | ${l.who} | ${l.msg.replace(/\|/g, '｜')} |`);
  }
}

module.exports = { T, L, createSim, gainEnergy, hit, advance, insertTurn, insert, run, mdRows };
