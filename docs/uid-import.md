# UID 面板导入功能说明

> 落地日期：2026-11-21　对应交付：`ui/import.html` / `ui/import.js` / `tools/mys_proxy.py`
> 定位：把「角色练度 → 面板数值」这一步交给现成服务，工具只做拉取 + 解析 + 填入排轴器。

## 1. 为什么这样做（结论与依据）

调研发现（详见 `research/07-数据源清单.md`）：

- Enka 官方 API 只覆盖国际服，返回的是**零件**（遗器词条/光锥基础值/行迹等级），要算最终面板得自己写推导层。
- **Mihomo `sr_info_parsed` 支持国服**（实测国服 UID `110554887` 返回大黑塔/遐蝶/砂金等），且返回的是**已汇总好的最终面板**：`statistics` 里 `spd`=131.632、`atk`=2838、`crit_rate`=0.69 等，`value` 为原始小数、`display` 为展示值。验证：`atk = attributes 中 field=atk 项的值 + additions 中 field=atk 项的值`，`spd` 同理（注意 `attributes`/`additions` 在 API 中是**数组**，按 `field` 名索引，不是以字段名做 key 的对象）。
- 社区大量前端工具（Fribbels、dsh-game-uid 等）直接用 Mihomo 作「别人组装好的完整练度」源。

因此主通道选 Mihomo：**输入 UID → 一个请求 → 可直接进排轴的最终速度**，省掉自研推导层。

## 2. 两条通道

### 2.1 主通道 · Mihomo（推荐）

| 项 | 内容 |
|---|---|
| 端点 | `https://api.mihomo.me/sr_info_parsed/{uid}?lang=cn` |
| 认证 | 无 key、无登录 |
| 区服 | 国服 1/2/5，国际服 6/7/8/9（首位判断） |
| 前提 | 游戏内开启「角色展示」，只能看到展柜里的角色 |
| 返回 | `{player, characters[]}`，每个角色含 `statistics / attributes / additions / light_cone / relics / relic_sets / skills / skill_trees` |
| 缓存 | 服务端有 TTL（社区工具默认按 5 分钟节流） |
| 局限 | 只展示展柜角色；`statistics` 不含战斗内条件触发加成（如套装「同命途队友在场暴击+12%」），这部分应由排轴引擎按配置叠加，不能锁死在静态面板里 |

**直连 vs 代理**：浏览器 `file://` 打开时，直连 Mihomo 的 CORS 取决于浏览器/网络环境。三种方式按序尝试：

1. 直接拉取（默认）
2. 勾选「经本地代理」→ 走 `mys_proxy.py` 的 `/api/mihomo` 转发
3. 手动在新标签页打开 API URL，把 JSON 粘进页面解析框

### 2.2 兜底 · 米游社查自己

| 项 | 内容 |
|---|---|
| 用途 | 查**自己**的 box（拥有的角色/光锥）+ 养成练度，含未放进展示的角色 |
| 认证 | 自己的米游社 Cookie；不需 DS 签名（账号接口） |
| 接口 | `binding/api/getUserGameRolesByCookie?game_biz=hkrpg_cn`（账号）<br>`event/rpgcultivate/avatar/list`（角色 box） |
| 返回 | 角色 `item_id / item_name / cur_level / max_level / rank(命座) / is_own / avatar_base_type / damage_type` |
| **关键限制** | **不给最终战斗面板**（无攻击/双暴/速度、无遗器词条），只是养成零件 |
| 为啥必须代理 | 浏览器直连会被 CORS 拦；且缺 `x-rpc-device_id` 等设备头；Cookie 是敏感凭证不能进前端代码 |

## 3. 字段映射（Mihomo → 排轴器）

- `characters[].statistics[]` 是 `{field, name, value, display, percent}` 数组，先按 `field` 转成 map。
- 速度取 `spd.value`（如 131.632），攻击取 `atk.value`，双暴取 `crit_rate/crit_dmg.display`（如 "69.0%"）。
- 常驻字段顺序：`spd / atk / crit_rate / crit_dmg / hp / def / break_dmg / sp_rate / effect_hit / effect_res / heal_rate`。
- 「填入排轴器」把 `spd` 写入 `localStorage["srr-config-v1"]` 的角色槽（同名覆盖 → 空槽 → 追加 → 满 6 槽则询问替换），随即跳回 `index.html`。

## 4. 验证记录（2026-11-21）

- `python -m py_compile tools/mys_proxy.py`：通过
- `node --check ui/import.js`：通过
- 代理 `/health`：返回 `{"ok":true,...}`
- 代理 `/api/mihomo?uid=110554887`：返回国服 5 人完整面板
- 前端解析逻辑用真实数据跑一遍：大黑塔 SPD 131.632 / ATK 2838 / 暴击 69.0% / 暴伤 73.9%、遐蝶 SPD 93.7、砂金 SPD 126.832……全部字段有值，映射正确
- 米游社接口：无本人 Cookie，仅验证了请求构造（host/headers/参数），**实际返回待本人 Cookie 实测**

## 5. 待验证 / 已知风险

1. **米游社接口实测**：需本人 Cookie 走一遍 `/api/roles`、`/api/box`，确认 `rpgcultivate` 路径当前版本仍有效、返回字段未变。
2. **直连 CORS**：不同浏览器对 `file://` + 跨域的处理不一，若都失败则固定走代理。
3. **第三方 API 稳定性**：Mihomo / 米游社接口非官方 SLA，可能变更或限流；工具侧已做错误提示与多通道降级。
4. **合规**：只用公开展示数据；不碰解包、不分发游戏资产。

## 6. 下一步（未做，等指令）

- 由练度**重新推导**面板（遗器词条级），而非直接用 Mihomo 汇总值 —— 需要完整伤害/属性模型，见 `docs/research/03`。
- 米游社详情接口补遗器词条（`event/rpgcultivate/calc/avatar/detail`），把兜底也升级成完整练度。
