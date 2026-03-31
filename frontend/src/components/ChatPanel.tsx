"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ChatMessage } from "@/lib/api";
import { Send, Loader2, Sparkles } from "lucide-react";

interface ChatPanelProps {
  projectId: string;
  onFinalized: () => void;
}

export default function ChatPanel({ projectId, onFinalized }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatHistory(projectId).then((msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    try {
      const { user_message, assistant_message } = await api.sendChatMessage(
        projectId,
        text
      );
      setMessages((prev) => [...prev, user_message, assistant_message]);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "메시지 전송 실패");
    } finally {
      setSending(false);
    }
  };

  const handleFinalize = async () => {
    if (messages.length < 2) {
      alert("먼저 Claude와 대화하여 기획을 구체화해주세요.");
      return;
    }
    setFinalizing(true);
    try {
      await api.finalizePlanning(projectId);
      onFinalized();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "기획 확정 실패");
      setFinalizing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl flex flex-col" style={{ height: "70vh" }}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold">Claude와 영상 기획</h2>
          <span className="text-xs text-slate-400">대화하며 시놉시스 → 시나리오 → 씬 구성을 완성하세요</span>
        </div>
        <button
          onClick={handleFinalize}
          disabled={finalizing || messages.length < 2}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {finalizing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          기획 확정
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Claude에게 영상에 대해 이야기해보세요.</p>
            <p className="text-sm mt-1">시놉시스, 타겟, 톤앤매너 등을 논의하며 기획을 구체화합니다.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-slate-700 text-slate-200 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="text-xs text-purple-400 mb-1 font-medium">Claude</div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-slate-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="영상 기획에 대해 이야기해보세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
            disabled={sending || finalizing}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || finalizing}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 rounded-lg transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
