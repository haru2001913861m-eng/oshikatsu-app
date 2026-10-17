/* 通知の文面を端末の中で作る（サービスワーカーとアプリの両方で使う）。
   サーバーから届くのは {"type":"daily"|"monthStart"|"eventSoon"} だけ。金額や推しの名前は端末の外に出さない */
(function (g) {
  'use strict';
  const BD = ['ticket', 'travel', 'hotel', 'goods', 'food'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const yen = (n) => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const cost = (gl) => { const b = BD.reduce((a, k) => a + ((gl.bd && gl.bd[k]) || 0), 0); return b + (gl.buffer ? Math.round(b * 0.1) : 0); };
  const saved = (gl) => (gl.deposits || []).reduce((a, x) => a + (x.a || 0), 0);

  function soonEvent(S, now) {
    const t = ymd(now);
    const list = (S.goals || []).filter((gl) => gl.status !== 'lose' && gl.date >= t)
      .map((gl) => ({ gl, days: Math.round((parse(gl.date) - parse(t)) / 86400000) }))
      .filter((x) => x.days <= 7).sort((a, b) => a.days - b.days);
    return list[0] || null;
  }
  function daily(S, now) {
    const mk = ymd(now).slice(0, 7);
    const spent = (S.records || []).filter((r) => r.date.startsWith(mk)).reduce((a, r) => a + r.amount, 0);
    const B = S.budget || 0;
    if (!B) return '今日の推し活、記録した？ 1行だけでOK';
    const left = B - spent;
    return left >= 0 ? `今日の推し活、記録した？ 今月の推し予算はあと${yen(left)}` : `今日の推し活、記録した？ 今月は予算を${yen(-left)}こえています。来月で調整しよう`;
  }
  function build(type, S, now) {
    S = S || {}; now = now || new Date();
    const title = '推し活家計簿';
    if (type === 'monthStart') {
      const m = now.getMonth() + 1;
      return { title, body: S.budget ? `${m}月の推し予算 ${yen(S.budget)} スタート。先に守る分を確保しよう` : `${m}月がスタート。今月の推し予算を決めておこう`, tag: 'monthStart' };
    }
    if (type === 'eventSoon') {
      const s = soonEvent(S, now);
      if (s) {
        const c = cost(s.gl), v = saved(s.gl);
        const body = s.days === 0 ? `今日は${s.gl.title}！楽しんできてね` : `${s.gl.title}まであと${s.days}日。積立は${yen(v)}/${yen(c)}`;
        return { title, body, tag: 'eventSoon' };
      }
    }
    return { title, body: daily(S, now), tag: 'daily' };
  }
  g.OshiNotice = { build, soonEvent };
})(typeof self !== 'undefined' ? self : window);
