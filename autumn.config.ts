import { feature, item, plan } from "atmn";

// Features
export const notifications = feature({
  id: "notifications",
  name: "Notifications",
  type: "metered",
  consumable: true,
});

export const higherRateLimits = feature({
  id: "higher_rate_limits",
  name: "Higher rate limits",
  type: "boolean",
});

export const deviceRouting = feature({
  id: "device_routing",
  name: "Device routing",
  type: "boolean",
});

export const devices = feature({
  id: "devices",
  name: "iPhones",
  type: "metered",
  consumable: false,
});

// Plans
export const freeV1 = plan({
  id: "free",
  version: 1,
  name: "Free",
  description: "Everything needed for personal webhook notifications.",
  group: "main",
  autoEnable: true,
  items: [
    item({
      featureId: devices.id,
      included: 1,
    }),
    item({
      featureId: notifications.id,
      included: 10000,
      reset: {
        interval: "month",
      },
    }),
  ],
});

export const proV1 = plan({
  id: "pro",
  version: 1,
  name: "Pro",
  description: "Multiple iPhones, targeted routing, and higher limits.",
  group: "main",
  price: {
    amount: 800,
    interval: "month",
  },
  items: [
    item({ featureId: deviceRouting.id }),
    item({ featureId: higherRateLimits.id }),
    item({
      featureId: devices.id,
      unlimited: true,
    }),
    item({
      featureId: notifications.id,
      included: 100000,
      reset: {
        interval: "month",
      },
    }),
  ],
});
