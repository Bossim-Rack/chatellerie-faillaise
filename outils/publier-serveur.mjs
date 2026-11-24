// Publie le serveur : envoie le code, crée une version et l'applique au déploiement.
// La première fois, crée le déploiement et écrit son adresse dans docs/config.js.
// Ensuite, l'adresse ne change plus.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const fichierDep = new URL('../deploiement.json', import.meta.url);
const fichierConfig = new URL('../docs/config.js', import.meta.url);
const description = process.argv.slice(2).join(' ') || 'Publication du ' + new Date().toLocaleString('fr-FR');
const clasp = args => execFileSync('npx', ['clasp', ...args], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });

console.log(clasp(['push', '-f']));
let dep = fs.existsSync(fichierDep) ? JSON.parse(fs.readFileSync(fichierDep, 'utf8')) : null;
const sortie = clasp(dep ? ['deploy', '--deploymentId', dep.id, '--description', description] : ['deploy', '--description', description]);
console.log(sortie);
if (!dep) {
  const m = sortie.match(/(AKfy[\w-]+)/);
  if (!m) { console.error('✗ Identifiant de déploiement introuvable dans la réponse de clasp.'); process.exit(1); }
  dep = { id: m[1] };
  fs.writeFileSync(fichierDep, JSON.stringify(dep, null, 2) + '\n');
}
const url = 'https://script.google.com/macros/s/' + dep.id + '/exec';
fs.writeFileSync(fichierConfig, "// Adresse du serveur Apps Script (remplie automatiquement par « npm run serveur:publier »).\nwindow.CONFIG = {\n  api: '" + url + "'\n};\n");
console.log('✓ Serveur publié : ' + url + '\n  (docs/config.js est à jour — pense à « npm run site:publier » si c\'est la première fois.)');
