#!/usr/bin/env node
// Downloads JMdict (word dictionary), KANJIDIC2 (kanji breakdown) and Kanjium
// (pitch accent) source data and builds the local SQLite lookup tables used
// by the reader's pop-up dictionary. Run once via `npm run build:dict`
// (re-run any time to refresh — it replaces the tables in place).

import { gunzipSync } from "node:zlib";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "app.db");

const JMDICT_URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz";
const KANJIDIC_URL = "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz";
const KANJIUM_URL =
  "https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/raw/accents.txt";
// KANJIDIC2's own <jlpt> field is frozen to the pre-2010 4-level test and was
// never updated for the current N1-N5 test, so most kanji added or reshuffled
// since then carry no (or a wrong) level. kanjiapi.dev serves the current
// community-maintained N1-N5 breakdown instead (davidluzgouveia/kanji-data) —
// this is what actually drives the difficulty-colored underlines.
const JLPT_URL = (level) => `https://kanjiapi.dev/v1/kanji/jlpt-${level}`;

async function fetchText(url, { gzip = false } = {}) {
  console.log(`fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const raw = gzip ? gunzipSync(buf) : buf;
  console.log(`  ${(raw.length / 1024 / 1024).toFixed(1)} MB`);
  return raw.toString("utf-8");
}

// ---------------------------------------------------------------------------
// JMdict
// ---------------------------------------------------------------------------

function resolveEntities(xml) {
  const entityMap = new Map();
  const entityRe = /<!ENTITY\s+(\S+)\s+"([^"]*)">/g;
  let m;
  while ((m = entityRe.exec(xml))) entityMap.set(m[1], m[2]);
  console.log(`  ${entityMap.size} custom entities defined`);
  return xml.replace(/&([a-zA-Z0-9_-]+);/g, (whole, name) => {
    if (["amp", "lt", "gt", "quot", "apos"].includes(name)) return whole;
    const v = entityMap.get(name);
    return v !== undefined ? v : whole;
  });
}

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractAll(re, block) {
  const out = [];
  let m;
  const r = new RegExp(re, "g");
  while ((m = r.exec(block))) out.push(m[1]);
  return out;
}

function parseJMdict(xml) {
  console.log("resolving JMdict entities...");
  const resolved = resolveEntities(xml);
  console.log("parsing JMdict entries...");
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  let count = 0;
  while ((m = entryRe.exec(resolved))) {
    const block = m[1];
    const seqStr = /<ent_seq>(\d+)<\/ent_seq>/.exec(block);
    if (!seqStr) continue;
    const seq = Number(seqStr[1]);
    const kanji = extractAll("<keb>([^<]*)</keb>", block).map(unescapeXml);
    const readings = extractAll("<reb>([^<]*)</reb>", block).map(unescapeXml);
    // JMdict marks genuinely common words with a priority tag on their k_ele/r_ele
    // (news1/ichi1/spec1/spec2/gai1 = "very common" tier). Without this, homographs
    // that share a reading (e.g. 居る "to be" vs 射る "to shoot", both いる) resolve
    // to whichever entry happens to appear first in the file, which is often the
    // obscure one. We keep just a boolean so the common reading wins ties.
    const isCommon = /<(?:ke|re)_pri>(?:news1|ichi1|spec1|spec2|gai1)<\/(?:ke|re)_pri>/.test(block);
    const senses = [];
    const senseRe = /<sense>([\s\S]*?)<\/sense>/g;
    let sm;
    while ((sm = senseRe.exec(block))) {
      const sblock = sm[1];
      const pos = extractAll("<pos>([^<]*)</pos>", sblock).map(unescapeXml);
      // Only English glosses: a gloss with xml:lang="xx" (non-eng) is excluded;
      // the default (no xml:lang attr) is English.
      const glosses = [];
      const glossTagRe = /<gloss([^>]*)>([^<]*)<\/gloss>/g;
      let gm;
      while ((gm = glossTagRe.exec(sblock))) {
        const attrs = gm[1];
        if (/xml:lang="(?!eng)/.test(attrs)) continue;
        glosses.push(unescapeXml(gm[2]));
      }
      if (glosses.length) senses.push({ pos, glosses });
    }
    if (senses.length === 0) continue;
    entries.push({ seq, kanji, readings, senses, isCommon });
    count++;
    if (count % 20000 === 0) console.log(`  parsed ${count} entries...`);
  }
  console.log(`  total ${entries.length} JMdict entries`);
  return entries;
}

// ---------------------------------------------------------------------------
// KANJIDIC2
// ---------------------------------------------------------------------------

function parseKanjidic(xml) {
  console.log("parsing KANJIDIC2...");
  const out = [];
  const charRe = /<character>([\s\S]*?)<\/character>/g;
  let m;
  while ((m = charRe.exec(xml))) {
    const block = m[1];
    const literal = /<literal>([^<]*)<\/literal>/.exec(block)?.[1];
    if (!literal) continue;
    const grade = /<grade>(\d+)<\/grade>/.exec(block)?.[1];
    const strokes = /<stroke_count>(\d+)<\/stroke_count>/.exec(block)?.[1];
    const jlpt = /<jlpt>(\d+)<\/jlpt>/.exec(block)?.[1];
    const freq = /<freq>(\d+)<\/freq>/.exec(block)?.[1];
    const onReadings = extractAll('<reading r_type="ja_on">([^<]*)</reading>', block);
    const kunReadings = extractAll('<reading r_type="ja_kun">([^<]*)</reading>', block);
    const meaningTagRe = /<meaning([^>]*)>([^<]*)<\/meaning>/g;
    const meanings = [];
    let mm;
    while ((mm = meaningTagRe.exec(block))) {
      if (/m_lang=/.test(mm[1])) continue; // non-English
      meanings.push(unescapeXml(mm[2]));
    }
    out.push({
      kanji: literal,
      grade: grade ? Number(grade) : null,
      strokes: strokes ? Number(strokes) : null,
      jlpt: jlpt ? Number(jlpt) : null,
      freq: freq ? Number(freq) : null,
      on: onReadings,
      kun: kunReadings.map((r) => r.replace(/\./g, "")), // strip okurigana dot marker for display simplicity
      kunRaw: kunReadings,
      meanings,
    });
  }
  console.log(`  total ${out.length} kanji`);
  return out;
}

// ---------------------------------------------------------------------------
// Kanjium pitch accent
// ---------------------------------------------------------------------------

function parseKanjium(text) {
  console.log("parsing Kanjium pitch accent data...");
  const rows = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split("\t");
    if (parts.length < 3) continue;
    const [surface, reading, pitchRaw] = parts;
    const pitches = pitchRaw
      .split(",")
      .map((p) => Number(p.trim()))
      .filter((n) => Number.isFinite(n));
    if (!pitches.length) continue;
    rows.push({ surface, reading, pitches });
  }
  console.log(`  total ${rows.length} pitch accent rows`);
  return rows;
}

// ---------------------------------------------------------------------------
// JLPT levels (current N1-N5 test, from kanjiapi.dev)
// ---------------------------------------------------------------------------

async function fetchJlptLevels() {
  console.log("fetching current JLPT kanji levels (kanjiapi.dev)...");
  const byKanji = new Map();
  for (const level of [5, 4, 3, 2, 1]) {
    console.log(`  N${level}...`);
    const res = await fetch(JLPT_URL(level));
    if (!res.ok) throw new Error(`kanjiapi.dev N${level} -> HTTP ${res.status}`);
    const list = await res.json();
    for (const kanji of list) byKanji.set(kanji, level);
  }
  console.log(`  ${byKanji.size} kanji classified across N1-N5`);
  return byKanji;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [jmdictXml, kanjidicXml, kanjiumText, jlptLevels] = await Promise.all([
    fetchText(JMDICT_URL, { gzip: true }),
    fetchText(KANJIDIC_URL, { gzip: true }),
    fetchText(KANJIUM_URL),
    fetchJlptLevels(),
  ]);

  const jmdictEntries = parseJMdict(jmdictXml);
  const kanjidicEntries = parseKanjidic(kanjidicXml);
  const pitchRows = parseKanjium(kanjiumText);

  // Override KANJIDIC2's stale jlpt field with the current N1-N5 mapping.
  for (const k of kanjidicEntries) {
    k.jlpt = jlptLevels.get(k.kanji) ?? null;
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS jmdict_entries (seq INTEGER PRIMARY KEY, entry_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jmdict_index (headword TEXT NOT NULL, seq INTEGER NOT NULL, is_reading INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS kanjidic (kanji TEXT PRIMARY KEY, entry_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pitch_accent (surface TEXT NOT NULL, reading TEXT NOT NULL, pitch_json TEXT NOT NULL, PRIMARY KEY (surface, reading));
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  console.log("writing to SQLite...");
  db.exec("DELETE FROM jmdict_entries; DELETE FROM jmdict_index; DELETE FROM kanjidic; DELETE FROM pitch_accent;");

  const insEntry = db.prepare("INSERT INTO jmdict_entries (seq, entry_json) VALUES (?, ?)");
  const insIndex = db.prepare("INSERT INTO jmdict_index (headword, seq, is_reading) VALUES (?, ?, ?)");
  const txEntries = db.transaction((entries) => {
    for (const e of entries) {
      insEntry.run(e.seq, JSON.stringify(e));
      for (const k of e.kanji) insIndex.run(k, e.seq, 0);
      for (const r of e.readings) insIndex.run(r, e.seq, 1);
    }
  });
  txEntries(jmdictEntries);
  db.exec("CREATE INDEX IF NOT EXISTS idx_jmdict_index_headword ON jmdict_index(headword);");

  const insKanji = db.prepare("INSERT INTO kanjidic (kanji, entry_json) VALUES (?, ?)");
  const txKanji = db.transaction((rows) => {
    for (const k of rows) insKanji.run(k.kanji, JSON.stringify(k));
  });
  txKanji(kanjidicEntries);

  const insPitch = db.prepare(
    "INSERT INTO pitch_accent (surface, reading, pitch_json) VALUES (?, ?, ?) ON CONFLICT(surface, reading) DO UPDATE SET pitch_json = excluded.pitch_json"
  );
  const txPitch = db.transaction((rows) => {
    for (const r of rows) insPitch.run(r.surface, r.reading, JSON.stringify(r.pitches));
  });
  txPitch(pitchRows);
  db.exec("CREATE INDEX IF NOT EXISTS idx_pitch_reading ON pitch_accent(reading);");

  db.prepare("INSERT INTO meta (key, value) VALUES ('dict_built_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    new Date().toISOString()
  );

  db.close();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
