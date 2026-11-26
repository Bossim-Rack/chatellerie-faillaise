/**
 * =====================================================================
 *  CHÂTELLERIE DE FAILLAISE — serveur (Google Apps Script)
 * ---------------------------------------------------------------------
 *  La page est hébergée sur GitHub Pages ; elle appelle ce serveur
 *  (application Web, méthode POST) pour lire et écrire les données.
 *  Les données sont dans le Google Sheets « Châtellerie de Faillaise —
 *  Données », créé automatiquement au premier lancement.
 *
 *  Première utilisation : exécuter « installer » depuis l'éditeur
 *  (accepter les autorisations). Cela crée la base, les grades et
 *  statuts de départ, et le compte du Jarl (qui choisira son mot de
 *  passe à sa première connexion).
 * =====================================================================
 */

const NOM_APPLI = 'Châtellerie de Faillaise';
const NOM_JARL_DEPART = 'Jarl';               // nom du premier compte (modifiable ensuite)
const DUREE_SESSION = 6 * 3600;               // 6 h

const TABLES = {
  Comptes: ['id', 'nom', 'grade', 'statut', 'prime', 'hash', 'sel', 'actif', 'note', 'cree_le', 'modifie_par', 'modifie_le'],
  Grades: ['id', 'nom', 'rang', 'salaire', 'garde', 'couleur', 'droits', 'systeme', 'modifie_par', 'modifie_le'],
  Statuts: ['id', 'nom', 'paye', 'couleur', 'modifie_par', 'modifie_le'],
  Missions: ['id', 'titre', 'type', 'lieu', 'debut', 'fin', 'statut', 'membres', 'description', 'compte_rendu', 'modifie_par', 'modifie_le'],
  Etablissements: ['id', 'categorie', 'nom', 'type', 'proprietaire', 'adresse', 'taux', 'loyer', 'depuis', 'actif', 'note', 'modifie_par', 'modifie_le'],
  Maisons: ['id', 'nom', 'adresse', 'occupant', 'loyer', 'depuis', 'actif', 'note', 'modifie_par', 'modifie_le'],
  Citoyens: ['id', 'nom', 'montant', 'depuis', 'actif', 'note', 'modifie_par', 'modifie_le'],
  Declarations: ['id', 'etablissement', 'semaine', 'recettes', 'taux', 'taxe', 'par', 'le'],
  Paiements: ['id', 'type', 'cible', 'semaine', 'montant', 'mouvement', 'note', 'par', 'le'],
  Tresor: ['id', 'date', 'semaine', 'sens', 'categorie', 'montant', 'libelle', 'ref', 'par', 'le'],
  Bareme: ['id', 'categorie', 'nom', 'amende', 'prison', 'description', 'actif', 'modifie_par', 'modifie_le'],
  Affaires: ['id', 'date', 'personne', 'infractions', 'amende', 'prison', 'agent', 'lieu', 'description', 'statut', 'modifie_par', 'modifie_le'],
  Detentions: ['id', 'personne', 'affaire', 'cellule', 'entree', 'sortie_prevue', 'sortie', 'motif', 'statut', 'note', 'modifie_par', 'modifie_le'],
  Avis: ['id', 'personne', 'signalement', 'motif', 'prime', 'danger', 'statut', 'depuis', 'note', 'modifie_par', 'modifie_le'],
  Annonces: ['id', 'titre', 'texte', 'epingle', 'grades', 'expire', 'par', 'le', 'modifie_le'],
  Rapports: ['id', 'mission', 'auteur', 'texte', 'statut', 'remarque', 'valide_par', 'le', 'modifie_le'],
  Equipements: ['id', 'nom', 'categorie', 'quantite', 'valeur', 'note', 'modifie_par', 'modifie_le'],
  Prets: ['id', 'equipement', 'membre', 'quantite', 'sortie', 'retour', 'etat', 'retenue', 'retenue_paiement', 'note', 'par', 'le'],
  Planning: ['id', 'semaine', 'jour', 'creneau', 'poste', 'membres', 'note', 'modifie_par', 'modifie_le'],
  Lois: ['id', 'numero', 'titre', 'categories', 'texte', 'mots_cles', 'infractions', 'statut', 'date', 'modifie_par', 'modifie_le', 'type'],
  Reglages: ['id', 'valeur'],
  Journal: ['date', 'par', 'action', 'detail']
};

/** Pages de l'appli dont l'accès se règle par grade (0 = invisible, 1 = lecture, 2 = modification). */
const PAGES = ['garde', 'missions', 'planning', 'armurerie', 'salaires', 'justice', 'lois', 'prison', 'recherches', 'entreprises', 'thaneries', 'maisons', 'citoyennete', 'tresor', 'bilan', 'annonces', 'comptes', 'journal', 'admin'];
/** Droits proposés pour les pages ajoutées après coup, tant que le Jarl ne les a pas réglés lui-même pour ce grade. */
const DROITS_NOUVEAUX = {
  intendant: { lois: 2, planning: 2, armurerie: 2, justice: 2, prison: 2, recherches: 2, bilan: 2, annonces: 2 },
  capitaine: { lois: 2, planning: 2, armurerie: 2, justice: 2, prison: 2, recherches: 2, bilan: 1, annonces: 2 },
  lieutenant: { lois: 1, planning: 2, armurerie: 2, justice: 2, prison: 2, recherches: 2, annonces: 1 },
  percepteur: { lois: 1, justice: 1, bilan: 1 },
  sergent: { lois: 1, planning: 1, armurerie: 1, justice: 2, prison: 2, recherches: 2 },
  garde: { lois: 1, planning: 1, armurerie: 1, justice: 1, prison: 1, recherches: 1 },
  recrue: { lois: 1, planning: 1, recherches: 1 }
};
const REGLAGES_DEFAUT = { taux_defaut: '10', citoyennete: '20', lancement: '' };

// =====================================================================
//  Point d'entrée : la page envoie { action, jeton, args } en POST
// =====================================================================
function doPost(e) {
  let reponse;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    reponse = { ok: true, data: traiter(req) };
  } catch (err) {
    reponse = { ok: false, erreur: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(reponse)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: NOM_APPLI + ' — serveur en ligne' })).setMimeType(ContentService.MimeType.JSON);
}

/** Exécute une action. [page, niveau requis, fonction] ; page null = toute personne connectée. */
const ACTIONS = {
  donnees: [null, 0, (c) => { initBareme_(); return donnees_(c); }],
  monMotDePasse: [null, 0, (c, a) => monMotDePasse_(c, a)],
  enregistrerCompte: ['comptes', 2, (c, a) => enregistrerCompte_(c, a)],
  majMembre: ['garde', 2, (c, a) => majMembre_(c, a)],
  enregistrerGrade: ['admin', 2, (c, a) => enregistrerGrade_(c, a)],
  supprimerGrade: ['admin', 2, (c, a) => supprimerGrade_(c, a)],
  enregistrerStatut: ['admin', 2, (c, a) => enregistrerStatut_(c, a)],
  supprimerStatut: ['admin', 2, (c, a) => supprimerStatut_(c, a)],
  enregistrerReglages: ['admin', 2, (c, a) => enregistrerReglages_(c, a)],
  enregistrerMission: ['missions', 2, (c, a) => enregistrerMission_(c, a)],
  supprimerMission: ['missions', 2, (c, a) => supprimerMission_(c, a)],
  payerSalaires: ['salaires', 2, (c, a) => payerSalaires_(c, a)],
  enregistrerEtablissement: [(a) => categorie_(a && a.categorie), 2, (c, a) => enregistrerEtablissement_(c, a)],
  declarer: [(a) => pageEtab_(a), 2, (c, a) => declarer_(c, a)],
  encaisserEtablissement: [(a) => pageEtab_(a), 2, (c, a) => encaisserEtablissement_(c, a)],
  enregistrerMaison: ['maisons', 2, (c, a) => enregistrerMaison_(c, a)],
  encaisserMaison: ['maisons', 2, (c, a) => encaisserMaison_(c, a)],
  enregistrerCitoyen: ['citoyennete', 2, (c, a) => enregistrerCitoyen_(c, a)],
  encaisserCitoyennete: ['citoyennete', 2, (c, a) => encaisserCitoyennete_(c, a)],
  ajouterMouvement: ['tresor', 2, (c, a) => ajouterMouvement_(c, a)],
  annulerPaiement: ['tresor', 2, (c, a) => annulerPaiement_(c, a)],
  journal: ['journal', 1, () => journalListe_()],
  // Justice
  enregistrerBareme: ['justice', 2, (c, a) => enregistrerBareme_(c, a)],
  supprimerBareme: ['justice', 2, (c, a) => supprimerBareme_(c, a)],
  enregistrerAffaire: ['justice', 2, (c, a) => enregistrerAffaire_(c, a)],
  supprimerAffaire: ['justice', 2, (c, a) => supprimerAffaire_(c, a)],
  encaisserAmende: ['justice', 2, (c, a) => encaisserAmende_(c, a)],
  enregistrerLoi: ['lois', 2, (c, a) => enregistrerLoi_(c, a)],
  supprimerLoi: ['lois', 2, (c, a) => supprimerLoi_(c, a)],
  enregistrerDetention: ['prison', 2, (c, a) => enregistrerDetention_(c, a)],
  libererDetenu: ['prison', 2, (c, a) => libererDetenu_(c, a)],
  supprimerDetention: ['prison', 2, (c, a) => supprimerDetention_(c, a)],
  enregistrerAvis: ['recherches', 2, (c, a) => enregistrerAvis_(c, a)],
  arreterAvis: ['recherches', 2, (c, a) => arreterAvis_(c, a)],
  supprimerAvis: ['recherches', 2, (c, a) => supprimerAvis_(c, a)],
  // Communication
  enregistrerAnnonce: ['annonces', 2, (c, a) => enregistrerAnnonce_(c, a)],
  supprimerAnnonce: ['annonces', 2, (c, a) => supprimerAnnonce_(c, a)],
  ecrireRapport: [null, 0, (c, a) => verrou_(() => ecrireRapport_(c, a))],
  supprimerRapport: [null, 0, (c, a) => verrou_(() => supprimerRapport_(c, a))],
  validerRapport: ['missions', 2, (c, a) => validerRapport_(c, a)],
  // Logistique
  enregistrerEquipement: ['armurerie', 2, (c, a) => enregistrerEquipement_(c, a)],
  supprimerEquipement: ['armurerie', 2, (c, a) => supprimerEquipement_(c, a)],
  preter: ['armurerie', 2, (c, a) => preter_(c, a)],
  retourPret: ['armurerie', 2, (c, a) => retourPret_(c, a)],
  enregistrerGarde: ['planning', 2, (c, a) => enregistrerGarde_(c, a)],
  supprimerGarde: ['planning', 2, (c, a) => supprimerGarde_(c, a)],
  copierPlanning: ['planning', 2, (c, a) => copierPlanning_(c, a)]
};
const PUBLIQUES = {
  listeConnexion: () => listeConnexion_(),
  connexion: (a) => connexion_(a),
  deconnexion: (a) => { if (a && a.jeton) CacheService.getScriptCache().remove('s_' + a.jeton); return true; }
};

function traiter(req) {
  const action = String(req && req.action || '');
  const args = (req && req.args) || {};
  MEMO_ = {};
  if (PUBLIQUES[action]) return PUBLIQUES[action](Object.assign({ jeton: req.jeton }, args));
  const def = ACTIONS[action];
  if (!def) throw new Error('Action inconnue : ' + action);
  const c = session_(req.jeton);
  const page = typeof def[0] === 'function' ? def[0](args) : def[0];
  if (page && niveau_(c, page) < def[1]) throw new Error('Vous n\'avez pas le droit de faire cela.');
  if (def[1] >= 2 || action === 'monMotDePasse') return verrou_(() => def[2](c, args));
  return def[2](c, args);
}

// =====================================================================
//  Base de données (Google Sheets)
// =====================================================================
let MEMO_ = {};
function classeur_() {
  if (MEMO_.ss) return MEMO_.ss;
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('DB_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(NOM_APPLI + ' — Données'); props.setProperty('DB_ID', ss.getId()); }
  Object.keys(TABLES).forEach(nom => {
    let sh = ss.getSheetByName(nom);
    if (!sh) {
      const vierge = ss.getSheets().find(s => s.getLastRow() === 0 && /^(Feuille|Sheet)/.test(s.getName()));
      sh = vierge ? vierge.setName(nom) : ss.insertSheet(nom);
      sh.getRange(1, 1, 1, TABLES[nom].length).setValues([TABLES[nom]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else if (sh.getRange(1, TABLES[nom].length).getValue() !== TABLES[nom][TABLES[nom].length - 1]) {
      sh.getRange(1, 1, 1, TABLES[nom].length).setValues([TABLES[nom]]).setFontWeight('bold');   // colonnes ajoutées après coup
    }
  });
  MEMO_.ss = ss;
  return ss;
}
function lire_(nom) {
  MEMO_.t = MEMO_.t || {};
  if (MEMO_.t[nom]) return MEMO_.t[nom];
  const sh = classeur_().getSheetByName(nom), ent = TABLES[nom], n = sh.getLastRow() - 1;
  const lignes = n > 0 ? sh.getRange(2, 1, n, ent.length).getValues() : [];
  MEMO_.t[nom] = lignes.map((r, i) => {
    const o = { _ligne: i + 2 };
    ent.forEach((h, j) => { o[h] = r[j] instanceof Date ? Utilities.formatDate(r[j], 'Europe/Paris', 'yyyy-MM-dd') : String(r[j] == null ? '' : r[j]); });
    return o;
  }).filter(o => o[ent[0]]);
  return MEMO_.t[nom];
}
function ecrire_(nom, o) {
  const sh = classeur_().getSheetByName(nom), ent = TABLES[nom];
  const v = [ent.map(h => o[h] == null ? '' : (typeof o[h] === 'object' ? JSON.stringify(o[h]) : String(o[h])))];
  if (o._ligne) sh.getRange(o._ligne, 1, 1, ent.length).setNumberFormat('@').setValues(v);
  else { o._ligne = sh.getLastRow() + 1; sh.getRange(o._ligne, 1, 1, ent.length).setNumberFormat('@').setValues(v); if (MEMO_.t && MEMO_.t[nom]) MEMO_.t[nom].push(o); }
  return o;
}
function supprimer_(nom, lignes) {
  const sh = classeur_().getSheetByName(nom);
  lignes.slice().sort((a, b) => b - a).forEach(l => sh.deleteRow(l));
  if (MEMO_.t) delete MEMO_.t[nom];
}
const sans_ = o => { const c = Object.assign({}, o); delete c._ligne; return c; };
const uid_ = p => p + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
function verrou_(fn) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }

// ---------- Petits outils ----------
const texte_ = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
const normal_ = t => String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const maintenant_ = () => Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
const aujourdhui_ = () => Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
function montant_(v, nom) {
  const n = Math.round(Number(String(v == null ? '' : v).replace(',', '.')) * 100) / 100;
  if (!(n >= 0) || n > 1e9) throw new Error((nom || 'Montant') + ' invalide.');
  return n;
}
function dateValide_(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T12:00:00Z');
  return isNaN(d.getTime()) ? '' : s;
}
/** Lundi de la semaine d'une date (aaaa-mm-jj). */
function lundi_(s) {
  const d = new Date((dateValide_(s) || aujourdhui_()) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function semaine_(v) { const s = dateValide_(v); if (!s) throw new Error('Semaine invalide.'); return lundi_(s); }
function reglages_() {
  const r = Object.assign({}, REGLAGES_DEFAUT);
  lire_('Reglages').forEach(x => { r[x.id] = x.valeur; });
  if (!r.lancement) r.lancement = lundi_(aujourdhui_());
  return r;
}
function journal_(qui, action, detail) {
  try {
    const sh = classeur_().getSheetByName('Journal');
    sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setNumberFormat('@').setValues([[maintenant_(), qui || '', action, String(detail || '').slice(0, 300)]]);
    if (sh.getLastRow() > 4000) sh.deleteRows(2, 500);
  } catch (e) {}
}
function journalListe_() {
  const sh = classeur_().getSheetByName('Journal'), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const d = Math.max(2, n + 2 - 800);
  return sh.getRange(d, 1, n + 2 - d, 4).getValues().map(r => ({ date: String(r[0]), par: String(r[1]), action: String(r[2]), detail: String(r[3]) })).filter(x => x.action).reverse();
}

// =====================================================================
//  Installation
// =====================================================================
function installer() {
  verrou_(() => {
    MEMO_ = {};
    const ss = classeur_();
    if (!lire_('Grades').length) {
      const T = n => JSON.stringify(PAGES.reduce((o, p) => { if (n[p] !== undefined) o[p] = n[p]; else if (n._ !== undefined) o[p] = n._; return o; }, {}));
      [
        ['jarl', 'Jarl', 100, 0, false, '#d4a73a', T({ _: 2 }), true],
        ['intendant', 'Intendant', 90, 300, false, '#8e44ad', T({ _: 2, admin: 0 }), false],
        ['capitaine', 'Capitaine', 70, 250, true, '#c0392b', T({ garde: 2, missions: 2, salaires: 2, entreprises: 1, thaneries: 1, maisons: 1, citoyennete: 1, tresor: 1, comptes: 1, journal: 1 }), false],
        ['lieutenant', 'Lieutenant', 60, 200, true, '#e67e22', T({ garde: 2, missions: 2, salaires: 1, entreprises: 1, thaneries: 1, maisons: 1, citoyennete: 1, journal: 1 }), false],
        ['percepteur', 'Percepteur', 50, 150, false, '#16a085', T({ entreprises: 2, thaneries: 2, maisons: 2, citoyennete: 2, tresor: 1 }), false],
        ['sergent', 'Sergent', 40, 150, true, '#2980b9', T({ garde: 1, missions: 2, entreprises: 1, maisons: 1, citoyennete: 1 }), false],
        ['garde', 'Garde', 20, 100, true, '#27ae60', T({ garde: 1, missions: 1 }), false],
        ['recrue', 'Recrue', 10, 60, true, '#7f8c8d', T({ missions: 1 }), false],
        ['citoyen', 'Citoyen', 0, 0, false, '#95a5a6', T({}), false]
      ].forEach(g => ecrire_('Grades', { id: g[0], nom: g[1], rang: g[2], salaire: g[3], garde: g[4] ? '1' : '', couleur: g[5], droits: g[6], systeme: g[7] ? '1' : '', modifie_par: 'installation', modifie_le: maintenant_() }));
    }
    if (!lire_('Statuts').length) {
      [['actif', 'En service', true, '#27ae60'], ['conge', 'En congé', false, '#d4a73a'], ['blesse', 'Blessé', true, '#e67e22'], ['suspendu', 'Suspendu', false, '#c0392b']]
        .forEach(s => ecrire_('Statuts', { id: s[0], nom: s[1], paye: s[2] ? '1' : '', couleur: s[3], modifie_par: 'installation', modifie_le: maintenant_() }));
    }
    if (!lire_('Reglages').some(r => r.id === 'lancement')) ecrire_('Reglages', { id: 'lancement', valeur: lundi_(aujourdhui_()) });
    if (!lire_('Comptes').some(c => c.grade === 'jarl')) {
      ecrire_('Comptes', { id: uid_('u'), nom: NOM_JARL_DEPART, grade: 'jarl', statut: 'actif', prime: '0', actif: '1', cree_le: maintenant_(), modifie_par: 'installation', modifie_le: maintenant_() });
    }
    if (!lire_('Bareme').length) { ajouterLignes_('Bareme', baremeDepart_()); PropertiesService.getScriptProperties().setProperty('BAREME_INIT', '1'); }
    journal_('installation', 'Installation', ss.getUrl());
    Logger.log('Base prête : ' + ss.getUrl());
  });
}

// =====================================================================
//  Comptes, connexion, droits
// =====================================================================
function grades_() {
  return lire_('Grades').map(g => {
    let d = {}; try { d = JSON.parse(g.droits || '{}'); } catch (e) { d = {}; }
    const prop = DROITS_NOUVEAUX[g.id] || {};
    const droits = {}; PAGES.forEach(p => { droits[p] = g.systeme === '1' ? 2 : Math.max(0, Math.min(2, Number(d[p] !== undefined ? d[p] : prop[p]) || 0)); });
    return { id: g.id, nom: g.nom, rang: Number(g.rang) || 0, salaire: Number(g.salaire) || 0, garde: g.garde === '1', couleur: g.couleur || '#7f8c8d', droits, systeme: g.systeme === '1' };
  }).sort((a, b) => b.rang - a.rang);
}
function statuts_() { return lire_('Statuts').map(s => ({ id: s.id, nom: s.nom, paye: s.paye === '1', couleur: s.couleur || '#7f8c8d' })); }
const estJarl_ = c => c.grade === 'jarl';
function niveau_(c, page) {
  if (estJarl_(c)) return 2;
  const g = grades_().find(x => x.id === c.grade);
  return g ? (g.droits[page] || 0) : 0;
}
function comptePublic_(c) {
  return { id: c.id, nom: c.nom, grade: c.grade, statut: c.statut, prime: Number(c.prime) || 0, actif: c.actif === '1', note: c.note, aMdp: !!c.hash, cree_le: c.cree_le };
}
function hacher_(mdp, sel) {
  let h = sel + '|' + mdp;
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + sel, Utilities.Charset.UTF_8));
  return h;
}
function mdpValide_(m) {
  m = String(m || '');
  if (m.length < 4) throw new Error('Le mot de passe doit faire au moins 4 caractères.');
  if (m.length > 100) throw new Error('Mot de passe trop long.');
  return m;
}
function listeConnexion_() {
  const gs = grades_();
  return lire_('Comptes').filter(c => c.actif === '1' && !estDemo_(c)).map(c => ({ nom: c.nom, nouveau: !c.hash, rang: (gs.find(g => g.id === c.grade) || {}).rang || 0 }))
    .sort((a, b) => b.rang - a.rang || a.nom.localeCompare(b.nom, 'fr')).map(x => ({ nom: x.nom, nouveau: x.nouveau }));
}
function connexion_(a) {
  const cle = normal_(a.nom), mdp = String(a.mdp || '');
  if (!cle || !mdp) throw new Error('Indiquez votre nom et votre mot de passe.');
  const cache = CacheService.getScriptCache(), ce = 'essais_' + Utilities.base64EncodeWebSafe(cle).slice(0, 60);
  const essais = Number(cache.get(ce) || 0);
  if (essais >= 5) throw new Error('Trop d\'essais manqués : réessayez dans 10 minutes.');
  return verrou_(() => {
    const c = lire_('Comptes').find(x => x.actif === '1' && !estDemo_(x) && normal_(x.nom) === cle);
    const echec = () => { cache.put(ce, String(essais + 1), 600); throw new Error('Nom ou mot de passe incorrect.'); };
    if (!c) echec();
    let premiere = false;
    if (!c.hash) {
      if (a.confirmation === undefined || a.confirmation === null) throw new Error('PREMIERE: Première connexion : choisissez votre mot de passe et confirmez-le.');
      if (String(a.confirmation) !== mdp) throw new Error('Les deux mots de passe ne sont pas identiques.');
      mdpValide_(mdp);
      c.sel = Utilities.getUuid(); c.hash = hacher_(mdp, c.sel);
      ecrire_('Comptes', c);
      premiere = true;
      journal_(c.nom, 'Première connexion', 'mot de passe choisi');
    } else if (hacher_(mdp, c.sel) !== c.hash) echec();
    cache.remove(ce);
    const jeton = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
    cache.put('s_' + jeton, c.id, DUREE_SESSION);
    return { jeton, premiere };
  });
}
function session_(jeton) {
  if (!jeton || String(jeton).length > 100) throw new Error('SESSION: Connectez-vous.');
  const cache = CacheService.getScriptCache(), id = cache.get('s_' + jeton);
  if (!id) throw new Error('SESSION: Votre session a expiré, reconnectez-vous.');
  const c = lire_('Comptes').find(x => x.id === id && x.actif === '1');
  if (!c) throw new Error('SESSION: Compte introuvable ou désactivé.');
  if (!c.hash) throw new Error('SESSION: Votre mot de passe a été réinitialisé, reconnectez-vous.');
  cache.put('s_' + jeton, id, DUREE_SESSION);
  return c;
}
function monMotDePasse_(c, a) {
  if (hacher_(String(a.ancien || ''), c.sel) !== c.hash) throw new Error('Mot de passe actuel incorrect.');
  const m = mdpValide_(a.nouveau);
  c.sel = Utilities.getUuid(); c.hash = hacher_(m, c.sel);
  ecrire_('Comptes', c);
  journal_(c.nom, 'Mot de passe changé', '');
  return true;
}

/** Tout ce que la page affiche, limité aux pages que le grade permet de voir. */
function donnees_(c) {
  const voit = p => niveau_(c, p) >= 1;
  const gs = grades_(), sts = statuts_();
  const droits = {}; PAGES.forEach(p => { droits[p] = niveau_(c, p); });
  const comptes = lire_('Comptes');
  const d = {
    moi: Object.assign(comptePublic_(c), { droits, jarl: estJarl_(c) }),
    grades: gs, statuts: sts, reglages: reglages_(), aujourdhui: aujourdhui_(),
    // la liste des membres (noms, grades) sert partout : missions, salaires…
    membres: comptes.filter(x => x.actif === '1' || voit('comptes')).map(x => {
      const p = comptePublic_(x);
      if (!voit('comptes')) { delete p.note; delete p.aMdp; }
      if (!voit('garde') && !voit('salaires') && !voit('comptes') && x.id !== c.id) delete p.prime;
      return p;
    })
  };
  if (voit('missions')) d.missions = lire_('Missions').map(m => Object.assign(sans_(m), { membres: m.membres ? m.membres.split(',') : [] }));
  else d.missions = lire_('Missions').filter(m => (m.membres || '').split(',').indexOf(c.id) >= 0).map(m => Object.assign(sans_(m), { membres: m.membres.split(',') }));
  // la page Bilan a besoin de tout ce qui rapporte ou coûte
  const bil = voit('bilan');
  if (voit('entreprises') || voit('thaneries') || bil) d.etablissements = lire_('Etablissements').filter(e => bil || voit(e.categorie === 'thanerie' ? 'thaneries' : 'entreprises')).map(sans_);
  if (voit('entreprises') || voit('thaneries') || bil) d.declarations = lire_('Declarations').map(sans_);
  if (voit('maisons') || bil) d.maisons = lire_('Maisons').map(sans_);
  if (voit('citoyennete') || bil) d.citoyens = lire_('Citoyens').map(sans_);
  const typesVus = { taxe: voit('entreprises') || voit('thaneries') || bil, loyer_etab: voit('entreprises') || voit('thaneries') || bil, loyer_maison: voit('maisons') || bil, citoyennete: voit('citoyennete') || bil, salaire: voit('salaires') || bil, amende: voit('justice') || bil };
  d.paiements = lire_('Paiements').filter(p => typesVus[p.type] || (p.type === 'salaire' && p.cible === c.id)).map(sans_);
  if (voit('tresor') || voit('bilan')) d.tresor = lire_('Tresor').map(sans_);
  donneesPlus_(c, d, voit);
  return d;
}

function enregistrerCompte_(qui, a) {
  const tous = lire_('Comptes');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  if (a.id && !ex) throw new Error('Compte introuvable.');
  const nom = texte_(a.nom, 40);
  if (!nom) throw new Error('Donnez un nom.');
  if (tous.some(x => x !== ex && x.actif === '1' && normal_(x.nom) === normal_(nom))) throw new Error('Un compte « ' + nom + ' » existe déjà.');
  const gs = grades_(), g = gs.find(x => x.id === String(a.grade));
  if (!g) throw new Error('Choisissez un grade.');
  if ((g.id === 'jarl' || (ex && ex.grade === 'jarl')) && !estJarl_(qui)) throw new Error('Seul le Jarl peut nommer ou modifier un Jarl.');
  if (!statuts_().some(s => s.id === String(a.statut))) throw new Error('Choisissez un statut.');
  const o = ex || { id: uid_('u'), cree_le: maintenant_(), hash: '', sel: '' };
  Object.assign(o, { nom, grade: g.id, statut: String(a.statut), prime: montant_(a.prime || 0, 'Prime'), actif: a.actif === false ? '' : '1', note: texte_(a.note, 500), modifie_par: qui.nom, modifie_le: maintenant_() });
  if (a.reinitialiser) { o.hash = ''; o.sel = ''; }
  if (!tous.some(x => x.actif === '1' && x.grade === 'jarl' && x !== o) && !(o.actif === '1' && o.grade === 'jarl')) throw new Error('Il faut garder au moins un Jarl actif.');
  ecrire_('Comptes', o);
  journal_(qui.nom, ex ? 'Compte modifié' : 'Compte créé', nom + ' (' + g.nom + ')' + (a.reinitialiser ? ' — mot de passe réinitialisé' : '') + (o.actif ? '' : ' — désactivé'));
  return donnees_(qui);
}
/** Depuis la page Garde : grade, statut et prime d'un membre. */
function majMembre_(qui, a) {
  const c = lire_('Comptes').find(x => x.id === String(a.id));
  if (!c) throw new Error('Membre introuvable.');
  const g = grades_().find(x => x.id === String(a.grade || c.grade));
  if (!g) throw new Error('Grade inconnu.');
  if ((g.id === 'jarl' || c.grade === 'jarl') && !estJarl_(qui)) throw new Error('Seul le Jarl peut nommer ou modifier un Jarl.');
  if (a.statut && !statuts_().some(s => s.id === String(a.statut))) throw new Error('Statut inconnu.');
  Object.assign(c, { grade: g.id, statut: a.statut ? String(a.statut) : c.statut, prime: a.prime !== undefined ? montant_(a.prime, 'Prime') : c.prime, modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Comptes', c);
  journal_(qui.nom, 'Membre modifié', c.nom + ' : ' + g.nom);
  return donnees_(qui);
}

// ---------- Grades, statuts, réglages (Jarl) ----------
function enregistrerGrade_(qui, a) {
  const tous = lire_('Grades');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  const nom = texte_(a.nom, 40);
  if (!nom) throw new Error('Donnez un nom au grade.');
  if (tous.some(x => x !== ex && normal_(x.nom) === normal_(nom))) throw new Error('Ce grade existe déjà.');
  const droits = {}; PAGES.forEach(p => { droits[p] = Math.max(0, Math.min(2, Number(a.droits && a.droits[p]) || 0)); });
  const o = ex || { id: uid_('g') };
  Object.assign(o, { nom, rang: Math.max(0, Math.min(99, Math.round(Number(a.rang) || 0))), salaire: montant_(a.salaire || 0, 'Salaire'), garde: a.garde ? '1' : '', couleur: /^#[0-9a-f]{6}$/i.test(a.couleur) ? a.couleur : '#7f8c8d', modifie_par: qui.nom, modifie_le: maintenant_() });
  if (o.systeme === '1') { o.rang = 100; o.droits = JSON.stringify(PAGES.reduce((x, p) => { x[p] = 2; return x; }, {})); }
  else o.droits = JSON.stringify(droits);
  ecrire_('Grades', o);
  journal_(qui.nom, ex ? 'Grade modifié' : 'Grade créé', nom);
  return donnees_(qui);
}
function supprimerGrade_(qui, a) {
  const g = lire_('Grades').find(x => x.id === String(a.id));
  if (!g) throw new Error('Grade introuvable.');
  if (g.systeme === '1') throw new Error('Le grade de Jarl ne peut pas être supprimé.');
  const n = lire_('Comptes').filter(c => c.grade === g.id).length;
  if (n) throw new Error('Ce grade est encore porté par ' + n + ' compte(s) : changez-leur de grade d\'abord.');
  supprimer_('Grades', [g._ligne]);
  journal_(qui.nom, 'Grade supprimé', g.nom);
  return donnees_(qui);
}
function enregistrerStatut_(qui, a) {
  const tous = lire_('Statuts');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  const nom = texte_(a.nom, 40);
  if (!nom) throw new Error('Donnez un nom au statut.');
  if (tous.some(x => x !== ex && normal_(x.nom) === normal_(nom))) throw new Error('Ce statut existe déjà.');
  const o = ex || { id: uid_('s') };
  Object.assign(o, { nom, paye: a.paye ? '1' : '', couleur: /^#[0-9a-f]{6}$/i.test(a.couleur) ? a.couleur : '#7f8c8d', modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Statuts', o);
  journal_(qui.nom, ex ? 'Statut modifié' : 'Statut créé', nom);
  return donnees_(qui);
}
function supprimerStatut_(qui, a) {
  const s = lire_('Statuts').find(x => x.id === String(a.id));
  if (!s) throw new Error('Statut introuvable.');
  const n = lire_('Comptes').filter(c => c.statut === s.id).length;
  if (n) throw new Error('Ce statut est encore utilisé par ' + n + ' compte(s).');
  if (lire_('Statuts').length <= 1) throw new Error('Il faut garder au moins un statut.');
  supprimer_('Statuts', [s._ligne]);
  journal_(qui.nom, 'Statut supprimé', s.nom);
  return donnees_(qui);
}
function enregistrerReglages_(qui, a) {
  const r = { taux_defaut: String(Math.min(100, montant_(a.taux_defaut, 'Taux'))), citoyennete: String(montant_(a.citoyennete, 'Citoyenneté')), lancement: lundi_(dateValide_(a.lancement) || reglages_().lancement) };
  const ex = lire_('Reglages');
  Object.keys(r).forEach(k => { const o = ex.find(x => x.id === k) || { id: k }; o.valeur = r[k]; ecrire_('Reglages', o); });
  journal_(qui.nom, 'Réglages', 'taxe ' + r.taux_defaut + ' %, citoyenneté ' + r.citoyennete + ', départ ' + r.lancement);
  return donnees_(qui);
}

// ---------- Missions ----------
const STATUTS_MISSION = ['prevue', 'en_cours', 'terminee', 'annulee'];
function enregistrerMission_(qui, a) {
  const tous = lire_('Missions');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  if (a.id && !ex) throw new Error('Mission introuvable.');
  const titre = texte_(a.titre, 80);
  if (!titre) throw new Error('Donnez un titre à la mission.');
  const ids = {}; lire_('Comptes').forEach(c => { ids[c.id] = true; });
  const membres = (Array.isArray(a.membres) ? a.membres : []).map(String).filter((x, i, t) => ids[x] && t.indexOf(x) === i);
  const o = ex || { id: uid_('m') };
  Object.assign(o, { titre, type: texte_(a.type, 40), lieu: texte_(a.lieu, 80), debut: dateValide_(a.debut), fin: dateValide_(a.fin), statut: STATUTS_MISSION.indexOf(a.statut) >= 0 ? a.statut : 'prevue',
    membres: membres.join(','), description: texte_(a.description, 3000), compte_rendu: texte_(a.compte_rendu, 5000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Missions', o);
  journal_(qui.nom, ex ? 'Mission modifiée' : 'Mission créée', titre);
  return donnees_(qui);
}
function supprimerMission_(qui, a) {
  const m = lire_('Missions').find(x => x.id === String(a.id));
  if (!m) throw new Error('Mission introuvable.');
  supprimer_('Missions', [m._ligne]);
  journal_(qui.nom, 'Mission supprimée', m.titre);
  return donnees_(qui);
}

// ---------- Paiements et trésor ----------
function mouvement_(qui, sens, categorie, montant, libelle, semaine, ref) {
  return ecrire_('Tresor', { id: uid_('t'), date: aujourdhui_(), semaine: semaine || lundi_(aujourdhui_()), sens, categorie, montant: String(montant), libelle: texte_(libelle, 200), ref: ref || '', par: qui.nom, le: maintenant_() });
}
function payer_(qui, type, cible, semaine, montant, libelle, note) {
  if (lire_('Paiements').some(p => p.type === type && p.cible === cible && p.semaine === semaine)) throw new Error('Déjà réglé pour la semaine du ' + semaine.split('-').reverse().join('/') + '.');
  const id = uid_('p');
  const sens = type === 'salaire' ? 'sortie' : 'entree';
  const cat = { taxe: 'Taxes', loyer_etab: 'Loyers', loyer_maison: 'Loyers', citoyennete: 'Citoyenneté', salaire: 'Salaires', amende: 'Amendes' }[type];
  const t = mouvement_(qui, sens, cat, montant, libelle, semaine, id);
  return ecrire_('Paiements', { id, type, cible, semaine, montant: String(montant), mouvement: t.id, note: texte_(note, 200), par: qui.nom, le: maintenant_() });
}
function annulerPaiement_(qui, a) {
  const p = lire_('Paiements').find(x => x.id === String(a.id));
  if (!p) throw new Error('Paiement introuvable.');
  const t = lire_('Tresor').find(x => x.id === p.mouvement);
  if (t) supprimer_('Tresor', [t._ligne]);
  supprimer_('Paiements', [lire_('Paiements').find(x => x.id === p.id)._ligne]);
  if (p.type === 'salaire') lire_('Prets').filter(x => x.retenue_paiement === p.id).forEach(x => { x.retenue_paiement = ''; ecrire_('Prets', x); });   // la retenue redevient à prélever
  journal_(qui.nom, 'Paiement annulé', p.type + ' ' + p.montant + ' (semaine du ' + p.semaine + ')');
  return donnees_(qui);
}
function ajouterMouvement_(qui, a) {
  const sens = a.sens === 'sortie' ? 'sortie' : 'entree';
  const m = montant_(a.montant);
  if (!m) throw new Error('Indiquez un montant.');
  const lib = texte_(a.libelle, 200);
  if (!lib) throw new Error('Indiquez un libellé.');
  mouvement_(qui, sens, texte_(a.categorie, 40) || (sens === 'sortie' ? 'Dépenses' : 'Recettes diverses'), m, lib, a.semaine ? semaine_(a.semaine) : '', '');
  journal_(qui.nom, sens === 'sortie' ? 'Dépense' : 'Recette', lib + ' : ' + m);
  return donnees_(qui);
}

// ---------- Salaires ----------
/** Paie les membres demandés (ou tous ceux qui sont payables) pour une semaine. */
function payerSalaires_(qui, a) {
  const semaine = semaine_(a.semaine), gs = grades_(), sts = statuts_();
  const cibles = Array.isArray(a.membres) && a.membres.length ? a.membres.map(String) : null;
  const deja = {}; lire_('Paiements').filter(p => p.type === 'salaire' && p.semaine === semaine).forEach(p => { deja[p.cible] = true; });
  let n = 0, total = 0;
  lire_('Comptes').filter(c => c.actif === '1' && (!cibles || cibles.indexOf(c.id) >= 0)).forEach(c => {
    const g = gs.find(x => x.id === c.grade), s = sts.find(x => x.id === c.statut);
    if (!g || !g.garde || !s || !s.paye || deja[c.id]) return;
    const m = Math.round((g.salaire + (Number(c.prime) || 0)) * 100) / 100;
    if (!m) return;
    // retenues sur solde (équipement perdu ou abîmé) : prélevées tant qu'elles tiennent dans le solde
    let r = 0; const appliquees = [];
    lire_('Prets').filter(x => x.membre === c.id && Number(x.retenue) > 0 && !x.retenue_paiement).forEach(x => { const v = Number(x.retenue); if (r + v <= m) { r += v; appliquees.push(x); } });
    const net = Math.round((m - r) * 100) / 100;
    const p = payer_(qui, 'salaire', c.id, semaine, net, 'Salaire de ' + c.nom + ' (' + g.nom + ')' + (r ? ' — retenue de ' + r + ' pour équipement' : ''));
    appliquees.forEach(x => { x.retenue_paiement = p.id; ecrire_('Prets', x); });
    n++; total += net;
  });
  if (!n) throw new Error('Personne à payer pour cette semaine (déjà payés, en congé ou hors de la garde).');
  journal_(qui.nom, 'Salaires', n + ' membre(s), ' + total + ' septimes, semaine du ' + semaine);
  return donnees_(qui);
}

// ---------- Établissements (entreprises et thaneries) ----------
const categorie_ = c => c === 'thanerie' ? 'thaneries' : 'entreprises';
function pageEtab_(a) { const e = lire_('Etablissements').find(x => x.id === String(a && a.etablissement)); return categorie_(e ? e.categorie : ''); }
function enregistrerEtablissement_(qui, a) {
  const tous = lire_('Etablissements');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  if (a.id && !ex) throw new Error('Établissement introuvable.');
  const nom = texte_(a.nom, 80);
  if (!nom) throw new Error('Donnez un nom.');
  const cat = a.categorie === 'thanerie' ? 'thanerie' : 'entreprise';
  if (ex && ex.categorie !== cat) throw new Error('Catégorie non modifiable.');
  const taux = String(a.taux == null ? '' : a.taux).trim() === '' ? '' : String(Math.min(100, montant_(a.taux, 'Taux')));
  const o = ex || { id: uid_('e'), categorie: cat };
  Object.assign(o, { nom, type: texte_(a.type, 40), proprietaire: texte_(a.proprietaire, 60), adresse: texte_(a.adresse, 120), taux, loyer: montant_(a.loyer || 0, 'Loyer'),
    depuis: lundi_(dateValide_(a.depuis) || reglages_().lancement), actif: a.actif === false ? '' : '1', note: texte_(a.note, 1000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Etablissements', o);
  journal_(qui.nom, ex ? 'Établissement modifié' : 'Établissement ajouté', nom + (o.actif ? '' : ' (fermé)'));
  return donnees_(qui);
}
/** Déclaration des recettes d'une semaine : calcule la taxe (modifiable tant qu'elle n'est pas encaissée). */
function declarer_(qui, a) {
  const e = lire_('Etablissements').find(x => x.id === String(a.etablissement));
  if (!e) throw new Error('Établissement introuvable.');
  const semaine = semaine_(a.semaine), recettes = montant_(a.recettes, 'Recettes');
  if (lire_('Paiements').some(p => p.type === 'taxe' && p.cible === e.id && p.semaine === semaine)) throw new Error('La taxe de cette semaine est déjà encaissée : annulez le paiement pour corriger.');
  const taux = Number(e.taux !== '' ? e.taux : reglages_().taux_defaut) || 0;
  const taxe = Math.round(recettes * taux) / 100;
  const ex = lire_('Declarations').find(d => d.etablissement === e.id && d.semaine === semaine);
  const o = ex || { id: uid_('d'), etablissement: e.id, semaine };
  Object.assign(o, { recettes: String(recettes), taux: String(taux), taxe: String(taxe), par: qui.nom, le: maintenant_() });
  ecrire_('Declarations', o);
  journal_(qui.nom, 'Déclaration', e.nom + ' : ' + recettes + ' de recettes, taxe ' + taxe + ' (semaine du ' + semaine + ')');
  if (a.encaisser) payer_(qui, 'taxe', e.id, semaine, taxe, 'Taxe ' + e.nom + ' (' + taux + ' % de ' + recettes + ')');
  return donnees_(qui);
}
function encaisserEtablissement_(qui, a) {
  const e = lire_('Etablissements').find(x => x.id === String(a.etablissement));
  if (!e) throw new Error('Établissement introuvable.');
  const semaine = semaine_(a.semaine);
  if (a.quoi === 'taxe') {
    const d = lire_('Declarations').find(x => x.etablissement === e.id && x.semaine === semaine);
    if (!d) throw new Error('Pas de déclaration de recettes pour cette semaine.');
    payer_(qui, 'taxe', e.id, semaine, Number(d.taxe), 'Taxe ' + e.nom + ' (' + d.taux + ' % de ' + d.recettes + ')', a.note);
  } else {
    if (!(Number(e.loyer) > 0)) throw new Error('Cet établissement n\'a pas de loyer.');
    payer_(qui, 'loyer_etab', e.id, semaine, Number(e.loyer), 'Loyer ' + e.nom, a.note);
  }
  journal_(qui.nom, a.quoi === 'taxe' ? 'Taxe encaissée' : 'Loyer encaissé', e.nom + ' (semaine du ' + semaine + ')');
  return donnees_(qui);
}

// ---------- Maisons ----------
function enregistrerMaison_(qui, a) {
  const tous = lire_('Maisons');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  if (a.id && !ex) throw new Error('Maison introuvable.');
  const nom = texte_(a.nom, 80);
  if (!nom) throw new Error('Donnez un nom à la maison.');
  const o = ex || { id: uid_('h') };
  Object.assign(o, { nom, adresse: texte_(a.adresse, 120), occupant: texte_(a.occupant, 60), loyer: montant_(a.loyer || 0, 'Loyer'), depuis: lundi_(dateValide_(a.depuis) || reglages_().lancement),
    actif: a.actif === false ? '' : '1', note: texte_(a.note, 1000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Maisons', o);
  journal_(qui.nom, ex ? 'Maison modifiée' : 'Maison ajoutée', nom);
  return donnees_(qui);
}
function encaisserMaison_(qui, a) {
  const h = lire_('Maisons').find(x => x.id === String(a.maison));
  if (!h) throw new Error('Maison introuvable.');
  const semaines = (Array.isArray(a.semaines) ? a.semaines : [a.semaine]).map(semaine_);
  if (!(Number(h.loyer) > 0)) throw new Error('Cette maison n\'a pas de loyer.');
  semaines.forEach(s => payer_(qui, 'loyer_maison', h.id, s, Number(h.loyer), 'Loyer ' + h.nom + (h.occupant ? ' (' + h.occupant + ')' : ''), a.note));
  journal_(qui.nom, 'Loyer encaissé', h.nom + ' : ' + semaines.length + ' semaine(s)');
  return donnees_(qui);
}

// ---------- Citoyenneté ----------
function enregistrerCitoyen_(qui, a) {
  const tous = lire_('Citoyens');
  const ex = a.id ? tous.find(x => x.id === String(a.id)) : null;
  if (a.id && !ex) throw new Error('Citoyen introuvable.');
  const nom = texte_(a.nom, 60);
  if (!nom) throw new Error('Donnez un nom.');
  if (tous.some(x => x !== ex && x.actif === '1' && normal_(x.nom) === normal_(nom))) throw new Error('« ' + nom + ' » est déjà inscrit.');
  const o = ex || { id: uid_('c') };
  Object.assign(o, { nom, montant: String(a.montant == null ? '' : a.montant).trim() === '' ? '' : String(montant_(a.montant)), depuis: lundi_(dateValide_(a.depuis) || aujourdhui_()),
    actif: a.actif === false ? '' : '1', note: texte_(a.note, 1000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Citoyens', o);
  journal_(qui.nom, ex ? 'Citoyen modifié' : 'Citoyen inscrit', nom);
  return donnees_(qui);
}
/** Encaisse une ou plusieurs semaines de citoyenneté (les semaines choisies, passées comprises). */
function encaisserCitoyennete_(qui, a) {
  const c = lire_('Citoyens').find(x => x.id === String(a.citoyen));
  if (!c) throw new Error('Citoyen introuvable.');
  const semaines = (Array.isArray(a.semaines) ? a.semaines : []).map(semaine_).filter((s, i, t) => t.indexOf(s) === i).sort();
  if (!semaines.length) throw new Error('Choisissez au moins une semaine.');
  if (semaines.length > 52) throw new Error('52 semaines au maximum en une fois.');
  const m = Number(c.montant !== '' ? c.montant : reglages_().citoyennete) || 0;
  semaines.forEach(s => payer_(qui, 'citoyennete', c.id, s, m, 'Citoyenneté ' + c.nom, a.note));
  journal_(qui.nom, 'Citoyenneté', c.nom + ' : ' + semaines.length + ' semaine(s), ' + (m * semaines.length) + ' septimes');
  return donnees_(qui);
}

// =====================================================================
//  Données de démonstration (fictives)
//  « demo » : remplit l'appli d'exemples sur les 6 dernières semaines.
//  « viderDemo » : retire tout ce qui a été créé par « demo ».
//  Les comptes de démo ne peuvent pas se connecter.
// =====================================================================
const estDemo_ = x => /^demo/.test(String(x && x.id || ''));

/** Ajoute plusieurs lignes d'un coup (beaucoup plus rapide qu'une par une). */
function ajouterLignes_(nom, objets) {
  if (!objets.length) return;
  const sh = classeur_().getSheetByName(nom), ent = TABLES[nom];
  const v = objets.map(o => ent.map(h => o[h] == null ? '' : (typeof o[h] === 'object' ? JSON.stringify(o[h]) : String(o[h]))));
  sh.getRange(sh.getLastRow() + 1, 1, v.length, ent.length).setNumberFormat('@').setValues(v);
  if (MEMO_.t) delete MEMO_.t[nom];
}

function demo() {
  verrou_(() => {
    MEMO_ = {};
    if (!lire_('Grades').length) throw new Error('Lance d\'abord « installer ».');
    if (lire_('Comptes').some(estDemo_)) throw new Error('Les données de démo sont déjà là. Lance « viderDemo » pour les retirer avant de recommencer.');
    let graine = 7;
    const hasard = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
    const entre = (a, b) => Math.round(a + hasard() * (b - a));
    const PAR = 'Démo', LE = maintenant_();
    const sc = lundi_(aujourdhui_());
    const sem = k => { const d = new Date(sc + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7 * k); return d.toISOString().slice(0, 10); };
    const jour = (s, j) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + j); return d.toISOString().slice(0, 10); };
    const S = [sem(-5), sem(-4), sem(-3), sem(-2), sem(-1), sem(0)];   // 6 semaines, la dernière = en cours
    const id = p => 'demo' + p + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    const gs = grades_(), sal = g => (gs.find(x => x.id === g) || {}).salaire || 0, garde = g => !!(gs.find(x => x.id === g) || {}).garde;
    const sts = statuts_(), paye = st => !!(sts.find(x => x.id === st) || {}).paye;
    const comptes = [], missions = [], etabs = [], decls = [], maisons = [], citoyens = [], paiements = [], tresor = [];

    // Paiement + mouvement au trésor
    const payer = (type, cible, semaine, montant, libelle) => {
      const pid = id('p'), tid = id('t');
      const sens = type === 'salaire' ? 'sortie' : 'entree';
      const cat = { taxe: 'Taxes', loyer_etab: 'Loyers', loyer_maison: 'Loyers', citoyennete: 'Citoyenneté', salaire: 'Salaires', amende: 'Amendes' }[type];
      tresor.push({ id: tid, date: jour(semaine, entre(0, 4)), semaine, sens, categorie: cat, montant: String(montant), libelle, ref: pid, par: PAR, le: LE });
      paiements.push({ id: pid, type, cible, semaine, montant: String(montant), mouvement: tid, note: '', par: PAR, le: LE });
    };
    const mouv = (sens, categorie, montant, libelle, semaine) => tresor.push({ id: id('t'), date: jour(semaine, entre(0, 4)), semaine, sens, categorie, montant: String(montant), libelle, ref: '', par: PAR, le: LE });

    // ---------- Personnel ----------
    [
      ['Dame Helga', 'intendant', 'actif', 0, 'Tient les registres du trésor.'],
      ['Hrolf Main-de-Fer', 'capitaine', 'actif', 50, 'Capitaine de la garde depuis dix hivers.'],
      ['Brynja la Rousse', 'lieutenant', 'actif', 20, ''],
      ['Aldric le Percepteur', 'percepteur', 'actif', 0, 'Collecte les taxes du port.'],
      ['Torvald Œil-de-Corbeau', 'sergent', 'actif', 10, ''],
      ['Eirik', 'garde', 'actif', 0, ''],
      ['Solveig', 'garde', 'actif', 15, 'Meilleure archère de la garde.'],
      ['Gunnar le Grand', 'garde', 'blesse', 0, 'Blessé à la jambe lors de l\'escorte du convoi.'],
      ['Ingrid', 'garde', 'conge', 0, 'En congé chez sa famille, à Rorikbourg.'],
      ['Kjell', 'recrue', 'actif', 0, ''],
      ['Astrid', 'recrue', 'actif', 0, ''],
      ['Ulfric Pied-Léger', 'garde', 'suspendu', 0, 'Suspendu : ivre pendant son tour de garde.']
    ].forEach(c => comptes.push({ id: id('u'), nom: c[0], grade: c[1], statut: c[2], prime: String(c[3]), hash: '', sel: '', actif: '1', note: c[4], cree_le: LE, modifie_par: PAR, modifie_le: LE }));
    const qui = n => comptes.find(c => c.nom.indexOf(n) === 0).id;

    // Soldes versés les 5 semaines passées (pas la semaine en cours)
    S.slice(0, 5).forEach((s, i) => comptes.forEach(c => {
      if (!garde(c.grade) || !paye(c.statut)) return;
      if (c.nom === 'Gunnar le Grand' && i < 2) return;
      const m = sal(c.grade) + Number(c.prime);
      if (m > 0) payer('salaire', c.id, s, m, 'Solde de ' + c.nom);
    }));

    // ---------- Missions ----------
    [
      ['Patrouille des remparts', 'Patrouille', 'Remparts nord', 0, 0, 'en_cours', ['Torvald', 'Eirik', 'Kjell'], 'Ronde de nuit, relève toutes les quatre heures.', ''],
      ['Escorte du convoi de minerai', 'Escorte', 'Route de Roche-Noire', -2, -2, 'terminee', ['Hrolf', 'Gunnar', 'Solveig'], 'Escorter les chariots jusqu\'au port.', 'Embuscade de bandits au gué. Deux bandits arrêtés, Gunnar blessé. Le minerai est arrivé intact.'],
      ['Enquête sur les vols au port', 'Enquête', 'Comptoir du Port', -1, 1, 'en_cours', ['Brynja', 'Solveig'], 'Des caisses disparaissent la nuit. Interroger les dockers.', ''],
      ['Garde de la porte du Val', 'Garde de porte', 'Porte du Val', 1, 1, 'prevue', ['Astrid', 'Eirik'], '', ''],
      ['Entraînement des recrues', 'Entraînement', 'Cour du château', 2, 2, 'prevue', ['Torvald', 'Kjell', 'Astrid'], 'Maniement du bouclier et de la lance.', ''],
      ['Arrestation du contrebandier Vigge', 'Arrestation', 'Pêcheries', -3, -3, 'annulee', ['Hrolf', 'Brynja'], '', 'Le suspect a fui par la mer avant notre arrivée.']
    ].forEach(m => missions.push({ id: id('m'), titre: m[0], type: m[1], lieu: m[2], debut: jour(sc, 7 * m[3] + 1), fin: jour(sc, 7 * m[4] + 4), statut: m[5], membres: m[6].map(qui).join(','), description: m[7], compte_rendu: m[8], modifie_par: PAR, modifie_le: LE }));

    // ---------- Entreprises et thaneries ----------
    // [catégorie, nom, type, propriétaire, adresse, taux, loyer, actif, recettes min-max, semaines oubliées]
    const taux = Number(reglages_().taux_defaut) || 10;
    [
      ['entreprise', 'La Jument Pie', 'Auberge', 'Hulda', 'Place du Marché', '', 40, '1', [300, 520], []],
      ['entreprise', 'Forge Hardi', 'Forge', 'Adrianne', 'Rue des Enclumes', '12', 30, '1', [250, 400], [3]],
      ['entreprise', 'Herboristerie Racine-Vive', 'Herboriste', 'Arcadia', 'Ruelle des Simples', '', 15, '1', [80, 150], [1, 4]],
      ['entreprise', 'Comptoir du Port', 'Négoce', 'Avulstein', 'Quai Est', '8', 60, '1', [600, 1100], [4]],
      ['entreprise', 'Écuries du Val', 'Écurie', 'Skulvar', 'Porte du Val', '', 20, '', [0, 0], []],
      ['thanerie', 'Ferme de Bois-Clair', 'Ferme', 'Thane Ronald', 'Vallon de Bois-Clair', '5', 0, '1', [200, 300], []],
      ['thanerie', 'Mine de Roche-Noire', 'Mine', 'Thane Ogmund', 'Roche-Noire', '15', 25, '1', [500, 800], [2, 3, 4]],
      ['thanerie', 'Pêcheries de Faillaise', 'Pêcherie', 'Thane Orla', 'Anse des Mouettes', '', 10, '1', [150, 260], [4]]
    ].forEach(e => {
      const o = { id: id('e'), categorie: e[0], nom: e[1], type: e[2], proprietaire: e[3], adresse: e[4], taux: e[5], loyer: String(e[6]), depuis: S[0], actif: e[7], note: e[7] ? '' : 'Fermée depuis l\'incendie.', modifie_par: PAR, modifie_le: LE };
      etabs.push(o);
      if (!e[7]) return;
      const tx = Number(e[5] !== '' ? e[5] : taux);
      S.forEach((s, i) => {
        const oubli = e[9].indexOf(i) >= 0, cour = i === 5;
        if (oubli) {
          if (i === 4 && e[1] === 'Comptoir du Port') { const r = entre(e[8][0], e[8][1]); decls.push({ id: id('d'), etablissement: o.id, semaine: s, recettes: String(r), taux: String(tx), taxe: String(Math.round(r * tx) / 100), par: PAR, le: LE }); }
          return;   // semaine non déclarée / non payée → retard
        }
        if (cour && hasard() < 0.4) return;    // pas encore déclaré cette semaine
        const r = entre(e[8][0], e[8][1]), t = Math.round(r * tx) / 100;
        decls.push({ id: id('d'), etablissement: o.id, semaine: s, recettes: String(r), taux: String(tx), taxe: String(t), par: PAR, le: LE });
        if (!(cour && hasard() < 0.5)) payer('taxe', o.id, s, t, 'Taxe ' + o.nom + ' (' + tx + ' % de ' + r + ')');
        if (e[6] > 0 && !(cour && hasard() < 0.5)) payer('loyer_etab', o.id, s, e[6], 'Loyer ' + o.nom);
      });
    });

    // ---------- Maisons ----------
    [
      ['Maison du Pont', 'Pont de pierre', 'Sigrid', 12, [0, 1, 2, 3, 4, 5]],
      ['Maison aux Volets Bleus', 'Rue Basse', 'Famille Olafsson', 15, [0, 1, 2, 3, 4]],
      ['Chaumière du Moulin', 'Chemin du Moulin', 'Hakon le Meunier', 8, [0, 1, 2]],
      ['Maison de la Tour', 'Rue de la Tour', 'Freydis', 20, [0, 1, 2, 3, 4, 5]],
      ['Masure du Quai', 'Quai Ouest', 'Bjorn le Pêcheur', 6, [0]],
      ['Maison du Tanneur', 'Rue des Peaux', '', 10, []]
    ].forEach(h => {
      const o = { id: id('h'), nom: h[0], adresse: h[1], occupant: h[2], loyer: String(h[3]), depuis: S[0], actif: h[2] ? '1' : '', note: h[2] ? '' : 'Vide depuis le départ du tanneur.', modifie_par: PAR, modifie_le: LE };
      maisons.push(o);
      h[4].forEach(i => payer('loyer_maison', o.id, S[i], h[3], 'Loyer ' + o.nom + (h[2] ? ' (' + h[2] + ')' : '')));
    });

    // ---------- Citoyenneté ----------
    // [nom, montant ('' = défaut), semaines payées (index dans S, 6+ = à l'avance), actif, note]
    const cit = Number(reglages_().citoyennete) || 20;
    [
      ['Sigrid', '', [0, 1, 2, 3, 4, 5], '1', ''],
      ['Hakon le Meunier', '', [0, 1, 2], '1', 'Promet de payer à la moisson.'],
      ['Freydis', '', [0, 1, 2, 3, 4, 5, 6, 7, 8], '1', 'A payé un mois d\'avance.'],
      ['Bjorn le Pêcheur', '10', [0], '1', 'Montant réduit : veuf avec quatre enfants.'],
      ['Thorgrim', '', [0, 1, 2, 3, 4], '1', ''],
      ['Famille Olafsson', '45', [0, 1, 2, 3, 4, 5], '1', 'Citoyenneté familiale (3 adultes).'],
      ['Ragnhild', '', [], '1', 'Arrivée récemment, n\'a encore rien payé.'],
      ['Vigge', '', [0, 1], '', 'Parti — recherché pour contrebande.']
    ].forEach(c => {
      const o = { id: id('c'), nom: c[0], montant: c[1], depuis: S[0], actif: c[3], note: c[4], modifie_par: PAR, modifie_le: LE };
      citoyens.push(o);
      const m = c[1] !== '' ? Number(c[1]) : cit;
      c[2].forEach(i => payer('citoyennete', o.id, i < 6 ? S[i] : jour(S[5], 7 * (i - 5)), m, 'Citoyenneté ' + o.nom));
    });

    // ---------- Trésor : autres mouvements ----------
    mouv('entree', 'Fonds de départ', 8000, 'Dotation du Jarl pour l\'ouverture du registre', S[0]);
    mouv('sortie', 'Équipement', 420, 'Achat de cottes de mailles (6)', S[1]);
    mouv('entree', 'Amendes', 75, 'Amende : rixe à La Jument Pie', S[2]);
    mouv('sortie', 'Entretien', 180, 'Réparation de la porte du Val', S[3]);
    mouv('sortie', 'Soins', 60, 'Guérisseur pour Gunnar', S[3]);
    mouv('entree', 'Amendes', 120, 'Contrebande saisie au port', S[4]);
    mouv('sortie', 'Vivres', 95, 'Rations de la garde', S[5]);

    // ---------- Justice ----------
    const bar = lire_('Bareme'), B = n => bar.find(b => b.nom === n) || { id: '', nom: n, amende: '0', prison: '0' };
    const affaires = [], detentions = [], avis = [], annonces = [], rapports = [], equipements = [], prets = [], planning = [];
    // [jours avant aujourd'hui, personne, [infractions], agent, lieu, statut, payée, description]
    [
      [20, 'Bjorn le Pêcheur', ['Ivresse sur la voie publique'], 'Eirik', 'Quai Ouest', 'jugee', true, 'Chantait à tue-tête sur le quai en pleine nuit.'],
      [16, 'Rorik Main-Leste', ['Vol à la tire', 'Refus d\'obtempérer'], 'Solveig', 'Place du Marché', 'jugee', false, 'Pris la main dans la bourse d\'un marchand, a tenté de fuir.'],
      [12, 'Vigge', ['Contrebande'], 'Hrolf Main-de-Fer', 'Pêcheries', 'ouverte', false, 'Caisses de vin de Cyrodiil non déclarées.'],
      [9, 'Thorgrim', ['Trouble à l\'ordre public'], 'Torvald Œil-de-Corbeau', 'La Jument Pie', 'jugee', true, 'Rixe à l\'auberge, une table brisée.'],
      [5, 'Halvar le Borgne', ['Coups et blessures', 'Arme dégainée en ville'], 'Brynja la Rousse', 'Rue des Enclumes', 'jugee', false, 'A blessé un apprenti forgeron au couteau.'],
      [2, 'Ysolda des Docks', ['Fraude aux taxes'], 'Aldric le Percepteur', 'Comptoir du Port', 'ouverte', false, 'Recettes sous-déclarées trois semaines de suite.']
    ].forEach(x => {
      const inf = x[2].map(n => { const b = B(n); return { id: b.id, nom: n, n: 1, amende: Number(b.amende) || 0, prison: Number(b.prison) || 0 }; });
      const o = { id: id('a'), date: jour(aujourdhui_(), -x[0]), personne: x[1], infractions: JSON.stringify(inf), amende: String(inf.reduce((t, i) => t + i.amende, 0)), prison: String(inf.reduce((t, i) => t + i.prison, 0)),
        agent: x[3], lieu: x[4], description: x[7], statut: x[5], modifie_par: PAR, modifie_le: LE };
      affaires.push(o);
      if (x[6]) payer('amende', o.id, lundi_(o.date), Number(o.amende), 'Amende : ' + o.personne + ' (' + x[2].join(', ') + ')');
    });
    const af = n => affaires.find(a => a.personne === n);
    [
      ['Rorik Main-Leste', af('Rorik Main-Leste').id, 'Cellule 1', -16, -13, -13, 'Vol à la tire, refus d\'obtempérer', 'libere'],
      ['Halvar le Borgne', af('Halvar le Borgne').id, 'Cellule 2', -5, -4, '', 'Coups et blessures', 'detenu'],
      ['Gerdur la Folle', '', 'Cellule 3', -3, 4, '', 'Agression d\'un garde', 'detenu']
    ].forEach(x => detentions.push({ id: id('j'), personne: x[0], affaire: x[1], cellule: x[2], entree: jour(aujourdhui_(), x[3]), sortie_prevue: jour(aujourdhui_(), x[4]), sortie: x[5] === '' ? '' : jour(aujourdhui_(), x[5]), motif: x[6], statut: x[7], note: '', modifie_par: PAR, modifie_le: LE }));
    [
      ['Vigge', 'Grand, barbe rousse, cicatrice à la joue gauche. Navigue sur un esquif noir.', 'Contrebande, fuite par la mer', 200, 'moyen', 'recherche', -12],
      ['Sven Œil-Noir', 'Chef de bande, cape grise, arc elfique.', 'Embuscade du convoi de minerai', 350, 'eleve', 'recherche', -14],
      ['Hilde la Rouge', 'Petite, cheveux roux tressés.', 'Vols répétés au marché', 80, 'faible', 'arrete', -25]
    ].forEach(x => avis.push({ id: id('r'), personne: x[0], signalement: x[1], motif: x[2], prime: String(x[3]), danger: x[4], statut: x[5], depuis: jour(aujourdhui_(), x[6]), note: '', modifie_par: PAR, modifie_le: LE }));
    // ---------- Annonces et rapports ----------
    const gardeGr = gs.filter(g => g.garde).map(g => g.id).join(',');
    [
      ['Visite du Jarl', 'Le Jarl passera en revue la garde samedi à midi, dans la cour du château. Tenue impeccable exigée.', '1', '', 6],
      ['Nouvelles rondes de nuit', 'À partir de cette semaine, les remparts nord sont gardés en deux tours de nuit. Consultez le planning.', '', gardeGr, 0],
      ['Rappel aux percepteurs', 'Les déclarations de recettes doivent être faites avant dimanche soir.', '', 'percepteur,intendant', 0]
    ].forEach(x => annonces.push({ id: id('n'), titre: x[0], texte: x[1], epingle: x[2], grades: x[3], expire: x[4] ? jour(aujourdhui_(), x[4]) : '', par: 'Hrolf Main-de-Fer', le: LE, modifie_le: LE }));
    const mi = t => missions.find(m => m.titre === t);
    rapports.push({ id: id('k'), mission: mi('Escorte du convoi de minerai').id, auteur: qui('Solveig'), texte: 'Embuscade au gué, côté est. Six bandits, dont deux arrêtés. Gunnar touché à la jambe par une flèche. Le chef (cape grise, arc elfique) a fui vers les collines.', statut: 'valide', remarque: 'Bon travail. Avis de recherche lancé pour le chef.', valide_par: 'Hrolf Main-de-Fer', le: LE, modifie_le: LE });
    rapports.push({ id: id('k'), mission: mi('Enquête sur les vols au port').id, auteur: qui('Brynja'), texte: 'Deux dockers interrogés. Les caisses disparaissent entre la relève de minuit et l\'aube. Piste : une barque sans fanal vue près de l\'Anse des Mouettes.', statut: 'soumis', remarque: '', valide_par: '', le: LE, modifie_le: LE });
    // ---------- Armurerie ----------
    [['Épée d\'acier', 'Armes', 14, 45], ['Arc de chasse', 'Armes', 8, 30], ['Bouclier de la garde', 'Protections', 16, 25], ['Cotte de mailles', 'Protections', 10, 70], ['Torche', 'Matériel', 40, 1], ['Menottes', 'Matériel', 12, 8]]
      .forEach(x => equipements.push({ id: id('q'), nom: x[0], categorie: x[1], quantite: String(x[2]), valeur: String(x[3]), note: '', modifie_par: PAR, modifie_le: LE }));
    const eq = n => equipements.find(e => e.nom.indexOf(n) === 0).id;
    [['Épée', 'Hrolf', 1, 'prete', ''], ['Épée', 'Eirik', 1, 'perdu', '30'], ['Arc', 'Solveig', 1, 'prete', ''], ['Bouclier', 'Torvald', 1, 'prete', ''], ['Bouclier', 'Kjell', 1, 'prete', ''], ['Cotte', 'Gunnar', 1, 'abime', '15'], ['Menottes', 'Brynja', 2, 'prete', ''], ['Torche', 'Eirik', 3, 'rendu', '']]
      .forEach(x => prets.push({ id: id('l'), equipement: eq(x[0]), membre: qui(x[1]), quantite: String(x[2]), sortie: S[1], retour: x[3] === 'prete' ? '' : jour(aujourdhui_(), -3), etat: x[3], retenue: x[4], retenue_paiement: '', note: x[3] === 'perdu' ? 'Tombée dans le fleuve pendant la patrouille.' : '', par: PAR, le: LE }));
    // ---------- Planning (semaine passée et semaine en cours) ----------
    [S[4], S[5]].forEach(sem => [
      [0, 'matin', 'Porte du Val', ['Eirik', 'Astrid']], [0, 'nuit', 'Remparts nord', ['Torvald', 'Kjell']], [1, 'apres_midi', 'Port', ['Solveig', 'Brynja']],
      [2, 'matin', 'Château', ['Hrolf']], [3, 'nuit', 'Remparts nord', ['Eirik', 'Kjell']], [4, 'matin', 'Porte du Val', ['Astrid', 'Solveig']],
      [5, 'apres_midi', 'Place du Marché', ['Torvald', 'Eirik']], [6, 'nuit', 'Port', ['Brynja', 'Kjell']]
    ].forEach(x => planning.push({ id: id('g'), semaine: sem, jour: String(x[0]), creneau: x[1], poste: x[2], membres: x[3].map(qui).join(','), note: '', modifie_par: PAR, modifie_le: LE })));
    const lois = [
      ['Art. 1', 'De l\'autorité du Jarl', ['Gouvernement'], 'Le Jarl de Faillaise exerce l\'autorité sur la ville et ses terres. Ses ordres, transmis par l\'intendant ou le capitaine de la garde, ont force de loi.', ['jarl', 'autorité'], [], -60],
      ['Art. 4', 'Du port des armes en ville', ['Ordre public', 'Armes'], 'Nul ne peut dégainer une arme dans l\'enceinte de la ville, hors légitime défense ou service de la garde. Les armes restent au fourreau dans les tavernes et au marché.', ['arme', 'épée', 'taverne', 'marché'], ['Arme dégainée en ville', 'Coups et blessures'], -60],
      ['Art. 7', 'De l\'ivresse et du tapage', ['Ordre public'], 'L\'ivresse sur la voie publique et le tapage nocturne sont punis d\'amende. La garde peut retenir l\'ivrogne jusqu\'à ce qu\'il ait dessoûlé.', ['ivresse', 'nuit', 'taverne'], ['Ivresse sur la voie publique', 'Trouble à l\'ordre public'], -60],
      ['Art. 12', 'Des déclarations de recettes', ['Commerce', 'Fiscalité'], 'Toute entreprise et toute thanerie déclare chaque semaine ses recettes au percepteur, avant le dimanche soir. La taxe due est un pourcentage de ces recettes, fixé par la Châtellerie.\nToute fausse déclaration est une fraude.', ['taxe', 'recettes', 'percepteur', 'déclaration'], ['Fraude aux taxes'], -45],
      ['Décret 2', 'Des marchandises importées', ['Commerce', 'Port'], 'Les marchandises qui entrent par le port sont déclarées au comptoir. Celles qui sont débarquées en cachette sont saisies au profit de la Châtellerie.', ['port', 'contrebande', 'douane'], ['Contrebande'], -45],
      ['Art. 20', 'Du vol et du recel', ['Biens'], 'Le voleur rend ce qu\'il a pris ou en paie la valeur, en plus de l\'amende. Celui qui achète sciemment un bien volé est puni comme le voleur.', ['vol', 'recel', 'restitution'], ['Vol', 'Vol à la tire', 'Vol de cheval'], -60],
      ['Décret 5', 'Du skooma', ['Substances', 'Commerce'], 'Le commerce, la détention et l\'usage du skooma sont interdits dans tout le domaine du Jarl.', ['skooma', 'drogue'], ['Trafic de skooma'], -30],
      ['Art. 9 (ancien)', 'Du couvre-feu', ['Ordre public'], 'Couvre-feu à la tombée de la nuit pour tous les habitants.', ['nuit', 'couvre-feu'], [], -90, 'abrogee']
    ].map(x => ({ id: id('w'), numero: x[0], titre: x[1], categories: x[2].join('|'), texte: x[3], mots_cles: x[4].join('|'), infractions: x[5].map(n => B(n).id).filter(Boolean).join(','), statut: x[7] || 'en_vigueur', type: /^Décret/.test(x[0]) ? 'decret' : x[0] === 'Art. 1' ? 'edit' : 'loi', date: jour(aujourdhui_(), x[6]), modifie_par: PAR, modifie_le: LE }));
    ajouterLignes_('Lois', lois);
    ajouterLignes_('Affaires', affaires); ajouterLignes_('Detentions', detentions); ajouterLignes_('Avis', avis); ajouterLignes_('Annonces', annonces); ajouterLignes_('Rapports', rapports);
    ajouterLignes_('Equipements', equipements); ajouterLignes_('Prets', prets); ajouterLignes_('Planning', planning);

    ajouterLignes_('Comptes', comptes); ajouterLignes_('Missions', missions); ajouterLignes_('Etablissements', etabs);
    ajouterLignes_('Declarations', decls); ajouterLignes_('Maisons', maisons); ajouterLignes_('Citoyens', citoyens);
    ajouterLignes_('Paiements', paiements); ajouterLignes_('Tresor', tresor);
    const r = lire_('Reglages').find(x => x.id === 'lancement');
    if (r) { r.valeur = S[0]; ecrire_('Reglages', r); } else ecrire_('Reglages', { id: 'lancement', valeur: S[0] });
    journal_('Démo', 'Données de démo ajoutées', comptes.length + ' comptes, ' + missions.length + ' missions, ' + etabs.length + ' établissements, ' + maisons.length + ' maisons, ' + citoyens.length + ' citoyens, ' + paiements.length + ' paiements');
    Logger.log('Démo prête : ' + paiements.length + ' paiements, ' + tresor.length + ' mouvements. Début du registre : ' + S[0]);
  });
}

function viderDemo() {
  verrou_(() => {
    MEMO_ = {};
    let n = 0;
    ['Comptes', 'Missions', 'Etablissements', 'Declarations', 'Maisons', 'Citoyens', 'Paiements', 'Tresor', 'Lois', 'Affaires', 'Detentions', 'Avis', 'Annonces', 'Rapports', 'Equipements', 'Prets', 'Planning'].forEach(t => {
      const l = lire_(t).filter(estDemo_).map(x => x._ligne);
      if (!l.length) return;
      n += l.length;
      // suppression par blocs de lignes contiguës (plus rapide)
      const sh = classeur_().getSheetByName(t);
      l.sort((a, b) => b - a);
      let i = 0;
      while (i < l.length) { let j = i; while (j + 1 < l.length && l[j + 1] === l[j] - 1) j++; sh.deleteRows(l[j], j - i + 1); i = j + 1; }
      delete MEMO_.t[t];
    });
    journal_('Démo', 'Données de démo retirées', n + ' lignes');
    Logger.log(n + ' lignes de démo retirées. Pense à régler « Début du registre » dans Grades et droits.');
  });
}

// =====================================================================
//  Petits outils communs aux pages ajoutées
// =====================================================================
const entier_ = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const ajoutJours_ = (s, j) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + j); return d.toISOString().slice(0, 10); };
function idsMembres_(liste) {
  const ids = {}; lire_('Comptes').forEach(c => { ids[c.id] = true; });
  return (Array.isArray(liste) ? liste : []).map(String).filter((x, i, t) => ids[x] && t.indexOf(x) === i);
}
function trouver_(table, id, quoi) {
  const o = lire_(table).find(x => x.id === String(id || ''));
  if (!o) throw new Error((quoi || 'Élément') + ' introuvable.');
  return o;
}
const json_ = (v, defaut) => { try { const x = JSON.parse(v || ''); return x == null ? defaut : x; } catch (e) { return defaut; } };

/** Ce que les pages ajoutées affichent, selon les droits du compte. */
function donneesPlus_(c, d, voit) {
  const today = aujourdhui_(), gestA = niveau_(c, 'annonces') >= 2;
  // Annonces : chacun voit celles qui s'adressent à son grade (les gestionnaires voient tout, même expiré)
  d.annonces = lire_('Annonces').map(a => Object.assign(sans_(a), { grades: a.grades ? a.grades.split(',') : [], epingle: a.epingle === '1' }))
    .filter(a => gestA || estJarl_(c) || ((!a.grades.length || a.grades.indexOf(c.grade) >= 0) && (!a.expire || a.expire >= today)));
  // Rapports de mission : ceux des missions visibles
  const mv = {}; (d.missions || []).forEach(m => { mv[m.id] = true; });
  d.rapports = lire_('Rapports').filter(r => mv[r.mission]).map(sans_);
  // Justice
  if (voit('justice')) {
    d.bareme = lire_('Bareme').map(b => ({ id: b.id, categorie: b.categorie, nom: b.nom, amende: Number(b.amende) || 0, prison: Number(b.prison) || 0, description: b.description, actif: b.actif === '1' }));
    d.affaires = lire_('Affaires').map(a => Object.assign(sans_(a), { infractions: json_(a.infractions, []), amende: Number(a.amende) || 0, prison: Number(a.prison) || 0 }));
  }
  if (voit('lois')) {
    d.lois = lire_('Lois').map(l => Object.assign(sans_(l), { categories: l.categories ? l.categories.split('|') : [], mots_cles: l.mots_cles ? l.mots_cles.split('|') : [], infractions: l.infractions ? l.infractions.split(',') : [], type: l.type || 'loi' }));
    if (!d.bareme) d.bareme = lire_('Bareme').map(b => ({ id: b.id, categorie: b.categorie, nom: b.nom, amende: Number(b.amende) || 0, prison: Number(b.prison) || 0, description: b.description, actif: b.actif === '1' }));
  }
  if (voit('prison')) d.detentions = lire_('Detentions').map(sans_);
  if (voit('recherches')) d.avis = lire_('Avis').map(a => Object.assign(sans_(a), { prime: Number(a.prime) || 0 }));
  // Armurerie : tout pour ceux qui la voient, sinon seulement mes prêts
  const eqs = lire_('Equipements');
  const prets = lire_('Prets').filter(p => voit('armurerie') || voit('salaires') || p.membre === c.id);
  d.prets = prets.map(p => Object.assign(sans_(p), { quantite: Number(p.quantite) || 0, retenue: Number(p.retenue) || 0, nomEquipement: (eqs.find(e => e.id === p.equipement) || {}).nom || '?' }));
  if (voit('armurerie')) d.equipements = eqs.map(e => Object.assign(sans_(e), { quantite: Number(e.quantite) || 0, valeur: Number(e.valeur) || 0 }));
  // Planning : tout pour ceux qui le voient, sinon seulement mes gardes
  d.planning = lire_('Planning').filter(p => voit('planning') || (p.membres || '').split(',').indexOf(c.id) >= 0)
    .map(p => Object.assign(sans_(p), { jour: Number(p.jour) || 0, membres: p.membres ? p.membres.split(',') : [] }));
}

// =====================================================================
//  Justice : barème des crimes, affaires (casier), amendes
// =====================================================================
const STATUTS_AFFAIRE = ['ouverte', 'jugee', 'classee'];
function baremeDepart_() {
  const L = maintenant_();
  return [
    ['Délit mineur', 'Ivresse sur la voie publique', 15, 0, 'Trouble causé par l\'ivresse.'],
    ['Délit mineur', 'Trouble à l\'ordre public', 25, 0, 'Tapage, bagarre sans blessé, attroupement.'],
    ['Délit mineur', 'Insulte envers un garde', 20, 0, ''],
    ['Délit mineur', 'Arme dégainée en ville', 30, 0, 'Menace ou port d\'arme dégainée dans les murs.'],
    ['Délit mineur', 'Intrusion', 50, 0, 'Entrée sans droit dans une propriété ou un lieu interdit.'],
    ['Délit', 'Vol à la tire', 50, 1, 'Plus la restitution de ce qui a été pris.'],
    ['Délit', 'Vol', 100, 2, 'Plus la restitution ou la valeur de ce qui a été volé.'],
    ['Délit', 'Vol de cheval', 250, 3, ''],
    ['Délit', 'Coups et blessures', 80, 1, 'Rixe avec blessé.'],
    ['Délit', 'Dégradation de biens', 75, 0, 'Plus le coût des réparations.'],
    ['Délit', 'Refus d\'obtempérer', 60, 1, 'Fuite ou refus d\'obéir à un garde.'],
    ['Délit', 'Contrebande', 150, 2, 'Les marchandises sont saisies.'],
    ['Délit', 'Fraude aux taxes', 200, 0, 'Recettes non déclarées ou falsifiées.'],
    ['Crime', 'Agression d\'un garde', 300, 5, ''],
    ['Crime', 'Évasion', 200, 7, 'S\'ajoute à la peine en cours.'],
    ['Crime', 'Trafic de skooma', 250, 5, 'La marchandise est saisie et détruite.'],
    ['Crime', 'Meurtre', 1000, 30, ''],
    ['Crime', 'Nécromancie', 1500, 30, ''],
    ['Crime', 'Haute trahison', 2000, 60, 'Atteinte au Jarl ou à la Châtellerie.']
  ].map(b => ({ id: uid_('b'), categorie: b[0], nom: b[1], amende: String(b[2]), prison: String(b[3]), description: b[4], actif: '1', modifie_par: 'installation', modifie_le: L }));
}
/** Installe le barème de départ une seule fois (même si l'appli existait avant cette page). */
function initBareme_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('BAREME_INIT')) return;
  verrou_(() => {
    if (props.getProperty('BAREME_INIT')) return;
    if (!lire_('Bareme').length) ajouterLignes_('Bareme', baremeDepart_());
    props.setProperty('BAREME_INIT', '1');
  });
}
function enregistrerBareme_(qui, a) {
  const tous = lire_('Bareme');
  const ex = a.id ? trouver_('Bareme', a.id, 'Infraction') : null;
  const nom = texte_(a.nom, 80);
  if (!nom) throw new Error('Donnez un nom à l\'infraction.');
  if (tous.some(x => x !== ex && normal_(x.nom) === normal_(nom))) throw new Error('« ' + nom + ' » existe déjà dans le barème.');
  const o = ex || { id: uid_('b') };
  Object.assign(o, { categorie: texte_(a.categorie, 40) || 'Délit', nom, amende: String(montant_(a.amende || 0, 'Amende')), prison: String(entier_(a.prison, 0, 3650)),
    description: texte_(a.description, 500), actif: a.actif === false ? '' : '1', modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Bareme', o);
  journal_(qui.nom, ex ? 'Barème modifié' : 'Barème : infraction ajoutée', nom + ' — ' + o.amende + ' septimes, ' + o.prison + ' jour(s)');
  return donnees_(qui);
}
function supprimerBareme_(qui, a) {
  const b = trouver_('Bareme', a.id, 'Infraction');
  supprimer_('Bareme', [b._ligne]);
  journal_(qui.nom, 'Barème : infraction supprimée', b.nom);   // les affaires gardent leur copie de l'infraction
  return donnees_(qui);
}
function amendePayee_(id) { return lire_('Paiements').find(p => p.type === 'amende' && p.cible === id); }
function enregistrerAffaire_(qui, a) {
  const ex = a.id ? trouver_('Affaires', a.id, 'Affaire') : null;
  const personne = texte_(a.personne, 60);
  if (!personne) throw new Error('Indiquez la personne mise en cause.');
  const bar = lire_('Bareme');
  const vide = v => v === undefined || v === null || String(v).trim() === '';
  const inf = (Array.isArray(a.infractions) ? a.infractions : []).slice(0, 20).map(x => {
    const b = bar.find(y => y.id === String(x && x.id || ''));
    const nom = texte_((x && x.nom) || (b && b.nom), 80);
    if (!nom) return null;
    return { id: b ? b.id : '', nom, n: entier_(x.n || 1, 1, 99),
      amende: montant_(vide(x.amende) ? (b ? b.amende : 0) : x.amende, 'Amende'), prison: entier_(vide(x.prison) ? (b ? b.prison : 0) : x.prison, 0, 3650) };
  }).filter(Boolean);
  if (!inf.length) throw new Error('Choisissez au moins une infraction.');
  const amende = vide(a.amende) ? inf.reduce((t, x) => t + x.amende * x.n, 0) : montant_(a.amende, 'Amende');
  const prison = vide(a.prison) ? inf.reduce((t, x) => t + x.prison * x.n, 0) : entier_(a.prison, 0, 3650);
  if (ex && amendePayee_(ex.id) && Number(ex.amende) !== amende) throw new Error('L\'amende est déjà payée : annulez le paiement dans le Trésor avant de changer son montant.');
  if (a.incarcerer && prison > 0 && niveau_(qui, 'prison') < 2) throw new Error('Vous n\'avez pas le droit d\'incarcérer (page Prison).');
  const o = ex || { id: uid_('a') };
  Object.assign(o, { date: dateValide_(a.date) || aujourdhui_(), personne, infractions: inf, amende: String(Math.round(amende * 100) / 100), prison: String(prison),
    agent: texte_(a.agent, 60) || qui.nom, lieu: texte_(a.lieu, 80), description: texte_(a.description, 3000),
    statut: STATUTS_AFFAIRE.indexOf(a.statut) >= 0 ? a.statut : 'ouverte', modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Affaires', o);
  journal_(qui.nom, ex ? 'Affaire modifiée' : 'Affaire enregistrée', personne + ' : ' + inf.map(x => x.nom).join(', ') + ' — ' + o.amende + ' septimes, ' + prison + ' jour(s)');
  if (a.incarcerer && prison > 0 && !lire_('Detentions').some(dd => dd.affaire === o.id && dd.statut === 'detenu')) {
    const entree = aujourdhui_();
    ecrire_('Detentions', { id: uid_('j'), personne, affaire: o.id, cellule: texte_(a.cellule, 40), entree, sortie_prevue: ajoutJours_(entree, prison), sortie: '', motif: inf.map(x => x.nom).join(', ').slice(0, 200), statut: 'detenu', note: '', modifie_par: qui.nom, modifie_le: maintenant_() });
    journal_(qui.nom, 'Incarcération', personne + ' pour ' + prison + ' jour(s)');
  }
  if (a.payee && !amendePayee_(o.id) && amende > 0) encaisserAmende_(qui, { id: o.id });
  return donnees_(qui);
}
function supprimerAffaire_(qui, a) {
  const af = trouver_('Affaires', a.id, 'Affaire');
  if (amendePayee_(af.id)) throw new Error('L\'amende de cette affaire est payée : annulez d\'abord le paiement dans le Trésor.');
  supprimer_('Affaires', [af._ligne]);
  journal_(qui.nom, 'Affaire supprimée', af.personne + ' (' + af.date + ')');
  return donnees_(qui);
}
function encaisserAmende_(qui, a) {
  const af = trouver_('Affaires', a.id, 'Affaire');
  if (amendePayee_(af.id)) throw new Error('Cette amende est déjà payée.');
  const m = a.montant === undefined || a.montant === null || a.montant === '' ? Number(af.amende) : montant_(a.montant, 'Montant');
  if (!(m > 0)) throw new Error('Cette affaire n\'a pas d\'amende.');
  const inf = json_(af.infractions, []).map(x => x.nom).join(', ');
  payer_(qui, 'amende', af.id, lundi_(aujourdhui_()), m, 'Amende : ' + af.personne + (inf ? ' (' + inf + ')' : ''), a.note);
  journal_(qui.nom, 'Amende encaissée', af.personne + ' : ' + m + ' septimes');
  return donnees_(qui);
}

// ---------- Prison ----------
function enregistrerDetention_(qui, a) {
  const ex = a.id ? trouver_('Detentions', a.id, 'Détention') : null;
  const personne = texte_(a.personne, 60);
  if (!personne) throw new Error('Indiquez le nom du détenu.');
  const entree = dateValide_(a.entree) || (ex ? ex.entree : aujourdhui_());
  const prevue = dateValide_(a.sortie_prevue) || ajoutJours_(entree, entier_(a.jours, 0, 3650));
  if (prevue < entree) throw new Error('La sortie prévue est avant l\'entrée.');
  const affaire = a.affaire && lire_('Affaires').some(x => x.id === String(a.affaire)) ? String(a.affaire) : (ex ? ex.affaire : '');
  const o = ex || { id: uid_('j'), statut: 'detenu', sortie: '' };
  Object.assign(o, { personne, affaire, cellule: texte_(a.cellule, 40), entree, sortie_prevue: prevue, motif: texte_(a.motif, 200), note: texte_(a.note, 1000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Detentions', o);
  journal_(qui.nom, ex ? 'Détention modifiée' : 'Incarcération', personne + ' jusqu\'au ' + prevue);
  return donnees_(qui);
}
function libererDetenu_(qui, a) {
  const d = trouver_('Detentions', a.id, 'Détention');
  if (d.statut !== 'detenu') throw new Error('Cette personne n\'est plus en détention.');
  const evade = !!a.evade;
  Object.assign(d, { statut: evade ? 'evade' : 'libere', sortie: aujourdhui_(), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Detentions', d);
  journal_(qui.nom, evade ? 'Évasion' : 'Libération', d.personne);
  if (evade && a.avis) {
    if (niveau_(qui, 'recherches') < 2) throw new Error('Évasion enregistrée, mais vous n\'avez pas le droit de créer un avis de recherche.');
    ecrire_('Avis', { id: uid_('r'), personne: d.personne, signalement: '', motif: 'Évadé de prison' + (d.motif ? ' (' + d.motif + ')' : ''), prime: '0', danger: 'moyen', statut: 'recherche', depuis: aujourdhui_(), note: '', modifie_par: qui.nom, modifie_le: maintenant_() });
    journal_(qui.nom, 'Avis de recherche', d.personne + ' (évadé)');
  }
  return donnees_(qui);
}
function supprimerDetention_(qui, a) {
  const d = trouver_('Detentions', a.id, 'Détention');
  supprimer_('Detentions', [d._ligne]);
  journal_(qui.nom, 'Détention supprimée', d.personne);
  return donnees_(qui);
}

// ---------- Avis de recherche ----------
const STATUTS_AVIS = ['recherche', 'arrete', 'abandonne'], DANGERS = ['faible', 'moyen', 'eleve'];
function enregistrerAvis_(qui, a) {
  const ex = a.id ? trouver_('Avis', a.id, 'Avis') : null;
  const personne = texte_(a.personne, 60);
  if (!personne) throw new Error('Indiquez la personne recherchée.');
  const o = ex || { id: uid_('r'), depuis: aujourdhui_() };
  Object.assign(o, { personne, signalement: texte_(a.signalement, 1000), motif: texte_(a.motif, 300), prime: String(montant_(a.prime || 0, 'Prime')),
    danger: DANGERS.indexOf(a.danger) >= 0 ? a.danger : 'moyen', statut: STATUTS_AVIS.indexOf(a.statut) >= 0 ? a.statut : (ex ? ex.statut : 'recherche'),
    depuis: dateValide_(a.depuis) || o.depuis, note: texte_(a.note, 1000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Avis', o);
  journal_(qui.nom, ex ? 'Avis de recherche modifié' : 'Avis de recherche', personne + (Number(o.prime) ? ' — prime ' + o.prime : ''));
  return donnees_(qui);
}
/** Arrestation : l'avis passe à « arrêté » ; la prime peut être versée (sortie du trésor). */
function arreterAvis_(qui, a) {
  const av = trouver_('Avis', a.id, 'Avis');
  if (av.statut !== 'recherche') throw new Error('Cet avis n\'est plus actif.');
  const prime = a.verserPrime ? montant_(a.prime === undefined || a.prime === '' ? av.prime : a.prime, 'Prime') : 0;
  if (prime > 0) {
    if (niveau_(qui, 'tresor') < 2) throw new Error('Il faut le droit de modifier le Trésor pour verser la prime.');
    const benef = texte_(a.beneficiaire, 60);
    mouvement_(qui, 'sortie', 'Primes de capture', prime, 'Prime pour la capture de ' + av.personne + (benef ? ', versée à ' + benef : ''), '', '');
  }
  Object.assign(av, { statut: 'arrete', note: texte_([av.note, a.note ? 'Arrestation : ' + a.note : ''].filter(Boolean).join('\n'), 1000), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Avis', av);
  journal_(qui.nom, 'Arrestation', av.personne + (prime ? ' — prime de ' + prime + ' versée' : ''));
  return donnees_(qui);
}
function supprimerAvis_(qui, a) {
  const av = trouver_('Avis', a.id, 'Avis');
  supprimer_('Avis', [av._ligne]);
  journal_(qui.nom, 'Avis de recherche supprimé', av.personne);
  return donnees_(qui);
}

// =====================================================================
//  Communication : annonces et rapports de mission
// =====================================================================
function enregistrerAnnonce_(qui, a) {
  const ex = a.id ? trouver_('Annonces', a.id, 'Annonce') : null;
  const titre = texte_(a.titre, 100);
  if (!titre) throw new Error('Donnez un titre à l\'annonce.');
  const gs = {}; grades_().forEach(g => { gs[g.id] = true; });
  const grades = (Array.isArray(a.grades) ? a.grades : []).map(String).filter((g, i, t) => gs[g] && t.indexOf(g) === i);
  const o = ex || { id: uid_('n'), par: qui.nom, le: maintenant_() };
  Object.assign(o, { titre, texte: texte_(a.texte, 3000), epingle: a.epingle ? '1' : '', grades: grades.join(','), expire: dateValide_(a.expire), modifie_le: maintenant_() });
  ecrire_('Annonces', o);
  journal_(qui.nom, ex ? 'Annonce modifiée' : 'Annonce publiée', titre);
  return donnees_(qui);
}
function supprimerAnnonce_(qui, a) {
  const n = trouver_('Annonces', a.id, 'Annonce');
  supprimer_('Annonces', [n._ligne]);
  journal_(qui.nom, 'Annonce supprimée', n.titre);
  return donnees_(qui);
}
const STATUTS_RAPPORT = ['soumis', 'valide', 'a_revoir'];
/** Un membre affecté à une mission rédige (ou corrige) son rapport. */
function ecrireRapport_(qui, a) {
  const m = trouver_('Missions', a.mission, 'Mission');
  const gere = niveau_(qui, 'missions') >= 2;
  if (!gere && (m.membres || '').split(',').indexOf(qui.id) < 0) throw new Error('Seuls les membres affectés à cette mission peuvent écrire un rapport.');
  const texte = texte_(a.texte, 5000);
  if (!texte) throw new Error('Le rapport est vide.');
  const ex = a.id ? trouver_('Rapports', a.id, 'Rapport') : null;
  if (ex && ex.auteur !== qui.id && !gere) throw new Error('Ce rapport n\'est pas le vôtre.');
  if (ex && ex.statut === 'valide' && !gere) throw new Error('Ce rapport est déjà validé.');
  const o = ex || { id: uid_('k'), mission: m.id, auteur: qui.id, le: maintenant_() };
  Object.assign(o, { texte, statut: 'soumis', remarque: ex ? ex.remarque : '', valide_par: '', modifie_le: maintenant_() });
  ecrire_('Rapports', o);
  journal_(qui.nom, ex ? 'Rapport corrigé' : 'Rapport de mission', m.titre);
  return donnees_(qui);
}
function supprimerRapport_(qui, a) {
  const r = trouver_('Rapports', a.id, 'Rapport');
  const gere = niveau_(qui, 'missions') >= 2;
  if (!gere && (r.auteur !== qui.id || r.statut === 'valide')) throw new Error('Vous ne pouvez pas supprimer ce rapport.');
  supprimer_('Rapports', [r._ligne]);
  journal_(qui.nom, 'Rapport supprimé', '');
  return donnees_(qui);
}
function validerRapport_(qui, a) {
  const r = trouver_('Rapports', a.id, 'Rapport');
  Object.assign(r, { statut: a.statut === 'a_revoir' ? 'a_revoir' : 'valide', remarque: texte_(a.remarque, 500), valide_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Rapports', r);
  const m = lire_('Missions').find(x => x.id === r.mission);
  journal_(qui.nom, r.statut === 'valide' ? 'Rapport validé' : 'Rapport à revoir', m ? m.titre : '');
  return donnees_(qui);
}

// =====================================================================
//  Logistique : armurerie (stock, prêts, retenues) et planning des gardes
// =====================================================================
const enPret_ = id => lire_('Prets').filter(p => p.equipement === id && p.etat === 'prete').reduce((t, p) => t + (Number(p.quantite) || 0), 0);
function enregistrerEquipement_(qui, a) {
  const ex = a.id ? trouver_('Equipements', a.id, 'Équipement') : null;
  const nom = texte_(a.nom, 80);
  if (!nom) throw new Error('Donnez un nom à l\'équipement.');
  if (lire_('Equipements').some(x => x !== ex && normal_(x.nom) === normal_(nom))) throw new Error('« ' + nom + ' » existe déjà dans l\'armurerie.');
  const q = entier_(a.quantite, 0, 100000);
  if (ex && q < enPret_(ex.id)) throw new Error('Il y en a ' + enPret_(ex.id) + ' en prêt : la quantité ne peut pas être plus petite.');
  const o = ex || { id: uid_('q') };
  Object.assign(o, { nom, categorie: texte_(a.categorie, 40), quantite: String(q), valeur: String(montant_(a.valeur || 0, 'Valeur')), note: texte_(a.note, 500), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Equipements', o);
  journal_(qui.nom, ex ? 'Armurerie : équipement modifié' : 'Armurerie : équipement ajouté', nom + ' × ' + q);
  return donnees_(qui);
}
function supprimerEquipement_(qui, a) {
  const e = trouver_('Equipements', a.id, 'Équipement');
  if (enPret_(e.id)) throw new Error('Des pièces sont encore en prêt : faites-les rendre d\'abord.');
  supprimer_('Equipements', [e._ligne]);
  journal_(qui.nom, 'Armurerie : équipement retiré', e.nom);
  return donnees_(qui);
}
function preter_(qui, a) {
  const e = trouver_('Equipements', a.equipement, 'Équipement');
  const m = lire_('Comptes').find(x => x.id === String(a.membre) && x.actif === '1');
  if (!m) throw new Error('Choisissez à qui prêter.');
  const q = entier_(a.quantite || 1, 1, 1000), dispo = (Number(e.quantite) || 0) - enPret_(e.id);
  if (q > dispo) throw new Error('Il n\'en reste que ' + dispo + ' en stock.');
  ecrire_('Prets', { id: uid_('l'), equipement: e.id, membre: m.id, quantite: String(q), sortie: dateValide_(a.sortie) || aujourdhui_(), retour: '', etat: 'prete', retenue: '', retenue_paiement: '', note: texte_(a.note, 200), par: qui.nom, le: maintenant_() });
  journal_(qui.nom, 'Armurerie : prêt', e.nom + ' × ' + q + ' à ' + m.nom);
  return donnees_(qui);
}
/** Retour d'un prêt : rendu, abîmé ou perdu (perdu = retiré du stock). Une retenue sur solde peut être fixée. */
function retourPret_(qui, a) {
  const p = trouver_('Prets', a.id, 'Prêt');
  if (p.etat !== 'prete') throw new Error('Ce prêt est déjà clos.');
  const etat = ['rendu', 'abime', 'perdu'].indexOf(a.etat) >= 0 ? a.etat : 'rendu';
  const retenue = etat === 'rendu' ? 0 : montant_(a.retenue || 0, 'Retenue');
  Object.assign(p, { etat, retour: aujourdhui_(), retenue: retenue ? String(retenue) : '', note: texte_([p.note, a.note].filter(Boolean).join(' — '), 200) });
  ecrire_('Prets', p);
  const e = lire_('Equipements').find(x => x.id === p.equipement);
  if (etat === 'perdu' && e) { e.quantite = String(Math.max(0, (Number(e.quantite) || 0) - (Number(p.quantite) || 0))); ecrire_('Equipements', e); }
  const m = lire_('Comptes').find(x => x.id === p.membre);
  journal_(qui.nom, 'Armurerie : retour', (e ? e.nom : '?') + ' — ' + ({ rendu: 'rendu', abime: 'rendu abîmé', perdu: 'perdu' }[etat]) + ' par ' + (m ? m.nom : '?') + (retenue ? ', retenue de ' + retenue + ' sur solde' : ''));
  return donnees_(qui);
}
const CRENEAUX = ['matin', 'apres_midi', 'nuit'];
function enregistrerGarde_(qui, a) {
  const ex = a.id ? trouver_('Planning', a.id, 'Garde') : null;
  const poste = texte_(a.poste, 60);
  if (!poste) throw new Error('Indiquez le poste (lieu de garde).');
  const o = ex || { id: uid_('g') };
  Object.assign(o, { semaine: semaine_(a.semaine), jour: String(entier_(a.jour, 0, 6)), creneau: CRENEAUX.indexOf(a.creneau) >= 0 ? a.creneau : 'matin', poste,
    membres: idsMembres_(a.membres).join(','), note: texte_(a.note, 300), modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Planning', o);
  journal_(qui.nom, ex ? 'Planning modifié' : 'Planning : garde ajoutée', poste + ' — semaine du ' + o.semaine);
  return donnees_(qui);
}
function supprimerGarde_(qui, a) {
  const g = trouver_('Planning', a.id, 'Garde');
  supprimer_('Planning', [g._ligne]);
  journal_(qui.nom, 'Planning : garde retirée', g.poste);
  return donnees_(qui);
}
/** Recopie les gardes de la semaine précédente sur la semaine choisie (sans créer de doublon). */
function copierPlanning_(qui, a) {
  const cible = semaine_(a.semaine), source = ajoutJours_(cible, -7);
  const tous = lire_('Planning'), deja = {};
  tous.filter(p => p.semaine === cible).forEach(p => { deja[p.jour + '|' + p.creneau + '|' + normal_(p.poste)] = true; });
  const neufs = tous.filter(p => p.semaine === source && !deja[p.jour + '|' + p.creneau + '|' + normal_(p.poste)])
    .map(p => ({ id: uid_('g'), semaine: cible, jour: p.jour, creneau: p.creneau, poste: p.poste, membres: p.membres, note: p.note, modifie_par: qui.nom, modifie_le: maintenant_() }));
  if (!neufs.length) throw new Error('Rien à recopier : la semaine précédente est vide ou déjà recopiée.');
  ajouterLignes_('Planning', neufs);
  journal_(qui.nom, 'Planning recopié', neufs.length + ' garde(s) vers la semaine du ' + cible);
  return donnees_(qui);
}

// =====================================================================
//  Lois : textes, catégories, mots-clés, infractions du barème liées
// =====================================================================
const liste_ = (v, max, long) => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[,|\n]/)).map(x => texte_(x, long || 40).replace(/\|/g, ' ')).filter(Boolean))].slice(0, max || 20);
const TYPES_LOI = ['loi', 'decret', 'edit', 'ordonnance'];
function enregistrerLoi_(qui, a) {
  const ex = a.id ? trouver_('Lois', a.id, 'Loi') : null;
  const titre = texte_(a.titre, 150);
  if (!titre) throw new Error('Donnez un titre à la loi.');
  const numero = texte_(a.numero, 30);
  if (numero && lire_('Lois').some(x => x !== ex && x.statut !== 'abrogee' && normal_(x.numero) === normal_(numero))) throw new Error('Une loi en vigueur porte déjà le numéro « ' + numero + ' ».');
  const bar = {}; lire_('Bareme').forEach(b => { bar[b.id] = true; });
  const o = ex || { id: uid_('w') };
  Object.assign(o, { numero, titre, categories: liste_(a.categories, 12).join('|'), texte: texte_(a.texte, 20000), mots_cles: liste_(a.mots_cles, 30).join('|'),
    infractions: (Array.isArray(a.infractions) ? a.infractions : []).map(String).filter((x, i, t) => bar[x] && t.indexOf(x) === i).join(','),
    statut: a.statut === 'abrogee' ? 'abrogee' : 'en_vigueur', date: dateValide_(a.date), type: TYPES_LOI.indexOf(a.type) >= 0 ? a.type : 'loi', modifie_par: qui.nom, modifie_le: maintenant_() });
  ecrire_('Lois', o);
  journal_(qui.nom, ex ? 'Loi modifiée' : 'Loi ajoutée', (numero ? numero + ' — ' : '') + titre + (o.statut === 'abrogee' ? ' (abrogée)' : ''));
  return donnees_(qui);
}
function supprimerLoi_(qui, a) {
  const l = trouver_('Lois', a.id, 'Loi');
  supprimer_('Lois', [l._ligne]);
  journal_(qui.nom, 'Loi supprimée', (l.numero ? l.numero + ' — ' : '') + l.titre);
  return donnees_(qui);
}
