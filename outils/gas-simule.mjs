// Imitation minimale des services Google Apps Script utilisés par Code.gs,
// pour faire tourner l'appli sur ton ordinateur (aperçu local). Les données vont dans .apercu/donnees.json.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

export function charger(fichierCode, fichierDonnees, proprietesInitiales = {}) {
  let etat = { feuilles: {}, ordre: [], props: { ...proprietesInitiales } };
  if (fs.existsSync(fichierDonnees)) etat = JSON.parse(fs.readFileSync(fichierDonnees, 'utf8'));
  const sauver = () => { fs.mkdirSync(path.dirname(fichierDonnees), { recursive: true }); fs.writeFileSync(fichierDonnees, JSON.stringify(etat)); };

  const feuille = nom => {
    const d = () => etat.feuilles[nom];
    const derniere = () => { const t = d(); let n = t.length; while (n > 0 && (t[n - 1] || []).every(v => v === '' || v == null)) n--; return n; };
    const f = {
      getName: () => nom,
      setName(n) { etat.feuilles[n] = etat.feuilles[nom]; delete etat.feuilles[nom]; etat.ordre[etat.ordre.indexOf(nom)] = n; nom = n; return f; },
      getLastRow: derniere,
      getLastColumn: () => Math.max(0, ...d().map(r => (r || []).length)),
      getMaxRows: () => Math.max(1000, d().length),
      setFrozenRows() { return f; },
      deleteRow(i) { d().splice(i - 1, 1); },
      deleteRows(i, n) { d().splice(i - 1, n); },
      appendRow(r) { d()[derniere()] = r.slice(); return f; },
      getDataRange() { return f.getRange(1, 1, Math.max(1, derniere()), Math.max(1, f.getLastColumn())); },
      getRange(r, c, nr = 1, nc = 1) {
        if (typeof r === 'string') throw new Error('Notation A1 non gérée par l\'aperçu : ' + r);
        const t = d();
        const P = {
          setNumberFormat: () => P, setNumberFormats: () => P, setFontWeight: () => P, setBackground: () => P, setFontColor: () => P,
          clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (t[r - 1 + i]) t[r - 1 + i][c - 1 + j] = ''; return P; },
          getValue() { const v = (t[r - 1] || [])[c - 1]; return v == null ? '' : v; },
          setValue(v) { t[r - 1] = t[r - 1] || []; t[r - 1][c - 1] = v; return P; },
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const l = []; for (let j = 0; j < nc; j++) { const v = (t[r - 1 + i] || [])[c - 1 + j]; l.push(v == null ? '' : v); } o.push(l); } return o; },
          setValues(v) { v.forEach((l, i) => { t[r - 1 + i] = t[r - 1 + i] || []; l.forEach((x, j) => { t[r - 1 + i][c - 1 + j] = x; }); }); return P; }
        };
        return P;
      }
    };
    return f;
  };
  const classeur = {
    getId: () => 'apercu-local', getUrl: () => 'file://' + fichierDonnees,
    getSheetByName: n => (etat.feuilles[n] ? feuille(n) : null),
    getSheets: () => etat.ordre.map(feuille),
    insertSheet(n) { etat.feuilles[n] = []; etat.ordre.push(n); return feuille(n); },
    deleteSheet(f) { const n = f.getName(); delete etat.feuilles[n]; etat.ordre = etat.ordre.filter(x => x !== n); }
  };
  const cache = {};
  const ctx = {
    console, JSON, Date, Math, Object, Array, String, Number, Boolean, Error, RegExp, Set, Map, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
    Logger: { log: (...a) => console.log('[Logger]', ...a) },
    SpreadsheetApp: {
      openById: () => classeur,
      create: () => { if (!etat.ordre.length) classeur.insertSheet('Feuille 1'); return classeur; },
      flush() {}
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => etat.props[k] ?? null, setProperty: (k, v) => { etat.props[k] = String(v); }, deleteProperty: k => { delete etat.props[k]; },
      getProperties: () => ({ ...etat.props })
    }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = cache[k]; return e && e.fin > Date.now() ? e.v : null; },
      put: (k, v, s = 600) => { cache[k] = { v: String(v), fin: Date.now() + s * 1000 }; },
      remove: k => { delete cache[k]; }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algo, txt) => [...crypto.createHash(algo).update(String(txt), 'utf8').digest()].map(b => (b > 127 ? b - 256 : b)),
      base64Encode: o => Buffer.from(Array.isArray(o) ? o.map(b => b & 255) : String(o)).toString('base64'),
      base64EncodeWebSafe: o => Buffer.from(Array.isArray(o) ? o.map(b => b & 255) : String(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      formatDate(d, tz, f) {
        const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
          .formatToParts(d).map(x => [x.type, x.value]));
        return String(f).replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
      }
    },
    HtmlService: { XFrameOptionsMode: {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(fichierCode, 'utf8'), ctx, { filename: 'Code.gs' });
  return {
    appeler(fn, args) {
      if (typeof ctx[fn] !== 'function' || fn.endsWith('_')) throw new Error('Fonction serveur inconnue : ' + fn);
      try { return ctx[fn](...args); } finally { sauver(); }
    },
    /** Évalue une expression dans le contexte du serveur (ex. : 'traiter'). */
    contexte: ctx
  };
}
