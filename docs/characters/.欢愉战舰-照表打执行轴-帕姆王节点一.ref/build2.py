# -*- coding: utf-8 -*-
"""欢愉战舰-照表打执行轴 → 单表连排版（P1开局+循环+转阶段+P2 全在一张表，按时间顺序）"""
try:
    import openpyxl
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl>=3.1.0"])
    import openpyxl

import os, time
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = r"E:\Code\starRailRotation\docs\characters\欢愉战舰-照表打执行轴-帕姆王节点一.xlsx"

def xl(css):
    return css.lstrip("#").upper()

C_HEADER_BG = PatternFill("solid", fgColor=xl("#F2F2F2"))
C_TITLE_BG  = PatternFill("solid", fgColor=xl("#D9D9D9"))
C_INPUT_BG  = PatternFill("solid", fgColor=xl("#FAFAFA"))
C_RED_BG    = PatternFill("solid", fgColor=xl("#FDECEC"))
C_YEL_BG    = PatternFill("solid", fgColor=xl("#FFF8E1"))
C_PHASE_BG  = PatternFill("solid", fgColor=xl("#305496"))   # 阶段分隔条深蓝
C_NOTE_BG   = PatternFill("solid", fgColor=xl("#E2EFDA"))

F_BASE   = Font(name="微软雅黑", size=10, color=xl("#1A1A1A"))
F_HEAD   = Font(name="微软雅黑", size=10, color=xl("#1A1A1A"), bold=True)
F_TITLE  = Font(name="微软雅黑", size=13, color=xl("#1A1A1A"), bold=True)
F_RED    = Font(name="微软雅黑", size=10, color=xl("#C00000"), bold=True)
F_PHASE  = Font(name="微软雅黑", size=11, color=xl("#FFFFFF"), bold=True)
F_NOTE   = Font(name="微软雅黑", size=9, color=xl("#555555"))

THIN = Side(style="thin", color=xl("#BFBFBF"))
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
AL_WRAP  = Alignment(vertical="top", wrap_text=True)
AL_WRAPC = Alignment(vertical="top", horizontal="center", wrap_text=True)
AL_PHASE = Alignment(vertical="center", horizontal="left")

HEADERS = ["步骤", "谁动", "时点(AV)", "动作（照着打）", "期望伤害/状态", "实际（贴图/数字）"]
WIDTHS  = [7, 11, 10, 52, 40, 24]

# ---- ⭐ 保留大人已填的「实际」列：重建前先读旧文件，按 (步骤,谁动,时点) 键回填 ----
OLD_ACTUAL = {}
if os.path.exists(OUT):
    try:
        from openpyxl import load_workbook
        _old = load_workbook(OUT, data_only=True)
        if "照表打执行轴" in _old.sheetnames:
            _ws = _old["照表打执行轴"]
            for _row in _ws.iter_rows(min_row=1, max_col=6, values_only=True):
                if _row[0] and _row[5]:  # 步骤列非空 且 实际列有内容
                    OLD_ACTUAL[(str(_row[0]).strip(), str(_row[1] or "").strip(), str(_row[2] or "").strip())] = _row[5]
        print(f"PRESERVED {len(OLD_ACTUAL)} filled cells from old file")
    except Exception as _e:
        print("WARN: could not read old file:", _e)

wb = Workbook()
wb.remove(wb.active)
ws = wb.create_sheet("照表打执行轴")

# ---- 标题 ----
r = 1
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
t = ws.cell(row=r, column=1, value="欢愉战舰 · 照表打执行轴 · 末日幻影 P22 帕姆王节点一（目标 3900+）｜单表从头打到尾：开局 → 循环 → 转阶段 → P2 → 结算")
t.font = F_TITLE; t.fill = C_TITLE_BG; t.alignment = Alignment(vertical="center", wrap_text=True)
ws.row_dimensions[r].height = 28
r += 1

# ---- 用法注 ----
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
n = ws.cell(row=r, column=1, value="📝 对账用法：每步把数字/截图描述填进浅灰「实际」列，打完逐行对账——对不上的行=轴错或机制漏，当场抓。🔴行=必做不可乱序；🟡行=可凹/观察项。战前配置与硬数据见第二个工作表「说明与战前」。")
n.font = F_NOTE; n.fill = C_INPUT_BG; n.alignment = AL_WRAP
ws.row_dimensions[r].height = 30
r += 1

# ---- 表头 ----
for i, h in enumerate(HEADERS, 1):
    c = ws.cell(row=r, column=i, value=h)
    c.font = F_HEAD; c.fill = C_HEADER_BG; c.alignment = AL_WRAPC; c.border = BORDER
head_row = r
r += 1

def phase(label):
    """阶段分隔条（深蓝通栏）"""
    global r
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    c = ws.cell(row=r, column=1, value=label)
    c.font = F_PHASE; c.fill = C_PHASE_BG; c.alignment = AL_PHASE
    ws.row_dimensions[r].height = 22
    r += 1

def rows(items):
    global r
    for step, who, when, action, expect in items:
        flag = "🔴" if "🔴" in action or "🔴" in str(step) else ("🟡" if "🟡" in action else "")
        fill = C_RED_BG if flag == "🔴" else (C_YEL_BG if flag == "🟡" else None)
        vals = [step, who, when, action, expect,
                OLD_ACTUAL.get((str(step).strip(), str(who).strip(), str(when).strip()))]
        for i, v in enumerate(vals, 1):
            c = ws.cell(row=r, column=i, value=v)
            c.font = F_RED if (i in (1, 4) and flag == "🔴") else F_BASE
            c.alignment = AL_WRAPC if i in (1, 2, 3) else AL_WRAP
            c.border = BORDER
            if i == 6:
                c.fill = C_INPUT_BG
            elif fill:
                c.fill = fill
        if len(action) > 60 or len(expect) > 45:
            ws.row_dimensions[r].height = 42
        r += 1

# ================= ① 开局段 =================
phase("【① 开局段】AV 0→200 —— 秘技进场 → 我方五步 → 阿哈① → 点火爆发第一轮（第 19 步 ≠ 打完，往下接着循环段）")
rows([
    ("1", "狼尊", "@0", "开怪（欢愉技/E）🔴", "计数两边各 −2；boss 韧 480→470（预锁削韧 −10）；99 盲盒+底本挂狼尊"),
    ("—", "敌·帕姆王", "@~2", "紧跟开怪：单体普攻（无横幅，目标按嘲讽值随机）——不用理", "随机单体受击、无技能横幅"),
    ("2", "爻光", "@31", "A 小怪（4）——秘技已自动开结界，不再花 E 开门；改 A 白赚：+3 笑点 + 计数两边各 −1 + 回 1 SP", "计数 −1×2、笑点+3、SP=4、结界图标在场（秘技挂的）"),
    ("3", "真珠", "@32", "E 奶（4→3）", "全队回血、抵挡池 +15、SP=3"),
    ("4", "欢愉主", "@34", "A 小怪（3→4）——打计数落后那只；相等打血少那只；不打 boss", "单体雷伤、目标侧计数 −2、SP=4"),
    ("—", "敌·破晓灰烬", "@38", "单体攻击——不用理", "随机单体受击"),
    ("5", "保姆", "@42", "普通 A（AI 代管；手操可点计数落后那只 = 修差 −1，不耗 SP）", "9579/发（实测）、计数 −1"),
    ("6", "狼尊", "@47", "E 群攻（4→3）", "群攻虚数伤、计数 −2×2、笑点 +5（隐藏分）、SP=3"),
    ("—", "敌·帕姆王", "@~58", "第二动：单体 或 单体+AOE 连续两下——不用理，但别慌，这不是阿哈时刻", "单体（或+AOE）；受击则爻光大条充满"),
    ("7", "阿哈①", "@64", "自动，不用按；SP +1（爻光欢愉技参演回 1）（→4）", "SP→4、笑点清零转好活、合演伤害自动发生"),
    ("—", "敌·破晓战队", "@~76", "小怪第二动（灰烬/赤焰）——不用理", "小怪第二动（非 boss）"),
    ("8", "爻光", "@81", "A 小怪 → 立刻开大#1（受击与否都这样）🔴——默认 A（4→5）；SP 松了以后 E 也放得出、但浪费同步+白打", "计数 −1×2、SP=5、大后触发额外阿哈 + 1魂 40 笑点入账"),
    ("9", "真珠", "@86", "E 攒能量（5→4）🔴 这步必须 E，被迫 A 点火链就断", "能量向 164~182 攒、SP=4"),
    ("10", "欢愉主", "@88", "E（4→3）", "SP=3"),
    ("11", "狼尊", "@93", "开大#1（插入，无敌玩家→真珠+90）🔴", "真珠能量 +90、SP=3"),
    ("12", "阿哈②", "@128", "自动；SP +1（→4）", "SP→4、好活续/发"),
    ("13", "爻光", "@131", "E 刷结界（结界 3 回合恰在此到期——按秘技进战开计；续 3 回合正盖住爆发窗；4→3）——想留点可改 A（+1），则 14 改狼 E", "结界图标续 3 回合、SP=3"),
    ("14", "狼尊", "@139", "A（3→4）", "单体虚数伤、SP=4"),
    ("15", "真珠", "@139", "E（4→3，最后一笔能量）", "能量 ≥144.8 达标（164~182）、SP=3"),
    ("16", "欢愉主", "@144", "开大#1 垫 🔴 顺序不能乱；Q 后 +1 SP（→4）", "指定狼尊立即施放欢愉技+暴伤 +50%、SP→4"),
    ("17", "真珠", "插入", "点火 → 狼尊 🔴", "账本 X∈[180,300) → 狼尊获得额外回合权"),
    ("⏱", "破韧节点", "观察项", "保姆第 5 发强普 → boss 韧条空 →「全力输出」toast = 全员激活终结技（免能量）。应正落在点火爆发窗内——激活免能量大按 真珠>欢愉主>爻光 立刻用掉，别攒；toast 在点火前则插链里用", "toast 出现、boss 韧条 0、受伤 +100%、行动延后（纠缠）"),
    ("18", "狼尊", "插入", "开大#2 → 额外回合 → 强普 ×N 全打 boss 本体 🔴；P1 血近空先消耗额外回合再压死（转阶段会吞）", "每段 24508 ×100 段 ≈245.08 万（boss 独吃，实测）；P1 应在此窗压空"),
    ("19", "强普完→狼尊", "—", "立刻开大#3 🔴 拖越久档位越低", "2 魂账本清零 → 后续 3→5 动档"),
])

# ================= ② 循环段 =================
phase("【② 循环段】P1 后半 —— 每 ~250 AV 套一轮同一模板，直到 P1 血打空（C1-C8=窗口内；日常 6 条=窗口外）")
rows([
    ("C1", "等窗口", "—", "窗口触发器（三选二开窗）：破韧 toast / 保姆强普剥层 / 末法余烬激活", "触发器就位"),
    ("C2", "欢愉主", "窗口", "开大（垫）🔴", "指定狼尊欢愉技+暴伤 +50%、SP +1"),
    ("C3", "真珠", "窗口", "点火 🔴——查账本：X∈[180,300) 给狼尊；X≥300 或 <60 给爻光/欢愉主转轴", "账本判定落点"),
    ("C4", "狼尊", "窗口", "开大 → 额外回合 → 强普 ×N 🔴——前提小怪已清场（没清场先用欢愉主 A/真珠强化 A 收尾，100 段必须独吃 boss）", "每段 24508 ×100 ≈245.08 万（独吃）"),
    ("C5", "强普完→狼尊", "窗口", "立刻接大 🔴", "2 魂账本清零、档位刷新"),
    ("C6", "爻光", "峰值", "下一个笑点峰值后开大（1 魂 40 笑点落进下次点火前的账本）", "额外阿哈时刻+40 笑点"),
    ("C7", "⏱ 破韧节点", "—", "保姆强普攒够一发 → 韧条空 →「全力输出」toast = 全员激活免能量大：按 真珠>欢愉主>爻光 立刻用掉，别攒", "toast、受伤 +100%"),
    ("C8", "阿哈③~⑧", "每64AV", "自然到来，不用按，伤害自动发生", "自动伤害、SP 每次含 +1"),
    ("日常", "爻光", "窗口外", "结界断了才补 E，其余全 A（中心选小怪，非物理优先）；能量满憋到窗口前 1-2 动", "计数 −1×2/动、笑点 +3/动"),
    ("日常", "真珠", "窗口外", "E（奶+攒能量备点火）；她的输出/计数全在强化普攻（Q 附带 3 发）", "能量持续攒"),
    ("日常", "欢愉主", "窗口外", "有 SP 就 E；大永远留点火前", "群攻雷伤+20 好活"),
    ("日常", "狼尊", "窗口外", "有 SP 就 E；无 SP 才 A", "群攻 160%+5 笑点"),
    ("日常", "保姆", "窗口外", "强普出来永远点 boss；普通 A 手操修计数差 −1（落后那只）", "韧 −100/发、A 修差 −1"),
    ("日常", "好活管理", "—", "发放后 2 动内安排狼尊强普窗，否则续期（狼尊开大/爻光鸿运鳞集）", "好活不断档"),
])

# ================= ③ 转阶段 =================
phase("【③ 转阶段】P1 血打空 → P2 开场 —— 分段转换不是波次：无 AV 返还；转阶段会吞狼尊额外回合")
rows([
    ("T1", "狼尊", "P1 血近空", "先停手消耗额外回合再压死（转阶段会吞额外回合）🔴", "额外回合清空后压死"),
    ("T2", "—", "演出~15s", "P1 空 → 演出，AV 冻结，第二发 99 好活盲盒白赚", "第二发盲盒伤害"),
    ("T3", "—", "P2 开场", "boss 满血（韧条 840 满条）+ 4 只新小怪 + 新力场（boss 全属性免疫+弱点无效+88% 减伤 4 层）", "HP 100%、韧 840/840、小怪 ×4"),
])

# ================= ④ P2 段 =================
phase("【④ P2 段】清盾 → 收计数 → 蒸汽洗涤斩杀窗 → 扫除前击杀（P2 破韧是加成项不是门槛，击杀条件 = 蒸汽洗涤被打退）")
rows([
    ("P1", "狼尊", "进场", "强普破盾型：小怪在场也放——100 段均分 5 目标 ≈ 每只 20 段 ×欢愉+2 = 一发破光全部 4 力场（🟡 假说；没好则阿哈欢愉技+全员 A，1~1.5 轮全破）", "一发破光 4 力场（🟡）"),
    ("P2", "全员", "清场", "收漏网计数：真珠强化 A/各 A 补；小怪逐个真杀别漏 → 保姆白得强普 ×4（削 boss 韧 100/发）", "保姆白得强普 ×4、韧 −400"),
    ("P3", "a谁e谁", "—", "爻光 A 中心选非物理小怪（物理那只免疫）；真珠 A 指残血/缺计数；欢愉主 A 修差+补刀（−2）；保姆 A 修差（−1）；E 无脑放（欢愉技通吃全属性）", "计数差收敛到 0"),
    ("P4", "保姆", "全程", "强普全部点 boss（剥层+削韧，唯一 boss 削韧来源）；9 发名义、小怪白送 4 发后实付 400 笑点同 P1", "292887/发（实测）、韧 −100/发"),
    ("P5", "⏱ 斩杀窗", "蒸汽洗涤退出", "「蒸汽洗涤」被打退 toast（boss HP 大额掉血 92→73）→ 全员灌大——状态未破期间 boss 几乎免伤，输出全挤在破的那一下", "HP 92→73 大额跳、全员大招"),
    ("P6", "收尾", "斩杀竞速", "boss「扫除」（第二次正式回合）之前杀掉 = +46 分；激活就放、不留大", "扫除前击杀 → 节点 ≥3900"),
])

# ================= ⑤ 结算 =================
phase("【⑤ 结算】")
rows([
    ("✓", "结算", "—", "节点一积分 ≥3900 = 达标（扫除前杀 = +46 分；「扫除」扣 46 是斩杀竞速线，天花板 3929）", "目标 3900+"),
])

# ---- 列宽/冻结 ----
for i, w in enumerate(WIDTHS, 1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = ws.cell(row=head_row + 1, column=1)

# ================= Sheet 2: 说明与战前（参考，不翻也行） =================
ws2 = wb.create_sheet("说明与战前")
ws2.column_dimensions["A"].width = 16
ws2.column_dimensions["B"].width = 90
ws2.merge_cells("A1:B1")
t2 = ws2["A1"]; t2.value = "说明与战前配置（打之前看一眼；打的过程中只看第一个表）"
t2.font = F_TITLE; t2.fill = C_TITLE_BG; t2.alignment = Alignment(vertical="center")
ws2.row_dimensions[1].height = 26
info = [
    ("【战前】", "愿力 Lv.3 → 检查环境配置 → 秘技 4 点按序：爻光秘技 → 真珠秘技 → 欢愉主秘技 → 狼尊秘技压轴（底本挂狼尊）→ 保持狼尊为操作角色触发战斗（🔴 开怪者不能换）。"),
    ("结界机制", "爻光秘技「浮光过隙」进战后自动释放一次免费战技 = 结界 AV0 即挂、3 回合从进战起算、恰 @130.7 到期 → 开局爻光第一动改 A（不开门），@130.7 续 E。"),
    ("进战硬数据", "进战 SP=3；boss 行动周期 ≈56.5 AV（SPD 177），槽位 @2 / @58.5 / @115(扫除) / @171.5，紧跟开怪就动第一次（单体普攻无横幅）；帕姆王 P1 韧条 480、P2 上限 840 进场满条；破晓战队韧条 P1/P2 均 160。"),
    ("保姆模型", "我方第 5 个可操作行动实体；充能 80（我方笑点 1:1）→ 强普事件：剥 1 层长效抗菌 + 削 boss 韧 100/发（唯一 boss 削韧来源）；普通 A 实测 9579 打不死小怪，只用于修计数差 −1。"),
    ("里程碑自查链", "计数满 16 退散 → 真杀 → 保姆强普×5 → 破韧 toast → 点火爆发压穿 P1 → 转阶段 → P2 一发清盾 → 蒸汽洗涤退出 → 灌大 → 扫除前击杀 = 结算 ≥3900（扫除前杀 = +46 分）。"),
]
r2 = 3
for k, v in info:
    a = ws2.cell(row=r2, column=1, value=k); a.font = F_HEAD; a.alignment = AL_WRAPC; a.border = BORDER; a.fill = C_NOTE_BG
    b = ws2.cell(row=r2, column=2, value=v); b.font = F_BASE; b.alignment = AL_WRAP; b.border = BORDER
    ws2.row_dimensions[r2].height = 46
    r2 += 1

wb.properties.title = "欢愉战舰-照表打执行轴-帕姆王节点一"

# ---- 保存（被预览锁定时自动另存 v2） ----
try:
    wb.save(OUT)
    print("SAVED:", OUT)
except PermissionError:
    alt = OUT.replace(".xlsx", f"_单表版_{time.strftime('%H%M%S')}.xlsx")
    wb.save(alt)
    print("LOCKED, SAVED AS:", alt)
