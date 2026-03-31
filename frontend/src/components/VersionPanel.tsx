"use client";

import { useEffect, useState } from "react";
import { api, type ProjectVersion } from "@/lib/api";
import { Save, RotateCcw, Trash2, Loader2, History, Plus } from "lucide-react";

interface VersionPanelProps {
  projectId: string;
  onRestored: () => void;
}

export default function VersionPanel({ projectId, onRestored }: VersionPanelProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [showSave, setShowSave] = useState(false);

  const loadVersions = async () => {
    try {
      const data = await api.listVersions(projectId);
      setVersions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [projectId]);

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await api.saveVersion(projectId, label);
      setLabel("");
      setShowSave(false);
      loadVersions();
    } catch (e) {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId: string, versionLabel: string) => {
    if (!confirm(`"${versionLabel}" 버전으로 복원하시겠습니까?\n현재 상태는 덮어씌워집니다.`)) return;
    setRestoring(versionId);
    try {
      await api.restoreVersion(projectId, versionId);
      onRestored();
    } catch (e) {
      alert("복원 실패");
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (versionId: string) => {
    if (!confirm("이 버전을 삭제하시겠습니까?")) return;
    await api.deleteVersion(projectId, versionId);
    loadVersions();
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "방금";
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    return `${Math.floor(hr / 24)}일 전`;
  };

  return (
    <div className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#5B7FFF]" />
          <h3 className="text-sm font-semibold text-white">버전 관리</h3>
        </div>
        <button
          onClick={() => setShowSave(!showSave)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#5B7FFF]/20 hover:bg-[#5B7FFF]/30 text-[#5B7FFF] text-xs font-medium transition"
        >
          <Plus className="w-3 h-3" />
          저장
        </button>
      </div>

      {/* Save form */}
      {showSave && (
        <div className="mb-3 flex gap-2 animate-fadeIn">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="버전 이름 (예: 시나리오 초안)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#5B7FFF]"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={saving || !label.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg gradient-primary hover:opacity-90 disabled:opacity-30 text-white text-xs font-medium transition"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Version list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-white/20" />
        </div>
      ) : versions.length === 0 ? (
        <p className="text-xs text-white/20 text-center py-4">저장된 버전이 없습니다</p>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 font-medium truncate">{v.label}</p>
                <p className="text-[10px] text-white/20">{timeAgo(v.created_at)}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => handleRestore(v.id, v.label)}
                  disabled={restoring !== null}
                  className="p-1.5 rounded bg-[#5B7FFF]/20 hover:bg-[#5B7FFF]/40 text-[#5B7FFF] transition"
                  title="이 버전으로 복원"
                >
                  {restoring === v.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
