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

export interface MonthOption {
  /** "2026-09" */
  key: string;
  label: string;
  count: number;
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

const LATEST_LIMIT = 50;

function firstParagraphExcerpt(bodyHtml: string, maxChars = 62): string {
  const m = /<p>([\s\S]*?)<\/p>/.exec(bodyHtml);
  if (!m) return "";
  const plain = surfaceOf(parseRubyHtml(m[1]));
  return plain.length > maxChars ? plain.slice(0, maxChars) + "…" : plain;
}

function toListItem(r: Pick<ArticleRow, "id" | "title_html" | "body_html" | "image_url" | "published_at">): ArticleListItem {
  return {
    id: r.id,
    titleHtml: r.title_html,
    imageUrl: r.image_url,
    publishedAt: r.published_at,
    excerpt: firstParagraphExcerpt(r.body_html),
  };
}

/**
 * With ~9,950 articles in the archive, the homepage can't just dump
 * everything — it defaults to the latest 50 (the original brief), and a
 * `month` (YYYY-MM) narrows to that month's articles instead (used by the
 * month filter). Article count per month is small (a few dozen), so no
 * further pagination is needed once a month is picked.
 */
export function getArticleList(month?: string): ArticleListItem[] {
  const db = getDb();
  if (month) {
    const rows = db
      .prepare(
        "SELECT id, title_html, body_html, image_url, published_at FROM articles WHERE strftime('%Y-%m', published_at) = ? ORDER BY published_at DESC"
      )
      .all(month) as Pick<ArticleRow, "id" | "title_html" | "body_html" | "image_url" | "published_at">[];
    return rows.map(toListItem);
  }
  const rows = db
    .prepare("SELECT id, title_html, body_html, image_url, published_at FROM articles ORDER BY published_at DESC LIMIT ?")
    .all(LATEST_LIMIT) as Pick<ArticleRow, "id" | "title_html" | "body_html" | "image_url" | "published_at">[];
  return rows.map(toListItem);
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" });

/** Every month that has at least one article, newest first — for the month filter. */
export function getMonthOptions(): MonthOption[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT strftime('%Y-%m', published_at) as key, COUNT(*) as count FROM articles GROUP BY key ORDER BY key DESC"
    )
    .all() as { key: string; count: number }[];
  return rows.map((r) => ({
    key: r.key,
    count: r.count,
    label: MONTH_LABEL.format(new Date(`${r.key}-01T00:00:00Z`)),
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

/** A random article id, for the "surprise me" button. */
export function getRandomArticleId(): string | null {
  const db = getDb();
  const row = db.prepare("SELECT id FROM articles ORDER BY RANDOM() LIMIT 1").get() as { id: string } | undefined;
  return row?.id ?? null;
}
