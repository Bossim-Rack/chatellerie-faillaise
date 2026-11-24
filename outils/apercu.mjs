// Aperçu local : http://localhost:8080 — la page de docs/ avec le serveur (serveur/Code.gs) exécuté sur ton ordinateur.
// Les données de test vont dans .apercu/donnees.json (jamais dans la vraie base Google).
// Pour repartir de zéro : supprime le dossier .apercu.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { charger } from './gas-simule.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(racine, 'docs');
const PORT = Number(process.env.PORT || 8080);
const fichierDonnees = path.join(racine, '.apercu/donnees.json');
const neuf = !fs.existsSync(fichierDonnees);
const serveur = charger(path.join(racine, 'serveur/Code.gs'), fichierDonnees);
if (neuf) serveur.appeler('installer', []);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && url === '/api') {
    let corps = '';
    req.on('data', c => { corps += c; });
    req.on('end', () => {
      let r;
      try { r = { ok: true, data: serveur.appeler('traiter', [JSON.parse(corps || '{}')]) }; }
      catch (e) { r = { ok: false, erreur: String(e && e.message || e) }; }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r));
    });
    return;
  }
  if (url === '/config.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'] }); res.end("window.CONFIG = { api: '/api' };"); return; }
  const f = path.join(docs, path.normalize(url === '/' ? 'index.html' : url).replace(/^([/\\]|\.\.[/\\])+/, ''));
  if (f.startsWith(docs) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  } else { res.writeHead(404); res.end('Introuvable'); }
}).listen(PORT, () => {
  console.log(`\n✓ Aperçu local : http://localhost:${PORT}`);
  console.log('  Compte de départ : « Jarl » — à la première connexion, choisis un mot de passe (aperçu local seulement).');
  console.log('  Données de test : .apercu/donnees.json (supprime le dossier .apercu pour repartir de zéro).');
  console.log('  Ctrl+C pour arrêter. Recharge la page après chaque modification.\n');
});
