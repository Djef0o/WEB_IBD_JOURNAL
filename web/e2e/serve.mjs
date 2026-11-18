/*
 * Static server for tests: serves dist/ and applies EXACTLY what ../netlify.toml declares
 * (headers by path pattern, SPA redirect) so CSP and Trusted Types are exercised as in production.
 *
 *   node e2e/serve.mjs [port]      (default 4173; run `npm run build` first)
 *
 * The TOML subset parsed here is the one netlify.toml uses: [[headers]] / [headers.values] /
 * [[redirects]] tables with string values.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Minimal parser for the netlify.toml subset. */
export function parseNetlifyToml(text) {
  const headers = [];
  const redirects = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === '[[headers]]') {
      current = { for: '', values: {} };
      headers.push(current);
      continue;
    }
    if (line === '[[redirects]]') {
      current = { from: '', to: '', status: 301, force: false };
      redirects.push(current);
      continue;
    }
    if (line.startsWith('[')) {
      if (line === '[headers.values]') current = current ? { target: current.values } : null;
      else current = null;
      continue;
    }
    const match = /^([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|(\d+)|(true|false))$/.exec(line);
    if (!match || !current) continue;
    const [, key, str, num, bool] = match;
    const value = str !== undefined ? str.replace(/\\"/g, '"') : num !== undefined ? Number(num) : bool === 'true';
    if (current.target) current.target[key] = value;
    else current[key] = value;
  }
  return { headers, redirects };
}

/** Netlify path patterns: `*` (and a trailing `/*`) match any suffix. */
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

export async function startServer(port = 4173) {
  const config = parseNetlifyToml(await readFile(join(root, '..', 'netlify.toml'), 'utf8'));
  const rules = config.headers.map((h) => ({ matches: patternToRegExp(h.for), values: h.values }));
  const redirect = config.redirects.find((r) => r.status === 200);

  async function find(pathname) {
    const file = normalize(join(dist, pathname));
    if (file !== dist && !file.startsWith(dist + sep)) return null;
    for (const candidate of [file, join(file, 'index.html')]) {
      try {
        if ((await stat(candidate)).isFile()) return candidate;
      } catch {
        /* next candidate */
      }
    }
    return null;
  }

  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      let path = decodeURIComponent(pathname);
      let file = await find(path);
      let status = 200;
      // Netlify: an existing file wins over a non-forced rewrite.
      if (!file && redirect) {
        path = redirect.to;
        file = await find(path);
      }
      if (!file) {
        status = 404;
        res.writeHead(status, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      const headers = { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' };
      for (const rule of rules) if (rule.matches.test(pathname)) Object.assign(headers, rule.values);
      res.writeHead(status, headers).end(await readFile(file));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(error));
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.argv[2] ?? 4173);
  await startServer(port);
  console.log(`dist/ served with netlify.toml headers on http://127.0.0.1:${port}`);
}
