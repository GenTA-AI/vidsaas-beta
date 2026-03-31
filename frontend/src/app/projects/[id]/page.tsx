"use client";

import { useEffect, useState, useCallback, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, type Project } from "@/lib/api";
import { AI_AGENTS } from "@/lib/agents";
import type { ViewMode, StageType, SynopsisData } from "@/lib/types";

import Sidebar from "@/components/Sidebar";
import ChatWorkspace from "@/components/ChatWorkspace";
import AIAgentsPanel from "@/components/AIAgentsPanel";
import SynopsisEditor from "@/components/SynopsisEditor";
import ScriptEditor from "@/components/ScriptEditor";
import SceneNodeVisualizer from "@/components/SceneNodeVisualizer";
import ImageGenerator from "@/components/ImageGenerator";
import ReferenceLibrary from "@/components/ReferenceLibrary";
import HarnessPanel from "@/components/HarnessPanel";
import CommandPalette from "@/components/CommandPalette";
import VersionPanel from "@/components/VersionPanel";
import PostProductionEditor from "@/components/PostProductionEditor";
import { Loader2, History } from "lucide-react";

const STATUS_TO_STAGE: Record<string, StageType> = {
  draft: "idea",
  planning: "idea",
  scenes_review: "synopsis",
  image_generating: "production",
  images_review: "production",
  video_generating: "production",
  videos_review: "postproduction",
  completed: "postproduction",
};

const STAGE_TO_VIEW: Record<StageType, ViewMode> = {
  idea: "chat",
  synopsis: "synopsis",
  script: "script",
  production: "production",
  postproduction: "postproduction",
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState<StageType>("idea");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [synopsisData, setSynopsisData] = useState<SynopsisData>({
    title: "",
    subtitle: "",
    format: "15초 릴스",
    genre: [],
    keyConcept: "",
    visualReference: "",
    thematicReference: "",
    logline: "",
    characters: "",
    synopsis: "",
  });

  const refresh = useCallback(async (autoNavigate = false) => {
    try {
      const proj = await api.getProject(id);
      setProject(proj);

      // Only auto-navigate on first load
      if (autoNavigate) {
        const stage = STATUS_TO_STAGE[proj.status] || "idea";
        setCurrentStage(stage);
        setViewMode(STAGE_TO_VIEW[stage]);
      }

      // Populate synopsis from project data
      if (proj.script && !synopsisData.synopsis) {
        let meta: Record<string, unknown> = {};
        try {
          if (proj.synopsis_data) meta = JSON.parse(proj.synopsis_data);
        } catch { /* ignore */ }
        setSynopsisData((prev) => ({
          ...prev,
          title: (meta.title as string) || proj.title,
          format: (meta.format as string) || prev.format,
          genre: (meta.genre as string[]) || prev.genre,
          keyConcept: (meta.key_concept as string) || prev.keyConcept,
          logline: (meta.logline as string) || prev.logline,
          visualReference: (meta.visual_reference as string) || prev.visualReference,
          characters: (meta.characters as string) || prev.characters,
          synopsis: proj.script || "",
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh(true); // first load: auto-navigate to correct stage
  }, []);

  // Auto-poll when generating
  useEffect(() => {
    if (!project) return;
    const runningStates = ["image_generating", "video_generating"];
    if (runningStates.includes(project.status)) {
      const interval = setInterval(refresh, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.status, refresh]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const stages: StageType[] = ["idea", "synopsis", "script", "production", "postproduction"];
        const stage = stages[parseInt(e.key) - 1];
        handleStageClick(stage);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleStageClick = (stage: StageType) => {
    setCurrentStage(stage);
    setViewMode(STAGE_TO_VIEW[stage]);
  };

  const handleFinalized = () => {
    refresh().then(() => {
      setCurrentStage("synopsis");
      setViewMode("synopsis");
    });
  };

  const commands = useMemo(
    () => [
      { id: "idea", label: "아이디어 단계로 이동", shortcut: "⌘1", action: () => handleStageClick("idea") },
      { id: "synopsis", label: "시놉시스 단계로 이동", shortcut: "⌘2", action: () => handleStageClick("synopsis") },
      { id: "script", label: "시나리오 단계로 이동", shortcut: "⌘3", action: () => handleStageClick("script") },
      { id: "production", label: "프로덕션 단계로 이동", shortcut: "⌘4", action: () => handleStageClick("production") },
      { id: "postproduction", label: "후보정 단계로 이동", shortcut: "⌘5", action: () => handleStageClick("postproduction") },
      { id: "refresh", label: "새로고침", action: () => refresh() },
      { id: "home", label: "프로젝트 목록으로", action: () => router.push("/") },
    ],
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-[#667eea]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50 bg-[#0a0a0a]">
        프로젝트를 찾을 수 없습니다
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <Sidebar
        projectTitle={project.title}
        projectStatus={project.status}
        currentStage={currentStage}
        onStageClick={handleStageClick}
        onBack={() => router.push("/")}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-white/10 bg-[rgba(18,18,18,0.8)] backdrop-blur-xl flex items-center px-6 justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">
              {currentStage === "idea" && "💡 아이디어 탐색"}
              {currentStage === "synopsis" && "📋 시놉시스"}
              {currentStage === "script" && "✍️ 시나리오"}
              {currentStage === "production" && "🎬 프로덕션"}
              {currentStage === "postproduction" && "🎛️ 후보정"}
            </h2>
            <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">
              {project.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${showVersions ? "bg-[#667eea]/20 text-[#667eea]" : "text-white/40 bg-white/5 hover:bg-white/10"}`}
            >
              <History className="w-3.5 h-3.5" />
              버전
            </button>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="text-xs text-white/40 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition flex items-center gap-2"
            >
              <span>⌘K</span>
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width:
                currentStage === "idea"
                  ? "20%"
                  : currentStage === "synopsis"
                    ? "40%"
                    : currentStage === "script"
                      ? "60%"
                      : currentStage === "production"
                        ? "80%"
                        : "100%",
            }}
          />
        </div>

        {/* Version Panel (toggled) */}
        {showVersions && (
          <div className="px-6 pt-4">
            <VersionPanel projectId={id} onRestored={() => { refresh(true); setShowVersions(false); }} />
          </div>
        )}

        {/* Workspace */}
        <main className="flex-1 overflow-auto">
          {/* Idea Stage: Chat + Agents */}
          {viewMode === "chat" && (
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <ChatWorkspace projectId={id} onFinalized={handleFinalized} onRefresh={refresh} />
              </div>
              <div className="w-80 p-6 pl-0">
                <AIAgentsPanel agents={AI_AGENTS} />
              </div>
            </div>
          )}

          {/* Synopsis Stage */}
          {viewMode === "synopsis" && (
            <div className="p-6">
              <SynopsisEditor
                data={{
                  ...synopsisData,
                  title: synopsisData.title || project.title,
                  synopsis: synopsisData.synopsis || project.script || "",
                }}
                onChange={setSynopsisData}
                onNext={() => handleStageClick("script")}
              />
            </div>
          )}

          {/* Script Stage */}
          {viewMode === "script" && (
            <div className="p-6">
              <ScriptEditor
                projectId={id}
                script={project.script || ""}
                scenes={project.scenes}
                onScriptChange={(s) =>
                  setProject((prev) => (prev ? { ...prev, script: s } : prev))
                }
                onScenesUpdate={refresh}
                onNext={() => handleStageClick("production")}
              />
            </div>
          )}

          {/* Production Stage */}
          {viewMode === "production" && (
            <div className="flex gap-6 p-6">
              <div className="flex-1 space-y-6">
                {project.scenes.length > 0 && (
                  <SceneNodeVisualizer
                    scenes={project.scenes}
                    onSceneClick={() => {}}
                  />
                )}
                <ImageGenerator
                  projectId={id}
                  scenes={project.scenes}
                  onRefresh={refresh}
                />
              </div>
              <div className="w-72 shrink-0 space-y-0">
                <ReferenceLibrary projectId={id} />
                <HarnessPanel projectId={id} harnessJson={project.harness} onUpdated={refresh} />
              </div>
            </div>
          )}

          {/* Scene View (sub-view of production) */}
          {viewMode === "scene" && (
            <div className="p-6">
              <SceneNodeVisualizer
                scenes={project.scenes}
                onSceneClick={() => {}}
              />
            </div>
          )}

          {/* Post-production Stage */}
          {viewMode === "postproduction" && (
            <div className="p-6 h-full">
              <PostProductionEditor
                projectId={id}
                scenes={project.scenes}
                onRefresh={refresh}
              />
            </div>
          )}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commands}
      />
    </div>
  );
}
