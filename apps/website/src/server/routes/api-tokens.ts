import { type ApiTokenDto, type ApiTokenScope, apiTokenCreateSchema } from "@hark/contracts";
import { and, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { apiToken } from "../db/schema";
import { track } from "../lib/analytics";
import { newId } from "../lib/id";
import {
  apiTokenPrefix,
  generateApiToken,
  hashApiToken,
  MAX_ACTIVE_API_TOKENS,
} from "../lib/token";
import { type AuthedEnv, requireAuth } from "../middleware";

function toDto(row: typeof apiToken.$inferSelect): ApiTokenDto {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes as ApiTokenScope[],
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export const apiTokensRoute = new Hono<AuthedEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const rows = await db
      .select()
      .from(apiToken)
      .where(eq(apiToken.userId, c.get("user").id))
      .orderBy(desc(apiToken.createdAt));
    return c.json({ tokens: rows.map(toDto) });
  })
  .post("/", async (c) => {
    const parsed = apiTokenCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Invalid API token", issues: parsed.error.issues }, 400);
    }
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      return c.json({ error: "Expiry must be in the future" }, 400);
    }

    const secret = generateApiToken();
    const now = new Date();
    const row = db.transaction((tx) => {
      const active = tx
        .select({ value: count() })
        .from(apiToken)
        .where(
          and(
            eq(apiToken.userId, c.get("user").id),
            isNull(apiToken.revokedAt),
            or(isNull(apiToken.expiresAt), gt(apiToken.expiresAt, now)),
          ),
        )
        .get();
      if ((active?.value ?? 0) >= MAX_ACTIVE_API_TOKENS) return null;
      return tx
        .insert(apiToken)
        .values({
          id: newId("tok"),
          userId: c.get("user").id,
          name: parsed.data.name,
          tokenHash: hashApiToken(secret),
          prefix: apiTokenPrefix(secret),
          scopes: [...new Set(parsed.data.scopes)].sort(),
          expiresAt,
          createdAt: now,
        })
        .returning()
        .get();
    });
    if (!row) {
      return c.json(
        { error: `This account is limited to ${MAX_ACTIVE_API_TOKENS} active API tokens.` },
        409,
      );
    }
    track({
      name: "api_token_created",
      userId: c.get("user").id,
      outcome: "dashboard",
      metadata: {
        scopeCount: (row.scopes as string[]).length,
        expires: row.expiresAt !== null,
      },
    });
    return c.json({ token: toDto(row), secret }, 201);
  })
  .delete("/:id", async (c) => {
    const rows = await db
      .update(apiToken)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiToken.id, c.req.param("id")),
          eq(apiToken.userId, c.get("user").id),
          isNull(apiToken.revokedAt),
        ),
      )
      .returning({ id: apiToken.id });
    if (rows.length === 0) return c.json({ error: "API token not found" }, 404);
    track({ name: "api_token_revoked", userId: c.get("user").id, outcome: "dashboard" });
    return c.json({ ok: true });
  });
