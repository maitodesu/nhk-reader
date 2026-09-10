import { FuriganaToggle } from "@/components/FuriganaToggle";
import { ArticleCard } from "@/components/ArticleCard";
import { getArticleList } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const articles = getArticleList();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <section className="flex flex-col items-start gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif-jp text-3xl font-bold text-sumi sm:text-4xl">
            今月の<span className="text-shu">やさしいニュース</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-sumi-soft">
            NHK Easy news, freshly gathered — click any word for its meaning, pitch accent, and a
            kanji-by-kanji breakdown. Furigana shows by default; switch it to hover-only or off when you&apos;re ready to test yourself.
          </p>
        </div>
        <FuriganaToggle />
      </section>

      {articles.length === 0 ? (
        <div className="card-paper rounded-xl p-8 text-center text-sm text-sumi-soft">
          No articles yet — run <code className="rounded bg-washi-deep px-1.5 py-0.5">npm run scrape</code> (latest
          articles) and <code className="rounded bg-washi-deep px-1.5 py-0.5">npm run backfill</code> (a month of
          history) to populate the homepage.
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
