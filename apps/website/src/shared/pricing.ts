import type { PricingPlansDto } from "@hark/contracts";

export const FREE_NOTIFICATIONS = 10_000;
export const PRO_NOTIFICATIONS = 100_000;
export const PRO_PRICE_MONTHLY = 8;

interface PricingRateLimits {
  freeServicePerMinute: number;
  freeAccountPerMinute: number;
  proServicePerMinute: number;
  proAccountPerMinute: number;
}

const defaultRateLimits: PricingRateLimits = {
  freeServicePerMinute: 60,
  freeAccountPerMinute: 300,
  proServicePerMinute: 300,
  proAccountPerMinute: 1_500,
};

/** Public fallback catalog, also used as the prerendered pricing-page state. */
export function staticPricingPlans(limits: PricingRateLimits = defaultRateLimits): PricingPlansDto {
  return {
    source: "static",
    plans: [
      {
        id: "free",
        name: "Free",
        description: "Everything needed for personal webhook notifications.",
        priceMonthly: 0,
        notificationsPerMonth: FREE_NOTIFICATIONS,
        devices: 1,
        deviceRouting: false,
        servicePerMinute: limits.freeServicePerMinute,
        accountPerMinute: limits.freeAccountPerMinute,
      },
      {
        id: "pro_monthly",
        name: "Pro",
        description: "Multiple iPhones, targeted routing, and higher limits.",
        priceMonthly: PRO_PRICE_MONTHLY,
        notificationsPerMonth: PRO_NOTIFICATIONS,
        devices: null,
        deviceRouting: true,
        servicePerMinute: limits.proServicePerMinute,
        accountPerMinute: limits.proAccountPerMinute,
      },
    ],
  };
}
