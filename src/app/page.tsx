import Link from "next/link";
import { FuriganaToggle } from "@/components/FuriganaToggle";
import { ArticleCard } from "@/components/ArticleCard";
import { MonthFilter } from "@/components/MonthFilter";
import { getArticleList, getMonthOptions } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const monthParam = typeof params.month === "string" ? params.month : null;

  const articles = getArticleList(monthParam ?? undefined);
  const months = getMonthOptions();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <section className="flex flex-col items-start gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif-jp text-3xl font-bold text-sumi sm:text-4xl">
            <span className="text-shu">やさしいニュース</span>アーカイブ
          </h1>
          <p className="mt-2 max-w-xl text-sm text-sumi-soft">
            NHK Easy news, from the entire archive (2017–present) — click any word for its meaning,
            pitch accent, and a kanji-by-kanji breakdown. Showing the latest 50 by default —{" "}
            <span className="text-shu-deep">browse by month</span> or hit{" "}
            <span className="text-shu-deep">🎲 ランダム</span> to jump to a random story from any year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthFilter months={months} current={monthParam} />
          <Link
            href="/random"
            className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-sumi-soft shadow-sm transition hover:border-shu/50 hover:text-shu-deep"
          >
            🎲 ランダム
          </Link>
          <FuriganaToggle />
        </div>
      </section>

      {monthParam && (
        <p className="-mt-2 mb-6 text-xs text-sumi-soft">
          {months.find((m) => m.key === monthParam)?.label ?? monthParam} ·{" "}
          <Link href="/" className="text-shu-deep hover:underline">
            ← back to latest
          </Link>
        </p>
      )}

      {articles.length === 0 ? (
        <div className="card-paper rounded-xl p-8 text-center text-sm text-sumi-soft">
          {monthParam ? (
            "No articles found for this month."
          ) : (
            <>
              No articles yet — run <code className="rounded bg-washi-deep px-1.5 py-0.5">npm run scrape</code> (latest
              articles) and <code className="rounded bg-washi-deep px-1.5 py-0.5">npm run backfill</code> (the full
              archive) to populate the homepage.
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
