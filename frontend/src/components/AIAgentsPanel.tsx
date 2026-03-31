"use client";

import { DISCOVERY_QUESTIONS } from "@/lib/agents";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  active: boolean;
}

interface AIAgentsPanelProps {
  agents: Agent[];
  onAgentClick?: (agentId: string) => void;
}

export default function AIAgentsPanel({
  agents,
  onAgentClick,
}: AIAgentsPanelProps) {
  return (
    <div className="rounded-xl bg-[rgba(18,18,18,0.5)] backdrop-blur border border-white/10 p-4 flex flex-col gap-4">
      {/* Title */}
      <h3 className="text-white font-semibold text-sm">AI 에이전트</h3>

      {/* Agent list */}
      <div className="flex flex-col gap-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onAgentClick?.(agent.id)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors"
          >
            {/* Emoji icon */}
            <span className="text-lg flex-shrink-0">{agent.emoji}</span>

            {/* Name and role */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {agent.name}
              </p>
              <p className="text-white/50 text-xs truncate">{agent.role}</p>
            </div>

            {/* Status dot */}
            <span className="flex-shrink-0 relative flex h-2.5 w-2.5">
              {agent.active ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-500" />
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Discovery questions */}
      <div className="border-t border-white/10 pt-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
          Discovery
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DISCOVERY_QUESTIONS.map((cat) => (
            <div
              key={cat.category}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70"
            >
              <span className="mr-1">{cat.emoji}</span>
              {cat.category}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
