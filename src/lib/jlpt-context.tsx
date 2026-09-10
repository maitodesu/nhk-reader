"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPersistedStore } from "./persisted-store";

interface JlptContextValue {
  enabled: boolean;
  toggle: () => void;
}

const JlptContext = createContext<JlptContextValue | null>(null);

const store = createPersistedStore<boolean>(
  "nhk-reader:jlpt-colors",
  true,
  (raw) => (raw === null ? true : raw === "on"),
  (v) => (v ? "on" : "off")
);

export function JlptProvider({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.jlptColors = enabled ? "on" : "off";
  }, [enabled]);

  return (
    <JlptContext.Provider value={{ enabled, toggle: () => store.set(!store.getSnapshot()) }}>
      {children}
    </JlptContext.Provider>
  );
}

export function useJlptColors() {
  const ctx = useContext(JlptContext);
  if (!ctx) throw new Error("useJlptColors must be used within JlptProvider");
  return ctx;
}
