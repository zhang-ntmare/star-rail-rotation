/* starRailRotation · 排轴引擎 v0.1
 * 模型：行动条进度 0..10000，周期 = 10000 / SPD
 * 推进：每步找最先到 10000 者出手，全体按其所需时间前进，出手者归零
 * SP：战技 -1（不足则强制普攻），普攻 +1，自动 = SP 足够 2 点则战技
 */

const CYCLE = 10000;
const COLORS = ["#7fd4c1", "#e3c477", "#c89be0", "#7fa8e0"];
const STORE_KEY = "srr-config-v1";

const SLOTS = [
  { name: "角色 A", spd: 134, init: 0, mode: "auto" },
  { name: "角色 B", spd: 101, init: 0, mode: "auto" },
  { name: "角色 C", spd: 160, init: 0, mode: "basic" },
  { name: "角色 D", spd: 98,  init: 0, mode: "auto" },
  { name: "角色 E", spd: 120, init: 0, mode: "auto" },
  { name: "角色 F", spd: 145, init: 0, mode: "auto" },
];

const $ = (id) => document.getElementById(id);
const DEFAULT_CFG = {
  chars: SLOTS.map(s => ({ ...s, on: true })),
  steps: 20, initSp: 3, maxSp: 5,
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && Array.isArray(c.chars) && c.chars.length) return c;
    }
  } catch (_) {}
  return JSON.parse(JSON.stringify(DEFAULT_CFG));
}
function save(cfg) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch (_) {}
}

let cfg = load();

function renderChars() {
  const box = $("char-list");
  box.innerHTML = "";
  cfg.chars.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = "char-card";
    el.style.setProperty("--slot-color", COLORS[i % COLORS.length]);
    el.innerHTML = `
      <div class="card-top">
        <input type="checkbox" ${c.on ? "checked" : ""} data-i="${i}" data-k="on" aria-label="启用">
        <input class="slot-name" type="text" value="${escapeHtml(c.name)}" data-i="${i}" data-k="name">
        <span class="slot-badge">槽 ${i + 1}</span>
      </div>
      <div class="card-fields">
        <label>速度 SPD<input type="number" min="1" max="300" step="1" value="${c.spd}" data-i="${i}" data-k="spd"></label>
        <label>初始条 %<input type="number" min="0" max="99" step="1" value="${c.init}" data-i="${i}" data-k="init"></label>
        <label>行动偏好
          <select data-i="${i}" data-k="mode">
            <option value="auto"  ${c.mode === "auto" ? "selected" : ""}>自动(SP≥2战技)</option>
            <option value="skill" ${c.mode === "skill" ? "selected" : ""}>优先战技</option>
            <option value="basic" ${c.mode === "basic" ? "selected" : ""}>优先普攻</option>
          </select>
        </label>
      </div>`;
    box.appendChild(el);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function simulate() {
  const active = cfg.chars.map((c, i) => ({ ...c, idx: i, on: c.on && Number(c.spd) > 0 })).filter(c => c.on);
  if (!active.length) return { rows: [], stats: null, err: "至少启用一名角色" };

  const steps = Math.max(1, Math.min(80, Number(cfg.steps) || 20));
  const maxSp = Math.max(1, Number(cfg.maxSp) || 5);
  let sp = Math.max(0, Math.min(maxSp, Number(cfg.initSp) || 0));

  const state = active.map(c => ({
    ...c,
    progress: (Number(c.init) || 0) / 100 * CYCLE,
    acts: 0,
    skills: 0,
    basics: 0,
  }));

  const rows = [];
  let t = 0;

  for (let step = 1; step <= steps; step++) {
    let first = null, minDt = Infinity;
    for (const s of state) {
      const dt = (CYCLE - s.progress) / s.spd;
      if (dt < minDt - 1e-9) { minDt = dt; first = s; }
    }
    if (!first || !isFinite(minDt)) break;

    t += minDt;
    for (const s of state) s.progress += s.spd * minDt;
    first.progress = 0;

    let act;
    if (first.mode === "skill") act = "skill";
    else if (first.mode === "basic") act = "basic";
    else act = (sp >= 2 ? "skill" : "basic");

    const spBefore = sp;
    if (act === "skill") {
      if (sp >= 1) { sp -= 1; first.skills++; }
      else { act = "basic"; sp = Math.min(maxSp, sp + 1); first.basics++; }
    } else {
      sp = Math.min(maxSp, sp + 1);
      first.basics++;
    }
    sp = Math.max(0, Math.min(maxSp, sp));
    const delta = sp - spBefore;
    first.acts++;

    rows.push({
      step, t, name: first.name, color: COLORS[first.idx % COLORS.length],
      act, delta, sp, spd: first.spd,
    });
  }

  return { rows, stats: { totalTime: t, active: state } };
}

function renderResult(res) {
  if (res.err) {
    $("axis-body").innerHTML = `<tr><td colspan="6" class="empty">${res.err}</td></tr>`;
    $("stats").innerHTML = "";
    $("legend").innerHTML = "";
    $("result-meta").textContent = "配置无效";
    return;
  }
  const { rows, stats } = res;
  if (!rows.length) return;

  $("result-meta").textContent = `共 ${rows.length} 步行动`;
  const last = rows[rows.length - 1];
  const skillCount = rows.filter(r => r.act === "skill").length;
  const basicCount = rows.filter(r => r.act === "basic").length;
  $("stats").innerHTML = `
    <div class="stat-box"><div class="num">${last.t.toFixed(1)}</div><div class="lbl">总行动值时间</div></div>
    <div class="stat-box"><div class="num">${skillCount}</div><div class="lbl">战技次数</div></div>
    <div class="stat-box"><div class="num">${basicCount}</div><div class="lbl">普攻次数</div></div>`;

  $("axis-body").innerHTML = rows.map(r => `
    <tr>
      <td>${r.step}</td>
      <td>${r.t.toFixed(1)}</td>
      <td><span class="dot" style="background:${r.color}"></span>${escapeHtml(r.name)}</td>
      <td class="${r.act === "skill" ? "act-skill" : "act-basic"}">${r.act === "skill" ? "战技" : "普攻"}</td>
      <td class="${r.delta > 0 ? "sp-up" : "sp-down"}">${r.delta > 0 ? "+" : ""}${r.delta}</td>
      <td>${r.sp}</td>
    </tr>`).join("");

  $("legend").innerHTML = stats.active.map(s => `
    <div class="legend-item" style="--slot-color:${COLORS[s.idx % COLORS.length]}">
      <b>${escapeHtml(s.name)}</b> · SPD ${s.spd} · 周期 ${(CYCLE / s.spd).toFixed(1)} · 出手 ${s.acts} 次
    </div>`).join("");
}

function bind() {
  $("char-list").addEventListener("input", e => {
    const i = e.target.dataset.i, k = e.target.dataset.k;
    if (i === undefined) return;
    const v = e.target.type === "checkbox" ? e.target.checked
            : k === "spd" || k === "init" ? Number(e.target.value)
            : e.target.value;
    cfg.chars[Number(i)][k] = v;
    save(cfg);
  });
  ["steps", "init-sp", "max-sp"].forEach(id => {
    $(id).addEventListener("input", () => {
      cfg.steps = Number($("steps").value);
      cfg.initSp = Number($("init-sp").value);
      cfg.maxSp = Number($("max-sp").value);
      save(cfg);
    });
  });
  $("run-btn").addEventListener("click", () => {
    const s = $("steps").value, i = $("init-sp").value, m = $("max-sp").value;
    cfg.steps = Number(s); cfg.initSp = Number(i); cfg.maxSp = Number(m);
    save(cfg);
    renderResult(simulate());
  });
  $("reset-btn").addEventListener("click", () => {
    cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
    save(cfg);
    $("steps").value = cfg.steps;
    $("init-sp").value = cfg.initSp;
    $("max-sp").value = cfg.maxSp;
    renderChars();
    renderResult(simulate());
  });
}

function init() {
  $("steps").value = cfg.steps;
  $("init-sp").value = cfg.initSp;
  $("max-sp").value = cfg.maxSp;
  renderChars();
  bind();
  renderResult(simulate());
}
init();
