import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

// On Vercel the deployment filesystem is read-only — but readable. data/app.db
// is fetched once at BUILD time (scripts/fetch-db.mjs, wired as "prebuild")
// and bundled as a static asset via next.config.ts's outputFileTracingIncludes,
// so it's already sitting at this same relative path when the function runs;
// no runtime network fetch needed. Just open it read-only there (WAL mode
// needs to create -wal/-shm sidecar files, which a read-only directory won't
// allow).
//
// Also requires NODE_ENV === "production": `vercel env pull` writes VERCEL=1
// into .env.local (which Next.js auto-loads even in `next dev`), so VERCEL
// alone isn't a reliable signal once that file has ever been pulled locally.
const IS_SERVERLESS = !!process.env.VERCEL && process.env.NODE_ENV === "production";

let _db: Database.Database | null = null;

/** Shared singleton connection. better-sqlite3 is synchronous, so no pooling needed. */
export function getDb(): Database.Database {
  if (_db) return _db;

  if (IS_SERVERLESS) {
    _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return _db;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  _db = db;
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title_html TEXT NOT NULL,
  title_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  tokens_json TEXT NOT NULL,
  image_url TEXT,
  audio_url TEXT,
  source_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  scraped_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jmdict_entries (
  seq INTEGER PRIMARY KEY,
  entry_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jmdict_index (
  headword TEXT NOT NULL,
  seq INTEGER NOT NULL,
  is_reading INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_jmdict_index_headword ON jmdict_index(headword);

CREATE TABLE IF NOT EXISTS kanjidic (
  kanji TEXT PRIMARY KEY,
  entry_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pitch_accent (
  surface TEXT NOT NULL,
  reading TEXT NOT NULL,
  pitch_json TEXT NOT NULL,
  PRIMARY KEY (surface, reading)
);
CREATE INDEX IF NOT EXISTS idx_pitch_reading ON pitch_accent(reading);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
