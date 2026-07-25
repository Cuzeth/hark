/**
 * The inline formatting understood inside docs content strings.
 *
 * Deliberately tiny: `` `code` `` and `[text](href)` cover every inline in the
 * docs today. Content is authored as markdown so `/docs.md` can emit the source
 * verbatim, and this parser is what turns the same source into React nodes.
 */
export type DocInline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

/** `` `code` `` or `[text](href)`, whichever comes first. */
const INLINE_PATTERN = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(source: string): DocInline[] {
  const nodes: DocInline[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    if (start > cursor) nodes.push({ kind: "text", text: source.slice(cursor, start) });

    const [, code, linkText, href] = match;
    if (code !== undefined) {
      nodes.push({ kind: "code", text: code });
    } else if (linkText !== undefined && href !== undefined) {
      nodes.push({ kind: "link", text: linkText, href });
    }
    cursor = start + match[0].length;
  }

  if (cursor < source.length) nodes.push({ kind: "text", text: source.slice(cursor) });
  return nodes;
}
