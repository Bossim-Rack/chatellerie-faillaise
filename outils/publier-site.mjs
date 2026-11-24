// Envoie le site (dossier docs/) et le reste du projet sur GitHub. GitHub Pages se met à jour en 1 à 2 minutes.
import { execFileSync } from 'node:child_process';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
const message = process.argv.slice(2).join(' ') || 'Mise à jour du ' + new Date().toLocaleString('fr-FR');
git('add', '-A');
if (!git('status', '--porcelain').trim()) console.log('Rien de nouveau à envoyer.');
else { git('commit', '-m', message); console.log('✓ Enregistré : ' + message); }
execFileSync('git', ['push'], { stdio: 'inherit' });
console.log('✓ Envoyé sur GitHub. Le site sera à jour dans 1 à 2 minutes.');
