/* Châtellerie de Faillaise — page (hébergée sur GitHub Pages), parle au serveur Apps Script. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lireLocal = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const ecrireLocal = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  const S = { jeton: lireLocal('chat-jeton'), d: null, page: lireLocal('chat-page') || 'accueil', sem: {}, f: {}, journal: null };

  // Pages : [id, icône, nom, clé de droit]
  // Pages : [id, icône, nom, clé de droit] ; ['-', 'Titre'] = début d'une section du menu
  const PAGES = [
    ['accueil', '🏰', 'Accueil', null],
    ['-', 'La garde'], ['garde', '🛡️', 'Garde', 'garde'], ['missions', '⚔️', 'Missions', 'missions'], ['planning', '🗓️', 'Planning', 'planning'], ['armurerie', '🗡️', 'Armurerie', 'armurerie'], ['salaires', '💰', 'Salaires', 'salaires'],
    ['-', 'Justice'], ['justice', '⚖️', 'Justice', 'justice'], ['lois', '📖', 'Lois', 'lois'], ['prison', '🔒', 'Prison', 'prison'], ['recherches', '🎯', 'Avis de recherche', 'recherches'],
    ['-', 'Finances'], ['entreprises', '🏪', 'Entreprises', 'entreprises'], ['thaneries', '🌾', 'Thaneries', 'thaneries'], ['maisons', '🏠', 'Maisons', 'maisons'],
    ['citoyennete', '📜', 'Citoyenneté', 'citoyennete'], ['tresor', '🪙', 'Trésor', 'tresor'], ['bilan', '📊', 'Bilan', 'bilan'],
    ['-', 'Administration'], ['annonces', '📢', 'Annonces', 'annonces'], ['comptes', '👥', 'Comptes', 'comptes'], ['journal', '🧾', 'Journal', 'journal'], ['admin', '👑', 'Grades et droits', 'admin']
  ];
  const NOMS_DROITS = { garde: 'Garde', missions: 'Missions', planning: 'Planning', armurerie: 'Armurerie', salaires: 'Salaires', justice: 'Justice (affaires, amendes, barème)', lois: 'Lois', prison: 'Prison', recherches: 'Avis de recherche',
    entreprises: 'Entreprises', thaneries: 'Thaneries', maisons: 'Maisons', citoyennete: 'Citoyenneté', tresor: 'Trésor', bilan: 'Bilan', annonces: 'Annonces (publier)', comptes: 'Comptes', journal: 'Journal', admin: 'Grades et droits' };
  const STATUTS_MISSION = { prevue: ['Prévue', '#4f86b8'], en_cours: ['En cours', '#d9822b'], terminee: ['Terminée', '#3f9b5a'], annulee: ['Annulée', '#7f8c8d'] };
  const TYPES_MISSION = ['Patrouille', 'Garde de porte', 'Escorte', 'Enquête', 'Arrestation', 'Surveillance', 'Collecte', 'Entraînement'];

  // ---------- Outils ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normal = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const num = v => Number(v) || 0;
  const fmtS = v => { const n = Math.round(num(v) * 100) / 100; return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' septime' + (Math.abs(n) >= 2 ? 's' : ''); };
  const dateUTC = s => new Date(s + 'T12:00:00Z');
  const iso = d => d.toISOString().slice(0, 10);
  const ajout = (s, j) => { const d = dateUTC(s); d.setUTCDate(d.getUTCDate() + j); return iso(d); };
  const lundi = s => { const d = dateUTC(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };
  const fmtJ = s => s ? dateUTC(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '';
  const fmtCourt = s => dateUTC(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fmtSem = s => 'semaine du ' + fmtCourt(s) + ' au ' + fmtCourt(ajout(s, 6));
  const semCour = () => lundi(S.d.aujourdhui);
  function semaines(debut, fin) { const out = []; for (let s = lundi(debut); s <= fin && out.length < 520; s = ajout(s, 7)) out.push(s); return out; }
  const niv = p => !p ? 2 : (S.d && S.d.moi.droits[p]) || 0;
  const grade = id => (S.d.grades.find(g => g.id === id) || { nom: '?', couleur: '#7f8c8d', salaire: 0, garde: false, rang: 0 });
  const statut = id => (S.d.statuts.find(s => s.id === id) || { nom: '?', couleur: '#7f8c8d', paye: false });
  const membre = id => S.d.membres.find(m => m.id === id);
  const badge = (nom, c) => '<span class="badge" style="--c:' + esc(c) + '">' + esc(nom) + '</span>';
  const badgeGrade = id => { const g = grade(id); return badge(g.nom, g.couleur); };
  const badgeStatut = id => { const s = statut(id); return badge(s.nom, s.couleur); };
  const salaireDe = m => Math.round((grade(m.grade).salaire + num(m.prime)) * 100) / 100;
  const paiement = (type, cible, sem) => (S.d.paiements || []).find(p => p.type === type && p.cible === cible && p.semaine === sem);
  const debutDe = depuis => { const l = S.d.reglages.lancement; return depuis && depuis > l ? lundi(depuis) : l; };
  const vide = t => '<div class="vide">' + esc(t) + '</div>';
  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const CRENEAUX = { matin: 'Matin', apres_midi: 'Après-midi', nuit: 'Nuit' };
  /** « 24/11/2026 18:05 » → clé triable « 2026112418:05 ». */
  const cleLe = le => { const x = /^(\d\d)\/(\d\d)\/(\d{4})\s*(\d\d:\d\d)?/.exec(le || ''); return x ? x[3] + x[2] + x[1] + (x[4] || '') : ''; };
  const ecart = (a, b) => Math.round((dateUTC(b) - dateUTC(a)) / 864e5);   // nombre de jours de a à b
  const nomMembre = id => (membre(id) || { nom: '?' }).nom;
  const onglets = (k, liste, def) => { const v = S.f[k] || def; return '<div class="onglets" role="tablist">' + liste.map(o => '<button role="tab" aria-selected="' + (v === o[0]) + '" class="' + (v === o[0] ? 'on' : '') + '" data-act="onglet" data-k="' + k + '" data-v="' + o[0] + '">' + esc(o[1]) + (o[2] ? ' <span class="nb">' + esc(o[2]) + '</span>' : '') + '</button>').join('') + '</div>'; };
  const amendePaiement = id => (S.d.paiements || []).find(p => p.type === 'amende' && p.cible === id);
  const impayee = a => a.amende > 0 && a.statut !== 'classee' && !amendePaiement(a.id);
  function personnesConnues() {
    const t = [].concat((S.d.citoyens || []).map(c => c.nom), (S.d.affaires || []).map(a => a.personne), (S.d.detentions || []).map(x => x.personne), (S.d.avis || []).map(x => x.personne), (S.d.maisons || []).map(h => h.occupant));
    return [...new Set(t.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  }
  const listePersonnes = id => '<datalist id="' + id + '">' + personnesConnues().map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
  /** Retenues sur solde (équipement perdu ou abîmé) qui seront prélevées au prochain versement. */
  function retenueDe(m) { const sal = salaireDe(m); let r = 0; (S.d.prets || []).filter(p => p.membre === m.id && p.retenue > 0 && !p.retenue_paiement).forEach(p => { if (r + p.retenue <= sal) r += p.retenue; }); return r; }
  /** Téléchargement d'un tableau en CSV lisible par Excel (point-virgule, accents). */
  function telecharger(nom, lignes) {
    const cell = v => { const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const csv = '\ufeff' + lignes.map(l => l.map(cell).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nom;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function toast(t, mal) {
    const e = $('toast'); e.textContent = t; e.className = 'toast' + (mal ? ' mal' : ''); e.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, mal ? 6000 : 3200);
  }
  async function api(action, args) {
    if (!window.CONFIG || !window.CONFIG.api) throw new Error('Le serveur n\'est pas encore configuré (docs/config.js).');
    let r;
    try { r = await fetch(window.CONFIG.api, { method: 'POST', body: JSON.stringify({ action, jeton: S.jeton, args: args || {} }) }); }
    catch (e) { throw new Error('Le serveur ne répond pas. Vérifie ta connexion et réessaie.'); }
    let j; try { j = await r.json(); } catch (e) { throw new Error('Réponse illisible du serveur.'); }
    if (!j.ok) {
      const m = String(j.erreur || 'Erreur inconnue.');
      if (m.indexOf('SESSION:') === 0) { deconnecter(m.slice(8).trim()); throw new Error(m.slice(8).trim()); }
      throw new Error(m);
    }
    return j.data;
  }
  const msg = e => String(e && e.message || e).replace(/^.*PREMIERE:\s*/, '');

  // ---------- Fenêtre générique ----------
  let MG = null;
  function fenetre(o) {
    MG = o;
    $('mg-titre').textContent = o.titre;
    $('mg-corps').onclick = null;
    $('mg-corps').innerHTML = o.html;
    $('mg-boite').className = 'boite' + (o.large ? ' large' : '');
    $('mg-erreur').textContent = '';
    $('mg-boutons').innerHTML = (o.boutons || []).map((b, i) => '<button class="btn ' + (b.cls || '') + '" data-mg="' + i + '">' + esc(b.t) + '</button>').join('');
    $('m-gen').hidden = false;
    if (o.ouvert) o.ouvert();
    const f = $('mg-corps').querySelector('input:not([type=checkbox]):not([type=color]), select, textarea'); if (f) setTimeout(() => { if (!$('mg-corps').contains(document.activeElement)) f.focus(); }, 30);
  }
  const fermer = () => { $('m-gen').hidden = true; MG = null; };
  $('mg-boutons').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-mg]'); if (!b || !MG) return;
    const def = MG.boutons[Number(b.dataset.mg)];
    if (!def.f) { fermer(); return; }
    if (def.confirmer && !confirm(def.confirmer)) return;
    b.disabled = true; $('mg-erreur').textContent = '';
    try { const r = await def.f(); if (r !== false) fermer(); }
    catch (e) { $('mg-erreur').textContent = msg(e); }
    finally { b.disabled = false; }
  });
  $('m-gen').addEventListener('click', ev => { if (ev.target === $('m-gen')) fermer(); });
  $('mg-corps').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && MG) { ev.preventDefault(); const p = $('mg-boutons').querySelector('.or'); if (p) p.click(); }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('m-gen').hidden) fermer(); });
  const val = id => { const e = $(id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; };
  const champ = (id, label, html) => '<label class="champ"><span>' + esc(label) + '</span>' + html + '</label>';
  const entree = (id, label, v, attrs) => champ(id, label, '<input id="' + id + '" value="' + esc(v == null ? '' : v) + '" ' + (attrs || '') + '>');
  const zone = (id, label, v, attrs) => champ(id, label, '<textarea id="' + id + '" ' + (attrs || '') + '>' + esc(v || '') + '</textarea>');
  const choix = (id, label, opts, v) => champ(id, label, '<select id="' + id + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>');
  const caseC = (id, label, on) => '<label class="case"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>';
  /** Applique les données renvoyées par le serveur puis redessine. */
  const maj = d => { S.d = d; dessiner(); };

  // ---------- Connexion ----------
  let listeCx = [];
  async function ouvrirConnexion(message) {
    $('m-connexion').hidden = false; $('cx-erreur').textContent = message || ''; $('cx-mdp').value = ''; $('cx-conf').value = '';
    try {
      listeCx = await api('listeConnexion');
      const voulu = lireLocal('chat-nom');
      $('cx-nom').innerHTML = '<option value="">— Choisissez votre nom —</option>' + listeCx.map(c => '<option' + (c.nom === voulu ? ' selected' : '') + '>' + esc(c.nom) + '</option>').join('');
      modeCx(); ($('cx-nom').value ? $('cx-mdp') : $('cx-nom')).focus();
    } catch (e) { $('cx-erreur').textContent = msg(e); }
  }
  function modeCx() {
    const c = listeCx.find(x => x.nom === $('cx-nom').value), prem = !!(c && c.nouveau);
    $('cx-conf-b').hidden = !prem; $('cx-premiere').hidden = !prem;
    $('cx-mdp-l').textContent = prem ? 'Choisissez votre mot de passe' : 'Mot de passe';
    $('cx-mdp').autocomplete = prem ? 'new-password' : 'current-password';
    $('cx-ok').textContent = prem ? 'Créer mon mot de passe' : 'Entrer';
  }
  $('cx-nom').addEventListener('change', modeCx);
  $('cx-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const nom = $('cx-nom').value, mdp = $('cx-mdp').value, prem = !$('cx-conf-b').hidden;
    if (!nom) { $('cx-erreur').textContent = 'Choisissez votre nom.'; return; }
    if (!mdp) { $('cx-erreur').textContent = 'Indiquez votre mot de passe.'; return; }
    if (prem && mdp !== $('cx-conf').value) { $('cx-erreur').textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
    $('cx-ok').disabled = true; $('cx-erreur').textContent = '';
    try {
      const r = await api('connexion', prem ? { nom, mdp, confirmation: $('cx-conf').value } : { nom, mdp });
      S.jeton = r.jeton; ecrireLocal('chat-jeton', r.jeton); ecrireLocal('chat-nom', nom);
      $('m-connexion').hidden = true;
      await charger();
      toast(r.premiere ? 'Bienvenue, ' + nom + ' : votre mot de passe est enregistré.' : 'Bienvenue, ' + nom + '.');
    } catch (e) {
      const m = String(e && e.message || e);
      if (m.indexOf('PREMIERE:') >= 0) { const c = listeCx.find(x => x.nom === nom); if (c) c.nouveau = true; modeCx(); }
      $('cx-erreur').textContent = msg(e);
    } finally { $('cx-ok').disabled = false; }
  });
  function deconnecter(message) {
    if (S.jeton) fetch(window.CONFIG.api, { method: 'POST', body: JSON.stringify({ action: 'deconnexion', args: { jeton: S.jeton } }) }).catch(() => {});
    S.jeton = ''; S.d = null; ecrireLocal('chat-jeton', '');
    $('moi').innerHTML = ''; $('nav').innerHTML = ''; $('page').innerHTML = '';
    fermer(); ouvrirConnexion(message || '');
  }
  async function charger() { maj(await api('donnees')); }

  // ---------- Squelette ----------
  function dessiner() {
    if (!S.d) return;
    const m = S.d.moi;
    // une section n'apparaît que si elle contient au moins une page visible
    const visibles = []; let section = null;
    PAGES.forEach(p => { if (p[0] === '-') { section = p; return; } if (niv(p[3]) < 1) return; if (section) { visibles.push(section); section = null; } visibles.push(p); });
    if (!visibles.some(p => p[0] === S.page)) S.page = 'accueil';
    $('nav').innerHTML = visibles.map(p => p[0] === '-' ? '<div class="sep-t">' + esc(p[1]) + '</div>' :
      '<button data-page="' + p[0] + '" class="' + (S.page === p[0] ? 'on' : '') + '"><span>' + p[1] + '</span>' + esc(p[2]) + (p[3] && niv(p[3]) === 1 ? '<span class="lect" title="Lecture seule">lecture</span>' : '') + '</button>').join('');
    $('moi').innerHTML = '<span class="qui">' + esc(m.nom) + '</span>' + badgeGrade(m.grade) + '<button class="btn petit" data-act="mdp" title="Mon mot de passe" aria-label="Mon mot de passe">🔑<span class="txt"> Mon mot de passe</span></button><button class="btn petit" data-act="quitter" title="Déconnexion" aria-label="Déconnexion">⎋<span class="txt"> Déconnexion</span></button>';
    $('menu-mobile').hidden = false;
    document.body.dataset.page = RENDUS[S.page] ? S.page : 'accueil';   // ambiance propre à la page (voir style.css)
    (RENDUS[S.page] || RENDUS.accueil)();
  }
  $('nav').addEventListener('click', ev => {
    const b = ev.target.closest('[data-page]'); if (!b) return;
    S.page = b.dataset.page; ecrireLocal('chat-page', S.page); $('nav').classList.remove('ouvert'); dessiner(); $('page').focus(); window.scrollTo(0, 0);
  });
  $('menu-mobile').addEventListener('click', () => $('nav').classList.toggle('ouvert'));

  const entete = (titre, aide, droite) => '<div class="entete"><h2>' + esc(titre) + '</h2>' + (droite ? '<div class="droite">' + droite + '</div>' : '') + (aide ? '<p class="aide">' + aide + '</p>' : '') + '</div>';
  const selSemaine = k => {
    const s = S.sem[k] || semCour();
    return '<div class="semaine"><button data-act="sem" data-k="' + k + '" data-d="-7" aria-label="Semaine précédente">◀</button><span>' + esc(fmtSem(s)) + (s === semCour() ? ' <span class="cour">· en cours</span>' : '') + '</span><button data-act="sem" data-k="' + k + '" data-d="7" aria-label="Semaine suivante">▶</button>' +
      (s !== semCour() ? '<button data-act="sem" data-k="' + k + '" data-d="0" title="Revenir à la semaine en cours">⟳</button>' : '') + '</div>';
  };
  const tableau = (tetes, lignes, pied) => '<div class="tableau-b"><table class="t"><thead><tr>' + tetes.map(t => '<th' + (t[1] ? ' class="' + t[1] + '"' : '') + '>' + esc(t[0]) + '</th>').join('') + '</tr></thead><tbody>' + lignes.join('') + '</tbody>' + (pied ? '<tfoot>' + pied + '</tfoot>' : '') + '</table></div>';

  // =====================================================================
  //  Calculs : retards, états
  // =====================================================================
  function etatEtab(e, sem) {
    const d = (S.d.declarations || []).find(x => x.etablissement === e.id && x.semaine === sem);
    const pt = paiement('taxe', e.id, sem), pl = paiement('loyer_etab', e.id, sem);
    return { d, pt, pl, loyer: num(e.loyer) };
  }
  function retardsEtab(e) {
    if (e.actif !== '1') return { taxes: [], loyers: [] };
    const passees = semaines(debutDe(e.depuis), ajout(semCour(), -7));
    return { taxes: passees.filter(s => !paiement('taxe', e.id, s)), loyers: num(e.loyer) > 0 ? passees.filter(s => !paiement('loyer_etab', e.id, s)) : [] };
  }
  function retardsMaison(h) { return h.actif !== '1' || !(num(h.loyer) > 0) ? [] : semaines(debutDe(h.depuis), ajout(semCour(), -7)).filter(s => !paiement('loyer_maison', h.id, s)); }
  const montantCit = c => c.montant !== '' && c.montant != null ? num(c.montant) : num(S.d.reglages.citoyennete);
  function etatCit(c) {
    const debut = debutDe(c.depuis), payees = semaines(debut, ajout(semCour(), 7 * 104)).filter(s => paiement('citoyennete', c.id, s));
    const retard = c.actif !== '1' ? [] : semaines(debut, ajout(semCour(), -7)).filter(s => !paiement('citoyennete', c.id, s));
    let premiere = debut; while (paiement('citoyennete', c.id, premiere) && premiere < ajout(semCour(), 7 * 104)) premiere = ajout(premiere, 7);
    return { debut, retard, payees, jusqu: premiere === debut ? '' : ajout(premiere, -1), premiere };
  }

  // =====================================================================
  //  Pages
  // =====================================================================
  const RENDUS = {};

  // ---------- Accueil ----------
  function annoncesVisibles() {
    return (S.d.annonces || []).filter(a => !a.expire || a.expire >= S.d.aujourdhui)
      .sort((a, b) => (b.epingle - a.epingle) || cleLe(b.le).localeCompare(cleLe(a.le)));
  }
  const carteAnnonce = a => '<article class="annonce' + (a.epingle ? ' epingle' : '') + '"><h4>' + (a.epingle ? '📌 ' : '') + esc(a.titre) + '</h4>' + (a.texte ? '<p>' + esc(a.texte).replace(/\n/g, '<br>') + '</p>' : '') +
    '<small>' + esc(a.par) + ' · ' + esc((a.le || '').split(' ')[0]) + (a.grades.length ? ' · pour : ' + a.grades.map(g => esc(grade(g).nom)).join(', ') : '') + (a.expire ? ' · jusqu\'au ' + esc(fmtJ(a.expire)) : '') + '</small></article>';
  /** Mes missions où il manque mon rapport (ou un rapport à revoir). */
  const rapportsAFaire = id => (S.d.missions || []).filter(x => x.membres.indexOf(id) >= 0 && (x.statut === 'en_cours' || x.statut === 'terminee'))
    .filter(x => { const r = (S.d.rapports || []).filter(k => k.mission === x.id && k.auteur === id); return !r.length || r.some(k => k.statut === 'a_revoir'); });
  RENDUS.accueil = () => {
    const m = S.d.moi, g = grade(m.grade), sc = semCour(), auj = S.d.aujourdhui;
    const mesMissions = (S.d.missions || []).filter(x => x.membres.indexOf(m.id) >= 0 && (x.statut === 'prevue' || x.statut === 'en_cours'));
    const chiffres = [];
    if (S.d.tresor && niv('tresor')) {
      const solde = S.d.tresor.reduce((t, x) => t + (x.sens === 'sortie' ? -1 : 1) * num(x.montant), 0);
      const ent = S.d.tresor.filter(x => x.semaine === sc && x.sens === 'entree').reduce((t, x) => t + num(x.montant), 0);
      chiffres.push(['Trésor', fmtS(solde), solde < 0], ['Entrées de la semaine', fmtS(ent)]);
    }
    let retards = 0;
    if (S.d.etablissements && (niv('entreprises') || niv('thaneries'))) S.d.etablissements.forEach(e => { const r = retardsEtab(e); retards += r.taxes.length + r.loyers.length; });
    if (S.d.maisons && niv('maisons')) S.d.maisons.forEach(h => { retards += retardsMaison(h).length; });
    if (S.d.citoyens && niv('citoyennete')) S.d.citoyens.forEach(c => { retards += etatCit(c).retard.length; });
    if (niv('entreprises') || niv('thaneries') || niv('maisons') || niv('citoyennete')) chiffres.push(['Paiements en retard', String(retards), retards > 0]);
    if (niv('missions')) chiffres.push(['Missions en cours', String((S.d.missions || []).filter(x => x.statut === 'en_cours').length)]);
    const imp = (S.d.affaires || []).filter(impayee);
    if (S.d.affaires) chiffres.push(['Amendes impayées', imp.length ? fmtS(imp.reduce((t, a) => t + a.amende, 0)) : '0', imp.length > 0]);
    if (S.d.detentions) chiffres.push(['Détenus', String(S.d.detentions.filter(x => x.statut === 'detenu').length)]);
    if (S.d.avis) chiffres.push(['Avis de recherche actifs', String(S.d.avis.filter(x => x.statut === 'recherche').length)]);
    const paye = paiement('salaire', m.id, sc);
    const afaire = [];
    if (niv('salaires') >= 2) { const n = S.d.membres.filter(x => x.actif && grade(x.grade).garde && statut(x.statut).paye && !paiement('salaire', x.id, sc) && salaireDe(x) > 0).length; if (n) afaire.push(['salaires', n + ' salaire(s) à verser cette semaine']); }
    ['entreprises', 'thaneries'].forEach(p => { if (niv(p) >= 2 && S.d.etablissements) { const n = S.d.etablissements.filter(e => e.actif === '1' && (e.categorie === 'thanerie') === (p === 'thaneries') && !etatEtab(e, sc).d).length; if (n) afaire.push([p, n + ' ' + (p === 'thaneries' ? 'thanerie(s)' : 'entreprise(s)') + ' sans déclaration cette semaine']); } });
    if (niv('citoyennete') >= 2 && S.d.citoyens) { const n = S.d.citoyens.filter(c => c.actif === '1' && etatCit(c).retard.length).length; if (n) afaire.push(['citoyennete', n + ' citoyen(s) en retard de paiement']); }
    if (niv('prison') >= 2 && S.d.detentions) { const n = S.d.detentions.filter(x => x.statut === 'detenu' && x.sortie_prevue <= auj).length; if (n) afaire.push(['prison', n + ' détenu(s) à libérer']); }
    if (niv('justice') >= 2 && imp.length) afaire.push(['justice', imp.length + ' amende(s) à encaisser']);
    if (niv('missions') >= 2) { const n = (S.d.rapports || []).filter(r => r.statut === 'soumis').length; if (n) afaire.push(['missions', n + ' rapport(s) de mission à valider']); }
    if (niv('armurerie') >= 2 && S.d.prets) { const n = S.d.prets.filter(p => p.etat === 'prete' && ecart(p.sortie, auj) > 14).length; if (n) afaire.push(['armurerie', n + ' prêt(s) d\'équipement de plus de 2 semaines']); }
    // mon planning, mon équipement, mes rapports
    const mesGardes = (S.d.planning || []).filter(p => p.semaine === sc && p.membres.indexOf(m.id) >= 0).sort((a, b) => a.jour - b.jour || Object.keys(CRENEAUX).indexOf(a.creneau) - Object.keys(CRENEAUX).indexOf(b.creneau));
    const mesPrets = (S.d.prets || []).filter(p => p.membre === m.id && p.etat === 'prete');
    const maRetenue = (S.d.prets || []).filter(p => p.membre === m.id && p.retenue > 0 && !p.retenue_paiement).reduce((t, p) => t + p.retenue, 0);
    const aRediger = rapportsAFaire(m.id);
    const ann = annoncesVisibles();
    $('page').innerHTML = entete('Bienvenue, ' + m.nom, 'Nous sommes le ' + esc(fmtJ(auj)) + ', ' + esc(fmtSem(sc))) +
      (ann.length ? '<section class="carte tableau-aff"><div class="tete"><h3>📢 Tableau d\'affichage</h3>' + (niv('annonces') ? '<button class="btn lien" data-act="aller" data-p="annonces">Toutes les annonces</button>' : '') + '</div>' + ann.slice(0, 4).map(carteAnnonce).join('') + '</section>' : '') +
      (chiffres.length ? '<div class="chiffres">' + chiffres.map(c => '<div class="chiffre' + (c[2] ? ' alerte' : '') + '"><b>' + esc(c[1]) + '</b><small>' + esc(c[0]) + '</small></div>').join('') + '</div>' : '') +
      '<div class="grille">' +
      '<div class="carte"><h3>Mon service</h3><p>' + badgeGrade(m.grade) + ' ' + badgeStatut(m.statut) + '</p>' +
        (g.garde ? '<p>Solde : <b>' + esc(fmtS(salaireDe(m))) + '</b> par semaine' + (num(m.prime) ? ' <small>(dont ' + esc(fmtS(m.prime)) + ' de prime)</small>' : '') + '<br>' + (paye ? '<span class="etat ok">✓ Payé cette semaine</span>' : '<span class="etat neutre">Pas encore payé cette semaine</span>') + '</p>' : '<p class="aide">Ce grade ne reçoit pas de solde de la garde.</p>') +
        (maRetenue ? '<p class="etat retard">Retenue à venir sur ton solde : ' + esc(fmtS(maRetenue)) + ' (équipement)</p>' : '') + '</div>' +
      (g.garde || mesGardes.length ? '<div class="carte"><h3>Mes gardes cette semaine</h3>' + (mesGardes.length ? mesGardes.map(p => '<p><b>' + esc(JOURS[p.jour]) + '</b> ' + esc(fmtCourt(ajout(p.semaine, p.jour))) + ' · ' + esc(CRENEAUX[p.creneau]) + ' · ' + esc(p.poste) + '</p>').join('') : vide('Aucune garde prévue pour toi cette semaine.')) + '</div>' : '') +
      '<div class="carte"><h3>Mes missions</h3>' + (mesMissions.length ? mesMissions.map(x => '<p>' + badge(STATUTS_MISSION[x.statut][0], STATUTS_MISSION[x.statut][1]) + ' <b>' + esc(x.titre) + '</b>' + (x.lieu ? ' <small>· ' + esc(x.lieu) + '</small>' : '') + (x.debut ? ' <small>· ' + esc(fmtJ(x.debut)) + '</small>' : '') + '</p>').join('') : vide('Aucune mission en cours pour toi.')) +
        (aRediger.length ? '<p style="margin-top:10px"><b>Rapports à rédiger</b></p>' + aRediger.map(x => '<p><button class="btn petit or" data-act="rapport" data-m="' + esc(x.id) + '">✍ ' + esc(x.titre) + '</button></p>').join('') : '') + '</div>' +
      (mesPrets.length ? '<div class="carte"><h3>Mon équipement</h3>' + mesPrets.map(p => '<p>🗡️ ' + esc(p.nomEquipement) + (p.quantite > 1 ? ' × ' + p.quantite : '') + ' <small>· depuis le ' + esc(fmtJ(p.sortie)) + '</small></p>').join('') + '</div>' : '') +
      (afaire.length ? '<div class="carte"><h3>À faire</h3>' + afaire.map(a => '<p><button class="btn lien" data-act="aller" data-p="' + a[0] + '">' + esc(a[1]) + '</button></p>').join('') + '</div>' : '') +
      '</div>';
  };

  // ---------- Garde ----------
  RENDUS.garde = () => {
    const q = normal(S.f.garde || ''), tous = !!S.f.gardeTous, ed = niv('garde') >= 2;
    const ms = S.d.membres.filter(m => m.actif && (tous || grade(m.grade).garde) && (!q || normal(m.nom + ' ' + grade(m.grade).nom + ' ' + statut(m.statut).nom).indexOf(q) >= 0))
      .sort((a, b) => grade(b.grade).rang - grade(a.grade).rang || a.nom.localeCompare(b.nom, 'fr'));
    const enCours = id => (S.d.missions || []).filter(x => x.statut === 'en_cours' && x.membres.indexOf(id) >= 0).length;
    const total = ms.filter(m => grade(m.grade).garde && statut(m.statut).paye).reduce((t, m) => t + salaireDe(m), 0);
    $('page').innerHTML = entete('Personnel de garde', 'Les membres de la garde, leur grade, leur statut et leur solde hebdomadaire (solde du grade + prime).',
      '<input class="recherche" data-f="garde" placeholder="Chercher…" value="' + esc(S.f.garde || '') + '"><label class="case" style="margin:0"><input type="checkbox" data-act="gardeTous"' + (tous ? ' checked' : '') + '> Tous les comptes</label>') +
      (ms.length ? '<div class="regiment">' + ms.map(m => { const g = grade(m.grade), ch = Math.max(0, Math.min(4, Math.round(g.rang / 25)));
        return '<article class="soldat' + (statut(m.statut).paye ? '' : ' repos') + '"><svg class="ecu" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 3 8v13c0 12 8 20 17 23 9-3 17-11 17-23V8z" fill="' + esc(g.couleur) + '" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/>' +
          [0, 1, 2, 3].slice(0, ch).map(i => '<path d="M9 ' + (16 + i * 6) + ' 20 ' + (10 + i * 6) + ' 31 ' + (16 + i * 6) + '" fill="none" stroke="rgba(255,245,220,.85)" stroke-width="2.6" stroke-linejoin="round"/>').join('') + '</svg>' +
          '<div class="fiche-s"><h3>' + esc(m.nom) + '</h3><div>' + badgeGrade(m.grade) + ' ' + badgeStatut(m.statut) + '</div>' +
          '<p class="meta">' + (g.garde ? 'Solde : <b>' + esc(fmtS(salaireDe(m))) + '</b>' + (num(m.prime) ? ' <small>(dont ' + esc(fmtS(m.prime)) + ' de prime)</small>' : '') : 'Hors solde') + ' · ' + enCours(m.id) + ' mission(s) en cours</p>' +
          (ed ? '<button class="btn petit" data-act="membre" data-id="' + esc(m.id) + '">Modifier</button>' : '') + '</div></article>'; }).join('') + '</div>' +
        '<p class="aide" style="margin-top:12px">' + ms.length + ' membre(s) · soldes à verser chaque semaine : <b>' + esc(fmtS(total)) + '</b> · les chevrons indiquent le rang.</p>' : vide('Aucun membre.'));
  };
  function ouvrirMembre(id) {
    const m = membre(id); if (!m) return;
    fenetre({ titre: 'Modifier ' + m.nom, html:
      choix('mb-grade', 'Grade', S.d.grades.filter(g => g.id !== 'jarl' || S.d.moi.jarl || m.grade === 'jarl').map(g => [g.id, g.nom + (g.garde ? ' — ' + fmtS(g.salaire) + '/sem.' : '')]), m.grade) +
      choix('mb-statut', 'Statut', S.d.statuts.map(s => [s.id, s.nom + (s.paye ? '' : ' (non payé)')]), m.statut) +
      entree('mb-prime', 'Prime hebdomadaire (septimes)', m.prime || 0, 'type="number" min="0" step="1"'),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('majMembre', { id, grade: val('mb-grade'), statut: val('mb-statut'), prime: val('mb-prime') })); toast('Membre mis à jour.'); } }] });
  }

  // ---------- Missions ----------
  RENDUS.missions = () => {
    const ed = niv('missions') >= 2, fs = S.f.mstatut || 'actives', q = normal(S.f.missions || '');
    const ms = (S.d.missions || []).filter(x => (fs === 'toutes' || (fs === 'actives' ? (x.statut === 'prevue' || x.statut === 'en_cours') : x.statut === fs)) &&
      (!q || normal(x.titre + ' ' + x.type + ' ' + x.lieu + ' ' + x.membres.map(id => (membre(id) || {}).nom).join(' ')).indexOf(q) >= 0))
      .sort((a, b) => (a.debut || '9') .localeCompare(b.debut || '9'));
    $('page').innerHTML = entete('Missions', 'Patrouilles, escortes, enquêtes… avec les membres affectés et le compte rendu.',
      '<select class="mini" data-f="mstatut"><option value="actives">Prévues et en cours</option>' + Object.keys(STATUTS_MISSION).map(k => '<option value="' + k + '"' + (fs === k ? ' selected' : '') + '>' + STATUTS_MISSION[k][0] + 's</option>').join('') + '<option value="toutes"' + (fs === 'toutes' ? ' selected' : '') + '>Toutes</option></select>' +
      '<input class="recherche" data-f="missions" placeholder="Chercher…" value="' + esc(S.f.missions || '') + '">' + (ed ? '<button class="btn or" data-act="mission">+ Nouvelle mission</button>' : '')) +
      (ms.length ? '<div class="grille ordres">' + ms.map(x => '<div class="carte mission st-' + esc(x.statut) + '"><div class="ordre-t">Ordre de mission</div><span class="tampon-m">' + esc(STATUTS_MISSION[x.statut][0]) + '</span><div class="tete"><h3>' + esc(x.titre) + '</h3></div>' +
        '<div class="meta">' + [x.type, x.lieu, x.debut ? fmtJ(x.debut) + (x.fin && x.fin !== x.debut ? ' → ' + fmtJ(x.fin) : '') : ''].filter(Boolean).map(esc).join(' · ') + '</div>' +
        (x.membres.length ? '<div>' + x.membres.map(id => { const mb = membre(id); return mb ? badgeGrade(mb.grade).replace(esc(grade(mb.grade).nom), esc(mb.nom)) : ''; }).join(' ') + '</div>' : '<div class="meta">Personne d\'affecté.</div>') +
        (x.description ? '<p>' + esc(x.description) + '</p>' : '') + (x.compte_rendu ? '<div class="cr">📝 ' + esc(x.compte_rendu) + '</div>' : '') +
        '<div class="boutons-c">' + boutonRapports(x) + (ed ? '<button class="btn petit" data-act="mission" data-id="' + esc(x.id) + '">Modifier</button>' : '') + '</div></div>').join('') + '</div>' : vide('Aucune mission.'));
  };
  function boutonRapports(x) {
    const rs = (S.d.rapports || []).filter(r => r.mission === x.id), att = rs.filter(r => r.statut === 'soumis').length;
    const membreDe = x.membres.indexOf(S.d.moi.id) >= 0;
    if (!rs.length && !membreDe && niv('missions') < 2) return '';
    return '<button class="btn petit' + (att && niv('missions') >= 2 ? ' or' : '') + '" data-act="rapports" data-m="' + esc(x.id) + '">📜 Rapports' + (rs.length ? ' (' + rs.length + (att ? ', ' + att + ' à valider' : '') + ')' : '') + '</button>';
  }
  function ouvrirMission(id) {
    const x = id ? S.d.missions.find(m => m.id === id) : null;
    let coches = x ? x.membres.slice() : [];
    const membresG = S.d.membres.filter(m => m.actif).sort((a, b) => (grade(b.grade).garde - grade(a.grade).garde) || grade(b.grade).rang - grade(a.grade).rang || a.nom.localeCompare(b.nom, 'fr'));
    fenetre({ titre: x ? 'Mission : ' + x.titre : 'Nouvelle mission', large: true, html:
      '<div class="rang">' + entree('mi-titre', 'Titre', x && x.titre, 'maxlength="80" placeholder="Ex. : Patrouille du port"') + champ('', 'Type', '<input id="mi-type" list="mi-types" maxlength="40" value="' + esc(x ? x.type : '') + '"><datalist id="mi-types">' + TYPES_MISSION.map(t => '<option value="' + t + '">').join('') + '</datalist>') + '</div>' +
      '<div class="rang">' + entree('mi-lieu', 'Lieu', x && x.lieu, 'maxlength="80"') + entree('mi-debut', 'Début', x && x.debut, 'type="date"') + entree('mi-fin', 'Fin', x && x.fin, 'type="date"') +
        choix('mi-statut', 'Statut', Object.keys(STATUTS_MISSION).map(k => [k, STATUTS_MISSION[k][0]]), x ? x.statut : 'prevue') + '</div>' +
      champ('', 'Membres affectés', '<div class="coches" id="mi-membres">' + membresG.map(m => '<label class="' + (coches.indexOf(m.id) >= 0 ? 'on' : '') + '"><input type="checkbox" value="' + esc(m.id) + '"' + (coches.indexOf(m.id) >= 0 ? ' checked' : '') + '> ' + esc(m.nom) + ' <small style="color:var(--doux)">' + esc(grade(m.grade).nom) + '</small></label>').join('') + '</div>') +
      zone('mi-desc', 'Ordres / description', x && x.description, 'maxlength="3000"') + zone('mi-cr', 'Compte rendu', x && x.compte_rendu, 'maxlength="5000"'),
      ouvert: () => $('mi-membres').addEventListener('change', ev => { ev.target.closest('label').classList.toggle('on', ev.target.checked); }),
      boutons: (x ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer la mission « ' + x.titre + ' » ?', f: async () => { maj(await api('supprimerMission', { id: x.id })); toast('Mission supprimée.'); } }] : []).concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        coches = [...$('mi-membres').querySelectorAll('input:checked')].map(i => i.value);
        maj(await api('enregistrerMission', { id: x ? x.id : '', titre: val('mi-titre'), type: val('mi-type'), lieu: val('mi-lieu'), debut: val('mi-debut'), fin: val('mi-fin'), statut: val('mi-statut'), membres: coches, description: val('mi-desc'), compte_rendu: val('mi-cr') }));
        toast('Mission enregistrée.'); } }]) });
  }

  // ---------- Salaires ----------
  RENDUS.salaires = () => {
    const sem = S.sem.salaires || semCour(), ed = niv('salaires') >= 2;
    const ms = S.d.membres.filter(m => m.actif && grade(m.grade).garde).sort((a, b) => grade(b.grade).rang - grade(a.grade).rang || a.nom.localeCompare(b.nom, 'fr'));
    let du = 0, verse = 0;
    const lignes = ms.map(m => {
      const p = paiement('salaire', m.id, sem), s = statut(m.statut), ret = p ? 0 : retenueDe(m), mt = salaireDe(m) - ret;
      if (p) verse += num(p.montant); else if (s.paye && mt > 0) du += mt;
      const etat = p ? '<span class="etat ok">✓ Versé (' + esc(fmtS(p.montant)) + ')</span><br><small>par ' + esc(p.par) + ', ' + esc(p.le) + '</small>' : !s.paye ? '<span class="etat neutre">Non payé (' + esc(s.nom) + ')</span>' : mt > 0 ? '<span class="etat du">À verser</span>' : '<span class="etat neutre">Solde nul</span>';
      return '<tr><td>' + esc(m.nom) + '</td><td>' + badgeGrade(m.grade) + '</td><td>' + badgeStatut(m.statut) + '</td><td class="num">' + esc(fmtS(mt)) + (ret ? '<br><small class="etat retard">− ' + esc(fmtS(ret)) + ' de retenue</small>' : '') + '</td><td>' + etat + '</td><td class="act">' + (ed && !p && s.paye && mt > 0 ? '<button class="btn petit" data-act="payer" data-id="' + esc(m.id) + '">Verser</button>' : '') + '</td></tr>';
    });
    $('page').innerHTML = entete('Salaires', 'Solde du grade + prime, versé chaque semaine aux membres dont le statut est payé. Chaque versement est inscrit au trésor.', selSemaine('salaires') + (ed && du > 0 ? '<button class="btn or" data-act="payerTous">Verser tous les soldes (' + esc(fmtS(du)) + ')</button>' : '')) +
      (ms.length ? tableau([['Nom'], ['Grade'], ['Statut'], ['Solde', 'num'], ['État'], ['', 'act']], lignes, '<tr><td colspan="3">Versé : ' + esc(fmtS(verse)) + '</td><td class="num">Reste : ' + esc(fmtS(du)) + '</td><td colspan="2"></td></tr>') : vide('Aucun membre de la garde.'));
  };

  // ---------- Entreprises et thaneries ----------
  function rendreEtabs(page, cat) {
    const sem = S.sem[page] || semCour(), ed = niv(page) >= 2, q = normal(S.f[page] || ''), inactifs = !!S.f[page + 'In'];
    const taux = num(S.d.reglages.taux_defaut);
    const es = (S.d.etablissements || []).filter(e => e.categorie === cat && (inactifs || e.actif === '1') && (!q || normal(e.nom + ' ' + e.type + ' ' + e.proprietaire + ' ' + e.adresse).indexOf(q) >= 0))
      .sort((a, b) => (b.actif === '1') - (a.actif === '1') || a.nom.localeCompare(b.nom, 'fr'));
    let decl = 0, taxeEnc = 0, taxeDue = 0, loyEnc = 0, loyDu = 0;
    const lignes = es.map(e => {
      const st = etatEtab(e, sem), r = retardsEtab(e), actif = e.actif === '1' && sem >= debutDe(e.depuis);
      if (st.d) decl++;
      if (st.pt) taxeEnc += num(st.pt.montant); else if (st.d) taxeDue += num(st.d.taxe);
      if (st.pl) loyEnc += num(st.pl.montant); else if (actif && st.loyer > 0) loyDu += st.loyer;
      const tx = e.taux !== '' ? num(e.taux) : taux;
      const etatT = !actif ? '<span class="etat neutre">—</span>' : st.pt ? '<span class="etat ok">✓ Encaissée</span>' : st.d ? '<span class="etat du">À encaisser</span>' : '<span class="etat ' + (sem < semCour() ? 'retard' : 'neutre') + '">Non déclarée</span>';
      const etatL = !actif || !(st.loyer > 0) ? '<span class="etat neutre">—</span>' : st.pl ? '<span class="etat ok">✓ Payé</span>' : '<span class="etat ' + (sem < semCour() ? 'retard' : 'du') + '">À payer</span>';
      const nR = r.taxes.length + r.loyers.length;
      const acts = !ed || !actif ? '' : (!st.pt ? '<button class="btn petit" data-act="declarer" data-id="' + esc(e.id) + '" data-s="' + sem + '">' + (st.d ? 'Corriger' : 'Déclarer') + '</button>' : '') +
        (st.d && !st.pt ? '<button class="btn petit or" data-act="encTaxe" data-id="' + esc(e.id) + '" data-s="' + sem + '">Encaisser taxe</button>' : '') +
        (st.loyer > 0 && !st.pl ? '<button class="btn petit" data-act="encLoyer" data-id="' + esc(e.id) + '" data-s="' + sem + '">Encaisser loyer</button>' : '');
      return '<tr class="' + (e.actif === '1' ? '' : 'inactif') + '"><td><span class="enseigne">' + esc(e.nom) + '</span><br><small>' + esc([e.type, e.proprietaire].filter(Boolean).join(' · ') || '—') + '</small></td><td class="num">' + tx + ' %' + (e.taux === '' ? '<br><small>défaut</small>' : '') + '</td>' +
        '<td class="num">' + (st.d ? esc(fmtS(st.d.recettes)) : '<small>—</small>') + '</td><td class="num">' + (st.d ? esc(fmtS(st.d.taxe)) : '<small>—</small>') + '</td><td>' + etatT + '</td>' +
        '<td class="num">' + (st.loyer > 0 ? esc(fmtS(st.loyer)) : '<small>—</small>') + '</td><td>' + etatL + '</td>' +
        '<td class="num">' + (nR ? '<button class="btn lien" data-act="retardsEtab" data-id="' + esc(e.id) + '" style="color:#ff8e7a">' + nR + ' en retard</button>' : '<span class="etat ok">à jour</span>') + '</td>' +
        '<td class="act">' + acts + (ed ? '<button class="btn petit" data-act="etab" data-id="' + esc(e.id) + '" title="Fiche">✎</button>' : '') + '</td></tr>';
    });
    const nomP = cat === 'thanerie' ? 'Thaneries' : 'Entreprises', un = cat === 'thanerie' ? 'une thanerie' : 'une entreprise';
    $('page').innerHTML = entete(nomP, 'Chaque semaine, les recettes déclarées donnent la taxe (' + taux + ' % par défaut, ou le taux propre à chacune), plus le loyer s\'il y en a un. On peut encaisser une semaine passée : change de semaine avec ◀ ou clique sur « en retard ».',
      selSemaine(page) + '<input class="recherche" data-f="' + page + '" placeholder="Chercher…" value="' + esc(S.f[page] || '') + '"><label class="case" style="margin:0"><input type="checkbox" data-act="inactifs" data-p="' + page + '"' + (inactifs ? ' checked' : '') + '> Fermées</label>' + (ed ? '<button class="btn or" data-act="etab" data-cat="' + cat + '">+ Ajouter ' + un + '</button>' : '')) +
      '<div class="chiffres"><div class="chiffre"><b>' + decl + ' / ' + es.filter(e => e.actif === '1').length + '</b><small>déclarations cette semaine</small></div><div class="chiffre"><b>' + esc(fmtS(taxeEnc)) + '</b><small>taxes encaissées</small></div><div class="chiffre' + (taxeDue ? ' alerte' : '') + '"><b>' + esc(fmtS(taxeDue)) + '</b><small>taxes déclarées à encaisser</small></div><div class="chiffre"><b>' + esc(fmtS(loyEnc)) + '</b><small>loyers encaissés</small></div><div class="chiffre' + (loyDu ? ' alerte' : '') + '"><b>' + esc(fmtS(loyDu)) + '</b><small>loyers à encaisser</small></div></div>' +
      (es.length ? tableau([['Nom'], ['Taux', 'num'], ['Recettes', 'num'], ['Taxe', 'num'], ['État taxe'], ['Loyer', 'num'], ['État loyer'], ['Retards', 'num'], ['', 'act']], lignes) : vide('Aucun établissement pour l\'instant.'));
  }
  RENDUS.entreprises = () => rendreEtabs('entreprises', 'entreprise');
  RENDUS.thaneries = () => rendreEtabs('thaneries', 'thanerie');
  const etab = id => (S.d.etablissements || []).find(e => e.id === id);
  function ouvrirEtab(id, cat) {
    const e = id ? etab(id) : null; cat = e ? e.categorie : cat;
    const nomC = cat === 'thanerie' ? 'thanerie' : 'entreprise';
    fenetre({ titre: e ? e.nom : 'Nouvelle ' + nomC, html:
      '<div class="rang">' + entree('et-nom', 'Nom', e && e.nom, 'maxlength="80"') + entree('et-type', cat === 'thanerie' ? 'Domaine (ferme, mine…)' : 'Activité (forge, auberge…)', e && e.type, 'maxlength="40"') + '</div>' +
      '<div class="rang">' + entree('et-proprio', cat === 'thanerie' ? 'Thane / exploitant' : 'Propriétaire', e && e.proprietaire, 'maxlength="60"') + entree('et-adresse', 'Adresse', e && e.adresse, 'maxlength="120"') + '</div>' +
      '<div class="rang">' + entree('et-taux', 'Taux de taxe (%)', e ? e.taux : '', 'type="number" min="0" max="100" step="0.5" placeholder="' + esc(S.d.reglages.taux_defaut) + ' (défaut)"') + entree('et-loyer', 'Loyer hebdomadaire', e ? e.loyer : 0, 'type="number" min="0" step="1"') +
        entree('et-depuis', 'Redevable depuis', e ? e.depuis : semCour(), 'type="date"') + '</div>' +
      zone('et-note', 'Note', e && e.note, 'maxlength="1000"') + caseC('et-actif', 'En activité (décochez si l\'établissement a fermé)', e ? e.actif === '1' : true),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        maj(await api('enregistrerEtablissement', { id: e ? e.id : '', categorie: cat, nom: val('et-nom'), type: val('et-type'), proprietaire: val('et-proprio'), adresse: val('et-adresse'), taux: val('et-taux'), loyer: val('et-loyer'), depuis: val('et-depuis'), note: val('et-note'), actif: val('et-actif') }));
        toast('Enregistré.'); } }] });
  }
  function ouvrirDeclaration(id, sem) {
    const e = etab(id), st = etatEtab(e, sem), taux = e.taux !== '' ? num(e.taux) : num(S.d.reglages.taux_defaut);
    fenetre({ titre: 'Déclaration — ' + e.nom, html: '<p class="aide">' + esc(fmtSem(sem)) + ' · taux ' + taux + ' %</p>' +
      entree('de-rec', 'Recettes de la semaine (septimes)', st.d ? st.d.recettes : '', 'type="number" min="0" step="1"') + '<p>Taxe : <b id="de-taxe">—</b></p>' + caseC('de-enc', 'Encaisser la taxe maintenant', true),
      ouvert: () => { const c = () => { $('de-taxe').textContent = $('de-rec').value === '' ? '—' : fmtS(Math.round(num($('de-rec').value) * taux) / 100); }; $('de-rec').addEventListener('input', c); c(); },
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        if (val('de-rec') === '') throw new Error('Indiquez les recettes.');
        maj(await api('declarer', { etablissement: id, semaine: sem, recettes: val('de-rec'), encaisser: val('de-enc') }));
        toast(val('de-enc') ? 'Déclaration enregistrée et taxe encaissée.' : 'Déclaration enregistrée.'); } }] });
  }
  async function encaisserEtab(id, sem, quoi) {
    const e = etab(id), st = etatEtab(e, sem);
    const mt = quoi === 'taxe' ? st.d.taxe : e.loyer;
    if (!confirm('Encaisser ' + (quoi === 'taxe' ? 'la taxe' : 'le loyer') + ' de « ' + e.nom + ' » : ' + fmtS(mt) + ' (' + fmtSem(sem) + ') ?')) return;
    try { maj(await api('encaisserEtablissement', { etablissement: id, semaine: sem, quoi })); toast('Encaissé : ' + fmtS(mt) + '.'); } catch (x) { toast(msg(x), true); }
  }
  function ouvrirRetardsEtab(id) {
    const e = etab(id), r = retardsEtab(e), ed = niv(e.categorie === 'thanerie' ? 'thaneries' : 'entreprises') >= 2;
    const toutes = [...new Set(r.taxes.concat(r.loyers))].sort().reverse();
    fenetre({ titre: 'Retards — ' + e.nom, large: true, html: toutes.length ? tableau([['Semaine'], ['Taxe'], ['Loyer'], ['', 'act']], toutes.map(s => {
      const st = etatEtab(e, s);
      return '<tr><td>' + esc(fmtSem(s)) + '</td><td>' + (st.pt ? '<span class="etat ok">✓</span>' : st.d ? '<span class="etat du">Déclarée : ' + esc(fmtS(st.d.taxe)) + '</span>' : '<span class="etat retard">Non déclarée</span>') + '</td><td>' + (!(st.loyer > 0) ? '—' : st.pl ? '<span class="etat ok">✓</span>' : '<span class="etat retard">' + esc(fmtS(st.loyer)) + '</span>') + '</td><td class="act">' +
        (ed && !st.pt ? '<button class="btn petit" data-act="declarer" data-id="' + esc(e.id) + '" data-s="' + s + '">' + (st.d ? 'Corriger' : 'Déclarer') + '</button>' : '') + (ed && st.d && !st.pt ? '<button class="btn petit or" data-act="encTaxe" data-id="' + esc(e.id) + '" data-s="' + s + '">Taxe</button>' : '') + (ed && st.loyer > 0 && !st.pl ? '<button class="btn petit" data-act="encLoyer" data-id="' + esc(e.id) + '" data-s="' + s + '">Loyer</button>' : '') + '</td></tr>';
    })) : vide('Aucun retard.'), boutons: [{ t: 'Fermer' }] });
    $('mg-corps').onclick = ev => { const b = ev.target.closest('[data-act]'); if (b) { fermer(); actions(b); } };
  }

  // ---------- Maisons ----------
  RENDUS.maisons = () => {
    const sem = S.sem.maisons || semCour(), ed = niv('maisons') >= 2, q = normal(S.f.maisons || ''), inactifs = !!S.f.maisonsIn;
    const hs = (S.d.maisons || []).filter(h => (inactifs || h.actif === '1') && (!q || normal(h.nom + ' ' + h.adresse + ' ' + h.occupant).indexOf(q) >= 0)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    let enc = 0, du = 0;
    const lignes = hs.map(h => {
      const p = paiement('loyer_maison', h.id, sem), r = retardsMaison(h), actif = h.actif === '1' && sem >= debutDe(h.depuis) && num(h.loyer) > 0;
      if (p) enc += num(p.montant); else if (actif) du += num(h.loyer);
      return '<tr class="' + (h.actif === '1' ? '' : 'inactif') + '"><td><span class="enseigne">' + esc(h.nom) + '</span><br><small>' + esc(h.adresse || '—') + '</small></td><td>' + esc(h.occupant || '—') + '</td><td class="num">' + esc(fmtS(h.loyer)) + '</td>' +
        '<td>' + (!actif ? '<span class="etat neutre">—</span>' : p ? '<span class="etat ok">✓ Payé</span>' : '<span class="etat ' + (sem < semCour() ? 'retard' : 'du') + '">À payer</span>') + '</td>' +
        '<td class="num">' + (r.length ? '<span class="etat retard">' + r.length + ' sem. (' + esc(fmtS(r.length * num(h.loyer))) + ')</span>' : '<span class="etat ok">à jour</span>') + '</td>' +
        '<td class="act">' + (ed && h.actif === '1' && num(h.loyer) > 0 ? '<button class="btn petit or" data-act="encMaison" data-id="' + esc(h.id) + '">Encaisser</button>' : '') + (ed ? '<button class="btn petit" data-act="maison" data-id="' + esc(h.id) + '" title="Fiche">✎</button>' : '') + '</td></tr>';
    });
    $('page').innerHTML = entete('Maisons', 'Les logements des citoyens et leur loyer hebdomadaire. « Encaisser » permet de choisir la ou les semaines réglées, passées comprises.',
      selSemaine('maisons') + '<input class="recherche" data-f="maisons" placeholder="Chercher…" value="' + esc(S.f.maisons || '') + '"><label class="case" style="margin:0"><input type="checkbox" data-act="inactifs" data-p="maisons"' + (inactifs ? ' checked' : '') + '> Vides / retirées</label>' + (ed ? '<button class="btn or" data-act="maison">+ Ajouter une maison</button>' : '')) +
      '<div class="chiffres"><div class="chiffre"><b>' + esc(fmtS(enc)) + '</b><small>loyers encaissés cette semaine</small></div><div class="chiffre' + (du ? ' alerte' : '') + '"><b>' + esc(fmtS(du)) + '</b><small>loyers à encaisser cette semaine</small></div></div>' +
      (hs.length ? tableau([['Maison'], ['Occupant'], ['Loyer', 'num'], ['Cette semaine'], ['Retard', 'num'], ['', 'act']], lignes) : vide('Aucune maison enregistrée.'));
  };
  function ouvrirMaison(id) {
    const h = id ? S.d.maisons.find(x => x.id === id) : null;
    fenetre({ titre: h ? h.nom : 'Nouvelle maison', html:
      '<div class="rang">' + entree('ho-nom', 'Nom', h && h.nom, 'maxlength="80" placeholder="Ex. : Maison du Pont"') + entree('ho-adresse', 'Adresse', h && h.adresse, 'maxlength="120"') + '</div>' +
      '<div class="rang">' + entree('ho-occ', 'Occupant', h && h.occupant, 'maxlength="60"') + entree('ho-loyer', 'Loyer hebdomadaire', h ? h.loyer : 0, 'type="number" min="0" step="1"') + entree('ho-depuis', 'Loyer dû depuis', h ? h.depuis : semCour(), 'type="date"') + '</div>' +
      zone('ho-note', 'Note', h && h.note, 'maxlength="1000"') + caseC('ho-actif', 'Louée (décochez si la maison est vide ou retirée)', h ? h.actif === '1' : true),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        maj(await api('enregistrerMaison', { id: h ? h.id : '', nom: val('ho-nom'), adresse: val('ho-adresse'), occupant: val('ho-occ'), loyer: val('ho-loyer'), depuis: val('ho-depuis'), note: val('ho-note'), actif: val('ho-actif') }));
        toast('Maison enregistrée.'); } }] });
  }
  /** Choix des semaines à régler (passées en retard et à venir). */
  function choixSemaines(type, cible, debut, montant, suivantes) {
    const ws = semaines(debut, ajout(semCour(), 7 * suivantes));
    const retard = ws.filter(s => s < semCour() && !paiement(type, cible, s));
    const premieres = ws.filter(s => !paiement(type, cible, s)).slice(0, 1);
    return '<p class="aide">' + esc(fmtS(montant)) + ' par semaine. Les semaines grisées sont déjà réglées.</p>' +
      '<div class="boutons" style="justify-content:flex-start;margin:0 0 8px">' + [1, 2, 4, 8].map(n => '<button type="button" class="btn petit" data-n="' + n + '">' + n + ' sem.</button>').join('') + (retard.length ? '<button type="button" class="btn petit" data-n="retard">Tout le retard (' + retard.length + ')</button>' : '') + '<button type="button" class="btn petit" data-n="0">Aucune</button></div>' +
      '<div class="semaines-c defile" id="cs-liste" style="max-height:300px">' + ws.slice().reverse().map(s => { const p = paiement(type, cible, s);
        return '<label class="' + (p ? 'paye' : s < semCour() ? 'retard' : '') + '"><input type="checkbox" value="' + s + '"' + (p ? ' disabled checked' : premieres.indexOf(s) >= 0 ? ' checked' : '') + '> ' + esc(fmtCourt(s)) + (s === semCour() ? ' <small>(en cours)</small>' : '') + '</label>'; }).join('') + '</div>' +
      '<p>Total : <b id="cs-total"></b></p>';
  }
  function brancherSemaines(montant) {
    const tot = () => { const n = $('cs-liste').querySelectorAll('input:checked:not(:disabled)').length; $('cs-total').textContent = n + ' semaine(s) — ' + fmtS(n * montant); };
    $('cs-liste').addEventListener('change', tot);
    $('mg-corps').querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => {
      const libres = [...$('cs-liste').querySelectorAll('input:not(:disabled)')].reverse();
      libres.forEach(i => { i.checked = false; });
      if (b.dataset.n === 'retard') libres.filter(i => i.closest('label').classList.contains('retard')).forEach(i => { i.checked = true; });
      else libres.slice(0, Number(b.dataset.n)).forEach(i => { i.checked = true; });
      tot();
    }));
    tot();
  }
  const semainesCochees = () => [...$('cs-liste').querySelectorAll('input:checked:not(:disabled)')].map(i => i.value);
  function encaisserMaison(id) {
    const h = S.d.maisons.find(x => x.id === id);
    fenetre({ titre: 'Loyer — ' + h.nom + (h.occupant ? ' (' + h.occupant + ')' : ''), html: choixSemaines('loyer_maison', h.id, debutDe(h.depuis), num(h.loyer), 8) + entree('cs-note', 'Note (facultatif)', '', 'maxlength="200"'),
      ouvert: () => brancherSemaines(num(h.loyer)),
      boutons: [{ t: 'Annuler' }, { t: 'Encaisser', cls: 'or', f: async () => { const s = semainesCochees(); if (!s.length) throw new Error('Cochez au moins une semaine.'); maj(await api('encaisserMaison', { maison: id, semaines: s, note: val('cs-note') })); toast('Loyer encaissé : ' + s.length + ' semaine(s).'); } }] });
  }

  // ---------- Citoyenneté ----------
  RENDUS.citoyennete = () => {
    const ed = niv('citoyennete') >= 2, q = normal(S.f.cit || ''), inactifs = !!S.f.citIn, sc = semCour();
    const cs = (S.d.citoyens || []).filter(c => (inactifs || c.actif === '1') && (!q || normal(c.nom + ' ' + c.note).indexOf(q) >= 0));
    const tri = S.f.ctri || lireLocal('chat-ctri') || 'nom', et = {};
    cs.forEach(c => { et[c.id] = etatCit(c); });
    const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr');
    const TRIS = {
      nom: parNom,
      nomZ: (a, b) => parNom(b, a),
      retard: (a, b) => et[b.id].retard.length * montantCit(b) - et[a.id].retard.length * montantCit(a) || parNom(a, b),
      jusqu: (a, b) => (et[a.id].jusqu || '0').localeCompare(et[b.id].jusqu || '0') || parNom(a, b),
      jusquZ: (a, b) => (et[b.id].jusqu || '0').localeCompare(et[a.id].jusqu || '0') || parNom(a, b),
      montant: (a, b) => montantCit(b) - montantCit(a) || parNom(a, b),
      depuis: (a, b) => String(b.depuis || '').localeCompare(String(a.depuis || '')) || parNom(a, b)
    };
    cs.sort(TRIS[tri] || parNom);
    let enRetard = 0, du = 0, semaineEnc = 0;
    const lignes = cs.map(c => {
      const e = etatCit(c), m = montantCit(c);
      if (e.retard.length) { enRetard++; du += e.retard.length * m; }
      const p = paiement('citoyennete', c.id, sc); if (p) semaineEnc += num(p.montant);
      const jusqu = e.jusqu ? (e.jusqu >= ajout(sc, 6) ? '<span class="etat ok">jusqu\'au ' + esc(fmtJ(e.jusqu)) + '</span>' : '<span class="etat ' + (e.retard.length ? 'retard' : 'du') + '">jusqu\'au ' + esc(fmtJ(e.jusqu)) + '</span>') : '<span class="etat ' + (e.retard.length ? 'retard' : 'du') + '">rien de payé</span>';
      return '<tr class="' + (c.actif === '1' ? '' : 'inactif') + '"><td><b>' + esc(c.nom) + '</b>' + (c.note ? '<br><small>' + esc(c.note) + '</small>' : '') + '</td><td class="num">' + esc(fmtS(m)) + (c.montant === '' ? '<br><small>défaut</small>' : '') + '</td><td>' + jusqu + '</td>' +
        '<td class="num">' + (e.retard.length ? '<span class="sceau-mini mal" title="En retard">✗</span><span class="etat retard">' + e.retard.length + ' sem. (' + esc(fmtS(e.retard.length * m)) + ')</span>' : '<span class="sceau-mini ok" title="En règle">✓</span><span class="etat ok">en règle</span>') + '</td>' +
        '<td class="act">' + (ed && c.actif === '1' ? '<button class="btn petit or" data-act="encCit" data-id="' + esc(c.id) + '">Encaisser</button>' : '') + (ed ? '<button class="btn petit" data-act="citoyen" data-id="' + esc(c.id) + '" title="Fiche">✎</button>' : '') + '</td></tr>';
    });
    $('page').innerHTML = entete('Citoyenneté', 'Chaque citoyen paie ' + esc(fmtS(S.d.reglages.citoyennete)) + ' par semaine (ou un montant propre). Un paiement peut couvrir plusieurs semaines, passées ou à venir : la colonne « Payé » indique jusqu\'à quand il est en règle.',
      '<select class="mini" data-f="ctri" aria-label="Trier">' + [['nom', 'Nom (A → Z)'], ['nomZ', 'Nom (Z → A)'], ['retard', 'Plus gros retard d\'abord'], ['jusqu', 'Payé jusqu\'au : le plus tôt'], ['jusquZ', 'Payé jusqu\'au : le plus tard'], ['montant', 'Montant le plus élevé'], ['depuis', 'Inscrits récemment']].map(o => '<option value="' + o[0] + '"' + (tri === o[0] ? ' selected' : '') + '>Tri : ' + o[1] + '</option>').join('') + '</select>' +
      '<input class="recherche" data-f="cit" placeholder="Chercher un citoyen…" value="' + esc(S.f.cit || '') + '"><label class="case" style="margin:0"><input type="checkbox" data-act="inactifs" data-p="cit"' + (inactifs ? ' checked' : '') + '> Partis</label>' + (ed ? '<button class="btn or" data-act="citoyen">+ Inscrire un citoyen</button>' : '')) +
      '<div class="chiffres"><div class="chiffre"><b>' + cs.filter(c => c.actif === '1').length + '</b><small>citoyens inscrits</small></div><div class="chiffre"><b>' + esc(fmtS(semaineEnc)) + '</b><small>encaissé pour la semaine en cours</small></div><div class="chiffre' + (enRetard ? ' alerte' : '') + '"><b>' + enRetard + '</b><small>citoyens en retard</small></div><div class="chiffre' + (du ? ' alerte' : '') + '"><b>' + esc(fmtS(du)) + '</b><small>de retard au total</small></div></div>' +
      (cs.length ? tableau([['Citoyen'], ['Par semaine', 'num'], ['Payé'], ['Retard', 'num'], ['', 'act']], lignes) : vide('Aucun citoyen inscrit.'));
  };
  function ouvrirCitoyen(id) {
    const c = id ? S.d.citoyens.find(x => x.id === id) : null;
    fenetre({ titre: c ? c.nom : 'Inscrire un citoyen', html:
      '<div class="rang">' + entree('ci-nom', 'Nom', c && c.nom, 'maxlength="60"') + entree('ci-montant', 'Montant hebdomadaire', c ? c.montant : '', 'type="number" min="0" step="1" placeholder="' + esc(S.d.reglages.citoyennete) + ' (défaut)"') + entree('ci-depuis', 'Citoyen depuis', c ? c.depuis : semCour(), 'type="date"') + '</div>' +
      zone('ci-note', 'Note', c && c.note, 'maxlength="1000"') + caseC('ci-actif', 'Citoyen actif (décochez s\'il a quitté la ville)', c ? c.actif === '1' : true),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        maj(await api('enregistrerCitoyen', { id: c ? c.id : '', nom: val('ci-nom'), montant: val('ci-montant'), depuis: val('ci-depuis'), note: val('ci-note'), actif: val('ci-actif') }));
        toast('Citoyen enregistré.'); } }] });
  }
  function encaisserCit(id) {
    const c = S.d.citoyens.find(x => x.id === id), m = montantCit(c);
    fenetre({ titre: 'Citoyenneté — ' + c.nom, html: choixSemaines('citoyennete', c.id, debutDe(c.depuis), m, 12) + entree('cs-note', 'Note (facultatif)', '', 'maxlength="200"'),
      ouvert: () => brancherSemaines(m),
      boutons: [{ t: 'Annuler' }, { t: 'Encaisser', cls: 'or', f: async () => { const s = semainesCochees(); if (!s.length) throw new Error('Cochez au moins une semaine.'); maj(await api('encaisserCitoyennete', { citoyen: id, semaines: s, note: val('cs-note') })); toast('Citoyenneté encaissée : ' + s.length + ' semaine(s), ' + fmtS(s.length * m) + '.'); } }] });
  }

  // ---------- Trésor ----------
  RENDUS.tresor = () => {
    const sem = S.sem.tresor || semCour(), ed = niv('tresor') >= 2, ts = S.d.tresor || [];
    const solde = ts.reduce((t, x) => t + (x.sens === 'sortie' ? -1 : 1) * num(x.montant), 0);
    const ds = ts.filter(x => x.semaine === sem);
    const parCat = {}; ds.forEach(x => { const k = x.sens + '|' + x.categorie; parCat[k] = (parCat[k] || 0) + num(x.montant); });
    const ent = ds.filter(x => x.sens === 'entree').reduce((t, x) => t + num(x.montant), 0), sor = ds.filter(x => x.sens === 'sortie').reduce((t, x) => t + num(x.montant), 0);
    const q = normal(S.f.tresor || ''), fs = S.f.tsens || '';
    const liste = ts.filter(x => (!fs || x.sens === fs) && (S.f.ttout || x.semaine === sem) && (!q || normal(x.libelle + ' ' + x.categorie + ' ' + x.par).indexOf(q) >= 0)).sort((a, b) => (b.le || '').split(' ')[0].split('/').reverse().join('') + (b.le || '').slice(11) > (a.le || '').split(' ')[0].split('/').reverse().join('') + (a.le || '').slice(11) ? 1 : -1);
    $('page').innerHTML = entete('Trésor', 'Toutes les entrées (taxes, loyers, citoyenneté…) et sorties (soldes, dépenses). Les paiements enregistrés dans les autres pages y arrivent tout seuls.',
      selSemaine('tresor') + (ed ? '<button class="btn" data-act="mouv" data-s="entree">+ Recette</button><button class="btn or" data-act="mouv" data-s="sortie">+ Dépense</button>' : '')) +
      '<div class="chiffres"><div class="chiffre' + (solde < 0 ? ' alerte' : '') + '"><b>' + esc(fmtS(solde)) + '</b><small>solde du trésor</small></div><div class="chiffre"><b>' + esc(fmtS(ent)) + '</b><small>entrées de la semaine</small></div><div class="chiffre"><b>' + esc(fmtS(sor)) + '</b><small>sorties de la semaine</small></div><div class="chiffre' + (ent - sor < 0 ? ' alerte' : '') + '"><b>' + esc(fmtS(ent - sor)) + '</b><small>bilan de la semaine</small></div></div>' +
      (Object.keys(parCat).length ? '<div class="carte" style="margin-bottom:16px"><h3>Bilan par catégorie</h3>' + Object.keys(parCat).sort().map(k => '<div style="display:flex;justify-content:space-between;gap:10px"><span>' + (k.split('|')[0] === 'entree' ? '▲ ' : '▼ ') + esc(k.split('|')[1]) + '</span><b>' + esc(fmtS(parCat[k])) + '</b></div>').join('') + '</div>' : '') +
      '<div class="entete" style="margin-bottom:10px"><h3 style="margin:0">Mouvements</h3><div class="droite"><select class="mini" data-f="tsens"><option value="">Entrées et sorties</option><option value="entree"' + (fs === 'entree' ? ' selected' : '') + '>Entrées</option><option value="sortie"' + (fs === 'sortie' ? ' selected' : '') + '>Sorties</option></select><label class="case" style="margin:0"><input type="checkbox" data-act="ttout"' + (S.f.ttout ? ' checked' : '') + '> Toutes les semaines</label><input class="recherche" data-f="tresor" placeholder="Chercher…" value="' + esc(S.f.tresor || '') + '"></div></div>' +
      (liste.length ? '<div class="grand-livre">' + tableau([['Date'], ['Catégorie'], ['Libellé'], ['Recettes', 'num'], ['Dépenses', 'num'], ['Par'], ['', 'act']], liste.slice(0, 400).map(x => '<tr><td>' + esc(fmtJ(x.date)) + '<br><small>' + esc(fmtCourt(x.semaine)) + '</small></td><td>' + esc(x.categorie) + '</td><td>' + esc(x.libelle) + '</td><td class="num recette">' + (x.sens === 'sortie' ? '' : esc(fmtS(x.montant))) + '</td><td class="num depense">' + (x.sens === 'sortie' ? esc(fmtS(x.montant)) : '') + '</td><td><small>' + esc(x.par) + '</small></td><td class="act">' + (ed && x.ref ? '<button class="btn petit danger" data-act="annulerP" data-id="' + esc(x.ref) + '" title="Annuler ce paiement">Annuler</button>' : '') + '</td></tr>')) + '</div>' : vide('Aucun mouvement.'));
  };
  function ouvrirMouvement(sens) {
    fenetre({ titre: sens === 'sortie' ? 'Nouvelle dépense' : 'Nouvelle recette', html:
      '<div class="rang">' + entree('mv-montant', 'Montant', '', 'type="number" min="0" step="1"') + champ('', 'Catégorie', '<input id="mv-cat" list="mv-cats" maxlength="40" placeholder="' + (sens === 'sortie' ? 'Dépenses' : 'Recettes diverses') + '"><datalist id="mv-cats">' + [...new Set((S.d.tresor || []).filter(x => x.sens === sens).map(x => x.categorie))].map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>') + '</div>' +
      entree('mv-lib', 'Libellé', '', 'maxlength="200" placeholder="' + (sens === 'sortie' ? 'Ex. : achat d\'armures' : 'Ex. : amende') + '"') + entree('mv-sem', 'Semaine concernée', S.sem.tresor || semCour(), 'type="date"'),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('ajouterMouvement', { sens, montant: val('mv-montant'), categorie: val('mv-cat'), libelle: val('mv-lib'), semaine: val('mv-sem') })); toast('Mouvement enregistré.'); } }] });
  }

  // ---------- Comptes ----------
  RENDUS.comptes = () => {
    const ed = niv('comptes') >= 2, q = normal(S.f.comptes || ''), inactifs = !!S.f.comptesIn;
    const cs = S.d.membres.filter(m => (inactifs || m.actif) && (!q || normal(m.nom + ' ' + grade(m.grade).nom).indexOf(q) >= 0)).sort((a, b) => (b.actif - a.actif) || grade(b.grade).rang - grade(a.grade).rang || a.nom.localeCompare(b.nom, 'fr'));
    $('page').innerHTML = entete('Comptes', 'Chaque membre de la Châtellerie a un compte. À sa première connexion, il choisit lui-même son mot de passe. Le grade décide des pages qu\'il voit et de ce qu\'il peut modifier.',
      '<input class="recherche" data-f="comptes" placeholder="Chercher…" value="' + esc(S.f.comptes || '') + '"><label class="case" style="margin:0"><input type="checkbox" data-act="inactifs" data-p="comptes"' + (inactifs ? ' checked' : '') + '> Désactivés</label>' + (ed ? '<button class="btn or" data-act="compte">+ Nouveau compte</button>' : '')) +
      tableau([['Nom'], ['Grade'], ['Statut'], ['Mot de passe'], ['Créé le'], ['', 'act']], cs.map(m => '<tr class="' + (m.actif ? '' : 'inactif') + '"><td>' + esc(m.nom) + (m.note ? '<br><small>' + esc(m.note) + '</small>' : '') + '</td><td>' + badgeGrade(m.grade) + '</td><td>' + badgeStatut(m.statut) + '</td><td>' + (m.aMdp ? '<span class="etat ok">choisi</span>' : '<span class="etat du">à choisir</span>') + '</td><td><small>' + esc(m.cree_le || '') + '</small></td><td class="act">' + (ed ? '<button class="btn petit" data-act="compte" data-id="' + esc(m.id) + '">Modifier</button>' : '') + '</td></tr>'));
  };
  function ouvrirCompte(id) {
    const m = id ? membre(id) : null;
    fenetre({ titre: m ? m.nom : 'Nouveau compte', html:
      '<div class="rang">' + entree('co-nom', 'Nom', m && m.nom, 'maxlength="40"') + choix('co-grade', 'Grade', S.d.grades.filter(g => g.id !== 'jarl' || S.d.moi.jarl || (m && m.grade === 'jarl')).map(g => [g.id, g.nom]), m ? m.grade : (S.d.grades.find(g => g.id === 'recrue') || S.d.grades[S.d.grades.length - 1]).id) + '</div>' +
      '<div class="rang">' + choix('co-statut', 'Statut', S.d.statuts.map(s => [s.id, s.nom]), m ? m.statut : S.d.statuts[0].id) + entree('co-prime', 'Prime hebdomadaire', m ? m.prime : 0, 'type="number" min="0" step="1"') + '</div>' +
      zone('co-note', 'Note', m && m.note, 'maxlength="500"') +
      (m && m.aMdp ? caseC('co-reinit', 'Réinitialiser le mot de passe (il en choisira un nouveau à sa prochaine connexion)', false) : '<p class="aide">' + (m ? 'Ce compte n\'a pas encore de mot de passe : il le choisira à sa première connexion.' : 'La personne choisira son mot de passe à sa première connexion.') + '</p>') +
      (m ? caseC('co-actif', 'Compte actif (décochez pour retirer l\'accès)', m.actif) : ''),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        maj(await api('enregistrerCompte', { id: m ? m.id : '', nom: val('co-nom'), grade: val('co-grade'), statut: val('co-statut'), prime: val('co-prime'), note: val('co-note'), reinitialiser: !!val('co-reinit'), actif: m ? val('co-actif') : true }));
        toast('Compte enregistré.'); } }] });
  }

  // ---------- Journal ----------
  RENDUS.journal = () => {
    const q = normal(S.f.journal || '');
    const l = (S.journal || []).filter(x => !q || normal(x.par + ' ' + x.action + ' ' + x.detail).indexOf(q) >= 0);
    $('page').innerHTML = entete('Journal', 'Qui a fait quoi, et quand.', '<input class="recherche" data-f="journal" placeholder="Filtrer…" value="' + esc(S.f.journal || '') + '"><button class="btn" data-act="journalMaj">Actualiser</button>') +
      (S.journal ? (l.length ? '<div class="carte">' + l.slice(0, 500).map(x => '<div class="ligne-j"><small>' + esc(x.date) + '</small><b>' + esc(x.par) + '</b><span>' + esc(x.action) + (x.detail ? ' — ' + esc(x.detail) : '') + '</span></div>').join('') + '</div>' : vide('Rien pour l\'instant.')) : '<div class="chargement">Chargement…</div>');
    if (!S.journal) api('journal').then(j => { S.journal = j; if (S.page === 'journal') RENDUS.journal(); }).catch(e => toast(msg(e), true));
  };

  // ---------- Grades et droits ----------
  RENDUS.admin = () => {
    const ed = niv('admin') >= 2, r = S.d.reglages;
    const nb = id => S.d.membres.filter(m => m.actif && m.grade === id).length;
    const resume = g => g.systeme ? 'Tous les droits' : PAGES.filter(p => p[3] && g.droits[p[3]]).map(p => p[1] + (g.droits[p[3]] === 1 ? '👁' : '✎')).join(' ') || 'Accueil seulement';
    $('page').innerHTML = entete('Grades et droits', 'Créez les grades et les statuts. Pour chaque grade, choisissez page par page : invisible, lecture seule (👁) ou modification (✎). Le Jarl a toujours tous les droits.', ed ? '<button class="btn" data-act="statut">+ Nouveau statut</button><button class="btn or" data-act="grade">+ Nouveau grade</button>' : '') +
      '<h3>Grades</h3>' + tableau([['Grade'], ['Rang', 'num'], ['Solde / sem.', 'num'], ['Garde'], ['Droits'], ['Membres', 'num'], ['', 'act']], S.d.grades.map(g => '<tr><td>' + badge(g.nom, g.couleur) + '</td><td class="num">' + g.rang + '</td><td class="num">' + (g.garde ? esc(fmtS(g.salaire)) : '<small>—</small>') + '</td><td>' + (g.garde ? '✓' : '') + '</td><td><small>' + esc(resume(g)) + '</small></td><td class="num">' + nb(g.id) + '</td><td class="act">' + (ed ? '<button class="btn petit" data-act="grade" data-id="' + esc(g.id) + '">Modifier</button>' : '') + '</td></tr>')) +
      '<h3 style="margin-top:20px">Statuts</h3>' + tableau([['Statut'], ['Solde versé ?'], ['Membres', 'num'], ['', 'act']], S.d.statuts.map(s => '<tr><td>' + badge(s.nom, s.couleur) + '</td><td>' + (s.paye ? '<span class="etat ok">oui</span>' : '<span class="etat neutre">non</span>') + '</td><td class="num">' + S.d.membres.filter(m => m.actif && m.statut === s.id).length + '</td><td class="act">' + (ed ? '<button class="btn petit" data-act="statut" data-id="' + esc(s.id) + '">Modifier</button>' : '') + '</td></tr>')) +
      '<h3 style="margin-top:20px">Réglages</h3><div class="carte"><div class="rang">' + entree('rg-taux', 'Taxe par défaut (% des recettes)', r.taux_defaut, 'type="number" min="0" max="100" step="0.5"' + (ed ? '' : ' disabled')) + entree('rg-cit', 'Citoyenneté par semaine', r.citoyennete, 'type="number" min="0" step="1"' + (ed ? '' : ' disabled')) +
        entree('rg-lanc', 'Début du registre (les retards comptent à partir de cette semaine)', r.lancement, 'type="date"' + (ed ? '' : ' disabled')) + '</div>' + (ed ? '<button class="btn or" data-act="reglages">Enregistrer les réglages</button>' : '') + '</div>';
  };
  function ouvrirGrade(id) {
    const g = id ? S.d.grades.find(x => x.id === id) : null, sys = g && g.systeme;
    fenetre({ titre: g ? 'Grade : ' + g.nom : 'Nouveau grade', large: true, html:
      '<div class="rang">' + entree('gr-nom', 'Nom', g && g.nom, 'maxlength="40"') + entree('gr-rang', 'Rang (plus haut = plus élevé)', g ? g.rang : 10, 'type="number" min="0" max="99"' + (sys ? ' disabled' : '')) + entree('gr-sal', 'Solde hebdomadaire', g ? g.salaire : 0, 'type="number" min="0" step="1"') + champ('', 'Couleur', '<input id="gr-coul" type="color" value="' + esc(g ? g.couleur : '#7f8c8d') + '" style="height:38px;padding:2px">') + '</div>' +
      caseC('gr-garde', 'Fait partie de la garde (apparaît dans le personnel et reçoit un solde)', g ? g.garde : true) +
      (sys ? '<p class="aide">Le Jarl a toujours tous les droits.</p>' : '<h3>Droits par page</h3><div class="tableau-b"><table class="t droits"><tbody>' + Object.keys(NOMS_DROITS).map(p => '<tr><td>' + esc(NOMS_DROITS[p]) + '</td><td><select data-droit="' + p + '"><option value="0">Invisible</option><option value="1"' + (g && g.droits[p] === 1 ? ' selected' : '') + '>👁 Lecture seule</option><option value="2"' + (g && g.droits[p] === 2 ? ' selected' : '') + '>✎ Modification</option></select></td></tr>').join('') + '</tbody></table></div>'),
      boutons: (g && !sys ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer le grade « ' + g.nom + ' » ?', f: async () => { maj(await api('supprimerGrade', { id: g.id })); toast('Grade supprimé.'); } }] : []).concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
        const droits = {}; $('mg-corps').querySelectorAll('[data-droit]').forEach(s => { droits[s.dataset.droit] = Number(s.value); });
        maj(await api('enregistrerGrade', { id: g ? g.id : '', nom: val('gr-nom'), rang: val('gr-rang'), salaire: val('gr-sal'), couleur: val('gr-coul'), garde: val('gr-garde'), droits }));
        toast('Grade enregistré.'); } }]) });
  }
  function ouvrirStatut(id) {
    const s = id ? S.d.statuts.find(x => x.id === id) : null;
    fenetre({ titre: s ? 'Statut : ' + s.nom : 'Nouveau statut', html:
      '<div class="rang">' + entree('st-nom', 'Nom', s && s.nom, 'maxlength="40" placeholder="Ex. : En mission longue"') + champ('', 'Couleur', '<input id="st-coul" type="color" value="' + esc(s ? s.couleur : '#7f8c8d') + '" style="height:38px;padding:2px">') + '</div>' +
      caseC('st-paye', 'Le solde est versé avec ce statut', s ? s.paye : true),
      boutons: (s ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer le statut « ' + s.nom + ' » ?', f: async () => { maj(await api('supprimerStatut', { id: s.id })); toast('Statut supprimé.'); } }] : []).concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('enregistrerStatut', { id: s ? s.id : '', nom: val('st-nom'), couleur: val('st-coul'), paye: val('st-paye') })); toast('Statut enregistré.'); } }]) });
  }

  // =====================================================================
  //  Justice : affaires, casier, amendes, barème
  // =====================================================================
  const STATUTS_AFFAIRE = { ouverte: ['Ouverte', '#d9822b'], jugee: ['Jugée', '#3f9b5a'], classee: ['Classée', '#7f8c8d'] };
  const resumeInf = a => a.infractions.map(x => x.nom + (x.n > 1 ? ' ×' + x.n : '')).join(', ');
  const etatAmende = a => !(a.amende > 0) ? '<small>—</small>' : amendePaiement(a.id) ? '<span class="tampon ok" title="' + esc(fmtS(amendePaiement(a.id).montant)) + '">Payée</span>' : a.statut === 'classee' ? '<span class="tampon neutre">Classée</span>' : '<span class="tampon mal">Impayée</span>';
  RENDUS.justice = () => {
    const ed = niv('justice') >= 2, tab = S.f.jtab || 'affaires', as = S.d.affaires || [], auj = S.d.aujourdhui;
    const imp = as.filter(impayee);
    const corps = { affaires: rendreAffaires, casier: rendreCasier, amendes: rendreAmendes, bareme: rendreBareme }[tab] || rendreAffaires;
    $('page').innerHTML = entete('Justice', 'Les affaires enregistrées par la garde, le casier de chaque personne, les amendes à encaisser et le barème des peines. Une amende payée part directement au Trésor.',
      ed ? '<button class="btn or" data-act="affaire">+ Nouvelle affaire</button>' : '') +
      '<div class="chiffres"><div class="chiffre"><b>' + as.filter(a => a.statut === 'ouverte').length + '</b><small>affaires ouvertes</small></div><div class="chiffre"><b>' + as.filter(a => ecart(a.date, auj) <= 6 && ecart(a.date, auj) >= 0).length + '</b><small>affaires ces 7 derniers jours</small></div>' +
      '<div class="chiffre' + (imp.length ? ' alerte' : '') + '"><b>' + esc(fmtS(imp.reduce((t, a) => t + a.amende, 0))) + '</b><small>' + imp.length + ' amende(s) impayée(s)</small></div>' +
      '<div class="chiffre"><b>' + esc(fmtS(as.reduce((t, a) => t + num((amendePaiement(a.id) || {}).montant), 0))) + '</b><small>amendes encaissées au total</small></div></div>' +
      onglets('jtab', [['affaires', 'Affaires', as.length], ['casier', 'Casier par personne'], ['amendes', 'Amendes impayées', imp.length || ''], ['bareme', 'Barème des peines', (S.d.bareme || []).length]], 'affaires') + corps(ed);
  };
  function rendreAffaires(ed) {
    const q = normal(S.f.aff || ''), fs = S.f.affst || '';
    const l = (S.d.affaires || []).filter(a => (!fs || a.statut === fs) && (!q || normal(a.personne + ' ' + resumeInf(a) + ' ' + a.lieu + ' ' + a.agent + ' ' + a.description).indexOf(q) >= 0))
      .sort((a, b) => b.date.localeCompare(a.date) || cleLe(b.modifie_le).localeCompare(cleLe(a.modifie_le)));
    return '<div class="filtres"><select class="mini" data-f="affst" aria-label="Statut"><option value="">Tous les statuts</option>' + Object.keys(STATUTS_AFFAIRE).map(k => '<option value="' + k + '"' + (fs === k ? ' selected' : '') + '>' + STATUTS_AFFAIRE[k][0] + 's</option>').join('') + '</select><input class="recherche" data-f="aff" placeholder="Chercher (nom, infraction, lieu…)" value="' + esc(S.f.aff || '') + '"></div>' +
      (l.length ? tableau([['Date'], ['Personne'], ['Infractions'], ['Amende', 'num'], ['Prison', 'num'], ['Agent'], ['Statut'], ['', 'act']], l.map(a =>
        '<tr><td>' + esc(fmtJ(a.date)) + '</td><td><button class="btn lien" data-act="casier" data-p="' + esc(a.personne) + '">' + esc(a.personne) + '</button></td><td>' + esc(resumeInf(a)) + (a.lieu ? '<br><small>' + esc(a.lieu) + '</small>' : '') + '</td>' +
        '<td class="num">' + (a.amende ? esc(fmtS(a.amende)) + '<br>' : '') + etatAmende(a) + '</td><td class="num">' + (a.prison ? a.prison + ' j' : '<small>—</small>') + '</td><td><small>' + esc(a.agent) + '</small></td><td>' + badge(STATUTS_AFFAIRE[a.statut][0], STATUTS_AFFAIRE[a.statut][1]) + '</td>' +
        '<td class="act">' + (ed && impayee(a) ? '<button class="btn petit or" data-act="encAmende" data-id="' + esc(a.id) + '">Encaisser</button>' : '') + (ed ? '<button class="btn petit" data-act="affaire" data-id="' + esc(a.id) + '" title="Modifier">✎</button>' : '') + '</td></tr>')) : vide('Aucune affaire.'));
  }
  function casiers() {
    const c = {};
    (S.d.affaires || []).forEach(a => { const k = normal(a.personne); (c[k] = c[k] || { nom: a.personne, affaires: [] }).affaires.push(a); });
    return Object.values(c).map(x => {
      x.affaires.sort((a, b) => b.date.localeCompare(a.date));
      x.total = x.affaires.reduce((t, a) => t + a.amende, 0); x.du = x.affaires.filter(impayee).reduce((t, a) => t + a.amende, 0);
      x.jours = x.affaires.reduce((t, a) => t + a.prison, 0); x.derniere = x.affaires[0].date;
      x.detenu = (S.d.detentions || []).some(d => d.statut === 'detenu' && normal(d.personne) === normal(x.nom));
      x.recherche = (S.d.avis || []).some(v => v.statut === 'recherche' && normal(v.personne) === normal(x.nom));
      return x;
    });
  }
  function rendreCasier() {
    const q = normal(S.f.cas || '');
    const l = casiers().filter(x => !q || normal(x.nom).indexOf(q) >= 0).sort((a, b) => b.affaires.length - a.affaires.length || b.derniere.localeCompare(a.derniere));
    return '<div class="filtres"><input class="recherche" data-f="cas" placeholder="Chercher une personne…" value="' + esc(S.f.cas || '') + '"></div>' +
      (l.length ? tableau([['Personne'], ['Affaires', 'num'], ['Dernière'], ['Amendes', 'num'], ['Reste dû', 'num'], ['Prison cumulée', 'num'], ['Situation']], l.map(x =>
        '<tr><td><button class="btn lien" data-act="casier" data-p="' + esc(x.nom) + '"><b>' + esc(x.nom) + '</b></button></td><td class="num">' + x.affaires.length + '</td><td>' + esc(fmtJ(x.derniere)) + '</td><td class="num">' + esc(fmtS(x.total)) + '</td>' +
        '<td class="num">' + (x.du ? '<span class="etat retard">' + esc(fmtS(x.du)) + '</span>' : '<span class="etat ok">rien</span>') + '</td><td class="num">' + (x.jours ? x.jours + ' j' : '—') + '</td>' +
        '<td>' + [x.detenu ? badge('En prison', '#c0392b') : '', x.recherche ? badge('Recherché', '#d9822b') : ''].join(' ') + '</td></tr>')) : vide('Aucun casier.'));
  }
  function ouvrirCasier(nom) {
    const x = casiers().find(c => normal(c.nom) === normal(nom)); if (!x) return;
    const ed = niv('justice') >= 2;
    const dets = (S.d.detentions || []).filter(d => normal(d.personne) === normal(nom));
    fenetre({ titre: 'Casier — ' + x.nom, large: true, html:
      '<div class="chiffres"><div class="chiffre"><b>' + x.affaires.length + '</b><small>affaire(s)</small></div><div class="chiffre"><b>' + esc(fmtS(x.total)) + '</b><small>d\'amendes</small></div><div class="chiffre' + (x.du ? ' alerte' : '') + '"><b>' + esc(fmtS(x.du)) + '</b><small>reste dû</small></div><div class="chiffre"><b>' + x.jours + ' j</b><small>de prison prononcés</small></div></div>' +
      tableau([['Date'], ['Infractions'], ['Amende', 'num'], ['Prison', 'num'], ['Statut'], ['', 'act']], x.affaires.map(a => '<tr><td>' + esc(fmtJ(a.date)) + '</td><td>' + esc(resumeInf(a)) + (a.description ? '<br><small>' + esc(a.description) + '</small>' : '') + '</td><td class="num">' + esc(fmtS(a.amende)) + '<br>' + etatAmende(a) + '</td><td class="num">' + (a.prison ? a.prison + ' j' : '—') + '</td><td>' + badge(STATUTS_AFFAIRE[a.statut][0], STATUTS_AFFAIRE[a.statut][1]) + '</td>' +
        '<td class="act">' + (ed && impayee(a) ? '<button class="btn petit or" data-act="encAmende" data-id="' + esc(a.id) + '">Encaisser</button>' : '') + (ed ? '<button class="btn petit" data-act="affaire" data-id="' + esc(a.id) + '">✎</button>' : '') + '</td></tr>')) +
      (dets.length ? '<h3 style="margin-top:14px">Séjours en prison</h3>' + dets.map(d => '<p>' + esc(fmtJ(d.entree)) + ' → ' + esc(fmtJ(d.sortie || d.sortie_prevue)) + ' · ' + esc(d.motif || '') + ' ' + badge(ETATS_DETENTION[d.statut][0], ETATS_DETENTION[d.statut][1]) + '</p>').join('') : ''),
      boutons: (ed ? [{ t: '+ Nouvelle affaire', cls: 'gauche', f: async () => { setTimeout(() => ouvrirAffaire(null, { personne: x.nom }), 0); } }] : []).concat([{ t: 'Fermer' }]) });
    $('mg-corps').onclick = ev => { const b = ev.target.closest('[data-act]'); if (b) { fermer(); actions(b); } };
  }
  function rendreAmendes(ed) {
    const auj = S.d.aujourdhui, l = (S.d.affaires || []).filter(impayee).sort((a, b) => a.date.localeCompare(b.date));
    return l.length ? tableau([['Personne'], ['Date'], ['Depuis', 'num'], ['Infractions'], ['Amende', 'num'], ['', 'act']], l.map(a => {
      const j = ecart(a.date, auj);
      return '<tr><td><button class="btn lien" data-act="casier" data-p="' + esc(a.personne) + '">' + esc(a.personne) + '</button></td><td>' + esc(fmtJ(a.date)) + '</td><td class="num"><span class="etat ' + (j > 7 ? 'retard' : 'du') + '">' + j + ' j</span></td><td>' + esc(resumeInf(a)) + '</td><td class="num">' + esc(fmtS(a.amende)) + '</td>' +
        '<td class="act">' + (ed ? '<button class="btn petit or" data-act="encAmende" data-id="' + esc(a.id) + '">Encaisser</button>' : '') + '</td></tr>';
    }), '<tr><td colspan="4">' + l.length + ' amende(s) impayée(s)</td><td class="num">' + esc(fmtS(l.reduce((t, a) => t + a.amende, 0))) + '</td><td></td></tr>') : vide('Aucune amende impayée. 👍');
  }
  function rendreBareme(ed) {
    const b = (S.d.bareme || []).slice(), cats = [...new Set(b.map(x => x.categorie))];
    const ordre = ['Délit mineur', 'Délit', 'Crime']; cats.sort((a, c) => (ordre.indexOf(a) + 1 || 99) - (ordre.indexOf(c) + 1 || 99) || a.localeCompare(c, 'fr'));
    return '<div class="filtres"><p class="aide" style="margin:0">Le barème sert de base : en enregistrant une affaire, l\'amende et la prison se remplissent toutes seules, et on peut les ajuster au cas par cas.</p>' + (ed ? '<button class="btn" data-act="bareme" style="margin-left:auto">+ Ajouter une infraction</button>' : '') + '</div>' +
      (b.length ? cats.map(c => '<h3 style="margin-top:14px">' + esc(c) + '</h3>' + tableau([['Infraction'], ['Amende', 'num'], ['Prison', 'num'], ['', 'act']],
        b.filter(x => x.categorie === c).sort((x, y) => x.amende - y.amende || x.nom.localeCompare(y.nom, 'fr')).map(x => '<tr class="' + (x.actif ? '' : 'inactif') + '"><td><b>' + esc(x.nom) + '</b>' + (x.description ? '<br><small>' + esc(x.description) + '</small>' : '') + (x.actif ? '' : ' <small>(retirée)</small>') + (S.d.lois || []).filter(l => l.statut !== 'abrogee' && l.infractions.indexOf(x.id) >= 0).map(l => '<br><button class="btn lien" data-act="loiVoir" data-id="' + esc(l.id) + '">📖 ' + esc((l.numero ? l.numero + ' — ' : '') + l.titre) + '</button>').join('') + '</td><td class="num">' + esc(fmtS(x.amende)) + '</td><td class="num">' + (x.prison ? x.prison + ' jour' + (x.prison > 1 ? 's' : '') : '—') + '</td>' +
          '<td class="act">' + (ed ? '<button class="btn petit" data-act="bareme" data-id="' + esc(x.id) + '">Modifier</button>' : '') + '</td></tr>'))).join('') : vide('Le barème est vide.'));
  }
  function ouvrirBareme(id) {
    const b = id ? (S.d.bareme || []).find(x => x.id === id) : null;
    const cats = [...new Set(['Délit mineur', 'Délit', 'Crime'].concat((S.d.bareme || []).map(x => x.categorie)))];
    fenetre({ titre: b ? 'Infraction : ' + b.nom : 'Nouvelle infraction', html:
      entree('ba-nom', 'Infraction', b && b.nom, 'maxlength="80" placeholder="Ex. : Braconnage"') +
      '<div class="rang">' + champ('', 'Catégorie', '<input id="ba-cat" list="ba-cats" maxlength="40" value="' + esc(b ? b.categorie : 'Délit') + '"><datalist id="ba-cats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>') +
        entree('ba-amende', 'Amende (septimes)', b ? b.amende : 0, 'type="number" min="0" step="1"') + entree('ba-prison', 'Prison (jours)', b ? b.prison : 0, 'type="number" min="0" step="1"') + '</div>' +
      zone('ba-desc', 'Précisions (facultatif)', b && b.description, 'maxlength="500" placeholder="Ex. : plus la restitution du gibier"') +
      (b ? caseC('ba-actif', 'Utilisable pour les nouvelles affaires (décochez pour la retirer sans la supprimer)', b.actif) : ''),
      boutons: (b ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer « ' + b.nom + ' » du barème ? Les affaires déjà enregistrées ne changent pas.', f: async () => { maj(await api('supprimerBareme', { id: b.id })); toast('Infraction supprimée du barème.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('enregistrerBareme', { id: b ? b.id : '', nom: val('ba-nom'), categorie: val('ba-cat'), amende: val('ba-amende'), prison: val('ba-prison'), description: val('ba-desc'), actif: b ? val('ba-actif') : true })); toast('Barème enregistré.'); } }]) });
  }
  /** Nouvelle affaire (ou modification) : les infractions viennent du barème, amende et prison se calculent. */
  function ouvrirAffaire(id, pre) {
    const a = id ? (S.d.affaires || []).find(x => x.id === id) : null; pre = pre || {};
    let inf = a ? a.infractions.map(x => Object.assign({}, x)) : [];
    const bar = (S.d.bareme || []).filter(b => b.actif), cats = [...new Set(bar.map(b => b.categorie))];
    const peutPrison = niv('prison') >= 2, paye = a && amendePaiement(a.id);
    const listeInf = () => {
      $('af-inf').innerHTML = inf.length ? inf.map((x, i) => '<div class="inf"><b>' + esc(x.nom) + '</b><label>× <input type="number" min="1" max="99" value="' + x.n + '" data-i="' + i + '" data-k="n" aria-label="Nombre"></label><label><input type="number" min="0" step="1" value="' + x.amende + '" data-i="' + i + '" data-k="amende" aria-label="Amende"> sept.</label><label><input type="number" min="0" step="1" value="' + x.prison + '" data-i="' + i + '" data-k="prison" aria-label="Prison"> j</label><button type="button" class="btn petit danger" data-ret="' + i + '" aria-label="Retirer">✕</button></div>').join('') : '<p class="aide">Ajoutez au moins une infraction.</p>';
      const am = inf.reduce((t, x) => t + num(x.amende) * num(x.n), 0), pr = inf.reduce((t, x) => t + num(x.prison) * num(x.n), 0);
      $('af-amende').placeholder = am; $('af-prison').placeholder = pr;
      $('af-calc').textContent = 'Selon le barème : ' + fmtS(am) + ' et ' + pr + ' jour(s) de prison. Laissez les deux cases vides pour garder ce calcul.';
      if ($('af-inc-l')) $('af-inc-l').textContent = 'Incarcérer maintenant (' + (val('af-prison') !== '' ? num(val('af-prison')) : pr) + ' jour(s))';
    };
    fenetre({ titre: a ? 'Affaire : ' + a.personne : 'Nouvelle affaire', large: true, html:
      '<div class="rang">' + champ('', 'Personne mise en cause', '<input id="af-pers" list="af-pers-l" maxlength="60" value="' + esc(a ? a.personne : pre.personne || '') + '">' + listePersonnes('af-pers-l')) + entree('af-date', 'Date des faits', a ? a.date : S.d.aujourdhui, 'type="date"') +
        champ('', 'Agent', '<input id="af-agent" list="af-agents" maxlength="60" value="' + esc(a ? a.agent : S.d.moi.nom) + '"><datalist id="af-agents">' + S.d.membres.filter(m => m.actif).map(m => '<option value="' + esc(m.nom) + '">').join('') + '</datalist>') + '</div>' +
      '<div class="rang">' + entree('af-lieu', 'Lieu', a ? a.lieu : pre.lieu || '', 'maxlength="80"') + choix('af-statut', 'Statut', Object.keys(STATUTS_AFFAIRE).map(k => [k, STATUTS_AFFAIRE[k][0]]), a ? a.statut : 'ouverte') + '</div>' +
      champ('', 'Infractions', '<div class="rang"><select id="af-choix"><option value="">— Choisir dans le barème —</option>' + cats.map(c => '<optgroup label="' + esc(c) + '">' + bar.filter(b => b.categorie === c).map(b => '<option value="' + esc(b.id) + '">' + esc(b.nom) + ' — ' + esc(fmtS(b.amende)) + (b.prison ? ', ' + b.prison + ' j' : '') + '</option>').join('') + '</optgroup>').join('') + '</select><button type="button" class="btn" id="af-autre">+ Hors barème</button></div><div id="af-inf"></div>') +
      '<p class="aide" id="af-calc"></p>' +
      '<div class="rang">' + entree('af-amende', 'Amende totale (septimes)', a ? a.amende : '', 'type="number" min="0" step="1"' + (paye ? ' disabled' : '')) + entree('af-prison', 'Prison totale (jours)', a ? a.prison : '', 'type="number" min="0" step="1"') + '</div>' +
      (paye ? '<p class="aide">L\'amende est déjà payée (' + esc(fmtS(paye.montant)) + ') : son montant ne peut plus changer.</p>' : '') +
      zone('af-desc', 'Faits / déroulement', a && a.description, 'maxlength="3000"') +
      (!a ? '<div class="rang">' + (peutPrison ? '<label class="case"><input type="checkbox" id="af-inc"> <span id="af-inc-l">Incarcérer maintenant</span></label>' + entree('af-cell', 'Cellule', '', 'maxlength="40" placeholder="Ex. : Cellule 2"') : '') + caseC('af-payee', 'L\'amende est payée sur-le-champ', false) + '</div>' : ''),
      ouvert: () => {
        listeInf();
        $('af-choix').addEventListener('change', () => { const b = bar.find(x => x.id === $('af-choix').value); if (b) { const ex = inf.find(x => x.id === b.id); if (ex) ex.n++; else inf.push({ id: b.id, nom: b.nom, n: 1, amende: b.amende, prison: b.prison }); } $('af-choix').value = ''; listeInf(); });
        $('af-autre').addEventListener('click', () => { const n = prompt('Nom de l\'infraction (hors barème) :'); if (n && n.trim()) { inf.push({ id: '', nom: n.trim().slice(0, 80), n: 1, amende: 0, prison: 0 }); listeInf(); } });
        $('af-inf').addEventListener('input', ev => { const t = ev.target; if (t.dataset.i !== undefined) { inf[Number(t.dataset.i)][t.dataset.k] = Math.max(t.dataset.k === 'n' ? 1 : 0, num(t.value)); const am = inf.reduce((s2, x) => s2 + num(x.amende) * num(x.n), 0), pr = inf.reduce((s2, x) => s2 + num(x.prison) * num(x.n), 0); $('af-amende').placeholder = am; $('af-prison').placeholder = pr; $('af-calc').textContent = 'Selon le barème : ' + fmtS(am) + ' et ' + pr + ' jour(s) de prison. Laissez les deux cases vides pour garder ce calcul.'; } });
        $('af-inf').addEventListener('click', ev => { const b = ev.target.closest('[data-ret]'); if (b) { inf.splice(Number(b.dataset.ret), 1); listeInf(); } });
        $('af-prison').addEventListener('input', listeInf);
        // en modification, les totaux enregistrés restent tant qu'on ne les vide pas
      },
      boutons: (a ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer cette affaire du casier de ' + a.personne + ' ?', f: async () => { maj(await api('supprimerAffaire', { id: a.id })); toast('Affaire supprimée.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
          if (!inf.length) throw new Error('Ajoutez au moins une infraction.');
          maj(await api('enregistrerAffaire', { id: a ? a.id : '', personne: val('af-pers'), date: val('af-date'), agent: val('af-agent'), lieu: val('af-lieu'), statut: val('af-statut'), infractions: inf,
            amende: paye ? a.amende : val('af-amende'), prison: val('af-prison'), description: val('af-desc'), incarcerer: !a && !!val('af-inc'), cellule: val('af-cell'), payee: !a && !!val('af-payee') }));
          toast(a ? 'Affaire modifiée.' : 'Affaire enregistrée au casier de ' + val('af-pers') + '.'); } }]) });
  }
  function encaisserAmende(id) {
    const a = (S.d.affaires || []).find(x => x.id === id); if (!a) return;
    fenetre({ titre: 'Amende — ' + a.personne, html: '<p>' + esc(resumeInf(a)) + ' · ' + esc(fmtJ(a.date)) + '</p>' + entree('ea-m', 'Montant encaissé (septimes)', a.amende, 'type="number" min="0" step="1"') + entree('ea-note', 'Note (facultatif)', '', 'maxlength="200"') + '<p class="aide">Le montant part au Trésor (catégorie « Amendes »).</p>',
      boutons: [{ t: 'Annuler' }, { t: 'Encaisser', cls: 'or', f: async () => { maj(await api('encaisserAmende', { id, montant: val('ea-m'), note: val('ea-note') })); toast('Amende encaissée : ' + fmtS(val('ea-m')) + '.'); } }] });
  }

  // =====================================================================
  //  Lois : textes, catégories, recherche par mots-clés
  // =====================================================================
  /** Découpe la recherche en termes ; "entre guillemets" = expression exacte. */
  // les mots au pluriel trouvent aussi le singulier (« armes » trouve « arme »)
  const termes = q => (String(q || '').match(/"[^"]+"|\S+/g) || []).map(t => { const ex = /^".*"$/.test(t), n = normal(t.replace(/"/g, '')).trim(); return !ex && n.length > 3 && /[sx]$/.test(n) ? n.slice(0, -1) : n; }).filter(t => t.length > 1);
  const SANS_ACCENT = { a: '[aàâäá]', e: '[eéèêë]', i: '[iîïí]', o: '[oôöó]', u: '[uùûüú]', c: '[cç]', y: '[yÿ]', n: '[nñ]' };
  const motifTerme = t => t.split('').map(ch => SANS_ACCENT[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  /** Texte échappé, avec les termes recherchés surlignés (sans tenir compte des accents ni des majuscules). */
  function surligner(txt, ts) {
    let h = esc(txt);
    if (!ts.length) return h;
    const re = new RegExp('(' + ts.map(motifTerme).sort((a, b) => b.length - a.length).join('|') + ')', 'gi');
    return h.split(/(<[^>]+>|&[a-z#0-9]+;)/i).map(p => /^(<|&)/.test(p) ? p : p.replace(re, '<mark>$1</mark>')).join('');
  }
  /** Extrait du texte autour du premier terme trouvé. */
  function extrait(txt, ts, n) {
    n = n || 320;
    if (txt.length <= n) return txt;
    const nt = normal(txt); let i = -1;
    ts.forEach(t => { const j = nt.indexOf(t); if (j >= 0 && (i < 0 || j < i)) i = j; });
    if (i < 0) return txt.slice(0, n).replace(/\s+\S*$/, '') + '…';
    const d = Math.max(0, i - 100);
    return (d ? '…' : '') + txt.slice(d, d + n).replace(/^\S*\s/, d ? '' : '$&').replace(/\s+\S*$/, '') + '…';
  }
  const TYPES_LOI = { loi: 'Loi', decret: 'Décret', edit: 'Édit', ordonnance: 'Ordonnance' };
  /** « Décret · n° 2 », sans répéter le type si le numéro le contient déjà (« Décret 2 »). */
  const intitule = x => { const t = TYPES_LOI[x.type] || 'Loi'; return !x.numero ? t : normal(x.numero).indexOf(normal(t)) === 0 ? x.numero : t + ' · ' + x.numero; };
  /** Un texte de loi présenté comme un parchemin ; les décrets portent en plus le sceau du Jarl. */
  function feuilleLoi(x, ts, complet) {
    const cats = S.f.loiCats || [], bar = id => (S.d.bareme || []).find(b => b.id === id), ed = niv('lois') >= 2;
    const texte = complet ? x.texte : extrait(x.texte, ts);
    return '<article class="parchemin type-' + esc(x.type) + (x.statut === 'abrogee' ? ' abrogee' : '') + '">' +
      '<div class="en-tete-p"><span class="type-p">' + surligner(intitule(x), ts) + '</span>' + (x.statut === 'abrogee' ? '<span class="abroge-p">Abrogé</span>' : '') + '</div>' +
      '<h3>' + (complet ? surligner(x.titre, ts) : '<button class="btn lien" data-act="loiVoir" data-id="' + esc(x.id) + '">' + surligner(x.titre, ts) + '</button>') + '</h3>' +
      '<div class="orne" aria-hidden="true">❦</div>' +
      '<div class="texte-p">' + surligner(texte, ts).replace(/\n/g, '<br>') + '</div>' +
      (x.infractions.length ? '<div class="peines-p"><b>Peines encourues :</b> ' + x.infractions.map(bar).filter(Boolean).map(b => esc(b.nom) + ' — ' + esc(fmtS(b.amende)) + (b.prison ? ', ' + b.prison + ' jour' + (b.prison > 1 ? 's' : '') + ' de geôle' : '')).join(' ; ') + '</div>' : '') +
      (x.type === 'decret' ? '<div class="signature-p">Par ordre du Jarl de Faillaise' + (x.date ? ',<br>le ' + esc(fmtJ(x.date)) : '') + '</div><div class="sceau" aria-hidden="true"><span>⚜</span></div>' : x.date && complet ? '<div class="signature-p">En vigueur depuis le ' + esc(fmtJ(x.date)) + '</div>' : '') +
      '<div class="pied-p">' + x.categories.map(c => '<span class="puce' + (cats.indexOf(c) >= 0 ? ' on' : '') + '">' + surligner(c, ts) + '</span>').join('') +
        (x.mots_cles.length ? '<span class="mots-p">🏷 ' + x.mots_cles.map(m => surligner(m, ts)).join(', ') + '</span>' : '') +
        (ed && !complet ? '<button class="btn petit" data-act="loi" data-id="' + esc(x.id) + '">Modifier</button>' : '') + '</div>' +
      '</article>';
  }
  const loiCle = l => normal([l.numero, l.titre, l.texte, l.mots_cles.join(' '), l.categories.join(' ')].join(' '));
  const numeroTri = l => { const m = /(\d+)/.exec(l.numero || ''); return m ? Number(m[1]) : 1e9; };
  RENDUS.lois = () => {
    const ed = niv('lois') >= 2, q = S.f.loiq || '', ts = termes(q), abr = !!S.f.loiAbr, cats = S.f.loiCats || [];
    const toutes = S.d.lois || [];
    const compte = {}; toutes.filter(l => abr || l.statut !== 'abrogee').forEach(l => l.categories.forEach(c => { compte[c] = (compte[c] || 0) + 1; }));
    const ty = S.f.loitype || '';
    const l = toutes.filter(x => (abr || x.statut !== 'abrogee') && (!ty || x.type === ty) && (!cats.length || cats.some(c => x.categories.indexOf(c) >= 0)) && ts.every(t => loiCle(x).indexOf(t) >= 0))
      .sort((a, b) => (a.statut === 'abrogee') - (b.statut === 'abrogee') || numeroTri(a) - numeroTri(b) || a.titre.localeCompare(b.titre, 'fr'));
    const bar = id => (S.d.bareme || []).find(b => b.id === id);
    $('page').innerHTML = entete('Lois de Faillaise', 'Tous les textes de loi, rangés par catégories. Cherchez par mots-clés (les accents ne comptent pas, tous les mots doivent être présents, "entre guillemets" pour une expression exacte) ou cliquez sur une catégorie.',
      '<select class="mini" data-f="loitype" aria-label="Type de texte"><option value="">Tous les textes</option>' + Object.keys(TYPES_LOI).map(k => '<option value="' + k + '"' + (ty === k ? ' selected' : '') + '>' + TYPES_LOI[k] + 's</option>').join('') + '</select>' +
      '<label class="case" style="margin:0"><input type="checkbox" data-act="tog" data-k="loiAbr"' + (abr ? ' checked' : '') + '> Textes abrogés</label>' + (ed ? '<button class="btn or" data-act="loi">+ Nouveau texte</button>' : '')) +
      '<div class="recherche-loi"><input class="recherche" data-f="loiq" placeholder="🔎 Chercher dans les lois : arme, taverne, &quot;tombée de la nuit&quot;…" value="' + esc(q) + '" aria-label="Chercher dans les lois"></div>' +
      (Object.keys(compte).length ? '<div class="puces">' + Object.keys(compte).sort((a, b) => a.localeCompare(b, 'fr')).map(c => '<button class="puce' + (cats.indexOf(c) >= 0 ? ' on' : '') + '" data-act="loicat" data-c="' + esc(c) + '" aria-pressed="' + (cats.indexOf(c) >= 0) + '">' + esc(c) + ' <span>' + compte[c] + '</span></button>').join('') + (cats.length ? '<button class="btn lien" data-act="loicat" data-c="">Toutes les catégories</button>' : '') + '</div>' : '') +
      '<p class="aide">' + l.length + ' loi(s)' + (ts.length || cats.length ? ' trouvée(s)' : '') + (cats.length ? ' dans : ' + cats.map(esc).join(' ou ') : '') + '</p>' +
      (l.length ? '<div class="liasse">' + l.map(x => feuilleLoi(x, ts, false)).join('') + '</div>' : vide(ts.length || cats.length ? 'Aucune loi ne correspond.' : 'Aucune loi enregistrée.'));
  };
  function voirLoi(id) {
    const x = (S.d.lois || []).find(l => l.id === id); if (!x) return;
    fenetre({ titre: intitule(x).replace(' · ', ' — '), large: true, html: feuilleLoi(x, termes(S.f.loiq), true) +
      '<p class="aide" style="margin-top:12px">Modifié par ' + esc(x.modifie_par) + ', le ' + esc(x.modifie_le) + '</p>',
      boutons: (niv('lois') >= 2 ? [{ t: 'Modifier', cls: 'gauche', f: async () => { setTimeout(() => ouvrirLoi(id), 0); } }] : []).concat([{ t: 'Fermer', cls: 'or' }]) });
  }
  function ouvrirLoi(id) {
    const x = id ? (S.d.lois || []).find(l => l.id === id) : null;
    const toutesCats = [...new Set(['Ordre public', 'Biens', 'Personnes', 'Commerce', 'Fiscalité', 'Armes', 'Gouvernement'].concat(...(S.d.lois || []).map(l => l.categories)))].sort((a, b) => a.localeCompare(b, 'fr'));
    const sel = x ? x.categories : [], bar = (S.d.bareme || []).filter(b => b.actif || (x && x.infractions.indexOf(b.id) >= 0));
    fenetre({ titre: x ? 'Modifier le texte' : 'Nouveau texte de loi', large: true, html:
      '<div class="rang">' + choix('lo-type', 'Type de texte', Object.keys(TYPES_LOI).map(k => [k, TYPES_LOI[k]]), x ? x.type : 'loi') + entree('lo-num', 'Numéro (facultatif)', x && x.numero, 'maxlength="30" placeholder="Ex. : Art. 14"') + entree('lo-titre', 'Titre', x && x.titre, 'maxlength="150" placeholder="Ex. : Du port des armes en ville"') + '</div>' +
      zone('lo-texte', 'Texte de la loi', x && x.texte, 'maxlength="20000" rows="9"') +
      champ('', 'Catégories (une loi peut en avoir plusieurs)', '<div class="coches" id="lo-cats">' + toutesCats.map(c => '<label class="' + (sel.indexOf(c) >= 0 ? 'on' : '') + '"><input type="checkbox" value="' + esc(c) + '"' + (sel.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(c) + '</label>').join('') + '</div>') +
      entree('lo-ncat', 'Nouvelles catégories (séparées par des virgules)', '', 'maxlength="200" placeholder="Ex. : Chasse, Forêts"') +
      entree('lo-mots', 'Mots-clés pour la recherche (séparés par des virgules)', x ? x.mots_cles.join(', ') : '', 'maxlength="600" placeholder="Ex. : épée, taverne, dégainer"') +
      '<div class="rang">' + entree('lo-date', 'En vigueur depuis', x ? x.date : S.d.aujourdhui, 'type="date"') + choix('lo-statut', 'Statut', [['en_vigueur', 'En vigueur'], ['abrogee', 'Abrogée']], x ? x.statut : 'en_vigueur') + '</div>' +
      (bar.length ? champ('', 'Infractions du barème punies par cette loi (facultatif)', '<div class="coches" id="lo-inf">' + bar.map(b => '<label class="' + (x && x.infractions.indexOf(b.id) >= 0 ? 'on' : '') + '"><input type="checkbox" value="' + esc(b.id) + '"' + (x && x.infractions.indexOf(b.id) >= 0 ? ' checked' : '') + '> ' + esc(b.nom) + '</label>').join('') + '</div>') : ''),
      ouvert: () => $('mg-corps').querySelectorAll('.coches').forEach(c => c.addEventListener('change', ev => { ev.target.closest('label').classList.toggle('on', ev.target.checked); })),
      boutons: (x ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer définitivement cette loi ? (Pour la garder dans l\'historique, passez-la plutôt en « Abrogée ».)', f: async () => { maj(await api('supprimerLoi', { id: x.id })); toast('Loi supprimée.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
          const categories = [...$('lo-cats').querySelectorAll('input:checked')].map(i => i.value).concat(val('lo-ncat').split(',').map(c => c.trim()).filter(Boolean));
          const infractions = $('lo-inf') ? [...$('lo-inf').querySelectorAll('input:checked')].map(i => i.value) : [];
          maj(await api('enregistrerLoi', { id: x ? x.id : '', type: val('lo-type'), numero: val('lo-num'), titre: val('lo-titre'), texte: val('lo-texte'), categories, mots_cles: val('lo-mots').split(','), date: val('lo-date'), statut: val('lo-statut'), infractions }));
          toast(x ? 'Loi modifiée.' : 'Loi ajoutée.'); } }]) });
  }

  // ---------- Prison ----------
  const ETATS_DETENTION = { detenu: ['Détenu', '#c0392b'], libere: ['Libéré', '#3f9b5a'], evade: ['Évadé', '#d9822b'] };
  function reste(d) {
    const j = ecart(S.d.aujourdhui, d.sortie_prevue);
    return j > 1 ? '<span class="etat neutre">dans ' + j + ' jours</span>' : j === 1 ? '<span class="etat du">demain</span>' : j === 0 ? '<span class="etat du">aujourd\'hui</span>' : '<span class="etat retard">dépassée de ' + (-j) + ' j</span>';
  }
  /** Jours restants gravés en bâtonnets (groupes de cinq), comme sur un mur de cellule. */
  function batonnets(n) {
    if (!(n > 0)) return '';
    const g = [], max = Math.min(n, 40);
    for (let i = 0; i < max; i += 5) {
      const k = Math.min(5, max - i);
      g.push('<svg viewBox="0 0 30 22" class="groupe-b" aria-hidden="true">' + [0, 1, 2, 3].filter(x => x < Math.min(k, 4)).map(x => '<path d="M' + (4 + x * 6) + ' 3 L' + (3 + x * 6) + ' 19"/>').join('') + (k === 5 ? '<path d="M1 16 L27 5"/>' : '') + '</svg>');
    }
    return '<span class="batons" title="' + n + ' jour(s) restant(s)">' + g.join('') + (n > 40 ? '<b>+' + (n - 40) + '</b>' : '') + '</span>';
  }
  RENDUS.prison = () => {
    const ed = niv('prison') >= 2, histo = !!S.f.prHisto, auj = S.d.aujourdhui, ds = S.d.detentions || [];
    const det = ds.filter(d => d.statut === 'detenu').sort((a, b) => a.sortie_prevue.localeCompare(b.sortie_prevue));
    const anciens = ds.filter(d => d.statut !== 'detenu').sort((a, b) => (b.sortie || '').localeCompare(a.sortie || ''));
    $('page').innerHTML = entete('Prison', 'Les détenus, leur cellule et leur date de sortie. Une incarcération peut être faite depuis une affaire (page Justice) ou directement ici.',
      '<label class="case" style="margin:0"><input type="checkbox" data-act="tog" data-k="prHisto"' + (histo ? ' checked' : '') + '> Historique</label>' + (ed ? '<button class="btn or" data-act="detention">+ Incarcérer</button>' : '')) +
      '<div class="chiffres"><div class="chiffre"><b>' + det.length + '</b><small>détenu(s)</small></div><div class="chiffre"><b>' + new Set(det.map(d => d.cellule).filter(Boolean)).size + '</b><small>cellule(s) occupée(s)</small></div>' +
      '<div class="chiffre' + (det.some(d => d.sortie_prevue <= auj) ? ' alerte' : '') + '"><b>' + det.filter(d => d.sortie_prevue <= auj).length + '</b><small>à libérer aujourd\'hui ou en retard</small></div><div class="chiffre"><b>' + anciens.filter(d => d.statut === 'evade').length + '</b><small>évasion(s) au total</small></div></div>' +
      (det.length ? '<div class="cellules">' + det.map(d => '<article class="cellule' + (d.sortie_prevue <= auj ? ' a-liberer' : '') + '"><div class="porte" aria-hidden="true"><span class="plaque">' + esc(d.cellule || 'Cellule') + '</span></div>' +
        '<div class="ecrou"><h3 class="craie">' + esc(d.personne) + '</h3><p>' + esc(d.motif || '—') + '</p>' + (d.note ? '<p class="meta">' + esc(d.note) + '</p>' : '') +
        '<p class="meta">Entré le ' + esc(fmtJ(d.entree)) + ' · sortie prévue le ' + esc(fmtJ(d.sortie_prevue)) + '</p>' + batonnets(ecart(auj, d.sortie_prevue)) + '<div>' + reste(d) + '</div>' +
        (ed ? '<div class="boutons-c"><button class="btn petit or" data-act="liberer" data-id="' + esc(d.id) + '">Libérer</button><button class="btn petit danger" data-act="evasion" data-id="' + esc(d.id) + '">Évadé</button><button class="btn petit" data-act="detention" data-id="' + esc(d.id) + '" title="Modifier">✎</button></div>' : '') + '</div></article>').join('') + '</div>' : vide('Personne en prison.')) +
      (histo ? '<h3 style="margin-top:20px">Historique</h3>' + (anciens.length ? tableau([['Personne'], ['Motif'], ['Entrée'], ['Sortie'], ['État'], ['', 'act']], anciens.map(d => '<tr class="inactif"><td>' + esc(d.personne) + '</td><td>' + esc(d.motif || '—') + '</td><td>' + esc(fmtJ(d.entree)) + '</td><td>' + esc(fmtJ(d.sortie)) + '</td><td>' + badge(ETATS_DETENTION[d.statut][0], ETATS_DETENTION[d.statut][1]) + '</td><td class="act">' + (ed ? '<button class="btn petit" data-act="detention" data-id="' + esc(d.id) + '">✎</button>' : '') + '</td></tr>')) : vide('Aucun ancien détenu.')) : '');
  };
  function ouvrirDetention(id) {
    const d = id ? (S.d.detentions || []).find(x => x.id === id) : null;
    const affs = (S.d.affaires || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    fenetre({ titre: d ? 'Détention : ' + d.personne : 'Incarcérer', html:
      '<div class="rang">' + champ('', 'Détenu', '<input id="de-pers" list="de-pers-l" maxlength="60" value="' + esc(d ? d.personne : '') + '">' + listePersonnes('de-pers-l')) + entree('de-cell', 'Cellule', d && d.cellule, 'maxlength="40" placeholder="Ex. : Cellule 1"') + '</div>' +
      '<div class="rang">' + entree('de-entree', 'Entrée', d ? d.entree : S.d.aujourdhui, 'type="date"') + entree('de-jours', 'Durée (jours)', d ? ecart(d.entree, d.sortie_prevue) : 1, 'type="number" min="0" step="1"') + entree('de-sortie', 'Sortie prévue', d ? d.sortie_prevue : ajout(S.d.aujourdhui, 1), 'type="date"') + '</div>' +
      entree('de-motif', 'Motif', d && d.motif, 'maxlength="200"') +
      (affs.length ? choix('de-aff', 'Affaire liée (facultatif)', [['', '— Aucune —']].concat(affs.map(a => [a.id, fmtJ(a.date) + ' · ' + a.personne + ' · ' + resumeInf(a).slice(0, 50)])), d ? d.affaire : '') : '') +
      zone('de-note', 'Note', d && d.note, 'maxlength="1000"'),
      ouvert: () => {
        const parJours = () => { $('de-sortie').value = ajout($('de-entree').value || S.d.aujourdhui, num($('de-jours').value)); };
        $('de-jours').addEventListener('input', parJours); $('de-entree').addEventListener('change', parJours);
        $('de-sortie').addEventListener('change', () => { if ($('de-sortie').value) $('de-jours').value = ecart($('de-entree').value || S.d.aujourdhui, $('de-sortie').value); });
        if ($('de-aff')) $('de-aff').addEventListener('change', () => { const a = (S.d.affaires || []).find(x => x.id === $('de-aff').value); if (a) { if (!$('de-pers').value) $('de-pers').value = a.personne; if (!$('de-motif').value) $('de-motif').value = resumeInf(a).slice(0, 200); if (a.prison) { $('de-jours').value = a.prison; $('de-jours').dispatchEvent(new Event('input')); } } });
      },
      boutons: (d ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer cette détention (erreur de saisie) ?', f: async () => { maj(await api('supprimerDetention', { id: d.id })); toast('Détention supprimée.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: d ? 'Enregistrer' : 'Incarcérer', cls: 'or', f: async () => { maj(await api('enregistrerDetention', { id: d ? d.id : '', personne: val('de-pers'), cellule: val('de-cell'), entree: val('de-entree'), sortie_prevue: val('de-sortie'), motif: val('de-motif'), affaire: val('de-aff'), note: val('de-note') })); toast(d ? 'Détention modifiée.' : val('de-pers') + ' est incarcéré.'); } }]) });
  }
  function evasion(id) {
    const d = (S.d.detentions || []).find(x => x.id === id);
    fenetre({ titre: 'Évasion — ' + d.personne, html: '<p>' + esc(d.personne) + ' s\'est évadé ?</p>' + (niv('recherches') >= 2 ? caseC('ev-avis', 'Lancer un avis de recherche', true) : ''),
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer l\'évasion', cls: 'danger', f: async () => { maj(await api('libererDetenu', { id, evade: true, avis: !!val('ev-avis') })); toast('Évasion enregistrée' + (val('ev-avis') ? ', avis de recherche lancé.' : '.')); } }] });
  }

  // ---------- Avis de recherche ----------
  const STATUTS_AVIS = { recherche: ['Recherché', '#c0392b'], arrete: ['Arrêté', '#3f9b5a'], abandonne: ['Abandonné', '#7f8c8d'] };
  const DANGERS = { faible: ['Peu dangereux', '#3f9b5a'], moyen: ['Dangereux', '#d9822b'], eleve: ['Très dangereux', '#c0392b'] };
  RENDUS.recherches = () => {
    const ed = niv('recherches') >= 2, fs = S.f.avst || 'recherche', q = normal(S.f.avq || '');
    const l = (S.d.avis || []).filter(a => (fs === 'tous' || a.statut === fs) && (!q || normal(a.personne + ' ' + a.motif + ' ' + a.signalement).indexOf(q) >= 0))
      .sort((a, b) => (b.danger === 'eleve') - (a.danger === 'eleve') || b.prime - a.prime || b.depuis.localeCompare(a.depuis));
    const actifs = (S.d.avis || []).filter(a => a.statut === 'recherche');
    $('page').innerHTML = entete('Avis de recherche', 'Les personnes recherchées par la garde, leur signalement et la prime offerte. À l\'arrestation, la prime peut être versée depuis le Trésor.',
      '<select class="mini" data-f="avst" aria-label="Statut"><option value="recherche">Recherchés</option><option value="arrete"' + (fs === 'arrete' ? ' selected' : '') + '>Arrêtés</option><option value="abandonne"' + (fs === 'abandonne' ? ' selected' : '') + '>Abandonnés</option><option value="tous"' + (fs === 'tous' ? ' selected' : '') + '>Tous</option></select>' +
      '<input class="recherche" data-f="avq" placeholder="Chercher…" value="' + esc(S.f.avq || '') + '">' + (ed ? '<button class="btn or" data-act="avis">+ Nouvel avis</button>' : '')) +
      '<div class="chiffres"><div class="chiffre"><b>' + actifs.length + '</b><small>personne(s) recherchée(s)</small></div><div class="chiffre"><b>' + esc(fmtS(actifs.reduce((t, a) => t + a.prime, 0))) + '</b><small>de primes offertes</small></div><div class="chiffre"><b>' + (S.d.avis || []).filter(a => a.statut === 'arrete').length + '</b><small>arrestation(s)</small></div></div>' +
      (l.length ? '<div class="grille affiches">' + l.map(a => '<article class="carte avis st-' + esc(a.statut) + (a.statut === 'recherche' ? '' : ' clos') + '"><div class="titre-avis">Recherché</div><div class="tete"><h3>' + esc(a.personne) + '</h3>' + badge(STATUTS_AVIS[a.statut][0], STATUTS_AVIS[a.statut][1]) + '</div>' +
        (a.statut !== 'recherche' ? '<div class="tampon-avis">' + esc(STATUTS_AVIS[a.statut][0]) + '</div>' : '') +
        '<div class="prime">' + (a.prime ? 'Prime : <b>' + esc(fmtS(a.prime)) + '</b>' : '<small>Pas de prime</small>') + ' ' + badge(DANGERS[a.danger][0], DANGERS[a.danger][1]) + '</div>' +
        (a.motif ? '<p><b>Motif :</b> ' + esc(a.motif) + '</p>' : '') + (a.signalement ? '<p><b>Signalement :</b> ' + esc(a.signalement) + '</p>' : '') +
        '<div class="meta">Recherché depuis le ' + esc(fmtJ(a.depuis)) + (a.note ? ' · ' + esc(a.note) : '') + '</div>' +
        (ed ? '<div class="boutons-c">' + (a.statut === 'recherche' ? '<button class="btn petit or" data-act="arreter" data-id="' + esc(a.id) + '">Arrêté !</button>' : '') + '<button class="btn petit" data-act="avis" data-id="' + esc(a.id) + '">Modifier</button>' + (niv('justice') >= 2 ? '<button class="btn petit" data-act="casier" data-p="' + esc(a.personne) + '">Casier</button>' : '') + '</div>' : '') + '</article>').join('') + '</div>' : vide(fs === 'recherche' ? 'Personne n\'est recherché.' : 'Aucun avis.'));
  };
  function ouvrirAvis(id) {
    const a = id ? (S.d.avis || []).find(x => x.id === id) : null;
    fenetre({ titre: a ? 'Avis : ' + a.personne : 'Nouvel avis de recherche', html:
      '<div class="rang">' + champ('', 'Personne recherchée', '<input id="av-pers" list="av-pers-l" maxlength="60" value="' + esc(a ? a.personne : '') + '">' + listePersonnes('av-pers-l')) + entree('av-prime', 'Prime (septimes)', a ? a.prime : 0, 'type="number" min="0" step="10"') + '</div>' +
      '<div class="rang">' + choix('av-danger', 'Dangerosité', Object.keys(DANGERS).map(k => [k, DANGERS[k][0]]), a ? a.danger : 'moyen') + (a ? choix('av-statut', 'Statut', Object.keys(STATUTS_AVIS).map(k => [k, STATUTS_AVIS[k][0]]), a.statut) : '') + entree('av-depuis', 'Recherché depuis', a ? a.depuis : S.d.aujourdhui, 'type="date"') + '</div>' +
      entree('av-motif', 'Motif', a && a.motif, 'maxlength="300" placeholder="Ex. : vol au marché, fuite"') + zone('av-sign', 'Signalement', a && a.signalement, 'maxlength="1000" placeholder="Taille, cheveux, signes particuliers, vêtements, où on l\'a vu…"') + zone('av-note', 'Note', a && a.note, 'maxlength="1000"'),
      boutons: (a ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer l\'avis concernant ' + a.personne + ' ?', f: async () => { maj(await api('supprimerAvis', { id: a.id })); toast('Avis supprimé.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('enregistrerAvis', { id: a ? a.id : '', personne: val('av-pers'), prime: val('av-prime'), danger: val('av-danger'), statut: a ? val('av-statut') : 'recherche', depuis: val('av-depuis'), motif: val('av-motif'), signalement: val('av-sign'), note: val('av-note') })); toast('Avis enregistré.'); } }]) });
  }
  function arreter(id) {
    const a = (S.d.avis || []).find(x => x.id === id), tr = niv('tresor') >= 2;
    fenetre({ titre: 'Arrestation — ' + a.personne, html: entree('ar-note', 'Circonstances (facultatif)', '', 'maxlength="300" placeholder="Ex. : arrêté au port par Solveig"') +
      (a.prime && tr ? caseC('ar-prime', 'Verser la prime (sortie du Trésor)', true) + '<div class="rang">' + entree('ar-montant', 'Montant de la prime', a.prime, 'type="number" min="0" step="1"') + champ('', 'Versée à', '<input id="ar-benef" list="ar-benefs" maxlength="60"><datalist id="ar-benefs">' + S.d.membres.filter(m => m.actif).map(m => '<option value="' + esc(m.nom) + '">').join('') + '</datalist>') + '</div>' : a.prime ? '<p class="aide">La prime (' + esc(fmtS(a.prime)) + ') devra être versée par quelqu\'un qui gère le Trésor.</p>' : '') +
      (niv('justice') >= 2 ? caseC('ar-aff', 'Ouvrir ensuite une affaire au casier', true) : ''),
      boutons: [{ t: 'Annuler' }, { t: 'Confirmer l\'arrestation', cls: 'or', f: async () => {
        const ouvrirApres = !!val('ar-aff');
        maj(await api('arreterAvis', { id, note: val('ar-note'), verserPrime: !!val('ar-prime'), prime: val('ar-montant'), beneficiaire: val('ar-benef') }));
        toast(a.personne + ' est arrêté.');
        if (ouvrirApres) setTimeout(() => ouvrirAffaire(null, { personne: a.personne }), 0);
      } }] });
  }

  // =====================================================================
  //  Communication : annonces et rapports de mission
  // =====================================================================
  RENDUS.annonces = () => {
    const ed = niv('annonces') >= 2, auj = S.d.aujourdhui;
    const l = (S.d.annonces || []).slice().sort((a, b) => (b.epingle - a.epingle) || cleLe(b.le).localeCompare(cleLe(a.le)));
    $('page').innerHTML = entete('Annonces', 'Le tableau d\'affichage de la Châtellerie. Les annonces apparaissent sur l\'accueil de ceux à qui elles s\'adressent (tout le monde, ou certains grades seulement). Une annonce épinglée reste en haut.',
      ed ? '<button class="btn or" data-act="annonce">+ Nouvelle annonce</button>' : '') +
      (l.length ? '<div class="liege">' + l.map(a => '<div class="ligne-annonce' + (a.expire && a.expire < auj ? ' inactif' : '') + '">' + carteAnnonce(a) + (a.expire && a.expire < auj ? '<span class="etat neutre">expirée</span>' : '') + (ed ? '<button class="btn petit" data-act="annonce" data-id="' + esc(a.id) + '">Modifier</button>' : '') + '</div>').join('') + '</div>' : vide('Aucune annonce.'));
  };
  function ouvrirAnnonce(id) {
    const a = id ? (S.d.annonces || []).find(x => x.id === id) : null, sel = a ? a.grades : [];
    fenetre({ titre: a ? 'Annonce : ' + a.titre : 'Nouvelle annonce', large: true, html:
      entree('an-titre', 'Titre', a && a.titre, 'maxlength="100"') + zone('an-texte', 'Texte', a && a.texte, 'maxlength="3000" rows="5"') +
      '<div class="rang">' + entree('an-exp', 'Visible jusqu\'au (facultatif)', a && a.expire, 'type="date"') + '<div>' + caseC('an-ep', '📌 Épingler en haut du tableau', a && a.epingle) + '</div></div>' +
      champ('', 'Pour qui ? (aucun coché = tout le monde)', '<div class="coches" id="an-gr">' + S.d.grades.map(g => '<label class="' + (sel.indexOf(g.id) >= 0 ? 'on' : '') + '"><input type="checkbox" value="' + esc(g.id) + '"' + (sel.indexOf(g.id) >= 0 ? ' checked' : '') + '> ' + esc(g.nom) + '</label>').join('') + '</div>'),
      ouvert: () => $('an-gr').addEventListener('change', ev => { ev.target.closest('label').classList.toggle('on', ev.target.checked); }),
      boutons: (a ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Supprimer l\'annonce « ' + a.titre + ' » ?', f: async () => { maj(await api('supprimerAnnonce', { id: a.id })); toast('Annonce supprimée.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: a ? 'Enregistrer' : 'Publier', cls: 'or', f: async () => {
          const grades = [...$('an-gr').querySelectorAll('input:checked')].map(i => i.value);
          maj(await api('enregistrerAnnonce', { id: a ? a.id : '', titre: val('an-titre'), texte: val('an-texte'), expire: val('an-exp'), epingle: val('an-ep'), grades }));
          toast(a ? 'Annonce modifiée.' : 'Annonce publiée.'); } }]) });
  }
  const STATUTS_RAPPORT = { soumis: ['À valider', '#d9822b'], valide: ['Validé', '#3f9b5a'], a_revoir: ['À revoir', '#c0392b'] };
  /** Les rapports d'une mission : lecture, rédaction (membres affectés), validation (chefs). */
  function ouvrirRapports(mid) {
    const x = (S.d.missions || []).find(m => m.id === mid); if (!x) return;
    const moi = S.d.moi, gere = niv('missions') >= 2, membreDe = x.membres.indexOf(moi.id) >= 0;
    const rs = (S.d.rapports || []).filter(r => r.mission === mid).sort((a, b) => cleLe(a.le).localeCompare(cleLe(b.le)));
    const mien = rs.find(r => r.auteur === moi.id && r.statut !== 'valide');
    fenetre({ titre: 'Rapports — ' + x.titre, large: true, html:
      (rs.length ? rs.map(r => '<div class="rapport"><div class="tete"><b>' + esc(nomMembre(r.auteur)) + '</b> <small>' + esc(r.le) + '</small> ' + badge(STATUTS_RAPPORT[r.statut][0], STATUTS_RAPPORT[r.statut][1]) + '</div><p>' + esc(r.texte).replace(/\n/g, '<br>') + '</p>' +
        (r.remarque ? '<p class="cr">💬 ' + esc(r.remarque) + (r.valide_par ? ' <small>— ' + esc(r.valide_par) + '</small>' : '') + '</p>' : '') +
        (gere && r.statut !== 'valide' ? '<div class="boutons-c"><button type="button" class="btn petit or" data-val="' + esc(r.id) + '" data-s="valide">✓ Valider</button><button type="button" class="btn petit" data-val="' + esc(r.id) + '" data-s="a_revoir">↩ À revoir</button></div>' : '') +
        ((gere || (r.auteur === moi.id && r.statut !== 'valide')) ? '<button type="button" class="btn petit danger" data-supr="' + esc(r.id) + '">Supprimer</button>' : '') + '</div>').join('') : vide('Aucun rapport pour cette mission.')) +
      ((membreDe || gere) ? '<h3 style="margin-top:14px">' + (mien ? 'Corriger mon rapport' : 'Écrire mon rapport') + '</h3>' + zone('ra-texte', 'Ce qui s\'est passé', mien ? mien.texte : '', 'maxlength="5000" rows="6" placeholder="Déroulement, personnes rencontrées, incidents, suites à donner…"') : ''),
      ouvert: () => {
        $('mg-corps').onclick = async ev => {
          const v = ev.target.closest('[data-val]'), s = ev.target.closest('[data-supr]');
          try {
            if (v) { const rem = v.dataset.s === 'a_revoir' ? prompt('Ce qu\'il faut revoir :') : ''; if (rem === null) return; maj(await api('validerRapport', { id: v.dataset.val, statut: v.dataset.s, remarque: rem })); ouvrirRapports(mid); toast(v.dataset.s === 'valide' ? 'Rapport validé.' : 'Rapport renvoyé à son auteur.'); }
            else if (s && confirm('Supprimer ce rapport ?')) { maj(await api('supprimerRapport', { id: s.dataset.supr })); ouvrirRapports(mid); toast('Rapport supprimé.'); }
          } catch (e) { $('mg-erreur').textContent = msg(e); }
        };
      },
      boutons: [{ t: 'Fermer' }].concat((membreDe || gere) ? [{ t: mien ? 'Enregistrer la correction' : 'Envoyer mon rapport', cls: 'or', f: async () => { maj(await api('ecrireRapport', { mission: mid, id: mien ? mien.id : '', texte: val('ra-texte') })); toast('Rapport envoyé.'); } }] : []) });
  }

  // =====================================================================
  //  Logistique : planning des gardes et armurerie
  // =====================================================================
  RENDUS.planning = () => {
    const sem = S.sem.planning || semCour(), ed = niv('planning') >= 2, moi = S.d.moi.id, mes = !!S.f.plMoi;
    const ps = (S.d.planning || []).filter(p => p.semaine === sem && (!mes || p.membres.indexOf(moi) >= 0));
    const cellule = (j, c) => ps.filter(p => p.jour === j && p.creneau === c).sort((a, b) => a.poste.localeCompare(b.poste, 'fr')).map(p =>
      '<button class="garde' + (p.membres.indexOf(moi) >= 0 ? ' moi' : '') + (p.membres.length ? '' : ' vide') + '" ' + (ed ? 'data-act="garde" data-id="' + esc(p.id) + '"' : 'disabled') + ' title="' + esc(p.poste + (p.note ? ' — ' + p.note : '')) + '"><b>' + esc(p.poste) + '</b>' +
        (p.membres.length ? p.membres.map(id => '<span>' + esc(nomMembre(id)) + '</span>').join('') : '<span class="manque">personne</span>') + '</button>').join('') +
      (ed ? '<button class="ajout-g" data-act="garde" data-j="' + j + '" data-c="' + c + '" aria-label="Ajouter une garde ' + JOURS[j] + ' ' + CRENEAUX[c] + '">+</button>' : '');
    // charge de chacun sur la semaine (pour équilibrer)
    const charge = {}; (S.d.planning || []).filter(p => p.semaine === sem).forEach(p => p.membres.forEach(id => { charge[id] = (charge[id] || 0) + 1; }));
    const gardes = S.d.membres.filter(m => m.actif && grade(m.grade).garde && statut(m.statut).paye).sort((a, b) => (charge[a.id] || 0) - (charge[b.id] || 0) || a.nom.localeCompare(b.nom, 'fr'));
    $('page').innerHTML = entete('Planning des gardes', 'Qui est de garde, où et quand. ' + (ed ? 'Cliquez sur « + » dans une case pour ajouter une garde, sur une garde pour la modifier.' : 'Vos gardes sont surlignées.'),
      selSemaine('planning') + '<label class="case" style="margin:0"><input type="checkbox" data-act="tog" data-k="plMoi"' + (mes ? ' checked' : '') + '> Mes gardes</label>' + (ed ? '<button class="btn" data-act="copierPl">Recopier la semaine précédente</button>' : '')) +
      '<div class="tableau-b"><table class="t planning"><thead><tr><th></th>' + JOURS.map((j, i) => '<th' + (ajout(sem, i) === S.d.aujourdhui ? ' class="auj"' : '') + '>' + j + '<br><small>' + esc(fmtCourt(ajout(sem, i))) + '</small></th>').join('') + '</tr></thead><tbody>' +
      Object.keys(CRENEAUX).map(c => '<tr class="cr-' + c + '"><th>' + ({ matin: '🌅 ', apres_midi: '☀️ ', nuit: '🌙 ' }[c]) + esc(CRENEAUX[c]) + '</th>' + JOURS.map((j, i) => '<td' + (ajout(sem, i) === S.d.aujourdhui ? ' class="auj"' : '') + '>' + cellule(i, c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
      (niv('planning') && gardes.length ? '<h3 style="margin-top:18px">Gardes par personne cette semaine</h3><div class="charge">' + gardes.map(m => '<span class="' + (charge[m.id] ? '' : 'zero') + '">' + esc(m.nom) + ' <b>' + (charge[m.id] || 0) + '</b></span>').join('') + '</div><p class="aide">Seuls les membres de la garde en service apparaissent ; les moins chargés d\'abord.</p>' : '');
  };
  function ouvrirGarde(id, jour, creneau) {
    const sem = S.sem.planning || semCour(), p = id ? (S.d.planning || []).find(x => x.id === id) : null;
    const postes = [...new Set((S.d.planning || []).map(x => x.poste).concat(['Porte du Val', 'Remparts nord', 'Port', 'Château', 'Place du Marché']))].sort((a, b) => a.localeCompare(b, 'fr'));
    const coches = p ? p.membres : [];
    const dispo = S.d.membres.filter(m => m.actif && grade(m.grade).garde).sort((a, b) => (statut(b.statut).paye - statut(a.statut).paye) || grade(b.grade).rang - grade(a.grade).rang || a.nom.localeCompare(b.nom, 'fr'));
    const occupe = (mid, j, c) => (S.d.planning || []).some(x => x.semaine === sem && x.jour === j && x.creneau === c && x.membres.indexOf(mid) >= 0 && (!p || x.id !== p.id));
    const j0 = p ? p.jour : Number(jour) || 0, c0 = p ? p.creneau : creneau || 'matin';
    fenetre({ titre: p ? 'Garde : ' + p.poste : 'Nouvelle garde', large: true, html:
      '<div class="rang">' + choix('ga-jour', 'Jour', JOURS.map((j, i) => [i, j + ' ' + fmtCourt(ajout(sem, i))]), j0) + choix('ga-cr', 'Créneau', Object.keys(CRENEAUX).map(k => [k, CRENEAUX[k]]), c0) +
        champ('', 'Poste', '<input id="ga-poste" list="ga-postes" maxlength="60" value="' + esc(p ? p.poste : '') + '" placeholder="Ex. : Porte du Val"><datalist id="ga-postes">' + postes.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>') + '</div>' +
      champ('', 'Gardes affectés', '<div class="coches" id="ga-mb">' + dispo.map(m => '<label class="' + (coches.indexOf(m.id) >= 0 ? 'on' : '') + '"><input type="checkbox" value="' + esc(m.id) + '"' + (coches.indexOf(m.id) >= 0 ? ' checked' : '') + '> ' + esc(m.nom) + ' <small style="color:var(--doux)">' + esc(grade(m.grade).nom) + (statut(m.statut).paye ? '' : ' · ' + esc(statut(m.statut).nom)) + '</small><em class="occupe" data-o="' + esc(m.id) + '"></em></label>').join('') + '</div>') +
      entree('ga-note', 'Consigne (facultatif)', p && p.note, 'maxlength="300"'),
      ouvert: () => {
        const maj2 = () => { const j = Number(val('ga-jour')), c = val('ga-cr'); $('mg-corps').querySelectorAll('[data-o]').forEach(e => { e.textContent = occupe(e.dataset.o, j, c) ? ' déjà de garde à ce créneau' : ''; }); };
        $('ga-mb').addEventListener('change', ev => { ev.target.closest('label').classList.toggle('on', ev.target.checked); });
        $('ga-jour').addEventListener('change', maj2); $('ga-cr').addEventListener('change', maj2); maj2();
      },
      boutons: (p ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Retirer cette garde du planning ?', f: async () => { maj(await api('supprimerGarde', { id: p.id })); toast('Garde retirée.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => {
          const membres = [...$('ga-mb').querySelectorAll('input:checked')].map(i => i.value);
          maj(await api('enregistrerGarde', { id: p ? p.id : '', semaine: sem, jour: val('ga-jour'), creneau: val('ga-cr'), poste: val('ga-poste'), membres, note: val('ga-note') }));
          toast('Planning mis à jour.'); } }]) });
  }

  // ---------- Armurerie ----------
  const ETATS_PRET = { prete: ['En prêt', '#4f86b8'], rendu: ['Rendu', '#3f9b5a'], abime: ['Rendu abîmé', '#d9822b'], perdu: ['Perdu', '#c0392b'] };
  const enPret = id => (S.d.prets || []).filter(p => p.equipement === id && p.etat === 'prete').reduce((t, p) => t + p.quantite, 0);
  RENDUS.armurerie = () => {
    const ed = niv('armurerie') >= 2, tab = S.f.artab || 'stock', eqs = S.d.equipements || [], prets = S.d.prets || [], auj = S.d.aujourdhui;
    const encours = prets.filter(p => p.etat === 'prete'), q = normal(S.f.arq || '');
    let corps = '';
    if (tab === 'stock') {
      const l = eqs.filter(e => !q || normal(e.nom + ' ' + e.categorie).indexOf(q) >= 0).sort((a, b) => (a.categorie || '').localeCompare(b.categorie || '', 'fr') || a.nom.localeCompare(b.nom, 'fr'));
      corps = l.length ? '<div class="plaques">' + l.map(e => {
        const pr = enPret(e.id), di = e.quantite - pr, pc = e.quantite ? Math.round(di / e.quantite * 100) : 0;
        return '<article class="plaque-m"><div class="tete"><h3>' + esc(e.nom) + '</h3><small>' + esc(e.categorie || '') + '</small></div>' +
          '<div class="jauge" role="img" aria-label="' + di + ' disponible(s) sur ' + e.quantite + '"><i style="width:' + pc + '%" class="' + (di > 0 ? '' : 'vide') + '"></i></div>' +
          '<p><b class="' + (di > 0 ? 'etat ok' : 'etat retard') + '">' + di + ' disponible' + (di > 1 ? 's' : '') + '</b> sur ' + e.quantite + (pr ? ' · ' + pr + ' en prêt' : '') + (e.valeur ? ' · ' + esc(fmtS(e.valeur)) + ' pièce' : '') + '</p>' + (e.note ? '<p class="meta">' + esc(e.note) + '</p>' : '') +
          (ed ? '<div class="boutons-c">' + (di > 0 ? '<button class="btn petit or" data-act="preter" data-id="' + esc(e.id) + '">Prêter</button>' : '') + '<button class="btn petit" data-act="equipement" data-id="' + esc(e.id) + '">Modifier</button></div>' : '') + '</article>';
      }).join('') + '</div><p class="aide" style="margin-top:12px">Valeur du stock : <b>' + esc(fmtS(eqs.reduce((t, e) => t + e.quantite * e.valeur, 0))) + '</b></p>' : vide('L\'armurerie est vide.');
    } else {
      const l = (tab === 'prets' ? encours : prets.filter(p => p.etat !== 'prete')).filter(p => !q || normal(p.nomEquipement + ' ' + nomMembre(p.membre)).indexOf(q) >= 0)
        .sort((a, b) => tab === 'prets' ? a.sortie.localeCompare(b.sortie) : (b.retour || '').localeCompare(a.retour || ''));
      corps = l.length ? tableau(tab === 'prets' ? [['Équipement'], ['Prêté à'], ['Qté', 'num'], ['Depuis'], ['', 'act']] : [['Équipement'], ['Prêté à'], ['Qté', 'num'], ['Sorti'], ['Retour'], ['État'], ['Retenue', 'num']], l.map(p => {
        const j = ecart(p.sortie, auj);
        return '<tr><td>' + esc(p.nomEquipement) + '</td><td>' + esc(nomMembre(p.membre)) + '</td><td class="num">' + p.quantite + '</td><td>' + esc(fmtJ(p.sortie)) + (tab === 'prets' ? ' <small class="etat ' + (j > 14 ? 'retard' : 'neutre') + '">(' + j + ' j)</small>' : '') + '</td>' +
          (tab === 'prets' ? '<td class="act">' + (ed ? '<button class="btn petit or" data-act="retour" data-id="' + esc(p.id) + '" data-e="rendu">Rendu</button><button class="btn petit" data-act="retour" data-id="' + esc(p.id) + '" data-e="abime">Abîmé</button><button class="btn petit danger" data-act="retour" data-id="' + esc(p.id) + '" data-e="perdu">Perdu</button>' : '') + '</td>'
            : '<td>' + esc(fmtJ(p.retour)) + '</td><td>' + badge(ETATS_PRET[p.etat][0], ETATS_PRET[p.etat][1]) + (p.note ? '<br><small>' + esc(p.note) + '</small>' : '') + '</td><td class="num">' + (p.retenue ? esc(fmtS(p.retenue)) + '<br><small>' + (p.retenue_paiement ? 'prélevée' : 'à prélever') + '</small>' : '—') + '</td>') + '</tr>';
      })) : vide(tab === 'prets' ? 'Aucun équipement en prêt.' : 'Aucun retour enregistré.');
    }
    $('page').innerHTML = entete('Armurerie', 'Le stock d\'équipement de la garde et ce qui est prêté à qui. Un équipement perdu ou abîmé peut entraîner une retenue, prélevée automatiquement sur le prochain solde.',
      '<input class="recherche" data-f="arq" placeholder="Chercher…" value="' + esc(S.f.arq || '') + '">' + (ed ? '<button class="btn or" data-act="equipement">+ Ajouter un équipement</button>' : '')) +
      '<div class="chiffres"><div class="chiffre"><b>' + eqs.reduce((t, e) => t + e.quantite, 0) + '</b><small>pièces en stock</small></div><div class="chiffre"><b>' + encours.reduce((t, p) => t + p.quantite, 0) + '</b><small>pièces en prêt</small></div>' +
      '<div class="chiffre' + (encours.some(p => ecart(p.sortie, auj) > 14) ? ' alerte' : '') + '"><b>' + encours.filter(p => ecart(p.sortie, auj) > 14).length + '</b><small>prêts de plus de 2 semaines</small></div><div class="chiffre"><b>' + esc(fmtS(prets.filter(p => p.retenue && !p.retenue_paiement).reduce((t, p) => t + p.retenue, 0))) + '</b><small>de retenues à prélever</small></div></div>' +
      onglets('artab', [['stock', 'Stock', eqs.length], ['prets', 'Prêts en cours', encours.length], ['histo', 'Historique']], 'stock') + corps;
  };
  function ouvrirEquipement(id) {
    const e = id ? (S.d.equipements || []).find(x => x.id === id) : null;
    const cats = [...new Set(['Armes', 'Protections', 'Matériel', 'Montures'].concat((S.d.equipements || []).map(x => x.categorie).filter(Boolean)))];
    fenetre({ titre: e ? e.nom : 'Nouvel équipement', html:
      '<div class="rang">' + entree('eq-nom', 'Nom', e && e.nom, 'maxlength="80" placeholder="Ex. : Épée d\'acier"') + champ('', 'Catégorie', '<input id="eq-cat" list="eq-cats" maxlength="40" value="' + esc(e ? e.categorie : '') + '"><datalist id="eq-cats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>') + '</div>' +
      '<div class="rang">' + entree('eq-q', 'Quantité possédée', e ? e.quantite : 1, 'type="number" min="0" step="1"') + entree('eq-v', 'Valeur unitaire (septimes)', e ? e.valeur : 0, 'type="number" min="0" step="1"') + '</div>' + zone('eq-note', 'Note', e && e.note, 'maxlength="500"'),
      boutons: (e ? [{ t: 'Supprimer', cls: 'danger gauche', confirmer: 'Retirer « ' + e.nom + ' » de l\'armurerie ?', f: async () => { maj(await api('supprimerEquipement', { id: e.id })); toast('Équipement retiré.'); } }] : [])
        .concat([{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('enregistrerEquipement', { id: e ? e.id : '', nom: val('eq-nom'), categorie: val('eq-cat'), quantite: val('eq-q'), valeur: val('eq-v'), note: val('eq-note') })); toast('Armurerie mise à jour.'); } }]) });
  }
  function ouvrirPret(id) {
    const e = (S.d.equipements || []).find(x => x.id === id), di = e.quantite - enPret(e.id);
    fenetre({ titre: 'Prêter : ' + e.nom, html: '<p class="aide">' + di + ' disponible(s).</p>' +
      '<div class="rang">' + choix('pr-m', 'À qui ?', S.d.membres.filter(m => m.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(m => [m.id, m.nom + ' (' + grade(m.grade).nom + ')']), '') + entree('pr-q', 'Quantité', 1, 'type="number" min="1" max="' + di + '" step="1"') + entree('pr-d', 'Date', S.d.aujourdhui, 'type="date"') + '</div>' + entree('pr-note', 'Note (facultatif)', '', 'maxlength="200"'),
      boutons: [{ t: 'Annuler' }, { t: 'Prêter', cls: 'or', f: async () => { maj(await api('preter', { equipement: id, membre: val('pr-m'), quantite: val('pr-q'), sortie: val('pr-d'), note: val('pr-note') })); toast('Prêt enregistré.'); } }] });
  }
  function retourPret(id, etat) {
    const p = (S.d.prets || []).find(x => x.id === id), e = (S.d.equipements || []).find(x => x.id === p.equipement) || { valeur: 0 };
    if (etat === 'rendu') { if (!confirm(p.nomEquipement + ' rendu par ' + nomMembre(p.membre) + ' ?')) return; api('retourPret', { id, etat }).then(d => { maj(d); toast('Retour enregistré.'); }).catch(x => toast(msg(x), true)); return; }
    const defaut = etat === 'perdu' ? e.valeur * p.quantite : Math.round(e.valeur * p.quantite / 2);
    fenetre({ titre: (etat === 'perdu' ? 'Perdu : ' : 'Rendu abîmé : ') + p.nomEquipement, html: '<p>' + esc(nomMembre(p.membre)) + (p.quantite > 1 ? ' · ' + p.quantite + ' pièces' : '') + '</p>' +
      entree('rt-ret', 'Retenue sur son solde (septimes, 0 = aucune)', defaut, 'type="number" min="0" step="1"') + entree('rt-note', 'Circonstances', '', 'maxlength="200"') +
      '<p class="aide">' + (etat === 'perdu' ? 'L\'équipement perdu sort du stock. ' : '') + 'La retenue est prélevée automatiquement au prochain versement de solde.</p>',
      boutons: [{ t: 'Annuler' }, { t: 'Enregistrer', cls: 'or', f: async () => { maj(await api('retourPret', { id, etat, retenue: val('rt-ret'), note: val('rt-note') })); toast('Retour enregistré.'); } }] });
  }

  // =====================================================================
  //  Bilan : graphiques du trésor, prévision, retards, export
  // =====================================================================
  const COUL = { entree: '#5fb07a', sortie: '#d9822b', solde: '#d4a73a' };   // palette validée sur le fond sombre de l'appli
  const fmtN = v => Math.round(v).toLocaleString('fr-FR');
  /** Graphique en barres groupées : entrées / sorties par semaine (un seul axe). */
  function grapheBarres(ws, parSem) {
    const W = 760, H = 250, g = 44, d = 10, h = 22, b = 28, iw = W - g - d, ih = H - h - b;
    const max = Math.max(1, ...ws.map(s => Math.max(parSem[s].entree, parSem[s].sortie)));
    const pas = Math.pow(10, Math.floor(Math.log10(max))), haut = Math.ceil(max / pas) * pas, ticks = [0, .25, .5, .75, 1].map(t => t * haut);
    const y = v => h + ih - v / haut * ih, col = iw / ws.length, bw = Math.max(3, Math.min(22, (col - 8) / 2));
    const barre = (x, v, c) => { const y0 = y(v), hh = h + ih - y0; if (hh <= 0) return ''; const r = Math.min(4, hh, bw / 2); return '<path d="M' + x + ' ' + (h + ih) + 'V' + (y0 + r) + 'Q' + x + ' ' + y0 + ' ' + (x + r) + ' ' + y0 + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + y0 + ' ' + (x + bw) + ' ' + (y0 + r) + 'V' + (h + ih) + 'Z" fill="' + c + '"/>'; };
    const chaque = Math.ceil(ws.length / 13);
    return '<svg class="graphe" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Entrées et sorties du trésor par semaine">' +
      ticks.map(t => '<line x1="' + g + '" x2="' + (W - d) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="grille-l"/><text x="' + (g - 6) + '" y="' + (y(t) + 4) + '" class="axe" text-anchor="end">' + fmtN(t) + '</text>').join('') +
      ws.map((s, i) => { const x0 = g + i * col + (col - 2 * bw - 2) / 2; return barre(x0, parSem[s].entree, COUL.entree) + barre(x0 + bw + 2, parSem[s].sortie, COUL.sortie) +
        (i % chaque === 0 ? '<text x="' + (g + i * col + col / 2) + '" y="' + (H - 8) + '" class="axe" text-anchor="middle">' + esc(fmtCourt(s)) + '</text>' : '') +
        '<rect class="cible" x="' + (g + i * col) + '" y="' + h + '" width="' + col + '" height="' + ih + '" data-s="' + s + '"/>'; }).join('') + '</svg>';
  }
  /** Courbe du solde du trésor en fin de semaine. */
  function grapheSolde(ws, soldes) {
    const W = 760, H = 200, g = 54, d = 10, h = 16, b = 28, iw = W - g - d, ih = H - h - b;
    const mn = Math.min(0, ...ws.map(s => soldes[s])), mx = Math.max(1, ...ws.map(s => soldes[s]));
    const y = v => h + ih - (v - mn) / (mx - mn || 1) * ih, col = iw / ws.length, x = i => g + i * col + col / 2;
    const ticks = [0, 1, 2, 3].map(t => mn + (mx - mn) * t / 3), chaque = Math.ceil(ws.length / 13);
    return '<svg class="graphe" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Solde du trésor en fin de semaine">' +
      ticks.map(t => '<line x1="' + g + '" x2="' + (W - d) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="grille-l"/><text x="' + (g - 6) + '" y="' + (y(t) + 4) + '" class="axe" text-anchor="end">' + fmtN(t) + '</text>').join('') +
      (mn < 0 ? '<line x1="' + g + '" x2="' + (W - d) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="zero-l"/>' : '') +
      '<path d="' + ws.map((s, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(soldes[s])).join('') + '" fill="none" stroke="' + COUL.solde + '" stroke-width="2" stroke-linejoin="round"/>' +
      ws.map((s, i) => '<circle cx="' + x(i) + '" cy="' + y(soldes[s]) + '" r="4" fill="' + COUL.solde + '" stroke="var(--panneau)" stroke-width="2"/>' + (i % chaque === 0 ? '<text x="' + x(i) + '" y="' + (H - 8) + '" class="axe" text-anchor="middle">' + esc(fmtCourt(s)) + '</text>' : '') +
        '<rect class="cible" x="' + (g + i * col) + '" y="' + h + '" width="' + col + '" height="' + ih + '" data-s="' + s + '"/>').join('') + '</svg>';
  }
  function donneesBilan(nb) {
    const sc = semCour(), ws = []; for (let i = nb - 1; i >= 0; i--) ws.push(ajout(sc, -7 * i));
    const ts = S.d.tresor || [], parSem = {}, cats = {};
    ws.forEach(s => { parSem[s] = { entree: 0, sortie: 0 }; });
    ts.forEach(t => { if (parSem[t.semaine]) { parSem[t.semaine][t.sens] += num(t.montant); const k = t.sens + '|' + t.categorie; cats[k] = (cats[k] || 0) + num(t.montant); } });
    const soldes = {}; ws.forEach(s => { soldes[s] = ts.filter(t => t.semaine <= s).reduce((a, t) => a + (t.sens === 'sortie' ? -1 : 1) * num(t.montant), 0); });
    return { ws, parSem, cats, soldes };
  }
  /** Ce qui devrait entrer et sortir la semaine prochaine. */
  function prevision() {
    const out = { sorties: [], entrees: [] };
    const gardes = S.d.membres.filter(m => m.actif && grade(m.grade).garde && statut(m.statut).paye);
    const sol = gardes.reduce((t, m) => t + Math.max(0, salaireDe(m) - retenueDe(m)), 0);
    if (sol) out.sorties.push(['Soldes de la garde (' + gardes.length + ' membres)', sol]);
    const es = (S.d.etablissements || []).filter(e => e.actif === '1');
    const loyE = es.reduce((t, e) => t + num(e.loyer), 0); if (loyE) out.entrees.push(['Loyers des entreprises et thaneries', loyE]);
    let tx = 0, estimables = 0;
    es.forEach(e => { const ds = (S.d.declarations || []).filter(x => x.etablissement === e.id).sort((a, b) => b.semaine.localeCompare(a.semaine)).slice(0, 4); if (ds.length) { estimables++; tx += ds.reduce((t, x) => t + num(x.taxe), 0) / ds.length; } });
    if (tx) out.entrees.push(['Taxes (moyenne des 4 dernières déclarations, ' + estimables + ' établissements)', Math.round(tx)]);
    const loyM = (S.d.maisons || []).filter(h => h.actif === '1').reduce((t, h) => t + num(h.loyer), 0); if (loyM) out.entrees.push(['Loyers des maisons', loyM]);
    const cit = (S.d.citoyens || []).filter(c => c.actif === '1').reduce((t, c) => t + montantCit(c), 0); if (cit) out.entrees.push(['Citoyenneté', cit]);
    return out;
  }
  /** Tous les retards, toutes catégories, du plus gros au plus petit. */
  function classementRetards() {
    const l = [];
    (S.d.etablissements || []).forEach(e => {
      const r = retardsEtab(e);
      const nonDecl = r.taxes.filter(s => !etatEtab(e, s).d), declNonPayee = r.taxes.filter(s => etatEtab(e, s).d);
      const mt = declNonPayee.reduce((t, s) => t + num(etatEtab(e, s).d.taxe), 0) + r.loyers.length * num(e.loyer);
      if (mt || nonDecl.length) l.push({ qui: e.nom, quoi: (e.categorie === 'thanerie' ? 'Thanerie' : 'Entreprise') + ' : ' + [r.loyers.length ? r.loyers.length + ' loyer(s)' : '', declNonPayee.length ? declNonPayee.length + ' taxe(s) déclarée(s)' : '', nonDecl.length ? nonDecl.length + ' semaine(s) non déclarée(s)' : ''].filter(Boolean).join(', '), montant: mt, page: e.categorie === 'thanerie' ? 'thaneries' : 'entreprises' });
    });
    (S.d.maisons || []).forEach(h => { const r = retardsMaison(h); if (r.length) l.push({ qui: h.nom + (h.occupant ? ' (' + h.occupant + ')' : ''), quoi: 'Maison : ' + r.length + ' loyer(s)', montant: r.length * num(h.loyer), page: 'maisons' }); });
    (S.d.citoyens || []).forEach(c => { const r = etatCit(c).retard; if (r.length) l.push({ qui: c.nom, quoi: 'Citoyenneté : ' + r.length + ' semaine(s)', montant: r.length * montantCit(c), page: 'citoyennete' }); });
    (S.d.affaires || []).filter(impayee).forEach(a => l.push({ qui: a.personne, quoi: 'Amende du ' + fmtJ(a.date), montant: a.amende, page: 'justice' }));
    return l.sort((a, b) => b.montant - a.montant);
  }
  RENDUS.bilan = () => {
    const nb = Number(S.f.bper || 12), B = donneesBilan(nb), ws = B.ws;
    const tE = ws.reduce((t, s) => t + B.parSem[s].entree, 0), tS = ws.reduce((t, s) => t + B.parSem[s].sortie, 0);
    const pv = prevision(), pE = pv.entrees.reduce((t, x) => t + x[1], 0), pS = pv.sorties.reduce((t, x) => t + x[1], 0);
    const rets = classementRetards(), totR = rets.reduce((t, r) => t + r.montant, 0);
    const catsE = Object.keys(B.cats).filter(k => k.startsWith('entree|')).sort((a, b) => B.cats[b] - B.cats[a]), catsS = Object.keys(B.cats).filter(k => k.startsWith('sortie|')).sort((a, b) => B.cats[b] - B.cats[a]);
    const ligneCat = (k, tot) => '<tr><td>' + esc(k.split('|')[1]) + '</td><td class="num">' + esc(fmtS(B.cats[k])) + '</td><td class="num"><span class="barre-p"><i style="width:' + (tot ? Math.round(B.cats[k] / tot * 100) : 0) + '%"></i></span> ' + (tot ? Math.round(B.cats[k] / tot * 100) : 0) + ' %</td></tr>';
    $('page').innerHTML = entete('Bilan', 'Les finances de la Châtellerie d\'un coup d\'œil : l\'évolution du trésor, d\'où vient l\'argent et où il part, ce qui est attendu la semaine prochaine et les plus gros retards.',
      '<select class="mini" data-f="bper" aria-label="Période">' + [[4, '4 dernières semaines'], [8, '8 dernières semaines'], [12, '12 dernières semaines'], [26, '6 derniers mois'], [52, '12 derniers mois']].map(o => '<option value="' + o[0] + '"' + (nb === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<button class="btn" data-act="exportTresor">⬇ Exporter le trésor</button>') +
      '<div class="chiffres"><div class="chiffre"><b>' + esc(fmtS(B.soldes[ws[ws.length - 1]])) + '</b><small>solde actuel du trésor</small></div><div class="chiffre"><b>' + esc(fmtS(tE)) + '</b><small>entrées sur la période</small></div><div class="chiffre"><b>' + esc(fmtS(tS)) + '</b><small>sorties sur la période</small></div>' +
      '<div class="chiffre' + (tE - tS < 0 ? ' alerte' : '') + '"><b>' + (tE - tS >= 0 ? '+ ' : '') + esc(fmtS(tE - tS)) + '</b><small>bilan de la période</small></div></div>' +
      '<section class="carte graphe-c"><div class="tete"><h3>Entrées et sorties par semaine</h3><div class="legende"><span><i style="background:' + COUL.entree + '"></i>Entrées</span><span><i style="background:' + COUL.sortie + '"></i>Sorties</span></div></div><div class="graphe-z" id="gr-barres">' + grapheBarres(ws, B.parSem) + '<div class="infobulle" hidden></div></div></section>' +
      '<section class="carte graphe-c"><div class="tete"><h3>Solde du trésor</h3><small class="aide" style="margin:0">en fin de semaine</small></div><div class="graphe-z" id="gr-solde">' + grapheSolde(ws, B.soldes) + '<div class="infobulle" hidden></div></div>' +
        '<details><summary>Voir les chiffres semaine par semaine</summary>' + tableau([['Semaine'], ['Entrées', 'num'], ['Sorties', 'num'], ['Bilan', 'num'], ['Solde', 'num']], ws.slice().reverse().map(s => '<tr><td>' + esc(fmtSem(s)) + '</td><td class="num">' + esc(fmtS(B.parSem[s].entree)) + '</td><td class="num">' + esc(fmtS(B.parSem[s].sortie)) + '</td><td class="num">' + esc(fmtS(B.parSem[s].entree - B.parSem[s].sortie)) + '</td><td class="num">' + esc(fmtS(B.soldes[s])) + '</td></tr>')) + '</details></section>' +
      '<div class="grille deux">' +
      '<section class="carte"><h3>D\'où vient l\'argent</h3>' + (catsE.length ? tableau([['Catégorie'], ['Montant', 'num'], ['Part', 'num']], catsE.map(k => ligneCat(k, tE))) : vide('Aucune entrée sur la période.')) + '</section>' +
      '<section class="carte"><h3>Où part l\'argent</h3>' + (catsS.length ? tableau([['Catégorie'], ['Montant', 'num'], ['Part', 'num']], catsS.map(k => ligneCat(k, tS))) : vide('Aucune sortie sur la période.')) + '</section>' +
      '</div>' +
      '<section class="carte" style="margin-top:14px"><h3>Prévision pour la ' + esc(fmtSem(ajout(semCour(), 7))) + '</h3><div class="grille deux"><div><p><b>Entrées attendues</b></p>' + (pv.entrees.length ? pv.entrees.map(x => '<div class="ligne-p"><span>' + esc(x[0]) + '</span><b>' + esc(fmtS(x[1])) + '</b></div>').join('') : vide('—')) +
        '</div><div><p><b>Sorties prévues</b></p>' + (pv.sorties.length ? pv.sorties.map(x => '<div class="ligne-p"><span>' + esc(x[0]) + '</span><b>' + esc(fmtS(x[1])) + '</b></div>').join('') : vide('—')) + '</div></div>' +
        '<p class="total-p">Bilan attendu : <b class="' + (pE - pS < 0 ? 'etat retard' : 'etat ok') + '">' + (pE - pS >= 0 ? '+ ' : '') + esc(fmtS(pE - pS)) + '</b> <small class="aide">— si tout le monde paie à l\'heure ; les taxes sont une estimation.</small></p></section>' +
      '<section class="carte" style="margin-top:14px"><div class="tete"><h3>Les plus gros retards</h3>' + (rets.length ? '<button class="btn petit" data-act="exportRetards">⬇ Exporter</button>' : '') + '</div>' +
        (rets.length ? '<p class="aide">' + rets.length + ' débiteur(s), ' + esc(fmtS(totR)) + ' au total (hors semaines non déclarées, dont le montant est inconnu).</p>' + tableau([['Qui'], ['Quoi'], ['Montant', 'num'], ['', 'act']], rets.slice(0, 15).map(r => '<tr><td><b>' + esc(r.qui) + '</b></td><td>' + esc(r.quoi) + '</td><td class="num">' + (r.montant ? '<span class="etat retard">' + esc(fmtS(r.montant)) + '</span>' : '<small>?</small>') + '</td><td class="act">' + (niv(r.page) ? '<button class="btn petit" data-act="aller" data-p="' + r.page + '">Voir</button>' : '') + '</td></tr>')) : vide('Aucun retard. 👍')) + '</section>';
    // infobulles des graphiques
    const bulle = (zoneId, texte) => {
      const z = $(zoneId), bu = z.querySelector('.infobulle');
      z.querySelectorAll('.cible').forEach(r => {
        r.addEventListener('mouseenter', () => { bu.innerHTML = texte(r.dataset.s); bu.hidden = false; r.classList.add('on'); });
        r.addEventListener('mousemove', ev => { const zr = z.getBoundingClientRect(); bu.style.left = Math.min(zr.width - bu.offsetWidth - 4, Math.max(4, ev.clientX - zr.left + 12)) + 'px'; bu.style.top = Math.max(4, ev.clientY - zr.top - bu.offsetHeight - 10) + 'px'; });
        r.addEventListener('mouseleave', () => { bu.hidden = true; r.classList.remove('on'); });
      });
    };
    bulle('gr-barres', s => '<b>' + esc(fmtSem(s)) + '</b><br><i style="background:' + COUL.entree + '"></i>Entrées : ' + esc(fmtS(B.parSem[s].entree)) + '<br><i style="background:' + COUL.sortie + '"></i>Sorties : ' + esc(fmtS(B.parSem[s].sortie)) + '<br>Bilan : ' + esc(fmtS(B.parSem[s].entree - B.parSem[s].sortie)));
    bulle('gr-solde', s => '<b>' + esc(fmtSem(s)) + '</b><br>Solde : ' + esc(fmtS(B.soldes[s])));
  };
  function exporterTresor() {
    const nb = Number(S.f.bper || 12), debut = ajout(semCour(), -7 * (nb - 1));
    const l = (S.d.tresor || []).filter(t => t.semaine >= debut).sort((a, b) => a.date.localeCompare(b.date));
    telecharger('tresor-faillaise-' + S.d.aujourdhui + '.csv', [['Date', 'Semaine du', 'Sens', 'Catégorie', 'Libellé', 'Montant', 'Enregistré par']].concat(l.map(t => [fmtJ(t.date), fmtJ(t.semaine), t.sens === 'sortie' ? 'Sortie' : 'Entrée', t.categorie, t.libelle, (t.sens === 'sortie' ? -1 : 1) * num(t.montant), t.par])));
    toast(l.length + ' mouvement(s) exporté(s).');
  }
  function exporterRetards() {
    telecharger('retards-faillaise-' + S.d.aujourdhui + '.csv', [['Qui', 'Quoi', 'Montant']].concat(classementRetards().map(r => [r.qui, r.quoi, r.montant])));
  }

  // ---------- Mon mot de passe ----------
  function ouvrirMdp() {
    fenetre({ titre: 'Mon mot de passe', html: entree('mp-a', 'Mot de passe actuel', '', 'type="password" autocomplete="current-password"') + entree('mp-n', 'Nouveau mot de passe', '', 'type="password" autocomplete="new-password"') + entree('mp-c', 'Confirmez le nouveau', '', 'type="password" autocomplete="new-password"'),
      boutons: [{ t: 'Annuler' }, { t: 'Changer', cls: 'or', f: async () => { if (val('mp-n') !== val('mp-c')) throw new Error('Les deux nouveaux mots de passe ne sont pas identiques.'); await api('monMotDePasse', { ancien: val('mp-a'), nouveau: val('mp-n') }); toast('Mot de passe changé.'); } }] });
  }

  // =====================================================================
  //  Actions (boutons data-act)
  // =====================================================================
  async function actions(b) {
    const a = b.dataset.act, id = b.dataset.id;
    try {
      if (a === 'sem') { const k = b.dataset.k, d = Number(b.dataset.d); S.sem[k] = d ? ajout(S.sem[k] || semCour(), d) : semCour(); dessiner(); }
      else if (a === 'aller') { S.page = b.dataset.p; ecrireLocal('chat-page', S.page); dessiner(); window.scrollTo(0, 0); }
      else if (a === 'mdp') ouvrirMdp();
      else if (a === 'quitter') deconnecter('À bientôt.');
      else if (a === 'membre') ouvrirMembre(id);
      else if (a === 'mission') ouvrirMission(id);
      else if (a === 'payer') { const m = membre(id); if (confirm('Verser ' + fmtS(salaireDe(m) - retenueDe(m)) + (retenueDe(m) ? ' (retenue de ' + fmtS(retenueDe(m)) + ' déduite)' : '') + ' à ' + m.nom + ' (' + fmtSem(S.sem.salaires || semCour()) + ') ?')) { maj(await api('payerSalaires', { semaine: S.sem.salaires || semCour(), membres: [id] })); toast('Solde versé à ' + m.nom + '.'); } }
      else if (a === 'payerTous') { if (confirm('Verser tous les soldes de la ' + fmtSem(S.sem.salaires || semCour()) + ' ?')) { maj(await api('payerSalaires', { semaine: S.sem.salaires || semCour() })); toast('Soldes versés.'); } }
      else if (a === 'etab') ouvrirEtab(id, b.dataset.cat);
      else if (a === 'declarer') ouvrirDeclaration(id, b.dataset.s);
      else if (a === 'encTaxe') encaisserEtab(id, b.dataset.s, 'taxe');
      else if (a === 'encLoyer') encaisserEtab(id, b.dataset.s, 'loyer');
      else if (a === 'retardsEtab') ouvrirRetardsEtab(id);
      else if (a === 'maison') ouvrirMaison(id);
      else if (a === 'encMaison') encaisserMaison(id);
      else if (a === 'citoyen') ouvrirCitoyen(id);
      else if (a === 'encCit') encaisserCit(id);
      else if (a === 'mouv') ouvrirMouvement(b.dataset.s);
      else if (a === 'annulerP') { if (confirm('Annuler ce paiement ? Il sera retiré du trésor et la semaine redeviendra due.')) { maj(await api('annulerPaiement', { id })); toast('Paiement annulé.'); } }
      else if (a === 'compte') ouvrirCompte(id);
      else if (a === 'journalMaj') { S.journal = null; RENDUS.journal(); }
      else if (a === 'grade') ouvrirGrade(id);
      else if (a === 'statut') ouvrirStatut(id);
      else if (a === 'onglet') { S.f[b.dataset.k] = b.dataset.v; dessiner(); }
      else if (a === 'rapport' || a === 'rapports') ouvrirRapports(b.dataset.m);
      else if (a === 'affaire') ouvrirAffaire(id);
      else if (a === 'loi') ouvrirLoi(id);
      else if (a === 'loiVoir') voirLoi(id);
      else if (a === 'loicat') { const c = b.dataset.c, l = (S.f.loiCats || []).slice(); if (!c) S.f.loiCats = []; else { const i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); S.f.loiCats = l; } dessiner(); }
      else if (a === 'casier') ouvrirCasier(b.dataset.p);
      else if (a === 'encAmende') encaisserAmende(id);
      else if (a === 'bareme') ouvrirBareme(id);
      else if (a === 'detention') ouvrirDetention(id);
      else if (a === 'liberer') { const d = S.d.detentions.find(x => x.id === id); if (confirm('Libérer ' + d.personne + ' ?')) { maj(await api('libererDetenu', { id })); toast(d.personne + ' est libéré.'); } }
      else if (a === 'evasion') evasion(id);
      else if (a === 'avis') ouvrirAvis(id);
      else if (a === 'arreter') arreter(id);
      else if (a === 'annonce') ouvrirAnnonce(id);
      else if (a === 'garde') ouvrirGarde(id, b.dataset.j, b.dataset.c);
      else if (a === 'copierPl') { const sem = S.sem.planning || semCour(); if (confirm('Recopier les gardes de la semaine précédente sur la ' + fmtSem(sem) + ' ?')) { maj(await api('copierPlanning', { semaine: sem })); toast('Planning recopié.'); } }
      else if (a === 'equipement') ouvrirEquipement(id);
      else if (a === 'preter') ouvrirPret(id);
      else if (a === 'retour') retourPret(id, b.dataset.e);
      else if (a === 'exportTresor') exporterTresor();
      else if (a === 'exportRetards') exporterRetards();
      else if (a === 'reglages') { maj(await api('enregistrerReglages', { taux_defaut: $('rg-taux').value, citoyennete: $('rg-cit').value, lancement: $('rg-lanc').value })); toast('Réglages enregistrés.'); }
    } catch (e) { toast(msg(e), true); }
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.type === 'checkbox' || !b.closest('#page, #moi')) return;
    actions(b);
  });
  $('page').addEventListener('input', ev => { const f = ev.target.dataset.f; if (f && ev.target.tagName === 'INPUT') { S.f[f] = ev.target.value; const pos = ev.target.selectionStart; dessiner(); const n = $('page').querySelector('[data-f="' + f + '"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } });
  $('page').addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.f && t.tagName === 'SELECT') { S.f[t.dataset.f] = t.value; if (t.dataset.f === 'ctri') ecrireLocal('chat-ctri', t.value); dessiner(); }
    else if (t.dataset.act === 'gardeTous') { S.f.gardeTous = t.checked; dessiner(); }
    else if (t.dataset.act === 'ttout') { S.f.ttout = t.checked; dessiner(); }
    else if (t.dataset.act === 'inactifs') { S.f[t.dataset.p + 'In'] = t.checked; dessiner(); }
    else if (t.dataset.act === 'tog') { S.f[t.dataset.k] = t.checked; dessiner(); }
  });

  // ---------- Démarrage ----------
  (async () => {
    if (!window.CONFIG || !window.CONFIG.api) { $('page').innerHTML = '<div class="chargement">Le serveur n\'est pas encore configuré : renseigne son adresse dans docs/config.js (voir le README).</div>'; return; }
    if (!S.jeton) { $('page').innerHTML = ''; ouvrirConnexion(); return; }
    try { await charger(); } catch (e) { if (S.jeton) deconnecter(msg(e)); }
  })();
})();
