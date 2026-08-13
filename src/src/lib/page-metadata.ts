type PageMetadata = {
  canonicalOrigin?: string;
  canonicalPath: string;
  description: string;
  image?: string;
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

function canonicalUrl(path: string, origin = SITE_URL): string {
  const normalizedPath = path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `${origin.replace(/\/+$/, "")}${normalizedPath}`;
}

export function setPageMetadata({
  canonicalOrigin = SITE_URL,
  canonicalPath,
  description,
  image = DEFAULT_IMAGE,
  locale = "es",
  robots = "index,follow,max-image-preview:large,max-snippet:-1",
  structuredData,
  title,
  type = "website",
}: PageMetadata): void {
  const url = canonicalUrl(canonicalPath, canonicalOrigin);

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
  upsertMeta('meta[property="og:locale"]', {
    content: locale === "en" ? "en_US" : "es_CO",
    property: "og:locale",
  });
  upsertMeta('meta[name="twitter:card"]', { content: "summary", name: "twitter:card" });
  upsertMeta('meta[name="twitter:title"]', { content: title, name: "twitter:title" });
  upsertMeta('meta[name="twitter:description"]', { content: description, name: "twitter:description" });
  upsertMeta('meta[name="twitter:image"]', { content: image, name: "twitter:image" });

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
