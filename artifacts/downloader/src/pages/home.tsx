import React, { useState } from "react";
import {
  useGetMediaInfo,
  useDownloadFile,
  useGetSupportedPlatforms,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardPaste,
  Download,
  Loader2,
  Music,
  Video,
  Eye,
  Clock,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatNumber(num: number | null | undefined) {
  if (num == null) return null;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  }).format(num);
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  youtube:     { bg: "rgba(255,0,0,0.12)",    text: "#ff4444",  dot: "#FF0000" },
  instagram:   { bg: "rgba(225,48,108,0.12)", text: "#e1306c",  dot: "#E1306C" },
  tiktok:      { bg: "rgba(105,201,208,0.12)",text: "#69c9d0",  dot: "#69C9D0" },
  twitter:     { bg: "rgba(29,161,242,0.12)", text: "#1da1f2",  dot: "#1DA1F2" },
  facebook:    { bg: "rgba(66,103,178,0.12)", text: "#4267b2",  dot: "#4267B2" },
  reddit:      { bg: "rgba(255,69,0,0.12)",   text: "#ff4500",  dot: "#FF4500" },
  twitch:      { bg: "rgba(100,65,165,0.12)", text: "#9147ff",  dot: "#9147FF" },
  vimeo:       { bg: "rgba(26,183,234,0.12)", text: "#1ab7ea",  dot: "#1AB7EA" },
  dailymotion: { bg: "rgba(0,100,255,0.12)",  text: "#0064ff",  dot: "#0064FF" },
  pinterest:   { bg: "rgba(230,0,35,0.12)",   text: "#e60023",  dot: "#E60023" },
  linkedin:    { bg: "rgba(0,119,181,0.12)",  text: "#0077b5",  dot: "#0077B5" },
  snapchat:    { bg: "rgba(255,252,0,0.12)",  text: "#fffc00",  dot: "#FFFC00" },
};

const PLATFORM_ICONS: Record<string, string> = {
  youtube: `<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>`,
  instagram: `<path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12c0 3.259.014 3.668.072 4.948.059 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24c3.259 0 3.668-.014 4.948-.072 1.277-.059 2.148-.261 2.913-.558.788-.306 1.459-.717 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947 0-3.259-.014-3.667-.072-4.947-.059-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>`,
  tiktok: `<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>`,
  twitter: `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 5.935zM17.083 20.003h1.833L6.985 4.126H5.017z"/>`,
  facebook: `<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>`,
  reddit: `<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>`,
  twitch: `<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>`,
  vimeo: `<path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.178 0-.797.375-1.860 1.109L0 7.134c1.185-1.044 2.351-2.087 3.501-3.128C5.08 2.407 6.266 1.686 7.055 1.617c1.854-.18 2.999.109 3.432 2.255.462 2.343.786 3.803.97 4.381.537 2.44 1.127 3.658 1.769 3.658.5 0 1.25-.79 2.25-2.37 1-1.58 1.536-2.781 1.612-3.605.144-1.366-.395-2.053-1.614-2.053-.57 0-1.157.07-1.769.255 1.17-3.834 3.427-5.7 6.774-5.596 2.488.038 3.664 1.675 3.498 4.479z"/>`,
  dailymotion: `<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.5 16.5A4.5 4.5 0 0 1 11 12a4.5 4.5 0 0 1 4.5-4.5V5h2v14h-2v-2.5zm-2 0V7.5A2.5 2.5 0 0 0 11 10a2.5 2.5 0 0 0 0 4 2.5 2.5 0 0 0 2.5 2.5z"/>`,
  pinterest: `<path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>`,
  linkedin: `<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>`,
  snapchat: `<path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.148-.015h-.075c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>`,
};

function PlatformIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const svgPath = PLATFORM_ICONS[icon.toLowerCase()];
  if (!svgPath) {
    return (
      <span style={{ fontSize: size * 0.6, fontWeight: 700 }}>
        {icon.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: svgPath }}
    />
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedFormatId, setSelectedFormatId] = useState<string>("");
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const getMediaInfo = useGetMediaInfo();
  const downloadFile = useDownloadFile();
  const { data: platformsData } = useGetSupportedPlatforms();

  const mediaInfo = getMediaInfo.data;
  const isLoading = getMediaInfo.isPending;
  const isDownloading = downloadFile.isPending || downloadProgress !== null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      toast({ title: "Paste failed", description: "Please paste manually.", variant: "destructive" });
    }
  };

  const handleFetch = () => {
    if (!url.trim()) return;
    getMediaInfo.mutate(
      { data: { url } },
      {
        onSuccess: (data) => {
          if (data.formats.length > 0) setSelectedFormatId(data.formats[0].formatId);
        },
        onError: (err) => {
          toast({ title: "Failed", description: err.error || "Could not load media info.", variant: "destructive" });
        },
      }
    );
  };

  const handleDownload = () => {
    if (!selectedFormatId || downloadProgress) return;

    // Get estimated size of selected format to decide download strategy
    const selectedFmt = mediaInfo?.formats.find((f) => f.formatId === selectedFormatId);
    const estimatedBytes = selectedFmt?.filesize ?? null;
    // Files > 300 MB: use native browser download (avoids loading huge files into browser RAM)
    const isLargeFile = estimatedBytes != null ? estimatedBytes > 300_000_000 : false;

    downloadFile.mutate(
      { data: { url, formatId: selectedFormatId } },
      {
        onSuccess: async (data) => {
          if (isLargeFile) {
            // Large file: let browser download manager handle it natively (streams to disk)
            setDownloadProgress("Preparing download…");
            const a = document.createElement("a");
            a.href = data.downloadUrl;
            a.setAttribute("download", data.filename);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Show processing state briefly — browser takes over from here
            setTimeout(() => {
              setDownloadProgress(null);
              toast({ title: "Download started", description: "Your file is being prepared. Check your downloads folder." });
            }, 1500);
            return;
          }

          // Small file: fetch+blob with progress bar and error detection
          try {
            setDownloadProgress("Processing…");

            const response = await fetch(data.downloadUrl);

            if (!response.ok) {
              let errMsg = "Download failed. Please try again.";
              try {
                const errData = await response.json();
                errMsg = errData.error || errMsg;
              } catch { /* ignore */ }
              toast({ title: "Download failed", description: errMsg, variant: "destructive" });
              setDownloadProgress(null);
              return;
            }

            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const errData = await response.json();
              toast({ title: "Download failed", description: errData.error || "Server error", variant: "destructive" });
              setDownloadProgress(null);
              return;
            }

            setDownloadProgress("Downloading…");

            const contentLength = response.headers.get("content-length");
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            const reader = response.body!.getReader();
            const chunks: Uint8Array[] = [];
            let received = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
              received += value.length;
              if (total > 0) {
                const pct = Math.round((received / total) * 100);
                setDownloadProgress(`Downloading… ${pct}%`);
              }
            }

            const blob = new Blob(chunks, { type: contentType || "application/octet-stream" });
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

            toast({ title: "Download complete" });
          } catch {
            toast({ title: "Download failed", description: "Network error. Please try again.", variant: "destructive" });
          } finally {
            setDownloadProgress(null);
          }
        },
        onError: (err) => {
          toast({ title: "Download failed", description: err.error || "Please try again.", variant: "destructive" });
          setDownloadProgress(null);
        },
      }
    );
  };

  const platformStyle = mediaInfo
    ? PLATFORM_COLORS[
        (platformsData?.platforms.find((p) => p.name === mediaInfo.platform)?.icon || "").toLowerCase()
      ] || { bg: "rgba(255,255,255,0.08)", text: "#ffffff", dot: "#ffffff" }
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "-20vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "0 24px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Download size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", color: "#fff" }}>
              MediaGrab
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "monospace",
              background: "rgba(255,255,255,0.05)",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            1000+ platforms
          </span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: 860,
          margin: "0 auto",
          width: "100%",
          padding: "60px 24px 80px",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 48,
        }}
      >
        {/* Hero */}
        <section style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              background: "linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.5))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: 0,
            }}
          >
            Download any video
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #6366f1, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              in any quality.
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, margin: 0, maxWidth: 420 }}>
            Paste a link from YouTube, Instagram, TikTok, or 1000+ other platforms.
          </p>
        </section>

        {/* URL Input */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
              padding: "6px 6px 6px 16px",
              transition: "border-color 0.2s",
            }}
            onFocus={() => {}}
          >
            <Search size={16} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginRight: 10 }} />
            <input
              type="url"
              placeholder="Paste a social media link…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: 15,
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handlePaste}
              title="Paste from clipboard"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 12,
                marginRight: 6,
                flexShrink: 0,
              }}
            >
              <ClipboardPaste size={13} />
              Paste
            </button>
            <button
              onClick={handleFetch}
              disabled={isLoading || !url.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: isLoading || !url.trim()
                  ? "rgba(99,102,241,0.4)"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                color: "#fff",
                borderRadius: 9,
                padding: "10px 20px",
                cursor: isLoading || !url.trim() ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
                transition: "opacity 0.2s",
              }}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              {isLoading ? "Fetching…" : "Fetch"}
            </button>
          </div>
        </section>

        {/* Loading state */}
        {isLoading && !mediaInfo && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Loader2 size={28} color="#6366f1" className="animate-spin" />
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Fetching media info…</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {getMediaInfo.error && !isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "16px 20px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 12,
            }}
          >
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ color: "#ef4444", fontWeight: 600, fontSize: 14 }}>Could not fetch media</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
                {getMediaInfo.error.error || "Make sure the URL is correct and the content is public."}
              </div>
            </div>
          </div>
        )}

        {/* Media Info + Formats */}
        {mediaInfo && !isLoading && (
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              animation: "fadeIn 0.4s ease",
            }}
          >
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>

            {/* Media card */}
            <div
              style={{
                display: "flex",
                gap: 0,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  flexShrink: 0,
                  width: 200,
                  background: "rgba(255,255,255,0.05)",
                  position: "relative",
                  minHeight: 130,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mediaInfo.thumbnail ? (
                  <img
                    src={mediaInfo.thumbnail}
                    alt={mediaInfo.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <Video size={32} color="rgba(255,255,255,0.15)" />
                )}
                {/* Duration badge */}
                {mediaInfo.duration && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      background: "rgba(0,0,0,0.75)",
                      backdropFilter: "blur(4px)",
                      borderRadius: 6,
                      padding: "2px 7px",
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "#fff",
                    }}
                  >
                    {formatDuration(mediaInfo.duration)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                {/* Platform badge */}
                {platformStyle && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: platformStyle.bg,
                        color: platformStyle.text,
                        border: `1px solid ${platformStyle.text}30`,
                        borderRadius: 20,
                        padding: "3px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          color: platformStyle.text,
                        }}
                      >
                        <PlatformIcon
                          icon={
                            platformsData?.platforms.find((p) => p.name === mediaInfo.platform)?.icon || ""
                          }
                          size={13}
                        />
                      </span>
                      {mediaInfo.platform}
                    </span>
                  </div>
                )}

                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    margin: 0,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    color: "#fff",
                  }}
                >
                  {mediaInfo.title}
                </h2>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  {mediaInfo.uploader && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <User size={12} />
                      {mediaInfo.uploader}
                    </span>
                  )}
                  {mediaInfo.viewCount && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Eye size={12} />
                      {formatNumber(mediaInfo.viewCount)} views
                    </span>
                  )}
                  {mediaInfo.duration && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={12} />
                      {formatDuration(mediaInfo.duration)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Format cards */}
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>
                Select Quality
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 8,
                }}
              >
                {mediaInfo.formats.map((fmt) => {
                  const isSelected = selectedFormatId === fmt.formatId;
                  const size = formatBytes(fmt.filesize);
                  const isAudio = !fmt.hasVideo && fmt.hasAudio;
                  return (
                    <button
                      key={fmt.formatId}
                      onClick={() => setSelectedFormatId(fmt.formatId)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 6,
                        padding: "12px 14px",
                        background: isSelected
                          ? "rgba(99,102,241,0.15)"
                          : "rgba(255,255,255,0.03)",
                        border: isSelected
                          ? "1px solid rgba(99,102,241,0.6)"
                          : "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 10,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        position: "relative",
                      }}
                    >
                      {isSelected && (
                        <div style={{ position: "absolute", top: 8, right: 8 }}>
                          <CheckCircle2 size={14} color="#6366f1" />
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: isSelected ? "#a78bfa" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {isAudio ? <Music size={12} /> : <Video size={12} />}
                        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                          {isAudio ? "Audio" : "Video"}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isSelected ? "#fff" : "rgba(255,255,255,0.85)",
                          lineHeight: 1.3,
                        }}
                      >
                        {fmt.quality}
                      </div>
                      {size && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                          est. {size}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading || !selectedFormatId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                padding: "15px 24px",
                background:
                  isDownloading || !selectedFormatId
                    ? "rgba(99,102,241,0.3)"
                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 12,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: isDownloading || !selectedFormatId ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em",
                transition: "opacity 0.2s",
              }}
            >
              {isDownloading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  {downloadProgress || "Preparing…"}
                </>
              ) : (
                <>
                  <Download size={17} />
                  Download
                  {selectedFormatId &&
                    mediaInfo.formats.find((f) => f.formatId === selectedFormatId)
                      ? ` — ${mediaInfo.formats.find((f) => f.formatId === selectedFormatId)!.quality}`
                      : ""}
                </>
              )}
            </button>
          </section>
        )}

        {/* Supported Platforms */}
        <section style={{ paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, textAlign: "center", marginBottom: 20 }}>
            Supported Platforms
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
            }}
          >
            {(platformsData?.platforms ?? []).map((p) => {
              const pStyle = PLATFORM_COLORS[p.icon.toLowerCase()] || { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.5)", dot: "#fff" };
              return (
                <div
                  key={p.name}
                  title={p.examples.join(", ")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 14px",
                    background: pStyle.bg,
                    border: `1px solid ${pStyle.text}25`,
                    borderRadius: 30,
                    cursor: "default",
                    transition: "transform 0.15s",
                  }}
                >
                  <span style={{ color: pStyle.text, display: "flex", alignItems: "center" }}>
                    <PlatformIcon icon={p.icon} size={14} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: pStyle.text }}>
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
