#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""kb.py —— starRailRotation 排轴知识库的索引 / 查询 / 召回。

为什么要有它
============
排轴出错的大头不是"算错"，是"该用的机制没被想起来"。
例：爻光的普攻回能 = 战技档，这条 2026-11-21 就写在角色卡里，
做能量账时却用了通用 20 档，差出来的 12.4 被编成"受击" —— 全链错。

所以开工前必须做一次召回：**把跟这次排轴相关的节点全捞出来**，再动手。

命令
====
    python kb.py build                 # 重建 knowledge/INDEX.md
    python kb.py ls                    # 列所有区
    python kb.py ls 40-enemies         # 列某区的节点
    python kb.py show 30-units/_index  # 读节点
    python kb.py recall 爻光 能量 普攻   # 召回（排轴前必做）
    python kb.py recall 帕姆王 韧条 --zone 40-enemies
    python kb.py stats

匹配方式（不引外部依赖）
========================
三层加权 + IDF：
  triggers / tags 命中 → 3 分；title 命中 → 2 分；body 命中 → 1 分（单节点最多计 6 个词）
中文按 2~4 字滑窗切；英文按词切。
判命中要求 **至少 2 个不同词** —— 只靠一个通用词撑起来的，是假阳性，宁可空着。
"""
import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
KB = os.path.join(ROOT, "knowledge")

ZONES = ["00-rules", "10-basics", "20-action", "30-units",
         "40-enemies", "50-stage", "60-teams", "70-runs", "80-tools"]

FRONT = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)
# 只放真正的虚词。千万别把"现在/开始/进行"这类整串塞进 set ——
# 它会被拆成单字，然后"开怪"→"怪"、"行动"→"动"，召回直接崩（实测踩过）。
STOP = set("的了是在和与及或有为我你他她它这那哪个可否请问里面之后之前时候")
STOP_TERMS = {"the", "and", "for", "with", "page", "问题", "情况", "东西"}

W_TRIG, W_TITLE, W_BODY = 3.0, 2.0, 1.0
BODY_HIT_CAP = 6
GENERIC_IDF = 0.05
MIN_DISTINCT = 2


def _out():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def parse_node(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        txt = f.read()
    meta, body = {}, txt
    m = FRONT.match(txt)
    if m:
        body = txt[m.end():]
        for line in m.group(1).splitlines():
            if ":" in line and not line.startswith((" ", "\t")):
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
    rel = os.path.relpath(path, KB).replace("\\", "/")
    nid = meta.get("id") or rel[:-3]
    tags = [x.strip() for x in meta.get("tags", "").strip("[]").split(",") if x.strip()]
    trig = [x.strip() for x in meta.get("triggers", "").strip("[]").split(",") if x.strip()]
    return {
        "id": nid, "title": meta.get("title") or os.path.basename(rel)[:-3],
        "type": meta.get("type", ""), "tags": tags, "triggers": trig,
        "status": meta.get("status", "active"),
        "confidence": meta.get("confidence", ""),
        "updated": meta.get("updated", ""),
        "game_ver": meta.get("game_ver", "").strip('"'),
        "source": meta.get("source", ""),
        "path": rel, "abs": path, "body": body,
    }


def load_all():
    nodes = []
    for dirpath, _dirs, files in os.walk(KB):
        for fn in files:
            if not fn.endswith(".md") or fn in ("README.md", "INDEX.md"):
                continue
            nodes.append(parse_node(os.path.join(dirpath, fn)))
    nodes.sort(key=lambda n: (ZONES.index(n["path"].split("/")[0])
                              if n["path"].split("/")[0] in ZONES else 99, n["id"]))
    return nodes


def tokenize(text):
    terms = set()
    for w in re.findall(r"[A-Za-z][A-Za-z0-9_\-]{1,}|[0-9]{2,}", text or ""):
        wl = w.lower()
        if wl not in STOP_TERMS:
            terms.add(wl)
    for seg in re.findall(r"[\u4e00-\u9fff]+", text or ""):
        part = "".join(ch for ch in seg if ch not in STOP)
        if len(part) < 2:
            continue
        for size in (2, 3, 4):
            for i in range(len(part) - size + 1):
                t = part[i:i + size]
                if t not in STOP_TERMS:
                    terms.add(t)
    return terms


def build_idf(nodes, terms):
    n = max(1, len(nodes))
    blobs = []
    for nd in nodes:
        blobs.append(" ".join([*nd["tags"], *nd["triggers"], nd["title"],
                               nd["body"]]).lower())
    idf = {}
    for t in terms:
        df = sum(1 for b in blobs if t in b)
        if df == 0:
            idf[t] = 0.0
            continue
        v = math.log((n + 1.0) / (df + 1.0)) / math.log(n + 1.0)
        idf[t] = max(0.0, v) ** 0.5
    return idf


def score(nd, terms, idf):
    tags = " ".join(nd["tags"] + nd["triggers"]).lower()
    title = nd["title"].lower()
    body = nd["body"].lower()
    s, hits, body_n = 0.0, [], 0
    for t in terms:
        w = idf.get(t, 0.0)
        if w < GENERIC_IDF:
            continue
        got = False
        if t in tags:
            s += W_TRIG * w
            got = True
        elif t in title:
            s += W_TITLE * w
            got = True
        elif body_n < BODY_HIT_CAP and t in body:
            s += W_BODY * w
            got = True
            body_n += 1
        if got:
            hits.append(t)
    return s, hits


def match_lines(nd, terms, limit=3):
    out = []
    for line in nd["body"].splitlines():
        t = line.strip()
        if not t or t.startswith(("|--", "|---", "#")):
            continue
        if any(len(x) >= 2 and x in t.lower() for x in terms):
            out.append(t if len(t) <= 130 else t[:127] + "…")
            if len(out) >= limit:
                break
    return out


def cmd_recall(args):
    nodes = load_all()
    if args.zone:
        nodes = [n for n in nodes if n["path"].startswith(args.zone)]
    desc = " ".join(args.text).strip()
    if not desc:
        print("用法：python kb.py recall 爻光 能量 普攻")
        return 1
    terms = tokenize(desc)
    if not terms or not nodes:
        print("没有可匹配的词或节点。")
        return 1
    idf = build_idf(nodes, terms)
    scored = []
    for nd in nodes:
        s, hits = score(nd, terms, idf)
        if s <= 0:
            continue
        scored.append((len(set(hits)), s, nd, hits))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    if not scored or scored[0][0] < MIN_DISTINCT:
        print("## 召回结果：未匹配\n\n> 库里没有足够相关的节点。**别在记忆里找不存在的答案，"
              "缺的机制先补进库再排轴。**\n")
        return 0

    top = [x for x in scored[:args.top] if x[0] >= MIN_DISTINCT]
    print("## 必读清单（recall / 仅供参考）\n")
    print("> 查询：%s\n> 命中判据：≥%d 个不同词\n" % (desc, MIN_DISTINCT))
    for cnt, s, nd, hits in top:
        mark = {"active": "✅", "superseded": "⚠️", "archived": "📦"}.get(nd["status"], "•")
        print("%s [%s] %s  (%d 词 / %.1f 分)" % (mark, nd["path"].split("/")[0], nd["title"], cnt, s))
        if nd["source"]:
            print("    源：%s" % nd["source"])
        print("    节点：%s" % nd["id"])
        for line in match_lines(nd, hits):
            print("    › %s" % line)
        print()
    print("读全文：`python kb.py show <节点id>`")
    return 0


def cmd_ls(args):
    nodes = load_all()
    if not args.zone:
        for z in ZONES:
            sub = [n for n in nodes if n["path"].startswith(z)]
            print("%-12s %2d 个节点" % (z, len(sub)))
        return 0
    for n in nodes:
        if n["path"].startswith(args.zone):
            print("%-28s %s" % (n["id"], n["title"]))
    return 0


def cmd_show(args):
    nodes = load_all()
    hit = [n for n in nodes if n["id"] == args.id or n["path"][:-3] == args.id]
    if not hit:
        print("没有这个节点：%s（用 ls 看 id）" % args.id)
        return 1
    n = hit[0]
    print("# %s\n" % n["title"])
    print("id: %s\ntype: %s\nstatus: %s\nconfidence: %s\ngame_ver: %s\nupdated: %s\nsource: %s\n"
          % (n["id"], n["type"], n["status"], n["confidence"],
             n["game_ver"] or "—", n["updated"], n["source"]))
    print("tags: %s" % "、".join(n["tags"]))
    print("\n---\n")
    print(n["body"].strip())
    return 0


def cmd_stats(args):
    nodes = load_all()
    print("节点总数：%d" % len(nodes))
    for z in ZONES:
        sub = [n for n in nodes if n["path"].startswith(z)]
        low = [n["id"] for n in sub if n["confidence"] == "medium"]
        print("  %-12s %2d 个%s" % (z, len(sub), ("  待钉:" + ",".join(low)) if low else ""))
    return 0


def cmd_build(args):
    nodes = load_all()
    lines = ["# 知识库索引（自动生成，勿手改）", "",
             "> 由 `python tools/kb/kb.py build` 生成。改节点后重跑。", ""]
    for z in ZONES:
        sub = [n for n in nodes if n["path"].startswith(z)]
        if not sub:
            continue
        lines.append("## %s（%d）\n" % (z, len(sub)))
        lines.append("| id | 标题 | 版本 | 置信 | 更新 | 源 |")
        lines.append("|---|---|---|---|---|---|")
        for n in sub:
            lines.append("| `%s` | %s | %s | %s | %s | %s |" % (
                n["id"], n["title"], n["game_ver"] or "—", n["confidence"] or "—",
                n["updated"] or "—", n["source"] or "—"))
        lines.append("")
    out = os.path.join(KB, "INDEX.md")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print("已写入 %s（%d 个节点）" % (out, len(nodes)))
    return 0


def main(argv=None):
    _out()
    p = argparse.ArgumentParser(description="排轴知识库：build / ls / show / recall / stats")
    sub = p.add_subparsers(dest="cmd")

    b = sub.add_parser("build"); b.set_defaults(fn=cmd_build)
    l = sub.add_parser("ls"); l.add_argument("zone", nargs="?"); l.set_defaults(fn=cmd_ls)
    s = sub.add_parser("show"); s.add_argument("id"); s.set_defaults(fn=cmd_show)
    st = sub.add_parser("stats"); st.set_defaults(fn=cmd_stats)
    r = sub.add_parser("recall")
    r.add_argument("text", nargs="*")
    r.add_argument("--zone", default=None)
    r.add_argument("--top", type=int, default=5)
    r.set_defaults(fn=cmd_recall)

    args = p.parse_args(argv)
    if not getattr(args, "fn", None):
        p.print_help()
        return 1
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
