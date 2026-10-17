/* シェアカード（canvas → PNG）。ストーリー 1080×1920／投稿 1080×1350。写真も数字も端末の中だけで描く */
(function (g) {
  'use strict';
  const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
  const INK = '#2B2A5A', SUB = '#77708F', LAV = '#8D7BFF', YEL = '#FFE45C';
  const imgCache = {};
  function loadImg(src) {
    if (imgCache[src]) return imgCache[src];
    imgCache[src] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    return imgCache[src];
  }
  const emoji = (n) => loadImg(`assets/emoji/${n}.png`);
  function blobImg(b) {
    if (!b) return Promise.resolve(null);
    return new Promise((res) => { const u = URL.createObjectURL(b); const i = new Image(); i.onload = () => res(i); i.onerror = () => { URL.revokeObjectURL(u); res(null); }; i.src = u; });
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(h, to, t) { const a = hexRgb(h), b = hexRgb(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ticket(c, x, y, w, h, r, notchY, nr) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, notchY - nr); c.arc(x + w, notchY, nr, -Math.PI / 2, Math.PI / 2, true); c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, notchY + nr); c.arc(x, notchY, nr, Math.PI / 2, -Math.PI / 2, true); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function cover(c, img, x, y, w, h, r) {
    c.save(); rr(c, x, y, w, h, r); c.clip();
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); c.restore();
  }
  function text(c, s, x, y, size, color, weight = 800, align = 'center') {
    c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(s, x, y);
  }
  function fit(c, s, maxW, size, weight = 800) { // 長い文字は小さく
    let z = size; c.font = `${weight} ${z}px ${FONT}`;
    while (c.measureText(s).width > maxW && z > 28) { z -= 2; c.font = `${weight} ${z}px ${FONT}`; }
    return z;
  }
  function wrap(c, s, maxW, size, maxLines) {
    c.font = `800 ${size}px ${FONT}`; const lines = []; let cur = '';
    for (const ch of s) { if (c.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
    return lines;
  }
  function pill(c, s, cx, y, size, bg, fg) {
    c.font = `800 ${size}px ${FONT}`; const w = c.measureText(s).width + size * 1.4, h = size * 1.6;
    c.fillStyle = bg; rr(c, cx - w / 2, y, w, h, h / 2); c.fill(); text(c, s, cx, y + h * 0.7, size, fg); return h;
  }

  function background(c, W, H, o) {
    const acc = o.color;
    if (o.frame === 'film') {
      c.fillStyle = '#1F1D3A'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.9)';
      for (let y = 30; y < H; y += 70) { rr(c, 26, y, 36, 40, 8); c.fill(); rr(c, W - 62, y, 36, 40, 8); c.fill(); }
      return;
    }
    const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, mix(acc, '#ffffff', 0.8)); gr.addColorStop(1, '#E9E2FF');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.6)';
    for (let y = 20; y < H; y += 56) for (let x = (y / 56) % 2 ? 48 : 20; x < W; x += 56) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
    if (o.frame === 'sparkle') {
      c.fillStyle = YEL; c.strokeStyle = '#fff'; c.lineWidth = 4;
      const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill(); };
      [[120, 150, 46], [960, 210, 34], [90, H - 300, 30], [990, H - 420, 52], [540, 70, 24], [200, H * 0.5, 22], [900, H * 0.55, 26]].forEach((s) => star(...s));
    }
  }
  function mark(c, W, H, o) {
    const dark = o.frame === 'film';
    text(c, '推し活家計簿  @oshikatsu.kakeibo', W / 2, H - 64, 34, dark ? 'rgba(255,255,255,.85)' : SUB, 700);
  }
  async function stickers(c, W, H, o, top, bottom) {
    const set = { hearts: ['hearts', 'heart'], crown: ['starstruck', 'sparkles'], lightstick: ['lightstick', 'party'] }[o.sticker];
    if (!set) return;
    const a = await emoji(set[0]), b = await emoji(set[1]);
    c.save();
    if (a) { c.translate(W - 210, top - 30); c.rotate(0.2); c.drawImage(a, 0, 0, 190, 190); c.setTransform(1, 0, 0, 1, 0, 0); }
    if (b) { c.translate(40, bottom - 150); c.rotate(-0.18); c.drawImage(b, 0, 0, 160, 160); c.setTransform(1, 0, 0, 1, 0, 0); }
    c.restore();
  }
  // 写真の台紙（ticket／polaroid／sparkle／film）
  async function photoCard(c, W, H, o, photo, x, y, w, h, fallbackEmoji) {
    const acc = o.color;
    c.save();
    c.shadowColor = 'rgba(43,42,90,.18)'; c.shadowBlur = 40; c.shadowOffsetY = 14;
    if (o.frame === 'polaroid') { c.translate(W / 2, y + h / 2); c.rotate(-0.025); c.translate(-W / 2, -(y + h / 2)); c.fillStyle = '#fff'; rr(c, x - 26, y - 26, w + 52, h + 150, 18); c.fill(); }
    else if (o.frame === 'film') { c.fillStyle = '#fff'; rr(c, x - 14, y - 14, w + 28, h + 28, 20); c.fill(); }
    else { c.fillStyle = '#fff'; rr(c, x - 22, y - 22, w + 44, h + 44, 44); c.fill(); }
    c.restore(); c.save();
    if (o.frame === 'polaroid') { c.translate(W / 2, y + h / 2); c.rotate(-0.025); c.translate(-W / 2, -(y + h / 2)); }
    if (photo) cover(c, photo, x, y, w, h, o.frame === 'polaroid' ? 6 : 30);
    else {
      c.fillStyle = mix(acc, '#ffffff', 0.82); rr(c, x, y, w, h, 30); c.fill();
      const e = await emoji(fallbackEmoji); if (e) c.drawImage(e, x + w / 2 - 150, y + h / 2 - 150, 300, 300);
    }
    if (o.frame === 'sparkle') { c.strokeStyle = YEL; c.lineWidth = 14; rr(c, x - 22, y - 22, w + 44, h + 44, 44); c.stroke(); }
    c.restore();
    return o.frame === 'polaroid' ? h + 130 : h;
  }
  // 下半分のチケット（文字の台）
  function stub(c, W, y, h, o) {
    const x = 70, w = W - 140;
    c.save(); c.shadowColor = 'rgba(43,42,90,.15)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
    c.fillStyle = '#fff'; ticket(c, x, y, w, h, 40, y + h - 150, 30); c.fill(); c.restore();
    c.setLineDash([16, 14]); c.strokeStyle = '#E2DDF0'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 50, y + h - 150); c.lineTo(x + w - 50, y + h - 150); c.stroke(); c.setLineDash([]);
    return { x, w };
  }

  async function eventCard(c, W, H, o, d) {
    const story = H > 1500, photo = await blobImg(d.photo);
    const top = story ? 170 : 110, ph = story ? 860 : 560, pw = story ? 860 : 640;
    text(c, d.head || (d.past ? '行ってきた！' : '次の現場'), W / 2, top - 40, story ? 48 : 40, o.frame === 'film' ? '#fff' : INK);
    const used = await photoCard(c, W, H, o, photo, (W - pw) / 2, top, pw, ph, 'ticket');
    const sy = top + used + (story ? 80 : 50), sh = story ? 560 : 420;
    stub(c, W, sy, sh, o);
    const lines = wrap(c, d.title, W - 260, story ? 64 : 54, 2);
    lines.forEach((l, i) => text(c, l, W / 2, sy + (story ? 100 : 86) + i * (story ? 78 : 66), story ? 64 : 54, INK));
    const ly = sy + (story ? 100 : 86) + lines.length * (story ? 78 : 66);
    text(c, d.dateLabel, W / 2, ly, story ? 38 : 34, SUB, 700);
    const big = d.big || (d.past ? '行ってきた！' : d.days === 0 ? '今日！' : `あと${d.days}日`);
    const bz = fit(c, big, W - 260, story ? 120 : 96);
    text(c, big, W / 2, sy + sh - 150 - (story ? 40 : 28), bz, o.color);
    const money = d.noMoney ? '推し活家計簿で記録中' : o.showMoney ? `積立 ${d.savedLabel} / ${d.costLabel}` : `積立 ${d.pct}%`;
    pill(c, money, W / 2, sy + sh - 110, story ? 40 : 34, mix(o.color, '#ffffff', 0.84), mix(o.color, INK, 0.3));
    await stickers(c, W, H, o, top, sy + sh);
  }
  async function goalCard(c, W, H, o, d) {
    const story = H > 1500, photo = await blobImg(d.photo);
    const top = story ? 300 : 190, ph = story ? 760 : 500, pw = story ? 820 : 600;
    const tz = story ? 110 : 86;
    text(c, '積立達成！', W / 2, top - 70, tz, o.frame === 'film' ? YEL : o.color);
    const used = await photoCard(c, W, H, o, photo, (W - pw) / 2, top, pw, ph, 'party');
    const sy = top + used + (story ? 80 : 50), sh = story ? 480 : 380;
    stub(c, W, sy, sh, o);
    const lines = wrap(c, d.title, W - 260, story ? 60 : 50, 2);
    lines.forEach((l, i) => text(c, l, W / 2, sy + 96 + i * 72, story ? 60 : 50, INK));
    text(c, d.dateLabel, W / 2, sy + 96 + lines.length * 72, 36, SUB, 700);
    pill(c, o.showMoney ? `${d.costLabel} 準備できた` : '当日までの準備、できた', W / 2, sy + sh - 112, story ? 40 : 34, o.color, o.ink);
    await stickers(c, W, H, o, top, sy + sh);
  }
  async function monthCard(c, W, H, o, d) {
    const story = H > 1500, dark = o.frame === 'film';
    const ink = dark ? '#fff' : INK;
    text(c, d.monthLabel, W / 2, story ? 150 : 110, story ? 44 : 38, dark ? '#CFC8F2' : SUB, 700);
    text(c, '推し活まとめ', W / 2, story ? 250 : 190, story ? 96 : 76, ink);
    // 写真のコラージュ（最大9枚）
    const imgs = (await Promise.all((d.photos || []).slice(0, 9).map(blobImg))).filter(Boolean);
    const gx = 90, gw = W - 180, gy = story ? 310 : 230, gh = story ? 820 : 500;
    const n = imgs.length;
    if (n) {
      const cols = n === 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 18;
      const cw = (gw - gap * (cols - 1)) / cols, ch = (gh - gap * (rows - 1)) / rows;
      imgs.forEach((im, i) => {
        const r = Math.floor(i / cols), col = i % cols;
        c.save(); c.translate(gx + col * (cw + gap) + cw / 2, gy + r * (ch + gap) + ch / 2); c.rotate(((i * 37) % 7 - 3) * 0.006);
        c.fillStyle = '#fff'; rr(c, -cw / 2 - 8, -ch / 2 - 8, cw + 16, ch + 16, 26); c.fill();
        cover(c, im, -cw / 2, -ch / 2, cw, ch, 20); c.restore();
      });
    } else {
      c.fillStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.7)'; rr(c, gx, gy, gw, gh, 40); c.fill();
      const e = await emoji('party'); if (e) c.drawImage(e, W / 2 - 140, gy + gh / 2 - 170, 280, 280);
      text(c, `記録した日 ${d.days}日`, W / 2, gy + gh / 2 + 170, 44, ink);
    }
    // 数字の台
    const sy = gy + gh + (story ? 60 : 40), sh = story ? 560 : 400;
    c.save(); c.shadowColor = 'rgba(43,42,90,.15)'; c.shadowBlur = 30; c.shadowOffsetY = 10; c.fillStyle = '#fff'; rr(c, 70, sy, W - 140, sh, 44); c.fill(); c.restore();
    const L = 130;
    text(c, '推し予算のうち', L, sy + (story ? 90 : 70), 36, SUB, 700, 'left');
    text(c, d.budget ? `${d.pct}%` : '—', L, sy + (story ? 200 : 160), story ? 110 : 88, o.color, 800, 'left');
    text(c, 'を推しに', L + (d.budget ? c.measureText(`${d.pct}%`).width : 60) + 16, sy + (story ? 200 : 160), 40, INK, 800, 'left');
    // バー
    const by = sy + (story ? 240 : 190), bw = W - 260;
    c.fillStyle = '#F1EEF8'; rr(c, L, by, bw, 26, 13); c.fill();
    c.fillStyle = o.color; rr(c, L, by, Math.max(26, bw * Math.min(1, (d.pct || 0) / 100)), 26, 13); c.fill();
    const te = d.top ? await emoji(d.top.em) : null;
    const ty = by + (story ? 130 : 100);
    if (te) c.drawImage(te, L, ty - 66, 84, 84);
    text(c, d.top ? `いちばんは ${d.top.name}` : 'まだ記録なし', L + (te ? 104 : 0), ty, 46, INK, 800, 'left');
    if (o.showMoney && d.spentLabel) text(c, `推し活 ${d.spentLabel}`, W - 130, ty, 38, SUB, 700, 'right');
    if (story) pill(c, d.badge, W / 2, sy + sh - 120, 44, o.color, o.ink);
    else pill(c, d.badge, W / 2, sy + sh - 96, 38, o.color, o.ink);
    await stickers(c, W, H, o, gy, gy + gh);
  }

  async function render(kind, o, d) {
    try { if (document.fonts) await Promise.race([document.fonts.load(`800 40px "M PLUS Rounded 1c"`), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* フォントが無くても描く */ }
    const W = 1080, H = o.size === 'post' ? 1350 : 1920;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    background(c, W, H, o);
    if (kind === 'event') await eventCard(c, W, H, o, d);
    else if (kind === 'goal') await goalCard(c, W, H, o, d);
    else await monthCard(c, W, H, o, d);
    mark(c, W, H, o);
    return cv;
  }
  const toBlob = (cv) => new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
  g.OshiShare = { render, toBlob };
})(window);
