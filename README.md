# 読みeasy — NHK Easy Reader

A Japanese-themed reader for NHK News Web Easy articles with:

- **The full NHK Easy archive** — every story nhkeasier.com has ever published (back to 2017),
  not just a fixed batch, auto-populated so there's nothing to search for.
- **Light/dark theme** and a choice of **6 Google Fonts** for the reading text (3 mincho, 3 gothic).
- **Furigana display mode** (always / hover-to-reveal / off, persisted) — NHK's own furigana.
- **JLPT-level colored underlines** (N5 green → N1 red, toggleable), from the current post-2010
  N1–N5 breakdown, not KANJIDIC2's stale pre-2010 field.
- **Click-any-word lookup**, Yomitan-style but scoped to the reading actually on the page:
  meaning, **pitch accent** diagram, and a **kanji-by-kanji breakdown** (readings, grade, JLPT, meaning).
- Fully offline dictionary — no external API calls at read time.

## Data sources

- **Articles**: [nhkeasier.com](https://nhkeasier.com). NHK's own site (news.web.nhk) rebuilt
  News Web Easy into an auth-gated SPA — the public `news-list.json` API now requires a bearer
  token issued through an internal account/OAuth flow, so this doesn't script against it.
  nhkeasier.com is a long-running, `robots.txt`-open mirror built specifically for learners: it
  republishes NHK Easy's own text, furigana, images and audio verbatim. Its story permalinks are
  plain sequential ids (`/story/1/` is their oldest post), so the whole archive is enumerable —
  see [How article ingestion works](#how-article-ingestion-works) below.
- **Dictionary**: [JMdict](http://www.edrdg.org/jmdict/j_jmdict.html) (word meanings),
  [KANJIDIC2](http://www.edrdg.org/kanjidic/kanjidic2.html) (kanji breakdown), both EDRDG,
  Creative Commons — and [Kanjium](https://github.com/mifunetoshiro/kanjium) (pitch accent, CC BY-SA).
- **JLPT levels**: [kanjiapi.dev](https://kanjiapi.dev) (community-maintained current N1–N5
  breakdown) overrides KANJIDIC2's own `<jlpt>` field, which was frozen to the old pre-2010
  4-level test and never updated.

All of the above are downloaded and compiled into a local SQLite file (`data/app.db`); nothing
is fetched at request time.

## Deploying (Vercel)

Vercel's deployment filesystem is read-only, and `data/app.db` (~250MB) is too big to commit to
git. The fix: upload it once to **Vercel Blob**, then fetch it at **build time** (not request
time) so it ships as a static, read-only file inside the deployed function — one download per
deploy, not one per cold start.

```bash
npm run upload:db                              # uploads data/app.db to Vercel Blob
vercel env add DB_BLOB_URL production          # paste the URL upload:db printed
vercel env add DB_BLOB_URL preview
```

From there, `scripts/fetch-db.mjs` runs automatically as npm's `prebuild` step before every
`next build` — it downloads the blob into `data/app.db` if it's not already present (a no-op
locally, since it's already there), and `next.config.ts`'s `outputFileTracingIncludes` bundles
that file into every server route's function output. `src/lib/db.ts` opens it read-only on
Vercel (no WAL — the directory isn't writable there) and exactly as before locally.

Re-run `npm run upload:db` any time `scrape`/`backfill`/`build:dict` produce fresh data, then
redeploy (or just push — the next build's prebuild step fetches the latest blob automatically).

## Setup

```bash
npm install
npm run setup   # build:dict + scrape + a full backfill — see the timing note below
npm run dev
```

`npm run setup` runs three scripts, also available separately:

- `npm run build:dict` — builds the dictionary tables (JMdict, KANJIDIC2, Kanjium, JLPT levels).
  Takes a minute or two. Re-run occasionally to pick up upstream updates.
- `npm run scrape` — pulls the RSS feed's latest 50 stories. Fast; good for a quick daily refresh.
- `npm run backfill` — walks nhkeasier.com's full story-id space (`/story/1/` onward) and upserts
  everything found. **The first run fetches the entire archive (~10,000 stories as of writing) at
  a deliberately polite pace (a few requests/sec) — expect 30–40 minutes.** It checkpoints its
  progress in the database, so re-running it (e.g. daily, alongside `scrape`) only fetches
  whatever's new since last time and finishes in seconds. Interrupting it is safe — it resumes
  from the checkpoint next run rather than starting over.

## How word lookup works

NHK's own `<ruby>` furigana already marks most kanji-compound word boundaries with an
exact, context-correct reading, so the tokenizer anchors on those groups rather than
guessing segmentation from scratch. It then extends each token through any trailing
okurigana/conjugation it can resolve against the dictionary (including a small built-in
deinflection table for polite/past/negative/te-form and adjective conjugations), and
tokenizes the remaining hiragana runs (particles, standalone kana words) the same way.
This is a lean, dependency-free approach (no MeCab/Unidic) — it isn't a full morphological
analyzer, so uncommon particle/verb boundary cases can occasionally misparse, but it
correctly handles the vocabulary that matters most: the kanji content words.

When multiple dictionary entries share a reading with no kanji to disambiguate (e.g. いる:
居る "to be" vs. 射る "to shoot"), entries are ranked by JMdict's own commonness tags, with
a small curated override for a few everyday kana verbs where one sense heavily dominates
ordinary text.
