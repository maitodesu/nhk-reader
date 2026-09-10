"use client";

import { useCallback, useState } from "react";
import { DictPopup } from "./DictPopup";
import type { ArticleParagraph, WordLookupResult } from "@/lib/types";

interface Active {
  key: string;
  anchor: { x: number; top: number; bottom: number };
}

export function ReaderText({ paragraphs }: { paragraphs: ArticleParagraph[] }) {
  const [active, setActive] = useState<Active | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordLookupResult | null>(null);

  const onTokenClick = useCallback(async (e: React.MouseEvent<HTMLSpanElement>, surface: string, reading: string | null) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const key = `${surface}:${reading}`;
    setActive({ key, anchor: { x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom } });
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ surface });
      if (reading) params.set("reading", reading);
      const res = await fetch(`/api/lookup?${params.toString()}`);
      const data: WordLookupResult = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="reader-text flex flex-col gap-6 text-[1.2rem] text-sumi">
      {paragraphs.map((para, pi) => (
        <p key={pi}>
          {para.tokens.map((t, ti) => {
            if (t.surface === "\n") return <br key={ti} />;
            if (t.reading === null) {
              return <span key={ti}>{t.surface}</span>;
            }
            const isActive = active?.key === `${t.surface}:${t.reading}`;
            return (
              <span
                key={ti}
                className="lookup-token"
                data-active={isActive || undefined}
                data-jlpt={t.jlptLevel ?? undefined}
                onClick={(e) => onTokenClick(e, t.surface, t.reading)}
              >
                {t.hasKanji ? (
                  <ruby>
                    {t.surface}
                    <rt>{t.reading}</rt>
                  </ruby>
                ) : (
                  t.surface
                )}
              </span>
            );
          })}
        </p>
      ))}

      {active && <DictPopup anchor={active.anchor} loading={loading} result={result} onClose={() => setActive(null)} />}
    </div>
  );
}
