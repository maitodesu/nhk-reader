import Link from "next/link";
import type { ArticleListItem } from "@/lib/articles";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(d);
}

export function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
    <Link
      href={`/article/${article.id}`}
      className="card-paper group flex flex-col overflow-hidden rounded-xl transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-washi-deep">
        {article.imageUrl ? (
          // NHK/nhkeasier images live on an external, per-article host — plain <img> avoids
          // configuring next/image remotePatterns for a domain that changes per story.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-gold">読</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <time className="text-xs font-medium text-shu-deep">{formatDate(article.publishedAt)}</time>
        <h2
          className="reader-text text-[1.05rem] leading-snug font-semibold text-sumi"
          dangerouslySetInnerHTML={{ __html: article.titleHtml }}
        />
        <p className="mt-auto line-clamp-2 pt-1 text-xs text-sumi-soft">{article.excerpt}</p>
      </div>
    </Link>
  );
}
