"use client";

import { useJlptColors } from "@/lib/jlpt-context";

const LEVELS: { level: 5 | 4 | 3 | 2 | 1; label: string }[] = [
  { level: 5, label: "N5" },
  { level: 4, label: "N4" },
  { level: 3, label: "N3" },
  { level: 2, label: "N2" },
  { level: 1, label: "N1" },
];

export function JlptLegend() {
  const { enabled } = useJlptColors();
  if (!enabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sumi-soft">
      <span>underline = JLPT level:</span>
      {LEVELS.map((l) => (
        <span key={l.level} className="flex items-center gap-1">
          <span
            data-jlpt={l.level}
            className="lookup-token inline-block h-0 w-4 border-b-2"
            style={{ borderColor: "var(--jlpt-color)" }}
          />
          {l.label}
        </span>
      ))}
    </div>
  );
}
