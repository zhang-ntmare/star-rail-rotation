# -*- coding: utf-8 -*-
"""
video_learn.py —— 视频学习工具链（通用，适用于 yt-dlp 支持的所有站点）
B站 / 抖音 / YouTube / 任意 yt-dlp 支持的 URL。

用法：
    python tools/video_learn.py <URL> [--fps 0.2] [--max-frames 60] [--audio-only]

流程（对应排轴器"学习别人的轴"工作流）：
    1. 本脚本：下载视频到 videos/<slug>/video.mp4，按间隔抽帧到 videos/<slug>/frames/
    2. Agent 拿 videos/<slug>/video.mp4 调 AudioTranscribe 工具 → 讲解全文（中文+说话人分离）
    3. Agent 用图像查看逐帧读轴表 / 伤害数字 / 行动条

依赖（已装）：yt-dlp（pip 腾讯镜像）、imageio-ffmpeg（自带 ffmpeg exe）
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
VIDEO_DIR = ROOT / "videos"


def slugify(url: str) -> str:
    """从 URL 提取可读目录名：B站用 BV 号，其他用域名+日期。"""
    m = re.search(r"(BV[0-9A-Za-z]{10})", url)
    if m:
        return m.group(1)
    m = re.search(r"(?:video|note|shorts)/(\w{6,})", url)
    if m:
        return m.group(1)[:40]
    host = re.sub(r"[^a-z0-9]", "", url.split("//")[-1].split("/")[0])[:20]
    from datetime import date
    return f"{host}-{date.today():%Y%m%d}"


def run(cmd: list[str]) -> None:
    print("+", " ".join(str(c) for c in cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    tail = (r.stdout + r.stderr).strip().splitlines()[-6:]
    print("\n".join(tail))
    if r.returncode != 0:
        sys.exit(f"[FAIL] exit={r.returncode}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--fps", type=float, default=0.2, help="抽帧每秒帧数，默认 0.2 = 每 5 秒一帧")
    ap.add_argument("--max-frames", type=int, default=60, help="最多保留帧数，超出均匀丢弃")
    ap.add_argument("--audio-only", action="store_true", help="只下音频（m4a），不抽帧")
    ap.add_argument("--no-audio", action="store_true", help="只抽帧，不保留完整视频/音频")
    args = ap.parse_args()

    slug = slugify(args.url)
    work = VIDEO_DIR / slug
    work.mkdir(parents=True, exist_ok=True)
    ytdlp = [sys.executable, "-m", "yt_dlp"]
    try:
        import imageio_ffmpeg
        ytdlp += ["--ffmpeg-location", imageio_ffmpeg.get_ffmpeg_exe()]
    except ImportError:
        pass

    # 1) 下载
    if args.audio_only:
        run(ytdlp + ["-f", "ba/b", "--merge-output-format", "mp4",
                     "-o", str(work / "audio.%(ext)s"), args.url])
        media = sorted(work.glob("audio.*"))[0]
    else:
        run(ytdlp + ["-f", "bv*[height<=1080]+ba/b[height<=1080]",
                     "--merge-output-format", "mp4",
                     "-o", str(work / "video.%(ext)s"), args.url])
        media = sorted(work.glob("video.*"))[0]

    # 2) 抽帧
    frames = work / "frames"
    if not args.audio_only:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        frames.mkdir(exist_ok=True)
        run([ff, "-y", "-i", str(media), "-vf", f"fps={args.fps},scale=1280:-2",
             "-q:v", "2", str(frames / "f%04d.jpg")])
        got = sorted(frames.glob("f*.jpg"))
        if len(got) > args.max_frames:
            keep = {got[int(i * len(got) / args.max_frames)] for i in range(args.max_frames)}
            for f in got:
                if f not in keep:
                    f.unlink()
        got = sorted(frames.glob("f*.jpg"))

    print("\n=== DONE ===")
    print(f"目录: {work}")
    if not args.audio_only:
        print(f"帧数: {len(list(frames.glob('f*.jpg')))} → 供图像查看逐帧读轴表/伤害数字")
    if not args.no_audio:
        print(f"媒体: {media} → 拿此路径调 AudioTranscribe 得讲解全文")


if __name__ == "__main__":
    main()
