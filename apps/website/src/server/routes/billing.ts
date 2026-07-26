import type { BillingRedirectResponse } from "@hark/contracts";
import { Hono } from "hono";
import { track } from "../lib/analytics";
import {
  createBillingPortal,
  createCheckout,
  getBilling,
  getPricingPlans,
  hasAutumn,
} from "../lib/billing";
import { type AuthedEnv, requireAuth } from "../middleware";

export const billingRoute = new Hono<AuthedEnv>()
  // Public: the pricing page reads the plan catalog without a session.
  .get("/plans", async (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json(await getPricingPlans());
  })
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await getBilling(c.get("user"))))
  .post("/checkout", async (c) => {
    if (!hasAutumn()) return c.json({ error: "Billing is not configured" }, 503);
    try {
      const url = await createCheckout(c.get("user"));
      track({ name: "plan_checkout_started", userId: c.get("user").id, outcome: "pro_monthly" });
      return c.json<BillingRedirectResponse>({ url });
    } catch (error) {
      console.error("[billing] Could not create checkout", error);
      return c.json({ error: "Could not start checkout" }, 502);
    }
  })
  .post("/portal", async (c) => {
    if (!hasAutumn()) return c.json({ error: "Billing is not configured" }, 503);
    try {
      const url = await createBillingPortal(c.get("user"));
      track({ name: "billing_portal_opened", userId: c.get("user").id });
      return c.json<BillingRedirectResponse>({ url });
    } catch (error) {
      console.error("[billing] Could not create customer portal", error);
      return c.json({ error: "Could not open billing portal" }, 502);
    }
  });
