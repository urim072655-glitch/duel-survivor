/* ===========================================================
 *  DSLOCALDB · 本地后端适配器（用户端 / 管理端共用）
 *  - 把 WorkBuddyCloud(Supabase 风格) 的链式查询翻译为 POST /api/db，
 *    交给同源的本地 server.py 处理（data/local/db.json 持久化）。
 *  - 仅在显式开启时启用：URL 带 ?localapi=1 或 localStorage.ds_local_api==='1'。
 *    默认（不开启）完全走远程 SDK，DS_PUBLIC_CONFIG.endpoint 保持不变。
 *  - 目的：本地服务器启动器可以"接收用户端的数据"（注册/登录/存档/发日元）。
 * =========================================================== */
window.DSLocalDB = (function () {
  'use strict';
  const API = '/api/db';

  function enabled() {
    try {
      if (new URLSearchParams(location.search).has('localapi')) return true;
      if (localStorage.getItem('ds_local_api') === '1') return true;
    } catch (e) { }
    return false;
  }

  function post(body) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  /* ---------- 链式 Builder（thenable，可 await / .then） ---------- */
  function Builder(table, op) {
    this._t = table; this._op = op;
    this._cols = '*'; this._opts = {};
    this._filters = [];
    this._limit = null; this._single = false;
    this._order = null; this._range = null;
    this._returning = false;
    this._patch = null; this._row = null;
  }
  Builder.prototype.eq = function (c, v) { this._filters.push({ col: c, op: 'eq', val: v }); return this; };
  Builder.prototype.ilike = function (c, v) { this._filters.push({ col: c, op: 'ilike', val: v }); return this; };
  Builder.prototype.gte = function (c, v) { this._filters.push({ col: c, op: 'gte', val: v }); return this; };
  Builder.prototype.limit = function (n) { this._limit = n; return this; };
  Builder.prototype.maybeSingle = function () { this._single = true; return this; };
  Builder.prototype.order = function (c, o) { this._order = { col: c, asc: !(o && o.ascending === false) }; return this; };
  Builder.prototype.range = function (a, b) { this._range = [a, b]; return this; };
  /* update()/delete() 后接 .select() 表示 returning（返回受影响行） */
  Builder.prototype.select = function () { this._returning = true; return this; };
  Builder.prototype.then = function (onF, onR) { return this._run().then(onF, onR); };
  Builder.prototype._run = function () {
    return post({
      table: this._t, op: this._op, cols: this._cols,
      filters: this._filters, limit: this._limit, single: this._single,
      order: this._order, range: this._range, returning: this._returning,
      patch: this._patch, row: this._row,
      head: !!(this._opts && this._opts.head),
      count: (this._opts && this._opts.count) ? this._opts.count : null
    });
  };

  /* ---------- from(table) ---------- */
  function from(table) {
    return {
      insert: function (row) { const b = new Builder(table, 'insert'); b._row = row; return b; },
      select: function (cols, opts) {
        const b = new Builder(table, 'select');
        if (typeof cols === 'string') b._cols = cols;
        if (cols && typeof cols === 'object') b._opts = cols;
        if (opts) b._opts = opts;
        return b;
      },
      update: function (patch) { const b = new Builder(table, 'update'); b._patch = patch; return b; },
      delete: function () { return new Builder(table, 'delete'); }
    };
  }

  function create() { return { database: { from: from } }; }

  return { enabled: enabled, create: create, from: from };
})();
