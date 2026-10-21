/* ===========================================================
 *  META · 局外系统（日元 / 商店卡包 / 卡组编辑 / 成就）
 *  存档 localStorage: ds_save_v3
 * =========================================================== */
(function (global) {
  const KEY = 'ds_save_v3';
  const $ = id => document.getElementById(id);

  const ACH = [
    { k: 'firstSummon', n: '初次召唤', d: '完成一次通常召唤', y: 200 },
    { k: 'firstSpell', n: '魔法发动', d: '发动第一张魔法卡', y: 200 },
    { k: 'fullField', n: '五阵齐列', d: '场上同时存在 5 只怪兽', y: 500 },
    { k: 'synchro', n: '同调之光', d: '完成一次同调召唤', y: 800 },
    { k: 'xyz', n: '超量叠放', d: '完成一次超量召唤', y: 800 },
    { k: 'link', n: '连接回路', d: '完成一次连接召唤', y: 800 },
    { k: 'fusion', n: '融合炼成', d: '完成一次融合召唤', y: 800 },
    { k: 'kill100', n: '百人斩', d: '单局击败 100 只怪兽', y: 600 },
    { k: 'kill500', n: '五百人斩', d: '单局击败 500 只怪兽', y: 1500 },
    { k: 'draw20', n: '抽卡如瀑', d: '单局抽 20 张卡', y: 300 },
    { k: 'pack10', n: '包瘾患者', d: '累计开启 10 个卡包', y: 500 },
    { k: 'clear', n: '神殿征服', d: '通关王家神殿', y: 3000 },
    /* v0.5.0：极简解锁线 —— 成就附带解锁物 */
    { k: 'fusionKill10', n: '融合大师', d: '用融合召唤的怪兽累计击败 10 个敌人', y: 1200, unlock: { type: 'card', id: 1533699, name: '融合支援卡 · 融合之门' } },
    { k: 'exodiaOnce', n: '封印解除', d: '集齐艾克佐迪亚一次', y: 5000, unlock: { type: 'cardback', id: 'exodia', name: '艾克佐迪亚卡背' } },
    { k: 'synchroKill10', n: '同调达人', d: '用同调召唤的怪兽累计击败 10 个敌人', y: 1200, unlock: { type: 'card', id: 2567839, name: '同调支援卡 · 同调素材' } },
    { k: 'xyzKill10', n: '超量高手', d: '用超量召唤的怪兽累计击败 10 个敌人', y: 1200, unlock: { type: 'card', id: 18940725, name: '超量支援卡 · 超量单元' } },
    { k: 'games5', n: '决斗老手', d: '累计游玩 5 局', y: 800, unlock: { type: 'avatar', id: 'duelist5', name: '决斗者头像 · 铜' } },
    { k: 'games20', n: '决斗大师', d: '累计游玩 20 局', y: 2000, unlock: { type: 'avatar', id: 'duelist20', name: '决斗者头像 · 金' } }
  ];

  // 初始额外卡组（均为可通过场上素材正规召唤的怪兽）
  const DEFAULT_EXTRA = {
    yugi: [84013238, 10443957],   // 编号39 希望皇霍普（2×★4）· 电子龙无限（2×★6）
    joey: [41462083],             // 千岁龙（融合）
    kaiba: [84013238, 47506081]   // 编号39 希望皇霍普（2×★4）· 红莲恐龙（2×★3）
  };

  const INIT_UNLOCKED = { yugi: true, joey: false, kaiba: false };
  let S = null;

  function deckArrFor(w) {
    const arr = [];
    (CARD_DB.decks[w] || []).forEach(d => { for (let i = 0; i < d.n; i++) arr.push(d.id); });
    return arr;
  }

  function defaultSave() {
    const owned = {};
    const decks = { yugi: [], joey: [], kaiba: [] };
    /* v0.3.5：解锁决斗者即拥有对应牌组 —— 初始只发已解锁的决斗者（游戏） */
    ['yugi', 'joey', 'kaiba'].forEach(w => {
      if (!INIT_UNLOCKED[w]) return;
      (CARD_DB.decks[w] || []).forEach(d => { owned[d.id] = Math.max(owned[d.id] || 0, d.n); });
      decks[w] = deckArrFor(w);
    });
    return {
      yen: 5000,
      owned: owned,
      decks: decks,
      extra: {
        yugi: DEFAULT_EXTRA.yugi.slice(),
        joey: [],
        kaiba: []
      },
      starter: Object.assign({}, CARD_DB.starter),
      ach: {},
      unlocked: { yugi: true, joey: false, kaiba: false },
      levels: ['temple'],
      seenSelect: false,
      lastChar: 'yugi',
      packsOpened: 0,
      games: 0,
      totalKills: 0,
      gamesPlayed: 0,
      tut: 0,
      unlocks: {},
      created: Date.now()
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      S = raw ? JSON.parse(raw) : defaultSave();
    } catch (e) { S = defaultSave(); }
    if (!S.owned) S.owned = {};
    if (!S.extra) S.extra = { yugi: [], joey: [], kaiba: [] };
    if (!S.unlocked) S.unlocked = Object.assign({}, INIT_UNLOCKED);
    /* v0.3.5：只给已解锁的决斗者补齐额外卡组（解锁时由 unlockChar 发放） */
    ['yugi', 'joey', 'kaiba'].forEach(w => {
      if (S.unlocked[w] && (!S.extra[w] || !S.extra[w].length)) S.extra[w] = (DEFAULT_EXTRA[w] || []).slice();
    });
    if (!S.starter) S.starter = Object.assign({}, CARD_DB.starter);
    if (!S.levels) S.levels = ['temple'];
    if (S.bgmVol === undefined) S.bgmVol = 0.35;
    if (!S.lastChar) S.lastChar = 'yugi';
    if (S.gamesPlayed === undefined) S.gamesPlayed = S.games || 0;
    /* v0.5.2c：教学关只发给新注册玩家 —— 老存档无此字段 → 视为已完成教学 */
    if (S.tut === undefined) S.tut = 2;
    if (!S.unlocks) S.unlocks = {};
    if (S.lowQuality === undefined) S.lowQuality = false;
    if (S.showFps === undefined) S.showFps = false;
    // 补齐缺失的初始卡（版本升级时）
    if (!S.decks) S.decks = defaultSave().decks;
    Object.keys(S.decks).forEach(w => {
      /* v0.3.5：仅已解锁决斗者自动补齐空卡组；未解锁者保留空（解锁时发放） */
      if (!S.decks[w] || !S.decks[w].length) {
        if (S.unlocked[w]) S.decks[w] = deckArrFor(w);
      }
    });
    /* v0.3.0：云端存档缺失 owned 时（如极简初始 {yen:5000}），从已解锁决斗者的卡组反推收集数 */
    Object.keys(S.decks).forEach(w => {
      if (!S.unlocked[w]) return;
      const cnt = {};
      (S.decks[w] || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
      Object.keys(cnt).forEach(id => { S.owned[id] = Math.max(S.owned[id] || 0, cnt[id]); });
    });
    return S;
  }

  function persistLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  }

  function persist() {
    persistLocal();
    /* 登录状态下自动云同步进度（DSCLOUD 内部防抖） */
    if (window.DSCLOUD) { try { DSCLOUD.pushSave(S); } catch (e) { } }
  }

  /* 云端存档覆盖本地（登录时调用），并刷新界面 */
  function applyCloudSave(obj) {
    if (!obj || typeof obj !== 'object') return false;
    S = obj;
    load();          // 走一遍字段补齐/兜底
    persist();
    refreshWallet();
    return true;
  }

  /* ---------------- 货币 ---------------- */
  function addYen(n, info) {
    S.yen = Math.max(0, Math.round(S.yen + n));
    if (info) {
      S.games = (S.games || 0) + 1;
      S.totalKills = (S.totalKills || 0) + (info.kills || 0);
    }
    persist(); refreshWallet();
  }
  function spend(n) {
    if (S.yen < n) return false;
    S.yen -= n; persist(); refreshWallet();
    return true;
  }
  function refreshWallet() {
    const v = '¥ ' + S.yen.toLocaleString();
    ['wallet-top', 'shop-wallet', 'deck-wallet'].forEach(id => { const el = $(id); if (el) el.textContent = v; });
    const bl = document.querySelector('.bl-yen');
    if (bl) bl.textContent = '¥' + S.yen.toLocaleString();
  }

  /* ---------------- 卡组 ---------------- */
  function deckFor(who) {
    const arr = S.decks[who];
    return (arr && arr.length) ? arr.slice() : null;
  }
  function extraFor(who) { return (S.extra[who] || []).slice(); }
  function starterFor(who) {
    const id = S.starter[who];
    const rec = id && CARD_DB.cards[id];
    if (rec && (rec.level || 0) <= 4) return id;
    return CARD_DB.starter[who];
  }
  function setStarter(who, id) {
    const rec = CARD_DB.cards[id];
    if (!rec || (rec.level || 0) > 4) return false;
    S.starter[who] = id; persist(); return true;
  }

  /* ---------------- 角色解锁 ---------------- */
  function isUnlocked(who) { return !!(S.unlocked && S.unlocked[who]); }
  function unlockChar(who) {
    if (!S.unlocked) S.unlocked = {};
    if (S.unlocked[who]) return false;
    S.unlocked[who] = true;
    /* v0.3.5：解锁决斗者即拥有对应专属牌组（卡牌收集 + 专属主卡组 / 额外卡组 / 初始怪兽） */
    if (!S.decks[who] || !S.decks[who].length) S.decks[who] = deckArrFor(who);
    if (!S.extra[who] || !S.extra[who].length) S.extra[who] = (DEFAULT_EXTRA[who] || []).slice();
    if (!S.starter[who]) S.starter[who] = CARD_DB.starter[who];
    const cnt = {};
    (S.decks[who] || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
    Object.keys(cnt).forEach(id => { S.owned[id] = Math.max(S.owned[id] || 0, cnt[id]); });
    persist(); refreshWallet();
    const nm = (typeof CHARS_META !== 'undefined' && CHARS_META[who]) ? CHARS_META[who].name : who;
    toast('已解锁决斗者 · ' + nm + '，并获得专属牌组（可在卡组编辑中切换决斗者修改）');
    return true;
  }
  /* ---------------- v0.4.0：战利品入收藏（击败三幻神 1% 掉落） ---------------- */
  function grantCard(id) {
    id = +id;
    const rec = CARD_DB.cards[id];
    if (!rec) return false;
    S.owned[id] = (S.owned[id] || 0) + 1;
    persist(); refreshWallet();
    toast('传说掉落！！获得 ' + rec.name + '（已加入收藏，可在卡组编辑中加入卡组）');
    if (global.GAME_TOAST) global.GAME_TOAST('★ 传说掉落 · ' + rec.name + ' ★');
    return true;
  }

  /* ---------------- 关卡解锁 ---------------- */
  function levelUnlocked(id) {
    if (!S.levels) S.levels = ['temple'];
    return S.levels.indexOf(id) >= 0;
  }
  function unlockLevel(id) {
    if (!S.levels) S.levels = ['temple'];
    if (S.levels.indexOf(id) >= 0) return false;
    S.levels.push(id);
    persist(); refreshWallet();
    toast('已解锁关卡 · ' + id);
    return true;
  }
  function markSelectSeen(who) {
    S.seenSelect = true;
    if (who) S.lastChar = who;    persist();
  }

  /* ---------------- v0.5.0：渐进式引导 · 分局解锁召唤法 ---------------- */
  /* 解锁顺序：通常召唤(始终) → 融合(第2局) → 同调(第3局) → 超量(第4局) → 连接(第5局) → 仪式(第6局) */
  const SUMMON_UNLOCK_ORDER = [
    { type: 'normal',   label: '通常召唤', game: 0 },
    { type: 'fusion',   label: '融合召唤', game: 1 },
    { type: 'synchro',  label: '同调召唤', game: 2 },
    { type: 'xyz',      label: '超量召唤', game: 3 },
    { type: 'link',     label: '连接召唤', game: 4 },
    { type: 'ritual',   label: '仪式召唤', game: 5 }
  ];
  function summonUnlocked(type) {
    const entry = SUMMON_UNLOCK_ORDER.find(e => e.type === type);
    if (!entry) return true;
    return (S.gamesPlayed || 0) >= entry.game;
  }
  function incrementGamesPlayed() {
    S.gamesPlayed = (S.gamesPlayed || 0) + 1;
    persist();
  }
  function getNewlyUnlockedSummons() {
    const gp = S.gamesPlayed || 0;
    return SUMMON_UNLOCK_ORDER.filter(e => e.game === gp).map(e => e.label);
  }
  function gamesPlayedCount() { return S.gamesPlayed || 0; }

  /* ---------------- 成就 ---------------- */
  function unlock(k) {
    if (S.ach[k]) return;
    const a = ACH.find(x => x.k === k);
    if (!a) return;
    S.ach[k] = Date.now();
    addYen(a.y);
    /* v0.5.0: achievement unlock reward */
    let unlockMsg = '';
    if (a.unlock) {
      if (!S.unlocks) S.unlocks = {};
      S.unlocks[a.unlock.id] = { type: a.unlock.type, name: a.unlock.name, at: Date.now() };
      unlockMsg = ' · 解锁：' + a.unlock.name;
      persist();
    }
    if (global.GAME_TOAST) global.GAME_TOAST('成就达成 · ' + a.n + ' +¥' + a.y + unlockMsg);
    renderAch();
  }
  function achCount() { return Object.keys(S.ach || {}).length; }

  /* ---------------- 卡包 ---------------- */
  /* v0.4.0：三幻神不进入任何卡包 —— 只能通过击败三幻神 1% 掉落获得 */
  const GOD_EXCLUDE = new Set([10000000, 10000010, 10000020]);
  function stripGodCards() {
    try {
      (CARD_DB.packs || []).forEach(p => {
        if (p.__godStripped) return;
        p.cards = (p.cards || []).filter(c => !GOD_EXCLUDE.has(+c.id));
        p.__godStripped = true;
      });
    } catch (e) { }
  }
  stripGodCards();
  /* 数字卡包：唯一在售卡包，卡池 = 全部官方卡（不含三幻神），每张等概率 */
  const DIGI_PRICE = 480;
  let digiPkCache = null;
  function digiPack() {
    if (digiPkCache) return digiPkCache;
    const cards = Object.keys(CARD_DB.cards)
      .filter(id => !GOD_EXCLUDE.has(+id))
      .map(id => ({ id: +id, r: CARD_DB.cards[id].rarity || 'N' }));
    digiPkCache = { name: '数字卡包', sub: 'FULL DIGITAL POOL', date: '—', code: 'DIGI', cards, price: DIGI_PRICE, digi: true };
    return digiPkCache;
  }
  function packCards(pk) {
    let total = 0;
    pk.cards.forEach(c => { total += c.w || 1; });
    return { total };
  }
  /* 每包固定抽 10 张 */
  const PACK_DRAW = 10;
  function rollOne(pk, used, maxSame) {
    // 等概率：卡池内每张卡机会相同；同包同卡最多 maxSame 张（默认 2）
    const cards = pk.cards;
    const cap = maxSame || 2;
    for (let t = 0; t < 60; t++) {
      const c = cards[(Math.random() * cards.length) | 0];
      if (used && (used[c.id] || 0) >= cap) continue;
      return c;
    }
    return cards[(Math.random() * cards.length) | 0];   // 小卡包兜底
  }
  function openPack(pk) {
    if (!pk || !pk.cards || !pk.cards.length) return null;
    if (!spend(pk.price)) return null;
    const got = [];
    const used = {};
    /* 包内种类足够时每张最多 2 张，种类少时放宽，保证抽满 10 张 */
    const maxSame = Math.max(2, Math.ceil(PACK_DRAW / Math.max(1, pk.cards.length)) + 1);
    for (let i = 0; i < PACK_DRAW; i++) {
      const c = rollOne(pk, used, maxSame);
      used[c.id] = (used[c.id] || 0) + 1;
      S.owned[c.id] = (S.owned[c.id] || 0) + 1;
      got.push({ id: c.id, r: c.r });
    }
    S.packsOpened = (S.packsOpened || 0) + 1;
    if (S.packsOpened >= 10) unlock('pack10');
    persist();
    return got;
  }

  /* ---------------- 商店 UI（按动画剧集分组，按播出顺序；只售中文剧集卡包） ---------------- */
  const SERIES = [
    { key: 'dm',     name: '千年神器', from: null,         until: '2004-10-05', note: '决斗怪兽 · 王之记忆 ~ 战斗城市（DM，1999-2004）' },
    { key: 'gx',     name: 'GX',       from: '2004-10-06', until: '2008-04-01', note: '决斗学园篇（GX，2004-2008）' },
    { key: '5ds',    name: "5D's",     from: '2008-04-02', until: '2011-04-17', note: '新童实野市 · 龙印者（5D\'s，2008-2011）' },
    { key: 'zexal',  name: 'ZEXAL',    from: '2011-04-18', until: '2014-04-05', note: '心之都市 · 超百罗巴（ZEXAL，2011-2014）' },
    { key: 'arcv',   name: 'ARC-V',    from: '2014-04-06', until: '2017-05-09', note: '四次元 · 灵摆召唤（ARC-V，2014-2017）' },
    { key: 'vrains', name: 'VRAINS',   from: '2017-05-10', until: '2999-12-31', note: '连接召唤 · 数据风暴（VRAINS，2017-）' },
  ];
  let shopSer = 'dm';
  function packsOfSeries(s) {
    return (CARD_DB.packs || []).filter(p => {
      const d = p.date || '';
      return (!s.from || d >= s.from) && (!s.until || d <= s.until);
    });
  }
  function renderShop() {
    const box = $('shop-packs');
    if (!box) return;
    const tabs = $('shop-years');
    if (tabs) {
      tabs.innerHTML = SERIES.map(s =>
        '<button class="sy-tab' + (shopSer === s.key ? ' on' : '') + '" data-s="' + s.key + '">' + s.name + '</button>').join('');
      tabs.querySelectorAll('.sy-tab').forEach(b => b.addEventListener('click', () => { shopSer = b.dataset.s; renderShop(); }));
    }
    const s = SERIES.find(x => x.key === shopSer) || SERIES[0];
    box.innerHTML = '';
    {
      const packs = packsOfSeries(s);
      const range = packs.length ? packs[0].date + ' ~ ' + packs[packs.length - 1].date : '—';
      const note = document.createElement('div');
      note.className = 'ser-note';
      note.innerHTML = '<b>' + s.name + '</b>　' + (s.note || '') + '<br>' +
        packs.length + ' 个卡包（' + range + '）· 每包固定 10 张 · 包间卡池不重叠 · 点击卡包查看内容并购买';
      box.appendChild(note);
      const grid = document.createElement('div');
      grid.className = 'shop-grid';
      box.appendChild(grid);
      packs.forEach(pk => {
        const el = document.createElement('div');
        el.className = 'pack-card';
        const coverId = pk.cards && pk.cards.length ? pk.cards[0].id : null;
        el.innerHTML =
          '<div class="pack-art"><img loading="lazy" alt=""></div>' +
          '<div class="pack-name">' + pk.name + '</div>' +
          '<div class="pack-sub">' + pk.sub + '</div>' +
          '<div class="pack-meta"><span>' + pk.date + '</span><span>' + pk.cards.length + ' 种</span></div>' +
          '<div class="pack-buy"><b>¥' + pk.price + '</b><span>查看 · 购买</span></div>';
        const im = el.querySelector('img');
        if (coverId) {
          im.onerror = () => { im.onerror = null; im.src = img(coverId); };
          im.src = pk.img || img(coverId);
        }
        el.addEventListener('click', () => openPackView(pk));
        grid.appendChild(el);
      });
    }
    refreshWallet();
  }

  function img(id) { return (global.__cardImg ? global.__cardImg(id) : 'data/cardimg/' + id + '.jpg'); }

  /* ---- 卡包内容弹窗（数字卡包 / 剧集卡包通用） ---- */
  let viewPk = null;
  let digiPage = 0, digiQuery = '', digiBound = false;
  const DIGI_PER = 60;
  function digiList() {
    let cards = (viewPk || digiPack()).cards;
    if (digiQuery) {
      const q = digiQuery.toLowerCase();
      cards = cards.filter(c => {
        const rec = CARD_DB.cards[c.id];
        return rec && ((rec.name + ' ' + (rec.en || '')).toLowerCase().indexOf(q) >= 0);
      });
    }
    return cards;
  }
  function renderDigiView() {
    const grid = $('digi-grid'), pager = $('digi-pager');
    if (!grid) return;
    const pk = viewPk || digiPack();
    const t = $('digi-title');
    if (t) t.textContent = pk.name + ' · 卡池一览';
    const k = $('digi-kicker');
    if (k) k.textContent = (pk.digi ? 'FULL DIGITAL POOL' : (pk.date + ' · ' + pk.sub)) + ' · 每张等概率';
    const buyBtn = $('digi-buy');
    if (buyBtn) buyBtn.textContent = '购买并抽取 10 张 · ¥' + pk.price;
    const cards = digiList();
    const pages = Math.max(1, Math.ceil(cards.length / DIGI_PER));
    if (digiPage >= pages) digiPage = pages - 1;
    if (digiPage < 0) digiPage = 0;
    const slice = cards.slice(digiPage * DIGI_PER, digiPage * DIGI_PER + DIGI_PER);
    grid.innerHTML = slice.map(c => {
      const rec = CARD_DB.cards[c.id];
      const nm = rec ? rec.name : '#' + c.id;
      return '<div class="digi-cell r-' + c.r + '" title="' + nm + '"><img loading="lazy" alt=""><b>' + nm + '</b></div>';
    }).join('');
    grid.querySelectorAll('.digi-cell').forEach((el, i) => {
      const im = el.querySelector('img');
      im.onerror = () => { el.style.visibility = 'hidden'; };
      im.src = img(slice[i].id);
    });
    pager.innerHTML =
      '<button class="btn btn-ghost small" id="digi-prev"' + (digiPage <= 0 ? ' disabled' : '') + '>上一页</button>' +
      '<span class="digi-page">' + cards.length.toLocaleString() + ' 张 · 第 ' + (digiPage + 1) + ' / ' + pages + ' 页</span>' +
      '<button class="btn btn-ghost small" id="digi-next"' + (digiPage >= pages - 1 ? ' disabled' : '') + '>下一页</button>';
    $('digi-prev').addEventListener('click', () => { digiPage--; renderDigiView(); });
    $('digi-next').addEventListener('click', () => { digiPage++; renderDigiView(); });
    const w = $('digi-wallet');
    if (w) w.textContent = '¥ ' + (S.yen || 0).toLocaleString();
  }
  function openPackView(pk) {
    const layer = $('digi-layer');
    if (!layer) return;
    viewPk = pk || digiPack();
    digiPage = 0; digiQuery = '';
    const inp = $('digi-search');
    if (inp) inp.value = '';
    layer.classList.add('on');
    if (!digiBound) {
      digiBound = true;
      if (inp) inp.addEventListener('input', () => { digiQuery = inp.value.trim().toLowerCase(); digiPage = 0; renderDigiView(); });
      $('digi-close').addEventListener('click', () => layer.classList.remove('on'));
      $('digi-buy').addEventListener('click', () => buyPack(viewPk || digiPack()));
    }
    renderDigiView();
  }
  function buyPack(pk) {
    pk = pk || digiPack();
    if (!pk) return false;
    if (S.yen < pk.price) { toast('日元不足，先去决斗赚取吧'); return false; }
    const got = openPack(pk);
    if (!got) return false;
    showPackResult(pk, got);
    return true;
  }
  /* 兼容旧接口 */
  function openDigiView() { openPackView(digiPack()); }
  function buyDigi() { return buyPack(digiPack()); }
  function showPackResult(pk, got) {
    const layer = $('pack-layer');
    layer.classList.add('on');
    layer.innerHTML = '<div class="pl-title">' + pk.name + '</div><div class="pl-row"></div>' +
      '<div class="pl-foot"><button class="btn btn-ghost small" id="pl-close">收下</button></div>';
    const row = layer.querySelector('.pl-row');
    got.forEach((g, k) => {
      const rec = CARD_DB.cards[g.id];
      const el = document.createElement('div');
      el.className = 'pl-card r-' + g.r;
      el.style.animationDelay = (k * 0.13) + 's';
      el.innerHTML = '<img src="' + img(g.id) + '" alt=""><span class="pl-rar">' + g.r + '</span>' +
        '<b>' + rec.name + '</b>';
      row.appendChild(el);
    });
    layer.querySelector('#pl-close').addEventListener('click', () => {
      layer.classList.remove('on');
      refreshWallet();
      renderDeck();
    });
  }

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('on'), 1600);
  }

  /* ---------------- 卡组编辑 UI ---------------- */
  let editWho = 'yugi';
  let draft = null;

  function ownedList(kindFilter) {
    const out = [];
    Object.keys(S.owned).forEach(id => {
      const rec = CARD_DB.cards[id];
      if (!rec || !S.owned[id]) return;
      if (kindFilter === 'monster' && !['normal', 'effect', 'tuner', 'ritual', 'fusion', 'synchro', 'xyz', 'link'].includes(rec.kind)) return;
      out.push({ id: +id, rec, n: S.owned[id] });
    });
    out.sort((a, b) => (b.rec.atk || 0) - (a.rec.atk || 0));
    return out;
  }

  /* 禁限卡表（与 game.js 的 LIMIT1_IDS 一致，经 window.LIMIT1_SET 共享） */
  function limitOf(id) {
    const L = global.LIMIT1_SET;
    return (L && L.has(+id)) ? 1 : 3;
  }

  function renderDeck() {
    const box = $('deck-body');
    if (!box) return;
    if (!draft) draft = { lib: deckFor(editWho) || [], extra: extraFor(editWho) || [], starter: starterFor(editWho) };
    if (!draft.extra) draft.extra = [];

    const counts = {};
    draft.lib.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const isExtraRec = rec => ['fusion', 'synchro', 'xyz', 'link'].includes(rec.kind);

    box.innerHTML =
      '<div class="dk-left">' +
        '<div class="dk-head">已拥有卡牌　<b>' + ownedList().length + '</b> 种　' +
          '<span class="dk-hint">同名卡 ≤3 · <b style="color:#ff9d6a">禁限卡表内 ≤1</b> · 额外怪兽自动进入额外卡组</span></div>' +
        '<div class="dk-grid" id="dk-owned"></div>' +
      '</div>' +
      '<div class="dk-right">' +
        '<div class="dk-head">主卡组　<b id="dk-count">' + draft.lib.length + '</b> / 40　' +
          '<span class="dk-hint">点击左侧加入 · 点击右侧移除</span></div>' +
        '<div class="dk-grid" id="dk-deck"></div>' +
        '<div class="dk-head" style="margin-top:10px">额外卡组（融合/同调/超量/连接）　<b id="dk-extra-count">' + draft.extra.length + '</b> / 15　' +
          '<span class="dk-hint">不参与抽卡 · 游戏内按 Q 查看</span></div>' +
        '<div class="dk-grid" id="dk-extra"></div>' +
        '<div class="dk-starter">初始怪兽（★4 以下）<div class="dk-sgrid" id="dk-starter"></div></div>' +
        '<div class="dk-actions"><button class="btn btn-primary small" id="dk-save">保存卡组</button>' +
        '<button class="btn btn-ghost small" id="dk-reset">恢复默认</button></div>' +
      '</div>';

    const og = box.querySelector('#dk-owned');
    ownedList().forEach(item => {
      const isEx = isExtraRec(item.rec);
      const inMain = counts[item.id] || 0;
      const inExtra = draft.extra.filter(x => +x === item.id).length;
      const lim = Math.min(item.n, limitOf(item.id));
      const isLim = lim === 1 && limitOf(item.id) === 1;
      const used = isEx ? inExtra : inMain;
      const el = document.createElement('div');
      el.className = 'dk-card' + (used >= lim ? ' maxed' : '') + (isLim ? ' lim1' : '') + (isEx ? ' dk-extag' : '');
      el.innerHTML = '<img src="' + img(item.id) + '" alt=""><i>' + used + '/' + lim + '</i>' +
        (isLim ? '<em class="dk-lim">限1</em>' : '') + (isEx ? '<em class="dk-extag">额外</em>' : '') +
        '<span class="dk-rar r-' + (item.rec.rarity || 'N') + '">' + (item.rec.rarity || 'N') + '</span>';
      el.title = item.rec.name + (isEx ? '（额外怪兽 · 加入额外卡组）' : (isLim ? '（禁限卡表 · 每卡组限 1 张）' : '（同名卡最多 3 张）'));
      el.addEventListener('click', () => {
        if (used >= lim) {
          toast(isLim ? '禁限卡表：' + item.rec.name + ' 每卡组只能放 1 张'
                      : '同名卡最多投放 3 张（' + item.rec.name + '）');
          return;
        }
        if (isEx) {
          if (draft.extra.length >= 15) { toast('额外卡组已满 15 张'); return; }
          draft.extra.push(item.id);
        } else {
          if (draft.lib.length >= 40) { toast('主卡组已满 40 张'); return; }
          draft.lib.push(item.id);
        }
        renderDeck();
      });
      og.appendChild(el);
    });

    const dg = box.querySelector('#dk-deck');
    const seen = {};
    draft.lib.forEach(id => { seen[id] = (seen[id] || 0) + 1; });
    Object.keys(seen).forEach(id => {
      const rec = CARD_DB.cards[id];
      if (!rec) return;
      const lim = limitOf(id);
      const el = document.createElement('div');
      el.className = 'dk-card' + (seen[id] > lim ? ' over' : '');
      el.innerHTML = '<img src="' + img(id) + '" alt=""><i>×' + seen[id] + (seen[id] > lim ? ' ⚠' : '') + '</i>' +
        (lim === 1 ? '<em class="dk-lim">限1</em>' : '');
      el.title = rec.name + '（' + (lim === 1 ? '禁限卡表 · 限 1 张' : '同名卡最多 3 张') + '）';
      el.addEventListener('click', () => {
        const i = draft.lib.indexOf(+id);
        if (i >= 0) draft.lib.splice(i, 1);
        renderDeck();
      });
      dg.appendChild(el);
    });

    const eg = box.querySelector('#dk-extra');
    const exSeen = {};
    draft.extra.forEach(id => { exSeen[id] = (exSeen[id] || 0) + 1; });
    Object.keys(exSeen).forEach(id => {
      const rec = CARD_DB.cards[id];
      if (!rec) return;
      const lim = limitOf(id);
      const el = document.createElement('div');
      el.className = 'dk-card' + (exSeen[id] > lim ? ' over' : '');
      el.innerHTML = '<img src="' + img(id) + '" alt=""><i>×' + exSeen[id] + '</i>';
      el.title = rec.name + '（点击移出额外卡组）';
      el.addEventListener('click', () => {
        const i = draft.extra.indexOf(+id);
        if (i >= 0) draft.extra.splice(i, 1);
        renderDeck();
      });
      eg.appendChild(el);
    });

    const sg = box.querySelector('#dk-starter');
    ownedList().filter(x => (x.rec.level || 0) <= 4 && ['normal', 'effect', 'tuner'].includes(x.rec.kind))
      .forEach(item => {
        const el = document.createElement('div');
        el.className = 'dk-card' + (draft.starter === item.id ? ' picked' : '');
        el.innerHTML = '<img src="' + img(item.id) + '" alt=""><i>★' + (item.rec.level || 1) + '</i>';
        el.title = item.rec.name;
        el.addEventListener('click', () => { draft.starter = item.id; renderDeck(); });
        sg.appendChild(el);
      });

    box.querySelector('#dk-save').addEventListener('click', () => {
      if (draft.lib.length > 40) { toast('主卡组最多 40 张（当前 ' + draft.lib.length + '）'); return; }
      if (draft.lib.length < 10) { toast('主卡组至少需要 10 张（当前 ' + draft.lib.length + '）'); return; }
      if (draft.extra.length > 15) { toast('额外卡组最多 15 张（当前 ' + draft.extra.length + '）'); return; }
      const cnt = {};
      let over = null;
      draft.lib.concat(draft.extra).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; if (cnt[id] > limitOf(id) && !over) over = id; });
      if (over) {
        const rec = CARD_DB.cards[over];
        toast((limitOf(over) === 1 ? '禁限卡表：' : '同名卡上限：') + (rec ? rec.name : over) +
          ' 最多 ' + limitOf(over) + ' 张');
        return;
      }
      S.decks[editWho] = draft.lib.slice();
      S.extra[editWho] = draft.extra.slice();
      setStarter(editWho, draft.starter);
      persist();
      toast('已保存 ' + CHARS_META[editWho].name + ' 的卡组（主 ' + draft.lib.length + ' · 额外 ' + draft.extra.length + '）');
      refreshWallet();
    });
    box.querySelector('#dk-reset').addEventListener('click', () => {
      const arr = [];
      (CARD_DB.decks[editWho] || []).forEach(d => {
        const n = Math.min(d.n, limitOf(d.id));
        for (let i = 0; i < n; i++) arr.push(d.id);
      });
      draft = { lib: arr, extra: extraFor(editWho) || [], starter: CARD_DB.starter[editWho] };
      renderDeck();
    });
  }

  const CHARS_META = { yugi: { name: '武藤游戏' }, joey: { name: '城之内克也' }, kaiba: { name: '海马濑人' } };

  function bindDeckTabs() {
    document.querySelectorAll('.dk-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.dk-tab').forEach(x => x.classList.remove('on'));
        t.classList.add('on');
        editWho = t.dataset.who;
        draft = null;
        renderDeck();
      });
    });
  }

  /* ---------------- 成就 UI ---------------- */
  function renderAch() {
    const box = $('ach-body');
    if (!box) return;
    const done = achCount();
    box.innerHTML = '<div class="ach-head">已达成 <b>' + done + '</b> / ' + ACH.length + '</div>' +
      '<div class="ach-grid">' + ACH.map(a => {
        const on = !!S.ach[a.k];
        const unlockBadge = a.unlock ? '<div class="ach-unlock' + (on ? ' unlocked' : '') + '">' +
          (on ? '🔓 ' : '🔒 ') + a.unlock.name + '</div>' : '';
        return '<div class="ach-item' + (on ? ' on' : '') + '">' +
          '<div class="ach-ic">' + (on ? '✓' : '?') + '</div>' +
          '<div class="ach-tx"><b>' + a.n + '</b><span>' + a.d + '</span>' + unlockBadge + '</div>' +
          '<div class="ach-y">¥' + a.y + '</div></div>';
      }).join('') + '</div>';
  }

  /* ---------------- 导出 ---------------- */
  global.META = {
    load, persist, persistLocal, addYen, spend, refreshWallet, applyCloudSave,
    deckFor, extraFor, starterFor, setStarter,
    unlock, achCount, ACH,
    openPack, buyDigi, openDigiView, digiPack, renderShop, renderDeck, renderAch, bindDeckTabs,
    get save() { return S; },
    isUnlocked, unlockChar, markSelectSeen, levelUnlocked, unlockLevel, grantCard,
    summonUnlocked, incrementGamesPlayed, getNewlyUnlockedSummons, gamesPlayedCount, SUMMON_UNLOCK_ORDER,
    resetDraft() { draft = null; },
    setEditWho(w) { editWho = w; draft = null; }
  };

  load();

  /* v0.3.5：绑定卡组编辑器决斗者切换标签（此前漏调用导致标签不可点击） */
  function initMetaUI() {
    try { bindDeckTabs(); } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMetaUI);
  else initMetaUI();
})(window);
