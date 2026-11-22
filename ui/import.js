/* starRailRotation · 面板导入
 * 主通道：Mihomo sr_info_parsed（返回已汇总的最终面板），支持国服/国际服
 * 兜底：米游社官方接口，经本地代理带 Cookie + 设备头，返回 box/养成零件
 */

const PROXY_BASE = "http://127.0.0.1:8792";
const SRR_STORE_KEY = "srr-config-v1";
const COLORS = ["#7fd4c1", "#e3c477", "#c89be0", "#7fa8e0", "#e0796f", "#8fc7d4"];

const $ = (id) => document.getElementById(id);

// 字段显示顺序与中文名（Mihomo statistics[].field）
const STAT_FIELDS = [
  ["spd", "速度", true],
  ["atk", "攻击", true],
  ["crit_rate", "暴击率", false],
  ["crit_dmg", "暴击伤害", false],
  ["hp", "生命", false],
  ["def", "防御", false],
  ["break_dmg", "击破特攻", false],
  ["sp_rate", "充能效率", false],
  ["effect_hit", "效果命中", false],
  ["effect_res", "效果抵抗", false],
  ["heal_rate", "治疗加成", false],
];

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function regionOf(uid) {
  const f = String(uid).trim().charAt(0);
  const map = {
    "0": "测试服", "1": "国服·官服", "2": "国服·官服", "5": "国服·渠道服",
    "6": "国际服·美洲", "7": "国际服·欧洲", "8": "国际服·亚洲", "9": "国际服·港澳台",
  };
  return map[f] || "未知";
}

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = "fetch-status" + (kind ? " " + kind : "");
}

function statsToMap(statistics) {
  const m = {};
  (statistics || []).forEach(s => {
    if (s && s.field) m[s.field] = s;
  });
  return m;
}

function normalizeMihomo(data) {
  if (!data || !Array.isArray(data.characters)) throw new Error("返回结构不正确：缺少 characters 数组");
  const player = data.player || {};
  const chars = data.characters.map(c => {
    const st = statsToMap(c.statistics);
    return {
      id: c.id,
      name: c.name || ("角色" + c.id),
      rarity: c.rarity,
      level: c.level,
      rank: c.rank || 0,
      path: c.path && c.path.name ? c.path.name : "",
      element: c.element && c.element.name ? c.element.name : "",
      lightCone: c.light_cone ? c.light_cone.name : "",
      lcRank: c.light_cone ? (c.light_cone.rank || 1) : 0,
      sets: (c.relic_sets || []).filter(s => s && s.num).map(s => `${s.name}×${s.num}`),
      stats: st,
      spd: st.spd ? st.spd.value : null,
    };
  });
  return { player, chars };
}

function renderMihomo(result) {
  const box = $("char-results");
  const { player, chars } = result;
  const uidLabel = player.uid || $("uid-input").value.trim();
  let html = `<div class="empty-hint">${escapeHtml(player.nickname || "玩家")} · UID ${escapeHtml(uidLabel)} · 展柜 ${chars.length} 人（速度为游戏内最终面板值）</div>`;
  chars.forEach((c, i) => {
    const color = COLORS[i % COLORS.length];
    const statsHtml = STAT_FIELDS.filter(([f]) => c.stats[f]).map(([f, label, hi]) => {
      const s = c.stats[f];
      const shown = s.display != null ? s.display : (typeof s.value === "number" ? s.value.toFixed(1) : s.value);
      return `<div class="pc-stat ${hi ? "hi" : ""}"><span class="k">${label}</span><span class="v">${escapeHtml(shown)}</span></div>`;
    }).join("");
    const canFill = c.spd != null && Number(c.spd) > 0;
    html += `
      <div class="pc-card" style="--slot-color:${color}">
        <div class="pc-head">
          <span class="pc-name">${escapeHtml(c.name)}</span>
          <span class="pc-meta">Lv.${escapeHtml(c.level)} · ${c.rank}魂 · ${"★".repeat(c.rarity || 0)}</span>
        </div>
        <div class="pc-sub">${escapeHtml(c.path)} / ${escapeHtml(c.element)}${c.lightCone ? " · 光锥「" + escapeHtml(c.lightCone) + "」" + (c.lcRank > 1 ? " 叠" + c.lcRank : "") : ""}</div>
        <div class="pc-stats">${statsHtml || '<div class="pc-stat"><span class="k">无面板数据</span></div>'}</div>
        ${c.sets.length ? `<div class="pc-sets">套装：${c.sets.map(escapeHtml).join(" · ")}</div>` : ""}
        <div class="pc-actions">
          <button class="btn-ghost" type="button" data-fill="${i}" ${canFill ? "" : "disabled"}>${canFill ? "填入排轴器" : "无速度数据"}</button>
        </div>
      </div>`;
  });
  box.innerHTML = html;
  box.querySelectorAll("[data-fill]").forEach(btn => {
    btn.addEventListener("click", () => fillToRotation(chars[Number(btn.dataset.fill)]));
  });
}

function fillToRotation(char) {
  let cfg = null;
  try {
    const raw = localStorage.getItem(SRR_STORE_KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch (_) {}
  if (!cfg || !Array.isArray(cfg.chars)) {
    cfg = { chars: [], steps: 20, initSp: 3, maxSp: 5 };
  }
  // 找同名槽覆盖，否则找第一个未启用的占位，否则追加（最多 6 槽）
  let slot = cfg.chars.find(c => c.name === char.name);
  if (!slot) slot = cfg.chars.find(c => !c.on);
  if (!slot && cfg.chars.length < 6) {
    slot = { name: char.name, spd: 0, init: 0, mode: "auto", on: false };
    cfg.chars.push(slot);
  }
  if (!slot) {
    if (!confirm("6 个槽已满，替换第 1 个槽？")) return;
    slot = cfg.chars[0];
  }
  slot.name = char.name;
  slot.spd = Math.round(Number(char.spd) * 100) / 100;
  slot.on = true;
  try { localStorage.setItem(SRR_STORE_KEY, JSON.stringify(cfg)); } catch (_) {}
  location.href = "index.html";
}

async function fetchMihomo(uid, viaProxy) {
  const url = viaProxy
    ? `${PROXY_BASE}/api/mihomo?uid=${encodeURIComponent(uid)}`
    : `https://api.mihomo.me/sr_info_parsed/${encodeURIComponent(uid)}?lang=cn`;
  const resp = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}，请确认 UID 正确且游戏内已开启角色展示`);
  return resp.json();
}

async function doFetch() {
  const uid = $("uid-input").value.trim();
  const st = $("fetch-status");
  if (!/^\d{6,10}$/.test(uid)) {
    setStatus(st, "请输入 6–10 位数字 UID", "err");
    return;
  }
  $("region-badge").textContent = "区服：" + regionOf(uid);
  $("api-url-hint").textContent = `https://api.mihomo.me/sr_info_parsed/${uid}?lang=cn`;
  setStatus(st, "拉取中…", "");
  try {
    const data = await fetchMihomo(uid, $("via-proxy").checked);
    if (data && (data.detail || data.message)) {
      throw new Error(data.detail || data.message);
    }
    const result = normalizeMihomo(data);
    renderMihomo(result);
    setStatus(st, `成功：展柜 ${result.chars.length} 人`, "ok");
  } catch (e) {
    setStatus(st, "失败：" + e.message + "（可勾选本地代理，或手动粘贴 JSON）", "err");
    $("char-results").innerHTML = '<div class="empty-hint">拉取失败，见上方提示。</div>';
  }
}

function parseManual() {
  const st = $("fetch-status");
  const raw = $("manual-json").value.trim();
  if (!raw) { setStatus(st, "请先粘贴 JSON", "err"); return; }
  try {
    const data = JSON.parse(raw);
    const result = normalizeMihomo(data);
    renderMihomo(result);
    setStatus(st, `解析成功：展柜 ${result.chars.length} 人`, "ok");
  } catch (e) {
    setStatus(st, "解析失败：" + e.message, "err");
  }
}

async function proxyAlive() {
  try {
    const resp = await fetch(`${PROXY_BASE}/health`, { signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined });
    return resp.ok;
  } catch (_) { return false; }
}

async function mysPost(path, body) {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

async function doMysRoles() {
  const st = $("mys-status");
  const cookie = $("cookie-input").value.trim();
  if (!cookie) { setStatus(st, "请先粘贴 Cookie", "err"); return; }
  setStatus(st, "查询账号…", "");
  try {
    const data = await mysPost("/api/roles", { cookie });
    const roles = data.roles || [];
    if (!roles.length) { setStatus(st, "Cookie 未关联星铁账号，或已过期", "err"); return; }
    $("box-results").innerHTML = roles.map(r => `
      <div class="pc-card" style="--slot-color:var(--gold)">
        <div class="pc-head"><span class="pc-name">${escapeHtml(r.nickname || "账号")}</span><span class="pc-meta">Lv.${escapeHtml(r.level)}</span></div>
        <div class="pc-sub">UID ${escapeHtml(r.game_uid)} · region ${escapeHtml(r.region)}</div>
        <div class="pc-actions"><button class="btn-ghost" type="button" data-uid="${escapeHtml(r.game_uid)}" data-region="${escapeHtml(r.region)}">查这个号的 box</button></div>
      </div>`).join("");
    $("box-results").querySelectorAll("[data-uid]").forEach(btn => {
      btn.addEventListener("click", () => {
        $("uid-input").value = btn.dataset.uid;
        doMysBox();
      });
    });
    setStatus(st, `找到 ${roles.length} 个账号`, "ok");
  } catch (e) {
    setStatus(st, "查询失败：" + e.message + "（确认代理已启动）", "err");
  }
}

async function doMysBox() {
  const st = $("mys-status");
  const cookie = $("cookie-input").value.trim();
  const uid = ($("uid-input").value.trim() || "");
  if (!cookie) { setStatus(st, "请先粘贴 Cookie", "err"); return; }
  if (!uid) { setStatus(st, "请在上方填 UID，或先查账号", "err"); return; }
  setStatus(st, "查询 box…", "");
  try {
    const data = await mysPost("/api/box", { cookie, uid });
    const avatars = (data.avatars || []).filter(a => a.is_own || Number(a.first_meet_time) > 0);
    if (!avatars.length) { setStatus(st, "未读到角色，可能 Cookie 无权限或接口已变更", "err"); return; }
    $("box-results").innerHTML = `<div class="empty-hint">拥有 ${avatars.length} 名角色（米游社仅给养成零件，无最终面板）</div>` +
      avatars.map((a, i) => {
        const color = COLORS[i % COLORS.length];
        return `<div class="pc-card" style="--slot-color:${color}">
          <div class="pc-head"><span class="pc-name">${escapeHtml(a.item_name)}</span><span class="pc-meta">Lv.${escapeHtml(a.cur_level)}/${escapeHtml(a.max_level)} · ${escapeHtml(a.rank)}魂</span></div>
          <div class="pc-sub">${escapeHtml(a.avatar_base_type || "")} / ${escapeHtml(a.damage_type || "")} · ${a.is_own ? "已拥有" : ""}</div>
        </div>`;
      }).join("");
    setStatus(st, `拥有 ${avatars.length} 名角色`, "ok");
  } catch (e) {
    setStatus(st, "查询失败：" + e.message, "err");
  }
}

function bind() {
  $("fetch-btn").addEventListener("click", doFetch);
  $("uid-input").addEventListener("keydown", e => { if (e.key === "Enter") doFetch(); });
  $("uid-input").addEventListener("input", () => {
    const v = $("uid-input").value.trim();
    $("region-badge").textContent = v ? "区服：" + regionOf(v) : "区服：—";
  });
  $("parse-manual-btn").addEventListener("click", parseManual);
  $("mys-roles-btn").addEventListener("click", doMysRoles);
  $("mys-box-btn").addEventListener("click", doMysBox);
}

async function init() {
  bind();
  const alive = await proxyAlive();
  $("proxy-status").textContent = alive ? "代理：已就绪 ✓" : "代理：未启动";
  $("proxy-status").className = "result-meta" + (alive ? " ok" : "");
}
init();
