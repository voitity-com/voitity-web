import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnv } from "vite";

const projectRoot = process.cwd();
const distDirectory = path.join(projectRoot, "dist");
const baseHtml = await readFile(path.join(distDirectory, "index.html"), "utf8");
const env = loadEnv("production", projectRoot, "");
const apiBaseUrl = (
  process.env.SEO_API_BASE_URL ||
  env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");
const siteUrl = "https://bigmelo.com";
const defaultImage = `${siteUrl}/bigmelo-icon.png`;

const homeMetadata = {
  canonical: `${siteUrl}/`,
  description:
    "Crea una presencia digital interactiva con IA, imagen y voz para compartir tu experiencia, responder preguntas y conectar tus redes oficiales.",
  image: defaultImage,
  locale: "es",
  robots: "index,follow,max-image-preview:large,max-snippet:-1",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Bigmelo", url: `${siteUrl}/` },
      {
        "@type": "Organization",
        logo: defaultImage,
        name: "Bigmelo",
        url: `${siteUrl}/`,
      },
      {
        "@type": "SoftwareApplication",
        applicationCategory: "BusinessApplication",
        name: "Bigmelo",
        operatingSystem: "Web",
        url: `${siteUrl}/`,
      },
    ],
  },
  title: "Bigmelo: perfiles interactivos con IA, imagen y voz",
  type: "website",
};

const profiles = await fetchSeoProfiles();

await writeFile(
  path.join(distDirectory, "index.html"),
  renderDocument(homeMetadata, homeFallback()),
);

for (const profile of profiles) {
  if (
    !isSafeAlias(profile.alias) ||
    typeof profile.name !== "string" ||
    profile.name.trim() === ""
  ) {
    console.warn(`Skipping invalid SEO profile alias: ${String(profile.alias)}`);
    continue;
  }

  const locale = profile.locale === "en" ? "en" : "es";
  const alias = profile.alias;
  const name = profile.name.trim();
  const canonical = `${siteUrl}/${encodeURIComponent(alias)}`;
  const networks = normalizeNetworks(profile.networks);
  const image = isHttpUrl(profile.image_url) ? profile.image_url : defaultImage;
  const description =
    locale === "en"
      ? `Meet ${name} (@${alias}), visit their official social profiles and start an interactive conversation on Bigmelo.`
      : `Conoce el perfil interactivo de ${name} (@${alias}), visita sus redes oficiales e inicia una conversación en Bigmelo.`;
  const person = {
    "@type": "Person",
    alternateName: `@${alias}`,
    ...(image !== defaultImage ? { image } : {}),
    name,
    ...(networks.length
      ? { sameAs: networks.map((network) => network.url) }
      : {}),
    url: canonical,
  };
  const metadata = {
    canonical,
    description,
    image,
    locale,
    robots: "index,follow,max-image-preview:large,max-snippet:-1",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      ...(profile.updated_at ? { dateModified: profile.updated_at } : {}),
      mainEntity: person,
      url: canonical,
    },
    title: `${name} (@${alias}) | Bigmelo`,
    type: "profile",
  };
  const profileDirectory = path.join(distDirectory, alias);
  await mkdir(profileDirectory, { recursive: true });
  await writeFile(
    path.join(profileDirectory, "index.html"),
    renderDocument(
      metadata,
      profileFallback({ alias, image, name, networks }),
    ),
  );
}

await writeFile(
  path.join(distDirectory, "404.html"),
  renderDocument(
    {
      canonical: `${siteUrl}/404`,
      description: "La página solicitada no existe en Bigmelo.",
      image: defaultImage,
      locale: "es",
      robots: "noindex,follow",
      title: "Página no encontrada | Bigmelo",
      type: "website",
    },
    notFoundFallback(),
  ),
);

for (const legalPage of [
  {
    locale: "es",
    path: "privacidad",
    title: "Política de privacidad de Bigmelo",
  },
  { locale: "en", path: "privacy", title: "Bigmelo Privacy Policy" },
  {
    locale: "es",
    path: "terminos",
    title: "Términos y condiciones de Bigmelo",
  },
  { locale: "en", path: "terms", title: "Bigmelo Terms and Conditions" },
  {
    locale: "es",
    path: "eliminacion-datos",
    title: "Eliminación de datos de Bigmelo",
  },
  {
    locale: "en",
    path: "data-deletion",
    title: "Bigmelo Data Deletion",
  },
]) {
  const directory = path.join(distDirectory, legalPage.path);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "index.html"),
    renderDocument(
      {
        canonical: `${siteUrl}/${legalPage.path}`,
        description: legalPage.title,
        image: defaultImage,
        locale: legalPage.locale,
        robots: "noindex,follow",
        title: `${legalPage.title} | Bigmelo`,
        type: "website",
      },
      "",
    ),
  );
}

const sitemapEntries = [
  { loc: `${siteUrl}/` },
  ...profiles
    .filter(
      (profile) =>
        isSafeAlias(profile.alias) &&
        typeof profile.name === "string" &&
        profile.name.trim() !== "",
    )
    .map((profile) => ({
      loc: `${siteUrl}/${encodeURIComponent(profile.alias)}`,
      lastmod: validDate(profile.updated_at) ?? new Date().toISOString(),
    })),
];

await writeFile(
  path.join(distDirectory, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries
    .map(({ loc, lastmod }) => {
      const lastModified = lastmod
        ? `<lastmod>${escapeXml(lastmod)}</lastmod>`
        : "";
      return `  <url><loc>${escapeXml(loc)}</loc>${lastModified}</url>`;
    })
    .join("\n")}\n</urlset>\n`,
);

await writeFile(
  path.join(distDirectory, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
);

console.log(`Generated SEO pages for ${profiles.length} public profiles.`);

async function fetchSeoProfiles() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/public/seo/profiles`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Bigmelo-SEO-Builder/1.0",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`SEO API returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload?.data?.profiles) ? payload.data.profiles : [];
  } catch (error) {
    if (process.env.CI) {
      throw error;
    }

    console.warn(
      `SEO API unavailable at ${apiBaseUrl}; generating the site without profile snapshots.`,
    );
    return [];
  }
}

function renderDocument(metadata, body) {
  const cleanHtml = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(
      /\s*<(?:meta|link)\b[^>]*data-bigmelo-seo[^>]*\/?>/gi,
      "",
    )
    .replace(
      /\s*<script\b[^>]*data-bigmelo-seo[^>]*>[\s\S]*?<\/script>/gi,
      "",
    )
    .replace(/<html\s+lang="[^"]*"/i, `<html lang="${metadata.locale}"`);
  const tags = metadataTags(metadata);
  const withMetadata = cleanHtml.replace("</head>", `${tags}\n  </head>`);

  return withMetadata.replace(
    '<div id="root"></div>',
    `<div id="root">${body}</div>`,
  );
}

function metadataTags(metadata) {
  const twitterCard =
    metadata.image === defaultImage ? "summary" : "summary_large_image";
  const structuredData = metadata.structuredData
    ? `<script data-bigmelo-seo id="bigmelo-structured-data" type="application/ld+json">${jsonForHtml(metadata.structuredData)}</script>`
    : "";

  return [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta data-bigmelo-seo name="description" content="${escapeHtml(metadata.description)}" />`,
    `<meta data-bigmelo-seo name="robots" content="${escapeHtml(metadata.robots)}" />`,
    `<link data-bigmelo-seo rel="canonical" href="${escapeHtml(metadata.canonical)}" />`,
    `<meta data-bigmelo-seo property="og:type" content="${escapeHtml(metadata.type)}" />`,
    `<meta data-bigmelo-seo property="og:site_name" content="Bigmelo" />`,
    `<meta data-bigmelo-seo property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta data-bigmelo-seo property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta data-bigmelo-seo property="og:url" content="${escapeHtml(metadata.canonical)}" />`,
    `<meta data-bigmelo-seo property="og:image" content="${escapeHtml(metadata.image)}" />`,
    `<meta data-bigmelo-seo property="og:locale" content="${metadata.locale === "en" ? "en_US" : "es_CO"}" />`,
    `<meta data-bigmelo-seo name="twitter:card" content="${twitterCard}" />`,
    `<meta data-bigmelo-seo name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta data-bigmelo-seo name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta data-bigmelo-seo name="twitter:image" content="${escapeHtml(metadata.image)}" />`,
    structuredData,
  ]
    .filter(Boolean)
    .join("\n    ");
}

function homeFallback() {
  return '<main class="seo-home-fallback"><h1>Presencia digital con IA, imagen y voz</h1><p>Bigmelo convierte tu experiencia en un perfil interactivo para responder preguntas y conectar tus redes oficiales.</p><a href="#contacto">Crear mi perfil</a></main>';
}

function profileFallback({ alias, image, name, networks }) {
  const networkLinks = networks
    .map(
      (network) =>
        `<a href="${escapeHtml(network.url)}" rel="noopener noreferrer">${escapeHtml(network.label)}</a>`,
    )
    .join("");
  const avatar =
    image !== defaultImage
      ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />`
      : "";
  return `<main class="seo-profile-fallback"><div>${avatar}<h1>${escapeHtml(name)}</h1><p>@${escapeHtml(alias)}</p><nav aria-label="Redes sociales">${networkLinks}</nav></div></main>`;
}

function notFoundFallback() {
  return '<main class="not-found-page"><div><p>404</p><h1>Página no encontrada</h1><p>El perfil o la página que buscas no está disponible.</p><a href="/">Volver a Bigmelo</a></div></main>';
}

function normalizeNetworks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, url]) =>
    isHttpUrl(url)
      ? [{ label: key.charAt(0).toUpperCase() + key.slice(1), url }]
      : [],
  );
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isSafeAlias(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value)
  );
}

function validDate(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
