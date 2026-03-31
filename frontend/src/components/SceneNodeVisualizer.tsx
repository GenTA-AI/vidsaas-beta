"use client";

import { Clock, Film } from "lucide-react";
import { assetUrl } from "@/lib/api";

interface SceneNodeVisualizerProps {
  scenes: Array<{
    id: string;
    order_index: number;
    title: string;
    prompt: string;
    duration_sec: number;
    key_image_url: string | null;
    video_url: string | null;
    status: string;
  }>;
  onSceneClick: (sceneId: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; pulse?: boolean }> = {
  pending:           { color: "text-gray-400",   bg: "bg-gray-500/20 border-gray-500/30",  label: "Pending" },
  generating_image:  { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", label: "Generating Image", pulse: true },
  generating_video:  { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", label: "Generating Video", pulse: true },
  image_ready:       { color: "text-blue-400",   bg: "bg-blue-500/20 border-blue-500/30",   label: "Image Ready" },
  video_ready:       { color: "text-blue-400",   bg: "bg-blue-500/20 border-blue-500/30",   label: "Video Ready" },
  completed:         { color: "text-green-400",  bg: "bg-green-500/20 border-green-500/30", label: "Completed" },
  saved:             { color: "text-green-400",  bg: "bg-green-500/20 border-green-500/30", label: "Saved" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { color: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30", label: status };
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SceneNodeVisualizer({ scenes, onSceneClick }: SceneNodeVisualizerProps) {
  const sorted = [...scenes].sort((a, b) => a.order_index - b.order_index);
  const totalDuration = sorted.reduce((sum, s) => sum + s.duration_sec, 0);

  const legendItems = [
    { label: "Pending",    dot: "bg-gray-400" },
    { label: "Generating", dot: "bg-yellow-400" },
    { label: "Ready",      dot: "bg-blue-400" },
    { label: "Complete",   dot: "bg-green-400" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between rounded-xl bg-[rgba(18,18,18,0.6)] backdrop-blur-xl border border-white/10 px-5 py-3">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-sm text-white/70">
            <Film className="w-4 h-4" />
            {sorted.length} scene{sorted.length !== 1 && "s"}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-white/70">
            <Clock className="w-4 h-4" />
            {formatDuration(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {legendItems.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-white/50">
              <span className={`w-2 h-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Horizontal Scene Flow ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max px-2 py-4">
          {sorted.map((scene, idx) => {
            const cfg = getStatusConfig(scene.status);
            return (
              <div key={scene.id} className="flex items-center">
                {/* Scene Card */}
                <button
                  onClick={() => onSceneClick(scene.id)}
                  className="w-48 flex flex-col items-center gap-2 rounded-xl bg-[rgba(24,24,28,0.7)] backdrop-blur-xl border border-white/10 p-4 hover:border-white/25 hover:bg-[rgba(30,30,36,0.8)] transition-all cursor-pointer group"
                >
                  {/* Scene number circle */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {scene.order_index + 1}
                  </div>

                  {/* Title */}
                  <span className="text-sm font-bold text-white text-center line-clamp-2 leading-tight">
                    {scene.title}
                  </span>

                  {/* Duration badge */}
                  <span className="flex items-center gap-1 text-xs text-white/50 bg-white/5 rounded-full px-2.5 py-0.5">
                    <Clock className="w-3 h-3" />
                    {formatDuration(scene.duration_sec)}
                  </span>

                  {/* Image preview */}
                  {scene.key_image_url && (
                    <div className="w-full aspect-video rounded-lg overflow-hidden border border-white/5">
                      <img
                        src={assetUrl(scene.key_image_url)}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Status badge */}
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.pulse ? "animate-pulse" : ""}`}
                  >
                    {cfg.label}
                  </span>
                </button>

                {/* Connecting line/arrow */}
                {idx < sorted.length - 1 && (
                  <div className="w-10 h-0.5 bg-gradient-to-r from-[#667eea]/60 to-[#764ba2]/60 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Timeline Bar ── */}
      {totalDuration > 0 && (
        <div className="rounded-xl bg-[rgba(18,18,18,0.6)] backdrop-blur-xl border border-white/10 px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Timeline</span>
            <span className="text-xs text-white/30">{formatDuration(totalDuration)}</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
            {sorted.map((scene, idx) => {
              const pct = (scene.duration_sec / totalDuration) * 100;
              const cfg = getStatusConfig(scene.status);
              // Pick a solid color for the bar segment based on status
              const barColor =
                cfg.color.includes("green")  ? "bg-green-500/60" :
                cfg.color.includes("blue")   ? "bg-blue-500/60" :
                cfg.color.includes("yellow") ? "bg-yellow-500/60" :
                                               "bg-gray-500/40";
              return (
                <div
                  key={scene.id}
                  className={`${barColor} ${idx > 0 ? "border-l border-black/20" : ""} relative group/bar cursor-pointer hover:brightness-125 transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${scene.title} — ${formatDuration(scene.duration_sec)}`}
                  onClick={() => onSceneClick(scene.id)}
                >
                  {pct > 12 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/60 truncate px-1">
                      {scene.order_index + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
