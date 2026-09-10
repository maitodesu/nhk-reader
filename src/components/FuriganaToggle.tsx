"use client";

import { useFurigana, type FuriganaMode } from "@/lib/furigana-context";

const OPTIONS: { mode: FuriganaMode; label: string }[] = [
  { mode: "always", label: "表示" },
  { mode: "hover", label: "ホバー" },
  { mode: "off", label: "非表示" },
];

export function FuriganaToggle() {
  const { mode, setMode } = useFurigana();
  return (
    <div role="radiogroup" aria-label="Furigana display" className="flex items-center gap-1 rounded-full border border-line bg-card p-1 text-sm shadow-sm">
      <span aria-hidden className="pl-2 pr-1 text-xs text-sumi-soft">
        ふりがな
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          role="radio"
          aria-checked={mode === o.mode}
          onClick={() => setMode(o.mode)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === o.mode ? "bg-shu text-white" : "text-sumi-soft hover:bg-washi-deep hover:text-shu-deep"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
