/* Châtellerie de Faillaise — page (hébergée sur GitHub Pages), parle au serveur Apps Script. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lireLocal = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const ecrireLocal = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  const S = { jeton: lireLocal('chat-jeton'), d: null, page: lireLocal('chat-page') || 'accueil', sem: {}, f: {}, journal: null };

  // Pages : [id, icône, nom, clé de droit]
  const PAGES = [
    ['accueil', '🏰', 'Accueil', null], ['garde', '🛡️', 'Garde', 'garde'], ['missions', '⚔️', 'Missions', 'missions'], ['salaires', '💰', 'Salaires', 'salaires'],
    ['entreprises', '🏪', 'Entreprises', 'entreprises'], ['thaneries', '🌾', 'Thaneries', 'thaneries'], ['maisons', '🏠', 'Maisons', 'maisons'],
    ['citoyennete', '📜', 'Citoyenneté', 'citoyennete'], ['tresor', '🪙', 'Trésor', 'tresor'], ['-'],
    ['comptes', '👥', 'Comptes', 'comptes'], ['journal', '🧾', 'Journal', 'journal'], ['admin', '👑', 'Grades et droits', 'admin']
  ];
  const NOMS_DROITS = { garde: 'Garde', missions: 'Missions', salaires: 'Salaires', entreprises: 'Entreprises', thaneries: 'Thaneries', maisons: 'Maisons', citoyennete: 'Citoyenneté', tresor: 'Trésor', comptes: 'Comptes', journal: 'Journal', admin: 'Grades et droits' };
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
    const visibles = PAGES.filter(p => p[0] === '-' || niv(p[3]) >= 1);
    if (!visibles.some(p => p[0] === S.page)) S.page = 'accueil';
    $('nav').innerHTML = visibles.map(p => p[0] === '-' ? '<div class="sep"></div>' :
      '<button data-page="' + p[0] + '" class="' + (S.page === p[0] ? 'on' : '') + '"><span>' + p[1] + '</span>' + esc(p[2]) + (p[3] && niv(p[3]) === 1 ? '<span class="lect" title="Lecture seule">lecture</span>' : '') + '</button>').join('')
      .replace(/(<div class="sep"><\/div>)+$/, '');
    $('moi').innerHTML = '<span class="qui">' + esc(m.nom) + '</span>' + badgeGrade(m.grade) + '<button class="btn petit" data-act="mdp" title="Mon mot de passe" aria-label="Mon mot de passe">🔑<span class="txt"> Mon mot de passe</span></button><button class="btn petit" data-act="quitter" title="Déconnexion" aria-label="Déconnexion">⎋<span class="txt"> Déconnexion</span></button>';
    $('menu-mobile').hidden = false;
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
  RENDUS.accueil = () => {
    const m = S.d.moi, g = grade(m.grade), sc = semCour();
    const mesMissions = (S.d.missions || []).filter(x => x.membres.indexOf(m.id) >= 0 && (x.statut === 'prevue' || x.statut === 'en_cours'));
    const chiffres = [];
    if (S.d.tresor) {
      const solde = S.d.tresor.reduce((t, x) => t + (x.sens === 'sortie' ? -1 : 1) * num(x.montant), 0);
      const ent = S.d.tresor.filter(x => x.semaine === sc && x.sens === 'entree').reduce((t, x) => t + num(x.montant), 0);
      chiffres.push(['Trésor', fmtS(solde), solde < 0], ['Entrées de la semaine', fmtS(ent)]);
    }
    let retards = 0;
    if (S.d.etablissements) S.d.etablissements.forEach(e => { const r = retardsEtab(e); retards += r.taxes.length + r.loyers.length; });
    if (S.d.maisons) S.d.maisons.forEach(h => { retards += retardsMaison(h).length; });
    if (S.d.citoyens) S.d.citoyens.forEach(c => { retards += etatCit(c).retard.length; });
    if (S.d.etablissements || S.d.maisons || S.d.citoyens) chiffres.push(['Paiements en retard', String(retards), retards > 0]);
    if (niv('missions')) chiffres.push(['Missions en cours', String((S.d.missions || []).filter(x => x.statut === 'en_cours').length)]);
    const paye = paiement('salaire', m.id, sc);
    let afaire = [];
    if (niv('salaires') >= 2) { const n = S.d.membres.filter(x => x.actif && grade(x.grade).garde && statut(x.statut).paye && !paiement('salaire', x.id, sc) && salaireDe(x) > 0).length; if (n) afaire.push(['salaires', n + ' salaire(s) à verser cette semaine']); }
    ['entreprises', 'thaneries'].forEach(p => { if (niv(p) >= 2 && S.d.etablissements) { const n = S.d.etablissements.filter(e => e.actif === '1' && (e.categorie === 'thanerie') === (p === 'thaneries') && !etatEtab(e, sc).d).length; if (n) afaire.push([p, n + ' ' + (p === 'thaneries' ? 'thanerie(s)' : 'entreprise(s)') + ' sans déclaration cette semaine']); } });
    if (niv('citoyennete') >= 2 && S.d.citoyens) { const n = S.d.citoyens.filter(c => c.actif === '1' && etatCit(c).retard.length).length; if (n) afaire.push(['citoyennete', n + ' citoyen(s) en retard de paiement']); }
    $('page').innerHTML = entete('Bienvenue, ' + m.nom, 'Nous sommes le ' + esc(fmtJ(S.d.aujourdhui)) + ', ' + esc(fmtSem(sc)) + '.') +
      (chiffres.length ? '<div class="chiffres">' + chiffres.map(c => '<div class="chiffre' + (c[2] ? ' alerte' : '') + '"><b>' + esc(c[1]) + '</b><small>' + esc(c[0]) + '</small></div>').join('') + '</div>' : '') +
      '<div class="grille">' +
      '<div class="carte"><h3>Mon service</h3><p>' + badgeGrade(m.grade) + ' ' + badgeStatut(m.statut) + '</p>' +
        (g.garde ? '<p>Solde : <b>' + esc(fmtS(salaireDe(m))) + '</b> par semaine' + (num(m.prime) ? ' <small>(dont ' + esc(fmtS(m.prime)) + ' de prime)</small>' : '') + '<br>' + (paye ? '<span class="etat ok">✓ Payé cette semaine</span>' : '<span class="etat neutre">Pas encore payé cette semaine</span>') + '</p>' : '<p class="aide">Ce grade ne reçoit pas de solde de la garde.</p>') + '</div>' +
      '<div class="carte"><h3>Mes missions</h3>' + (mesMissions.length ? mesMissions.map(x => '<p>' + badge(STATUTS_MISSION[x.statut][0], STATUTS_MISSION[x.statut][1]) + ' <b>' + esc(x.titre) + '</b>' + (x.lieu ? ' <small>· ' + esc(x.lieu) + '</small>' : '') + (x.debut ? ' <small>· ' + esc(fmtJ(x.debut)) + '</small>' : '') + '</p>').join('') : vide('Aucune mission en cours pour vous.')) + '</div>' +
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
      (ms.length ? tableau([['Nom'], ['Grade'], ['Statut'], ['Solde / semaine', 'num'], ['Missions en cours', 'num'], ['', 'act']],
        ms.map(m => '<tr><td>' + esc(m.nom) + '</td><td>' + badgeGrade(m.grade) + '</td><td>' + badgeStatut(m.statut) + '</td><td class="num">' + (grade(m.grade).garde ? esc(fmtS(salaireDe(m))) + (num(m.prime) ? ' <small>(+' + esc(fmtS(m.prime)) + ')</small>' : '') : '<small>—</small>') + '</td><td class="num">' + enCours(m.id) + '</td><td class="act">' + (ed ? '<button class="btn petit" data-act="membre" data-id="' + esc(m.id) + '">Modifier</button>' : '') + '</td></tr>'),
        '<tr><td colspan="3">' + ms.length + ' membre(s)</td><td class="num">' + esc(fmtS(total)) + '</td><td colspan="2"></td></tr>') : vide('Aucun membre.'));
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
      (ms.length ? '<div class="grille">' + ms.map(x => '<div class="carte mission"><div class="tete"><h3>' + esc(x.titre) + '</h3>' + badge(STATUTS_MISSION[x.statut][0], STATUTS_MISSION[x.statut][1]) + '</div>' +
        '<div class="meta">' + [x.type, x.lieu, x.debut ? fmtJ(x.debut) + (x.fin && x.fin !== x.debut ? ' → ' + fmtJ(x.fin) : '') : ''].filter(Boolean).map(esc).join(' · ') + '</div>' +
        (x.membres.length ? '<div>' + x.membres.map(id => { const mb = membre(id); return mb ? badgeGrade(mb.grade).replace(esc(grade(mb.grade).nom), esc(mb.nom)) : ''; }).join(' ') + '</div>' : '<div class="meta">Personne d\'affecté.</div>') +
        (x.description ? '<p>' + esc(x.description) + '</p>' : '') + (x.compte_rendu ? '<div class="cr">📝 ' + esc(x.compte_rendu) + '</div>' : '') +
        (ed ? '<div><button class="btn petit" data-act="mission" data-id="' + esc(x.id) + '">Modifier</button></div>' : '') + '</div>').join('') + '</div>' : vide('Aucune mission.'));
  };
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
      const p = paiement('salaire', m.id, sem), s = statut(m.statut), mt = salaireDe(m);
      if (p) verse += num(p.montant); else if (s.paye && mt > 0) du += mt;
      const etat = p ? '<span class="etat ok">✓ Versé (' + esc(fmtS(p.montant)) + ')</span><br><small>par ' + esc(p.par) + ', ' + esc(p.le) + '</small>' : !s.paye ? '<span class="etat neutre">Non payé (' + esc(s.nom) + ')</span>' : mt > 0 ? '<span class="etat du">À verser</span>' : '<span class="etat neutre">Solde nul</span>';
      return '<tr><td>' + esc(m.nom) + '</td><td>' + badgeGrade(m.grade) + '</td><td>' + badgeStatut(m.statut) + '</td><td class="num">' + esc(fmtS(mt)) + '</td><td>' + etat + '</td><td class="act">' + (ed && !p && s.paye && mt > 0 ? '<button class="btn petit" data-act="payer" data-id="' + esc(m.id) + '">Verser</button>' : '') + '</td></tr>';
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
      return '<tr class="' + (e.actif === '1' ? '' : 'inactif') + '"><td><b>' + esc(e.nom) + '</b><br><small>' + esc([e.type, e.proprietaire].filter(Boolean).join(' · ') || '—') + '</small></td><td class="num">' + tx + ' %' + (e.taux === '' ? '<br><small>défaut</small>' : '') + '</td>' +
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
      return '<tr class="' + (h.actif === '1' ? '' : 'inactif') + '"><td><b>' + esc(h.nom) + '</b><br><small>' + esc(h.adresse || '—') + '</small></td><td>' + esc(h.occupant || '—') + '</td><td class="num">' + esc(fmtS(h.loyer)) + '</td>' +
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
    const cs = (S.d.citoyens || []).filter(c => (inactifs || c.actif === '1') && (!q || normal(c.nom + ' ' + c.note).indexOf(q) >= 0)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    let enRetard = 0, du = 0, semaineEnc = 0;
    const lignes = cs.map(c => {
      const e = etatCit(c), m = montantCit(c);
      if (e.retard.length) { enRetard++; du += e.retard.length * m; }
      const p = paiement('citoyennete', c.id, sc); if (p) semaineEnc += num(p.montant);
      const jusqu = e.jusqu ? (e.jusqu >= ajout(sc, 6) ? '<span class="etat ok">jusqu\'au ' + esc(fmtJ(e.jusqu)) + '</span>' : '<span class="etat ' + (e.retard.length ? 'retard' : 'du') + '">jusqu\'au ' + esc(fmtJ(e.jusqu)) + '</span>') : '<span class="etat ' + (e.retard.length ? 'retard' : 'du') + '">rien de payé</span>';
      return '<tr class="' + (c.actif === '1' ? '' : 'inactif') + '"><td><b>' + esc(c.nom) + '</b>' + (c.note ? '<br><small>' + esc(c.note) + '</small>' : '') + '</td><td class="num">' + esc(fmtS(m)) + (c.montant === '' ? '<br><small>défaut</small>' : '') + '</td><td>' + jusqu + '</td>' +
        '<td class="num">' + (e.retard.length ? '<span class="etat retard">' + e.retard.length + ' sem. (' + esc(fmtS(e.retard.length * m)) + ')</span>' : '<span class="etat ok">à jour</span>') + '</td>' +
        '<td class="act">' + (ed && c.actif === '1' ? '<button class="btn petit or" data-act="encCit" data-id="' + esc(c.id) + '">Encaisser</button>' : '') + (ed ? '<button class="btn petit" data-act="citoyen" data-id="' + esc(c.id) + '" title="Fiche">✎</button>' : '') + '</td></tr>';
    });
    $('page').innerHTML = entete('Citoyenneté', 'Chaque citoyen paie ' + esc(fmtS(S.d.reglages.citoyennete)) + ' par semaine (ou un montant propre). Un paiement peut couvrir plusieurs semaines, passées ou à venir : la colonne « Payé » indique jusqu\'à quand il est en règle.',
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
      (liste.length ? tableau([['Date'], ['Catégorie'], ['Libellé'], ['Montant', 'num'], ['Par'], ['', 'act']], liste.slice(0, 400).map(x => '<tr><td>' + esc(fmtJ(x.date)) + '<br><small>' + esc(fmtCourt(x.semaine)) + '</small></td><td>' + esc(x.categorie) + '</td><td>' + esc(x.libelle) + '</td><td class="num"><span class="etat ' + (x.sens === 'sortie' ? 'retard' : 'ok') + '">' + (x.sens === 'sortie' ? '− ' : '+ ') + esc(fmtS(x.montant)) + '</span></td><td><small>' + esc(x.par) + '</small></td><td class="act">' + (ed && x.ref ? '<button class="btn petit danger" data-act="annulerP" data-id="' + esc(x.ref) + '" title="Annuler ce paiement">Annuler</button>' : '') + '</td></tr>')) : vide('Aucun mouvement.'));
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
      else if (a === 'aller') { S.page = b.dataset.p; dessiner(); }
      else if (a === 'mdp') ouvrirMdp();
      else if (a === 'quitter') deconnecter('À bientôt.');
      else if (a === 'membre') ouvrirMembre(id);
      else if (a === 'mission') ouvrirMission(id);
      else if (a === 'payer') { const m = membre(id); if (confirm('Verser ' + fmtS(salaireDe(m)) + ' à ' + m.nom + ' (' + fmtSem(S.sem.salaires || semCour()) + ') ?')) { maj(await api('payerSalaires', { semaine: S.sem.salaires || semCour(), membres: [id] })); toast('Solde versé à ' + m.nom + '.'); } }
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
    if (t.dataset.f && t.tagName === 'SELECT') { S.f[t.dataset.f] = t.value; dessiner(); }
    else if (t.dataset.act === 'gardeTous') { S.f.gardeTous = t.checked; dessiner(); }
    else if (t.dataset.act === 'ttout') { S.f.ttout = t.checked; dessiner(); }
    else if (t.dataset.act === 'inactifs') { S.f[t.dataset.p + 'In'] = t.checked; dessiner(); }
  });

  // ---------- Démarrage ----------
  (async () => {
    if (!window.CONFIG || !window.CONFIG.api) { $('page').innerHTML = '<div class="chargement">Le serveur n\'est pas encore configuré : renseigne son adresse dans docs/config.js (voir le README).</div>'; return; }
    if (!S.jeton) { $('page').innerHTML = ''; ouvrirConnexion(); return; }
    try { await charger(); } catch (e) { if (S.jeton) deconnecter(msg(e)); }
  })();
})();
