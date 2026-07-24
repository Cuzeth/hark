import { Hono } from "hono";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { billingRoute } from "./routes/billing";
import { devicesRoute } from "./routes/devices";
import { eventsRoute } from "./routes/events";
import { hooksRoute } from "./routes/hooks";
import { servicesRoute } from "./routes/services";

export const app = new Hono();

if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}

app.get("/api/health", (c) => c.json({ ok: true }));

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/services", servicesRoute);
app.route("/api/billing", billingRoute);
app.route("/api/devices", devicesRoute);
app.route("/api/events", eventsRoute);
app.route("/hooks", hooksRoute);

app.notFound((c) => {
  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/hooks")) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.text("Not found", 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
