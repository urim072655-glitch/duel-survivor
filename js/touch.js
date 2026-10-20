/* ============================================================
 * 决斗幸存者 · v0.3.3 手机端适配（touch.js）
 *  - 设备模式切换（主界面按钮，localStorage 持久化）：
 *      自动 auto：多重信号识别（触摸能力 + 粗指针/任意粗指针/手机尺寸屏幕）
 *                + 触摸自愈（误报环境下收到真实触摸且屏幕为手机尺寸 → 动态启用）
 *      手机端 touch：强制启用虚拟按键与横屏检测
 *      PC端 pc：强制禁用（键鼠操作）
 *  - 手机端功能：竖屏「请横屏游玩」遮罩；战斗中左侧浮动摇杆 + 右侧 抽卡/大招/冲刺/跳跃；
 *    触屏滑动画面旋转视角；触屏端禁用指针锁定
 *  - 标题左上角版本号可点按 → 设备检测诊断信息（排查用）
 * 依赖：__DS（game.js 导出：keys / drawCard / castUlt / tryJump / rotateCam / G）
 * ============================================================ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const MODE_KEY = 'ds_device_mode_v1';          // auto | touch | pc
  let enabled = false, initialized = false, prevCursorSupported = null;
  let memMode = null;                            // v0.3.5：内存态模式（localStorage 被禁/隐私模式时仍生效）

  const getMode = () => {
    if (memMode) return memMode;
    try { const m = localStorage.getItem(MODE_KEY); return (m === 'touch' || m === 'pc') ? m : 'auto'; }
    catch (e) { return 'auto'; }
  };
  const setMode = m => {
    memMode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* 隐私模式等：仅本会话生效 */ }
  };

  /* ---------- 设备信号 ---------- */
  function deviceInfo() {
    const mm = window.matchMedia ? window.matchMedia.bind(window) : null;
    const mmq = q => { try { return mm ? mm(q).matches : false; } catch (e) { return false; } };
    return {
      hasTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
      touchPts: navigator.maxTouchPoints || 0,
      coarse: mmq('(pointer: coarse)'),
      anyCoarse: mmq('(any-pointer: coarse)'),
      sw: (window.screen && window.screen.width) || 0,
      sh: (window.screen && window.screen.height) || 0,
      vw: window.innerWidth, vh: window.innerHeight,
      ua: navigator.userAgent
    };
  }
  function shouldAutoEnable() {
    const d = deviceInfo();
    if (!d.hasTouch) return false;
    return !!(d.coarse || d.anyCoarse || (d.sw > 0 && Math.min(d.sw, d.sh) <= 620));
  }

  /* ---------- 启用手机端模式（可重复调用，监听器只注册一次） ---------- */
  function syncTouchUI() {
    const hud = $('hud'), tui = $('touch-ui');
    if (hud && tui) {
      const inGame = enabled && !hud.classList.contains('hidden');
      tui.classList.toggle('hidden', !inGame);
      if (!inGame) {
        window.__touchVec = { fwd: 0, strafe: 0 };
        releaseDash();
      }
    }
  }
  function enableTouchMode() {
    if (!document.body || enabled) return;
    enabled = true;
    document.body.classList.add('is-touch');
    try {
      if (window.__DS && window.__DS.Cursor && prevCursorSupported === null) {
        prevCursorSupported = __DS.Cursor.supported;
        __DS.Cursor.supported = false;          // 触屏无鼠标，禁用指针锁定
      }
    } catch (e) { }
    initOnce();
    applyOrientation();
    syncTouchUI();
  }
  function disableTouchMode() {
    if (!document.body) return;
    enabled = false;
    document.body.classList.remove('is-touch', 'portrait', 'touch-dashing');
    const tui = $('touch-ui');
    if (tui) tui.classList.add('hidden');
    /* v0.4.1：切回 PC 模式时退出全屏，避免 PC 窗口被浏览器全屏 API 锁住 */
    try { if (fsElement()) fsExit(); } catch (e) { }
    refreshFsBtn();
    window.__touchVec = { fwd: 0, strafe: 0 };
    releaseDash();
    try {
      if (window.__DS && window.__DS.Cursor && prevCursorSupported !== null) {
        __DS.Cursor.supported = prevCursorSupported;   // 还原指针锁定能力
        prevCursorSupported = null;
      }
    } catch (e) { }
  }
  function applyMode() {
    const m = getMode();
    if (m === 'touch') enableTouchMode();
    else if (m === 'pc') disableTouchMode();
    else { shouldAutoEnable() ? enableTouchMode() : disableTouchMode(); }
    syncTouchUI();      // v0.3.5：切模式后立即同步虚拟按键显示
  }

  /* ---------- 横竖屏 ---------- */
  function applyOrientation() {
    if (document.body) document.body.classList.toggle('portrait', enabled && window.innerHeight > window.innerWidth);
  }
  window.addEventListener('resize', applyOrientation);
  window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 120));

  function releaseDash() {
    if (document.body) document.body.classList.remove('touch-dashing');
    try { if (window.__DS && window.__DS.keys) window.__DS.keys['ShiftLeft'] = false; } catch (e) { }
  }

  /* ---------- 一次性初始化：摇杆 / 按键 / 相机 / 血条联动 ---------- */
  function initOnce() {
    if (initialized) return;
    initialized = true;

    /* 战斗中才显示虚拟按键（MutationObserver + 500ms 轮询双保险，防个别浏览器观察器失效） */
    const hud = $('hud'), tui = $('touch-ui');
    if (hud && tui) {
      new MutationObserver(syncTouchUI).observe(hud, { attributes: true, attributeFilter: ['class'] });
      setInterval(syncTouchUI, 500);
    }

    /* 左侧：浮动虚拟摇杆 */
    const zone = $('joy-zone'), base = $('joy-base'), knob = $('joy-knob');
    const JOY_R = 58, DEAD = 0.14;
    let joyId = null, ox = 0, oy = 0;
    window.__touchVec = { fwd: 0, strafe: 0 };
    function joyStart(e) {
      if (joyId !== null) return;
      joyId = e.pointerId;
      try { zone.setPointerCapture(joyId); } catch (err) { }
      const zr = zone.getBoundingClientRect();
      ox = e.clientX - zr.left; oy = e.clientY - zr.top;
      base.style.left = ox + 'px'; base.style.top = oy + 'px';
      base.classList.add('on');
      joyMove(e);
    }
    function joyMove(e) {
      if (e.pointerId !== joyId) return;
      const zr = zone.getBoundingClientRect();
      let dx = (e.clientX - zr.left) - ox, dy = (e.clientY - zr.top) - oy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      let strafe = dx / JOY_R, fwd = -dy / JOY_R;
      if (Math.hypot(strafe, fwd) < DEAD) { strafe = 0; fwd = 0; }
      window.__touchVec.fwd = fwd;
      window.__touchVec.strafe = strafe;
    }
    function joyEnd(e) {
      if (e.pointerId !== joyId) return;
      joyId = null;
      base.classList.remove('on');
      knob.style.transform = 'translate(0,0)';
      window.__touchVec.fwd = 0; window.__touchVec.strafe = 0;
    }
    if (zone) {
      zone.addEventListener('pointerdown', e => { e.preventDefault(); joyStart(e); });
      zone.addEventListener('pointermove', e => { e.preventDefault(); joyMove(e); });
      zone.addEventListener('pointerup', joyEnd);
      zone.addEventListener('pointercancel', joyEnd);
      /* v0.3.5：Touch 事件回退（老浏览器无 PointerEvent） */
      zone.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; if (t) joyStart({ pointerId: 't', clientX: t.clientX, clientY: t.clientY }); }, { passive: false });
      zone.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; if (t) joyMove({ pointerId: 't', clientX: t.clientX, clientY: t.clientY }); }, { passive: false });
      zone.addEventListener('touchend', e => { joyEnd({ pointerId: 't' }); });
      zone.addEventListener('touchcancel', e => { joyEnd({ pointerId: 't' }); });
    }

    /* 右侧：功能按键 */
    const DS = () => window.__DS || {};
    function bindBtn(id, down, up) {
      const el = $(id);
      if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('pressing'); if (down) down(); });
      const end = e => { el.classList.remove('pressing'); if (up) up(); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
      el.addEventListener('contextmenu', e => e.preventDefault());
      /* v0.3.5：无 PointerEvent 的老浏览器回退到 Touch 事件 */
      el.addEventListener('touchstart', e => { e.preventDefault(); if (!el._ts) { el._ts = true; el.classList.add('pressing'); if (down) down(); } }, { passive: false });
      const tEnd = e => { if (el._ts) { el._ts = false; el.classList.remove('pressing'); if (up) up(); } };
      el.addEventListener('touchend', tEnd);
      el.addEventListener('touchcancel', tEnd);
    }
    bindBtn('tb-draw', () => { const d = DS(); if (d.G && d.G.screen === 'playing' && d.drawCard) d.drawCard(); });
    bindBtn('tb-ult', () => { const d = DS(); if (d.castUlt) d.castUlt(); });
    bindBtn('tb-jump', () => { const d = DS(); if (d.tryJump) d.tryJump(); });
    bindBtn('tb-dash', () => { document.body.classList.add('touch-dashing'); try { DS().keys['ShiftLeft'] = true; } catch (e) { } }, releaseDash);
    bindBtn('tb-full', fsToggle);
    bindBtn('tb-hand', () => { const d = DS(); if (d.openHandPanel && d.G) { d.G.screen === 'handm' ? d.closeHandPanel() : d.openHandPanel(); } });
    window.addEventListener('blur', releaseDash);

    /* 大招就绪态高亮 */
    setInterval(() => {
      const d = DS(), el = $('tb-ult');
      if (!el || !d.G) return;
      el.classList.toggle('ready', d.G.screen === 'playing' && d.G.ult >= 100);
    }, 400);

    /* 触屏滑动画面 → 旋转视角 */
    const canvas = $('game');
    let camId = null, camLastX = 0;
    if (canvas) {
      canvas.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch' || camId !== null || !enabled) return;
        const d = DS();
        if (d.G && d.G.screen !== 'playing' && d.G.screen !== 'summon') return;
        if (d.G.pick) return;
        camId = e.pointerId; camLastX = e.clientX;
      });
      window.addEventListener('pointermove', e => {
        if (e.pointerId !== camId) return;
        const d = DS();
        const dx = e.clientX - camLastX;
        camLastX = e.clientX;
        if (d.rotateCam && Math.abs(dx) < 200) d.rotateCam(dx);
      });
      const camEnd = e => { if (e.pointerId === camId) camId = null; };
      window.addEventListener('pointerup', camEnd);
      window.addEventListener('pointercancel', camEnd);
    }
  }

  /* ---------- 模式应用 + 触摸自愈（仅 auto 模式） ---------- */
  applyMode();
  window.addEventListener('touchstart', function onFirstTouch() {
    if (getMode() !== 'auto' || enabled) { window.removeEventListener('touchstart', onFirstTouch); return; }
    const d = deviceInfo();
    if (d.hasTouch && d.sw > 0 && Math.min(d.sw, d.sh) <= 620) {
      window.removeEventListener('touchstart', onFirstTouch);
      enableTouchMode();
    }
  }, { passive: true });

  /* ---------- 主界面「设备模式」切换按钮 + 诊断 ---------- */
  const MODE_LABEL = { auto: '设备：自动', touch: '设备：手机端', pc: '设备：PC端' };
  function refreshModeBtn() {
    const b = $('btn-device-mode');
    if (b) b.textContent = MODE_LABEL[getMode()];
  }
  window.addEventListener('DOMContentLoaded', () => {
    refreshModeBtn();
    const b = $('btn-device-mode');
    if (b) b.addEventListener('click', () => {
      const order = ['auto', 'touch', 'pc'];
      const next = order[(order.indexOf(getMode()) + 1) % 3];
      setMode(next);
      applyMode();
      refreshModeBtn();
    });
    /* 诊断：点版本号 */
    const vb = $('ver-badge');
    if (vb) vb.addEventListener('click', () => {
      const d = deviceInfo();
      alert(
        '决斗幸存者 v' + (window.__DS ? window.__DS.GAME_VERSION : '?') +
        '\n── 设备检测 ──' +
        '\n设备模式: ' + MODE_LABEL[getMode()] + (getMode() === 'auto' ? '' : '（手动指定）') +
        '\n触屏模式: ' + (enabled ? '已启用' : '未启用') +
        '\n触摸能力: ' + (d.hasTouch ? '有（' + d.touchPts + ' 点）' : '无') +
        '\npointer:coarse: ' + d.coarse +
        '\nany-pointer:coarse: ' + d.anyCoarse +
        '\n屏幕: ' + d.sw + '×' + d.sh +
        '\n视口: ' + d.vw + '×' + d.vh +
        '\nUA: ' + d.ua.slice(0, 90)
      );
    });
  });

  /* ---------- v0.4.0 全屏模式：隐藏浏览器地址栏 ---------- */
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function fsEnter() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (fn) {
      try { const r = fn.call(el); if (r && r.catch) r.catch(() => { }); } catch (e) { }
    }
    /* iOS Safari 无 Fullscreen API：滚动隐藏地址栏 + 安全区兜底 */
    try { window.scrollTo(0, 1); } catch (e) { }
  }
  function fsExit() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) { try { fn.call(document); } catch (e) { } }
  }
  function fsToggle() {
    if (fsElement()) fsExit(); else fsEnter();
    setTimeout(refreshFsBtn, 300);
  }
  function refreshFsBtn() {
    const b = $('tb-full');
    if (b) b.innerHTML = '<b>' + (fsElement() ? '退出全屏' : '全屏') + '</b>';
    /* v0.4.1：常驻退出按钮 —— fullscreen 激活且处于触屏模式才显示（菜单/暂停时也能退出） */
    const fe = $('fs-exit');
    if (fe) fe.classList.toggle('hidden', !(fsElement() && enabled));
  }
  document.addEventListener('fullscreenchange', refreshFsBtn);
  document.addEventListener('webkitfullscreenchange', refreshFsBtn);
  (function bindFsExit() {
    const fe = $('fs-exit');
    if (fe) fe.addEventListener('click', () => { fsExit(); setTimeout(refreshFsBtn, 300); });
  })();
  refreshFsBtn();

  /* ---------- 供外部 / 测试调用 ---------- */
  window.DeviceMode = {
    get get() { return getMode(); },
    set(m) { setMode(m); applyMode(); refreshModeBtn(); },
    apply: applyMode,
    get active() { return enabled; },
    info: deviceInfo,
    fullscreen: { enter: fsEnter, exit: fsExit, toggle: fsToggle, get active() { return !!fsElement(); } }
  };
})();
