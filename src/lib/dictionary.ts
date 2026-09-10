import type Database from "better-sqlite3";
import { deinflect } from "./deinflect";
import { kataToHira } from "./furigana";
import type { JMdictEntry, KanjiInfo, PitchPattern, WordLookupResult } from "./types";

/** Does this exact string exist as a JMdict headword (kanji or reading form)? */
export function headwordExists(db: Database.Database, text: string): boolean {
  const row = db.prepare("SELECT 1 FROM jmdict_index WHERE headword = ? LIMIT 1").get(text);
  return !!row;
}

interface ResolvedHeadword {
  form: string;
  via: string | null;
  seqs: number[];
}

/**
 * Resolve `text` to a dictionary headword: try it verbatim first, then fall
 * back to deinflection candidates (longest matching suffix first).
 */
export function resolveHeadword(db: Database.Database, text: string): ResolvedHeadword | null {
  const direct = db.prepare("SELECT seq FROM jmdict_index WHERE headword = ?").all(text) as { seq: number }[];
  if (direct.length) return { form: text, via: null, seqs: direct.map((r) => r.seq) };

  for (const cand of deinflect(text)) {
    const rows = db.prepare("SELECT seq FROM jmdict_index WHERE headword = ?").all(cand.form) as { seq: number }[];
    if (rows.length) return { form: cand.form, via: cand.via, seqs: rows.map((r) => r.seq) };
  }
  return null;
}

function loadEntries(db: Database.Database, seqs: number[]): JMdictEntry[] {
  const uniq = Array.from(new Set(seqs));
  const placeholders = uniq.map(() => "?").join(",");
  if (!uniq.length) return [];
  const rows = db.prepare(`SELECT entry_json FROM jmdict_entries WHERE seq IN (${placeholders})`).all(...uniq) as {
    entry_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.entry_json) as JMdictEntry);
}

function loadKanjiInfo(db: Database.Database, text: string): KanjiInfo[] {
  const kanjiChars = Array.from(new Set(Array.from(text).filter((c) => /[一-龯々]/.test(c))));
  if (!kanjiChars.length) return [];
  const placeholders = kanjiChars.map(() => "?").join(",");
  const rows = db.prepare(`SELECT entry_json FROM kanjidic WHERE kanji IN (${placeholders})`).all(...kanjiChars) as {
    entry_json: string;
  }[];
  const byChar = new Map(rows.map((r) => [JSON.parse(r.entry_json).kanji as string, JSON.parse(r.entry_json) as KanjiInfo]));
  // Preserve the order the kanji appear in the word.
  return kanjiChars
    .sort((a, b) => text.indexOf(a) - text.indexOf(b))
    .map((c) => byChar.get(c))
    .filter((k): k is KanjiInfo => !!k);
}

const SMALL_COMBINING = new Set(["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ"]);

/** Split a hiragana reading into morae (small ゃゅょ etc. attach to the preceding kana). */
export function splitMora(reading: string): string[] {
  const chars = Array.from(kataToHira(reading));
  const moras: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (i > 0 && SMALL_COMBINING.has(c) && moras.length) {
      moras[moras.length - 1] += c;
    } else {
      moras.push(c);
    }
  }
  return moras;
}

function computePitchForAccent(moras: string[], accent: number): ("H" | "L")[] {
  return moras.map((_, idx) => {
    const j = idx + 1;
    if (accent === 0) return j === 1 ? "L" : "H";
    if (j === 1) return accent === 1 ? "H" : "L";
    return j <= accent ? "H" : "L";
  });
}

function loadPitch(db: Database.Database, surface: string, reading: string): PitchPattern[] {
  const hiraReading = kataToHira(reading);
  let row = db
    .prepare("SELECT pitch_json FROM pitch_accent WHERE surface = ? AND reading = ?")
    .get(surface, hiraReading) as { pitch_json: string } | undefined;
  if (!row) {
    // Fall back to any surface with the same reading (common for kana-only lookups).
    row = db.prepare("SELECT pitch_json FROM pitch_accent WHERE reading = ? LIMIT 1").get(hiraReading) as
      | { pitch_json: string }
      | undefined;
  }
  if (!row) return [];
  const accents = JSON.parse(row.pitch_json) as number[];
  const moras = splitMora(hiraReading);
  return accents.map((accent) => ({ accent, moras, pitches: computePitchForAccent(moras, accent) }));
}

// A handful of everyday kana-only verbs have several *equally* "common"-tagged
// JMdict homographs (居る/射る/煎る/要る/入る all read いる), so the isCommon
// tiebreak below can't separate them. True sense disambiguation needs sentence
// context (part-of-speech / grammar) that this lookup doesn't have — but for
// this short list one sense so dominates ordinary text that defaulting to it
// is far more useful than an arbitrary pick. Left deliberately small: only
// added where the alternatives are genuinely rare in practice.
const KANA_SENSE_PREFERENCE: Record<string, string> = {
  いる: "居る",
  いく: "行く",
  できる: "出来る",
};

/**
 * Full pop-up lookup for a clicked token: dictionary sense(s) filtered to the
 * given reading where possible, kanji-by-kanji breakdown, and pitch accent.
 */
export function lookupWord(db: Database.Database, surface: string, reading: string | null): WordLookupResult {
  const resolved = resolveHeadword(db, surface);
  const dictionaryForm = resolved?.form ?? surface;
  let entries = resolved ? loadEntries(db, resolved.seqs) : [];

  const hiraReading = reading ? kataToHira(reading) : null;
  if (hiraReading && !resolved?.via && entries.length > 1) {
    // Only filter by the literal on-page reading when it's the word as written
    // (no deinflection) — a conjugated surface reading (e.g. うごかない) won't
    // match the dictionary-form reading (うごく) and would wrongly zero out entries.
    const filtered = entries.filter((e) => e.readings.some((r) => kataToHira(r) === hiraReading));
    if (filtered.length) entries = filtered;
  }
  if (entries.length > 1) {
    // Same reading can still map to unrelated homographs with no kanji in the text
    // to disambiguate (e.g. いる: 居る "to be" vs 射る "to shoot") — put JMdict's
    // own "genuinely common" entries first so the primary meaning shown is the
    // one a reader is actually seeing, not whichever happened to load first.
    const preferred = KANA_SENSE_PREFERENCE[dictionaryForm];
    entries = [...entries].sort((a, b) => {
      if (preferred) {
        const aPref = Number(a.kanji.includes(preferred));
        const bPref = Number(b.kanji.includes(preferred));
        if (aPref !== bPref) return bPref - aPref;
      }
      return Number(b.isCommon) - Number(a.isCommon);
    });
  }

  // Pitch accent is a property of the dictionary form's own reading, not of
  // whatever inflected reading appeared on the page.
  const pitchReading = resolved?.via ? kataToHira(entries[0]?.readings[0] ?? "") || null : hiraReading;

  const kanji = loadKanjiInfo(db, surface);
  const pitch = pitchReading ? loadPitch(db, dictionaryForm, pitchReading) : [];

  return {
    surface,
    reading: hiraReading ?? entries[0]?.readings[0] ?? "",
    via: resolved?.via ?? null,
    dictionaryForm,
    entries,
    kanji,
    pitch,
  };
}
