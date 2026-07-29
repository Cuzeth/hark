export const SITE_URL = "https://hark.abdeen.dev";
export const SOCIAL_IMAGE_URL = `${SITE_URL}/ogimage.png`;

export type SeoPage = "home" | "docs" | "dashboard" | "cliAuthorize";

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  markdownAlternate?: string;
}

/** A private instance: every route is noindex, so only titles and canonicals matter. */
export const PAGE_SEO: Record<SeoPage, PageSeo> = {
  home: {
    path: "/",
    title: "Sign in — Hark",
    description: "Sign in to this private Hark instance.",
  },
  docs: {
    path: "/docs",
    title: "Hark API Docs — Notifications, Approvals, and Live Activities",
    description:
      "Use the Hark webhook API and CLI to send iPhone notifications, request approvals or replies, and update Live Activities from agents and automation.",
    markdownAlternate: `${SITE_URL}/docs.md`,
  },
  dashboard: {
    path: "/dashboard",
    title: "Dashboard — Hark",
    description: "Manage your private Hark services, devices, activity, and agent connections.",
  },
  cliAuthorize: {
    path: "/cli/authorize",
    title: "Authorize Hark CLI",
    description: "Review and authorize a Hark CLI connection.",
  },
};

/** Pages whose markup is prerendered at build time. */
export const PRERENDERED_SEO_PAGES = ["home", "docs"] as const;
/** Pages that ship an empty shell and render entirely in the browser. */
export const SHELL_SEO_PAGES = ["dashboard", "cliAuthorize"] as const;

export function absoluteUrl(path: string): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

export function seoPageForPath(pathname: string): SeoPage | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const [page, seo] of Object.entries(PAGE_SEO) as [SeoPage, PageSeo][]) {
    if (seo.path === normalized) return page;
  }
  return null;
}
