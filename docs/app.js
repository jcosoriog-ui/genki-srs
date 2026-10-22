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
  const SUGGEST_RATIO = 0.8;  // % consolidado de una lección para sugerir pasar a la siguiente
  const CHUNK = 5;            // tarjetas nuevas que se presentan juntas antes de evaluarlas
  const PRACTICE_CHUNK = 10;  // tarjetas por bloque de práctica extra cuando no quedan repasos ni nuevas
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
  const KANJI_BY_CHAR = {};
  D.kanji.forEach((k) => { KANJI_BY_CHAR[k.c] = k; });
  // Palabras del vocabulario que contienen cada kanji (ordenadas por lección).
  const VOCAB_BY_KANJI = {};
  D.vocab.slice().sort((a, b) => a.l - b.l).forEach((v) => {
    new Set([...(v.w || '')]).forEach((ch) => { if (KANJI_BY_CHAR[ch]) (VOCAB_BY_KANJI[ch] = VOCAB_BY_KANJI[ch] || []).push(v); });
  });

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
    settings: { furigana: 'auto', useful: false, autoplay: false, introSeen: false },
    study: { type: 'mix', lessons: [] },
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
        return { ...def, ...s, settings: { ...def.settings, ...(s.settings || {}) }, study: { ...def.study, ...(s.study || {}) }, day: { ...def.day, ...(s.day || {}) }, streak: { ...def.streak, ...(s.streak || {}) } };
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
  const isActive = (c) => !(c.kind === 'v' && c.d.e && !state.settings.useful);
  const lessonCards = (L) => CARDS.filter((c) => c.l === L && isActive(c));
  function lessonProgress(L) {
    const cs = lessonCards(L);
    let learned = 0, seen = 0, mastered = 0;
    cs.forEach((c) => { const s = stage(c.id); if (s >= 0) seen++; if (s >= LEARNED) learned++; if (s >= MASTER) mastered++; });
    return { total: cs.length, seen, learned, mastered, ratio: cs.length ? learned / cs.length : 1 };
  }
  // Lección sugerida: la primera que aún no tiene el 80% consolidado (no bloquea nada).
  function suggestedLesson() {
    let L = 1;
    while (L < MAX_LESSON && lessonProgress(L).ratio >= SUGGEST_RATIO) L++;
    return L;
  }
  const TYPES = { vocab: 'Vocabulario', kanji: 'Kanji', mix: 'Ambos' };
  const KANJI_LESSONS = new Set(D.kanji.map((k) => k.l));
  const typeOk = (c, type = state.study.type) => type === 'mix' || (type === 'vocab' ? c.kind === 'v' : c.kind === 'k');
  const selLessons = () => state.study.lessons.filter((L) => state.study.type !== 'kanji' || KANJI_LESSONS.has(L));
  const inSel = (c) => isActive(c) && typeOk(c) && selLessons().includes(c.l);
  const isDue = (c, t = Date.now()) => { const s = st(c.id); return !!(s && s.s < MASTER && s.due != null && s.due <= t); };
  const dueCards = (t = Date.now()) => CARDS.filter((c) => isActive(c) && isDue(c, t));
  const selDue = (t = Date.now()) => CARDS.filter((c) => inSel(c) && isDue(c, t));
  const selNew = () => NEW_ORDER.filter((c) => inSel(c) && !st(c.id));
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
      if (stage('k' + k.i) >= 3) set.add(k.c);
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
    const U = Math.max(c.l, ...selLessons(), 1);
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
  // La sesión no tiene límite: primero repasos pendientes de la selección, luego bloques de
  // tarjetas nuevas y, cuando ya no quedan, práctica extra. Termina cuando el estudiante sale.
  let S = null;
  function modeFor(c, relearn) {
    const s = Math.max(0, stage(c.id));
    if (relearn || s <= 1) return 'mc';
    if (c.kind === 'v' && s === 2) return 'mcr';    // dirección inversa: español → japonés
    if (s <= 2) return 'mc';
    return 'recall';
  }
  function refill() {
    const pending = new Set(S.queue.slice(S.i).map((q) => q.id));
    const due = shuffle(selDue().filter((c) => !pending.has(c.id)));
    if (due.length) {
      due.forEach((c) => S.queue.push({ id: c.id, step: 'quiz' }));
      S.reviewCount += due.length;
      return true;
    }
    const news = selNew().filter((c) => !pending.has(c.id)).slice(0, CHUNK);
    if (news.length) {
      news.forEach((c) => S.queue.push({ id: c.id, step: 'intro' }));
      shuffle(news.slice()).forEach((c) => S.queue.push({ id: c.id, step: 'quiz' }));
      S.newCount += news.length;
      return true;
    }
    // Práctica extra: lo menos consolidado primero. No adelanta intervalos; si fallas, sí retrocede.
    const pick = () => CARDS.filter((c) => inSel(c) && st(c.id) && !pending.has(c.id) && !S.practiced.has(c.id))
      .sort((x, y) => (stage(x.id) - stage(y.id)) || ((st(x.id).due || Infinity) - (st(y.id).due || Infinity)));
    let pool = pick();
    if (!pool.length && S.practiced.size) { S.practiced.clear(); pool = pick(); }
    if (!pool.length) return false;
    shuffle(pool.slice(0, PRACTICE_CHUNK)).forEach((c) => { S.practiced.add(c.id); S.queue.push({ id: c.id, step: 'quiz', practice: true }); });
    return true;
  }
  function startSession() {
    rollDay();
    S = { queue: [], i: 0, answered: 0, correct: 0, wrong: 0, failed: new Set(), practiced: new Set(), newCount: 0, reviewCount: 0, practiceCount: 0, cur: null };
    if (!refill()) { S = null; toast('No hay tarjetas en esta selección'); return; }
    document.body.classList.add('in-session');
    next();
  }
  function endSession() {
    document.body.classList.remove('in-session');
    S = null; render();
  }
  function next() {
    if (S.i >= S.queue.length && !refill()) return renderSummary();
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
  function gradeCard(item, result) {
    const c = BY_ID[item.id];
    const s = state.cards[c.id] || (state.cards[c.id] = { s: 0, due: Date.now(), reps: 0, lapses: 0 });
    const now = Date.now();
    s.reps++; s.last = now;
    rollDay();
    S.answered++;
    if (item.practice && !item.relearn) S.practiceCount++;
    if (result === 'wrong') {
      if (!S.failed.has(c.id)) {
        if (s.s > 0) { s.lapses++; s.s = Math.max(1, s.s - 2); }
        S.failed.add(c.id); S.wrong++;
      }
      s.due = now;                              // si se cierra la app, sigue pendiente
      const at = Math.min(S.queue.length, S.i + 1 + 3 + Math.floor(Math.random() * 3));
      S.queue.splice(at, 0, { id: c.id, step: 'quiz', relearn: true });
    } else if (S.failed.has(c.id)) {
      if (s.s === 0) s.s = 1;
      s.due = now + INTERVALS[s.s];
    } else {
      S.correct++; state.day.correct++;
      if (!item.practice) {
        s.s = Math.min(MASTER, s.s + (result === 'easy' ? 2 : 1));
        s.due = s.s >= MASTER ? null : now + INTERVALS[s.s];
      }
    }
    state.day.reviewed++;
    touchStreak();
    save();
  }

  // ---------------------------------------------------------------- vistas de sesión
  function topBar() {
    const pendingDue = S.queue.slice(S.i).filter((q) => q.step === 'quiz' && !q.relearn && !q.practice && st(q.id) && st(q.id).s > 0).length;
    const item = S.queue[S.i];
    const label = item && item.practice ? 'práctica extra' : pendingDue ? `${pendingDue} repasos por delante` : 'aprendiendo';
    return `<div class="session-top">
      <button class="close" data-act="quit" aria-label="Terminar">×</button>
      <div class="session-info"><b>${S.answered}</b> respondidas · <span class="muted">${label}</span></div>
      <button class="end-btn" data-act="quit">Terminar</button>
    </div>`;
  }
  const kindPill = (c) => `<span class="pill ${c.kind === 'k' ? 'accent' : ''} kind">${c.kind === 'k' ? '漢字' : 'Vocabulario'}</span>`;
  const lessonPill = (c) => `<span class="pill lesson-tag">L${c.l}</span>`;
  // Resalta en el texto los caracteres indicados (kanji estudiado) o la palabra completa.
  function hl(text, target) {
    if (!target) return esc(text);
    if (target.length === 1) return [...text].map((ch) => (ch === target ? `<b class="hl">${esc(ch)}</b>` : esc(ch))).join('');
    const i = text.indexOf(target);
    if (i >= 0) return esc(text.slice(0, i)) + `<b class="hl">${esc(target)}</b>` + esc(text.slice(i + target.length));
    // Forma conjugada: resalta los kanji de la palabra.
    const ks = new Set([...target].filter((ch) => KANJI_RE.test(ch)));
    return [...text].map((ch) => (ks.has(ch) ? `<b class="hl">${esc(ch)}</b>` : esc(ch))).join('');
  }
  function exampleHTML(d, target) {
    if (!d.x) return '';
    return `<div class="ex"><div class="ex-label">Oración del libro</div><div class="jp">${hl(d.x, target)}</div><div class="src">${esc(d.xs)}</div></div>`;
  }
  const TYPE_LABEL = { u: 'verbo -u', ru: 'verbo -ru', irr: 'verbo irregular' };
  function kanjiExamplesHTML(d) {
    const cps = d.cp.map(([w, r, m]) => `<div><span class="cw">${hl(w, d.c)}</span><span class="cr">${esc(r)}</span><span class="ce">${esc(m)}</span></div>`).join('');
    const inTable = new Set(d.cp.map(([w]) => w));
    const voc = (VOCAB_BY_KANJI[d.c] || []).filter((v) => !inTable.has(v.w) && (!v.e || state.settings.useful));
    const MAXV = 8;
    const vhtml = voc.slice(0, MAXV).map((v) => `<div><span class="cw">${hl(v.w, d.c)}</span><span class="cr">${esc(v.r)}</span><span class="ce">${esc(v.es)} <span class="lnum">L${v.l}</span></span></div>`).join('');
    return `<div class="sec-label">Ejemplos del libro (tabla de kanji)</div>
      <div class="compounds">${cps}</div>
      ${voc.length ? `<div class="sec-label">En tu vocabulario de Genki</div><div class="compounds">${vhtml}</div>${voc.length > MAXV ? `<div class="muted small" style="margin-top:4px">y ${voc.length - MAXV} palabras más</div>` : ''}` : ''}`;
  }
  function kanjiBreakdownHTML(d) {
    const ks = [...new Set([...(d.w || '')])].map((ch) => KANJI_BY_CHAR[ch]).filter(Boolean);
    if (!ks.length) return '';
    return `<div class="kbreak">${ks.map((k) => `<div class="kb"><span class="kc">${esc(k.c)}</span><span><b>${esc(k.es)}</b><br><span class="cr">${esc([...k.on, ...k.kun].slice(0, 4).join('、'))} · L${k.l}</span></span></div>`).join('')}</div>`;
  }
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
        ${kanjiExamplesHTML(d)}
        ${exampleHTML(d, d.c)}
      </div>`;
    }
    return `<div class="answer">
      ${d.w ? `<div class="reading">${esc(d.r)}</div>` : ''}
      <div class="meaning">${esc(d.es)}</div>
      <div class="en">${esc(d.en)}${d.t ? ` · ${TYPE_LABEL[d.t]}` : ''}</div>
      ${kanjiBreakdownHTML(d)}
      ${exampleHTML(d, d.w)}
    </div>`;
  }
  const nextLabel = (c, inc) => { const ns = Math.min(MASTER, stage(c.id) + inc); return ns >= MASTER ? 'dominada' : fmtWait(INTERVALS[ns]); };
  const speakBtn = `<button class="speak" data-act="speak">🔊 Escuchar</button>`;
  const practiceNote = () => (S.cur.item.practice && !S.cur.item.relearn ? `<div class="practice-note">Práctica extra: acertar no cambia tus intervalos; fallar sí.</div>` : '');

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
    const { c, mode, options, phase, picked, item } = S.cur;
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
          ${practiceNote()}
        </div>
        ${phase === 'q' ? `<div class="options">${opts}</div>` : `<div class="options">${opts}</div><div class="bottom-actions"><button class="btn" data-act="continue">Continuar</button></div>`}`;
    } else {
      const practice = item.practice && !item.relearn;
      body = `<div class="flash fade-in">${kindPill(c)}${lessonPill(c)}
          <div class="hint">Piensa el significado${c.kind === 'v' && c.d.w ? ' y la lectura' : ''}</div>
          <div class="prompt ${f.cls}">${f.html}</div>
          ${phase === 'a' ? speakBtn + answerHTML(c) : ''}
          ${practiceNote()}
        </div>
        ${phase === 'q'
          ? `<div class="bottom-actions"><button class="btn" data-act="reveal">Mostrar respuesta</button></div>`
          : practice
            ? `<div class="grade two">
                <button class="g-again" data-grade="wrong">Otra vez<small>no la sabía</small></button>
                <button class="g-good" data-grade="good">La sabía<small>sin cambios</small></button>
              </div>`
            : `<div class="grade">
                <button class="g-again" data-grade="wrong">Otra vez<small>no la sabía</small></button>
                <button class="g-good" data-grade="good">Bien<small>${nextLabel(c, 1)}</small></button>
                <button class="g-easy" data-grade="easy">Fácil<small>${nextLabel(c, 2)}</small></button>
              </div>`}`;
    }
    $app.innerHTML = topBar() + body;
  }
  function renderSummary() {
    if (!S.answered && !S.newCount) return endSession();
    const acc = S.correct + S.wrong ? Math.round((S.correct / (S.correct + S.wrong)) * 100) : 100;
    $app.innerHTML = `<div class="fade-in">
      <div class="summary-big">${acc}%</div>
      <p class="center muted">de aciertos a la primera</p>
      <div class="card">
        <div class="set-row"><span>Respuestas</span><b>${S.answered}</b></div>
        <div class="set-row"><span>Repasos</span><b>${S.reviewCount}</b></div>
        <div class="set-row"><span>Tarjetas nuevas</span><b>${S.newCount}</b></div>
        ${S.practiceCount ? `<div class="set-row"><span>Práctica extra</span><b>${S.practiceCount}</b></div>` : ''}
        <div class="set-row"><span>Falladas (volverán pronto)</span><b>${S.failed.size}</b></div>
        <div class="set-row"><span>Racha</span><b>${state.streak.count} ${state.streak.count === 1 ? 'día' : 'días'}</b></div>
      </div>
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
  }

  function tierBar(ids) {
    const counts = TIERS.map((t) => ids.filter((id) => { const s = stage(id); return s >= t.from && s <= t.to; }).length);
    const total = ids.length || 1;
    return `<div class="tiers">${TIERS.map((t, i) => `<i style="width:${(counts[i] / total) * 100}%;background:${t.c}"></i>`).join('')}</div>
      <div class="legend">${TIERS.map((t, i) => `<span style="--c:${t.c}">${t.name} ${counts[i]}</span>`).join('')}</div>`;
  }
  function pickerHTML() {
    const type = state.study.type;
    const sel = new Set(state.study.lessons);
    const chip = (L) => {
      const off = type === 'kanji' && !KANJI_LESSONS.has(L);
      const p = lessonProgress(L);
      return `<button class="chip ${sel.has(L) && !off ? 'on' : ''}" data-chip="${L}" ${off ? 'disabled' : ''} aria-pressed="${sel.has(L) && !off}">
        ${L}<i style="width:${Math.round(p.ratio * 100)}%"></i></button>`;
    };
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const sug = suggestedLesson();
    return `<div class="card picker">
      <div class="seg" role="tablist">${Object.entries(TYPES).map(([k, t]) => `<button class="${type === k ? 'on' : ''}" data-type="${k}">${t}</button>`).join('')}</div>
      <div class="chips-head"><span>Genki I</span><span class="muted small">${type === 'kanji' ? 'los kanji empiezan en la L3' : ''}</span></div>
      <div class="chips">${range(1, 12).map(chip).join('')}</div>
      <div class="chips-head"><span>Genki II</span></div>
      <div class="chips">${range(13, MAX_LESSON).map(chip).join('')}</div>
      <div class="quick">
        <button data-act="sel-suggested">Sugerida (L${sug})</button>
        ${sug > 1 ? `<button data-act="sel-upto">L1–L${sug}</button>` : ''}
        <button data-act="sel-all">Todas</button>
        <button data-act="sel-none">Ninguna</button>
      </div>
    </div>`;
  }
  function renderHome() {
    rollDay();
    const now = Date.now();
    const lessons = selLessons();
    const due = selDue(now).length;
    const newN = selNew().length;
    const dueOther = dueCards(now).length - due;
    const sug = suggestedLesson();
    const p = lessonProgress(sug);
    const seenIds = Object.keys(state.cards).filter((id) => BY_ID[id] && isActive(BY_ID[id]));
    const upcoming = CARDS.filter((c) => { const s = st(c.id); return s && s.due != null && s.s < MASTER && isActive(c); }).map((c) => st(c.id).due).filter((t) => t > now).sort((a, b) => a - b);
    const next24 = upcoming.filter((t) => t <= now + DAY).length;
    const anyCards = CARDS.some(inSel);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
    const target = Math.ceil(p.total * SUGGEST_RATIO);
    const selText = lessons.length ? `${TYPES[state.study.type]} · ${lessons.length === 1 ? `lección ${lessons[0]}` : `lecciones ${compactLessons(lessons)}`}` : 'Elige al menos una lección';
    $app.innerHTML = `<div class="fade-in">
      <p class="muted small" style="margin:0">${new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>げんき <span class="muted" style="font-weight:600">SRS</span></h1>
      ${ios ? `<div class="card small"><b>Instálala en tu iPhone:</b> toca <b>Compartir</b> ⬆︎ y luego <b>Añadir a pantalla de inicio</b>. Así funciona sin conexión, como una app.</div>` : ''}
      ${!state.settings.introSeen ? `<div class="card small">
          <b>Cómo funciona.</b> Elige qué estudiar (vocabulario, kanji o ambos) y de qué lecciones. Primero repasas lo que te toca y luego aprendes tarjetas nuevas, sin límite: sigue hasta que pulses <b>Terminar</b>.
          Las nuevas se aprenden con opción múltiple; cuando ya las dominas, pasan a recuerdo activo (piensas la respuesta y te calificas).
          Si aciertas, el siguiente repaso se aleja (4 h → 8 h → 1 d → 2 d → 1 sem → 2 sem → 1 mes → 4 meses) hasta que la tarjeta queda <b>dominada</b> y deja de salir. Si fallas, retrocede y vuelve a salir enseguida.
          <div style="margin-top:10px"><button class="btn secondary" data-act="intro-dismiss" style="min-height:40px;font-size:15px">Entendido</button></div>
        </div>` : ''}
      <h2>¿Qué quieres estudiar?</h2>
      ${pickerHTML()}
      <div class="hero">
        <div class="stat hl"><b>${due}</b><span>repasos pendientes</span></div>
        <div class="stat"><b>${newN}</b><span>tarjetas nuevas</span></div>
      </div>
      <button class="btn" data-act="study" ${anyCards ? '' : 'disabled'}>${anyCards ? (due || newN ? 'Estudiar' : 'Practicar') : 'Elige lecciones'}</button>
      <p class="center muted small">${esc(selText)}${!due && !newN && anyCards ? ' · todo al día: puedes hacer práctica extra' : ''}</p>
      ${dueOther > 0 ? `<p class="center small" style="margin-top:-6px">Tienes <b>${dueOther}</b> repasos pendientes en otras lecciones · <button class="link" data-act="sel-due">incluirlas</button></p>` : ''}
      <h2>Lección sugerida</h2>
      <div class="card">
        <div class="lesson-now"><b>Lección ${sug} · <span class="jp">${esc(LESSONS[sug][0])}</span></b><span class="muted small">${Math.round(p.ratio * 100)}%</span></div>
        <div class="muted small" style="margin-bottom:8px">${esc(LESSONS[sug][1])} · Genki ${sug <= 12 ? 'I' : 'II'}</div>
        <div class="progress"><i style="width:${Math.min(100, (p.learned / Math.max(1, target)) * 100)}%"></i></div>
        <div class="muted small" style="margin-top:8px">${p.learned} de ${target} consolidadas para sugerirte la lección ${Math.min(MAX_LESSON, sug + 1)} · ${p.seen}/${p.total} vistas</div>
      </div>
      <h2>Tu progreso</h2>
      <div class="card">
        <div class="row" style="text-align:center">
          <div><b style="font-size:22px">${seenIds.length}</b><div class="muted small">vistas</div></div>
          <div><b style="font-size:22px">${state.day.reviewed}</b><div class="muted small">respuestas hoy</div></div>
          <div><b style="font-size:22px">${state.streak.last === dayKey() || state.streak.last === dayKey(now - DAY) ? state.streak.count : 0}</b><div class="muted small">días de racha</div></div>
        </div>
        ${seenIds.length ? tierBar(seenIds) : ''}
        <div class="muted small" style="margin-top:8px">${state.day.newDone} nuevas hoy · ${next24} repasos en las próximas 24 h</div>
      </div>
    </div>`;
  }
  function compactLessons(ls) {
    const out = []; let a = ls[0], b = ls[0];
    for (const L of ls.slice(1).concat([null])) {
      if (L === b + 1) { b = L; continue; }
      out.push(a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`);
      a = b = L;
    }
    return out.join(', ');
  }

  function lessonStats(L) {
    const cs = lessonCards(L);
    return { v: cs.filter((c) => c.kind === 'v').length, k: cs.filter((c) => c.kind === 'k').length, p: lessonProgress(L) };
  }
  function renderLessons() {
    const sug = suggestedLesson();
    const row = (L) => {
      const s = lessonStats(L);
      return `<button class="lesson-row" data-lesson="${L}">
        <div class="lesson-num">${L}</div>
        <div class="grow">
          <div class="title"><span class="jp">${esc(LESSONS[L][0])}</span>${L === sug ? ' <span class="pill accent">sugerida</span>' : ''}</div>
          <div class="meta">${esc(LESSONS[L][1])} · ${s.v} palabras${s.k ? ` · ${s.k} kanji` : ''}</div>
          <div class="progress"><i style="width:${s.p.ratio * 100}%"></i></div>
        </div>
      </button>`;
    };
    let html = `<div class="fade-in"><h1>Lecciones</h1><p class="sub">Todas están abiertas. La barra muestra cuánto tienes consolidado; la app te sugiere seguir en orden.</p>`;
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
    $app.innerHTML = `<div class="fade-in">
      <button class="btn ghost" data-act="back" style="width:auto;padding-left:0">‹ Lecciones</button>
      <h1>Lección ${L} <span class="jp">${esc(LESSONS[L][0])}</span></h1>
      <p class="sub">${esc(LESSONS[L][1])} · ${p.learned}/${p.total} consolidadas</p>
      ${tierBar(cs.map((c) => c.id))}
      <div class="row" style="margin-top:14px">
        <button class="btn" data-act="study-lesson" data-l="${L}" data-t="vocab">Estudiar vocabulario</button>
        ${ks.length ? `<button class="btn secondary" data-act="study-lesson" data-l="${L}" data-t="kanji">Estudiar kanji</button>` : ''}
      </div>
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
        <div class="set-row"><div><label>Furigana</label><div class="desc">"Auto": sólo sobre kanji que aún no has consolidado</div></div>
          ${sel('furigana', [['auto', 'Auto'], ['always', 'Siempre'], ['never', 'Nunca']], s.furigana)}</div>
        <div class="set-row"><div><label>Expresiones útiles</label><div class="desc">Vocabulario extra de las secciones "Useful Expressions" (277 palabras)</div></div>${sw('useful', s.useful)}</div>
        <div class="set-row"><div><label>Audio automático</label><div class="desc">Pronuncia cada tarjeta al mostrarla</div></div>${sw('autoplay', s.autoplay)}</div>
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
  function setLessons(ls) { state.study.lessons = [...new Set(ls)].sort((a, b) => a - b); save(); }
  function rerenderKeepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }
  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    view = { tab: b.dataset.tab, lesson: null }; render(); window.scrollTo(0, 0);
  });
  $app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-opt],[data-grade],[data-lesson],[data-chip],[data-type]');
    if (!t) return;
    if (t.dataset.lesson) { view.lesson = +t.dataset.lesson; render(); return window.scrollTo(0, 0); }
    if (t.dataset.chip) {
      const L = +t.dataset.chip; const cur = new Set(state.study.lessons);
      cur.has(L) ? cur.delete(L) : cur.add(L);
      setLessons([...cur]); return rerenderKeepScroll();
    }
    if (t.dataset.type) { state.study.type = t.dataset.type; save(); return rerenderKeepScroll(); }
    if (t.dataset.opt != null && S && S.cur.phase === 'q') {
      const i = +t.dataset.opt; const ok = S.cur.options[i].id === S.cur.c.id;
      S.cur.picked = i; S.cur.phase = 'a';
      gradeCard(S.cur.item, ok ? 'good' : 'wrong');
      renderQuiz();
      if (navigator.vibrate) navigator.vibrate(ok ? 10 : [30, 40, 30]);
      if (state.settings.autoplay && S.cur.mode === 'mcr') speak(speechOf(S.cur.c));
      return;
    }
    if (t.dataset.grade && S) { gradeCard(S.cur.item, t.dataset.grade); S.i++; window.scrollTo(0, 0); return next(); }
    switch (t.dataset.act) {
      case 'study': startSession(); window.scrollTo(0, 0); break;
      case 'study-lesson':
        state.study.type = t.dataset.t; setLessons([+t.dataset.l]); startSession(); window.scrollTo(0, 0); break;
      case 'sel-suggested': setLessons([suggestedLesson()]); rerenderKeepScroll(); break;
      case 'sel-upto': setLessons(Array.from({ length: suggestedLesson() }, (_, i) => i + 1)); rerenderKeepScroll(); break;
      case 'sel-all': setLessons(Array.from({ length: MAX_LESSON }, (_, i) => i + 1)); rerenderKeepScroll(); break;
      case 'sel-none': setLessons([]); rerenderKeepScroll(); break;
      case 'sel-due': setLessons(state.study.lessons.concat(dueCards().filter((c) => typeOk(c)).map((c) => c.l))); rerenderKeepScroll(); break;
      case 'quit': if (S && (S.answered || S.newCount)) renderSummary(); else endSession(); break;
      case 'intro-ok': case 'continue': S.i++; window.scrollTo(0, 0); next(); break;
      case 'reveal': S.cur.phase = 'a'; renderQuiz(); if (state.settings.autoplay) speak(speechOf(S.cur.c)); break;
      case 'speak': speak(speechOf(S.cur.c)); break;
      case 'done': endSession(); window.scrollTo(0, 0); break;
      case 'back': view.lesson = null; render(); window.scrollTo(0, 0); break;
      case 'intro-dismiss': state.settings.introSeen = true; save(); rerenderKeepScroll(); break;
      case 'export': exportData(); break;
      case 'import': document.getElementById('importFile').click(); break;
      case 'reset':
        if (confirm('¿Borrar todo tu progreso? Esta acción no se puede deshacer.')) { state = defaultState(); initSelection(); save(); render(); toast('Progreso borrado'); }
        break;
      default: break;
    }
  });
  $app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'importFile') return importData(t.files[0]);
    const key = t.dataset.set; if (!key) return;
    const s = state.settings;
    s[key] = t.type === 'checkbox' ? t.checked : t.value;
    save(); rerenderKeepScroll(); toast('Guardado');
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
        localStorage.setItem(STORE, JSON.stringify(s)); state = load(); initSelection(); render(); toast('Progreso importado');
      } catch (err) { toast('Archivo no válido'); }
    };
    r.readAsText(file);
  }
  function initSelection() {
    if (!Array.isArray(state.study.lessons)) state.study.lessons = [];
    if (!state.study.lessons.length) state.study.lessons = [suggestedLesson()];
    if (!TYPES[state.study.type]) state.study.type = 'mix';
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S) rerenderKeepScroll(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  initSelection();
  render();
  window.__genki = { state: () => state, cur: () => S && S.cur, sess: () => S, CARDS, selDue, selNew, suggestedLesson }; // para depuración
})();
