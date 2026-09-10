/**
 * Parses NHK Easy's own <ruby>base<rt>reading</rt></ruby> markup into a flat
 * character stream, keeping track of which characters came with an
 * NHK-supplied reading. This is the ground truth for furigana display and
 * for assigning exact readings to dictionary lookups (NHK already picked
 * the correct reading for context, so we should never guess a different one
 * for kanji it covered).
 */

export interface RubyChar {
  /** A single character (surface). */
  ch: string;
  /** Reading assigned to the *group* this character belongs to, if it was inside a <ruby> tag. */
  groupReading: string | null;
  /** Index shared by all characters that came from the same <ruby> tag (for re-grouping). */
  groupId: number | null;
}

/**
 * Turn one paragraph of NHK ruby-HTML into a flat array of RubyChar.
 * Only handles the tags NHK Easy actually emits: <ruby>, <rt>, <p>, <br>, plain text.
 */
export function parseRubyHtml(html: string): RubyChar[] {
  const out: RubyChar[] = [];
  let groupCounter = 0;
  let i = 0;
  const n = html.length;

  while (i < n) {
    if (html.startsWith("<ruby>", i)) {
      const rtOpen = html.indexOf("<rt>", i);
      const rtClose = html.indexOf("</rt>", rtOpen);
      const rubyClose = html.indexOf("</ruby>", rtClose);
      if (rtOpen === -1 || rtClose === -1 || rubyClose === -1) {
        // Malformed — bail out of ruby handling for this tag, treat literally.
        out.push({ ch: html[i], groupReading: null, groupId: null });
        i += 1;
        continue;
      }
      const base = html.slice(i + "<ruby>".length, rtOpen);
      const reading = html.slice(rtOpen + "<rt>".length, rtClose);
      const gid = groupCounter++;
      for (const ch of base) {
        out.push({ ch, groupReading: reading, groupId: gid });
      }
      i = rubyClose + "</ruby>".length;
      continue;
    }
    if (html.startsWith("<br>", i) || html.startsWith("<br/>", i) || html.startsWith("<br />", i)) {
      out.push({ ch: "\n", groupReading: null, groupId: null });
      i = html.indexOf(">", i) + 1;
      continue;
    }
    if (html[i] === "<") {
      // Skip any other tag entirely (NHK Easy paragraphs don't nest anything else of note).
      const close = html.indexOf(">", i);
      i = close === -1 ? n : close + 1;
      continue;
    }
    out.push({ ch: html[i], groupReading: null, groupId: null });
    i += 1;
  }
  return out;
}

/** Plain surface text (no readings), used for dictionary indexing/tokenizing. */
export function surfaceOf(chars: RubyChar[]): string {
  return chars.map((c) => c.ch).join("");
}

const HIRAGANA_RE = /^[぀-ゟ]+$/;
const KATAKANA_RE = /^[゠-ヿ]+$/;

/** Convert katakana to hiragana (for reading comparisons). */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * Compute the exact reading (in hiragana) for a run of RubyChar (a token span),
 * using NHK's own ruby readings for grouped characters and the literal kana
 * for ungrouped hiragana/katakana characters. Returns null if the span
 * contains a kanji character with no ruby reading (shouldn't normally happen
 * in NHK Easy text, but guards against malformed input).
 */
export function readingOf(chars: RubyChar[]): string | null {
  let reading = "";
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c.groupId !== null) {
      // Consume the whole group at once (avoid repeating the reading per character).
      const gid = c.groupId;
      reading += c.groupReading ?? "";
      while (i < chars.length && chars[i].groupId === gid) i++;
      continue;
    }
    if (HIRAGANA_RE.test(c.ch) || KATAKANA_RE.test(c.ch)) {
      reading += kataToHira(c.ch);
      i++;
      continue;
    }
    if (/[一-龯]/.test(c.ch)) {
      // Kanji with no ruby reading — can't determine reading reliably.
      return null;
    }
    // Punctuation/numbers/latin: passthrough, doesn't affect the phonetic reading.
    i++;
  }
  return reading;
}
