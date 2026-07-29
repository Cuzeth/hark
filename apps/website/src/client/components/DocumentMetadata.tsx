import { useEffect } from "react";
import { useLocation } from "react-router";
import { absoluteUrl, PAGE_SEO, SOCIAL_IMAGE_URL, seoPageForPath } from "../../shared/seo";

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
      meta("robots", "noindex, nofollow"),
      meta("application-name", "Hark"),
      meta("og:type", "website", true),
      meta("og:site_name", "Hark", true),
      meta("og:locale", "en_US", true),
      meta("og:title", seo.title, true),
      meta("og:description", seo.description, true),
      meta("og:url", canonical, true),
      meta("og:image", SOCIAL_IMAGE_URL, true),
      meta("og:image:type", "image/png", true),
    );

    if (seo.markdownAlternate) {
      const alternate = document.createElement("link");
      alternate.rel = "alternate";
      alternate.type = "text/markdown";
      alternate.href = seo.markdownAlternate;
      alternate.dataset.seo = "true";
      document.head.append(alternate);
    }
  }, [pathname]);

  return null;
}
