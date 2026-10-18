/* Genki SRS — vocabulario y kanji de Genki I y II con repetición espaciada.
   Sin dependencias. Estado en localStorage (clave STORE). */
(() => {
  'use strict';

  const D = window.GENKI_DATA;
  const H = 3600e3, DAY = 24 * H;
  // Intervalo hasta el siguiente repaso según la etapa (índice). Etapa 9 = dominada: sale de la rotación.
  const INTERVALS = [0, 4 * H, 8 * H, 1 * DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 120 * DAY];
  const MASTER = 9;
  const LEARNED = 5;          // etapa a partir de la cual una tarjeta cuenta como "aprendida"
  const UNLOCK_RATIO = 0.8;   // % de la lección aprendida para desbloquear la siguiente
  const CHUNK = 5;            // tarjetas nuevas que se presentan juntas antes de evaluarlas
  const STORE = 'genki-srs-v1';
  const TIERS = [
    { key: 'apr', name: 'Aprendiz', from: 1, to: 4, c: 'var(--tier-1)' },
    { key: 'con', name: 'Consolidada', from: 5, to: 6, c: 'var(--tier-2)' },
    { key: 'exp', name: 'Experta', from: 7, to: 8, c: 'var(--tier-3)' },
    { key: 'dom', name: 'Dominada', from: 9, to: 9, c: 'var(--tier-4)' },
  ];
  const LESSONS = {
    1: ['あたらしいともだち', 'Nuevos amigos'], 2: ['かいもの', 'De compras'], 3: ['デートの約束', 'Quedar para una cita'],
    4: ['初めてのデート', 'La primera cita'], 5: ['沖縄旅行', 'Viaje a Okinawa'], 6: ['ロバートさんの一日', 'Un día de Robert'],
    7: ['家族の写真', 'La foto familiar'], 8: ['バーベキュー', 'Barbacoa'], 9: ['かぶき', 'Kabuki'],
    10: ['冬休みの予定', 'Planes de invierno'], 11: ['休みのあと', 'Después de las vacaciones'], 12: ['病気', 'Enfermo'],
    13: ['アルバイト探し', 'Buscando trabajo'], 14: ['バレンタインデー', 'San Valentín'], 15: ['長野旅行', 'Viaje a Nagano'],
    16: ['忘れ物', 'Objetos olvidados'], 17: ['ぐちとうわさ話', 'Quejas y chismes'], 18: ['ジョンさんのアルバイト', 'El trabajo de John'],
    19: ['出迎え', 'Recibir al jefe'], 20: ['メアリーさんの買い物', 'Las compras de Mary'], 21: ['どろぼう', 'El ladrón'],
    22: ['日本の教育', 'La educación en Japón'], 23: ['別れ', 'Despedida'],
  };
  const MAX_LESSON = 23;

  // ---------------------------------------------------------------- tarjetas
  const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const CARDS = [];
  const BY_ID = {};
  D.vocab.forEach((d) => CARDS.push({ id: 'v' + d.i, kind: 'v', l: d.l, d }));
  D.kanji.forEach((d) => CARDS.push({ id: 'k' + d.i, kind: 'k', l: d.l, d }));
  CARDS.forEach((c) => { BY_ID[c.id] = c; });

  // Orden de presentación de tarjetas nuevas: por lección; dentro de cada lección, saludos y
  // conversación antes que lectura, y un kanji intercalado cada pocas palabras.
  const SEC = { G: 0, '会': 1, '読': 2 };
  const NEW_ORDER = [];
  for (let L = 1; L <= MAX_LESSON; L++) {
    const vs = CARDS.filter((c) => c.kind === 'v' && c.l === L)
      .sort((a, b) => (SEC[a.d.s] - SEC[b.d.s]) || (hash(a.id) - hash(b.id)));
    const ks = CARDS.filter((c) => c.kind === 'k' && c.l === L).sort((a, b) => a.d.i - b.d.i);
    const every = ks.length ? Math.max(2, Math.floor(vs.length / ks.length)) : Infinity;
    let ki = 0;
    vs.forEach((c, i) => { NEW_ORDER.push(c); if ((i + 1) % every === 0 && ki < ks.length) NEW_ORDER.push(ks[ki++]); });
    while (ki < ks.length) NEW_ORDER.push(ks[ki++]);
  }

  // ---------------------------------------------------------------- estado
  const defaultState = () => ({
    v: 1,
    cards: {},
    settings: { newPerDay: 15, furigana: 'auto', useful: false, kanji: true, autoplay: false, manualLesson: 1, introSeen: false },
    day: { key: '', newDone: 0, reviewed: 0, correct: 0 },
    streak: { last: '', count: 0 },
  });
  let state;
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        const def = defaultState();
        return { ...def, ...s, settings: { ...def.settings, ...(s.settings || {}) }, day: { ...def.day, ...(s.day || {}) }, streak: { ...def.streak, ...(s.streak || {}) } };
      }
    } catch (e) { /* sin almacenamiento */ }
    return defaultState();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { toast('No se pudo guardar el progreso'); } }
  state = load();

  const dayKey = (t = Date.now()) => { const d = new Date(t - 4 * H); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function rollDay() {
    const k = dayKey();
    if (state.day.key !== k) state.day = { key: k, newDone: 0, reviewed: 0, correct: 0 };
  }
  function touchStreak() {
    const today = dayKey();
    if (state.streak.last === today) return;
    state.streak.count = state.streak.last === dayKey(Date.now() - DAY) ? state.streak.count + 1 : 1;
    state.streak.last = today;
  }

  const st = (id) => state.cards[id];
  const stage = (id) => (state.cards[id] ? state.cards[id].s : -1);
  const isActive = (c) => !(c.kind === 'v' && c.d.e && !state.settings.useful) && !(c.kind === 'k' && !state.settings.kanji);
  const lessonCards = (L) => CARDS.filter((c) => c.l === L && isActive(c));
  function lessonProgress(L) {
    const cs = lessonCards(L);
    let learned = 0, seen = 0, mastered = 0;
    cs.forEach((c) => { const s = stage(c.id); if (s >= 0) seen++; if (s >= LEARNED) learned++; if (s >= MASTER) mastered++; });
    return { total: cs.length, seen, learned, mastered, ratio: cs.length ? learned / cs.length : 1 };
  }
  function autoLesson() {
    let L = 1;
    while (L < MAX_LESSON && lessonProgress(L).ratio >= UNLOCK_RATIO) L++;
    return L;
  }
  const unlocked = () => Math.max(autoLesson(), state.settings.manualLesson || 1);
  const dueCards = (t = Date.now()) => CARDS.filter((c) => { const s = st(c.id); return s && s.s < MASTER && s.due != null && s.due <= t && isActive(c); });
  const newAvailable = () => { const U = unlocked(); return NEW_ORDER.filter((c) => c.l <= U && !st(c.id) && isActive(c)); };
  const newLeftToday = () => { rollDay(); return Math.max(0, state.settings.newPerDay - state.day.newDone); };
  const tierOf = (s) => TIERS.find((t) => s >= t.from && s <= t.to);

  // ---------------------------------------------------------------- utilidades
  const $app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isKana = (ch) => /[぀-ヿ]/.test(ch);
  const KANJI_RE = /[一-鿿々]/;
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast fade-in'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }
  function fmtWait(ms) {
    if (ms < H) return `${Math.max(1, Math.round(ms / 60e3))} min`;
    if (ms < DAY) return `${Math.round(ms / H)} h`;
    return `${Math.round(ms / DAY)} d`;
  }
  const spoken = (r) => r.replace(/（[^）]*）|\([^)]*\)|[～〜…・]|＋.*$|\s.*$/g, '').split(/[/／]/)[0];

  // Furigana sólo sobre la parte con kanji (quita el okurigana común entre escritura y lectura).
  function furi(w, r) {
    if (/[（(]/.test(w)) return `<ruby>${esc(w)}<rt>${esc(r)}</rt></ruby>`;
    const rr = r.replace(/（[^）]*）/g, '');
    let a = 0; while (a < w.length && a < rr.length && w[a] === rr[a] && isKana(w[a])) a++;
    let b = 0; while (b < w.length - a && b < rr.length - a && w[w.length - 1 - b] === rr[rr.length - 1 - b] && isKana(w[w.length - 1 - b])) b++;
    const core = w.slice(a, w.length - b), rc = rr.slice(a, rr.length - b);
    if (!core || !rc || !KANJI_RE.test(core)) return esc(w);
    return esc(w.slice(0, a)) + `<ruby>${esc(core)}<rt>${esc(rc)}</rt></ruby>` + esc(w.slice(w.length - b));
  }
  function knownKanji(c) {
    // Genki escribe con kanji lo que ya se estudió; lo demás lleva furigana.
    const set = new Set();
    D.kanji.forEach((k) => {
      if (state.settings.kanji ? stage('k' + k.i) >= 3 : k.l < c.l) set.add(k.c);
    });
    return set;
  }
  function showFuri(c) {
    const m = state.settings.furigana;
    if (m === 'always') return true;
    if (m === 'never') return false;
    const known = knownKanji(c);
    return [...c.d.w].some((ch) => KANJI_RE.test(ch) && !known.has(ch));
  }
  function frontHTML(c) {
    if (c.kind === 'k') return { html: esc(c.d.c), cls: 'kanji-big' };
    const w = c.d.w || c.d.r;
    const html = c.d.w && showFuri(c) ? furi(c.d.w, c.d.r) : esc(w);
    return { html, cls: w.length > 7 ? 'long' : '' };
  }
  const plainJP = (c) => (c.kind === 'k' ? c.d.c : (c.d.w || c.d.r));

  let jaVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
    jaVoice = vs.find((v) => /Kyoko|O-ren|Otoya|Hattori/i.test(v.name)) || vs[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 0.85; if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  }
  const speechOf = (c) => (c.kind === 'k' ? (c.d.cp[0] ? c.d.cp[0][1] : (c.d.kun[0] || c.d.on[0])) : spoken(c.d.r));

  // ---------------------------------------------------------------- opción múltiple
  const parts = (s) => s.toLowerCase().split(/[;；]/).map((x) => x.replace(/\(.*?\)|（.*?）/g, '').trim()).filter(Boolean);
  function distractors(c, n = 3, reverse = false) {
    const mine = new Set(parts(c.d.es));
    const U = unlocked();
    const cands = CARDS.filter((o) => {
      if (o.kind !== c.kind || o.id === c.id || !isActive(o)) return false;
      if (parts(o.d.es).some((p) => mine.has(p))) return false;
      if (reverse && plainJP(o) === plainJP(c)) return false;
      return true;
    }).map((o) => {
      let score = Math.abs(o.l - c.l) * 2 + Math.random() * 4;
      if (o.l > U) score += 6;                                   // mejor distractores de lecciones ya vistas
      if (c.kind === 'v' && !!c.d.t !== !!o.d.t) score += 5;     // verbos con verbos
      if (c.kind === 'v' && c.d.t && c.d.t === o.d.t) score -= 1;
      if (c.kind === 'v' && /[.!?]$/.test(c.d.en) === /[.!?]$/.test(o.d.en)) score -= 3;   // expresiones con expresiones
      return { o, score };
    }).sort((a, b) => a.score - b.score);
    const out = [], seenTxt = new Set([reverse ? plainJP(c) : c.d.es]);
    for (const { o } of cands) {
      const txt = reverse ? plainJP(o) : o.d.es;
      if (seenTxt.has(txt)) continue;
      seenTxt.add(txt); out.push(o);
      if (out.length >= n) break;
    }
    return out;
  }

  // ---------------------------------------------------------------- sesión de estudio
  let S = null;
  function modeFor(c, relearn) {
    const s = Math.max(0, stage(c.id));
    if (relearn || s <= 1) return 'mc';
    if (c.kind === 'v' && s === 2) return 'mcr';    // dirección inversa: español → japonés
    if (s <= 2) return 'mc';
    return 'recall';
  }
  function startSession() {
    rollDay();
    const due = shuffle(dueCards());
    const news = newAvailable().slice(0, newLeftToday());
    const queue = due.map((c) => ({ id: c.id, step: 'quiz' }));
    for (let i = 0; i < news.length; i += CHUNK) {
      const chunk = news.slice(i, i + CHUNK);
      chunk.forEach((c) => queue.push({ id: c.id, step: 'intro' }));
      shuffle(chunk.slice()).forEach((c) => queue.push({ id: c.id, step: 'quiz' }));
    }
    if (!queue.length) return;
    S = { queue, i: 0, total: queue.length, correct: 0, wrong: 0, failed: new Set(), newCount: news.length, reviewCount: due.length, cur: null };
    document.body.classList.add('in-session');
    next();
  }
  function endSession() {
    document.body.classList.remove('in-session');
    S = null; render();
  }
  function next() {
    if (S.i >= S.queue.length) return renderSummary();
    const item = S.queue[S.i];
    const c = BY_ID[item.id];
    if (item.step === 'intro') {
      if (!st(c.id)) { state.cards[c.id] = { s: 0, due: Date.now(), reps: 0, lapses: 0 }; state.day.newDone++; save(); }
      S.cur = { item, c, phase: 'intro' };
      renderIntro();
      if (state.settings.autoplay) speak(speechOf(c));
      return;
    }
    const mode = modeFor(c, item.relearn);
    let options = null;
    if (mode === 'mc' || mode === 'mcr') options = shuffle([c, ...distractors(c, 3, mode === 'mcr')]);
    S.cur = { item, c, phase: 'q', mode, options, picked: null };
    renderQuiz();
    if (state.settings.autoplay && mode !== 'mcr') speak(speechOf(c));
  }
  function gradeCard(c, result) {
    const s = state.cards[c.id] || (state.cards[c.id] = { s: 0, due: Date.now(), reps: 0, lapses: 0 });
    const now = Date.now();
    s.reps++; s.last = now;
    rollDay();
    if (result === 'wrong') {
      if (!S.failed.has(c.id)) {
        if (s.s > 0) { s.lapses++; s.s = Math.max(1, s.s - 2); }
        S.failed.add(c.id); S.wrong++;
      }
      s.due = now;                              // si se cierra la app, sigue pendiente
      const at = Math.min(S.queue.length, S.i + 1 + 3 + Math.floor(Math.random() * 3));
      S.queue.splice(at, 0, { id: c.id, step: 'quiz', relearn: true });
      S.total++;
    } else {
      if (S.failed.has(c.id)) { if (s.s === 0) s.s = 1; }
      else { s.s = Math.min(MASTER, s.s + (result === 'easy' ? 2 : 1)); S.correct++; state.day.correct++; }
      s.due = s.s >= MASTER ? null : now + INTERVALS[s.s];
    }
    state.day.reviewed++;
    touchStreak();
    save();
  }

  // ---------------------------------------------------------------- vistas de sesión
  function topBar() {
    const pct = Math.round((S.i / Math.max(1, S.queue.length)) * 100);
    return `<div class="session-top">
      <button class="close" data-act="quit" aria-label="Salir">×</button>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="counter">${S.i}/${S.queue.length}</div>
    </div>`;
  }
  const kindPill = (c) => `<span class="pill ${c.kind === 'k' ? 'accent' : ''} kind">${c.kind === 'k' ? '漢字' : 'Vocabulario'}</span>`;
  const lessonPill = (c) => `<span class="pill lesson-tag">L${c.l}</span>`;
  function exampleHTML(d) {
    if (!d.x) return '';
    return `<div class="ex"><div class="jp">${esc(d.x)}</div><div class="src">${esc(d.xs)}</div></div>`;
  }
  const TYPE_LABEL = { u: 'verbo -u', ru: 'verbo -ru', irr: 'verbo irregular' };
  function answerHTML(c) {
    const d = c.d;
    if (c.kind === 'k') {
      return `<div class="answer">
        <div class="meaning">${esc(d.es)}</div>
        <div class="en">${esc(d.en)} · ${d.n} trazos · Genki ${d.b === 1 ? 'I' : 'II'} p.${d.p}</div>
        <dl class="readings">
          ${d.on.length ? `<dt>On</dt><dd>${esc(d.on.join('、'))}</dd>` : ''}
          ${d.kun.length ? `<dt>Kun</dt><dd>${esc(d.kun.join('、'))}</dd>` : ''}
        </dl>
        <div class="compounds">${d.cp.slice(0, 5).map(([w, r, m]) => `<div><span class="cw">${esc(w)}</span><span class="cr">${esc(r)}</span><span class="ce">${esc(m)}</span></div>`).join('')}</div>
        ${exampleHTML(d)}
      </div>`;
    }
    return `<div class="answer">
      ${d.w ? `<div class="reading">${esc(d.r)}</div>` : ''}
      <div class="meaning">${esc(d.es)}</div>
      <div class="en">${esc(d.en)}${d.t ? ` · ${TYPE_LABEL[d.t]}` : ''}</div>
      ${exampleHTML(d)}
    </div>`;
  }
  const nextLabel = (c, inc) => { const ns = Math.min(MASTER, stage(c.id) + inc); return ns >= MASTER ? 'dominada' : fmtWait(INTERVALS[ns]); };
  const speakBtn = `<button class="speak" data-act="speak">🔊 Escuchar</button>`;

  function renderIntro() {
    const { c } = S.cur;
    const f = frontHTML(c);
    const html = c.kind === 'v' && c.d.w ? furi(c.d.w, c.d.r) : f.html;
    $app.innerHTML = `${topBar()}
      <div class="flash fade-in">
        ${kindPill(c)}${lessonPill(c)}
        <div style="margin-top:2px"><span class="new-badge">NUEVA</span></div>
        <div class="prompt ${f.cls}">${html}</div>
        ${speakBtn}
        ${answerHTML(c)}
      </div>
      <div class="bottom-actions"><button class="btn" data-act="intro-ok">Entendido</button></div>`;
  }
  function renderQuiz() {
    const { c, mode, options, phase, picked } = S.cur;
    const f = frontHTML(c);
    let body = '';
    if (mode === 'mc' || mode === 'mcr') {
      const prompt = mode === 'mcr'
        ? `<div class="hint">¿Cómo se dice en japonés?</div><div class="prompt es">${esc(c.d.es)}</div>`
        : `<div class="hint">${c.kind === 'k' ? '¿Qué significa este kanji?' : '¿Qué significa?'}</div><div class="prompt ${f.cls}">${f.html}</div>`;
      const opts = options.map((o, i) => {
        let cls = 'opt';
        if (phase === 'a') { if (o.id === c.id) cls += ' right'; else if (i === picked) cls += ' wrong'; else cls += ' dim'; }
        if (mode === 'mcr') {
          const rd = o.kind === 'v' && o.d.w ? `<span class="rd">${esc(o.d.r)}</span>` : '';
          const label = o.kind === 'v' && o.d.w && showFuri(o) ? furi(o.d.w, o.d.r) : esc(plainJP(o));
          return `<button class="${cls} jp" data-opt="${i}" ${phase === 'a' ? 'disabled' : ''}>${label}${phase === 'a' ? rd : ''}</button>`;
        }
        return `<button class="${cls}" data-opt="${i}" ${phase === 'a' ? 'disabled' : ''}>${esc(o.d.es)}</button>`;
      }).join('');
      const ok = phase === 'a' && options[picked].id === c.id;
      body = `<div class="flash fade-in">${kindPill(c)}${lessonPill(c)}${prompt}
          ${phase === 'a' ? `${mode === 'mcr' ? `<div class="prompt ${f.cls}" style="margin-top:4px">${f.html}</div>` : ''}${speakBtn}` : ''}
          ${phase === 'a' ? `<div class="answer"><div class="verdict ${ok ? 'ok' : 'ko'}">${ok ? '¡Correcto!' : 'Incorrecto — volverá a salir'}</div></div>${answerHTML(c)}` : ''}
        </div>
        ${phase === 'q' ? `<div class="options">${opts}</div>` : `<div class="options">${opts}</div><div class="bottom-actions"><button class="btn" data-act="continue">Continuar</button></div>`}`;
    } else {
      body = `<div class="flash fade-in">${kindPill(c)}${lessonPill(c)}
          <div class="hint">Piensa el significado${c.kind === 'v' && c.d.w ? ' y la lectura' : ''}</div>
          <div class="prompt ${f.cls}">${f.html}</div>
          ${phase === 'a' ? speakBtn + answerHTML(c) : ''}
        </div>
        ${phase === 'q'
          ? `<div class="bottom-actions"><button class="btn" data-act="reveal">Mostrar respuesta</button></div>`
          : `<div class="grade">
              <button class="g-again" data-grade="wrong">Otra vez<small>no la sabía</small></button>
              <button class="g-good" data-grade="good">Bien<small>${nextLabel(c, 1)}</small></button>
              <button class="g-easy" data-grade="easy">Fácil<small>${nextLabel(c, 2)}</small></button>
            </div>`}`;
    }
    $app.innerHTML = topBar() + body;
  }
  function renderSummary() {
    const acc = S.correct + S.wrong ? Math.round((S.correct / (S.correct + S.wrong)) * 100) : 100;
    const U = unlocked();
    $app.innerHTML = `<div class="fade-in">
      <div class="summary-big">${acc}%</div>
      <p class="center muted">de aciertos a la primera</p>
      <div class="card">
        <div class="set-row"><span>Repasos</span><b>${S.reviewCount}</b></div>
        <div class="set-row"><span>Palabras nuevas</span><b>${S.newCount}</b></div>
        <div class="set-row"><span>A repasar pronto (falladas)</span><b>${S.failed.size}</b></div>
        <div class="set-row"><span>Racha</span><b>${state.streak.count} ${state.streak.count === 1 ? 'día' : 'días'}</b></div>
      </div>
      ${U > (S.startLesson || U) ? `<div class="card"><b>¡Lección ${U} desbloqueada!</b><div class="muted small">${esc(LESSONS[U][1])}</div></div>` : ''}
      <div class="bottom-actions"><button class="btn" data-act="done">Volver al inicio</button></div>
    </div>`;
  }

  // ---------------------------------------------------------------- pestañas
  let view = { tab: 'home', lesson: null };
  function render() {
    if (S) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === view.tab));
    if (view.tab === 'home') renderHome();
    else if (view.tab === 'lessons') view.lesson ? renderLesson(view.lesson) : renderLessons();
    else renderSettings();
    window.scrollTo(0, 0);
  }

  function tierBar(ids) {
    const counts = TIERS.map((t) => ids.filter((id) => { const s = stage(id); return s >= t.from && s <= t.to; }).length);
    const total = ids.length || 1;
    return `<div class="tiers">${TIERS.map((t, i) => `<i style="width:${(counts[i] / total) * 100}%;background:${t.c}"></i>`).join('')}</div>
      <div class="legend">${TIERS.map((t, i) => `<span style="--c:${t.c}">${t.name} ${counts[i]}</span>`).join('')}</div>`;
  }
  function renderHome() {
    rollDay();
    const now = Date.now();
    const due = dueCards(now).length;
    const newN = Math.min(newLeftToday(), newAvailable().length);
    const U = unlocked();
    const p = lessonProgress(U);
    const seenIds = Object.keys(state.cards).filter((id) => BY_ID[id] && isActive(BY_ID[id]));
    const upcoming = CARDS.filter((c) => { const s = st(c.id); return s && s.due != null && s.s < MASTER && isActive(c); }).map((c) => st(c.id).due).filter((t) => t > now).sort((a, b) => a - b);
    const next24 = upcoming.filter((t) => t <= now + DAY).length;
    const total = due + newN;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
    const target = Math.ceil(p.total * UNLOCK_RATIO);
    $app.innerHTML = `<div class="fade-in">
      <p class="muted small" style="margin:0">${new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>げんき <span class="muted" style="font-weight:600">SRS</span></h1>
      ${ios ? `<div class="card small"><b>Instálala en tu iPhone:</b> toca <b>Compartir</b> ⬆︎ y luego <b>Añadir a pantalla de inicio</b>. Así funciona sin conexión, como una app.</div>` : ''}
      ${!state.settings.introSeen ? `<div class="card small">
          <b>Cómo funciona.</b> Cada día ves palabras nuevas de la lección actual y repasas las que te tocan.
          Las nuevas se aprenden con opción múltiple; cuando ya las dominas, pasan a recuerdo activo (piensas la respuesta y te calificas).
          Si aciertas, el siguiente repaso se aleja (4 h → 8 h → 1 d → 2 d → 1 sem → 2 sem → 1 mes → 4 meses) hasta que la palabra queda <b>dominada</b> y deja de salir. Si fallas, retrocede y vuelve a salir enseguida.
          La siguiente lección se desbloquea cuando el 80% de la actual está <b>consolidada</b>.
          <div style="margin-top:10px"><button class="btn secondary" data-act="intro-dismiss" style="min-height:40px;font-size:15px">Entendido</button></div>
        </div>` : ''}
      <div class="hero">
        <div class="stat hl"><b>${due}</b><span>repasos pendientes</span></div>
        <div class="stat"><b>${newN}</b><span>nuevas para hoy</span></div>
      </div>
      <button class="btn" data-act="study" ${total ? '' : 'disabled'}>${total ? `Estudiar · ${total}` : 'Todo al día ✓'}</button>
      ${!total && upcoming.length ? `<p class="center muted small">Próximo repaso en ${fmtWait(upcoming[0] - now)}${state.day.newDone >= state.settings.newPerDay ? ' · ya viste tus palabras nuevas de hoy' : ''}</p>` : ''}
      <h2>Lección actual</h2>
      <div class="card">
        <div class="lesson-now"><b>Lección ${U} · <span class="jp">${esc(LESSONS[U][0])}</span></b><span class="muted small">${Math.round(p.ratio * 100)}%</span></div>
        <div class="muted small" style="margin-bottom:8px">${esc(LESSONS[U][1])} · Genki ${U <= 12 ? 'I' : 'II'}</div>
        <div class="progress"><i style="width:${Math.min(100, (p.learned / Math.max(1, target)) * 100)}%"></i></div>
        <div class="muted small" style="margin-top:8px">${p.learned} de ${target} consolidadas para desbloquear la lección ${Math.min(MAX_LESSON, U + 1)} · ${p.seen}/${p.total} vistas</div>
      </div>
      <h2>Tu progreso</h2>
      <div class="card">
        <div class="row" style="text-align:center">
          <div><b style="font-size:22px">${seenIds.length}</b><div class="muted small">vistas</div></div>
          <div><b style="font-size:22px">${state.day.reviewed}</b><div class="muted small">respuestas hoy</div></div>
          <div><b style="font-size:22px">${state.streak.last === dayKey() || state.streak.last === dayKey(now - DAY) ? state.streak.count : 0}</b><div class="muted small">días de racha</div></div>
        </div>
        ${seenIds.length ? tierBar(seenIds) : ''}
        <div class="muted small" style="margin-top:8px">${next24} repasos en las próximas 24 h</div>
      </div>
    </div>`;
  }

  function lessonStats(L) {
    const cs = lessonCards(L);
    return { v: cs.filter((c) => c.kind === 'v').length, k: cs.filter((c) => c.kind === 'k').length, p: lessonProgress(L) };
  }
  function renderLessons() {
    const U = unlocked();
    const row = (L) => {
      const s = lessonStats(L); const locked = L > U;
      return `<button class="lesson-row ${locked ? 'locked' : ''}" data-lesson="${L}">
        <div class="lesson-num">${locked ? '🔒' : L}</div>
        <div class="grow">
          <div class="title"><span class="jp">${esc(LESSONS[L][0])}</span></div>
          <div class="meta">${esc(LESSONS[L][1])} · ${s.v} palabras${s.k ? ` · ${s.k} kanji` : ''}</div>
          <div class="progress"><i style="width:${s.p.ratio * 100}%"></i></div>
        </div>
      </button>`;
    };
    let html = `<div class="fade-in"><h1>Lecciones</h1><p class="sub">Avanzas como en Genki: cada lección se abre al consolidar el 80% de la anterior.</p>`;
    html += `<h2 class="book-head">Genki I</h2>`;
    for (let L = 1; L <= 12; L++) html += row(L);
    html += `<h2 class="book-head">Genki II</h2>`;
    for (let L = 13; L <= MAX_LESSON; L++) html += row(L);
    $app.innerHTML = html + '</div>';
  }
  function renderLesson(L) {
    const cs = lessonCards(L);
    const dot = (c) => { const s = stage(c.id); const t = s >= 1 ? tierOf(s) : null; return `<span class="dot" style="${t ? `background:${t.c};border-color:${t.c}` : s === 0 ? 'background:var(--ink-3)' : ''}"></span>`; };
    const vs = cs.filter((c) => c.kind === 'v').sort((a, b) => (SEC[a.d.s] - SEC[b.d.s]) || a.d.r.localeCompare(b.d.r, 'ja'));
    const ks = cs.filter((c) => c.kind === 'k');
    const p = lessonProgress(L);
    const locked = L > unlocked();
    $app.innerHTML = `<div class="fade-in">
      <button class="btn ghost" data-act="back" style="width:auto;padding-left:0">‹ Lecciones</button>
      <h1>Lección ${L} <span class="jp">${esc(LESSONS[L][0])}</span></h1>
      <p class="sub">${esc(LESSONS[L][1])} · ${p.learned}/${p.total} consolidadas${locked ? ' · bloqueada' : ''}</p>
      ${tierBar(cs.map((c) => c.id))}
      ${ks.length ? `<h2>Kanji</h2><div class="card word-list">${ks.map((c) => `<div class="w"><span class="jpw" style="font-family:var(--jp);font-size:26px">${esc(c.d.c)}</span><span class="es">${esc(c.d.es)}<br><span class="rd">${esc([...c.d.on, ...c.d.kun].join('、'))}</span></span>${dot(c)}</div>`).join('')}</div>` : ''}
      <h2>Vocabulario</h2>
      <div class="card word-list">${vs.map((c) => `<div class="w"><div><div class="jpw">${esc(c.d.w || c.d.r)}</div>${c.d.w ? `<div class="rd">${esc(c.d.r)}</div>` : ''}</div><span class="es">${esc(c.d.es)}</span>${dot(c)}</div>`).join('')}</div>
    </div>`;
  }

  function renderSettings() {
    const s = state.settings;
    const sel = (name, opts, val) => `<select data-set="${name}">${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    const sw = (name, val) => `<label class="switch"><input type="checkbox" data-set="${name}" ${val ? 'checked' : ''}><span></span></label>`;
    $app.innerHTML = `<div class="fade-in">
      <h1>Ajustes</h1>
      <h2>Estudio</h2>
      <div class="card">
        <div class="set-row"><div><label>Palabras nuevas por día</label><div class="desc">Los repasos no tienen límite</div></div>
          ${sel('newPerDay', [5, 10, 15, 20, 25, 30, 40, 50].map((n) => [n, n]), s.newPerDay)}</div>
        <div class="set-row"><div><label>Furigana</label><div class="desc">"Auto": sólo sobre kanji que aún no has consolidado</div></div>
          ${sel('furigana', [['auto', 'Auto'], ['always', 'Siempre'], ['never', 'Nunca']], s.furigana)}</div>
        <div class="set-row"><div><label>Tarjetas de kanji</label><div class="desc">Los 317 kanji de Genki (desde la lección 3)</div></div>${sw('kanji', s.kanji)}</div>
        <div class="set-row"><div><label>Expresiones útiles</label><div class="desc">Vocabulario extra de las secciones "Useful Expressions" (277 palabras)</div></div>${sw('useful', s.useful)}</div>
        <div class="set-row"><div><label>Audio automático</label><div class="desc">Pronuncia cada tarjeta al mostrarla</div></div>${sw('autoplay', s.autoplay)}</div>
      </div>
      <h2>Lecciones</h2>
      <div class="card">
        <div class="set-row"><div><label>Desbloquear hasta</label><div class="desc">Si ya conoces lecciones anteriores. La lección actual automática es la ${autoLesson()}.</div></div>
          ${sel('manualLesson', Array.from({ length: MAX_LESSON }, (_, i) => [i + 1, `L${i + 1}`]), s.manualLesson)}</div>
      </div>
      <h2>Copia de seguridad</h2>
      <div class="card">
        <p class="small muted" style="margin-top:0">El progreso se guarda sólo en este dispositivo. Exporta una copia de vez en cuando.</p>
        <div class="row"><button class="btn secondary" data-act="export">Exportar</button><button class="btn secondary" data-act="import">Importar</button></div>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
        <div style="margin-top:10px"><button class="btn ghost" data-act="reset" style="color:var(--bad)">Borrar todo el progreso</button></div>
      </div>
      <p class="small muted center">Datos: Genki I y II (3.ª ed.) · 1.774 palabras · 317 kanji</p>
    </div>`;
  }

  // ---------------------------------------------------------------- eventos
  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    view = { tab: b.dataset.tab, lesson: null }; render();
  });
  $app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-opt],[data-grade],[data-lesson]');
    if (!t) return;
    if (t.dataset.lesson) { view.lesson = +t.dataset.lesson; return render(); }
    if (t.dataset.opt != null && S && S.cur.phase === 'q') {
      const i = +t.dataset.opt; const ok = S.cur.options[i].id === S.cur.c.id;
      S.cur.picked = i; S.cur.phase = 'a';
      gradeCard(S.cur.c, ok ? 'good' : 'wrong');
      renderQuiz();
      if (navigator.vibrate) navigator.vibrate(ok ? 10 : [30, 40, 30]);
      if (state.settings.autoplay && S.cur.mode === 'mcr') speak(speechOf(S.cur.c));
      return;
    }
    if (t.dataset.grade && S) { gradeCard(S.cur.c, t.dataset.grade); S.i++; return next(); }
    switch (t.dataset.act) {
      case 'study': S = null; startSession(); if (S) S.startLesson = unlocked(); break;
      case 'quit': if (S && S.i > 0) save(); endSession(); break;
      case 'intro-ok': S.i++; next(); break;
      case 'continue': S.i++; next(); break;
      case 'reveal': S.cur.phase = 'a'; renderQuiz(); if (state.settings.autoplay) speak(speechOf(S.cur.c)); break;
      case 'speak': speak(speechOf(S.cur.c)); break;
      case 'done': endSession(); break;
      case 'back': view.lesson = null; render(); break;
      case 'intro-dismiss': state.settings.introSeen = true; save(); render(); break;
      case 'export': exportData(); break;
      case 'import': document.getElementById('importFile').click(); break;
      case 'reset':
        if (confirm('¿Borrar todo tu progreso? Esta acción no se puede deshacer.')) { state = defaultState(); save(); render(); toast('Progreso borrado'); }
        break;
      default: break;
    }
  });
  $app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'importFile') return importData(t.files[0]);
    const key = t.dataset.set; if (!key) return;
    const s = state.settings;
    if (t.type === 'checkbox') s[key] = t.checked;
    else if (key === 'newPerDay' || key === 'manualLesson') s[key] = +t.value;
    else s[key] = t.value;
    save(); render(); toast('Guardado');
  });
  function exportData() {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `genki-srs-${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importData(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!s || typeof s.cards !== 'object') throw new Error('formato');
        localStorage.setItem(STORE, JSON.stringify(s)); state = load(); render(); toast('Progreso importado');
      } catch (err) { toast('Archivo no válido'); }
    };
    r.readAsText(file);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S) render(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  render();
  window.__genki = { state: () => state, cur: () => S && S.cur, CARDS, unlocked, dueCards, newAvailable }; // para depuración
})();
