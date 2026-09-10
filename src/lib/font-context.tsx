"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPersistedStore } from "./persisted-store";

export interface ReaderFontOption {
  id: string;
  label: string;
  family: string;
  /** Short description shown in the picker to help pick between similar-looking options. */
  hint: string;
}

// Five well-regarded, genuinely-readable-at-body-size Google Fonts covering
// both mincho (serif) and gothic (sans) taste — not just Noto by default.
export const READER_FONTS: ReaderFontOption[] = [
  { id: "noto-serif", label: "Noto Serif JP", family: "Noto Serif JP", hint: "classic mincho" },
  { id: "shippori", label: "Shippori Mincho", family: "Shippori Mincho", hint: "soft, editorial mincho" },
  { id: "zen-old-mincho", label: "Zen Old Mincho", family: "Zen Old Mincho", hint: "calligraphic mincho" },
  { id: "noto-sans", label: "Noto Sans JP", family: "Noto Sans JP", hint: "clean gothic, high readability" },
  { id: "zen-kaku", label: "Zen Kaku Gothic New", family: "Zen Kaku Gothic New", hint: "clean modern gothic" },
  { id: "zen-maru", label: "Zen Maru Gothic", family: "Zen Maru Gothic", hint: "rounded, friendly gothic" },
];

const DEFAULT_FONT = READER_FONTS[0];

interface FontContextValue {
  font: ReaderFontOption;
  setFontId: (id: string) => void;
}

const FontContext = createContext<FontContextValue | null>(null);

const store = createPersistedStore<string>(
  "nhk-reader:font",
  DEFAULT_FONT.id,
  (raw) => (raw && READER_FONTS.some((f) => f.id === raw) ? raw : DEFAULT_FONT.id),
  (v) => v
);

export function FontProvider({ children }: { children: ReactNode }) {
  const fontId = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const font = READER_FONTS.find((f) => f.id === fontId) ?? DEFAULT_FONT;

  useEffect(() => {
    document.documentElement.style.setProperty("--font-serif-jp", `"${font.family}", serif`);
  }, [font]);

  return (
    <FontContext.Provider value={{ font, setFontId: (id) => store.set(id) }}>{children}</FontContext.Provider>
  );
}

export function useReaderFont() {
  const ctx = useContext(FontContext);
  if (!ctx) throw new Error("useReaderFont must be used within FontProvider");
  return ctx;
}
