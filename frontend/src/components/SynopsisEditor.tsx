"use client";

import { useState } from "react";
import { Check, Circle, ArrowRight, Plus, X } from "lucide-react";
import type { SynopsisData } from "@/lib/types";

interface SynopsisEditorProps {
  data: SynopsisData;
  onChange: (data: SynopsisData) => void;
  onNext: () => void;
}

const FORMAT_OPTIONS = [
  "30초 광고",
  "60초 광고",
  "15초 릴스",
  "뮤직비디오",
  "브랜드 필름",
];

const FIELD_LABELS: { key: keyof SynopsisData; label: string }[] = [
  { key: "title", label: "제목" },
  { key: "subtitle", label: "부제목" },
  { key: "format", label: "포맷" },
  { key: "genre", label: "장르" },
  { key: "keyConcept", label: "핵심 컨셉" },
  { key: "visualReference", label: "비주얼 레퍼런스" },
  { key: "thematicReference", label: "테마 레퍼런스" },
  { key: "logline", label: "로그라인" },
  { key: "characters", label: "등장인물" },
  { key: "synopsis", label: "시놉시스" },
];

function isFieldFilled(data: SynopsisData, key: keyof SynopsisData): boolean {
  const value = data[key];
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

export default function SynopsisEditor({
  data,
  onChange,
  onNext,
}: SynopsisEditorProps) {
  const [genreInput, setGenreInput] = useState("");

  const update = <K extends keyof SynopsisData>(
    key: K,
    value: SynopsisData[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  const addGenre = () => {
    const tag = genreInput.trim();
    if (tag && !data.genre.includes(tag)) {
      update("genre", [...data.genre, tag]);
    }
    setGenreInput("");
  };

  const removeGenre = (tag: string) => {
    update(
      "genre",
      data.genre.filter((g) => g !== tag)
    );
  };

  const filledCount = FIELD_LABELS.filter((f) =>
    isFieldFilled(data, f.key)
  ).length;
  const totalCount = FIELD_LABELS.length;
  const progress = Math.round((filledCount / totalCount) * 100);

  const inputClass =
    "w-full bg-white/5 border-0 focus:ring-1 focus:ring-primary rounded-lg text-white placeholder:text-white/30 px-4 py-3 outline-none transition-all";
  const textareaClass =
    "w-full bg-white/5 border-0 focus:ring-1 focus:ring-primary rounded-lg text-white placeholder:text-white/30 px-4 py-3 outline-none resize-none transition-all";
  const labelClass = "block text-sm font-medium text-white/60 mb-1.5";

  return (
    <div className="flex gap-6 h-full">
      {/* Left: Document Editor */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {/* Title */}
        <div>
          <label className={labelClass}>제목</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="영상 제목을 입력하세요"
            className={`${inputClass} text-2xl font-bold py-4`}
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className={labelClass}>부제목</label>
          <input
            type="text"
            value={data.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            placeholder="부제목을 입력하세요"
            className={`${inputClass} text-base text-white/70`}
          />
        </div>

        {/* Format */}
        <div>
          <label className={labelClass}>포맷</label>
          <select
            value={data.format}
            onChange={(e) => update("format", e.target.value)}
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            <option value="" disabled className="bg-neutral-900 text-white/30">
              포맷을 선택하세요
            </option>
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-neutral-900 text-white">
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Genre */}
        <div>
          <label className={labelClass}>장르</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {data.genre.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm border border-primary/30"
              >
                {tag}
                <button
                  onClick={() => removeGenre(tag)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGenre();
                }
              }}
              placeholder="장르 추가"
              className={`${inputClass} flex-1`}
            />
            <button
              onClick={addGenre}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Key Concept */}
        <div>
          <label className={labelClass}>핵심 컨셉</label>
          <textarea
            value={data.keyConcept}
            onChange={(e) => update("keyConcept", e.target.value)}
            placeholder="핵심 컨셉을 설명하세요"
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* Visual Reference */}
        <div>
          <label className={labelClass}>비주얼 레퍼런스</label>
          <textarea
            value={data.visualReference}
            onChange={(e) => update("visualReference", e.target.value)}
            placeholder="비주얼 레퍼런스를 설명하세요"
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* Thematic Reference */}
        <div>
          <label className={labelClass}>테마 레퍼런스</label>
          <textarea
            value={data.thematicReference}
            onChange={(e) => update("thematicReference", e.target.value)}
            placeholder="테마 레퍼런스를 설명하세요"
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* Logline */}
        <div>
          <label className={labelClass}>로그라인</label>
          <textarea
            value={data.logline}
            onChange={(e) => update("logline", e.target.value)}
            placeholder="한두 문장으로 영상의 핵심을 요약하세요"
            rows={2}
            className={textareaClass}
          />
        </div>

        {/* Characters */}
        <div>
          <label className={labelClass}>등장인물</label>
          <textarea
            value={data.characters}
            onChange={(e) => update("characters", e.target.value)}
            placeholder="등장인물을 설명하세요"
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* Synopsis */}
        <div>
          <label className={labelClass}>시놉시스</label>
          <textarea
            value={data.synopsis}
            onChange={(e) => update("synopsis", e.target.value)}
            placeholder="전체 시놉시스를 작성하세요"
            rows={8}
            className={textareaClass}
          />
        </div>
      </div>

      {/* Right: Status Panel */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 sticky top-0 space-y-6">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white/60">
                작성 진행률
              </span>
              <span className="text-sm font-bold text-white">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/40 mt-1.5">
              {filledCount} / {totalCount} 항목 완료
            </p>
          </div>

          {/* Field Checklist */}
          <div className="space-y-2">
            {FIELD_LABELS.map(({ key, label }) => {
              const filled = isFieldFilled(data, key);
              return (
                <div
                  key={key}
                  className="flex items-center gap-2.5 text-sm"
                >
                  {filled ? (
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />
                  )}
                  <span
                    className={
                      filled ? "text-white/80" : "text-white/40"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-all"
          >
            다음 단계: 시나리오
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
