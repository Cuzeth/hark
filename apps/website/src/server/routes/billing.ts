import type { BillingRedirectResponse } from "@hark/contracts";
import { Hono } from "hono";
import { createBillingPortal, createCheckout, getBilling, hasAutumn } from "../lib/billing";
import { type AuthedEnv, requireAuth } from "../middleware";

export const billingRoute = new Hono<AuthedEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await getBilling(c.get("user"))))
  .post("/checkout", async (c) => {
    if (!hasAutumn()) return c.json({ error: "Billing is not configured" }, 503);
    try {
      return c.json<BillingRedirectResponse>({ url: await createCheckout(c.get("user")) });
    } catch (error) {
      console.error("[billing] Could not create checkout", error);
      return c.json({ error: "Could not start checkout" }, 502);
    }
  })
  .post("/portal", async (c) => {
    if (!hasAutumn()) return c.json({ error: "Billing is not configured" }, 503);
    try {
      return c.json<BillingRedirectResponse>({ url: await createBillingPortal(c.get("user")) });
    } catch (error) {
      console.error("[billing] Could not create customer portal", error);
      return c.json({ error: "Could not open billing portal" }, 502);
    }
  });
