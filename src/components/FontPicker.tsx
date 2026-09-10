"use client";

import { useEffect, useRef, useState } from "react";
import { READER_FONTS, useReaderFont } from "@/lib/font-context";

export function FontPicker() {
  const { font, setFontId } = useReaderFont();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-sumi-soft shadow-sm transition hover:border-shu/50 hover:text-shu-deep"
      >
        <span aria-hidden className="text-shu-deep">
          字
        </span>
        <span className="max-w-28 truncate">{font.label}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="card-paper popup-anim absolute top-[calc(100%+6px)] right-0 z-40 w-64 overflow-hidden rounded-xl p-1.5"
        >
          {READER_FONTS.map((f) => (
            <li key={f.id}>
              <button
                role="option"
                aria-selected={f.id === font.id}
                onClick={() => {
                  setFontId(f.id);
                  setOpen(false);
                }}
                style={{ fontFamily: `"${f.family}", serif` }}
                className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  f.id === font.id ? "bg-shu/10 text-shu-deep" : "text-sumi hover:bg-washi-deep"
                }`}
              >
                <span className="text-base">{f.label}</span>
                <span className="shrink-0 text-[11px] opacity-60" style={{ fontFamily: "var(--font-sans-jp)" }}>
                  {f.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
