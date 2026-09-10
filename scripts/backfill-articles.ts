#!/usr/bin/env -S npx tsx
// Full-archive backfill. nhkeasier.com's story permalinks are just sequential
// IDs (/story/1/ is their oldest post, from 2017-01-04) — every article they
// have ever published is reachable this way, not just the RSS feed's latest
// 50 or a date-range guess. This walks the ID space, upserting each story it
// finds, and remembers how far it got in the `meta` table so a re-run only
// fetches whatever's new since last time instead of starting over.
//
// Usage: npm run backfill              (resume from last known id, or 1 on a fresh db)
//        npm run backfill -- --from=1  (force a specific starting id)
import { getDb } from "../src/lib/db";
import { parseRubyHtml, surfaceOf } from "../src/lib/furigana";
import { tokenizeParagraph } from "../src/lib/tokenize";
import type { ArticleParagraph } from "../src/lib/types";

const ORIGIN = "https://nhkeasier.com";
const CONCURRENCY = 4; // a few in flight at once, not a flood — this is someone's personal server.
const REQUEST_DELAY_MS = 150; // stagger within each concurrent batch
const MISS_STREAK_TO_STOP = 40; // this many consecutive missing ids in a row means we've passed the current end

function extractTag(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? m[1].trim() : null;
}
function extractAttr(block: string, tag: string, attr: string): string | null {
  const m = new RegExp(`<${tag}\\s+[^>]*\\b${attr}="([^"]*)"`).exec(block);
  return m ? m[1] : null;
}
function absolutize(url: string | null): string | null {
  if (!url) return null;
  if (url === "/media/" || url === "/media") return null; // some very old posts have a dangling, file-less src
  return url.startsWith("http") ? url : `${ORIGIN}${url}`;
}
function extractParagraphHtmls(bodyHtml: string): string[] {
  const out: string[] = [];
  const re = /<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(bodyHtml))) out.push(m[1]);
  return out;
}

interface StoryArticle {
  titleHtml: string;
  bodyHtml: string;
  imageUrl: string | null;
  audioUrl: string | null;
  pubDate: string;
}

function parseStoryPage(html: string): StoryArticle | null {
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/.exec(html);
  if (!articleMatch) return null;
  const block = articleMatch[1];
  const titleHtml = extractTag(block, "h3");
  const pubDate = extractAttr(block, "time", "datetime");
  if (!titleHtml || !pubDate) return null;
  const imageUrl = absolutize(extractAttr(block, "img", "src"));
  const audioUrl = absolutize(extractAttr(block, "audio", "src"));
  const bodyHtml = extractParagraphHtmls(block)
    .map((p) => `<p>${p}</p>`)
    .join("\n");
  return { titleHtml, bodyHtml, imageUrl, audioUrl, pubDate };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStory(id: number): Promise<StoryArticle | null | "error"> {
  try {
    const res = await fetch(`${ORIGIN}/story/${id}/`, {
      headers: { "User-Agent": "nhk-reader/1.0 (personal Japanese study tool)" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return "error";
    return parseStoryPage(await res.text());
  } catch {
    return "error";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fromArg = args.find((a) => a.startsWith("--from="))?.slice("--from=".length);

  const db = getDb();
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const hasDict = db.prepare("SELECT 1 FROM jmdict_index LIMIT 1").get();
  if (!hasDict) {
    console.warn("warning: dictionary tables are empty — run `npm run build:dict` first for lookups to work.");
  }

  const storedMax = db.prepare("SELECT value FROM meta WHERE key = 'backfill_max_id'").get() as
    | { value: string }
    | undefined;
  const start = fromArg ? Number(fromArg) : storedMax ? Number(storedMax.value) + 1 : 1;

  console.log(`backfilling NHK Easy articles starting at story id ${start} (nhkeasier.com/story/{id}/)...`);

  const upsert = db.prepare(`
    INSERT INTO articles (id, title_html, title_text, body_html, tokens_json, image_url, audio_url, source_url, published_at, scraped_at)
    VALUES (@id, @titleHtml, @titleText, @bodyHtml, @tokensJson, @imageUrl, @audioUrl, @sourceUrl, @publishedAt, @scrapedAt)
    ON CONFLICT(id) DO UPDATE SET
      title_html = excluded.title_html, title_text = excluded.title_text, body_html = excluded.body_html,
      tokens_json = excluded.tokens_json, image_url = excluded.image_url, audio_url = excluded.audio_url,
      published_at = excluded.published_at, scraped_at = excluded.scraped_at
  `);
  const saveProgress = db.prepare(
    "INSERT INTO meta (key, value) VALUES ('backfill_max_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  function storeArticle(id: number, item: StoryArticle) {
    const titleChars = parseRubyHtml(item.titleHtml);
    const titleText = surfaceOf(titleChars);
    const paragraphHtmls = extractParagraphHtmls(item.bodyHtml);
    const paragraphs: ArticleParagraph[] = paragraphHtmls.map((html) => ({
      tokens: tokenizeParagraph(db, parseRubyHtml(html)),
    }));
    upsert.run({
      id: String(id),
      titleHtml: item.titleHtml,
      titleText,
      bodyHtml: item.bodyHtml,
      tokensJson: JSON.stringify(paragraphs),
      imageUrl: item.imageUrl,
      audioUrl: item.audioUrl,
      sourceUrl: `https://nhkeasier.com/story/${id}/`,
      publishedAt: new Date(item.pubDate).toISOString(),
      scrapedAt: new Date().toISOString(),
    });
  }

  let id = start;
  let missStreak = 0;
  let found = 0;
  let highestSeen = start - 1;

  while (missStreak < MISS_STREAK_TO_STOP) {
    const batchIds = Array.from({ length: CONCURRENCY }, (_, i) => id + i);
    const results = await Promise.all(
      batchIds.map(async (bid, i) => {
        await sleep(i * REQUEST_DELAY_MS);
        return { bid, article: await fetchStory(bid) };
      })
    );

    for (const { bid, article } of results.sort((a, b) => a.bid - b.bid)) {
      if (article === "error") {
        // Transient network hiccup, not a real 404 — don't let it count toward
        // "we've reached the end of the archive", and don't advance the
        // checkpoint past it. Rare in practice; worth a look if it repeats.
        console.log(`  id ${bid}: request error, skipping (re-run later to retry)`);
        continue;
      }
      if (article === null) {
        missStreak++;
        continue;
      }
      missStreak = 0;
      if (bid > highestSeen) highestSeen = bid;
      storeArticle(bid, article);
      found++;
      if (found % 25 === 0) {
        saveProgress.run(String(highestSeen));
        console.log(`  ...${found} articles so far (up to id ${highestSeen})`);
      }
    }

    id += CONCURRENCY;
    if (missStreak >= MISS_STREAK_TO_STOP) break;
    await sleep(120); // small pause between batches — this is a big one-time crawl of someone's personal server
  }

  saveProgress.run(String(highestSeen));
  const total = (db.prepare("SELECT COUNT(*) as n FROM articles").get() as { n: number }).n;
  console.log(
    `backfill complete: added/updated ${found} articles, reached id ~${highestSeen}, ${total} total in the database.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
