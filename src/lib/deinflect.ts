/**
 * Minimal, single-pass Japanese deinflection. Not a full conjugation engine
 * (no MeCab/Unidic dependency) — covers the endings that actually show up in
 * NHK Easy prose: polite forms, plain past/negative/te-form, i-adjective
 * conjugations, and copula/na-adjective forms. Ambiguous godan reconstructions
 * (e.g. -ます stem could belong to more than one row) are all offered as
 * candidates; the caller picks whichever one is an actual dictionary entry.
 */

export interface Deinflection {
  /** Candidate dictionary-form string to test against the index. */
  form: string;
  /** Human-readable label for the popup, e.g. "ます-form". */
  via: string;
}

// U-row / dictionary-ending kana for each godan consonant row, keyed by the
// い-row (masu-stem) and あ-row (nai-stem) kana that appear right before the
// stripped suffix.
const I_TO_U: Record<string, string> = {
  い: "う", き: "く", ぎ: "ぐ", し: "す", ち: "つ", に: "ぬ", び: "ぶ", み: "む", り: "る",
};
const A_TO_U: Record<string, string> = {
  わ: "う", か: "く", が: "ぐ", さ: "す", た: "つ", な: "ぬ", ば: "ぶ", ま: "む", ら: "る",
};

function godanFromRowMap(stem: string, map: Record<string, string>): string | null {
  if (!stem) return null;
  const last = stem[stem.length - 1];
  const u = map[last];
  if (!u) return null;
  return stem.slice(0, -1) + u;
}

/** Reconstruct candidate dictionary forms from a -masu stem (e.g. 読み → 読む / 読みる). */
function fromMasuStem(stem: string, via: string): Deinflection[] {
  const out: Deinflection[] = [];
  const godan = godanFromRowMap(stem, I_TO_U);
  if (godan) out.push({ form: godan, via });
  out.push({ form: stem + "る", via }); // ichidan guess
  return out;
}

/** Reconstruct candidate dictionary forms from a -nai stem (e.g. 読ま → 読む / 読まる). */
function fromNaiStem(stem: string, via: string): Deinflection[] {
  const out: Deinflection[] = [];
  const godan = godanFromRowMap(stem, A_TO_U);
  if (godan) out.push({ form: godan, via });
  out.push({ form: stem + "る", via }); // ichidan guess
  return out;
}

// Suffix rules tried longest-first. Each returns candidate reconstructions
// given the stem left after stripping the suffix.
type Rule = { suffix: string; via: string; expand: (stem: string) => Deinflection[] };

const RULES: Rule[] = [
  // --- irregular verbs (checked before the generic onbin rules) ---
  { suffix: "しました", via: "past (irregular する)", expand: (s) => [{ form: s + "する", via: "past" }] },
  { suffix: "しません", via: "negative (irregular する)", expand: (s) => [{ form: s + "する", via: "negative" }] },
  { suffix: "して", via: "te-form (irregular する)", expand: (s) => [{ form: s + "する", via: "te-form" }] },
  { suffix: "した", via: "past (irregular する)", expand: (s) => [{ form: s + "する", via: "past" }] },
  { suffix: "しない", via: "negative (irregular する)", expand: (s) => [{ form: s + "する", via: "negative" }] },
  { suffix: "きました", via: "past (irregular 来る)", expand: (s) => [{ form: s + "来る", via: "past" }, { form: s + "くる", via: "past" }] },
  { suffix: "きて", via: "te-form (irregular 来る)", expand: (s) => [{ form: s + "来る", via: "te-form" }, { form: s + "くる", via: "te-form" }] },
  { suffix: "きた", via: "past (irregular 来る)", expand: (s) => [{ form: s + "来る", via: "past" }, { form: s + "くる", via: "past" }] },
  { suffix: "行って", via: "te-form (行く exception)", expand: (s) => [{ form: s + "行く", via: "te-form" }] },
  { suffix: "行った", via: "past (行く exception)", expand: (s) => [{ form: s + "行く", via: "past" }] },

  // --- polite forms (ます stem) ---
  { suffix: "ましょう", via: "volitional (ます)", expand: (s) => fromMasuStem(s, "volitional") },
  { suffix: "ませんでした", via: "past negative (ます)", expand: (s) => fromMasuStem(s, "past negative") },
  { suffix: "ました", via: "past (ます)", expand: (s) => fromMasuStem(s, "past") },
  { suffix: "ません", via: "negative (ます)", expand: (s) => fromMasuStem(s, "negative") },
  { suffix: "ます", via: "polite", expand: (s) => fromMasuStem(s, "polite") },

  // --- たい (want to) ---
  { suffix: "たくなかった", via: "past negative desire (たい)", expand: (s) => fromMasuStem(s, "desire") },
  { suffix: "たくない", via: "negative desire (たい)", expand: (s) => fromMasuStem(s, "desire") },
  { suffix: "たかった", via: "past desire (たい)", expand: (s) => fromMasuStem(s, "desire") },
  { suffix: "たい", via: "desire", expand: (s) => fromMasuStem(s, "desire") },

  // --- negative (nai stem) ---
  { suffix: "なくなかった", via: "double negative", expand: (s) => fromNaiStem(s, "negative") },
  { suffix: "なかった", via: "past negative", expand: (s) => fromNaiStem(s, "past negative") },
  { suffix: "くなくて", via: "negative te-form", expand: (s) => fromNaiStem(s, "negative") },
  { suffix: "ないで", via: "negative te-form", expand: (s) => fromNaiStem(s, "negative") },
  { suffix: "ない", via: "negative", expand: (s) => fromNaiStem(s, "negative") },

  // --- te/ta form onbin (godan sound changes) ---
  { suffix: "って", via: "te-form (う/つ/る)", expand: (s) => ["う", "つ", "る"].map((e) => ({ form: s + e, via: "te-form" })) },
  { suffix: "った", via: "past (う/つ/る)", expand: (s) => ["う", "つ", "る"].map((e) => ({ form: s + e, via: "past" })) },
  { suffix: "んで", via: "te-form (む/ぶ/ぬ)", expand: (s) => ["む", "ぶ", "ぬ"].map((e) => ({ form: s + e, via: "te-form" })) },
  { suffix: "んだ", via: "past (む/ぶ/ぬ)", expand: (s) => ["む", "ぶ", "ぬ"].map((e) => ({ form: s + e, via: "past" })) },
  { suffix: "いで", via: "te-form (ぐ)", expand: (s) => [{ form: s + "ぐ", via: "te-form" }] },
  { suffix: "いだ", via: "past (ぐ)", expand: (s) => [{ form: s + "ぐ", via: "past" }] },
  { suffix: "いて", via: "te-form (く)", expand: (s) => [{ form: s + "く", via: "te-form" }] },
  { suffix: "いた", via: "past (く)", expand: (s) => [{ form: s + "く", via: "past" }] },
  { suffix: "して", via: "te-form (す)", expand: (s) => [{ form: s + "す", via: "te-form" }] },
  { suffix: "した", via: "past (す)", expand: (s) => [{ form: s + "す", via: "past" }] },
  // single-mora te/ta — ichidan (食べる → 食べて/食べた)
  { suffix: "て", via: "te-form (ichidan)", expand: (s) => [{ form: s + "る", via: "te-form" }] },
  { suffix: "た", via: "past (ichidan)", expand: (s) => [{ form: s + "る", via: "past" }] },

  // --- i-adjective ---
  { suffix: "くなかった", via: "past negative (i-adj)", expand: (s) => [{ form: s + "い", via: "negative" }] },
  { suffix: "くない", via: "negative (i-adj)", expand: (s) => [{ form: s + "い", via: "negative" }] },
  { suffix: "かった", via: "past (i-adj)", expand: (s) => [{ form: s + "い", via: "past" }] },
  { suffix: "くて", via: "te-form (i-adj)", expand: (s) => [{ form: s + "い", via: "te-form" }] },
  { suffix: "さ", via: "nominalized (i-adj)", expand: (s) => [{ form: s + "い", via: "nominalization" }] },

  // --- copula / na-adjective / noun predicate ---
  { suffix: "ではありませんでした", via: "past negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "じゃありませんでした", via: "past negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "ではありません", via: "negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "じゃありません", via: "negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "ではなかった", via: "past negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "じゃなかった", via: "past negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "ではない", via: "negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "じゃない", via: "negative copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "でした", via: "past copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "だった", via: "past copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "です", via: "copula", expand: (s) => [{ form: s, via: "copula" }] },
  { suffix: "だ", via: "copula", expand: (s) => [{ form: s, via: "copula" }] },
];

// Longest suffix first, so "ました" is tried before "た".
RULES.sort((a, b) => b.suffix.length - a.suffix.length);

/**
 * Return candidate dictionary-form reconstructions for `word`, longest
 * matching suffix first. Does not touch the database — the caller checks
 * each candidate against the dictionary index and keeps the first hit.
 */
export function deinflect(word: string): Deinflection[] {
  const out: Deinflection[] = [];
  for (const rule of RULES) {
    if (word.length <= rule.suffix.length) continue;
    if (!word.endsWith(rule.suffix)) continue;
    const stem = word.slice(0, -rule.suffix.length);
    out.push(...rule.expand(stem));
  }
  return out;
}
