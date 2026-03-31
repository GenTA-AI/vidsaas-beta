"use client";

import { useState, useEffect, useCallback } from "react";
import { api, assetUrl } from "@/lib/api";
import type { Scene } from "@/lib/api";
import {
  ImageIcon,
  Video,
  RefreshCw,
  Save,
  Loader2,
  Check,
  Play,
  Sparkles,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface ImageGeneratorProps {
  projectId: string;
  scenes: Scene[];
  onRefresh: () => void;
}

type GenerationMode = "image" | "video";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-white/10 text-white/40" },
  generating_image: { label: "이미지 생성중", color: "bg-yellow-500/20 text-yellow-300" },
  image_ready: { label: "이미지 완료", color: "bg-blue-500/20 text-blue-300" },
  image_approved: { label: "이미지 승인", color: "bg-blue-500/20 text-blue-300" },
  image_failed: { label: "이미지 실패", color: "bg-red-500/20 text-red-300" },
  generating_video: { label: "영상 생성중", color: "bg-yellow-500/20 text-yellow-300" },
  video_ready: { label: "영상 완료", color: "bg-purple-500/20 text-purple-300" },
  video_approved: { label: "영상 승인", color: "bg-purple-500/20 text-purple-300" },
  video_failed: { label: "영상 실패", color: "bg-red-500/20 text-red-300" },
  saved: { label: "저장됨", color: "bg-green-500/20 text-green-300" },
  completed: { label: "완료", color: "bg-green-500/20 text-green-300" },
};

export default function ImageGenerator({
  projectId,
  scenes,
  onRefresh,
}: ImageGeneratorProps) {
  const [selectedId, setSelectedId] = useState<string>(scenes[0]?.id ?? "");
  const [mode, setMode] = useState<GenerationMode>("image");
  const [loading, setLoading] = useState<string | null>(null);
  const [userRequest, setUserRequest] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [refLibrary, setRefLibrary] = useState<Array<{ url: string; label: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [focusPreview, setFocusPreview] = useState(false);

  const selected = scenes.find((s) => s.id === selectedId);

  // Load reference library
  useEffect(() => {
    api.listReferences(projectId).then((refs) => {
      setRefLibrary(
        refs.filter((r) => r.image_url).map((r) => ({ url: r.image_url!, label: r.label }))
      );
    }).catch(console.error);
  }, [projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadImage(projectId, file);
      setSelectedRefs((prev) => [...prev, url]);
      setRefLibrary((prev) => [...prev, { url, label: file.name }]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const toggleRef = (url: string) => {
    setSelectedRefs((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  // Auto-poll when any scene is generating
  const isGenerating = scenes.some(
    (s) => s.status === "generating_image" || s.status === "generating_video"
  );

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(onRefresh, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating, onRefresh]);

  const handleSelectScene = (scene: Scene) => {
    setSelectedId(scene.id);
    setUserRequest("");
  };

  const statusBadge = (status: string) => {
    const s = STATUS_MAP[status] ?? { label: status, color: "bg-white/10 text-white/40" };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const isDone = (scene: Scene) =>
    ["saved", "completed", "video_ready", "video_approved"].includes(scene.status);

  const withLoading = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(key);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "작업 실패");
    } finally {
      setLoading(null);
    }
  };

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-white/30">
        씬이 없습니다. 먼저 기획을 완료해주세요.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[70vh]">
      {/* Left: Scene list */}
      <div className="w-60 shrink-0 bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-y-auto">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white/70">씬 목록</h3>
        </div>
        <div className="p-2 space-y-1">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => handleSelectScene(scene)}
              draggable
              onDragStart={() => setDraggedId(scene.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async () => {
                if (!draggedId || draggedId === scene.id) return;
                const ids = scenes.map((s) => s.id);
                const fromIdx = ids.indexOf(draggedId);
                const toIdx = ids.indexOf(scene.id);
                ids.splice(fromIdx, 1);
                ids.splice(toIdx, 0, draggedId);
                setDraggedId(null);
                await api.reorderScenes(projectId, ids);
                onRefresh();
              }}
              onDragEnd={() => setDraggedId(null)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-start gap-3 cursor-grab active:cursor-grabbing ${
                draggedId === scene.id ? "opacity-40" :
                selectedId === scene.id
                  ? "bg-[#5B7FFF]/20 border border-[#5B7FFF]/30"
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDone(scene)
                    ? "bg-green-600 text-white"
                    : selectedId === scene.id
                      ? "gradient-primary text-white"
                      : "bg-white/10 text-white/50"
                }`}
              >
                {isDone(scene) ? <Check className="w-3.5 h-3.5" /> : scene.order_index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-white/80">{scene.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(scene.status)}
                  <span className="text-[10px] text-white/20">{scene.duration_sec}s</span>
                </div>
                {/* Mini preview */}
                {scene.key_image_url && (
                  <img
                    src={assetUrl(scene.key_image_url)}
                    alt=""
                    className="w-full h-12 object-cover rounded mt-2 border border-white/10"
                  />
                )}
              </div>
            </button>
          ))}
          {/* Add scene buttons */}
          <div className="px-2 py-2 space-y-1">
            <button
              onClick={async () => {
                const title = prompt("새 씬 제목을 입력하세요:", "새 씬");
                if (!title) return;
                const afterIdx = selected ? scenes.findIndex((s) => s.id === selectedId) : scenes.length - 1;
                await api.addScene(projectId, title, afterIdx);
                onRefresh();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/10 hover:border-white/30 text-white/30 hover:text-white/50 text-xs transition"
            >
              <Plus className="w-3 h-3" />
              씬 추가
            </button>
            {selected && (
              <button
                onClick={async () => {
                  if (!confirm(`"${selected.title}" 씬을 삭제하시겠습니까?`)) return;
                  await api.deleteScene(projectId, selectedId);
                  setSelectedId(scenes[0]?.id ?? "");
                  onRefresh();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/5 text-[10px] transition"
              >
                <Trash2 className="w-3 h-3" />
                선택 씬 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center: Controls */}
      <div className="flex-1 bg-white/5 backdrop-blur border border-white/10 rounded-xl flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="px-5 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">
                씬 {selected.order_index + 1}: {selected.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-white/30">{selected.duration_sec}초</span>
                {statusBadge(selected.status)}
                {selected.status.includes("generating") && (
                  <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                )}
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setMode("image")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition ${
                  mode === "image"
                    ? "text-[#5B7FFF] border-b-2 border-[#5B7FFF]"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                이미지
              </button>
              <button
                onClick={() => setMode("video")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition ${
                  mode === "video"
                    ? "text-purple-400 border-b-2 border-purple-400"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                <Video className="w-4 h-4" />
                영상
              </button>
            </div>

            {/* Model badge */}
            <div className="px-5 pt-3">
              <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 text-xs text-white/40">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {mode === "image" ? "나노바나나 2" : "Veo 3.0"}
              </div>
            </div>

            {/* Natural language input */}
            <div className="flex-1 px-5 py-3 flex flex-col gap-3">
              <div>
                <label className="text-xs text-white/30 mb-1.5 block">어떤 이미지/영상을 원하시나요?</label>
                <textarea
                  value={userRequest}
                  onChange={(e) => setUserRequest(e.target.value)}
                  rows={3}
                  placeholder="예: 좀 더 따뜻한 조명으로, 제품을 클로즈업해서 보여줘"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#5B7FFF] resize-none"
                />
                {userRequest.trim() && (
                  <button
                    onClick={() => withLoading("gen-prompt", async () => {
                      const result = await api.generatePrompt(projectId, selectedId, userRequest);
                      setUserRequest("");
                      onRefresh();
                    })}
                    disabled={loading !== null}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5B7FFF]/20 hover:bg-[#5B7FFF]/30 disabled:opacity-30 text-[#5B7FFF] text-xs font-medium transition"
                  >
                    {loading === "gen-prompt" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI가 프롬프트 작성
                  </button>
                )}
              </div>

              {/* Current prompt (collapsible) */}
              {selected.prompt && (
                <div>
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="text-[10px] text-white/20 hover:text-white/40 transition"
                  >
                    {showPrompt ? "프롬프트 숨기기 ▲" : "현재 프롬프트 보기 ▼"}
                  </button>
                  {showPrompt && (
                    <p className="mt-1 text-xs text-white/30 font-mono bg-white/[0.02] rounded-lg px-3 py-2 leading-relaxed">
                      {selected.prompt}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Reference images selector */}
            <div className="px-5 pb-2">
              <label className="text-xs text-white/30 mb-1.5 block">레퍼런스 이미지 (선택)</label>
              <div className="flex gap-2 flex-wrap items-center">
                {refLibrary.map((ref) => (
                  <button
                    key={ref.url}
                    onClick={() => toggleRef(ref.url)}
                    className={`relative w-14 h-14 rounded-lg border-2 overflow-hidden transition ${
                      selectedRefs.includes(ref.url)
                        ? "border-[#5B7FFF] ring-1 ring-[#5B7FFF]/50"
                        : "border-white/10 hover:border-white/30"
                    }`}
                    title={ref.label}
                  >
                    <img src={assetUrl(ref.url)} alt={ref.label} className="w-full h-full object-cover" />
                    {selectedRefs.includes(ref.url) && (
                      <div className="absolute inset-0 bg-[#5B7FFF]/30 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
                <label className={`w-14 h-14 rounded-lg border-2 border-dashed border-white/10 hover:border-white/30 flex items-center justify-center cursor-pointer transition ${uploading ? "opacity-50" : ""}`}>
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                  ) : (
                    <span className="text-white/20 text-lg">+</span>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              {selectedRefs.length > 0 && (
                <p className="text-[10px] text-[#5B7FFF]/60 mt-1">{selectedRefs.length}개 레퍼런스 선택됨</p>
              )}
            </div>

            {/* Key image reference (when in video mode) */}
            {mode === "video" && selected.key_image_url && (
              <div className="px-5 pb-1">
                <label className="text-xs text-white/30 mb-1.5 block">레퍼런스 키 이미지</label>
                <img
                  src={assetUrl(selected.key_image_url)}
                  alt="key image"
                  className="w-full max-h-24 object-cover rounded-lg border border-white/10"
                />
              </div>
            )}
            {mode === "video" && !selected.key_image_url && (
              <div className="px-5 pb-1">
                <p className="text-xs text-yellow-400/70 bg-yellow-400/5 border border-yellow-400/10 rounded-lg px-3 py-2">
                  키 이미지가 없습니다. 먼저 이미지를 생성하면 영상의 첫 프레임으로 사용됩니다.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2">
              {mode === "image" ? (
                <button
                  onClick={() => {
                    if (userRequest.trim()) {
                      // 원클릭: 자연어 → 프롬프트 수정 → 이미지 생성
                      withLoading("gen-image", async () => {
                        await api.generateImageWithRequest(projectId, selectedId, userRequest);
                        setUserRequest("");
                      });
                    } else {
                      // 기존 프롬프트로 생성
                      withLoading("gen-image", () => api.regenerateImage(projectId, selectedId, selectedRefs));
                    }
                  }}
                  disabled={loading !== null}
                  className="flex items-center gap-2 gradient-primary hover:opacity-90 disabled:opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {loading === "gen-image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {userRequest.trim() ? "프롬프트 수정 + 이미지 생성" : "이미지 생성"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!selected.key_image_url) {
                      if (!confirm("키 이미지 없이 영상을 생성합니다. 계속할까요?")) return;
                    }
                    withLoading("gen-video", () => api.regenerateVideo(projectId, selectedId));
                  }}
                  disabled={loading !== null}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {loading === "gen-video" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  영상 생성
                </button>
              )}
              <button
                onClick={() => withLoading("save", () => api.saveSceneClip(projectId, selectedId))}
                disabled={loading !== null || (!selected.key_image_url && !selected.video_url)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-20 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                {loading === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                저장
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
            씬을 선택해주세요
          </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className={`${focusPreview ? "fixed inset-4 z-50 bg-black/95 backdrop-blur-xl" : "flex-1 bg-white/5 backdrop-blur"} border border-white/10 rounded-xl flex flex-col overflow-hidden`}>
        {/* Focus toggle */}
        <div className="flex justify-end p-2">
          <button
            onClick={() => setFocusPreview(!focusPreview)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
          >
            {focusPreview ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-5 pt-0">
          {selected?.status.includes("generating") ? (
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#5B7FFF] mx-auto mb-3" />
              <p className="text-sm text-white/50">
                {selected.status === "generating_image" ? "이미지 생성 중..." : "영상 생성 중..."}
              </p>
              <p className="text-xs text-white/20 mt-1">잠시만 기다려주세요</p>
            </div>
          ) : selected?.status.includes("failed") ? (
            <div className="text-left max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <span className="text-red-400 text-lg">!</span>
                </div>
                <p className="text-sm text-red-400 font-semibold">
                  {selected.status === "image_failed" ? "이미지 생성 실패" : "영상 생성 실패"}
                </p>
              </div>

              {/* 원인 */}
              {selected.error_message && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-3">
                  <p className="text-[10px] text-red-300/50 mb-1 font-medium">원인</p>
                  <p className="text-xs text-red-300/80 leading-relaxed">
                    {selected.error_message}
                  </p>
                </div>
              )}

              {/* 해결 안내 */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-white/40 font-medium">해결 방법</p>
                {selected.error_message?.includes("children") || selected.error_message?.includes("child") ? (
                  <div className="space-y-1.5 text-xs text-white/60">
                    <p>1. <strong>시나리오 단계</strong>로 돌아가서 해당 씬의 프롬프트에서 어린이/아이 관련 표현을 제거하세요</p>
                    <p>2. <strong>프로덕션</strong>에서 이미지를 먼저 재생성하세요 (어린이가 없는 이미지로)</p>
                    <p>3. 새 이미지로 영상을 다시 생성하세요</p>
                  </div>
                ) : selected.error_message?.includes("safety") || selected.error_message?.includes("안전") || selected.error_message?.includes("rai") ? (
                  <div className="space-y-1.5 text-xs text-white/60">
                    <p>1. 해당 씬의 <strong>이미지 프롬프트</strong>에 부적절한 표현이 없는지 확인하세요</p>
                    <p>2. <strong>프로덕션</strong>에서 이미지를 다른 내용으로 재생성하세요</p>
                    <p>3. 새 이미지로 영상을 다시 생성하세요</p>
                  </div>
                ) : selected.error_message?.includes("timeout") || selected.error_message?.includes("Timeout") ? (
                  <div className="space-y-1.5 text-xs text-white/60">
                    <p>1. 서버가 바쁜 상태일 수 있습니다. <strong>잠시 후 다시 시도</strong>해주세요</p>
                    <p>2. 한 번에 하나의 씬만 생성하세요 (동시 생성 시 실패 가능)</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs text-white/60">
                    <p>1. 왼쪽에서 <strong>이미지 생성</strong>을 다시 시도해보세요</p>
                    <p>2. 계속 실패하면 <strong>시나리오 단계</strong>에서 프롬프트를 수정하세요</p>
                    <p>3. 그래도 안 되면 <strong>아이디어 채팅</strong>에서 하네스를 점검하세요</p>
                  </div>
                )}
              </div>
            </div>
          ) : selected?.video_url ? (
            <div className="w-full space-y-3">
              <video
                src={assetUrl(selected.video_url)}
                controls
                autoPlay
                loop
                className="w-full rounded-lg bg-black"
              />
              <p className="text-xs text-white/30 text-center">영상 미리보기</p>
              {selected.key_image_url && (
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs text-white/20 mb-1.5">원본 키 이미지</p>
                  <img
                    src={assetUrl(selected.key_image_url)}
                    alt="key image"
                    className="w-full rounded-lg object-contain max-h-32 opacity-70"
                  />
                </div>
              )}
            </div>
          ) : selected?.key_image_url ? (
            <div className="w-full">
              <img
                src={assetUrl(selected.key_image_url)}
                alt={selected.title}
                className="w-full rounded-lg object-contain max-h-[50vh]"
              />
              <p className="text-xs text-white/30 text-center mt-2">키 이미지</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="w-full aspect-video rounded-lg bg-black flex items-center justify-center">
                <p className="text-white/20 text-sm">{selected ? `씬 ${selected.order_index + 1}: ${selected.title}` : "검정 화면"}</p>
              </div>
              <p className="text-xs text-white/20 text-center mt-2">이미지/영상을 생성하면 여기에 표시됩니다</p>
            </div>
          )}
        </div>

        {/* Batch actions */}
        <div className="px-5 py-3 border-t border-white/10 space-y-2">
          <button
            onClick={() => withLoading("batch-img", () => api.approveScenes(projectId))}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 bg-[#5B7FFF]/10 hover:bg-[#5B7FFF]/20 border border-[#5B7FFF]/20 disabled:opacity-30 text-[#5B7FFF] px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading === "batch-img" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            전체 이미지 생성
          </button>
          <button
            onClick={() => withLoading("batch-vid", () => api.approveAllImages(projectId))}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 disabled:opacity-30 text-purple-400 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading === "batch-vid" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            전체 영상 생성
          </button>
          <button
            onClick={() => withLoading("done", () => api.completeProject(projectId))}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading === "done" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            프로젝트 완료
          </button>
        </div>
      </div>
    </div>
  );
}
