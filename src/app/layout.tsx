import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { FuriganaProvider } from "@/lib/furigana-context";
import { ThemeProvider } from "@/lib/theme-context";
import { FontProvider } from "@/lib/font-context";
import { JlptProvider } from "@/lib/jlpt-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FontPicker } from "@/components/FontPicker";

export const metadata: Metadata = {
  title: "読み easy | NHK Easy Reader",
  description: "NHK News Web Easy articles with furigana toggle, pitch accent, and kanji breakdown lookups.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout is the
        correct place for a site-wide font link; the rule targets pages/_document. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;700&family=Shippori+Mincho:wght@400;500;700&family=Zen+Old+Mincho:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap"
        />
      </head>
      {/* suppressHydrationWarning: some browser extensions (password managers, etc.) inject
      attributes like cz-shortcut-listen onto <body> before React hydrates — a real mismatch,
      but an expected/harmless one this tells React not to warn about (React's own documented
      use case for this prop). */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <FontProvider>
            <FuriganaProvider>
              <JlptProvider>
                <header className="sticky top-0 z-30 border-b border-line bg-washi/90 backdrop-blur">
                  <div className="seigaiha h-1.5 w-full" />
                  <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link href="/" className="group flex items-baseline gap-2.5">
                      <span className="font-serif-jp text-2xl font-bold tracking-wide text-sumi group-hover:text-shu-deep transition-colors">
                        読み<span className="text-shu">easy</span>
                      </span>
                      <span className="hidden text-xs text-sumi-soft sm:inline">NHK Easy Reader</span>
                    </Link>
                    <div className="flex items-center gap-2">
                      <FontPicker />
                      <ThemeToggle />
                    </div>
                  </div>
                </header>
                <main className="flex-1">{children}</main>
                <footer className="border-t border-line py-6 text-center text-xs text-sumi-soft">
                  Articles sourced from NHK News Web Easy via nhkeasier.com · for personal Japanese study
                </footer>
              </JlptProvider>
            </FuriganaProvider>
          </FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
