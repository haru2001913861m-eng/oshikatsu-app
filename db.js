/* 端末の中の IndexedDB（アプリとサービスワーカーの両方から使う）
   kv     : アプリの状態の写し（サービスワーカーは localStorage を読めないため）
   pmeta  : 写真の目録 {id, date, goalId, ts, rgb:[r,g,b]}。小さいので1万枚でも一覧が速い（索引: date, goalId）
   pthumb : 縮小画像 {t64, t256}（t64 はモザイク用・t256 はカレンダーと写真集用）
   pfull  : 長辺1080pxの写真 {full}。一覧では読まない */
(function (g) {
  'use strict';
  const NAME = 'oshikakeibo', VER = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!g.indexedDB) return rej(new Error('no-idb'));
      const r = g.indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('pmeta')) {
          const s = db.createObjectStore('pmeta', { keyPath: 'id' });
          s.createIndex('date', 'date'); s.createIndex('goalId', 'goalId');
        }
        if (!db.objectStoreNames.contains('pthumb')) db.createObjectStore('pthumb');
        if (!db.objectStoreNames.contains('pfull')) db.createObjectStore('pfull');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  function tx(stores, mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(stores, mode);
      const out = fn(t);
      t.oncomplete = () => res(out && typeof out === 'object' && 'result' in out ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  const one = (store, mode, f) => tx(store, mode, (t) => f(t.objectStore(store)));
  g.OshiDB = {
    get: (store, key) => one(store, 'readonly', (s) => s.get(key)),
    put: (store, key, val) => one(store, 'readwrite', (s) => { if (s.keyPath) s.put(val); else s.put(val, key); }),
    del: (store, key) => one(store, 'readwrite', (s) => { s.delete(key); }),
    all: (store) => one(store, 'readonly', (s) => s.getAll()),
    count: (store) => one(store, 'readonly', (s) => s.count()),
    clear: (store) => one(store, 'readwrite', (s) => { s.clear(); }),
    // 日付の範囲（'2026-10-01'〜'2026-10-31'）の写真の目録
    byDate: (from, to) => one('pmeta', 'readonly', (s) => s.index('date').getAll(IDBKeyRange.bound(from, to))),
    // 写真1枚を3か所に一度に書く／消す
    putPhoto: (meta, thumb, full) => tx(['pmeta', 'pthumb', 'pfull'], 'readwrite', (t) => {
      t.objectStore('pmeta').put(meta); t.objectStore('pthumb').put(thumb, meta.id); t.objectStore('pfull').put(full, meta.id);
    }),
    delPhoto: (id) => tx(['pmeta', 'pthumb', 'pfull'], 'readwrite', (t) => {
      t.objectStore('pmeta').delete(id); t.objectStore('pthumb').delete(id); t.objectStore('pfull').delete(id);
    }),
  };
})(typeof self !== 'undefined' ? self : window);
