/* 推し活家計簿 v1 — 素の JavaScript・ビルド不要。データはこの端末の localStorage だけに保存する */
'use strict';
(() => {
  const KEY = 'oshikakeibo.v1';
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

  /* ---------- 保存 ---------- */
  const defaults = () => ({
    v: 1, onboarded: false, name: '', color: 'pink', takehome: 0, fixed: 0, saving: 0, pct: 12, budget: 0,
    records: [], goals: [], checks: {}, checkHide: {}, lastCat: 'ticket', a2hs: false,
  });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { /* 読めないときは新しく始める */ }
    return defaults();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('保存できませんでした（ブラウザの設定を確認してください）'); }
  }

  /* ---------- 小道具 ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (n) => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
  const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; };
  const comma = (n) => (n ? Number(n).toLocaleString('ja-JP') : '');
  const em = (name, cls = 'em') => `<img src="assets/emoji/${name}.png" alt="" class="${cls}" loading="lazy">`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => ymd(new Date());
  const mkOf = (s) => s.slice(0, 7);
  const thisMk = () => mkOf(today());
  const mkLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${y}年${m}月`; };
  const mkShift = (mk, k) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const jdate = (s, withYear) => { const d = parse(s); return `${withYear ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`; };
  const daysUntil = (s) => Math.round((parse(s) - parse(today())) / 86400000);
  const cat = (id) => CATS.find((c) => c.id === id) || CATS[5];

  /* ---------- 推し色 ---------- */
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(h, to, t) { const a = hexRgb(h), b = hexRgb(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function lum(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function applyTheme() {
    const c = (COLORS.find((x) => x.id === S.color) || COLORS[0]).hex;
    const st = document.documentElement.style;
    const [r, g, b] = hexRgb(c);
    st.setProperty('--acc', c);
    st.setProperty('--acc-l', mix(c, '#ffffff', 0.86));
    st.setProperty('--acc-d', mix(c, '#2B2A5A', lum(c) > 0.45 ? 0.45 : 0.18));
    st.setProperty('--acc-ink', lum(c) > 0.45 ? '#2B2A5A' : '#ffffff');
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
  // 公演までの月数＝(公演の年−今の年)×12＋公演の月−今の月（テンプレと同じ式・0未満は0）
  const gMonths = (g) => { const e = parse(g.date), n = new Date(); return Math.max(0, (e.getFullYear() - n.getFullYear()) * 12 + e.getMonth() - n.getMonth()); };
  const savedBeforeThisMonth = (g) => { const mk = thisMk(); return sum((g.deposits || []).filter((x) => x.t === 'move' || mkOf(x.d) < mk), (x) => x.a); };
  const depositedThisMonth = (g) => { const mk = thisMk(); return sum((g.deposits || []).filter((x) => x.t !== 'move' && mkOf(x.d) === mk), (x) => x.a); };
  // 毎月の積立額＝残り÷月数（円単位で切り上げ）。月数0なら残りを今月まとめて
  function gMonthly(g) {
    const rest = Math.max(0, gCost(g) - savedBeforeThisMonth(g));
    const m = gMonths(g);
    return m <= 0 ? rest : Math.ceil(rest / m);
  }
  const gTodo = (g) => Math.max(0, Math.min(gMonthly(g) - depositedThisMonth(g), gCost(g) - gSaved(g)));
  const activeGoals = () => S.goals.filter((g) => g.status !== 'lose');
  function nextEvent() {
    const t = today();
    return activeGoals().filter((g) => g.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  }
  const expected = () => sum(S.goals.filter((g) => g.status === 'apply' && g.prob != null), (g) => gCost(g) * g.prob / 100);

  /* ---------- 画面の状態 ---------- */
  const ui = { tab: 'home', calMk: thisMk(), sel: today(), sumMk: thisMk(), goalView: 'active' };
  let offers = [];

  function render() {
    applyTheme();
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === ui.tab));
    const main = $('#main');
    main.innerHTML = `<div class="fade-in">${({ home: homeHTML, cal: calTabHTML, goals: goalsHTML, sum: sumHTML })[ui.tab]()}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(animateIn));
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
    const msg = left < 0 ? 'はみ出した分は、来月の予算で調整しよう' : ratio > 0.5 ? 'まだまだ余裕。全力で楽しもう' : ratio > 0.15 ? '計画どおり。いいペース' : 'のこり少し。次の現場を思い出してから使おう';
    const cats = byCat(mk);
    const chips = CATS.filter((c) => cats[c.id] > 0).map((c) => `<span class="chip">${em(c.em)}${c.name}<b>${yen(cats[c.id])}</b></span>`).join('');
    return `<section class="card ring-card">
      <div class="ring-wrap"><svg viewBox="0 0 220 220"><circle class="ring-bg" cx="110" cy="110" r="${R}" fill="none" stroke-width="18"/>
        <circle class="ring-fg" cx="110" cy="110" r="${R}" fill="none" stroke-width="18" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-to="${C * (1 - ratio)}"/></svg>
        <div class="ring-in"><div class="ring-lbl">今月の推し予算</div>
          ${left >= 0 ? `<div class="ring-lbl">あと</div><div class="ring-val" id="ringVal">${yen(left)}</div>` : `<div class="ring-val over" id="ringVal">${yen(-left)} はみ出し</div>`}
          <div class="ring-of">${yen(spent)} / ${yen(B)}</div></div>
        ${em(face, 'ring-em')}</div>
      <p class="ring-msg">${msg}</p>
      <div class="chips">${chips || '<span class="muted small">＋ボタンから、今月の1行目を記録しよう</span>'}</div>
    </section>`;
  }
  function nextStubHTML() {
    const g = nextEvent();
    if (!g) {
      return `<button class="stub" data-act="newGoal" style="width:100%;text-align:left"><div class="stub-main empty-stub">${em('calendar')}<div><div class="stub-t">次の現場を登録しよう</div><div class="stub-d">当たった場合の費用から、毎月の積立額を出します</div></div></div><div class="stub-side"><div class="big">＋</div><div class="lbl">追加</div></div></button>`;
    }
    const d = daysUntil(g.date), pct = Math.min(100, Math.round(gSaved(g) / Math.max(1, gCost(g)) * 100));
    return `<button class="stub" data-act="tab" data-tab="goals" style="width:100%;text-align:left">
      <div class="stub-main"><div class="stub-k">${em('ticket')}次の現場 <span class="badge ${g.status}">${STATUS[g.status]}</span></div>
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
  function homeHTML() {
    return `${checkHTML(false)}${ringHTML()}${nextStubHTML()}
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

  /* ---------- カレンダー ---------- */
  function calHTML(mk, sel, big) {
    const [y, m] = mk.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate(), t = today();
    const evs = {}; activeGoals().forEach((g) => { if (g.date.startsWith(mk)) (evs[g.date] = evs[g.date] || []).push(g); });
    const per = {}; recsOfMonth(mk).forEach((r) => { per[r.date] = per[r.date] || { n: 0, a: 0 }; per[r.date].n++; per[r.date].a += r.amount; });
    let cells = [...DOW].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < first; i++) cells += '<div class="day out"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${mk}-${pad(d)}`, p = per[ds];
      const dots = p ? '<i></i>'.repeat(Math.min(3, p.n)) : '';
      const lbl = `${m}月${d}日${p ? `・記録${p.n}件` : ''}${evs[ds] ? '・現場' : ''}`;
      cells += `<button class="day${ds === t ? ' today' : ''}${ds === sel ? ' sel' : ''}" data-act="day" data-d="${ds}" aria-label="${lbl}">
        <span class="n">${d}</span>${big && p ? `<span class="amt">${p.a >= 10000 ? (p.a / 10000).toFixed(1).replace(/\.0$/, '') + '万' : comma(p.a)}</span>` : `<span class="dots">${dots}</span>`}
        ${evs[ds] ? em('ticket', 'ev') : ''}</button>`;
    }
    return `<div class="cal-head"><button class="nav-btn" data-act="calPrev" aria-label="前の月">‹</button><b>${mkLabel(mk)}</b><button class="nav-btn" data-act="calNext" aria-label="次の月">›</button></div>
      <div class="cal${big ? ' big' : ''}">${cells}</div>
      <div class="legend"><span><i></i>使った日</span><span>${em('ticket')}現場の日</span></div>`;
  }
  function calTabHTML() {
    const d = ui.sel, evs = activeGoals().filter((g) => g.date === d), list = recsOfDay(d).sort(sortRec);
    const mk = ui.calMk;
    return `<section class="card">${calHTML(mk, d, true)}</section>
      <h2 class="sec-h">${em('calendar')}${jdate(d)}<button class="more" data-act="add" data-d="${d}">＋この日に記録</button></h2>
      ${evs.map((g) => `<button class="stub" data-act="editGoal" data-id="${g.id}" style="width:100%;text-align:left"><div class="stub-main"><div class="stub-k">${em('ticket')}現場の日</div><div class="stub-t">${esc(g.title)}</div><div class="stub-d">${STATUS[g.status]}・${yen(gCost(g))}</div></div><div class="stub-side">${em('starstruck', 'em" style="width:40px;height:40px')}</div></button>`).join('')}
      <section class="card soft">${recListHTML(list, false)}${list.length ? `<p class="muted small" style="text-align:right;margin-top:6px">この日の合計 <b class="acc">${yen(sum(list, (r) => r.amount))}</b></p>` : ''}</section>
      <h2 class="sec-h">${em('receipt')}${mkLabel(mk)}の記録 <span class="muted small" style="margin-left:auto">${yen(spendOf(mk))}</span></h2>
      <section class="card soft">${recListHTML(recsOfMonth(mk).sort(sortRec), true)}</section>`;
  }

  /* ---------- 積立 ---------- */
  function goalCardHTML(g) {
    const cost = gCost(g), saved = gSaved(g), pct = Math.min(100, Math.round(saved / Math.max(1, cost) * 100));
    const d = daysUntil(g.date), past = d < 0, months = gMonths(g), todo = gTodo(g), monthly = gMonthly(g);
    const full = saved >= cost && cost > 0;
    return `<article class="stub goal${g.status === 'lose' ? ' lost' : ''}${full ? ' full' : ''}" id="g-${g.id}">
      <div class="stub-main">
        <div class="stub-k"><span class="badge ${g.status}">${STATUS[g.status]}</span>${g.prob != null && g.status === 'apply' ? `<span class="muted small">当選予想 ${g.prob}%</span>` : ''}</div>
        <div class="stub-t">${esc(g.title)}</div>
        <div class="stub-d">${jdate(g.date, true)}</div>
        <div class="bar"><i data-w="${pct}%"></i></div>
        <div class="goal-nums"><span>積立済み <b class="acc">${yen(saved)}</b></span><span>目標 ${yen(cost)}</span></div>
        ${g.status !== 'lose' && !past && !full ? `<div class="preview" style="margin:10px 0 0;padding:10px">毎月 <b>${yen(monthly)}</b> <span class="muted small">${months > 0 ? `× あと${months}か月` : '今月まとめて'}</span></div>` : ''}
        ${full && g.status !== 'lose' ? `<p class="check-done" style="text-align:left">${em('party')} 準備できてる！あとは当日を待つだけ</p>` : ''}
        <div class="goal-acts">
          ${g.status !== 'lose' && !full && !past ? (todo > 0 ? `<button class="btn sm" data-act="deposit" data-id="${g.id}">${em('pig')}今月ぶん積み立てた <span style="opacity:.85">${yen(todo)}</span></button>` : `<button class="btn sm ghost" disabled>${em('check')}今月ぶんは済み</button>`) : ''}
          <button class="btn sm ghost" data-act="editGoal" data-id="${g.id}" style="flex:0 0 auto">編集</button>
        </div>
        <div class="seg" role="group" aria-label="当落">${Object.entries(STATUS).map(([k, v]) => `<button data-act="status" data-id="${g.id}" data-s="${k}" class="${g.status === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      </div>
      <div class="stub-side">${past ? '<div class="lbl">おつかれさま</div>' : d === 0 ? '<div class="big" style="font-size:22px">今日！</div>' : `<div class="lbl">あと</div><div class="big">${d}</div><div class="lbl">日</div>`}<div class="lbl" style="margin-top:6px">${pct}%</div></div>
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
    return ['pig', '少しはみ出した月もあります。来月の予算で調整すれば大丈夫。見直しリストを1つだけ試すのもおすすめです。'];
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
        ${B ? `<div class="bar bm-bar"><i data-w="${p}%"></i></div><div class="goal-nums"><span>${p}%</span><span>${spent <= B ? 'あと ' + yen(B - spent) : yen(spent - B) + ' はみ出し'}</span></div>` : ''}
        <div class="gentle">${em(face)}<span>${msg}</span></div>
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
    sh.innerHTML = html; layer.hidden = false; sh.scrollTop = 0; sheetClose = onClose || null;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheetLayer').hidden = true; $('#sheet').innerHTML = ''; document.body.style.overflow = '';
    const f = sheetClose; sheetClose = null; if (f) f();
  }

  // 記録（3タップ：数字→カテゴリ→記録する）
  let draft = null;
  function openAdd(opt = {}) {
    const r = opt.rec;
    draft = r ? { ...r, amount: String(r.amount) } : { id: null, amount: '', cat: S.lastCat || 'ticket', date: opt.date || today(), memo: '' };
    openSheet(`<h3>${em('sparkles')}${r ? '記録を直す' : '推し活を記録'}</h3>
      <div class="amt-disp" id="amtDisp"></div>
      <div class="cats">${CATS.map((c) => `<button class="cat${c.id === draft.cat ? ' on' : ''}" data-act="pickCat" data-c="${c.id}">${em(c.em)}${c.name}</button>`).join('')}</div>
      <div class="meta-row"><label class="date-chip">${em('calendar')}<span id="dateLbl">${jdate(draft.date)}</span><input type="date" id="dateInp" value="${draft.date}" aria-label="日付"></label>
        <input class="memo" id="memoInp" placeholder="メモ（任意）" maxlength="40" value="${esc(draft.memo)}" enterkeyhint="done"></div>
      <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((k) => `<button class="key${k === '⌫' || k === '00' ? ' fn' : ''}" data-act="key" data-k="${k}" aria-label="${k === '⌫' ? '1文字消す' : k}">${k}</button>`).join('')}</div>
      <button class="btn block" id="saveRec" data-act="saveRec">記録する</button>
      ${r ? '<div style="text-align:center;margin-top:6px"><button class="link-btn" data-act="delRec">この記録を消す</button></div>' : ''}`);
    drawAmt(false);
    $('#dateInp').addEventListener('change', (e) => { if (e.target.value) { draft.date = e.target.value; $('#dateLbl').textContent = jdate(draft.date); } });
    $('#memoInp').addEventListener('input', (e) => (draft.memo = e.target.value));
  }
  function drawAmt(pop = true) {
    const el = $('#amtDisp'); if (!el) return;
    const n = num(draft.amount);
    el.innerHTML = `<small>¥</small>${n ? n.toLocaleString('ja-JP') : '0'}`;
    el.classList.toggle('zero', !n);
    $('#saveRec').disabled = !n;
    if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  function saveRec() {
    const n = num(draft.amount); if (!n) return;
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
      ${recListHTML(list, false)}
      ${list.length ? `<p class="muted small" style="text-align:right;margin:6px 0 10px">この日の合計 <b class="acc">${yen(sum(list, (r) => r.amount))}</b></p>` : ''}
      <button class="btn block" data-act="add" data-d="${d}" style="margin-top:8px">＋ この日に記録する</button>`);
  }

  // 公演・イベント
  let gdraft = null;
  function openGoal(g, opt = {}) {
    gdraft = g ? JSON.parse(JSON.stringify(g)) : { id: null, title: '', date: '', bd: {}, buffer: true, prob: null, status: 'apply', deposits: [] };
    gdraft.carryFrom = opt.carryFrom || null;
    openSheet(`<div id="gForm"><h3>${em('ticket')}${g ? '公演・イベントを編集' : '公演・イベントを追加'}</h3>
      <label class="field"><span>名前</span><input class="inp" id="gTitle" maxlength="40" placeholder="例：秋ツアー 大阪2日目" value="${esc(gdraft.title)}"></label>
      <label class="field"><span>公演の日</span><input class="inp" type="date" id="gDate" value="${gdraft.date}" min="${today()}"></label>
      <div class="field"><span>当たった場合の費用（わかる所だけでOK）</span>
        <div class="bd-grid">${BD.map((b) => `<label>${em(b.em)}<span>${b.name}</span><input inputmode="numeric" pattern="[0-9]*" data-bd="${b.id}" value="${comma(gdraft.bd[b.id])}" placeholder="0" aria-label="${b.name}の費用"></label>`).join('')}</div></div>
      <label class="toggle"><span>想定外 ＋10%（最初から1割足しておく）</span><input type="checkbox" id="gBuf" ${gdraft.buffer ? 'checked' : ''}></label>
      <label class="toggle"><span>当選確率を自己予想する</span><input type="checkbox" id="gProbOn" ${gdraft.prob != null ? 'checked' : ''}></label>
      <div id="gProbBox" ${gdraft.prob != null ? '' : 'hidden'}><input type="range" id="gProb" min="5" max="100" step="5" value="${gdraft.prob ?? 30}" aria-label="当選確率"><div class="pct-scale"><span>5%</span><span id="gProbLbl"></span><span>100%</span></div></div>
      ${g ? `<label class="field" style="margin-top:8px"><span>積立済み（直すとき）</span><div class="yen-inp"><input class="inp" inputmode="numeric" pattern="[0-9]*" id="gSaved" value="${comma(gSaved(g))}"></div></label>` : ''}
      <div class="preview" id="gPrev"></div>
      <button class="btn block" data-act="saveGoal">${g ? '保存する' : '追加する'}</button>
      ${g ? '<div style="text-align:center;margin-top:6px"><button class="link-btn" data-act="delGoal">この公演を消す</button></div>' : ''}</div>`);
    const sh = $('#gForm');
    sh.addEventListener('input', goalInput);
    sh.addEventListener('change', goalInput);
    goalInput();
  }
  function goalInput(e) {
    if (!gdraft || !$('#gForm')) return;
    if (e && e.target.matches('[data-bd],#gSaved')) { const n = num(e.target.value); e.target.value = comma(n); }
    gdraft.title = $('#gTitle').value; gdraft.date = $('#gDate').value; gdraft.buffer = $('#gBuf').checked;
    $$('[data-bd]').forEach((i) => (gdraft.bd[i.dataset.bd] = num(i.value)));
    const on = $('#gProbOn').checked; $('#gProbBox').hidden = !on;
    const pr = $('#gProb'); gdraft.prob = on ? Number(pr.value) : null;
    pr.style.setProperty('--p', ((pr.value - 5) / 95 * 100) + '%');
    $('#gProbLbl').textContent = on ? `だいたい ${pr.value}%` : '';
    const cost = gCost(gdraft);
    let html = `当たった場合の費用 <b>${yen(cost)}</b>${gdraft.buffer && cost ? ` <span class="muted small">（想定外 ${yen(gBuffer(gdraft))} 込み）</span>` : ''}`;
    if (gdraft.date && cost) {
      const tmp = { ...gdraft, deposits: $('#gSaved') ? [{ d: '1970-01-01', a: num($('#gSaved').value), t: 'move' }] : gdraft.deposits };
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
    const savedInp = $('#gSaved');
    if (savedInp) { const want = num(savedInp.value), have = gSaved(g); if (want !== have) g.deposits.push({ d: today(), a: want - have, t: 'move' }); }
    const carry = g.carryFrom; delete g.carryFrom;
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
    if (after >= 1 && before < 1) { confetti(90); toast(`${g.title} の積立、100%！準備できてる`); } else { confetti(36); toast(`${yen(amt)} 積み立てました。えらい！`); }
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

  /* ---------- 全画面（はじめに・設定） ---------- */
  function showScreen(html) { const l = $('#screenLayer'); l.innerHTML = html; l.hidden = false; l.scrollTop = 0; }
  function hideScreen() { const l = $('#screenLayer'); l.hidden = true; l.innerHTML = ''; }
  const colorsHTML = () => `<div class="colors">${COLORS.map((c) => `<button class="color${S.color === c.id ? ' on' : ''}" style="background:${c.hex}" data-act="color" data-c="${c.id}" aria-label="${c.name}"></button>`).join('')}</div>
    <div class="color-name" id="colorName">推し色：${(COLORS.find((c) => c.id === S.color) || COLORS[0]).name}</div>`;
  const moneyInp = (id, label, val, ph) => `<label class="field"><span>${label}</span><div class="yen-inp"><input class="inp" inputmode="numeric" pattern="[0-9]*" id="${id}" value="${comma(val)}" placeholder="${ph || ''}"></div></label>`;
  function budgetBlockHTML() {
    return `<div class="pct"><div class="muted small">毎月の推し活予算（守る予算）</div><div class="yen-big" id="bAmt"></div><div class="muted small" id="bPct"></div></div>
      <div id="bSlider"><input type="range" id="pctInp" min="5" max="25" step="0.5" value="${S.pct}" aria-label="手取りに対する割合"><div class="pct-scale"><span>5%</span><span class="hint-band">目安 10〜15%</span><span>25%</span></div></div>
      ${moneyInp('budgetInp', '金額で決める（直接入れてもOK）', S.budget, '例：30000')}
      <ul class="calc" id="bCalc"></ul>`;
  }
  function budgetSync(src) {
    const th = num($('#thInp')?.value ?? S.takehome);
    S.takehome = th; if ($('#fxInp')) S.fixed = num($('#fxInp').value); if ($('#svInp')) S.saving = num($('#svInp').value);
    const sl = $('#pctInp'), bi = $('#budgetInp');
    if (!sl || !bi) return;
    if (src === 'budget') { S.budget = num(bi.value); if (th) { S.pct = Math.round(S.budget / th * 200) / 2; sl.value = Math.min(25, Math.max(5, S.pct)); } }
    else if (th && (src === 'pct' || src === 'th' || src === 'init' && !S.budget)) { S.pct = Number(sl.value); S.budget = Math.round(th * S.pct / 100 / 100) * 100; bi.value = comma(S.budget); }
    $('#bSlider').hidden = !th;
    sl.style.setProperty('--p', ((sl.value - 5) / 20 * 100) + '%');
    $('#bAmt').textContent = yen(S.budget);
    $('#bPct').textContent = th ? `手取りの ${S.pct}%` : '手取りを入れると、10〜15%の目安が出ます';
    $('#bCalc').innerHTML = th ? `<li><span>手取り</span><b>${yen(th)}</b></li><li><span>固定費</span><b>− ${yen(S.fixed)}</b></li><li><span>先取り貯金</span><b>− ${yen(S.saving)}</b></li><li><span>推し活予算</span><b>− ${yen(S.budget)}</b></li><li><span>生活費</span><b>${yen(lifeCost())}</b></li>` : '';
  }
  function bindMoney(root) {
    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('#thInp,#fxInp,#svInp,#budgetInp')) t.value = comma(num(t.value));
      if (t.id === 'pctInp') budgetSync('pct');
      else if (t.id === 'budgetInp') budgetSync('budget');
      else if (t.matches('#thInp,#fxInp,#svInp')) budgetSync(t.id === 'thInp' ? 'th' : 'x');
      if (t.id === 'nameInp') { S.name = t.value.trim(); applyTheme(); }
    });
  }

  let obStep = 0;
  function onboarding() {
    const steps = `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i <= obStep ? 'on' : ''}"></i>`).join('')}</div>`;
    const top = `<div class="ob-top">${steps}<button class="link-btn" data-act="obSkip">スキップ</button></div>`;
    let body = '';
    if (obStep === 0) body = `<div class="ob-hero">${em('starstruck')}<h1>推しに会い続けるための<br>家計簿へようこそ</h1><p>推し活費は削るものじゃなく、最初に守る予算。<br>まずは推しのことを教えてください</p></div>
      <div class="ob-body"><label class="field"><span>推しの名前（任意・この端末の中だけ）</span><input class="inp" id="nameInp" maxlength="16" placeholder="例：〇〇くん" value="${esc(S.name)}"></label>
      <div class="field"><span>推し色をえらぶ（アプリの色が変わります）</span>${colorsHTML()}</div></div>`;
    if (obStep === 1) body = `<div class="ob-hero">${em('moneybag')}<h1>お金を3つに分けよう</h1><p>生活・貯金・推し。<br>だいたいの金額で大丈夫。あとから直せます</p></div>
      <div class="ob-body">${moneyInp('thInp', '毎月の手取り', S.takehome, '例：220000')}${moneyInp('fxInp', '固定費（家賃・スマホ・光熱費・サブスクなど／任意）', S.fixed, '例：87000')}${moneyInp('svInp', '先取り貯金（給料日に先に移す額／任意）', S.saving, '例：20000')}
      <p class="muted small">入れた金額は、この端末の中にだけ保存されます。</p></div>`;
    if (obStep === 2) body = `<div class="ob-hero">${em('lightstick')}<h1>推し活の「守る予算」</h1><p>目安は手取りの10〜15%。<br>先に確保して、残りで生活を整えます</p></div>
      <div class="ob-body"><section class="card">${budgetBlockHTML()}</section></div>`;
    showScreen(`<div class="screen fade-in" id="ob">${top}${body}<div class="ob-foot">
      <button class="btn block" data-act="obNext">${obStep < 2 ? '次へ' : 'はじめる'}</button>
      ${obStep > 0 ? '<button class="link-btn" data-act="obBack">もどる</button>' : ''}</div></div>`);
    const root = $('#ob'); bindMoney(root);
    if (obStep === 2) budgetSync('init');
  }
  function obNext() {
    if (obStep === 1) { S.takehome = num($('#thInp').value); S.fixed = num($('#fxInp').value); S.saving = num($('#svInp').value); }
    if (obStep < 2) { obStep++; save(); onboarding(); return; }
    finishOb(true);
  }
  function finishOb(party) {
    S.onboarded = true; save(); hideScreen(); render();
    if (party) { confetti(80); toast(S.name ? `${S.name}に会い続けよう！` : '推しに会い続けよう！'); }
    setTimeout(maybeA2hs, 1600);
  }

  function settings() {
    showScreen(`<div class="screen fade-in" id="set">
      <div class="set-head"><button class="back" data-act="closeScreen" aria-label="もどる">‹</button><h2>設定</h2></div>
      <section class="card"><h2>${em('heart')}推し</h2><label class="field"><span>推しの名前（任意）</span><input class="inp" id="nameInp" maxlength="16" value="${esc(S.name)}" placeholder="例：〇〇くん"></label>
        <div class="field"><span>推し色</span>${colorsHTML()}</div></section>
      <section class="card"><h2>${em('moneybag')}お金の3つの置き場所</h2>${moneyInp('thInp', '毎月の手取り', S.takehome, '例：220000')}${moneyInp('fxInp', '固定費（任意）', S.fixed)}${moneyInp('svInp', '先取り貯金（任意）', S.saving)}${budgetBlockHTML()}</section>
      <section class="card"><h2>${em('envelope')}バックアップ</h2><p class="muted small" style="margin-bottom:10px">機種変更の前などに、データをファイルに書き出しておけます。</p>
        <div class="row"><button class="btn sm line" data-act="export">書き出す</button><label class="btn sm line" style="position:relative">読み込む<input type="file" id="importInp" accept="application/json,.json" style="position:absolute;inset:0;opacity:0"></label></div></section>
      <section class="card"><h2>${em('warn')}リセット</h2><p class="muted small" style="margin-bottom:10px">すべての記録と設定を消して、最初からやり直します。</p><button class="btn sm danger block" data-act="reset">データをすべて消す</button></section>
      <p class="foot-note">${em('check')}データはこの端末の中だけに保存されます</p>
      <p class="muted small" style="text-align:center">ログイン不要・送信なし。ブラウザのデータを消すと記録も消えます。<br>イラスト：Microsoft Fluent Emoji（MIT）</p>
    </div>`);
    const root = $('#set'); bindMoney(root); budgetSync('show');
    root.addEventListener('change', () => save());
    root.addEventListener('input', () => save());
    $('#importInp').addEventListener('change', importData);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'oshikatsu-kakeibo', exportedAt: new Date().toISOString(), data: S }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `推し活家計簿_${today()}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('書き出しました');
  }
  function importData(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    f.text().then((txt) => {
      const j = JSON.parse(txt); const d = j.data || j;
      if (!Array.isArray(d.records) || !Array.isArray(d.goals)) throw new Error('bad');
      if (!confirm('いまのデータを、このファイルの中身に置き換えます。よいですか？')) return;
      S = Object.assign(defaults(), d); save(); hideScreen(); render(); toast('読み込みました');
    }).catch(() => toast('このファイルは読み込めませんでした'));
  }

  /* ---------- 演出 ---------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  function confetti(n = 60) {
    const fx = $('#fx'); const cols = [getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#FF4F87', '#8D7BFF', '#FFE45C', '#FF9EC0', '#7FD3FF'];
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
  function maybeA2hs() {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    if (!ios || standalone || S.a2hs || !S.onboarded) return;
    S.a2hs = true; save();
    const d = document.createElement('div'); d.className = 'a2hs'; d.id = 'a2hs';
    d.innerHTML = `<button class="x-btn" data-act="closeA2hs" aria-label="閉じる">×</button>下の <b>共有ボタン</b>（□に↑）→ <b>「ホーム画面に追加」</b>で、アプリみたいにすぐ開けます`;
    document.body.appendChild(d);
  }

  /* ---------- 操作 ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act],[data-close]'); if (!el) return;
    if (el.hasAttribute('data-close')) return closeSheet();
    const a = el.dataset.act, id = el.dataset.id;
    switch (a) {
      case 'tab': ui.tab = el.dataset.tab; render(); scrollTo(0, 0); break;
      case 'settings': settings(); break;
      case 'closeScreen': hideScreen(); render(); break;
      case 'add': closeSheet(); openAdd({ date: el.dataset.d }); break;
      case 'key': {
        const k = el.dataset.k;
        if (k === '⌫') draft.amount = draft.amount.slice(0, -1);
        else if (draft.amount.length < 8) draft.amount = (draft.amount + k).replace(/^0+/, '');
        drawAmt(); break;
      }
      case 'pickCat': draft.cat = el.dataset.c; $$('.cat').forEach((c) => c.classList.toggle('on', c === el)); break;
      case 'saveRec': saveRec(); break;
      case 'editRec': { const r = S.records.find((x) => x.id === id); if (r) { closeSheet(); openAdd({ rec: r }); } break; }
      case 'delRec': if (confirm('この記録を消しますか？')) { S.records = S.records.filter((x) => x.id !== draft.id); save(); closeSheet(); render(); toast('消しました'); } break;
      case 'day':
        if (ui.tab === 'cal') { ui.sel = el.dataset.d; render(); } else openDay(el.dataset.d);
        break;
      case 'calPrev': case 'calNext': ui.calMk = mkShift(ui.calMk, a === 'calPrev' ? -1 : 1); render(); break;
      case 'sumPrev': case 'sumNext': ui.sumMk = mkShift(ui.sumMk, a === 'sumPrev' ? -1 : 1); render(); break;
      case 'newGoal': openGoal(null); break;
      case 'editGoal': { const g = S.goals.find((x) => x.id === id); if (g) openGoal(g); break; }
      case 'saveGoal': saveGoal(); break;
      case 'delGoal': if (confirm('この公演を消しますか？積立の記録も消えます')) { S.goals = S.goals.filter((x) => x.id !== gdraft.id); save(); closeSheet(); render(); toast('消しました'); } break;
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
      case 'color': S.color = el.dataset.c; save(); applyTheme(); $$('.color').forEach((c) => c.classList.toggle('on', c === el)); $('#colorName').textContent = `推し色：${COLORS.find((c) => c.id === S.color).name}`; break;
      case 'obNext': obNext(); break;
      case 'obBack': obStep = Math.max(0, obStep - 1); onboarding(); break;
      case 'obSkip': finishOb(false); break;
      case 'export': exportData(); break;
      case 'reset':
        if (confirm('すべての記録と設定を消します。元に戻せません。よいですか？')) { try { localStorage.removeItem(KEY); } catch (er) { /* */ } S = defaults(); hideScreen(); obStep = 0; render(); onboarding(); }
        break;
      case 'closeA2hs': $('#a2hs')?.remove(); break;
    }
  });
  $$('.tab').forEach((t) => t.addEventListener('click', () => { ui.tab = t.dataset.tab; render(); scrollTo(0, 0); }));
  $('#fab').addEventListener('click', () => openAdd({ date: ui.tab === 'cal' ? ui.sel : today() }));
  $('#btnSettings').addEventListener('click', settings);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheetLayer').hidden) closeSheet(); });

  /* ---------- 起動 ---------- */
  fetch('offers.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then((j) => { offers = Array.isArray(j) ? j : (j.items || []); if (ui.tab === 'sum') render(); }).catch(() => {});
  render();
  if (!S.onboarded) onboarding(); else setTimeout(maybeA2hs, 1600);
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
