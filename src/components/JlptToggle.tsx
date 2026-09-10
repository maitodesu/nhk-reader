"use client";

import { useJlptColors } from "@/lib/jlpt-context";

export function JlptToggle() {
  const { enabled, toggle } = useJlptColors();
  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-sumi-soft shadow-sm transition hover:border-shu/50 hover:text-shu-deep"
      title="Toggle JLPT-level underline colors"
    >
      <span
        className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-shu" : "bg-line"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-card shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      JLPT
    </button>
  );
}
