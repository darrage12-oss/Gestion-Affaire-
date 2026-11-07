/* ==========================================================================
   LOGIQUE MÉTIER PRINCIPALE — GESTION AFFAIRE MT-BT (VERSION PRO)
   SRM Tanger-Tétouan-Al Hoceima — Direction Provinciale d'Ouezzane
   Préparateur de l'application : A. DARRAGE
   Fichier : js/app.js
   ========================================================================== */

"use strict";

/* ===== Utilitaires ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const fmt = (x, d = 2) => (x === '' || x == null || isNaN(x)) ? '' : Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fq = x => (x === '' || x == null) ? '' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dh = x => fmt(x) + ' DH';

let toastT;
function toast(m) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.hidden = true, 3400);
}

function fd(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d\d)-(\d\d)/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}

/* ===== Montant en toutes lettres (Dirhams) ===== */
function nfr(n) {
  const u = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
  const t = ['','','vingt','trente','quarante','cinquante','soixante'];
  function b100(n, fin) {
    if (n < 20) return u[n];
    if (n < 70) { const d = Math.floor(n / 10), r = n % 10; return t[d] + (r === 1 ? ' et un' : r ? '-' + u[r] : ''); }
    if (n < 80) { const r = n - 60; return 'soixante' + (r === 11 ? ' et onze' : '-' + u[r]); }
    const r = n - 80;
    if (r === 0) return 'quatre-vingt' + (fin ? 's' : '');
    return 'quatre-vingt-' + u[r < 20 ? r : r];
  }
  function b1000(n, fin) {
    if (n < 100) return b100(n, fin);
    const c = Math.floor(n / 100), r = n % 100;
    let s = c === 1 ? 'cent' : u[c] + ' cent';
    if (r === 0) return c > 1 && fin ? s + 's' : s;
    return s + ' ' + b100(r, fin);
  }
  if (n === 0) return 'zéro';
  const parts = [];
  const mil = Math.floor(n / 1e9), m = Math.floor(n % 1e9 / 1e6), k = Math.floor(n % 1e6 / 1e3), r = n % 1000;
  if (mil) parts.push(b1000(mil, false) + ' milliard' + (mil > 1 ? 's' : ''));
  if (m) parts.push(b1000(m, false) + ' million' + (m > 1 ? 's' : ''));
  if (k) parts.push((k === 1 ? '' : b1000(k, false) + ' ') + 'mille');
  if (r) parts.push(b1000(r, true));
  return parts.join(' ').trim();
}

function enLettres(x) {
  x = r2(x);
  const d = Math.floor(x), c = Math.round((x - d) * 100);
  let s = nfr(d);
  s = s.charAt(0).toUpperCase() + s.slice(1) + ' dirham' + (d > 1 ? 's' : '');
  if (c) s += ' et ' + nfr(c) + ' centime' + (c > 1 ? 's' : '');
  return s;
}

/* ===== Catalogue & Données (Série des Prix modifiable et sauvegardée de façon permanente) ===== */
const STORAGE_CAT_KEY = 'srm_tta_f_serie_prix_v6';

function getDefaultArtsFromCat() {
  return (CAT.arts || []).map((a, idx) => ({
    _uid: 'cat_' + idx + '_' + Math.random().toString(36).slice(2, 6),
    code: String(a[0] ?? ''),
    d: String(a[1] ?? ''),
    c: String(a[2] || 'F+M'),
    u: String(a[3] || 'U'),
    p: num(a[4]),
    cat: String(a[5] || 'BT'),
    d2: String(a[6] ?? a[1] ?? '')
  }));
}

let ARTS = getDefaultArtsFromCat();
const PRE_DEFAULT = (CAT.pre || []).map(a => ({ name: a[0], p: a[1] }));

function loadCatalogStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_CAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        ARTS = parsed.map((a, idx) => ({
          _uid: a._uid || ('cat_' + idx + '_' + Math.random().toString(36).slice(2, 6)),
          code: String(a.code ?? ''),
          d: String(a.d ?? ''),
          c: String(a.c || 'F+M'),
          u: String(a.u || 'U'),
          p: num(a.p),
          cat: String(a.cat || 'BT'),
          d2: String(a.d2 ?? a.d ?? '')
        }));
      }
    }
  } catch (e) {
    console.error('Erreur chargement Série des Prix:', e);
  }
}

function saveCatalogStorage(showToast = false) {
  try {
    // Nettoyer le cache de recherche _haystack pour prendre en compte toutes les modifications
    ARTS.forEach(a => { delete a._haystack; });
    const clean = ARTS.map(a => ({
      _uid: a._uid,
      code: String(a.code ?? '').trim(),
      d: String(a.d ?? '').trim(),
      c: String(a.c || 'F+M').trim(),
      u: String(a.u || 'U').trim(),
      p: num(a.p),
      cat: String(a.cat || 'BT').trim(),
      d2: String(a.d2 ?? a.d ?? '').trim()
    }));
    localStorage.setItem(STORAGE_CAT_KEY, JSON.stringify(clean));
    setStat('Série des Prix & Dossier enregistrés à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    if (showToast) {
      toast(`✅ Série des Prix enregistrée définitivement (${ARTS.length} articles)`);
    }
  } catch (e) {
    console.error('Erreur sauvegarde Série des Prix:', e);
    if (showToast) toast('Erreur lors de la sauvegarde de la Série des Prix');
  }
}
const PEINES = 'Peines et soins';

/* Natures de câbles standards demandées par l'utilisateur */
const CABLES_STANDARDS = {
  btar: [
    'Câble préassemblé 3x70+54,6 mm²',
    'Câble préassemblé 3x50+54,6 mm²'
  ],
  btst: [
    'Câble armé Alu U1000 ARVFV 3x240+95 mm²'
  ],
  mtar: [
    'câble Almelec 54,6 mm2',
    'câble Almelec-Acier 59,7 mm2',
    'câble Almelec 148 mm2',
    'câble Almelec acier 147,1 mm2'
  ],
  mtst: [
    'Câble isolé au PR USP 18/30 kV à champ radial en aluminium unipolaire 1x240 mm2 type S 26'
  ]
};

const CIV_OPTIONS = [
  'Monsieur le Gérant',
  'Monsieur le Directeur',
  'Monsieur',
  'Madame la Directrice',
  'Madame la Gérante',
  'Madame, Monsieur'
];

/* ===== État global & Dossiers ===== */
var plist = [];
var P = null; // Dossier courant
var tab = 'projet';
let docSub = 'bordfinal';
let mode = 'affaires'; // 'affaires' par défaut : sélection d'affaire avant d'entrer pour modifier
let saveT = null;
let catSearchQ = '', catFilterC = '';

const STATUTS = ['Brouillon', 'En étude', 'Validé DP', 'Transmis DCL', 'Validé DCL', 'Validé DG', 'Envoyé au client', 'Réglé', 'Travaux en cours', 'Clôturé', 'Annulé'];
const ETAPES = [
  ['dpDate', 'Validation DP'],
  ['dclTransmis', 'Transmission DCL'],
  ['dclDate', 'Validation DCL'],
  ['dgDate', 'Validation DG'],
  ['dateReglement', 'Règlement du client']
];

/* Dossier vierge */
function blankP(name) {
  return {
    id: uid(),
    name: name || 'Nouveau dossier',
    upd: Date.now(),
    tva: 20,
    peines: 20,
    info: {
      demande: '',
      contrat: '',
      devis: '',
      objet: '',
      commune: '',
      province: 'Ouezzane',
      village: '',
      date: new Date().toISOString().slice(0, 10),
      destinataire: '',
      adresseCorresp: '',
      puissance: '',
      metier: 'BT',
      typeAff: 'MT/BT', // 'MT', 'BT', 'MT/BT'
      origine: '',
      dateDemande: '',
      num: 'SET/DPO/100/' + new Date().getFullYear(),
      refAffaire: 'SET/DPO/100/' + new Date().getFullYear(),
      statut: 'En étude',
      // Options Lotissement demandées par l'utilisateur
      mtSite: 'In-Site', // 'In-Site' ou 'Hors-Site'
      mtPose: 'Aérien',   // 'Aérien' ou 'Souterrain'
      btPose: 'Aérien',   // 'Aérien' ou 'Souterrain'
      // Données techniques
      zone: 'Rurale',
      natProjet: 'Morcellement/Lotissement',
      terrain: 'Emprise de voie publique',
      origineType: 'Aérien',
      supportOrigine: '',
      poste: '',
      messageClient: '',
      btarL: '',
      btarCab: CABLES_STANDARDS.btar[0],
      btstL: '',
      btstCab: CABLES_STANDARDS.btst[0],
      mtarL: '',
      mtarCab: CABLES_STANDARDS.mtar[0],
      mtstL: '',
      mtstCab: CABLES_STANDARDS.mtst[0],
      indications: '',
      matriculePoste: '',
      situationProjet: 'Ouezzane',
      participation: 'X',
      benef: 'X',
      refReglement: '.',
      dpDate: '',
      dclTransmis: '',
      dclDate: '',
      dgDate: '',
      dateReglement: ''
    },
    // Bordereau structuré en 3 Lots (Lotissement) :
    // lot: 'lot1' (MT), 'lot2' (Poste Transfo), 'lot3' (BT)
    bord: [],
    // Prestations
    prest: {
      [PEINES]: { on: true },
      'Raccordement MT/BT': { on: true, qty: 1 }
    },
    customPre: [],
    customArts: [],
    doc: {
      ville: 'Ouezzane',
      dateLettre: '',
      showLogo: false, // User: "et sans logo"
      signataireMode: 'auto',
      signataireCustom: '',
      validateur: 'Préparée et validée',
      civilite: 'Monsieur le Gérant',
      delai: 'six (06) mois',
      nRef: '…………../ DC/DG',
      natureTravaux: '',
      reglement: '',
      fraisRoute: 0,
      partTiers: 0
    }
  };
}

/* Dossier d'exemple initial */
function exampleP() {
  const p = blankP('Étude Lotissement · Ouezzane');
  p.example = true;
  p.info.num = 'SET/DPO/100/2026';
  p.info.refAffaire = 'SET/DPO/100/2026';
  p.info.demande = '46247';
  p.info.contrat = '5029470';
  p.info.devis = '552828';
  p.info.objet = "Électrification du Lotissement (Ligne MT In-Site, Poste H61 et Réseau BT)";
  p.info.commune = 'Beni Qolla';
  p.info.province = 'Ouezzane';
  p.info.village = 'Oulad LHAJ';
  p.info.destinataire = "Sté Compagnie Publique d'Aménagement et Investissement";
  p.info.adresseCorresp = "Ouezzane Centre";
  p.info.origine = "PT LAADIR 7248-02-B";
  p.info.poste = "PT LAADIR 7248-02-B";
  p.info.supportOrigine = "Support BA N° 12";
  p.info.dateDemande = '2026-08-06';
  p.info.typeAff = 'MT/BT';
  p.info.mtSite = 'In-Site';
  p.info.mtPose = 'Aérien';
  p.info.btPose = 'Aérien';
  p.info.mtarL = '300';
  p.info.mtarCab = 'câble Almelec 54,6 mm2';
  p.info.btarL = '250';
  p.info.btarCab = 'Câble préassemblé 3x70+54,6 mm²';
  p.doc.ville = 'Ouezzane';
  p.doc.civilite = 'Monsieur le Gérant';
  p.doc.showLogo = false;
  
  // Articles d'exemple
  p.bord = [
    // 1. Ligne MT (In-Site)
    { key: 'b1', lot: 'lot1', code: '02-02-23', d: 'Poteau béton arme classe B 10,50 m 500 daN', c: 'F+M', u: 'U', q: 3, pu: 2520, on: true },
    { key: 'b2', lot: 'lot1', code: '15-00-07', d: 'Fourniture câble Almelec 54,6 mm2', c: 'F', u: 'Kg', q: 300, pu: 42, on: true },
    { key: 'b3', lot: 'lot1', code: '15-01-07', d: "Transport, déroulage, réglage du conducteur almelec 54,6 mm2", c: 'M', u: 'Km-Unif', q: 0.9, pu: 4750, on: true },
    
    // 2. Poste de Transformation
    { key: 'b4', lot: 'lot2', code: '60-02-01', d: 'Génie civil poste de transformation aérien type H61 sur poteau béton armé', c: 'F+M', u: 'U', q: 1, pu: 7900, on: true },
    { key: 'b5', lot: 'lot2', code: '61-02-01', d: 'Equipement et montage poste type H61 24 kV triphasé + basse tension', c: 'F+M', u: 'U', q: 1, pu: 28000, on: true },
    { key: 'b6', lot: 'lot2', code: '70-00-25', d: 'Transformateur de puissance triphasé type extérieur 50 kVA', c: 'F', u: 'U', q: 1, pu: 32000, on: true },
    
    // 3. Réseau Basse Tension
    { key: 'b7', lot: 'lot3', code: '02-02-03', d: 'Poteau béton armé classe A 8 m 500 daN', c: 'F+M', u: 'U', q: 4, pu: 1480, on: true },
    { key: 'b8', lot: 'lot3', code: '34-00-09', d: 'Câble isolé préassemblé en aluminium avec neutre porteur en Almelec 3x70 Alu + 54,6 Alm', c: 'F', u: 'm', q: 250, pu: 33, on: true },
    { key: 'b9', lot: 'lot3', code: '34-01-04', d: 'Pose sans accessoires câble isolé triphasé préassemblé en aluminium', c: 'M', u: 'm', q: 250, pu: 4, on: true },
    { key: 'b10', lot: 'lot3', code: '20-02-01', d: 'Terre de réseau', c: 'F+M', u: 'U', q: 2, pu: 650, on: true }
  ];
  return p;
}

/* ===== Gestion LocalStorage ===== */
const STORAGE_KEY = 'srm_tta_etudes_lignes_pro_db';

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length) {
        plist = data;
        sortPlistByOrder();
        return;
      }
    }
  } catch (e) {
    console.error("Erreur chargement storage", e);
  }
  const ex = exampleP();
  plist = [{ id: ex.id, name: ex.name, upd: ex.upd, data: ex }];
  saveStorage();
  // Actualiser automatiquement toutes les affaires au démarrage pour séparer les longueurs aérien / souterrain
  try {
    actualiserToutesLesAffaires(false);
  } catch(e) {}
}

function saveStorage() {
  try {
    sortPlistByOrder();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plist));
    setStat('Enregistré localement à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    setStat('Erreur enregistrement');
  }
}

function touch() {
  if (!P) return;
  P.upd = Date.now();
  if (P.info && P.info.objet && P.info.objet.trim()) {
    P.name = P.info.objet.trim();
  }
  const idx = plist.findIndex(x => x.id === P.id);
  if (idx >= 0) {
    plist[idx] = { id: P.id, name: P.name, upd: P.upd, data: JSON.parse(JSON.stringify(P)) };
  } else {
    plist.unshift({ id: P.id, name: P.name, upd: P.upd, data: JSON.parse(JSON.stringify(P)) });
  }
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    saveStorage();
    renderList();
  }, 400);
}

/* ===== Fonctions N° d'Affaire SET/DPO/[N]/[Année] ===== */
function parseAffaireNum(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Analyse ex: SET/DPO/100/2026, SET/OU/100/2026, 100/2026, SET/DPO/101
  const m = s.match(/(?:S?ET\/(?:DPO|OU)\/)?(\d+)(?:\/(\d{4}))?/i);
  if (m && m[1]) {
    return {
      num: parseInt(m[1], 10),
      year: m[2] ? parseInt(m[2], 10) : new Date().getFullYear()
    };
  }
  return null;
}

const MOIS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function extractStudyDateInfo(info, upd) {
  info = info || {};
  const raw = String(info.date || '').trim();
  let y = '', m = '', d = '';
  // Format YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  // Format DD/MM/YYYY
  const fr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (iso) {
    y = iso[1]; m = iso[2]; d = iso[3];
  } else if (fr) {
    d = fr[1]; m = fr[2]; y = fr[3];
  } else {
    const parsedNum = parseAffaireNum(info.num || info.refAffaire);
    if (upd) {
      const dt = new Date(upd);
      if (!isNaN(dt.getTime())) {
        y = String(parsedNum ? parsedNum.year : dt.getFullYear());
        m = String(dt.getMonth() + 1).padStart(2, '0');
        d = String(dt.getDate()).padStart(2, '0');
      }
    }
    if (!y && parsedNum) {
      y = String(parsedNum.year);
    }
  }
  const mNum = m ? parseInt(m, 10) : 0;
  const mName = (mNum >= 1 && mNum <= 12) ? MOIS_FR[mNum] : 'Non défini';
  const displayDate = (d && m && y) ? `${d}/${m}/${y}` : (raw || '—');
  const myKey = (y && m) ? `${y}-${m}` : (y ? `${y}-00` : '0000-00');
  const myLabel = (y && mNum) ? `${mName} ${y}` : (y ? `Année ${y}` : 'Date non renseignée');
  return {
    year: y || '',
    month: m || '',
    monthNum: mNum,
    monthName: mName,
    displayDate,
    myKey,
    myLabel
  };
}

function compareAffairesByOrder(a, b, dir = 'desc') {
  const da = (a && a.data) ? a.data : (a || {});
  const db = (b && b.data) ? b.data : (b || {});
  const ia = da.info || a.i || {};
  const ib = db.info || b.i || {};
  const pa = parseAffaireNum(ia.num || ia.refAffaire);
  const pb = parseAffaireNum(ib.num || ib.refAffaire);
  if (pa && !pb) return -1;
  if (!pa && pb) return 1;
  let diff = 0;
  if (pa && pb) {
    diff = (pa.year - pb.year) || (pa.num - pb.num);
  }
  if (diff === 0) {
    diff = String(ia.num || '').localeCompare(String(ib.num || ''));
  }
  return dir === 'asc' ? diff : -diff;
}

function sortPlistByOrder() {
  if (Array.isArray(plist)) {
    plist.sort((a, b) => compareAffairesByOrder(a, b, 'desc'));
  }
}

function getNextAffaireNum(targetYear) {
  const y = targetYear || new Date().getFullYear();
  let maxNum = 99; // Valeur de départ : si aucune affaire, la première sera 100 !
  const list = Array.isArray(plist) ? plist : [];
  list.forEach(item => {
    const pData = item.data || item;
    const numStr = (pData.info && (pData.info.num || pData.info.refAffaire)) || '';
    const parsed = parseAffaireNum(numStr);
    if (parsed) {
      if (parsed.year === y && parsed.num > maxNum) {
        maxNum = parsed.num;
      }
    }
  });
  if (P && P.info && (P.info.num || P.info.refAffaire)) {
    const parsed = parseAffaireNum(P.info.num || P.info.refAffaire);
    if (parsed && parsed.year === y && parsed.num > maxNum) {
      maxNum = parsed.num;
    }
  }
  const next = maxNum + 1;
  return {
    num: next,
    year: y,
    formatted: `SET/DPO/${next}/${y}`
  };
}

function setStat(t) {
  const e = $('#dbstat');
  if (e) e.textContent = t;
}

/* ===== Catalogue helpers ===== */
function allArts() {
  return ARTS.map((x, idx) => {
    if (!x._uid) x._uid = 'cat_' + idx + '_' + uid();
    x._id = x._uid;
    x._realIdx = idx;
    return x;
  });
}

/* ===== Insertion d'un article dans le Bordereau à sa position selon l'ordre de la Série des Prix ===== */
function catalogRankOfLine(l) {
  if (!l) return -1;
  const code = String(l.code || '').trim();
  const d = String(l.d || '').trim();
  const isRealCode = code && code !== '—' && !/^F\d+$/i.test(code);
  let idx = -1;
  if (isRealCode) idx = ARTS.findIndex(a => String(a.code || '').trim() === code && String(a.d || '').trim() === d);
  if (idx < 0 && isRealCode) idx = ARTS.findIndex(a => String(a.code || '').trim() === code);
  if (idx < 0 && d) idx = ARTS.findIndex(a => String(a.d || '').trim() === d);
  return idx;
}

function insertBordByCatalogOrder(line) {
  P.bord = P.bord || [];
  const rank = catalogRankOfLine(line);
  if (rank < 0) { P.bord.push(line); return; }
  // Insérer avant le premier article du Bordereau situé plus bas dans la Série des Prix
  let pos = P.bord.length;
  for (let k = 0; k < P.bord.length; k++) {
    const r = catalogRankOfLine(P.bord[k]);
    if (r > rank) { pos = k; break; }
  }
  P.bord.splice(pos, 0, line);
}

function artByCode(idOrCode) {
  if (!idOrCode) return null;
  const all = allArts();
  return all.find(a => a._id === idOrCode || a._uid === idOrCode || (a.code && a.code === idOrCode)) || null;
}

/* Détection automatique du lot approprié selon le code et la désignation d'article */
function detectLot(code, d) {
  const c = String(code || '').trim();
  const dl = String(d || '').toLowerCase();
  if (/^(60|61|62|63|64|65|70)/.test(c)) return 'lot2'; // Poste de transformation
  if (/^(01|08-02-0[5-9]|08-02-1[0-4]|10|11|12|13|15|16|34-00-0[1-3]|34-01-0[1-3]|35-|40-00-0[1-5]|40-01-0[1-5]|41-)/.test(c)) return 'lot1'; // MT
  if (dl.includes('18/30 kv') || dl.includes('15/25 kv') || (dl.includes('almelec') && !dl.includes('préassemblé') && !dl.includes('preassemble'))) return 'lot1';
  return 'lot3'; // BT par défaut
}

/* ===== Détection & Synchronisation Automatique des Câbles et Longueurs depuis le Bordereau ===== */
function cleanCableName(d) {
  let s = String(d || '').trim();
  s = s.replace(/^Fourniture\s+du\s+/i, '')
       .replace(/^Fourniture\s+/i, '')
       .replace(/^Pose\s+sans\s+accessoires\s+/i, '')
       .replace(/^Pose\s+/i, '')
       .replace(/^Transport[,\s]+déroulage[,\s]+réglage.*?\bdu\s+conducteur\s+/i, 'câble ')
       .replace(/^Déroulage\s+tirage\s+réglage.*?,?\s*/i, '')
       .replace(/\s*\(\s*zone\s+givrable\s*\)/gi, '');
  return s.trim();
}

function classifyCableArticle(item) {
  if (!item) return null;
  const code = String(item.code || '').trim();
  const d = String(item.d || '').trim();
  const dl = d.toLowerCase();
  const cons = String(item.c || '').toUpperCase().trim();
  const u = String(item.u || '').toLowerCase().trim();

  const exclude = [
    'dépose', 'depose', 'transfèrement', 'transferement', 'pince', 'manchon',
    'boite', 'boîte', 'coffret', 'vérine', 'verine', 'ferrure', 'collier',
    'connecteur', 'raccord', 'cellule', 'dispositif', 'accessoire', 'console',
    'scellement', 'fil de garde', 'sphère', 'sphere', 'tranchée', 'tranchee',
    'buse', 'grille', 'terre', 'poteau', 'pylône', 'pylone', 'armement',
    'isolateur', 'interrupteur', 'parafoudre', 'transformateur', 'branchement',
    'réalisation', 'realisation', 'aménagement', 'amenagement'
  ];
  if (exclude.some(w => dl.includes(w))) return null;

  const include = [
    'câble', 'cable', 'conducteur', 'almelec', 'préassemblé', 'preassemble',
    'unipolaire', 'torsadé', 'torsade', 'rvfv', 'arvfv', 'r02v', 'ro2v', 'vinysol'
  ];
  if (!include.some(w => dl.includes(w))) return null;

  const isPose = (cons === 'M') || /^(pose|transport|déroulage|deroulage|tirage)\b/i.test(d);
  const isPreass = dl.includes('préassemblé') || dl.includes('preassemble');

  let net = 'BT';
  let pose = 'Aérien';
  let lot = item.lot || 'lot3';
  let strong = true;

  if (dl.includes('18/30') || dl.includes('s 26') || dl.includes('s26') || (dl.includes('15/25') && dl.includes('champ radial')) || /^40-0[01]-0[1-5]/.test(code) || /^34-00-0[12]/.test(code)) {
    net = 'MT';
    pose = 'Souterrain';
  } else if (/^15-0[01]/.test(code) || (dl.includes('15/25') && dl.includes('porteur')) || (dl.includes('almelec') && !isPreass)) {
    net = 'MT';
    pose = 'Aérien';
  } else if (isPreass || dl.includes('torsadé') || dl.includes('torsade')) {
    net = 'BT';
    pose = 'Aérien';
  } else if (['u1000', 'u 1000', 'r02v', 'ro2v', 'rvfv', 'arvfv', 'vinysol', 'armé', 'arme'].some(w => dl.includes(w)) || /^40-/.test(code)) {
    net = 'BT';
    pose = 'Souterrain';
  } else {
    strong = false;
    if (item.lot === 'lot1' || item.lot === 'lot1_hs' || item.lot === 'lot1_is') {
      net = 'MT';
      pose = (u === 'm' && dl.includes('isolé') && !dl.includes('porteur')) ? 'Souterrain' : 'Aérien';
    }
  }

  if (item.ouvrage) {
    if (item.ouvrage === 'Réseau MT Aérien') { net = 'MT'; pose = 'Aérien'; lot = 'lot1'; strong = true; }
    else if (item.ouvrage === 'Réseau MT Souterrain') { net = 'MT'; pose = 'Souterrain'; lot = 'lot1'; strong = true; }
    else if (item.ouvrage === 'Réseau BT Aérien') { net = 'BT'; pose = 'Aérien'; lot = 'lot3'; strong = true; }
    else if (item.ouvrage === 'Réseau BT Souterrain') { net = 'BT'; pose = 'Souterrain'; lot = 'lot3'; strong = true; }
  }

  if (!strong) {
    if (item.lot === 'lot1' || item.lot === 'lot1_hs' || item.lot === 'lot1_is') net = 'MT';
    else if (item.lot === 'lot3') net = 'BT';
  }

  lot = item.lot || (net === 'MT' ? 'lot1' : 'lot3');
  if (net === 'MT' && !/^lot1/.test(lot)) lot = 'lot1';
  if (net === 'BT' && /^lot1/.test(lot)) lot = 'lot3';

  return {
    net,
    pose,
    isPose,
    cleanName: cleanCableName(d),
    rawName: d,
    q: num(item.q),
    u: item.u || 'm',
    lot,
    ouvrage: item.ouvrage || ('Réseau ' + net + ' ' + pose)
  };
}

/* Section d'un conducteur nu Almelec / Almelec-acier (148, 54.6, 59.7, 147.1, 75.5 mm²) ou null */
function bareConductorSection(c) {
  const dl = smartNorm((c && (c.rawName || c.cleanName || c.d)) || c || '');
  if (dl.includes('preassemble') || dl.includes('torsade') || dl.includes('18/30') || dl.includes('15/25')) return null;
  if (!dl.includes('almelec')) return null;
  const m = dl.match(/(147\.1|148|54\.6|59\.7|75\.5|93\.3|228)/);
  return m ? m[1] : 'alm';
}

function isMtBareAerialConductor(itemOrDesc) {
  return !!bareConductorSection(itemOrDesc);
}

/* Câbles comptés en 3 longueurs unifilaires (unipolaire 1x240 MT, ARVFV 3x240+95 BT) -> longueur / 3 */
function isDividedBy3Cable(c) {
  const dl = smartNorm((c && (c.rawName || c.cleanName)) || '');
  return (dl.includes('unipolaire') || dl.includes('1x240')) && !dl.includes('arvfv');
}

/* Clé d'un type de câble pour associer Fourniture + Pose/Déroulage du même câble */
function cableTypeKey(c) {
  const sec = bareConductorSection(c);
  if (sec) return 'alm:' + sec;
  return smartNorm(c.cleanName || c.rawName || '').replace(/\s+/g, ' ').trim();
}

/* Longueur d'un type de câble (en m) selon les règles SRM-TTA */
function computeCableTypeLength(list) {
  const fourn = list.filter(c => !c.isPose && c.q > 0);
  const poses = list.filter(c => c.isPose && c.q > 0);
  const sumQ = arr => arr.reduce((s, c) => s + num(c.q), 0);

  if (bareConductorSection(list[0])) {
    // Conducteurs nus aériens MT : Q (Km-Unif) x 1000 / 3
    const der = poses[0];
    if (der) {
      const u = String(der.u || '').toLowerCase();
      const q = sumQ(poses);
      if (u.includes('km')) return r2(q * 1000 / 3);
      return r2(q / 3);
    }
    if (fourn.length) {
      const f = fourn[0];
      const u = String(f.u || '').toLowerCase();
      const q = sumQ(fourn);
      if (u === 'kg') {
        const sec = bareConductorSection(f);
        const kgPerM3 = { '148': 1.26, '54.6': 0.45, '59.7': 0.60, '147.1': 1.50, '75.5': 0.63 }[sec] || 1.26;
        return r2(q / kgPerM3);
      }
      if (u.includes('km')) return r2(q * 1000 / 3);
      return r2(q / 3);
    }
    return 0;
  }

  const base = fourn.length ? sumQ(fourn) : sumQ(poses);
  if (isDividedBy3Cable(list[0])) return r2(base / 3);
  return r2(base);
}

/* Nom affiché du câble : en priorité celui de l'article de fourniture */
function cableTypeName(list) {
  const f = list.find(c => !c.isPose) || list[0];
  let n = String(f.cleanName || f.rawName || '').trim();
  n = cleanCableName(n);
  if (bareConductorSection(f) && !/^c[âa]ble/i.test(n)) n = 'câble ' + n;
  n = n.replace(/\balmelec[-\s]+acier\b/gi, 'Almelec -Acier');
  n = n.replace(/\balmelec\b/gi, 'Almelec');
  n = n.replace(/\s*\(\s*zone\s+givrable\s*\)/gi, '');
  return n.trim();
}

/* Détail par type de câble : [{ cab, len, pose, net, lot }] */
function cableTypeDetails(cables) {
  const groups = [];
  const byKey = {};
  (cables || []).forEach(c => {
    const k = (c.ouvrage || (c.net + '|' + c.pose)) + '|' + cableTypeKey(c);
    if (!byKey[k]) { byKey[k] = []; groups.push(byKey[k]); }
    byKey[k].push(c);
  });
  return groups.map(g => ({
    cab: cableTypeName(g),
    len: computeCableTypeLength(g),
    pose: g[0].pose,
    net: g[0].net,
    lot: g[0].lot,
    ouvrage: g[0].ouvrage || ('Réseau ' + g[0].net + ' ' + g[0].pose)
  })).filter(x => x.len > 0);
}

function summarizeCableGroup(cables) {
  if (!cables || !cables.length) return null;
  const det = cableTypeDetails(cables);
  if (!det.length) return null;
  return {
    pose: det[det.length - 1].pose,
    cab: det.map(x => x.cab).join(' + '),
    len: r2(det.reduce((s, x) => s + x.len, 0)),
    details: det
  };
}

/* Câbles actifs du Bordereau, classés */
function getActiveBordCables(targetP) {
  const curP = targetP || P;
  if (!curP || !Array.isArray(curP.bord)) return [];
  return curP.bord
    .filter(l => l && l.on !== false && num(l.q) > 0)
    .map(l => classifyCableArticle(l))
    .filter(Boolean);
}

/* Synchronisation et séparation stricte des câbles aériens et souterrains pour une affaire */
function syncCablesForAffaire(targetP) {
  const curP = targetP || P;
  if (!curP || !curP.info || !Array.isArray(curP.bord)) return;
  const i = curP.info;
  const activeCables = curP.bord
    .filter(l => l && l.on !== false && num(l.q) > 0)
    .map(l => classifyCableArticle(l))
    .filter(Boolean);

  if (!activeCables.length) return;

  // 1. Synchronisation BT avec séparation stricte Aérien / Souterrain
  const btCables = activeCables.filter(c => c.net === 'BT');
  if (btCables.length) {
    const btAr = btCables.filter(c => c.pose === 'Aérien');
    const btSt = btCables.filter(c => c.pose === 'Souterrain');

    if (btAr.length && btSt.length) {
      i.btPose = 'Aérien et Souterrain';
      const sumAr = summarizeCableGroup(btAr);
      const sumSt = summarizeCableGroup(btSt);
      if (sumAr) { i.btarCab = sumAr.cab; i.btarL = String(sumAr.len); }
      if (sumSt) { i.btstCab = sumSt.cab; i.btstL = String(sumSt.len); }
      i.btL = String(r2(num(i.btarL) + num(i.btstL)));
    } else if (btSt.length) {
      i.btPose = 'Souterrain';
      const sumSt = summarizeCableGroup(btSt);
      if (sumSt) { i.btstCab = sumSt.cab; i.btstL = String(sumSt.len); }
      i.btL = i.btstL;
    } else if (btAr.length) {
      i.btPose = 'Aérien';
      const sumAr = summarizeCableGroup(btAr);
      if (sumAr) { i.btarCab = sumAr.cab; i.btarL = String(sumAr.len); }
      i.btL = i.btarL;
    }
  }

  // 2. Synchronisation MT avec séparation stricte Aérien / Souterrain
  const mtCables = activeCables.filter(c => c.net === 'MT');
  if (mtCables.length) {
    if (i.mtSite === 'Les Deux') {
      const hsCables = mtCables.filter(c => c.lot === 'lot1_hs' || c.lot === 'lot1');
      const isCables = mtCables.filter(c => c.lot === 'lot1_is');
      const hsSum = summarizeCableGroup(hsCables);
      if (hsSum) {
        i.mtHsPose = hsSum.pose;
        i.mtHsCab = hsSum.cab;
        i.mtHsL = String(hsSum.len);
      }
      const isSum = summarizeCableGroup(isCables);
      if (isSum) {
        i.mtIsPose = isSum.pose;
        i.mtIsCab = isSum.cab;
        i.mtIsL = String(isSum.len);
      }
    } else {
      const mtAr = mtCables.filter(c => c.pose === 'Aérien');
      const mtSt = mtCables.filter(c => c.pose === 'Souterrain');

      if (mtAr.length && mtSt.length) {
        i.mtPose = 'Aérien et Souterrain';
        const sumAr = summarizeCableGroup(mtAr);
        const sumSt = summarizeCableGroup(mtSt);
        if (sumAr) { i.mtarCab = sumAr.cab; i.mtarL = String(sumAr.len); }
        if (sumSt) { i.mtstCab = sumSt.cab; i.mtstL = String(sumSt.len); }
        i.mtL = String(r2(num(i.mtarL) + num(i.mtstL)));
      } else if (mtSt.length) {
        i.mtPose = 'Souterrain';
        const sumSt = summarizeCableGroup(mtSt);
        if (sumSt) { i.mtstCab = sumSt.cab; i.mtstL = String(sumSt.len); }
        i.mtL = i.mtstL;
      } else if (mtAr.length) {
        i.mtPose = 'Aérien';
        const sumAr = summarizeCableGroup(mtAr);
        if (sumAr) { i.mtarCab = sumAr.cab; i.mtarL = String(sumAr.len); }
        i.mtL = i.mtarL;
      }
    }
  }
}

function syncCablesFromBord() {
  syncCablesForAffaire(P);
}

/* Actualisation totale de toutes les affaires de la base de données */
function actualiserToutesLesAffaires(showToast = true) {
  if (Array.isArray(plist)) {
    plist.forEach(item => {
      const pData = item.data || item;
      if (pData && pData.info) {
        syncCablesForAffaire(pData);
        item.upd = pData.upd = Date.now();
      }
    });
  }
  if (P && P.info) {
    syncCablesForAffaire(P);
    P.upd = Date.now();
  }
  saveStorage();
  renderList();
  if (mode === 'affaires') {
    renderAffaires();
  } else if (P && P.info) {
    render();
  }
  if (showToast) {
    toast(`✅ Actualisation totale terminée : câbles, longueurs et consistances mis à jour sur toutes les affaires`);
  }
}


/* ===== Recherche Intelligente (Insensible aux accents, casse, pluriels, symboles) & Filtre Intelligent ===== */
const FAMILLES_INTELLIGENTES = [
  ['ALL', '📂 Toutes les familles d’ouvrages'],
  ['CABLES', '🔌 Câbles & Conducteurs (MT / BT)'],
  ['SUPPORTS', '🪵 Poteaux, Pylônes & Supports'],
  ['ARMEMENTS', '⚙️ Armements, Consoles & Isolateurs'],
  ['APP_MT', '⚡ Appareillage MT (IACM, IAT, Parafoudres)'],
  ['ACC_COFFRETS', '🧰 Accessoires, Boîtes, Jonctions & Coffrets'],
  ['GC_TRANCHEES', '🧱 Massifs, Génie Civil, Tranchées & Tubes'],
  ['POSTES_CELLULES', '🏢 Postes de Transformation & Cellules'],
  ['TRANSFOS', '🔋 Transformateurs de Puissance'],
  ['EP', '💡 Éclairage Public (Luminaires & Candélabres)'],
  ['ETUDES_BRANCH', '📐 Études, Topo, Terres & Branchements'],
  ['DEPOSE', '🔄 Déposes, Démolitions & Transfèrements']
];

function smartNorm(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime tous les accents (Câble -> cable, préassemblé -> preassemble, béton -> beton)
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/,/g, '.')
    .replace(/(\d)\s*[x*]\s*(\d)/gi, '$1x$2')
    .toLowerCase()
    .trim();
}

function smartTokenize(q) {
  const n = smartNorm(q);
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean).map(tok => {
    // Tolérance au pluriel (ex: "cables" -> "cable", "poteaux" -> "poteau")
    if (tok.length > 4 && tok.endsWith('aux')) return tok.slice(0, -1); // poteaux -> poteau
    if (tok.length > 3 && tok.endsWith('s') && !tok.endsWith('us') && !tok.endsWith('is')) return tok.slice(0, -1);
    return tok;
  });
}

function detectArticleFamily(a) {
  const c = String(a.code || '').trim();
  const dl = smartNorm(a.d || '');
  const cat = String(a.cat || '').toUpperCase().trim();

  // 1. Déposes & Transfèrements
  if (dl.startsWith('depose') || dl.startsWith('transferement') || dl.startsWith('destruction') || dl.startsWith('demolition') || /^\d\d-0[346]-/.test(c)) {
    return 'DEPOSE';
  }
  // 2. Transformateurs
  if (cat === 'TR' || /^70-/.test(c) || dl.includes('transformateur de puissance') || dl.includes('pose transformateur')) {
    return 'TRANSFOS';
  }
  // 3. Postes & Cellules
  if (/^(60|61|62|63|64|65|67)-/.test(c) || cat.startsWith('EQ') || cat === 'AMG' || dl.includes('cellule') || dl.includes('poste de transformation') || dl.includes('pt cabine') || dl.includes('poste asservi')) {
    return 'POSTES_CELLULES';
  }
  // 4. Éclairage Public
  if (cat === 'EP' || /^(21|22|23|24)-/.test(c) || dl.includes('eclairage public') || dl.includes('candelabre') || dl.includes('luminaire') || dl.includes('hublot')) {
    return 'EP';
  }
  // 5. Câbles & Conducteurs
  if (classifyCableArticle(a)) {
    return 'CABLES';
  }
  // 6. Poteaux, Pylônes & Supports
  if (/^(01|02|04|05|06|37)-/.test(c) || dl.includes('poteau') || dl.includes('pylone') || dl.includes('potelet') || dl.includes('contrefichage') || dl.includes('jumelage')) {
    return 'SUPPORTS';
  }
  // 7. Armements, Consoles & Isolateurs
  if (/^(08|09|12|13|14)-/.test(c) || dl.includes('armement') || dl.includes('console') || dl.includes('isolateur') || dl.includes('contrepoids') || dl.includes('pince d') || dl.includes('manchon d')) {
    return 'ARMEMENTS';
  }
  // 8. Appareillage MT (IACM, IAT, Parafoudres, Localisateurs)
  if (/^(10|11|16)-/.test(c) || dl.includes('iacm') || dl.includes('iact') || dl.includes('iat') || dl.includes('parafoudre') || dl.includes('eclateur') || dl.includes('reenclencheur') || dl.includes('reenclancheur') || dl.includes('localisateur de defaut')) {
    return 'APP_MT';
  }
  // 9. Massifs, Génie Civil, Tranchées, Fourreaux & Tubes
  if (/^(03|47|48|49|50|51|52|53)-/.test(c) || dl.includes('massif') || dl.includes('tranchee') || dl.includes('tuyau') || dl.includes('tube annele') || dl.includes('caniveau') || dl.includes('refection') || dl.includes('fosse') || dl.includes('regard')) {
    return 'GC_TRANCHEES';
  }
  // 10. Accessoires, Boîtes & Coffrets
  if (/^(35|36|41|42|43|54)-/.test(c) || dl.includes('boite') || dl.includes('coffret') || dl.includes('accessoire') || dl.includes('connecteur') || dl.includes('placard') || dl.includes('portillon')) {
    return 'ACC_COFFRETS';
  }
  // 11. Études, Topo & Branchements
  return 'ETUDES_BRANCH';
}

function detectArticleNetCategory(a) {
  const cat = String(a.cat || '').toUpperCase().trim().replace(/\s+/g, '');
  const c = String(a.code || '').trim();
  if (cat === 'MT-BT') return 'MT-BT';
  if (cat === 'EP') return 'EP';
  if (cat === 'ETD' || /^80-/.test(c)) return 'ETD';
  if (cat === 'EQ' || cat === 'EQ22KV' || cat === 'TR' || cat === 'AMG' || /^(60|61|62|63|64|65|67|70)-/.test(c)) return 'PT';
  if (cat === 'MT') return 'MT';
  if (cat === 'BT') return 'BT';
  const lot = detectLot(a.code, a.d);
  if (lot === 'lot2') return 'PT';
  if (lot === 'lot1') return 'MT';
  return 'BT';
}

function smartFilterArts(list, q, netFilter = 'ALL', famFilter = 'ALL', consFilter = 'ALL') {
  const tokens = smartTokenize(q);
  const res = list.filter(a => {
    // 1. Filtre Réseau / Type
    if (netFilter && netFilter !== 'ALL') {
      const netCat = detectArticleNetCategory(a);
      if (netFilter === 'MT' && netCat !== 'MT' && netCat !== 'MT-BT') return false;
      if (netFilter === 'BT' && netCat !== 'BT' && netCat !== 'MT-BT') return false;
      if (netFilter === 'MT-BT' && netCat !== 'MT-BT') return false;
      if (netFilter === 'PT' && netCat !== 'PT') return false;
      if (netFilter === 'EP' && netCat !== 'EP') return false;
      if (netFilter === 'ETD' && netCat !== 'ETD') return false;
    }
    // 2. Filtre Famille d'ouvrage
    if (famFilter && famFilter !== 'ALL') {
      if (detectArticleFamily(a) !== famFilter) return false;
    }
    // 3. Filtre Consistance (F+M, F, M)
    if (consFilter && consFilter !== 'ALL') {
      if (String(a.c || '').toUpperCase().trim() !== consFilter) return false;
    }
    // 4. Recherche Intelligente multi-mots sur DESIGNATION 1 et DESIGNATION 2 sans accents
    if (tokens.length > 0) {
      if (!a._haystack) {
        const raw = `${a.code || ''} ${a.d || ''} ${a.d2 || ''} ${a.cat || ''} ${a.c || ''} ${a.u || ''} ${a.p || ''}`;
        const norm = smartNorm(raw);
        // Version compacte chiffres + unités (ex: "240 mm2" -> "240mm2")
        const compact = norm.replace(/(\d)\s+(mm2|mm|kv|kva|dan|kg|m3|m2|m)\b/g, '$1$2');
        // Extraire tous les nombres et sections de câbles (ex: "1x240" -> "240", "3x240+1x95" -> "240 95")
        const numbers = (norm.match(/\b\d+(?:\.\d+)?\b/g) || []).join(' ');
        const sections = (norm.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)/gi) || []).map(s => s.split(/x/i)[1]).join(' ');
        a._haystack = norm + ' ' + compact + ' ' + numbers + ' ' + sections;
      }
      for (let i = 0; i < tokens.length; i++) {
        if (!a._haystack.includes(tokens[i])) return false;
      }
    }
    return true;
  });

  if (tokens.length > 0) {
    // Pertinence : placer en premier les articles mentionnant les termes recherchés dans DESIGNATION 1, DESIGNATION 2 ou CODE
    res.sort((a, b) => {
      const getScore = art => {
        let sc = 0;
        const d1n = smartNorm(art.d || '');
        const d2n = smartNorm(art.d2 || '');
        const cn = smartNorm(art.code || '');
        for (const tok of tokens) {
          if (cn.includes(tok)) sc += 15;
          if (d1n.includes(tok)) sc += 10;
          if (d2n.includes(tok)) sc += 8;
        }
        return sc;
      };
      return getScore(b) - getScore(a);
    });
  }

  return res;
}

/* ===== Attribution automatique F1, F2... et Tri Alphanumérique Croissant par N° DE PRIX ===== */
function getCodeSortGroup(codeStr) {
  const c = String(codeStr || '').trim();
  if (!c || c === '—') return 2; // Vide tout à la fin
  if (/^F\d+/i.test(c) || /^[A-Za-z]/.test(c)) return 1; // F1, F2... après les codes numériques (01-..., 02-..., 34-...)
  return 0; // Codes commençant par un chiffre (01-..., 02-..., 03-..., 34-...) en premier
}

function comparePrixCode(aCode, bCode) {
  const cA = String(aCode || '').trim();
  const cB = String(bCode || '').trim();
  const gA = getCodeSortGroup(cA);
  const gB = getCodeSortGroup(cB);
  if (gA !== gB) return gA - gB;
  if (gA === 2) return 0;
  return cA.localeCompare(cB, 'fr', { numeric: true, sensitivity: 'base' });
}

function sortLinesByCode(lines) {
  // Tri automatique désactivé : on conserve scrupuleusement l'ordre d'origine de la liste
  if (!Array.isArray(lines)) return [];
  return lines.slice();
}

function sortBordByCode(bord) {
  // Tri automatique désactivé : on conserve scrupuleusement l'ordre d'origine de la liste
  return;
}

function getNextFCode(bord) {
  let maxF = 0;
  (bord || []).forEach(l => {
    const m = String(l.code || '').trim().match(/^F(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxF) maxF = n;
    }
  });
  return 'F' + (maxF + 1);
}

function autoNumberUndefinedPrices(bord) {
  if (!Array.isArray(bord)) return 0;
  let count = 0;
  bord.forEach(l => {
    const c = String(l.code || '').trim();
    if (!c || c === '—' || c === 'PERSO') {
      l.code = getNextFCode(bord);
      count++;
    }
  });
  // Conserver scrupuleusement l'ordre d'origine de sélection de la liste (aucun tri par N° DE PRIX)
  // Renuméroter proprement F1, F2... selon l'ordre d'apparition dans la liste
  let fIdx = 1;
  bord.forEach(l => {
    const c = String(l.code || '').trim();
    if (/^F\d+$/i.test(c)) {
      l.code = 'F' + (fIdx++);
    }
  });
  return count;
}

/* ===== Système Hybride : Définition des 5 Réseaux / Sections Normalisées =====
   - Ligne MT
   - Ligne MT Hors site
   - Ligne MT In Site
   - Poste
   - Ligne BT
   L'utilisateur peut cocher comme il veut en toute liberté.
*/
const SECTION_DEFS = {
  'MT':    { key: 'MT',    net: 'MT', site: 'STD', label: 'Ligne MT',           shortLabel: 'Ligne MT',           icon: '⚡', lot: 'lot1',    ouvrage: 'Ligne MT' },
  'MT_HS': { key: 'MT_HS', net: 'MT', site: 'HS',  label: 'Ligne MT Hors site', shortLabel: 'Ligne MT Hors site', icon: '⚡', lot: 'lot1_hs', ouvrage: 'Ligne MT Hors site' },
  'MT_IS': { key: 'MT_IS', net: 'MT', site: 'IS',  label: 'Ligne MT In Site',   shortLabel: 'Ligne MT In Site',   icon: '⚡', lot: 'lot1_is', ouvrage: 'Ligne MT In Site' },
  'PT':    { key: 'PT',    net: 'PT', site: 'IS',  label: 'Poste',              shortLabel: 'Poste',              icon: '🏢', lot: 'lot2',    ouvrage: 'Poste Transfo (PT)' },
  'BT':    { key: 'BT',    net: 'BT', site: 'IS',  label: 'Ligne BT',           shortLabel: 'Ligne BT',           icon: '🔌', lot: 'lot3',    ouvrage: 'Ligne BT' },
  // Alias de compatibilité
  'BT_IS': { key: 'BT',    net: 'BT', site: 'IS',  label: 'Ligne BT',           shortLabel: 'Ligne BT',           icon: '🔌', lot: 'lot3',    ouvrage: 'Ligne BT' },
  'BT_HS': { key: 'BT_HS', net: 'BT', site: 'HS',  label: 'Ligne BT Hors-Site', shortLabel: 'BT Hors-Site',       icon: '🔌', lot: 'lot3',    ouvrage: 'Ligne BT Hors-Site' }
};

const DEFAULT_SEC_ORDER = ['MT', 'MT_HS', 'MT_IS', 'PT', 'BT', 'BT_HS'];

function getActiveSecs(info) {
  info = info || {};
  let s = info.activeSecs;
  if (!s || typeof s !== 'object') {
    const t = info.typeAff || 'MT/BT';
    const ms = info.mtSite || 'In-Site';
    s = {
      'MT': t === 'MT' && ms !== 'Hors-Site' && ms !== 'Les Deux',
      'MT_HS': (t === 'MT' || t === 'MT/BT') && (ms === 'Hors-Site' || ms === 'Les Deux'),
      'MT_IS': (t === 'MT' || t === 'MT/BT') && ms !== 'Hors-Site',
      'PT': t === 'MT/BT',
      'BT': t === 'BT' || t === 'MT/BT'
    };
    if (info.netSel) {
      if (info.netSel.MT) {
        if (info.netSel.MT.site === 'HS') s['MT_HS'] = true;
        else if (info.netSel.MT.site === 'IS') s['MT_IS'] = true;
        else if (info.netSel.MT.on) s['MT'] = true;
      }
      if (info.netSel.PT) s['PT'] = !!info.netSel.PT.on;
      if (info.netSel.BT) s['BT'] = !!info.netSel.BT.on;
    }
    info.activeSecs = s;
  }
  if (s['BT_IS'] !== undefined && s['BT'] === undefined) {
    s['BT'] = s['BT_IS'];
  }
  DEFAULT_SEC_ORDER.forEach(k => {
    if (s[k] === undefined) s[k] = false;
  });
  return s;
}

function getSecOrder(info) {
  info = info || {};
  let o = Array.isArray(info.secOrder) ? info.secOrder.filter(k => DEFAULT_SEC_ORDER.includes(k)) : [];
  DEFAULT_SEC_ORDER.forEach(k => {
    if (!o.includes(k)) o.push(k);
  });
  info.secOrder = o;
  return o;
}

function getLineSec(l) {
  if (l && l.sec) {
    if (l.sec === 'BT_IS') return 'BT';
    if (SECTION_DEFS[l.sec]) return SECTION_DEFS[l.sec].key;
  }
  if (!l) return 'MT';
  const o = String(l.ouvrage || '');
  if (o.includes('Poste') || l.lot === 'lot2' || l.net === 'PT') return 'PT';
  if (o.includes('Hors-Site') || o.includes('Hors site') || l.site === 'HS' || l.lot === 'lot1_hs') {
    if (o.includes('BT') || l.net === 'BT' || l.lot === 'lot3') return 'BT';
    return 'MT_HS';
  }
  if (o.includes('In-Site') || o.includes('In Site') || l.site === 'IS' || l.lot === 'lot1_is') {
    if (o.includes('BT') || l.net === 'BT' || l.lot === 'lot3') return 'BT';
    return 'MT_IS';
  }
  if (o.includes('MT') || l.net === 'MT' || l.lot === 'lot1') {
    const act = (P && P.info && P.info.activeSecs) || {};
    if (act['MT']) return 'MT';
    if (act['MT_IS']) return 'MT_IS';
    if (act['MT_HS']) return 'MT_HS';
    return 'MT';
  }
  if (o.includes('BT') || l.net === 'BT' || l.lot === 'lot3') return 'BT';
  const d = detectLot(l.code, l.d);
  if (d === 'lot2') return 'PT';
  if (d === 'lot1') {
    const act = (P && P.info && P.info.activeSecs) || {};
    if (act['MT']) return 'MT';
    if (act['MT_IS']) return 'MT_IS';
    if (act['MT_HS']) return 'MT_HS';
    return 'MT';
  }
  return 'BT';
}

function setLineSec(l, secKey) {
  const def = SECTION_DEFS[secKey] || SECTION_DEFS['MT'] || SECTION_DEFS['MT_IS'];
  l.sec = def.key;
  l.net = def.net;
  l.site = def.site;
  l.lot = def.lot;
  l.ouvrage = def.ouvrage;
}

function syncHybridAff(info) {
  info = info || (P && P.info) || {};
  const act = getActiveSecs(info);
  const hasMt = !!(act['MT'] || act['MT_IS'] || act['MT_HS']);
  const hasBt = !!(act['BT'] || act['BT_IS'] || act['BT_HS']);
  const hasPt = !!act['PT'];
  info.typeAff = ((hasMt && hasBt) || hasPt) ? 'MT/BT' : hasMt ? 'MT' : hasBt ? 'BT' : 'MT/BT';
  info.mtSite = (act['MT_IS'] && act['MT_HS']) ? 'Les Deux' : act['MT_HS'] ? 'Hors-Site' : 'In-Site';
  P.prest = P.prest || {};
  P.prest['Raccordement MT'] = { on: info.typeAff === 'MT', qty: 1 };
  P.prest['Raccordement BT'] = { on: info.typeAff === 'BT', qty: 1 };
  P.prest['Raccordement MT/BT'] = { on: info.typeAff === 'MT/BT', qty: 1 };
  info.metier = info.typeAff === 'BT' ? 'BT' : 'HTA';
  (P.bord || []).forEach(l => {
    if (!l.sec) l.sec = getLineSec(l);
    setLineSec(l, l.sec);
  });
  if (typeof syncCablesFromBord === 'function') syncCablesFromBord();
  updKpi();
}

function activeSectionKeys(info, lines) {
  const act = getActiveSecs(info);
  const order = getSecOrder(info);
  const presentKeys = new Set((lines || []).map(l => getLineSec(l)));
  return order.filter(k => act[k] === true || presentKeys.has(k));
}

function groupLinesBySection(lines, info) {
  info = info || (P && P.info) || {};
  const activeKeys = activeSectionKeys(info, lines);
  return activeKeys.map(k => {
    const def = SECTION_DEFS[k] || { label: k, shortLabel: k, icon: '📌' };
    const ls = (lines || []).filter(l => getLineSec(l) === k);
    const ht = r2(ls.filter(l => l.on !== false).reduce((acc, l) => acc + (num(l.q) * num(l.pu)), 0));
    return {
      key: k,
      def: def,
      label: def.label,
      shortLabel: def.shortLabel,
      icon: def.icon,
      lines: ls,
      ht: ht
    };
  }).filter(g => g.lines.length > 0 || (info.activeSecs && info.activeSecs[g.key]));
}

function buildSectionedDocLines(lines) {
  if (P.info.groupSections === false) return sortLinesByCode(lines);
  const groups = groupLinesBySection(lines);
  const out = [];
  groups.forEach((g, gi) => {
    if (!g.lines.length) return;
    out.push({ _kind: 'hdr', num: gi + 1, label: g.label });
    sortLinesByCode(g.lines).forEach(l => out.push(l));
    out.push({ _kind: 'sub', num: gi + 1, label: g.label, ht: g.ht });
  });
  return out;
}

function renderSecDocRow(l, withPrices) {
  if (l._kind === 'hdr') {
    return `<tr><td colspan="7" style="border:1.5px solid #000;background:#dbe5f1;padding:5px 8px;font-weight:800;font-size:12px;text-transform:uppercase;color:#000">${l.num}. ${esc(l.label)}</td></tr>`;
  }
  return `<tr>
    <td colspan="6" style="border-left:1.5px solid #000;border-right:1px solid #000;border-top:1px solid #000;border-bottom:1.5px solid #000;background:#f2f2f2;padding:4px 8px;text-align:right;font-weight:800;font-size:11.5px">SOUS-TOTAL ${l.num} · ${esc(l.label)} (HT)</td>
    <td style="border-right:1.5px solid #000;border-top:1px solid #000;border-bottom:1.5px solid #000;background:#f2f2f2;padding:4px 6px;text-align:right;font-weight:800;font-size:11.5px">${withPrices ? fmt(l.ht) : '&nbsp;'}</td>
  </tr>`;
}

function sectionSubTotRows(b, prefix) {
  if (P.info.groupSections === false) return '';
  const gs = groupLinesBySection(b.lines.filter(l => l.on)).filter(g => g.lines.length > 0);
  if (gs.length < 2) return '';
  return gs.map((g, gi) => `<tr><td>${prefix} ${gi + 1} · ${esc(g.label)} (HTVA)</td><td class="n">${dh(g.ht)}</td></tr>`).join('') +
    `<tr class="b" style="border-top:1px solid #000"><td>Total Travaux HTVA (${gs.map((_, i) => i + 1).join(' + ')})</td><td class="n b">${dh(b.ht)}</td></tr>`;
}

function renderNetSelWidget(info) {
  const act = getActiveSecs(info);
  let lines = [];
  try { lines = computeBordLots().lines; } catch (e) {}
  const actKeys = activeSectionKeys(info, lines);

  const secCard = (key, label, desc, icon) => {
    const on = act[key] === true;
    const hasLines = (lines || []).some(l => getLineSec(l) === key);
    return `<label style="display:flex;align-items:center;gap:10px;background:#fff;border:2px solid ${on ? '#2563eb' : '#cbd5e1'};border-radius:8px;padding:9px 14px;cursor:pointer;flex:1;min-width:180px;box-shadow:${on ? '0 2px 6px rgba(37,99,235,0.18)' : '0 1px 3px rgba(0,0,0,0.05)'};transition:all .15s">
      <input type="checkbox" data-togglesec="${key}" ${on ? 'checked' : ''} style="width:19px;height:19px;cursor:pointer;accent-color:#2563eb">
      <div>
        <div style="font-weight:800;font-size:13.5px;color:${on ? '#1e40af' : '#334155'}">${icon} ${label}</div>
        <div style="font-size:11px;color:#64748b;font-weight:500">${desc}${hasLines ? ' &bull; <b style="color:#2563eb">Articles présents</b>' : ''}</div>
      </div>
    </label>`;
  };

  const orderBadges = actKeys.map((key, idx) => {
    const d = SECTION_DEFS[key] || { label: key, icon: '📌' };
    return `
      <div style="display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px 4px 10px;font-size:12.5px;font-weight:600">
        <b style="color:#1e40af">${idx + 1}.</b> ${d.icon} ${esc(d.label)}
        <button class="btn sm" data-secup="${key}" style="padding:1px 6px" title="Monter cette section" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn sm" data-secdn="${key}" style="padding:1px 6px" title="Descendre cette section" ${idx === actKeys.length - 1 ? 'disabled' : ''}>↓</button>
      </div>`;
  }).join('');

  return `
    <div class="netsel-box" style="background:#eff6ff;padding:14px 16px;border:1.5px solid #93c5fd;border-radius:8px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <label style="font-weight:800;color:var(--brand);font-size:14px;margin:0">
          🏗️ Structure du Projet / Réseaux <span style="font-weight:500;font-size:12px;color:var(--muted)">(cochez comme vous voulez)</span> :
        </label>
        <span style="font-size:11.5px;color:#1e40af;font-weight:700;background:#dbeafe;padding:2px 8px;border-radius:12px">
          ${actKeys.length} section(s) cochée(s)
        </span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${secCard('MT', 'Ligne MT', 'Réseau MT', '⚡')}
        ${secCard('MT_HS', 'Ligne MT Hors site', 'Ligne extérieure / raccordement', '⚡')}
        ${secCard('MT_IS', 'Ligne MT In Site', 'Intérieur lotissement', '⚡')}
        ${secCard('PT', 'Poste', 'Poste de Transformation (PT)', '🏢')}
        ${secCard('BT', 'Ligne BT', 'Réseau Basse Tension', '🔌')}
      </div>

      <div style="margin-top:12px;border-top:1px dashed #93c5fd;padding-top:10px">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px">
          <span style="font-weight:800;color:var(--brand);font-size:13px">📑 Ordre d'affichage des sections (Bordereau, Devis, Factures) :</span>
          <label style="display:flex;align-items:center;gap:5px;font-size:12.5px;cursor:pointer">
            <input type="checkbox" data-secgroup ${info.groupSections !== false ? 'checked' : ''}> Regrouper par section avec sous-totaux
          </label>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${orderBadges || '<i style="color:var(--muted);font-size:12.5px">Aucune section active — cochez au moins une section ci-dessus.</i>'}</div>
      </div>
    </div>`;
}

function bindNetSelWidget(el) {
  el.querySelectorAll('[data-togglesec]').forEach(chk => {
    chk.onchange = () => {
      const key = chk.dataset.togglesec;
      const act = getActiveSecs(P.info);
      act[key] = chk.checked;
      syncHybridAff(P.info);
      touch();
      render();
      toast(`Section « ${SECTION_DEFS[key]?.label || key} » : ${chk.checked ? 'activée' : 'désactivée'}`);
    };
  });
  const moveSec = (key, dir) => {
    let lines = [];
    try { lines = computeBordLots().lines; } catch (e) {}
    const actKeys = activeSectionKeys(P.info, lines);
    const i = actKeys.indexOf(key);
    const other = actKeys[i + dir];
    if (!other) return;
    const order = getSecOrder(P.info);
    const a = order.indexOf(key), b = order.indexOf(other);
    order[a] = other; order[b] = key;
    P.info.secOrder = order;
    touch();
    render();
  };
  el.querySelectorAll('[data-secup]').forEach(btn => { btn.onclick = () => moveSec(btn.dataset.secup, -1); });
  el.querySelectorAll('[data-secdn]').forEach(btn => { btn.onclick = () => moveSec(btn.dataset.secdn, 1); });
  el.querySelectorAll('[data-secgroup]').forEach(chk => {
    chk.onchange = () => { P.info.groupSections = chk.checked; touch(); render(); };
  });
}

function setTypeAff(type) {
  const act = getActiveSecs(P.info);
  act['MT'] = type === 'MT';
  act['MT_IS'] = type === 'MT/BT';
  act['MT_HS'] = false;
  act['BT'] = type !== 'MT';
  act['BT_IS'] = type !== 'MT';
  act['BT_HS'] = false;
  act['PT'] = type === 'MT/BT';
  syncHybridAff(P.info);
  touch();
  render();
}

/* ===== Calculs financiers selon le Type d'Affaire ===== */
/*
   RÈGLES UTILISATEUR :
   - si typeAff === 'MT' : Bordereau affiche ligne MT seule
   - si typeAff === 'BT' : Bordereau affiche ligne BT seule
   - si typeAff === 'MT/BT' : Bordereau affiche ligne MT + PT + BT
*/
function computeBordLots() {
  if (!P) return { lines: [], ht: 0, lot1: { lines: [], ht: 0 }, lot1_hs: { lines: [], ht: 0 }, lot1_is: { lines: [], ht: 0 }, lot2: { lines: [], ht: 0 }, lot3: { lines: [], ht: 0 } };
  
  const typeAff = P.info.typeAff || 'MT/BT';
  const mtSite = P.info.mtSite || 'In-Site';
  
  const lines = (P.bord || []).map((l, idx) => {
    const q = num(l.q);
    const pu = num(l.pu);
    const tot = r2(q * pu);
    let lot = l.lot;
    if (!lot) {
      const d = detectLot(l.code);
      if (d === 'lot1' && mtSite === 'Les Deux') lot = 'lot1_hs';
      else lot = d;
    }
    const secKey = getLineSec(l);
    const def = SECTION_DEFS[secKey] || SECTION_DEFS['MT_IS'];
    const net = def.net;
    const site = def.site;
    return {
      key: l.key || ('b_' + idx),
      lot: lot,
      net: net,
      site: site,
      ouvrage: l.ouvrage,
      pose: l.pose,
      code: l.code || '—',
      d: l.d || '',
      c: l.c || 'F+M',
      u: l.u || 'U',
      q: q,
      pu: pu,
      tot: tot,
      on: l.on !== false
    };
  });
  
  const lot1Lines = lines.filter(l => l.net === 'MT');
  const lot1HsLines = lines.filter(l => l.net === 'MT' && l.site === 'HS');
  const lot1IsLines = lines.filter(l => l.net === 'MT' && l.site === 'IS');
  const lot2Lines = lines.filter(l => l.net === 'PT');
  const lot3Lines = lines.filter(l => l.net === 'BT');
  
  const ht1 = r2(lot1Lines.filter(l => l.on).reduce((a, l) => a + l.tot, 0));
  const ht1_hs = r2(lot1HsLines.filter(l => l.on).reduce((a, l) => a + l.tot, 0));
  const ht1_is = r2(lot1IsLines.filter(l => l.on).reduce((a, l) => a + l.tot, 0));
  const ht2 = r2(lot2Lines.filter(l => l.on).reduce((a, l) => a + l.tot, 0));
  const ht3 = r2(lot3Lines.filter(l => l.on).reduce((a, l) => a + l.tot, 0));
  
  // Total HT = somme de tous les articles actifs du Bordereau (affichés les uns après les autres)
  const htTotal = r2(lines.filter(l => l.on).reduce((a, l) => a + l.tot, 0));
  
  return {
    lines,
    typeAff,
    mtSite,
    ht: htTotal,
    lot1: { lines: lot1Lines, ht: ht1, active: typeAff === 'MT' || typeAff === 'MT/BT' },
    lot1_hs: { lines: lot1HsLines, ht: ht1_hs, active: (typeAff === 'MT' || typeAff === 'MT/BT') && mtSite === 'Les Deux' },
    lot1_is: { lines: lot1IsLines, ht: ht1_is, active: (typeAff === 'MT' || typeAff === 'MT/BT') && mtSite === 'Les Deux' },
    lot2: { lines: lot2Lines, ht: ht2, active: typeAff === 'MT/BT' },
    lot3: { lines: lot3Lines, ht: ht3, active: typeAff === 'BT' || typeAff === 'MT/BT' }
  };
}

const SPECIAL_PREST_NAMES = [
  'Equipement cellule depart 22kV',
  'Frais Traversee ADM',
  'Frais Traversee ONCF',
  "Frais d'étude du dossier traversée de route par la DPETL"
];

function isSpecialPrest(name) {
  const n = smartNorm(name || '');
  return SPECIAL_PREST_NAMES.some(s => smartNorm(s) === n) ||
    n.includes('cellule depart 22kv') ||
    n.includes('traversee adm') ||
    n.includes('traversee oncf') ||
    n.includes('traversee de route');
}

function computeEval() {
  const b = computeBordLots();
  const tva = num(P.tva ?? 20) / 100;
  const worksTva = r2(b.ht * tva);
  const worksTtc = r2(b.ht + worksTva);
  
  const allPre = PRE_DEFAULT.concat((P.customPre || []).map(x => ({ name: x.name, p: num(x.p), cu: 1 })));
  const pr = [];
  const specialPr = [];
  
  allPre.forEach(a => {
    const s = P.prest && P.prest[a.name];
    if (!s || !s.on) return;
    let pu = s.pu != null && s.pu !== '' ? num(s.pu) : a.p;
    let q = s.qty != null && s.qty !== '' ? num(s.qty) : 1;
    
    // Peines et soins auto = 20% des travaux HT
    if (a.name === PEINES) {
      pu = r2(b.ht * (num(P.peines ?? 20) / 100));
      q = 1;
    }
    // Participation sur puissance
    if (a.name === 'Participation sur puissance') {
      q = num(P.info.puissance) || q;
    }
    const item = { name: a.name, pu, q, tot: r2(pu * q) };
    if (isSpecialPrest(a.name)) {
      specialPr.push(item);
    } else {
      pr.push(item);
    }
  });
  
  const pht = r2(pr.reduce((a, x) => a + x.tot, 0));
  const ptva = r2(pht * tva);
  const corePttc = r2(pht + ptva);
  const specialTotal = r2(specialPr.reduce((a, x) => a + x.tot, 0));
  const pttc = r2(corePttc + specialTotal);
  const total = r2(worksTtc + pttc);
  
  return { b, tva, worksTva, worksTtc, pr, specialPr, pht, ptva, corePttc, specialTotal, pttc, total };
}

/* ===== Règle de signature sur les PRESTATIONS SRM-TTA ===== */
/*
  Consigne utilisateur :
  "je veux appliqué sur Montant des prestations de la SRM-TTA c'est pas le montant total"
  - Prestations SRM-TTA <= 50 000 DH -> Directeur Provincial
  - Prestations SRM-TTA entre 50 000 DH et 500 000 DH -> Directeur Clientèle
  - Prestations SRM-TTA > 500 000 DH -> La Directrice Générale
  (seuils et titres modifiables dans 4 · Documents clients > Paramètres)
*/
/* Paramètres de signature (modifiables, enregistrés pour toutes les affaires) */
const SIG_CFG_KEY = 'srm_sig_cfg_v1';
const SIG_CFG_DEFAULT = {
  s1: 50000,
  s2: 500000,
  t1: 'Directeur Provincial',
  t2: 'Directeur Clientèle',
  t3: 'La Directrice Générale'
};
function getSigCfg() {
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(SIG_CFG_KEY) || '{}') || {}; } catch (e) { cfg = {}; }
  const out = Object.assign({}, SIG_CFG_DEFAULT, cfg);
  out.s1 = num(out.s1) || SIG_CFG_DEFAULT.s1;
  out.s2 = num(out.s2) || SIG_CFG_DEFAULT.s2;
  if (out.s2 < out.s1) out.s2 = out.s1;
  ['t1', 't2', 't3'].forEach(k => { if (!String(out[k] || '').trim()) out[k] = SIG_CFG_DEFAULT[k]; });
  return out;
}
function saveSigCfg(cfg) {
  try { localStorage.setItem(SIG_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
}
function fmtK(v) {
  v = num(v);
  return v >= 1000 ? (fmt(v / 1000).replace(/,00$/, '') + 'k') : fmt(v);
}
function sigRuleLabel() {
  const g = getSigCfg();
  return `&le; ${fmtK(g.s1)} DH : ${esc(g.t1)} | ${fmtK(g.s1)} – ${fmtK(g.s2)} DH : ${esc(g.t2)} | &gt; ${fmtK(g.s2)} DH : ${esc(g.t3)}`;
}
function sigLevel(prestTTC) {
  const g = getSigCfg();
  if (prestTTC <= g.s1) return 1;
  if (prestTTC <= g.s2) return 2;
  return 3;
}
function getSignatairePrestations(prestTTC) {
  const g = getSigCfg();
  const lv = sigLevel(prestTTC);
  return lv === 1 ? g.t1 : lv === 2 ? g.t2 : g.t3;
}

function getSignataire(prestTTC) {
  const d = P.doc || {};
  const g = getSigCfg();
  const mode = d.signataireMode || 'auto';
  if (mode === 'dp') return g.t1;
  if (mode === 'dc') return g.t2;
  if (mode === 'dg') return g.t3;
  if (mode === 'custom' && d.signataireCustom) return d.signataireCustom;
  return getSignatairePrestations(prestTTC);
}

/* ===== Consistance des travaux selon le Type d'Affaire ===== */
function consist() {
  syncCablesFromBord();
  const o = [];
  const i = P.info;
  const typeAff = i.typeAff || 'MT/BT';
  const site = i.mtSite || 'In-Site';
  const fmtLg = v => fmt(num(v), 2);
  const bordCables = getActiveBordCables(P);
  const mtDet = cableTypeDetails(bordCables.filter(c => c.net === 'MT'));
  const btDet = cableTypeDetails(bordCables.filter(c => c.net === 'BT'));

  // Câbles MT : chaque câble sur sa propre ligne sans préfixe "Ligne MT aérienne" ni "Liaison MT souterraine"
  if (mtDet.length) {
    mtDet.forEach(x => {
      o.push(`longueur de ${fmtLg(x.len)} m environ en ${x.cab}`);
    });
  } else if (typeAff === 'MT' || typeAff === 'MT/BT') {
    if (site === 'Les Deux') {
      const hsL = num(i.mtHsL) || num(i.mtarL) || 0;
      const hsCab = i.mtHsCab || i.mtarCab;
      if (hsL) o.push(`longueur de ${fmtLg(hsL)} m environ en ${hsCab}`);
      
      const isL = num(i.mtIsL) || num(i.mtstL) || 0;
      const isCab = i.mtIsCab || i.mtstCab;
      if (isL) o.push(`longueur de ${fmtLg(isL)} m environ en ${isCab}`);
    } else {
      const arL = num(i.mtarL);
      const stL = num(i.mtstL);
      if (arL > 0) {
        o.push(`longueur de ${fmtLg(arL)} m environ en ${i.mtarCab || CABLES_STANDARDS.mtar[0]}`);
      }
      if (stL > 0) {
        o.push(`longueur de ${fmtLg(stL)} m environ en ${i.mtstCab || CABLES_STANDARDS.mtst[0]}`);
      }
      if (arL === 0 && stL === 0) {
        const mtL = num(i.mtL);
        if (mtL) o.push(`longueur de ${fmtLg(mtL)} m environ en ${i.mtarCab || i.mtstCab || CABLES_STANDARDS.mtar[0]}`);
      }
    }
  }
  
  if (typeAff === 'MT/BT') {
    const ptType = i.posteType || 'Poste H61';
    const ptP = i.puissance ? `${i.puissance} kVA` : '';
    o.push(`Poste de Transformation MT/BT (${ptType} ${ptP})`);
  }
  
  // Câbles BT : chaque câble sur sa propre ligne sans préfixe "Réseau BT aérien" ni "Réseau BT souterrain"
  if (btDet.length) {
    btDet.forEach(x => {
      o.push(`longueur de ${fmtLg(x.len)} m environ en ${x.cab}`);
    });
  } else if (typeAff === 'BT' || typeAff === 'MT/BT') {
    const arL = num(i.btarL);
    const stL = num(i.btstL);
    if (arL > 0) {
      o.push(`longueur de ${fmtLg(arL)} m environ en ${i.btarCab || CABLES_STANDARDS.btar[0]}`);
    }
    if (stL > 0) {
      o.push(`longueur de ${fmtLg(stL)} m environ en ${i.btstCab || CABLES_STANDARDS.btst[0]}`);
    }
    if (arL === 0 && stL === 0) {
      const btL = num(i.btL);
      if (btL) {
        o.push(`longueur de ${fmt(btL)} m environ en ${i.btarCab || i.btstCab || CABLES_STANDARDS.btar[0]}`);
      }
    }
  }
  
  if (!o.length) {
    if (i.objet) o.push(`Travaux de : ${i.objet}`);
    else o.push(`Travaux d'électricité réseau ${typeAff}`);
  }
  
  return o;
}

function extras() {
  const d = P.doc || {};
  return {
    route: num(d.fraisRoute),
    tiers: num(d.partTiers)
  };
}

/* ===== Actions Dossier ===== */
function newP() {
  const curYear = new Date().getFullYear();
  const next = getNextAffaireNum(curYear);
  P = blankP('Nouvelle affaire');
  P.info.num = next.formatted;
  P.info.refAffaire = next.formatted;
  touch();
  tab = 'projet';
  renderList();
  render();
  toast(`Nouvelle affaire créée : ${P.info.num}`);
}

function dupP() {
  const c = JSON.parse(JSON.stringify(P));
  c.id = uid();
  c.name = (P.info.objet || P.name) + ' (copie)';
  delete c.example;
  const next = getNextAffaireNum(new Date().getFullYear());
  if (c.info) {
    c.info.num = next.formatted;
    c.info.refAffaire = next.formatted;
  }
  P = c;
  touch();
  renderList();
  render();
  toast(`Dossier dupliqué avec nouveau N° : ${P.info.num}`);
}

/* Créer une nouvelle affaire vierge mais en conservant exactement le même Bordereau des prix d'un devis existant */
function createNewAffaireWithSameBord(sourceAff) {
  const src = sourceAff || P;
  if (!src) return;
  const curYear = new Date().getFullYear();
  const next = getNextAffaireNum(curYear);
  const np = blankP('Nouvelle affaire (Bordereau repris)');
  np.info.num = next.formatted;
  np.info.refAffaire = next.formatted;
  if (src.info) {
    np.info.typeAff = src.info.typeAff || 'MT/BT';
    np.info.mtSite = src.info.mtSite || 'In-Site';
    np.info.mtPose = src.info.mtPose || 'Aérien';
    np.info.btPose = src.info.btPose || 'Aérien';
    np.info.posteType = src.info.posteType || 'Poste H61';
    np.info.puissance = src.info.puissance || '';
    np.info.province = src.info.province || 'Ouezzane';
  }
  np.tva = src.tva ?? 20;
  np.peines = src.peines ?? 20;
  np.bord = JSON.parse(JSON.stringify(src.bord || [])).map(l => ({
    ...l,
    key: 'b_' + uid()
  }));
  if (src.prest) {
    np.prest = JSON.parse(JSON.stringify(src.prest));
  }
  if (src.customPre) {
    np.customPre = JSON.parse(JSON.stringify(src.customPre));
  }
  P = np;
  mode = 'dossier';
  syncCablesFromBord();
  touch();
  saveStorage();
  renderList();
  render();
  toast(`✅ Nouvelle affaire ${P.info.num} créée avec le même Bordereau (${P.bord.length} articles)`);
}


/* ===== Modale Globale : Créer une Nouvelle Affaire à partir d'un Bordereau Déjà Fait ===== */
function openNewAffaireWithBordModal() {
  const old = document.getElementById('modalChooseBordGlobal');
  if (old) old.remove();

  // S'assurer que l'affaire courante P est bien présente dans la liste
  if (P && Array.isArray(P.bord) && P.bord.length) {
    const pIdx = plist.findIndex(x => x.id === P.id);
    if (pIdx >= 0) {
      plist[pIdx].data = JSON.parse(JSON.stringify(P));
      plist[pIdx].upd = Date.now();
    } else {
      plist.unshift({ id: P.id, name: P.name, upd: Date.now(), data: JSON.parse(JSON.stringify(P)) });
    }
  }

  // Liste des affaires ayant un bordereau non vide
  const affairesWithBord = (plist || []).filter(x => {
    const d = x.data || {};
    return Array.isArray(d.bord) && d.bord.length > 0;
  });

  let searchQ = '';
  let previewId = null;

  const modal = document.createElement('div');
  modal.id = 'modalChooseBordGlobal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);';

  const renderModalContent = () => {
    const qNorm = smartNorm(searchQ);
    const filtered = affairesWithBord.filter(x => {
      if (!qNorm) return true;
      const d = x.data || {};
      const inf = d.info || {};
      const hay = smartNorm(`${inf.num || ''} ${inf.devis || ''} ${inf.demande || ''} ${inf.contrat || ''} ${inf.objet || ''} ${d.name || ''} ${inf.destinataire || ''} ${inf.commune || ''} ${inf.province || ''}`);
      return hay.includes(qNorm);
    });

    const previewAff = previewId ? affairesWithBord.find(x => x.id === previewId) : null;
    const previewLines = previewAff && previewAff.data && Array.isArray(previewAff.data.bord) ? previewAff.data.bord : [];

    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;width:100%;max-width:920px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;border:1.5px solid #cbd5e1;font-family:Arial,sans-serif">
        
        <!-- En-tête -->
        <div style="padding:16px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;font-size:18px;color:#0d7a5b;display:flex;align-items:center;gap:8px">
              <span>📋</span> Créer une nouvelle affaire avec un Bordereau déjà fait
            </h3>
            <div style="font-size:12.5px;color:#64748b;margin-top:3px">
              Sélectionnez une affaire / un devis existant pour reprendre son Bordereau dans une nouvelle affaire (numérotée automatiquement).
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <label class="btn sm ok" style="cursor:pointer;margin:0;font-weight:700;background:#0284c7;color:#fff;border-color:#0284c7" title="Importer directement un Devis / Bordereau depuis un fichier PDF">
              📄 Importer Bordereau (PDF)
              <input type="file" id="inpImportBordPdfGlobal" accept=".pdf" style="display:none">
            </label>
            <label class="btn sm ok" style="cursor:pointer;margin:0;font-weight:700" title="Importer un devis ou une affaire depuis un fichier .json">
              📂 Importer fichier (.json)
              <input type="file" id="inpImportBordJsonGlobal" accept=".json" style="display:none">
            </label>
            <button class="btn sm" id="btnCloseChooseBordModal" style="font-size:16px;line-height:1;padding:4px 8px" title="Fermer">✕</button>
          </div>
        </div>

        <!-- Barre de recherche -->
        <div style="padding:12px 20px;background:#fff;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;align-items:center">
          <input type="text" id="inpSearchBordAff" placeholder="🔍 Rechercher par N° d'affaire, N° devis, objet, commune, client..." value="${esc(searchQ)}" style="flex:1;padding:8px 12px;font-size:13px;border:1.5px solid #cbd5e1;border-radius:6px;outline:none">
          <span style="font-size:12px;color:#64748b;white-space:nowrap">${filtered.length} affaire(s) disponible(s)</span>
        </div>

        <!-- Liste des affaires -->
        <div style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px">
          ${filtered.length === 0 ? `
            <div style="text-align:center;padding:40px 20px;color:#64748b">
              <div style="font-size:36px;margin-bottom:8px">📭</div>
              <b style="font-size:14px">Aucune affaire correspondante avec bordereau.</b>
              <div style="font-size:12px;margin-top:4px">Utilisez le bouton « 📂 Importer fichier (.json) » ci-dessus si vous avez une sauvegarde de devis.</div>
            </div>
          ` : filtered.map(x => {
            const d = x.data || {};
            const inf = d.info || {};
            const count = (d.bord || []).length;
            const ht = (d.bord || []).filter(l => l.on !== false).reduce((acc, l) => acc + (num(l.q) * num(l.pu)), 0);
            const ttc = ht * 1.2;
            const isPreviewing = previewId === x.id;
            return `
              <div style="background:${isPreviewing ? '#f0fdf4' : '#fff'};border:1.5px solid ${isPreviewing ? '#0d7a5b' : '#e2e8f0'};border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;transition:all 0.15s ease">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
                  <div style="flex:1;min-width:240px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span style="background:#0d7a5b;color:#fff;font-size:11.5px;font-weight:700;padding:2px 7px;border-radius:4px;font-family:monospace">${esc(inf.num || x.name)}</span>
                      <span class="pill" style="font-size:11px;background:#e0f2fe;color:#0369a1;font-weight:700">${esc(inf.typeAff || 'MT/BT')}</span>
                      ${inf.commune ? `<span style="font-size:11.5px;color:#475569">📍 ${esc(inf.commune)}</span>` : ''}
                    </div>
                    <div style="font-size:13.5px;font-weight:700;color:#0f172a;line-height:1.35">${esc(inf.objet || d.name)}</div>
                    <div style="font-size:11.5px;color:#64748b;margin-top:3px">
                      ${inf.destinataire ? `Demandeur : <b>${esc(inf.destinataire)}</b> • ` : ''}
                      ${inf.devis ? `Devis : <b>${esc(inf.devis)}</b> • ` : ''}
                      ${inf.demande ? `Demande : <b>${esc(inf.demande)}</b> • ` : ''}
                      Bordereau : <b style="color:#0d7a5b">${count} articles</b> (${fmt(ttc)} DH TTC)
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;align-items:center">
                    <button class="btn sm" data-previd="${x.id}" style="font-size:11.5px">${isPreviewing ? 'Masquer aperçu' : '👁️ Aperçu articles'}</button>
                    <button class="btn sm ok" data-createfrom="${x.id}" style="font-weight:800;background:#0d7a5b;color:#fff;font-size:12px;padding:6px 12px" title="Créer une nouvelle affaire avec exactement ce même Bordereau">
                      ⚡ Créer nouvelle affaire
                    </button>
                  </div>
                </div>

                ${isPreviewing ? `
                  <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;background:#fff;border-radius:4px;padding:8px">
                    <div style="font-size:11.5px;font-weight:700;color:#0d7a5b;margin-bottom:6px">Articles du Bordereau (${previewLines.length}) :</div>
                    <div style="max-height:160px;overflow-y:auto;font-size:11px">
                      <table style="width:100%;border-collapse:collapse;font-size:11px">
                        <thead>
                          <tr style="background:#f8fafc;font-weight:700;text-align:left">
                            <th style="padding:4px">N° Prix</th>
                            <th style="padding:4px">Désignation</th>
                            <th style="padding:4px;text-align:right">Qté</th>
                            <th style="padding:4px">Unité</th>
                            <th style="padding:4px;text-align:right">Total HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${previewLines.slice(0, 15).map(l => `
                            <tr style="border-bottom:1px solid #f1f5f9">
                              <td style="padding:3px 4px;font-weight:700;font-family:monospace">${esc(l.np || l.code || '—')}</td>
                              <td style="padding:3px 4px">${esc(l.des || '')}</td>
                              <td style="padding:3px 4px;text-align:right;font-weight:700">${fmt(l.q)}</td>
                              <td style="padding:3px 4px">${esc(l.u || '')}</td>
                              <td style="padding:3px 4px;text-align:right">${fmt(num(l.q) * num(l.pu))}</td>
                            </tr>
                          `).join('')}
                          ${previewLines.length > 15 ? `<tr><td colspan="5" style="text-align:center;font-style:italic;color:#64748b;padding:4px">... et ${previewLines.length - 15} autres articles</td></tr>` : ''}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Pied de modale -->
        <div style="padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <button class="btn sm" id="btnCancelChooseBordModal">Annuler</button>
          <div style="font-size:12px;color:#64748b">
            Chaque nouvelle affaire créée reçoit automatiquement le prochain numéro officiel (ex: <b>SET/DPO/[N]/[Année]</b>).
          </div>
        </div>

      </div>
    `;

    // Événements
    const closeBtn = modal.querySelector('#btnCloseChooseBordModal');
    if (closeBtn) closeBtn.onclick = () => modal.remove();
    const cancelBtn = modal.querySelector('#btnCancelChooseBordModal');
    if (cancelBtn) cancelBtn.onclick = () => modal.remove();

    const searchInp = modal.querySelector('#inpSearchBordAff');
    if (searchInp) {
      searchInp.oninput = (e) => {
        searchQ = e.target.value;
        renderModalContent();
        const nInp = modal.querySelector('#inpSearchBordAff');
        if (nInp) { nInp.focus(); nInp.setSelectionRange(searchQ.length, searchQ.length); }
      };
    }

    modal.querySelectorAll('[data-previd]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.previd;
        previewId = (previewId === id) ? null : id;
        renderModalContent();
      };
    });

    modal.querySelectorAll('[data-createfrom]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.createfrom;
        const targetAff = affairesWithBord.find(x => x.id === id);
        if (targetAff && targetAff.data) {
          modal.remove();
          createNewAffaireWithSameBord(targetAff.data);
        }
      };
    });

    // Importation PDF depuis la modale
    const pdfInp = modal.querySelector('#inpImportBordPdfGlobal');
    if (pdfInp) {
      pdfInp.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        modal.remove();
        handlePdfBordereauUpload(file, 'new');
      };
    }

    // Importation JSON pour créer la nouvelle affaire
    const fileInp = modal.querySelector('#inpImportBordJsonGlobal');
    if (fileInp) {
      fileInp.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(ev.target.result);
            let sourceData = null;
            if (Array.isArray(parsed) && parsed.length > 0) {
              sourceData = parsed[0].data || parsed[0];
            } else if (parsed && typeof parsed === 'object') {
              sourceData = parsed.data || parsed.affaire || parsed;
            }
            if (!sourceData || !Array.isArray(sourceData.bord) || !sourceData.bord.length) {
              alert('Le fichier importé ne contient aucun bordereau des prix valide.');
              return;
            }
            modal.remove();
            createNewAffaireWithSameBord(sourceData);
          } catch (err) {
            alert('Erreur lors de la lecture du fichier JSON : ' + err.message);
          }
        };
        reader.readAsText(file);
      };
    }
  };

  renderModalContent();
  document.body.appendChild(modal);
}


function askDel() {
  const b = $('#delP');
  if (!b) return;
  if (b.dataset.arm) {
    delP();
    return;
  }
  b.dataset.arm = '1';
  b.textContent = 'Confirmer la suppression ?';
  setTimeout(() => {
    if (b) {
      b.dataset.arm = '';
      b.textContent = '🗑️ Supprimer';
    }
  }, 3500);
}

function delP() {
  const id = P.id;
  plist = plist.filter(x => x.id !== id);
  saveStorage();
  if (plist.length) {
    openP(plist[0].data);
  } else {
    P = blankP('Nouveau dossier');
    touch();
    render();
  }
  toast('Dossier supprimé');
}

function openP(data) {
  P = JSON.parse(JSON.stringify(data));
  mode = 'dossier';
  syncCablesFromBord();
  renderList();
  render();
}

function renderList() {
  const el = $('#plist');
  if (!el) return;
  el.innerHTML = plist.map(x => {
    const pData = x.data || {};
    const pInfo = pData.info || {};
    const numAff = pInfo.num || 'SET/DPO/...';
    const objTitle = pInfo.objet || x.name || 'Dossier sans objet';
    const subMeta = [pInfo.commune, pInfo.typeAff || 'MT/BT'].filter(Boolean).join(' • ');
    return `
      <button class="pitem ${P && P.id === x.id ? 'on' : ''}" data-id="${x.id}" title="${esc(objTitle)}">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:3px">
          <span style="display:inline-block;background:#0d7a5b;color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:monospace">${esc(numAff)}</span>
          <span style="font-size:10px;color:var(--muted)">${x.upd ? new Date(x.upd).toLocaleDateString('fr-FR') : ''}</span>
        </div>
        <b style="display:block;font-size:12.5px;color:var(--ink);line-height:1.25;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(objTitle)}</b>
        ${subMeta ? `<span style="font-size:11px;color:var(--muted)">${esc(subMeta)}</span>` : ''}
      </button>
    `;
  }).join('') || '<div class="empty">Aucun dossier</div>';
  
  el.querySelectorAll('.pitem').forEach(b => {
    b.onclick = () => {
      const f = plist.find(x => x.id === b.dataset.id);
      if (f) openP(f.data);
    };
  });
}

function exportCurrentAffaire() {
  const o = JSON.parse(JSON.stringify(P));
  delete o.example;
  const str = JSON.stringify(o, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safeObj = (P.info.objet || P.name || 'Affaire').replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 60);
  const safeNum = (P.info.num || 'SET_DPO').replace(/[/\\?%*:|"<>]/g, '-').trim();
  a.download = `${safeNum}_${safeObj}.json`;
  a.click();
  toast(`Affaire ${P.info.num || ''} enregistrée par Objet (.json)`);
}

function exportJson() {
  exportCurrentAffaire();
}

function exportAllJson() {
  const str = JSON.stringify(plist, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `SRM_TTA_Sauvegarde_TOUS_Les_Projets_${dateStr}.json`;
  a.click();
  toast(`Sauvegarde complète de tous les projets (${plist.length}) téléchargée`);
}

function exportXlsx() {
  if (typeof XLSX === 'undefined') {
    toast('Bibliothèque Excel non chargée');
    return;
  }
  autoNumberUndefinedPrices(P.bord);
  const wb = XLSX.utils.book_new();
  const i = P.info;
  const e = computeEval();
  
  const head = t => [
    [t],
    ['Objet', ':', i.objet || ''],
    ['Commune', ':', i.commune || ''],
    ['Province', ':', i.province || ''],
    ['Contrat N°', ':', i.contrat || i.devis || ''],
    []
  ];
  
  // 1. Feuille Bordereau avec prix + PRESTATIONS SRM-TTA (T-PRESTATIONS)
  const aoaBord = head('BORDEREAU DES PRIX DETAIL ESTIMATIF');
  aoaBord.push(['N° DE PRIX', 'DESIGNATION DES FOURNITURES ET OUVRAGES', 'CONSISTANCE', 'UNITE', 'QUANTITE', 'PRIX UNITAIRES ( HT )', 'PRIX TOTAUX (HT)']);
  sortLinesByCode(e.b.lines.filter(l => l.on)).forEach(l => {
    aoaBord.push([l.code === '—' ? '' : l.code, l.d, l.c, l.u, l.q, l.pu, l.tot]);
  });
  aoaBord.push(['', '', '', '', '', 'TOTAL', e.b.ht]);
  aoaBord.push(['', '', '', '', '', 'TVA ' + P.tva + '%', e.worksTva]);
  aoaBord.push(['', '', '', '', '', 'TOTAL (G)', e.worksTtc]);
  aoaBord.push(['', 'PRESTATIONS SRM-TTA (T-PRESTATIONS)', '', '', '', '', '']);
  e.pr.forEach(x => {
    aoaBord.push(['', x.name, '', '', x.pu, x.q, x.tot]);
  });
  aoaBord.push([]);
  aoaBord.push(['', '', '', '', '', 'TOTAL HTVA', e.pht]);
  aoaBord.push(['', '', '', '', '', 'TOTAL TTC', e.pttc]);
  aoaBord.push([]);
  aoaBord.push(['', 'TOTAL PRESTATIONS SRM-TTA T.T.C', '', '', '', '', e.pttc]);
  aoaBord.push([]);
  aoaBord.push(['', 'TOTAL GENERAL T.T.C', '', '', '', '', e.total]);
  
  const wsBord = XLSX.utils.aoa_to_sheet(aoaBord);
  XLSX.utils.book_append_sheet(wb, wsBord, 'Bordereau avec prix');
  
  // 2. Feuille Devis sans prix (pour entreprise)
  const aoaDevis = head('BORDEREAU DES PRIX DETAIL ESTIMATIF');
  aoaDevis.push(['N° DE PRIX', 'DESIGNATION DES FOURNITURES ET OUVRAGES', 'CONSISTANCE', 'UNITE', 'QUANTITE', 'PRIX UNITAIRES ( HT )', 'PRIX TOTAUX (HT)']);
  sortLinesByCode(e.b.lines.filter(l => l.on)).forEach(l => {
    aoaDevis.push([l.code === '—' ? '' : l.code, l.d, l.c, l.u, l.q, '', '']);
  });
  aoaDevis.push(['', '', '', '', 'TOTAL', '', '-']);
  aoaDevis.push(['', '', '', '', 'TVA ' + P.tva + '%', '', '-']);
  aoaDevis.push(['', '', '', '', 'TOTAL (G)', '', '-']);
  const wsDevis = XLSX.utils.aoa_to_sheet(aoaDevis);
  XLSX.utils.book_append_sheet(wb, wsDevis, 'Devis sans prix');
  
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ((P.name || 'etude') + '.xlsx').replace(/[^\w\-.]+/g, '_');
  a.click();
  toast('Fichier Excel généré (Bordereau avec prix + Devis sans prix)');
}

/* ===== En-tête de page & KPIs ===== */
function renderHeader() {
  const e = computeEval();
  const typeAff = P.info.typeAff || 'MT/BT';
  const sigAuto = getSignatairePrestations(e.pttc);
  const isDG = sigLevel(e.pttc) > 1;
  const numAff = (P.info && P.info.num) ? P.info.num : 'SET/DPO/...';

  return `
    <div class="card top">
      <div style="flex:1;min-width:280px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
          <button type="button" class="btn pri sm" id="btnBackToSelect" style="font-weight:800;padding:5px 12px" title="Retourner à l'écran de sélection des affaires">
            📂 ⬅️ Changer d'Affaire (Sélection)
          </button>
          <span style="background:var(--brand);color:#fff;font-family:var(--f-m);font-weight:700;font-size:12.5px;padding:3px 10px;border-radius:6px">${esc(numAff)}</span>
          <span class="pill" style="background:#fef3c7;color:#92400e;font-weight:800;border:1px solid #f59e0b">⭐ VERSION PRO · Direction Provinciale d'Ouezzane</span>
          <span class="pill" style="background:#ecfdf5;color:#065f46;font-weight:800;border:1px solid #10b981">👨‍💻 Préparateur : A. DARRAGE</span>
        </div>
        <h2>${esc(P.info.objet || P.name)}</h2>
        <div class="status" style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="pill">${esc(P.info.province || 'Ouezzane')}</span>
          <span class="pill gold">${esc(typeAff)}</span>
          <span class="pill green">${esc(P.info.statut || 'En étude')}</span>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi">
          <span>Travaux HT (${esc(typeAff)})</span>
          <b id="kHT">${fmt(e.b.ht)} DH</b>
        </div>
        <div class="kpi">
          <span>Prestations SRM TTC</span>
          <b id="kPR" style="color:var(--brand)">${fmt(e.pttc)} DH</b>
        </div>
        <div class="kpi total">
          <span>Total Général TTC</span>
          <b id="kTT">${fmt(e.total)} DH</b>
        </div>
        <div class="kpi-sig ${isDG ? 'dg' : ''}">
          <span>Signataire (Prestations ${sigRuleLabel()}) :</span>
          <b>${esc(sigAuto)}</b>
        </div>
      </div>
      
      <div class="bar" style="margin:0">
        <button class="btn ok" id="saveBtn">💾 Enregistrer</button>
        <button class="btn hv" id="actAllAffHeader" title="Actualiser toutes les affaires (câbles, longueurs et consistances)">🔄 Actualiser tout</button>
        <button class="btn" id="xlsx">📊 Exporter Excel</button>
        <button class="btn" id="expJ">📦 JSON</button>
        <button class="btn" id="dupP">📋 Dupliquer</button>
        <button class="btn del" id="delP">🗑️ Supprimer</button>
      </div>
    </div>
  `;
}

function updKpi() {
  const e = computeEval();
  const sigAuto = getSignatairePrestations(e.pttc);
  const isDG = sigLevel(e.pttc) > 1;
  
  const kHT = $('#kHT'); if (kHT) kHT.textContent = fmt(e.b.ht) + ' DH';
  const kPR = $('#kPR'); if (kPR) kPR.textContent = fmt(e.pttc) + ' DH';
  const kTT = $('#kTT'); if (kTT) kTT.textContent = fmt(e.total) + ' DH';
  
  const boxSig = $('.kpi-sig');
  if (boxSig) {
    boxSig.className = 'kpi-sig ' + (isDG ? 'dg' : '');
    boxSig.innerHTML = `<span>Signataire (Prestations ${sigRuleLabel()}) :</span><b>${esc(sigAuto)}</b>`;
  }
}

/* ===== Vue principale ===== */
function render() {
  const m = $('#main');
  if (!m) return;
  
  if (mode === 'affaires') {
    renderAffaires();
    return;
  }

  if (!P || !P.info) {
    if (Array.isArray(plist) && plist.length && plist[0].data) {
      P = plist[0].data;
    } else {
      return;
    }
  }
  
  const typeAff = P.info.typeAff || 'MT/BT';
  const bordLabel = typeAff === 'MT' ? '2 · Bordereau (Ligne MT)' : typeAff === 'BT' ? '2 · Bordereau (Réseau BT)' : '2 · Bordereau (MT + PT + BT)';
  
  const tabs = [
    ['projet', '1 · Projet & Données'],
    ['bord', bordLabel],
    ['prest', '3 · Prestations SRM-TTA'],
    ['docs', '4 · Documents clients'],
    ['cat', '5 · Catalogue des prix'],
    ['recol', '6 · Chiffrage & Attachement']
  ];
  
  m.innerHTML = `
    ${renderHeader()}
    <div class="tabs">
      ${tabs.map(t => `<button class="tab ${tab === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}
    </div>
    <div class="card pane" id="pane"></div>
  `;
  
  m.querySelectorAll('.tab').forEach(b => {
    b.onclick = () => {
      tab = b.dataset.t;
      render();
    };
  });
  
  const backSelBtn = $('#btnBackToSelect');
  if (backSelBtn) backSelBtn.onclick = () => { mode = 'affaires'; render(); };
  $('#saveBtn').onclick = () => { saveStorage(); saveCatalogStorage(false); toast('✅ Dossier et Série des Prix enregistrés définitivement'); };
  const actHdrBtn = $('#actAllAffHeader');
  if (actHdrBtn) actHdrBtn.onclick = () => actualiserToutesLesAffaires(true);
  $('#xlsx').onclick = exportXlsx;
  $('#expJ').onclick = exportJson;
  $('#dupP').onclick = dupP;
  $('#delP').onclick = askDel;
  
  const paneEl = $('#pane');
  if (tab === 'projet') paneProjet(paneEl);
  else if (tab === 'bord') paneBord(paneEl);
  else if (tab === 'prest') panePrest(paneEl);
  else if (tab === 'docs') paneDocs(paneEl);
  else if (tab === 'cat') paneCat(paneEl);
  else if (tab === 'recol') paneRecol(paneEl);
}

/* ===== Onglet 1 : Projet & Données techniques ===== */

function getNormalizedCableOptions(pose, isMT, curVal) {
  const stdList = isMT
    ? ((pose === 'Souterrain') ? CABLES_STANDARDS.mtst : CABLES_STANDARDS.mtar)
    : ((pose === 'Souterrain') ? CABLES_STANDARDS.btst : CABLES_STANDARDS.btar);
  
  const list = [...stdList];
  
  // Ajouter tous les câbles de fourniture du catalogue correspondant à (isMT, pose)
  ARTS.forEach(a => {
    const info = classifyCableArticle({ code: a.code, d: a.d, c: a.c, u: a.u, q: 1 });
    if (info && !info.isPose && info.net === (isMT ? 'MT' : 'BT') && info.pose === pose) {
      if (!list.includes(info.cleanName)) list.push(info.cleanName);
    }
  });
  
  // Si la valeur actuelle (ex: détectée du Bordereau) n'est pas encore dans la liste, l'inclure en tête
  if (curVal && !list.includes(curVal)) {
    list.unshift(curVal);
  }
  
  return list.map(c => `<option value="${esc(c)}" ${curVal === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

function paneProjet(el) {
  syncCablesFromBord();
  const i = P.info;
  const parsedAff = parseAffaireNum(i.num || i.refAffaire) || { num: 100, year: new Date().getFullYear() };
  const affSeq = parsedAff.num;
  const affYear = parsedAff.year;
  if (!i.num) {
    i.num = `SET/DPO/${affSeq}/${affYear}`;
    i.refAffaire = i.num;
  }
  
  const typeAff = i.typeAff || 'MT/BT';
  const mtSite = i.mtSite || 'In-Site';
  
  // Valeurs par défaut si non renseignées
  i.mtPose = i.mtPose || 'Aérien';
  i.btPose = i.btPose || 'Aérien';
  i.mtHsPose = i.mtHsPose || 'Aérien';
  i.mtIsPose = i.mtIsPose || 'Souterrain';
  i.posteType = i.posteType || 'Poste H61';
  
  const f = (k, l, t = 'text', w = '') => `
    <label class="f ${w}">
      ${l}
      <input type="${t}" data-i="${k}" value="${esc(i[k])}">
    </label>
  `;
  
  // Construction du bloc dynamique selon Type d'affaire & Implantation
  let reseauxBlocHtml = '';
  
  if (typeAff === 'MT/BT') {
    // 1. LOTISSEMENT COMPLET
    let mtDetailsHtml = '';
    if (mtSite === 'Les Deux') {
      mtDetailsHtml = `
        <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:10px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:6px">⚡ 1A. Ligne MT Hors-Site (Ligne extérieure) :</div>
          <div class="grid2">
            <label class="f">Mode de pose
              <select id="selMtHsPose" data-i="mtHsPose">
                <option value="Aérien" ${i.mtHsPose === 'Aérien' ? 'selected' : ''}>Aérien</option>
                <option value="Souterrain" ${i.mtHsPose === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
              </select>
            </label>
            <label class="f wide">Nature de Câble MT Hors-Site
              <select id="selMtHsCab" data-i="mtHsCab">
                ${getNormalizedCableOptions(i.mtHsPose, true, i.mtHsCab || (i.mtHsPose === 'Souterrain' ? CABLES_STANDARDS.mtst[0] : CABLES_STANDARDS.mtar[0]))}
              </select>
            </label>
            <label class="f">Longueur MT Hors-Site (m)
              <input type="text" data-i="mtHsL" value="${esc(i.mtHsL || i.mtarL || '')}" placeholder="Ex: 350">
            </label>
          </div>
        </div>
        
        <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:10px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:6px">⚡ 1B. Ligne MT In-Site (Intérieur du lotissement) :</div>
          <div class="grid2">
            <label class="f">Mode de pose
              <select id="selMtIsPose" data-i="mtIsPose">
                <option value="Aérien" ${i.mtIsPose === 'Aérien' ? 'selected' : ''}>Aérien</option>
                <option value="Souterrain" ${i.mtIsPose === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
              </select>
            </label>
            <label class="f wide">Nature de Câble MT In-Site
              <select id="selMtIsCab" data-i="mtIsCab">
                ${getNormalizedCableOptions(i.mtIsPose, true, i.mtIsCab || (i.mtIsPose === 'Souterrain' ? CABLES_STANDARDS.mtst[0] : CABLES_STANDARDS.mtar[0]))}
              </select>
            </label>
            <label class="f">Longueur MT In-Site (m)
              <input type="text" data-i="mtIsL" value="${esc(i.mtIsL || i.mtstL || '')}" placeholder="Ex: 200">
            </label>
          </div>
        </div>
      `;
    } else {
      // In-Site seul ou Hors-Site seul (avec séparation propre Aérien et Souterrain)
      const hasBothMt = i.mtPose === 'Aérien et Souterrain' || (num(i.mtarL) > 0 && num(i.mtstL) > 0);
      const curMtPose = hasBothMt ? 'Aérien et Souterrain' : (i.mtPose || 'Aérien');

      let mtFieldsInner = '';
      if (hasBothMt) {
        mtFieldsInner = `
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px;margin-bottom:8px">
            <div style="font-weight:700;color:#166534;margin-bottom:6px">🪵 Tronçon MT Aérien :</div>
            <div class="grid2">
              <label class="f wide">Nature de Câble MT Aérien
                <select id="selMtarCab" data-i="mtarCab">
                  ${getNormalizedCableOptions('Aérien', true, i.mtarCab || CABLES_STANDARDS.mtar[0])}
                </select>
              </label>
              <label class="f">Longueur MT Aérien (m)
                <input type="text" data-i="mtarL" value="${esc(i.mtarL || '')}" placeholder="Ex: 150">
              </label>
            </div>
          </div>
          <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;padding:10px">
            <div style="font-weight:700;color:#1e40af;margin-bottom:6px">⚡ Liaison MT Souterraine :</div>
            <div class="grid2">
              <label class="f wide">Nature de Câble MT Souterrain
                <select id="selMtstCab" data-i="mtstCab">
                  ${getNormalizedCableOptions('Souterrain', true, i.mtstCab || CABLES_STANDARDS.mtst[0])}
                </select>
              </label>
              <label class="f">Longueur MT Souterrain (m)
                <input type="text" data-i="mtstL" value="${esc(i.mtstL || '')}" placeholder="Ex: 600">
              </label>
            </div>
          </div>
        `;
      } else if (curMtPose === 'Souterrain') {
        mtFieldsInner = `
          <div class="grid2">
            <label class="f wide">Nature de Câble MT Souterrain
              <select id="selMtCab" data-i="mtstCab">
                ${getNormalizedCableOptions('Souterrain', true, i.mtstCab || CABLES_STANDARDS.mtst[0])}
              </select>
            </label>
            <label class="f">Longueur MT Souterrain (m)
              <input type="text" data-i="mtstL" value="${esc(i.mtstL || i.mtL || '')}" placeholder="Ex: 500">
            </label>
          </div>
        `;
      } else {
        mtFieldsInner = `
          <div class="grid2">
            <label class="f wide">Nature de Câble MT Aérien
              <select id="selMtCab" data-i="mtarCab">
                ${getNormalizedCableOptions('Aérien', true, i.mtarCab || CABLES_STANDARDS.mtar[0])}
              </select>
            </label>
            <label class="f">Longueur MT Aérien (m)
              <input type="text" data-i="mtarL" value="${esc(i.mtarL || i.mtL || '')}" placeholder="Ex: 300">
            </label>
          </div>
        `;
      }

      mtDetailsHtml = `
        <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div style="font-weight:700;color:#1e40af">⚡ 1. Ligne MT (${mtSite}) :</div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;font-weight:700;color:var(--muted)">Mode de pose :</span>
              <select id="selMtPose" data-i="mtPose" style="font-size:12.5px;font-weight:700;padding:3px 8px;border-radius:4px;border:1.5px solid #93c5fd;color:#1e40af">
                <option value="Aérien" ${curMtPose === 'Aérien' ? 'selected' : ''}>Aérien</option>
                <option value="Souterrain" ${curMtPose === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
                <option value="Aérien et Souterrain" ${curMtPose === 'Aérien et Souterrain' ? 'selected' : ''}>Mixte (Aérien + Souterrain)</option>
              </select>
            </div>
          </div>
          ${mtFieldsInner}
        </div>
      `;
    }
    
    // Partie 2 : Poste de Transformation & Partie 3 : BT
    const curBtCab = i.btPose === 'Souterrain' ? (i.btstCab || CABLES_STANDARDS.btst[0]) : (i.btarCab || CABLES_STANDARDS.btar[0]);
    const curBtL = i.btL || (i.btPose === 'Souterrain' ? i.btstL : i.btarL) || '';
    
    reseauxBlocHtml = `
      <div style="font-size:12px;color:#1e40af;background:#dbeafe;padding:6px 10px;border-radius:6px;margin-bottom:10px">📍 Implantation MT : <b>${esc(mtSite)}</b> — modifiable via le sélecteur d'état <b>In site / Hors site / vide</b> du Réseau MT ci-dessus.</div>

      ${mtDetailsHtml}
      
      <!-- Partie 2 : Poste Transfo -->
      <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:10px">
        <div style="font-weight:700;color:#1e40af;margin-bottom:6px">🏢 2. Poste de Transformation MT/BT (PT) :</div>
        <div class="grid2">
          <label class="f">Type de poste
            <select data-i="posteType">
              <option value="Poste H61" ${i.posteType === 'Poste H61' ? 'selected' : ''}>Poste H61 (sur poteau)</option>
              <option value="Cabine" ${i.posteType === 'Cabine' ? 'selected' : ''}>Cabine (maçonnée / préfabriquée)</option>
            </select>
          </label>
          <label class="f">Puissance transformateur
            <select data-i="puissance">
              <option value="50" ${i.puissance == 50 ? 'selected' : ''}>50 kVA</option>
              <option value="100" ${i.puissance == 100 ? 'selected' : ''}>100 kVA</option>
              <option value="160" ${i.puissance == 160 ? 'selected' : ''}>160 kVA</option>
              <option value="250" ${i.puissance == 250 ? 'selected' : ''}>250 kVA</option>
              <option value="400" ${i.puissance == 400 ? 'selected' : ''}>400 kVA</option>
              <option value="630" ${i.puissance == 630 ? 'selected' : ''}>630 kVA</option>
            </select>
          </label>
          ${f('poste', 'Matricule / Nom du poste')}
        </div>
      </div>
      
      <!-- Partie 3 : Réseau Basse Tension BT (avec séparation propre Aérien et Souterrain) -->
      ${(() => {
        const hasBothBt = i.btPose === 'Aérien et Souterrain' || (num(i.btarL) > 0 && num(i.btstL) > 0);
        const curBtPose = hasBothBt ? 'Aérien et Souterrain' : (i.btPose || 'Aérien');

        let btFieldsInner = '';
        if (hasBothBt) {
          btFieldsInner = `
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px;margin-bottom:8px">
              <div style="font-weight:700;color:#166534;margin-bottom:6px">🔌 Réseau BT Aérien :</div>
              <div class="grid2">
                <label class="f wide">Nature de Câble BT Aérien
                  <select id="selBtarCab" data-i="btarCab">
                    ${getNormalizedCableOptions('Aérien', false, i.btarCab || CABLES_STANDARDS.btar[0])}
                  </select>
                </label>
                <label class="f">Longueur BT Aérien (m)
                  <input type="text" data-i="btarL" value="${esc(i.btarL || '')}" placeholder="Ex: 250">
                </label>
              </div>
            </div>
            <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;padding:10px">
              <div style="font-weight:700;color:#1e40af;margin-bottom:6px">⚡ Réseau BT Souterrain :</div>
              <div class="grid2">
                <label class="f wide">Nature de Câble BT Souterrain
                  <select id="selBtstCab" data-i="btstCab">
                    ${getNormalizedCableOptions('Souterrain', false, i.btstCab || CABLES_STANDARDS.btst[0])}
                  </select>
                </label>
                <label class="f">Longueur BT Souterrain (m)
                  <input type="text" data-i="btstL" value="${esc(i.btstL || '')}" placeholder="Ex: 300">
                </label>
              </div>
            </div>
          `;
        } else if (curBtPose === 'Souterrain') {
          btFieldsInner = `
            <div class="grid2">
              <label class="f wide">Nature de Câble BT Souterrain
                <select id="selBtCab" data-i="btstCab">
                  ${getNormalizedCableOptions('Souterrain', false, i.btstCab || CABLES_STANDARDS.btst[0])}
                </select>
              </label>
              <label class="f">Longueur Réseau BT Souterrain (m)
                <input type="text" data-i="btstL" value="${esc(i.btstL || i.btL || '')}" placeholder="Ex: 250">
              </label>
            </div>
          `;
        } else {
          btFieldsInner = `
            <div class="grid2">
              <label class="f wide">Nature de Câble BT Aérien
                <select id="selBtCab" data-i="btarCab">
                  ${getNormalizedCableOptions('Aérien', false, i.btarCab || CABLES_STANDARDS.btar[0])}
                </select>
              </label>
              <label class="f">Longueur Réseau BT Aérien (m)
                <input type="text" data-i="btarL" value="${esc(i.btarL || i.btL || '')}" placeholder="Ex: 250">
              </label>
            </div>
          `;
        }

        return `
          <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
              <div style="font-weight:700;color:#1e40af">🔌 3. Réseau Basse Tension BT :</div>
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:12px;font-weight:700;color:var(--muted)">Mode de pose BT :</span>
                <select id="selBtPose" data-i="btPose" style="font-size:12.5px;font-weight:700;padding:3px 8px;border-radius:4px;border:1.5px solid #93c5fd;color:#1e40af">
                  <option value="Aérien" ${curBtPose === 'Aérien' ? 'selected' : ''}>Aérien</option>
                  <option value="Souterrain" ${curBtPose === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
                  <option value="Aérien et Souterrain" ${curBtPose === 'Aérien et Souterrain' ? 'selected' : ''}>Mixte (Aérien + Souterrain)</option>
                </select>
              </div>
            </div>
            ${btFieldsInner}
          </div>
        `;
      })()}
    `;
  } else if (typeAff === 'MT') {
    // 2. LIGNE MT SEULE (avec séparation propre Aérien et Souterrain)
    const hasBothMt = i.mtPose === 'Aérien et Souterrain' || (num(i.mtarL) > 0 && num(i.mtstL) > 0);
    const curMtPose = hasBothMt ? 'Aérien et Souterrain' : (i.mtPose || 'Aérien');

    let mtOnlyInner = '';
    if (hasBothMt) {
      mtOnlyInner = `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px;margin-bottom:8px">
          <div style="font-weight:700;color:#166534;margin-bottom:6px">🪵 Tronçon MT Aérien :</div>
          <div class="grid2">
            <label class="f wide">Nature de Câble MT Aérien
              <select id="selMtarCab" data-i="mtarCab">
                ${getNormalizedCableOptions('Aérien', true, i.mtarCab || CABLES_STANDARDS.mtar[0])}
              </select>
            </label>
            <label class="f">Longueur MT Aérien (m)
              <input type="text" data-i="mtarL" value="${esc(i.mtarL || '')}" placeholder="Ex: 150">
            </label>
          </div>
        </div>
        <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;padding:10px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:6px">⚡ Liaison MT Souterraine :</div>
          <div class="grid2">
            <label class="f wide">Nature de Câble MT Souterrain
              <select id="selMtstCab" data-i="mtstCab">
                ${getNormalizedCableOptions('Souterrain', true, i.mtstCab || CABLES_STANDARDS.mtst[0])}
              </select>
            </label>
            <label class="f">Longueur MT Souterrain (m)
              <input type="text" data-i="mtstL" value="${esc(i.mtstL || '')}" placeholder="Ex: 600">
            </label>
          </div>
        </div>
      `;
    } else if (curMtPose === 'Souterrain') {
      mtOnlyInner = `
        <div class="grid2">
          <label class="f wide">Nature de Câble MT Souterrain
            <select id="selMtCab" data-i="mtstCab">
              ${getNormalizedCableOptions('Souterrain', true, i.mtstCab || CABLES_STANDARDS.mtst[0])}
            </select>
          </label>
          <label class="f">Longueur Ligne MT Souterraine (m)
            <input type="text" data-i="mtstL" value="${esc(i.mtstL || i.mtL || '')}" placeholder="Ex: 500">
          </label>
        </div>
      `;
    } else {
      mtOnlyInner = `
        <div class="grid2">
          <label class="f wide">Nature de Câble MT Aérien
            <select id="selMtCab" data-i="mtarCab">
              ${getNormalizedCableOptions('Aérien', true, i.mtarCab || CABLES_STANDARDS.mtar[0])}
            </select>
          </label>
          <label class="f">Longueur Ligne MT Aérienne (m)
            <input type="text" data-i="mtarL" value="${esc(i.mtarL || i.mtL || '')}" placeholder="Ex: 500">
          </label>
        </div>
      `;
    }

    reseauxBlocHtml = `
      <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700;color:#1e40af">⚡ Ligne Moyenne Tension MT seule :</div>
          <div style="display:flex;align-items:center;gap:10px">
            <label class="f" style="margin:0;flex-direction:row;align-items:center;gap:4px">
              <span style="font-size:12px;font-weight:700;color:var(--muted)">Implantation :</span>
              <select data-i="mtSite" style="font-size:12px;padding:2px 6px">
                <option value="In-Site" ${i.mtSite === 'In-Site' ? 'selected' : ''}>In-Site</option>
                <option value="Hors-Site" ${i.mtSite === 'Hors-Site' ? 'selected' : ''}>Hors-Site</option>
              </select>
            </label>
            <label class="f" style="margin:0;flex-direction:row;align-items:center;gap:4px">
              <span style="font-size:12px;font-weight:700;color:var(--muted)">Pose :</span>
              <select id="selMtPose" data-i="mtPose" style="font-size:12px;font-weight:700;padding:2px 6px;border-radius:4px;border:1.5px solid #93c5fd;color:#1e40af">
                <option value="Aérien" ${curMtPose === 'Aérien' ? 'selected' : ''}>Aérien</option>
                <option value="Souterrain" ${curMtPose === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
                <option value="Aérien et Souterrain" ${curMtPose === 'Aérien et Souterrain' ? 'selected' : ''}>Mixte (Aérien + Souterrain)</option>
              </select>
            </label>
          </div>
        </div>
        ${mtOnlyInner}
      </div>
    `;
  } else {
    // 3. LIGNE BT SEULE (avec séparation propre Aérien et Souterrain)
    const hasBothBt = i.btPose === 'Aérien et Souterrain' || (num(i.btarL) > 0 && num(i.btstL) > 0);
    const curBtPose = hasBothBt ? 'Aérien et Souterrain' : (i.btPose || 'Aérien');

    let btOnlyInner = '';
    if (hasBothBt) {
      btOnlyInner = `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px;margin-bottom:8px">
          <div style="font-weight:700;color:#166534;margin-bottom:6px">🔌 Réseau BT Aérien :</div>
          <div class="grid2">
            <label class="f wide">Nature de Câble BT Aérien
              <select id="selBtarCab" data-i="btarCab">
                ${getNormalizedCableOptions('Aérien', false, i.btarCab || CABLES_STANDARDS.btar[0])}
              </select>
            </label>
            <label class="f">Longueur BT Aérien (m)
              <input type="text" data-i="btarL" value="${esc(i.btarL || '')}" placeholder="Ex: 250">
            </label>
          </div>
        </div>
        <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;padding:10px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:6px">⚡ Réseau BT Souterrain :</div>
          <div class="grid2">
            <label class="f wide">Nature de Câble BT Souterrain
              <select id="selBtstCab" data-i="btstCab">
                ${getNormalizedCableOptions('Souterrain', false, i.btstCab || CABLES_STANDARDS.btst[0])}
              </select>
            </label>
            <label class="f">Longueur BT Souterrain (m)
              <input type="text" data-i="btstL" value="${esc(i.btstL || '')}" placeholder="Ex: 300">
            </label>
          </div>
        </div>
      `;
    } else if (curBtPose === 'Souterrain') {
      btOnlyInner = `
        <div class="grid2">
          <label class="f wide">Nature de Câble BT Souterrain
            <select id="selBtCab" data-i="btstCab">
              ${getNormalizedCableOptions('Souterrain', false, i.btstCab || CABLES_STANDARDS.btst[0])}
            </select>
          </label>
          <label class="f">Longueur Ligne BT Souterraine (m)
            <input type="text" data-i="btstL" value="${esc(i.btstL || i.btL || '')}" placeholder="Ex: 300">
          </label>
        </div>
      `;
    } else {
      btOnlyInner = `
        <div class="grid2">
          <label class="f wide">Nature de Câble BT Aérien
            <select id="selBtCab" data-i="btarCab">
              ${getNormalizedCableOptions('Aérien', false, i.btarCab || CABLES_STANDARDS.btar[0])}
            </select>
          </label>
          <label class="f">Longueur Ligne BT Aérienne (m)
            <input type="text" data-i="btarL" value="${esc(i.btarL || i.btL || '')}" placeholder="Ex: 300">
          </label>
        </div>
      `;
    }

    reseauxBlocHtml = `
      <div style="background:#fff;padding:12px;border:1px solid #bfdbfe;border-radius:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700;color:#1e40af">🔌 Ligne / Réseau Basse Tension BT seul :</div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;font-weight:700;color:var(--muted)">Mode de pose BT :</span>
            <select id="selBtPose" data-i="btPose" style="font-size:12px;font-weight:700;padding:2px 6px;border-radius:4px;border:1.5px solid #93c5fd;color:#1e40af">
              <option value="Aérien" ${curBtPose === 'Aérien' ? 'selected' : ''}>Aérien</option>
              <option value="Souterrain" ${curBtPose === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
              <option value="Aérien et Souterrain" ${curBtPose === 'Aérien et Souterrain' ? 'selected' : ''}>Mixte (Aérien + Souterrain)</option>
            </select>
          </div>
        </div>
        ${btOnlyInner}
      </div>
    `;
  }
  
  el.innerHTML = `
    <div class="form-sec">
      <div class="form-sec-title">
        <span>Identification de l'affaire</span>
        <span class="pill" id="affTitleBadge">${esc(P.name || i.objet || 'Sans objet')}</span>
      </div>

      ${(!P.bord || !P.bord.length) ? `
        <div style="background:#eff6ff;border:1.5px solid #3b82f6;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">📋</span>
            <div>
              <div style="font-size:13.5px;font-weight:700;color:#1e40af">Cette affaire n'a pas encore de Bordereau des prix</div>
              <div style="font-size:12px;color:#3b82f6">Gagnez du temps : vous pouvez reprendre immédiatement le Bordereau d'une affaire déjà faite !</div>
            </div>
          </div>
          <button class="btn ok sm" id="btnProjetPickBord" style="font-weight:700;font-size:12.5px;padding:6px 14px">📋 Reprendre un Bordereau déjà fait</button>
        </div>
      ` : ''}
      
      <!-- Bloc N° Affaire Normalisé SET/DPO/[N°]/[Année] -->
      <div style="background:#f0fdf4;padding:12px 14px;border:1.5px solid #86efac;border-radius:8px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="color:#166534;font-size:14px;font-weight:700">🏷️ N° d'Affaire Officiel (Format SRM-TTA : SET/DPO/[N°]/[Année])</span>
          <span class="badge" id="badgeAffNum" style="background:#15803d;color:#fff;font-weight:800;font-size:13px;padding:3px 10px;border-radius:4px;font-family:monospace">${esc(i.num || 'SET/DPO/100/2026')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="background:#dcfce7;color:#166534;font-weight:800;font-family:monospace;font-size:15px;padding:8px 14px;border-radius:6px;border:1px solid #86efac;user-select:none">
            SET/DPO/
          </div>
          <input type="number" id="affSeq" style="width:110px;font-weight:800;font-size:16px;color:#166534;text-align:center;padding:8px" value="${affSeq}" min="1" step="1" title="Numéro d'affaire (ex: 100, 101...)">
          <span style="font-weight:800;font-size:20px;color:#166534">/</span>
          <input type="number" id="affYear" style="width:95px;font-weight:800;font-size:16px;color:#166534;text-align:center;padding:8px" value="${affYear}" min="2020" max="2050" step="1" title="Année de l'affaire">
          <div style="flex:1;min-width:220px">
            <input type="text" id="affNumFull" data-i="num" value="${esc(i.num)}" style="width:100%;font-family:monospace;font-weight:700;color:#166534;padding:8px 10px" placeholder="SET/DPO/..." title="Référence complète de l'affaire">
          </div>
        </div>
        <small style="color:#15803d;margin-top:6px;display:block;font-size:11.5px">
          Préfixe fixe <b>SET/DPO/</b> • Numéro et Année modifiables librement • Prochaine affaire auto-incrémentée automatiquement (+1)
        </small>
      </div>

      <!-- Bloc Objet du projet -->
      <div style="background:#f8fafc;padding:12px 14px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:14px">
        <label style="display:block;font-weight:700;color:var(--brand);font-size:13.5px;margin-bottom:4px">
          📝 Intitulé / Objet du projet (Enregistrement principal & Titre officiel de l'étude) :
          <textarea rows="2" data-i="objet" id="projObjet" style="font-weight:700;font-size:13.5px;color:var(--ink);width:100%;margin-top:5px;border-color:#94a3b8" placeholder="Ex: Électrification du Lotissement (Ligne MT In-Site, Poste H61 et Réseau BT)...">${esc(i.objet)}</textarea>
        </label>
        <small style="color:var(--muted);font-size:11px">Le dossier est automatiquement sauvegardé et identifié par cet Objet dans la liste des affaires.</small>
      </div>

      <!-- Type d'affaire Principal : sélection multiple MT / PT / BT × In-Site / Hors-Site -->
      ${renderNetSelWidget(i)}

      <div class="grid2">
        ${f('demande', 'N° Demande')}
        ${f('dateDemande', 'Date de demande', 'date')}
        ${f('contrat', 'N° Contrat')}
        ${f('devis', 'N° Devis')}
        ${f('date', "Date de l'étude", 'date')}
        <label class="f">Province
          <select data-i="province" id="selProvince">
            <option value="Ouezzane" ${i.province === 'Ouezzane' ? 'selected' : ''}>Ouezzane</option>
            <option value="Tanger" ${i.province === 'Tanger' ? 'selected' : ''}>Tanger</option>
            <option value="Tétouan" ${i.province === 'Tétouan' ? 'selected' : ''}>Tétouan</option>
            <option value="Larache" ${i.province === 'Larache' ? 'selected' : ''}>Larache</option>
            <option value="Chefchaouen" ${i.province === 'Chefchaouen' ? 'selected' : ''}>Chefchaouen</option>
            <option value="Al Hoceima" ${i.province === 'Al Hoceima' ? 'selected' : ''}>Al Hoceima</option>
          </select>
        </label>
        <label class="f" style="border-left:3px solid #0d7a5b;padding-left:8px;background:#f0fdf4">
          Situation du projet (Ville / Emplacement)
          <input type="text" data-i="situationProjet" id="inpSituationProjet" value="${esc(i.situationProjet || i.province || 'Ouezzane')}" placeholder="Ex: Ouezzane, Centre-ville, Douar...">
        </label>
        ${f('commune', 'Commune / Municipalité')}
        ${f('village', 'Village / Douar')}
        ${f('destinataire', 'Partenaire / Demandeur / Client', 'text', 'wide')}
        ${f('intitulePartenaire', 'Intitulé Partenaire (ex: Ouezzane)')}
        ${f('adresseCorresp', 'Adresse de correspondance', 'text', 'wide')}
      </div>
    </div>
    
    <!-- Structure des Réseaux & Natures de Câbles Normalisées -->
    <div class="form-sec">
      <div class="form-sec-title">
        <span>Structure des Réseaux & Natures de Câbles Normalisées</span>
      </div>
      ${reseauxBlocHtml}
    </div>
    
    <div class="form-sec">
      <div class="form-sec-title">
        <span>Origine électrique, Matricule du Poste & Indications</span>
      </div>
      <div class="grid2">
        <label class="f">Nature du projet
          <select data-i="natProjet" style="font-weight:700;color:#1e40af">
            <option value="Morcellement/Lotissement" ${(!i.natProjet || i.natProjet === 'Morcellement/Lotissement') ? 'selected' : ''}>Morcellement/Lotissement</option>
            <option value="Unité Industrielle/Agricole" ${i.natProjet === 'Unité Industrielle/Agricole' ? 'selected' : ''}>Unité Industrielle/Agricole</option>
            <option value="Propriété" ${i.natProjet === 'Propriété' ? 'selected' : ''}>Propriété</option>
          </select>
        </label>
        <label class="f">Nature de la zone
          <select data-i="zone">
            <option value="Rurale" ${i.zone === 'Rurale' ? 'selected' : ''}>Rurale</option>
            <option value="Urbaine" ${i.zone === 'Urbaine' ? 'selected' : ''}>Urbaine</option>
            <option value="Périurbaine" ${i.zone === 'Périurbaine' ? 'selected' : ''}>Périurbaine</option>
          </select>
        </label>
        <label class="f">Puissance demandée (kVA)
          <input type="text" data-i="puissance" value="${esc(i.puissance || '')}" placeholder="Ex: 50, 100, 160...">
        </label>
        <label class="f">Terrain traversé
          <select data-i="terrain">
            <option value="Emprise de voie publique" ${i.terrain === 'Emprise de voie publique' ? 'selected' : ''}>Emprise de voie publique</option>
            <option value="Privé" ${i.terrain === 'Privé' ? 'selected' : ''}>Privé</option>
            <option value="Demandeur" ${i.terrain === 'Demandeur' ? 'selected' : ''}>Terrain du demandeur</option>
          </select>
        </label>
        <label class="f">Origine du branchement
          <select data-i="origineType">
            <option value="Aérien" ${i.origineType === 'Aérien' ? 'selected' : ''}>Aérien</option>
            <option value="Souterrain" ${i.origineType === 'Souterrain' ? 'selected' : ''}>Souterrain</option>
          </select>
        </label>
        ${f('supportOrigine', 'Support ou Boîte de dérivation origine')}
        <label class="f" style="border-left:3px solid #0d7a5b;padding-left:8px;background:#f0fdf4">
          Matricule du Poste (Tableau II)
          <input type="text" data-i="matriculePoste" id="inpMatriculePoste" value="${esc(i.matriculePoste || i.poste || '')}" placeholder="Ex: Ain Dorrij PT2 N3F-808-22D">
        </label>
        <label class="f wide">
          Indications supplémentaires (Section IV)
          <textarea rows="2" data-i="indications" id="inpIndications" placeholder="Ex: Précisions sur le tracé, autorisations riverains, remarques...">${esc(i.indications || '')}</textarea>
        </label>
        ${f('participation', 'Participation')}
        ${f('benef', 'Bénéficiaire(s)')}
        ${f('refReglement', 'Réf. règlement de forfait')}
      </div>
    </div>
    
    <!-- Bloc Message du client pour Évaluation des Travaux SRM -->
    <div class="form-sec" style="background:#fefce8;border:1.5px solid #fde047">
      <div class="form-sec-title" style="color:#854d0e;border-color:#fde047">
        <span>💬 Message du client (Évaluation des Travaux SRM)</span>
        <span class="pill" style="background:#fef08a;color:#854d0e;font-weight:700">Imprimé sous le montant de « Év. travaux SRM »</span>
      </div>
      <div style="padding:10px 4px 4px 4px">
        <label style="display:block;font-weight:700;color:#854d0e;font-size:13px;margin-bottom:6px">
          Saisir ici le message du client (affiché dans le document Év. travaux SRM) :
        </label>
        <textarea rows="3" data-i="messageClient" id="projMessageClient" style="font-weight:600;font-size:13px;color:#1e293b;width:100%;border:1.5px solid #ca8a04;padding:8px 10px;border-radius:6px;background:#fff;line-height:1.45" placeholder="Saisir ici le message ou observations destinées au client (ex: Travaux de génie civil et tranchées à la charge du client, poste transformateur à fournir par le client, délais de réalisation...)...">${esc(i.messageClient || '')}</textarea>
        <small style="color:#a16207;font-size:11.5px;display:block;margin-top:6px">
          Ce message sera automatiquement imprimé et affiché en bas du document <b>05 · Évaluation des travaux SRM</b>, juste sous la somme en toutes lettres.
        </small>
      </div>
    </div>
    
    <div class="form-sec">
      <div class="form-sec-title">
        <span>Paramètres financiers & Suivi</span>
      </div>
      <div class="grid2">
        <label class="f">Taux de TVA (%)
          <input type="number" id="tva" value="${P.tva}">
        </label>
        <label class="f">Peines et soins (% des travaux HT)
          <input type="number" id="peines" value="${P.peines}">
        </label>
        <label class="f">Statut du dossier
          <select data-i="statut">
            ${STATUTS.map(s => `<option value="${s}" ${i.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        ${f('refAffaire', 'Réf. affaire interne (ex: SET/DPO/100/2026)')}
        ${f('dpDate', 'Date validation DP', 'date')}
        ${f('dclTransmis', 'Date transmission DCL', 'date')}
        ${f('dclDate', 'Date validation DCL', 'date')}
        ${f('dgDate', 'Date validation DG', 'date')}
        ${f('dateReglement', 'Date règlement client', 'date')}
      </div>
    </div>
  `;
  
  // Événements Radio Type d'Affaire
  el.querySelectorAll('input[name="radTypeAff"]').forEach(rad => {
    rad.onchange = () => {
      setTypeAff(rad.value);
    };
  });
  
  // Sélection multiple Réseaux / Implantation / Ordre des sections
  bindNetSelWidget(el);
  
  // Événements Radio Implantation MT
  el.querySelectorAll('input[name="radMtSite"]').forEach(rad => {
    rad.onchange = () => {
      P.info.mtSite = rad.value;
      touch();
      updKpi();
      paneProjet(el);
      toast(`Implantation MT définie sur : ${rad.value}`);
    };
  });
  
  // Changement dynamique du mode de pose MT -> actualiser et réafficher les champs séparés
  const selMtPose = el.querySelector('#selMtPose');
  if (selMtPose) {
    selMtPose.onchange = () => {
      P.info.mtPose = selMtPose.value;
      touch();
      updKpi();
      paneProjet(el);
    };
  }

  const selBtPose = el.querySelector('#selBtPose');
  if (selBtPose) {
    selBtPose.onchange = () => {
      P.info.btPose = selBtPose.value;
      touch();
      updKpi();
      paneProjet(el);
    };
  }
  
  const selMtHsPose = el.querySelector('#selMtHsPose');
  if (selMtHsPose) {
    selMtHsPose.onchange = () => {
      P.info.mtHsPose = selMtHsPose.value;
      const cabSel = el.querySelector('#selMtHsCab');
      if (cabSel) {
        const isSt = selMtHsPose.value === 'Souterrain';
        cabSel.innerHTML = getNormalizedCableOptions(selMtHsPose.value, true, isSt ? CABLES_STANDARDS.mtst[0] : CABLES_STANDARDS.mtar[0]);
        P.info.mtHsCab = cabSel.value;
      }
      touch();
      updKpi();
    };
  }
  
  const selMtIsPose = el.querySelector('#selMtIsPose');
  if (selMtIsPose) {
    selMtIsPose.onchange = () => {
      P.info.mtIsPose = selMtIsPose.value;
      const cabSel = el.querySelector('#selMtIsCab');
      if (cabSel) {
        const isSt = selMtIsPose.value === 'Souterrain';
        cabSel.innerHTML = getNormalizedCableOptions(selMtIsPose.value, true, isSt ? CABLES_STANDARDS.mtst[0] : CABLES_STANDARDS.mtar[0]);
        P.info.mtIsCab = cabSel.value;
      }
      touch();
      updKpi();
    };
  }
  

  
  el.querySelectorAll('[data-i]').forEach(x => {
    x.oninput = () => {
      P.info[x.dataset.i] = x.value;
      if (x.dataset.i === 'matriculePoste') {
        P.info.poste = x.value;
      }
      if (x.dataset.i === 'province') {
        if (x.value === 'Ouezzane' || x.value === 'Tanger') {
          P.doc.ville = x.value;
        }
        if (!P.info.situationProjet || P.info.situationProjet === 'Ouezzane' || P.info.situationProjet === 'Tanger' || P.info.situationProjet === 'Tétouan' || P.info.situationProjet === 'Larache' || P.info.situationProjet === 'Chefchaouen' || P.info.situationProjet === 'Al Hoceima') {
          P.info.situationProjet = x.value;
          const sitInp = $('#inpSituationProjet');
          if (sitInp) sitInp.value = x.value;
        }
      }
      touch();
      updKpi();
    };
    x.onchange = () => {
      P.info[x.dataset.i] = x.value;
      if (x.dataset.i === 'matriculePoste') {
        P.info.poste = x.value;
      }
      touch();
      updKpi();
    };
  });
  
  const updateAffaireNum = (seq, yr) => {
    const s = String(seq || '100').trim();
    const y = String(yr || new Date().getFullYear()).trim();
    P.info.num = `SET/DPO/${s}/${y}`;
    P.info.refAffaire = P.info.num;
    const fullInp = $('#affNumFull');
    if (fullInp) fullInp.value = P.info.num;
    const badge = $('#badgeAffNum');
    if (badge) badge.textContent = P.info.num;
    touch();
    renderList();
  };
  
  const seqInp = $('#affSeq');
  const yrInp = $('#affYear');
  if (seqInp && yrInp) {
    seqInp.oninput = () => updateAffaireNum(seqInp.value, yrInp.value);
    yrInp.oninput = () => updateAffaireNum(seqInp.value, yrInp.value);
  }
  
  const fullInp = $('#affNumFull');
  if (fullInp) {
    fullInp.oninput = () => {
      P.info.num = fullInp.value;
      P.info.refAffaire = fullInp.value;
      const parsed = parseAffaireNum(fullInp.value);
      if (parsed) {
        if (seqInp) seqInp.value = parsed.num;
        if (yrInp) yrInp.value = parsed.year;
      }
      const badge = $('#badgeAffNum');
      if (badge) badge.textContent = P.info.num;
      touch();
      renderList();
    };
  }
  
  const objInp = $('#projObjet');
  if (objInp) {
    objInp.oninput = () => {
      P.info.objet = objInp.value;
      P.name = objInp.value.trim() || 'Dossier sans objet';
      touch();
      renderList();
      const mainH2 = $('#main h2');
      if (mainH2) mainH2.textContent = P.name;
      const bTitle = $('#affTitleBadge');
      if (bTitle) bTitle.textContent = P.name;
    };
  }
  
  $('#tva').oninput = e => { P.tva = num(e.target.value); touch(); updKpi(); };
  $('#peines').oninput = e => { P.peines = num(e.target.value); touch(); updKpi(); };
}

/* ===== Onglet 2 : Bordereau des prix (Affichage dynamique MT / BT / MT+PT+BT) ===== */

function renderBordCablesBanner() {
  if (!P || !P.info) return '';
  syncCablesFromBord();
  const i = P.info;
  const typeAff = i.typeAff || 'MT/BT';
  const mtSite = i.mtSite || 'In-Site';
  const badges = [];
  
  if (typeAff === 'MT' || typeAff === 'MT/BT' || getActiveBordCables(P).some(c => c.net === 'MT')) {
    if (mtSite === 'Les Deux') {
      const hsL = num(i.mtHsL) || num(i.mtarL) || 0;
      const hsCab = i.mtHsCab || i.mtarCab || '—';
      badges.push(`<div style="background:#eff6ff;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:12.5px">
        <b style="color:#1e40af">⚡ MT Hors-Site (${esc(i.mtHsPose || 'Aérien')}) :</b> ${esc(hsCab)} &bull; <b style="color:#15803d">Longueur : ${fmt(hsL)} m</b>
      </div>`);
      const isL = num(i.mtIsL) || num(i.mtstL) || 0;
      const isCab = i.mtIsCab || i.mtstCab || '—';
      badges.push(`<div style="background:#eff6ff;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:12.5px">
        <b style="color:#1e40af">⚡ MT In-Site (${esc(i.mtIsPose || 'Souterrain')}) :</b> ${esc(isCab)} &bull; <b style="color:#15803d">Longueur : ${fmt(isL)} m</b>
      </div>`);
    } else {
      const arL = num(i.mtarL);
      const stL = num(i.mtstL);
      if (arL > 0) {
        badges.push(`<div style="background:#eff6ff;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:12.5px">
          <b style="color:#1e40af">⚡ Ligne MT Aérienne (${esc(mtSite)}) :</b> ${esc(i.mtarCab || CABLES_STANDARDS.mtar[0])} &bull; <b style="color:#15803d">Longueur : ${fmt(arL)} m</b>
        </div>`);
      }
      if (stL > 0) {
        badges.push(`<div style="background:#f0fdf4;border:1px solid #86efac;padding:6px 12px;border-radius:6px;font-size:12.5px">
          <b style="color:#166534">⚡ Liaison MT Souterraine (${esc(mtSite)}) :</b> ${esc(i.mtstCab || CABLES_STANDARDS.mtst[0])} &bull; <b style="color:#15803d">Longueur : ${fmt(stL)} m</b>
        </div>`);
      }
      if (arL === 0 && stL === 0) {
        const mtPose = i.mtPose || 'Aérien';
        const mtCab = mtPose === 'Souterrain' ? (i.mtstCab || '—') : (i.mtarCab || '—');
        const mtL = num(i.mtL) || 0;
        badges.push(`<div style="background:#eff6ff;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:12.5px">
          <b style="color:#1e40af">⚡ Câble MT (${esc(mtSite)} · ${esc(mtPose)}) :</b> ${esc(mtCab)} &bull; <b style="color:#15803d">Longueur : ${fmt(mtL)} m</b>
        </div>`);
      }
    }
  }
  
  if (typeAff === 'BT' || typeAff === 'MT/BT' || getActiveBordCables(P).some(c => c.net === 'BT')) {
    const arL = num(i.btarL);
    const stL = num(i.btstL);
    if (arL > 0) {
      badges.push(`<div style="background:#f0fdf4;border:1px solid #86efac;padding:6px 12px;border-radius:6px;font-size:12.5px">
        <b style="color:#166534">🔌 Réseau BT Aérien :</b> ${esc(i.btarCab || CABLES_STANDARDS.btar[0])} &bull; <b style="color:#15803d">Longueur : ${fmt(arL)} m</b>
      </div>`);
    }
    if (stL > 0) {
      badges.push(`<div style="background:#eff6ff;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:12.5px">
        <b style="color:#1e40af">🔌 Réseau BT Souterrain :</b> ${esc(i.btstCab || CABLES_STANDARDS.btst[0])} &bull; <b style="color:#15803d">Longueur : ${fmt(stL)} m</b>
      </div>`);
    }
    if (arL === 0 && stL === 0) {
      const btPose = i.btPose || 'Aérien';
      const btCab = btPose === 'Souterrain' ? (i.btstCab || '—') : (i.btarCab || '—');
      const btL = num(i.btL) || 0;
      badges.push(`<div style="background:#f0fdf4;border:1px solid #86efac;padding:6px 12px;border-radius:6px;font-size:12.5px">
        <b style="color:#166534">🔌 Câble BT (${esc(btPose)}) :</b> ${esc(btCab)} &bull; <b style="color:#15803d">Longueur : ${fmt(btL)} m</b>
      </div>`);
    }
  }
  
  return `
    <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--brand);margin-bottom:6px">
        🔄 Nature de Câble & Longueur synchronisées automatiquement depuis le Bordereau des prix :
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${badges.join('')}
      </div>
    </div>
  `;
}

function paneBord(el) {
  // Attribution automatique F1, F2... et tri alphanumérique croissant par N° DE PRIX (02-..., 03-..., 34-..., puis F1, F2)
  autoNumberUndefinedPrices(P.bord);
  syncCablesFromBord();
  
  const e = computeEval();
  const b = e.b;
  const i = P.info;
  const typeAff = i.typeAff || 'MT/BT';
  const mtSiteStr = i.mtSite || 'In-Site';
  
  // Affichage de TOUS les articles, regroupés par section Hybride (MT In-Site, MT Hors-Site, Poste, BT)
  const activeSecKeys = activeSectionKeys(i, b.lines);
  let rowsHtml = '';
  const rowParts = [];
  if (!b.lines.length) {
    rowsHtml = `<tr><td colspan="11" class="empty" style="padding:18px;text-align:center">Aucun article dans le Bordereau. Cliquez sur <b>« ➕ Ajouter article du catalogue »</b> pour cocher vos articles.</td></tr>`;
  } else {
    b.lines.forEach((l, fullIdx) => {
      // Choix direct entre les 4 Ouvrages normalisés SRM-TTA (+ Poste Transfo)
      let curOuvrage = l.ouvrage;
      if (!curOuvrage) {
        if (l.lot === 'lot2') {
          curOuvrage = 'Poste Transfo (PT)';
        } else if (l.lot === 'lot1' || l.lot === 'lot1_hs' || l.lot === 'lot1_is' || l.net === 'MT') {
          curOuvrage = (l.pose === 'Souterrain') ? 'Réseau MT Souterrain' : 'Réseau MT Aérien';
        } else {
          curOuvrage = (l.pose === 'Souterrain') ? 'Réseau BT Souterrain' : 'Réseau BT Aérien';
        }
      }
      
      const lotSelectOptions = `
        <option value="Réseau MT Aérien" ${curOuvrage === 'Réseau MT Aérien' ? 'selected' : ''}>⚡ Réseau MT Aérien</option>
        <option value="Réseau MT Souterrain" ${curOuvrage === 'Réseau MT Souterrain' ? 'selected' : ''}>⚡ Réseau MT Souterrain</option>
        <option value="Poste Transfo (PT)" ${curOuvrage === 'Poste Transfo (PT)' ? 'selected' : ''}>🏢 Poste Transfo (PT)</option>
        <option value="Réseau BT Aérien" ${curOuvrage === 'Réseau BT Aérien' ? 'selected' : ''}>🔌 Réseau BT Aérien</option>
        <option value="Réseau BT Souterrain" ${curOuvrage === 'Réseau BT Souterrain' ? 'selected' : ''}>🔌 Réseau BT Souterrain</option>
      `;
      
      const dispCode = (l.code === '—') ? '' : (l.code || '');
      rowParts[fullIdx] = `
        <tr class="${l.on ? '' : 'off'}">
          <td class="c" style="width:36px;text-align:center">
            <input type="checkbox" class="bord-sel-del" data-seldel="${fullIdx}" style="width:16px;height:16px;cursor:pointer" title="Cocher cet article pour suppression groupée">
          </td>
          <td class="c" style="font-weight:700;color:var(--muted);font-size:11.5px">${fullIdx + 1}</td>
          <td class="c">
            <input type="checkbox" data-on="${fullIdx}" ${l.on ? 'checked' : ''} style="width:16px;height:16px" title="Inclure / Exclure du calcul">
          </td>
          <td class="c" style="white-space:nowrap">
            <input type="text" data-code="${fullIdx}" value="${esc(dispCode)}" placeholder="N° Prix" style="width:85px;text-align:center;font-weight:700;padding:4px 6px;border:1px solid var(--line2);border-radius:4px" title="Modifier le N° de Prix (ou F1, F2 / vide)">
          </td>
          <td>
            <textarea data-d="${fullIdx}" rows="2" style="width:100%;min-width:250px;font-size:12.5px;padding:4px 6px;border:1px solid var(--line2);border-radius:4px;resize:vertical;font-family:inherit;line-height:1.3" title="Modifier la désignation">${esc(l.d || '')}</textarea>
          </td>
          <td class="c">
            <input type="text" data-cons="${fullIdx}" value="${esc(l.c || 'F+M')}" style="width:48px;text-align:center;font-size:12px;font-weight:600;padding:3px;border:1px solid var(--line2);border-radius:4px" title="Consistance (F+M, F, M)">
          </td>
          <td class="c">
            <input type="text" data-u="${fullIdx}" value="${esc(l.u || 'U')}" style="width:45px;text-align:center;font-size:12px;padding:3px;border:1px solid var(--line2);border-radius:4px" title="Modifier l'unité">
          </td>
          <td class="n">
            <input type="text" data-q="${fullIdx}" value="${l.q}" style="width:78px;text-align:right;padding:4px;font-weight:600">
          </td>
          <td class="n">
            <input type="text" data-pu="${fullIdx}" value="${l.pu}" style="width:92px;text-align:right;padding:4px">
          </td>
          <td class="n" style="font-weight:700">${fmt(l.tot)}</td>
          <td class="c" style="white-space:nowrap">
            <select data-changsec="${fullIdx}" style="font-size:11.5px;font-weight:700;padding:2px 4px;margin-right:4px;border-radius:4px;border:1.5px solid #93c5fd;max-width:160px;color:#1e40af;background:#eff6ff" title="Section de cet article">
              ${activeSecKeys.map(k => {
                const def = SECTION_DEFS[k] || { label: k, shortLabel: k, icon: '📌' };
                const curK = getLineSec(l);
                return `<option value="${k}" ${curK === k ? 'selected' : ''}>${def.icon} ${esc(def.shortLabel || def.label)}</option>`;
              }).join('')}
            </select>
            <button class="btn sm" data-up="${fullIdx}" title="Monter" style="padding:2px 5px" ${fullIdx === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn sm" data-dn="${fullIdx}" title="Descendre" style="padding:2px 5px" ${fullIdx === b.lines.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn sm del" data-del="${fullIdx}" title="Supprimer cet article" style="padding:2px 6px">✕</button>
          </td>
        </tr>
      `;
    });
    if (i.groupSections === false) {
      rowsHtml = rowParts.join('');
    } else {
      const groups = groupLinesBySection(b.lines.map((l, ix) => Object.assign({}, l, { _idx: ix })));
      rowsHtml = groups.map((g, gi) => `
        <tr style="background:#1e3a8a;color:#fff">
          <td colspan="11" style="padding:7px 12px;font-size:13px;font-weight:800">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <span>${gi + 1}. ${g.icon} ${esc(g.label)} <span style="font-weight:500;font-size:11.5px;opacity:.85">— ${g.lines.length} article${g.lines.length > 1 ? 's' : ''}</span></span>
              <button type="button" class="btn sm" data-openaddto="${g.key}" style="background:#2563eb;color:#fff;border:1px solid #60a5fa;font-weight:700;padding:3px 10px;cursor:pointer" title="Ajouter des articles directement dans ${esc(g.shortLabel || g.label)}">
                ➕ Ajouter des articles dans ${esc(g.shortLabel || g.label)}
              </button>
            </div>
          </td>
        </tr>
        ${g.lines.length ? g.lines.map(l => rowParts[l._idx]).join('') : `<tr><td colspan="11" class="empty" style="padding:14px;text-align:center;color:#64748b;font-style:italic;background:#f8fafc">Aucun article dans cette section. Cliquez sur <b>« ➕ Ajouter des articles dans ${esc(g.shortLabel || g.label)} »</b> pour y ajouter des articles.</td></tr>`}
        <tr style="background:#eff6ff">
          <td colspan="9" style="text-align:right;font-weight:800;color:#1e3a8a;padding:6px 12px;font-size:12.5px">Sous-total ${gi + 1} · ${esc(g.label)} (HT)</td>
          <td class="n" style="font-weight:800;color:#1e3a8a">${fmt(g.ht)}</td>
          <td></td>
        </tr>`).join('');
    }
  }
  
  el.innerHTML = `
    <!-- Sélection multiple des réseaux et ordre des sections -->
    ${renderNetSelWidget(i)}
    <div style="font-size:12.5px;color:var(--muted);margin:-6px 0 10px 2px">
      Articles regroupés par <b>section (Réseau × État)</b> avec sous-total — <b>${b.lines.length} article${b.lines.length > 1 ? 's' : ''}</b>
    </div>
    
    <div id="bordCablesBanner">${renderBordCablesBanner()}</div>
    
    <div class="bar">
      <div>
        <h3 style="font-size:20px;color:#b91c1c;font-weight:800">
          BORDEREAU DES PRIX DÉTAIL ESTIMATIF
        </h3>
      </div>
      <span class="sp"></span>
      <button class="btn del" id="btnDeleteSelectedBord" style="display:none;background:#dc2626;border-color:#b91c1c;color:#fff;font-weight:700;box-shadow:0 2px 6px rgba(220,38,38,0.25)">🗑️ Supprimer la sélection (<span id="cntSelBord">0</span>)</button>
      <button class="btn sm" id="btnViderBord" style="color:#b91c1c;border-color:#fca5a5;background:#fff5f5" title="Supprimer tous les articles du Bordereau">🗑️ Vider tout</button>
      <button class="btn pri" id="openAddBox">➕ Ajouter article du catalogue</button>
      <button class="btn ok" id="openCopyBordBox" title="Réutiliser le Bordereau d'un devis / d'une affaire déjà réalisée">📋 Copier Bordereau d'une autre affaire</button>
      <button class="btn" id="btnNewAffFromBord" title="Créer directement une nouvelle affaire avec ce même Bordereau">🆕 Nouvelle affaire avec ce Bordereau</button>
      <button class="btn ok" id="btnImportPdfBord" style="background:#0284c7;border-color:#0284c7;color:#fff" title="Importer un devis ou bordereau depuis un fichier PDF">📄 Importer Bordereau PDF</button>
      <input type="file" id="inpImportPdfBordPane" accept=".pdf" style="display:none">
      <button class="btn" id="openAddCustom">✏️ Ligne personnalisée</button>
      <button class="btn" id="btnAutoNumF" title="Numéroter automatiquement F1, F2... les articles sans N° de prix">🔢 Numéroter F1, F2...</button>
    </div>
    
    <div id="addbox"></div>
    
    <div class="tw" style="margin-top:10px">
      <table>
        <thead>
          <tr>
            <th style="width:36px;text-align:center"><input type="checkbox" id="chkSelAllBord" title="Tout cocher / décocher pour supprimer" style="cursor:pointer"></th>
            <th style="width:32px">#</th>
            <th style="width:36px">Inclus</th>
            <th style="width:95px">N° de Prix</th>
            <th>Désignation des fournitures et ouvrages</th>
            <th style="width:65px">Consist.</th>
            <th style="width:55px">Unité</th>
            <th style="width:90px">Quantité</th>
            <th style="width:110px">Prix Unit. HT</th>
            <th style="width:115px">Prix Totaux HT</th>
            <th style="width:165px">Lot / Ordre</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
    
    <!-- Récapitulatif Travaux + PRESTATIONS SRM-TTA (T-PRESTATIONS) comme sur le Bordereau détaillé -->
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <table class="paper xt" style="max-width:680px;width:100%;border-collapse:collapse">
        <tbody>
          <tr class="b" style="background:#f8fafc">
            <td colspan="3" style="text-align:right;font-weight:800">TOTAL (HT)</td>
            <td class="n b" style="width:140px">${fmt(b.ht)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:700">TVA ${P.tva}%</td>
            <td class="n" style="font-weight:700">${fmt(e.worksTva)}</td>
          </tr>
          <tr class="b" style="background:#e0f2fe">
            <td colspan="3" style="text-align:right;font-weight:800">TOTAL (G)</td>
            <td class="n b">${fmt(e.worksTtc)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:center;font-weight:800;color:#1e3a8a;padding:10px 6px;font-size:13.5px;background:#fff">
              PRESTATIONS SRM-TTA (T-PRESTATIONS)
            </td>
          </tr>
          ${e.pr.map(x => `
            <tr>
              <td style="text-align:right;font-weight:700">${esc(x.name)}</td>
              <td class="n" style="width:115px;font-weight:700">${fmt(x.pu)}</td>
              <td class="c" style="width:70px;font-weight:700">${fq(x.q)}</td>
              <td class="n" style="width:140px;font-weight:700">${fmt(x.tot)}</td>
            </tr>
          `).join('')}
          <tr class="b" style="background:#f8fafc">
            <td colspan="2"></td>
            <td style="text-align:center;font-weight:800">TOTAL HTVA</td>
            <td class="n b">${fmt(e.pht)}</td>
          </tr>
          <tr class="b" style="background:#f8fafc">
            <td colspan="2"></td>
            <td style="text-align:center;font-weight:800">TOTAL TTC</td>
            <td class="n b">${fmt(e.corePttc)}</td>
          </tr>
          ${(e.specialPr || []).map(sp => `
            <tr>
              <td style="text-align:right;font-weight:700">${esc(sp.name)}</td>
              <td class="n" style="width:115px;font-weight:700">${fmt(sp.pu)}</td>
              <td class="c" style="width:70px;font-weight:700">${fq(sp.q)}</td>
              <td class="n" style="width:140px;font-weight:700">${fmt(sp.tot)}</td>
            </tr>
          `).join('')}
          <tr class="b">
            <td colspan="3" style="text-align:right;font-weight:800">TOTAL PRESTATIONS SRM-TTA T.T.C</td>
            <td class="n b">${fmt(e.pttc)}</td>
          </tr>
          <tr class="b" style="background:#dbeafe;font-size:14px">
            <td colspan="3" style="text-align:right;font-weight:800;color:#1e3a8a">TOTAL GENERAL T.T.C</td>
            <td class="n b" style="color:#000">${fmt(e.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  // Sélection multiple Réseaux / Implantation / Ordre des sections
  bindNetSelWidget(el);
  
  // Changement d'implantation (In-Site / Hors-Site) d'un article
  el.querySelectorAll('[data-site]').forEach(sel => {
    sel.onchange = () => {
      const idx = parseInt(sel.dataset.site, 10);
      if (P.bord[idx]) {
        freezeLineSites();
        P.bord[idx].site = sel.value;
        applyNetSel();
        paneBord(el);
      }
    };
  });
  
  // Boutons de bascule rapide de type d'affaire
  el.querySelectorAll('[data-switchtype]').forEach(btn => {
    btn.onclick = () => {
      setTypeAff(btn.dataset.switchtype);
    };
  });
  
  // Bouton de renumérotation automatique séquentielle F1, F2...
  $('#btnAutoNumF').onclick = () => {
    const c = autoNumberUndefinedPrices(P.bord);
    touch();
    updKpi();
    paneBord(el);
    toast(`${c} article(s) renuméroté(s) en N° de Prix séquentiels (F1, F2...)`);
  };
  
  // Changement de section hybride pour un article
  el.querySelectorAll('[data-changsec]').forEach(sel => {
    sel.onchange = () => {
      const idx = parseInt(sel.dataset.changsec, 10);
      if (P.bord[idx]) {
        setLineSec(P.bord[idx], sel.value);
        syncCablesFromBord();
        touch();
        updKpi();
        paneBord(el);
      }
    };
  });

  // Bouton direct pour ajouter des articles dans une section précise
  el.querySelectorAll('[data-openaddto]').forEach(btn => {
    btn.onclick = () => {
      openAddBox(btn.dataset.openaddto);
      const ab = el.querySelector('#addbox');
      if (ab) ab.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
  // Déplacement Haut / Bas pour ordonner les articles
  el.querySelectorAll('[data-up]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.up, 10);
      if (idx > 0 && P.bord[idx]) {
        const tmp = P.bord[idx - 1];
        P.bord[idx - 1] = P.bord[idx];
        P.bord[idx] = tmp;
        touch();
        paneBord(el);
      }
    };
  });
  el.querySelectorAll('[data-dn]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.dn, 10);
      if (idx < P.bord.length - 1 && P.bord[idx]) {
        const tmp = P.bord[idx + 1];
        P.bord[idx + 1] = P.bord[idx];
        P.bord[idx] = tmp;
        touch();
        paneBord(el);
      }
    };
  });
  
  // Inputs du tableau
  el.querySelectorAll('[data-on]').forEach(x => {
    x.onchange = () => {
      const idx = parseInt(x.dataset.on, 10);
      if (P.bord[idx]) P.bord[idx].on = x.checked;
      touch();
      updKpi();
      paneBord(el);
    };
  });
  
  el.querySelectorAll('[data-code]').forEach(x => {
    x.oninput = () => {
      const idx = parseInt(x.dataset.code, 10);
      if (P.bord[idx]) P.bord[idx].code = x.value;
      touch();
    };
    x.onchange = () => {
      touch();
      updKpi();
      paneBord(el);
    };
  });
  
  el.querySelectorAll('[data-d]').forEach(x => {
    x.oninput = () => {
      const idx = parseInt(x.dataset.d, 10);
      if (P.bord[idx]) P.bord[idx].d = x.value;
      touch();
    };
  });
  
  el.querySelectorAll('[data-cons]').forEach(x => {
    x.oninput = () => {
      const idx = parseInt(x.dataset.cons, 10);
      if (P.bord[idx]) P.bord[idx].c = x.value;
      touch();
    };
  });
  
  el.querySelectorAll('[data-u]').forEach(x => {
    x.oninput = () => {
      const idx = parseInt(x.dataset.u, 10);
      if (P.bord[idx]) P.bord[idx].u = x.value;
      touch();
    };
  });
  
  el.querySelectorAll('[data-q]').forEach(x => {
    x.oninput = () => {
      const idx = parseInt(x.dataset.q, 10);
      if (P.bord[idx]) {
        P.bord[idx].q = x.value;
        syncCablesFromBord();
        const banner = $('#bordCablesBanner');
        if (banner) banner.innerHTML = renderBordCablesBanner();
        touch();
        updKpi();
      }
    };
    x.onchange = () => {
      syncCablesFromBord();
      paneBord(el);
    };
  });
  
  el.querySelectorAll('[data-pu]').forEach(x => {
    x.oninput = () => {
      const idx = parseInt(x.dataset.pu, 10);
      if (P.bord[idx]) {
        P.bord[idx].pu = x.value;
        touch();
        updKpi();
      }
    };
    x.onchange = () => paneBord(el);
  });
  
  el.querySelectorAll('[data-del]').forEach(x => {
    x.onclick = () => {
      const idx = parseInt(x.dataset.del, 10);
      if (confirm(`Supprimer l'article « ${P.bord[idx]?.d || P.bord[idx]?.code} » ?`)) {
        P.bord.splice(idx, 1);
        touch();
        updKpi();
        paneBord(el);
        toast('Article supprimé');
      }
    };
  });
  
  // Gestion de la sélection et suppression groupée des articles du Bordereau
  const updateBordBatchDelState = () => {
    const chks = el.querySelectorAll('.bord-sel-del:checked');
    const btnDelSel = el.querySelector('#btnDeleteSelectedBord');
    const cntSpan = el.querySelector('#cntSelBord');
    const chkAll = el.querySelector('#chkSelAllBord');
    const allChks = el.querySelectorAll('.bord-sel-del');
    if (cntSpan) cntSpan.textContent = chks.length;
    if (btnDelSel) {
      btnDelSel.style.display = chks.length > 0 ? 'inline-flex' : 'none';
      btnDelSel.innerHTML = `🗑️ Supprimer les ${chks.length} article${chks.length > 1 ? 's' : ''} coché${chks.length > 1 ? 's' : ''}`;
    }
    if (chkAll && allChks.length > 0) {
      chkAll.checked = chks.length === allChks.length;
      chkAll.indeterminate = chks.length > 0 && chks.length < allChks.length;
    }
  };

  const chkAllBord = el.querySelector('#chkSelAllBord');
  if (chkAllBord) {
    chkAllBord.onchange = () => {
      el.querySelectorAll('.bord-sel-del').forEach(chk => {
        chk.checked = chkAllBord.checked;
        const tr = chk.closest('tr');
        if (tr) tr.style.backgroundColor = chk.checked ? '#fef2f2' : '';
      });
      updateBordBatchDelState();
    };
  }

  el.querySelectorAll('.bord-sel-del').forEach(chk => {
    chk.onchange = () => {
      const tr = chk.closest('tr');
      if (tr) tr.style.backgroundColor = chk.checked ? '#fef2f2' : '';
      updateBordBatchDelState();
    };
  });

  const btnDelSel = el.querySelector('#btnDeleteSelectedBord');
  if (btnDelSel) {
    btnDelSel.onclick = () => {
      const chks = Array.from(el.querySelectorAll('.bord-sel-del:checked'));
      if (!chks.length) return;
      if (!confirm(`Confirmer la suppression groupée de ${chks.length} article(s) du Bordereau ?`)) return;
      
      const indices = chks.map(c => parseInt(c.dataset.seldel, 10)).sort((a, b) => b - a);
      indices.forEach(idx => {
        if (idx >= 0 && idx < P.bord.length) {
          P.bord.splice(idx, 1);
        }
      });
      syncCablesFromBord();
      touch();
      updKpi();
      paneBord(el);
      toast(`${indices.length} article(s) supprimé(s) du Bordereau`);
    };
  }

  const btnVider = el.querySelector('#btnViderBord');
  if (btnVider) {
    btnVider.onclick = () => {
      if (!P.bord.length) {
        toast('Le Bordereau est déjà vide');
        return;
      }
      if (confirm(`Êtes-vous sûr de vouloir vider TOUT le Bordereau (${P.bord.length} articles) ? Cette action est irréversible.`)) {
        P.bord = [];
        syncCablesFromBord();
        touch();
        updKpi();
        paneBord(el);
        toast('Bordereau vidé avec succès');
      }
    };
  }
  
  // Modal Catalogue Hybride avec choix de la Section de Destination (MT In-Site, MT Hors-Site, Poste, BT)
  function openAddBox(initialTargetSec) {
    const box = $('#addbox');
    const selIds = new Set();
    const selQtys = {};
    let currentNet = 'ALL';
    let currentFam = 'ALL';
    let currentCons = 'ALL';
    
    const activeSecsList = activeSectionKeys(P.info, P.bord);
    let targetSec = (initialTargetSec && SECTION_DEFS[initialTargetSec]) ? SECTION_DEFS[initialTargetSec].key : (activeSecsList[0] || 'MT');
    
    box.innerHTML = `
      <div style="background:#fff;border:2px solid var(--brand);border-radius:10px;padding:16px;margin:12px 0;box-shadow:0 6px 20px rgba(0,0,0,0.12)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div>
            <h4 style="font-size:18px;color:var(--brand);margin:0" id="catModalTitle">➕ Série des Prix Officielle SRM-TTA (${ARTS.length} articles) — Modifiable & Sauvegardée</h4>
            <span style="font-size:12px;color:var(--muted)">Vous pouvez cocher les articles à ajouter, ou <b>modifier directement N° Prix, Désignation, Unité, Prix Unitaire</b>, ajouter ou supprimer un article, puis cliquer sur <b>« 💾 Enregistrer Série des Prix »</b>.</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <button class="btn" id="btnModalNewArt" style="font-weight:700">➕ Nouvel article dans la Série</button>
            <button class="btn ok" id="btnModalSaveCat" style="font-weight:700">💾 Enregistrer Série des Prix</button>
            <button class="btn pri" id="btnAddChecked" style="padding:7px 16px" disabled>
              ➕ Ajouter les 0 article coché au Bordereau
            </button>
            <button class="btn sm" id="btnCloseCatBox">✕ Fermer</button>
          </div>
        </div>
        
        <div id="modalNewArtBox"></div>
        
        <!-- Sélecteur de Section Cible (Hybride) -->
        <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-weight:800;color:#1e40af;font-size:13.5px">🎯 Destination : Ajouter ces articles dans la section :</span>
            <div id="modalTargetSecPills" style="display:flex;gap:6px;flex-wrap:wrap">
              ${activeSecsList.map(k => {
                const d = SECTION_DEFS[k] || { label: k, shortLabel: k, icon: '📌' };
                const isCur = k === targetSec;
                return `<button type="button" data-picksec="${k}" class="${isCur ? 'on' : ''}" style="font-weight:700;font-size:12.5px;padding:5px 12px;border-radius:6px;cursor:pointer;${isCur ? 'background:#1e40af;color:#fff;border:1.5px solid #1e40af' : 'background:#fff;color:#1e40af;border:1.5px solid #93c5fd'}">
                  ${d.icon} ${esc(d.shortLabel || d.label)}
                </button>`;
              }).join('')}
            </div>
          </div>
          <div style="font-size:12px;color:#1e40af;background:#dbeafe;padding:4px 10px;border-radius:4px;font-weight:700">
            ✨ Destination active : <span id="lblTargetSecName" style="color:#1e40af;text-decoration:underline">${esc(SECTION_DEFS[targetSec]?.label || targetSec)}</span>
          </div>
        </div>
        
        <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:12px;border-radius:8px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="position:relative;flex:1;min-width:260px">
              <input type="text" id="catFilterInp" placeholder="🔍 Recherche intelligente (ex: cable, preassemble 70, poteau b 12, boite s26, 34-00)..." style="width:100%;padding:8px 32px 8px 12px;font-size:13.5px;border:1.5px solid #94a3b8;border-radius:6px" value="">
              <button id="btnClearCatQ" title="Effacer la recherche" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;font-size:14px;color:#64748b;display:none">✕</button>
            </div>
            
            <select id="selCatFam" style="padding:8px 10px;font-weight:600;color:var(--brand);border:1.5px solid #94a3b8;border-radius:6px;min-width:250px">
              ${FAMILLES_INTELLIGENTES.map(f => `<option value="${f[0]}">${f[1]}</option>`).join('')}
            </select>
            
            <select id="selCatCons" style="padding:8px 10px;font-weight:600;border:1.5px solid #94a3b8;border-radius:6px">
              <option value="ALL">🔧 Toutes consistances (F+M / F / M)</option>
              <option value="F+M">F+M (Fourniture + Pose)</option>
              <option value="F">F (Fourniture seule)</option>
              <option value="M">M (Pose / Montage seul)</option>
            </select>
          </div>
          
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div class="sub" style="margin:0;display:flex;flex-wrap:wrap;gap:4px">
              <button data-netflt="ALL" class="on" id="btnNetAllCount">📋 Tous (${ARTS.length})</button>
              <button data-netflt="MT">⚡ MT</button>
              <button data-netflt="BT">🔌 BT</button>
              <button data-netflt="MT-BT">🔗 MT-BT</button>
              <button data-netflt="PT">🏢 Postes & Transfos</button>
              <button data-netflt="EP">💡 Éclairage Public</button>
              <button data-netflt="ETD">📐 Études & Topo</button>
            </div>
            <span id="catResultCount" style="font-size:12.5px;font-weight:700;color:var(--brand)"></span>
          </div>
        </div>
        
        <div style="max-height:400px;overflow-y:auto;border:1px solid var(--line);border-radius:6px">
          <table style="width:100%;font-size:12.5px">
            <thead>
              <tr style="position:sticky;top:0;background:#f1f5f9;z-index:2">
                <th style="width:42px;text-align:center">
                  <input type="checkbox" id="chkAllDisplayed" title="Tout cocher / décocher parmi les résultats">
                </th>
                <th style="width:68px">Type</th>
                <th style="width:92px">N° Service</th>
                <th style="min-width:300px">Désignation du Prix (Complète D1 &amp; D2)</th>
                <th style="width:62px">Consist.</th>
                <th style="width:58px">Unité</th>
                <th style="width:85px;text-align:center;background:#dbeafe;color:#1e40af">Quantité</th>
                <th style="width:100px">Prix Unit. HT</th>
                <th style="width:86px;text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody id="catModalTbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const updateBtnState = () => {
      const btn = $('#btnAddChecked');
      if (!btn) return;
      btn.disabled = selIds.size === 0;
      const targetName = SECTION_DEFS[targetSec]?.shortLabel || SECTION_DEFS[targetSec]?.label || targetSec;
      btn.textContent = `➕ Ajouter les ${selIds.size} article${selIds.size > 1 ? 's' : ''} coché${selIds.size > 1 ? 's' : ''} dans « ${targetName} »`;
    };
    
    const resolveDefaultLot = (a) => {
      if (typeAff === 'MT') return mtSiteStr === 'Les Deux' ? 'lot1_hs' : 'lot1';
      if (typeAff === 'BT') return 'lot3';
      let lot = detectLot(a.code, a.d);
      if (lot === 'lot1' && mtSiteStr === 'Les Deux') lot = 'lot1_hs';
      return lot;
    };
    
    const addSingleArtWithQty = (id, customQty) => {
      const a = artByCode(id);
      if (!a) return;
      const qVal = (customQty != null && !isNaN(customQty) && customQty > 0) ? customQty : 1;
      const newLine = {
        key: uid(),
        code: a.code || '',
        d: a.d,
        c: a.c || 'F+M',
        u: a.u || 'U',
        q: qVal,
        pu: num(a.p),
        on: true
      };
      setLineSec(newLine, targetSec);
      insertBordByCatalogOrder(newLine);
      syncCablesFromBord();
      touch();
      updKpi();
      toast(`Ajouté dans ${SECTION_DEFS[targetSec]?.shortLabel || targetSec} (${qVal} ${a.u || 'U'}) : ${a.code || a.d.slice(0, 30)}`);
    };
    
    const drawRows = () => {
      const all = allArts();
      const titleEl = $('#catModalTitle');
      if (titleEl) titleEl.textContent = `➕ Série des Prix Officielle SRM-TTA (${all.length} articles) — Modifiable & Sauvegardée`;
      const allBtn = $('#btnNetAllCount');
      if (allBtn) allBtn.textContent = `📋 Tous (${all.length})`;

      const fInp = $('#catFilterInp');
      const q = fInp ? fInp.value : '';
      const clearBtn = $('#btnClearCatQ');
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      
      const displayed = smartFilterArts(all, q, currentNet, currentFam, currentCons);
      const tbody = $('#catModalTbody');
      if (!tbody) return;
      
      const cntEl = $('#catResultCount');
      if (cntEl) cntEl.textContent = `${displayed.length} article${displayed.length > 1 ? 's' : ''} trouvé${displayed.length > 1 ? 's' : ''}`;
      
      box.querySelectorAll('[data-netflt]').forEach(b => {
        b.className = b.dataset.netflt === currentNet ? 'on' : '';
      });
      
      if (!displayed.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty" style="padding:18px;text-align:center">Aucun article ne correspond à votre recherche « <b>${esc(q)}</b> ».</td></tr>`;
        return;
      }
      
      const selArray = Array.from(selIds);
      
      tbody.innerHTML = displayed.map(a => {
        const isChecked = selIds.has(a._id);
        const curQty = (selQtys[a._id] != null && !isNaN(selQtys[a._id])) ? selQtys[a._id] : 1;
        const selOrder = isChecked ? (selArray.indexOf(a._id) + 1) : '';
        const netCat = a.cat || detectArticleNetCategory(a);
        const rIdx = a._realIdx;
        return `
          <tr style="background:${isChecked ? '#e0f2fe' : 'transparent'}">
            <td style="text-align:center;white-space:nowrap">
              <input type="checkbox" data-chkid="${esc(a._id)}" ${isChecked ? 'checked' : ''} style="cursor:pointer">
              ${selOrder ? `<span style="display:inline-block;background:var(--brand);color:#fff;font-size:10px;font-weight:700;padding:1px 4px;border-radius:8px;margin-left:2px">#${selOrder}</span>` : ''}
            </td>
            <td style="text-align:center;font-size:11px;font-weight:700;color:#1e40af">${esc(netCat)}</td>
            <td style="text-align:center">
              <input type="text" data-mcode="${rIdx}" value="${esc(a.code)}" style="width:82px;font-family:monospace;font-weight:700;text-align:center;padding:3px 4px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px">
            </td>
            <td style="min-width:300px;vertical-align:middle">
              <textarea data-mdes="${rIdx}" rows="2" style="width:100%;font-size:12px;font-weight:600;color:#0f172a;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;line-height:1.35;resize:vertical;font-family:inherit;min-height:46px" title="DÉSIGNATION 1 (Complète, modifiable)">${esc(a.d)}</textarea>
              ${a.d2 && a.d2.trim() !== a.d.trim() ? `<div style="font-size:11px;color:#475569;margin-top:3px;background:#f1f5f9;padding:2px 6px;border-radius:4px;display:inline-block;border:1px solid #e2e8f0"><b style="color:#1e3a8a">Désignation 2 :</b> ${esc(a.d2)}</div>` : ''}
            </td>
            <td style="text-align:center">
              <input type="text" data-mcons="${rIdx}" value="${esc(a.c)}" style="width:50px;text-align:center;font-weight:600;padding:3px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px">
            </td>
            <td style="text-align:center">
              <input type="text" data-mu="${rIdx}" value="${esc(a.u)}" style="width:48px;text-align:center;padding:3px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px">
            </td>
            <td style="text-align:center;background:#f0fdf4">
              <input type="number" data-artqty="${esc(a._id)}" value="${curQty}" min="0.001" step="any" style="width:72px;text-align:center;font-weight:700;padding:4px;border:1.5px solid #16a34a;border-radius:5px;background:#fff;color:#15803d;font-size:13px" title="Saisir la quantité souhaitée (Appuyez sur Entrée pour ajouter directement)">
            </td>
            <td class="n">
              <input type="text" data-mpu="${rIdx}" value="${a.p}" style="width:88px;text-align:right;font-weight:700;padding:3px 5px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px">
            </td>
            <td style="text-align:center;white-space:nowrap">
              <button class="btn sm pri" data-addsingle="${esc(a._id)}" title="Ajouter immédiatement avec la quantité saisie" style="padding:3px 8px;font-weight:700">➕ Ajouter</button>
              <button class="btn sm del" data-mdel="${rIdx}" title="Supprimer cet article de la Série des Prix" style="padding:3px 5px">🗑️</button>
            </td>
          </tr>
        `;
      }).join('');
      
      tbody.querySelectorAll('[data-chkid]').forEach(chk => {
        chk.onchange = () => {
          const id = chk.dataset.chkid;
          if (chk.checked) selIds.add(id);
          else selIds.delete(id);
          drawRows();
          updateBtnState();
        };
      });

      // Édition directe dans la Série des Prix depuis la fenêtre modale
      tbody.querySelectorAll('[data-mcode]').forEach(inp => {
        inp.oninput = () => {
          const idx = +inp.dataset.mcode;
          if (ARTS[idx]) { ARTS[idx].code = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
        };
      });
      tbody.querySelectorAll('[data-mdes]').forEach(inp => {
        inp.oninput = () => {
          const idx = +inp.dataset.mdes;
          if (ARTS[idx]) { ARTS[idx].d = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
        };
      });
      tbody.querySelectorAll('[data-mcons]').forEach(inp => {
        inp.oninput = () => {
          const idx = +inp.dataset.mcons;
          if (ARTS[idx]) { ARTS[idx].c = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
        };
      });
      tbody.querySelectorAll('[data-mu]').forEach(inp => {
        inp.oninput = () => {
          const idx = +inp.dataset.mu;
          if (ARTS[idx]) { ARTS[idx].u = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
        };
      });
      tbody.querySelectorAll('[data-mpu]').forEach(inp => {
        inp.oninput = () => {
          const idx = +inp.dataset.mpu;
          if (ARTS[idx]) { ARTS[idx].p = num(inp.value); delete ARTS[idx]._haystack; saveCatalogStorage(false); }
        };
      });
      tbody.querySelectorAll('[data-mdel]').forEach(btn => {
        btn.onclick = () => {
          const idx = +btn.dataset.mdel;
          const art = ARTS[idx];
          if (art && confirm(`Supprimer définitivement l'article « ${art.code} - ${art.d} » de la Série des Prix ?`)) {
            selIds.delete(art._id);
            ARTS.splice(idx, 1);
            saveCatalogStorage(true);
            drawRows();
          }
        };
      });
      
      tbody.querySelectorAll('[data-artqty]').forEach(inp => {
        inp.oninput = () => {
          const id = inp.dataset.artqty;
          const val = parseFloat(inp.value);
          if (!isNaN(val) && val > 0) {
            selQtys[id] = val;
            selIds.add(id);
            const chk = tbody.querySelector(`[data-chkid="${CSS.escape(id)}"]`);
            if (chk) chk.checked = true;
            const tr = inp.closest('tr');
            if (tr) tr.style.backgroundColor = '#e0f2fe';
          } else {
            selQtys[id] = 1;
          }
          updateBtnState();
        };
        inp.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const id = inp.dataset.artqty;
            const val = parseFloat(inp.value) || 1;
            addSingleArtWithQty(id, val);
          }
        };
      });

      tbody.querySelectorAll('[data-addsingle]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.addsingle;
          const qVal = (selQtys[id] != null && !isNaN(selQtys[id]) && selQtys[id] > 0) ? selQtys[id] : 1;
          addSingleArtWithQty(id, qVal);
        };
      });
      
      const chkAll = $('#chkAllDisplayed');
      if (chkAll) {
        chkAll.checked = displayed.length > 0 && displayed.every(a => selIds.has(a._id));
        chkAll.onchange = () => {
          displayed.forEach(a => {
            if (chkAll.checked) selIds.add(a._id);
            else selIds.delete(a._id);
          });
          drawRows();
          updateBtnState();
        };
      }
      
      box.querySelectorAll('[data-picksec]').forEach(btn => {
        btn.onclick = () => {
          targetSec = btn.dataset.picksec;
          box.querySelectorAll('[data-picksec]').forEach(b => {
            const isCur = b.dataset.picksec === targetSec;
            b.className = isCur ? 'on' : '';
            b.style.background = isCur ? '#1e40af' : '#fff';
            b.style.color = isCur ? '#fff' : '#1e40af';
            b.style.border = isCur ? '1.5px solid #1e40af' : '1.5px solid #93c5fd';
          });
          const lbl = box.querySelector('#lblTargetSecName');
          if (lbl) lbl.textContent = SECTION_DEFS[targetSec]?.label || targetSec;
          updateBtnState();
        };
      });

      updateBtnState();
    };
    
    $('#btnCloseCatBox').onclick = () => { box.innerHTML = ''; paneBord(el); };
    $('#btnModalSaveCat').onclick = () => {
            saveCatalogStorage(true);
      drawRows();
    };
    $('#btnModalNewArt').onclick = () => {
      const nb = $('#modalNewArtBox');
      if (nb.innerHTML) { nb.innerHTML = ''; return; }
      nb.innerHTML = `
        <div style="background:#eff6ff;border:1.5px solid #3b82f6;border-radius:8px;padding:12px;margin-bottom:12px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:8px">➕ Ajouter un nouvel article dans la Série des Prix Officielle</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">
            <label class="f" style="width:95px">Type
              <select id="mNewCat">
                <option value="MT">MT</option>
                <option value="BT" selected>BT</option>
                <option value="MT - BT">MT - BT</option>
                <option value="PT">PT</option>
                <option value="EP">EP</option>
                <option value="ETD">ETD</option>
              </select>
            </label>
            <label class="f" style="width:110px">N° de Prix
              <input type="text" id="mNewCode" placeholder="ex: 34-00-99">
            </label>
            <label class="f" style="flex:1;min-width:220px">Désignation
              <input type="text" id="mNewDes" placeholder="Désignation complète de l'ouvrage...">
            </label>
            <label class="f" style="width:85px">Consist.
              <select id="mNewCons">
                <option value="F+M">F+M</option>
                <option value="F">F</option>
                <option value="M">M</option>
              </select>
            </label>
            <label class="f" style="width:75px">Unité
              <input type="text" id="mNewUnit" value="U">
            </label>
            <label class="f" style="width:115px">Prix Unit. HT
              <input type="number" id="mNewPu" value="0" step="0.01">
            </label>
            <button class="btn ok" id="mBtnConfirmNew">💾 Ajouter & Enregistrer</button>
            <button class="btn" id="mBtnCancelNew">Annuler</button>
          </div>
        </div>
      `;
      $('#mBtnCancelNew').onclick = () => { nb.innerHTML = ''; };
      $('#mBtnConfirmNew').onclick = () => {
        const d = $('#mNewDes').value.trim();
        if (!d) { toast('Veuillez saisir la désignation'); return; }
        const newArt = {
          _uid: 'cat_' + uid(),
          code: $('#mNewCode').value.trim(),
          d: d,
          c: $('#mNewCons').value,
          u: $('#mNewUnit').value.trim() || 'U',
          p: num($('#mNewPu').value),
          cat: $('#mNewCat').value
        };
        ARTS.push(newArt);
                saveCatalogStorage(true);
        nb.innerHTML = '';
        drawRows();
      };
    };
    
    box.querySelectorAll('[data-netflt]').forEach(b => {
      b.onclick = () => {
        currentNet = b.dataset.netflt;
        drawRows();
      };
    });
    
    $('#selCatFam').onchange = e => {
      currentFam = e.target.value;
      drawRows();
    };
    
    $('#selCatCons').onchange = e => {
      currentCons = e.target.value;
      drawRows();
    };
    
    const fInp = $('#catFilterInp');
    fInp.oninput = () => {
      drawRows();
    };
    
    $('#btnClearCatQ').onclick = () => {
      fInp.value = '';
      drawRows();
      fInp.focus();
    };
    
    $('#btnAddChecked').onclick = () => {
      if (!selIds.size) return;
      let count = 0;
      Array.from(selIds).forEach(id => {
        const a = artByCode(id);
        if (a) {
          const qVal = (selQtys[id] != null && !isNaN(selQtys[id]) && selQtys[id] > 0) ? selQtys[id] : 1;
          const newLine = {
            key: uid(),
            code: a.code || '',
            d: a.d,
            c: a.c || 'F+M',
            u: a.u || 'U',
            q: qVal,
            pu: num(a.p),
            on: true
          };
          setLineSec(newLine, targetSec);
          insertBordByCatalogOrder(newLine);
          count++;
        }
      });
      syncCablesFromBord();
      touch();
      updKpi();
      paneBord(el);
      toast(`${count} article(s) ajouté(s) dans ${SECTION_DEFS[targetSec]?.shortLabel || targetSec}`);
    };
    
    drawRows();
    fInp.focus();
  };

  $('#openAddBox').onclick = () => openAddBox();

  // Modal Ligne personnalisée
  $('#openAddCustom').onclick = () => {
    const box = $('#addbox');
    let defaultLot = 'lot3';
    if (typeAff === 'MT') defaultLot = 'lot1';
    else if (typeAff === 'MT/BT') defaultLot = 'lot1';
    const nextF = getNextFCode(P.bord);
    
    box.innerHTML = `
      <div class="card pane" style="margin:12px 0;background:#f8fafc;border:1.5px solid var(--brand)">
        <h4 style="margin-bottom:10px;color:var(--brand)">✏️ Ajouter une ligne personnalisée au Bordereau</h4>
        <div class="grid2">
          <label class="f">N° de Prix (vide ou F1, F2...)
            <input type="text" id="custCode" value="${esc(nextF)}">
          </label>
          <label class="f">Affectation Lot
            <select id="custLot">
              <option value="lot1" ${defaultLot === 'lot1' ? 'selected' : ''}>1. Ligne MT</option>
              <option value="lot2" ${defaultLot === 'lot2' ? 'selected' : ''}>2. Poste Transfo</option>
              <option value="lot3" ${defaultLot === 'lot3' ? 'selected' : ''}>3. Réseau BT</option>
            </select>
          </label>
          <label class="f wide">Désignation de l'ouvrage
            <input type="text" id="custDes" placeholder="Désignation complète...">
          </label>
          <label class="f">Consistance
            <select id="custCons">
              <option value="F+M">F+M</option>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </label>
          <label class="f">Unité
            <input type="text" id="custUnit" value="U">
          </label>
          <label class="f">Quantité
            <input type="number" id="custQty" value="1" step="0.01">
          </label>
          <label class="f">Prix Unitaire HT (DH)
            <input type="number" id="custPu" value="0" step="0.01">
          </label>
        </div>
        <div class="bar" style="margin-top:10px">
          <button class="btn pri" id="saveCustLine">➕ Ajouter à la suite</button>
          <button class="btn" id="cancelCustLine">Annuler</button>
        </div>
      </div>
    `;
    $('#cancelCustLine').onclick = () => { box.innerHTML = ''; };
    $('#saveCustLine').onclick = () => {
      const d = $('#custDes').value.trim();
      if (!d) { toast('Veuillez saisir une désignation'); return; }
      const code = $('#custCode').value.trim();
      P.bord.push({
        key: uid(),
        lot: $('#custLot').value,
        code: code,
        d: d,
        c: $('#custCons').value,
        u: $('#custUnit').value.trim() || 'U',
        q: num($('#custQty').value) || 1,
        pu: num($('#custPu').value) || 0,
        on: true
      });
      syncCablesFromBord();
      touch();
      updKpi();
      paneBord(el);
      toast(`Article personnalisé ajouté à la suite`);
    };
  };

  // Bouton : Créer directement une nouvelle affaire avec ce même Bordereau
  const btnNewFromBord = $('#btnNewAffFromBord');
  if (btnNewFromBord) {
    btnNewFromBord.onclick = () => {
      if (!P.bord || !P.bord.length) {
        toast('Ce bordereau est vide. Ajoutez d’abord des articles ou copiez le bordereau d’une autre affaire.');
        return;
      }
      if (confirm(`Voulez-vous créer une NOUVELLE affaire avec exactement ce même Bordereau (${P.bord.length} articles) ?`)) {
        createNewAffaireWithSameBord(P);
      }
    };
  }

  // Modal : Copier le Bordereau d'une autre affaire (ou d'un devis déjà fait) dans l'affaire courante
  const btnCopyBord = $('#openCopyBordBox');
  if (btnCopyBord) {
    btnCopyBord.onclick = () => {
      const box = $('#addbox');
      // S'assurer que plist contient les dernières modifications
      const otherAffaires = (plist || []).filter(x => {
        const d = x.data || {};
        return d.id !== P.id && Array.isArray(d.bord) && d.bord.length > 0;
      });

      let searchQ = '';
      let previewId = null;

      const renderCopyModal = () => {
        const qNorm = smartNorm(searchQ);
        const filtered = otherAffaires.filter(x => {
          if (!qNorm) return true;
          const d = x.data || {};
          const inf = d.info || {};
          const hay = smartNorm(`${inf.num || ''} ${inf.devis || ''} ${inf.demande || ''} ${inf.contrat || ''} ${inf.objet || ''} ${d.name || ''} ${inf.destinataire || ''} ${inf.commune || ''}`);
          return hay.includes(qNorm);
        });

        const previewAff = previewId ? otherAffaires.find(x => x.id === previewId) : null;
        const previewLines = previewAff && previewAff.data && Array.isArray(previewAff.data.bord) ? previewAff.data.bord : [];

        box.innerHTML = `
          <div style="background:#fff;border:2px solid #0d7a5b;border-radius:10px;padding:16px;margin:12px 0;box-shadow:0 6px 20px rgba(0,0,0,0.12)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <div>
                <h4 style="font-size:18px;color:#0d7a5b;margin:0">📋 Réutiliser le Bordereau d'un devis / d'une affaire déjà réalisée</h4>
                <span style="font-size:12.5px;color:var(--muted)">Sélectionnez un devis déjà établi pour récupérer exactement son Bordereau des prix dans l'affaire actuelle (<b>${esc(P.info.num || P.name)}</b>).</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <label class="btn" style="cursor:pointer;margin:0;font-weight:700;background:#eff6ff;border-color:#93c5fd;color:#1e40af">
                  📂 Importer Bordereau depuis un fichier .json
                  <input type="file" id="impBordJsonFile" accept=".json" style="display:none">
                </label>
                <button class="btn sm" id="btnCloseCopyBord">✕ Fermer</button>
              </div>
            </div>

            <div style="background:#f0fdf4;border:1px solid #86efac;padding:10px 14px;border-radius:8px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:18px;align-items:center">
              <div style="display:flex;align-items:center;gap:8px">
                <b style="color:#166534;font-size:13px">Mode de copie :</b>
                <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;cursor:pointer">
                  <input type="radio" name="copyBordMode" value="replace" checked> 🔄 Remplacer le bordereau actuel
                </label>
                <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;cursor:pointer;margin-left:8px">
                  <input type="radio" name="copyBordMode" value="append"> ➕ Ajouter à la suite du bordereau actuel
                </label>
              </div>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#1e40af;cursor:pointer;margin-left:auto">
                <input type="checkbox" id="chkCopyAlsoPrest" checked style="width:15px;height:15px">
                Copier aussi les Prestations SRM-TTA & la structure réseau (MT/BT)
              </label>
            </div>

            <div style="margin-bottom:10px">
              <input type="text" id="copyBordSearch" placeholder="🔍 Rechercher un devis existant par N° Affaire, N° Devis, N° Demande, Objet, Client, Commune..." value="${esc(searchQ)}" style="width:100%;padding:8px 12px;font-size:13.5px;border:1.5px solid #94a3b8;border-radius:6px">
            </div>

            <div style="max-height:320px;overflow-y:auto;border:1px solid var(--line);border-radius:6px">
              <table style="width:100%;font-size:12.5px">
                <thead>
                  <tr style="position:sticky;top:0;background:#f1f5f9;z-index:2">
                    <th style="width:125px">N° Affaire</th>
                    <th style="width:85px">N° Devis</th>
                    <th style="width:85px">N° Demande</th>
                    <th>Objet du projet / Client</th>
                    <th style="width:75px;text-align:center">Type</th>
                    <th style="width:85px;text-align:center">Articles</th>
                    <th style="width:115px;text-align:right">Montant HT</th>
                    <th style="width:210px;text-align:center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.length ? filtered.map(x => {
                    const d = x.data || {};
                    const inf = d.info || {};
                    const bLines = (d.bord || []).filter(l => l.on !== false);
                    const ht = r2(bLines.reduce((acc, l) => acc + num(l.q) * num(l.pu), 0));
                    const isPrev = previewId === x.id;
                    return `
                      <tr style="background:${isPrev ? '#ecfdf5' : 'transparent'}">
                        <td><span style="display:inline-block;background:#0d7a5b;color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:monospace">${esc(inf.num || 'SET/DPO/...')}</span></td>
                        <td class="c"><b>${esc(inf.devis || '—')}</b></td>
                        <td class="c">${esc(inf.demande || '—')}</td>
                        <td>
                          <b>${esc(inf.objet || d.name || 'Sans objet')}</b>
                          <div style="font-size:11px;color:var(--muted)">Client : ${esc(inf.destinataire || '—')} ${inf.commune ? '• ' + esc(inf.commune) : ''}</div>
                        </td>
                        <td class="c"><span class="pill">${esc(inf.typeAff || 'MT/BT')}</span></td>
                        <td class="c"><b>${(d.bord || []).length}</b> art.</td>
                        <td class="n" style="font-weight:700">${fmt(ht)} DH</td>
                        <td class="c" style="white-space:nowrap">
                          <button class="btn sm" data-prevbord="${esc(x.id)}" title="Voir le détail des articles">${isPrev ? '🔼 Masquer' : '👁️ Aperçu'}</button>
                          <button class="btn sm ok" data-applybord="${esc(x.id)}" style="font-weight:700">📋 Copier ce Bordereau</button>
                        </td>
                      </tr>
                    `;
                  }).join('') : `<tr><td colspan="8" class="empty" style="padding:18px;text-align:center">Aucune autre affaire avec un bordereau trouvée. Vous pouvez aussi importer un fichier <b>.json</b> avec le bouton ci-dessus.</td></tr>`}
                </tbody>
              </table>
            </div>

            ${previewAff ? `
              <div style="margin-top:12px;background:#f8fafc;border:1.5px solid #0d7a5b;border-radius:8px;padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <b style="color:#0d7a5b;font-size:13.5px">👁️ Aperçu du Bordereau de « ${esc(previewAff.data?.info?.objet || previewAff.name)} » (${previewLines.length} articles) :</b>
                  <button class="btn sm ok" data-applybord="${esc(previewAff.id)}" style="font-weight:700">✅ Confirmer la copie de ce Bordereau</button>
                </div>
                <div style="max-height:180px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:6px;background:#fff">
                  <table style="width:100%;font-size:12px">
                    <thead>
                      <tr style="background:#e2e8f0">
                        <th style="width:35px">#</th>
                        <th style="width:90px">N° de Prix</th>
                        <th>Désignation</th>
                        <th style="width:60px">Cons.</th>
                        <th style="width:55px">Unité</th>
                        <th style="width:75px">Qté</th>
                        <th style="width:95px">P.U. HT</th>
                        <th style="width:105px">Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${previewLines.map((l, idx) => `
                        <tr>
                          <td class="c">${idx + 1}</td>
                          <td class="c"><b>${esc(l.code || '')}</b></td>
                          <td>${esc(l.d || '')}</td>
                          <td class="c">${esc(l.c || '')}</td>
                          <td class="c">${esc(l.u || '')}</td>
                          <td class="n">${fmt(num(l.q))}</td>
                          <td class="n">${fmt(num(l.pu))}</td>
                          <td class="n"><b>${fmt(r2(num(l.q) * num(l.pu)))}</b></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
          </div>
        `;

        $('#btnCloseCopyBord').onclick = () => { box.innerHTML = ''; };

        const sInp = $('#copyBordSearch');
        if (sInp) {
          sInp.oninput = () => {
            searchQ = sInp.value;
            renderCopyModal();
            const ni = $('#copyBordSearch');
            if (ni) { ni.focus(); ni.setSelectionRange(searchQ.length, searchQ.length); }
          };
        }

        box.querySelectorAll('[data-prevbord]').forEach(btn => {
          btn.onclick = () => {
            const id = btn.dataset.prevbord;
            previewId = (previewId === id) ? null : id;
            renderCopyModal();
          };
        });

        const applyBordFromData = (srcData, label) => {
          if (!srcData || !Array.isArray(srcData.bord) || !srcData.bord.length) {
            toast('Ce dossier ne contient aucun article dans le Bordereau');
            return;
          }
          const modeEl = box.querySelector('input[name="copyBordMode"]:checked');
          const copyMode = modeEl ? modeEl.value : 'replace';
          const copyPrest = $('#chkCopyAlsoPrest') ? $('#chkCopyAlsoPrest').checked : true;

          const clonedLines = JSON.parse(JSON.stringify(srcData.bord)).map(l => ({
            ...l,
            key: 'b_' + uid()
          }));

          if (copyMode === 'replace') {
            P.bord = clonedLines;
          } else {
            P.bord = (P.bord || []).concat(clonedLines);
          }

          if (copyPrest) {
            if (srcData.prest) P.prest = JSON.parse(JSON.stringify(srcData.prest));
            if (srcData.customPre) P.customPre = JSON.parse(JSON.stringify(srcData.customPre));
            if (srcData.info) {
              P.info.typeAff = srcData.info.typeAff || P.info.typeAff || 'MT/BT';
              P.info.mtSite = srcData.info.mtSite || P.info.mtSite || 'In-Site';
              P.info.mtPose = srcData.info.mtPose || P.info.mtPose || 'Aérien';
              P.info.btPose = srcData.info.btPose || P.info.btPose || 'Aérien';
              if (srcData.info.posteType) P.info.posteType = srcData.info.posteType;
              if (srcData.info.puissance) P.info.puissance = srcData.info.puissance;
            }
          }

          syncCablesFromBord();
          touch();
          updKpi();
          paneBord(el);
          toast(`✅ Bordereau (${clonedLines.length} articles) copié depuis « ${label} » !`);
        };

        box.querySelectorAll('[data-applybord]').forEach(btn => {
          btn.onclick = () => {
            const target = otherAffaires.find(x => x.id === btn.dataset.applybord);
            if (target && target.data) {
              const lbl = target.data.info?.devis ? `Devis N° ${target.data.info.devis}` : (target.data.info?.num || target.name);
              applyBordFromData(target.data, lbl);
            }
          };
        });

        const fileInp = $('#impBordJsonFile');
        if (fileInp) {
          fileInp.onchange = e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
              try {
                const parsed = JSON.parse(rd.result);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  // Fichier multi-projets : prendre le premier ayant un bordereau
                  const firstWithBord = parsed.find(x => (x.data || x)?.bord?.length > 0);
                  if (firstWithBord) {
                    const d = firstWithBord.data || firstWithBord;
                    applyBordFromData(d, d.info?.objet || d.name || f.name);
                  } else {
                    toast('Aucun bordereau trouvé dans ce fichier JSON');
                  }
                } else if (parsed && Array.isArray(parsed.bord)) {
                  applyBordFromData(parsed, parsed.info?.objet || parsed.name || f.name);
                } else {
                  toast('Format de fichier JSON non reconnu');
                }
              } catch (err) {
                toast('Erreur lors de la lecture du fichier JSON');
              }
            };
            rd.readAsText(f);
            e.target.value = '';
          };
        }
      };

      renderCopyModal();
    };
  }
}

/* ===== Onglet 3 : Prestations SRM-TTA ===== */
function panePrest(el) {
  const all = PRE_DEFAULT.concat((P.customPre || []).map(x => ({ name: x.name, p: num(x.p), cu: 1 })));
  const ev = computeEval();
  
  el.innerHTML = `
    <div class="bar">
      <div>
        <h3 style="font-size:22px;color:var(--brand)">PRESTATIONS SRM-TTA</h3>
        <p class="note" style="margin:2px 0 0">
          Cochez les prestations à facturer. « Peines et soins » est calculé automatiquement à <b>${P.peines}%</b> des travaux HT (${fmt(ev.b.ht)} DH).
        </p>
      </div>
    </div>
    
    <div class="tw" style="margin-top:10px">
      <table>
        <thead>
          <tr>
            <th style="width:40px">Actif</th>
            <th>Désignation de la prestation</th>
            <th style="width:140px">Prix Unitaire HT (DH)</th>
            <th style="width:90px">Quantité</th>
            <th style="width:140px">Montant HT (DH)</th>
          </tr>
        </thead>
        <tbody>
          ${all.map((a, i) => {
            const s = (P.prest && P.prest[a.name]) || {};
            const isPeines = a.name === PEINES;
            const row = ev.pr.find(x => x.name === a.name) || (ev.specialPr || []).find(x => x.name === a.name);
            const puVal = isPeines ? fmt(r2(ev.b.ht * (num(P.peines ?? 20) / 100))) : (s.pu != null && s.pu !== '' ? s.pu : a.p);
            return `
              <tr>
                <td class="c">
                  <input type="checkbox" data-pc="${i}" ${s.on ? 'checked' : ''} style="width:16px;height:16px">
                </td>
                <td style="font-weight:500">${esc(a.name)}</td>
                <td class="n">
                  ${isPeines ? puVal : `<input type="text" data-pp="${i}" value="${puVal}" style="width:110px;text-align:right">`}
                </td>
                <td class="n">
                  ${isPeines ? '1' : `<input type="text" data-pq="${i}" value="${s.qty != null ? s.qty : 1}" style="width:70px;text-align:right">`}
                </td>
                <td class="n" style="font-weight:600" data-pt="${i}">${row ? fmt(row.tot) : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <table class="paper xt right" style="max-width:380px">
        <tbody>
          <tr><td>TOTAL PRESTATIONS SRM HTVA</td><td class="n b">${fmt(ev.pht)} DH</td></tr>
          <tr><td>TVA ${P.tva}%</td><td class="n">${fmt(ev.ptva)} DH</td></tr>
          <tr class="b"><td>SOUS-TOTAL PRESTATIONS SRM TTC</td><td class="n">${fmt(ev.corePttc)} DH</td></tr>
          ${(ev.specialPr || []).map(sp => `
            <tr><td>+ ${esc(sp.name)} (TTC)</td><td class="n b">${fmt(sp.tot)} DH</td></tr>
          `).join('')}
          <tr class="b blue"><td>TOTAL PRESTATIONS TTC</td><td class="n">${fmt(ev.pttc)} DH</td></tr>
          <tr class="b" style="background:#fef3c7"><td style="color:#b45309">TOTAL GÉNÉRAL TTC (Travaux + Prestations)</td><td class="n" style="color:#b45309">${fmt(ev.total)} DH</td></tr>
        </tbody>
      </table>
    </div>
    
    <details style="margin-top:16px"><summary>➕ Ajouter une prestation personnalisée</summary>
      <div class="in grid2" style="padding:10px 0">
        <label class="f wide">Intitulé de la prestation
          <input type="text" id="cpn" placeholder="Nom de la prestation...">
        </label>
        <label class="f">Prix Unitaire HT (DH)
          <input type="number" id="cpp" placeholder="0.00">
        </label>
        <button class="btn pri" id="cpa" style="align-self:end">Ajouter la prestation</button>
      </div>
    </details>
  `;
  
  el.querySelectorAll('[data-pc]').forEach(x => {
    x.onchange = () => {
      const a = all[+x.dataset.pc];
      P.prest = P.prest || {};
      P.prest[a.name] = Object.assign(P.prest[a.name] || {}, { on: x.checked });
      touch();
      updKpi();
      panePrest(el);
    };
  });
  
  el.querySelectorAll('[data-pp]').forEach(x => {
    x.oninput = () => {
      const a = all[+x.dataset.pp];
      P.prest = P.prest || {};
      P.prest[a.name] = Object.assign(P.prest[a.name] || {}, { pu: x.value });
      touch();
      updKpi();
    };
    x.onchange = () => panePrest(el);
  });
  
  el.querySelectorAll('[data-pq]').forEach(x => {
    x.oninput = () => {
      const a = all[+x.dataset.pq];
      P.prest = P.prest || {};
      P.prest[a.name] = Object.assign(P.prest[a.name] || {}, { qty: x.value });
      touch();
      updKpi();
    };
    x.onchange = () => panePrest(el);
  });
  
  const cpaBtn = $('#cpa');
  if (cpaBtn) {
    cpaBtn.onclick = () => {
      const n = $('#cpn').value.trim();
      if (!n) { toast('Précisez le nom de la prestation'); return; }
      P.customPre = P.customPre || [];
      P.customPre.push({ name: n, p: num($('#cpp').value) });
      P.prest = P.prest || {};
      P.prest[n] = { on: true, qty: 1, pu: num($('#cpp').value) };
      touch();
      updKpi();
      panePrest(el);
      toast('Prestation ajoutée');
    };
  }
}

/* ===== Onglet 4 : Documents clients ===== */
const DOCS = [
  ['garde', 'Page de garde'],
  ['lettre', 'Lettre d’envoi'],
  ['bordfinal', 'Bordereau détaillé (avec prix)'],
  ['devis', 'Devis client (sans prix)'],
  ['rapport', "Rapport d'étude"],
  ['evalglob', 'Évaluation globale'],
  ['evaltrav', 'Év. travaux SRM'],
  ['evalprest', 'Év. prestations SRM']
];

function paneDocs(el) {
  const e = computeEval();
  const d = P.doc || (P.doc = {});
  const sigAuto = getSignatairePrestations(e.pttc);
  const sigCfg = getSigCfg();
  if (!docSub || !DOCS.some(x => x[0] === docSub)) docSub = 'garde';
  
  el.innerHTML = `
    <!-- Boutons documents (conforme à l'image utilisateur) -->
    <div class="sub">
      ${DOCS.map(item => `
        <button data-d="${item[0]}" class="${docSub === item[0] ? 'on' : ''}">${item[1]}</button>
      `).join('')}
    </div>
    
    <!-- Barre d'actions -->
    <div class="bar">
      <button class="btn pri" id="btnPrint">🖨️ Imprimer ce document</button>
      <button class="btn" id="dlOne">📄 Télécharger ce document (.pdf)</button>
      <button class="btn ok" id="dlAll" style="font-weight:700">📦 Télécharger Dossier Complet (WinRAR / ZIP — 8 PDF séparés)</button>
      <span class="note" style="margin:0" id="pdfGenStatus">Chaque document est généré en fichier PDF séparé dans l'archive.</span>
    </div>
    
    <!-- Paramètres de la lettre et des documents -->
    <details open style="margin-bottom:14px">
      <summary>⚙️ Paramètres de la Lettre (Ville, Civilité, Signataire sur Prestations, Logo)</summary>
      <div class="in grid2" style="background:#f8fafc;padding:12px;border-radius:6px">
        <label class="f">
          Ville d'émission (Lettre)
          <select id="docVille">
            <option value="Ouezzane" ${d.ville === 'Ouezzane' ? 'selected' : ''}>Ouezzane</option>
            <option value="Tanger" ${d.ville === 'Tanger' ? 'selected' : ''}>Tanger</option>
            <option value="Tétouan" ${d.ville === 'Tétouan' ? 'selected' : ''}>Tétouan</option>
            <option value="Larache" ${d.ville === 'Larache' ? 'selected' : ''}>Larache</option>
            <option value="Chefchaouen" ${d.ville === 'Chefchaouen' ? 'selected' : ''}>Chefchaouen</option>
            <option value="Al Hoceima" ${d.ville === 'Al Hoceima' ? 'selected' : ''}>Al Hoceima</option>
          </select>
        </label>
        
        <label class="f">
          Date dans la Lettre (après "Le :")
          <input type="text" value="VIDE (conformément à votre consigne)" disabled style="background:#f1f5f9;color:var(--muted)">
        </label>
        
        <label class="f">
          Civilité d'appel (Monsieur le Gérant, Directeur, etc.)
          <select id="docCivSelect">
            ${CIV_OPTIONS.map(c => `<option value="${c}" ${d.civilite === c ? 'selected' : ''}>${c}</option>`).join('')}
            <option value="__custom" ${!CIV_OPTIONS.includes(d.civilite) ? 'selected' : ''}>Personnalisé...</option>
          </select>
        </label>
        
        <label class="f">
          Civilité personnalisée ou saisie libre
          <input type="text" id="docCiv" value="${esc(d.civilite || 'Monsieur le Gérant')}">
        </label>
        
        <label class="f wide">
          Signataire de la Lettre (Règle sur Prestations SRM : ${sigRuleLabel()})
          <select id="docSignataireMode">
            <option value="auto" ${d.signataireMode === 'auto' || !d.signataireMode ? 'selected' : ''}>
              ✅ Automatique sur Prestations SRM : « ${esc(sigAuto)} » (Prestations = ${fmt(e.pttc)} DH TTC)
            </option>
            <option value="dp" ${d.signataireMode === 'dp' ? 'selected' : ''}>${esc(sigCfg.t1)} (forcé)</option>
            <option value="dc" ${d.signataireMode === 'dc' ? 'selected' : ''}>${esc(sigCfg.t2)} (forcé)</option>
            <option value="dg" ${d.signataireMode === 'dg' ? 'selected' : ''}>${esc(sigCfg.t3)} (forcé)</option>
            <option value="custom" ${d.signataireMode === 'custom' ? 'selected' : ''}>Personnalisé...</option>
          </select>
        </label>

        ${d.signataireMode === 'custom' ? `
          <label class="f wide">Titre personnalisé du signataire
            <input type="text" id="docSigCustom" value="${esc(d.signataireCustom || '')}">
          </label>
        ` : ''}

        <div class="wide" style="grid-column:1/-1;background:#fff7ed;border:1.5px solid #fdba74;border-radius:8px;padding:12px 14px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
            <b style="color:#9a3412;font-size:13.5px">✏️ Modifier les règles du Signataire (seuils &amp; titres) — appliqué à toutes les affaires</b>
            <button type="button" class="btn sm" id="sigCfgReset">↺ Valeurs par défaut</button>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="color:#9a3412;text-align:left">
                <th style="padding:4px 6px;width:42%">Montant Prestations SRM (TTC)</th>
                <th style="padding:4px 6px">Titre du signataire</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:4px 6px">&le; <input type="number" id="sigS1" value="${sigCfg.s1}" min="0" step="1000" style="width:130px;text-align:right"> DH</td>
                <td style="padding:4px 6px"><input type="text" id="sigT1" value="${esc(sigCfg.t1)}" style="width:100%"></td>
              </tr>
              <tr>
                <td style="padding:4px 6px">entre <b id="sigS1Lbl">${fmt(sigCfg.s1)}</b> et <input type="number" id="sigS2" value="${sigCfg.s2}" min="0" step="1000" style="width:130px;text-align:right"> DH</td>
                <td style="padding:4px 6px"><input type="text" id="sigT2" value="${esc(sigCfg.t2)}" style="width:100%"></td>
              </tr>
              <tr>
                <td style="padding:4px 6px">&gt; <b id="sigS2Lbl">${fmt(sigCfg.s2)}</b> DH</td>
                <td style="padding:4px 6px"><input type="text" id="sigT3" value="${esc(sigCfg.t3)}" style="width:100%"></td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn ok sm" id="sigCfgSave">💾 Enregistrer les règles</button>
            <span style="font-size:12px;color:#9a3412">Signataire actuel : <b id="sigNowLbl">${esc(sigAuto)}</b> (Prestations = ${fmt(e.pttc)} DH TTC)</span>
          </div>
        </div>

        <label class="f wide" style="flex-direction:row;align-items:center;gap:8px;text-transform:none">
          <input type="checkbox" id="docShowLogo" ${d.showLogo ? 'checked' : ''} style="width:16px;height:16px">
          <b>Afficher le logo SRM-TTA sur la Lettre d'envoi</b> (Décocher si la lettre est imprimée sur papier avec en-tête déjà pré-imprimé)
        </label>
        
        <label class="f">Validateur
          <input type="text" id="docVal" value="${esc(d.validateur || 'Préparée et validée')}">
        </label>
        <label class="f">Notre référence (N/Réf)
          <input type="text" id="docNRef" value="${esc(d.nRef || '…………../ DC/DG')}">
        </label>
        <label class="f">Délai d'exécution
          <input type="text" id="docDelai" value="${esc(d.delai || 'six (06) mois')}">
        </label>
        <label class="f">Puissance demandée (kVA)
          <input type="text" id="docPuissance" value="${esc(P.info.puissance || '')}" placeholder="Ex: 50, 100, 160...">
        </label>
        <label class="f">Frais traversée de route DRETL (DH TTC)
          <input type="number" id="docRoute" value="${d.fraisRoute || ''}">
        </label>
        <label class="f">Participation tiers (DH TTC)
          <input type="number" id="docTiers" value="${d.partTiers || ''}">
        </label>
        <label class="f wide" style="background:#fefce8;padding:8px 10px;border:1px solid #fde047;border-radius:6px">
          <span style="font-weight:700;color:#854d0e">💬 Message du client (Évaluation des Travaux SRM) :</span>
          <textarea rows="2" id="docMsgClientInp" style="font-size:12.5px;padding:6px;border:1px solid #ca8a04;border-radius:4px;margin-top:4px;width:100%" placeholder="Saisir ou modifier ici le message du client...">${esc(P.info.messageClient || '')}</textarea>
        </label>
      </div>
    </details>
    
    <!-- Aperçu du document -->
    <div class="doc-box" id="docPreview"></div>
  `;
  
  const drawDoc = () => {
    const fn = DOCFN[docSub] || DOCFN['garde'];
    const prevEl = $('#docPreview');
    if (fn && prevEl) {
      try {
        prevEl.innerHTML = fn();
        prevEl.querySelectorAll('[data-setcb]').forEach(item => {
          item.onclick = () => {
            const fKey = item.dataset.setcb;
            const fVal = item.dataset.val;
            if (fKey && fVal) {
              P.info[fKey] = fVal;
              touch();
              drawDoc();
            }
          };
        });
      } catch (err) {
        console.error('Erreur affichage document:', err);
        prevEl.innerHTML = '<div class="paper"><p style="color:red">Erreur lors du rendu du document : ' + esc(err.message) + '</p></div>';
      }
    }
  };
  drawDoc();
  
  el.querySelectorAll('.sub button').forEach(b => {
    b.onclick = () => {
      docSub = b.dataset.d;
      paneDocs(el);
    };
  });
  
  $('#docVille').onchange = e => { d.ville = e.target.value; touch(); drawDoc(); };
  
  $('#docCivSelect').onchange = e => {
    if (e.target.value !== '__custom') {
      d.civilite = e.target.value;
      $('#docCiv').value = e.target.value;
      touch();
      drawDoc();
    }
  };
  $('#docCiv').oninput = e => { d.civilite = e.target.value; touch(); drawDoc(); };
  
  $('#docSignataireMode').onchange = e => { d.signataireMode = e.target.value; touch(); paneDocs(el); };

  // Règles du signataire (seuils & titres modifiables)
  const readSigForm = () => ({
    s1: num($('#sigS1').value),
    s2: num($('#sigS2').value),
    t1: $('#sigT1').value.trim(),
    t2: $('#sigT2').value.trim(),
    t3: $('#sigT3').value.trim()
  });
  ['#sigS1', '#sigS2'].forEach(id => {
    const inp = $(id);
    if (inp) inp.oninput = () => {
      const f = readSigForm();
      $('#sigS1Lbl').textContent = fmt(f.s1);
      $('#sigS2Lbl').textContent = fmt(f.s2);
    };
  });
  if ($('#sigCfgSave')) $('#sigCfgSave').onclick = () => {
    const f = readSigForm();
    if (!(f.s1 > 0) || !(f.s2 > 0)) { toast('Veuillez saisir des montants valides'); return; }
    if (f.s2 < f.s1) { toast('Le 2e seuil doit être supérieur au 1er seuil'); return; }
    saveSigCfg(f);
    const ex = $('#main') && $('#main').querySelector('.card.top');
    if (ex) { updKpi(); }
    paneDocs(el);
    updKpi();
    toast('Règles du signataire enregistrées');
  };
  if ($('#sigCfgReset')) $('#sigCfgReset').onclick = () => {
    saveSigCfg(Object.assign({}, SIG_CFG_DEFAULT));
    paneDocs(el);
    updKpi();
    toast('Règles du signataire réinitialisées');
  };
  if ($('#docSigCustom')) {
    $('#docSigCustom').oninput = e => { d.signataireCustom = e.target.value; touch(); drawDoc(); };
  }
  
  $('#docShowLogo').onchange = e => { d.showLogo = e.target.checked; touch(); drawDoc(); };
  
  $('#docVal').oninput = e => { d.validateur = e.target.value; touch(); drawDoc(); };
  $('#docNRef').oninput = e => { d.nRef = e.target.value; touch(); drawDoc(); };
  $('#docDelai').oninput = e => { d.delai = e.target.value; touch(); drawDoc(); };
  const docPuiss = $('#docPuissance');
  if (docPuiss) {
    docPuiss.oninput = e => {
      P.info.puissance = e.target.value.trim();
      touch();
      drawDoc();
    };
  }
  $('#docRoute').oninput = e => { d.fraisRoute = num(e.target.value); touch(); drawDoc(); };
  $('#docTiers').oninput = e => { d.partTiers = num(e.target.value); touch(); drawDoc(); };
  
  const docMsgClientInp = $('#docMsgClientInp');
  if (docMsgClientInp) {
    docMsgClientInp.oninput = () => {
      P.info.messageClient = docMsgClientInp.value;
      touch();
      drawDoc();
    };
  }
  
  $('#btnPrint').onclick = () => window.print();
  $('#dlOne').onclick = () => downloadSingleDocPdf(docSub);
  $('#dlAll').onclick = () => downloadAllDocsZipPdf();
}

function docName(k) {
  return ((P.info.demande || P.name || 'affaire') + '_' + k).replace(/[^\w\-]+/g, '_');
}

/* ===== Génération PDF Haute Qualité par document & Archive ZIP / WinRAR ===== */
async function generateDocPdfArrayBuffer(docKey) {
  const fn = DOCFN[docKey];
  if (!fn) throw new Error('Document inconnu : ' + docKey);
  if (!window.jspdf || !window.html2canvas) {
    throw new Error('Bibliothèques PDF (jsPDF / html2canvas) non chargées. Vérifiez votre connexion internet.');
  }
  const { jsPDF } = window.jspdf;

  // Conteneur hors-écran calibré au format A4 (794px de large)
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;z-index:-1;';
  container.innerHTML = fn();
  document.body.appendChild(container);

  try {
    const papers = Array.from(container.querySelectorAll('.paper'));
    const targets = papers.length ? papers : [container];
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageW = 210;
    const pageH = 297;
    const margin = 6;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    let firstPage = true;

    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      // Retirer ombres et marges externes pour un rendu A4 propre
      el.style.boxShadow = 'none';
      el.style.margin = '0';
      el.style.width = '794px';
      el.style.maxWidth = '794px';

      const canvas = await window.html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgW = maxW;
      const imgH = (canvas.height * imgW) / canvas.width;

      // Si le bloc tient sur 1 page A4 (ou dépasse légèrement <= 1.18x A4), on l'ajuste sur une seule page A4
      if (imgH <= maxH * 1.18) {
        if (!firstPage) pdf.addPage();
        firstPage = false;
        let finalW = imgW;
        let finalH = imgH;
        let xOffset = margin;
        if (imgH > maxH) {
          const ratio = maxH / imgH;
          finalH = maxH;
          finalW = imgW * ratio;
          xOffset = (pageW - finalW) / 2;
        }
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', xOffset, margin, finalW, finalH, undefined, 'FAST');
      } else {
        // Document long (ex: Bordereau sur plusieurs pages) : découpage propre en pages A4
        const pxPerMm = canvas.width / imgW;
        const sliceHeightPx = Math.floor(maxH * pxPerMm);
        let yPx = 0;
        while (yPx < canvas.height) {
          if (!firstPage) pdf.addPage();
          firstPage = false;
          const curSlicePx = Math.min(sliceHeightPx, canvas.height - yPx);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = curSlicePx;
          const ctx = sliceCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, yPx, canvas.width, curSlicePx, 0, 0, canvas.width, curSlicePx);
          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const sliceH_mm = curSlicePx / pxPerMm;
          pdf.addImage(sliceImgData, 'JPEG', margin, margin, imgW, sliceH_mm, undefined, 'FAST');
          yPx += curSlicePx;
        }
      }
    }

    return pdf.output('arraybuffer');
  } finally {
    document.body.removeChild(container);
  }
}

async function downloadSingleDocPdf(docKey) {
  const btn = $('#dlOne');
  const origText = btn ? btn.textContent : '';
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Génération du PDF...'; }
    toast('Génération du fichier PDF en cours...');
    const buf = await generateDocPdfArrayBuffer(docKey);
    const blob = new Blob([buf], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = docName(docKey) + '.pdf';
    a.click();
    toast('PDF téléchargé avec succès : ' + a.download);
  } catch (err) {
    console.error(err);
    toast('Erreur génération PDF : ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

async function downloadAllDocsZipPdf() {
  if (!window.JSZip) {
    toast('Bibliothèque JSZip non chargée. Vérifiez votre connexion internet.');
    return;
  }
  const btn = $('#dlAll');
  const statusEl = $('#pdfGenStatus');
  const origText = btn ? btn.textContent : '';
  const docsToExport = [
    ['garde', '01_Page_de_garde.pdf'],
    ['lettre', '02_Lettre_d_envoi.pdf'],
    ['bordfinal', '03_Bordereau_detaille_avec_prix.pdf'],
    ['devis', '04_Devis_client_sans_prix.pdf'],
    ['rapport', '05_Rapport_d_etude.pdf'],
    ['evalglob', '06_Evaluation_globale.pdf'],
    ['evaltrav', '07_Evaluation_travaux_SRM.pdf'],
    ['evalprest', '08_Evaluation_prestations_SRM.pdf']
  ];

  try {
    if (btn) btn.disabled = true;
    const zip = new window.JSZip();
    const safeNum = (P.info.num || P.info.demande || 'Affaire').replace(/[/\\?%*:|"<>\s]+/g, '_');
    const safeObj = (P.info.objet || P.name || 'Dossier').replace(/[/\\?%*:|"<>]+/g, '_').trim().slice(0, 50);
    const folderName = `Dossier_${safeNum}_${safeObj}`;
    const folder = zip.folder(folderName);

    for (let idx = 0; idx < docsToExport.length; idx++) {
      const [key, fileName] = docsToExport[idx];
      const msg = `⏳ Génération PDF (${idx + 1}/${docsToExport.length}) : ${fileName}...`;
      if (btn) btn.textContent = msg;
      if (statusEl) statusEl.textContent = msg;
      const pdfBuf = await generateDocPdfArrayBuffer(key);
      folder.file(fileName, pdfBuf);
    }

    if (btn) btn.textContent = '📦 Compression WinRAR / ZIP...';
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = `${folderName}.zip`;
    a.click();
    if (statusEl) statusEl.textContent = '✅ Dossier complet téléchargé (8 fichiers PDF séparés dans l’archive).';
    toast('Dossier complet (8 PDF séparés) téléchargé en archive ZIP / WinRAR !');
  } catch (err) {
    console.error(err);
    toast('Erreur lors de la création de l’archive : ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

function downloadHtml(filename, content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast('Fichier téléchargé : ' + filename);
}

function htmlWrapper(pages) {
  const css = $('style').textContent;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(P.info.objet || P.name)}</title>
<style>
body { margin:0; background:#eef2f7; padding:16px; font-family:Arial, sans-serif; }
${css}
@page { size: A4; margin: 10mm; }
@media print {
  body { background: #fff !important; padding: 0 !important; }
  .paper { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
}
</style>
</head>
<body>
${pages.map((p, i) => i < pages.length - 1 ? p.replace('class="paper"', 'class="paper pb"') : p).join('')}
</body>
</html>`;
}

function renderLogo(height = 75) {
  if (typeof LOGO !== 'undefined' && LOGO) {
    return `<img src="${LOGO}" alt="SRM-TTA" style="height:${height}px;max-width:240px;object-fit:contain;display:block">`;
  }
  return '';
}

/* En-tête conforme à 100% à la photo en pièce jointe : Logo + Demande/Contrat/Devis + Objet souligné + Commune/Province + Encadré Titre */
function docExcelHeader(docTitle) {
  const i = P.info || {};
  const demande = i.demande || '';
  const contrat = i.contrat || '';
  const devis = i.devis || '';
  const objet = i.objet || '';
  const commune = i.commune || '';
  const province = i.province || '';

  return `
    <div class="excel-header-block" style="margin-bottom:14px;background:#fff;border:none">
      <!-- 1. Logo SRM-TTA -->
      <div style="margin-bottom:12px">
        ${renderLogo(75)}
      </div>

      <!-- 2. Ligne Demande / Contrat / Devis (conforme à la capture Excel bb995ad1.png) -->
      <div style="display:flex;justify-content:center;gap:65px;font-size:13px;font-weight:700;margin-bottom:16px;color:#000">
        <div>Demande : <span style="font-weight:600">${esc(demande)}</span></div>
        <div>Contrat : <span style="font-weight:600">${esc(contrat)}</span></div>
        <div>Devis : <span style="font-weight:600">${esc(devis)}</span></div>
      </div>

      <!-- 3. Bloc Objet, Commune, Province (SANS AUCUN TRAIT FIN, sans bordure, sans soulignement) -->
      <table style="width:100%;border-collapse:collapse;border:none;font-size:13px;line-height:1.7;margin-bottom:16px;background:transparent">
        <tbody>
          <tr style="border:none">
            <td style="width:100px;font-weight:700;vertical-align:top;padding:2px 0;border:none;color:#000">
              Objet:
            </td>
            <td style="width:18px;font-weight:700;vertical-align:top;padding:2px 0;border:none;color:#000">
              :
            </td>
            <td style="font-weight:700;color:#000;padding:2px 0;border:none;vertical-align:top">
              ${esc(objet)}
            </td>
          </tr>
          <tr style="border:none">
            <td style="font-weight:700;padding:2px 0;border:none;color:#000">
              Commune
            </td>
            <td style="font-weight:700;padding:2px 0;border:none;color:#000">
              :
            </td>
            <td style="font-weight:700;color:#000;padding:2px 0;border:none">
              ${esc(commune)}
            </td>
          </tr>
          <tr style="border:none">
            <td style="font-weight:700;padding:2px 0;border:none;color:#000">
              Province
            </td>
            <td style="font-weight:700;padding:2px 0;border:none;color:#000">
              :
            </td>
            <td style="font-weight:700;color:#000;padding:2px 0;border:none">
              ${esc(province)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 4. Encadré Titre (Cadre rectangulaire noir centré comme sur la capture) -->
      ${docTitle ? `
        <div style="border:2px solid #000;padding:6px 14px;text-align:center;font-weight:800;font-size:13.5px;text-transform:uppercase;margin:14px auto 18px;background:#fff;letter-spacing:0.5px;color:#000">
          ${docTitle}
        </div>
      ` : ''}
    </div>
  `;
}

function docStandardHeader(docTitle, docSubtitle = '') {
  const fullTitle = docSubtitle ? `${docTitle} (${docSubtitle})` : docTitle;
  return docExcelHeader(fullTitle);
}

function bordHead() {
  return '';
}

function exTop(mode) {
  return '';
}

function exObj(mode) {
  return '';
}

function sigTable() {
  return `
    <div class="sig-bottom-block" style="margin-top:auto;padding-top:20px;page-break-inside:avoid">
      <table class="sig-box-table" style="width:100%;border-collapse:collapse;border:1.5px solid #000;background:#fff">
        <thead>
          <tr>
            <th style="width:25%;border:1.5px solid #000;padding:8px 4px;font-size:12px;font-weight:700;text-align:center;color:#000;background:#fff">Conducteur de Travaux</th>
            <th style="width:25%;border:1.5px solid #000;padding:8px 4px;font-size:12px;font-weight:700;text-align:center;color:#000;background:#fff">Chef de Service</th>
            <th style="width:25%;border:1.5px solid #000;padding:8px 4px;font-size:12px;font-weight:700;text-align:center;color:#000;background:#fff">Chef département</th>
            <th style="width:25%;border:1.5px solid #000;padding:8px 4px;font-size:12px;font-weight:700;text-align:center;color:#000;background:#fff">Directeur Provincial</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1.5px solid #000;height:125px;background:#fff"></td>
            <td style="border:1.5px solid #000;height:125px;background:#fff"></td>
            <td style="border:1.5px solid #000;height:125px;background:#fff"></td>
            <td style="border:1.5px solid #000;height:125px;background:#fff"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* 0. Page de garde (Sans traits de grille Excel, conforme à la photo utilisateur) */
function dGarde() {
  const i = P.info;
  const numAffaire = i.num || '';
  const partenaire = i.destinataire || i.client || i.partenaire || '';
  const intitule = i.intitulePartenaire || '';
  const adresse = i.adresseCorresp || i.adresse || '';
  const dateDemandeVal = fd(i.dateDemande) || '';
  const dateEtudeVal = fd(i.date) || '';
  
  return `
    <div class="paper" style="min-height:280mm;display:flex;flex-direction:column;justify-content:space-between;padding:24px 38px 28px;background:#fff">
      <div>
        ${renderLogo()}
        
        <div style="border:2px solid #000;border-radius:2px;padding:12px 20px;text-align:center;font-size:18px;font-weight:800;max-width:440px;margin:25px auto 35px;letter-spacing:0.5px">
          Affaire: ${esc(numAffaire)}
        </div>
        
        <!-- Tableau 1 : Informations principales du projet -->
        <table style="width:100%;border-collapse:collapse;margin:25px 0;font-size:13.5px;border:none">
          <tbody>
            <tr>
              <td style="width:180px;padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">Objet</td>
              <td style="width:20px;padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0;line-height:1.4">${esc(i.objet || '')}</td>
            </tr>
            ${i.commune ? `<tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">Commune</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(i.commune)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">Province</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(i.province || '')}</td>
            </tr>
            <tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">Partenaire</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(partenaire)}</td>
            </tr>
            <tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">Intitulé Partenaire</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(intitule)}</td>
            </tr>
            <tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">Adresse Partenaire</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(adresse)}</td>
            </tr>
            <tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">DATE DE DEMANDE</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(dateDemandeVal)}</td>
            </tr>
            <tr>
              <td style="padding:9px 6px;font-weight:800;border-bottom:1px solid #e2e8f0;text-decoration:underline">DATE D'ÉTUDE</td>
              <td style="padding:9px 0;font-weight:800;border-bottom:1px solid #e2e8f0">:</td>
              <td style="padding:9px 6px;font-weight:600;border-bottom:1px solid #e2e8f0">${esc(dateEtudeVal)}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="height:35px"></div>
        
        <!-- Tableau 2 : Numéros administratifs officiels -->
        <table style="width:60%;border-collapse:collapse;margin:15px 0 35px;font-size:13.5px;border:none">
          <tbody>
            <tr>
              <td style="width:160px;padding:8px 6px;font-weight:800;border-bottom:1.5px solid #000">DEMANDE N°</td>
              <td style="width:20px;padding:8px 0;font-weight:800;border-bottom:1.5px solid #000">:</td>
              <td style="padding:8px 6px;font-weight:800;border-bottom:1.5px solid #000">${esc(i.demande || '')}</td>
            </tr>
            <tr>
              <td style="width:160px;padding:8px 6px;font-weight:800;border-bottom:1.5px solid #000">CONTRAT N°</td>
              <td style="width:20px;padding:8px 0;font-weight:800;border-bottom:1.5px solid #000">:</td>
              <td style="padding:8px 6px;font-weight:800;border-bottom:1.5px solid #000">${esc(i.contrat || '')}</td>
            </tr>
            <tr>
              <td style="width:160px;padding:8px 6px;font-weight:800;border-bottom:1.5px solid #000">DEVIS N°</td>
              <td style="width:20px;padding:8px 0;font-weight:800;border-bottom:1.5px solid #000">:</td>
              <td style="padding:8px 6px;font-weight:800;border-bottom:1.5px solid #000">${esc(i.devis || '')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function exPrestT(e, mode) {
  return `
    <table class="exb">
      <tbody>
        ${e.pr.map(x => `
          <tr>
            <td class="ce">${esc(x.name)}</td>
            <td class="ce" style="width:26%">${dh(x.pu)}</td>
            <td class="ce" style="width:12%">${fq(x.q)}</td>
            <td class="n" style="width:20%">${dh(x.tot)}</td>
          </tr>
        `).join('') || '<tr><td colspan="4" class="ce">—</td></tr>'}
        <tr><td class="nb" colspan="2"></td><td class="${mode === 'a' ? 'ce' : 'blue'}">TOTAL HTVA</td><td class="n b">${dh(e.pht)}</td></tr>
        <tr><td class="nb" colspan="2"></td><td class="${mode === 'a' ? 'ce' : 'blue'}">TVA ${P.tva}%</td><td class="n">${dh(e.ptva)}</td></tr>
        <tr><td class="nb" colspan="2"></td><td class="${mode === 'a' ? 'ce' : 'blue'}">TOTAL TTC</td><td class="n b">${dh(e.corePttc)}</td></tr>
      </tbody>
    </table>
  `;
}

function exBox(label, val) {
  return `
    <table class="exg">
      <tbody>
        <tr>
          <td style="text-align:right;font-weight:700;padding-right:14px">${label}</td>
          <td style="width:150px"><div class="bx">${val}</div></td>
        </tr>
      </tbody>
    </table>
  `;
}

function exLettresText(v) { return esc(enLettres(v)); }
function exLettres(v) {
  return `
    <div style="margin-top:12px;font-size:12.5px">
      Arrêtée la présente somme de :<br>
      <b>${esc(enLettres(v))}</b>
    </div>
  `;
}

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/* Affiche dynamiquement UNIQUEMENT les prestations spéciales cochées :
   - Equipement cellule depart 22kV
   - Frais Traversee ADM
   - Frais Traversee ONCF
   - Frais d'étude du dossier traversée de route par la DPETL
   (ainsi que Participation entre tiers si renseigné > 0) */
function renderDynamicSpecialSections(e, x, startIdxRoman) {
  const sections = [];
  let rIdx = startIdxRoman; // 2 -> 'III' pour Év. travaux, 1 -> 'II' pour Év. prestations

  (e.specialPr || []).forEach(sp => {
    const rom = ROMANS[rIdx] || String(rIdx + 1);
    rIdx++;
    sections.push(`
      <div class="exh2">${rom}) ${esc(sp.name)}</div>
      <table class="exa"><tbody><tr><td class="b">Total ${rom} (TTC)</td><td class="n b">${dh(sp.tot)}</td></tr></tbody></table>
    `);
  });

  // Si l'utilisateur a saisi manuellement des frais de route dans Paramètres sans cocher la case DPETL
  if (x && x.route > 0 && !(e.specialPr || []).some(s => smartNorm(s.name).includes('traversee de route'))) {
    const rom = ROMANS[rIdx] || String(rIdx + 1);
    rIdx++;
    sections.push(`
      <div class="exh2">${rom}) Frais d'étude du dossier traversée de route par la DPETL</div>
      <table class="exa"><tbody><tr><td class="b">Total ${rom} (TTC)</td><td class="n b">${dh(x.route)}</td></tr></tbody></table>
    `);
  }

  // Participation entre tiers uniquement si > 0
  if (x && x.tiers > 0) {
    const rom = ROMANS[rIdx] || String(rIdx + 1);
    rIdx++;
    sections.push(`
      <div class="exh2">${rom}) Participation entre tiers sur ouvrages existants</div>
      <table class="exa"><tbody><tr><td class="b">Total ${rom} (TTC)</td><td class="n b">${dh(x.tiers)}</td></tr></tbody></table>
    `);
  }

  return sections.join('');
}

function exSpecial(e, x, total, isPrest) {
  const startIdxRoman = isPrest ? 1 : 2; // 'II' si isPrest, 'III' sinon
  const dynamicHtml = renderDynamicSpecialSections(e, x, startIdxRoman);
  const msgClient = (P.info && P.info.messageClient) ? String(P.info.messageClient).trim() : '';
  return `
    ${dynamicHtml}
    <div style="height:12px"></div>
    ${exBox('Total G' + (isPrest ? '&nbsp;&nbsp;' : '') + ' (TTC)', dh(total))}
    ${exLettres(total)}
    ${msgClient ? `
      <div style="margin-top:22px;font-size:12.5px;color:#000">
        <div style="font-weight:700;text-decoration:underline;margin-bottom:6px">Message du client :</div>
        <div style="min-height:20px;white-space:pre-wrap;line-height:1.45;font-weight:500">${esc(msgClient)}</div>
      </div>
    ` : ''}
  `;
}

/* En-tête officiel BORDEREAU DES PRIX DETAIL ESTIMATIF (Conforme au PDF SRM-TTA) */
function docBordPdfHeader(titleText = 'BORDEREAU DES PRIX DETAIL ESTIMATIF') {
  const i = P.info || {};
  return `
    <div style="margin-bottom:8px;color:#000;font-family:Calibri,Arial,sans-serif">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="flex:0 0 auto">
          ${renderLogo(68)}
        </div>
        <div style="flex:1;text-align:center;color:#b91c1c;font-weight:800;font-size:15.5px;text-transform:uppercase;letter-spacing:0.3px">
          ${esc(titleText)}
        </div>
        <div style="width:130px;text-align:right;font-size:12px;font-weight:800;color:#000">
          Demande N° : ${esc(i.demande || '')}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:none;font-size:12px;line-height:1.3">
        <tbody>
          <tr style="border:none">
            <td style="width:85px;font-weight:800;padding:1.5px 0;border:none;color:#000">Objet</td>
            <td style="width:16px;font-weight:800;padding:1.5px 0;border:none;color:#000">:</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">${esc(i.objet || '')}</td>
          </tr>
          <tr style="border:none">
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">Commune</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">:</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">${esc(i.commune || '')}</td>
          </tr>
          <tr style="border:none">
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">Province</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">:</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">${esc(i.province || '')}</td>
          </tr>
          <tr style="border:none">
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">Contrat N°</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">:</td>
            <td style="font-weight:800;padding:1.5px 0;border:none;color:#000">${esc(i.contrat || i.devis || '')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* En-tête de rappel pour les pages suivantes (2/N, 3/N...) du Bordereau et du Devis */
function docBordContinuationHeader(titleText = 'BORDEREAU DES PRIX DETAIL ESTIMATIF') {
  const i = P.info || {};
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:4px;font-family:Calibri,Arial,sans-serif;color:#000">
      <div style="font-size:12.5px;font-weight:800;color:#000">
        ${i.demande ? `Demande N° : ${esc(i.demande)}` : ''}
      </div>
      <div style="font-size:12px;font-weight:800;color:#b91c1c;text-transform:uppercase">
        ${esc(titleText)} (Suite)
      </div>
      <div style="font-size:11.5px;font-weight:700;color:#000">
        ${(i.contrat || i.devis) ? `Contrat N° : ${esc(i.contrat || i.devis)}` : ''}
      </div>
    </div>
  `;
}

/* En-tête des colonnes du tableau Bordereau / Devis (répété sur chaque page, conforme à l'image) */
function docBordTableThead() {
  return `
    <thead>
      <tr style="border-top:1.5px solid #000;border-bottom:1.5px solid #000;background:#e3ebf4;color:#000">
        <th style="width:74px;border:1.5px solid #000;padding:7px 4px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000">N° DE PRIX</th>
        <th style="border:1.5px solid #000;padding:7px 6px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000">DESIGNATION DES FOURNITURES ET OUVRAGES</th>
        <th style="width:76px;border:1.5px solid #000;padding:7px 3px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000">CONSISTANCE</th>
        <th style="width:48px;border:1.5px solid #000;padding:7px 3px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000">UNITE</th>
        <th style="width:74px;border:1.5px solid #000;padding:7px 4px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000">QUANTITE</th>
        <th style="width:96px;border:1.5px solid #000;padding:6px 4px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000;line-height:1.2">PRIX UNITAIRES<br>( HT )</th>
        <th style="width:100px;border:1.5px solid #000;padding:6px 4px;font-size:11px;font-weight:800;text-align:center;background:#e3ebf4;color:#000;line-height:1.2">PRIX TOTAUX<br>(HT)</th>
      </tr>
    </thead>
  `;
}

/* Découpage dynamique exact (mesuré au pixel sur feuille A4) :
   - Tant que la 1ère page n'est pas remplie jusqu'en bas, tout reste sur la 1ère page (1/1).
   - Dès que la 1ère page est pleine, le reste passe automatiquement à la 2ème page (1/2, 2/2), puis 3ème page (1/3, 2/3, 3/3), etc. */
function paginateBordLinesDom(activeLines, renderRowFn, footerHtml, headerP1Html, headerContHtml, theadHtml) {
  if (!activeLines.length) {
    return [{ lines: [], hasFooter: true }];
  }

  // Hauteur utile d'une page A4 (280mm ~ 1058px à 96dpi, moins padding haut/bas 38px et pied de page numérotation 26px = 994px)
  const PAGE_MAX_PX = 990;

  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:738px;visibility:hidden;pointer-events:none;font-family:Calibri,Arial,sans-serif;color:#000;background:#fff;';
  document.body.appendChild(probe);

  try {
    // 1. Mesurer la hauteur de l'en-tête Page 1, de l'en-tête Page Suivante, et du Thead
    probe.innerHTML = `<div id="pH1">${headerP1Html}</div><div id="pHC">${headerContHtml}</div><table style="width:100%;border-collapse:collapse">${theadHtml}</table>`;
    const h1Px = (probe.querySelector('#pH1')?.offsetHeight || 145) + 6;
    const hContPx = (probe.querySelector('#pHC')?.offsetHeight || 30) + 6;
    const theadPx = (probe.querySelector('thead')?.offsetHeight || 36);

    const maxBodyPage1Px = PAGE_MAX_PX - h1Px - theadPx;
    const maxBodyNextPagePx = PAGE_MAX_PX - hContPx - theadPx;

    // 2. Mesurer la hauteur réelle de chaque ligne d'article et du bloc Total/Prestations
    const rowsHtmlAll = activeLines.map(l => renderRowFn(l, false)).join('');
    probe.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        ${theadHtml}
        <tbody id="pRows">${rowsHtmlAll}</tbody>
        <tbody id="pFoot">${footerHtml}</tbody>
      </table>
    `;
    const trEls = Array.from(probe.querySelectorAll('#pRows > tr'));
    const rowHeights = trEls.map(tr => tr.offsetHeight || 28);
    const footEl = probe.querySelector('#pFoot');
    const footerPx = footEl ? footEl.offsetHeight : (footerHtml ? 180 : 80);

    // 3. Remplir chaque page jusqu'en bas avant de passer à la page suivante
    const pages = [];
    let curLines = [];
    let curPx = 0;

    activeLines.forEach((l, idx) => {
      const rPx = rowHeights[idx] || 28;
      const pageLimitPx = pages.length === 0 ? maxBodyPage1Px : maxBodyNextPagePx;

      if (curLines.length > 0 && (curPx + rPx) > pageLimitPx) {
        // La page courante est pleine -> on ferme cette page et on passe à la suivante
        pages.push({ lines: curLines, hasFooter: false });
        curLines = [l];
        curPx = rPx;
      } else {
        curLines.push(l);
        curPx += rPx;
      }
    });

    // 4. Placer le pied de tableau (TOTAL / TVA / TOTAL G / T-PRESTATIONS)
    if (curLines.length > 0) {
      const pageLimitPx = pages.length === 0 ? maxBodyPage1Px : maxBodyNextPagePx;
      if ((curPx + footerPx) <= pageLimitPx) {
        // Le pied de tableau rentre sur la même page
        pages.push({ lines: curLines, hasFooter: true });
      } else {
        // Le pied de tableau dépasse le bas de la page -> il passe sur la page suivante
        pages.push({ lines: curLines, hasFooter: false });
        pages.push({ lines: [], hasFooter: true });
      }
    }

    return pages;
  } finally {
    document.body.removeChild(probe);
  }
}

/* 1. Bordereau détaillé (avec prix) + PRESTATIONS SRM-TTA (T-PRESTATIONS) — Multi-pages adaptatif (1/1, 1/2, 1/3...) */
function dBordFinal() {
  autoNumberUndefinedPrices(P.bord);
  const e = computeEval();
  const b = e.b;
  const activeLines = buildSectionedDocLines(b.lines.filter(l => l.on));

  const renderRow = (l, isLastRowOnPageWithoutFooter) => {
    if (l._kind) return renderSecDocRow(l, true);
    const codeStr = (l.code === '—') ? '' : (l.code || '');
    const bBot = isLastRowOnPageWithoutFooter ? '1.5px solid #000' : '1px dashed #333';
    return `
      <tr>
        <td style="border-left:1.5px solid #000;border-right:1px solid #000;border-bottom:${bBot};padding:4px 5px;text-align:center;white-space:nowrap;font-size:11.5px">${esc(codeStr)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 6px;font-size:11.5px;line-height:1.25">${esc(l.d)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 4px;text-align:center;font-size:11.5px">${esc(l.c)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 4px;text-align:center;font-size:11.5px">${esc(l.u)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 6px;text-align:center;font-size:11.5px">${fmt(l.q)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 6px;text-align:right;font-size:11.5px">${fmt(l.pu)}</td>
        <td style="border-right:1.5px solid #000;border-bottom:${bBot};padding:4px 6px;text-align:right;font-size:11.5px">${fmt(l.tot)}</td>
      </tr>
    `;
  };

  const prestRowsHtml = e.pr.map((x, idx) => {
    const bTop = idx === 0 ? '1px dashed #000' : '1px dashed #333';
    return `
      <tr>
        <td colspan="4" style="border-left:1.5px solid #000;border-right:1px dashed #000;border-top:${bTop};border-bottom:1px dashed #000;padding:4px 8px;text-align:right;font-weight:700;font-size:12px">${esc(x.name)}</td>
        <td style="border-right:1px dashed #000;border-top:${bTop};border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:700;font-size:12px">${fmt(x.pu)}</td>
        <td style="border-right:1px dashed #000;border-top:${bTop};border-bottom:1px dashed #000;padding:4px 6px;text-align:center;font-weight:700;font-size:12px">${fq(x.q)}</td>
        <td style="border-right:1.5px solid #000;border-top:${bTop};border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:700;font-size:12px">${fmt(x.tot)}</td>
      </tr>
    `;
  }).join('');

  const footerHtml = `
    <tr style="border-top:1.5px solid #000">
      <td colspan="5" style="border:none"></td>
      <td style="border-left:1px dashed #000;border-right:1px dashed #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:center;font-weight:800;font-size:12px">TOTAL</td>
      <td style="border-right:1.5px solid #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:800;font-size:12px">${fmt(b.ht)}</td>
    </tr>
    <tr>
      <td colspan="5" style="border:none"></td>
      <td style="border-left:1px dashed #000;border-right:1px dashed #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:center;font-weight:800;font-size:12px">TVA ${P.tva}%</td>
      <td style="border-right:1.5px solid #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:800;font-size:12px">${fmt(e.worksTva)}</td>
    </tr>
    <tr>
      <td colspan="5" style="border:none"></td>
      <td style="border-left:1px dashed #000;border-right:1px dashed #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:center;font-weight:800;font-size:12px">TOTAL (G)</td>
      <td style="border-right:1.5px solid #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:800;font-size:12px">${fmt(e.worksTtc)}</td>
    </tr>
    <tr>
      <td colspan="7" style="border:none;padding:8px 4px 6px;text-align:center;font-weight:800;font-size:13px;color:#1e3a8a;text-transform:uppercase">
        PRESTATIONS SRM-TTA (T-PRESTATIONS)
      </td>
    </tr>
    ${prestRowsHtml}
    <tr><td colspan="7" style="border:none;height:8px"></td></tr>
    <tr>
      <td colspan="5" style="border:none"></td>
      <td style="border:1px dashed #000;padding:4px 6px;text-align:center;font-weight:800;font-size:12px">TOTAL HTVA</td>
      <td style="border-top:1px dashed #000;border-bottom:1px dashed #000;border-right:1.5px solid #000;padding:4px 6px;text-align:right;font-weight:800;font-size:12px">${fmt(e.pht)}</td>
    </tr>
    <tr>
      <td colspan="5" style="border:none"></td>
      <td style="border:1px dashed #000;padding:4px 6px;text-align:center;font-weight:800;font-size:12px">TOTAL TTC</td>
      <td style="border-bottom:1px dashed #000;border-right:1.5px solid #000;padding:4px 6px;text-align:right;font-weight:800;font-size:12px">${fmt(e.corePttc)}</td>
    </tr>
    ${(e.specialPr || []).map(sp => `
      <tr>
        <td colspan="4" style="border-left:1.5px solid #000;border-right:1px dashed #000;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 8px;text-align:right;font-weight:700;font-size:12px">${esc(sp.name)}</td>
        <td style="border-right:1px dashed #000;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:700;font-size:12px">${fmt(sp.pu)}</td>
        <td style="border-right:1px dashed #000;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:center;font-weight:700;font-size:12px">${fq(sp.q)}</td>
        <td style="border-right:1.5px solid #000;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 6px;text-align:right;font-weight:700;font-size:12px">${fmt(sp.tot)}</td>
      </tr>
    `).join('')}
    <tr><td colspan="7" style="border:none;height:8px"></td></tr>
    <tr>
      <td colspan="6" style="border-left:1.5px solid #000;border-top:1px dashed #000;border-bottom:1px dashed #000;border-right:1px dashed #000;padding:5px 8px;text-align:right;font-weight:800;font-size:12.5px">TOTAL PRESTATIONS SRM-TTA T.T.C</td>
      <td style="border-top:1px dashed #000;border-bottom:1px dashed #000;border-right:1.5px solid #000;padding:5px 6px;text-align:right;font-weight:800;font-size:12.5px">${fmt(e.pttc)}</td>
    </tr>
    <tr><td colspan="7" style="border:none;height:8px"></td></tr>
    <tr>
      <td colspan="6" style="border-left:1.5px solid #000;border-top:1px dashed #000;border-bottom:1.5px solid #000;border-right:1px dashed #000;padding:5px 8px;text-align:right;font-weight:800;font-size:13px;color:#1e3a8a">TOTAL GENERAL T.T.C</td>
      <td style="border-top:1px dashed #000;border-bottom:1.5px solid #000;border-right:1.5px solid #000;padding:5px 6px;text-align:right;font-weight:800;font-size:13px;color:#000">${fmt(e.total)}</td>
    </tr>
  `;

  const headerP1 = docBordPdfHeader('BORDEREAU DES PRIX DETAIL ESTIMATIF');
  const headerCont = docBordContinuationHeader('BORDEREAU DES PRIX DETAIL ESTIMATIF');
  const thead = docBordTableThead();
  const pages = paginateBordLinesDom(activeLines, renderRow, footerHtml, headerP1, headerCont, thead);
  const totalPages = pages.length;

  return pages.map((pg, idx) => {
    const pageNum = idx + 1;
    const isLast = pageNum === totalPages;
    let rowsHtml = '';
    if (pg.lines.length) {
      rowsHtml = pg.lines.map((l, rIdx) => renderRow(l, !pg.hasFooter && rIdx === pg.lines.length - 1)).join('');
    } else if (!activeLines.length) {
      rowsHtml = `<tr><td colspan="7" style="border:1.5px solid #000;text-align:center;padding:10px;font-style:italic">Aucun article sélectionné dans le Bordereau.</td></tr>`;
    }

    return `
      <div class="paper ${!isLast ? 'pb' : ''}" style="min-height:280mm;display:flex;flex-direction:column;justify-content:space-between;padding:20px 28px 18px;font-family:Calibri,Arial,sans-serif;color:#000;background:#fff">
        <div>
          ${idx === 0 ? headerP1 : headerCont}
          <table style="width:100%;border-collapse:collapse;margin-top:4px;color:#000">
            ${thead}
            <tbody>
              ${rowsHtml}
              ${pg.hasFooter ? footerHtml : ''}
            </tbody>
          </table>
        </div>
        <div style="margin-top:auto;padding-top:10px;text-align:right;font-size:12px;font-weight:700;color:#000">
          ${pageNum}/${totalPages}
        </div>
      </div>
    `;
  }).join('');
}

/* 2. Lettre client (2 pages) — Respectant 100% la mise en page du PDF officiel */
function dLettre() {
  const i = P.info;
  const d = P.doc || {};
  const e = computeEval();
  const ex = extras();
  
  const obj = (i.objet || '') + (i.commune ? ' ' + i.commune : '') + (i.province ? ' Province de ' + i.province : '');
  const trav = e.worksTtc;
  const prest = r2(e.pttc + ex.route + ex.tiers);
  const regl = d.reglement != null && d.reglement !== '' ? num(d.reglement) : prest;
  
  const civ = d.civilite || 'Monsieur le Gérant';
  const ville = d.ville || i.province || 'Ouezzane';
  const signataire = getSignataire(prest);
  const validateur = d.validateur || 'Préparée et validée';
  const demandeNum = i.demande || '';
  const dateDemandeStr = fd(i.dateDemande) || '';
  const natureTravauxStr = d.natureTravaux || (i.objet ? i.objet : 'déviation du tronçon HTA');
  
  const topSpaceP1 = (P.doc && P.doc.showLogo) 
    ? `<div style="margin-bottom:14px">${renderLogo()}</div>` 
    : `<div style="height:105px;min-height:105px"></div>`;
    
  const topSpaceP2 = (P.doc && P.doc.showLogo) 
    ? `<div style="margin-bottom:14px">${renderLogo()}</div>` 
    : `<div style="height:65px;min-height:65px"></div>`;
  
  // PAGE 1 (100% conforme au PDF Page 1)
  const p1 = `
    <div class="paper let pb" style="min-height:280mm;display:flex;flex-direction:column;justify-content:space-between;padding:22px 46px 24px;font-family:Calibri,Arial,sans-serif;font-size:13px;line-height:1.42;color:#000;background:#fff">
      <div>
        ${topSpaceP1}
        
        <div style="margin-left:58%;font-size:13px;margin-bottom:18px;color:#000">
          ${esc(ville)}, le :
        </div>
        
        <div style="text-align:center;margin-bottom:20px;color:#000">
          <div style="font-weight:700;font-size:13.5px">À</div>
          <div style="font-weight:700;font-size:15px">${esc(i.destinataire || i.client || '')}</div>
        </div>
        
        <div style="margin-bottom:14px;font-size:13px;line-height:1.38;color:#000">
          <b>Direction Générale de la SRM Tanger-Tétouan-Al Hoceima</b><br>
          N/Réf : ${esc(d.nRef || '…………../ DC/DG')}<br>
          ${dateDemandeStr ? `V/Réf : Demande du ${esc(dateDemandeStr)}` : 'V/Réf :'}
        </div>
        
        <div style="margin-bottom:14px;font-size:13px;line-height:1.38;display:flex;color:#000">
          <b style="white-space:nowrap;margin-right:5px">Objet :</b>
          <span>${esc(obj)}</span>
        </div>
        
        <div style="margin-left:42px;margin-bottom:14px;font-size:13px;color:#000">
          <b>Demande n° :</b> ${esc(demandeNum)}
        </div>
        
        <div style="margin-bottom:12px;font-size:13px;color:#000">
          ${esc(civ)} ;
        </div>
        
        <p style="margin:0 0 12px 0;text-align:justify;color:#000">
          Suite à la demande que vous avez bien voulue nous formuler, nous avons l’honneur de vous informer que nos services ont procédé à l’étude détaillée de l’affaire citée en objet.
        </p>
        
        <p style="margin:0 0 12px 0;text-align:justify;color:#000">
          La dépense envisagée pour la réalisation des travaux de ${esc(natureTravauxStr)} s’élève, selon l’évaluation technique et économique de nos services, aux montants suivants :
        </p>
        
        <div style="margin:0 0 12px 0;font-size:13px;line-height:1.42;color:#000">
          <div>- Montant des travaux : <b>${fmt(trav)} DH (TTC)</b></div>
          <div>- Montant des prestations de la SRM-TTA : <b>${fmt(prest)} DH (TTC)</b></div>
        </div>
        
        <p style="margin:0 0 12px 0;text-align:justify;color:#000">
          Notre offre s’entend pour un délai d’exécution maximal de ${esc(d.delai || 'six (06) mois')}.
        </p>
        
        <p style="margin:0 0 12px 0;text-align:justify;color:#000">
          Nous tenons également à vous préciser que l’exécution des travaux sera conditionnée par :
        </p>
        
        <div style="margin:0 0 12px 0;font-size:13px;line-height:1.38;color:#000">
          <div style="padding-left:10px;text-indent:-10px;text-align:justify">- Le règlement du montant de <b>${fmt(regl)} DH (TTC)</b> relative à la totalité des prestations de la SRM-TTA avant tout commencement des travaux.</div>
          <div style="padding-left:10px;text-indent:-10px;text-align:justify">- Le projet qui fera l'objet d'un dossier technique ne devra soulever aucune objection de la part des administrations concernées.</div>
          <div style="padding-left:10px;text-indent:-10px">- La fourniture par vos services de l’autorisation des propriétaires riverains pour le passage des ouvrages ;</div>
          <div style="padding-left:10px;text-indent:-10px">- L’implantation des supports et autres équipements nécessaires ;</div>
          <div style="padding-left:10px;text-indent:-10px">- La disponibilité des accès au chantier ;</div>
          <div style="padding-left:10px;text-indent:-10px">- Le respect des conditions techniques et sécuritaires prévues par la réglementation en vigueur.</div>
        </div>
        
        <p style="margin:0 0 12px 0;text-align:justify;color:#000">
          Nous vous prions de bien vouloir nous retourner l’acceptation de l’offre dûment signée, accompagnée de l’engagement de prise en charge des coûts susmentionnés.
        </p>
        
        <p style="margin:0 0 12px 0;text-align:justify;color:#000">
          Dès réception, une lettre de mise en service des travaux vous sera transmise afin de permettre à la SRM-TTA d’engager les procédures techniques nécessaires.
        </p>
        
        <p style="margin:0 0 8px 0;color:#000">
          L’entreprise chargée des travaux sera tenue de :
        </p>
        <div style="margin-left:24px;font-size:13px;line-height:1.42;color:#000">
          <div><span style="display:inline-block;width:22px">•</span>Respecter strictement les normes et exigences de la SRM-TTA ;</div>
          <div><span style="display:inline-block;width:22px">•</span>Présenter un planning d’exécution validé ;</div>
          <div><span style="display:inline-block;width:22px">•</span>Tenir un journal de chantier ;</div>
          <div><span style="display:inline-block;width:22px">•</span>Réaliser les travaux sous le contrôle d’un agent SRM-TTA ;</div>
          <div><span style="display:inline-block;width:22px">•</span>Remettre, à la fin des travaux :</div>
        </div>
      </div>
      
      <div style="margin-top:auto;text-align:right;font-size:12px;color:#000;padding-top:12px">
        1/2
      </div>
    </div>
  `;
  
  // PAGE 2 (100% conforme au PDF Page 2)
  const p2 = `
    <div class="paper let" style="min-height:280mm;display:flex;flex-direction:column;justify-content:space-between;padding:22px 46px 24px;font-family:Calibri,Arial,sans-serif;font-size:13px;line-height:1.42;color:#000;background:#fff">
      <div>
        ${topSpaceP2}
        
        <div style="margin-bottom:14px;font-size:13px;font-weight:700;color:#000">
          Demande N : ${esc(demandeNum)}
        </div>
        
        <div style="margin:0 0 18px 92px;font-size:13px;line-height:1.42;color:#000">
          <div style="display:flex;margin-bottom:2px">
            <span style="min-width:24px;font-family:'Courier New',monospace">o</span>
            <span>Un plan de récolement ;</span>
          </div>
          <div style="display:flex;margin-bottom:2px">
            <span style="min-width:24px;font-family:'Courier New',monospace">o</span>
            <span>Un dossier technique de fin de chantier ;</span>
          </div>
          <div style="display:flex;text-align:justify">
            <span style="min-width:24px;font-family:'Courier New',monospace">o</span>
            <span>Les deux copies certifiées conformes de la facture des travaux réellement exécutés, dont le récolement sera effectué contradictoirement entre notre agent, votre représentant légal et l’entreprise.</span>
          </div>
        </div>
        
        <p style="margin:18px 0 38px 0;text-align:justify;color:#000">
          En restant à votre entière disposition pour tout renseignement complémentaire, veuillez agréer, ${esc(civ)}, l’expression de nos salutations distinguées.
        </p>
        
        <div style="margin-top:32px;margin-bottom:135px">
          <table style="width:100%;border:none;border-collapse:collapse">
            <tbody>
              <tr style="border:none">
                <td style="width:50%;border:none;vertical-align:top;font-size:13px;padding-left:6px;color:#000">
                  ${esc(validateur)}
                </td>
                <td style="width:50%;border:none;text-align:center;vertical-align:top;font-size:13px;padding-left:50px;color:#000">
                  ${esc(signataire)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style="font-size:13px;line-height:1.45;color:#000">
          <div style="margin-bottom:8px">Pièces jointes :</div>
          <div>▪ Évaluation des travaux</div>
          <div>▪ Évaluation des prestations</div>
          <div>▪ Devis des prestations</div>
          <div>▪ Bordereau de détail des travaux</div>
          <div>▪ Imprimé à remplir et à retourner</div>
          <div>▪ Engagement de l’entreprise</div>
        </div>
      </div>
      
      <div style="margin-top:auto;text-align:right;font-size:12px;color:#000;padding-top:12px">
        2/2
      </div>
    </div>
  `;
  
  return p1 + p2;
}

/* 3. Rapport d'étude */
function cb(opts, val, fieldKey) {
  return opts.map(o => {
    const isChecked = (val === o);
    const attr = fieldKey ? ` data-setcb="${fieldKey}" data-val="${esc(o)}" style="cursor:pointer;user-select:none"` : '';
    return `<span class="cbx ${isChecked ? 'on' : ''}"${attr}></span> <span${attr}>${esc(o)}</span>`;
  }).join('&emsp;&emsp;');
}

function dRapport() {
  syncCablesFromBord();
  const i = P.info;
  const d = P.doc || {};
  const typeAff = i.typeAff || 'MT/BT';
  const row = (l, v, big) => `<tr><td style="width:34%;font-weight:700;font-size:11.5px">${l}</td><td style="width:14px">:</td><td style="${big ? 'font-size:13px;font-weight:600' : ''}">${v}</td></tr>`;
  
  let ouvrRows = '';
  const bordCables = getActiveBordCables(P);
  const detCables = cableTypeDetails(bordCables);

  if (detCables.length > 0) {
    detCables.forEach(c => {
      const ouvName = c.ouvrage || ('Réseau ' + c.net + ' ' + c.pose);
      ouvrRows += `<tr><td class="b">${esc(ouvName)}</td><td style="text-align:center">${fmt(c.len)} m</td><td>${esc(c.cab)}</td></tr>`;
    });
    if (typeAff === 'MT/BT' || (P.bord || []).some(l => l.lot === 'lot2' || l.ouvrage === 'Poste Transfo (PT)')) {
      const ptType = i.posteType || 'Poste H61 / cabine';
      const ptP = i.puissance ? `${i.puissance} kVA` : '';
      ouvrRows += `<tr><td class="b">Poste Transfo (PT)</td><td style="text-align:center">1 U</td><td>${esc(ptType)} ${esc(ptP)}</td></tr>`;
    }
  } else {
    if (typeAff === 'MT' || typeAff === 'MT/BT') {
      const arL = num(i.mtarL);
      const stL = num(i.mtstL);
      if (arL > 0) {
        ouvrRows += `<tr><td class="b">Réseau MT Aérien</td><td style="text-align:center">${fmt(arL)} m</td><td>${esc(i.mtarCab || CABLES_STANDARDS.mtar[0])}</td></tr>`;
      }
      if (stL > 0) {
        ouvrRows += `<tr><td class="b">Réseau MT Souterrain</td><td style="text-align:center">${fmt(stL)} m</td><td>${esc(i.mtstCab || CABLES_STANDARDS.mtst[0])}</td></tr>`;
      }
      if (arL === 0 && stL === 0 && num(i.mtL) > 0) {
        const mtL = num(i.mtL);
        const isSt = i.mtPose === 'Souterrain';
        const mtCab = isSt ? (i.mtstCab || CABLES_STANDARDS.mtst[0]) : (i.mtarCab || CABLES_STANDARDS.mtar[0]);
        ouvrRows += `<tr><td class="b">Réseau MT ${isSt ? 'Souterrain' : 'Aérien'}</td><td style="text-align:center">${fmt(mtL)} m</td><td>${esc(mtCab)}</td></tr>`;
      }
    }
    if (typeAff === 'MT/BT') {
      const ptType = i.posteType || 'Poste H61 / cabine';
      const ptP = i.puissance ? `${i.puissance} kVA` : '';
      ouvrRows += `<tr><td class="b">Poste Transfo (PT)</td><td style="text-align:center">1 U</td><td>${esc(ptType)} ${esc(ptP)}</td></tr>`;
    }
    if (typeAff === 'BT' || typeAff === 'MT/BT') {
      const arL = num(i.btarL);
      const stL = num(i.btstL);
      if (arL > 0) {
        ouvrRows += `<tr><td class="b">Réseau BT Aérien</td><td style="text-align:center">${fmt(arL)} m</td><td>${esc(i.btarCab || CABLES_STANDARDS.btar[0])}</td></tr>`;
      }
      if (stL > 0) {
        ouvrRows += `<tr><td class="b">Réseau BT Souterrain</td><td style="text-align:center">${fmt(stL)} m</td><td>${esc(i.btstCab || CABLES_STANDARDS.btst[0])}</td></tr>`;
      }
      if (arL === 0 && stL === 0 && num(i.btL) > 0) {
        const btL = num(i.btL);
        const isSt = i.btPose === 'Souterrain';
        const btCab = isSt ? (i.btstCab || CABLES_STANDARDS.btst[0]) : (i.btarCab || CABLES_STANDARDS.btar[0]);
        ouvrRows += `<tr><td class="b">Réseau BT ${isSt ? 'Souterrain' : 'Aérien'}</td><td style="text-align:center">${fmt(btL)} m</td><td>${esc(btCab)}</td></tr>`;
      }
    }
  }
  
  return `
    <div class="paper">
      ${docStandardHeader("Rapport d’Étude Technique et Financière", typeAff)}
      
      <div class="rh">I- Identification du projet</div>
      <table class="exo">
        ${row('* Numéro Demande', esc(i.demande))}
        ${i.dateDemande ? row('* Date de la demande', esc(fd(i.dateDemande))) : ''}
        ${row('* Numéro Contrat', esc(i.contrat))}
        ${row('* Numéro Devis', esc(i.devis))}
        ${i.date ? row('* Date de l’étude', esc(fd(i.date))) : ''}
        ${row('* Demandeur', esc(i.destinataire), 1)}
        ${row('* Intitulé du projet', esc(i.objet), 1)}
        ${row('* Adresse de correspondance', esc(i.adresseCorresp || ''))}
        ${row('* Situation du projet', esc(i.situationProjet || i.province || 'Ouezzane'), 1)}
        ${row('* Commune / Municipalité', esc(i.commune), 1)}
        ${row('* Province', esc(i.province), 1)}
      </table>
      
      <div style="margin:8px 0 2px 8px;font-weight:700;font-size:11px">* Nature de la zone :</div>
      <div style="margin-left:8px">${cb(['Rurale', 'Urbaine', 'Périurbaine'], i.zone || 'Rurale', 'zone')}</div>
      
      <div style="margin:8px 0 2px 8px;font-weight:700;font-size:11px">* Nature du projet :</div>
      <div style="margin-left:8px">${cb(['Morcellement/Lotissement', 'Unité Industrielle/Agricole', 'Propriété'], i.natProjet || 'Morcellement/Lotissement', 'natProjet')}</div>
      
      <div style="margin:8px 0 2px 8px;font-size:12.5px">* Puissance demandée : <b>${i.puissance ? (num(i.puissance) ? (Number.isInteger(num(i.puissance)) ? num(i.puissance) : fmt(num(i.puissance))) : esc(i.puissance)) : '&emsp;&emsp;&emsp;&emsp;'} kVA</b></div>
      
      <div class="rh">II- Adresse électrique de l’origine du branchement proposé</div>
      <table class="rt">
        <thead>
          <tr>
            <th style="width:90px">Type</th>
            <th>Support ou boîte de dérivation</th>
            <th>Matricule du Poste</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="b" style="text-align:center">${esc(i.origineType || 'Aérien')}</td>
            <td>${esc(i.supportOrigine || '—')}</td>
            <td>${esc(i.matriculePoste || i.poste || i.indications || '—')}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="rh">III- Caractéristiques des ouvrages (${typeAff})</div>
      <table class="rt">
        <thead>
          <tr>
            <th style="width:120px">Ouvrage</th>
            <th style="width:25%">Longueur (m)</th>
            <th>Nature et section du câble</th>
          </tr>
        </thead>
        <tbody>
          ${ouvrRows || '<tr><td colspan="3" style="text-align:center">Renseignez les données techniques dans le dossier.</td></tr>'}
        </tbody>
      </table>
      
      <div class="rh" style="margin-top:10px">IV- Indications supplémentaires</div>
      ${(i.indications && i.indications.trim() && i.indications.trim() !== 'Néant.') ? `<div style="white-space:pre-wrap;margin:4px 0 6px 8px;font-size:12px">${esc(i.indications)}</div>` : ''}
      <div style="margin:6px 0 2px 8px;font-size:11px">-Terrain traversé :</div>
      <div style="margin-left:8px">${cb(['Privé', 'Emprise de voie publique', 'Demandeur'], i.terrain || 'Emprise de voie publique')}</div>
      
      <div style="margin:10px 0 0 8px;font-size:11px">
        * Participation : <b>${esc(i.participation || 'X')}</b> &emsp;&emsp;&emsp;&emsp;
        Bénéficiaire(s) : <b>${esc(i.benef || 'X')}</b>
      </div>
      ${i.dateDemande ? `<div style="margin:2px 0 0 8px;font-size:12.5px">* Date de la demande : <b>${esc(fd(i.dateDemande))}</b></div>` : ''}
      <div style="margin:2px 0 0 8px;font-size:12.5px">* Date de l’étude : <b>${esc(fd(i.date))}</b></div>
      <div style="margin:2px 0 0 8px;font-size:12.5px">* Référence de règlement de forfait : <b>${esc(i.refReglement || '.')}</b></div>
      
      ${sigTable()}
    </div>
  `;
}

/* 4. Évaluation globale */
function dEvalGlob() {
  const e = computeEval();
  const c = consist();
  const b = e.b;
  const x = extras();
  const extraRoute = (x.route > 0 && !(e.specialPr || []).some(s => smartNorm(s.name).includes('traversee de route'))) ? x.route : 0;
  const totalG = r2(e.total + extraRoute + x.tiers);
  const totalPrestG = r2(e.pttc + extraRoute + x.tiers);
  const typeAff = P.info.typeAff || 'MT/BT';
  const mtSiteStr = P.info.mtSite || 'In-Site';
  
  let subTotTableHtml = '';
  if (typeAff === 'MT/BT') {
    if (mtSiteStr === 'Les Deux') {
      subTotTableHtml = `
        <tr><td>Sous-total 1A · Ligne MT Hors-Site</td><td class="n">${dh(b.lot1_hs.ht)}</td></tr>
        <tr><td>Sous-total 1B · Ligne MT In-Site</td><td class="n">${dh(b.lot1_is.ht)}</td></tr>
        <tr><td>Sous-total 2 · Poste de Transformation (PT)</td><td class="n">${dh(b.lot2.ht)}</td></tr>
        <tr><td>Sous-total 3 · Réseau Basse Tension BT</td><td class="n">${dh(b.lot3.ht)}</td></tr>
        <tr class="b" style="border-top:1px solid #000"><td>Total Travaux HTVA (1A + 1B + 2 + 3)</td><td class="n b">${dh(b.ht)}</td></tr>
      `;
    } else {
      subTotTableHtml = `
        <tr><td>Sous-total 1 · Ligne MT (${mtSiteStr})</td><td class="n">${dh(b.lot1.ht)}</td></tr>
        <tr><td>Sous-total 2 · Poste de Transformation (PT)</td><td class="n">${dh(b.lot2.ht)}</td></tr>
        <tr><td>Sous-total 3 · Réseau Basse Tension BT</td><td class="n">${dh(b.lot3.ht)}</td></tr>
        <tr class="b" style="border-top:1px solid #000"><td>Total Travaux HTVA (1 + 2 + 3)</td><td class="n b">${dh(b.ht)}</td></tr>
      `;
    }
  } else {
    subTotTableHtml = `
      <tr class="b"><td>Total Travaux ${typeAff} (HTVA)</td><td class="n b">${dh(b.ht)}</td></tr>
    `;
  }
  
  const secSubTotG = sectionSubTotRows(b, 'Sous-total');
  if (secSubTotG) subTotTableHtml = secSubTotG;
  
  return `
    <div class="paper">
      ${docExcelHeader('EVALUATION APPROXIMATIVE DES TRAVAUX ET DES PRESTATIONS SRM-TTA')}
      
      <div style="font-weight:700;margin:10px 0 4px">I) Coût des travaux hors prestations SRM-TTA :</div>
      ${c.map(x => `<div class="exl">-&nbsp;&nbsp;${esc(x)}</div>`).join('')}
      
      <table class="exa" style="margin-top:10px;width:60%">
        <tbody>
          ${subTotTableHtml}
          <tr><td>TVA au taux de ${P.tva}%</td><td class="n">${dh(e.worksTva)}</td></tr>
          <tr class="b"><td>Total I Travaux (TTC)</td><td class="n b">${dh(e.worksTtc)}</td></tr>
        </tbody>
      </table>
      
      <div style="font-weight:700;margin:12px 0 4px">II) Prestations assurées par SRM-TTA :</div>
      ${exPrestT(e, 'a')}
      ${renderDynamicSpecialSections(e, x, 2)}
      
      <div style="margin-top:16px;font-weight:700">TOTAL PRESTATIONS SRM-TTA T.T.C</div>
      ${exBox('<span style="color:#1a3d6e">TOTAL TTC</span>', dh(totalPrestG))}
      
      <div style="height:8px"></div>
      ${exBox('TOTAL GÉNÉRAL :', dh(totalG))}
      ${exLettres(totalG)}
      ${sigTable()}
    </div>
  `;
}

/* 5. Év. travaux SRM */
function dEvalTrav() {
  const e = computeEval();
  const c = consist();
  const b = e.b;
  const x = extras();
  const extraRoute = (x.route > 0 && !(e.specialPr || []).some(s => smartNorm(s.name).includes('traversee de route'))) ? x.route : 0;
  const g = r2(e.total + extraRoute + x.tiers);
  const typeAff = P.info.typeAff || 'MT/BT';
  const mtSiteStr = P.info.mtSite || 'In-Site';
  
  let subTotTableHtml = '';
  if (typeAff === 'MT/BT') {
    if (mtSiteStr === 'Les Deux') {
      subTotTableHtml = `
        <tr><td>Total 1A Ligne MT Hors-Site HTVA</td><td class="n">${dh(b.lot1_hs.ht)}</td></tr>
        <tr><td>Total 1B Ligne MT In-Site HTVA</td><td class="n">${dh(b.lot1_is.ht)}</td></tr>
        <tr><td>Total 2 Poste Transfo (PT) HTVA</td><td class="n">${dh(b.lot2.ht)}</td></tr>
        <tr><td>Total 3 Réseau BT HTVA</td><td class="n">${dh(b.lot3.ht)}</td></tr>
        <tr class="b"><td>Total I (HTVA) (1A+1B+2+3)</td><td class="n b">${dh(b.ht)}</td></tr>
      `;
    } else {
      subTotTableHtml = `
        <tr><td>Total 1 Ligne MT (${mtSiteStr}) HTVA</td><td class="n">${dh(b.lot1.ht)}</td></tr>
        <tr><td>Total 2 Poste Transfo (PT) HTVA</td><td class="n">${dh(b.lot2.ht)}</td></tr>
        <tr><td>Total 3 Réseau BT HTVA</td><td class="n">${dh(b.lot3.ht)}</td></tr>
        <tr class="b"><td>Total I (HTVA) (1+2+3)</td><td class="n b">${dh(b.ht)}</td></tr>
      `;
    }
  } else {
    subTotTableHtml = `
      <tr class="b"><td>Total I Travaux ${typeAff} (HTVA)</td><td class="n b">${dh(b.ht)}</td></tr>
    `;
  }
  
  const secSubTotT = sectionSubTotRows(b, 'Total');
  if (secSubTotT) subTotTableHtml = secSubTotT;
  
  return `
    <div class="paper">
      ${docExcelHeader('EVALUATION APPROXIMATIVE DES TRAVAUX (' + typeAff + ')')}
      
      <div class="exh2" style="margin-top:14px">I) Coût des travaux hors prestations SRM-TTA :</div>
      ${c.map(t => `<div class="exl b" style="margin-left:36px">-&nbsp;&nbsp;${esc(t)}</div>`).join('')}
      
      <table class="exa tr" style="margin-top:12px;width:60%">
        <tbody>
          ${subTotTableHtml}
          <tr><td>TVA ${P.tva}%</td><td class="n">${dh(e.worksTva)}</td></tr>
          <tr class="b"><td>Total I (TTC)</td><td class="n b">${dh(e.worksTtc)}</td></tr>
        </tbody>
      </table>
      
      <div class="exh2">II) Prestations assurées par SRM-TTA :</div>
      ${exPrestT(e, 'b')}
      ${exSpecial(e, x, g, false)}
    </div>
  `;
}

/* 6. Év. prestations SRM */
function dEvalPrest() {
  const e = computeEval();
  const x = extras();
  const extraRoute = (x.route > 0 && !(e.specialPr || []).some(s => smartNorm(s.name).includes('traversee de route'))) ? x.route : 0;
  const g = r2(e.pttc + extraRoute + x.tiers);
  
  return `
    <div class="paper">
      ${docExcelHeader('EVALUATION DES PRESTATIONS SRM-TTA')}
      
      <div style="margin:16px 0 6px 20px;font-size:12.5px">* Montant des travaux hors taxe : &emsp;<b>${dh(e.b.ht)}</b></div>
      <div class="exh2" style="margin-top:2px">I) Prestations assurées par SRM-TTA :</div>
      ${exPrestT(e, 'b')}
      ${exSpecial(e, x, g, true)}
    </div>
  `;
}

/* 7. Devis client (sans prix) — Multi-pages adaptatif (1/1, 1/2, 1/3...) avec en-tête et N° Demande répétés sur chaque page */
function dDevis() {
  autoNumberUndefinedPrices(P.bord);
  const e = computeEval();
  const b = e.b;
  const activeLines = buildSectionedDocLines(b.lines.filter(l => l.on));

  const renderRow = (l, isLastRowOnPageWithoutFooter) => {
    if (l._kind) return renderSecDocRow(l, false);
    const codeStr = (l.code === '—') ? '' : (l.code || '');
    const bBot = isLastRowOnPageWithoutFooter ? '1.5px solid #000' : '1px dashed #333';
    return `
      <tr>
        <td style="border-left:1.5px solid #000;border-right:1px solid #000;border-bottom:${bBot};padding:4px 5px;text-align:center;white-space:nowrap;font-size:11.5px">${esc(codeStr)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 6px;font-size:11.5px;line-height:1.25">${esc(l.d)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 4px;text-align:center;font-size:11.5px">${esc(l.c)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 4px;text-align:center;font-size:11.5px">${esc(l.u)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 6px;text-align:center;font-size:11.5px">${fmt(l.q)}</td>
        <td style="border-right:1px solid #000;border-bottom:${bBot};padding:4px 6px;text-align:right;font-size:11.5px">&nbsp;</td>
        <td style="border-right:1.5px solid #000;border-bottom:${bBot};padding:4px 6px;text-align:right;font-size:11.5px">&nbsp;</td>
      </tr>
    `;
  };

  const footerHtml = `
    <tr style="border-top:1.5px solid #000">
      <td colspan="4" style="border:none"></td>
      <td style="border-left:1.5px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;padding:4px 6px;text-align:center;font-weight:800;font-size:11.5px">TOTAL</td>
      <td style="border-right:1px solid #000;border-bottom:1px dashed #333;padding:4px 6px">&nbsp;</td>
      <td style="border-right:1.5px solid #000;border-bottom:1px dashed #333;padding:4px 6px;text-align:right;font-weight:800;font-size:11.5px">-</td>
    </tr>
    <tr>
      <td colspan="4" style="border:none"></td>
      <td style="border-left:1.5px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;padding:4px 6px;text-align:center;font-weight:800;font-size:11.5px">TVA ${P.tva}%</td>
      <td style="border-right:1px solid #000;border-bottom:1px dashed #333;padding:4px 6px">&nbsp;</td>
      <td style="border-right:1.5px solid #000;border-bottom:1px dashed #333;padding:4px 6px;text-align:right;font-weight:800;font-size:11.5px">-</td>
    </tr>
    <tr>
      <td colspan="4" style="border:none"></td>
      <td style="border-left:1.5px solid #000;border-right:1px solid #000;border-bottom:1.5px solid #000;padding:4px 6px;text-align:center;font-weight:800;font-size:11.5px">TOTAL (G)</td>
      <td style="border-right:1px solid #000;border-bottom:1.5px solid #000;padding:4px 6px">&nbsp;</td>
      <td style="border-right:1.5px solid #000;border-bottom:1.5px solid #000;padding:4px 6px;text-align:right;font-weight:800;font-size:11.5px">-</td>
    </tr>
  `;

  const headerP1 = docBordPdfHeader('BORDEREAU DES PRIX DETAIL ESTIMATIF');
  const headerCont = docBordContinuationHeader('BORDEREAU DES PRIX DETAIL ESTIMATIF');
  const thead = docBordTableThead();
  const pages = paginateBordLinesDom(activeLines, renderRow, footerHtml, headerP1, headerCont, thead);
  const totalPages = pages.length;

  return pages.map((pg, idx) => {
    const pageNum = idx + 1;
    const isLast = pageNum === totalPages;
    let rowsHtml = '';
    if (pg.lines.length) {
      rowsHtml = pg.lines.map((l, rIdx) => renderRow(l, !pg.hasFooter && rIdx === pg.lines.length - 1)).join('');
    } else if (!activeLines.length) {
      rowsHtml = `<tr><td colspan="7" style="border:1.5px solid #000;text-align:center;padding:10px;font-style:italic">Aucun article sélectionné dans le Bordereau.</td></tr>`;
    }

    return `
      <div class="paper ${!isLast ? 'pb' : ''}" style="min-height:280mm;display:flex;flex-direction:column;justify-content:space-between;padding:20px 28px 18px;font-family:Calibri,Arial,sans-serif;color:#000;background:#fff">
        <div>
          ${idx === 0 ? headerP1 : headerCont}
          <table style="width:100%;border-collapse:collapse;margin-top:4px;color:#000">
            ${thead}
            <tbody>
              ${rowsHtml}
              ${pg.hasFooter ? footerHtml : ''}
            </tbody>
          </table>
        </div>
        <div style="margin-top:auto;padding-top:10px;text-align:right;font-size:12px;font-weight:700;color:#000">
          ${pageNum}/${totalPages}
        </div>
      </div>
    `;
  }).join('');
}

const DOCFN = {
  garde: dGarde,
  lettre: dLettre,
  bordfinal: dBordFinal,
  devis: dDevis,
  rapport: dRapport,
  evalglob: dEvalGlob,
  evaltrav: dEvalTrav,
  evalprest: dEvalPrest
};

/* ===== Onglet 5 : Catalogue des prix (Gestion complète : Modifier, Ajouter, Supprimer, Enregistrer) ===== */
function paneCat(el) {
  let currentNet = 'ALL';
  let currentFam = 'ALL';
  let currentCons = 'ALL';
  
  el.innerHTML = `
    <div class="bar" style="flex-wrap:wrap;gap:10px">
      <div>
        <h3 style="font-size:22px;color:var(--brand)" id="fullCatHeaderTitle">SÉRIE DES PRIX OFFICIELLE SRM-TTA (${ARTS.length} articles)</h3>
        <p class="note" style="margin:2px 0 0">
          Modifiez directement les <b>N° de Prix, Désignations, Consistances, Unités ou Prix Unitaires</b>, ajoutez ou supprimez des articles, puis cliquez sur <b>« 💾 Enregistrer la Série des Prix »</b>.
        </p>
      </div>
      <span class="sp"></span>
      <button class="btn pri" id="btnCatAddNew" style="font-weight:700">➕ Ajouter un article</button>
      <button class="btn ok" id="btnCatSaveAll" style="font-weight:700;padding:8px 16px">💾 Enregistrer la Série des Prix</button>
      <button class="btn sm" id="btnCatResetDefault" title="Restaurer la Série des Prix initiale (${(CAT.arts || []).length} articles)">🔄 Réinitialiser par défaut</button>
    </div>
    
    <div id="catAddFormBox"></div>
    
    <div style="background:#f8fafc;border:1.5px solid #cbd5e1;padding:12px;border-radius:8px;margin-top:8px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:260px">
          <input type="text" id="fullCatQ" placeholder="🔍 Recherche intelligente (ex: cable, preassemble, poteau b 12, transfo 160, boite s26)..." style="width:100%;padding:8px 32px 8px 12px;font-size:13.5px;border:1.5px solid #94a3b8;border-radius:6px">
          <button id="btnClearFullCatQ" title="Effacer" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;font-size:14px;color:#64748b;display:none">✕</button>
        </div>
        
        <select id="fullCatFam" style="padding:8px 10px;font-weight:600;color:var(--brand);border:1.5px solid #94a3b8;border-radius:6px;min-width:250px">
          ${FAMILLES_INTELLIGENTES.map(f => `<option value="${f[0]}">${f[1]}</option>`).join('')}
        </select>
        
        <select id="fullCatCons" style="padding:8px 10px;font-weight:600;border:1.5px solid #94a3b8;border-radius:6px">
          <option value="ALL">🔧 Toutes consistances (F+M / F / M)</option>
          <option value="F+M">F+M (Fourniture + Pose)</option>
          <option value="F">F (Fourniture seule)</option>
          <option value="M">M (Pose / Montage seul)</option>
        </select>
      </div>
      
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div class="sub" style="margin:0;display:flex;flex-wrap:wrap;gap:4px">
          <button data-cnet="ALL" class="on" id="fullCatBtnAll">📋 Tous (${ARTS.length})</button>
          <button data-cnet="MT">⚡ MT</button>
          <button data-cnet="BT">🔌 BT</button>
          <button data-cnet="MT-BT">🔗 MT-BT</button>
          <button data-cnet="PT">🏢 Postes & Transfos</button>
          <button data-cnet="EP">💡 Éclairage Public</button>
          <button data-cnet="ETD">📐 Études & Topo</button>
        </div>
        <span id="fullCatCount" style="font-weight:800;color:var(--brand);font-size:13.5px"></span>
      </div>
    </div>
    
    <div class="tw" style="margin-top:10px;max-height:66vh">
      <table>
        <thead>
          <tr style="position:sticky;top:0;z-index:2">
            <th style="width:85px">Type</th>
            <th style="width:105px">N° de Prix</th>
            <th>Désignation des fournitures et ouvrages</th>
            <th style="width:75px">Consist.</th>
            <th style="width:65px">Unité</th>
            <th style="width:120px">Prix Unitaire HT (DH)</th>
            <th style="width:170px">Actions / Bordereau</th>
          </tr>
        </thead>
        <tbody id="fullCatList"></tbody>
      </table>
    </div>
  `;
  
  const draw = () => {
    const all = allArts();
    const hdTitle = $('#fullCatHeaderTitle');
    if (hdTitle) hdTitle.textContent = `SÉRIE DES PRIX OFFICIELLE SRM-TTA (${all.length} articles)`;
    const btnAll = $('#fullCatBtnAll');
    if (btnAll) btnAll.textContent = `📋 Tous (${all.length})`;

    const qInp = $('#fullCatQ');
    const q = qInp ? qInp.value : '';
    const clearBtn = $('#btnClearFullCatQ');
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
    
    const res = smartFilterArts(all, q, currentNet, currentFam, currentCons);
    const cntEl = $('#fullCatCount');
    if (cntEl) cntEl.textContent = `${res.length} / ${all.length} article(s) affiché(s)`;
    
    el.querySelectorAll('[data-cnet]').forEach(b => {
      b.className = b.dataset.cnet === currentNet ? 'on' : '';
    });
    
    const catTypes = ['MT', 'BT', 'MT - BT', 'PT', 'EP', 'ETD'];

    $('#fullCatList').innerHTML = res.map(a => {
      const rIdx = a._realIdx;
      const curType = a.cat || detectArticleNetCategory(a);
      return `
        <tr>
          <td class="c">
            <select data-ccat="${rIdx}" style="font-size:11.5px;font-weight:700;padding:3px 4px;border:1px solid var(--line2);border-radius:4px;color:var(--brand)">
              ${catTypes.map(t => `<option value="${t}" ${curType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </td>
          <td class="c">
            <input type="text" data-ccode="${rIdx}" value="${esc(a.code)}" placeholder="N° Prix" style="width:92px;font-weight:700;font-family:monospace;text-align:center;padding:4px 5px;border:1px solid var(--line2);border-radius:4px">
          </td>
          <td style="min-width:320px;vertical-align:middle">
            <textarea data-cdes="${rIdx}" rows="2" style="width:100%;font-size:12px;font-weight:600;padding:4px 6px;border:1px solid var(--line2);border-radius:4px;line-height:1.35;resize:vertical;font-family:inherit;min-height:48px" title="DÉSIGNATION 1 (Complète, modifiable)">${esc(a.d)}</textarea>
            ${a.d2 && a.d2.trim() !== a.d.trim() ? `<div style="font-size:11px;color:#475569;margin-top:3px;background:#f1f5f9;padding:2px 6px;border-radius:4px;display:inline-block;border:1px solid #e2e8f0"><b style="color:#1e3a8a">Désignation 2 :</b> ${esc(a.d2)}</div>` : ''}
          </td>
          <td class="c">
            <select data-ccons="${rIdx}" style="font-size:12px;font-weight:600;padding:3px 4px;border:1px solid var(--line2);border-radius:4px">
              <option value="F+M" ${a.c === 'F+M' ? 'selected' : ''}>F+M</option>
              <option value="F" ${a.c === 'F' ? 'selected' : ''}>F</option>
              <option value="M" ${a.c === 'M' ? 'selected' : ''}>M</option>
            </select>
          </td>
          <td class="c">
            <input type="text" data-cu="${rIdx}" value="${esc(a.u)}" style="width:52px;text-align:center;font-size:12px;padding:4px;border:1px solid var(--line2);border-radius:4px">
          </td>
          <td class="n">
            <input type="text" data-cpu="${rIdx}" value="${a.p}" style="width:105px;text-align:right;font-weight:700;padding:4px 6px;border:1px solid var(--line2);border-radius:4px">
          </td>
          <td class="c" style="white-space:nowrap">
            <button class="btn sm" data-addlot="lot1" data-id="${esc(a._id)}" title="Ajouter à Ligne MT" style="padding:3px 6px">⚡MT</button>
            <button class="btn sm" data-addlot="lot2" data-id="${esc(a._id)}" title="Ajouter à Poste Transfo" style="padding:3px 6px">🏢PT</button>
            <button class="btn sm" data-addlot="lot3" data-id="${esc(a._id)}" title="Ajouter à Réseau BT" style="padding:3px 6px">🔌BT</button>
            <button class="btn sm del" data-cdel="${rIdx}" title="Supprimer cet article de la Série des Prix" style="padding:3px 7px;margin-left:3px">🗑️</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="7" class="empty">Aucun article trouvé.</td></tr>';
    
    // Événements de modification en direct + sauvegarde automatique dans localStorage
    $('#fullCatList').querySelectorAll('[data-ccat]').forEach(sel => {
      sel.onchange = () => {
        const idx = +sel.dataset.ccat;
        if (ARTS[idx]) { ARTS[idx].cat = sel.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
      };
    });
    $('#fullCatList').querySelectorAll('[data-ccode]').forEach(inp => {
      inp.oninput = () => {
        const idx = +inp.dataset.ccode;
        if (ARTS[idx]) { ARTS[idx].code = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
      };
    });
    $('#fullCatList').querySelectorAll('[data-cdes]').forEach(inp => {
      inp.oninput = () => {
        const idx = +inp.dataset.cdes;
        if (ARTS[idx]) { ARTS[idx].d = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
      };
    });
    $('#fullCatList').querySelectorAll('[data-ccons]').forEach(sel => {
      sel.onchange = () => {
        const idx = +sel.dataset.ccons;
        if (ARTS[idx]) { ARTS[idx].c = sel.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
      };
    });
    $('#fullCatList').querySelectorAll('[data-cu]').forEach(inp => {
      inp.oninput = () => {
        const idx = +inp.dataset.cu;
        if (ARTS[idx]) { ARTS[idx].u = inp.value; delete ARTS[idx]._haystack; saveCatalogStorage(false); }
      };
    });
    $('#fullCatList').querySelectorAll('[data-cpu]').forEach(inp => {
      inp.oninput = () => {
        const idx = +inp.dataset.cpu;
        if (ARTS[idx]) { ARTS[idx].p = num(inp.value); delete ARTS[idx]._haystack; saveCatalogStorage(false); }
      };
    });
    $('#fullCatList').querySelectorAll('[data-cdel]').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.cdel;
        const art = ARTS[idx];
        if (art && confirm(`Voulez-vous vraiment supprimer l'article « ${art.code} - ${art.d} » de la Série des Prix ?`)) {
          ARTS.splice(idx, 1);
          saveCatalogStorage(true);
          draw();
        }
      };
    });

    $('#fullCatList').querySelectorAll('[data-addlot]').forEach(b => {
      b.onclick = () => {
        const it = artByCode(b.dataset.id);
        let lot = b.dataset.addlot;
        if (it) {
          if (lot === 'lot1' && P.info && P.info.mtSite === 'Les Deux') lot = 'lot1_hs';
          const codeVal = it.code || getNextFCode(P.bord);
          P.bord = P.bord || [];
          insertBordByCatalogOrder({
            key: 'b_' + uid(),
            lot: lot,
            code: codeVal,
            d: it.d,
            c: it.c,
            u: it.u,
            q: 1,
            pu: num(it.p),
            on: true
          });
          autoNumberUndefinedPrices(P.bord);
          syncCablesFromBord();
          touch();
          updKpi();
          toast(`Article ${codeVal} ajouté au Bordereau`);
        }
      };
    });
  };
  
  $('#btnCatSaveAll').onclick = () => {
        saveCatalogStorage(true);
    saveStorage();
    draw();
  };

  $('#btnCatAddNew').onclick = () => {
    const fb = $('#catAddFormBox');
    if (fb.innerHTML) { fb.innerHTML = ''; return; }
    fb.innerHTML = `
      <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:14px;margin-top:10px">
        <div style="font-weight:800;color:#1e40af;margin-bottom:10px;font-size:14.5px">➕ Ajouter un nouvel article à la Série des Prix Officielle</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
          <label class="f" style="width:105px">Type
            <select id="newCatType">
              <option value="MT">MT</option>
              <option value="BT" selected>BT</option>
              <option value="MT - BT">MT - BT</option>
              <option value="PT">PT</option>
              <option value="EP">EP</option>
              <option value="ETD">ETD</option>
            </select>
          </label>
          <label class="f" style="width:120px">N° de Prix (N°SER)
            <input type="text" id="newCatCode" placeholder="ex: 34-00-15">
          </label>
          <label class="f" style="flex:1;min-width:260px">Désignation des fournitures et ouvrages
            <input type="text" id="newCatDes" placeholder="Désignation complète...">
          </label>
          <label class="f" style="width:90px">Consistance
            <select id="newCatCons">
              <option value="F+M">F+M</option>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </label>
          <label class="f" style="width:80px">Unité (UQ)
            <input type="text" id="newCatUnit" value="U">
          </label>
          <label class="f" style="width:130px">Prix Unitaire HT (DH)
            <input type="number" id="newCatPu" value="0" step="0.01">
          </label>
          <button class="btn ok" id="btnConfirmAddCat" style="padding:8px 16px;font-weight:700">💾 Ajouter et Enregistrer</button>
          <button class="btn" id="btnCancelAddCat">Annuler</button>
        </div>
      </div>
    `;
    $('#btnCancelAddCat').onclick = () => { fb.innerHTML = ''; };
    $('#btnConfirmAddCat').onclick = () => {
      const d = $('#newCatDes').value.trim();
      if (!d) { toast('Veuillez saisir la désignation de l’article'); return; }
      const newArt = {
        _uid: 'cat_' + uid(),
        code: $('#newCatCode').value.trim(),
        d: d,
        c: $('#newCatCons').value,
        u: $('#newCatUnit').value.trim() || 'U',
        p: num($('#newCatPu').value),
        cat: $('#newCatType').value
      };
      ARTS.push(newArt);
            saveCatalogStorage(true);
      fb.innerHTML = '';
      draw();
    };
  };

  $('#btnCatResetDefault').onclick = () => {
    if (confirm('Voulez-vous restaurer la Série des Prix initiale par défaut (698 articles) ? Toutes vos modifications personnalisées sur le catalogue seront réinitialisées.')) {
      localStorage.removeItem(STORAGE_CAT_KEY);
      ARTS = getDefaultArtsFromCat();
      saveCatalogStorage(false);
      draw();
      toast('Série des Prix réinitialisée par défaut');
    }
  };
  
  el.querySelectorAll('[data-cnet]').forEach(b => {
    b.onclick = () => { currentNet = b.dataset.cnet; draw(); };
  });
  $('#fullCatFam').onchange = e => { currentFam = e.target.value; draw(); };
  $('#fullCatCons').onchange = e => { currentCons = e.target.value; draw(); };
  $('#fullCatQ').oninput = draw;
  $('#btnClearFullCatQ').onclick = () => {
    $('#fullCatQ').value = '';
    draw();
    $('#fullCatQ').focus();
  };
  draw();
}

/* ===== Gestion des affaires (Tri par ordre de N° Affaire + Filtre par Mois d'étude & Année) ===== */
let affQ = '', affS = '', affYear = '', affMonth = '', affSortDir = 'desc', affGroupByMonth = false;

function suiv(info) {
  const m = ETAPES.find(e => !info[e[0]]);
  return m ? m[1] : 'Terminé';
}

function renderAffaires() {
  const m = $('#main');
  sortPlistByOrder();

  const all = plist.map(x => {
    const d = x.data || {};
    const i = d.info || {};
    let total = 0;
    if (P && P.id === x.id) {
      total = computeEval().total;
    } else {
      const ht = (d.bord || []).filter(l => l.on !== false).reduce((acc, l) => acc + (num(l.q) * num(l.pu)), 0);
      const ttc = ht * 1.2;
      total = r2(ttc);
    }
    const parsedNum = parseAffaireNum(i.num || i.refAffaire);
    const dtInfo = extractStudyDateInfo(i, d.upd || x.upd);
    return {
      id: x.id,
      name: d.name || x.name,
      i: i,
      total: total,
      upd: d.upd || x.upd || 0,
      st: i.statut || 'En étude',
      nbArts: (d.bord || []).length,
      hasNum: !!parsedNum,
      seqNum: parsedNum ? parsedNum.num : -1,
      seqYear: parsedNum ? parsedNum.year : -1,
      dt: dtInfo
    };
  }).sort((a, b) => {
    if (a.hasNum && !b.hasNum) return -1;
    if (!a.hasNum && b.hasNum) return 1;
    const diff = (a.seqYear - b.seqYear) || (a.seqNum - b.seqNum);
    return affSortDir === 'asc' ? diff : -diff;
  });

  // Années et Mois disponibles
  const yearsSet = new Set();
  all.forEach(r => { if (r.dt.year) yearsSet.add(r.dt.year); });
  const yearsList = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

  const q = affQ.toLowerCase();
  const rows = all.filter(r => {
    if (affS && r.st !== affS) return false;
    if (affYear && r.dt.year !== affYear) return false;
    if (affMonth && r.dt.month !== affMonth) return false;
    if (q) {
      const hay = [r.name, r.i.num, r.i.demande, r.i.devis, r.i.contrat, r.i.objet, r.i.commune, r.i.province, r.i.destinataire, r.dt.displayDate, r.dt.myLabel].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cnt = s => all.filter(r => r.st === s).length;
  const cntYear = y => all.filter(r => r.dt.year === y).length;
  const cntMonth = mo => all.filter(r => (!affYear || r.dt.year === affYear) && r.dt.month === mo).length;
  const enCours = all.filter(r => !['Clôturé', 'Annulé', 'Brouillon'].includes(r.st)).length;
  const tot = r2(rows.filter(r => r.st !== 'Annulé').reduce((a, r) => a + r.total, 0));
  const curId = (P && P.id) ? P.id : (all[0] ? all[0].id : '');

  // Construction des lignes du tableau (avec ou sans regroupement par Mois / Année d'étude)
  const renderRowHtml = (r, rankIdx) => `
    <tr style="${P && P.id === r.id ? 'background:var(--hv-soft);' : ''}">
      <td class="c" style="font-weight:800;color:var(--muted);font-family:var(--f-m)">#${rankIdx}</td>
      <td class="c">
        <span style="display:inline-block;background:var(--brand);color:#fff;font-size:12px;font-weight:700;padding:3px 9px;border-radius:5px;font-family:var(--f-m)">${esc(r.i.num || 'SET/DPO/...')}</span>
      </td>
      <td class="c">
        <div style="font-weight:700;font-size:12.5px;color:var(--ink)">${esc(r.dt.displayDate)}</div>
        <div style="font-size:10.5px;color:var(--brand);font-weight:700">${esc(r.dt.myLabel)}</div>
      </td>
      <td class="c"><b>${esc(r.i.demande || '—')}</b></td>
      <td class="c">${esc(r.i.contrat || r.i.devis || '—')}</td>
      <td>
        <b style="font-size:13.5px;color:var(--ink);cursor:pointer" data-open="${r.id}" title="Cliquer pour entrer et modifier cette affaire">${esc(r.i.objet || r.name)}</b>
        <div style="font-size:11.5px;color:var(--muted)">Partenaire : ${esc(r.i.destinataire || '—')} • ${r.nbArts} article(s)</div>
      </td>
      <td>${esc(r.i.commune || '')} ${r.i.province ? '(' + esc(r.i.province) + ')' : ''}</td>
      <td class="c"><span class="pill gold">${esc(r.i.typeAff || 'MT/BT')}</span></td>
      <td>
        <select data-st="${r.id}" style="font-size:12px;padding:4px 6px">
          ${STATUTS.map(s => `<option ${s === r.st ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="n" style="font-weight:700;color:var(--brand)">${fmt(r.total)} DH</td>
      <td class="c" style="white-space:nowrap">
        <button class="btn sm pri" data-open="${r.id}" style="font-weight:800;padding:5px 11px" title="Entrer dans cette affaire pour la modifier">
          ✏️ Entrer / Modifier
        </button>
        <button class="btn sm ok" data-samebord="${r.id}" title="Créer une nouvelle affaire avec le même Bordereau">
          📋 Dupliquer
        </button>
        <button class="btn sm del" data-delaff="${r.id}" title="Supprimer cette affaire">
          🗑️
        </button>
      </td>
    </tr>
  `;

  let tbodyHtml = '';
  if (!rows.length) {
    tbodyHtml = '<tr><td colspan="11" class="empty">Aucune affaire trouvée pour ces critères (Mois / Année / Recherche).</td></tr>';
  } else if (!affGroupByMonth) {
    tbodyHtml = rows.map((r, idx) => renderRowHtml(r, idx + 1)).join('');
  } else {
    // Regroupement par Mois & Année d'étude tout en conservant le classement par ordre de N° Affaire à l'intérieur
    const groupsMap = new Map();
    rows.forEach(r => {
      const k = r.dt.myKey;
      if (!groupsMap.has(k)) {
        groupsMap.set(k, { key: k, label: r.dt.myLabel, items: [], tot: 0 });
      }
      const g = groupsMap.get(k);
      g.items.push(r);
      g.tot = r2(g.tot + r.total);
    });
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
    let globalIdx = 1;
    tbodyHtml = sortedGroups.map(g => `
      <tr class="sec-lot">
        <td colspan="11" style="background:var(--brand);color:#fff;padding:8px 14px;font-size:14px;font-weight:800">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span>📅 MOIS D'ÉTUDE : ${esc(g.label.toUpperCase())} — ${g.items.length} affaire(s) (Classées par ordre N° Affaire)</span>
            <span style="background:rgba(255,255,255,0.18);padding:2px 10px;border-radius:6px;font-family:var(--f-m)">Sous-total : ${fmt(g.tot)} DH TTC</span>
          </div>
        </td>
      </tr>
      ${g.items.map(r => renderRowHtml(r, globalIdx++)).join('')}
    `).join('');
  }

  m.innerHTML = `
    <!-- BANNIÈRE D'ACCUEIL PORTAIL PRO (SÉLECTION D'AFFAIRE) -->
    <div class="card top" style="background:linear-gradient(135deg, #ffffff 0%, #f0fdf4 60%, #eff6ff 100%);border-top:5px solid var(--brand)">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="background:#fff;padding:8px 12px;border-radius:12px;border:2px solid var(--brand);box-shadow:0 4px 12px rgba(0,0,0,0.08)">
          <img src="${typeof LOGO !== 'undefined' ? LOGO : ''}" alt="SRM-TTA" style="height:56px;width:auto;display:block;object-fit:contain">
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span class="pill" style="background:var(--brand);color:#fff;font-weight:800">🏛️ DIRECTION PROVINCIALE D'OUEZZANE</span>
            <span class="pill gold" style="font-weight:800">⭐ VERSION PRO</span>
            <span class="pill green" style="font-weight:800">👨‍💻 Préparateur de l'application : A. DARRAGE</span>
          </div>
          <h2 style="font-size:27px;color:var(--brand)">📂 PORTAIL DE SÉLECTION & GESTION DES AFFAIRES</h2>
          <div class="status" style="font-size:13px;color:var(--muted)">
            Affaires classées automatiquement par ordre de <b>N° d'Affaire</b> • Filtrables par <b>Mois d'étude</b> et par <b>Année</b>.
          </div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><span>Affaires Affichées</span><b>${rows.length} / ${all.length}</b></div>
        <div class="kpi"><span>Affaires en cours</span><b>${enCours}</b></div>
        <div class="kpi total"><span>Total Affiché TTC</span><b style="color:var(--brand)">${fmt(tot)} DH</b></div>
      </div>
    </div>

    <!-- BLOC DE SÉLECTION RAPIDE D'UNE AFFAIRE POUR ENTRER ET MODIFIER (CLASSÉ PAR ORDRE) -->
    <div class="card" style="padding:18px 22px;background:linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%);border:2px solid var(--brand);box-shadow:var(--shadow-md)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div style="font-family:var(--f-d);font-size:20px;font-weight:800;color:var(--brand);letter-spacing:.03em">
          🎯 1. SÉLECTIONNER UNE AFFAIRE (CLASSÉE PAR ORDRE) ET ENTRER POUR MODIFIER :
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn hv" id="aNew">➕ Créer une Nouvelle Affaire</button>
          <button class="btn ok" id="aNewWithBord" title="Créer une nouvelle affaire en reprenant un Bordereau existant">📋 Nouvelle avec Bordereau</button>
          <button class="btn" id="aNewFromPdf" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📄 Importer un Bordereau PDF</button>
          <button class="btn" id="actAllAff" title="Actualiser toutes les affaires enregistrées">🔄 Actualiser tout</button>
        </div>
      </div>

      <div style="display:flex;gap:12px;align-items:stretch;flex-wrap:wrap">
        <select id="selQuickAffaire" style="flex:1;min-width:300px;font-size:15px;font-weight:700;padding:11px 14px;border:2px solid var(--brand);border-radius:9px;background:#fff;color:var(--ink)">
          ${rows.map((r, idx) => {
            const num = r.i.num || 'SET/DPO/...';
            const obj = r.i.objet || r.name || 'Sans objet';
            const com = r.i.commune ? ` • ${r.i.commune}` : '';
            const typ = r.i.typeAff || 'MT/BT';
            return `<option value="${r.id}" ${r.id === curId ? 'selected' : ''}>#${idx + 1} — [${esc(num)}] ${esc(obj)}${esc(com)} (${esc(r.dt.displayDate)} • ${esc(typ)} — ${fmt(r.total)} DH TTC)</option>`;
          }).join('')}
        </select>

        <button class="btn pri" id="btnEnterSelectedAff" style="font-size:15.5px;font-weight:800;padding:11px 24px;border-radius:9px;box-shadow:0 4px 12px rgba(6,95,70,0.28)">
          ✏️ Entrer pour modifier cette affaire &rarr;
        </button>

        <button class="btn" id="btnEnterDocsAff" style="font-weight:700;padding:11px 16px;border-radius:9px;border-color:var(--brand);color:var(--brand)">
          📄 Ouvrir ses Documents
        </button>
      </div>
    </div>

    <!-- TABLEAU COMPLET AVEC CLASSEMENT PAR ORDRE + FILTRES MOIS D'ÉTUDE & ANNÉE -->
    <div class="card pane" style="border-radius:12px">
      <!-- Barre de filtres : Classement par ordre + Année + Mois d'étude + Recherche -->
      <div style="background:#f8fafc;border:1.5px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
          <label class="f" style="min-width:240px">
            🔢 Classement par Ordre N° Affaire
            <select id="selAffSortDir" style="font-weight:700;border-color:var(--brand);color:var(--brand)">
              <option value="desc" ${affSortDir === 'desc' ? 'selected' : ''}>⬇️ Plus récent en haut (112 &rarr; 111 &rarr; 110...)</option>
              <option value="asc" ${affSortDir === 'asc' ? 'selected' : ''}>⬆️ Ordre Croissant (100 &rarr; 110 &rarr; 112...)</option>
            </select>
          </label>

          <label class="f" style="min-width:165px">
            📅 Filtrer par Année d'étude
            <select id="selAffYear" style="font-weight:700">
              <option value="">Toutes les années (${all.length})</option>
              ${yearsList.map(y => `<option value="${esc(y)}" ${affYear === y ? 'selected' : ''}>Année ${esc(y)} (${cntYear(y)})</option>`).join('')}
            </select>
          </label>

          <label class="f" style="min-width:200px">
            🗓️ Filtrer par Mois d'étude
            <select id="selAffMonth" style="font-weight:700">
              <option value="">Tous les mois</option>
              ${MOIS_FR.slice(1).map((mName, idx) => {
                const mCode = String(idx + 1).padStart(2, '0');
                const c = cntMonth(mCode);
                return `<option value="${mCode}" ${affMonth === mCode ? 'selected' : ''}>${mCode} - ${mName} (${c})</option>`;
              }).join('')}
            </select>
          </label>

          <label class="f" style="flex:1;min-width:240px">
            🔍 Recherche rapide
            <input type="text" id="affSearch" placeholder="N° affaire, demande, contrat, devis, objet, commune..." value="${esc(affQ)}">
          </label>

          <div style="display:flex;align-items:center;gap:8px;padding-bottom:2px">
            <label style="display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid var(--brand);color:var(--brand);padding:7px 12px;border-radius:7px;font-weight:700;font-size:12.5px;cursor:pointer">
              <input type="checkbox" id="chkGroupMonth" ${affGroupByMonth ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--brand)">
              📂 Grouper par Mois / Année
            </label>
            ${(affYear || affMonth || affQ || affS) ? `
              <button type="button" class="btn sm del" id="btnResetAffFilters" style="padding:7px 11px;font-weight:700" title="Réinitialiser tous les filtres">
                ↺ Tout afficher
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Boutons rapides des Mois d'étude ayant des affaires -->
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)">
          <span style="font-size:12px;font-weight:700;color:var(--muted)">Accès rapide Mois d'étude :</span>
          <button type="button" class="btn sm ${!affMonth ? 'pri' : ''}" data-mo="">Tous les mois</button>
          ${MOIS_FR.slice(1).map((mName, idx) => {
            const mCode = String(idx + 1).padStart(2, '0');
            const c = cntMonth(mCode);
            if (c === 0 && affMonth !== mCode) return '';
            return `<button type="button" class="btn sm ${affMonth === mCode ? 'pri' : ''}" data-mo="${mCode}">${mCode} · ${mName} (${c})</button>`;
          }).join('')}
        </div>
      </div>

      <div class="sub">
        <button data-s="" class="${affS === '' ? 'on' : ''}">Tous les statuts (${all.length})</button>
        ${STATUTS.filter(s => cnt(s) > 0).map(s => `<button data-s="${s}" class="${affS === s ? 'on' : ''}">${s} (${cnt(s)})</button>`).join('')}
      </div>

      <div class="tw">
        <table>
          <thead>
            <tr>
              <th style="width:55px">Ordre</th>
              <th style="width:140px">N° Affaire</th>
              <th style="width:115px">Date d'Étude<br><small style="font-weight:500">(Mois / Année)</small></th>
              <th style="width:90px">N° Demande</th>
              <th style="width:95px">N° Contrat / Devis</th>
              <th>Objet du projet / Partenaire</th>
              <th style="width:135px">Commune / Province</th>
              <th style="width:80px">Type</th>
              <th style="width:125px">Statut</th>
              <th style="width:120px">Total TTC</th>
              <th style="width:245px">Action (Entrer / Modifier)</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#aNew').onclick = newP;
  const aNewBordBtn = $('#aNewWithBord'); if (aNewBordBtn) aNewBordBtn.onclick = openNewAffaireWithBordModal;
  const aNewPdfBtn = $('#aNewFromPdf');
  if (aNewPdfBtn && $('#inpImportPdfSidebar')) {
    aNewPdfBtn.onclick = () => { $('#inpImportPdfSidebar').value = ''; $('#inpImportPdfSidebar').click(); };
  }
  const actBtn = $('#actAllAff');
  if (actBtn) actBtn.onclick = () => actualiserToutesLesAffaires(true);

  const btnEnterSel = $('#btnEnterSelectedAff');
  if (btnEnterSel) {
    btnEnterSel.onclick = () => {
      const id = $('#selQuickAffaire') ? $('#selQuickAffaire').value : '';
      const f = plist.find(x => x.id === id) || plist[0];
      if (f) {
        tab = 'projet';
        openP(f.data);
      }
    };
  }

  const btnEnterDocs = $('#btnEnterDocsAff');
  if (btnEnterDocs) {
    btnEnterDocs.onclick = () => {
      const id = $('#selQuickAffaire') ? $('#selQuickAffaire').value : '';
      const f = plist.find(x => x.id === id) || plist[0];
      if (f) {
        tab = 'docs';
        openP(f.data);
      }
    };
  }

  const sortSel = $('#selAffSortDir');
  if (sortSel) {
    sortSel.onchange = () => {
      affSortDir = sortSel.value;
      renderAffaires();
    };
  }

  const yearSel = $('#selAffYear');
  if (yearSel) {
    yearSel.onchange = () => {
      affYear = yearSel.value;
      renderAffaires();
    };
  }

  const monthSel = $('#selAffMonth');
  if (monthSel) {
    monthSel.onchange = () => {
      affMonth = monthSel.value;
      renderAffaires();
    };
  }

  const chkGrp = $('#chkGroupMonth');
  if (chkGrp) {
    chkGrp.onchange = () => {
      affGroupByMonth = chkGrp.checked;
      renderAffaires();
    };
  }

  const btnReset = $('#btnResetAffFilters');
  if (btnReset) {
    btnReset.onclick = () => {
      affYear = '';
      affMonth = '';
      affQ = '';
      affS = '';
      renderAffaires();
    };
  }

  m.querySelectorAll('[data-mo]').forEach(b => {
    b.onclick = () => {
      affMonth = b.dataset.mo;
      renderAffaires();
    };
  });

  const searchInput = $('#affSearch');
  searchInput.oninput = () => {
    affQ = searchInput.value;
    renderAffaires();
    const ni = $('#affSearch');
    if (ni) { ni.focus(); ni.setSelectionRange(affQ.length, affQ.length); }
  };

  m.querySelectorAll('[data-s]').forEach(b => {
    b.onclick = () => { affS = b.dataset.s; renderAffaires(); };
  });

  m.querySelectorAll('[data-open]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.open;
      const f = plist.find(x => x.id === id);
      if (f) {
        openP(f.data);
      }
    };
  });

  m.querySelectorAll('[data-samebord]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.samebord;
      const f = plist.find(x => x.id === id);
      if (f && f.data) {
        createNewAffaireWithSameBord(f.data);
      }
    };
  });

  m.querySelectorAll('[data-delaff]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.delaff;
      const f = plist.find(x => x.id === id);
      if (!f) return;
      if (plist.length <= 1) {
        toast('Impossible de supprimer la seule affaire restante');
        return;
      }
      const label = (f.data && f.data.info && (f.data.info.num + ' - ' + (f.data.info.objet || f.name))) || f.name;
      if (confirm(`Supprimer définitivement l'affaire « ${label} » ?`)) {
        plist = plist.filter(x => x.id !== id);
        if (P && P.id === id) {
          P = plist[0].data;
        }
        saveStorage();
        renderList();
        renderAffaires();
        toast('Affaire supprimée');
      }
    };
  });

  m.querySelectorAll('[data-st]').forEach(s => {
    s.onchange = () => {
      const id = s.dataset.st;
      const val = s.value;
      const f = plist.find(x => x.id === id);
      if (f) {
        f.data.info = f.data.info || {};
        f.data.info.statut = val;
        f.data.upd = Date.now();
        if (P && P.id === id) {
          P.info.statut = val;
        }
        saveStorage();
        renderAffaires();
      }
    };
  });
}

/* ===== Initialisation & Événements globaux ===== */
const newPBtn = $('#newP'); if (newPBtn) newPBtn.onclick = newP;
const newPFromBordBtn = $('#newPFromBord'); if (newPFromBordBtn) newPFromBordBtn.onclick = openNewAffaireWithBordModal;
const newPFromPdfBtn = $('#newPFromPdf');
const inpPdfSidebar = $('#inpImportPdfSidebar');
if (newPFromPdfBtn && inpPdfSidebar) {
  newPFromPdfBtn.onclick = () => { inpPdfSidebar.value = ''; inpPdfSidebar.click(); };
  inpPdfSidebar.onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handlePdfBordereauUpload(f, 'new');
  };
}
const goAffBtn = $('#goAff'); if (goAffBtn) goAffBtn.onclick = () => { mode = 'affaires'; render(); };
const expAffBtn = $('#expCurrentAffaire'); if (expAffBtn) expAffBtn.onclick = exportCurrentAffaire;
const expAllBtn = $('#expAllJson'); if (expAllBtn) expAllBtn.onclick = exportAllJson;
const impPBtn = $('#impP'); if (impPBtn) impPBtn.onclick = () => $('#impF').click();

const impFEl = $('#impF');
if (impFEl) {
  impFEl.onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (Array.isArray(o)) {
          // Sauvegarde globale de tous les projets
          plist = o;
          saveStorage();
          if (plist.length) openP(plist[0].data || plist[0]);
          renderList();
          render();
          toast(`Sauvegarde globale (${plist.length} affaires) importée avec succès`);
        } else if (o && (o.info || o.bord)) {
          // Import d'une affaire individuelle
          o.id = uid();
          if (o.info && o.info.objet) o.name = o.info.objet.trim();
          plist.unshift({
            id: o.id,
            name: o.name || (o.info && o.info.objet) || 'Dossier importé',
            upd: Date.now(),
            data: o
          });
          saveStorage();
          openP(o);
          renderList();
          render();
          toast(`Affaire "${o.info?.num || o.name}" importée avec succès`);
        } else {
          throw new Error('Format invalide');
        }
      } catch (err) {
        toast('Fichier non reconnu ou format incorrect');
      }
    };
    rd.readAsText(f);
    e.target.value = '';
  };
}


/* ==========================================================================
   6 · CHIFFRAGE APRÈS RÉCOLEMENT & FEUILLE D'ATTACHEMENT (SANS PRIX)
   ========================================================================== */

/* Évaluation comparative Étude vs Récolement */
function computeRecolEval(targetP) {
  const curP = targetP || P;
  const e = computeEval();
  const tva = num(curP.tva ?? 20) / 100;
  const lines = (curP.bord || []).filter(l => l && l.on !== false);

  let hasAnyRecol = false;
  let sumRecolHt = 0;

  const items = lines.map((l, idx) => {
    const qEtude = num(l.q);
    const pu = num(l.pu);
    const totEtude = r2(qEtude * pu);
    const hasQ = (l.qRecol !== undefined && l.qRecol !== null && String(l.qRecol).trim() !== '');
    let qRec = null;
    let totRec = null;
    if (hasQ) {
      hasAnyRecol = true;
      qRec = num(l.qRecol);
      totRec = r2(qRec * pu);
      sumRecolHt += totRec;
    }
    return {
      rawLine: l,
      fullIdx: curP.bord.indexOf(l),
      code: l.code === '—' ? '' : (l.code || ''),
      d: l.d || '',
      c: l.c || 'F+M',
      u: l.u || 'U',
      qEtude,
      pu,
      totEtude,
      qRec,
      totRec,
      hasQ
    };
  });

  sumRecolHt = r2(sumRecolHt);
  const recolWorksTva = r2(sumRecolHt * tva);
  const recolWorksTtc = r2(sumRecolHt + recolWorksTva);

  // Prestations SRM-TTA Récolement
  const allPre = PRE_DEFAULT.concat((curP.customPre || []).map(x => ({ name: x.name, p: num(x.p), cu: 1 })));
  const recolPr = [];
  const recolSpecialPr = [];

  allPre.forEach(a => {
    const s = curP.prest && curP.prest[a.name];
    if (!s || !s.on) return;
    let pu = s.pu != null && s.pu !== '' ? num(s.pu) : a.p;
    let q = s.qty != null && s.qty !== '' ? num(s.qty) : 1;

    // Peines et soins = 20% des travaux réalisés HT
    if (a.name === PEINES) {
      pu = hasAnyRecol ? r2(sumRecolHt * (num(curP.peines ?? 20) / 100)) : 0;
      q = 1;
    } else if (a.name === 'Participation sur puissance') {
      q = num(curP.info.puissance) || q;
    }
    const item = { name: a.name, pu, q, tot: r2(pu * q) };
    if (isSpecialPrest(a.name)) {
      recolSpecialPr.push(item);
    } else {
      recolPr.push(item);
    }
  });

  const recolPht = r2(recolPr.reduce((s, x) => s + x.tot, 0));
  const recolPtva = r2(recolPht * tva);
  const recolCorePttc = r2(recolPht + recolPtva);
  const recolSpecialTotal = r2(recolSpecialPr.reduce((s, x) => s + x.tot, 0));
  const recolPttc = r2(recolCorePttc + recolSpecialTotal);
  const recolTotal = r2(recolWorksTtc + recolPttc);

  // DIFFÉRENCE RÉCOLEMENT - ÉTUDE = TOTAL PRESTATIONS SRM-TTA T.T.C "Recolement" - TOTAL PRESTATIONS SRM-TTA T.T.C "Etude"
  const ecartTtc = r2(recolPttc - e.pttc);
  const ecartTotalGeneral = r2(recolTotal - e.total);

  return {
    e,
    tva,
    items,
    hasAnyRecol,
    sumRecolHt,
    recolWorksTva,
    recolWorksTtc,
    recolPr,
    recolSpecialPr,
    recolPht,
    recolPtva,
    recolPttc,
    recolTotal,
    ecartTtc,
    ecartTotalGeneral
  };
}

/* Téléchargement PDF Direct de Chiffrage Après Récolement & Feuille d'Attachement (garder même forme) */
async function downloadRecolPdf(subView) {
  const isChif = (subView === 'chiffrage');
  const isAtt = (subView === 'attachement');
  const isFiche = (subView === 'fiche');
  let btn = null;
  if (isChif) btn = document.querySelector('#btnDownloadRecolPdf');
  else if (isAtt) btn = document.querySelector('#btnDownloadAttPdf');
  else if (isFiche) btn = document.querySelector('#btnDownloadFichePdf');
  const origText = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Génération du PDF...';
  }
  toast('Génération du fichier PDF en cours...');

  try {
    if (!window.jspdf || !window.html2canvas) {
      window.print();
      toast('Impression / Enregistrement PDF ouvert');
      return;
    }
    const { jsPDF } = window.jspdf;
    const paperEl = document.querySelector('.paper.recol-pro-paper');
    if (!paperEl) throw new Error('Document introuvable dans la page');

    // Cloner pour un rendu d'impression parfait sans boîtes d'input
    const clone = paperEl.cloneNode(true);
    clone.style.boxShadow = 'none';
    clone.style.margin = '0';
    const targetWidth = isChif ? 1080 : (isFiche ? 794 : 980);
    clone.style.width = targetWidth + 'px';
    clone.style.maxWidth = targetWidth + 'px';
    clone.style.padding = isChif ? '20px 24px' : (isFiche ? '22px 26px 20px 26px' : '22px 28px');
    if (isFiche) {
      clone.style.width = '210mm';
      clone.style.maxWidth = '210mm';
      clone.style.height = '297mm';
      clone.style.minHeight = '297mm';
      clone.style.padding = '15mm 18mm';
      clone.style.boxSizing = 'border-box';
      clone.style.border = 'none';
      clone.style.boxShadow = 'none';
      clone.style.display = 'flex';
      clone.style.flexDirection = 'column';
      clone.style.justifyContent = 'space-between';
      clone.style.background = '#ffffff';
    }
    clone.style.background = '#ffffff';

    // Remplacer les champs input par des textes propres avec la même mise en forme
    clone.querySelectorAll('input').forEach(inp => {
      const span = document.createElement('span');
      span.textContent = inp.value || '—';
      span.style.cssText = inp.style.cssText;
      span.style.border = 'none';
      span.style.background = 'transparent';
      span.style.display = 'inline-block';
      span.style.width = '100%';
      span.style.textAlign = inp.style.textAlign || 'right';
      span.style.fontWeight = '700';
      span.style.fontSize = inp.style.fontSize || '11.5px';
      inp.parentNode.replaceChild(span, inp);
    });

    // Retirer les éléments avec classe no-print
    clone.querySelectorAll('.no-print').forEach(el => el.remove());

    // Conteneur hors écran temporaire
    const offscreen = document.createElement('div');
    offscreen.style.cssText = `position:fixed;left:-10000px;top:0;width:${targetWidth}px;background:#ffffff;z-index:-1;`;
    offscreen.appendChild(clone);
    document.body.appendChild(offscreen);

    const canvas = await window.html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    if (offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageW = 210;
    const pageH = 297;
    const margin = 6;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    const imgW = maxW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= maxH * 1.15) {
      let finalW = imgW;
      let finalH = imgH;
      let xOffset = margin;
      if (imgH > maxH) {
        const ratio = maxH / imgH;
        finalH = maxH;
        finalW = imgW * ratio;
        xOffset = (pageW - finalW) / 2;
      }
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', xOffset, margin, finalW, finalH, undefined, 'FAST');
    } else {
      const pxPerMm = canvas.width / imgW;
      const sliceHeightPx = Math.floor(maxH * pxPerMm);
      let yPx = 0;
      let firstPage = true;
      while (yPx < canvas.height) {
        if (!firstPage) pdf.addPage();
        firstPage = false;
        const currentSliceH = Math.min(sliceHeightPx, canvas.height - yPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceH;
        const sctx = sliceCanvas.getContext('2d');
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sctx.drawImage(canvas, 0, yPx, canvas.width, currentSliceH, 0, 0, canvas.width, currentSliceH);

        const sliceH_mm = (currentSliceH * imgW) / canvas.width;
        const sData = sliceCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(sData, 'JPEG', margin, margin, imgW, sliceH_mm, undefined, 'FAST');
        yPx += currentSliceH;
      }
    }

    const devisOrDemande = (P.info && (P.info.devis || P.info.demande || P.info.contrat)) || P.name || 'etude';
    let filename = '';
    if (isChif) {
      filename = `Chiffrage_Apres_Recolement_${devisOrDemande}.pdf`.replace(/[^\w\-.]+/g, '_');
    } else if (isFiche) {
      filename = `Fiche_Suiveuse_${devisOrDemande}.pdf`.replace(/[^\w\-.]+/g, '_');
    } else {
      const attNum = (P.info && P.info.attNum) ? P.info.attNum : '1';
      filename = `Attachement_N${attNum}_${devisOrDemande}.pdf`.replace(/[^\w\-.]+/g, '_');
    }

    pdf.save(filename);
    toast(`✅ PDF "${filename}" téléchargé avec succès`);
  } catch (err) {
    console.error(err);
    toast('Erreur génération PDF : ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

/* Export Excel dédié au Récolement et aux Attachements */
function exportRecolXlsx(mode = 'both') {
  if (typeof XLSX === 'undefined') {
    toast('Bibliothèque Excel non chargée');
    return;
  }
  const wb = XLSX.utils.book_new();
  const i = P.info || {};
  const rec = computeRecolEval();
  const e = rec.e;

  const head = title => [
    [title],
    ['Objet', ':', i.objet || ''],
    ['Commune', ':', i.commune || ''],
    ['Province', ':', i.province || ''],
    ['Demande N°', ':', i.demande || '', 'Contrat N°', ':', i.contrat || '', 'Devis N°', ':', i.devis || ''],
    []
  ];

  // 1. Feuille : Chiffrage Après Récolement (si mode === 'chiffrage' ou 'both')
  if (mode === 'chiffrage' || mode === 'both') {
    const aoaRecol = head('CHIFFRAGE APRES RECOLEMENT');
    aoaRecol.push([
      'N° DE PRIX',
      'DESIGNATION DES FOURNITURES ET OUVRAGES',
      'CONSISTANCE',
      'UNITE',
      'QUANTITE (Etude)',
      'PRIX UNITAIRES (HT)',
      'PRIX TOTAUX (HT Etude)',
      'QUANTITE REALISE (Recolement)',
      'PRIX TOTAUX (HT Recolement)'
    ]);

    rec.items.forEach(it => {
      aoaRecol.push([
        it.code,
        it.d,
        it.c,
        it.u,
        it.qEtude,
        it.pu,
        it.totEtude,
        it.hasQ ? it.qRec : '',
        it.hasQ ? it.totRec : '-'
      ]);
    });

    aoaRecol.push([]);
    aoaRecol.push(['', '', '', '', '', 'TOTAL (HT)', e.b.ht, '', rec.hasAnyRecol ? rec.sumRecolHt : '-']);
    aoaRecol.push(['', '', '', '', '', 'TVA ' + P.tva + '%', e.worksTva, '', rec.hasAnyRecol ? rec.recolWorksTva : '-']);
    aoaRecol.push(['', '', '', '', '', 'TOTAL (G)', e.worksTtc, '', rec.hasAnyRecol ? rec.recolWorksTtc : 0]);
    aoaRecol.push([]);
    aoaRecol.push(['', 'PRESTATIONS SRM-TTA (T-PRESTATIONS)', '', '', '', '', '', '', '']);

    e.pr.forEach((prItem, pIdx) => {
      const recPrItem = rec.recolPr[pIdx] || prItem;
      aoaRecol.push([
        '',
        prItem.name,
        '',
        '',
        prItem.q,
        prItem.pu,
        prItem.tot,
        recPrItem.q,
        recPrItem.tot
      ]);
    });

    aoaRecol.push(['', '', '', '', '', 'TOTAL HTVA', e.pht, '', rec.recolPht]);
    aoaRecol.push(['', '', '', '', '', 'TOTAL TTC', e.pttc, '', rec.recolPttc]);
    aoaRecol.push([]);
    aoaRecol.push(['', 'TOTAL PRESTATIONS SRM-TTA T.T.C', '', '', '', '', e.pttc, '', rec.recolPttc]);
    aoaRecol.push(['', 'TOTAL GENERAL T.T.C', '', '', '', '', e.total, '', rec.recolTotal]);
    aoaRecol.push(['', 'DIFFÉRENCE RÉCOLEMENT - ÉTUDE (PRESTATIONS SRM-TTA TTC)', '', '', '', '', '', '', rec.ecartTtc]);
    aoaRecol.push(['', rec.ecartTtc < 0 ? 'Ecart en Faveur du client' : (rec.ecartTtc > 0 ? 'Ecart en Faveur de la SRM-TTA' : 'Aucun écart'), '', '', '', '', '', '', '']);

    const wsRecol = XLSX.utils.aoa_to_sheet(aoaRecol);
    XLSX.utils.book_append_sheet(wb, wsRecol, 'Chiffrage Récolement');
  }

  // 2. Feuille : Feuille d'Attachement (sans prix)
  if (mode === 'attachement' || mode === 'both') {
    const attNum = (P.info && P.info.attNum) ? P.info.attNum : '1';
    const aoaAtt = head(`FEUILLE D'ATTACHEMENT DES TRAVAUX N° ${attNum}`);
    aoaAtt.push(['Entreprise Réalisatrice', ':', i.attEntreprise || i.entreprise || '']);
    aoaAtt.push(['Date de réalisation', ':', i.attDate || i.date || '']);
    aoaAtt.push([]);
    aoaAtt.push(['N° DE PRIX', 'DESIGNATION DES FOURNITURES ET OUVRAGES', 'CONSISTANCE', 'UNITE', 'QUANTITE']);

    rec.items.forEach(it => {
      const qVal = it.hasQ ? it.qRec : it.qEtude;
      aoaAtt.push([it.code, it.d, it.c, it.u, qVal]);
    });

    aoaAtt.push([]);
    aoaAtt.push(['L\'Entreprise Réalisatrice', '', 'Conducteur de travaux / SRM-TTA', '', 'Client']);

    const wsAtt = XLSX.utils.aoa_to_sheet(aoaAtt);
    XLSX.utils.book_append_sheet(wb, wsAtt, `Attachement N° ${attNum}`);
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const fname = ((P.name || 'affaire') + '_' + (mode === 'attachement' ? 'attachement' : 'recolement') + '.xlsx').replace(/[^\w\-.]+/g, '_');
  a.download = fname;
  a.click();
  toast(`✅ Fichier Excel "${fname}" exporté avec succès`);
}

/* Onglet 6 : Chiffrage Après Récolement & Feuille d'Attachement */

/* Extraction automatique des câbles depuis les quantités de récolement (Attachement) */
function formatFsDateFr(d) {
  if (!d) return '';
  d = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return d;
}

function extractAttachementCables(rec) {
  const hta = [];
  const bt = [];
  const fmtLg = v => fmt(num(v), 2);

  // Projet virtuel basé sur les quantités réelles de récolement (Attachement)
  const targetP = {
    ...P,
    bord: (rec && rec.items && rec.items.length)
      ? rec.items.map(it => {
          const qVal = (it.hasQ && it.qRec !== null) ? num(it.qRec) : num(it.qEtude);
          return { ...(it.rawLine || {}), q: qVal, on: true };
        })
      : (P.bord || [])
  };

  const bordCables = getActiveBordCables(targetP);
  const mtDet = cableTypeDetails(bordCables.filter(c => c.net === 'MT'));
  const btDet = cableTypeDetails(bordCables.filter(c => c.net === 'BT'));

  // Câbles MT : format exact conforme à l'Évaluation des Travaux
  mtDet.forEach(x => {
    hta.push(`longueur de ${fmtLg(x.len)} m environ en ${x.cab}`);
  });

  // Câbles BT : format exact conforme au modèle photo
  btDet.forEach(x => {
    const kmStr = (x.len >= 1000) ? (x.len / 1000).toFixed(3).replace('.', ',') + ' km' : fmtLg(x.len) + ' m';
    bt.push(`Construction d’un réseau BTA d’environ <b>${kmStr}</b> en ${x.cab}`);
  });

  return { hta, bt };
}
function paneRecol(el) {
  if (!window._recolSubTab) window._recolSubTab = 'chiffrage';
  const subTab = window._recolSubTab;
  const i = P.info || {};
  const rec = computeRecolEval();
  const e = rec.e;

  // En-tête de navigation interne (Sous-onglets Chiffrage vs Attachement)
  const navHtml = `
    <style>
      table.table-recol-solid {
        width: 100% !important;
        border-collapse: collapse !important;
        border: 1.5px solid #000 !important;
      }
      table.table-recol-solid th,
      table.table-recol-solid td {
        border: 1px solid #000 !important;
      }
      @media print {
        .no-print, .bar, .tabs, .sub, .top, .app > .side, #navRecolBar, .status, .kpis { display: none !important; }
        body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
        .main, .pane, #pane { padding: 0 !important; margin: 0 !important; border: none !important; background: transparent !important; }
        .paper.recol-pro-paper {
          box-shadow: none !important;
          border: none !important;
          padding: 6mm 8mm !important;
          margin: 0 auto !important;
          width: 100% !important;
          max-width: 100% !important;
          font-family: Arial, sans-serif !important;
        }
        .paper.recol-pro-paper.fs-a4-frame {
          border: 1.5px solid #000 !important;
          padding: 14mm 18mm !important;
          min-height: 270mm !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
        }
        .recol-input-clean {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          text-align: right !important;
          font-weight: 700 !important;
          padding: 0 !important;
          width: auto !important;
        }
        .att-input-clean {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          text-align: right !important;
          font-weight: 800 !important;
          padding: 0 !important;
          width: auto !important;
        }
        .sig-block-pro {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    </style>
    
    <div id="navRecolBar" class="no-print" style="background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-weight:700;color:var(--brand);font-size:14px">Vue d'exécution :</span>
        <div class="sub" style="margin:0">
          <button id="btnSubChiffrage" class="${subTab === 'chiffrage' ? 'on' : ''}">📊 1. Chiffrage Après Récolement</button>
          <button id="btnSubAttachement" class="${subTab === 'attachement' ? 'on' : ''}">📑 2. Feuille d'Attachement (Sans prix)</button>
          <button id="btnSubFiche" class="${subTab === 'fiche' ? 'on' : ''}">📋 3. Fiche Suiveuse</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${subTab === 'chiffrage' ? `
          <button class="btn ok" id="btnDownloadRecolPdf" title="Télécharger directement en fichier PDF haute qualité">📄 Télécharger PDF</button>
          <button class="btn ok" id="btnRecolFillAll" title="Copier toutes les quantités de l'étude vers le récolement">📋 Remplir Récolement = Étude</button>
          <button class="btn" id="btnRecolClearAll" title="Vider toutes les quantités réalisées">🔄 Réinitialiser quantités</button>
          <button class="btn pri" id="btnExportRecolXlsx" title="Exporter le Chiffrage après récolement au format Excel">📥 Exporter Excel (.xlsx)</button>
          <button class="btn" id="btnPrintRecol" title="Imprimer le Chiffrage après récolement">🖨️ Imprimer</button>
        ` : (subTab === 'attachement' ? `
          <button class="btn ok" id="btnDownloadAttPdf" title="Télécharger directement en fichier PDF haute qualité">📄 Télécharger PDF</button>
          <button class="btn pri" id="btnExportAttXlsx" title="Exporter l'Attachement au format Excel">📥 Exporter Attachement (.xlsx)</button>
          <button class="btn" id="btnPrintAtt" title="Imprimer la Feuille d'Attachement sans prix">🖨️ Imprimer</button>
        ` : `
          <button class="btn ok" id="btnDownloadFichePdf" title="Télécharger la Fiche Suiveuse en format PDF haute qualité">📄 Télécharger PDF</button>
          <button class="btn" id="btnPrintFiche" title="Imprimer la Fiche Suiveuse">🖨️ Imprimer</button>
        `)}
      </div>
    </div>
  `;

  if (subTab === 'chiffrage') {
    // Vue 1 : Chiffrage Après Récolement (SANS traits sur Objet/Commune/Province/Demande/Contrat/Devis, SANS signature, format Pro)
    let rowsHtml = '';
    rec.items.forEach(it => {
      rowsHtml += `
        <tr>
          <td class="c" style="font-weight:700;font-size:12px;white-space:nowrap;padding:5px 6px">${esc(it.code)}</td>
          <td style="font-size:12.5px;line-height:1.35;padding:5px 6px">${esc(it.d)}</td>
          <td class="c" style="font-weight:600;font-size:11.5px;padding:5px 4px">${esc(it.c)}</td>
          <td class="c" style="font-size:11.5px;padding:5px 4px">${esc(it.u)}</td>
          <td class="n" style="font-weight:600;font-size:12px;padding:5px 6px">${fmt(it.qEtude)}</td>
          <td class="n" style="font-size:12px;padding:5px 6px">${fmt(it.pu)}</td>
          <td class="n" style="font-weight:700;font-size:12px;padding:5px 6px">${fmt(it.totEtude)}</td>
          <td class="c" style="padding:2px 4px">
            <input type="text" data-qrecol="${it.fullIdx}" class="recol-input-clean" value="${it.hasQ ? it.qRec : ''}" placeholder="—" style="width:100%;max-width:80px;text-align:right;font-weight:700;font-size:12px;padding:3px 5px;border:1px solid #cbd5e1;border-radius:3px;background:#fff;outline:none;box-sizing:border-box" title="Quantité réalisée sur le terrain">
          </td>
          <td class="n recol-tot-cell recol-tot-${it.fullIdx}" style="font-weight:700;font-size:12px;padding:5px 6px">${it.hasQ ? fmt(it.totRec) : '—'}</td>
        </tr>
      `;
    });

    let prestRowsHtml = '';
    e.pr.forEach((prItem, pIdx) => {
      const recPrItem = rec.recolPr[pIdx] || prItem;
      prestRowsHtml += `
        <tr>
          <td colspan="4" style="font-size:12px;font-weight:600;padding-left:14px;padding:5px 6px">${esc(prItem.name)}</td>
          <td class="n" style="font-size:12px;padding:5px 6px">${fmt(prItem.q)}</td>
          <td class="n" style="font-size:12px;padding:5px 6px">${fmt(prItem.pu)}</td>
          <td class="n" style="font-weight:700;font-size:12px;padding:5px 6px">${fmt(prItem.tot)}</td>
          <td class="n" style="font-size:12px;padding:5px 6px">${fmt(recPrItem.q)}</td>
          <td class="n recol-pr-cell recol-pr-${pIdx}" style="font-weight:700;font-size:12px;padding:5px 6px">${rec.hasAnyRecol ? fmt(recPrItem.tot) : (recPrItem.name === PEINES ? '—' : fmt(recPrItem.tot))}</td>
        </tr>
      `;
    });

    const ecartLabel = rec.ecartTtc < 0
      ? `<span style="color:#047857;font-weight:800">Écart en Faveur du client</span>`
      : (rec.ecartTtc > 0
        ? `<span style="color:#b91c1c;font-weight:800">Écart en Faveur de la SRM-TTA</span>`
        : `<span style="color:#475569;font-weight:700">Aucun écart (Montants identiques)</span>`);

    el.innerHTML = `
      ${navHtml}
      <div class="paper recol-pro-paper" style="max-width:1080px;margin:0 auto;box-shadow:0 4px 14px rgba(0,0,0,0.08);background:#fff;padding:22px 26px;border-radius:8px">
        
        <h2 style="text-align:center;color:#b45309;font-size:19px;font-weight:800;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px">
          CHIFFRAGE APRÈS RÉCOLEMENT
        </h2>

        <!-- Cartouche d'identification SANS AUCUN TRAIT NI BORDURE comme demandé -->
        <div style="display:flex;justify-content:space-between;gap:30px;margin-bottom:16px;font-size:13.5px;line-height:1.85;color:#000">
          <div style="flex:1">
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Objet</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.objet || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Commune</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.commune || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Province</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.province || '')}</span></div>
          </div>
          <div style="width:260px">
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Demande</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.demande || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Contrat</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.contrat || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Devis</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.devis || '')}</span></div>
          </div>
        </div>

        <!-- Tableau principal de comparaison Étude vs Récolement avec quadrillage parfait et continu -->
        <table class="table-recol-solid" style="width:100%;font-size:12px">
          <thead>
            <tr style="background:#f1f5f9;font-weight:bold;text-align:center">
              <th rowspan="2" style="width:70px;vertical-align:middle;padding:6px 4px;font-size:12px">N° DE PRIX</th>
              <th rowspan="2" style="vertical-align:middle;padding:6px 8px;white-space:nowrap;min-width:320px;font-size:12px">DESIGNATION DES FOURNITURES ET OUVRAGES</th>
              <th rowspan="2" style="width:48px;vertical-align:middle;padding:6px 3px;font-size:11.5px">CONSIS<br>TANCE</th>
              <th rowspan="2" style="width:42px;vertical-align:middle;padding:6px 3px;font-size:11.5px">UNITE</th>
              <th colspan="3" style="text-align:center;padding:5px 6px;font-size:12px">Etude</th>
              <th colspan="2" style="text-align:center;padding:5px 6px;font-size:12px">Recolement</th>
            </tr>
            <tr style="background:#f1f5f9;font-weight:bold;text-align:center">
              <th style="width:68px;padding:5px 3px;font-size:11.5px">QUANTITE</th>
              <th style="width:78px;padding:5px 3px;font-size:11.5px">PRIX UNITAIRES<br>(HT)</th>
              <th style="width:88px;padding:5px 3px;font-size:11.5px">PRIX TOTAUX (HT)</th>
              <th style="width:78px;padding:5px 3px;font-size:11.5px">QUANTITE REALISE</th>
              <th style="width:88px;padding:5px 3px;font-size:11.5px">PRIX TOTAUX (HT)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <!-- Totaux Travaux HT, TVA, TTC -->
            <tr style="background:#f8fafc">
              <td colspan="4" style="text-align:right;font-weight:800;padding:6px 8px;font-size:12px">TOTAL</td>
              <td colspan="2"></td>
              <td class="n" style="font-weight:800;padding:6px 8px;font-size:12px">${fmt(e.b.ht)}</td>
              <td></td>
              <td class="n" id="recolTravHt" style="font-weight:800;padding:6px 8px;font-size:12px">${rec.hasAnyRecol ? fmt(rec.sumRecolHt) : '—'}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td colspan="4" style="text-align:right;font-weight:700;padding:5px 8px;font-size:12px">TVA 20%</td>
              <td colspan="2"></td>
              <td class="n" style="font-weight:700;padding:5px 8px;font-size:12px">${fmt(e.worksTva)}</td>
              <td></td>
              <td class="n" id="recolWorksTva" style="font-weight:700;padding:5px 8px;font-size:12px">${rec.hasAnyRecol ? fmt(rec.recolWorksTva) : '—'}</td>
            </tr>
            <tr style="background:#f1f5f9">
              <td colspan="4" style="text-align:right;font-weight:800;color:var(--brand);padding:6px 8px;font-size:12.5px">TOTA (G)</td>
              <td colspan="2"></td>
              <td class="n" style="font-weight:800;color:var(--brand);padding:6px 8px;font-size:12.5px">${fmt(e.worksTtc)} DH</td>
              <td></td>
              <td class="n" id="recolWorksTtc" style="font-weight:800;color:var(--brand);padding:6px 8px;font-size:12.5px">${(rec.hasAnyRecol ? fmt(rec.recolWorksTtc) : '0,00')} DH</td>
            </tr>

            <!-- Section PRESTATIONS SRM-TTA -->
            <tr style="background:#e0f2fe;font-weight:800">
              <td colspan="9" style="padding:7px 10px;text-transform:uppercase;color:#0369a1;font-size:12px">
                PRESTATIONS SRM-TTA (T-PRESTATIONS)
              </td>
            </tr>
            ${prestRowsHtml}
            <tr style="background:#f8fafc">
              <td colspan="4" style="text-align:right;font-weight:800;padding:5px 8px;font-size:12px">TOTAL HTVA</td>
              <td colspan="2"></td>
              <td class="n" style="font-weight:800;padding:5px 8px;font-size:12px">${fmt(e.pht)}</td>
              <td></td>
              <td class="n" id="recolPht" style="font-weight:800;padding:5px 8px;font-size:12px">${fmt(rec.recolPht)}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td colspan="4" style="text-align:right;font-weight:800;padding:5px 8px;font-size:12px">TOTAL TTC</td>
              <td colspan="2"></td>
              <td class="n" style="font-weight:800;padding:5px 8px;font-size:12px">${fmt(e.pttc)}</td>
              <td></td>
              <td class="n" id="recolPttc" style="font-weight:800;padding:5px 8px;font-size:12px">${fmt(rec.recolPttc)}</td>
            </tr>

            <!-- TOTAUX FINAUX -->
            <tr style="background:#e2e8f0;font-weight:800">
              <td colspan="4" style="font-size:12.5px;text-transform:uppercase;padding:7px 8px">TOTAL PRESTATIONS SRM-TTA T.T.C</td>
              <td colspan="2"></td>
              <td class="n" style="font-size:12.5px;padding:7px 8px">${fmt(e.pttc)} DH</td>
              <td></td>
              <td class="n" id="recolPrestTtc" style="font-size:12.5px;padding:7px 8px">${fmt(rec.recolPttc)} DH</td>
            </tr>
            <tr style="background:#cbd5e1;font-weight:900">
              <td colspan="4" style="font-size:13px;text-transform:uppercase;color:#0f172a;padding:8px 8px">TOTAL GENERAL T.T.C</td>
              <td colspan="2"></td>
              <td class="n" style="font-size:13px;color:#0f172a;padding:8px 8px">${fmt(e.total)} DH</td>
              <td></td>
              <td class="n" id="recolTotGen" style="font-size:13px;color:#0f172a;padding:8px 8px">${fmt(rec.recolTotal)} DH</td>
            </tr>
          </tbody>
        </table>

        <!-- Résumé de l'écart (PAS DE TABLEAU DE SIGNATURE) -->
        <div style="margin-top:14px;display:flex;justify-content:flex-end">
          <div id="recolEcartBox" style="border:1.5px solid #000;border-radius:6px;padding:12px 18px;min-width:300px;text-align:right;background:#fff">
            <div style="font-size:11.5px;font-weight:700;color:#475569">DIFFÉRENCE RÉCOLEMENT - ÉTUDE :</div>
            <div id="recolDiffTtc" style="font-size:17px;font-weight:900;color:${rec.ecartTtc < 0 ? '#059669' : (rec.ecartTtc > 0 ? '#dc2626' : '#1e293b')};margin:3px 0">
              ${rec.ecartTtc > 0 ? '+' : ''}${fmt(rec.ecartTtc)} DH
            </div>
            <div id="recolEcartLabel" style="font-size:12.5px">
              ${ecartLabel}
            </div>
          </div>
        </div>

      </div>
    `;

    // Fonction de mise à jour fluide en direct (sans détruire le DOM ni perdre le curseur)
    function updateRecolLive() {
      const liveRec = computeRecolEval();

      liveRec.items.forEach(it => {
        const cell = el.querySelector(`.recol-tot-${it.fullIdx}`);
        if (cell) cell.textContent = it.hasQ ? fmt(it.totRec) : '—';
      });

      const elSumHt = el.querySelector('#recolTravHt');
      if (elSumHt) elSumHt.textContent = liveRec.hasAnyRecol ? fmt(liveRec.sumRecolHt) : '—';

      const elWorksTva = el.querySelector('#recolWorksTva');
      if (elWorksTva) elWorksTva.textContent = liveRec.hasAnyRecol ? fmt(liveRec.recolWorksTva) : '—';

      const elWorksTtc = el.querySelector('#recolWorksTtc');
      if (elWorksTtc) elWorksTtc.textContent = (liveRec.hasAnyRecol ? fmt(liveRec.recolWorksTtc) : '0,00') + ' DH';

      liveRec.recolPr.forEach((pr, pIdx) => {
        const prCell = el.querySelector(`.recol-pr-${pIdx}`);
        if (prCell) prCell.textContent = liveRec.hasAnyRecol ? fmt(pr.tot) : (pr.name === PEINES ? '—' : fmt(pr.tot));
      });

      const elPht = el.querySelector('#recolPht');
      if (elPht) elPht.textContent = fmt(liveRec.recolPht);

      const elPttc = el.querySelector('#recolPttc');
      if (elPttc) elPttc.textContent = fmt(liveRec.recolPttc);

      const elPrestTtc = el.querySelector('#recolPrestTtc');
      if (elPrestTtc) elPrestTtc.textContent = fmt(liveRec.recolPttc) + ' DH';

      const elTotGen = el.querySelector('#recolTotGen');
      if (elTotGen) elTotGen.textContent = fmt(liveRec.recolTotal) + ' DH';

      const elDiff = el.querySelector('#recolDiffTtc');
      if (elDiff) {
        elDiff.textContent = (liveRec.ecartTtc > 0 ? '+' : '') + fmt(liveRec.ecartTtc) + ' DH';
        elDiff.style.color = liveRec.ecartTtc < 0 ? '#059669' : (liveRec.ecartTtc > 0 ? '#dc2626' : '#1e293b');
      }

      const box = el.querySelector('#recolEcartBox');
      if (box) {
        box.style.borderColor = liveRec.ecartTtc < 0 ? '#059669' : (liveRec.ecartTtc > 0 ? '#dc2626' : '#64748b');
      }

      const lbl = el.querySelector('#recolEcartLabel');
      if (lbl) {
        lbl.innerHTML = liveRec.ecartTtc < 0
          ? `<span style="color:#047857;font-weight:800">Écart en Faveur du client</span>`
          : (liveRec.ecartTtc > 0
            ? `<span style="color:#b91c1c;font-weight:800">Écart en Faveur de la SRM-TTA</span>`
            : `<span style="color:#475569;font-weight:700">Aucun écart (Montants identiques)</span>`);
      }
    }

    // Événements de saisie fluide : oninput met à jour les totaux en direct SANS perte de focus
    el.querySelectorAll('[data-qrecol]').forEach(inp => {
      inp.oninput = () => {
        const idx = parseInt(inp.dataset.qrecol, 10);
        if (P.bord[idx]) {
          P.bord[idx].qRecol = inp.value;
          touch();
          updKpi();
          updateRecolLive();
        }
      };
      inp.onchange = () => {
        saveStorage();
      };
    });

    const dlPdfBtn = el.querySelector('#btnDownloadRecolPdf');
    if (dlPdfBtn) dlPdfBtn.onclick = () => downloadRecolPdf('chiffrage');

    const fillBtn = el.querySelector('#btnRecolFillAll');
    if (fillBtn) {
      fillBtn.onclick = () => {
        (P.bord || []).forEach(l => {
          if (l && l.on !== false) l.qRecol = String(l.q || 0);
        });
        touch();
        saveStorage();
        updKpi();
        paneRecol(el);
        toast('✅ Quantités de l’étude recopiées vers le récolement');
      };
    }

    const clearBtn = el.querySelector('#btnRecolClearAll');
    if (clearBtn) {
      clearBtn.onclick = () => {
        (P.bord || []).forEach(l => {
          if (l) l.qRecol = '';
        });
        touch();
        saveStorage();
        updKpi();
        paneRecol(el);
        toast('🔄 Quantités de récolement réinitialisées');
      };
    }

    const expBtn = el.querySelector('#btnExportRecolXlsx');
    if (expBtn) expBtn.onclick = () => exportRecolXlsx('chiffrage');

    const prtBtn = el.querySelector('#btnPrintRecol');
    if (prtBtn) prtBtn.onclick = () => window.print();

  } else if (subTab === 'attachement') {
    // Vue 2 : Feuille d'Attachement (SANS phrase entre parenthèses, SANS traits sur le cartouche, 3 Signatures : L'Entreprise Réalisatrice / Conducteur de travaux / SRM-TTA / Client)
    const attNum = (P.info && P.info.attNum) ? P.info.attNum : '1';
    let rowsHtml = '';
    rec.items.forEach(it => {
      const qVal = it.hasQ ? it.qRec : it.qEtude;
      rowsHtml += `
        <tr>
          <td class="c" style="font-weight:700;font-size:13px;white-space:nowrap;padding:8px 6px">${esc(it.code)}</td>
          <td style="font-size:13px;line-height:1.4;padding:8px 10px">${esc(it.d)}</td>
          <td class="c" style="font-weight:700;font-size:12.5px;padding:8px 6px">${esc(it.c)}</td>
          <td class="c" style="font-weight:600;font-size:12.5px;padding:8px 6px">${esc(it.u)}</td>
          <td class="c" style="padding:4px 6px">
            <input type="text" data-attq="${it.fullIdx}" class="att-input-clean" value="${qVal}" style="width:100%;max-width:90px;text-align:right;font-weight:800;font-size:13px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:3px;background:#f8fafc;box-sizing:border-box" title="Quantité réalisée">
          </td>
        </tr>
      `;
    });

    el.innerHTML = `
      ${navHtml}
      <div class="paper recol-pro-paper" style="max-width:980px;margin:0 auto;box-shadow:0 4px 14px rgba(0,0,0,0.08);background:#fff;padding:22px 28px;border-radius:8px">
        
        <!-- En-tête standardisé SRM-TTA avec Logo et Titre SANS la phrase entre parenthèses demandée -->
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px">
          <div>
            ${typeof LOGO !== 'undefined' && LOGO ? `<img src="${LOGO}" style="height:55px;object-fit:contain" alt="SRM-TTA">` : `<div style="font-weight:900;font-size:20px;color:var(--brand)">SRM-TTA</div>`}
            <div style="font-size:11px;color:var(--muted);font-weight:700;margin-top:2px">Société Régionale Multiservices Tanger-Tétouan-Al Hoceima</div>
          </div>
          <div style="text-align:right">
            <h2 style="font-size:18px;font-weight:900;color:#0f172a;margin:0;text-transform:uppercase">
              ATTACHEMENT DES TRAVAUX N° <span id="dispAttNum">${esc(attNum)}</span>
            </h2>
          </div>
        </div>

        <!-- Paramètres et identification du projet SANS AUCUN TRAIT NI BORDURE -->
        <div style="display:flex;justify-content:space-between;gap:30px;margin-bottom:16px;font-size:13.5px;line-height:1.85;color:#000">
          <div style="flex:1">
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Objet</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.objet || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Commune</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.commune || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Province</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.province || '')}</span></div>
          </div>
          <div style="width:260px">
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Demande</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.demande || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Contrat</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.contrat || '')}</span></div>
            <div style="display:flex;margin-bottom:2px"><span style="width:95px;font-weight:800">Devis</span><span style="width:14px">:</span><span style="font-weight:700">${esc(i.devis || '')}</span></div>
          </div>
        </div>

        <!-- Barre de saisie interne Attachement (masquée à l'impression) -->
        <div class="no-print" style="margin-bottom:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0">
          <div style="display:flex;align-items:center;gap:6px">
            <b>Attachement N° :</b>
            <select id="selAttNum" style="padding:3px 8px;font-weight:700;border:1px solid var(--line2);border-radius:4px">
              <option value="1" ${attNum === '1' ? 'selected' : ''}>1</option>
              <option value="2" ${attNum === '2' ? 'selected' : ''}>2</option>
              <option value="3" ${attNum === '3' ? 'selected' : ''}>3</option>
              <option value="Définitif" ${attNum === 'Définitif' ? 'selected' : ''}>Définitif</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <b>Date :</b>
            <input type="date" id="inpAttDate" value="${esc(i.attDate || i.date || '')}" style="padding:3px 6px;border:1px solid var(--line2);border-radius:4px">
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex:1">
            <b>Entreprise :</b>
            <input type="text" id="inpAttEntreprise" value="${esc(i.attEntreprise || i.entreprise || '')}" placeholder="Nom de l'entreprise réalisatrice" style="padding:3px 8px;border:1px solid var(--line2);border-radius:4px;flex:1">
          </div>
        </div>

        <!-- Tableau d'Attachement SANS PRIX avec quadrillage plein et parfait -->
        <table class="table-recol-solid" style="width:100%;font-size:13px">
          <thead>
            <tr style="background:#f1f5f9;font-weight:bold;text-align:center">
              <th style="width:85px;padding:9px 6px;font-size:13px">N° DE PRIX</th>
              <th style="padding:9px 10px;white-space:nowrap;min-width:320px;font-size:13px">DESIGNATION DES FOURNITURES ET OUVRAGES</th>
              <th style="width:65px;padding:9px 6px;font-size:12.5px">CONSIS TANCE</th>
              <th style="width:55px;padding:9px 6px;font-size:12.5px">UNITE</th>
              <th style="width:95px;padding:9px 6px;font-size:13px">QUANTITE</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Blocs de signatures officiels à 3 intervenants : L'Entreprise Réalisatrice / Conducteur de travaux / SRM-TTA / Client -->
        <div class="sig-block-pro" style="margin-top:36px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;page-break-inside:avoid">
          <div style="border:1.5px solid #000;border-radius:4px;padding:12px;text-align:center;min-height:120px;display:flex;flex-direction:column;justify-content:flex-start;background:#fff">
            <div style="font-weight:800;font-size:13.5px;color:#000">L'Entreprise Réalisatrice</div>
          </div>
          <div style="border:1.5px solid #000;border-radius:4px;padding:12px;text-align:center;min-height:120px;display:flex;flex-direction:column;justify-content:flex-start;background:#fff">
            <div style="font-weight:800;font-size:13.5px;color:#000">Conducteur de travaux / SRM-TTA</div>
          </div>
          <div style="border:1.5px solid #000;border-radius:4px;padding:12px;text-align:center;min-height:120px;display:flex;flex-direction:column;justify-content:flex-start;background:#fff">
            <div style="font-weight:800;font-size:13.5px;color:#000">Client</div>
          </div>
        </div>

      </div>
    `;

    // Événements de la vue Attachement (saisie fluide sans perte de curseur)
    const dlAttPdfBtn = el.querySelector('#btnDownloadAttPdf');
    if (dlAttPdfBtn) dlAttPdfBtn.onclick = () => downloadRecolPdf('attachement');

    const selAtt = el.querySelector('#selAttNum');
    if (selAtt) {
      selAtt.onchange = () => {
        P.info.attNum = selAtt.value;
        const disp = el.querySelector('#dispAttNum');
        if (disp) disp.textContent = selAtt.value;
        touch();
        saveStorage();
      };
    }

    const inpDate = el.querySelector('#inpAttDate');
    if (inpDate) {
      inpDate.onchange = () => {
        P.info.attDate = inpDate.value;
        touch();
        saveStorage();
      };
    }

    const inpEnt = el.querySelector('#inpAttEntreprise');
    if (inpEnt) {
      inpEnt.oninput = () => {
        P.info.attEntreprise = inpEnt.value;
        touch();
      };
      inpEnt.onchange = () => {
        saveStorage();
      };
    }

    el.querySelectorAll('[data-attq]').forEach(inp => {
      inp.oninput = () => {
        const idx = parseInt(inp.dataset.attq, 10);
        if (P.bord[idx]) {
          P.bord[idx].qRecol = inp.value;
          touch();
          updKpi();
        }
      };
      inp.onchange = () => {
        saveStorage();
      };
    });

    const expBtn = el.querySelector('#btnExportAttXlsx');
    if (expBtn) expBtn.onclick = () => exportRecolXlsx('attachement');

    const prtBtn = el.querySelector('#btnPrintAtt');
    if (prtBtn) prtBtn.onclick = () => window.print();
  } else if (subTab === 'fiche') {
    // Vue 3 : Fiche suiveuse de demande de travaux
    P.info.ficheSuiveuse = P.info.ficheSuiveuse || {};
    const fs = P.info.ficheSuiveuse;

    // Extraction automatique des câbles depuis l'attachement (format exact Évaluation des Travaux)
    const extCables = extractAttachementCables(rec);
    const hasAnyHta = extCables.hta && extCables.hta.length > 0;
    const hasAnyBt = extCables.bt && extCables.bt.length > 0;

    // Détermination intelligente de la nature de l'affaire (BT, MT, MT/BT)
    if (!fs.affaireType || !fs._userManualAffaire) {
      if (hasAnyBt && !hasAnyHta) {
        fs.affaireType = 'bt';
      } else if (hasAnyHta && !hasAnyBt) {
        fs.affaireType = 'mt';
      } else if (hasAnyHta && hasAnyBt) {
        fs.affaireType = 'mt_bt';
      } else {
        const nat = (P.info.nature || '').toLowerCase();
        const struct = (P.info.structure || '').toLowerCase();
        const obj = (P.info.objet || '').toLowerCase();
        const allText = `${nat} ${struct} ${obj}`;
        if (/\bbt\b|basse tension/i.test(allText) && !/\b(mt|hta|haute tension|poste)\b/i.test(allText)) fs.affaireType = 'bt';
        else if (/\b(mt|hta|haute tension)\b/i.test(allText) && !/\b(bt|basse tension)\b/i.test(allText)) fs.affaireType = 'mt';
        else fs.affaireType = 'mt_bt';
      }
    }

    // Référence (Marché, Devis, Ordre)
    if (!fs.refType) {
      if (P.info.contrat || P.info.marche) fs.refType = 'marche';
      else if (P.info.devis) fs.refType = 'devis';
      else fs.refType = 'devis';
    }
    if (fs.refNum === undefined || fs.refNum === '') {
      fs.refNum = (fs.refType === 'marche') ? (P.info.contrat || P.info.marche || '') : (P.info.devis || P.info.demande || '');
    }

    if (!fs.num) fs.num = P.info.num || '20/2026';
    const provUpper = (P.info.province || 'Ouazzane').toUpperCase();
    if (!fs.demandeur) {
      fs.demandeur = `Service Etudes Et Travaux / DP SRM ${provUpper}`;
    }
    if (!fs.executant) {
      fs.executant = `SED / DP SRM ${provUpper}`;
    }
    if (!fs.intitule) {
      fs.intitule = `Visite montée, réception et mise sous tension ${P.info.objet || ''}`;
    }

    // Extraction automatique des câbles depuis l'attachement (format exact Évaluation des Travaux)
    if (fs.htaLines === undefined || fs.btLines === undefined || fs._lastAutoSync !== 'v2') {
      const ext = extractAttachementCables(rec);
      fs.htaLines = ext.hta.length ? ext.hta : ['.............................................................................................................'];
      fs.btLines = ext.bt.length ? ext.bt : ['.............................................................................................................'];
      fs._lastAutoSync = 'v2';
    }

    // Poste TYPE (Si étude BT, Poste TYPE = Aucun par défaut)
    if (!fs.posteType || (!fs._userManualPoste && fs.affaireType === 'bt')) {
      if (fs.affaireType === 'bt') {
        fs.posteType = 'Aucun';
      } else {
        const obj = (P.info.objet || '').toLowerCase();
        if (obj.includes('livraison')) fs.posteType = 'Livraison';
        else if (obj.includes('cabine') || obj.includes('au sol') || obj.includes('type bas')) fs.posteType = 'Type Bas';
        else fs.posteType = 'H61';
      }
    }

    if (fs.transfoCount === undefined) fs.transfoCount = 2;
    if (!fs.puissance) {
      fs.puissance = P.info.puissance ? `${P.info.puissance}KVA` : (fs.posteType === 'Livraison' ? '2500KVA' : (fs.posteType === 'Type Bas' ? '160KVA' : (fs.posteType === 'H61' ? '50KVA' : '')));
    }
    if (!fs.faitLe) fs.faitLe = formatFsDateFr(P.info.attDate || P.info.date || new Date().toLocaleDateString('fr-FR'));
    if (!fs.mlle) {
      fs.mlle = (fs.posteType === 'H61') ? 'N3F-402-25D -' : ((fs.posteType === 'Livraison') ? 'N3F-400-25C-' : 'N3F-400-25B -');
    }

    el.innerHTML = `
      ${navHtml}
      
      <!-- Barre de configuration Fiche Suiveuse (masquée à l'impression) -->
      <div class="no-print" style="max-width:880px;margin:0 auto 16px;background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #cbd5e1;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <b>Nature de l'Affaire :</b>
            <select id="selFsAffaire" style="padding:4px 8px;font-weight:700;border:1px solid #94a3b8;border-radius:4px">
              <option value="mt_bt" ${fs.affaireType === 'mt_bt' ? 'selected' : ''}>Affaire MT / BT</option>
              <option value="mt" ${fs.affaireType === 'mt' ? 'selected' : ''}>Affaire MT seule</option>
              <option value="bt" ${fs.affaireType === 'bt' ? 'selected' : ''}>Affaire BT seule</option>
            </select>
          </div>
          
          <div style="display:flex;align-items:center;gap:8px">
            <b>Référence :</b>
            <select id="selFsRefType" style="padding:4px 8px;font-weight:700;border:1px solid #94a3b8;border-radius:4px">
              <option value="marche" ${fs.refType === 'marche' ? 'selected' : ''}>Marché</option>
              <option value="devis" ${fs.refType === 'devis' ? 'selected' : ''}>Devis</option>
              <option value="ordre" ${fs.refType === 'ordre' ? 'selected' : ''}>Ordre</option>
            </select>
            <input type="text" id="inpFsRefNum" value="${esc(fs.refNum || '')}" placeholder="Numéro..." style="padding:4px 8px;font-weight:700;width:140px;border:1px solid #94a3b8;border-radius:4px">
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <b>N° Fiche :</b>
            <input type="text" id="inpFsNum" value="${esc(fs.num || '20/2026')}" style="padding:4px 8px;font-weight:700;width:90px;border:1px solid #94a3b8;border-radius:4px">
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <b>Fait le :</b>
            <input type="text" id="inpFsFaitLe" value="${esc(fs.faitLe || '')}" style="padding:4px 8px;font-weight:700;width:105px;border:1px solid #94a3b8;border-radius:4px">
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-top:1px dashed #cbd5e1;padding-top:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <b>Poste TYPE :</b>
            <select id="selFsPosteType" style="padding:4px 8px;font-weight:700;border:1px solid #94a3b8;border-radius:4px">
              <option value="H61" ${fs.posteType === 'H61' ? 'selected' : ''}>H61 (Poteau béton)</option>
              <option value="Type Bas" ${fs.posteType === 'Type Bas' ? 'selected' : ''}>Type Bas (Cabine au sol)</option>
              <option value="Livraison" ${fs.posteType === 'Livraison' ? 'selected' : ''}>Livraison (Poste client)</option>
              <option value="Aucun" ${fs.posteType === 'Aucun' ? 'selected' : ''}>Aucun (BT pure)</option>
            </select>
          </div>

          ${fs.posteType === 'Livraison' ? `
            <div style="display:flex;align-items:center;gap:8px">
              <b>Transformateurs :</b>
              <select id="selFsTransfoCount" style="padding:4px 8px;font-weight:700;border:1px solid #94a3b8;border-radius:4px">
                <option value="2" ${fs.transfoCount == 2 ? 'selected' : ''}>2 Transfos (TR1 + TR2)</option>
                <option value="1" ${fs.transfoCount == 1 ? 'selected' : ''}>1 Transfo (TR)</option>
              </select>
            </div>
          ` : ''}

          ${fs.posteType === 'Type Bas' ? `
            <div style="display:flex;align-items:center;gap:8px">
              <b>Départs BT :</b>
              <select id="selFsDepartBt" style="padding:4px 8px;font-weight:700;border:1px solid #94a3b8;border-radius:4px">
                <option value="4 départs" ${fs.departBt === '4 départs' ? 'selected' : ''}>4 départs</option>
                <option value="8 départs" ${fs.departBt === '8 départs' ? 'selected' : ''}>8 départs</option>
              </select>
            </div>
          ` : ''}

          <div style="display:flex;align-items:center;gap:8px">
            <b>Puissance :</b>
            <input type="text" id="inpFsPuissance" value="${esc(fs.puissance || '')}" placeholder="Ex: 50KVA, 160KVA..." style="padding:4px 8px;font-weight:700;width:110px;border:1px solid #94a3b8;border-radius:4px">
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <b>Matricule (Mlle) :</b>
            <input type="text" id="inpFsMlle" value="${esc(fs.mlle || '')}" placeholder="Ex: N3F-402-25D -" style="padding:4px 8px;font-weight:700;width:130px;border:1px solid #94a3b8;border-radius:4px">
          </div>

          <div>
            <button class="btn ok" id="btnRefreshCablesFromAtt" title="Ré-extraire automatiquement les longueurs de câbles depuis les quantités de récolement">🔄 Actualiser câbles depuis Attachement</button>
          </div>
        </div>

        <details style="font-size:11.5px;color:#475569">
          <summary style="cursor:pointer;font-weight:700;color:var(--brand)">⚙️ Personnaliser les libellés, plaques et cellules...</summary>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
            <div>
              <b>Demandeur :</b>
              <input type="text" id="inpFsDemandeur" value="${esc(fs.demandeur)}" style="width:100%;padding:4px 6px;margin-top:2px">
            </div>
            <div>
              <b>Exécutant :</b>
              <input type="text" id="inpFsExecutant" value="${esc(fs.executant)}" style="width:100%;padding:4px 6px;margin-top:2px">
            </div>
            <div style="grid-column:1/-1">
              <b>Intitulé de l'ouvrage :</b>
              <input type="text" id="inpFsIntitule" value="${esc(fs.intitule)}" style="width:100%;padding:4px 6px;margin-top:2px">
            </div>
            <div>
              <b>Lignes Réseau HTA (une par ligne) :</b>
              <textarea id="txtFsHta" rows="3" style="width:100%;padding:4px 6px;font-size:11px">${esc((fs.htaLines || []).join('\n'))}</textarea>
            </div>
            <div>
              <b>Lignes Réseau BT (une par ligne / villages) :</b>
              <textarea id="txtFsBt" rows="3" style="width:100%;padding:4px 6px;font-size:11px">${esc((fs.btLines || []).join('\n'))}</textarea>
            </div>

            ${fs.posteType === 'H61' ? `
              <div>
                <b>Plaque IRD IACM :</b>
                <input type="text" id="inpFsPlaqueIrd" value="${esc(fs.plaqueIrd || 'J1V2K3')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Plaque Transformateur :</b>
                <input type="text" id="inpFsPlaqueTransfo" value="${esc(fs.plaqueTransfo || 'J1V2K4')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Plaque Disjoncteur :</b>
                <input type="text" id="inpFsPlaqueDisj" value="${esc(fs.plaqueDisj || 'J1V2K5')}" style="width:100%;padding:4px 6px">
              </div>
            ` : ''}

            ${fs.posteType === 'Type Bas' ? `
              <div>
                <b>Cellule Arrivée :</b>
                <input type="text" id="inpFsCellArrivee" value="${esc(fs.cellArrivee || 'J1V2H1')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Cellule Départ :</b>
                <input type="text" id="inpFsCellDepart" value="${esc(fs.cellDepart || 'J1V2H2')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Cellule Protection :</b>
                <input type="text" id="inpFsCellProtect" value="${esc(fs.cellProtect || 'J1V2H3')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Transformateur :</b>
                <input type="text" id="inpFsTransfo" value="${esc(fs.transfo || 'J1V2H4')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Disj TG BT :</b>
                <input type="text" id="inpFsDisjTgbt" value="${esc(fs.disjTgbt || 'J1V2H5')}" style="width:100%;padding:4px 6px">
              </div>
            ` : ''}

            ${fs.posteType === 'Livraison' ? `
              <div>
                <b>Cellule Arrivée :</b>
                <input type="text" id="inpFsCellArrivee" value="${esc(fs.cellArrivee || 'J1V2H7')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Cellule Réserve :</b>
                <input type="text" id="inpFsCellReserve" value="${esc(fs.cellReserve || 'J1V2H8')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Cellule Comptage :</b>
                <input type="text" id="inpFsCellComptage" value="${esc(fs.cellComptage || 'J1V2H9')}" style="width:100%;padding:4px 6px">
              </div>
              <div>
                <b>Cellule Protection Générale :</b>
                <input type="text" id="inpFsCellProtectGen" value="${esc(fs.cellProtectGen || 'J1V2J1')}" style="width:100%;padding:4px 6px">
              </div>
              ${fs.transfoCount == 1 ? `
                <div>
                  <b>Cellule Protection TR :</b>
                  <input type="text" id="inpFsCellProtectTr" value="${esc(fs.cellProtectTr || 'J1V2J2')}" style="width:100%;padding:4px 6px">
                </div>
                <div>
                  <b>Transformateur :</b>
                  <input type="text" id="inpFsTransfo" value="${esc(fs.transfo || 'J1V2J4')}" style="width:100%;padding:4px 6px">
                </div>
              ` : `
                <div>
                  <b>Cellule Protection TR1 :</b>
                  <input type="text" id="inpFsCellProtectTr1" value="${esc(fs.cellProtectTr1 || 'J1V2J2')}" style="width:100%;padding:4px 6px">
                </div>
                <div>
                  <b>Cellule Protection TR2 :</b>
                  <input type="text" id="inpFsCellProtectTr2" value="${esc(fs.cellProtectTr2 || 'J1V2J3')}" style="width:100%;padding:4px 6px">
                </div>
                <div>
                  <b>Transformateur N° 1 :</b>
                  <input type="text" id="inpFsTransfo1" value="${esc(fs.transfo1 || 'J1V2J4')}" style="width:100%;padding:4px 6px">
                </div>
                <div>
                  <b>Transformateur N° 2 :</b>
                  <input type="text" id="inpFsTransfo2" value="${esc(fs.transfo2 || 'J1V2J5')}" style="width:100%;padding:4px 6px">
                </div>
              `}
              <div style="grid-column:1/-1">
                <b>IACM (codes séparés par /) :</b>
                <input type="text" id="inpFsIacm" value="${esc(fs.iacmText || 'J1V2J6 / J1V2J7 / J1V2J8')}" style="width:100%;padding:4px 6px">
              </div>
            ` : ''}
          </div>
        </details>
      </div>

      <!-- FEUILLE IMPRIMABLE FICHE SUIVEUSE (100% CONFORME AU MODELE WORD A4 ORIGINAL) -->
      <div class="paper recol-pro-paper fs-a4-frame" style="width:210mm;max-width:210mm;height:297mm;min-height:297mm;margin:0 auto;box-shadow:0 4px 14px rgba(0,0,0,0.1);background:#fff;padding:15mm 18mm;border:none;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;color:#000">

        <!-- PARTIE HAUTE DU DOCUMENT -->
        <div>

          <!-- En-tête SRM-TTA + N° d'affaire centré -->
          <div style="position:relative;margin-bottom:12px;min-height:70px">
            <div style="position:absolute;left:0;top:0">
              ${typeof LOGO !== 'undefined' && LOGO 
                ? `<img src="${LOGO}" alt="SRM-TTA" style="width:48mm;max-width:48mm;height:auto;object-fit:contain;opacity:0.75;display:block">` 
                : `<div style="font-weight:900;font-size:24px;color:var(--brand);opacity:0.75">SRM-TTA</div>`}
            </div>
            <div style="text-align:center;padding-top:28px">
              <div style="font-family:Arial,sans-serif;font-size:13pt;font-weight:bold;color:#000">
                N : <span id="dispFsNum">${esc(fs.num || 'SET/DPO/112/2026')}</span>
              </div>
            </div>
          </div>

          <!-- Titre principal centré -->
          <div style="text-align:center;font-family:Arial,sans-serif;font-size:12pt;font-weight:bold;color:#000;margin:18px 0 25px 0">
            Fiche suiveuse de demande de travaux
          </div>

          <!-- Bloc Informations Administratives (Labels Sans-Serif bold 11pt, Valeurs Demandeur/Executant 12pt bold majuscules, Descriptif Times New Roman 11pt) -->
          <div style="margin-bottom:22px;line-height:1.6;color:#000">
            <div style="display:flex;align-items:baseline;margin-bottom:3px">
              <span style="display:inline-block;width:190px;flex-shrink:0;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Etablissement Demandeur :</span>
              <span id="dispFsDemandeur" style="font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:bold;text-transform:uppercase">${esc(fs.demandeur)}</span>
            </div>
            <div style="display:flex;align-items:baseline;margin-bottom:3px">
              <span style="display:inline-block;width:190px;flex-shrink:0;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Etablissement Exécutant :</span>
              <span id="dispFsExecutant" style="font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:bold;text-transform:uppercase">${esc(fs.executant)}</span>
            </div>
            <div style="display:flex;align-items:baseline;margin-bottom:3px">
              <span style="display:inline-block;width:190px;flex-shrink:0;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Intitulé de l'ouvrage &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
              <span id="dispFsIntitule" style="font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:normal">${esc(fs.intitule)}</span>
            </div>
            <div style="display:flex;align-items:baseline;margin-top:16px">
              <span style="display:inline-block;width:190px;flex-shrink:0;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold" id="dispFsRefLabel">${fs.refType === 'marche' ? 'Marche' : (fs.refType === 'ordre' ? 'Ordre' : 'Devis')} :</span>
              <span id="dispFsRefNum" style="font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:normal">${esc(fs.refNum || '—')}</span>
            </div>
          </div>

          <!-- Titre Infrastructures à réceptionner -->
          <div style="text-align:center;font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:bold;margin:22px 0;color:#000">
            Infrastructures à réceptionner
          </div>

          <!-- Section Réseau HTA -->
          <div style="margin-bottom:20px;line-height:1.5;color:#000">
            <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Réseau HTA :</div>
            ${(fs.affaireType !== 'bt' && fs.htaLines && fs.htaLines.length && !fs.htaLines[0].startsWith('...')) 
              ? fs.htaLines.map(l => `<div style="margin-left:18px;font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:normal">- ${l.includes('<b>') || l.includes('<strong>') ? l : esc(l)}</div>`).join('') 
              : `<div style="margin-left:18px;display:flex;align-items:flex-end;height:18px"><span style="margin-right:6px;font-family:'Times New Roman',Times,serif;font-size:11pt">-</span><div style="border-bottom:1px dotted #000;width:100%;height:14px"></div></div>`}
          </div>

          <!-- Section Réseau BT -->
          <div style="margin-bottom:20px;line-height:1.5;color:#000">
            <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Réseau BT :</div>
            ${(fs.affaireType !== 'mt' && fs.btLines && fs.btLines.length && !fs.btLines[0].startsWith('...')) 
              ? fs.btLines.map(l => `<div style="margin-left:18px;font-family:'Times New Roman',Times,serif;font-size:11pt;font-weight:normal">- ${l.includes('<b>') || l.includes('<strong>') ? l : esc(l)}</div>`).join('') 
              : `<div style="margin-left:18px;display:flex;align-items:flex-end;height:18px"><span style="margin-right:6px;font-family:'Times New Roman',Times,serif;font-size:11pt">-</span><div style="border-bottom:1px dotted #000;width:100%;height:14px"></div></div>`}
          </div>

          <!-- Section Poste TYPE & Puissance -->
          ${(fs.affaireType === 'bt' || fs.posteType === 'Aucun') ? `
            <div style="margin-bottom:20px;line-height:1.5;color:#000">
              <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Poste TYPE :</div>
              <div style="height:20px"></div>
              <div><span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Puissance :</span></div>
            </div>
          ` : (
            fs.posteType === 'H61' ? `
              <div style="margin-bottom:20px;line-height:1.5;color:#000">
                <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Poste TYPE : H61</div>
                <div style="margin-top:4px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-family:Calibri,Arial,sans-serif;font-size:10.5pt">
                  <span>Mlle : <b>${esc(fs.mlle || 'N3F-402-25D')}</b> -</span>
                  <span>- Plaque IRD IACM : <b>${esc(fs.plaqueIrd || 'J1V2K3')}</b></span>
                  <span>- Plaque Transformateur : <b>${esc(fs.plaqueTransfo || 'J1V2K4')}</b></span>
                </div>
                <div style="margin-top:3px;font-family:Calibri,Arial,sans-serif;font-size:10.5pt">
                  <span style="margin-left:45px">- Plaque Disjoncteur : <b>${esc(fs.plaqueDisj || 'J1V2K5')}</b></span>
                </div>
                <div style="margin-top:6px">
                  <span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Puissance :</span>
                  <span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin-left:4px">${esc(fs.puissance || '50KVA')}</span>
                </div>
              </div>
            ` : (fs.posteType === 'Type Bas' ? `
              <div style="margin-bottom:20px;line-height:1.5;color:#000">
                <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Poste TYPE : Type Bas</div>
                <div style="margin-top:3px;font-family:Calibri,Arial,sans-serif;font-size:10.5pt">Mlle : <b>${esc(fs.mlle || 'N3F-400-25B -')}</b></div>
                <table class="fs-sig-table" style="margin-top:6px;width:100%;border-collapse:collapse;border:1.5px solid #000;font-size:11px;text-align:center">
                  <thead>
                    <tr style="background:#fff !important;font-weight:700">
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 3px">Cellule Réseau Arrivée</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 3px">Cellule Départ</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 3px">Cellule Protection</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 3px">Transformateur</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 3px">Disj TG BT</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 3px">Départ BT (${esc(fs.departBt || '4 départs')})</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="font-weight:700;background:#fff">
                      <td style="border:1px solid #000;padding:5px 3px">${esc(fs.cellArrivee || 'J1V2H1')}</td>
                      <td style="border:1px solid #000;padding:5px 3px">${esc(fs.cellDepart || 'J1V2H2')}</td>
                      <td style="border:1px solid #000;padding:5px 3px">${esc(fs.cellProtect || 'J1V2H3')}</td>
                      <td style="border:1px solid #000;padding:5px 3px">${esc(fs.transfo || 'J1V2H4')}</td>
                      <td style="border:1px solid #000;padding:5px 3px">${esc(fs.disjTgbt || 'J1V2H5')}</td>
                      <td style="border:1px solid #000;padding:5px 3px">${esc(fs.departBt || '4 départs')}</td>
                    </tr>
                  </tbody>
                </table>
                <div style="margin-top:6px">
                  <span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Puissance :</span>
                  <span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin-left:4px">${esc(fs.puissance || '160KVA')}</span>
                </div>
              </div>
            ` : (fs.posteType === 'Livraison' ? `
              <div style="margin-bottom:20px;line-height:1.5;color:#000">
                <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Poste TYPE : Livraison</div>
                <div style="margin-top:3px;font-family:Calibri,Arial,sans-serif;font-size:10.5pt">Mlle : <b>${esc(fs.mlle || 'N3F-400-25C-')}</b></div>
                <table class="fs-sig-table" style="margin-top:6px;width:100%;border-collapse:collapse;border:1.5px solid #000;font-size:10.5px;text-align:center">
                  <thead>
                    <tr style="background:#fff !important;font-weight:700">
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Arrivée</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Réserve</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Comptage</th>
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Protection<br>Générale</th>
                      ${fs.transfoCount == 1 ? `
                        <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Protection TR</th>
                        <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Transformateur</th>
                      ` : `
                        <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Protection<br>TR1</th>
                        <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Cellule<br>Protection<br>TR2</th>
                        <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Transformateur<br>N°: 1</th>
                        <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">Transformateur<br>N°: 2</th>
                      `}
                      <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:5px 2px">IACM</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="font-weight:700;background:#fff">
                      <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellArrivee || 'J1V2H7')}</td>
                      <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellReserve || 'J1V2H8')}</td>
                      <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellComptage || 'J1V2H9')}</td>
                      <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellProtectGen || 'J1V2J1')}</td>
                      ${fs.transfoCount == 1 ? `
                        <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellProtectTr || 'J1V2J2')}</td>
                        <td style="border:1px solid #000;padding:5px 2px">${esc(fs.transfo || 'J1V2J4')}</td>
                      ` : `
                        <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellProtectTr1 || 'J1V2J2')}</td>
                        <td style="border:1px solid #000;padding:5px 2px">${esc(fs.cellProtectTr2 || 'J1V2J3')}</td>
                        <td style="border:1px solid #000;padding:5px 2px">${esc(fs.transfo1 || 'J1V2J4')}</td>
                        <td style="border:1px solid #000;padding:5px 2px">${esc(fs.transfo2 || 'J1V2J5')}</td>
                      `}
                      <td style="border:1px solid #000;padding:3px 2px;font-size:9.5px;line-height:1.2">
                        ${(fs.iacmText || 'J1V2J6 / J1V2J7 / J1V2J8').split('/').map(x => esc(x.trim())).join('<br>')}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style="margin-top:6px">
                  <span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Puissance :</span>
                  <span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin-left:4px">${esc(fs.puissance || '2500KVA')}</span>
                </div>
              </div>
            ` : `
              <div style="margin-bottom:20px;line-height:1.5;color:#000">
                <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Poste TYPE :</div>
                <div style="height:20px"></div>
                <div><span style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold">Puissance :</span></div>
              </div>
            `))
          )}

          <!-- Section Situation des règlements des Prestations de SRM avec lignes pointillées 100% largeur -->
          <div style="margin-top:16px;line-height:1.6;color:#000">
            <div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin-bottom:4px">Situation des règlements des Prestations de SRM :</div>
            <div style="margin-left:18px;font-family:'Times New Roman',Times,serif;font-size:11pt">- Situation des règlements des Prestations de SRM</div>
            <div style="margin-left:18px;display:flex;align-items:flex-end;height:20px">
              <span style="font-family:'Times New Roman',Times,serif;font-size:11pt;white-space:nowrap;margin-right:4px">- Pj : plans de récolement ${fs.affaireType === 'mt' ? 'MT' : (fs.affaireType === 'bt' ? 'BT' : 'MT/BT')}${fs.pjExtra ? ' + ' + esc(fs.pjExtra) : ''}</span>
              <div style="border-bottom:1px dotted #000;flex:1;height:16px"></div>
            </div>
            <div style="margin-left:18px;border-bottom:1px dotted #000;width:calc(100% - 18px);height:18px"></div>
            <div style="margin-left:18px;border-bottom:1px dotted #000;width:calc(100% - 18px);height:18px"></div>
            <div style="margin-left:18px;display:flex;align-items:flex-end;height:22px">
              <div style="border-bottom:1px dotted #000;flex:1;height:16px"></div>
              <div style="margin-left:12px;font-size:11pt;white-space:nowrap;color:#000;font-family:Calibri,Arial,sans-serif">
                <u><b>Fait le</b></u><b> : <span id="dispFsFaitLe">${formatFsDateFr(fs.faitLe || '')}</span></b>
              </div>
            </div>
          </div>

        </div><!-- FIN PARTIE HAUTE DU DOCUMENT -->

        <!-- PARTIE BASSE DU DOCUMENT : TABLEAU DE SIGNATURES POUSSE TOUT EN BAS (FLEXBOX) -->
        <div style="margin-top:auto;padding-top:10px">
          <table class="fs-sig-table" style="width:100%;border-collapse:collapse;border:1.5px solid #000;text-align:center;background:#fff;font-family:Arial,sans-serif">
            <thead>
              <tr style="background:#fff !important">
                <th colspan="3" style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:8px 4px;height:38px;font-size:11pt;font-weight:bold;text-align:center">Date, cachet et signature</th>
              </tr>
              <tr style="background:#fff !important">
                <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:4px;width:33.33%;height:30px;font-size:10pt;font-weight:bold;text-align:center">Conducteur de Travaux</th>
                <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:4px;width:33.33%;height:30px;font-size:10pt;font-weight:bold;text-align:center">Responsable Etudes</th>
                <th style="border:1px solid #000 !important;background:#fff !important;color:#000 !important;padding:4px;width:33.34%;height:30px;font-size:10pt;font-weight:bold;text-align:center">Responsable Exploitation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #000 !important;height:145px;min-height:145px;background:#fff !important;padding:0"></td>
                <td style="border:1px solid #000 !important;height:145px;min-height:145px;background:#fff !important;padding:0"></td>
                <td style="border:1px solid #000 !important;height:145px;min-height:145px;background:#fff !important;padding:0"></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    `;

    // Événements de configuration Fiche Suiveuse
    const dlFicheBtn = el.querySelector('#btnDownloadFichePdf');
    if (dlFicheBtn) dlFicheBtn.onclick = () => downloadRecolPdf('fiche');

    const prtFicheBtn = el.querySelector('#btnPrintFiche');
    if (prtFicheBtn) prtFicheBtn.onclick = () => window.print();

    const selAffaire = el.querySelector('#selFsAffaire');
    if (selAffaire) {
      selAffaire.onchange = () => {
        fs.affaireType = selAffaire.value;
        fs._userManualAffaire = true;
        if (fs.affaireType === 'bt') {
          fs.posteType = 'Aucun';
        } else if (fs.posteType === 'Aucun') {
          fs.posteType = 'H61';
        }
        touch(); saveStorage(); paneRecol(el);
      };
    }

    const selRefType = el.querySelector('#selFsRefType');
    if (selRefType) {
      selRefType.onchange = () => {
        fs.refType = selRefType.value;
        touch(); saveStorage(); paneRecol(el);
      };
    }

    const inpRefNum = el.querySelector('#inpFsRefNum');
    if (inpRefNum) {
      inpRefNum.oninput = () => {
        fs.refNum = inpRefNum.value;
        const disp = el.querySelector('#dispFsRefNum');
        if (disp) disp.textContent = fs.refNum || '—';
        touch();
      };
      inpRefNum.onchange = () => saveStorage();
    }

    const inpNum = el.querySelector('#inpFsNum');
    if (inpNum) {
      inpNum.oninput = () => {
        fs.num = inpNum.value;
        const disp = el.querySelector('#dispFsNum');
        if (disp) disp.textContent = fs.num;
        touch();
      };
      inpNum.onchange = () => saveStorage();
    }

    const inpFaitLe = el.querySelector('#inpFsFaitLe');
    if (inpFaitLe) {
      inpFaitLe.oninput = () => {
        fs.faitLe = inpFaitLe.value;
        const disp = el.querySelector('#dispFsFaitLe');
        if (disp) disp.textContent = fs.faitLe;
        touch();
      };
      inpFaitLe.onchange = () => saveStorage();
    }

    const selPoste = el.querySelector('#selFsPosteType');
    if (selPoste) {
      selPoste.onchange = () => {
        fs.posteType = selPoste.value;
        fs._userManualPoste = true;
        if (fs.posteType === 'Livraison') {
          fs.mlle = 'N3F-400-25C-';
          fs.puissance = '2500KVA';
        } else if (fs.posteType === 'Type Bas') {
          fs.mlle = 'N3F-400-25B -';
          fs.puissance = '160KVA';
        } else if (fs.posteType === 'H61') {
          fs.mlle = 'N3F-402-25D -';
          fs.puissance = '50KVA';
        }
        touch(); saveStorage(); paneRecol(el);
      };
    }

    const selTransfoCount = el.querySelector('#selFsTransfoCount');
    if (selTransfoCount) {
      selTransfoCount.onchange = () => {
        fs.transfoCount = parseInt(selTransfoCount.value, 10);
        touch(); saveStorage(); paneRecol(el);
      };
    }

    const selDepartBt = el.querySelector('#selFsDepartBt');
    if (selDepartBt) {
      selDepartBt.onchange = () => {
        fs.departBt = selDepartBt.value;
        touch(); saveStorage(); paneRecol(el);
      };
    }

    const inpPuiss = el.querySelector('#inpFsPuissance');
    if (inpPuiss) {
      inpPuiss.oninput = () => {
        fs.puissance = inpPuiss.value;
        touch();
      };
      inpPuiss.onchange = () => { saveStorage(); paneRecol(el); };
    }

    const inpMlle = el.querySelector('#inpFsMlle');
    if (inpMlle) {
      inpMlle.oninput = () => {
        fs.mlle = inpMlle.value;
        touch();
      };
      inpMlle.onchange = () => { saveStorage(); paneRecol(el); };
    }

    const btnRefreshCables = el.querySelector('#btnRefreshCablesFromAtt');
    if (btnRefreshCables) {
      btnRefreshCables.onclick = () => {
        const ext = extractAttachementCables(rec);
        fs.htaLines = ext.hta.length ? ext.hta : ['.............................................................................................................'];
        fs.btLines = ext.bt.length ? ext.bt : ['.............................................................................................................'];
        touch(); saveStorage(); paneRecol(el);
        toast("Câbles et longueurs synchronisés depuis l'attachement");
      };
    }

    // Champs de personnalisation avancée
    const bindFsInput = (id, key) => {
      const inp = el.querySelector(id);
      if (inp) {
        inp.oninput = () => { fs[key] = inp.value; touch(); };
        inp.onchange = () => { saveStorage(); paneRecol(el); };
      }
    };
    bindFsInput('#inpFsDemandeur', 'demandeur');
    bindFsInput('#inpFsExecutant', 'executant');
    bindFsInput('#inpFsIntitule', 'intitule');
    bindFsInput('#inpFsPlaqueIrd', 'plaqueIrd');
    bindFsInput('#inpFsPlaqueTransfo', 'plaqueTransfo');
    bindFsInput('#inpFsPlaqueDisj', 'plaqueDisj');
    bindFsInput('#inpFsCellArrivee', 'cellArrivee');
    bindFsInput('#inpFsCellDepart', 'cellDepart');
    bindFsInput('#inpFsCellProtect', 'cellProtect');
    bindFsInput('#inpFsTransfo', 'transfo');
    bindFsInput('#inpFsDisjTgbt', 'disjTgbt');
    bindFsInput('#inpFsCellReserve', 'cellReserve');
    bindFsInput('#inpFsCellComptage', 'cellComptage');
    bindFsInput('#inpFsCellProtectGen', 'cellProtectGen');
    bindFsInput('#inpFsCellProtectTr', 'cellProtectTr');
    bindFsInput('#inpFsCellProtectTr1', 'cellProtectTr1');
    bindFsInput('#inpFsCellProtectTr2', 'cellProtectTr2');
    bindFsInput('#inpFsTransfo1', 'transfo1');
    bindFsInput('#inpFsTransfo2', 'transfo2');
    bindFsInput('#inpFsIacm', 'iacmText');

    const txtHta = el.querySelector('#txtFsHta');
    if (txtHta) {
      txtHta.onchange = () => {
        fs.htaLines = txtHta.value.split('\n').map(s => s.trim()).filter(Boolean);
        touch(); saveStorage(); paneRecol(el);
      };
    }

    const txtBt = el.querySelector('#txtFsBt');
    if (txtBt) {
      txtBt.onchange = () => {
        fs.btLines = txtBt.value.split('\n').map(s => s.trim()).filter(Boolean);
        touch(); saveStorage(); paneRecol(el);
      };
    }
  }

  // Événements de bascule des sous-onglets
  const btnChif = el.querySelector('#btnSubChiffrage');
  if (btnChif) {
    btnChif.onclick = () => {
      window._recolSubTab = 'chiffrage';
      paneRecol(el);
    };
  }

  const btnAtt = el.querySelector('#btnSubAttachement');
  if (btnAtt) {
    btnAtt.onclick = () => {
      window._recolSubTab = 'attachement';
      paneRecol(el);
    };
  }

  const btnFiche = el.querySelector('#btnSubFiche');
  if (btnFiche) {
    btnFiche.onclick = () => {
      window._recolSubTab = 'fiche';
      paneRecol(el);
    };
  }
}


// Démarrage & Initialisation Logo + Thème PRO
(function initProBrandingAndTheme() {
  const logoImg = $('#appTopLogo');
  if (logoImg && typeof LOGO !== 'undefined') {
    logoImg.src = LOGO;
  }
  const savedTheme = localStorage.getItem('srm_pro_theme_v1') || 'emerald-pro';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeSel = $('#proThemeSelect');
  if (themeSel) {
    themeSel.value = savedTheme;
    themeSel.onchange = () => {
      const val = themeSel.value || 'emerald-pro';
      document.documentElement.setAttribute('data-theme', val);
      try { localStorage.setItem('srm_pro_theme_v1', val); } catch (e) {}
      toast('🎨 Thème PRO appliqué avec succès');
    };
  }
})();

loadCatalogStorage();
loadStorage();
P = (plist[0] && plist[0].data) ? plist[0].data : exampleP();
renderList();
render();



/* ===== IMPORTATION BORDEREAU PDF ===== */

// Configuration du worker pdf.js
if (typeof pdfjsLib !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } catch (e) {
    console.warn('pdfjsLib worker config:', e);
  }
}

/* Gestionnaire principal d'upload de fichier PDF */
function handlePdfBordereauUpload(file, targetMode = 'new') {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Veuillez sélectionner un fichier au format PDF.');
    return;
  }

  if (typeof pdfjsLib === 'undefined') {
    alert('La bibliothèque PDF.js n\'a pas pu être chargée. Veuillez vérifier la connexion Internet ou recharger la page.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const buffer = e.target.result;
      await processPdfBordereauBuffer(buffer, file.name, targetMode);
    } catch (err) {
      console.error('Erreur traitement PDF:', err);
      alert('Erreur lors de la lecture du fichier PDF : ' + (err.message || err));
    }
  };
  reader.readAsArrayBuffer(file);
}

/* Analyse asynchrone du buffer PDF */
async function processPdfBordereauBuffer(buffer, filename, targetMode) {
  toast('📄 Lecture et analyse du Bordereau PDF en cours...');
  
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const metadata = {
    objet: '',
    commune: '',
    province: 'Ouezzane',
    devis: '',
    demande: '',
    destinataire: '',
    typeAff: 'MT/BT'
  };

  const rawItems = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const items = textContent.items || [];
    if (!items.length) continue;

    const words = [];
    for (const it of items) {
      const str = (it.str || '').trim();
      if (!str) continue;
      const x = it.transform[4];
      const yBottom = it.transform[5];
      const yTop = viewport.height - yBottom;
      const w = it.width || 10;
      const h = it.height || 10;
      words.push({ str, x, y: yTop, x1: x + w, y1: yTop + h });
    }

    // Regrouper par lignes visuelles (Y ± 3.5)
    const lineMap = new Map();
    for (const w of words) {
      const yKey = Math.round(w.y / 4) * 4;
      if (!lineMap.has(yKey)) lineMap.set(yKey, []);
      lineMap.get(yKey).push(w);
    }

    const sortedY = Array.from(lineMap.keys()).sort((a, b) => a - b);

    // Recherche de Devis dans les mots proches
    if (!metadata.devis) {
      const devisWord = words.find(w => /devis/i.test(w.str));
      if (devisWord) {
        const nearbyNum = words.find(w => Math.abs(w.y - devisWord.y) < 15 && w.x > devisWord.x - 20 && /^\d{4,9}$/.test(w.str));
        if (nearbyNum) metadata.devis = nearbyNum.str;
      }
    }
    
    // Détection métadonnées
    for (const y of sortedY) {
      const rowWords = lineMap.get(y).sort((a, b) => a.x - b.x);
      const lineStr = rowWords.map(w => w.str).join(' ');

      if (!metadata.objet) {
        const mObj = lineStr.match(/Objet\s*:\s*(.+)$/i);
        if (mObj && mObj[1].trim()) metadata.objet = mObj[1].trim();
      }
      if (!metadata.commune) {
        const mCom = lineStr.match(/Commune\s*:\s*(.+)$/i);
        if (mCom && mCom[1].trim()) metadata.commune = mCom[1].trim();
      }
      if (!metadata.province || metadata.province === 'Ouezzane') {
        const mPrv = lineStr.match(/Province\s*:\s*(.+)$/i);
        if (mPrv && mPrv[1].trim()) metadata.province = mPrv[1].trim();
      }
      if (!metadata.devis) {
        const mDev = lineStr.match(/Devis\s*N?[°o]?\s*:\s*([A-Za-z0-9\/-]+)/i);
        if (mDev && mDev[1].trim()) metadata.devis = mDev[1].trim();
      }
      if (!metadata.demande) {
        const mDem = lineStr.match(/Demande\s*N[°o]?\s*:\s*([A-Za-z0-9\/-]+)/i);
        if (mDem && mDem[1].trim()) metadata.demande = mDem[1].trim();
      }
    }

    // Détection des en-têtes de colonnes
    let colCode = [0, 75];
    let colDes = [75, 290];
    let colCons = [290, 345];
    let colU = [345, 385];
    let colQ = [385, 450];
    let colPu = [450, 520];
    let colTot = [520, 600];

    let headerY = -1;
    for (const y of sortedY) {
      const rowWords = lineMap.get(y);
      const lineUpper = rowWords.map(w => w.str.toUpperCase()).join(' ');
      if (lineUpper.includes('PRIX') && (lineUpper.includes('DESIGNATION') || lineUpper.includes('QUANTITE') || lineUpper.includes('UNITE'))) {
        headerY = y;
        for (const w of rowWords) {
          const uStr = w.str.toUpperCase();
          if (uStr.includes('DESIGNATION')) colDes[0] = Math.max(50, w.x - 10);
          if (uStr.includes('CONSIS')) colCons[0] = Math.max(260, w.x - 10);
          if (uStr.includes('UNITE') || uStr === 'U') colU[0] = Math.max(320, w.x - 10);
          if (uStr.includes('QUANTITE') || uStr === 'QTE') colQ[0] = Math.max(370, w.x - 10);
          if (uStr.includes('UNITAIRE') || uStr === 'PU') colPu[0] = Math.max(440, w.x - 10);
        }
        break;
      }
    }

    // Ancres de quantités
    const anchors = [];
    for (const w of words.sort((a, b) => a.y - b.y)) {
      if (headerY > 0 && w.y <= headerY + 10) continue;
      const sUp = w.str.toUpperCase();
      if (sUp.includes('TOTAL') || sUp.includes('TVA')) continue;

      if (w.x >= colQ[0] - 15 && w.x <= colPu[0] && /^\d+([.,]\d+)?$/.test(w.str)) {
        anchors.push({ y: w.y, val: w.str });
      }
    }

    if (anchors.length > 0) {
      for (let k = 0; k < anchors.length; k++) {
        const yTop = (k === 0) ? (headerY > 0 ? headerY + 12 : anchors[k].y - 12) : (anchors[k-1].y + anchors[k].y) / 2;
        const yBottom = (k < anchors.length - 1) ? (anchors[k].y + anchors[k+1].y) / 2 : anchors[k].y + 20;

        const rowWords = words.filter(w => w.y >= yTop && w.y < yBottom);

        // 1. Recherche du code dans rowWords
        let codeStr = '';
        for (const w of rowWords) {
          if (w.x < 85 && (/^[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(w.str) || /^\d{1,4}$/.test(w.str))) {
            codeStr = w.str;
            break;
          }
        }

        // 2. Recherche de la consistance (F+M, M, F)
        let consStr = '';
        for (const w of rowWords) {
          if (w.x >= 280 && w.x <= 345 && /^(F\+M|M|F)$/i.test(w.str)) {
            consStr = w.str.toUpperCase();
            break;
          }
        }

        // 3. Recherche de l'unité
        let uStr = '';
        for (const w of rowWords) {
          if (w.x >= 340 && w.x <= 385 && /^(U|m|m3|kg|t|ens|f|km|ml)$/i.test(w.str)) {
            uStr = w.str;
            break;
          }
        }

        // 4. Quantité
        const qRaw = (anchors[k].val || '1').replace(/\s+/g, '').replace(',', '.');
        const qVal = parseFloat(qRaw) || 1;

        // 5. Prix unitaire si présent
        const puWords = rowWords.filter(w => w.x >= colPu[0] && w.x < colTot[0]).map(w => w.str);
        const puRaw = (puWords.join(' ').trim() || '0').replace(/\s+/g, '').replace(',', '.');
        const puVal = parseFloat(puRaw) || 0;

        // 6. Désignation : tous les mots situés entre 50 et 290, ordonnés par Y puis X
        const desWords = rowWords
          .filter(w => w.x >= 50 && w.x < 290)
          .sort((a, b) => (Math.round(a.y / 3) * 3 - Math.round(b.y / 3) * 3) || (a.x - b.x))
          .map(w => w.str);
        
        let desStr = desWords.join(' ').trim();

        if (desStr || codeStr) {
          rawItems.push({
            code: codeStr,
            des: desStr,
            cons: consStr,
            u: uStr,
            q: qVal,
            pu: puVal
          });
        }
      }
    } else {
      // Fallback regex ligne par ligne
      for (const y of sortedY) {
        if (headerY > 0 && y <= headerY + 10) continue;
        const lineWords = lineMap.get(y).sort((a, b) => a.x - b.x);
        const lineStr = lineWords.map(w => w.str).join(' ');
        const m = lineStr.match(/^([0-9]{2}-[0-9]{2}-[0-9]{2}|\d{1,4}|[A-Z0-9.-]+)?\s*(.+?)\s+(F\+M|M|F)?\s*(U|m3|m|kg|t|ens|f|km|ml|forfait)\s+([\d\s,.]+)\s*([\d\s,.]*)/i);
        if (m) {
          const codeStr = (m[1] || '').trim();
          const desStr = (m[2] || '').trim();
          const consStr = (m[3] || '').trim();
          const uStr = (m[4] || '').trim();
          const qVal = parseFloat(m[5].replace(/\s+/g, '').replace(',', '.')) || 1;
          const puVal = parseFloat((m[6] || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
          rawItems.push({ code: codeStr, des: desStr, cons: consStr, u: uStr, q: qVal, pu: puVal });
        }
      }
    }
  }

  // Enrichissement et appariement catalogue
  const enrichedItems = enrichExtractedBordereauItems(rawItems);

  if (!enrichedItems.length) {
    alert('Aucun article de bordereau n\'a pu être détecté dans ce fichier PDF.\n\nVérifiez que le PDF contient un tableau de prix avec désignation, unités et quantités.');
    return;
  }

  // Détection du type d'affaire
  let hasMT = false, hasBT = false;
  for (const it of enrichedItems) {
    const lot = String(it.lot || '').toUpperCase();
    const des = String(it.d || '').toUpperCase();
    if (lot.includes('MT') || lot.includes('LOT1') || des.includes('MT') || des.includes('ALMELEC') || des.includes('POSTE')) hasMT = true;
    if (lot.includes('BT') || lot.includes('LOT3') || des.includes('BT') || des.includes('TORSADÉ') || des.includes('TORSADE') || des.includes('BRANCHEMENT')) hasBT = true;
  }
  if (hasMT && hasBT) metadata.typeAff = 'MT/BT';
  else if (hasMT) metadata.typeAff = 'MT';
  else if (hasBT) metadata.typeAff = 'BT';

  openPdfBordereauImportModal({
    filename,
    metadata,
    items: enrichedItems,
    targetMode
  });
}

/* Appariement des articles extraits avec la base de données SRM-TTA */
function enrichExtractedBordereauItems(rawItems) {
  const allCatalog = (typeof allArts === 'function' ? allArts() : (typeof ARTS !== 'undefined' ? ARTS : []));

  const catByCode = new Map();
  for (const a of allCatalog) {
    const c = String(a.code || '').trim();
    if (c) catByCode.set(c, a);
  }

  const result = [];
  let customCounter = 1;

  for (const raw of rawItems) {
    let matchedArt = null;
    const cleanCode = (raw.code || '').trim();

    // 1. Recherche par code exact
    if (cleanCode && catByCode.has(cleanCode)) {
      matchedArt = catByCode.get(cleanCode);
    }

    // 2. Recherche par texte si code non trouvé ou vide
    if (!matchedArt && raw.des) {
      const dNorm = smartNorm(raw.des);
      if (dNorm.length >= 4) {
        matchedArt = allCatalog.find(a => {
          const aNorm = smartNorm(a.d || '');
          return aNorm && (aNorm === dNorm || aNorm.includes(dNorm) || dNorm.includes(aNorm));
        });
      }
    }

    let finalCode = cleanCode;
    let finalDes = (raw.des || '').trim();
    let finalCons = (raw.cons || '').trim();
    let finalU = (raw.u || '').trim();
    let finalPu = raw.pu || 0;
    let finalLot = 'lot1';
    let isCatalogMatch = false;

    if (matchedArt) {
      isCatalogMatch = true;
      finalCode = matchedArt.code || finalCode;
      if (!finalDes || finalDes.length < 5) finalDes = matchedArt.d || finalDes;
      if (!finalCons) finalCons = matchedArt.c || 'F+M';
      if (!finalU) finalU = matchedArt.u || 'U';
      if (!finalPu || finalPu === 0) finalPu = num(matchedArt.p) || num(matchedArt.pu) || 0;
      finalLot = (matchedArt.cat === 'BT') ? 'lot3' : (matchedArt.cat === 'PT' ? 'lot2' : 'lot1');
    } else {
      if (!finalCode) {
        finalCode = 'F' + (customCounter++);
      }
      if (!finalCons) finalCons = 'F+M';
      if (!finalU) finalU = 'U';
      finalLot = (typeof detectLot === 'function' ? detectLot(finalCode, finalDes) : 'lot1');
    }

    result.push({
      key: 'b_' + uid(),
      code: finalCode,
      np: finalCode,
      d: finalDes,
      c: finalCons,
      u: finalU,
      q: raw.q > 0 ? raw.q : 1,
      pu: finalPu,
      lot: finalLot,
      on: true,
      _isCat: isCatalogMatch
    });
  }

  return result;
}

function openPdfBordereauImportModal({ filename, metadata, items, targetMode }) {
  const old = document.getElementById('modalImportBordPdf');
  if (old) old.remove();

  const curYear = new Date().getFullYear();
  const nextNum = (typeof getNextAffaireNum === 'function') ? getNextAffaireNum(curYear).formatted : `SET/DPO/101/${curYear}`;

  let localItems = JSON.parse(JSON.stringify(items));

  const modal = document.createElement('div');
  modal.id = 'modalImportBordPdf';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);';

  const renderModal = () => {
    const totalHT = localItems.filter(it => it.on).reduce((sum, it) => sum + (num(it.q) * num(it.pu)), 0);
    const totalTVA = totalHT * 0.20;
    const totalTTC = totalHT * 1.20;
    const countChecked = localItems.filter(it => it.on).length;

    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;width:100%;max-width:1050px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.3);overflow:hidden;border:1.5px solid #cbd5e1;font-family:Arial,sans-serif">
        
        <!-- En-tête -->
        <div style="padding:14px 20px;background:#0d7a5b;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;font-size:18px;display:flex;align-items:center;gap:8px">
              <span>📄</span> Importer Bordereau PDF & Créer Nouvelle Affaire
            </h3>
            <div style="font-size:12px;opacity:0.9;margin-top:2px">
              Fichier source : <b>${esc(filename)}</b> · <b>${localItems.length} articles détectés</b> (dont ${localItems.filter(it => it._isCat).length} appariés au catalogue officiel SRM-TTA)
            </div>
          </div>
          <button class="btn sm" id="btnCloseImportPdfModal" style="background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:16px;line-height:1;padding:4px 8px;cursor:pointer" title="Fermer">✕</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
          
          <!-- Bloc Données de la Nouvelle Affaire -->
          <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 14px">
            <div style="font-size:12.5px;font-weight:700;color:#0d7a5b;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
              <span>📋 INFORMATIONS DU DOSSIER À CRÉER (détectées automatiquement du PDF) :</span>
              <span style="font-size:11px;font-weight:normal;color:#64748b">Vous pouvez ajuster ces données avant création</span>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;font-size:12px">
              <div>
                <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155">N° Affaire (officiel) :</label>
                <input type="text" id="pdfAffNum" value="${esc(nextNum)}" style="width:100%;padding:6px 8px;border:1.5px solid #0d7a5b;border-radius:5px;font-weight:700;font-family:monospace;color:#0d7a5b;background:#f0fdf4">
              </div>
              <div>
                <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155">N° Devis :</label>
                <input type="text" id="pdfAffDevis" value="${esc(metadata.devis)}" placeholder="ex: 552849" style="width:100%;padding:6px 8px;border:1.5px solid #cbd5e1;border-radius:5px">
              </div>
              <div>
                <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155">Commune :</label>
                <input type="text" id="pdfAffCommune" value="${esc(metadata.commune)}" placeholder="ex: Sidi Ahmed Chrif" style="width:100%;padding:6px 8px;border:1.5px solid #cbd5e1;border-radius:5px">
              </div>
              <div>
                <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155">Province :</label>
                <input type="text" id="pdfAffProvince" value="${esc(metadata.province || 'Ouezzane')}" placeholder="ex: Ouezzane" style="width:100%;padding:6px 8px;border:1.5px solid #cbd5e1;border-radius:5px">
              </div>
              <div>
                <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155">Situation du projet :</label>
                <input type="text" id="pdfAffSituation" value="${esc(metadata.province || 'Ouezzane')}" placeholder="ex: Ouezzane" style="width:100%;padding:6px 8px;border:1.5px solid #cbd5e1;border-radius:5px">
              </div>
              <div>
                <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155">Structure Réseau :</label>
                <select id="pdfAffType" style="width:100%;padding:6px 8px;border:1.5px solid #cbd5e1;border-radius:5px;font-weight:700">
                  <option value="MT/BT" ${metadata.typeAff === 'MT/BT' ? 'selected' : ''}>🏗️ Lotissement (MT + PT + BT)</option>
                  <option value="BT" ${metadata.typeAff === 'BT' ? 'selected' : ''}>🔌 Réseau BT seul</option>
                  <option value="MT" ${metadata.typeAff === 'MT' ? 'selected' : ''}>⚡ Ligne MT seule</option>
                </select>
              </div>
            </div>

            <div style="margin-top:10px">
              <label style="font-weight:700;display:block;margin-bottom:3px;color:#334155;font-size:12px">Objet / Intitulé de l'affaire :</label>
              <input type="text" id="pdfAffObjet" value="${esc(metadata.objet || filename.replace('.pdf',''))}" placeholder="ex: Travaux d'électrification ou déviation réseau..." style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:5px;font-size:12.5px">
            </div>
          </div>

          <!-- Tableau des Articles extraits -->
          <div style="border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff">
            <div style="padding:10px 14px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div style="font-size:13px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                <span>📦 Articles du Bordereau extraits :</span>
                <span class="pill" style="font-size:11px;background:#0d7a5b;color:#fff">${countChecked} / ${localItems.length} sélectionnés</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <button class="btn sm" id="btnToggleAllArticles" style="font-size:11px">Tout cocher / décocher</button>
              </div>
            </div>

            <div style="max-height:280px;overflow-y:auto">
              <table style="width:100%;border-collapse:collapse;font-size:11.5px;text-align:left">
                <thead style="position:sticky;top:0;background:#f8fafc;border-bottom:1.5px solid #cbd5e1;z-index:2">
                  <tr style="color:#475569;font-weight:700">
                    <th style="padding:6px 8px;width:30px;text-align:center">#</th>
                    <th style="padding:6px 8px;width:95px">N° Prix</th>
                    <th style="padding:6px 8px">Désignation des fournitures et ouvrages</th>
                    <th style="padding:6px 8px;width:55px;text-align:center">Cons.</th>
                    <th style="padding:6px 8px;width:50px;text-align:center">Unité</th>
                    <th style="padding:6px 8px;width:85px;text-align:right">Quantité</th>
                    <th style="padding:6px 8px;width:100px;text-align:right">PU HT (DH)</th>
                    <th style="padding:6px 8px;width:110px;text-align:right">Total HT (DH)</th>
                    <th style="padding:6px 8px;width:80px;text-align:center">Origine</th>
                  </tr>
                </thead>
                <tbody>
                  ${localItems.map((it, idx) => {
                    const lineHT = num(it.q) * num(it.pu);
                    return `
                      <tr style="border-bottom:1px solid #f1f5f9;background:${it.on ? (idx % 2 === 0 ? '#fff' : '#fcfcfc') : '#f8fafc'};opacity:${it.on ? 1 : 0.5}">
                        <td style="padding:6px 8px;text-align:center">
                          <input type="checkbox" data-idx="${idx}" class="chk-art-pdf" ${it.on ? 'checked' : ''}>
                        </td>
                        <td style="padding:6px 8px;font-weight:700;font-family:monospace;color:#0d7a5b">
                          ${esc(it.code || it.np || '—')}
                        </td>
                        <td style="padding:6px 8px;color:#1e293b;line-height:1.3">
                          ${esc(it.d)}
                        </td>
                        <td style="padding:6px 8px;text-align:center;font-weight:700;color:#64748b">
                          ${esc(it.c || 'F+M')}
                        </td>
                        <td style="padding:6px 8px;text-align:center;font-weight:700">
                          ${esc(it.u || 'U')}
                        </td>
                        <td style="padding:6px 8px;text-align:right">
                          <input type="number" step="any" min="0" data-qidx="${idx}" value="${it.q}" style="width:75px;padding:3px 6px;text-align:right;border:1px solid #cbd5e1;border-radius:4px;font-weight:700">
                        </td>
                        <td style="padding:6px 8px;text-align:right">
                          <input type="number" step="any" min="0" data-puidx="${idx}" value="${it.pu}" style="width:90px;padding:3px 6px;text-align:right;border:1px solid #cbd5e1;border-radius:4px;font-weight:700">
                        </td>
                        <td style="padding:6px 8px;text-align:right;font-weight:700;color:#0f172a">
                          ${fmt(lineHT)}
                        </td>
                        <td style="padding:6px 8px;text-align:center">
                          ${it._isCat ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px">✓ SRM</span>` : `<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px">⭐ Perso</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Bandeau Totaux Calculés en direct -->
            <div style="padding:10px 16px;background:#f8fafc;border-top:1.5px solid #cbd5e1;display:flex;justify-content:flex-end;align-items:center;gap:20px;font-size:13px">
              <div>Total HT : <b style="color:#0f172a">${fmt(totalHT)} DH</b></div>
              <div>TVA (20%) : <b style="color:#64748b">${fmt(totalTVA)} DH</b></div>
              <div style="font-size:14px;color:#0d7a5b">Total TTC : <b style="font-size:15px">${fmt(totalTTC)} DH</b></div>
            </div>
          </div>

        </div>

        <!-- Pied de page & Actions -->
        <div style="padding:14px 20px;background:#f8fafc;border-top:1.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <button class="btn sm" id="btnCancelImportPdfModal">Annuler</button>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn sm" id="btnInjectInCurrentAff" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;font-weight:700" title="Remplacer ou ajouter ces articles dans le bordereau de l'affaire courante (${P ? P.info.num : ''})">
              📥 Injecter dans l'affaire courante
            </button>
            <button class="btn ok" id="btnConfirmCreateNewFromPdf" style="background:#0d7a5b;color:#fff;font-weight:800;padding:8px 18px;font-size:13.5px" title="Créer une nouvelle affaire officielle avec ce Bordereau">
              ⚡ Créer la NOUVELLE affaire avec ce Bordereau
            </button>
          </div>
        </div>

      </div>
    `;

    // Événements
    const closeBtn = modal.querySelector('#btnCloseImportPdfModal');
    if (closeBtn) closeBtn.onclick = () => modal.remove();
    const cancelBtn = modal.querySelector('#btnCancelImportPdfModal');
    if (cancelBtn) cancelBtn.onclick = () => modal.remove();

    // Checkboxes
    modal.querySelectorAll('.chk-art-pdf').forEach(chk => {
      chk.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        localItems[idx].on = e.target.checked;
        renderModal();
      };
    });

    // Inputs Quantité
    modal.querySelectorAll('[data-qidx]').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.qidx, 10);
        localItems[idx].q = Math.max(0, num(e.target.value));
        renderModal();
      };
    });

    // Inputs Prix Unitaire
    modal.querySelectorAll('[data-puidx]').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.puidx, 10);
        localItems[idx].pu = Math.max(0, num(e.target.value));
        renderModal();
      };
    });

    // Tout cocher / décocher
    const toggleAllBtn = modal.querySelector('#btnToggleAllArticles');
    if (toggleAllBtn) {
      toggleAllBtn.onclick = () => {
        const allOn = localItems.every(it => it.on);
        localItems.forEach(it => { it.on = !allOn; });
        renderModal();
      };
    }

    // Bouton Créer NOUVELLE Affaire
    const btnCreate = modal.querySelector('#btnConfirmCreateNewFromPdf');
    if (btnCreate) {
      btnCreate.onclick = () => {
        const selectedItems = localItems.filter(it => it.on);
        if (!selectedItems.length) {
          alert('Veuillez sélectionner au moins un article pour créer la nouvelle affaire.');
          return;
        }

        const affNum = modal.querySelector('#pdfAffNum').value.trim() || nextNum;
        const affDevis = modal.querySelector('#pdfAffDevis').value.trim();
        const affObjet = modal.querySelector('#pdfAffObjet').value.trim();
        const affCommune = modal.querySelector('#pdfAffCommune').value.trim();
        const affProvince = modal.querySelector('#pdfAffProvince').value.trim() || 'Ouezzane';
        const affType = modal.querySelector('#pdfAffType').value;

        // Créer l'affaire
        const np = blankP(affObjet || 'Nouvelle affaire (Bordereau PDF)');
        np.info.num = affNum;
        np.info.refAffaire = affNum;
        np.info.devis = affDevis;
        np.info.objet = affObjet;
        np.info.commune = affCommune;
        np.info.province = affProvince;
        const affSit = modal.querySelector('#pdfAffSituation') ? modal.querySelector('#pdfAffSituation').value.trim() : '';
        np.info.situationProjet = affSit || affProvince || 'Ouezzane';
        np.info.typeAff = affType;
        np.info.posteType = (affType === 'BT') ? 'Néant' : 'Poste H61';
        np.tva = 20;
        np.peines = 20;
        
        np.bord = selectedItems.map(it => ({
          key: 'b_' + uid(),
          code: it.code || it.np,
          np: it.code || it.np,
          d: it.d,
          c: it.c || 'F+M',
          u: it.u || 'U',
          q: num(it.q) || 1,
          pu: num(it.pu) || 0,
          lot: it.lot || 'lot1',
          on: true
        }));

        P = np;
        mode = 'dossier';
        syncCablesFromBord();
        touch();
        saveStorage();
        renderList();
        render();

        modal.remove();
        toast(`✅ Nouvelle affaire ${P.info.num} créée avec succès (${P.bord.length} articles importés du PDF)`);
      };
    }

    // Bouton Injecter dans l'affaire courante
    const btnInject = modal.querySelector('#btnInjectInCurrentAff');
    if (btnInject) {
      btnInject.onclick = () => {
        if (!P) {
          alert('Aucune affaire courante n\'est ouverte.');
          return;
        }
        const selectedItems = localItems.filter(it => it.on);
        if (!selectedItems.length) {
          alert('Veuillez sélectionner au moins un article à injecter.');
          return;
        }

        const affDevis = modal.querySelector('#pdfAffDevis').value.trim();
        const affObjet = modal.querySelector('#pdfAffObjet').value.trim();
        const affCommune = modal.querySelector('#pdfAffCommune').value.trim();
        if (affDevis && !P.info.devis) P.info.devis = affDevis;
        if (affObjet && !P.info.objet) P.info.objet = affObjet;
        if (affCommune && !P.info.commune) P.info.commune = affCommune;

        const doReplace = confirm(`Voulez-vous REMPLACER le bordereau existant de l'affaire courante (${P.info.num}) par ces ${selectedItems.length} articles ?\n\n• Cliquez sur [OK] pour Remplacer entièrement\n• Cliquez sur [Annuler] pour Ajouter à la suite des articles existants`);

        const newLines = selectedItems.map(it => ({
          key: 'b_' + uid(),
          code: it.code || it.np,
          np: it.code || it.np,
          d: it.d,
          c: it.c || 'F+M',
          u: it.u || 'U',
          q: num(it.q) || 1,
          pu: num(it.pu) || 0,
          lot: it.lot || 'lot1',
          on: true
        }));

        if (doReplace) {
          P.bord = newLines;
        } else {
          P.bord = (P.bord || []).concat(newLines);
        }

        syncCablesFromBord();
        touch();
        saveStorage();
        render();

        modal.remove();
        toast(`✅ ${selectedItems.length} articles injectés avec succès dans l'affaire ${P.info.num}`);
      };
    }

  };

  renderModal();
  document.body.appendChild(modal);
}

/* ===== FIN IMPORTATION BORDEREAU PDF ===== */

