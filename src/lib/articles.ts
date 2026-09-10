import { getDb } from "./db";
import { parseRubyHtml, surfaceOf } from "./furigana";
import type { ArticleParagraph, ArticleRecord } from "./types";

export interface ArticleListItem {
  id: string;
  titleHtml: string;
  imageUrl: string | null;
  publishedAt: string;
  excerpt: string;
}

interface ArticleRow {
  id: string;
  title_html: string;
  title_text: string;
  body_html: string;
  tokens_json: string;
  image_url: string | null;
  audio_url: string | null;
  source_url: string;
  published_at: string;
}

function firstParagraphExcerpt(bodyHtml: string, maxChars = 62): string {
  const m = /<p>([\s\S]*?)<\/p>/.exec(bodyHtml);
  if (!m) return "";
  const plain = surfaceOf(parseRubyHtml(m[1]));
  return plain.length > maxChars ? plain.slice(0, maxChars) + "…" : plain;
}

export function getArticleList(): ArticleListItem[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, title_html, body_html, image_url, published_at FROM articles ORDER BY published_at DESC")
    .all() as Pick<ArticleRow, "id" | "title_html" | "body_html" | "image_url" | "published_at">[];
  return rows.map((r) => ({
    id: r.id,
    titleHtml: r.title_html,
    imageUrl: r.image_url,
    publishedAt: r.published_at,
    excerpt: firstParagraphExcerpt(r.body_html),
  }));
}

export function getArticleById(id: string): ArticleRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    titleHtml: row.title_html,
    titleText: row.title_text,
    bodyHtml: row.body_html,
    paragraphs: JSON.parse(row.tokens_json) as ArticleParagraph[],
    imageUrl: row.image_url,
    audioUrl: row.audio_url,
    sourceUrl: row.source_url,
    publishedAt: row.published_at,
  };
}
