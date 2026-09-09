import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://bigmelo.com';
const ROOT_URL = `${SITE_URL}/`;
const HOME_V01_URL = `${SITE_URL}/landing/homev01`;
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const EXPECTED_TITLE = 'Bigmelo: el link en bio con IA que responde por ti';
const EXPECTED_DESCRIPTION =
  'Crea un perfil interactivo con IA, tu imagen y voz. Responde preguntas, recomienda productos y convierte tu link en bio en una conversación 24/7.';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const distDirectory = path.join(projectRoot, 'dist');

const [rootHtml, homeV01Html, sitemapXml, robotsText] = await Promise.all([
  readOutput('index.html'),
  readOutput('landing/homev01/index.html'),
  readOutput('sitemap.xml'),
  readOutput('robots.txt'),
]);

const failures = [];
let passed = 0;

check('root title matches the promoted homev01 SEO title', () => {
  expectEqual(getTitle(rootHtml), EXPECTED_TITLE);
});

check('root meta description matches the promoted homev01 SEO description', () => {
  expectEqual(getMeta(rootHtml, 'name', 'description'), EXPECTED_DESCRIPTION);
});

check('root canonical points to the production root', () => {
  expectEqual(getCanonical(rootHtml), ROOT_URL);
});

check('root robots directive is explicitly indexable', () => {
  expectIndexable(getMeta(rootHtml, 'name', 'robots'));
});

check('root Open Graph title and description match the canonical metadata', () => {
  expectEqual(getMeta(rootHtml, 'property', 'og:title'), EXPECTED_TITLE);
  expectEqual(getMeta(rootHtml, 'property', 'og:description'), EXPECTED_DESCRIPTION);
  expectEqual(getMeta(rootHtml, 'property', 'og:url'), ROOT_URL);
});

check('root Open Graph image is absolute and declares 1200x630 dimensions', () => {
  const image = getMeta(rootHtml, 'property', 'og:image');
  const imageUrl = new URL(image);

  expectEqual(imageUrl.protocol, 'https:');
  expectEqual(getMeta(rootHtml, 'property', 'og:image:width'), '1200');
  expectEqual(getMeta(rootHtml, 'property', 'og:image:height'), '630');
});

check('root Open Graph image has useful alternative text', () => {
  const alt = getMeta(rootHtml, 'property', 'og:image:alt').trim();

  if (alt.length === 0) {
    throw new Error('expected og:image:alt to be non-empty');
  }
});

check('root Twitter metadata uses a large image card consistently', () => {
  expectEqual(getMeta(rootHtml, 'name', 'twitter:card'), 'summary_large_image');
  expectEqual(
    getMeta(rootHtml, 'name', 'twitter:image'),
    getMeta(rootHtml, 'property', 'og:image'),
  );
});

check('root JSON-LD exposes a SoftwareApplication with a USD 12.99 Offer', () => {
  const applications = getJsonLdObjects(rootHtml).filter((value) =>
    hasSchemaType(value, 'SoftwareApplication'),
  );
  const hasExpectedOffer = applications.some((application) =>
    asArray(application.offers).some(
      (offer) =>
        isObject(offer) &&
        hasSchemaType(offer, 'Offer') &&
        Number(offer.price) === 12.99 &&
        offer.priceCurrency === 'USD',
    ),
  );

  if (!hasExpectedOffer) {
    throw new Error('expected SoftwareApplication.offers to contain Offer { price: "12.99", priceCurrency: "USD" }');
  }
});

check('homev01 alias canonical points to the production root', () => {
  expectEqual(getCanonical(homeV01Html), ROOT_URL);
});

check('homev01 alias is explicitly indexable', () => {
  expectIndexable(getMeta(homeV01Html, 'name', 'robots'));
});

check('sitemap contains the root exactly once and excludes the homev01 alias', () => {
  const locations = getSitemapLocations(sitemapXml);
  const rootEntries = locations.filter((location) => normalizeUrl(location) === ROOT_URL);
  const aliasEntries = locations.filter(
    (location) => normalizeUrl(location) === `${HOME_V01_URL}/`,
  );

  expectEqual(rootEntries.length, 1);
  expectEqual(aliasEntries.length, 0);
});

check('robots.txt references the production sitemap', () => {
  const sitemapDirectives = robotsText
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.replace(/^sitemap\s*:\s*/i, '').trim());

  if (!sitemapDirectives.includes(SITEMAP_URL)) {
    throw new Error(`expected a Sitemap directive for ${SITEMAP_URL}`);
  }
});

if (failures.length > 0) {
  console.error(`\nSEO output check failed (${failures.length} failure${failures.length === 1 ? '' : 's'}):`);
  failures.forEach(({ error, name }) => console.error(`- ${name}: ${error}`));
  process.exitCode = 1;
} else {
  console.log(`\nSEO output check passed (${passed} checks).`);
}

async function readOutput(relativePath) {
  const absolutePath = path.join(distDirectory, relativePath);

  try {
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing dist/${relativePath}. Run the production build before checking SEO output.`);
    }

    throw error;
  }
}

function check(name, callback) {
  try {
    callback();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({
      error: error instanceof Error ? error.message : String(error),
      name,
    });
    console.error(`FAIL ${name}`);
  }
}

function expectEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function expectIndexable(robots) {
  const directives = robots
    .toLowerCase()
    .split(/[;,]/)
    .map((directive) => directive.trim())
    .filter(Boolean);

  if (!directives.includes('index')) {
    throw new Error(`expected an explicit index directive, received ${JSON.stringify(robots)}`);
  }

  if (directives.includes('noindex')) {
    throw new Error(`found noindex in ${JSON.stringify(robots)}`);
  }
}

function getTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  if (!match?.[1]) {
    throw new Error('could not find a non-empty <title>');
  }

  return normalizeText(match[1]);
}

function getMeta(html, selectorAttribute, selectorValue) {
  const tag = findTag(html, 'meta', (attributes) =>
    attributeEquals(attributes, selectorAttribute, selectorValue),
  );
  const content = tag.get('content');

  if (content === undefined) {
    throw new Error(`meta[${selectorAttribute}="${selectorValue}"] is missing content`);
  }

  return decodeHtml(content).trim();
}

function getCanonical(html) {
  const tag = findTag(html, 'link', (attributes) =>
    (attributes.get('rel') ?? '')
      .toLowerCase()
      .split(/\s+/)
      .includes('canonical'),
  );
  const href = tag.get('href');

  if (href === undefined) {
    throw new Error('link[rel="canonical"] is missing href');
  }

  return decodeHtml(href).trim();
}

function findTag(html, tagName, predicate) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');

  for (const match of html.matchAll(pattern)) {
    const attributes = parseAttributes(match[0]);
    if (predicate(attributes)) {
      return attributes;
    }
  }

  throw new Error(`could not find matching <${tagName}>`);
}

function parseAttributes(tag) {
  const attributes = new Map();
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function attributeEquals(attributes, name, value) {
  return (attributes.get(name.toLowerCase()) ?? '').toLowerCase() === value.toLowerCase();
}

function getJsonLdObjects(html) {
  const objects = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const attributes = parseAttributes(`<script ${match[1]}>`);
    if (!attributeEquals(attributes, 'type', 'application/ld+json')) {
      continue;
    }

    let document;
    try {
      document = JSON.parse(match[2]);
    } catch (error) {
      throw new Error(`invalid JSON-LD: ${error instanceof Error ? error.message : String(error)}`);
    }

    walkJson(document, objects);
  }

  if (objects.length === 0) {
    throw new Error('could not find any JSON-LD objects');
  }

  return objects;
}

function walkJson(value, objects) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, objects));
    return;
  }

  if (!isObject(value)) {
    return;
  }

  objects.push(value);
  Object.values(value).forEach((item) => walkJson(item, objects));
}

function hasSchemaType(value, expectedType) {
  return asArray(value['@type']).includes(expectedType);
}

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSitemapLocations(xml) {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((match) =>
    decodeHtml(match[1]).trim(),
  );
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname === '/' ? '/' : `${url.pathname.replace(/\/+$/, '')}/`;
  return url.href;
}

function normalizeText(value) {
  return decodeHtml(value).replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return value.replace(
    /&(?:amp|quot|apos|lt|gt|#39|#x27|#\d+|#x[\da-f]+);/gi,
    (entity) => {
      const normalized = entity.toLowerCase();
      const named = {
        '&amp;': '&',
        '&apos;': "'",
        '&gt;': '>',
        '&lt;': '<',
        '&quot;': '"',
      };

      if (named[normalized]) {
        return named[normalized];
      }

      if (normalized === '&#39;' || normalized === '&#x27;') {
        return "'";
      }

      const radix = normalized.startsWith('&#x') ? 16 : 10;
      const number = Number.parseInt(normalized.replace(/^&#x?|;$/g, ''), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    },
  );
}
