"use client";

import { useState } from "react";
import { api, assetUrl, type Scene } from "@/lib/api";
import { Loader2, Check, Film, Type, Plus, Trash2, Maximize2, Minimize2 } from "lucide-react";
import React from "react";

interface SubtitleEntry {
  text: string;
  start: number;
  end: number;
  style: string;
  size: number; // px
  position: string; // center, top, bottom
  fadeIn: number; // seconds
  fadeOut: number; // seconds
}

// 프리뷰와 FFmpeg 출력이 일치하도록 scale 기반 렌더링
function SubtitlePreview({ sub, time, scale }: { sub: SubtitleEntry; time: number; scale: number }) {
  const fadeIn = sub.fadeIn ?? 0.3;
  const fadeOut = sub.fadeOut ?? 0.3;
  let opacity = 1;
  if (fadeIn > 0 && time - sub.start < fadeIn) opacity = Math.min(opacity, (time - sub.start) / fadeIn);
  if (fadeOut > 0 && sub.end - time < fadeOut) opacity = Math.min(opacity, (sub.end - time) / fadeOut);
  opacity = Math.max(0, Math.min(1, opacity));

  const styleObj = STYLES[sub.style]?.style || STYLES.default.style;
  const fontSize = Math.round((sub.size || 42) * scale);

  return (
    <div
      className={`absolute inset-0 flex justify-center pointer-events-none text-center ${
        sub.position === "top" ? "items-start pt-[8%]" : sub.position === "bottom" ? "items-end pb-[8%]" : "items-center"
      }`}
      style={{ opacity }}
    >
      <span style={{ ...styleObj, fontSize: `${fontSize}px`, whiteSpace: "pre-line", lineHeight: 1.4 }}>
        {sub.text}
      </span>
    </div>
  );
}

interface PostProductionEditorProps {
  projectId: string;
  scenes: Scene[];
  onRefresh: () => void;
}

const TRANSITIONS = [
  { id: "cut", label: "컷", desc: "즉시 전환" },
  { id: "dissolve", label: "디졸브", desc: "겹치며 전환" },
  { id: "fade_black", label: "페이드 (블랙)", desc: "검은 화면으로 전환" },
  { id: "fade_white", label: "페이드 (화이트)", desc: "흰 화면으로 전환" },
  { id: "wipe", label: "와이프", desc: "밀어내기 전환" },
];

const STYLES: Record<string, { label: string; style: React.CSSProperties }> = {
  default: { label: "기본", style: { color: "white", fontWeight: 500, textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)" } },
  bold: { label: "굵은", style: { color: "white", fontWeight: 700, textShadow: "0 2px 6px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,0.8)" } },
  minimal: { label: "미니멀", style: { color: "rgba(255,255,255,0.85)", fontWeight: 400, textShadow: "0 1px 2px rgba(0,0,0,0.5)" } },
  cinematic: { label: "시네마틱", style: { color: "white", fontWeight: 600, letterSpacing: "0.15em", textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.6)" } },
  news: { label: "뉴스", style: { color: "white", fontWeight: 500, background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: "4px" } },
};

function parseSubs(json: string): SubtitleEntry[] {
  try {
    const parsed = JSON.parse(json || "[]");
    if (Array.isArray(parsed)) return parsed;
    if (parsed.subs) return parsed.subs;
    return [];
  } catch { return []; }
}

function parseSpeed(json: string): number {
  try {
    const parsed = JSON.parse(json || "{}");
    return parsed.speed ?? 1;
  } catch { return 1; }
}

const SPEED_OPTIONS = [
  { value: 0.25, label: "0.25x (슬로우)" },
  { value: 0.5, label: "0.5x (슬로우)" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x (원본)" },
  { value: 1.5, label: "1.5x (빠르게)" },
  { value: 2, label: "2x (빠르게)" },
];

export default function PostProductionEditor({ projectId, scenes, onRefresh }: PostProductionEditorProps) {
  const [sceneSubs, setSceneSubs] = useState<Record<string, SubtitleEntry[]>>(() => {
    const init: Record<string, SubtitleEntry[]> = {};
    scenes.forEach((s) => { init[s.id] = parseSubs(s.subtitles_json); });
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<Record<string, number>>({});
  const [focusScene, setFocusScene] = useState<string | null>(null);
  const [sceneSpeed, setSceneSpeed] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    scenes.forEach((s) => { init[s.id] = parseSpeed(s.subtitles_json); });
    return init;
  });

  const getSubs = (sceneId: string) => sceneSubs[sceneId] || [];

  const updateSub = (sceneId: string, idx: number, field: string, value: string | number) => {
    setSceneSubs((prev) => {
      const subs = [...(prev[sceneId] || [])];
      subs[idx] = { ...subs[idx], [field]: value };
      return { ...prev, [sceneId]: subs };
    });
  };

  const addSub = (sceneId: string, duration: number) => {
    const subs = getSubs(sceneId);
    const lastEnd = subs.length > 0 ? subs[subs.length - 1].end : 0;
    setSceneSubs((prev) => ({
      ...prev,
      [sceneId]: [...(prev[sceneId] || []), { text: "", start: lastEnd, end: Math.min(lastEnd + 2, duration), style: "cinematic", size: 42, position: "center", fadeIn: 0.3, fadeOut: 0.3 }],
    }));
  };

  const removeSub = (sceneId: string, idx: number) => {
    setSceneSubs((prev) => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).filter((_, i) => i !== idx),
    }));
  };

  const saveSubs = async (sceneId: string) => {
    setSaving(sceneId);
    try {
      await api.updateScene(projectId, sceneId, { subtitles_json: JSON.stringify(getSubs(sceneId)) });
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("저장 실패 — 페이지를 새로고침 해주세요.");
    }
    finally { setSaving(null); }
  };

  const handleComplete = async () => {
    // Save subtitles + speed
    for (const scene of scenes) {
      const speed = sceneSpeed[scene.id] ?? 1;
      const payload = JSON.stringify({ subs: getSubs(scene.id), speed });
      await api.updateScene(projectId, scene.id, { subtitles_json: payload });
    }
    setCompleting(true);
    try {
      const result = await api.completeProject(projectId);
      setOutputDir(result.output_dir);
      onRefresh();
      await api.openFolder(projectId, result.output_dir).catch(() => {});
    } catch (e) { alert(e instanceof Error ? e.message : "실패"); }
    finally { setCompleting(false); }
  };

  const handleTransition = async (sceneId: string, value: string) => {
    setSaving(sceneId);
    try { await api.updateScene(projectId, sceneId, { transition: value }); onRefresh(); }
    catch (e) { console.error(e); }
    finally { setSaving(null); }
  };

  // Which subtitle is visible at a given time?
  const visibleSub = (sceneId: string): SubtitleEntry | null => {
    const t = previewTime[sceneId] ?? 0;
    return getSubs(sceneId).find((s) => t >= s.start && t < s.end) || null;
  };

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {scenes.map((scene, idx) => {
          const subs = getSubs(scene.id);
          const active = visibleSub(scene.id);

          return (
            <div key={scene.id}>
              {idx > 0 && (
                <div className="flex items-center gap-3 py-2 px-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <select value={scene.transition} onChange={(e) => handleTransition(scene.id, e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 focus:outline-none focus:ring-1 focus:ring-[#667eea]">
                    {TRANSITIONS.map((t) => <option key={t.id} value={t.id} className="bg-[#141414]">{t.label} — {t.desc}</option>)}
                  </select>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              <div className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-5">
                <div className={focusScene === scene.id ? "flex flex-col gap-4" : "flex gap-5"}>
                  {/* Preview with subtitle overlay */}
                  <div className={focusScene === scene.id ? "w-full" : "w-80 shrink-0"}>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                      {/* Focus toggle */}
                      <button
                        onClick={() => setFocusScene(focusScene === scene.id ? null : scene.id)}
                        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/60 hover:text-white transition"
                      >
                        {focusScene === scene.id ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                      {scene.key_image_url ? (
                        <img src={assetUrl(scene.key_image_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-white/10" /></div>
                      )}
                      {/* Active subtitle */}
                      {active && active.text && <SubtitlePreview sub={active} time={previewTime[scene.id] ?? 0} scale={focusScene === scene.id ? 0.55 : 0.35} />}
                    </div>

                    {/* Time scrubber */}
                    <div className="mt-2">
                      <input
                        type="range" min={0} max={scene.duration_sec} step={0.1}
                        value={previewTime[scene.id] ?? 0}
                        onChange={(e) => setPreviewTime((p) => ({ ...p, [scene.id]: parseFloat(e.target.value) }))}
                        className="w-full h-1 accent-[#667eea] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-white/20">
                        <span>{(previewTime[scene.id] ?? 0).toFixed(1)}s</span>
                        <span>씬 {scene.order_index + 1}</span>
                        <span>{scene.duration_sec}s</span>
                      </div>
                    </div>

                    {/* Subtitle timeline visualization */}
                    <div className="relative h-4 mt-1 rounded bg-white/5 overflow-hidden">
                      {subs.map((sub, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full rounded bg-[#667eea]/40 border border-[#667eea]/60"
                          style={{
                            left: `${(sub.start / scene.duration_sec) * 100}%`,
                            width: `${((sub.end - sub.start) / scene.duration_sec) * 100}%`,
                          }}
                          title={sub.text}
                        >
                          <span className="text-[7px] text-white/60 px-0.5 truncate block">{sub.text}</span>
                        </div>
                      ))}
                      {/* Playhead */}
                      <div
                        className="absolute top-0 w-0.5 h-full bg-white/80"
                        style={{ left: `${((previewTime[scene.id] ?? 0) / scene.duration_sec) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Subtitle list */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{scene.title}</h3>
                      <div className="flex items-center gap-2">
                        {saving === scene.id && <Loader2 className="w-3 h-3 animate-spin text-[#667eea]" />}
                        <button onClick={() => saveSubs(scene.id)} disabled={saving !== null}
                          className="px-2.5 py-1 rounded-lg bg-[#667eea]/20 hover:bg-[#667eea]/30 disabled:opacity-20 text-[#667eea] text-xs font-medium transition">
                          저장
                        </button>
                      </div>
                    </div>

                    {subs.map((sub, i) => (
                      <div key={i} className="flex gap-2 items-start rounded-lg bg-white/[0.03] p-2.5">
                        <div className="flex-1 space-y-1.5">
                          <textarea
                            value={sub.text}
                            onChange={(e) => updateSub(scene.id, i, "text", e.target.value)}
                            placeholder="자막 텍스트... (Enter로 줄바꿈)"
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#667eea] resize-none"
                          />
                          <div className="flex gap-2 items-center">
                            <label className="text-[10px] text-white/30">시작</label>
                            <input type="number" value={sub.start} min={0} max={scene.duration_sec} step={0.5}
                              onChange={(e) => updateSub(scene.id, i, "start", parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                            <label className="text-[10px] text-white/30">끝</label>
                            <input type="number" value={sub.end} min={0} max={scene.duration_sec} step={0.5}
                              onChange={(e) => updateSub(scene.id, i, "end", parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                            <select value={sub.style} onChange={(e) => updateSub(scene.id, i, "style", e.target.value)}
                              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60 focus:outline-none">
                              {Object.entries(STYLES).map(([id, s]) => <option key={id} value={id} className="bg-[#141414]">{s.label}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-3 items-center">
                            <div className="flex gap-2 items-center flex-1">
                              <label className="text-[10px] text-white/30">크기</label>
                              <input
                                type="range" min={16} max={80} step={2}
                                value={sub.size || 42}
                                onChange={(e) => updateSub(scene.id, i, "size", parseInt(e.target.value))}
                                className="flex-1 h-1 accent-[#667eea] cursor-pointer"
                              />
                              <span className="text-[10px] text-white/40 w-8">{sub.size || 42}px</span>
                            </div>
                            <div className="flex gap-1">
                              {(["top", "center", "bottom"] as const).map((pos) => (
                                <button
                                  key={pos}
                                  onClick={() => updateSub(scene.id, i, "position", pos)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] transition ${
                                    (sub.position || "center") === pos
                                      ? "bg-[#667eea] text-white"
                                      : "bg-white/5 text-white/30 hover:text-white/50"
                                  }`}
                                >
                                  {pos === "top" ? "상단" : pos === "bottom" ? "하단" : "중앙"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-3 items-center">
                            <label className="text-[10px] text-white/30">페이드인</label>
                            <input type="number" value={sub.fadeIn ?? 0.3} min={0} max={3} step={0.1}
                              onChange={(e) => updateSub(scene.id, i, "fadeIn", parseFloat(e.target.value) || 0)}
                              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                            <label className="text-[10px] text-white/30">페이드아웃</label>
                            <input type="number" value={sub.fadeOut ?? 0.3} min={0} max={3} step={0.1}
                              onChange={(e) => updateSub(scene.id, i, "fadeOut", parseFloat(e.target.value) || 0)}
                              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                            <span className="text-[9px] text-white/20">초</span>
                          </div>
                        </div>
                        <button onClick={() => removeSub(scene.id, i)} className="p-1 text-white/20 hover:text-red-400 transition mt-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => addSub(scene.id, scene.duration_sec)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/10 hover:border-white/30 text-white/30 hover:text-white/50 text-xs transition"
                    >
                      <Plus className="w-3 h-3" />
                      자막 추가
                    </button>

                    {/* Speed / output duration */}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] text-white/30 shrink-0">재생 속도</label>
                        <select
                          value={sceneSpeed[scene.id] ?? 1}
                          onChange={(e) => setSceneSpeed((p) => ({ ...p, [scene.id]: parseFloat(e.target.value) }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60 focus:outline-none"
                        >
                          {SPEED_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-[#141414]">{o.label}</option>)}
                        </select>
                        <span className="text-[10px] text-white/20">
                          {(scene.duration_sec / (sceneSpeed[scene.id] ?? 1)).toFixed(1)}s
                        </span>
                      </div>
                      {(sceneSpeed[scene.id] ?? 1) !== 1 && (
                        <p className="text-[9px] text-white/20 mt-1">
                          원본 {scene.duration_sec}초 → 출력 {(scene.duration_sec / (sceneSpeed[scene.id] ?? 1)).toFixed(1)}초
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right summary */}
      <div className="w-56 shrink-0 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-5 flex flex-col">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-6">후보정</h3>
        <div className="space-y-4 flex-1">
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-1">총 러닝타임</p>
            <p className="text-2xl font-light text-white">{scenes.reduce((s, sc) => s + sc.duration_sec, 0)}<span className="text-sm text-white/30 ml-1">초</span></p>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-2">자막 현황</p>
            {scenes.map((s) => {
              const cnt = getSubs(s.id).filter((x) => x.text).length;
              return (
                <div key={s.id} className="flex items-center gap-2 mb-1">
                  {cnt > 0 ? <Check className="w-3 h-3 text-emerald-400" /> : <div className="w-3 h-3 rounded-full border border-white/20" />}
                  <span className="text-[10px] text-white/50">씬 {s.order_index + 1}: {cnt}개</span>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={handleComplete} disabled={completing}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium transition">
          {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          완료 & 내보내기
        </button>

        {outputDir && (
          <div className="mt-4 rounded-lg bg-green-600/10 border border-green-600/20 p-3">
            <p className="text-xs text-green-400 font-medium mb-1">내보내기 완료!</p>
            <button onClick={() => api.openFolder(projectId, outputDir)} className="text-xs text-green-400 hover:text-green-300 underline">폴더 열기</button>
          </div>
        )}
      </div>
    </div>
  );
}
