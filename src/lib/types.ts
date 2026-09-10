export interface JMdictSense {
  pos: string[];
  glosses: string[];
}

export interface JMdictEntry {
  seq: number;
  kanji: string[];
  readings: string[];
  senses: JMdictSense[];
  /** True when JMdict tags this entry as genuinely common (news1/ichi1/spec1/spec2/gai1). */
  isCommon: boolean;
}

export interface KanjiInfo {
  kanji: string;
  grade: number | null;
  strokes: number | null;
  jlpt: number | null;
  freq: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
}

/** High/low per mora for one accepted pitch pattern. */
export interface PitchPattern {
  accent: number;
  moras: string[];
  pitches: ("H" | "L")[];
}

export interface WordLookupResult {
  surface: string;
  reading: string;
  /** How the surface was matched to this entry: null = exact, else deinflection label. */
  via: string | null;
  /** The word actually found in the dictionary (may differ from `surface` if deinflected). */
  dictionaryForm: string;
  entries: JMdictEntry[];
  kanji: KanjiInfo[];
  pitch: PitchPattern[];
}

/** One clickable unit in the reader, pre-computed at scrape time. */
export interface Token {
  surface: string;
  reading: string | null;
  /** True when this token contains at least one CJK ideograph. */
  hasKanji: boolean;
  /** True when a furigana reading should be rendered above it. */
  showRuby: boolean;
  /** JLPT level (1 = hardest .. 5 = easiest) of the hardest kanji in the token, if known. */
  jlptLevel: 1 | 2 | 3 | 4 | 5 | null;
}

export interface ArticleParagraph {
  tokens: Token[];
}

export interface ArticleRecord {
  id: string;
  titleHtml: string;
  titleText: string;
  bodyHtml: string;
  paragraphs: ArticleParagraph[];
  imageUrl: string | null;
  audioUrl: string | null;
  sourceUrl: string;
  publishedAt: string;
}
