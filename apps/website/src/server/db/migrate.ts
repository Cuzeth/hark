import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

/**
 * Runs generated Drizzle migrations. The migrations folder is resolved from the
 * process working directory, which is apps/website in dev and /app in Docker.
 */
export function runMigrations(): void {
  const migrationsFolder = resolve(process.cwd(), "drizzle");
  if (!existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found at ${migrationsFolder}`);
  }
  migrate(db, { migrationsFolder });
}
