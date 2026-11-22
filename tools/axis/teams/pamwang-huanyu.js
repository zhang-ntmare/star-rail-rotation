'use strict';
/**
 * 队伍/环境特异层（第 3/4 层）：欢愉战舰（狼尊/爻光/真珠/欢愉主）× 帕姆王节点一（末日幻影 P22）
 *
 * 通用引擎在 ../core.js——这里只准写"这支队伍在这个环境里"的东西：
 *   · 单位定义（SPD/进场条/能量档）——第 1/2 层的输入
 *   · 拉条算子接线（cast/policy）——第 2 层
 *   · 敌方与场地机制（boss 插入、力场、韧性、保姆充能、笑点/好活/阿哈）——第 3 层
 *   · 开大政策对比（POLICIES）——第 4 层
 *
 * 敌方时序参数（2026-11-22 队列帧定案，见 knowledge/00-rules/L2-待钉总账）：
 *   帕姆王  周期 58 ✅（双帧证：boss@27@剩余1969 → elapsed58；16@剩余1958 → elapsed58 再证）
 *   保姆    周期 69 ✅（首动42 ✅ → 二动 d=69@剩余1958 → elapsed111；旧候选 23/30/43 全作废）
 *   灰烬    周期 64 🟡（首动38 ✅ → 二动 d=60@剩余1958 → elapsed102；SPD 156.25）
 *   赤焰    周期 64 ✅（首动 77 双帧交叉；二动@140=剩余1919帧读59 → 帧证，与灰烬同速 156.25）
 */

const core = require('../core');
const dmg = require('../dmg');
const { L, gainEnergy, advance, insertTurn } = core;

// ── 伤害层配置（2026-11-22 接入；依据 docs/characters/欢愉战舰-乘区与倍率总账.md + 面板实测 + 节点一血量）──
const DMG = {
  bossHP: { p1: 19357999, p2: 23229599 },            // ✅ 实机卡片终裁（1935.8万 / ×1.2）
  mobHP: { hui: 3145675, chi: 3145675, cangyi: 2661725 },  // 破晓精英 ✅拆包链（苍翼 P2 出场）
  def: 1100, pen: 0.40,                              // 帕姆王 DEF 1100；无视 40%（专武20+魔法少女4=20）→ 防御区 0.6024 ✅
  defZone: dmg.defZone(1100, 0.40),
  joyFactor: { lang: 4.73, yao: 4.30, zhen: 3.55, huan: 3.33 },   // ✅总账§1.3 实战欢愉度（含转模+队伍加成）
  crit: { yao: dmg.panelCrit(0.327, 1.394 + 0.30), huan: dmg.panelCrit(0.623, 1.060 + 0.30) },  // 面板+愿力暴伤30
  zengxiao: 1.15,                                    // 真珠 2 魂 ✅
  haohuoInit: 99,                                    // 狼秘技开场 99 好活（完整循环轴口径）🟡
  // 抗性/免疫（欢愉伤属性归属=攻击者自身属性 ✅总账§1.8）：
  //   boss 弱点 物理/火/量子/虚数 → 虚数/物理 ×1.0；雷/冰 ×0.4
  //   boss 免疫（力场期=小怪在场）＝成员同属性：P1 {物理,火}／P2 {物理,火,量子,苍翼🟡}——欢愉属性不在其中，欢愉线永不被免疫锁
  //   小怪免疫自身属性（灰烬物理/赤焰火/苍翼🟡）；非自身属性按 ×1.0 简化🟡
  bossRes: { lang: 1.0, yao: 1.0, zhen: 0.4, huan: 0.4 },
  bossImmune: { 1: ['yao'], 2: ['yao'] },            // 物理归属（爻）被免疫；火/量子我方无人走欢愉线；雷/冰/虚数不锁
  mobResSelf: { hui: 'yao', chi: null, cangyi: null },  // 小怪免疫自身属性：灰烬=物理→爻打灰烬 ×0
  takenMobFF: 0.25,                                  // 坚不可摧（力场期）✅总账§1.11
  takenMobRetreat: 1.3,                              // 失意「受到的伤害提高」🟡数值未测（小怪1轮死闭合需 ≥+19%，占位 1.3）
  haohuoCap: 180,                                    // 好活乘区封顶（§5 口径 LP 120~180；2回合衰减🟡按封顶近似）
  strongBonusOn: false,                              // ⚠️校准疑点#1：§5 复算未乘强普档也闭合 24508 → 默认关；实机单段>33k 再开
};

const CFG = {
  // spd/start：start = 进场条进度（next = (1-start)×周期；负 start = 召唤/晚入场）
  units: {
    lang:  { name: '狼尊',   spd: 216,    start: 0 },                       // 开怪者，无翁瓦克
    yao:   { name: '爻光',   spd: 199,    start: 0.40, energy: { max: 180, init: 127.3, A: 37.3, E: 37.3, joy: 37.3 } },
    zhen:  { name: '真珠',   spd: 187,    start: 0.40, energy: { max: 180, init: 90,    A: 30.3, E: 37.3, joy: 37.3 } },  // A=30.3 🟡反解（与欢愉主同档假设）：首动A + 闭合 @88.4 点火链（24.9 时差 3.0 开不出 Q）
    huan:  { name: '欢愉主', spd: 181,    start: 0.40, energy: { max: 160, init: 80,    A: 30.3, E: 37.3, joy: 37.3 } },  // A=30.3 🟡反解：@88.4 实测「A 即有 Q」（129.7+30.3=160 恰满）；旧 24.9 系通用档误套
    // joy = 合演回能 = **37.3**（战技档 30×1.244）——2026-11-22 大人实测「自然阿哈①后欢愉主能量已满」唯一闭合解（122.7+37.3=160 恰满）；旧"Gachabase Energy Gen 5→6.2"勘误作废（或合演回能≠欢愉技施放档，机制归属🟡）。爻光撞 cap 不可判别；真珠判别式：@64.1 后读数 =170（37.3）/139（6.2）
    aha:   { name: '阿哈',   spd: 156.07, start: 0 },
    boss:  { name: '帕姆王', spd: 172.4,  start: 1.0 },                     // 周期 58 ✅帧证；开怪首动@0（排队内）
    baomu: { name: '保姆',   spd: 144.9,  start: 0.3913 },                  // 周期 69 ✅帧证（42→111）；首动@42
    hui:   { name: '灰烬',   spd: 156.25, start: 0.40625 },                 // 周期 64 🟡（38→102）
    chi:   { name: '赤焰',   spd: 156.25, start: -0.20313 },                // 周期 64 ✅帧证（二动@140）；首动@77 ✅双帧交叉
  },
  sp: { init: 3, max: 5 },
  hit: 12.4,            // 轻击群攻档 10×1.244（boss@58 AOE 部分）
  artBarrier: 90,       // 真珠行迹「艺术壁垒」：底本开大 → +90 能量
  laugh: { init: 10, yaoA: 3, langE: 5, huanA: 3, baomuA: 5, langJoy: 15, trace20: 20, trace40: 20, yaoQFixed: 40,
    bossAoe: 3,          // 帕姆王【饱和式大扫除！】"并使我方获得笑点"（boss技能原文+2026-11-22实测@58 池26→29）；无双抛洗渍/高级肥皂泡同产🟡数值未测
    ahaGift: 1,          // 阿哈时刻结束按欢愉角色数赠送（实测 4人×1=4：池+4/狼+4，67→71、134→138 双验）
    enterUltHidden: 20,   // 狼行迹3「隐藏关卡全成就」：进入无敌玩家 +20 隐藏分（纯隐藏分，不给笑点/充能）BWIKI 原文
    langUltLC: 20 },      // 狼专武「欢迎来到银河城」：对自身放终结技 +20 笑点（最多1次，3次普攻后重置）→ 隐藏分+保姆充能
  // 2026-11-22 实测链全闭合（狼隐藏分）：10(进场固定) → +3爻A → +0真E/强化Q（实测均 0）→ +3欢A=16 → +5保姆普通A=21 → +5狼E=26 ✅
  // ⚠️ laugh.init 2026-11-22 修正 11→10：大人实测进场固定 10（4 基础+盲盒3+爻秘技3）；旧 11 会让池多 1、好活多 1
  // 狼E +5 笑点 = BWIKI 原文；保姆A +5 = 详情卡原文+实测双证。真珠全程 0 笑点。
  // 小怪击杀表（2026-11-22 实测）：灰烬第 1 轮强普死；赤焰贪饕两段（致死→回血→压制上限→彻底消灭），第 2 轮才死
  mobs: { hui: { hits: 1, taotie: false }, chi: { hits: 2, taotie: true } },
  adv: { zhenQBase: 0.30, zhenQE2: 0.30, wind: 0.25 },  // 狼尊Q=行动提前100%（next→now，写死在 cast）
  // th.langQ = 开大门槛；langQCost = 开大消耗（2026-11-22 实测 300→164 消耗136🟡单例，旧 60 作废；
  //   行迹3/专武 +40 在消耗前结算、被 300 顶格吸收，读数上不可见——见 cast langQ 注释）
  th: { langQ: 60, langQCost: 136, langExtra: 120, yaoQ: 180, zhenQ: 180, huanQ: 160 },
  tough: { bossStart: 470, barrierUntil: 88, ahaStrike: 65, langAhaStrike: 10, langStrong: 50, baomuStrong: 100 },
  chargeNeed: 80,       // 保姆闪充：80 笑点 → 1 发强普（🟡 拟合：1 笑点 = 1 格）
};

const GREEDY = { yaoQ: 'early', langQ: 'now', zhenQ: 'now', huanQ: 'now' };  // 第 2 层专用（无机制约束下的贪心）

/** 队伍层资源状态（createSim 只建行动条，这些归特异层管）。run.js 在 createSim 后调用 */
function initState(s) {
  s.laugh = CFG.laugh.init;
  s.hidden = 10;  // 2026-11-22 大人实测钉死：进场 4 → 狼秘技开怪盲盒 +3 → 爻秘技 +3 = 10 固定
  s.ahaCount = 0;
  s.tough = CFG.tough.bossStart;
  s.broken = false;
  s.langUltLeft = 0;
  s.langUltGain = 0;   // 无敌玩家期间累计新增隐藏分（2 魂额外回合按"保底1档 + 每再+120"判，见 B1）
  s.zhenUltLeft = 0;
  s.charge = 0;
  s.strips = 0;
  // ── 伤害层状态（2026-11-22 接入）──
  s.bossHP = DMG.bossHP.p1;
  s.phase = 1;
  s.haohuo = DMG.haohuoInit;      // 狼尊持有的好活值（强普笑点乘区用；阿哈结束池值转入）
  s.dmgDealt = { boss: 0, mob: 0 };  // 并行记账：只算数扣血，不动控制流
  s.killT = null;                 // P2 boss HP 归零的（理论）elapsed
  s.p1KillT = null;
  // 小怪存活表：acc = 已吃到的强普轮数（贪饕两段靠这个累计）
  s.mobs = {};
  for (const k of Object.keys(CFG.mobs)) s.mobs[k] = { acc: 0, dead: false, ...CFG.mobs[k] };
  s.flags.mobsCleared = false;
}

/** hooks 工厂：step=1 骨架 / 2 +资源触发 / 3 +机制闸门 */
function makeHooks(step, policyObj) {
  const BARRIER = step >= 3 ? CFG.tough.barrierUntil : -1;  // 力场闸门只在第 3 层生效

  function eName(s, k) { return (s.ents[k] && s.ents[k].name) || (CFG.units[k] && CFG.units[k].name) || k; }

  function gainLaugh(s, n, why) {
    s.laugh += n;
    if (step >= 3) {
      s.charge = (s.charge || 0) + n;   // 保姆充能（第 3 层）
      // +1e-6：同刻 FIFO 微推后——实测「点火 → 狼Q → 保姆强普」（2026-11-22），充能强普不得插队到狼Q 前
      while ((s.charge || 0) >= CFG.chargeNeed) {
        s.charge -= CFG.chargeNeed;
        s.inserts.push({ t: s.t + 1e-6, done: false, fn: () => baomuStrong(s) });
      }
    }
    s.hidden = Math.min(300, s.hidden + n);
    if (s.langUltLeft > 0) s.langUltGain = (s.langUltGain || 0) + n;  // 无敌玩家期间新增（2魂额外回合判定用）
    L(s, '账', `笑点+${n}（${why}）→池${s.laugh}／狼隐藏分${s.hidden}`);
  }

  // ── 伤害层：逐区计算 + 并行记账（不动控制流，击杀时点由 HP 账反推对账）──
  /** 易伤区 ✅总账§1.9/§5 复算闭合口径：加算（爻凶星0.16@阿哈 + 欢4魂0.1 + 菇菇0.1 + 末法0.15），
   *  狼1魂结界 = **乘算 ×1.2**（无敌玩家期间）；破韧 +100% 不进易伤区——它在受伤修正 ×2.0（§5 用 1.71~1.81×2.0 闭合 24508） */
  function vulnOf(s, opts = {}) {
    // 爻「凶星低语」+16% = 欢愉技附带 3 回合标记（爻每场阿哈都参演 → 阿哈#1 起常驻，覆盖强普窗——§5 闭合口径 1.51×1.2=1.81）
    let v = 1 + 0.16 * (s.flags.yaoMark ? 1 : 0) + 0.1 + 0.1 + 0.15;
    if (s.langUltLeft > 0) v *= 1.2;
    return v;
  }
  /** boss 受伤修正（乘算）✅总账§1.11：韧在×0.9、坚防守备×0.5、抗菌×0.56^剩余层（P1=2/P2=4，剥完=×1）、破韧窗×2.0 */
  function takenBoss(s) {
    let z = 1;
    if (!s.broken) { z *= 0.9; z *= 0.5; }
    const cap = s.phase === 1 ? 2 : 4;
    z *= Math.pow(0.56, Math.max(0, cap - s.strips));
    if (s.broken) z *= 2.0;
    return z;
  }
  /** 欢愉式伤害落地：attacker=lang/yao/huan, mult=总倍率(对单目标), target='boss'|mob key */
  function dealJoy(s, attacker, mult, target, opts = {}) {
    const joy = DMG.joyFactor[attacker];
    const crit = attacker === 'lang' ? dmg.wolfCrit(s.hidden).zone : DMG.crit[attacker];
    const lp = Math.min(opts.lp != null ? opts.lp : s.haohuo, DMG.haohuoCap);
    let res, taken;
    if (target === 'boss') {
      res = DMG.bossRes[attacker];
      const anyMobAlive = Object.keys(s.mobs).some((k) => !s.mobs[k].dead);
      if ((DMG.bossImmune[s.phase] || []).includes(attacker) && anyMobAlive) res = 0;   // 力场期属性免疫（小怪在场才开）
      taken = takenBoss(s);
    } else {
      if (DMG.mobResSelf[target] === attacker) res = 0;                  // 小怪免疫自身属性
      else res = 1.0;                                                    // 非自身属性 ×1.0 简化🟡
      taken = (s.mobs[target] && s.mobs[target].retreated) ? DMG.takenMobRetreat : DMG.takenMobFF;
    }
    const d = dmg.joyHit({
      mult, joyFactor: joy, laughLP: lp, critZone: crit, zengxiao: DMG.zengxiao,
      defZone: DMG.defZone, res, vuln: vulnOf(s, opts), taken,
      strong: opts.strong && DMG.strongBonusOn ? dmg.strongBonus(s.hidden) : null,
    });
    if (process.env.DMG_DEBUG) console.log(`    [zone] ${attacker}→${target} mult=${mult} joy=${joy} lp=${lp}(${dmg.laughZone(lp).toFixed(2)}) crit=${crit.toFixed(2)} def=${DMG.defZone} res=${res} vuln=${vulnOf(s, opts).toFixed(2)} taken=${taken} strong=${opts.strong ? dmg.strongBonus(s.hidden) : 1} → ${Math.round(d)}`);
    s.dmgDealt[target === 'boss' ? 'boss' : 'mob'] += d;
    // 扣血 + 阶段/击杀判定（并行账）
    if (target === 'boss') {
      s.bossHP -= d;
      if (s.phase === 1 && s.bossHP <= 0) {
        s.p1KillT = s.t;
        L(s, '★', `伤害账：P1 血量归零（理论转阶段 @${s.t.toFixed(1)}，实测 89 对账锚）`);
        s.phase = 2; s.bossHP = DMG.bossHP.p2; s.strips = 0; s.broken = false; s.tough = 840;
        L(s, '★', 'P2：韧 840/840 满条＋抗菌 4 层重置（P1 破韧不延续）');
        setupP2(s);
      } else if (s.phase === 2 && s.bossHP <= 0 && s.killT === null) {
        s.killT = s.t;
        L(s, '★', `伤害账：P2 boss 击杀（理论 elapsed ${s.t.toFixed(1)}）`);
      }
    } else if (s.mobs[target] && !s.mobs[target].dead) {
      const m = s.mobs[target];
      m.hp = (m.hp == null ? DMG.mobHP[target.replace('p2', '')] || DMG.mobHP.cangyi : m.hp) - d;
      if (m.p2) {
        m.cnt = (m.cnt || 0) + 2;   // 16 计数盾：欢愉伤 +2/段（挑战策略页；我方全程欢愉线）
        if (m.hp <= 0) {
          m.dead = true;
          if (s.ents[target]) s.ents[target].next = Infinity;
          L(s, '★', `伤害账：${eName(s, target)} 被击杀 @${s.t.toFixed(1)}（退散后承伤 1.3）→ 保姆白送强普`);
          baomuKillTurn(s);
        }
      } else if (m.hp <= 0) {
        L(s, '★', `伤害账：${eName(s, target)} HP 归零（理论）@${s.t.toFixed(1)}——控制流仍按实测轮数`);
      }
    }
    return d;
  }

  /** 狼欢愉技（阿哈参演 / 欢愉主Q指定共用）：+15 隐藏分 + 行迹2（按当下池值 ≥20→+20、≥40→+40）。
   *  2026-11-22 实测三验：池32→+35（67）、池47/52→+55（134）、池22→+35（184）✅。
   *  ⚠️ 池在阿哈期间不清零（实测 26→29→32，行迹2 读的是当下池值）；转好活发生在【阿哈时刻结束】
   *  伤害：变身欢愉技 6×90% 敌全体均分（🟡均分口径=总倍率÷在场目标数） */
  function langJoySkill(s, fixed, opts = {}) {
    const pool = s.laugh + (fixed || 0);
    const h = CFG.laugh.langJoy + (pool >= 20 ? CFG.laugh.trace20 : 0) + (pool >= 40 ? CFG.laugh.trace40 : 0);
    s.hidden = Math.min(300, s.hidden + h);
    L(s, '狼尊', `欢愉技：隐藏分+${h}（池${pool}${fixed ? `含爻Q固定${fixed}` : ''}）→${s.hidden}`);
    if (step >= 3 && !opts.noDmg) {
      const targets = ['boss', ...Object.keys(s.mobs).filter((k) => !s.mobs[k].dead)];
      const per = 5.4 / Math.max(1, targets.length);
      for (const tgt of targets) dealJoy(s, 'lang', per, tgt, { lp: pool, aha: true });
    }
  }

  function aha(s, fixed) {
    s.ahaCount++;
    if (step === 1) { s.sp = Math.min(CFG.sp.max, s.sp + 1); L(s, '阿哈', `【阿哈时刻#${s.ahaCount}】`); return; }
    L(s, '阿哈', `【阿哈时刻#${s.ahaCount}${fixed ? `·爻光Q额外+${fixed}` : ''}】池 ${s.laugh}${fixed ? `+${fixed}` : ''}`);
    // 参演顺序 104真珠 → 116爻光 → 120欢愉主 → 999狼尊（参演编号台账）。
    // 2026-11-22 实测：真珠/爻光参演 0 笑点（"真爻欢愉技都没变"）；欢愉主参演 +3（天赋"施放攻击后+3"不限普攻）
    s.flags.yaoMark = true;   // 爻参演「凶星低语」：敌受伤+16%（3回合，🟡按常驻近似）
    gainLaugh(s, CFG.laugh.huanA, '欢愉主参演欢愉技');
    s.sp = Math.min(CFG.sp.max, s.sp + 1); // 爻光欢愉技回 1 SP
    // 合演欢愉技回能：真珠/爻光/欢愉主各 37.3；狼尊 0（2026-11-22 实测定案）
    for (const k of ['yao', 'zhen', 'huan']) gainEnergy(s, k, CFG.units[k].energy.joy, '合演欢愉技回能');
    langJoySkill(s, fixed);
    // ── 伤害账（阿哈合演）：爻 全体100%物理+随机单体5×20%🟡(单体归boss)；欢 全体60%雷(+随机段🟡未入)；真 无伤 ──
    if (step >= 3) {
      const poolNow = s.laugh + (fixed || 0);
      const alive = Object.keys(s.mobs).filter((k) => !s.mobs[k].dead);
      dealJoy(s, 'yao', 1.0, 'boss', { lp: poolNow, aha: true });
      for (const m of alive) dealJoy(s, 'yao', 1.0, m, { lp: poolNow, aha: true });
      dealJoy(s, 'yao', 0.2 * 5, 'boss', { lp: poolNow, aha: true });
      dealJoy(s, 'huan', 0.6, 'boss', { lp: poolNow, aha: true });
      for (const m of alive) dealJoy(s, 'huan', 0.6, m, { lp: poolNow, aha: true });
    }

    // 削韧/破韧/力场属第 3 层：阿哈合演削韧 65 恒定；狼尊 +10 仅当在【无敌玩家】中；真珠 0
    if (step >= 3) {
      const strike = CFG.tough.ahaStrike + (s.langUltLeft > 0 ? CFG.tough.langAhaStrike : 0);
      if (!s.broken) {
        if (s.t < BARRIER) L(s, '阿哈', `合演削韧 ${strike}（力场锁，无效）`);
        else {
          s.tough -= strike;
          L(s, '阿哈', `合演削韧 ${strike} → 韧 ${s.tough}`);
          if (s.tough <= 0) { s.tough = 0; s.broken = true; L(s, '★', `破韧@${s.t.toFixed(1)}（合演削韧所致）`); }
        }
      }
    }
    // 阿哈时刻结束：池转好活（狼强普笑点乘区用）＋**池计入保姆充能**（实测口径：充能=累计获得笑点，
    //   极速闪充 tooltip=实时累计笑点计数器；引擎此前漏记池 → 强普全堆 88.4，2026-11-22 修）
    const consumed = s.laugh + (fixed || 0);
    s.haohuo += consumed;
    if (step >= 3) {
      s.charge = (s.charge || 0) + consumed;
      while ((s.charge || 0) >= CFG.chargeNeed) {
        s.charge -= CFG.chargeNeed;
        s.inserts.push({ t: s.t + 1e-6, done: false, fn: () => baomuStrong(s) });
      }
    }
    s.laugh = 0;
    gainLaugh(s, 4 * CFG.laugh.ahaGift, '阿哈结束赠送（4欢愉×1）');
  }

  function baomuStrong(s) {
    // 官方语义（2026-11-22 详情卡原文）：满 80 充能 → 立即获得 1 个额外回合并获得强化普攻（严格建模应走 insertTurn，
    // 现 insert 近似）；强普 = 量子伤 + 目标 HP 上限×% 真伤🟡（伤害层接）+ 剥 1 层「长效抗菌」+ 无视弱点无效强制削韧（实测 100）
    const cap = s.phase === 1 ? 2 : 4;
    const stripped = (s.strips || 0) < cap;
    if (stripped) s.strips = (s.strips || 0) + 1;
    const block = s.t < BARRIER ? '（力场锁，削韧无效）' : s.broken ? '（已破韧，削韧无意义）' : '';
    let msg = stripped ? `强普：剥减伤1层（剩${cap - s.strips}层）＋削韧${CFG.tough.baomuStrong}${block}` : `强普：无层可剥＋削韧${CFG.tough.baomuStrong}${block}`;
    if (!(s.t < BARRIER) && !s.broken) {
      s.tough -= CFG.tough.baomuStrong;
      if (s.tough <= 0) { s.tough = 0; s.broken = true; msg += ' → 破韧'; activateAll(s); }
    }
    L(s, '保姆', msg);
  }

  /** 破韧 → 末法余烬：全队激活终结技（免能量）。狼尊无能量条 → 隐藏分门槛跳过（🟡待验） */
  function activateAll(s) {
    L(s, '★', `破韧@${s.t.toFixed(1)} → 末法余烬：全队激活终结技（免能量）＋受伤+100%＋纠缠延后`);
    for (const k of ['yao', 'zhen', 'huan']) {
      const u = CFG.units[k];
      if (u.energy) s.energy[k] = u.energy.max;
    }
  }

  /** 击杀破晓成员 → 保姆立即获得 1 个可施放强化普攻的额外回合（官方首领特性原文） */
  function baomuKillTurn(s) {
    s.inserts.push({ t: s.t + 1e-5, done: false, fn: () => {
      L(s, '保姆', '击杀破晓成员 → 立即额外回合（强化普攻）');
      baomuStrong(s);
    } });
  }

  /**
   * 狼强普一轮落地后结算小怪（2026-11-22 实测 V3.1）：
   *   灰烬 1 轮死（狼一动 3+1）；赤焰贪饕两段（致死→回血→压制上限→彻底消灭），第 2 轮才死（狼二动 3+1 结束）。
   * 排轴含义：清场 AV 由"最强那只的两段"决定，不是"打完就清"。
   */
  function mobHit(s, rounds) {
    if (!s.mobs) return;
    for (const k of Object.keys(s.mobs)) {
      const m = s.mobs[k];
      if (m.dead || m.p2) continue;   // p2 小怪走 HP 账（dealJoy 内击杀判定）
      m.acc += rounds;
      if (m.acc >= m.hits) {
        m.dead = true;
        L(s, '★', `${CFG.units[k].name} 被消灭（${m.taotie ? '贪饕两段：致死→回血→压制上限→彻底消灭' : '一轮强普清场'}）`);
        s.ents[k].next = Infinity;
        baomuKillTurn(s);
      } else {
        L(s, '★', `${CFG.units[k].name} 遭致死一击 → 贪饕回血（第 ${m.acc}/${m.hits} 段，未消灭）`);
      }
    }
    if (Object.values(s.mobs).every((m) => m.dead)) s.flags.mobsCleared = true;
  }

  function cast(s, what) {
    if (what === 'yaoQ') {
      s.energy.yao = 0;
      gainLaugh(s, 5, '爻光Q');
      L(s, '爻光', '【Q】额外阿哈时刻＋全队抗穿20%（3回合）');
      s.inserts.push({ t: s.t, fn: () => aha(s, CFG.laugh.yaoQFixed), done: false });
    } else if (what === 'langQ') {
      // ── 开大瞬间产点两条（BWIKI 原文）在消耗**之前**结算：
      // 2026-11-22 实测 300→164：行迹3 +20 / 专武 +20 被 300 顶格吸收（读数不可见），消耗 136 🟡单例
      s.langUltGain = 0;
      s.langUltLeft = 1;               // 临时标记"已进入无敌玩家"，供 gainLaugh 累计 langUltGain
      s.hidden = Math.min(300, s.hidden + CFG.laugh.enterUltHidden);
      s.langUltGain += CFG.laugh.enterUltHidden;
      gainLaugh(s, CFG.laugh.langUltLC, '专武·对自身放终结技');
      s.hidden = Math.max(0, s.hidden - CFG.th.langQCost);
      // 2026-11-22 实测：狼Q 读数后立刻 +120（164→284）＝真珠Q 的**第二段**（真珠2魂额外回合）。
      //   归属挂到 zhenQ cast（见下），此处不再直录——挂在 langQ 上会导致每次开大自+120 无限循环（2026-11-22 修）
      // ── 2 魂额外回合口径（`排轴认知终版与算法` B1）──
      //   **含初始 = 保底 1 档**，无敌玩家期间每再累计 120 才 +1（实测 88.4 四轮 3+1 = 3动+1额外回合）
      const extra = 1 + Math.floor((s.langUltGain || 0) / CFG.th.langExtra);
      const hits = 3 + extra;
      s.langUltLeft = hits;
      L(s, '狼尊', `【Q】无敌玩家：消耗${CFG.th.langQCost}🟡 →${s.hidden}；强普 ${hits} 次（3+${extra}）；续好活+1回合`);
      s.ents.lang.next = s.t;   // 行动提前 100%
      // 实测（V3.1 2026-11-22）：Q 期间是"两动，每动 3+1"——第 1 动 3 次强普、第 2 动 = 2魂额外回合的 extra 次
      // 伤害账时序（实测）：轮1/2 打小怪 → 保姆强普连发破韧 → 轮3+ 全弹 boss（+2e-6 排到保姆批之后）
      const r1 = Math.min(3, hits), r2 = hits - r1;
      const doStrong = (i) => {
        L(s, '狼尊', `强普#${i}：削韧${CFG.tough.langStrong}${step >= 3 && (s.broken || s.t < BARRIER) ? '（被力场锁，无效）' : ''}`);
        if (step >= 3 && !(s.t < BARRIER) && !s.broken) {
          s.tough -= CFG.tough.langStrong;
          if (s.tough <= 0) { s.tough = 0; s.broken = true; activateAll(s); }
        }
        // ── 伤害账：100 段弹射 ×2.4%＝总倍率 240%，单体独吃（🟡分摊口径另测）──
        //   瞄准策略：韧在期→打首个存活小怪（涨 16 计数促退散＋杀退散怪）；破韧后→全弹 boss（吃满受伤+100%）
        if (step >= 3) {
          const alive = Object.keys(s.mobs).filter((k) => !s.mobs[k].dead);
          const tgt = s.broken ? 'boss' : (alive[0] || 'boss');
          const d = dealJoy(s, 'lang', 2.4, tgt, { strong: true });
          (s.strongRounds = s.strongRounds || []).push({ t: s.t, tgt, d: Math.round(d) });
          if (s.langUltLeft > 0) {
            s.langUltLeft--; s.langChainEnd = s.t;   // 无敌玩家随强普轮消耗（Q 打完=图标消失 → 允许 Q#2，V5 判据）；链尾时间供现实档判据
            // 现实档（gap88）：链尾 +0.6 AV 自动补Q——policy 只在有人行动时轮询，等不到槽；
            // 复现实测 Q#1@88.4 → Q#2@89 的手动插入节奏（背靠背=乱轴口径，隔 0.6 = 不叠无敌玩家）
            if (s.langUltLeft === 0 && policyObj.langQ === 'gap88') {
              const tEnd = s.t;
              s.inserts.push({ t: tEnd + 0.6, done: false, fn: () => {
                if (s.hidden >= CFG.th.langQ && s.langUltLeft === 0 && s.t >= tEnd + 0.6 - 1e-9) cast(s, 'langQ');
              } });
            }
          }
          mobHit(s, 1);   // P1 小怪按实测轮数结算（灰烬1/赤焰2）；P2 小怪走 HP 账（dealJoy 内）
        }
      };
      for (let i = 0; i < r1; i++) s.inserts.push({ t: s.t + i * 1e-8 + (i >= 2 ? 2e-6 : 0), done: false, fn: () => doStrong(i + 1) });
      if (r2 > 0) {
        s.inserts.push({ t: s.t + 1.5e-7, done: false, fn: () => { s.ents.lang.turns++; L(s, '狼尊', '【2魂额外回合（第2动）】额外回合'); } });
        for (let i = 0; i < r2; i++) s.inserts.push({ t: s.t + 2e-6 + 2e-7 + i * 1e-8, done: false, fn: () => doStrong(r1 + i + 1) });
      }
      gainEnergy(s, 'zhen', CFG.artBarrier, '艺术壁垒（底本狼尊开大）');
    } else if (what === 'zhenQ') {
      s.energy.zhen = 0;
      s.zhenUltLeft = 3;
      L(s, '真珠', '【Q】底本=狼尊：提前30%＋额外回合（+120笑点）；2魂其余欢愉也提前');
      advance(s, 'lang', CFG.adv.zhenQBase, '底本提前');
      advance(s, 'yao', CFG.adv.zhenQE2, '2魂');
      advance(s, 'huan', CFG.adv.zhenQE2, '2魂');
      insertTurn(s, 'lang', '真珠底本额外回合', () => {});
      gainLaugh(s, 120, '真珠Q第一段');
      // 第二段 +120（真珠2魂「额外回合」）：实测排在狼Q cast 消耗之后到账（300→164→284）。
      //   +3e-6 保证排在狼Q 强普链插入之后；落到无敌玩家内 → langUltGain 累计（2魂折算口径🟡读2 定）
      s.inserts.push({ t: s.t + 3e-6, done: false, fn: () => gainLaugh(s, 120, '真珠Q第二段（2魂额外回合）') });
      advance(s, 'zhen', CFG.adv.wind, '翔鹰4');
    } else if (what === 'huanQ') {
      s.energy.huan = 0;
      s.sp = Math.min(CFG.sp.max, s.sp + 1);
      // 2026-11-22 实测（88.4 段）：Q → 池+12（10→22）、狼隐藏+5（144→149）——
      //   拆分口径🟡（"获5+固定7"还是"获12只转5"），先按观测直录
      s.laugh += 12; s.charge = (s.charge || 0) + 12;
      s.hidden = Math.min(300, s.hidden + 5);
      L(s, '欢愉主', `【Q】池+12／狼隐藏+5🟡 →池${s.laugh}／狼${s.hidden}；指定狼尊立即施放欢愉技＋暴伤50%；SP+1`);
      langJoySkill(s, 0);   // 强制狼欢愉技：实测 池22 → +15+20=+35 → 184 ✅
    }
  }

  function policy(s) {
    if (step === 1) return [];  // 骨架层：零拉条零机制
    const th = CFG.th, p = policyObj || GREEDY;
    const acts = [];
    // 欢愉主Q：hold88 = 持有到力场解除拍（@88.4 垫大链：欢Q→点火→狼Q）。
    // 2026-11-22 合演回能 37.3 落定后他 @64.1 能量即满——能量到账≠Q提前放，S4/S1/S2 设计都持有到垫大拍
    if (step >= 3 && p.huanQ === 'hold88' && s.t < CFG.tough.barrierUntil) { /* 持有 */ }
    else if (s.energy.huan >= th.huanQ) acts.push('huanQ');
    if (s.energy.yao >= th.yaoQ) {
      if (step >= 3 && p.yaoQ === 'late' && s.t < 79) { /* 现轴：压到 @81 自己行动后 */ }
      else acts.push('yaoQ');
    }
    if (s.hidden >= th.langQ && s.langUltLeft === 0) {
      let ok = true;
      if (step >= 3) {
        if (p.langQ === 'barrier' && s.t < CFG.tough.barrierUntil) ok = false;
        if (p.langQ === 'afterZhen' && s.zhenUltLeft === 0) ok = false;
        // 现实档 'gap88'：P1 内守力场闸门；P1 后狼Q 链尾至少隔 0.6 AV（实测 Q#1@88.4→Q#2@89 节奏；
        //   背靠背=实测乱轴口径，见 V5 判据）
        if (p.langQ === 'gap88') {
          if (s.t < CFG.tough.barrierUntil) ok = false;
          if (s.t < (s.langChainEnd || 0) + 0.6) ok = false;
        }
      }
      if (ok) acts.push('langQ');
    }
    if (s.energy.zhen >= th.zhenQ && s.zhenUltLeft === 0) {
      let ok = true;
      if (step >= 3) {
        if (p.zhenQ === 'barrier' && s.t < CFG.tough.barrierUntil) ok = false;
        if (p.zhenQ === 'after128' && s.t < 128) ok = false;
      }
      if (ok) acts.push('zhenQ');
    }
    const order = ['huanQ', 'yaoQ', 'zhenQ', 'langQ'];
    return acts.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  function onTurn(s, k) {
    const e = s.ents[k], u = CFG.units[k];
    e.turns++;
    if (k === 'aha') { aha(s, 0); e.next = s.t + e.period; return; }
    if (k === 'boss') {
      e.next = s.t + e.period;
      // 2026-11-22 详情卡原文：1动=值日准备中（蜂巢擦掌·弱点无效，无伤害）；2动=饱和式大扫除！（AOE+笑点，笑点在 @58 插入里结算）
      const skill = e.turns === 1 ? '值日准备中（蜂巢擦掌·弱点无效）'
        : e.turns === 2 ? '饱和式大扫除！（AOE＋我方+3笑点，见插入账）'
        : e.turns === 3 ? 'P2 值日准备中（锁弱点 ✅实测与 P1 同构）'
        : e.turns === 4 ? 'P2 AOE（泼脏水🟡，+3笑点见插入账）'
        : '🟡轮转待钉（无双抛洗渍/高级肥皂泡均产笑点）';
      L(s, u.name, `第${e.turns}动（敌方）：${skill}`);
      return;
    }
    if (k === 'baomu') {
      if (step >= 2) gainLaugh(s, CFG.laugh.baomuA, '保姆普通A');  // ✅详情卡原文「普攻…产生一定笑点」+实测@42 狼16→21 双证；数量恒5🟡（@111 充能值+5跳变可验）、强普是否也产🟡
      L(s, '保姆', `普通A${step >= 3 ? `（充能 ${(s.charge || 0).toFixed(0)}/80）` : ''}`);
      e.next = s.t + e.period; return;
    }
    if (s.mobs[k]) {
      const m = s.mobs[k];
      const nm = u ? u.name : (e.name || k);
      if (m.dead) { e.next = Infinity; return; }
      if (!m.retreated && (m.cnt || 0) >= 16) {
        m.retreated = true;
        L(s, nm, `【破晓退散】16 计数满 → 解除力场＋掉血＋挂失意（此后承伤 ×${DMG.takenMobRetreat}）`);
      } else {
        L(s, nm, `单体攻击（敌方，随机目标🟡）${m.p2 && (m.cnt || 0) ? `［盾 ${(m.cnt || 0)}/16］` : ''}`);
      }
      e.next = s.t + (m.period || e.period); return;
    }

    // 我方四人：爻光恒 A（产笑点3+回能）；狼 SP>2 用 E（狼E产5笑点，BWIKI 原文）；
    // 真珠 E/强化Q 全程 0 笑点（2026-11-22 实测）——她不产笑点，动作只看生存/循环需求；
    // 欢愉主恒 A（产笑点3，实测锚点；SP 溢出接受，旧「SP满用E」与 f0030 欢A@34 矛盾）。
    let act = 'A';
    if (k === 'lang') act = s.sp > 2 ? 'E' : 'A';
    if (k === 'zhen') act = e.turns === 1 ? 'A' : (s.sp > 2 ? 'E' : 'A');
    if (k === 'huan') act = 'A';
    if (act === 'E') s.sp = Math.max(0, s.sp - 1);
    if (act === 'A') s.sp = Math.min(CFG.sp.max, s.sp + 1);  // 普攻+1 SP（2026-11-22 大人揪出的重构丢失项，v0.1 本有）
    if (step >= 2) {
      if (k !== 'lang') gainEnergy(s, k, u.energy[act], act);
      if (k === 'yao') gainLaugh(s, CFG.laugh.yaoA, '爻光A');
      if (k === 'lang' && act === 'E') gainLaugh(s, CFG.laugh.langE, '狼尊E（BWIKI：获得5笑点）');
      if (k === 'huan' && act === 'A') gainLaugh(s, CFG.laugh.huanA, '欢愉主A');
      // 真珠：0 笑点（E/强化Q 实测均不给，2026-11-22）——故意没有她的 gainLaugh 行
    }
    if (k === 'zhen' && s.zhenUltLeft > 0) s.zhenUltLeft--;
    L(s, u.name, `${act}（SP ${s.sp}）`);
    e.next = s.t + e.period;
  }

  return { policy, cast, onTurn, stageInserts };

  /** P2 转阶段：召唤破晓战队 ×4（行动条连续；进场条按 P1 召唤物口径类比，P2 实测 38/76/39 三读） */
  function setupP2(s) {
    const T = s.t;
    const p2def = {
      p2hui: { name: '灰烬·P2',   spd: 156.25, first: 38, period: 64, hp: DMG.mobHP.hui },
      p2bm:  { name: '保姆·P2',   spd: 144.9,  first: 42, period: 69, hp: DMG.mobHP.cangyi },   // 保姆小怪 HP🟡 暂用苍翼档
      p2chi: { name: '赤焰·P2',   spd: 156.25, first: 77, period: 64, hp: DMG.mobHP.chi },
      p2cy:  { name: '苍翼·P2',   spd: 156.25, first: 38, period: 64, hp: DMG.mobHP.cangyi },   // 苍翼进场条/HP🟡
    };
    for (const [k, d] of Object.entries(p2def)) {
      s.mobs[k] = { acc: 0, dead: false, hp: d.hp, cnt: 0, retreated: false, p2: true, period: d.period, hits: 1, taotie: false };
      s.ents[k] = { name: d.name, spd: d.spd, period: d.period, next: T + d.first, turns: 0 };
    }
    L(s, '★', `P2 小怪×4 召唤 @${T.toFixed(1)}（首动 T+38/T+42/T+77/T+38🟡）；boss 行动条连续（下一动 @${s.ents.boss.next.toFixed(1)}）`);
  }

  /** 第 3 层机制插入：boss@58 AOE、破晓清场 @112（🟡 时点暂定）。createSim 之后、run 之前调用一次 */
  function stageInserts(s) {
    if (step < 3) return;
    // 帕姆王二动 @58 =【饱和式大扫除！】（一动"值日准备中"原文：下次行动时施放——帧证周期 58 双证）：
    //   对我方全体大量量子伤 + **并使我方获得笑点**（boss 技能原文，hsr-trend 3022 / 详情卡；2026-11-22 实测 +3，池26→29）
    //   AOE 受击回能 = 12.4 全队；灵魂修正码（单体→真珠）受击档 🟡 未入账
    s.inserts.push({ t: 58.0, done: false, fn: () => {
      core.hit(s, ['lang', 'yao', 'zhen', 'huan'], 'boss@58 饱和式大扫除！（AOE）', CFG.hit);
      gainLaugh(s, CFG.laugh.bossAoe, 'boss技能原文「并使我方获得笑点」');
    } });
    // 破晓小怪 ×4 被清 → 白送 4 发强普（🟡 时点按 @112 暂定，实测可改）；灰烬/赤焰退场
    // 兜底：实测（V3.1）@88.4~89 狼两动 3+1 已经把灰烬/赤焰清掉，这里只在"漏杀"时补，避免小怪永远出手。
    // 旧版把它当主路径（@112 白送 4 强普）已被实测推翻。
    // 破晓退散标记 @81（🟡时点按 1919 帧"退散后条目同步@1872"证据反推 ≤81）：失意挂身、力场解除——
    //   伤害账按 takenMobRetreat 记（灰烬 1 轮死由此闭合：663k×(1.3/0.25)=3.45M ≥ 314.6万 ✓）
    s.inserts.push({ t: 81, done: false, fn: () => {
      for (const k of Object.keys(s.mobs)) if (!s.mobs[k].dead) { s.mobs[k].retreated = true; L(s, CFG.units[k].name, '【破晓退散】解除力场＋挂失意（伤害账按退散口径）'); }
    } });
    // P2 boss AOE @174（实测口径：P2 首动 @116 值日准备中锁弱点 → 下次行动 AOE；周期 58 连续）
    s.inserts.push({ t: 174.0, done: false, fn: () => {
      core.hit(s, ['lang', 'yao', 'zhen', 'huan'], 'boss@174 P2 AOE（泼脏水🟡）', CFG.hit);
      gainLaugh(s, CFG.laugh.bossAoe, 'P2 boss AOE「并使我方获得笑点」');
    } });
    s.inserts.push({ t: 112, done: false, fn: () => {
      if (s.flags.mobsCleared) return;
      L(s, '保姆', '（兜底）破晓成员清场 → 白送强普');
      s.flags.mobsCleared = true;
      for (const k of ['hui', 'chi']) { if (s.mobs[k]) s.mobs[k].dead = true; s.ents[k].next = Infinity; }
      s.charge = (s.charge || 0) + 320;
      while (s.charge >= CFG.chargeNeed) { s.charge -= CFG.chargeNeed; s.inserts.push({ t: s.t + 1e-6, done: false, fn: () => baomuStrong(s) }); }
    } });
  }
}

// ---------------- 统计与政策（第 4 层） ----------------
function stats(s) {
  const ahaLogs = s.log.filter((l) => /阿哈时刻#/.test(l.msg));
  const broken = s.log.find((l) => /破韧/.test(l.msg));
  const zhenQ = s.log.filter((l) => l.who === '真珠' && /【Q】/.test(l.msg));
  const langQ = s.log.filter((l) => l.who === '狼尊' && /【Q】/.test(l.msg));
  const validStrong = s.log.filter((l) => /强普#/.test(l.msg) && !/无效/.test(l.msg)).length;
  return {
    aha: ahaLogs.length,
    ahaTimes: ahaLogs.map((l) => l.t.toFixed(0)).join('/'),
    langQ1: langQ[0] ? langQ[0].t.toFixed(1) : '—',
    langQn: langQ.length,
    zhenQ1: zhenQ[0] ? zhenQ[0].t.toFixed(1) : '—',
    zhenQn: zhenQ.length,
    broken: broken ? broken.t.toFixed(1) : '未破',
    validStrong,
    hiddenEnd: s.hidden,
  };
}

const POLICIES = {
  S1_现轴: { yaoQ: 'late', langQ: 'barrier', zhenQ: 'after128', huanQ: 'hold88' },
  S2_爻光早开: { yaoQ: 'early', langQ: 'barrier', zhenQ: 'after128', huanQ: 'hold88' },
  S3_贪心能放就放: { yaoQ: 'early', langQ: 'now', zhenQ: 'now', huanQ: 'now' },
  S4_早开_大等力场: { yaoQ: 'early', langQ: 'barrier', zhenQ: 'barrier', huanQ: 'hold88' },
  S5_现实_狼Q隔帧: { yaoQ: 'early', langQ: 'gap88', zhenQ: 'barrier', huanQ: 'hold88' },    // 现实档：P1 纪律照旧，P2 狼Q 隔帧（复现实测 Q#2@89）
};
const DEFAULT_POLICY = 'S4_早开_大等力场';  // V4 对账胜出（2026-11-22）

module.exports = { CFG, GREEDY, initState, makeHooks, stats, POLICIES, DEFAULT_POLICY };
