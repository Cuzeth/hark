import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  absoluteUrl,
  DEMO_VIDEO_URL,
  PAGE_SEO,
  SOCIAL_IMAGE_URL,
  seoPageForPath,
  structuredDataForPage,
} from "../../shared/seo";

function meta(name: string, content: string, property = false): HTMLMetaElement {
  const element = document.createElement("meta");
  element.setAttribute(property ? "property" : "name", name);
  element.content = content;
  element.dataset.seo = "true";
  return element;
}

/** Keeps metadata correct when React Router navigates without a document request. */
export function DocumentMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = seoPageForPath(pathname);
    if (!page) return;
    const seo = PAGE_SEO[page];
    const canonical = absoluteUrl(seo.path);
    const robots = seo.index
      ? "index, follow, max-image-preview:large, max-video-preview:-1"
      : "noindex, nofollow";

    document.head.querySelectorAll("[data-seo]").forEach((element) => {
      element.remove();
    });

    const title = document.createElement("title");
    title.textContent = seo.title;
    title.dataset.seo = "true";
    document.head.append(title);

    const canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    canonicalLink.href = canonical;
    canonicalLink.dataset.seo = "true";
    document.head.append(canonicalLink);

    document.head.append(
      meta("description", seo.description),
      meta("robots", robots),
      meta("application-name", "Hark"),
      meta("og:type", "website", true),
      meta("og:site_name", "Hark", true),
      meta("og:locale", "en_US", true),
      meta("og:title", seo.title, true),
      meta("og:description", seo.description, true),
      meta("og:url", canonical, true),
      meta("og:image", SOCIAL_IMAGE_URL, true),
      meta("og:image:type", "image/png", true),
      meta("og:image:width", "1920", true),
      meta("og:image:height", "1080", true),
      meta("og:image:alt", "Hark iOS alerts, notifications, and Live Activities", true),
      meta("twitter:card", "summary_large_image"),
      meta("twitter:title", seo.title),
      meta("twitter:description", seo.description),
      meta("twitter:image", SOCIAL_IMAGE_URL),
      meta("twitter:image:alt", "Hark iOS alerts, notifications, and Live Activities"),
    );

    if (page === "home") {
      document.head.append(
        meta("og:video", DEMO_VIDEO_URL, true),
        meta("og:video:secure_url", DEMO_VIDEO_URL, true),
        meta("og:video:type", "video/mp4", true),
        meta("og:video:width", "1280", true),
        meta("og:video:height", "720", true),
      );
    }

    if (seo.markdownAlternate) {
      const alternate = document.createElement("link");
      alternate.rel = "alternate";
      alternate.type = "text/markdown";
      alternate.href = seo.markdownAlternate;
      alternate.dataset.seo = "true";
      document.head.append(alternate);
    }

    const structuredData = structuredDataForPage(page);
    if (structuredData) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(structuredData).replaceAll("<", "\\u003c");
      script.dataset.seo = "true";
      document.head.append(script);
    }
  }, [pathname]);

  return null;
}
