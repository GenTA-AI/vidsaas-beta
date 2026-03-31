"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Settings, Loader2, Send, ChevronDown, ChevronUp } from "lucide-react";

interface HarnessData {
  visual_style?: string;
  color_palette?: string;
  camera_style?: string;
  tone?: string;
  target_audience?: string;
  brand_keywords?: string[];
  prompt_prefix?: string;
  banned_words?: string[];
}

interface HarnessPanelProps {
  projectId: string;
  harnessJson: string | null;
  onUpdated: () => void;
}

export default function HarnessPanel({ projectId, harnessJson, onUpdated }: HarnessPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  let harness: HarnessData = {};
  try { harness = harnessJson ? JSON.parse(harnessJson) : {}; } catch { /* */ }

  const isEmpty = !harness.visual_style && !harness.prompt_prefix;

  const handleChatUpdate = async () => {
    if (!chatInput.trim()) return;
    setChatting(true);
    setChatResponse(null);
    try {
      const result = await api.updateHarnessWithChat(projectId, chatInput);
      setChatResponse(result.message);
      setChatInput("");
      onUpdated();
    } catch (e) {
      console.error(e);
      setChatResponse("수정 실패. 다시 시도해주세요.");
    } finally { setChatting(false); }
  };

  const entries = [
    { key: "visual_style", label: "비주얼 스타일", value: harness.visual_style },
    { key: "color_palette", label: "색감", value: harness.color_palette },
    { key: "camera_style", label: "카메라", value: harness.camera_style },
    { key: "tone", label: "톤앤매너", value: harness.tone },
    { key: "target_audience", label: "타겟", value: harness.target_audience },
    { key: "prompt_prefix", label: "프롬프트 프리픽스", value: harness.prompt_prefix },
  ];

  return (
    <div className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#5B7FFF]" />
          <h3 className="text-sm font-semibold text-white">하네스 지침</h3>
          {isEmpty && <span className="text-[10px] text-yellow-400/60 bg-yellow-400/10 px-1.5 py-0.5 rounded">미설정</span>}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-fadeIn">
          {/* Harness entries */}
          {entries.map((e) => (
            <div key={e.key} className="flex gap-2">
              <span className="text-[10px] text-white/30 w-16 shrink-0 pt-0.5">{e.label}</span>
              <span className={`text-[11px] leading-relaxed ${e.value ? "text-white/60" : "text-white/15 italic"}`}>
                {e.value || "—"}
              </span>
            </div>
          ))}
          {harness.brand_keywords && harness.brand_keywords.length > 0 && (
            <div className="flex gap-2">
              <span className="text-[10px] text-white/30 w-16 shrink-0">키워드</span>
              <div className="flex gap-1 flex-wrap">
                {harness.brand_keywords.map((kw, i) => (
                  <span key={i} className="text-[10px] bg-[#5B7FFF]/10 text-[#5B7FFF] px-1.5 py-0.5 rounded">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Chat to modify */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex gap-1.5">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatUpdate()}
                placeholder="하네스 수정 요청..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#5B7FFF]"
                disabled={chatting}
              />
              <button
                onClick={handleChatUpdate}
                disabled={chatting || !chatInput.trim()}
                className="p-1.5 rounded-lg bg-[#5B7FFF]/20 hover:bg-[#5B7FFF]/30 disabled:opacity-20 text-[#5B7FFF] transition"
              >
                {chatting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
            {chatResponse && (
              <p className="mt-2 text-[10px] text-white/40 bg-white/[0.02] rounded-lg px-2.5 py-2 leading-relaxed">
                {chatResponse}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
