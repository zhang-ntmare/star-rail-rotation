# tools/ 工具说明

## video_learn.py —— 视频学习工具链（通用）

适用于 **yt-dlp 支持的所有站点**：B站、抖音、YouTube 等。给排轴器"学习别人的排轴/讲解"用。

### 依赖（均已装）

- `yt-dlp` 2026.10.26（pip 装；**必须走腾讯镜像**：`python -m pip install yt-dlp -i https://mirrors.cloud.tencent.com/pypi/simple`）
- `imageio-ffmpeg`（自带 ffmpeg exe，无需系统 ffmpeg）
- AudioTranscribe：会话内置工具（不用装），支持中文+说话人分离，直接吃 mp4/m4a，≤1GB/5小时

### 用法

```bash
# 完整流程：下载 1080p 视频 + 每5秒抽帧（默认）
python tools/video_learn.py https://www.bilibili.com/video/BVxxxx

# 只要音频（听讲解） / 只要帧（看轴表）
python tools/video_learn.py <URL> --audio-only
python tools/video_learn.py <URL> --no-audio --fps 1
```

输出在 `videos/<BV号或slug>/`：`video.mp4`（或 audio.m4a）+ `frames/f0001.jpg...`

### 配套工作流（Agent 侧）

1. `video_learn.py` 下载
2. 拿 `video.mp4` 调 **AudioTranscribe** → 讲解全文
3. 图像查看逐帧读 `frames/`（轴表 / 伤害数字 / 行动条 / buff栏）
4. 拆解别人的轴 → 对照 `docs/characters/欢愉战舰-完整循环轴.md` 找差异 → 修订文档

### 已知坑

- pip 装 py 包必须 `-i https://mirrors.cloud.tencent.com/pypi/simple`（清华镜像部分包缺失；GitHub release 直连被重置 exit 56）
- B站公开视频无需 cookie；会员/清晰度受限视频可能需要 `--cookies-from-browser edge`
- **抖音 yt-dlp 直连已失效**（web detail 403 "Fresh cookies needed"；Edge cookie 库被锁、Chrome 新版加密提取失败）→ 用以下**直链配方**（2026-11-22 实测可用）：
  1. `POST https://ttwid.bytedance.com/ttwid/union/register/`，body `{"region":"cn","aid":1768,"needFid":false,"service":"www.ixigua.com","migrate_info":{"ticket":"","source":"node"},"cbUrlProtocol":"https","union":true}`，从响应头拿 `ttwid` cookie
  2. 带 ttwid cookie + iPhone UA GET `https://www.iesdouyin.com/share/video/{视频ID}/`（短链 v.douyin.com 先跟随重定向拿 ID）
  3. 从 HTML 解析 `window._ROUTER_DATA` JSON → 找 `play_addr.url_list`
  4. 直链下载：`aweme.snssdk.com/aweme/v1/play/?video_id=...&ratio=1080p&line=0`（`playwm` 换 `play` 可去水印）
  5. 下载产物无音轨问题：imageio ffmpeg `-fflags +genpts` 重封装/直接抽帧可用
  （待办：把配方固化成 `video_learn.py --douyin` 子命令）

## kb/kb.py —— 排轴知识库索引 / 查询 / 召回

`knowledge/` 九区的索引工具。纯标准库，无外部依赖。

```bash
python tools/kb/kb.py build                       # 重建 knowledge/INDEX.md（改完节点必跑）
python tools/kb/kb.py ls 40-enemies               # 列某区节点
python tools/kb/kb.py show 30-units/_index         # 读节点
python tools/kb/kb.py recall 爻光 能量 普攻         # 召回：排轴前必做
python tools/kb/kb.py stats                        # 各区节点数与待钉项
```

匹配：triggers/tags 权重 3、title 2、body 1，乘 IDF；中文 2~4 字滑窗。
判命中要求**至少 2 个不同词**——只靠一个通用词撑分的算假阳性，宁可空着。
