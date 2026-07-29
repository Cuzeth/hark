import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  PAGE_SEO,
  PRERENDERED_SEO_PAGES,
  SHELL_SEO_PAGES,
  SOCIAL_IMAGE_URL,
  seoPageForPath,
} from "./seo";

const publicDir = resolve(import.meta.dirname, "../../public");

describe("SEO metadata", () => {
  it("gives every page unique metadata and an absolute canonical", () => {
    const pages = Object.values(PAGE_SEO);
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);

    for (const page of pages) {
      expect(absoluteUrl(page.path)).toMatch(/^https:\/\/hark\.abdeen\.dev\//);
    }
  });

  it("builds every route exactly once", () => {
    const built = [...PRERENDERED_SEO_PAGES, ...SHELL_SEO_PAGES].sort();
    expect(built).toEqual(Object.keys(PAGE_SEO).sort());
  });

  it("resolves direct and trailing-slash routes without treating unknown paths as pages", () => {
    expect(seoPageForPath("/")).toBe("home");
    expect(seoPageForPath("/docs/")).toBe("docs");
    expect(seoPageForPath("/dashboard")).toBe("dashboard");
    expect(seoPageForPath("/missing")).toBeNull();
  });

  it("serves its social image from the instance", () => {
    expect(SOCIAL_IMAGE_URL).toBe("https://hark.abdeen.dev/ogimage.png");
  });
});

describe("crawler files", () => {
  it("keeps the whole private instance out of search engines", async () => {
    const robots = await readFile(resolve(publicDir, "robots.txt"), "utf8");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Sitemap:");
  });
});
