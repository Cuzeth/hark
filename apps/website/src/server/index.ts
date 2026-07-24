import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app";
import { runMigrations } from "./db/migrate";
import { assertRuntimeEnv, env } from "./env";
import { pruneAnalytics } from "./lib/analytics";

assertRuntimeEnv();
runMigrations();
// Bounds the analytics log at startup; long-running processes prune opportunistically.
pruneAnalytics();

// In production the same process serves the built SPA with a history fallback.
const clientDir = resolve(process.cwd(), "dist/client");
if (existsSync(clientDir)) {
  app.use("*", serveStatic({ root: "./dist/client" }));
  app.get("*", serveStatic({ path: "./dist/client/index.html" }));
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Hark API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
  if (!existsSync(clientDir)) {
    console.log("No dist/client build found — expecting the Vite dev server to proxy /api.");
  }
});
