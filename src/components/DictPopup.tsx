"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PitchAccentGraph } from "./PitchAccentGraph";
import type { WordLookupResult } from "@/lib/types";

interface Props {
  anchor: { x: number; top: number; bottom: number };
  loading: boolean;
  result: WordLookupResult | null;
  onClose: () => void;
}

function jlptLabel(jlpt: number | null): string | null {
  return jlpt ? `N${jlpt}` : null;
}

const MARGIN = 10; // minimum gap kept from the viewport edge
const GAP = 10; // gap between the clicked word and the popup
const IDEAL_WIDTH = 336;
const MIN_USABLE_HEIGHT = 160; // below this, flipping to the other side is worth it even if it has less room

/**
 * Viewport-aware placement: prefers below the clicked word, flips above when
 * that side has more room, and always sizes to what actually fits on screen
 * (the popup scrolls internally past that, rather than running off-screen).
 */
function computePlacement(anchor: Props["anchor"]) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width = Math.min(IDEAL_WIDTH, vw - MARGIN * 2);
  const left = Math.min(Math.max(MARGIN, anchor.x - width / 2), vw - width - MARGIN);

  const spaceBelow = vh - anchor.bottom - GAP - MARGIN;
  const spaceAbove = anchor.top - GAP - MARGIN;
  const placeBelow = spaceBelow >= MIN_USABLE_HEIGHT || spaceBelow >= spaceAbove;

  const maxHeight = Math.max(MIN_USABLE_HEIGHT, Math.min(placeBelow ? spaceBelow : spaceAbove, vh * 0.75));

  const style: React.CSSProperties = { left, width, maxHeight };
  if (placeBelow) {
    style.top = anchor.bottom + GAP;
  } else {
    style.bottom = vh - anchor.top + GAP;
  }
  return style;
}

export function DictPopup({ anchor, loading, result, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const style = computePlacement(anchor);

  const primaryEntry = result?.entries[0];
  const primarySense = primaryEntry?.senses[0];
  const restSenses = primaryEntry ? primaryEntry.senses.slice(1) : [];
  const extraEntries = result ? result.entries.slice(1) : [];

  return createPortal(
    <div
      ref={ref}
      className="card-paper popup-anim fixed z-50 flex flex-col overflow-hidden rounded-xl text-sm"
      style={{ ...style, fontFamily: "var(--font-sans-jp)" }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-2 right-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-card/90 text-sumi-soft hover:bg-washi-deep hover:text-shu-deep"
      >
        ×
      </button>

      <div className="dict-popup-scroll overflow-y-auto p-4">
        {loading && <p className="py-4 text-center text-sumi-soft">…</p>}

        {!loading && result && (
          <div className="flex flex-col gap-3 pr-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="reader-text text-xl font-bold text-sumi">{result.dictionaryForm}</span>
                {result.reading && result.reading !== result.dictionaryForm && (
                  <span className="text-sm text-shu-deep">{result.reading}</span>
                )}
              </div>
              {result.via && (
                <span className="mt-1 inline-block rounded-full bg-washi-deep px-2 py-0.5 text-[11px] text-sumi-soft">
                  {result.via} of {result.dictionaryForm}
                </span>
              )}
            </div>

            {result.pitch.length > 0 && (
              <div className="flex flex-col gap-1 border-y border-line py-2">
                {result.pitch.map((p, i) => (
                  <PitchAccentGraph key={i} pattern={p} />
                ))}
              </div>
            )}

            {primarySense ? (
              <div>
                <div className="mb-1 flex flex-wrap gap-1">
                  {primarySense.pos.slice(0, 3).map((p, i) => (
                    <span key={i} className="rounded-full bg-shu/10 px-2 py-0.5 text-[11px] text-shu-deep">
                      {p}
                    </span>
                  ))}
                </div>
                <p className="text-[15px] text-sumi">{primarySense.glosses.join("; ")}</p>
              </div>
            ) : (
              <p className="text-sumi-soft italic">No dictionary entry found for this word.</p>
            )}

            {(restSenses.length > 0 || extraEntries.length > 0) && (
              <details className="text-xs text-sumi-soft">
                <summary className="cursor-pointer select-none text-shu-deep">more meanings</summary>
                <div className="mt-2 flex flex-col gap-2">
                  {restSenses.map((s, i) => (
                    <p key={`s${i}`}>
                      <span className="text-sumi-soft/70">{s.pos.slice(0, 2).join(", ")}</span> {s.glosses.join("; ")}
                    </p>
                  ))}
                  {extraEntries.map((e, i) => (
                    <p key={`e${i}`}>
                      <span className="text-sumi-soft/70">{e.senses[0]?.pos.slice(0, 2).join(", ")}</span>{" "}
                      {e.senses[0]?.glosses.join("; ")}
                    </p>
                  ))}
                </div>
              </details>
            )}

            {result.kanji.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                {result.kanji.map((k) => (
                  <div key={k.kanji} className="flex gap-3">
                    <div className="reader-text grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-washi-deep text-xl text-sumi">
                      {k.kanji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-sumi-soft">
                        {k.on.length > 0 && <span>音 {k.on.join("・")}</span>}
                        {k.kun.length > 0 && <span>訓 {k.kun.join("・")}</span>}
                        {jlptLabel(k.jlpt) && (
                          <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-gold">{jlptLabel(k.jlpt)}</span>
                        )}
                        {k.grade && <span className="rounded-full bg-washi-deep px-1.5 py-0.5">grade {k.grade}</span>}
                      </div>
                      <p className="truncate text-xs text-sumi">{k.meanings.slice(0, 4).join(", ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
