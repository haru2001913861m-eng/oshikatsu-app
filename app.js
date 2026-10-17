/* 推し活家計簿 v2 — 素の JavaScript・ビルド不要。
   記録・設定は localStorage、写真と通知用の写しは IndexedDB（db.js）。どれもこの端末の中だけ */
'use strict';
(() => {
  const KEY = 'oshikakeibo.v1';
  const VAPID_PUBLIC = 'BIFsQSfmAEfH5vnLwOpg9TBL75NHc6zUI--ZcaMf3R12rFe9pqdJFBVMpPpG0HFaRLasg13Du9LkOiIFRiMVbwg';
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe5Qr3KV8bVcy-o6LhIsfLkZW-4Nk_Oraad6wRK6xQYqgK50Q/formResponse';
  const FORM_FIELD = 'entry.221683344';
  const MAX = 99999999;
  const CATS = [
    { id: 'ticket', name: 'チケット', em: 'ticket' },
    { id: 'trip', name: '遠征', em: 'bus' },
    { id: 'goods', name: 'グッズ', em: 'bags' },
    { id: 'stream', name: '配信', em: 'mic' },
    { id: 'fc', name: 'FC', em: 'heart' },
    { id: 'other', name: 'その他', em: 'sparkles' },
  ];
  const COLORS = [
    { id: 'pink', name: 'ピンク', hex: '#FF4F87' }, { id: 'red', name: 'レッド', hex: '#EE3B55' },
    { id: 'orange', name: 'オレンジ', hex: '#FF8A2B' }, { id: 'yellow', name: 'イエロー', hex: '#F5C400' },
    { id: 'green', name: 'グリーン', hex: '#22B573' }, { id: 'sky', name: '水色', hex: '#29AEE6' },
    { id: 'blue', name: 'ブルー', hex: '#4E68F5' }, { id: 'purple', name: 'パープル', hex: '#9B6BFF' },
    { id: 'mint', name: 'ミント', hex: '#2EC4B6', lock: 'color' }, { id: 'gold', name: 'ゴールド', hex: '#D4A017', lock: 'color' },
    { id: 'black', name: 'ブラック', hex: '#3A3756', lock: 'color' },
  ];
  const BD = [
    { id: 'ticket', name: 'チケット', em: 'ticket' }, { id: 'travel', name: '交通', em: 'bus' },
    { id: 'hotel', name: '宿', em: 'hotel' }, { id: 'goods', name: 'グッズ', em: 'bags' },
    { id: 'food', name: '食事', em: 'coin' },
  ];
  const CHECKS = ['推し活予算の残りを見る', '申込中の公演の状態を更新する', '来月の積立額を確かめる',
    '次のカードの請求額を見る', '生活費が足りなかったら、見直しを1つだけやる'];
  const STATUS = { apply: '申込中', win: '当選', lose: '落選' };
  const DOW = '日月火水木金土';
  // シェアで解放（シェアした回数）
  const UNLOCK = { sticker: 1, sparkle: 1, film: 2, color: 3 };
  const FRAMES = [{ id: 'ticket', name: 'チケット' }, { id: 'polaroid', name: 'ポラロイド' }, { id: 'sparkle', name: 'キラキラ', lock: 'sparkle' }, { id: 'film', name: 'フィルム', lock: 'film' }];
  const STICKERS = [{ id: 'none', name: 'なし' }, { id: 'hearts', name: 'ハート' }, { id: 'crown', name: 'キラキラ顔', lock: 'sticker' }, { id: 'lightstick', name: 'ペンライト', lock: 'sticker' }];
  const UNLOCK_NAME = { 1: 'キラキラ枠とスタンプ2つ', 2: 'フィルム枠', 3: '推し色 ミント・ゴールド・ブラック' };

  /* ---------- 端末の種類 ---------- */
  const UA = navigator.userAgent;
  const IS_IOS = /iP(hone|ad|od)/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const IN_APP = (() => {
    if (/Instagram/i.test(UA)) return 'Instagram';
    if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(UA)) return 'Facebook';
    if (/\bLine\//i.test(UA)) return 'LINE';
    if (/TikTok|musical_ly|BytedanceWebview|trill_/i.test(UA)) return 'TikTok';
    return '';
  })();
  const standalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let installPrompt = null;

  /* ---------- 保存 ---------- */
  const defaults = () => ({
    v: 2, onboarded: false, name: '', color: 'pink', takehome: 0, fixed: 0, saving: 0, pct: 12, budget: 0,
    records: [], goals: [], checks: {}, checkHide: {}, lastCat: 'ticket', a2hs: false, homeA2hsHide: false,
    shares: 0, notif: { on: false, daily: true, time: '21:00', monthStart: true, eventSoon: true }, installId: '',
  });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); return Object.assign(defaults(), d, { notif: Object.assign(defaults().notif, d.notif || {}) }); }
    } catch (e) { /* 読めないときは新しく始める */ }
    return defaults();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('保存できませんでした（ブラウザの設定を確認してください）'); }
    mirror();
  }
  // 通知の文面は端末の中で作るので、サービスワーカーが読める IndexedDB に必要な分だけ写す
  let mirrorT;
  function mirror() {
    clearTimeout(mirrorT);
    mirrorT = setTimeout(() => {
      if (!window.OshiDB) return;
      const mk = thisMk();
      OshiDB.put('kv', 'state', { budget: S.budget, records: S.records.filter((r) => r.date.startsWith(mk)).map((r) => ({ date: r.date, amount: r.amount })), goals: S.goals.map((g) => ({ title: g.title, date: g.date, status: g.status, bd: g.bd, buffer: g.buffer, deposits: g.deposits })) }).catch(() => {});
    }, 300);
  }

  /* ---------- 小道具 ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (n) => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
  const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; };
  const comma = (n) => Number(n || 0).toLocaleString('ja-JP');
  // 230000 → 23万円、12345 → 1万2,345円
  const reading = (n) => { n = Math.round(n || 0); const m = Math.floor(n / 10000), r = n % 10000; return n ? `${m ? comma(m) + '万' : ''}${r ? comma(r) : ''}円` : '0円'; };
  const em = (name, cls = 'em') => `<img src="assets/emoji/${name}.png" alt="" class="${cls}" loading="lazy">`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => ymd(new Date());
  const mkOf = (s) => s.slice(0, 7);
  const thisMk = () => mkOf(today());
  const mkLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${y}年${m}月`; };
  const mkShift = (mk, k) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
  const jdate = (s, withYear) => { const d = parse(s); return `${withYear ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`; };
  const daysUntil = (s) => Math.round((parse(s) - parse(today())) / 86400000);
  const cat = (id) => CATS.find((c) => c.id === id) || CATS[5];
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* 対応していない端末 */ } };
  const unlocked = (lock) => !lock || (S.shares || 0) >= UNLOCK[lock];
  const lockLeft = (lock) => Math.max(0, UNLOCK[lock] - (S.shares || 0));
  if (!S.installId) { S.installId = (crypto.randomUUID ? crypto.randomUUID() : uid() + uid()); }

  /* ---------- 推し色 ---------- */
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(h, to, t) { const a = hexRgb(h), b = hexRgb(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function lum(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  const accHex = () => (COLORS.find((x) => x.id === S.color) || COLORS[0]).hex;
  const accInk = () => (lum(accHex()) > 0.45 ? '#2B2A5A' : '#ffffff');
  function applyTheme() {
    const c = accHex(), st = document.documentElement.style, [r, g, b] = hexRgb(c);
    st.setProperty('--acc', c);
    st.setProperty('--acc-l', mix(c, '#ffffff', 0.86));
    st.setProperty('--acc-d', mix(c, '#2B2A5A', lum(c) > 0.45 ? 0.45 : 0.18));
    st.setProperty('--acc-ink', accInk());
    st.setProperty('--acc-glow', `rgba(${r},${g},${b},.45)`);
    const meta = $('meta[name=theme-color]'); if (meta) meta.content = mix(c, '#ffffff', 0.86);
    $('#brandSub').textContent = S.name ? `${S.name}に会い続けるための` : '推しに会い続けるための';
  }

  /* ---------- 計算 ---------- */
  const recsOfMonth = (mk) => S.records.filter((r) => r.date.startsWith(mk));
  const recsOfDay = (d) => S.records.filter((r) => r.date === d);
  const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  const spendOf = (mk) => sum(recsOfMonth(mk), (r) => r.amount);
  const byCat = (mk) => { const o = {}; CATS.forEach((c) => (o[c.id] = 0)); recsOfMonth(mk).forEach((r) => (o[r.cat] = (o[r.cat] || 0) + r.amount)); return o; };
  const lifeCost = () => (S.takehome || 0) - (S.fixed || 0) - (S.saving || 0) - (S.budget || 0);
  const gBase = (g) => sum(BD, (b) => g.bd?.[b.id] || 0);
  const gBuffer = (g) => (g.buffer ? Math.round(gBase(g) * 0.1) : 0);
  const gCost = (g) => gBase(g) + gBuffer(g);
  const gSaved = (g) => sum(g.deposits || [], (x) => x.a);
  const gPct = (g) => Math.min(100, Math.round(gSaved(g) / Math.max(1, gCost(g)) * 100));
  // 公演までの月数＝(公演の年−今の年)×12＋公演の月−今の月（テンプレと同じ式・0未満は0）
  const gMonths = (g) => { const e = parse(g.date), n = new Date(); return Math.max(0, (e.getFullYear() - n.getFullYear()) * 12 + e.getMonth() - n.getMonth()); };
  const savedBeforeThisMonth = (g) => { const mk = thisMk(); return sum((g.deposits || []).filter((x) => x.t === 'move' || mkOf(x.d) < mk), (x) => x.a); };
  const depositedThisMonth = (g) => { const mk = thisMk(); return sum((g.deposits || []).filter((x) => x.t !== 'move' && mkOf(x.d) === mk), (x) => x.a); };
  function gMonthly(g) { const rest = Math.max(0, gCost(g) - savedBeforeThisMonth(g)); const m = gMonths(g); return m <= 0 ? rest : Math.ceil(rest / m); }
  const gTodo = (g) => Math.max(0, Math.min(gMonthly(g) - depositedThisMonth(g), gCost(g) - gSaved(g)));
  const activeGoals = () => S.goals.filter((g) => g.status !== 'lose');
  const nextEvent = () => { const t = today(); return activeGoals().filter((g) => g.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0]; };
  const expected = () => sum(S.goals.filter((g) => g.status === 'apply' && g.prob != null), (g) => gCost(g) * g.prob / 100);

  /* ---------- 写真（IndexedDB・この端末の中だけ。1万枚でも一覧は目録と小さい縮小画像だけ読む） ---------- */
  let metas = [];               // {id, date, goalId, ts, rgb}
  const byDay = new Map();      // date → [meta]（新しい順）
  const turl = new Map();       // id → t256 の objectURL（見えた分だけ作る）
  function indexMetas() {
    metas.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
    byDay.clear(); metas.forEach((m) => { if (!byDay.has(m.date)) byDay.set(m.date, []); byDay.get(m.date).push(m); });
  }
  async function loadMetas() { try { metas = await OshiDB.all('pmeta'); indexMetas(); } catch (e) { metas = []; } }
  const goalById = (id) => S.goals.find((g) => g.id === id);
  const goalPhotos = (g) => metas.filter((m) => m.goalId === g.id);
  function coverOfDay(d) {
    const l = byDay.get(d); if (l && l.length) return l[0];
    const g = activeGoals().find((x) => x.date === d); return g ? goalPhotos(g)[0] || null : null;
  }
  const goalCover = (g) => goalPhotos(g)[0] || (byDay.get(g.date) || [])[0] || null;
  const rgbCss = (m) => (m && m.rgb ? `rgb(${m.rgb.join(',')})` : 'var(--acc-l)');
  const eventOf = (m) => (m.goalId && goalById(m.goalId)) || S.goals.find((g) => g.date === m.date) || null;
  // 見えた写真だけ縮小画像を読む
  let io = null;
  function hydrate() {
    const els = $$('[data-pid]:not([data-h])'); if (!els.length) return;
    const load = async (el) => {
      el.dataset.h = '1'; const id = el.dataset.pid;
      let u = turl.get(id);
      if (!u) { try { const t = await OshiDB.get('pthumb', id); if (!t) return; u = URL.createObjectURL(unpack(t.t256)); turl.set(id, u); } catch (e) { return; } }
      if (el.tagName === 'IMG') el.src = u; else el.style.backgroundImage = `url('${u}')`;
      if (turl.size > 800) { const k = turl.keys().next().value; URL.revokeObjectURL(turl.get(k)); turl.delete(k); }
    };
    if (!('IntersectionObserver' in window)) return els.forEach(load);
    if (!io) io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); load(en.target); } }), { rootMargin: '300px' });
    els.forEach((el) => io.observe(el));
  }
  const phEl = (m, cls, tag = 'span', attrs = '') => tag === 'img'
    ? `<img class="${cls}" data-pid="${m.id}" alt="" style="background:${rgbCss(m)}" ${attrs}>`
    : `<span class="${cls}" data-pid="${m.id}" style="background-color:${rgbCss(m)}" ${attrs}></span>`;
  function drawScaled(img, max) {
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * s)); cv.height = Math.max(1, Math.round(img.naturalHeight * s));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv;
  }
  const cvBlob = (cv, q) => new Promise((res) => cv.toBlob(res, 'image/jpeg', q));
  // Blob のままだと Safari のプライベートブラウズで IndexedDB に保存できないので、ArrayBuffer にして入れる
  const pack = async (b) => ({ buf: await b.arrayBuffer(), type: b.type || 'image/jpeg' });
  const unpack = (o) => (!o ? null : o instanceof Blob ? o : new Blob([o.buf], { type: o.type }));
  function avgRgb(cv) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }
  async function attachPhoto(target, file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const full = await cvBlob(drawScaled(img, 1080), 0.8);
      const c256 = drawScaled(img, 256), t256 = await cvBlob(c256, 0.75), t64 = await cvBlob(drawScaled(img, 64), 0.7);
      const meta = { id: uid(), date: target.date, goalId: target.goalId || null, ts: Date.now(), rgb: avgRgb(c256) };
      await OshiDB.putPhoto(meta, { t64: await pack(t64), t256: await pack(t256) }, { full: await pack(full) });
      metas.push(meta); indexMetas();
      return meta;
    } catch (e) { toast('この写真は読み込めませんでした'); return null; } finally { URL.revokeObjectURL(url); }
  }
  async function delPhoto(id) {
    try { await OshiDB.delPhoto(id); } catch (e) { /* */ }
    metas = metas.filter((m) => m.id !== id); indexMetas();
    if (turl.has(id)) { URL.revokeObjectURL(turl.get(id)); turl.delete(id); }
  }
  async function fullPhoto(id) { try { const p = id && await OshiDB.get('pfull', id); return p ? unpack(p.full) : null; } catch (e) { return null; } }
  let photoTarget = null;
  function pickPhoto(target) { photoTarget = target; const inp = $('#photoInp'); inp.value = ''; inp.click(); }
  function photoBoxHTML(d) {
    const list = byDay.get(d) || [];
    return `<div class="photo-strip">${list.slice(0, 12).map((m) => `<button class="pthumb-btn" data-act="viewPhoto" data-pid-open="${m.id}" data-ctx="day:${d}" aria-label="写真を開く">${phEl(m, 'pthumb', 'img')}</button>`).join('')}
      <button class="padd" data-act="photo" data-date="${d}" aria-label="この日の写真を追加">📷<span>${list.length ? '追加' : '写真を貼る'}</span></button></div>`;
  }

  /* ---------- 写真集 ---------- */
  function albumGroups() {
    if (ui.albumBy === 'event') {
      const used = new Set(), out = [];
      [...S.goals].sort((a, b) => b.date.localeCompare(a.date)).forEach((g) => {
        const l = metas.filter((m) => !used.has(m.id) && (m.goalId === g.id || (!m.goalId && m.date === g.date)));
        l.forEach((m) => used.add(m.id));
        if (l.length) out.push({ key: 'g:' + g.id, label: g.title, sub: jdate(g.date, true), list: l });
      });
      const rest = metas.filter((m) => !used.has(m.id));
      if (rest.length) out.push({ key: 'rest', label: 'ふだんの推し活', sub: '', list: rest });
      return out;
    }
    const map = new Map();
    metas.forEach((m) => { const k = m.date.slice(0, 7); if (!map.has(k)) map.set(k, []); map.get(k).push(m); });
    return [...map.entries()].map(([k, l]) => ({ key: 'm:' + k, label: mkLabel(k), sub: '', list: l }));
  }
  function albumHTML() {
    const gs = albumGroups(), shown = gs.slice(0, ui.albumN);
    return `<div class="seg" style="margin:0 0 12px">${[['month', '月ごと'], ['event', '現場ごと']].map(([k, v]) => `<button data-act="albumBy" data-v="${k}" class="${ui.albumBy === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <p class="muted small" style="margin:0 4px 8px">写真 ${metas.length}枚</p>
      ${metas.length ? shown.map((g) => `<section class="card soft album-g"><h2>${esc(g.label)} <span class="muted small">${g.sub ? g.sub + '・' : ''}${g.list.length}枚</span></h2>
        <div class="album-grid">${g.list.map((m) => `<button class="tile" data-act="viewPhoto" data-pid-open="${m.id}" data-ctx="${g.key}" aria-label="${jdate(m.date)}の写真">${phEl(m, 'tile-img')}</button>`).join('')}</div></section>`).join('')
        : `<section class="card soft"><div class="empty">${em('sparkles')}カレンダーの日をタップして、現場の写真を貼ってみよう。<br>月がだんだん写真でうまっていきます</div></section>`}
      ${gs.length > ui.albumN ? '<button class="btn block ghost" data-act="albumMore">もっと見る</button>' : ''}
      <p class="foot-note">📷 写真はこの端末の中だけに保存されます</p>`;
  }
  function ctxList(ctx) {
    if (ctx.startsWith('day:')) return byDay.get(ctx.slice(4)) || [];
    if (ctx.startsWith('goal:')) { const g = goalById(ctx.slice(5)); return g ? goalPhotos(g) : []; }
    const g = albumGroups().find((x) => x.key === ctx); return g ? g.list : metas;
  }
  // 全画面で見る（左右にスワイプ）
  let viewer = null;
  async function openViewer(id, ctx) {
    const list = ctxList(ctx); const i = Math.max(0, list.findIndex((m) => m.id === id));
    viewer = { list, i, url: null };
    const l = $('#viewLayer'); l.hidden = false; document.body.classList.add('lock');
    await drawViewer();
  }
  async function drawViewer() {
    const v = viewer; if (!v) return;
    const m = v.list[v.i]; if (!m) return closeViewer();
    const ev = eventOf(m);
    if (v.url) URL.revokeObjectURL(v.url);
    const full = await fullPhoto(m.id); v.url = full ? URL.createObjectURL(full) : null;
    $('#viewLayer').innerHTML = `<div class="vw-top"><button class="vw-btn" data-act="viewClose" aria-label="閉じる">×</button><span class="vw-n">${v.i + 1} / ${v.list.length}</span><button class="vw-btn" data-act="viewDel" aria-label="この写真を消す">🗑</button></div>
      <div class="vw-stage" id="vwStage">${v.url ? `<img src="${v.url}" alt="${jdate(m.date)}の写真" id="vwImg">` : ''}
        ${v.i > 0 ? '<button class="vw-nav l" data-act="viewPrev" aria-label="前の写真">‹</button>' : ''}${v.i < v.list.length - 1 ? '<button class="vw-nav r" data-act="viewNext" aria-label="次の写真">›</button>' : ''}</div>
      <div class="vw-cap"><b>${jdate(m.date, true)}</b>${ev ? `<span>${em('ticket')}${esc(ev.title)}</span>` : ''}</div>
      <div class="vw-foot"><button class="btn block" data-act="viewCard">${em('sparkles')}この写真でカードを作る</button></div>`;
  }
  function closeViewer() { if (viewer && viewer.url) URL.revokeObjectURL(viewer.url); viewer = null; const l = $('#viewLayer'); l.hidden = true; l.innerHTML = ''; if ($('#sheetLayer').hidden) document.body.classList.remove('lock'); }
  function viewStep(k) { if (!viewer) return; const n = viewer.i + k; if (n < 0 || n >= viewer.list.length) return; viewer.i = n; drawViewer(); }

  /* ---------- 画面の状態 ---------- */
  const ui = { tab: 'home', calMk: thisMk(), sel: today(), sumMk: thisMk(), goalView: 'active', calView: 'cal', albumBy: 'month', albumN: 6 };
  let offers = [];
  function render() {
    applyTheme();
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === ui.tab));
    if (io) io.disconnect();
    $('#main').innerHTML = `<div class="fade-in">${({ home: homeHTML, cal: calTabHTML, goals: goalsHTML, sum: sumHTML })[ui.tab]()}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(animateIn));
    hydrate();
  }
  function animateIn() {
    $$('.ring-fg').forEach((c) => (c.style.strokeDashoffset = c.dataset.to));
    $$('.bar i[data-w]').forEach((b) => (b.style.width = b.dataset.w));
  }

  /* ---------- ホーム ---------- */
  function ringHTML() {
    const mk = thisMk(), spent = spendOf(mk), B = S.budget || 0;
    const R = 92, C = 2 * Math.PI * R;
    if (!B) {
      return `<section class="card ring-card"><div class="ring-wrap"><svg viewBox="0 0 220 220"><circle class="ring-bg" cx="110" cy="110" r="${R}" fill="none" stroke-width="18"/></svg>
        <div class="ring-in"><div class="ring-lbl">今月の推し予算</div><div class="ring-val" style="font-size:20px">まだ決めていません</div><div class="ring-of">使った ${yen(spent)}</div></div></div>
        <button class="btn sm" data-act="settings" style="margin-top:10px;z-index:1">${em('sparkles')}守る予算を決める</button></section>`;
    }
    const left = B - spent, ratio = Math.max(0, Math.min(1, left / B));
    const face = left < 0 ? 'pig' : ratio > 0.5 ? 'starstruck' : ratio > 0.15 ? 'hearts' : 'heart';
    const msg = left < 0 ? 'こえた分は、来月の予算で調整しよう' : ratio > 0.5 ? 'まだまだ余裕。全力で楽しもう' : ratio > 0.15 ? '計画どおり。いいペース' : 'のこり少し。次の現場を思い出してから使おう';
    const cats = byCat(mk);
    const chips = CATS.filter((c) => cats[c.id] > 0).map((c) => `<span class="chip">${em(c.em)}${c.name}<b>${yen(cats[c.id])}</b></span>`).join('');
    const vs = left >= 0 ? yen(left) : yen(-left);
    return `<section class="card ring-card">
      <div class="ring-wrap"><svg viewBox="0 0 220 220"><circle class="ring-bg" cx="110" cy="110" r="${R}" fill="none" stroke-width="18"/>
        <circle class="ring-fg" cx="110" cy="110" r="${R}" fill="none" stroke-width="18" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-to="${C * (1 - ratio)}"/></svg>
        <div class="ring-in"><div class="ring-lbl">今月の推し予算</div>
          ${left >= 0 ? `<div class="ring-lbl">あと</div><div class="ring-val" id="ringVal" style="${vs.length > 9 ? 'font-size:26px' : ''}">${vs}</div>` : `<div class="ring-val over" id="ringVal">${vs} こえた</div>`}
          <div class="ring-of">${yen(spent)} / ${yen(B)}</div></div>
        ${em(face, 'ring-em')}</div>
      <p class="ring-msg">${msg}</p>
      <div class="chips">${chips || '<span class="muted small">＋ボタンから、今月の1行目を記録しよう</span>'}</div>
    </section>`;
  }
  function nextStubHTML() {
    const g = nextEvent();
    if (!g) return `<button class="stub" data-act="newGoal" style="width:100%;text-align:left"><div class="stub-main empty-stub">${em('calendar')}<div><div class="stub-t">次の現場を登録しよう</div><div class="stub-d">当たった場合の費用から、毎月の積立額を出します</div></div></div><div class="stub-side"><div class="big">＋</div><div class="lbl">追加</div></div></button>`;
    const d = daysUntil(g.date), pct = gPct(g), ph = goalCover(g);
    return `<button class="stub" data-act="tab" data-tab="goals" style="width:100%;text-align:left">
      <div class="stub-main"><div class="stub-k">${ph ? phEl(ph, 'stub-ph', 'img') : em('ticket')}次の現場 <span class="badge ${g.status}">${STATUS[g.status]}</span></div>
        <div class="stub-t">${esc(g.title)}</div><div class="stub-d">${jdate(g.date)}・積立 ${pct}%（${yen(gSaved(g))} / ${yen(gCost(g))}）</div>
        <div class="bar"><i data-w="${pct}%"></i></div></div>
      <div class="stub-side">${d === 0 ? '<div class="big" style="font-size:22px">今日！</div>' : `<div class="lbl">あと</div><div class="big">${d}</div><div class="lbl">日</div>`}</div></button>`;
  }
  function checkHTML(force) {
    const mk = thisMk(), done = S.checks[mk] || [];
    const all = CHECKS.every((_, i) => done[i]);
    if (!force && (new Date().getDate() > 7 || S.checkHide[mk] || all)) return '';
    return `<section class="card check-card">${force ? '' : '<button class="x-btn" data-act="hideCheck" aria-label="閉じる">×</button>'}
      <h2>${em('memo')}月に1回、5分だけ見る</h2>
      <p class="muted small" style="margin:-6px 0 6px">${force ? '' : '新しい月のはじまり。'}今月の${mkLabel(mk).replace(/^\d+年/, '')}ぶん</p>
      <ul class="check-list">${CHECKS.map((c, i) => `<li><label><input type="checkbox" data-act="check" data-i="${i}" ${done[i] ? 'checked' : ''}><span>${c}</span></label></li>`).join('')}</ul>
      ${all ? `<p class="check-done">${em('party')} 今月の5分、おわり！おつかれさま</p>` : ''}</section>`;
  }
  function installCardHTML() {
    if (standalone() || S.homeA2hsHide || IN_APP) return '';
    if (IS_IOS) return `<section class="card install-card"><button class="x-btn" data-act="hideHomeA2hs" aria-label="閉じる">×</button><div class="row" style="gap:10px">${em('sparkles')}<div style="flex:1"><b>ホーム画面に追加しよう</b><p class="muted small">ワンタップで開けて、通知も届くようになります</p></div></div><button class="btn sm block" data-act="installGuide" style="margin-top:8px">追加のしかたを見る</button></section>`;
    if (installPrompt) return `<section class="card install-card"><button class="x-btn" data-act="hideHomeA2hs" aria-label="閉じる">×</button><div class="row" style="gap:10px">${em('sparkles')}<div style="flex:1"><b>ホーム画面に追加しよう</b><p class="muted small">ワンタップで開けて、通知も届きます</p></div></div><button class="btn sm block" data-act="installNow" style="margin-top:8px">ホーム画面に追加</button></section>`;
    return '';
  }
  function homeHTML() {
    return `${checkHTML(false)}${ringHTML()}${nextStubHTML()}${installCardHTML()}
      <section class="card">${calHTML(ui.calMk, null, false)}</section>
      <h2 class="sec-h">${em('receipt')}さいきんの記録<button class="more" data-act="tab" data-tab="cal">すべて見る</button></h2>
      <section class="card soft">${recListHTML([...S.records].sort(sortRec).slice(0, 4), true)}</section>`;
  }
  const sortRec = (a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0);
  function recListHTML(list, showDate) {
    if (!list.length) return `<div class="empty">${em('memo')}まだ記録がありません<br>下の＋から、1行だけ書いてみよう</div>`;
    return `<ul class="rec-list">${list.map((r) => { const c = cat(r.cat); return `<li><button class="rec" data-act="editRec" data-id="${r.id}">
      <span class="rec-ic">${em(c.em)}</span><span class="rec-b"><span class="rec-t">${c.name}</span><span class="rec-m">${showDate ? jdate(r.date) : ''}${r.memo ? (showDate ? '・' : '') + esc(r.memo) : ''}</span></span>
      <span class="rec-a">${yen(r.amount)}</span></button></li>`; }).join('')}</ul>`;
  }

  /* ---------- カレンダー（思い出カレンダー） ---------- */
  function calHTML(mk, sel, big) {
    const [y, m] = mk.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate(), t = today();
    const evs = {}; activeGoals().forEach((g) => { if (g.date.startsWith(mk)) (evs[g.date] = evs[g.date] || []).push(g); });
    const per = {}; recsOfMonth(mk).forEach((r) => { per[r.date] = per[r.date] || { n: 0, a: 0 }; per[r.date].n++; per[r.date].a += r.amount; });
    let cells = [...DOW].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < first; i++) cells += '<div class="day out"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${mk}-${pad2(d)}`, p = per[ds], ph = coverOfDay(ds);
      const dots = p ? '<i></i>'.repeat(Math.min(3, p.n)) : '';
      const lbl = `${m}月${d}日${p ? `・記録${p.n}件` : ''}${evs[ds] ? '・現場' : ''}${ph ? '・写真あり' : ''}`;
      cells += `<button class="day${ds === t ? ' today' : ''}${ds === sel ? ' sel' : ''}${ph ? ' has-ph' : ''}" data-act="day" data-d="${ds}" aria-label="${lbl}">
        ${ph ? phEl(ph, 'ph') : ''}
        <span class="n">${d}</span>${big && p && !ph ? `<span class="amt">${p.a >= 10000 ? (p.a / 10000).toFixed(1).replace(/\.0$/, '') + '万' : comma(p.a)}</span>` : `<span class="dots">${dots}</span>`}
        ${evs[ds] ? em('ticket', 'ev') : ''}</button>`;
    }
    return `<div class="cal-head"><button class="nav-btn" data-act="calPrev" aria-label="前の月">‹</button><b>${mkLabel(mk)}</b><button class="nav-btn" data-act="calNext" aria-label="次の月">›</button></div>
      <div class="cal${big ? ' big' : ''}">${cells}</div>
      <div class="legend"><span><i></i>使った日</span><span>${em('ticket')}現場の日</span><span>📷 写真の日</span></div>`;
  }
  function calTabHTML() {
    const toggle = `<div class="seg" style="margin:0 0 12px">${[['cal', 'カレンダー'], ['album', '写真集']].map(([k, v]) => `<button data-act="calView" data-v="${k}" class="${ui.calView === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
    if (ui.calView === 'album') return toggle + albumHTML();
    const d = ui.sel, evs = activeGoals().filter((g) => g.date === d), list = recsOfDay(d).sort(sortRec), mk = ui.calMk;
    return `${toggle}<section class="card">${calHTML(mk, d, true)}</section>
      <h2 class="sec-h">${em('calendar')}${jdate(d)}<button class="more" data-act="add" data-d="${d}">＋この日に記録</button></h2>
      ${evs.map((g) => `<button class="stub" data-act="editGoal" data-id="${g.id}" style="width:100%;text-align:left"><div class="stub-main"><div class="stub-k">${em('ticket')}現場の日</div><div class="stub-t">${esc(g.title)}</div><div class="stub-d">${STATUS[g.status]}・${yen(gCost(g))}</div></div><div class="stub-side">${em('starstruck', 'em big-em')}</div></button>`).join('')}
      <section class="card soft">${photoBoxHTML(d)}</section>
      <section class="card soft">${recListHTML(list, false)}${list.length ? `<p class="muted small" style="text-align:right;margin-top:6px">この日の合計 <b class="acc">${yen(sum(list, (r) => r.amount))}</b></p>` : ''}</section>
      <h2 class="sec-h">${em('receipt')}${mkLabel(mk)}の記録 <span class="muted small" style="margin-left:auto">${yen(spendOf(mk))}</span></h2>
      <section class="card soft">${recListHTML(recsOfMonth(mk).sort(sortRec), true)}</section>
      <p class="foot-note">📷 写真はこの端末の中だけに保存されます</p>`;
  }

  /* ---------- 積立 ---------- */
  function goalCardHTML(g) {
    const cost = gCost(g), saved = gSaved(g), pct = gPct(g);
    const d = daysUntil(g.date), past = d < 0, months = gMonths(g), todo = gTodo(g), monthly = gMonthly(g);
    const full = saved >= cost && cost > 0, ph = goalCover(g);
    return `<article class="stub goal${g.status === 'lose' ? ' lost' : ''}${full ? ' full' : ''}" id="g-${g.id}">
      <div class="stub-main">
        <div class="stub-k"><span class="badge ${g.status}">${STATUS[g.status]}</span>${g.prob != null && g.status === 'apply' ? `<span class="muted small">当選予想 ${g.prob}%</span>` : ''}</div>
        <div class="goal-top">${ph ? `<button class="goal-ph-btn" data-act="viewPhoto" data-pid-open="${ph.id}" data-ctx="goal:${g.id}" aria-label="現場の写真">${phEl(ph, 'goal-ph', 'img')}</button>` : ''}<div><div class="stub-t">${esc(g.title)}</div><div class="stub-d">${jdate(g.date, true)}</div></div></div>
        <div class="bar"><i data-w="${pct}%"></i></div>
        <div class="goal-nums"><span>積立済み <b class="acc">${yen(saved)}</b></span><span>目標 ${yen(cost)}</span></div>
        ${g.status !== 'lose' && !past && !full ? `<div class="preview" style="margin:10px 0 0;padding:10px">毎月 <b>${yen(monthly)}</b> <span class="muted small">${months > 0 ? `× あと${months}か月` : '今月まとめて'}</span></div>` : ''}
        ${full && g.status !== 'lose' ? `<p class="check-done" style="text-align:left">${em('party')} 準備できてる！あとは当日を待つだけ</p>` : ''}
        <div class="goal-acts">
          ${g.status !== 'lose' && !full && !past ? (todo > 0 ? `<button class="btn sm" data-act="deposit" data-id="${g.id}">${em('pig')}今月ぶん積み立てた <span style="opacity:.85">${yen(todo)}</span></button>` : `<button class="btn sm ghost" disabled>${em('check')}今月ぶんは済み</button>`) : ''}
          <button class="btn sm line" data-act="share" data-kind="${full ? 'goal' : 'event'}" data-id="${g.id}">${em('sparkles')}シェアカード</button>
          <button class="btn sm ghost" data-act="photo" data-goal="${g.id}" data-date="${g.date}" aria-label="現場の写真を貼る">📷</button>
          <button class="btn sm ghost" data-act="editGoal" data-id="${g.id}">編集</button>
        </div>
        <div class="seg" role="group" aria-label="当落">${Object.entries(STATUS).map(([k, v]) => `<button data-act="status" data-id="${g.id}" data-s="${k}" class="${g.status === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      </div>
      <div class="stub-side">${past ? '<div class="lbl">行ってきた！</div>' : d === 0 ? '<div class="big" style="font-size:22px">今日！</div>' : `<div class="lbl">あと</div><div class="big">${d}</div><div class="lbl">日</div>`}<div class="lbl" style="margin-top:6px">${pct}%</div></div>
    </article>`;
  }
  function goalsHTML() {
    const applying = S.goals.filter((g) => g.status === 'apply');
    const ev = expected(), noProb = applying.filter((g) => g.prob == null).length;
    const list = S.goals.filter((g) => (ui.goalView === 'active' ? g.status !== 'lose' && daysUntil(g.date) >= 0 : g.status === 'lose' || daysUntil(g.date) < 0))
      .sort((a, b) => a.date.localeCompare(b.date));
    const monthlyTotal = sum(activeGoals().filter((g) => daysUntil(g.date) >= 0), gMonthly);
    return `<section class="card ev-total">
        <div class="row" style="align-items:flex-start"><div><div class="muted small">申込中 ${applying.length}件の期待値</div><div class="yen-big">${yen(ev)}</div></div>
        <div style="text-align:right"><div class="muted small">今月の積立 合計</div><div style="font-size:20px;font-weight:800">${yen(monthlyTotal)}</div></div></div>
        <p class="muted small" style="margin-top:6px">期待値＝当たった場合の費用×当選確率の自己予想。だいたいこれくらい備えておけば安心、の目安です${noProb ? `（確率未入力 ${noProb}件は含みません）` : ''}</p>
      </section>
      <button class="btn block" data-act="newGoal" style="margin-bottom:14px">${em('ticket')}公演・イベントを追加</button>
      <div class="seg" style="margin:0 0 14px"><button data-act="goalView" data-v="active" class="${ui.goalView === 'active' ? 'on' : ''}">これから</button><button data-act="goalView" data-v="done" class="${ui.goalView === 'done' ? 'on' : ''}">落選・終わった</button></div>
      ${list.length ? list.map(goalCardHTML).join('') : `<section class="card soft"><div class="empty">${em('calendar')}${ui.goalView === 'active' ? '申し込んだ日に登録すると、<br>毎月いくら積み立てればいいかが出ます' : 'まだありません'}</div></section>`}`;
  }

  /* ---------- まとめ ---------- */
  function gentle(spent, B) {
    if (!B) return ['sparkles', '守る予算を決めると、ここで予算との比べ方が見られます。'];
    if (!spent) return ['memo', '今月はこれから。記録はいつでも1行から。'];
    const r = spent / B;
    if (r <= 0.8) return ['starstruck', '守る予算の中で、ちゃんと楽しめています。この調子で次の現場へ。'];
    if (r <= 1) return ['hearts', '予算どおり、推しに全力で使えた月です。'];
    return ['pig', '予算をこえた月もあります。来月の予算で調整すれば大丈夫。見直しリストを1つだけ試すのもおすすめです。'];
  }
  function sumHTML() {
    const mk = ui.sumMk, spent = spendOf(mk), B = S.budget || 0, cats = byCat(mk), max = Math.max(1, ...Object.values(cats));
    const dep = sum(S.goals.flatMap((g) => (g.deposits || []).filter((x) => x.t !== 'move' && mkOf(x.d) === mk)), (x) => x.a);
    const [face, msg] = gentle(spent, B);
    const p = B ? Math.min(100, Math.round(spent / B * 100)) : 0;
    const shown = offers.filter((o) => o && o.pr !== false && typeof o.url === 'string' && /^https:\/\//.test(o.url.trim()));
    return `<section class="card">
        <div class="cal-head"><button class="nav-btn" data-act="sumPrev" aria-label="前の月">‹</button><b>${mkLabel(mk)}のまとめ</b><button class="nav-btn" data-act="sumNext" aria-label="次の月">›</button></div>
        <div class="sum-top"><div><div class="muted small">推し活に使った</div><div class="yen-big">${yen(spent)}</div></div>
          <div style="text-align:right"><div class="muted small">守る予算</div><div style="font-size:18px;font-weight:800">${B ? yen(B) : '未設定'}</div></div></div>
        ${B ? `<div class="bar bm-bar"><i data-w="${p}%"></i></div><div class="goal-nums"><span>${p}%</span><span>${spent <= B ? 'あと ' + yen(B - spent) : yen(spent - B) + ' こえた'}</span></div>` : ''}
        <div class="gentle">${em(face)}<span>${msg}</span></div>
        <button class="btn block line" data-act="share" data-kind="month" style="margin-top:12px">${em('sparkles')}${mkLabel(mk).replace(/^\d+年/, '')}のまとめカードをつくる</button>
      </section>
      <section class="card"><h2>${em('chart')}カテゴリ別</h2>
        <div class="cat-bars">${CATS.map((c) => `<div class="cb-row">${em(c.em)}<span>${c.name}</span><div class="bar"><i data-w="${Math.round(cats[c.id] / max * 100)}%"></i></div><b>${yen(cats[c.id])}</b></div>`).join('')}</div>
        <p class="muted small" style="margin-top:12px">${em('pig')}この月の当落積立 <b class="acc">${yen(dep)}</b></p>
      </section>
      ${checkHTML(true)}
      ${S.takehome ? `<section class="card soft"><h2>${em('moneybag')}お金の3つの置き場所</h2><ul class="calc">
        <li><span>手取り</span><b>${yen(S.takehome)}</b></li><li><span>固定費</span><b>− ${yen(S.fixed)}</b></li><li><span>先取り貯金</span><b>− ${yen(S.saving)}</b></li>
        <li><span>推し（守る予算）</span><b>− ${yen(S.budget)}</b></li><li><span>生活費</span><b>${yen(lifeCost())}</b></li></ul></section>` : ''}
      ${shown.length ? `<section class="card soft" id="offers"><h2>${em('coin')}推し活費をつくる</h2><p class="muted small">推し活以外の出費を見直すヒント。金額はプランや使い方で変わります。</p>
        ${shown.map((o) => `<a class="offer" href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer"><div class="offer-h"><span class="pr">PR</span>${esc(o.title)}</div><p>${esc(o.body)}</p><span class="go">くわしく見る ›</span></a>`).join('')}</section>` : ''}`;
  }

  /* ---------- ボトムシート ---------- */
  let sheetClose = null;
  function openSheet(html, onClose) {
    const layer = $('#sheetLayer'), sh = $('#sheet');
    sh.innerHTML = '<button class="sheet-x" data-close aria-label="閉じる">×</button>' + html; layer.hidden = false; sh.scrollTop = 0; sheetClose = onClose || null; hydrate();
    document.body.classList.add('lock');
  }
  function closeSheet() {
    $('#sheetLayer').hidden = true; $('#sheet').innerHTML = ''; document.body.classList.remove('lock');
    const f = sheetClose; sheetClose = null; if (f) f();
  }

  /* ---------- 金額キーパッド（端末のキーボードは使わない） ---------- */
  const CHIPS = { small: [500, 1000, 5000, 10000], mid: [1000, 5000, 10000, 50000], big: [10000, 50000, 100000] };
  const chipLabel = (v) => '＋' + (v >= 10000 ? `${v / 10000}万` : comma(v));
  const pads = {};
  function newPad(id, value, mode, onChange) {
    const p = { id, man: null, low: value ? String(value) : '', mode, onChange };
    pads[id] = p; return p;
  }
  const padVal = (p) => (p.man || 0) * 10000 + num(p.low);
  function padHTML(p) {
    const keys = ['1', '2', '3', '⌫', '4', '5', '6', '万', '7', '8', '9', 'C', '0', '00', '000'];
    return `<div class="pad" data-pad="${p.id}">
      <div class="amt-disp" data-pad-disp aria-live="polite"></div>
      <div class="amt-read" data-pad-read></div>
      <div class="pad-chips">${CHIPS[p.mode].map((v) => `<button class="pchip" data-act="pc" data-pad="${p.id}" data-v="${v}">${chipLabel(v)}</button>`).join('')}</div>
      <div class="keypad">${keys.map((k) => `<button class="key${/[⌫万C]/.test(k) ? ' fn' : ''}${k === '0' ? ' zero' : ''}${k === '万' ? ' man' : ''}" data-act="pk" data-pad="${p.id}" data-k="${k}" aria-label="${{ '⌫': '1文字消す', C: 'ぜんぶ消す' }[k] || k}">${k}</button>`).join('')}</div></div>`;
  }
  function padDraw(p, pop = true) {
    const root = $(`[data-pad="${p.id}"].pad`); if (!root) return;
    const n = padVal(p), disp = $('[data-pad-disp]', root), rd = $('[data-pad-read]', root);
    const s = comma(n);
    disp.innerHTML = `<small>¥</small><span>${s}</span>${p.man != null && !p.low ? '<i class="caret"></i>' : ''}`;
    const len = s.length + 1;
    disp.style.fontSize = (len <= 9 ? 44 : Math.max(26, Math.floor(44 * 9 / len))) + 'px';
    disp.classList.toggle('zero', !n);
    rd.textContent = n ? reading(n) + (p.man != null && !p.low ? '　続けて千の位以下も入れられます' : '') : '金額を入れてください';
    if (pop) { disp.classList.remove('pop'); void disp.offsetWidth; disp.classList.add('pop'); }
    if (p.onChange) p.onChange(n);
  }
  function padShake(p) { const r = $(`[data-pad="${p.id}"].pad .amt-disp`); if (r) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); } }
  function padKey(p, k) {
    buzz();
    if (k === 'C') { p.man = null; p.low = ''; }
    else if (k === '⌫') { if (p.low) p.low = p.low.slice(0, -1); else if (p.man != null) { p.low = String(p.man); p.man = null; } }
    else if (k === '万') {
      if (p.man != null) return padShake(p);
      const m = num(p.low) || 1;
      if (m * 10000 > MAX) return padShake(p);
      p.man = m; p.low = '';
    } else if (p.man != null) {
      const nl = (p.low + k).replace(/^0+(?=\d)/, '');
      if (nl.length > 4) return padShake(p);
      p.low = nl;
    } else {
      const nl = (p.low + k).replace(/^0+/, '');
      if (num(nl) > MAX) return padShake(p);
      p.low = nl;
    }
    padDraw(p);
  }
  function padChip(p, v) {
    buzz();
    const n = padVal(p) + v;
    if (n > MAX) return padShake(p);
    p.man = null; p.low = String(n); padDraw(p);
  }

  // 手取り・固定費など：タップ → 下からキーパッド
  const amtFieldHTML = (key, label, val, mode = 'mid', hint = '') => `<div class="field"><span>${label}</span>
    <button class="amt-field${val ? '' : ' empty'}" data-act="amtField" data-key="${key}" data-label="${esc(label)}" data-mode="${mode}" id="af-${key.replace('.', '-')}">
      <span class="af-v">${val ? yen(val) : (hint || 'タップして入力')}</span><span class="af-r">${val ? reading(val) : ''}</span></button></div>`;
  function refreshField(key, val) {
    const b = $('#af-' + key.replace('.', '-')); if (!b) return;
    b.classList.toggle('empty', !val);
    $('.af-v', b).textContent = val ? yen(val) : 'タップして入力';
    $('.af-r', b).textContent = val ? reading(val) : '';
  }
  let fieldDone = null;
  function openFieldPad(key, label, mode) {
    const val = getField(key);
    const p = newPad('field', val, mode);
    fieldDone = () => { const n = padVal(p); setField(key, n); refreshField(key, n); closeFieldPad(); };
    const l = $('#kpLayer');
    $('#kpSheet').innerHTML = `<button class="sheet-x" data-close aria-label="閉じる">×</button><h3>${esc(label)}</h3>${padHTML(p)}<button class="btn block" data-act="fieldOk">決定</button>`;
    l.hidden = false; padDraw(p, false);
  }
  function closeFieldPad() { $('#kpLayer').hidden = true; $('#kpSheet').innerHTML = ''; delete pads.field; }
  function getField(key) {
    if (key.startsWith('bd.')) return gdraft?.bd[key.slice(3)] || 0;
    if (key === 'gsaved') return gdraft?.savedEdit || 0;
    return S[key] || 0;
  }
  function setField(key, n) {
    if (key.startsWith('bd.')) { gdraft.bd[key.slice(3)] = n; goalInput(); return; }
    if (key === 'gsaved') { gdraft.savedEdit = n; goalInput(); return; }
    S[key] = n;
    budgetSync(key === 'budget' ? 'budget' : 'th');
    save();
  }

  // 記録（3タップ：数字→カテゴリ→記録する）
  let draft = null;
  function openAdd(opt = {}) {
    const r = opt.rec;
    draft = r ? { ...r } : { id: null, cat: S.lastCat || 'ticket', date: opt.date || today(), memo: '' };
    const p = newPad('rec', r ? r.amount : 0, 'small', (n) => { const b = $('#saveRec'); if (b) b.disabled = !n; });
    openSheet(`<h3>${em('sparkles')}${r ? '記録を直す' : '推し活を記録'}</h3>
      ${padHTML(p)}
      <div class="cats">${CATS.map((c) => `<button class="cat${c.id === draft.cat ? ' on' : ''}" data-act="pickCat" data-c="${c.id}">${em(c.em)}${c.name}</button>`).join('')}</div>
      <div class="meta-row"><label class="date-chip">${em('calendar')}<span id="dateLbl">${jdate(draft.date)}</span><input type="date" id="dateInp" value="${draft.date}" aria-label="日付"></label>
        <input class="memo" id="memoInp" placeholder="メモ（任意）" maxlength="40" value="${esc(draft.memo)}" enterkeyhint="done" autocomplete="off"></div>
      <button class="btn block" id="saveRec" data-act="saveRec">記録する</button>
      ${r ? '<div style="text-align:center;margin-top:6px"><button class="link-btn" data-act="delRec">この記録を消す</button></div>' : ''}`, () => delete pads.rec);
    // キーパッドの並びを「金額 → カテゴリ」の順に（カテゴリは数字の下）
    padDraw(p, false);
    $('#dateInp').addEventListener('change', (e) => { if (e.target.value) { draft.date = e.target.value; $('#dateLbl').textContent = jdate(draft.date); } });
    $('#memoInp').addEventListener('input', (e) => (draft.memo = e.target.value));
  }
  function saveRec() {
    const n = padVal(pads.rec); if (!n) return;
    const isNew = !draft.id;
    const rec = { id: draft.id || uid(), date: draft.date, amount: n, cat: draft.cat, memo: (draft.memo || '').trim(), ts: draft.ts || Date.now() };
    if (isNew) S.records.push(rec); else S.records = S.records.map((x) => (x.id === rec.id ? rec : x));
    S.lastCat = draft.cat; save(); closeSheet();
    ui.sel = rec.date; render();
    toast(isNew ? `${cat(rec.cat).name} ${yen(n)} を記録しました` : '記録を直しました');
    if (isNew) { const f = $('#fab').getBoundingClientRect(); sparkle(f.left + f.width / 2, f.top); }
  }

  function openDay(d) {
    const list = recsOfDay(d).sort(sortRec), evs = activeGoals().filter((g) => g.date === d);
    openSheet(`<h3>${em('calendar')}${jdate(d, true)}</h3>
      ${evs.map((g) => `<div class="preview">${em('ticket')} <b style="font-size:15px">${esc(g.title)}</b> <span class="badge ${g.status}">${STATUS[g.status]}</span></div>`).join('')}
      ${photoBoxHTML(d)}
      ${recListHTML(list, false)}
      ${list.length ? `<p class="muted small" style="text-align:right;margin:6px 0 10px">この日の合計 <b class="acc">${yen(sum(list, (r) => r.amount))}</b></p>` : ''}
      <button class="btn block" data-act="add" data-d="${d}" style="margin-top:8px">＋ この日に記録する</button>`);
    ui.daySheet = d;
  }

  // 公演・イベント
  let gdraft = null;
  function openGoal(g, opt = {}) {
    gdraft = g ? JSON.parse(JSON.stringify(g)) : { id: null, title: '', date: '', bd: {}, buffer: true, prob: null, status: 'apply', deposits: [] };
    gdraft.carryFrom = opt.carryFrom || null;
    gdraft.savedEdit = g ? gSaved(g) : 0;
    openSheet(`<div id="gForm"><h3>${em('ticket')}${g ? '公演・イベントを編集' : '公演・イベントを追加'}</h3>
      <label class="field"><span>名前</span><input class="inp" id="gTitle" maxlength="40" placeholder="例：秋ツアー 2日目" value="${esc(gdraft.title)}" autocomplete="off"></label>
      <label class="field"><span>公演の日</span><input class="inp" type="date" id="gDate" value="${gdraft.date}"></label>
      <div class="field"><span>当たった場合の費用（わかる所だけでOK・タップして入力）</span>
        <div class="bd-grid">${BD.map((b) => `<button class="bd-btn" data-act="amtField" data-key="bd.${b.id}" data-label="${b.name}の費用" data-mode="mid" id="af-bd-${b.id}">${em(b.em)}<span class="bd-n">${b.name}</span><span class="af-v">${gdraft.bd[b.id] ? yen(gdraft.bd[b.id]) : '¥0'}</span><span class="af-r" hidden></span></button>`).join('')}</div></div>
      <label class="toggle"><span>想定外 ＋10%（最初から1割足しておく）</span><input type="checkbox" id="gBuf" ${gdraft.buffer ? 'checked' : ''}></label>
      <label class="toggle"><span>当選確率を自己予想する</span><input type="checkbox" id="gProbOn" ${gdraft.prob != null ? 'checked' : ''}></label>
      <div id="gProbBox" ${gdraft.prob != null ? '' : 'hidden'}><input type="range" id="gProb" min="5" max="95" step="5" value="${gdraft.prob ?? 30}" aria-label="当選確率"><div class="pct-scale"><span>5%</span><span id="gProbLbl"></span><span>95%</span></div></div>
      ${g ? amtFieldHTML('gsaved', '積立済み（直すとき）', gdraft.savedEdit, 'mid', '¥0') : ''}
      <div class="preview" id="gPrev"></div>
      <button class="btn block" data-act="saveGoal">${g ? '保存する' : '追加する'}</button>
      ${g ? '<div style="text-align:center;margin-top:6px"><button class="link-btn" data-act="delGoal">この公演を消す</button></div>' : ''}</div>`, () => { gdraft = null; });
    const f = $('#gForm');
    f.addEventListener('input', goalInput);
    f.addEventListener('change', goalInput);
    goalInput();
  }
  function goalInput() {
    if (!gdraft || !$('#gForm')) return;
    gdraft.title = $('#gTitle').value; gdraft.date = $('#gDate').value; gdraft.buffer = $('#gBuf').checked;
    BD.forEach((b) => { const el = $(`#af-bd-${b.id} .af-v`); if (el) el.textContent = yen(gdraft.bd[b.id] || 0); });
    const on = $('#gProbOn').checked; $('#gProbBox').hidden = !on;
    const pr = $('#gProb'); gdraft.prob = on ? Number(pr.value) : null;
    pr.style.setProperty('--p', ((pr.value - 5) / 90 * 100) + '%');
    $('#gProbLbl').textContent = on ? `だいたい ${pr.value}%` : '';
    const cost = gCost(gdraft);
    let html = `当たった場合の費用 <b>${yen(cost)}</b>${gdraft.buffer && cost ? ` <span class="muted small">（想定外 ${yen(gBuffer(gdraft))} 込み）</span>` : ''}`;
    if (gdraft.date && cost) {
      const tmp = { ...gdraft, deposits: gdraft.id ? [{ d: '1970-01-01', a: gdraft.savedEdit, t: 'move' }] : gdraft.deposits };
      const m = gMonths(tmp);
      html += `<br>毎月の積立 <b>${yen(gMonthly(tmp))}</b> <span class="muted small">${m > 0 ? `（${yen(Math.max(0, cost - gSaved(tmp)))} ÷ ${m}か月）` : '（今月まとめて）'}</span>`;
      if (gdraft.prob != null) html += `<br><span class="muted small">期待値 ${yen(cost * gdraft.prob / 100)}（費用×${gdraft.prob}%）</span>`;
    } else html += '<br><span class="muted small">日付と費用を入れると、毎月の積立額が出ます</span>';
    $('#gPrev').innerHTML = html;
  }
  function saveGoal() {
    goalInput();
    const g = gdraft;
    if (!g.title.trim()) return toast('名前を入れてください');
    if (!g.date) return toast('公演の日を選んでください');
    if (!gCost(g)) return toast('費用を1つ以上入れてください');
    const isNew = !g.id; g.id = g.id || uid(); g.title = g.title.trim();
    if (!isNew) { const have = gSaved(g); if (g.savedEdit !== have) g.deposits.push({ d: today(), a: g.savedEdit - have, t: 'move' }); }
    const carry = g.carryFrom; delete g.carryFrom; delete g.savedEdit;
    if (carry) moveSaved(carry, g);
    if (isNew) S.goals.push(g); else S.goals = S.goals.map((x) => (x.id === g.id ? g : x));
    save(); closeSheet(); ui.tab = 'goals'; ui.goalView = 'active'; render();
    toast(isNew ? `${g.title} を追加。毎月 ${yen(gMonthly(g))} ずつ` : '保存しました');
  }
  function moveSaved(fromId, to) {
    const from = S.goals.find((x) => x.id === fromId); if (!from) return 0;
    const amt = gSaved(from); if (amt <= 0) return 0;
    from.deposits = [...(from.deposits || []), { d: today(), a: -amt, t: 'move' }];
    to.deposits = [...(to.deposits || []), { d: today(), a: amt, t: 'move', from: from.title }];
    return amt;
  }
  function deposit(id) {
    const g = S.goals.find((x) => x.id === id); if (!g) return;
    const amt = gTodo(g);
    if (amt <= 0) return toast('今月ぶんは積立済みです');
    const before = gSaved(g) / gCost(g);
    g.deposits = [...(g.deposits || []), { d: today(), a: amt }];
    save(); render();
    const after = gSaved(g) / gCost(g);
    const el = $(`#g-${id}`); const b = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    sparkle(b.left + b.width / 2, b.top + 60);
    if (after >= 1 && before < 1) {
      confetti(90); toast(`${g.title} の積立、達成！準備できてる`);
      setTimeout(() => openSheet(`<h3>${em('party')}積立達成！</h3><p class="muted" style="margin-bottom:12px">「${esc(g.title)}」の準備ができました。達成カードを残しておきませんか？</p>
        <button class="btn block" data-act="share" data-kind="goal" data-id="${g.id}">${em('sparkles')}達成カードをつくる</button><div style="text-align:center"><button class="link-btn" data-act="close">あとで</button></div>`), 900);
    } else { confetti(36); toast(`${yen(amt)} 積み立てました。えらい！`); }
  }
  function setStatus(id, s) {
    const g = S.goals.find((x) => x.id === id); if (!g || g.status === s) return;
    g.status = s; save(); render();
    if (s === 'win') { confetti(110); toast('当選おめでとう！宿はその日のうちに押さえよう'); }
    if (s === 'lose') {
      const amt = gSaved(g);
      if (amt <= 0) { toast('次の公演でまた会えますように'); return; }
      const others = activeGoals().filter((x) => x.id !== id && daysUntil(x.date) >= 0);
      openSheet(`<h3>${em('pig')}積み立てたお金は、次に回せます</h3>
        <p class="muted" style="margin-bottom:12px">「${esc(g.title)}」の積立 <b class="acc">${yen(amt)}</b> は無駄になりません。どこに回しますか？</p>
        ${others.map((o) => `<button class="btn line block" style="margin-bottom:8px" data-act="moveTo" data-from="${id}" data-to="${o.id}">${esc(o.title)}（${jdate(o.date)}）へ</button>`).join('')}
        <button class="btn block" style="margin-bottom:8px" data-act="moveNew" data-from="${id}">＋ 新しい公演をつくって回す</button>
        <div style="text-align:center"><button class="link-btn" data-act="close">あとで決める</button></div>`);
    }
  }

  /* ---------- シェアカード ---------- */
  let shareOpt = null, shareBlob = null, shareUrl = null, shareSeq = 0;
  async function shareData() {
    const o = shareOpt;
    if (o.kind === 'month') {
      const mk = o.mk, spent = spendOf(mk), B = S.budget || 0, cats = byCat(mk);
      const top = CATS.filter((c) => cats[c.id] > 0).sort((a, b) => cats[b.id] - cats[a.id])[0] || null;
      const ids = metas.filter((m) => m.date.startsWith(mk)).slice(0, 9).map((m) => m.id);
      if (o.photoId && !ids.includes(o.photoId)) ids.unshift(o.photoId), ids.length = Math.min(ids.length, 9);
      const photos = (await Promise.all(ids.map(fullPhoto))).filter(Boolean);
      const days = new Set(recsOfMonth(mk).map((r) => r.date)).size;
      return { monthLabel: mkLabel(mk), budget: B, pct: B ? Math.round(spent / B * 100) : 0, top, photos, days, spentLabel: yen(spent),
        badge: !spent ? '推し活の記録、はじめました' : !B ? '推し活を記録した月' : spent <= B ? '予算内で楽しめた' : '全力で推した月' };
    }
    if (o.kind === 'day') {
      const m = metas.find((x) => x.id === o.photoId); if (!m) return null;
      return { head: '推し活の思い出', title: (recsOfDay(m.date)[0]?.memo) || '推しに会えた日', dateLabel: jdate(m.date, true), big: `${parse(m.date).getMonth() + 1}月${parse(m.date).getDate()}日`, pct: 0, noMoney: true, photo: await fullPhoto(m.id) };
    }
    const g = S.goals.find((x) => x.id === o.id); if (!g) return null;
    const cov = goalCover(g);
    const photo = await fullPhoto(o.photoId || (cov && cov.id));
    const d = daysUntil(g.date);
    return { title: g.title, dateLabel: jdate(g.date, true), days: d, past: d < 0, pct: gPct(g), savedLabel: yen(gSaved(g)), costLabel: yen(gCost(g)), photo };
  }
  function openShare(kind, id, photoId) {
    shareOpt = { kind, id, mk: ui.sumMk, size: 'story', frame: 'ticket', sticker: 'none', showMoney: false, photoId: photoId || null };
    openSheet(`<h3>${em('sparkles')}シェアカード</h3><div id="shareBody"></div>`, () => { if (shareUrl) URL.revokeObjectURL(shareUrl); shareUrl = null; shareBlob = null; shareOpt = null; });
    drawShareUI(); makeCard();
  }
  function optChips(list, cur, act) {
    return list.map((x) => {
      const locked = x.lock && !unlocked(x.lock);
      return `<button class="ochip${cur === x.id ? ' on' : ''}${locked ? ' locked' : ''}" data-act="${act}" data-v="${x.id}"${locked ? ` data-lock="${x.lock}"` : ''}>${x.name}${locked ? `<span class="lockb">シェアで解放</span>` : ''}</button>`;
    }).join('');
  }
  function drawShareUI() {
    const o = shareOpt, el = $('#shareBody'); if (!el) return;
    const goals = S.goals;
    const nextLock = [1, 2, 3].find((n) => (S.shares || 0) < n);
    el.innerHTML = `<div class="share-prev"><img id="sharePrev" alt="シェアカードの見本"><div class="share-wait" id="shareWait">つくっています…</div></div>
      <div class="seg" style="margin:10px 0 6px">${[...(o.photoId ? [['day', 'この写真']] : []), ['event', '現場'], ['month', '月のまとめ'], ['goal', '積立達成']].map(([k, v]) => `<button data-act="shareKind" data-v="${k}" class="${o.kind === k ? 'on' : ''}"${(k === 'event' || k === 'goal') && !goals.length ? ' disabled' : ''}>${v}</button>`).join('')}</div>
      ${(o.kind === 'event' || o.kind === 'goal') && goals.length ? `<select class="inp" id="shareGoal" aria-label="公演">${goals.map((g) => `<option value="${g.id}"${g.id === o.id ? ' selected' : ''}>${esc(g.title)}（${jdate(g.date)}）</option>`).join('')}</select>` : ''}
      <div class="opt-row"><span class="opt-l">サイズ</span><div class="ochips">${optChips([{ id: 'story', name: 'ストーリー 9:16' }, { id: 'post', name: '投稿 4:5' }], o.size, 'shareSize')}</div></div>
      <div class="opt-row"><span class="opt-l">枠</span><div class="ochips">${optChips(FRAMES, o.frame, 'shareFrame')}</div></div>
      <div class="opt-row"><span class="opt-l">スタンプ</span><div class="ochips">${optChips(STICKERS, o.sticker, 'shareSticker')}</div></div>
      <label class="toggle"><span>金額も載せる<br><span class="muted small">オフのときは割合とバッジだけ</span></span><input type="checkbox" id="shareMoney" ${o.showMoney ? 'checked' : ''}></label>
      <button class="btn block" data-act="shareGo" id="shareGo">${em('sparkles')}シェアする</button>
      <div style="text-align:center"><button class="link-btn" data-act="shareSave">画像を保存</button></div>
      <p class="muted small" style="text-align:center">${nextLock ? `カードをシェアすると、${UNLOCK_NAME[nextLock]}が使えるようになります（あと${nextLock - (S.shares || 0)}回）` : 'ぜんぶ解放ずみ。いつもシェアありがとう！'}<br>写真はこの端末の中だけに保存されます</p>`;
    const sg = $('#shareGoal'); if (sg) sg.addEventListener('change', (e) => { shareOpt.id = e.target.value; makeCard(); });
    $('#shareMoney').addEventListener('change', (e) => { shareOpt.showMoney = e.target.checked; makeCard(); });
  }
  async function makeCard() {
    if (!shareOpt || !window.OshiShare) return;
    const seq = ++shareSeq; const w = $('#shareWait'); if (w) w.hidden = false;
    const o = shareOpt;
    if ((o.kind === 'event' || o.kind === 'goal') && !o.id) o.id = (nextEvent() || S.goals[0] || {}).id;
    const data = await shareData();
    if (!data || seq !== shareSeq) return;
    const cv = await OshiShare.render(o.kind === 'day' ? 'event' : o.kind, { size: o.size, frame: o.frame, sticker: o.sticker, showMoney: o.showMoney, color: accHex(), ink: accInk() }, data);
    const blob = await OshiShare.toBlob(cv);
    if (seq !== shareSeq || !shareOpt) return;
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareBlob = blob; shareUrl = URL.createObjectURL(blob);
    const img = $('#sharePrev'); if (img) { img.src = shareUrl; img.dataset.w = cv.width; img.dataset.h = cv.height; }
    const ww = $('#shareWait'); if (ww) ww.hidden = true;
  }
  const shareName = () => `oshikatsu_${shareOpt.kind}_${today()}.png`;
  async function shareGo() {
    if (!shareBlob) return toast('つくっています。少し待ってね');
    const file = new File([shareBlob], shareName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file] });
        countShare();
      } catch (e) { if (e && e.name !== 'AbortError') toast('シェアできませんでした。「画像を保存」から投稿してね'); }
    } else { downloadBlob(shareBlob, shareName()); toast('画像を保存しました。Instagram や TikTok から投稿してね'); }
  }
  function countShare() {
    const before = S.shares || 0; S.shares = before + 1; save();
    if (UNLOCK_NAME[S.shares]) { confetti(70); toast(`解放：${UNLOCK_NAME[S.shares]}`); } else toast('シェアありがとう！');
    drawShareUI(); makeCard();
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function lockedTap(lock) { const n = lockLeft(lock); toast(`カードをシェアすると使えるようになります（あと${n}回）`); }

  /* ---------- 通知（ホーム画面に追加したアプリで・iOS 16.4 以降） ---------- */
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const prefs = () => ({ daily: S.notif.daily ? S.notif.time : null, monthStart: !!S.notif.monthStart, eventSoon: !!S.notif.eventSoon, time: S.notif.time });
  function b64ToU8(b) { const p = '='.repeat((4 - (b.length % 4)) % 4); const s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); }
  function postForm(obj) {
    const body = new URLSearchParams(); body.set(FORM_FIELD, JSON.stringify(obj));
    return fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
  }
  async function pushReg() { return navigator.serviceWorker.ready; }
  async function enablePush() {
    if (!pushSupported()) return false;
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('通知が許可されていません。設定アプリの「通知」から許可できます'); return false; }
    const reg = await pushReg();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC) });
    await postForm({ sub: sub.toJSON ? sub.toJSON() : sub, prefs: prefs(), id: S.installId, v: 1 });
    return true;
  }
  async function disablePush() {
    try { const reg = await pushReg(); const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { /* */ }
    await postForm({ id: S.installId, unsub: true, v: 1 });
  }
  let prefT;
  function prefsChanged() {
    save(); clearTimeout(prefT);
    if (!S.notif.on) return;
    prefT = setTimeout(async () => { try { const reg = await pushReg(); const sub = await reg.pushManager.getSubscription(); if (sub) postForm({ sub: sub.toJSON(), prefs: prefs(), id: S.installId, v: 1 }); } catch (e) { /* */ } }, 600);
  }
  function notifHTML() {
    if (IS_IOS && !standalone()) {
      return `<p class="muted small" style="margin-bottom:10px">iPhone では、<b>ホーム画面に追加したアプリ</b>からだけ通知を受け取れます（iOS 16.4 以降）。先にホーム画面に追加して、そこから開いてください。</p>
        <button class="btn sm block" data-act="installGuide">ホーム画面に追加する方法</button>`;
    }
    if (!pushSupported()) return '<p class="muted small">このブラウザは通知に対応していません。</p>';
    const n = S.notif, dis = n.on ? '' : ' disabled';
    return `<label class="toggle"><span>通知を受け取る</span><input type="checkbox" id="nOn" ${n.on ? 'checked' : ''}></label>
      <div class="notif-sub${n.on ? '' : ' off'}">
        <label class="toggle"><span>毎日のリマインド<br><span class="muted small">「今日の推し活、記録した？」と残りの予算</span></span><input type="checkbox" id="nDaily" ${n.daily ? 'checked' : ''}${dis}></label>
        <div class="time-row"><span class="muted small">時刻</span>${['20:00', '21:00', '22:00'].map((t) => `<button class="ochip${n.time === t ? ' on' : ''}" data-act="nTime" data-v="${t}"${dis}>${t}</button>`).join('')}</div>
        <label class="toggle"><span>月初のお知らせ<br><span class="muted small">1日の朝に、今月の推し予算</span></span><input type="checkbox" id="nMonth" ${n.monthStart ? 'checked' : ''}${dis}></label>
        <label class="toggle"><span>現場が近いお知らせ<br><span class="muted small">7日以内の現場があるとき、上の時刻に</span></span><input type="checkbox" id="nSoon" ${n.eventSoon ? 'checked' : ''}${dis}></label>
      </div>
      <p class="muted small">通知の文面はこの端末の中で作ります。送るのは「通知の届け先」と時刻の設定だけで、金額や推しの名前は送りません。</p>`;
  }
  function bindNotif(root) {
    root.addEventListener('change', async (e) => {
      const t = e.target;
      if (t.id === 'nOn') {
        t.disabled = true;
        if (t.checked) { const ok = await enablePush().catch(() => false); S.notif.on = !!ok; if (ok) toast('通知をオンにしました'); }
        else { await disablePush(); S.notif.on = false; toast('通知をオフにしました'); }
        save(); $('#notifBox').innerHTML = notifHTML(); return;
      }
      const map = { nDaily: 'daily', nMonth: 'monthStart', nSoon: 'eventSoon' };
      if (map[t.id]) { S.notif[map[t.id]] = t.checked; prefsChanged(); }
    });
  }

  /* ---------- 全画面（はじめに・設定・案内） ---------- */
  function showScreen(html) { const l = $('#screenLayer'); l.innerHTML = html; l.hidden = false; l.scrollTop = 0; }
  function hideScreen() { const l = $('#screenLayer'); l.hidden = true; l.innerHTML = ''; }
  const colorsHTML = () => `<div class="colors">${COLORS.map((c) => { const lk = c.lock && !unlocked(c.lock); return `<button class="color${S.color === c.id ? ' on' : ''}${lk ? ' locked' : ''}" style="background:${c.hex}" data-act="color" data-c="${c.id}" aria-label="${c.name}${lk ? '（シェアで解放）' : ''}">${lk ? '<span class="lockb">シェアで解放</span>' : ''}</button>`; }).join('')}</div>
    <div class="color-name" id="colorName">推し色：${(COLORS.find((c) => c.id === S.color) || COLORS[0]).name}</div>`;
  function budgetBlockHTML() {
    return `<div class="pct"><div class="muted small">毎月の推し活予算（守る予算）</div><div class="yen-big" id="bAmt"></div><div class="muted small" id="bRead"></div><div class="muted small" id="bPct"></div></div>
      <div id="bSlider"><input type="range" id="pctInp" min="5" max="25" step="0.5" value="${S.pct}" aria-label="手取りに対する割合"><div class="pct-scale"><span>5%</span><span class="hint-band">目安 10〜15%</span><span>25%</span></div></div>
      ${amtFieldHTML('budget', '金額で決める（直接入れてもOK）', S.budget, 'mid')}
      <ul class="calc" id="bCalc"></ul>`;
  }
  function budgetSync(src) {
    const sl = $('#pctInp'); const th = S.takehome || 0;
    if (sl) {
      if (src === 'budget') { if (th) { S.pct = Math.round(S.budget / th * 200) / 2; sl.value = Math.min(25, Math.max(5, S.pct)); } }
      else if (th && (src === 'pct' || src === 'th' || (src === 'init' && !S.budget))) { if (src === 'pct') S.pct = Number(sl.value); S.budget = Math.round(th * S.pct / 100 / 100) * 100; refreshField('budget', S.budget); }
      $('#bSlider').hidden = !th;
      sl.style.setProperty('--p', ((sl.value - 5) / 20 * 100) + '%');
    }
    if ($('#bAmt')) {
      $('#bAmt').textContent = yen(S.budget);
      $('#bRead').textContent = S.budget ? reading(S.budget) : '';
      $('#bPct').textContent = th ? `手取りの ${S.pct}%` : '手取りを入れると、10〜15%の目安が出ます';
      $('#bCalc').innerHTML = th ? `<li><span>手取り</span><b>${yen(th)}</b></li><li><span>固定費</span><b>− ${yen(S.fixed)}</b></li><li><span>先取り貯金</span><b>− ${yen(S.saving)}</b></li><li><span>推し活予算</span><b>− ${yen(S.budget)}</b></li><li><span>生活費</span><b>${yen(lifeCost())}</b></li>` : '';
    }
  }
  function bindMoney(root) {
    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'pctInp') { budgetSync('pct'); save(); }
      if (t.id === 'nameInp') { S.name = t.value.trim(); applyTheme(); save(); }
    });
  }

  // アプリ内ブラウザ（Instagram・TikTok・LINE・Facebook）の中では、ホーム画面に追加できない
  function inAppGuide(next) {
    const line = IN_APP === 'LINE';
    const ext = line ? (location.href + (location.search ? '&' : '?') + 'openExternalBrowser=1') : '';
    const how = { Instagram: '右上の「…」→「外部ブラウザで開く」', TikTok: '右上の「…」→「ブラウザで開く」', LINE: '右下の「…」→「ブラウザで開く」', Facebook: '右上の「…」→「外部ブラウザで開く」' }[IN_APP];
    showScreen(`<div class="screen fade-in" id="iab">
      <div class="ob-hero">${em('sparkles')}<h1>${IS_IOS ? 'Safari' : 'ブラウザ'}で開きなおしてね</h1><p>いまは ${IN_APP} の中で開いています。<br>このままだと、ホーム画面に追加できず、記録が消えやすくなります</p></div>
      <div class="iab-demo" aria-hidden="true"><div class="iab-bar"><span class="iab-x">×</span><span class="iab-url">oshikatsu-app</span><span class="iab-dots">…</span></div>
        <div class="iab-menu"><div>リンクをコピー</div><div class="hl">${IS_IOS ? '外部ブラウザで開く' : 'ブラウザで開く'}</div><div>共有</div></div><div class="iab-finger">👆</div></div>
      <ol class="guide-steps"><li><b>${how}</b></li><li>${IS_IOS ? 'Safari' : 'ブラウザ'}で開いたら、ホーム画面に追加</li></ol>
      <div class="ob-foot">
        ${line ? `<a class="btn block" href="${esc(ext)}">${IS_IOS ? 'Safari' : 'ブラウザ'}で開く</a>` : ''}
        <button class="btn block${line ? ' line' : ''}" data-act="copyUrl">URLをコピー</button>
        <p class="muted small" style="text-align:center">コピーしたら ${IS_IOS ? 'Safari' : 'ブラウザ'} のアドレス欄に貼りつけて開きます</p>
        <button class="link-btn" data-act="iabSkip">このまま使う</button></div></div>`);
    iabNext = next;
  }
  let iabNext = null;
  async function copyUrl() {
    const u = location.href.replace(/[?&]openExternalBrowser=1/, '');
    try { await navigator.clipboard.writeText(u); toast('URLをコピーしました'); }
    catch (e) { const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('URLをコピーしました'); } catch (er) { toast(u); } t.remove(); }
  }

  // iPhone の Safari：ホーム画面に追加の手順（動きつき）
  function installGuide(back) {
    showScreen(`<div class="screen fade-in" id="ig">
      <div class="set-head"><button class="back" data-act="${back ? 'settings' : 'closeScreen'}" aria-label="もどる">‹</button><h2>ホーム画面に追加</h2></div>
      <div class="perks">${[['📲', 'ワンタップで開ける'], ['🔔', '通知が届く'], ['✨', '全画面でアプリみたい']].map(([i, t]) => `<div class="perk"><span>${i}</span>${t}</div>`).join('')}</div>
      <div class="ig-demo" aria-hidden="true">
        <div class="ig-phone"><div class="ig-screen"><img src="icons/icon-192.png" alt=""><div class="ig-sheet"><div>コピー</div><div class="hl">ホーム画面に追加 <span>＋</span></div><div>ブックマークを追加</div></div></div>
          <div class="ig-bar"><span>‹</span><span>›</span><span class="ig-share"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg></span><span>▢</span><span>⧉</span></div>
          <div class="ig-finger">👆</div></div></div>
      <ol class="guide-steps">
        <li>画面の下（または上）の <b>共有ボタン</b>（□に↑）をタップ<br><span class="muted small">見つからないときは「…」の中にあります</span></li>
        <li>下にスクロールして <b>「ホーム画面に追加」</b></li>
        <li>右上の <b>「追加」</b>。ホーム画面のアイコンから開きます</li></ol>
      <p class="muted small" style="text-align:center">記録はそのまま引きつがれないことがあります。先に設定の「書き出す」で控えをとっておくと安心です。</p>
      <div class="ob-foot"><button class="btn block" data-act="${back ? 'settings' : 'closeScreen'}">わかった</button></div></div>`);
  }

  let obStep = 0;
  function onboarding() {
    const steps = `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i <= obStep ? 'on' : ''}"></i>`).join('')}</div>`;
    const top = `<div class="ob-top">${steps}<button class="link-btn" data-act="obSkip">スキップ</button></div>`;
    let body = '';
    if (obStep === 0) body = `<div class="ob-hero">${em('starstruck')}<h1>推しに会い続けるための<br>家計簿へようこそ</h1><p>推し活費は削るものじゃなく、最初に守る予算。<br>まずは推しのことを教えてください</p></div>
      <div class="ob-body"><label class="field"><span>推しの名前（任意・この端末の中だけ）</span><input class="inp" id="nameInp" maxlength="16" placeholder="例：〇〇くん" value="${esc(S.name)}" autocomplete="off"></label>
      <div class="field"><span>推し色をえらぶ（アプリの色が変わります）</span>${colorsHTML()}</div></div>`;
    if (obStep === 1) body = `<div class="ob-hero">${em('moneybag')}<h1>お金を3つに分けよう</h1><p>生活・貯金・推し。<br>だいたいの金額で大丈夫。あとから直せます</p></div>
      <div class="ob-body">${amtFieldHTML('takehome', '毎月の手取り', S.takehome, 'big', '例：22万円')}${amtFieldHTML('fixed', '固定費（家賃・スマホ・光熱費・サブスクなど／任意）', S.fixed, 'mid', '例：8万7,000円')}${amtFieldHTML('saving', '先取り貯金（給料日に先に移す額／任意）', S.saving, 'mid', '例：2万円')}
      <p class="muted small">入れた金額は、この端末の中にだけ保存されます。</p></div>`;
    if (obStep === 2) body = `<div class="ob-hero">${em('lightstick')}<h1>推し活の「守る予算」</h1><p>目安は手取りの10〜15%。<br>先に確保して、残りで生活を整えます</p></div>
      <div class="ob-body"><section class="card">${budgetBlockHTML()}</section></div>`;
    showScreen(`<div class="screen fade-in" id="ob">${top}${body}<div class="ob-foot">
      <button class="btn block" data-act="obNext">${obStep < 2 ? '次へ' : 'はじめる'}</button>
      ${obStep > 0 ? '<button class="link-btn" data-act="obBack">もどる</button>' : ''}</div></div>`);
    bindMoney($('#ob'));
    if (obStep === 2) budgetSync('init');
  }
  function obNext() { if (obStep < 2) { obStep++; save(); onboarding(); return; } finishOb(true); }
  function finishOb(party) {
    S.onboarded = true; save(); hideScreen(); render();
    if (party) { confetti(80); toast(S.name ? `${S.name}に会い続けよう！` : '推しに会い続けよう！'); }
    setTimeout(afterOnboard, 1400);
  }
  function afterOnboard() {
    if (S.a2hs || standalone() || IN_APP || !S.onboarded) return;
    if (IS_IOS) { S.a2hs = true; save(); installGuide(false); }
  }

  function settings() {
    showScreen(`<div class="screen fade-in" id="set">
      <div class="set-head"><button class="back" data-act="closeScreen" aria-label="もどる">‹</button><h2>設定</h2></div>
      <section class="card"><h2>${em('heart')}推し</h2><label class="field"><span>推しの名前（任意）</span><input class="inp" id="nameInp" maxlength="16" value="${esc(S.name)}" placeholder="例：〇〇くん" autocomplete="off"></label>
        <div class="field"><span>推し色</span>${colorsHTML()}</div></section>
      <section class="card"><h2>${em('moneybag')}お金の3つの置き場所</h2>${amtFieldHTML('takehome', '毎月の手取り', S.takehome, 'big')}${amtFieldHTML('fixed', '固定費（任意）', S.fixed)}${amtFieldHTML('saving', '先取り貯金（任意）', S.saving)}${budgetBlockHTML()}</section>
      <section class="card" id="notifCard"><h2>🔔 通知</h2><div id="notifBox">${notifHTML()}</div></section>
      ${standalone() ? '' : `<section class="card"><h2>📲 ホーム画面に追加</h2><p class="muted small" style="margin-bottom:10px">ワンタップで開けて、通知も届くようになります。</p>
        ${IN_APP ? '<button class="btn sm block" data-act="iabShow">ブラウザで開きなおす方法</button>' : installPrompt ? '<button class="btn sm block" data-act="installNow">ホーム画面に追加</button>' : IS_IOS ? '<button class="btn sm block" data-act="installGuideSet">追加のしかたを見る</button>' : '<p class="muted small">ブラウザのメニューから「ホーム画面に追加」を選んでください。</p>'}</section>`}
      <section class="card"><h2>${em('envelope')}バックアップ</h2><p class="muted small" style="margin-bottom:10px">機種変更の前などに、データをファイルに書き出しておけます（写真は含みません）。</p>
        <div class="row"><button class="btn sm line" data-act="export">書き出す</button><label class="btn sm line" style="position:relative">読み込む<input type="file" id="importInp" accept="application/json,.json" style="position:absolute;inset:0;opacity:0;font-size:16px"></label></div></section>
      <section class="card"><h2>${em('warn')}リセット</h2><p class="muted small" style="margin-bottom:10px">すべての記録・写真・設定を消して、最初からやり直します。</p><button class="btn sm danger block" data-act="reset">データをすべて消す</button></section>
      <p class="foot-note">${em('check')}データはこの端末の中だけに保存されます</p>
      <p class="muted small" style="text-align:center">写真もこの端末の中だけ。ログイン不要。ブラウザのデータを消すと記録も消えます。<br>イラスト：Microsoft Fluent Emoji（MIT）</p>
    </div>`);
    const root = $('#set'); bindMoney(root); bindNotif(root); budgetSync('show');
    $('#importInp').addEventListener('change', importData);
  }
  function exportData() {
    downloadBlob(new Blob([JSON.stringify({ app: 'oshikatsu-kakeibo', exportedAt: new Date().toISOString(), data: S }, null, 2)], { type: 'application/json' }), `推し活家計簿_${today()}.json`);
    toast('書き出しました');
  }
  function importData(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    f.text().then((txt) => {
      const j = JSON.parse(txt); const d = j.data || j;
      if (!Array.isArray(d.records) || !Array.isArray(d.goals)) throw new Error('bad');
      if (!confirm('いまのデータを、このファイルの中身に置き換えます。よいですか？')) return;
      const keep = { installId: S.installId, notif: S.notif };
      S = Object.assign(defaults(), d, keep); save(); hideScreen(); render(); toast('読み込みました');
    }).catch(() => toast('このファイルは読み込めませんでした'));
  }

  /* ---------- 演出 ---------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  function confetti(n = 60) {
    const fx = $('#fx'); const cols = [accHex(), '#8D7BFF', '#FFE45C', '#FF9EC0', '#7FD3FF'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length];
      p.style.setProperty('--x', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
      p.style.setProperty('--d', (1.2 + Math.random() * 1.2) + 's'); p.style.animationDelay = Math.random() * 0.3 + 's';
      if (i % 3 === 0) p.style.borderRadius = '50%';
      fx.appendChild(p); setTimeout(() => p.remove(), 3000);
    }
  }
  function sparkle(x, y) {
    const fx = $('#fx'); const marks = ['✦', '♡', '✧', '★'];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('b'); const a = (i / 10) * Math.PI * 2, r = 50 + Math.random() * 30;
      s.textContent = marks[i % 4]; s.style.left = x - 10 + 'px'; s.style.top = y - 12 + 'px';
      s.style.color = i % 2 ? 'var(--acc)' : '#F5B400';
      s.style.setProperty('--x', Math.cos(a) * r + 'px'); s.style.setProperty('--y', Math.sin(a) * r + 'px');
      fx.appendChild(s); setTimeout(() => s.remove(), 1100);
    }
  }

  /* ---------- 操作 ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act],[data-close]'); if (!el) return;
    if (el.hasAttribute('data-close')) { if (el.closest('#kpLayer')) return closeFieldPad(); return closeSheet(); }
    const a = el.dataset.act, id = el.dataset.id;
    switch (a) {
      case 'tab': ui.tab = el.dataset.tab; render(); scrollTo(0, 0); break;
      case 'settings': settings(); break;
      case 'closeScreen': hideScreen(); render(); break;
      case 'add': closeSheet(); openAdd({ date: el.dataset.d }); break;
      case 'pk': padKey(pads[el.dataset.pad], el.dataset.k); break;
      case 'pc': padChip(pads[el.dataset.pad], Number(el.dataset.v)); break;
      case 'amtField': openFieldPad(el.dataset.key, el.dataset.label, el.dataset.mode || 'mid'); break;
      case 'fieldOk': if (fieldDone) fieldDone(); break;
      case 'pickCat': buzz(); draft.cat = el.dataset.c; $$('.cat').forEach((c) => c.classList.toggle('on', c === el)); break;
      case 'saveRec': saveRec(); break;
      case 'editRec': { const r = S.records.find((x) => x.id === id); if (r) { closeSheet(); openAdd({ rec: r }); } break; }
      case 'delRec': if (confirm('この記録を消しますか？')) { S.records = S.records.filter((x) => x.id !== draft.id); save(); closeSheet(); render(); toast('消しました'); } break;
      case 'day': if (ui.tab === 'cal') { ui.sel = el.dataset.d; render(); } else openDay(el.dataset.d); break;
      case 'calPrev': case 'calNext': ui.calMk = mkShift(ui.calMk, a === 'calPrev' ? -1 : 1); render(); break;
      case 'sumPrev': case 'sumNext': ui.sumMk = mkShift(ui.sumMk, a === 'sumPrev' ? -1 : 1); render(); break;
      case 'newGoal': openGoal(null); break;
      case 'editGoal': { const g = S.goals.find((x) => x.id === id); if (g) openGoal(g); break; }
      case 'saveGoal': saveGoal(); break;
      case 'delGoal': if (confirm('この公演を消しますか？積立の記録も消えます')) { const gid = gdraft.id; S.goals = S.goals.filter((x) => x.id !== gid); metas.filter((m) => m.goalId === gid).forEach((m) => { m.goalId = null; OshiDB.put('pmeta', null, m).catch(() => {}); }); save(); closeSheet(); render(); toast('消しました'); } break;
      case 'deposit': deposit(id); break;
      case 'status': setStatus(id, el.dataset.s); break;
      case 'goalView': ui.goalView = el.dataset.v; render(); break;
      case 'moveTo': { const to = S.goals.find((x) => x.id === el.dataset.to); const amt = moveSaved(el.dataset.from, to); save(); closeSheet(); render(); sparkle(innerWidth / 2, innerHeight / 2); toast(`${yen(amt)} を ${to.title} に回しました`); break; }
      case 'moveNew': { const from = el.dataset.from; closeSheet(); openGoal(null, { carryFrom: from }); break; }
      case 'close': closeSheet(); break;
      case 'check': {
        const mk = thisMk(); const arr = S.checks[mk] || [false, false, false, false, false];
        arr[+el.dataset.i] = el.checked; S.checks[mk] = arr; save();
        if (CHECKS.every((_, i) => arr[i])) { confetti(50); toast('今月の5分、おわり！'); render(); }
        break;
      }
      case 'hideCheck': S.checkHide[thisMk()] = true; save(); render(); break;
      case 'hideHomeA2hs': S.homeA2hsHide = true; save(); render(); break;
      case 'color': {
        const c = COLORS.find((x) => x.id === el.dataset.c);
        if (c.lock && !unlocked(c.lock)) return lockedTap(c.lock);
        S.color = c.id; save(); applyTheme(); $$('.color').forEach((b) => b.classList.toggle('on', b === el)); $('#colorName').textContent = `推し色：${c.name}`; break;
      }
      case 'obNext': obNext(); break;
      case 'obBack': obStep = Math.max(0, obStep - 1); onboarding(); break;
      case 'obSkip': finishOb(false); break;
      case 'export': exportData(); break;
      case 'reset':
        if (confirm('すべての記録・写真・設定を消します。元に戻せません。よいですか？')) {
          try { localStorage.removeItem(KEY); } catch (er) { /* */ }
          try { for (const st of ['pmeta', 'pthumb', 'pfull', 'kv']) await OshiDB.clear(st); } catch (er) { /* */ }
          turl.forEach((u) => URL.revokeObjectURL(u)); turl.clear(); metas = []; indexMetas();
          S = defaults(); S.installId = uid() + uid(); hideScreen(); obStep = 0; render(); onboarding();
        }
        break;
      case 'photo': pickPhoto({ date: el.dataset.date, goalId: el.dataset.goal || null }); break;
      case 'viewPhoto': openViewer(el.dataset.pidOpen, el.dataset.ctx); break;
      case 'viewClose': closeViewer(); break;
      case 'viewPrev': viewStep(-1); break;
      case 'viewNext': viewStep(1); break;
      case 'viewDel': if (viewer && confirm('この写真を消しますか？')) { const m = viewer.list[viewer.i]; await delPhoto(m.id); viewer.list = viewer.list.filter((x) => x.id !== m.id); viewer.i = Math.min(viewer.i, viewer.list.length - 1); refreshAfterPhoto(); if (viewer.list.length) drawViewer(); else closeViewer(); toast('写真を消しました'); } break;
      case 'viewCard': { const m = viewer && viewer.list[viewer.i]; if (!m) break; const ev = eventOf(m); closeViewer(); closeSheet(); openShare(ev ? 'event' : 'day', ev ? ev.id : null, m.id); break; }
      case 'calView': ui.calView = el.dataset.v; render(); break;
      case 'albumBy': ui.albumBy = el.dataset.v; ui.albumN = 6; render(); break;
      case 'albumMore': ui.albumN += 6; render(); break;
      case 'share': closeSheet(); openShare(el.dataset.kind, id); break;
      case 'shareKind': shareOpt.kind = el.dataset.v; if (el.dataset.v === 'goal') { const f = S.goals.find((g) => gSaved(g) >= gCost(g)); if (f) shareOpt.id = f.id; } drawShareUI(); makeCard(); break;
      case 'shareSize': case 'shareFrame': case 'shareSticker':
        if (el.dataset.lock) return lockedTap(el.dataset.lock);
        shareOpt[{ shareSize: 'size', shareFrame: 'frame', shareSticker: 'sticker' }[a]] = el.dataset.v; drawShareUI(); makeCard(); break;
      case 'shareGo': shareGo(); break;
      case 'shareSave': if (shareBlob) { downloadBlob(shareBlob, shareName()); toast('画像を保存しました'); } break;
      case 'nTime': S.notif.time = el.dataset.v; $$('[data-act=nTime]').forEach((b) => b.classList.toggle('on', b === el)); prefsChanged(); break;
      case 'installGuide': installGuide(false); break;
      case 'installGuideSet': installGuide(true); break;
      case 'installNow': if (installPrompt) { installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => ({})); installPrompt = null; if (r.outcome === 'accepted') toast('ホーム画面に追加しました'); render(); } break;
      case 'iabShow': inAppGuide(() => settings()); break;
      case 'copyUrl': copyUrl(); break;
      case 'iabSkip': { try { sessionStorage.setItem('oshi-iab-skip', '1'); } catch (er) { /* */ } const n = iabNext; iabNext = null; hideScreen(); if (n) n(); break; }
    }
  });
  function refreshAfterPhoto() {
    const scr = $('#screenLayer'); render();
    if (!$('#sheetLayer').hidden && ui.daySheet && $('#sheet .photo-strip')) openDay(ui.daySheet);
    void scr;
  }
  $('#photoInp').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f || !photoTarget || !photoTarget.date) return;
    if (await attachPhoto(photoTarget, f)) { refreshAfterPhoto(); sparkle(innerWidth / 2, innerHeight / 3); toast('写真を貼りました'); }
  });
  (() => { let x0 = null; const l = $('#viewLayer');
    l.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    l.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) viewStep(dx < 0 ? 1 : -1); });
  })();
  $('#sheetLayer').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) ui.daySheet = null; });
  $$('.tab').forEach((t) => t.addEventListener('click', () => { ui.tab = t.dataset.tab; render(); scrollTo(0, 0); }));
  $('#fab').addEventListener('click', () => openAdd({ date: ui.tab === 'cal' ? ui.sel : today() }));
  $('#btnSettings').addEventListener('click', settings);
  document.addEventListener('keydown', (e) => {
    if (!$('#kpLayer').hidden || (!$('#sheetLayer').hidden && pads.rec)) {
      const p = !$('#kpLayer').hidden ? pads.field : pads.rec;
      if (p && /^[0-9]$/.test(e.key) && e.target.tagName !== 'INPUT') { padKey(p, e.key); return; }
      if (p && e.key === 'Backspace' && e.target.tagName !== 'INPUT') { padKey(p, '⌫'); return; }
    }
    if (viewer && e.key === 'ArrowRight') return viewStep(1);
    if (viewer && e.key === 'ArrowLeft') return viewStep(-1);
    if (e.key === 'Escape') { if (viewer) closeViewer(); else if (!$('#kpLayer').hidden) closeFieldPad(); else if (!$('#sheetLayer').hidden) closeSheet(); }
  });
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (S.onboarded && ui.tab === 'home' && $('#screenLayer').hidden) render(); });
  addEventListener('appinstalled', () => { installPrompt = null; render(); });

  /* ---------- 起動 ---------- */
  fetch('offers.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then((j) => { offers = Array.isArray(j) ? j : (j.items || []); if (ui.tab === 'sum') render(); }).catch(() => {});
  save();
  render();
  loadMetas().then(() => { if (metas.length) render(); });
  const iabSkipped = (() => { try { return sessionStorage.getItem('oshi-iab-skip') === '1'; } catch (e) { return false; } })();
  const start = () => { if (!S.onboarded) onboarding(); else { setTimeout(afterOnboard, 1200); if (/[?&]add=1/.test(location.search)) openAdd({}); } };
  if (IN_APP && !iabSkipped) inAppGuide(start); else start();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.__oshi = { reading, pads, padVal }; // テスト用（中身を読むだけ）
})();
