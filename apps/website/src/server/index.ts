import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app";
import { auth } from "./auth";
import { db, sqlite } from "./db";
import { runMigrations } from "./db/migrate";
import { user as userTable } from "./db/schema";
import { assertRuntimeEnv, env } from "./env";
import { pruneAnalytics } from "./lib/analytics";
import { startInteractionCallbackWorker } from "./lib/interaction-callbacks";

assertRuntimeEnv();
runMigrations();
await seedAdminAccount();
// Bounds the analytics log at startup; long-running processes prune opportunistically.
pruneAnalytics();
startInteractionCallbackWorker();

/**
 * Creates the single account this instance serves. Runs only while the user
 * table is empty, so restarts never touch an existing account and the
 * sign-up guard in auth.ts keeps refusing every other creation path.
 */
async function seedAdminAccount(): Promise<void> {
  const [existing] = await db.select({ id: userTable.id }).from(userTable).limit(1);
  if (existing) return;
  if (!env.ADMIN_PASSWORD) {
    console.warn(
      "[auth] No account exists and ADMIN_PASSWORD is unset — nobody can sign in. Set ADMIN_PASSWORD (at least 8 characters) and restart.",
    );
    return;
  }
  try {
    await auth.api.signUpEmail({
      body: {
        email: env.ADMIN_EMAIL ?? `${env.ADMIN_USERNAME}@hark.local`,
        password: env.ADMIN_PASSWORD,
        name: env.ADMIN_USERNAME,
        username: env.ADMIN_USERNAME,
      },
    });
    console.log(`[auth] Created the admin account "${env.ADMIN_USERNAME}".`);
  } catch (error) {
    console.error("[auth] Could not create the admin account", error);
  }
}

// In production the same process serves prerendered public pages and explicit
// noindex shells for private application routes. Unknown paths remain real 404s
// instead of becoming indexable soft-404 copies of the home page.
const clientDir = resolve(process.cwd(), "dist/client");
if (existsSync(clientDir)) {
  const documentRoutes = ["/", "/docs", "/dashboard"];
  for (const path of documentRoutes) {
    const file = path === "/" ? "index.html" : `${path.slice(1)}/index.html`;
    if (existsSync(resolve(clientDir, file))) {
      app.get(path, serveStatic({ path: `./dist/client/${file}` }));
    }
  }
  if (existsSync(resolve(clientDir, "cli/authorize/index.html"))) {
    app.get("/cli/authorize", serveStatic({ path: "./dist/client/cli/authorize/index.html" }));
  }
  app.use("*", serveStatic({ root: "./dist/client" }));
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Hark API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
  if (!existsSync(clientDir)) {
    console.log("No dist/client build found — expecting the Vite dev server to proxy /api.");
  }
});

/**
 * WAL data only lands in the main database file on a clean close. Without this,
 * `hark.sqlite` stays stale and any file-level backup of it is effectively empty.
 */
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, checkpointing SQLite and shutting down.`);
  server.close(() => {
    try {
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
      sqlite.close();
    } catch (error) {
      console.error("Failed to checkpoint SQLite on shutdown", error);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
