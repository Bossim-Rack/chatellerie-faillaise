// Crée le projet Apps Script (une seule fois) puis remet le manifeste du projet.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

if (fs.existsSync(new URL('../.clasp.json', import.meta.url))) { console.log('Le projet Apps Script existe déjà (.clasp.json). Rien à faire.'); process.exit(0); }
const manifeste = fs.readFileSync(new URL('../serveur/appsscript.json', import.meta.url), 'utf8');
execFileSync('npx', ['clasp', 'create', '--type', 'standalone', '--title', 'Châtellerie de Faillaise', '--rootDir', 'serveur'], { stdio: 'inherit' });
fs.writeFileSync(new URL('../serveur/appsscript.json', import.meta.url), manifeste);
console.log('\n✓ Projet Apps Script créé. Étape suivante : npm run serveur:envoyer');
