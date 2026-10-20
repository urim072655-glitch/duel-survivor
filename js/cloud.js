/* ===========================================================
 *  DSCLOUD · 账号系统（用户端）
 *  - 自定义账号：姓名（唯一）+ 密码，存于云数据库 ds_users 表
 *  - 密码仅存 SHA-256('ds:v1:' + 密码) 摘要，明文不出浏览器
 *  - 登录后局外进度（日元/卡组/成就…）自动云同步
 * =========================================================== */
window.DSCLOUD = (function () {
  'use strict';
  const SALT = 'ds:v1:';
  const SESSION_KEY = 'ds_session_v1';
  const $ = id => document.getElementById(id);

  let cloud = null;          // WorkBuddyCloud 客户端
  let sdkOk = false;         // SDK 是否可用
  let session = null;        // { name }
  let pushTimer = null;      // 进度上传防抖
  let pushBusy = false, pushPending = null;
  let lastPushQueuedAt = 0;  // v0.3.5：最近一次本地存档入队时间（拉取云端余额前需等待推送落定）

  /* ---------- 工具 ---------- */
  async function sha256(s) {
    if (!window.crypto || !crypto.subtle) throw new Error('当前环境不支持安全哈希（需要 https 或 localhost）');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const hashPwd = pwd => sha256(SALT + pwd);

  function errText(e) {
    if (!e) return '网络异常';
    const m = (e.message || String(e) || '');
    if (e.code === '23505' || /23505|duplicate|unique constraint/i.test(m)) return '该姓名已被注册，请换一个姓名或直接登录';
    return m;
  }

  /* ---------- 初始化 ---------- */
  function init() {
    try {
      if (!window.WorkBuddyCloud || !window.DS_PUBLIC_CONFIG) { sdkOk = false; return false; }
      cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: window.DS_PUBLIC_CONFIG.endpoint,
        oauthRelayBaseUrl: window.DS_PUBLIC_CONFIG.oauthRelayBaseUrl,
        publishableKey: window.DS_PUBLIC_CONFIG.publishableKey
      });
      sdkOk = true;
    } catch (e) { sdkOk = false; }
    return sdkOk;
  }

  function db() { return cloud.database; }

  /* ---------- 会话 ---------- */
  function current() { return session; }
  function restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) session = JSON.parse(raw);
    } catch (e) { session = null; }
    return session;
  }
  function setSession(name) {
    session = name ? { name } : null;
    if (name) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }
  function logout() {
    setSession(null);
    location.reload();
  }

  /* ---------- 注册 / 登录 ---------- */
  async function register(name, pwd) {
    if (!sdkOk) init();                       /* 懒初始化：页面脚本刚就绪就点按钮时自动补连 */
    if (!sdkOk) return { ok: false, msg: '无法连接云端 · 请检查网络后重试，或使用离线体验' };
    name = (name || '').trim();
    if (!name) return { ok: false, msg: '请输入姓名' };
    if (name.length > 16) return { ok: false, msg: '姓名最长 16 个字符' };
    if (!pwd || pwd.length < 4) return { ok: false, msg: '密码至少 4 位' };
    try {
      const h = await hashPwd(pwd);
      const { error } = await db().from('ds_users').insert({ name, pwd_hash: h, is_admin: false, data: { yen: 5000 } });
      if (error) return { ok: false, msg: errText(error) };
      return await doLogin(name, pwd, true);
    } catch (e) { return { ok: false, msg: errText(e) }; }
  }

  async function doLogin(name, pwd, isNew) {
    try {
      const h = await hashPwd(pwd);
      const { data, error } = await db().from('ds_users').select('id,name,is_admin,data').eq('name', name).maybeSingle();
      if (error) return { ok: false, msg: errText(error) };
      if (!data) return { ok: false, msg: isNew ? '注册失败，请重试' : '姓名或密码错误' };
      /* 校验密码（客户端比对摘要） */
      const { data: rows, error: e2 } = await db().from('ds_users')
        .select('name,data').eq('name', name).eq('pwd_hash', h).maybeSingle();
      if (e2) return { ok: false, msg: errText(e2) };
      if (!rows) return { ok: false, msg: '姓名或密码错误' };
      setSession(name);
      db().from('ds_users').update({ last_login: new Date().toISOString() }).eq('name', name).then(() => {});
      return { ok: true, name, data: rows.data || null, isAdmin: !!data.is_admin };
    } catch (e) { return { ok: false, msg: errText(e) }; }
  }

  const login = (name, pwd) => {
    if (!sdkOk) init();
    if (!sdkOk) return Promise.resolve({ ok: false, msg: '无法连接云端 · 请检查网络后重试，或使用离线体验' });
    return doLogin((name || '').trim(), pwd, false);
  };

  /* ---------- 进度云同步 ---------- */
  /* v0.4.2d：管理员发放以 yenSeq 递增为凭，本地推送前必须合并，否则会把发放覆盖掉 */
  function adoptRemoteYen(remote, obj) {
    if (!remote || typeof remote.yen !== 'number') return false;
    const rSeq = (typeof remote.yenSeq === 'number') ? remote.yenSeq : 0;
    const lSeq = (typeof obj.yenSeq === 'number') ? obj.yenSeq : 0;
    if (rSeq <= lSeq) return false;
    /* 按“云端相对上次同步的净变化”合并，避免吞掉本地刚赚到的部分 */
    const base = (typeof obj.yenPushed === 'number') ? obj.yenPushed : null;
    obj.yen = (base === null) ? remote.yen : Math.max(0, remote.yen + ((obj.yen || 0) - base));
    obj.yenSeq = rSeq;
    obj.yenPushed = remote.yen;
    return true;
  }

  function pushSave(saveObj) {
    if (!session || session.name === '__offline__' || !sdkOk) return;
    lastPushQueuedAt = Date.now();              // v0.3.5：标记本地存档待推送
    let payload = JSON.stringify(saveObj);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      if (pushBusy) { pushPending = payload; return; }
      pushBusy = true;
      try {
        /* 写前先读云端：若管理员在此期间发放过（yenSeq 更大），先采纳云端余额再落库 */
        const { data: rows } = await db().from('ds_users').select('data').eq('name', session.name).limit(1);
        if (rows && rows.length) {
          const target = safeParseC(payload);
          if (adoptRemoteYen(safeParseC(rows[0].data), target)) {
            payload = JSON.stringify(target);
            if (window.META && META.save) {
              META.save.yen = target.yen;
              META.save.yenSeq = target.yenSeq;
              if (META.persistLocal) META.persistLocal();
              META.refreshWallet();
              cloudToast('管理员发放 ¥ ' + target.yen.toLocaleString() + ' · 已到账');
            }
          }
        }
        const out = safeParseC(payload);
        if (typeof out.yen === 'number') { out.yenPushed = out.yen; payload = JSON.stringify(out); }
        await db().from('ds_users').update({ data: payload }).eq('name', session.name);
      } catch (e) { /* 静默：下次 persist 会再推 */ }
      pushBusy = false;
      if (pushPending) { const p = pushPending; pushPending = null; pushSave(p); }
    }, 2500);
  }

  /* ---------- v0.3.5：云端余额拉取（管理员后台加减日元 → 玩家端自动到账） ---------- */
  const safeParseC = s => { try { return typeof s === 'string' ? JSON.parse(s) : (s || {}); } catch (e) { return {}; } };
  function cloudToast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(cloudToast._t);
    cloudToast._t = setTimeout(() => el.classList.remove('on'), 1600);
  }
  async function pullYen() {
    const dbg = r => { try { window.__pullYenDbg = { t: Date.now(), r: r, push: lastPushQueuedAt }; } catch (e) { } return false; };
    if (!session || session.name === '__offline__' || !sdkOk) return dbg('session');
    /* 管理员发放（带 yenSeq）后台标签页也要拉，回来就能看到；旧逻辑只在可见的标题页生效 */
    /* 标题界面：允许“按数值兜底”的旧逻辑；战斗中只接受带 yenSeq 的管理员发放，
       避免用旧云端数值覆盖战斗中刚赚到的本地进度 */
    const title = $('s-title'), hud = $('hud');
    const onTitle = !!title && !title.classList.contains('hidden') && !(hud && !hud.classList.contains('hidden'));
    try {
      const { data: rows, error } = await db().from('ds_users').select('data').eq('name', session.name).limit(1);
      if (error || !rows || !rows.length) return dbg('query:' + (error ? error.message : 'empty'));
      const obj = safeParseC(rows[0].data);
      if (typeof obj.yen !== 'number' || !window.META || !META.save) return dbg('yen-type');
      const cur = META.save.yen || 0;
      const rSeq = (typeof obj.yenSeq === 'number') ? obj.yenSeq : 0;
      const lSeq = (typeof META.save.yenSeq === 'number') ? META.save.yenSeq : 0;
      /* 1) 管理员发放（带版本号）：任何界面都立即到账 */
      if (rSeq > lSeq) {
        META.save.yen = obj.yen;
        META.save.yenSeq = rSeq;
        META.save.yenPushed = obj.yen;
        if (META.persistLocal) META.persistLocal();
        META.refreshWallet();
        cloudToast('管理员发放已到账：¥ ' + obj.yen.toLocaleString());
        return true;
      }
      /* 2) 旧数据兜底：仅标题界面按数值同步 */
      if (!onTitle || document.visibilityState !== 'visible') return dbg('not-title');
      if (Date.now() - lastPushQueuedAt < 4000) return dbg('push-window');
      if (obj.yen === cur) return dbg('same:' + obj.yen);
      META.save.yen = obj.yen;
      META.save.yenPushed = obj.yen;
      if (typeof obj.yenSeq === 'number') META.save.yenSeq = obj.yenSeq;
      META.persist();
      META.refreshWallet();
      cloudToast('云端余额已同步：¥ ' + obj.yen.toLocaleString());
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 登录界面 ---------- */
  function showAuth(mode) {
    const auth = $('s-auth');
    if (!auth) return;
    auth.classList.remove('hidden');
    $('s-title').classList.add('hidden');
    if (window.__DS && __DS.G) __DS.G.screen = 'auth';
    setTab(mode || 'login');
  }
  function setTab(mode) {
    const login = mode !== 'reg';
    $('auth-tab-login').classList.toggle('on', login);
    $('auth-tab-reg').classList.toggle('on', !login);
    $('auth-btn-login').classList.toggle('hidden', !login);
    $('auth-btn-reg').classList.toggle('hidden', login);
    $('auth-ok-line').textContent = '';
  }
  function hideAuth() {
    $('s-auth').classList.add('hidden');
    $('s-title').classList.remove('hidden');
    if (window.__DS && __DS.G) __DS.G.screen = 'title';
    refreshUserChip();
  }
  function refreshUserChip() {
    const chip = $('auth-user-chip');
    if (!chip) return;
    if (session) {
      chip.innerHTML = '<i>决斗者</i><b>' + session.name + '</b><button id="btn-logout">退出</button>';
      chip.classList.add('on');
      $('btn-logout').addEventListener('click', logout);
    } else {
      chip.classList.remove('on');
      chip.innerHTML = '';
    }
  }

  async function afterAuth(res, reg) {
    if (!res.ok) {
      $('auth-ok-line').textContent = res.msg || '失败，请重试';
      $('auth-ok-line').className = 'auth-line bad';
      return;
    }
    /* 云端进度 > 本地进度：有云端存档则覆盖本地 */
    if (res.data && typeof res.data === 'object' && Object.keys(res.data).length) {
      try { if (window.META && META.applyCloudSave) META.applyCloudSave(res.data); } catch (e) {}
    } else if (window.META && META.persist && window.__DS) {
      /* 新账号：把本地当前进度作为初始存档推上云端 */
      try { META.persist(); } catch (e) {}
    }
    hideAuth();
    if (window.__DS) {
      try { __DS.updateBestLine && __DS.updateBestLine(); } catch (e) {}
      if (typeof toast === 'function') toast((reg ? '注册并登录' : '欢迎回来') + ' · ' + res.name);
    }
    if (res.isAdmin) toast('检测到管理员账号，可打开 admin.html 进入管理后台');
  }

  /* ---------- 启动门：未登录先弹登录 ---------- */
  function bootGate() {
    restoreSession();
    const auth = $('s-auth');
    if (!auth) return;
    if (session) { refreshUserChip(); return; }
    showAuth(sdkOk ? 'login' : 'login');
    if (!sdkOk) {
      $('auth-ok-line').textContent = '网络服务加载失败 · 可点「离线体验」本地游玩';
      $('auth-ok-line').className = 'auth-line bad';
      $('auth-btn-offline').classList.remove('hidden');
    }
  }

  /* ---------- DOM 绑定 ---------- */
  function bindUI() {
    if (!$('s-auth')) return;
    $('auth-tab-login').addEventListener('click', () => setTab('login'));
    $('auth-tab-reg').addEventListener('click', () => setTab('reg'));
    const doReg = async () => {
      const r = await register($('auth-name').value, $('auth-pwd').value);
      $('auth-ok-line').className = 'auth-line' + (r.ok ? ' good' : ' bad');
      if (r.ok) { $('auth-ok-line').textContent = '注册成功，正在进入…'; await afterAuth(r, true); }
      else $('auth-ok-line').textContent = r.msg;
    };
    const doLogin = async () => {
      const r = await login($('auth-name').value, $('auth-pwd').value);
      $('auth-ok-line').className = 'auth-line' + (r.ok ? ' good' : ' bad');
      if (r.ok) { $('auth-ok-line').textContent = '登录成功，正在进入…'; await afterAuth(r, false); }
      else $('auth-ok-line').textContent = r.msg;
    };
    $('auth-btn-reg').addEventListener('click', doReg);
    $('auth-btn-login').addEventListener('click', doLogin);
    $('auth-pwd').addEventListener('keydown', e => {
      if (e.key === 'Enter') ($('auth-btn-login').classList.contains('hidden') ? doReg : doLogin)();
    });
    $('auth-btn-offline').addEventListener('click', () => {
      setSession('__offline__');
      hideAuth();
      toast('离线模式 · 进度仅保存在本机');
    });
    /* 离线会话不推送云端：pushSave 里排除 */
  }

  function start() {
    init();
    bindUI();
    bootGate();
    /* v0.3.5：定期拉取云端余额（管理员后台加减日元自动到账），15s 一次 */
    setInterval(() => { pullYen(); }, 15000);
    setTimeout(() => { pullYen(); }, 4000);
    /* v0.4.2g：用户端换域名后，玩家常把标签放后台；切回来/聚焦时立刻补拉一次 */
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullYen(); });
    window.addEventListener('focus', () => { pullYen(); });
    window.addEventListener('online', () => { pullYen(); });
  }

  return {
    init, start, register, login, logout, current, pushSave, pullYen,
    refreshUserChip, showAuth, hideAuth,
    get sdkOk() { return sdkOk; },
    get db() { return cloud && cloud.database; }   // 只读暴露数据库句柄（测试/扩展用）
  };
})();
window.addEventListener('DOMContentLoaded', () => { try { window.DSCLOUD.start(); } catch (e) {} });
