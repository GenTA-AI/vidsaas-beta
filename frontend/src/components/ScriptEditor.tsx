"use client";

import { useState } from "react";
import { ArrowRight, Sparkles, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { api, type Scene } from "@/lib/api";

interface ScriptEditorProps {
  projectId: string;
  script: string;
  scenes: Scene[];
  onScriptChange: (script: string) => void;
  onScenesUpdate: () => void;
  onNext: () => void;
}

export default function ScriptEditor({
  projectId,
  script,
  scenes,
  onScriptChange,
  onScenesUpdate,
  onNext,
}: ScriptEditorProps) {
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    scenes.forEach((s) => {
      init[s.id] = s.description || "";
    });
    return init;
  });
  const [refining, setRefining] = useState<string | null>(null);
  const [refineProgress, setRefineProgress] = useState<{ current: number; total: number } | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration_sec, 0);

  const handleRefine = async (sceneId: string) => {
    const desc = descriptions[sceneId]?.trim();
    if (!desc) {
      alert("씬 설명을 먼저 작성해주세요.");
      return;
    }

    setRefining(sceneId);
    try {
      await api.refineScene(projectId, sceneId, desc);
      onScenesUpdate();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "정리 실패");
    } finally {
      setRefining(null);
    }
  };

  const handleRefineAll = async () => {
    const toRefine = scenes.filter((s) => {
      const desc = descriptions[s.id]?.trim() || s.description?.trim();
      return desc && !s.script_formatted;
    });
    if (toRefine.length === 0) {
      alert("정리할 씬이 없습니다. 설명이 작성된 씬 중 아직 정리되지 않은 씬이 있어야 합니다.");
      return;
    }

    setRefining("all");
    setRefineProgress({ current: 0, total: toRefine.length });

    for (let i = 0; i < toRefine.length; i++) {
      const scene = toRefine[i];
      setRefineProgress({ current: i + 1, total: toRefine.length });
      const desc = descriptions[scene.id]?.trim() || scene.description?.trim();
      try {
        await api.refineScene(projectId, scene.id, desc!);
      } catch (e) {
        console.error(`씬 ${scene.order_index + 1} 정리 실패:`, e);
      }
    }

    setRefining(null);
    setRefineProgress(null);
    onScenesUpdate();
  };

  return (
    <div className="flex h-full gap-4">
      {/* Main - Scene cards */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-6 animate-fadeIn"
          >
            {/* Scene header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {scene.order_index + 1}
              </div>
              <h3 className="text-white font-semibold flex-1">{scene.title}</h3>
              <span className="text-xs text-white/30">{scene.duration_sec}초</span>
            </div>

            {/* Description input - 자연어 설명 */}
            <div className="mb-4">
              <label className="block text-xs text-white/40 mb-2">
                씬 설명 (자유롭게 적으세요)
              </label>
              <textarea
                value={descriptions[scene.id] || ""}
                onChange={(e) =>
                  setDescriptions((prev) => ({ ...prev, [scene.id]: e.target.value }))
                }
                rows={3}
                placeholder="예: 카페에서 주인공이 노트북을 열고 제품을 처음 사용하는 장면. 놀라는 표정. 따뜻한 조명."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#5B7FFF] placeholder:text-white/20 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => handleRefine(scene.id)}
                  disabled={refining !== null || !descriptions[scene.id]?.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary hover:opacity-90 disabled:opacity-30 text-white text-sm font-medium transition"
                >
                  {refining === scene.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {refining === scene.id ? "정리 중..." : "AI 정리"}
                </button>
              </div>
            </div>

            {/* Formatted script - AI가 정리한 대본 */}
            {scene.script_formatted && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <label className="text-xs text-emerald-400/80 font-medium">정리된 대본</label>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg px-5 py-4">
                  <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
                    {scene.script_formatted}
                  </pre>
                </div>
              </div>
            )}

            {/* Generated prompt - 자동 생성된 영어 프롬프트 */}
            {scene.prompt && scene.script_formatted && (
              <div>
                <button
                  onClick={() =>
                    setExpandedScript(expandedScript === scene.id ? null : scene.id)
                  }
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition"
                >
                  {expandedScript === scene.id ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  이미지 프롬프트 (자동 생성)
                </button>
                {expandedScript === scene.id && (
                  <p className="mt-2 text-xs text-white/30 font-mono bg-white/[0.02] rounded-lg px-4 py-3 leading-relaxed">
                    {scene.prompt}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Full script (collapsible) */}
        {script && (
          <details className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
            <summary className="px-6 py-3 text-sm text-white/40 cursor-pointer hover:text-white/60 transition">
              전체 스크립트 원문
            </summary>
            <pre className="px-6 pb-4 text-sm text-white/50 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
              {script}
            </pre>
          </details>
        )}
      </div>

      {/* Right info panel */}
      <div className="w-56 shrink-0 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-5 flex flex-col">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-6">
          진행 상황
        </h3>

        <div className="space-y-4 flex-1">
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-1">씬 수</p>
            <p className="text-2xl font-light text-white">
              {scenes.length}
              <span className="text-sm text-white/30 ml-1">씬</span>
            </p>
          </div>

          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-1">총 러닝타임</p>
            <p className="text-2xl font-light text-white">
              {totalDuration}
              <span className="text-sm text-white/30 ml-1">초</span>
            </p>
          </div>

          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-2">정리 완료</p>
            <div className="space-y-1.5">
              {scenes.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  {s.script_formatted ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-white/20" />
                  )}
                  <span className={`text-xs ${s.script_formatted ? "text-white/60" : "text-white/30"}`}>
                    씬 {s.order_index + 1}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(scenes.filter((s) => s.script_formatted).length / Math.max(scenes.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleRefineAll}
          disabled={refining !== null}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl gradient-primary hover:opacity-90 disabled:opacity-30 text-white text-sm font-medium transition"
        >
          {refining === "all" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {refineProgress ? `${refineProgress.current}/${refineProgress.total} 정리 중...` : "정리 중..."}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              전체 AI 정리
            </>
          )}
        </button>

        <button
          onClick={onNext}
          className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          다음: 프로덕션
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
