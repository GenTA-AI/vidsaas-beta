"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Project } from "@/lib/api";
import { Plus, Film, Trash2, ArrowRight, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  planning: "기획 중",
  scenes_review: "씬 검토",
  image_generating: "이미지 생성 중",
  images_review: "이미지 검토",
  video_generating: "영상 생성 중",
  videos_review: "영상 검토",
  completed: "완료",
  failed: "실패",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-white/20",
  planning: "bg-[#667eea]/60",
  scenes_review: "bg-blue-500/60",
  image_generating: "bg-yellow-500/60",
  images_review: "bg-blue-500/60",
  video_generating: "bg-yellow-500/60",
  videos_review: "bg-blue-500/60",
  completed: "bg-green-500/60",
  failed: "bg-red-500/60",
};

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createMode, setCreateMode] = useState<"brief" | "synopsis">("brief");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [synopsisText, setSynopsisText] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProjects = async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (createMode === "synopsis" && synopsisText.trim()) {
        const project = await api.importSynopsis(synopsisText, title || undefined);
        router.push(`/projects/${project.id}`);
      } else if (title.trim() && brief.trim()) {
        const project = await api.createProject({ title, brief });
        router.push(`/projects/${project.id}`);
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "프로젝트 생성 실패");
      setCreating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSynopsisText(text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 프로젝트를 삭제하시겠습니까?")) return;
    await api.deleteProject(id);
    loadProjects();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero */}
      <header className="border-b border-white/10 bg-[rgba(18,18,18,0.8)] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-lg">
              G
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">GenTA Studio</h1>
              <p className="text-xs text-white/40">AI Video Production</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 gradient-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            새 프로젝트
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Create Form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-10 glass rounded-2xl p-8 animate-fadeInUp"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                새 프로젝트 만들기
              </h2>
              {/* Mode toggle */}
              <div className="flex bg-white/5 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setCreateMode("brief")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${createMode === "brief" ? "bg-[#667eea] text-white" : "text-white/40 hover:text-white/60"}`}
                >
                  브리프로 시작
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("synopsis")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${createMode === "synopsis" ? "bg-[#667eea] text-white" : "text-white/40 hover:text-white/60"}`}
                >
                  시놉시스 파일로 시작
                </button>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-white/50 mb-2">
                  프로젝트 제목
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: Galaxy S26 런칭 영상"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#667eea]"
                />
              </div>

              {createMode === "brief" ? (
                <div>
                  <label className="block text-sm text-white/50 mb-2">
                    브리프 (영상 기획 의도)
                  </label>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={4}
                    placeholder="예: Galaxy S26의 혁신적인 AI 카메라 기능을 강조하는 15초 SNS 광고 영상."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#667eea] resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-white/50 mb-2">
                    시놉시스 / 기획서 (파일 또는 직접 입력)
                  </label>
                  <div className="mb-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 cursor-pointer transition">
                      <Film className="w-4 h-4" />
                      파일 선택 (.txt, .md)
                      <input
                        type="file"
                        accept=".txt,.md,.text"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <textarea
                    value={synopsisText}
                    onChange={(e) => setSynopsisText(e.target.value)}
                    rows={8}
                    placeholder={"시놉시스나 기획서 내용을 붙여넣기 하거나 파일을 선택하세요.\n\n예:\n오프닝: 블루 톤 배경에 제품 등장 (3초)\n메인: 제품 기능 시연, 사용자 리액션 (7초)\n클로징: 로고 + CTA (5초)"}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#667eea] resize-none font-mono"
                  />
                  <p className="text-xs text-white/30 mt-2">
                    AI가 내용을 분석해서 자동으로 씬 분할, 대본, 이미지 프롬프트를 생성합니다.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating || (createMode === "brief" ? !title.trim() || !brief.trim() : !synopsisText.trim())}
                  className="gradient-primary hover:opacity-90 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {createMode === "synopsis" ? "AI로 프로젝트 생성" : "프로젝트 생성"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-white/40 hover:text-white px-4 py-3 text-sm transition"
                >
                  취소
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Project List */}
        <h2 className="text-lg font-semibold mb-6 text-white">프로젝트</h2>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <Film className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-lg">아직 프로젝트가 없습니다</p>
            <p className="text-sm mt-2 text-white/20">
              &quot;새 프로젝트&quot; 버튼을 눌러 시작하세요
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p, i) => (
              <div
                key={p.id}
                className="glass rounded-2xl p-6 flex items-center justify-between hover:bg-white/[0.03] transition group animate-fadeInUp"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="font-semibold text-white truncate">
                      {p.title}
                    </h3>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full text-white ${STATUS_COLORS[p.status] || "bg-white/20"}`}
                    >
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/40 truncate">{p.brief}</p>
                  <p className="text-xs text-white/20 mt-1.5">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-white/30 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-xl text-sm transition"
                  >
                    열기
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
