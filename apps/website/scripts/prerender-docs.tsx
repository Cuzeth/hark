/**
 * Prerenders `/docs` into static HTML after `vite build`.
 *
 * `/docs` is the one route agents, crawlers, and `curl` are expected to read, so
 * its content has to exist in the initial response. Rendering the real React
 * tree with `react-dom/server` — rather than hand-writing a second HTML
 * template — means the static page and the interactive page are the same
 * components over the same content model, and cannot drift.
 *
 * Output: `dist/client/docs/index.html`, served by `src/server/index.ts` for
 * `GET /docs`. The client bundle still loads and hydrates it, so the sidebar
 * scrollspy and copy buttons work exactly as before.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { Docs } from "../src/client/pages/Docs";
import { DOCS_MARKDOWN_URL, DOCS_TITLE } from "../src/shared/docs/content";

const clientDir = resolve(import.meta.dirname, "../dist/client");
const shellPath = resolve(clientDir, "index.html");
const outputDir = resolve(clientDir, "docs");

const title = `Hark docs — ${DOCS_TITLE}`;
const description =
  "Hark API documentation: send an HTTP POST to a webhook URL and get a source-branded iPhone notification, approval prompt, or Live Activity.";

const markup = renderToString(
  <StrictMode>
    <StaticRouter location="/docs">
      <Docs />
    </StaticRouter>
  </StrictMode>,
);

const shell = await readFile(shellPath, "utf8");
if (!shell.includes('<div id="root"></div>')) {
  throw new Error("Cannot prerender /docs: dist/client/index.html has no empty #root div");
}

const html = shell
  .replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${description}" />`,
  )
  // Points agents at the markdown twin of this page.
  .replace(
    "</head>",
    `  <link rel="alternate" type="text/markdown" href="${DOCS_MARKDOWN_URL}" />\n  </head>`,
  );

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "index.html"), html);

console.log(`prerendered /docs → dist/client/docs/index.html (${html.length} bytes)`);
