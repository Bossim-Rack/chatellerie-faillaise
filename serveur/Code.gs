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
  Reglages: ['id', 'valeur'],
  Journal: ['date', 'par', 'action', 'detail']
};

/** Pages de l'appli dont l'accès se règle par grade (0 = invisible, 1 = lecture, 2 = modification). */
const PAGES = ['garde', 'missions', 'salaires', 'entreprises', 'thaneries', 'maisons', 'citoyennete', 'tresor', 'comptes', 'journal', 'admin'];
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
  donnees: [null, 0, (c) => donnees_(c)],
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
  journal: ['journal', 1, () => journalListe_()]
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
      const T = n => JSON.stringify(PAGES.reduce((o, p) => { o[p] = n[p] !== undefined ? n[p] : (n._ || 0); return o; }, {}));
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
    const droits = {}; PAGES.forEach(p => { droits[p] = g.systeme === '1' ? 2 : Math.max(0, Math.min(2, Number(d[p]) || 0)); });
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
  return lire_('Comptes').filter(c => c.actif === '1').map(c => ({ nom: c.nom, nouveau: !c.hash, rang: (gs.find(g => g.id === c.grade) || {}).rang || 0 }))
    .sort((a, b) => b.rang - a.rang || a.nom.localeCompare(b.nom, 'fr')).map(x => ({ nom: x.nom, nouveau: x.nouveau }));
}
function connexion_(a) {
  const cle = normal_(a.nom), mdp = String(a.mdp || '');
  if (!cle || !mdp) throw new Error('Indiquez votre nom et votre mot de passe.');
  const cache = CacheService.getScriptCache(), ce = 'essais_' + Utilities.base64EncodeWebSafe(cle).slice(0, 60);
  const essais = Number(cache.get(ce) || 0);
  if (essais >= 5) throw new Error('Trop d\'essais manqués : réessayez dans 10 minutes.');
  return verrou_(() => {
    const c = lire_('Comptes').find(x => x.actif === '1' && normal_(x.nom) === cle);
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
  if (voit('entreprises') || voit('thaneries')) d.etablissements = lire_('Etablissements').filter(e => voit(e.categorie === 'thanerie' ? 'thaneries' : 'entreprises')).map(sans_);
  if (voit('entreprises') || voit('thaneries')) d.declarations = lire_('Declarations').map(sans_);
  if (voit('maisons')) d.maisons = lire_('Maisons').map(sans_);
  if (voit('citoyennete')) d.citoyens = lire_('Citoyens').map(sans_);
  const typesVus = { taxe: voit('entreprises') || voit('thaneries'), loyer_etab: voit('entreprises') || voit('thaneries'), loyer_maison: voit('maisons'), citoyennete: voit('citoyennete'), salaire: voit('salaires') };
  d.paiements = lire_('Paiements').filter(p => typesVus[p.type] || (p.type === 'salaire' && p.cible === c.id)).map(sans_);
  if (voit('tresor')) d.tresor = lire_('Tresor').map(sans_);
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
  const cat = { taxe: 'Taxes', loyer_etab: 'Loyers', loyer_maison: 'Loyers', citoyennete: 'Citoyenneté', salaire: 'Salaires' }[type];
  const t = mouvement_(qui, sens, cat, montant, libelle, semaine, id);
  return ecrire_('Paiements', { id, type, cible, semaine, montant: String(montant), mouvement: t.id, note: texte_(note, 200), par: qui.nom, le: maintenant_() });
}
function annulerPaiement_(qui, a) {
  const p = lire_('Paiements').find(x => x.id === String(a.id));
  if (!p) throw new Error('Paiement introuvable.');
  const t = lire_('Tresor').find(x => x.id === p.mouvement);
  if (t) supprimer_('Tresor', [t._ligne]);
  supprimer_('Paiements', [lire_('Paiements').find(x => x.id === p.id)._ligne]);
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
    payer_(qui, 'salaire', c.id, semaine, m, 'Salaire de ' + c.nom + ' (' + g.nom + ')');
    n++; total += m;
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
