// app.js — chargeur shamanloop
// Le bundle UMD `lib/strudel/index.js` est chargé via <script> dans index.html
// et expose `initStrudel` (et après son appel, `evaluate`, `hush`, `samples`…)
// sur `window`. On utilise les globals — aucune syntaxe ES module ici, pour
// rester compatible avec une ouverture en file:// (les imports ESM y sont bloqués).

const $code   = document.getElementById('code');
const $sample = document.getElementById('sample');
const $play   = document.getElementById('play');
const $stop   = document.getElementById('stop');
const $status = document.getElementById('status');
const $params = document.getElementById('params');

let manifest = null;
let initialized = false;
let playing = false;
let liveTimer = null;

document.addEventListener('strudel.log', (ev) => {
  const { message, type } = ev.detail || {};
  if (type === 'error') {
    setStatus('erreur strudel : ' + message, 'error');
    document.body.classList.remove('playing');
    playing = false;
  }
});

const setStatus = (msg, cls = '') => {
  $status.textContent = msg;
  $status.className = 'status' + (cls ? ' ' + cls : '');
};

const findById = (arr, id) => arr.find(x => x.id === id);

const stripSamples = (code) =>
  code.replace(/samples\s*\(\s*\{[\s\S]*?\}\s*\)\s*;?\s*/g, '');

const toLit = (v) => typeof v === 'number'
  ? String(v)
  : `'${String(v).replace(/'/g, "\\'")}'`;

// (re)construit l'UI des paramètres pour le code sélectionné
function renderParams(codeMeta) {
  $params.innerHTML = '';
  const params = codeMeta.params || [];
  if (!params.length) { $params.classList.add('empty'); return; }
  $params.classList.remove('empty');

  for (const p of params) {
    const wrap = document.createElement('label');
    wrap.className = 'param';

    const head = document.createElement('span');
    head.className = 'plabel';
    head.textContent = p.label;

    const val = document.createElement('span');
    val.className = 'pval';

    if (p.type === 'select') {
      const sel = document.createElement('select');
      for (const o of p.options) {
        const opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        if (o === p.default) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.dataset.paramId = p.id;
      sel.dataset.paramKind = 'string';
      val.textContent = p.default;
      sel.addEventListener('change', () => { val.textContent = sel.value; });
      wrap.append(head, val, sel);
    } else {
      const r = document.createElement('input');
      r.type = 'range';
      r.min = p.min; r.max = p.max; r.step = p.step ?? 0.01;
      r.value = p.default;
      r.dataset.paramId = p.id;
      r.dataset.paramKind = 'number';
      val.textContent = p.default;
      r.addEventListener('input', () => { val.textContent = r.value; });
      wrap.append(head, val, r);
    }
    $params.appendChild(wrap);
  }
}

function readParamValues() {
  const out = {};
  for (const el of $params.querySelectorAll('[data-param-id]')) {
    out[el.dataset.paramId] = el.dataset.paramKind === 'number'
      ? Number(el.value) : el.value;
  }
  return out;
}

// construit le code final à envoyer à evaluate()
function buildFinalCode(codeMeta, sampleMeta) {
  const stripped = stripSamples(codeMeta.source);

  // ⚠ simple-quotes obligatoires : evaluate() interprète les double-quotes
  //   comme du mini-notation.
  const entries = Object.entries(sampleMeta.bindings)
    .map(([k, v]) => `${k}: '${String(v).replace(/'/g, "\\'")}'`)
    .join(', ');
  const samplesLine = `samples({ ${entries} })`;

  const values = readParamValues();
  const constsLine = (codeMeta.params || [])
    .map(p => `const ${p.id} = ${toLit(values[p.id])};`)
    .join('\n');

  return `${samplesLine}\n${constsLine}\n${stripped}`;
}

// applique les valeurs courantes en live (hot-swap Strudel) — seulement si on joue
function scheduleLive() {
  if (!playing) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(applyLive, 120);
}

async function applyLive() {
  try {
    const codeMeta   = findById(manifest.codes,   $code.value);
    const sampleMeta = findById(manifest.samples, $sample.value);
    if (!codeMeta || !sampleMeta) return;
    await window.evaluate(buildFinalCode(codeMeta, sampleMeta));
    setStatus('▶ en lecture', 'playing');
  } catch (e) {
    console.error('[ShaLoop] live apply failed', e);
    setStatus('erreur : ' + e.message, 'error');
  }
}

function loadManifest() {
  manifest = window.SHALOOP_DATA;
  if (!manifest) {
    setStatus('data.js manquant — exécuter ./bundle.sh', 'error');
    return;
  }
  for (const c of manifest.codes) {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.label;
    $code.appendChild(opt);
  }
  for (const s of manifest.samples) {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.label;
    $sample.appendChild(opt);
  }

  $code.addEventListener('change', () => {
    const meta = findById(manifest.codes, $code.value);
    if (meta) renderParams(meta);
    scheduleLive();
  });
  $sample.addEventListener('change', scheduleLive);

  // un seul listener délégué sur la zone params : couvre sliders + selects
  $params.addEventListener('input',  scheduleLive);
  $params.addEventListener('change', scheduleLive);

  if (manifest.codes.length) renderParams(manifest.codes[0]);
}

async function play() {
  if (playing) return;
  $play.disabled = true;

  if (!initialized) {
    setStatus('initialisation…');
    await window.initStrudel();
    initialized = true;
  }

  // si stop() a suspendu le contexte, on le réveille
  try {
    const ctx = window.getAudioContext?.();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
  } catch (e) { console.warn('resume threw', e); }

  const codeMeta   = findById(manifest.codes,   $code.value);
  const sampleMeta = findById(manifest.samples, $sample.value);
  if (!codeMeta || !sampleMeta) {
    setStatus('sélection invalide', 'error');
    $play.disabled = false;
    return;
  }

  try {
    const finalCode = buildFinalCode(codeMeta, sampleMeta);

    console.groupCollapsed('[ShaLoop] code envoyé à evaluate()');
    console.log(finalCode);
    console.groupEnd();

    await window.evaluate(finalCode);

    playing = true;
    document.body.classList.add('playing');
    setStatus('▶ en lecture', 'playing');
  } catch (e) {
    console.error(e);
    setStatus('erreur : ' + e.message, 'error');
  } finally {
    $play.disabled = false;
  }
}

function stop() {
  if (!initialized) return;
  clearTimeout(liveTimer);

  if (typeof window.hush === 'function') {
    try { window.hush(); } catch (e) { console.warn('hush threw', e); }
  }

  try {
    const ctx = window.getAudioContext?.();
    if (ctx && ctx.state === 'running') ctx.suspend();
  } catch (e) { console.warn('suspend threw', e); }

  playing = false;
  document.body.classList.remove('playing');
  setStatus('■ arrêté');
}

$play.addEventListener('click', play);
$stop.addEventListener('click', stop);

// boîte « à propos » (principes des musiques de transe)
const $about = document.getElementById('about');
document.getElementById('help').addEventListener('click', () => {
  if (typeof $about.showModal === 'function') $about.showModal();
  else $about.setAttribute('open', '');
});
$about.querySelector('.about-close').addEventListener('click', () => $about.close?.() || $about.removeAttribute('open'));
$about.addEventListener('click', (e) => {
  // clic sur la backdrop (en dehors du contenu) → ferme
  const r = $about.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
    $about.close?.();
  }
});

loadManifest();
