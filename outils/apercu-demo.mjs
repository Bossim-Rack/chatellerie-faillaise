// Aperçu local AVEC les données de démo : repart d'une base de test neuve, la remplit d'exemples, puis lance l'aperçu.
// La vraie base Google n'est jamais touchée.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { charger } from './gas-simule.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fichier = path.join(racine, '.apercu/donnees.json');
fs.rmSync(path.dirname(fichier), { recursive: true, force: true });
const s = charger(path.join(racine, 'serveur/Code.gs'), fichier);
s.appeler('installer', []);
s.appeler('demo', []);
await import('./apercu.mjs');
