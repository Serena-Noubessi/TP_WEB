/**
 * Petit serveur de test : sert le site compilé (frontend-starter/dist/gpc/browser)
 * et relaie /api vers le backend. Si l'API ne répond pas, il renvoie 502 (comme
 * un vrai serveur ou le proxy d'Angular), ce qui permet de tester les messages d'erreur.
 *
 *   node tests-navigateur/serveur-test.mjs           # port 4300 → API 3001
 *   WEB_PORT=4301 API_PORT=3999 node tests-navigateur/serveur-test.mjs
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend-starter', 'dist', 'gpc', 'browser');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

export function startWebServer(webPort, apiPort) {
  if (!existsSync(path.join(ROOT, 'index.html'))) throw new Error('Site non compilé : lancez « npx ng build » dans frontend-starter');
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api')) {
      const upstream = http.request({ host: 'localhost', port: apiPort, path: req.url, method: req.method, headers: req.headers }, (answer) => {
        res.writeHead(answer.statusCode, answer.headers);
        answer.pipe(res);
      });
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('API injoignable');
      });
      req.pipe(upstream);
      return;
    }
    let file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    // Toute adresse inconnue renvoie index.html : c'est Angular qui affiche la bonne page.
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(webPort, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const webPort = Number(process.env.WEB_PORT ?? 4300);
  const apiPort = Number(process.env.API_PORT ?? 3001);
  await startWebServer(webPort, apiPort);
  console.log(`Site servi sur http://localhost:${webPort} (API relayée vers le port ${apiPort})`);
}
