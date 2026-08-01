import { createHash } from "node:crypto";
import { open, readFile, rename, rm, writeFile } from "node:fs/promises";
import process from "node:process";
import Database from "better-sqlite3";
import { Expo } from "expo-server-sdk";

const CAMPAIGN_ID = "app-store-launch-2026-08-01-v1";
const TITLE = "Hark is live on the App Store";
const BODY =
  "Update to the App Store version to keep receiving future Hark updates and fixes. Tap to update or get help.";
const IMAGE_URL = "https://pbs.twimg.com/profile_images/2070959207273082880/HZoVBuA2_400x400.jpg";
const URL = "https://hark.ryan.ceo/a/launched";
const DATABASE_PATH = process.env.DATABASE_URL ?? "/data/hark.sqlite";
const STATE_PATH = process.env.BROADCAST_STATE_PATH ?? `/data/broadcast-${CAMPAIGN_ID}.json`;
const LOCK_PATH = `${STATE_PATH}.lock`;

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseArgs(argv) {
  const send = argv.includes("--send");
  const confirmAt = argv.indexOf("--confirm");
  const confirmation = confirmAt >= 0 ? argv[confirmAt + 1] : undefined;
  if (send && confirmation !== CAMPAIGN_ID) {
    throw new Error(`Sending requires --confirm ${CAMPAIGN_ID}`);
  }
  return { send };
}

async function validatePublicAssets() {
  const [image, article] = await Promise.all([
    fetch(IMAGE_URL, { method: "HEAD" }),
    fetch(URL, { method: "HEAD" }),
  ]);
  if (!image.ok || !image.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`Campaign image is unavailable (${image.status})`);
  }
  if (!article.ok) throw new Error(`Campaign article is unavailable (${article.status})`);
}

async function readState() {
  try {
    const state = JSON.parse(await readFile(STATE_PATH, "utf8"));
    if (
      state.campaignId !== CAMPAIGN_ID ||
      !Array.isArray(state.sent) ||
      !Array.isArray(state.skipped)
    ) {
      throw new Error("Broadcast state does not match this campaign");
    }
    return state;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return {
      campaignId: CAMPAIGN_ID,
      startedAt: new Date().toISOString(),
      completedAt: null,
      sent: [],
      skipped: [],
      errors: [],
    };
  }
}

async function writeState(state) {
  const temporary = `${STATE_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, STATE_PATH);
}

function loadTargets(db) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, expo_push_token AS token
       FROM device
       WHERE active = 1
       ORDER BY id`,
    )
    .all();
}

function message(target) {
  const hash = tokenHash(target.token);
  return {
    to: target.token,
    title: TITLE,
    body: BODY,
    priority: "high",
    mutableContent: true,
    richContent: { image: IMAGE_URL },
    data: {
      v: 1,
      eventId: `${CAMPAIGN_ID}-${hash.slice(0, 16)}`,
      serviceId: "hark-product-updates",
      sourceId: "hark-product-updates",
      sourceName: TITLE,
      avatarUrl: IMAGE_URL,
      url: URL,
      conversationId: "hark-product-updates",
    },
  };
}

async function main() {
  const { send } = parseArgs(process.argv.slice(2));
  await validatePublicAssets();
  const db = new Database(DATABASE_PATH, { readonly: !send });
  const state = await readState();
  const sent = new Set(state.sent);
  const skipped = new Set(state.skipped);
  const targets = loadTargets(db);
  const pending = targets.filter((target) => {
    const hash = tokenHash(target.token);
    return !sent.has(hash) && !skipped.has(hash);
  });
  const summary = {
    campaignId: CAMPAIGN_ID,
    mode: send ? "send" : "dry-run",
    users: new Set(targets.map((target) => target.userId)).size,
    activeDevices: targets.length,
    previouslySent: sent.size,
    previouslySkipped: skipped.size,
    remaining: pending.length,
  };
  if (!send) {
    db.close();
    console.log(JSON.stringify(summary));
    return;
  }

  const lock = await open(LOCK_PATH, "wx", 0o600).catch((error) => {
    if (error?.code === "EEXIST") throw new Error("Another broadcast process holds the lock");
    throw error;
  });
  try {
    const expo = new Expo(
      process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : {},
    );
    const hashes = new Map(pending.map((target) => [target.token, tokenHash(target.token)]));
    const valid = [];
    for (const target of pending) {
      if (Expo.isExpoPushToken(target.token)) {
        valid.push(message(target));
        continue;
      }
      db.prepare("UPDATE device SET active = 0 WHERE id = ?").run(target.id);
      const hash = tokenHash(target.token);
      skipped.add(hash);
      state.errors.push({ tokenHash: hash, error: "Invalid Expo push token" });
    }
    state.skipped = [...skipped].sort();

    for (const chunk of expo.chunkPushNotifications(valid)) {
      let tickets;
      try {
        tickets = await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        state.errors.push({
          chunk: chunk.length,
          error: error instanceof Error ? error.message : "Expo push request failed",
        });
        await writeState(state);
        continue;
      }
      tickets.forEach((ticket, index) => {
        const token = chunk[index]?.to;
        if (typeof token !== "string") return;
        const hash = hashes.get(token);
        if (!hash) return;
        if (ticket.status === "ok") {
          sent.add(hash);
          return;
        }
        state.errors.push({ tokenHash: hash, error: ticket.message ?? "Unknown Expo error" });
        if (ticket.details?.error === "DeviceNotRegistered") {
          db.prepare("UPDATE device SET active = 0 WHERE expo_push_token = ?").run(token);
          skipped.add(hash);
        }
      });
      state.sent = [...sent].sort();
      state.skipped = [...skipped].sort();
      await writeState(state);
    }

    state.sent = [...sent].sort();
    state.skipped = [...skipped].sort();
    state.completedAt =
      state.sent.length + state.skipped.length >= targets.length ? new Date().toISOString() : null;
    await writeState(state);
    console.log(
      JSON.stringify({
        ...summary,
        accepted: state.sent.length - summary.previouslySent,
        skipped: state.skipped.length - summary.previouslySkipped,
        remaining: Math.max(0, targets.length - state.sent.length - state.skipped.length),
        errors: state.errors.length,
        completed: state.completedAt !== null,
      }),
    );
  } finally {
    db.close();
    await lock.close();
    await rm(LOCK_PATH, { force: true });
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
