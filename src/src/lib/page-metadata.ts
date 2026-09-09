type PageMetadata = {
  canonicalOrigin?: string;
  canonicalPath: string;
  description: string;
  image?: string;
  imageAlt?: string;
  imageHeight?: number;
  imageType?: string;
  imageWidth?: number;
  locale?: "en" | "es";
  robots?: string;
  structuredData?: Record<string, unknown>;
  title: string;
  type?: "profile" | "website";
};

const DEFAULT_IMAGE = "https://bigmelo.com/bigmelo-icon.png";
const SITE_URL = "https://bigmelo.com";

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.dataset.bigmeloSeo = "runtime";
    document.head.append(element);
  }

  Object.entries(attributes).forEach(([key, value]) => element!.setAttribute(key, value));
}

function removeMeta(selector: string) {
  document.head.querySelector(selector)?.remove();
}

function canonicalUrl(path: string, origin = SITE_URL): string {
  const normalizedPath = path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `${origin.replace(/\/+$/, "")}${normalizedPath}`;
}

export function setPageMetadata({
  canonicalOrigin = SITE_URL,
  canonicalPath,
  description,
  image = DEFAULT_IMAGE,
  imageAlt,
  imageHeight,
  imageType,
  imageWidth,
  locale = "es",
  robots = "index,follow,max-image-preview:large,max-snippet:-1",
  structuredData,
  title,
  type = "website",
}: PageMetadata): void {
  const url = canonicalUrl(canonicalPath, canonicalOrigin);
  const resolvedImageAlt = imageAlt ?? title;

  document.documentElement.lang = locale;
  document.title = title;

  upsertMeta('meta[name="description"]', { content: description, name: "description" });
  upsertMeta('meta[name="robots"]', { content: robots, name: "robots" });
  upsertMeta('meta[property="og:type"]', { content: type, property: "og:type" });
  upsertMeta('meta[property="og:site_name"]', { content: "Bigmelo", property: "og:site_name" });
  upsertMeta('meta[property="og:title"]', { content: title, property: "og:title" });
  upsertMeta('meta[property="og:description"]', { content: description, property: "og:description" });
  upsertMeta('meta[property="og:url"]', { content: url, property: "og:url" });
  upsertMeta('meta[property="og:image"]', { content: image, property: "og:image" });
  upsertMeta('meta[property="og:image:alt"]', { content: resolvedImageAlt, property: "og:image:alt" });
  if (imageWidth) {
    upsertMeta('meta[property="og:image:width"]', { content: String(imageWidth), property: "og:image:width" });
  } else {
    removeMeta('meta[property="og:image:width"]');
  }
  if (imageHeight) {
    upsertMeta('meta[property="og:image:height"]', { content: String(imageHeight), property: "og:image:height" });
  } else {
    removeMeta('meta[property="og:image:height"]');
  }
  if (imageType) {
    upsertMeta('meta[property="og:image:type"]', { content: imageType, property: "og:image:type" });
  } else {
    removeMeta('meta[property="og:image:type"]');
  }
  upsertMeta('meta[property="og:locale"]', {
    content: locale === "en" ? "en_US" : "es_CO",
    property: "og:locale",
  });
  upsertMeta('meta[name="twitter:card"]', {
    content: image === DEFAULT_IMAGE ? "summary" : "summary_large_image",
    name: "twitter:card",
  });
  upsertMeta('meta[name="twitter:title"]', { content: title, name: "twitter:title" });
  upsertMeta('meta[name="twitter:description"]', { content: description, name: "twitter:description" });
  upsertMeta('meta[name="twitter:image"]', { content: image, name: "twitter:image" });
  upsertMeta('meta[name="twitter:image:alt"]', { content: resolvedImageAlt, name: "twitter:image:alt" });

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.dataset.bigmeloSeo = "runtime";
    document.head.append(canonical);
  }
  canonical.href = url;

  document.getElementById("bigmelo-structured-data")?.remove();
  if (structuredData) {
    const script = document.createElement("script");
    script.id = "bigmelo-structured-data";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(structuredData);
    document.head.append(script);
  }
}

export function profileDescription(name: string, alias: string, locale: "en" | "es"): string {
  return locale === "en"
    ? `Meet ${name} (@${alias}), visit their official social profiles and start an interactive conversation on Bigmelo.`
    : `Conoce el perfil interactivo de ${name} (@${alias}), visita sus redes oficiales e inicia una conversación en Bigmelo.`;
}
