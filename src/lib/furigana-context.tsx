"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPersistedStore } from "./persisted-store";

export type FuriganaMode = "always" | "hover" | "off";
const MODES: FuriganaMode[] = ["always", "hover", "off"];

interface FuriganaContextValue {
  mode: FuriganaMode;
  setMode: (mode: FuriganaMode) => void;
}

const FuriganaContext = createContext<FuriganaContextValue | null>(null);

const store = createPersistedStore<FuriganaMode>(
  "nhk-reader:furigana",
  "always",
  (raw) => (raw && (MODES as string[]).includes(raw) ? (raw as FuriganaMode) : "always"),
  (v) => v
);

export function FuriganaProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.furigana = mode;
  }, [mode]);

  return <FuriganaContext.Provider value={{ mode, setMode: store.set }}>{children}</FuriganaContext.Provider>;
}

export function useFurigana() {
  const ctx = useContext(FuriganaContext);
  if (!ctx) throw new Error("useFurigana must be used within FuriganaProvider");
  return ctx;
}
