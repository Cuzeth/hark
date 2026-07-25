import { type TokenKind, tokenize } from "../lib/highlight";

/**
 * The code surface is dark in both themes, so a single set of syntax colours
 * works everywhere and none of these need a `dark:` counterpart.
 */
const KIND_CLASS: Record<Exclude<TokenKind, "plain">, string> = {
  key: "text-code-key",
  string: "text-code-string",
  number: "text-code-number",
  literal: "text-code-literal",
  punct: "text-code-punct",
  comment: "text-code-comment",
  flag: "text-code-flag",
  command: "text-code-command",
  url: "text-code-url",
};

export function CodeBlock({ code, language }: { code: string; language: "json" | "bash" }) {
  const nodes: React.ReactNode[] = [];
  // Byte offset doubles as a stable, unique key without keying on array index.
  let offset = 0;

  for (const token of tokenize(code, language)) {
    if (token.kind === "plain") {
      nodes.push(token.text);
    } else {
      nodes.push(
        <span key={offset} className={KIND_CLASS[token.kind]}>
          {token.text}
        </span>,
      );
    }
    offset += token.text.length;
  }

  return (
    <pre className="bg-code text-code-ink overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
      <code>{nodes}</code>
    </pre>
  );
}
