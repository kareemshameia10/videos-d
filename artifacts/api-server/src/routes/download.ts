import { Router, type IRouter } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import {
  GetMediaInfoBody,
  DownloadFileBody,
} from "@workspace/api-zod";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const YT_DLP_PATH = "/home/runner/workspace/.pythonlibs/bin/yt-dlp";

const SUPPORTED_PLATFORMS = [
  { name: "YouTube",     icon: "youtube",     examples: ["youtube.com", "youtu.be"] },
  { name: "Instagram",   icon: "instagram",   examples: ["instagram.com"] },
  { name: "TikTok",      icon: "tiktok",      examples: ["tiktok.com", "vm.tiktok.com"] },
  { name: "Twitter / X", icon: "twitter",     examples: ["twitter.com", "x.com"] },
  { name: "Facebook",    icon: "facebook",    examples: ["facebook.com", "fb.watch"] },
  { name: "Reddit",      icon: "reddit",      examples: ["reddit.com", "v.redd.it"] },
  { name: "Twitch",      icon: "twitch",      examples: ["twitch.tv", "clips.twitch.tv"] },
  { name: "Vimeo",       icon: "vimeo",       examples: ["vimeo.com"] },
  { name: "Dailymotion", icon: "dailymotion", examples: ["dailymotion.com"] },
  { name: "Pinterest",   icon: "pinterest",   examples: ["pinterest.com"] },
  { name: "LinkedIn",    icon: "linkedin",    examples: ["linkedin.com"] },
  { name: "Snapchat",    icon: "snapchat",    examples: ["snapchat.com"] },
];

function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  for (const p of SUPPORTED_PLATFORMS) {
    for (const ex of p.examples) {
      if (urlLower.includes(ex)) return p.name;
    }
  }
  return "Unknown";
}

interface RawFormat {
  format_id: string;
  ext?: string;
  format_note?: string;
  filesize?: number | null;
  filesize_approx?: number | null;
  height?: number | null;
  width?: number | null;
  fps?: number | null;
  vcodec?: string;
  acodec?: string;
  abr?: number;
  tbr?: number;
  url?: string;
  resolution?: string; // e.g. "3840x2160" — used as height fallback
}

function fmtHasVideo(f: RawFormat) {
  return !!(f.vcodec && f.vcodec !== "none");
}
function fmtHasAudio(f: RawFormat) {
  return !!(f.acodec && f.acodec !== "none");
}
function fmtSize(f: RawFormat): number | null {
  return f.filesize ?? f.filesize_approx ?? null;
}
// Extract height from height field, or parse "WxH" resolution string as fallback
function fmtHeight(f: RawFormat): number | null {
  if (f.height && f.height > 0) return f.height;
  if (f.resolution) {
    const m = f.resolution.match(/(\d+)x(\d+)/i);
    if (m) return parseInt(m[2], 10); // second number is height
  }
  return null;
}

// Clean up old temp files (older than 1 hour)
function cleanOldTempFiles() {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();
    for (const file of files) {
      if (!file.startsWith("mediagrab_")) continue;
      const fullPath = path.join(tmpDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > 3600_000) fs.unlinkSync(fullPath);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

router.get("/download/supported-platforms", async (_req, res): Promise<void> => {
  res.json({ platforms: SUPPORTED_PLATFORMS });
});

router.post("/download/info", async (req, res): Promise<void> => {
  const parsed = GetMediaInfoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url } = parsed.data;

  try {
    const { stdout } = await execFileAsync(
      YT_DLP_PATH,
      ["--dump-json", "--no-playlist", "--no-warnings", url],
      { timeout: 30000 }
    );

    const info = JSON.parse(stdout);
    const rawFormats: RawFormat[] = info.formats || [];

    // Find best audio track for size estimation
    const bestAudioTrack = rawFormats
      .filter((f) => !fmtHasVideo(f) && fmtHasAudio(f))
      .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];
    const bestAudioSize = bestAudioTrack ? fmtSize(bestAudioTrack) : null;

    // Collect all unique heights with video (use fmtHeight to catch resolution-field heights too)
    const availableHeights = [
      ...new Set(
        rawFormats
          .filter((f) => fmtHasVideo(f) && fmtHeight(f) != null && fmtHeight(f)! > 0)
          .map((f) => fmtHeight(f) as number)
      ),
    ].sort((a, b) => b - a);

    const STANDARD_HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240, 144];
    const seenHeights = new Set<number>();
    const smartFormats: Array<{
      formatId: string;
      quality: string;
      ext: string;
      filesize: number | null;
      resolution: string | null;
      fps: number | null;
      vcodec: string | null;
      acodec: string | null;
      hasVideo: boolean;
      hasAudio: boolean;
    }> = [];

    for (const stdH of STANDARD_HEIGHTS) {
      // Best available height at or below this standard
      const matchH = availableHeights.find((h) => h <= stdH);
      if (matchH == null) continue;
      if (seenHeights.has(matchH)) continue;
      seenHeights.add(matchH);

      // Best video-only track at or below this height (use fmtHeight fallback)
      const bestVideoTrack = rawFormats
        .filter((f) => fmtHasVideo(f) && (fmtHeight(f) || 0) <= matchH)
        .sort((a, b) => (fmtHeight(b) || 0) - (fmtHeight(a) || 0) || (b.tbr || 0) - (a.tbr || 0))[0];

      if (!bestVideoTrack) continue;

      const bvHeight = fmtHeight(bestVideoTrack);

      // Estimate total size = best video at this height + best audio
      const videoSize = fmtSize(bestVideoTrack);
      const estimatedSize =
        videoSize != null && bestAudioSize != null
          ? videoSize + bestAudioSize
          : videoSize ?? bestAudioSize ?? null;

      const label =
        matchH === 2160
          ? `4K Ultra HD — ${matchH}p`
          : matchH === 1440
          ? `2K QHD — ${matchH}p`
          : matchH >= 1080
          ? `Full HD — ${matchH}p`
          : matchH >= 720
          ? `HD — ${matchH}p`
          : `SD — ${matchH}p`;

      // yt-dlp selector: merge best video at this height with best audio
      const formatSelector = `bestvideo[height<=${matchH}]+bestaudio/best[height<=${matchH}]/best`;

      smartFormats.push({
        formatId: formatSelector,
        quality: label,
        ext: "mp4",
        filesize: estimatedSize,
        resolution: bvHeight ? `${bestVideoTrack.width || "?"}x${bvHeight}` : null,
        fps: bestVideoTrack.fps ?? null,
        vcodec: bestVideoTrack.vcodec ?? null,
        acodec: bestAudioTrack?.acodec ?? null,
        hasVideo: true,
        hasAudio: true,
      });
    }

    // Audio-only options
    const audioCandidates = rawFormats
      .filter((f) => !fmtHasVideo(f) && fmtHasAudio(f))
      .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

    if (audioCandidates.length > 0) {
      const best = audioCandidates[0];
      const abr = best.abr || best.tbr;
      smartFormats.push({
        formatId: "bestaudio/best",
        quality: `Audio Only${abr ? ` — ${Math.round(abr)}kbps` : ""}`,
        ext: best.ext === "webm" ? "webm" : best.ext || "m4a",
        filesize: fmtSize(best),
        resolution: null,
        fps: null,
        vcodec: null,
        acodec: best.acodec ?? null,
        hasVideo: false,
        hasAudio: true,
      });
      // MP3 option
      smartFormats.push({
        formatId: "bestaudio[ext=mp3]/bestaudio",
        quality: "Audio Only — MP3",
        ext: "mp3",
        filesize: null,
        resolution: null,
        fps: null,
        vcodec: null,
        acodec: "mp3",
        hasVideo: false,
        hasAudio: true,
      });
    }

    // Fallback for direct media with no format list
    const finalFormats =
      smartFormats.length > 0
        ? smartFormats
        : rawFormats.slice(0, 12).map((f) => ({
            formatId: f.format_id,
            quality: f.format_note || f.format_id,
            ext: f.ext || "mp4",
            filesize: fmtSize(f),
            resolution: f.height ? `${f.width || "?"}x${f.height}` : null,
            fps: f.fps ?? null,
            vcodec: f.vcodec ?? null,
            acodec: f.acodec ?? null,
            hasVideo: fmtHasVideo(f),
            hasAudio: fmtHasAudio(f),
          }));

    let mediaType: "video" | "image" | "audio" = "video";
    if (["jpg", "jpeg", "png", "webp"].includes(info.ext ?? "")) {
      mediaType = "image";
    } else if (finalFormats.every((f) => !f.hasVideo)) {
      mediaType = "audio";
    }

    res.json({
      title: info.title || "Untitled",
      platform: detectPlatform(url),
      thumbnail: info.thumbnail ?? null,
      duration: info.duration ?? null,
      uploader: info.uploader ?? null,
      viewCount: info.view_count ?? null,
      mediaType,
      formats: finalFormats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, url }, "Failed to fetch media info");
    if (message.includes("is not a valid URL") || message.includes("Unsupported URL")) {
      res.status(400).json({ error: "This URL is not supported. Please paste a valid social media link." });
    } else if (message.toLowerCase().includes("private")) {
      res.status(400).json({ error: "This content is private and cannot be downloaded." });
    } else {
      res.status(500).json({ error: "Failed to fetch media info. Make sure the URL is correct and the content is public." });
    }
  }
});

router.post("/download/file", async (req, res): Promise<void> => {
  const parsed = DownloadFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, formatId } = parsed.data;

  try {
    // Get media title for filename
    const { stdout } = await execFileAsync(
      YT_DLP_PATH,
      ["--dump-json", "--no-playlist", "--no-warnings", url],
      { timeout: 30000 }
    );
    const info = JSON.parse(stdout);
    const safeTitle = (info.title || "media")
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80);

    // Determine extension: for merged formats use mp4, for audio use m4a
    const isAudioOnly = formatId.includes("bestaudio") && !formatId.includes("bestvideo");
    const ext = isAudioOnly ? "m4a" : "mp4";

    // Always use stream endpoint — this handles merging correctly via temp file
    const proxyUrl = `/api/download/stream?url=${encodeURIComponent(url)}&format=${encodeURIComponent(formatId)}&title=${encodeURIComponent(safeTitle)}`;
    res.json({ downloadUrl: proxyUrl, filename: `${safeTitle}.${ext}`, ext });
  } catch (err: unknown) {
    req.log.error({ err, url, formatId }, "Failed to prepare download");
    res.status(500).json({ error: "Failed to prepare the download. Please try again." });
  }
});

router.get("/download/stream", async (req, res): Promise<void> => {
  const rawUrl = req.query["url"];
  const rawFormat = req.query["format"];
  const rawTitle = req.query["title"];

  const url = Array.isArray(rawUrl) ? rawUrl[0] : (rawUrl as string | undefined);
  const format = Array.isArray(rawFormat) ? rawFormat[0] : (rawFormat as string | undefined);
  const title = Array.isArray(rawTitle) ? rawTitle[0] : (rawTitle as string | undefined);

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  cleanOldTempFiles();

  // Build a unique temp output template
  const prefix = `mediagrab_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const tmpDir = os.tmpdir();
  const outputTemplate = path.join(tmpDir, `${prefix}.%(ext)s`);

  const isAudioOnly = format && format.includes("bestaudio") && !format.includes("bestvideo");

  const args: string[] = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "-o", outputTemplate,
  ];

  // Use ffmpeg for merging video+audio — it's available at system level
  if (format && typeof format === "string") {
    args.push("-f", format);
  }

  // For audio-only, convert to m4a
  if (isAudioOnly) {
    args.push("--extract-audio", "--audio-format", "m4a");
  } else {
    // Remux merged video to mp4 container
    args.push("--merge-output-format", "mp4");
  }

  args.push(url);

  req.log.info({ url, format, prefix }, "Starting yt-dlp download to temp file");

  try {
    await execFileAsync(YT_DLP_PATH, args, {
      timeout: 300_000, // 5 minutes
      maxBuffer: 50 * 1024 * 1024, // 50 MB stdout buffer (for stderr/stdout logs)
    });

    // Find the downloaded file
    const tmpFiles = fs.readdirSync(tmpDir).filter((f) => f.startsWith(prefix));
    if (tmpFiles.length === 0) {
      req.log.error({ prefix }, "No temp file found after yt-dlp download");
      res.status(500).json({ error: "Download failed — no output file produced." });
      return;
    }

    const filePath = path.join(tmpDir, tmpFiles[0]);
    const ext = path.extname(tmpFiles[0]).slice(1) || (isAudioOnly ? "m4a" : "mp4");
    const stat = fs.statSync(filePath);
    const safeFilename = title
      ? `${title}.${ext}`
      : `media.${ext}`;

    const mimeTypes: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mkv: "video/x-matroska",
      m4a: "audio/mp4",
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
    };
    const mime = mimeTypes[ext] || "application/octet-stream";

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeFilename)}"`);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");

    req.log.info({ filePath, size: stat.size, ext }, "Streaming temp file to client");

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Clean up after stream ends
    fileStream.on("end", () => {
      fs.unlink(filePath, (err) => {
        if (err) req.log.warn({ err, filePath }, "Failed to delete temp file");
      });
    });
    fileStream.on("error", (err) => {
      req.log.error({ err, filePath }, "File stream error");
      if (!res.headersSent) res.status(500).json({ error: "Stream error" });
      fs.unlink(filePath, () => {});
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, url, format }, "yt-dlp download failed");

    // Clean up any partial files
    try {
      const tmpFiles = fs.readdirSync(tmpDir).filter((f) => f.startsWith(prefix));
      for (const f of tmpFiles) fs.unlinkSync(path.join(tmpDir, f));
    } catch {
      // ignore cleanup errors
    }

    if (!res.headersSent) {
      if (message.includes("429") || message.includes("Too Many")) {
        res.status(429).json({ error: "Rate limited by the platform. Please wait a moment and try again." });
      } else {
        res.status(500).json({ error: "Download failed. The format may not be available or the content is restricted." });
      }
    }
  }
});

export default router;
