# Châtellerie de Faillaise

Registre de la Châtellerie : personnel de garde (grades, statuts, soldes, primes), missions, versement des soldes chaque semaine, taxes des entreprises et des thaneries (% des recettes déclarées), loyers des entreprises et des maisons, citoyenneté hebdomadaire, trésor et journal.
Chaque page peut être **invisible**, en **lecture seule** ou **modifiable** selon le grade. Le **Jarl** a tous les droits et règle les autres grades dans « Grades et droits ».

- **La page** (dossier `docs/`) est hébergée sur **GitHub Pages**.
- **Le serveur** (dossier `serveur/`) est un script **Google Apps Script** qui range les données dans un **Google Sheets** créé tout seul (« Châtellerie de Faillaise — Données »).
- Monnaie : **septimes**. Les semaines commencent le **lundi**. Un paiement peut être rangé sur une semaine passée.

```
docs/            la page (index.html, style.css, app.js, config.js)
serveur/         le serveur Apps Script (Code.gs, appsscript.json)
outils/          aperçu local et scripts de publication
```

---

## 1. Essayer sur ton ordinateur (aperçu local)

```bash
npm install
npm run apercu
```

Ouvre <http://localhost:8080>, choisis **Jarl** et choisis un mot de passe : c'est l'aperçu, les données restent dans `.apercu/` (supprime ce dossier pour repartir de zéro). Rien ne touche la vraie base.

---

## 2. Mettre en ligne (une seule fois)

### a. Le dépôt GitHub et la page

```bash
git init -b main
git add -A
git commit -m "Première version"
gh repo create chatellerie-faillaise --public --source . --push
```

Puis active GitHub Pages : **Settings → Pages → Source : Deploy from a branch → Branch : `main`, dossier `/docs` → Save**
(ou en une commande : `gh api -X POST repos/Bossim-Rack/chatellerie-faillaise/pages -f "source[branch]=main" -f "source[path]=/docs"`).

L'adresse du site sera : **https://bossim-rack.github.io/chatellerie-faillaise/**

### b. Le serveur Apps Script

```bash
npm run serveur:creer      # crée le projet Apps Script (une seule fois)
npm run serveur:envoyer    # envoie le code
```

Ouvre le projet (`npx clasp open`), choisis la fonction **`installer`** dans la liste en haut, clique **Exécuter** et **accepte les autorisations**. Cela crée la base, les grades, les statuts et le compte **Jarl**.

Puis publie le serveur :

```bash
npm run serveur:publier
```

La première fois, cela crée l'application Web et écrit son adresse dans `docs/config.js`. Envoie ensuite ce changement sur GitHub :

```bash
npm run site:publier
```

### c. Première connexion

Ouvre le site, choisis **Jarl** et **choisis ton mot de passe** (deux fois). Va dans **Grades et droits → Réglages** pour régler la taxe par défaut, la citoyenneté par semaine et le début du registre, puis crée les comptes dans **Comptes** : chacun choisira son mot de passe à sa première connexion.

---

## 3. Au quotidien

| Je modifie… | Commande |
|---|---|
| la page (`docs/`) | `npm run site:publier` (en ligne en 1 à 2 minutes) |
| le serveur (`serveur/Code.gs`) | `npm run serveur:publier` (l'adresse ne change pas) |

Tu peux ajouter un message : `npm run site:publier -- "Nouvelle page"`.

---

## Bon à savoir

- **Mot de passe oublié** : un compte qui a le droit de modifier « Comptes » coche « Réinitialiser le mot de passe » ; la personne en choisira un nouveau à sa prochaine connexion.
- **Retards** : comptés à partir du « Début du registre » (ou de la date « depuis » de chaque fiche, si elle est plus récente). La semaine en cours est « à payer », pas « en retard ».
- **Annuler un paiement** : dans « Trésor », bouton « Annuler » sur le mouvement ; la semaine redevient due.
- **Les données** sont dans le Google Sheets du compte qui a publié le serveur ; tu peux le consulter, mais modifie-les plutôt depuis l'appli.
- Seul un **Jarl** peut nommer ou modifier un Jarl, et il en reste toujours au moins un actif.
