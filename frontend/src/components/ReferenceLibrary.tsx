"use client";

import { useEffect, useState } from "react";
import { api, assetUrl, type ReferenceImage } from "@/lib/api";
import { Plus, Loader2, Trash2, ImageIcon, User, Mountain, Box, Palette } from "lucide-react";

interface ReferenceLibraryProps {
  projectId: string;
}

const CATEGORIES = [
  { id: "character", label: "캐릭터", icon: User },
  { id: "background", label: "배경", icon: Mountain },
  { id: "object", label: "오브젝트", icon: Box },
  { id: "style", label: "스타일", icon: Palette },
];

export default function ReferenceLibrary({ projectId }: ReferenceLibraryProps) {
  const [refs, setRefs] = useState<ReferenceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState("character");
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const loadRefs = async () => {
    try {
      const data = await api.listReferences(projectId);
      setRefs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefs();
    const interval = setInterval(loadRefs, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleCreate = async () => {
    if (!label.trim() || !prompt.trim()) return;
    setCreating(true);
    try {
      await api.createReference(projectId, { category, label, prompt });
      setLabel("");
      setPrompt("");
      setShowForm(false);
      loadRefs();
    } catch (e) {
      console.error(e);
      alert("생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (refId: string) => {
    await api.deleteReference(projectId, refId);
    loadRefs();
  };

  const filtered = filter ? refs.filter((r) => r.category === filter) : refs;

  return (
    <div className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#5B7FFF]" />
          <h3 className="text-sm font-semibold text-white">레퍼런스 라이브러리</h3>
          <span className="text-xs text-white/30">{refs.length}개</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5B7FFF]/20 hover:bg-[#5B7FFF]/30 text-[#5B7FFF] text-xs font-medium transition"
        >
          <Plus className="w-3 h-3" />
          생성
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-lg bg-white/5 border border-white/10 space-y-3 animate-fadeIn">
          {/* Category */}
          <div className="flex gap-1.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    category === cat.id
                      ? "bg-[#5B7FFF] text-white"
                      : "bg-white/5 text-white/50 hover:text-white"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>
          {/* Label */}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="이름 (예: 주인공, 도시 배경, 제품 클로즈업)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#5B7FFF]"
          />
          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="이미지 프롬프트 (영어): A young Korean woman, 25 years old, modern style..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#5B7FFF] resize-none font-mono"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !label.trim() || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg gradient-primary hover:opacity-90 disabled:opacity-30 text-white text-sm font-medium transition"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            레퍼런스 이미지 생성
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setFilter(null)}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${
            !filter ? "bg-white/15 text-white" : "text-white/30 hover:text-white/50"
          }`}
        >
          전체
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${
              filter === cat.id ? "bg-white/15 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Image grid */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-white/30" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-white/20 text-center py-6">
          레퍼런스 이미지가 없습니다
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((ref) => (
            <div key={ref.id} className="group relative">
              {ref.image_url ? (
                <img
                  src={assetUrl(ref.image_url)}
                  alt={ref.label}
                  className="w-full aspect-square object-cover rounded-lg border border-white/10"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-2">
                <button
                  onClick={() => handleDelete(ref.id)}
                  className="self-end p-1 rounded bg-red-500/50 hover:bg-red-500 transition"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
                <div>
                  <p className="text-[10px] text-white font-medium truncate">{ref.label}</p>
                  <p className="text-[9px] text-white/50">{ref.category}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
