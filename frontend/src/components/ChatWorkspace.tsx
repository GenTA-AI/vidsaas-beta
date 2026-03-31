"use client";

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { api, type ChatMessage } from "@/lib/api";
import { Send, Loader2, Sparkles, Check, X, ArrowRight } from "lucide-react";

interface ChatWorkspaceProps {
  projectId: string;
  onFinalized: () => void;
  onRefresh?: () => void;
}

interface Proposal {
  summary: string;
  changes: Array<{
    target: string;
    scene_index?: number;
    field: string;
    before: string;
    after: string;
  }>;
}

export default function ChatWorkspace({ projectId, onFinalized, onRefresh }: ChatWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null);
  const [applying, setApplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    api.getChatHistory(projectId).then(setMessages).catch(console.error).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    try {
      const result = await api.sendChatMessage(projectId, trimmed);
      setMessages((prev) => [...prev, result.user_message, result.assistant_message]);
      if (result.has_proposal && result.proposal) {
        setPendingProposal(result.proposal as unknown as Proposal);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleApply = async () => {
    if (!pendingProposal) return;
    setApplying(true);
    try {
      const result = await api.applyChanges(projectId, pendingProposal.changes);
      setPendingProposal(null);
      // Add system message
      setMessages((prev) => [
        ...prev,
        {
          id: `applied-${Date.now()}`,
          role: "assistant",
          content: `${result.message}`,
          created_at: new Date().toISOString(),
        },
      ]);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert("변경 적용 실패");
    } finally {
      setApplying(false);
    }
  };

  const handleReject = () => {
    setPendingProposal(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `rejected-${Date.now()}`,
        role: "assistant",
        content: "변경사항이 취소되었습니다. 다른 수정이 필요하시면 말씀해주세요.",
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleFinalize = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      await api.finalizePlanning(projectId);
      onFinalized();
    } catch (err) {
      console.error(err);
    } finally {
      setFinalizing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
      style={{ height: "calc(100vh - 200px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#5B7FFF]" />
          <h2 className="text-lg font-semibold text-white">AI 기획 채팅</h2>
          <span className="text-xs text-white/30">상담 & 수정 요청</span>
        </div>
        <button
          onClick={handleFinalize}
          disabled={finalizing || messages.length === 0}
          className="flex items-center gap-2 rounded-lg bg-[#5B7FFF] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {finalizing && <Loader2 className="h-4 w-4 animate-spin" />}
          기획 확정
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/40">
            <Sparkles className="h-12 w-12" />
            <p className="text-lg">Claude에게 영상에 대해 이야기해보세요</p>
            <p className="text-sm text-white/20">기획 상담, 수정 요청 모두 가능합니다</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${!isUser ? "space-y-1" : ""}`}>
                  {!isUser && <span className="text-xs font-medium text-[#5B7FFF]">Claude</span>}
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "rounded-br-md bg-[#5B7FFF] text-white"
                        : "rounded-bl-md bg-white/10 text-white/90"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pending Proposal Card */}
        {pendingProposal && (
          <div className="mx-auto max-w-[85%] rounded-xl border border-[#5B7FFF]/30 bg-[#5B7FFF]/5 p-5 animate-fadeInUp">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="w-4 h-4 text-[#5B7FFF]" />
              <h4 className="text-sm font-semibold text-white">변경사항 제안</h4>
            </div>
            <p className="text-sm text-white/70 mb-3">{pendingProposal.summary}</p>

            <div className="space-y-2 mb-4">
              {pendingProposal.changes.map((change, i) => (
                <div key={i} className="rounded-lg bg-white/5 p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-white/40">
                      {change.target === "scene" ? `씬 ${(change.scene_index ?? 0) + 1}` : "프로젝트"}
                    </span>
                    <span className="text-[#5B7FFF] font-medium">{change.field}</span>
                  </div>
                  {change.before && (
                    <div className="text-red-400/70 line-through mb-1 truncate">
                      {change.before}
                    </div>
                  )}
                  <div className="text-emerald-400/90">
                    {change.after}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                적용
              </button>
              <button
                onClick={handleReject}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 text-sm font-medium transition"
              >
                <X className="w-3.5 h-3.5" />
                취소
              </button>
            </div>
          </div>
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#5B7FFF]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="기획 상담, 수정 요청 등 자유롭게 입력하세요..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#5B7FFF]/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5B7FFF] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
