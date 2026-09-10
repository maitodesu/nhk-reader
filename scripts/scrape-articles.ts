#!/usr/bin/env -S npx tsx
// Populates the homepage with the latest NHK Easy articles.
//
// NHK's own site (news.web.nhk) rebuilt News Web Easy into an auth-gated SPA
// — the old public news-list.json now requires a bearer token issued through
// an internal account/OAuth flow, so it's not something to script against.
// Instead this pulls from nhkeasier.com, a long-running, robots.txt-open
// mirror built specifically for language learners: it republishes NHK Easy's
// own text, furigana, images and audio verbatim, and its RSS feed conveniently
// carries exactly the last 50 stories in one request.
import { getDb } from "../src/lib/db";
import { parseRubyHtml, surfaceOf } from "../src/lib/furigana";
import { tokenizeParagraph } from "../src/lib/tokenize";
import type { ArticleParagraph } from "../src/lib/types";

const FEED_URL = "https://nhkeasier.com/feed/";

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTag(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? m[1].trim() : null;
}

function extractAttr(block: string, tag: string, attr: string): string | null {
  const m = new RegExp(`<${tag}\\s+[^>]*\\b${attr}="([^"]*)"`).exec(block);
  return m ? m[1] : null;
}

interface FeedItem {
  id: string;
  titleHtml: string;
  descriptionHtml: string;
  imageUrl: string | null;
  audioUrl: string | null;
  pubDate: string;
}

function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const link = extractTag(block, "link");
    const guid = extractTag(block, "guid");
    const permalink = link || guid || "";
    const idMatch = /\/story\/(\d+)\//.exec(permalink);
    if (!idMatch) continue;
    const titleHtml = xmlUnescape(extractTag(block, "title") ?? "");
    const descriptionRaw = extractTag(block, "description") ?? "";
    const descriptionHtml = xmlUnescape(descriptionRaw);
    const imageUrl = extractAttr(block, "itunes:image", "href");
    const audioUrl = extractAttr(block, "enclosure", "url");
    const pubDate = extractTag(block, "pubDate") ?? new Date().toISOString();
    items.push({ id: idMatch[1], titleHtml, descriptionHtml, imageUrl, audioUrl, pubDate });
  }
  return items;
}

/** Split the article body HTML into <p> blocks (skipping the image/audio/link furniture). */
function extractParagraphHtmls(bodyHtml: string): string[] {
  const out: string[] = [];
  const re = /<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(bodyHtml))) out.push(m[1]);
  return out;
}

async function main() {
  console.log(`fetching ${FEED_URL} ...`);
  const res = await fetch(FEED_URL, { headers: { "User-Agent": "nhk-reader/1.0 (personal Japanese study tool)" } });
  if (!res.ok) throw new Error(`feed fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseFeed(xml);
  console.log(`  ${items.length} articles in feed`);

  const db = getDb();
  const hasDict = db.prepare("SELECT 1 FROM jmdict_index LIMIT 1").get();
  if (!hasDict) {
    console.warn("warning: dictionary tables are empty — run `npm run build:dict` first for lookups to work.");
  }

  const upsert = db.prepare(`
    INSERT INTO articles (id, title_html, title_text, body_html, tokens_json, image_url, audio_url, source_url, published_at, scraped_at)
    VALUES (@id, @titleHtml, @titleText, @bodyHtml, @tokensJson, @imageUrl, @audioUrl, @sourceUrl, @publishedAt, @scrapedAt)
    ON CONFLICT(id) DO UPDATE SET
      title_html = excluded.title_html, title_text = excluded.title_text, body_html = excluded.body_html,
      tokens_json = excluded.tokens_json, image_url = excluded.image_url, audio_url = excluded.audio_url,
      published_at = excluded.published_at, scraped_at = excluded.scraped_at
  `);

  const tx = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) upsert.run(row);
  });

  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    const titleChars = parseRubyHtml(item.titleHtml);
    const titleText = surfaceOf(titleChars);
    const paragraphHtmls = extractParagraphHtmls(item.descriptionHtml);
    const paragraphs: ArticleParagraph[] = paragraphHtmls.map((html) => ({
      tokens: tokenizeParagraph(db, parseRubyHtml(html)),
    }));

    rows.push({
      id: item.id,
      titleHtml: item.titleHtml,
      titleText,
      bodyHtml: item.descriptionHtml,
      tokensJson: JSON.stringify(paragraphs),
      imageUrl: item.imageUrl,
      audioUrl: item.audioUrl,
      sourceUrl: `https://nhkeasier.com/story/${item.id}/`,
      publishedAt: new Date(item.pubDate).toISOString(),
      scrapedAt: new Date().toISOString(),
    });
  }

  tx(rows);
  console.log(`stored ${rows.length} articles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
