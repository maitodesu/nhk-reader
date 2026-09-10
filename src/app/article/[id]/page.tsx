import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/articles";
import { FuriganaToggle } from "@/components/FuriganaToggle";
import { ReaderText } from "@/components/ReaderText";
import { JlptLegend } from "@/components/JlptLegend";
import { JlptToggle } from "@/components/JlptToggle";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
}

export default async function ArticlePage({ params }: PageProps<"/article/[id]">) {
  const { id } = await params;
  const article = getArticleById(id);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 py-6">
        <Link href="/" className="text-sm text-sumi-soft hover:text-shu-deep">
          ← 記事一覧
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <FuriganaToggle />
          <JlptToggle />
        </div>
      </div>

      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="mb-6 aspect-[16/9] w-full rounded-xl object-cover shadow-md"
        />
      )}

      <time className="text-xs font-medium text-shu-deep">{formatDate(article.publishedAt)}</time>
      <h1
        className="reader-text mt-2 mb-4 text-3xl leading-snug font-bold text-sumi"
        dangerouslySetInnerHTML={{ __html: article.titleHtml }}
      />

      {article.audioUrl && (
        <audio controls preload="none" src={article.audioUrl} className="mb-6 w-full">
          Your browser does not support audio playback.
        </audio>
      )}

      <div className="mb-8 flex flex-col gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-xs text-sumi-soft">
        <p>単語をクリックすると、意味・アクセント・漢字の分解が見られます — click any word for its meaning, pitch accent, and kanji breakdown.</p>
        <JlptLegend />
      </div>

      <ReaderText paragraphs={article.paragraphs} />

      <div className="mt-10 border-t border-line pt-6 text-xs text-sumi-soft">
        <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="text-shu-deep hover:underline">
          Original source ↗
        </a>
      </div>
    </div>
  );
}
