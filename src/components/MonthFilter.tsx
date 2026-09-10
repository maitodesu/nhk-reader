"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthOption } from "@/lib/articles";

export function MonthFilter({ months, current }: { months: MonthOption[]; current: string | null }) {
  const router = useRouter();
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

  const currentLabel = current ? months.find((m) => m.key === current)?.label ?? current : "最新50件 — Latest 50";

  function select(key: string | null) {
    router.push(key ? `/?month=${key}` : "/");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-sumi-soft shadow-sm transition hover:border-shu/50 hover:text-shu-deep"
      >
        <span aria-hidden className="text-xs">
          📅
        </span>
        <span className="max-w-40 truncate">{currentLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="card-paper popup-anim dict-popup-scroll absolute top-[calc(100%+6px)] right-0 z-40 max-h-80 w-56 overflow-y-auto rounded-xl p-1.5"
        >
          <li>
            <button
              role="option"
              aria-selected={!current}
              onClick={() => select(null)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                !current ? "bg-shu/10 text-shu-deep" : "text-sumi hover:bg-washi-deep"
              }`}
            >
              最新50件 — Latest 50
            </button>
          </li>
          <li className="my-1 border-t border-line" />
          {months.map((m) => (
            <li key={m.key}>
              <button
                role="option"
                aria-selected={m.key === current}
                onClick={() => select(m.key)}
                className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  m.key === current ? "bg-shu/10 text-shu-deep" : "text-sumi hover:bg-washi-deep"
                }`}
              >
                <span>{m.label}</span>
                <span className="shrink-0 text-[11px] opacity-60">{m.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
