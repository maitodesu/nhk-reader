import type Database from "better-sqlite3";
import { deinflect } from "./deinflect";
import { headwordExists } from "./dictionary";
import { kataToHira, type RubyChar } from "./furigana";
import type { Token } from "./types";

const MAX_OKURIGANA_LOOKAHEAD = 10;
const MAX_KANA_WORD = 10;

function isHiragana(ch: string) {
  return /^[぀-ゟー]$/.test(ch);
}
function isKatakana(ch: string) {
  return /^[゠-ヿー]$/.test(ch);
}
function isKana(ch: string) {
  return isHiragana(ch) || isKatakana(ch);
}

/** True if `text`, or any deinflection of it, is a known dictionary headword. */
function isResolvable(db: Database.Database, text: string): boolean {
  if (headwordExists(db, text)) return true;
  return deinflect(text).some((d) => headwordExists(db, d.form));
}

// Deinflecting an arbitrary kana substring is only safe when it's anchored to
// a real kanji (the ruby-lookahead case): the stem always contains the actual
// word. Applied to a *pure*-kana run instead, a short stem + common ending
// (e.g. に + って → になう, coincidentally someone else's word) can produce a
// confident-looking false match. So for pure-kana runs, only trust
// deinflection for this closed set of everyday kana-written verbs/adjectives
// — direct (non-deinflected) headword matches are still unrestricted.
const COMMON_KANA_VERBS = new Set([
  "する", "くる", "ある", "いる", "なる", "ない", "いい", "よい",
  "くれる", "あげる", "もらう", "しまう", "おく", "いく", "みる",
  "くださる", "いらっしゃる", "おっしゃる", "なさる",
]);

function isResolvableKanaOnly(db: Database.Database, text: string): boolean {
  if (headwordExists(db, text)) return true;
  return deinflect(text).some((d) => COMMON_KANA_VERBS.has(d.form) && headwordExists(db, d.form));
}

const jlptCache = new Map<string, number | null>();

/** JLPT level (1=hardest..5=easiest) of the hardest kanji in `text`, or null if none are classified. */
function jlptLevelOf(db: Database.Database, text: string): 1 | 2 | 3 | 4 | 5 | null {
  let hardest: number | null = null;
  for (const ch of text) {
    if (!/[一-龯々]/.test(ch)) continue;
    let level = jlptCache.get(ch);
    if (level === undefined) {
      const row = db.prepare("SELECT entry_json FROM kanjidic WHERE kanji = ?").get(ch) as
        | { entry_json: string }
        | undefined;
      level = row ? ((JSON.parse(row.entry_json).jlpt as number | null) ?? null) : null;
      jlptCache.set(ch, level);
    }
    if (level !== null && (hardest === null || level < hardest)) hardest = level;
  }
  return hardest as 1 | 2 | 3 | 4 | 5 | null;
}

/**
 * Turn one paragraph's flat ruby-char stream into clickable tokens.
 *
 * Strategy: NHK's own <ruby> groups already mark kanji-compound boundaries
 * with an exact reading, so each ruby group anchors one token. We then look
 * ahead into the plain hiragana that follows (okurigana / conjugation
 * endings) and greedily extend the token as far as it still forms a real
 * dictionary word (checked directly or via deinflection), e.g. 降+りそう →
 * keep only 降り (part of 降る) and let そう start its own token. Runs of
 * hiragana/katakana that aren't attached to a kanji token (particles,
 * standalone kana words, auxiliaries) are tokenized the same way, greedily
 * matching the longest known dictionary form. Everything else (punctuation,
 * digits, latin) is passed through as plain, non-lookup text.
 */
export function tokenizeParagraph(db: Database.Database, chars: RubyChar[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = chars.length;

  while (i < n) {
    const c = chars[i];

    if (c.groupId !== null) {
      const gid = c.groupId;
      let gEnd = i;
      while (gEnd < n && chars[gEnd].groupId === gid) gEnd++;
      const base = chars
        .slice(i, gEnd)
        .map((x) => x.ch)
        .join("");
      const reading = c.groupReading ?? "";

      // Look ahead into the following plain hiragana/katakana run.
      let runEnd = gEnd;
      while (runEnd < n && chars[runEnd].groupId === null && isKana(chars[runEnd].ch) && runEnd - gEnd < MAX_OKURIGANA_LOOKAHEAD) {
        runEnd++;
      }
      const lookahead = chars
        .slice(gEnd, runEnd)
        .map((x) => x.ch)
        .join("");

      let bestP = 0;
      for (let p = lookahead.length; p >= 1; p--) {
        const candidate = base + lookahead.slice(0, p);
        if (isResolvable(db, candidate)) {
          bestP = p;
          break;
        }
      }

      const extra = lookahead.slice(0, bestP);
      const surface = base + extra;
      tokens.push({
        surface,
        reading: reading + kataToHira(extra),
        hasKanji: true,
        showRuby: true,
        jlptLevel: jlptLevelOf(db, surface),
      });
      i = gEnd + bestP;
      continue;
    }

    if (c.ch === "\n") {
      tokens.push({ surface: "\n", reading: null, hasKanji: false, showRuby: false, jlptLevel: null });
      i++;
      continue;
    }

    if (isKana(c.ch)) {
      let runEnd = i;
      while (runEnd < n && chars[runEnd].groupId === null && isKana(chars[runEnd].ch)) runEnd++;
      const run = chars
        .slice(i, runEnd)
        .map((x) => x.ch)
        .join("");

      let pos = 0;
      while (pos < run.length) {
        let bestLen = 1;
        const maxLen = Math.min(MAX_KANA_WORD, run.length - pos);
        for (let len = maxLen; len >= 1; len--) {
          const candidate = run.slice(pos, pos + len);
          if (isResolvableKanaOnly(db, candidate)) {
            bestLen = len;
            break;
          }
        }
        const surface = run.slice(pos, pos + bestLen);
        tokens.push({ surface, reading: kataToHira(surface), hasKanji: false, showRuby: false, jlptLevel: null });
        pos += bestLen;
      }
      i = runEnd;
      continue;
    }

    // Punctuation, digits, latin, symbols — group into one plain run.
    let runEnd = i;
    while (runEnd < n && chars[runEnd].groupId === null && chars[runEnd].ch !== "\n" && !isKana(chars[runEnd].ch)) {
      runEnd++;
    }
    const run = chars
      .slice(i, runEnd)
      .map((x) => x.ch)
      .join("");
    tokens.push({ surface: run, reading: null, hasKanji: false, showRuby: false, jlptLevel: null });
    i = runEnd;
  }

  return tokens;
}
