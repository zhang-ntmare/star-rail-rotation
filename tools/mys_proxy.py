# -*- coding: utf-8 -*-
"""
starRailRotation · 本地代理

用途：
  1. 转发 Mihomo API（浏览器 file:// 直连被 CORS 拦时的备用通道）
  2. 转发米游社官方接口（需 Cookie + 设备头，浏览器无法直接带）

只监听 127.0.0.1，Cookie 只在内存中透传，不落盘、不缓存、不上传。

运行： python tools/mys_proxy.py     （默认 127.0.0.1:8792）
依赖： 仅 Python 标准库
"""

import json
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, quote

PORT = 8792
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
DEVICE_ID = str(uuid.uuid4())
MYS_HOST = "api-takumi.mihoyo.com"

# 米游社各接口的 base headers（参考 seelieEx / miao-plugin 的公开实现）
BASE_HEADERS = {
    "User-Agent": UA,
    "Referer": "https://act.mihoyo.com/",
    "x-rpc-device_id": DEVICE_ID,
    "x-rpc-platform": "4",
    "x-rpc-lang": "zh-cn",
    "Accept": "application/json, text/plain, */*",
}


def http_get(url, headers=None, timeout=15):
    """用标准库发 GET，返回 (status, body_bytes)。"""
    import urllib.request
    import urllib.error
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 0, json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8")


def mys_headers(cookie, extra=None):
    h = dict(BASE_HEADERS)
    h["Cookie"] = cookie or ""
    if extra:
        h.update(extra)
    return h


def handle_roles(cookie):
    """查 Cookie 关联的星铁游戏账号（此接口只需 Cookie，无 DS 签名）。"""
    url = "https://%s/binding/api/getUserGameRolesByCookie?game_biz=hkrpg_cn" % MYS_HOST
    headers = mys_headers(cookie, {
        "x-rpc-device_id": DEVICE_ID,
        "x-rpc-lrsag": "",
        "x-rpc-mi_referrer": "https://act.mihoyo.com/",
    })
    status, body = http_get(url, headers)
    try:
        data = json.loads(body.decode("utf-8", "replace"))
    except Exception:
        return 502, {"error": "米游社返回非 JSON", "raw": body[:200].decode("utf-8", "replace")}
    ret = data.get("retcode")
    if ret != 0:
        msg = data.get("message") or "未知错误"
        if ret == -100:
            msg = "登录态过期，请重新获取 Cookie"
        return 401, {"error": "米游社 retcode=%s：%s" % (ret, msg)}
    roles = []
    for r in (data.get("data") or {}).get("list", []):
        if str(r.get("game_biz", "")) != "hkrpg_cn":
            continue
        roles.append({
            "game_uid": str(r.get("game_uid", "")),
            "region": r.get("region", ""),
            "nickname": r.get("nickname", ""),
            "level": r.get("level", ""),
        })
    return 200, {"roles": roles}


def handle_box(cookie, uid):
    """查自己拥有的角色列表（养成计算器接口，含等级/命座/光锥，无最终面板）。"""
    if not uid:
        return 400, {"error": "缺少 uid"}
    url = ("https://%s/event/rpgcultivate/avatar/list"
           "?game=hkrpg&game_biz=hkrpg_cn&badge_region=&badge_uid=" % MYS_HOST)
    headers = mys_headers(cookie, {
        "x-rpc-page": "v4.4.4__#/tools/calculation",
        "x-rpc-view_source": "1",
    })
    status, body = http_get(url, headers)
    try:
        data = json.loads(body.decode("utf-8", "replace"))
    except Exception:
        return 502, {"error": "米游社返回非 JSON", "raw": body[:200].decode("utf-8", "replace")}
    ret = data.get("retcode")
    if ret != 0:
        return 401, {"error": "米游社 retcode=%s：%s" % (ret, data.get("message") or "未知错误")}
    avatars = (data.get("data") or {}).get("avatars", [])
    return 200, {"avatars": avatars}


def handle_mihomo(uid):
    """转发 Mihomo 解析接口。"""
    if not uid:
        return 400, {"error": "缺少 uid"}
    url = "https://api.mihomo.me/sr_info_parsed/%s?lang=cn" % quote(uid, safe="")
    status, body = http_get(url, {"User-Agent": UA, "Accept": "application/json"})
    try:
        data = json.loads(body.decode("utf-8", "replace"))
    except Exception:
        return 502, {"error": "Mihomo 返回非 JSON"}
    return 200, data


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.address_string(), fmt % args))

    def send_json(self, status, obj, cors=True):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if cors:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        if path == "/health":
            self.send_json(200, {"ok": True, "service": "srr-local-proxy"})
            return
        if path == "/api/mihomo":
            uid = (qs.get("uid") or [""])[0]
            status, data = handle_mihomo(uid)
            self.send_json(status, data)
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            self.send_json(400, {"error": "请求体不是合法 JSON"})
            return

        cookie = body.get("cookie", "")
        if path == "/api/roles":
            status, data = handle_roles(cookie)
        elif path == "/api/box":
            status, data = handle_box(cookie, str(body.get("uid", "")))
        else:
            status, data = 404, {"error": "not found"}
        self.send_json(status, data)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("starRailRotation 本地代理已启动： http://127.0.0.1:%d" % PORT)
    print("  /health       代理健康检查")
    print("  /api/mihomo   Mihomo 面板转发（备用通道）")
    print("  /api/roles    查 Cookie 关联的星铁账号")
    print("  /api/box      查自己拥有的角色 box")
    print("Cookie 仅内存中转，不落盘。按 Ctrl+C 停止。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.server_close()


if __name__ == "__main__":
    main()
