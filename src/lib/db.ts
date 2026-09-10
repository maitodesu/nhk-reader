import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Local dev / build scripts: a real, writable file under ./data, exactly as before.
const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(LOCAL_DATA_DIR, "app.db");

// On Vercel the deployment filesystem is read-only (only /tmp is writable, and
// it's wiped between cold starts), so there's nowhere to keep a local SQLite
// file long-term. Instead the built database is uploaded once to Vercel Blob
// (see scripts/upload-db.ts) and `instrumentation.ts` downloads it to /tmp
// before this server instance accepts any requests — see that file for why
// this doesn't need to be awaited here too.
//
// Also requires NODE_ENV === "production": `vercel env pull` writes VERCEL=1
// into .env.local (which Next.js auto-loads even in `next dev`), so VERCEL
// alone isn't a reliable signal once that file has ever been pulled locally.
// `next dev` always sets NODE_ENV=development regardless of .env.local, so
// this stays false there even with a polluted .env.local.
export const IS_SERVERLESS = !!process.env.VERCEL && process.env.NODE_ENV === "production";
export const TMP_DB_PATH = "/tmp/app.db";

let _db: Database.Database | null = null;

/** Shared singleton connection. better-sqlite3 is synchronous, so no pooling needed. */
export function getDb(): Database.Database {
  if (_db) return _db;

  if (IS_SERVERLESS) {
    // instrumentation.ts already downloaded this before the server started
    // accepting requests; open it read-only since /tmp on a reused (Fluid
    // Compute) instance is still someone else's copy in spirit, and we never
    // write from the deployed app anyway.
    _db = new Database(TMP_DB_PATH, { readonly: true, fileMustExist: true });
    return _db;
  }

  if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  const db = new Database(LOCAL_DB_PATH);
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
