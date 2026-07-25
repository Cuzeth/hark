/**
 * A deliberately tiny syntax highlighter for the only two languages the site
 * shows: JSON payloads and shell (curl) snippets. A real grammar engine such as
 * Shiki or Prism would add far more weight than the whole site's CSS bundle to
 * colour about forty lines of static example code.
 *
 * Both tokenizers guarantee that concatenating every token's text reproduces the
 * input exactly, so rendering can never silently drop or reorder source.
 */

export type TokenKind =
  | "plain"
  | "key"
  | "string"
  | "number"
  | "literal"
  | "punct"
  | "comment"
  | "flag"
  | "command"
  | "url";

export interface Token {
  text: string;
  kind: TokenKind;
}

const JSON_PUNCT = new Set(["{", "}", "[", "]", ",", ":"]);
const NUMBER_RE = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const LITERAL_RE = /^(?:true|false|null)\b/;
const URL_RE = /^https?:\/\//;

/** Collects plain characters so runs of them emit as one token, not one each. */
function createSink() {
  const tokens: Token[] = [];
  let plain = "";
  return {
    tokens,
    /** Buffer a character with no syntactic meaning. */
    plain(text: string) {
      plain += text;
    },
    /** Emit a highlighted token, flushing any buffered plain text first. */
    push(text: string, kind: TokenKind) {
      if (plain) {
        tokens.push({ text: plain, kind: "plain" });
        plain = "";
      }
      if (text) tokens.push({ text, kind });
    },
    finish(): Token[] {
      if (plain) {
        tokens.push({ text: plain, kind: "plain" });
        plain = "";
      }
      return tokens;
    },
  };
}

/** Index just past the closing quote, or the end of input when unterminated. */
function endOfQuoted(source: string, start: number, escapes: boolean): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (escapes && source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  return source.length;
}

export function tokenizeJson(source: string): Token[] {
  const sink = createSink();
  let i = 0;

  while (i < source.length) {
    const char = source[i] as string;

    if (char === '"') {
      const end = endOfQuoted(source, i, true);
      // A string followed by a colon is an object key, so it gets its own colour.
      let after = end;
      while (after < source.length && /\s/.test(source[after] as string)) after += 1;
      sink.push(source.slice(i, end), source[after] === ":" ? "key" : "string");
      i = end;
      continue;
    }

    if (JSON_PUNCT.has(char)) {
      sink.push(char, "punct");
      i += 1;
      continue;
    }

    if (char === "-" || (char >= "0" && char <= "9")) {
      const match = NUMBER_RE.exec(source.slice(i));
      if (match) {
        sink.push(match[0], "number");
        i += match[0].length;
        continue;
      }
    }

    const literal = LITERAL_RE.exec(source.slice(i));
    if (literal) {
      sink.push(literal[0], "literal");
      i += literal[0].length;
      continue;
    }

    sink.plain(char);
    i += 1;
  }

  return sink.finish();
}

export function tokenizeShell(source: string): Token[] {
  const sink = createSink();
  let i = 0;
  // The first word of a line is the command, unless the previous line ended in
  // a `\` continuation, in which case the line is still arguments.
  let atCommandStart = true;

  while (i < source.length) {
    const char = source[i] as string;

    if (char === "#") {
      const newline = source.indexOf("\n", i);
      const end = newline === -1 ? source.length : newline;
      sink.push(source.slice(i, end), "comment");
      i = end;
      continue;
    }

    // A `\` at end of line continues the command; keep argument context.
    if (char === "\\" && source[i + 1] === "\n") {
      sink.push("\\", "punct");
      sink.plain("\n");
      i += 2;
      continue;
    }

    if (char === "\n") {
      sink.plain(char);
      atCommandStart = true;
      i += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      const end = endOfQuoted(source, i, char === '"');
      const closed = source[end - 1] === char && end - 1 > i;
      const inner = source.slice(i + 1, closed ? end - 1 : end);

      // curl bodies are JSON inside quotes; highlight them properly rather than
      // flattening a whole payload into one string colour.
      if (inner.trimStart().startsWith("{")) {
        sink.push(char, "punct");
        for (const token of tokenizeJson(inner)) sink.push(token.text, token.kind);
        if (closed) sink.push(char, "punct");
      } else {
        sink.push(source.slice(i, end), "string");
      }

      atCommandStart = false;
      i = end;
      continue;
    }

    if (/\s/.test(char)) {
      sink.plain(char);
      i += 1;
      continue;
    }

    let end = i;
    while (end < source.length && !/[\s'"]/.test(source[end] as string)) end += 1;
    const word = source.slice(i, end);

    if (word.startsWith("-")) sink.push(word, "flag");
    else if (URL_RE.test(word)) sink.push(word, "url");
    else if (atCommandStart) sink.push(word, "command");
    else sink.push(word, "plain");

    atCommandStart = false;
    i = end;
  }

  return sink.finish();
}

export function tokenize(source: string, language: "json" | "bash"): Token[] {
  return language === "json" ? tokenizeJson(source) : tokenizeShell(source);
}
