import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const projectRoot = process.cwd();
const distDirectory = path.join(projectRoot, 'dist');
const indexHtml = await readFile(path.join(distDirectory, 'index.html'), 'utf8');

const entryScript = matchAsset(indexHtml, /<script\b[^>]*src="([^"]*\/assets\/app-[^"]+\.js)"/i, 'entry script');
const entryStylesheet = matchAsset(indexHtml, /<link\b[^>]*href="([^"]*\/assets\/app-[^"]+\.css)"/i, 'entry stylesheet');

const budgets = [
  {
    file: entryScript,
    gzip: true,
    maximumBytes: 100 * 1024,
    name: 'Initial JavaScript (gzip)',
  },
  {
    file: entryStylesheet,
    gzip: true,
    maximumBytes: 20 * 1024,
    name: 'Initial CSS (gzip)',
  },
  {
    file: 'src/assets/bigmelo-logo.webp',
    maximumBytes: 10 * 1024,
    name: 'Bigmelo logo',
    source: true,
  },
  {
    file: '/media/landing/valeria-rios-avatar-512.webp',
    maximumBytes: 80 * 1024,
    name: 'Landing avatar poster',
  },
  {
    file: '/media/landing/valeria-rios-avatar-96.webp',
    maximumBytes: 10 * 1024,
    name: 'Landing avatar thumbnail',
  },
  {
    file: '/media/landing/valeria-rios-avatar-480.mp4',
    maximumBytes: 350 * 1024,
    name: 'Landing avatar animation',
  },
  {
    file: '/media/landing/bigmelo-overview-video-480.webp',
    maximumBytes: 80 * 1024,
    name: 'YouTube placeholder',
  },
];

let failed = false;

for (const budget of budgets) {
  const absolutePath = budget.source
    ? path.join(projectRoot, budget.file)
    : path.join(distDirectory, budget.file.replace(/^\/+/, ''));
  const bytes = budget.gzip
    ? gzipSync(await readFile(absolutePath)).byteLength
    : (await stat(absolutePath)).size;
  const status = bytes <= budget.maximumBytes ? 'PASS' : 'FAIL';

  console.log(
    `${status} ${budget.name}: ${formatBytes(bytes)} / ${formatBytes(budget.maximumBytes)}`,
  );

  if (status === 'FAIL') {
    failed = true;
  }
}

if (failed) {
  throw new Error('The production build exceeds one or more landing performance budgets.');
}

function matchAsset(html, pattern, name) {
  const match = html.match(pattern);

  if (! match?.[1]) {
    throw new Error(`Could not locate the ${name} in dist/index.html.`);
  }

  return match[1];
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
