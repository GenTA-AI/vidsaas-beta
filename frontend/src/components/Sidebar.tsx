"use client";

import { ArrowLeft } from "lucide-react";

type Stage = "idea" | "synopsis" | "script" | "production" | "postproduction";

interface SidebarProps {
  projectTitle: string;
  projectStatus: string;
  currentStage: Stage;
  onStageClick: (stage: Stage) => void;
  onBack: () => void;
}

const STAGES: { key: Stage; label: string }[] = [
  { key: "idea", label: "💡 아이디어" },
  { key: "synopsis", label: "📋 시놉시스" },
  { key: "script", label: "✍️ 시나리오" },
  { key: "production", label: "🎬 프로덕션" },
  { key: "postproduction", label: "🎛️ 후보정" },
];

export default function Sidebar({
  projectTitle,
  projectStatus,
  currentStage,
  onStageClick,
  onBack,
}: SidebarProps) {
  return (
    <aside className="w-64 h-full flex flex-col bg-[rgba(18,18,18,0.8)] backdrop-blur-xl border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white font-bold text-sm">
          G
        </div>
        <span className="text-white font-semibold text-lg tracking-tight">
          GenTA Studio
        </span>
      </div>

      {/* Project info */}
      <div className="px-5 pb-4 border-b border-white/10">
        <h2 className="text-white text-sm font-medium truncate">
          {projectTitle}
        </h2>
        <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
          {projectStatus}
        </span>
      </div>

      {/* Pipeline */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[11px] uppercase tracking-wider text-white/40 px-2 mb-2">
          Pipeline
        </p>
        <nav className="flex flex-col gap-1">
          {STAGES.map((stage) => {
            const isActive = currentStage === stage.key;
            return (
              <button
                key={stage.key}
                onClick={() => onStageClick(stage.key)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                  ${
                    isActive
                      ? "bg-[#667eea]/20 text-white border-l-2 border-[#667eea]"
                      : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                  }
                `}
              >
                {stage.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Back button */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          프로젝트 목록
        </button>
      </div>
    </aside>
  );
}
