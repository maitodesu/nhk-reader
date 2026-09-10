"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-card text-sumi-soft shadow-sm transition hover:border-shu/50 hover:text-shu-deep"
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a9 9 0 1 0 9 9c0-.36-.02-.71-.05-1.06A7 7 0 0 1 12 3Z" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      )}
    </button>
  );
}
