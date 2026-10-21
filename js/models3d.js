/* ===========================================================
 *  MODELS · 程序化 3D 建模
 *  - duelist(who)  决斗者（武藤游戏 / 城之内 / 海马 / 无名法老王）
 *  - monster(rec)  有卡图 → 卡牌立牌（浮雕卡面 billboard 始终面向玩家）
 *                  无卡图 → 按种族程序化全身建模（Boss 路径）
 *  - ace(who)      王牌怪兽（决斗链接式立像）
 *  =========================================================== */
(function (global) {
  const T = THREE;
  const TAU = Math.PI * 2;

  /* ---------------- 材质工具 ---------------- */
  function std(color, o) {
    o = o || {};
    return new T.MeshStandardMaterial({
      color: color,
      roughness: o.r === undefined ? 0.62 : o.r,
      metalness: o.m === undefined ? 0.12 : o.m,
      flatShading: o.flat !== false,
      emissive: o.e || 0x000000,
      emissiveIntensity: o.ei === undefined ? 0 : o.ei,
      transparent: !!o.t, opacity: o.op === undefined ? 1 : o.op,
      side: o.ds ? T.DoubleSide : T.FrontSide
    });
  }
  function shade(hex, f) {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    const k = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return (k(r) << 16) | (k(g) << 8) | k(b);
  }

  /* ---------------- 卡图主色采样 ---------------- */
  const colorCache = {};
  function artColor(img, fallback) {
    if (!img) return fallback || 0x8a7a5c;
    if (img.__dom) return img.__dom;
    try {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const x = c.getContext('2d');
      x.drawImage(img, 46, 102, 308, 325, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx < 26 || mx > 246) continue;      // 跳过纯黑/纯白边框
        if (mx - mn < 14) continue;             // 跳过灰色
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return fallback || 0x8a7a5c;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      // 提升饱和度，避免灰扑扑
      const avg = (r + g + b) / 3;
      const boost = 1.45;
      r = Math.max(0, Math.min(255, avg + (r - avg) * boost));
      g = Math.max(0, Math.min(255, avg + (g - avg) * boost));
      b = Math.max(0, Math.min(255, avg + (b - avg) * boost));
      const out = (r << 16) | (g << 8) | b;
      img.__dom = out;
      return out;
    } catch (e) { return fallback || 0x8a7a5c; }
  }

  /* ---------------- 卡面浮雕建模：由卡面像素生成 3D（全息立体投影） ----------------
   * 原理：采样卡面画窗的亮度场 → 作为高度图对平面网格做顶点位移，
   *      再把卡面原画贴回浮雕表面，配金色画框 + 背板 + 全息辉光底座，
   *      得到"由图片生成的 3D 建模"。每张卡的浮雕形状都由其卡面唯一决定。 */
  const RELIEF = { SX: 46 / 400, SY: 102 / 580, SW: 308 / 400, SH: 325 / 580 };

  function reliefHeightField(img) {
    const w = 64, h = 70;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const iw = img.naturalWidth || 400, ih = img.naturalHeight || 580;
    x.drawImage(img, RELIEF.SX * iw, RELIEF.SY * ih, RELIEF.SW * iw, RELIEF.SH * ih, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    let f = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      f[i] = (d[i * 4] * 0.34 + d[i * 4 + 1] * 0.5 + d[i * 4 + 2] * 0.16) / 255;
    }
    // 3x3 盒滤波平滑
    const s = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ny = y + dy, nx = xx + dx;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        sum += f[ny * w + nx]; n++;
      }
      s[y * w + xx] = sum / n;
    }
    return { f: s, w, h };
  }

  function reliefTexture(img) {
    const c = document.createElement('canvas');
    c.width = 288; c.height = 316;
    const x = c.getContext('2d');
    const iw = img.naturalWidth || 400, ih = img.naturalHeight || 580;
    x.drawImage(img, RELIEF.SX * iw, RELIEF.SY * ih, RELIEF.SW * iw, RELIEF.SH * ih, 0, 0, 288, 316);
    const t = new T.CanvasTexture(c);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }

  /* 整卡纹理：怪兽脚下的「本卡」——建模与卡牌绑定（v0.4.0：按 img 缓存） */
  function cardTexture(img) {
    if (img.__cardTex) return img.__cardTex;
    const c = document.createElement('canvas');
    c.width = 200; c.height = 290;
    const x = c.getContext('2d');
    x.fillStyle = '#c9a45c'; x.fillRect(0, 0, 200, 290);
    const iw = img.naturalWidth || 400, ih = img.naturalHeight || 580;
    x.drawImage(img, 8, 8, 184, 274);
    const t = new T.CanvasTexture(c);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    img.__cardTex = t;
    return t;
  }

  /* 立牌卡面纹理：卡牌立牌模式的整卡脸（金框 + 名字带 + 画窗 + 底部装饰带）
   * v0.4.0：按 img 缓存 —— 此前每只怪出场都新建 256×372 canvas + 纹理，3 分钟后 GC/显存崩塌 */
  function standFace(img, rec) {
    if (img.__standFace) return img.__standFace;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 372;
    const x = c.getContext('2d');
    // 卡底金框
    const grd = x.createLinearGradient(0, 0, 0, 372);
    grd.addColorStop(0, '#dcc788'); grd.addColorStop(0.5, '#c9a45c'); grd.addColorStop(1, '#a8823e');
    x.fillStyle = grd; x.fillRect(0, 0, 256, 372);
    x.strokeStyle = '#f0e2b0'; x.lineWidth = 3;
    x.strokeRect(4, 4, 248, 364);
    // 名字带
    x.fillStyle = '#241a10'; x.fillRect(12, 12, 232, 30);
    x.fillStyle = '#f0d890'; x.font = 'bold 17px "Microsoft YaHei", "Noto Sans SC", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const nm = ((rec && rec.name) || '').slice(0, 13);
    x.fillText(nm, 128, 28);
    // 画窗（与 RELIEF 裁剪区同比例 308:325）
    const ax = 22, ay = 48, aw = 212, ah = 224;
    try {
      if (img && img.complete && img.naturalWidth) {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        x.drawImage(img, RELIEF.SX * iw, RELIEF.SY * ih, RELIEF.SW * iw, RELIEF.SH * ih, ax, ay, aw, ah);
      } else {
        const ag = x.createLinearGradient(ax, ay, ax + aw, ay + ah);
        ag.addColorStop(0, '#3a2c4a'); ag.addColorStop(1, '#1a1226');
        x.fillStyle = ag; x.fillRect(ax, ay, aw, ah);
      }
    } catch (e) {
      x.fillStyle = '#241a2e'; x.fillRect(ax, ay, aw, ah);
    }
    x.strokeStyle = '#8a6c2e'; x.lineWidth = 2;
    x.strokeRect(ax - 1, ay - 1, aw + 2, ah + 2);
    // 底部装饰带
    const bg = x.createLinearGradient(0, 278, 0, 366);
    bg.addColorStop(0, '#4a3820'); bg.addColorStop(1, '#2c2010');
    x.fillStyle = bg; x.fillRect(12, 278, 232, 84);
    x.strokeStyle = '#c9a45c'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(20, 284); x.lineTo(236, 284); x.stroke();
    x.fillStyle = 'rgba(240,216,144,0.5)';
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(58 + i * 35, 320, 3.2, 0, TAU); x.fill(); }
    const t = new T.CanvasTexture(c);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    img.__standFace = t;
    return t;
  }

  /* 浮雕层构建（v0.4.2b：双层视差合并为单 Mesh + 顶点色，draw call 2→1；
   * 几何体/材质按 img 缓存，实例仅新建 Mesh——共享 geometry/material）
   * v0.4.2b：三档精度 ——
   *   精档 HQ 44×48：Boss/法老王专属（opt.hq），单对象不惜代价，保留全部视差细节；
   *   标准档 HI：PC 26×28 / 触屏 12×13。立牌画窗在 ~23 格相机距下仅约 40px，
   *     44×48 每行不足 1px 严重过采样，26×28（约 1.5px/行）肉眼无差，顶点量降至 42%；
   *   低档 LO 12×13：远距离 LOD 用（setReliefLOD 切换，触屏标准档=低档则跳过） */
  const RELIEF_COARSE = (() => {
    try {
      return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
    } catch (e) { return false; }
  })();
  const RELIEF_SEG = RELIEF_COARSE ? { x: 12, y: 13 } : { x: 26, y: 28 };
  const RELIEF_HQ_SEG = { x: 44, y: 48 };
  const RELIEF_LO_SEG = { x: 12, y: 13 };
  const RELIEF_LOD_OK = !RELIEF_COARSE;
  /* v0.4.2b：双层视差合并几何体 —— 底层暗色全画面 + 前景亮部（+0.13 深度），
   * 顶点色区分明暗（原 m0/m1 双材质双 Mesh → 单材质单 Mesh），索引拼接保持共享顶点 */
  function buildReliefGeo(hf, seg) {
    const PW = 1.04, PH = 1.14, DEPTH = 0.17;
    const mkLayer = extra => {
      const geo2 = new T.PlaneGeometry(PW, PH, seg.x, seg.y);
      const p = geo2.attributes.position;
      const uw = hf.w, uh = hf.h;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i);
        const fx = Math.min(uw - 1, Math.max(0, Math.round((px / PW + 0.5) * (uw - 1))));
        const fy = Math.min(uh - 1, Math.max(0, Math.round((0.5 - py / PH) * (uh - 1))));
        const lum = hf.f[fy * uw + fx];
        const base = Math.pow(lum, 1.15) * DEPTH;
        const fg = Math.max(0, lum - 0.62) / 0.38;
        p.setZ(i, base + fg * extra);
      }
      geo2.computeVertexNormals();
      return geo2;
    };
    const l0 = mkLayer(0), l1 = mkLayer(0.13);
    const n0 = l0.attributes.position.count, n1 = l1.attributes.position.count;
    const out = new T.BufferGeometry();
    const cat = (attr, size) => {
      const a = new Float32Array((n0 + n1) * size);
      a.set(l0.attributes[attr].array, 0);
      a.set(l1.attributes[attr].array, n0 * size);
      return new T.BufferAttribute(a, size);
    };
    out.setAttribute('position', cat('position', 3));
    out.setAttribute('normal', cat('normal', 3));
    out.setAttribute('uv', cat('uv', 2));
    const col = new Float32Array((n0 + n1) * 3);
    const dim = new T.Color(0x8a8a9a);                 // 底层暗色（原 m0.color）
    for (let i = 0; i < n0; i++) { col[i * 3] = dim.r; col[i * 3 + 1] = dim.g; col[i * 3 + 2] = dim.b; }
    for (let i = 0; i < n1; i++) { col[(n0 + i) * 3] = 1; col[(n0 + i) * 3 + 1] = 1; col[(n0 + i) * 3 + 2] = 1; }
    out.setAttribute('color', new T.BufferAttribute(col, 3));
    const i0 = l0.index.array, i1 = l1.index.array;
    const total = i0.length + i1.length;
    const idx = total > 65535 ? new Uint32Array(total) : new Uint16Array(total);
    idx.set(i0, 0);
    for (let i = 0; i < i1.length; i++) idx[i0.length + i] = i1[i] + n0;
    out.setIndex(new T.BufferAttribute(idx, 1));
    return out;
  }
  function reliefLayers(img, hq) {
    if (img.__reliefFail) return null;
    try {
      if (!img.complete || !img.naturalWidth) return null;
      if (!img.__reliefData) {
        const hf = reliefHeightField(img);       // 跨域图会在此抛错
        const tex = reliefTexture(img);
        img.__reliefData = { hf, tex };
      }
      const { hf, tex } = img.__reliefData;
      if (!img.__reliefMat) {
        img.__reliefMat = new T.MeshStandardMaterial({
          map: tex, vertexColors: true, roughness: 0.5, metalness: 0.06,
          emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85
        });
      }
      if (!img.__reliefGeo) img.__reliefGeo = {};
      const key = hq ? 'hq' : 'hi';
      if (!img.__reliefGeo[key]) img.__reliefGeo[key] = buildReliefGeo(hf, hq ? RELIEF_HQ_SEG : RELIEF_SEG);
      const mesh = new T.Mesh(img.__reliefGeo[key], img.__reliefMat);
      const grp = new T.Group();
      grp.add(mesh);
      grp.scale.setScalar(0.73);                 // 1.04×1.14 → 0.76×0.83，与立牌画窗吻合
      grp.userData.rl = { mesh: mesh, img: img, hq: !!hq };
      return grp;
    } catch (e) {
      img.__reliefFail = true;
      return null;
    }
  }
  /* v0.4.2b：浮雕 LOD —— near=true 保留标准/精档，远距离切 12×13 低档
   * （触屏两档网格相同，直接跳过；低档几何体懒构建，用后即弃由 GC 回收） */
  function setReliefLOD(grp, near) {
    if (!RELIEF_LOD_OK) return;
    const r = grp && grp.userData && grp.userData.rl;
    if (!r) return;
    const img = r.img;
    if (!near && !img.__reliefGeo.lo) {
      if (!img.__reliefData) return;
      img.__reliefGeo.lo = buildReliefGeo(img.__reliefData.hf, RELIEF_LO_SEG);
    }
    const g = near ? img.__reliefGeo[r.hq ? 'hq' : 'hi'] : img.__reliefGeo.lo;
    if (g && r.mesh.geometry !== g) r.mesh.geometry = g;
  }

  function artRelief(img) {
    if (img.__reliefFail) return null;
    if (img.__relief) return img.__relief;
    let g = null;
    try {
      if (!img.complete || !img.naturalWidth) throw 0;
      const hf = reliefHeightField(img);        // 跨域图会在此抛错
      const tex = reliefTexture(img);
      const PW = 1.04, PH = 1.14, DEPTH = 0.17;
      g = new T.Group();

      // 双层立体投影：底层全画面浮雕 + 前景亮部层（视差深度）
      const mkLayer = (extra, dim) => {
        const geo2 = new T.PlaneGeometry(PW, PH, 44, 48);
        const p = geo2.attributes.position;
        const uw = hf.w, uh = hf.h;
        for (let i = 0; i < p.count; i++) {
          const px = p.getX(i), py = p.getY(i);
          const fx = Math.min(uw - 1, Math.max(0, Math.round((px / PW + 0.5) * (uw - 1))));
          const fy = Math.min(uh - 1, Math.max(0, Math.round((0.5 - py / PH) * (uh - 1))));
          const lum = hf.f[fy * uw + fx];
          const base = Math.pow(lum, 1.15) * DEPTH;
          const fg = Math.max(0, lum - 0.62) / 0.38;        // 亮部（角色主体）
          p.setZ(i, base + fg * extra);
        }
        geo2.computeVertexNormals();
        const mat = new T.MeshStandardMaterial({
          map: tex, roughness: 0.5, metalness: 0.06,
          emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85,
          color: new T.Color(dim ? 0x8a8a9a : 0xffffff)
        });
        return new T.Mesh(geo2, mat);
      };
      const pg = new T.Group();
      const panel = mkLayer(0, true);          // 底层全画面浮雕（暗）
      const front = mkLayer(0.13, false);      // 前景亮部层（+0.13 深度视差）
      pg.add(panel, front);
      panel.rotation.x = -0.16;               // 仰角面向俯视相机
      front.rotation.x = -0.16;
      pg.position.y = 1.04;
      g.add(pg);

      // 背板（暗色轮廓 + 背面倒影）
      const backM = std(0x191219, { r: 0.85 });
      const slab = new T.Mesh(new T.BoxGeometry(PW + 0.05, PH + 0.05, 0.055), backM);
      slab.position.set(0, 1.04, -0.045);
      g.add(slab);
      const backFace = new T.Mesh(new T.PlaneGeometry(PW, PH),
        new T.MeshBasicMaterial({ map: tex, color: 0x3c3548, transparent: true, opacity: 0.85 }));
      backFace.rotation.y = Math.PI;
      backFace.position.set(0, 1.04, -0.075);
      g.add(backFace);

      // 金色画框
      const goldM = std(0xd8b45c, { r: 0.3, m: 0.85 });
      const fw = 0.045, fd = 0.05;
      [[0, PH / 2 + fw / 2, PW + fw * 2, fw], [0, -PH / 2 - fw / 2, PW + fw * 2, fw]].forEach(b => {
        const m = new T.Mesh(new T.BoxGeometry(b[2], b[3], fd), goldM);
        m.position.set(b[0], 1.04 + b[1], 0.01);
        g.add(m);
      });
      for (const s of [-1, 1]) {
        const m = new T.Mesh(new T.BoxGeometry(fw, PH, fd), goldM);
        m.position.set(s * (PW / 2 + fw / 2), 1.04, 0.01);
        g.add(m);
      }

      // 底座 + 全息光环 + 本卡（建模与卡牌绑定：怪兽立于自己的卡牌之上）
      const ped = new T.Mesh(new T.CylinderGeometry(0.34, 0.46, 0.07, 14), std(0x2a2032, { r: 0.6, m: 0.3 }));
      ped.position.y = 0.035;
      const pedRing = new T.Mesh(new T.TorusGeometry(0.4, 0.02, 5, 28),
        new T.MeshBasicMaterial({ color: 0xd8b45c, transparent: true, opacity: 0.75 }));
      pedRing.rotation.x = Math.PI / 2; pedRing.position.y = 0.075;
      g.add(ped, pedRing);
      const bindCard = new T.Mesh(new T.PlaneGeometry(0.52, 0.75),
        new T.MeshBasicMaterial({ map: cardTexture(img), transparent: false }));
      bindCard.rotation.x = -Math.PI / 2 + 0.22;
      bindCard.position.set(0, 0.085, 0.52);
      g.add(bindCard);
      const cardGlow = new T.Mesh(new T.PlaneGeometry(0.58, 0.81),
        new T.MeshBasicMaterial({ color: 0xd8b45c, transparent: true, opacity: 0.25, depthWrite: false }));
      cardGlow.rotation.x = -Math.PI / 2 + 0.22;
      cardGlow.position.set(0, 0.082, 0.52);
      g.add(cardGlow);
      const beam = new T.Mesh(new T.CylinderGeometry(0.3, 0.42, 0.9, 10, 1, true),
        new T.MeshBasicMaterial({ color: 0x8a76c8, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false }));
      beam.position.y = 0.55;
      g.add(beam);

      g.traverse(o => { if (o.isMesh && o !== beam) o.castShadow = true; });
      pg.name = 'reliefP';              // 克隆后按名字重挂动画引用
      pedRing.name = 'pedRing';
      g.userData.kind = 'relief';
      img.__relief = g;
    } catch (e) {
      img.__reliefFail = true;
      return null;
    }
    return g;
  }


  /* ---------------- 决斗者 ---------------- */
  const DUELIST = {
    yugi: {
      name: '武藤游戏', skin: 0xf0cfae, hair: 0x141018, hair2: 0xa8203c, hair3: 0xe8b93a,
      coat: 0x22305c, coat2: 0x18213f, shirt: 0x2c3c72, pants: 0x1b2136, trim: 0xd8b45c,
      eye: 0x8b5cf6, acc: 'puzzle', disk: 0x2b3a6b, gl: 0x9b7bff, aura: 0x8b5cf6
    },
    joey: {
      name: '城之内克也', skin: 0xf3d3b0, hair: 0xe3c05e, hair2: 0xc79a3c, hair3: 0xf2dc94,
      coat: 0xe6edf4, coat2: 0xa9c8de, shirt: 0xe8e4dc, pants: 0x2f4a3a, trim: 0xc9a34e,
      eye: 0x58a888, acc: 'bandage', disk: 0x4a4a52, gl: 0xffb347, aura: 0x4ade80
    },
    kaiba: {
      name: '海马濑人', skin: 0xf2d6b8, hair: 0x7a5230, hair2: 0x5e3f24, hair3: 0x9a6c40,
      coat: 0xf2f4f8, coat2: 0xd8dde6, shirt: 0x17141c, pants: 0xe8ebef, trim: 0x2f6fb5,
      eye: 0x4fa8e8, acc: 'kc', disk: 0xe8eef6, gl: 0x60c8ff, aura: 0x38bdf8
    },
    pharaoh: {
      name: '无名的法老王', skin: 0xe8c39e, hair: 0x100c14, hair2: 0x8a1830, hair3: 0xd8a832,
      coat: 0x1b2440, coat2: 0x121a30, shirt: 0x2b3a6b, pants: 0x14203a, trim: 0xf0c95a,
      eye: 0xffd166, acc: 'scepter', disk: 0xd8b45c, gl: 0xffd166, aura: 0xffcf5a
    }
  };

  /* ---- 动漫脸部：直接绘在头球 UV 上（u=0.25 → +z 正面），任意角度可见 ---- */
  const faceCache = {};
  function faceTex(cfg) {
    if (faceCache[cfg.name]) return faceCache[cfg.name];
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    x.fillStyle = hex(cfg.skin);                    // 整体肤色（球面包皮）
    x.fillRect(0, 0, 512, 256);
    // 腮红阴影带（下颌渐暗）
    const sh = x.createLinearGradient(0, 170, 0, 256);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(60,30,20,0.18)');
    x.fillStyle = sh; x.fillRect(0, 170, 512, 86);
    const CX = 128, CY = 104;                       // u=0.25 → 模型正面（+z）；眼位略高，俯角相机可见
    function eye(cx, cy, w, h) {
      x.fillStyle = 'rgba(38,24,38,0.3)';
      x.beginPath(); x.ellipse(cx, cy + 4, w * 1.14, h * 1.18, 0, 0, TAU); x.fill();
      x.fillStyle = '#fbf9f7';
      x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, TAU); x.fill();
      const g1 = x.createRadialGradient(cx, cy + h * 0.25, 1, cx, cy, h * 1.05);
      g1.addColorStop(0, hex(shade(cfg.eye, 1.65)));
      g1.addColorStop(1, hex(shade(cfg.eye, 0.42)));
      x.fillStyle = g1;
      x.beginPath(); x.ellipse(cx, cy + h * 0.08, w * 0.72, h * 0.88, 0, 0, TAU); x.fill();
      x.fillStyle = '#160f1e';
      x.beginPath(); x.ellipse(cx, cy + h * 0.12, w * 0.3, h * 0.44, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.96)';
      x.beginPath(); x.ellipse(cx - w * 0.24, cy - h * 0.34, w * 0.18, h * 0.24, 0, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(cx + w * 0.2, cy + h * 0.38, w * 0.1, h * 0.13, 0, 0, TAU); x.fill();
      x.strokeStyle = '#1e1522'; x.lineWidth = w * 0.36; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - w * 1.02, cy - h * 0.42);
      x.quadraticCurveTo(cx, cy - h * 1.38, cx + w * 1.02, cy - h * 0.42); x.stroke();
      x.strokeStyle = '#241a20'; x.lineWidth = w * 0.24;
      x.beginPath(); x.moveTo(cx - w * 0.9, cy - h * 1.9);
      x.quadraticCurveTo(cx, cy - h * 2.45, cx + w * 0.9, cy - h * 1.8); x.stroke();
    }
    eye(CX - 46, CY, 38, 44);
    eye(CX + 46, CY, 38, 44);
    // 鼻 + 嘴
    x.strokeStyle = 'rgba(96,52,52,0.65)'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(CX + 2, CY + 52); x.lineTo(CX - 6, CY + 68); x.stroke();
    x.strokeStyle = '#a45550'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(CX - 20, CY + 96); x.quadraticCurveTo(CX, CY + 108, CX + 20, CY + 96); x.stroke();
    const t = new T.CanvasTexture(c);
    faceCache[cfg.name] = t;
    return t;
  }

  /* ---- 尖发辅助：圆锥沿方向摆放（根部贴头皮，flat 压扁成发片） ---- */
  function spike(len, rad, mat, fx, fy, fz, dx, dy, dz, flat) {
    const s = new T.Mesh(new T.ConeGeometry(rad, len, 5), mat);
    if (flat) s.scale.z = flat;
    const d = new T.Vector3(dx, dy, dz).normalize();
    s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
    s.position.set(fx, fy, fz).addScaledVector(d, len * 0.4);
    return s;
  }

  function humanoid(cfg, opt) {
    opt = opt || {};
    const g = new T.Group();
    const skinM = std(cfg.skin, { r: 0.75, m: 0.02 });
    const coatM = std(cfg.coat, { r: 0.68, m: 0.06 });
    const coat2M = std(cfg.coat2, { r: 0.7, m: 0.06 });
    const shirtM = std(cfg.shirt, { r: 0.72 });
    const pantsM = std(cfg.pants, { r: 0.76 });
    const trimM = std(cfg.trim, { r: 0.3, m: 0.9 });
    const hairM = std(cfg.hair, { r: 0.5, m: 0.18 });
    const hair2M = std(cfg.hair2, { r: 0.5, m: 0.14 });
    const hair3M = std(cfg.hair3, { r: 0.42, m: 0.2 });
    const darkM = std(0x14141a, { r: 0.8 });
    const style = opt.hairStyle || 'yugi';

    // 腿
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new T.Mesh(new T.CylinderGeometry(0.118, 0.098, 0.74, 9), pantsM);
      hip.position.set(s * 0.155, 0.39, 0);
      const shoe = new T.Mesh(new T.BoxGeometry(0.2, 0.12, 0.34), darkM);
      shoe.position.set(s * 0.155, 0.06, 0.06);
      legs.push(hip, shoe);
      g.add(hip, shoe);
    }
    // 腰带
    const belt = new T.Mesh(new T.BoxGeometry(0.46, 0.09, 0.31), darkM);
    belt.position.y = 0.77;
    g.add(belt);

    /* 躯干：按角色裁剪 */
    if (style === 'kaiba') {
      // 白色无袖长大衣 + 黑色高领衫
      const torso = new T.Mesh(new T.CylinderGeometry(0.285, 0.24, 0.7, 12), coatM);
      torso.position.y = 1.08;
      const chest = new T.Mesh(new T.BoxGeometry(0.32, 0.44, 0.14), shirtM);
      chest.position.set(0, 1.12, 0.15);
      const neckT = new T.Mesh(new T.CylinderGeometry(0.115, 0.13, 0.15, 10), shirtM);
      neckT.position.y = 1.53;
      g.add(torso, chest, neckT);
      // 高立领 + 银扣
      for (const s of [-1, 1]) {
        const col = new T.Mesh(new T.BoxGeometry(0.1, 0.26, 0.06), coatM);
        col.position.set(s * 0.16, 1.58, 0.05);
        col.rotation.z = s * 0.3;
        g.add(col);
        for (let i = 0; i < 2; i++) {
          const stud = new T.Mesh(new T.SphereGeometry(0.024, 6, 5), trimM);
          stud.position.set(s * (0.12 + i * 0.055), 1.5 + i * 0.09, 0.11);
          g.add(stud);
        }
      }
      // 肩章球
      for (const s of [-1, 1]) {
        const sh = new T.Mesh(new T.SphereGeometry(0.105, 9, 7), coatM);
        sh.position.set(s * 0.3, 1.38, 0);
        g.add(sh);
      }
      // 长大衣后摆
      for (const s of [-1, 1]) {
        const tail = new T.Mesh(new T.BoxGeometry(0.21, 0.95, 0.06), coatM);
        tail.position.set(s * 0.14, 0.44, -0.2);
        tail.rotation.x = 0.14; tail.rotation.z = s * 0.06;
        g.add(tail);
      }
      // KC 腰扣
      const kc = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.03, 12), std(0x2f6fb5, { m: 0.9, r: 0.25 }));
      kc.rotation.x = Math.PI / 2; kc.position.set(0, 0.77, 0.17);
      const kcr = new T.Mesh(new T.TorusGeometry(0.088, 0.018, 6, 18), trimM);
      kcr.position.set(0, 0.77, 0.17);
      g.add(kc, kcr);
    } else if (style === 'joey') {
      // 浅色短袖上衣 + 胸前色块 + 锁链项链
      const torso = new T.Mesh(new T.CylinderGeometry(0.27, 0.24, 0.66, 12), coatM);
      torso.position.y = 1.07;
      const panel = new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.06), coat2M);
      panel.position.set(0, 1.12, 0.2);
      g.add(torso, panel);
      const chain = new T.Mesh(new T.TorusGeometry(0.17, 0.02, 6, 22), trimM);
      chain.position.set(0, 1.42, 0.04); chain.rotation.x = 1.35;
      g.add(chain);
    } else {
      // 游戏/法老王：深蓝外套敞开 + 黑色内衬 + 斜挎皮带金扣
      const torso = new T.Mesh(new T.CylinderGeometry(0.275, 0.24, 0.68, 12), coatM);
      torso.position.y = 1.08;
      const shirtV = new T.Mesh(new T.BoxGeometry(0.2, 0.46, 0.12), darkM);
      shirtV.position.set(0, 1.12, 0.16);
      g.add(torso, shirtV);
      for (const s of [-1, 1]) {
        const edge = new T.Mesh(new T.BoxGeometry(0.05, 0.5, 0.03), std(0xe8e4dc, { r: 0.6 }));
        edge.position.set(s * 0.12, 1.12, 0.235);
        edge.rotation.z = s * 0.08;
        const strap = new T.Mesh(new T.BoxGeometry(0.07, 0.4, 0.03), darkM);
        strap.position.set(s * 0.2, 1.16, 0.23);
        strap.rotation.z = s * 0.5;
        const buckle = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.035, 8), trimM);
        buckle.rotation.x = Math.PI / 2;
        buckle.position.set(s * 0.14, 1.25, 0.25);
        g.add(edge, strap, buckle);
      }
      const collar = new T.Mesh(new T.CylinderGeometry(0.15, 0.26, 0.13, 10), coat2M);
      collar.position.y = 1.46;
      g.add(collar);
      if (opt.longCoat) {                 // 法老王披风式后摆
        for (const s of [-1, 1]) {
          const tail = new T.Mesh(new T.BoxGeometry(0.2, 0.92, 0.06), coat2M);
          tail.position.set(s * 0.13, 0.44, -0.2);
          tail.rotation.x = 0.13;
          g.add(tail);
        }
      }
    }

    // 手臂（海马无袖/城之内短袖露出皮肤）
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new T.Group();
      const upperM = (style === 'joey' || style === 'kaiba') ? skinM : coatM;
      const upper = new T.Mesh(new T.CylinderGeometry(0.078, 0.068, 0.42, 8), upperM);
      upper.position.y = -0.21;
      const fore = new T.Mesh(new T.CylinderGeometry(0.066, 0.058, 0.36, 8), skinM);
      fore.position.y = -0.58;
      const hand = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), skinM);
      hand.position.y = -0.79;
      arm.add(upper, fore, hand);
      arm.position.set(s * 0.315, 1.36, 0);
      arm.rotation.z = s * 0.13;
      g.add(arm);
      arms.push(arm);
    }

    // 头（脸绘于球面 UV，正面 u=0.25 → +z）
    const headM = new T.MeshStandardMaterial({ color: 0xffffff, map: faceTex(cfg), roughness: 0.72, metalness: 0.02 });
    const head = new T.Mesh(new T.SphereGeometry(0.29, 24, 18), headM);
    head.position.y = 1.74; head.scale.set(0.97, 1.04, 0.92);
    const jaw = new T.Mesh(new T.SphereGeometry(0.2, 12, 9), skinM);
    jaw.position.set(0, 1.62, 0.05); jaw.scale.set(0.88, 0.7, 0.9);
    const neck = new T.Mesh(new T.CylinderGeometry(0.085, 0.1, 0.14, 8), skinM);
    neck.position.y = 1.5;
    g.add(head, jaw, neck);

    // 发型（多尖发层，按角色原画）
    const hair = new T.Group();
    const hy = 1.74;                                  // 头心高度
    if (opt.hairStyle === 'yugi') {
      // 黑色底帽
      const cap = new T.Mesh(new T.SphereGeometry(0.305, 14, 12), hairM);
      cap.position.y = hy + 0.09; cap.position.z = -0.03; cap.scale.set(1.02, 0.92, 0.88);
      hair.add(cap);
      // 黑色后发棘
      hair.add(spike(0.4, 0.11, hairM, 0, hy + 0.18, -0.2, 0, 0.9, -1, 0.6));
      hair.add(spike(0.42, 0.12, hairM, -0.17, hy + 0.1, -0.22, -0.4, 0.7, -0.9, 0.6));
      hair.add(spike(0.42, 0.12, hairM, 0.17, hy + 0.1, -0.22, 0.4, 0.7, -0.9, 0.6));
      // 洋红巨星棘（星形轮廓）
      hair.add(spike(0.5, 0.14, hair2M, 0, hy + 0.24, 0.02, 0, 1, 0.1, 0.55));
      for (const s of [-1, 1]) {
        hair.add(spike(0.48, 0.13, hair2M, s * 0.16, hy + 0.2, 0.02, s * 0.55, 1, 0.05, 0.55));
        hair.add(spike(0.44, 0.12, hair2M, s * 0.26, hy + 0.08, -0.06, s * 0.95, 0.65, -0.25, 0.55));
        hair.add(spike(0.38, 0.11, hair2M, s * 0.27, hy - 0.06, -0.1, s * 1, 0.15, -0.3, 0.55));
      }
      // 金色鬓角翼
      for (const s of [-1, 1]) {
        hair.add(spike(0.4, 0.085, hair3M, s * 0.24, hy + 0.02, 0.14, s * 0.65, 0.85, 0.2, 0.5));
      }
      // 金色前发刘海（框额，不遮眼）
      hair.add(spike(0.24, 0.06, hair3M, -0.09, hy + 0.19, 0.21, -0.12, -0.95, 0.28, 0.5));
      hair.add(spike(0.24, 0.06, hair3M, 0.09, hy + 0.19, 0.21, 0.12, -0.95, 0.28, 0.5));
      hair.add(spike(0.2, 0.05, hair3M, 0, hy + 0.2, 0.22, 0, -0.9, 0.25, 0.5));
    } else if (opt.hairStyle === 'joey') {
      const cap = new T.Mesh(new T.SphereGeometry(0.31, 13, 11), hairM);
      cap.position.y = hy + 0.08; cap.position.z = -0.03; cap.scale.set(1.04, 0.88, 0.86);
      hair.add(cap);
      // 前额横垂刘海（两侧分梳，露脸）
      for (let i = 0; i < 4; i++) {
        const t = -0.18 + i * 0.12;
        hair.add(spike(0.26 + (i % 2) * 0.05, 0.06, hair2M,
          t, hy + 0.17, 0.2, t * 1.6, -0.9, 0.22, 0.5));
      }
      // 头顶乱棘
      const dirs = [[-0.7, 1, 0.1], [0, 1.05, 0.15], [0.7, 1, 0.1], [-0.45, 0.9, -0.5], [0.45, 0.9, -0.5], [0, 1, -0.9]];
      dirs.forEach((d, i) => {
        hair.add(spike(0.36 + (i % 3) * 0.05, 0.1, i % 2 ? hairM : hair2M,
          d[0] * 0.14, hy + 0.18, d[2] * 0.14, d[0], d[1], d[2], 0.55));
      });
      // 侧发
      for (const s of [-1, 1]) {
        hair.add(spike(0.3, 0.08, hairM, s * 0.26, hy - 0.02, 0.08, s * 0.95, -0.45, 0.15, 0.5));
      }
    } else {
      // 海马/法老王：后梳 + 中分垂刘海 + 侧翼
      const cap = new T.Mesh(new T.SphereGeometry(0.3, 13, 11), hairM);
      cap.position.y = hy + 0.09; cap.position.z = -0.03; cap.scale.set(1.01, 0.92, 0.88);
      hair.add(cap);
      hair.add(spike(0.42, 0.13, hair2M, 0, hy + 0.16, -0.18, 0, 0.75, -0.9, 0.6));
      hair.add(spike(0.36, 0.11, hairM, -0.14, hy + 0.1, -0.2, -0.35, 0.7, -0.85, 0.6));
      hair.add(spike(0.36, 0.11, hairM, 0.14, hy + 0.1, -0.2, 0.35, 0.7, -0.85, 0.6));
      for (const s of [-1, 1]) {
        hair.add(spike(0.34, 0.075, hair2M, s * 0.14, hy + 0.15, 0.19, s * 0.42, -0.85, 0.18, 0.5));
        hair.add(spike(0.36, 0.09, hairM, s * 0.26, hy + 0.1, -0.04, s * 1, 0.3, -0.15, 0.5));
      }
    }
    g.add(hair);

    // 千年积木 / 千年锡杖 / KC 徽章
    if (cfg.acc === 'puzzle') {
      const cord = new T.Mesh(new T.TorusGeometry(0.19, 0.014, 4, 20), trimM);
      cord.position.set(0, 1.44, 0.03); cord.rotation.x = 1.35;
      const pyr = new T.Mesh(new T.ConeGeometry(0.13, 0.2, 4), trimM);
      pyr.position.set(0, 1.28, 0.22); pyr.rotation.x = Math.PI;   // 倒悬金字塔
      const eye = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), std(0xffd166, { e: 0xffb300, ei: 2.2 }));
      eye.position.set(0, 1.31, 0.3);
      g.add(cord, pyr, eye);
      g.userData.accGlow = eye;
    } else if (cfg.acc === 'scepter') {
      const rod = new T.Group();
      const shaft = new T.Mesh(new T.CylinderGeometry(0.05, 0.055, 2.0, 8), trimM);
      shaft.position.y = 1.0;
      const headG = new T.Mesh(new T.TorusGeometry(0.2, 0.035, 6, 18), trimM);
      headG.position.y = 2.0;
      const orb = new T.Mesh(new T.IcosahedronGeometry(0.11, 1), std(0xffd166, { e: 0xffb300, ei: 2.6 }));
      orb.position.y = 2.02;
      rod.add(shaft, headG, orb);
      rod.position.set(0.42, 0.02, 0.06);
      rod.rotation.z = -0.09;
      g.add(rod);
      g.userData.scepterOrb = orb;
      // 千年神器·黄金柜挂饰
      const box = new T.Mesh(new T.BoxGeometry(0.18, 0.22, 0.12), trimM);
      box.position.set(0, 1.24, 0.24);
      g.add(box);
    } else if (cfg.acc === 'kc') {
      const badge = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.03, 10), std(0x2f6fb5, { m: 0.9, r: 0.25 }));
      badge.position.set(-0.16, 1.3, 0.23); badge.rotation.x = Math.PI / 2;
      g.add(badge);
    } else if (cfg.acc === 'bandage') {
      const bd = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.05), std(0xf0e8d8));
      bd.position.set(-0.14, 1.62, 0.22);
      g.add(bd);
    }

    // 决斗盘（挂左臂，随手臂摆动）
    if (opt.disk !== false && arms[0]) {
      const disk = new T.Group();
      const plate = new T.Mesh(new T.BoxGeometry(0.44, 0.055, 0.3), std(cfg.disk, { r: 0.35, m: 0.7 }));
      const slot = new T.Mesh(new T.BoxGeometry(0.32, 0.02, 0.2), std(cfg.gl, { e: cfg.gl, ei: 2.2 }));
      slot.position.y = 0.04;
      const grip = new T.Mesh(new T.TorusGeometry(0.13, 0.03, 5, 14), std(cfg.disk, { r: 0.4, m: 0.7 }));
      grip.rotation.y = Math.PI / 2; grip.position.set(-0.2, -0.05, 0);
      disk.add(plate, slot, grip);
      disk.position.set(-0.04, -0.6, 0.17);
      disk.rotation.z = 0.12;
      arms[0].add(disk);
      g.userData.diskGlow = slot;
    }

    /* ---- 精修细节：高帮靴 / 外套下摆 / 手套护腕（与怪兽独立建模同标准） ---- */
    const bootM = std(style === 'joey' ? 0x5c4128 : 0x17171d, { r: 0.55, m: 0.12 });
    for (const s of [-1, 1]) {
      const shaft = new T.Mesh(new T.CylinderGeometry(0.104, 0.122, 0.3, 9), bootM);
      shaft.position.set(s * 0.155, 0.23, 0);
      g.add(shaft);
    }
    if (style === 'yugi' || style === 'joey') {
      // 外套侧摆 ×2 + 后摆裙片
      for (const s of [-1, 1]) {
        const flap = new T.Mesh(new T.BoxGeometry(0.15, 0.4, 0.06), coatM);
        flap.position.set(s * 0.26, 0.66, 0.06);
        flap.rotation.z = s * 0.12; flap.rotation.x = -0.06;
        g.add(flap);
      }
      const back = new T.Mesh(new T.BoxGeometry(0.4, 0.42, 0.05), coatM);
      back.position.set(0, 0.68, -0.24); back.rotation.x = 0.1;
      g.add(back);
    }
    if (style === 'kaiba') {
      // 白手套 + 银色护腕
      for (const s of [-1, 1]) {
        const glove = new T.Mesh(new T.SphereGeometry(0.082, 8, 6), std(0xf2f0ea, { r: 0.5 }));
        glove.position.set(s * 0.315, 0.57, 0);
        const bracer = new T.Mesh(new T.CylinderGeometry(0.072, 0.064, 0.16, 8), std(0xe8e6e0, { r: 0.35, m: 0.6 }));
        bracer.position.set(s * 0.315, 0.72, 0);
        g.add(glove, bracer);
      }
      // 大衣下摆内衬
      for (const s of [-1, 1]) {
        const lin = new T.Mesh(new T.BoxGeometry(0.17, 0.5, 0.02), std(0x2a2a34, { r: 0.7 }));
        lin.position.set(s * 0.14, 0.42, -0.235);
        lin.rotation.x = 0.14;
        g.add(lin);
      }
    }
    if (style === 'joey') {
      // 棕色半指手套
      for (const s of [-1, 1]) {
        const glove = new T.Mesh(new T.SphereGeometry(0.079, 8, 6), std(0x6b4a2f, { r: 0.6 }));
        glove.position.set(s * 0.315, 0.57, 0);
        g.add(glove);
      }
    }

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.arms = arms;
    g.userData.legs = legs;
    g.userData.hair = hair;
    g.userData.kind = 'duelist';
    g.userData.cfg = cfg;
    return g;
  }

  function duelist(who) {
    const cfg = DUELIST[who] || DUELIST.yugi;
    const opt = {
      hairStyle: who === 'yugi' || who === 'pharaoh' ? 'yugi' : (who === 'joey' ? 'joey' : 'kaiba'),
      longCoat: who === 'kaiba' || who === 'pharaoh',
      jacket: who === 'joey',
      disk: true
    };
    const g = humanoid(cfg, opt);
    const aura = new T.Sprite(new T.SpriteMaterial({
      map: glow(),
      color: cfg.aura, transparent: true, opacity: 0.42,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    aura.scale.set(2.6, 2.0, 1);
    aura.position.y = 0.9;
    g.add(aura);
    g.userData.aura = aura;
    return g;
  }

  let GLOW = null;
  function glow() {
    if (GLOW) return GLOW;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    GLOW = new T.CanvasTexture(c);
    return GLOW;
  }

  /* ---------------- 怪兽 archetype ---------------- */
  function bodyMat(color, opt) {
    return std(color, Object.assign({ r: 0.6, m: 0.22 }, opt || {}));
  }

  function dragonModel(color, lv) {
    const g = new T.Group();
    const s = 0.82 + lv * 0.035;
    const bodyM = bodyMat(color, { m: 0.3 });
    const bellyM = std(shade(color, 1.5), { r: 0.72, m: 0.1 });
    const hornM = std(shade(color, 1.9), { r: 0.35, m: 0.65 });
    const spineM = std(shade(color, 0.6), { r: 0.4, m: 0.5 });
    const eyeM = std(0xffd166, { e: 0xff9d00, ei: 3.2, r: 0.2 });
    const wingM = std(shade(color, 0.72), { r: 0.78, ds: true, t: true, op: 0.92 });

    const torso = new T.Mesh(new T.SphereGeometry(0.46, 10, 8), bodyM);
    torso.position.y = 0.86; torso.scale.set(0.95, 0.95, 1.3);
    // 分段腹部甲壳（参考：segmented pale belly carapace）
    const bellySegs = [];
    for (let i = 0; i < 4; i++) {
      const b = new T.Mesh(new T.SphereGeometry(0.3 - i * 0.018, 8, 6), bellyM);
      b.position.set(0, 0.62 - i * 0.09, 0.34 - i * 0.28);
      b.scale.set(1, 0.55, 0.8);
      g.add(b); bellySegs.push(b);
    }
    // 背脊骨刺（参考：sharp dorsal spines along the back）
    const spines = [];
    for (let i = 0; i < 5; i++) {
      const sp = new T.Mesh(new T.ConeGeometry(0.075 - i * 0.008, 0.3 - i * 0.035, 4), spineM);
      sp.position.set(0, 1.26 - i * 0.055, 0.42 - i * 0.3);
      sp.rotation.x = -0.5 - i * 0.06;
      g.add(sp); spines.push(sp);
    }
    const neck = new T.Group();
    for (let i = 0; i < 4; i++) {
      const n = new T.Mesh(new T.SphereGeometry(0.24 - i * 0.033, 8, 6), bodyM);
      n.position.set(0, 0.1 + i * 0.18, 0.24 + i * 0.2);
      neck.add(n);
    }
    neck.position.y = 0.92;
    const headG = new T.Group();
    const head = new T.Mesh(new T.BoxGeometry(0.34, 0.28, 0.46), bodyM);
    const snout = new T.Mesh(new T.BoxGeometry(0.24, 0.16, 0.3), bodyM);
    snout.position.set(0, -0.04, 0.32);
    const jaw = new T.Mesh(new T.BoxGeometry(0.22, 0.08, 0.26), bellyM);
    jaw.position.set(0, -0.14, 0.3);
    const crest = new T.Mesh(new T.ConeGeometry(0.06, 0.34, 4), spineM);   // 头冠角鳍
    crest.position.set(0, 0.2, -0.08); crest.rotation.x = -0.7;
    const finL = new T.Mesh(new T.ConeGeometry(0.05, 0.22, 4), spineM);    // 头侧鳍
    finL.position.set(-0.19, 0.08, -0.05); finL.rotation.z = 1.15;
    const finR = finL.clone(); finR.position.x = 0.19; finR.rotation.z = -1.15;
    const eyeL = new T.Mesh(new T.SphereGeometry(0.05, 7, 6), eyeM);
    eyeL.position.set(-0.12, 0.06, 0.24);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
    const hornL = new T.Mesh(new T.ConeGeometry(0.055, 0.4, 5), hornM);
    hornL.position.set(-0.13, 0.18, -0.02); hornL.rotation.set(-0.5, 0, 0.35);
    const hornR = hornL.clone(); hornR.position.x = 0.13; hornR.rotation.z = -0.35;
    headG.add(head, snout, jaw, crest, finL, finR, eyeL, eyeR, hornL, hornR);
    headG.position.set(0, 0.55, 0.72);

    const tail = new T.Group();
    for (let i = 0; i < 4; i++) {
      const t = new T.Mesh(new T.ConeGeometry(0.16 - i * 0.035, 0.52 - i * 0.07, 6), bodyM);
      t.position.set(0, -0.04 - i * 0.05, -0.28 - i * 0.33);
      t.rotation.x = Math.PI / 2 - 0.1 + i * 0.06;
      tail.add(t);
    }
    const tailFin = new T.Mesh(new T.ConeGeometry(0.07, 0.24, 4), spineM);  // 尾尖骨刺
    tailFin.position.set(0, -0.2, -1.52); tailFin.rotation.x = -1.9;
    tail.add(tailFin);
    tail.position.set(0, 0.8, -0.5);

    const claws = [];
    const legs = [];
    [[-0.34, 0.34], [0.34, 0.34], [-0.32, -0.3], [0.32, -0.3]].forEach(p => {
      const l = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 0.5, 6), bodyM);
      l.position.set(p[0], 0.3, p[1]);
      const f = new T.Mesh(new T.BoxGeometry(0.2, 0.1, 0.24), hornM);
      f.position.set(p[0], 0.06, p[1] + 0.06);
      legs.push(l);
      g.add(l, f);
      // 三利爪（参考：three sharp claws）
      for (let c = -1; c <= 1; c++) {
        const claw = new T.Mesh(new T.ConeGeometry(0.032, 0.14, 5), hornM);
        claw.position.set(p[0] + c * 0.06, 0.045, p[1] + 0.2);
        claw.rotation.x = 1.5;
        claws.push(claw);
        g.add(claw);
      }
    });

    const wings = [];
    for (const sg of [-1, 1]) {
      const w = new T.Group();
      const shape = new T.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.6, 0.5); shape.lineTo(1.3, 0.42);
      shape.lineTo(1.02, 0.04); shape.lineTo(1.2, -0.16);
      shape.lineTo(0.5, -0.2); shape.lineTo(0.1, -0.06);
      shape.lineTo(0, 0);
      const mem = new T.Mesh(new T.ShapeGeometry(shape), wingM);
      mem.scale.x = sg;
      const bone = new T.Mesh(new T.CylinderGeometry(0.035, 0.05, 1.25, 5), hornM);
      bone.position.set(sg * 0.62, 0.34, 0.02); bone.rotation.z = sg * 1.1;
      w.add(mem, bone);
      w.position.set(sg * 0.3, 1.12, -0.06);
      w.rotation.z = sg * 0.2;
      w.userData.base = w.rotation.z;
      wings.push(w);
      g.add(w);
    }

    g.add(torso, neck, headG, tail);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(s * 0.92);
    g.userData = Object.assign(g.userData, { wings, kind: 'dragon' });
    return g;
  }

  function casterModel(color, lv) {
    const g = new T.Group();
    const robeM = bodyMat(color, { r: 0.74, m: 0.16 });
    const robe2M = bodyMat(shade(color, 0.7), { r: 0.72 });
    const trimM = std(shade(color, 1.75), { r: 0.3, m: 0.9 });
    const skinM = std(0xe8cba9, { r: 0.6 });
    const glowC = shade(color, 1.9);
    const glowM = std(glowC, { e: glowC, ei: 2.4, r: 0.2 });

    const robe = new T.Mesh(new T.ConeGeometry(0.52, 1.3, 10), robeM); robe.position.y = 0.65;
    const torso = new T.Mesh(new T.CylinderGeometry(0.25, 0.42, 0.6, 10), robe2M); torso.position.y = 1.3;
    const belt = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.08, 10), trimM); belt.position.y = 1.04;
    const neck = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.14, 8), skinM); neck.position.y = 1.64;
    const head = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), skinM); head.position.y = 1.82;
    const eyeL = new T.Mesh(new T.SphereGeometry(0.028, 6, 5), glowM); eyeL.position.set(-0.07, 1.84, 0.18);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.07;
    const hatB = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.05, 12), trimM); hatB.position.y = 1.98;
    const hat = new T.Mesh(new T.ConeGeometry(0.33, 0.7, 10), bodyMat(shade(color, 0.45))); hat.position.set(0, 2.32, -0.02); hat.rotation.x = -0.18;
    const gem = new T.Mesh(new T.OctahedronGeometry(0.08), glowM); gem.position.set(0, 2.06, 0.3);

    const staff = new T.Group();
    const shaft = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 2.0, 8), trimM); shaft.position.y = 1.0;
    const orb = new T.Mesh(new T.IcosahedronGeometry(0.14, 1), glowM); orb.position.y = 2.1;
    const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.02, 5, 14), trimM); ring.position.y = 2.1;
    staff.add(shaft, orb, ring);
    staff.position.set(0.52, 0, 0.08); staff.rotation.z = -0.12;

    // 环绕符文
    const runes = [];
    for (let i = 0; i < 5; i++) {
      const r = new T.Mesh(new T.TetrahedronGeometry(0.055), glowM);
      r.position.set(Math.cos(i / 5 * TAU) * 0.6, 1.1 + Math.sin(i) * 0.3, Math.sin(i / 5 * TAU) * 0.6);
      g.add(r); runes.push(r);
    }

    g.add(robe, torso, belt, neck, head, eyeL, eyeR, hatB, hat, gem, staff);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.9 + lv * 0.03);
    g.userData = Object.assign(g.userData, { orb, ring, runes, kind: 'caster' });
    return g;
  }

  function warriorModel(color, lv) {
    const g = new T.Group();
    const armorM = bodyMat(color, { m: 0.55, r: 0.42 });
    const darkM = bodyMat(shade(color, 0.55), { m: 0.5, r: 0.5 });
    const goldM = std(shade(color, 1.8), { r: 0.3, m: 0.95 });
    const skinM = std(0xe0bd97, { r: 0.6 });
    const eyeM = std(0x8ef0ff, { e: 0x3fd8ff, ei: 2.4, r: 0.2 });

    const legs = [];
    for (const s of [-1, 1]) {
      const l = new T.Mesh(new T.CylinderGeometry(0.105, 0.09, 0.62, 7), darkM);
      l.position.set(s * 0.15, 0.33, 0);
      const boot = new T.Mesh(new T.BoxGeometry(0.2, 0.12, 0.28), armorM);
      boot.position.set(s * 0.15, 0.06, 0.04);
      legs.push(l); g.add(l, boot);
    }
    const torso = new T.Mesh(new T.CylinderGeometry(0.27, 0.22, 0.62, 9), armorM);
    torso.position.y = 0.98;
    const plat = new T.Mesh(new T.BoxGeometry(0.5, 0.24, 0.34), darkM); plat.position.y = 0.78;
    const head = new T.Mesh(new T.SphereGeometry(0.19, 10, 8), skinM); head.position.y = 1.5;
    const helm = new T.Mesh(new T.SphereGeometry(0.235, 12, 8, 0, TAU, 0, Math.PI * 0.62), armorM);
    helm.position.y = 1.52;
    const crest = new T.Mesh(new T.ConeGeometry(0.05, 0.34, 5), goldM);
    crest.position.set(0, 1.76, -0.02);
    const eyeL = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), eyeM); eyeL.position.set(-0.07, 1.5, 0.17);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.07;

    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new T.Group();
      const up = new T.Mesh(new T.CylinderGeometry(0.07, 0.062, 0.34, 7), armorM); up.position.y = -0.17;
      const pad = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), darkM); pad.position.y = 0.02; pad.scale.set(1, 0.85, 1);
      const hand = new T.Mesh(new T.SphereGeometry(0.06, 6, 5), skinM); hand.position.y = -0.4;
      arm.add(up, pad, hand);
      arm.position.set(s * 0.28, 1.22, 0);
      arm.rotation.z = s * 0.1;
      g.add(arm); arms.push(arm);
    }
    // 剑
    const sword = new T.Group();
    const blade = new T.Mesh(new T.BoxGeometry(0.09, 0.95, 0.03), std(0xd8e4f0, { m: 0.95, r: 0.16 }));
    blade.position.y = 0.62;
    const guard = new T.Mesh(new T.BoxGeometry(0.34, 0.06, 0.09), goldM);
    const grip = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.22, 6), darkM); grip.position.y = -0.16;
    const pommel = new T.Mesh(new T.SphereGeometry(0.05, 6, 5), goldM); pommel.position.y = -0.3;
    sword.add(blade, guard, grip, pommel);
    sword.position.set(0.42, 0.85, 0.08); sword.rotation.z = -0.22;
    // 盾
    const shield = new T.Group();
    const sh = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.07, 6), armorM); sh.rotation.x = Math.PI / 2;
    const boss = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), goldM); boss.position.z = 0.06;
    shield.add(sh, boss);
    shield.position.set(-0.42, 0.95, 0.14); shield.rotation.y = 0.2;

    g.add(torso, plat, head, helm, crest, eyeL, eyeR, sword, shield);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.88 + lv * 0.028);
    g.userData = Object.assign(g.userData, { arms, sword, kind: 'warrior' });
    return g;
  }

  function fiendModel(color, lv) {
    const g = new T.Group();
    const bodyM = bodyMat(color, { m: 0.28, r: 0.66 });
    const darkM = bodyMat(shade(color, 0.55), { r: 0.7 });
    const hornM = std(shade(color, 1.7), { r: 0.4, m: 0.5 });
    const eyeM = std(0xff4d4d, { e: 0xff2222, ei: 3 });

    const torso = new T.Mesh(new T.SphereGeometry(0.4, 10, 8), bodyM);
    torso.position.y = 0.98; torso.scale.set(1, 1.1, 0.82);
    const abs = new T.Mesh(new T.SphereGeometry(0.26, 8, 6), shade(color, 1.3) && std(shade(color, 1.3), { r: 0.7 }));
    abs.position.set(0, 0.78, 0.16);
    const head = new T.Mesh(new T.SphereGeometry(0.24, 10, 8), bodyM); head.position.y = 1.5;
    const jaw = new T.Mesh(new T.ConeGeometry(0.15, 0.22, 6), darkM); jaw.position.set(0, 1.36, 0.16); jaw.rotation.x = 2.9;
    for (const s of [-1, 1]) {
      const horn = new T.Mesh(new T.ConeGeometry(0.06, 0.36, 5), hornM);
      horn.position.set(s * 0.14, 1.68, -0.02); horn.rotation.set(-0.2, 0, s * 0.5);
      g.add(horn);
      const eye = new T.Mesh(new T.SphereGeometry(0.035, 6, 5), eyeM);
      eye.position.set(s * 0.09, 1.53, 0.2);
      g.add(eye);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const l = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 0.62, 6), bodyM);
      l.position.set(s * 0.17, 0.34, 0);
      const foot = new T.Mesh(new T.BoxGeometry(0.22, 0.1, 0.3), hornM);
      foot.position.set(s * 0.17, 0.06, 0.08);
      legs.push(l); g.add(l, foot);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new T.Group();
      const up = new T.Mesh(new T.CylinderGeometry(0.075, 0.07, 0.42, 6), bodyM); up.position.y = -0.2;
      const claw = new T.Mesh(new T.ConeGeometry(0.07, 0.2, 5), hornM); claw.position.y = -0.48;
      arm.add(up, claw);
      arm.position.set(s * 0.34, 1.2, 0); arm.rotation.z = s * 0.3;
      g.add(arm); arms.push(arm);
    }
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Group();
      const mem = new T.Mesh(new T.ConeGeometry(0.4, 0.9, 4, 1, true), std(shade(color, 0.5), { ds: true, t: true, op: 0.88 }));
      mem.rotation.z = Math.PI / 2; mem.scale.set(1, 1, 0.4);
      const bone = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.9, 5), hornM);
      bone.position.set(s * 0.4, 0.24, 0); bone.rotation.z = s * 1.2;
      w.add(mem, bone);
      w.position.set(s * 0.26, 1.16, -0.14);
      w.rotation.z = s * 0.3;
      w.userData.base = w.rotation.z;
      wings.push(w); g.add(w);
    }
    g.add(torso, abs, head, jaw);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.9 + lv * 0.03);
    g.userData = Object.assign(g.userData, { wings, arms, kind: 'fiend' });
    return g;
  }

  function machineModel(color, lv) {
    const g = new T.Group();
    const metalM = bodyMat(color, { m: 0.82, r: 0.34 });
    const darkM = bodyMat(shade(color, 0.5), { m: 0.75, r: 0.4 });
    const glowM = std(shade(color, 1.9), { e: shade(color, 1.6), ei: 2.6, r: 0.2 });

    const core = new T.Mesh(new T.BoxGeometry(0.56, 0.56, 0.5), metalM);
    core.position.y = 1.0;
    const headG = new T.Mesh(new T.BoxGeometry(0.36, 0.3, 0.4), darkM); headG.position.y = 1.45;
    const eye = new T.Mesh(new T.BoxGeometry(0.26, 0.07, 0.03), glowM); eye.position.set(0, 1.46, 0.21);
    const chest = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.06, 12), glowM);
    chest.rotation.x = Math.PI / 2; chest.position.set(0, 1.02, 0.26);
    const ventL = new T.Mesh(new T.BoxGeometry(0.1, 0.34, 0.06), darkM);
    ventL.position.set(-0.22, 1.0, 0.24);
    const ventR = ventL.clone(); ventR.position.x = 0.22;
    const legs = [];
    for (const s of [-1, 1]) {
      const l = new T.Mesh(new T.BoxGeometry(0.2, 0.56, 0.22), metalM);
      l.position.set(s * 0.2, 0.44, 0);
      const foot = new T.Mesh(new T.BoxGeometry(0.28, 0.12, 0.36), darkM);
      foot.position.set(s * 0.2, 0.08, 0.04);
      legs.push(l); g.add(l, foot);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new T.Group();
      const up = new T.Mesh(new T.BoxGeometry(0.16, 0.4, 0.18), metalM); up.position.y = -0.2;
      const cannon = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.34, 8), darkM);
      cannon.position.y = -0.44;
      const muzzle = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.04, 8), glowM);
      muzzle.position.y = -0.62;
      arm.add(up, cannon, muzzle);
      arm.position.set(s * 0.36, 1.24, 0);
      g.add(arm); arms.push(arm);
      // 肩炮
      const shoulder = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.34), darkM);
      shoulder.position.set(s * 0.36, 1.36, -0.1);
      g.add(shoulder);
    }
    g.add(core, headG, eye, chest, ventL, ventR);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.9 + lv * 0.028);
    g.userData = Object.assign(g.userData, { arms, eye, chest, kind: 'machine' });
    return g;
  }

  function beastModel(color, lv) {
    const g = new T.Group();
    const furM = bodyMat(color, { r: 0.82, m: 0.06 });
    const darkM = bodyMat(shade(color, 0.6), { r: 0.85 });
    const clawM = std(shade(color, 1.8), { r: 0.4, m: 0.5 });
    const eyeM = std(0xffd166, { e: 0xff9d00, ei: 2.8 });

    const body = new T.Mesh(new T.SphereGeometry(0.42, 10, 8), furM);
    body.position.y = 0.82; body.scale.set(1, 0.92, 1.5);
    const chest = new T.Mesh(new T.SphereGeometry(0.34, 8, 6), darkM);
    chest.position.set(0, 0.78, 0.32);
    const head = new T.Mesh(new T.SphereGeometry(0.26, 10, 8), furM);
    head.position.set(0, 1.02, 0.72);
    const snout = new T.Mesh(new T.BoxGeometry(0.2, 0.16, 0.24), darkM);
    snout.position.set(0, 0.96, 0.94);
    const earL = new T.Mesh(new T.ConeGeometry(0.07, 0.2, 5), furM);
    earL.position.set(-0.15, 1.24, 0.66);
    const earR = earL.clone(); earR.position.x = 0.15;
    const eyeL = new T.Mesh(new T.SphereGeometry(0.04, 6, 5), eyeM); eyeL.position.set(-0.1, 1.06, 0.94);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.1;
    const tail = new T.Mesh(new T.ConeGeometry(0.1, 0.7, 6), furM);
    tail.position.set(0, 1.0, -0.72); tail.rotation.x = -0.9;
    const legs = [];
    [[-0.28, 0.36], [0.28, 0.36], [-0.26, -0.36], [0.26, -0.36]].forEach(p => {
      const l = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.6, 6), furM);
      l.position.set(p[0], 0.32, p[1]);
      const paw = new T.Mesh(new T.SphereGeometry(0.11, 6, 5), darkM);
      paw.position.set(p[0], 0.06, p[1] + 0.06);
      legs.push(l); g.add(l, paw);
    });
    // 背刺
    for (let i = 0; i < 3; i++) {
      const sp = new T.Mesh(new T.ConeGeometry(0.06, 0.22, 5), clawM);
      sp.position.set(0, 1.2 - i * 0.04, 0.16 - i * 0.3);
      sp.rotation.x = -0.4;
      g.add(sp);
    }
    g.add(body, chest, head, snout, earL, earR, eyeL, eyeR, tail);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.9 + lv * 0.028);
    g.userData = Object.assign(g.userData, { legs, tail, kind: 'beast' });
    return g;
  }

  function rockModel(color, lv) {
    const g = new T.Group();
    const rockM = bodyMat(color, { r: 0.95, m: 0.08 });
    const darkM = bodyMat(shade(color, 0.65), { r: 0.95 });
    const eyeM = std(0xffb347, { e: 0xff8c00, ei: 2.4 });
    const torso = new T.Mesh(new T.DodecahedronGeometry(0.46, 0), rockM);
    torso.position.y = 0.86; torso.scale.set(1.1, 1.0, 0.9);
    const head = new T.Mesh(new T.DodecahedronGeometry(0.26, 0), rockM);
    head.position.y = 1.38;
    const eyeL = new T.Mesh(new T.SphereGeometry(0.045, 6, 5), eyeM); eyeL.position.set(-0.09, 1.42, 0.2);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.09;
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new T.Group();
      const a = new T.Mesh(new T.DodecahedronGeometry(0.2, 0), rockM);
      const b = new T.Mesh(new T.DodecahedronGeometry(0.16, 0), darkM); b.position.y = -0.28;
      arm.add(a, b);
      arm.position.set(s * 0.44, 1.06, 0);
      g.add(arm); arms.push(arm);
    }
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.26, 0.5, 0.3), darkM);
      leg.position.set(s * 0.2, 0.26, 0);
      g.add(leg);
    }
    g.add(torso, head, eyeL, eyeR);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.88 + lv * 0.03);
    g.userData = Object.assign(g.userData, { arms, kind: 'rock' });
    return g;
  }

  function aquaModel(color, lv) {
    const g = new T.Group();
    const bodyM = bodyMat(color, { r: 0.32, m: 0.35, t: true, op: 0.94 });
    const finM = std(shade(color, 1.6), { r: 0.4, m: 0.2, t: true, op: 0.9, ds: true });
    const eyeM = std(0xffffff, { e: 0x9ff0ff, ei: 2.2 });
    const body = new T.Mesh(new T.SphereGeometry(0.4, 10, 8), bodyM);
    body.position.y = 0.96; body.scale.set(0.9, 1.0, 1.7);
    const head = new T.Mesh(new T.SphereGeometry(0.28, 10, 8), bodyM);
    head.position.set(0, 1.24, 0.5); head.scale.set(0.95, 0.95, 1.2);
    const eyeL = new T.Mesh(new T.SphereGeometry(0.05, 7, 6), eyeM); eyeL.position.set(-0.14, 1.3, 0.7);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.14;
    const tail = new T.Mesh(new T.ConeGeometry(0.34, 0.9, 6), bodyM);
    tail.position.set(0, 0.9, -0.8); tail.rotation.x = -Math.PI / 2 + 0.3;
    const fins = [];
    for (const s of [-1, 1]) {
      const f = new T.Mesh(new T.ConeGeometry(0.3, 0.6, 3), finM);
      f.position.set(s * 0.42, 0.92, 0);
      f.rotation.set(0, 0, s * 1.1); f.scale.z = 0.35;
      fins.push(f); g.add(f);
    }
    const topFin = new T.Mesh(new T.ConeGeometry(0.22, 0.5, 3), finM);
    topFin.position.set(0, 1.5, -0.04); topFin.scale.z = 0.35;
    g.add(body, head, eyeL, eyeR, tail, topFin);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.92 + lv * 0.028);
    g.userData = Object.assign(g.userData, { fins, tail, kind: 'aqua' });
    return g;
  }

  function insectModel(color, lv) {
    const g = new T.Group();
    const chitinM = bodyMat(color, { m: 0.5, r: 0.4 });
    const darkM = bodyMat(shade(color, 0.55), { m: 0.45, r: 0.45 });
    const eyeM = std(0xff5a5a, { e: 0xff2222, ei: 2.6 });
    const thorax = new T.Mesh(new T.SphereGeometry(0.3, 9, 7), chitinM);
    thorax.position.y = 0.9;
    const abdomen = new T.Mesh(new T.SphereGeometry(0.34, 9, 7), chitinM);
    abdomen.position.set(0, 0.82, -0.56); abdomen.scale.set(1, 0.9, 1.4);
    const head = new T.Mesh(new T.SphereGeometry(0.22, 9, 7), darkM);
    head.position.set(0, 0.98, 0.42);
    const eyeL = new T.Mesh(new T.SphereGeometry(0.07, 7, 6), eyeM); eyeL.position.set(-0.1, 1.02, 0.56);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.1;
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = new T.Mesh(new T.CylinderGeometry(0.028, 0.022, 0.5, 5), darkM);
        l.position.set(s * 0.26, 0.62, 0.24 - i * 0.28);
        l.rotation.z = s * 1.0; l.rotation.x = -0.3 + i * 0.3;
        legs.push(l); g.add(l);
      }
      const ant = new T.Mesh(new T.CylinderGeometry(0.016, 0.012, 0.42, 4), darkM);
      ant.position.set(s * 0.1, 1.2, 0.52);
      ant.rotation.set(0.5, 0, s * 0.35);
      g.add(ant);
    }
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CircleGeometry(0.4, 12), std(shade(color, 1.9), { t: true, op: 0.4, ds: true, e: shade(color, 1.4), ei: 0.6 }));
      w.position.set(s * 0.26, 1.14, -0.14);
      w.rotation.set(-1.1, s * 0.4, s * 0.3);
      wings.push(w); g.add(w);
    }
    g.add(thorax, abdomen, head, eyeL, eyeR);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.9 + lv * 0.028);
    g.userData = Object.assign(g.userData, { wings, legs, kind: 'insect' });
    return g;
  }

  function genericModel(color, lv) {
    const g = new T.Group();
    const m1 = bodyMat(color, { m: 0.3 });
    const m2 = bodyMat(shade(color, 0.6));
    const glowM = std(shade(color, 1.9), { e: shade(color, 1.5), ei: 2.2 });
    const core = new T.Mesh(new T.IcosahedronGeometry(0.34, 1), m1);
    core.position.y = 1.0;
    const ring = new T.Mesh(new T.TorusGeometry(0.5, 0.035, 6, 24), m2);
    ring.position.y = 1.0; ring.rotation.x = 0.4;
    const eye = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), glowM);
    eye.position.set(0, 1.0, 0.3);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU;
      const spike = new T.Mesh(new T.ConeGeometry(0.09, 0.34, 5), m2);
      spike.position.set(Math.cos(a) * 0.28, 1.34 + Math.sin(i) * 0.06, Math.sin(a) * 0.28);
      spike.rotation.z = Math.cos(a) * 0.5;
      g.add(spike);
    }
    g.add(core, ring, eye);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.85 + lv * 0.03);
    g.userData = Object.assign(g.userData, { core, ring, eye, kind: 'generic' });
    return g;
  }

  function pickModel(rec, color) {
    const race = (rec && rec.race) || '';
    const kind = (rec && rec.kind) || '';
    const lv = Math.min(12, (rec && rec.level) || 4);
    if (kind === 'spell' || kind === 'trap') return casterModel(color, lv);
    if (/Dragon/i.test(race)) return dragonModel(color, lv);
    if (/Spellcaster/i.test(race)) return casterModel(color, lv);
    if (/Warrior/i.test(race)) return warriorModel(color, lv);
    if (/Fiend|Illusion/i.test(race)) return fiendModel(color, lv);
    if (/Machine|Cyberse/i.test(race)) return machineModel(color, lv);
    if (/Rock|Wyrm/i.test(race)) return rockModel(color, lv);
    if (/Beast|Beast-Warrior|Dinosaur/i.test(race)) return beastModel(color, lv);
    if (/Fish|Sea Serpent|Aqua|Reptile/i.test(race)) return aquaModel(color, lv);
    if (/Insect|Plant/i.test(race)) return insectModel(color, lv);
    if (/Zombie/i.test(race)) return fiendModel(shade(color, 0.8), lv);
    if (/Thunder|Pyro/i.test(race)) return genericModel(color, lv);
    if (/Winged/i.test(race)) return dragonModel(color, lv - 1);
    return genericModel(color, lv);
  }

  /* ===========================================================
   *  卡面原画定制精细建模（按卡 ID 绑定）
   *  - FINE 表：核心怪兽逐只独立建模，配色取自卡面原画
   *  - vary()  ：其余怪兽按 ID 确定性生成专属装饰，一卡一模
   *  =========================================================== */
  function hashSeed(id) {
    let h = 2166136261;
    const s = String(id);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mat(color, o) { return std(color, Object.assign({ r: 0.6, m: 0.2 }, o || {})); }
  function glowM(color, ei) { return std(color, { e: color, ei: ei === undefined ? 2.4 : ei, r: 0.3 }); }
  function put(g, mesh, x, y, z, rx, ry, rz) {
    mesh.position.set(x || 0, y || 0, z || 0);
    if (rx) mesh.rotation.x = rx; if (ry) mesh.rotation.y = ry; if (rz) mesh.rotation.z = rz;
    g.add(mesh); return mesh;
  }

  /* ---- 库里波 40640057 ---- */
  function kuribohModel() {
    const g = new T.Group();
    const furM = std(0x7a4a22, { r: 0.96, m: 0 });
    const darkM = std(0x14100c, { r: 0.4 });
    const wingM = std(0x8fae3a, { r: 0.7, ds: true, t: true, op: 0.95 });
    const body = new T.Mesh(new T.IcosahedronGeometry(0.52, 1), furM);
    body.position.y = 0.52;
    g.add(body);
    for (let i = 0; i < 30; i++) {
      const a = i * 2.399, ph = 0.5 + (i % 4) * 0.55;
      const dir = new T.Vector3(Math.cos(a) * Math.sin(ph), Math.cos(ph) + 0.25, Math.sin(a) * Math.sin(ph)).normalize();
      const sp = new T.Mesh(new T.ConeGeometry(0.05, 0.16, 4), furM);
      sp.position.copy(dir).multiplyScalar(0.52); sp.position.y += 0.52;
      sp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      g.add(sp);
    }
    for (const s of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.13, 8, 7), std(0xffffff, { r: 0.3 }));
      e.position.set(s * 0.19, 0.62, 0.44); e.scale.z = 0.55;
      const p = new T.Mesh(new T.SphereGeometry(0.062, 7, 6), darkM);
      p.position.set(s * 0.19, 0.62, 0.51);
      g.add(e, p);
    }
    put(g, new T.Mesh(new T.BoxGeometry(0.1, 0.035, 0.04), darkM), 0, 0.4, 0.5);
    for (const s of [-1, 1]) {
      put(g, new T.Mesh(new T.ConeGeometry(0.06, 0.24, 5), furM), s * 0.42, 0.32, 0.26, 0, 0, s * -1.3);
    }
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CircleGeometry(0.26, 8), wingM);
      w.userData.base = s * 0.5;
      w.position.set(s * 0.42, 0.8, -0.2);
      w.rotation.set(-0.35, s * 1.4, s * 0.4);
      wings.push(w); g.add(w);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { wings, kind: 'kuriboh' });
    g.scale.setScalar(0.98);
    return g;
  }

  /* ---- 黑魔导 46986414 / 黑魔导女孩 38033121 ---- */
  function darkMagicianModel(o) {
    o = o || {};
    const girl = !!o.girl;
    const g = new T.Group();
    const robeC = girl ? 0x4a7de0 : 0x5b2fa8;
    const robeM = mat(robeC, { r: 0.66 });
    const robe2M = mat(shade(robeC, 0.72), { r: 0.7 });
    const armM = mat(girl ? 0xe8ecf2 : 0x283a72, { r: 0.5, m: 0.35 });
    const trimM = mat(0xd8b45c, { r: 0.35, m: 0.8 });
    const skinM = mat(0xf0cfae, { r: 0.8 });
    const hairM = mat(girl ? 0xe8c85a : 0x1c1430, { r: 0.55 });
    const skirt = new T.Mesh(new T.ConeGeometry(0.46, 1.0, 10), robeM);
    put(g, skirt, 0, 0.5, 0);
    put(g, new T.Mesh(new T.CylinderGeometry(0.48, 0.52, 0.1, 10), robe2M), 0, 0.08, 0);
    const belt = new T.Mesh(new T.TorusGeometry(0.26, 0.04, 6, 14), trimM);
    put(g, belt, 0, 1.02, 0, Math.PI / 2);
    put(g, new T.Mesh(new T.CylinderGeometry(0.23, 0.29, 0.5, 9), robeM), 0, 1.24, 0);
    put(g, new T.Mesh(new T.BoxGeometry(0.32, 0.32, 0.2), armM), 0, 1.38, 0.03);
    if (girl) put(g, new T.Mesh(new T.BoxGeometry(0.34, 0.14, 0.22), mat(0xf0a8c8, { r: 0.6 })), 0, 1.16, 0.04);
    const arms = [];
    for (const s of [-1, 1]) {
      const p = new T.Mesh(new T.SphereGeometry(0.17, 8, 6), armM);
      put(g, p, s * 0.31, 1.54, 0, 0, 0, 0); p.scale.y = 0.75;
      const armG = new T.Group(); armG.position.set(s * 0.36, 1.48, 0.02);
      const arm = new T.Mesh(new T.CylinderGeometry(0.075, 0.065, 0.52, 7), robeM);
      arm.position.y = -0.26;
      const glove = new T.Mesh(new T.SphereGeometry(0.08, 7, 6), armM);
      glove.position.y = -0.54;
      armG.add(arm, glove); armG.rotation.z = s * 0.22;
      g.add(armG); arms.push(armG);
    }
    const head = new T.Mesh(new T.SphereGeometry(0.19, 9, 8), skinM);
    head.scale.y = 1.05;
    put(g, head, 0, 1.7, 0.01);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.035, 6, 5), glowM(girl ? 0x3fae6a : 0x8a5cf0, 2.0));
      put(g, eye, s * 0.08, 1.73, 0.17);
    }
    if (!girl) {
      const hat = new T.Group();
      hat.add(new T.Mesh(new T.CylinderGeometry(0.35, 0.4, 0.06, 10), robeM));
      const top = new T.Mesh(new T.ConeGeometry(0.23, 0.52, 10), robeM); top.position.y = 0.28;
      const band = new T.Mesh(new T.CylinderGeometry(0.24, 0.26, 0.08, 10), armM); band.position.y = 0.05;
      hat.add(top, band);
      hat.position.set(0, 1.84, 0); hat.rotation.z = 0.1;
      g.add(hat);
      g.userData.hat = hat;
    } else {
      const hair = new T.Mesh(new T.SphereGeometry(0.21, 9, 7), hairM);
      hair.position.set(0, 1.78, -0.04); hair.scale.set(1, 0.9, 1);
      g.add(hair);
      for (const s of [-1, 1]) {
        const bun = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), hairM);
        bun.position.set(s * 0.22, 1.72, -0.1);
        g.add(bun);
      }
    }
    const staff = new T.Group();
    const shaft = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1.55, 6), mat(0x6b4a2a, { r: 0.7 }));
    shaft.position.y = 0.78;
    const orb = new T.Mesh(new T.IcosahedronGeometry(0.13, 1), glowM(0x62e0b0, 2.8));
    orb.position.y = 1.6;
    const claw = new T.Mesh(new T.TorusGeometry(0.15, 0.025, 6, 12), trimM);
    claw.position.y = 1.6; claw.rotation.x = 0.5;
    staff.add(shaft, orb, claw);
    staff.position.set(0.42, 0.05, 0.1);
    staff.rotation.z = -0.12;
    g.add(staff);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, staff, orb, kind: 'darkmagician' });
    return g;
  }

  /* ---- 青眼白龙 89631139 / 真红眼黑龙 74677422 ---- */
  function aceDragonModel(o) {
    const g = new T.Group();
    const bodyM = mat(o.body, { r: 0.5, m: 0.25 });
    const bellyM = mat(o.belly, { r: 0.6 });
    const hornM = mat(o.horn, { r: 0.35, m: 0.6 });
    const eyeM = glowM(o.eye, 3.0);
    const wingM = mat(o.wing, { r: 0.75, ds: true });
    const torso = new T.Mesh(new T.SphereGeometry(0.48, 10, 8), bodyM);
    torso.position.y = 0.92; torso.scale.set(0.9, 0.95, 1.45);
    g.add(torso);
    put(g, new T.Mesh(new T.SphereGeometry(0.3, 8, 6), bellyM), 0, 0.84, 0.34);
    // 修长脖颈
    const neck = new T.Group();
    for (let i = 0; i < 4; i++) {
      const n = new T.Mesh(new T.SphereGeometry(0.2 - i * 0.02, 8, 6), bodyM);
      n.position.set(0, 0.16 + i * 0.22, 0.3 + i * 0.16);
      neck.add(n);
    }
    neck.position.y = 1.0;
    g.add(neck);
    g.userData.neck = neck;
    // 头：窄长吻 + 双角
    const headG = new T.Group();
    headG.add(new T.Mesh(new T.BoxGeometry(0.3, 0.26, 0.44), bodyM));
    const snout = new T.Mesh(new T.BoxGeometry(0.2, 0.14, 0.34), bodyM);
    put(headG, snout, 0, -0.05, 0.34);
    const jaw = new T.Mesh(new T.BoxGeometry(0.18, 0.07, 0.3), bellyM);
    put(headG, jaw, 0, -0.15, 0.3);
    headG.userData = {}; headG.children.forEach(c => { });
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.05, 7, 6), eyeM);
      put(headG, eye, s * 0.11, 0.07, 0.22);
      const horn = new T.Mesh(new T.ConeGeometry(0.05, 0.42, 5), hornM);
      put(headG, horn, s * 0.1, 0.24, -0.06, -0.6, 0, s * 0.3);
    }
    headG.position.set(0, 0.62, 0.86);
    neck.add(headG);
    g.userData.headG = headG;
    // 宽大双翼（指骨 + 膜）
    const wings = [];
    for (const s of [-1, 1]) {
      const wg = new T.Group();
      for (let f = 0; f < 3; f++) {
        const bone = new T.Mesh(new T.CylinderGeometry(0.03, 0.02, 1.0 - f * 0.18, 5), hornM);
        bone.position.set(s * (0.45 + f * 0.02), 0.32 - f * 0.08, -f * 0.16);
        bone.rotation.z = s * (0.55 + f * 0.16);
        wg.add(bone);
      }
      const memb = new T.Mesh(new T.CircleGeometry(0.95, 3), wingM);
      memb.position.set(s * 0.62, 0.18, -0.14);
      memb.rotation.set(0, s * -0.5, s * -0.9);
      memb.scale.set(1.1, 0.72, 1);
      wg.add(memb);
      wg.position.set(s * 0.32, 1.16, -0.12);
      wg.rotation.y = s * -0.25;
      g.add(wg); wings.push(wg);
    }
    g.userData.wings = wings;
    // 长尾
    const tail = new T.Group();
    for (let i = 0; i < 4; i++) {
      const t = new T.Mesh(new T.ConeGeometry(0.15 - i * 0.03, 0.55 - i * 0.06, 6), bodyM);
      t.position.set(0, 0, -0.24 - i * 0.36);
      t.rotation.x = Math.PI / 2 - 0.08;
      tail.add(t);
    }
    tail.position.set(0, 0.9, -0.6);
    g.add(tail);
    g.userData.tailG = tail;
    // 后腿
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.13, 0.11, 0.5, 7), bodyM);
      put(g, leg, s * 0.3, 0.34, -0.18);
      const foot = new T.Mesh(new T.BoxGeometry(0.2, 0.1, 0.32), bodyM);
      put(g, foot, s * 0.3, 0.08, -0.06);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { kind: 'acedragon' });
    g.scale.setScalar(1.02);
    return g;
  }
  const BLUE_EYES = { body: 0xf2f4f8, belly: 0xd8e2ee, horn: 0xe8ecf2, eye: 0x38bdf8, wing: 0xdfe6f0 };
  const RED_EYES = { body: 0x241a1e, belly: 0x4a2020, horn: 0x8a6a4a, eye: 0xff3b30, wing: 0x5a1a1a };

  /* ---- 恶魔的召唤 70781052 ---- */
  function summonedSkullModel() {
    const g = new T.Group();
    const boneM = mat(0xe8e0d0, { r: 0.7 });
    const darkM = mat(0x2a2438, { r: 0.75 });
    const eyeM = glowM(0xfff2c0, 3.0);
    const torso = new T.Mesh(new T.CylinderGeometry(0.26, 0.34, 0.72, 8), darkM);
    put(g, torso, 0, 1.06, 0);
    // 肋骨纹
    for (let i = 0; i < 3; i++) {
      const rib = new T.Mesh(new T.TorusGeometry(0.26 - i * 0.02, 0.025, 5, 12), boneM);
      put(g, rib, 0, 1.24 - i * 0.16, 0, Math.PI / 2);
    }
    // 骷髅头
    const headG = new T.Group();
    const skull = new T.Mesh(new T.SphereGeometry(0.22, 9, 8), boneM);
    skull.scale.set(1, 1.1, 0.9);
    const jaw = new T.Mesh(new T.BoxGeometry(0.24, 0.1, 0.22), boneM);
    put(headG, jaw, 0, -0.18, 0.08);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.06, 7, 6), eyeM);
      put(headG, eye, s * 0.09, 0.02, 0.18);
      const horn = new T.Mesh(new T.ConeGeometry(0.05, 0.3, 5), boneM);
      put(headG, horn, s * 0.12, 0.26, 0, -0.3, 0, s * 0.9);
    }
    headG.add(skull);
    headG.position.set(0, 1.66, 0.02);
    g.add(headG);
    g.userData.headG = headG;
    // 长爪双臂
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      armG.position.set(s * 0.34, 1.4, 0.02);
      const up = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.55, 6), darkM);
      up.position.y = -0.28;
      const fore = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, 0.5, 6), darkM);
      fore.position.set(0, -0.75, 0.1); fore.rotation.x = 0.35;
      armG.add(up, fore);
      for (let f = 0; f < 3; f++) {
        const claw = new T.Mesh(new T.ConeGeometry(0.025, 0.18, 4), boneM);
        claw.position.set((f - 1) * 0.05, -1.05, 0.2 + f * 0.02);
        claw.rotation.x = Math.PI * 0.95;
        armG.add(claw);
      }
      armG.rotation.z = s * 0.5;
      g.add(armG); arms.push(armG);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.09, 0.07, 0.66, 6), darkM);
      put(g, leg, s * 0.16, 0.33, 0);
      const hoof = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.24), boneM);
      put(g, hoof, s * 0.16, 0.05, 0.04);
      legs.push(leg);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, kind: 'skull' });
    return g;
  }

  /* ---- 岩石巨兵 13039848 ---- */
  function rockGiantModel() {
    const g = new T.Group();
    const stoneM = mat(0x8a8478, { r: 0.95, m: 0.02 });
    const stone2M = mat(0x6e685e, { r: 0.95, m: 0.02 });
    const eyeM = glowM(0xff8a3a, 2.8);
    const torso = new T.Mesh(new T.BoxGeometry(0.66, 0.72, 0.44), stoneM);
    put(g, torso, 0, 1.06, 0);
    const hips = new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.38), stone2M);
    put(g, hips, 0, 0.6, 0);
    for (const s of [-1, 1]) {
      const pad = new T.Mesh(new T.BoxGeometry(0.26, 0.2, 0.3), stone2M);
      put(g, pad, s * 0.44, 1.34, 0);
    }
    const head = new T.Mesh(new T.BoxGeometry(0.3, 0.26, 0.28), stoneM);
    put(g, head, 0, 1.62, 0.02);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.045, 6, 5), eyeM);
      put(g, eye, s * 0.08, 1.64, 0.16);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      armG.position.set(s * 0.5, 1.3, 0);
      const up = new T.Mesh(new T.CylinderGeometry(0.12, 0.1, 0.5, 6), stoneM);
      up.position.y = -0.25;
      const fist = new T.Mesh(new T.BoxGeometry(0.26, 0.26, 0.26), stone2M);
      fist.position.y = -0.62;
      armG.add(up, fist);
      armG.rotation.z = s * 0.16;
      g.add(armG); arms.push(armG);
      const leg = new T.Mesh(new T.CylinderGeometry(0.13, 0.12, 0.5, 6), stoneM);
      put(g, leg, s * 0.19, 0.25, 0);
      const foot = new T.Mesh(new T.BoxGeometry(0.24, 0.12, 0.34), stone2M);
      put(g, foot, s * 0.19, 0.06, 0.05);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, kind: 'rockgiant' });
    return g;
  }

  /* ---- 精灵剑士 91152256 ---- */
  function celticModel() {
    const g = new T.Group();
    const tunM = mat(0x2c5c38, { r: 0.7 });
    const armM = mat(0x3f7a4a, { r: 0.55, m: 0.3 });
    const skinM = mat(0xf0cfae, { r: 0.8 });
    const hairM = mat(0xd8b25c, { r: 0.55 });
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.09, 0.08, 0.6, 7), mat(0x24402a, { r: 0.75 }));
      put(g, leg, s * 0.14, 0.3, 0);
      const boot = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.26), mat(0x4a3320, { r: 0.8 }));
      put(g, boot, s * 0.14, 0.05, 0.04);
      legs.push(leg);
    }
    const torso = new T.Mesh(new T.CylinderGeometry(0.22, 0.26, 0.56, 9), tunM);
    put(g, torso, 0, 0.96, 0);
    const belt = new T.Mesh(new T.TorusGeometry(0.24, 0.035, 6, 12), mat(0x6b4a2a, { r: 0.6 }));
    put(g, belt, 0, 0.72, 0, Math.PI / 2);
    const head = new T.Mesh(new T.SphereGeometry(0.18, 9, 8), skinM);
    head.scale.y = 1.08;
    put(g, head, 0, 1.46, 0.01);
    for (const s of [-1, 1]) {
      const ear = new T.Mesh(new T.ConeGeometry(0.03, 0.14, 4), skinM);
      put(g, ear, s * 0.17, 1.5, -0.02, 0, 0, s * 1.3);
      const eye = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), std(0x2a5c38, { e: 0x2a5c38, ei: 1.2 }));
      put(g, eye, s * 0.075, 1.48, 0.16);
    }
    const hair = new T.Mesh(new T.SphereGeometry(0.19, 9, 7), hairM);
    hair.position.set(0, 1.53, -0.03); hair.scale.set(1, 0.8, 1);
    g.add(hair);
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      armG.position.set(s * 0.27, 1.2, 0.02);
      const arm = new T.Mesh(new T.CylinderGeometry(0.07, 0.06, 0.48, 6), tunM);
      arm.position.y = -0.24;
      const hand = new T.Mesh(new T.SphereGeometry(0.065, 7, 6), skinM);
      hand.position.y = -0.5;
      armG.add(arm, hand);
      armG.rotation.z = s * 0.2; armG.rotation.x = -0.25;
      g.add(armG); arms.push(armG);
    }
    // 长剑
    const sword = new T.Group();
    const blade = new T.Mesh(new T.BoxGeometry(0.07, 1.05, 0.02), mat(0xd8e2ee, { r: 0.25, m: 0.9 }));
    blade.position.y = 0.62;
    const guard = new T.Mesh(new T.BoxGeometry(0.2, 0.05, 0.05), mat(0xd8b45c, { r: 0.35, m: 0.85 }));
    const grip = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.2, 6), mat(0x4a3320, { r: 0.7 }));
    grip.position.y = -0.12;
    sword.add(blade, guard, grip);
    sword.position.set(0.34, 0.6, 0.12);
    sword.rotation.z = -0.28;
    g.add(sword);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, sword, kind: 'celtic' });
    return g;
  }

  /* ---- 宝贝龙 88819587 ---- */
  function babyDragonModel() {
    const g = new T.Group();
    const bodyM = mat(0xd88a3a, { r: 0.6 });
    const bellyM = mat(0xf0c080, { r: 0.65 });
    const darkM = std(0x1a120a, { r: 0.4 });
    const wingM = mat(0xb5651d, { r: 0.7, ds: true });
    const body = new T.Mesh(new T.SphereGeometry(0.4, 10, 8), bodyM);
    body.position.y = 0.44; body.scale.set(0.9, 0.85, 1.1);
    g.add(body);
    put(g, new T.Mesh(new T.SphereGeometry(0.26, 8, 6), bellyM), 0, 0.36, 0.18);
    const head = new T.Mesh(new T.SphereGeometry(0.34, 10, 8), bodyM);
    head.scale.set(1, 0.95, 1.05);
    put(g, head, 0, 0.98, 0.1);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), std(0xffffff, { r: 0.3 }));
      put(g, eye, s * 0.15, 1.05, 0.32);
      const pup = new T.Mesh(new T.SphereGeometry(0.05, 6, 5), darkM);
      put(g, pup, s * 0.15, 1.05, 0.4);
      const horn = new T.Mesh(new T.ConeGeometry(0.045, 0.16, 5), bellyM);
      put(g, horn, s * 0.12, 1.28, -0.02, -0.2, 0, s * 0.3);
    }
    const snout = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 0.16), bellyM);
    put(g, snout, 0, 0.88, 0.42);
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CircleGeometry(0.3, 3), wingM);
      w.userData.base = s * 0.6;
      w.position.set(s * 0.36, 0.66, -0.12);
      w.rotation.set(-0.4, s * 1.2, s * 0.5);
      w.scale.set(1, 0.7, 1);
      wings.push(w); g.add(w);
    }
    const tail = new T.Mesh(new T.ConeGeometry(0.1, 0.5, 6), bodyM);
    put(g, tail, 0, 0.4, -0.5, Math.PI / 2 + 0.4);
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.24, 6), bodyM);
      put(g, leg, s * 0.18, 0.12, 0.06);
      const foot = new T.Mesh(new T.BoxGeometry(0.14, 0.07, 0.2), bellyM);
      put(g, foot, s * 0.18, 0.04, 0.12);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { wings, kind: 'babydragon' });
    g.scale.setScalar(1.05);
    return g;
  }

  /* ---- 千岁龙 41462083 ---- */
  function thousandDragonModel() {
    const g = aceDragonModel({ body: 0x4a7a5a, belly: 0x9ab87a, horn: 0xd8cca0, eye: 0xffd166, wing: 0x3a5c46 });
    // 年迈龙须 + 眉角
    const whiskM = mat(0xd8cca0, { r: 0.6 });
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.012, 0.006, 0.5, 4), whiskM);
      w.position.set(s * 0.12, 0.52, 0.5);
      w.rotation.z = s * 0.3; w.rotation.x = 0.25;
      g.add(w);
      const brow = new T.Mesh(new T.ConeGeometry(0.04, 0.2, 4), whiskM);
      brow.position.set(s * 0.14, 1.76, 0.78);
      brow.rotation.z = s * 0.8;
      g.add(brow);
    }
    g.scale.setScalar(1.14);
    g.userData.kind = 'thousanddragon';
    return g;
  }

  /* ---- 欧贝利斯克的巨神兵 10000000 ---- */
  function obeliskModel() {
    const g = new T.Group();
    const bodyM = mat(0x2f5fae, { r: 0.55, m: 0.25 });
    const darkM = mat(0x1d3a70, { r: 0.6, m: 0.3 });
    const lineM = glowM(0xe8a8c8, 2.2);
    const eyeM = glowM(0xfff2d8, 3.2);
    const torso = new T.Mesh(new T.CylinderGeometry(0.42, 0.5, 0.9, 7), bodyM);
    put(g, torso, 0, 1.1, 0);
    const hips = new T.Mesh(new T.BoxGeometry(0.6, 0.34, 0.44), darkM);
    put(g, hips, 0, 0.56, 0);
    // 胸口发光纹
    for (let i = 0; i < 3; i++) {
      const ln = new T.Mesh(new T.BoxGeometry(0.34 - i * 0.08, 0.035, 0.02), lineM);
      put(g, ln, 0, 1.42 - i * 0.14, 0.4);
    }
    const head = new T.Mesh(new T.BoxGeometry(0.32, 0.3, 0.34), bodyM);
    put(g, head, 0, 1.78, 0.04);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.05, 7, 6), eyeM);
      put(g, eye, s * 0.08, 1.8, 0.2);
      const crn = new T.Mesh(new T.ConeGeometry(0.05, 0.24, 5), darkM);
      put(g, crn, s * 0.12, 2.0, 0, -0.2, 0, s * 0.4);
    }
    // 巨臂
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      armG.position.set(s * 0.56, 1.5, 0);
      const up = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.6, 7), bodyM);
      up.position.y = -0.3;
      const fist = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), darkM);
      fist.position.y = -0.72; fist.scale.y = 1.15;
      armG.add(up, fist);
      armG.rotation.z = s * 0.24;
      g.add(armG); arms.push(armG);
      const leg = new T.Mesh(new T.CylinderGeometry(0.16, 0.14, 0.56, 7), bodyM);
      put(g, leg, s * 0.24, 0.28, 0);
      const foot = new T.Mesh(new T.BoxGeometry(0.26, 0.12, 0.4), darkM);
      put(g, foot, s * 0.24, 0.06, 0.08);
    }
    // 背后紫色垂翼
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CircleGeometry(0.5, 3), mat(0x7a4aa8, { r: 0.7, ds: true }));
      w.userData.base = s * 0.8;
      w.position.set(s * 0.3, 1.5, -0.42);
      w.rotation.set(-0.2, s * 1.7, s * 0.3);
      w.scale.set(1, 1.5, 1);
      wings.push(w); g.add(w);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, wings, kind: 'obelisk' });
    g.scale.setScalar(1.12);
    return g;
  }

  /* ---- 欧西里斯的天空龙 10000020 ---- */
  function sliferModel() {
    const g = new T.Group();
    const bodyM = mat(0xc4342a, { r: 0.55, m: 0.2 });
    const goldM = mat(0xd8a832, { r: 0.4, m: 0.7 });
    const toothM = mat(0xf0ead8, { r: 0.5 });
    const eyeM = glowM(0xfff2d8, 3.0);
    // 蛇状直立体节
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const seg = new T.Mesh(new T.SphereGeometry(0.3 - i * 0.028, 9, 7), bodyM);
      seg.position.set(Math.sin(i * 0.9) * 0.1, 0.34 + i * 0.34, -i * 0.08);
      seg.scale.y = 1.15;
      segs.push(seg); g.add(seg);
      if (i > 0 && i < 5) {
        const belly = new T.Mesh(new T.BoxGeometry(0.2 - i * 0.02, 0.2, 0.06), goldM);
        belly.position.set(seg.position.x, seg.position.y - 0.1, seg.position.z + 0.24);
        g.add(belly);
      }
    }
    g.userData.segs = segs;
    // 头部：大颚 + 额上第二张嘴
    const headG = new T.Group();
    const skull = new T.Mesh(new T.SphereGeometry(0.24, 9, 8), bodyM);
    skull.scale.set(0.95, 0.9, 1.1);
    const jaw = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.42), bodyM);
    put(headG, jaw, 0, -0.16, 0.16);
    for (let i = 0; i < 5; i++) {
      const th = new T.Mesh(new T.ConeGeometry(0.025, 0.09, 4), toothM);
      put(headG, th, -0.11 + i * 0.055, -0.1, 0.34, Math.PI);
      const tb = new T.Mesh(new T.ConeGeometry(0.025, 0.09, 4), toothM);
      put(headG, tb, -0.11 + i * 0.055, -0.12, 0.34);
    }
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.055, 7, 6), eyeM);
      put(headG, eye, s * 0.13, 0.08, 0.16);
    }
    // 第二张嘴
    const mouth2 = new T.Group();
    const m2up = new T.Mesh(new T.ConeGeometry(0.09, 0.26, 4), bodyM);
    m2up.rotation.x = 0.5;
    mouth2.add(m2up);
    for (let i = 0; i < 4; i++) {
      const th = new T.Mesh(new T.ConeGeometry(0.02, 0.07, 4), toothM);
      th.position.set(-0.05 + i * 0.033, 0.1, 0.06);
      mouth2.add(th);
    }
    mouth2.position.set(0, 0.22, 0.06);
    headG.add(mouth2);
    headG.add(skull);
    headG.position.set(0, 2.2, 0.1);
    g.add(headG);
    g.userData.headG = headG;
    g.userData.jaw = jaw;
    g.userData.mouth2 = mouth2;
    // 漂浮金爪双手
    const hands = [];
    for (const s of [-1, 1]) {
      const hand = new T.Group();
      const palm = new T.Mesh(new T.SphereGeometry(0.14, 8, 6), bodyM);
      hand.add(palm);
      for (let f = 0; f < 3; f++) {
        const cl = new T.Mesh(new T.ConeGeometry(0.035, 0.22, 5), goldM);
        cl.position.set((f - 1) * 0.08, -0.02, 0.14);
        cl.rotation.x = Math.PI / 2 - 0.2;
        hand.add(cl);
      }
      hand.position.set(s * 0.8, 1.1, 0.3);
      hand.userData.side = s;
      g.add(hand); hands.push(hand);
    }
    g.userData.hands = hands;
    // 底部蛇尾盘绕
    const coil = new T.Mesh(new T.TorusGeometry(0.42, 0.13, 8, 18, Math.PI * 1.6), bodyM);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.14;
    g.add(coil);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { kind: 'slifer' });
    g.scale.setScalar(1.18);
    return g;
  }

  /* ---- 拉的翼神龙 10000010 ---- */
  function raModel() {
    const g = new T.Group();
    const goldM = mat(0xd8a832, { r: 0.4, m: 0.75 });
    const gold2M = mat(0xe8c060, { r: 0.45, m: 0.7 });
    const flameM = glowM(0xff7a3a, 3.0);
    const eyeM = glowM(0xfff2d8, 3.2);
    // 金球状躯体 + 环
    const body = new T.Mesh(new T.SphereGeometry(0.44, 12, 10), goldM);
    body.position.y = 0.95;
    body.scale.set(1, 1.15, 0.9);
    g.add(body);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new T.Mesh(new T.TorusGeometry(0.52 + i * 0.09, 0.028, 6, 26), gold2M);
      r.position.y = 0.95;
      r.rotation.x = 0.5 + i * 0.4;
      r.userData.i = i;
      rings.push(r); g.add(r);
    }
    g.userData.rings = rings;
    // 鹰首
    const headG = new T.Group();
    const head = new T.Mesh(new T.SphereGeometry(0.2, 9, 8), goldM);
    head.scale.set(0.9, 0.95, 1.1);
    const beak = new T.Mesh(new T.ConeGeometry(0.09, 0.26, 5), gold2M);
    beak.rotation.x = Math.PI / 2;
    put(headG, beak, 0, -0.04, 0.26);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.05, 7, 6), eyeM);
      put(headG, eye, s * 0.1, 0.06, 0.16);
    }
    // 火焰冠
    const crest = new T.Mesh(new T.ConeGeometry(0.08, 0.42, 5), flameM);
    put(headG, crest, 0, 0.3, -0.02, -0.3);
    headG.add(head);
    headG.position.set(0, 1.62, 0.14);
    g.add(headG);
    g.userData.headG = headG;
    // 金翼
    const wings = [];
    for (const s of [-1, 1]) {
      const wg = new T.Group();
      for (let f = 0; f < 4; f++) {
        const feather = new T.Mesh(new T.BoxGeometry(0.5 - f * 0.04, 0.035, 0.12), gold2M);
        feather.position.set(s * (0.3 + f * 0.08), -f * 0.07, -f * 0.1);
        feather.rotation.z = s * (0.3 + f * 0.12);
        wg.add(feather);
      }
      wg.position.set(s * 0.3, 1.2, -0.1);
      wg.rotation.y = s * -0.2;
      g.add(wg); wings.push(wg);
    }
    g.userData.wings = wings;
    // 尾焰
    const tail = new T.Mesh(new T.ConeGeometry(0.16, 0.7, 6), flameM);
    tail.rotation.x = Math.PI / 2 + 0.5;
    tail.position.set(0, 0.7, -0.6);
    g.add(tail);
    g.userData.core = body;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { kind: 'ra' });
    return g;
  }

  /* ---- XYZ-神龙炮 91998119 ---- */
  function xyzCannonModel() {
    const g = new T.Group();
    const bodyM = mat(0xe8ecf2, { r: 0.4, m: 0.55 });
    const trimM = mat(0x3f6fd8, { r: 0.4, m: 0.6 });
    const gunM = mat(0x6a7078, { r: 0.35, m: 0.8 });
    const eyeM = glowM(0xff3b30, 3.0);
    const torso = new T.Mesh(new T.BoxGeometry(0.5, 0.6, 0.36), bodyM);
    put(g, torso, 0, 1.02, 0);
    const chest = new T.Mesh(new T.BoxGeometry(0.36, 0.2, 0.1), trimM);
    put(g, chest, 0, 1.12, 0.2);
    const head = new T.Mesh(new T.BoxGeometry(0.28, 0.24, 0.3), bodyM);
    put(g, head, 0, 1.52, 0.02);
    const visor = new T.Mesh(new T.BoxGeometry(0.2, 0.07, 0.04), eyeM);
    put(g, visor, 0, 1.54, 0.16);
    // 双肩加农炮
    const cannons = [];
    for (const s of [-1, 1]) {
      const can = new T.Group();
      const barrel = new T.Mesh(new T.CylinderGeometry(0.08, 0.09, 0.7, 8), gunM);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.2;
      const mouth = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.06, 8), std(0x14141a, { r: 0.5 }));
      mouth.rotation.x = Math.PI / 2;
      mouth.position.z = 0.55;
      can.add(barrel, mouth);
      can.position.set(s * 0.34, 1.42, -0.05);
      can.rotation.x = 0.18;
      g.add(can); cannons.push(can);
    }
    g.userData.arms = cannons;
    // 龙首臂炮（右臂）
    const armG = new T.Group();
    const dragonHead = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.4), bodyM);
    dragonHead.position.set(0, -0.5, 0.12);
    const dJaw = new T.Mesh(new T.BoxGeometry(0.16, 0.07, 0.3), trimM);
    dJaw.position.set(0, -0.6, 0.2);
    armG.add(dragonHead, dJaw);
    const up = new T.Mesh(new T.CylinderGeometry(0.09, 0.08, 0.5, 7), trimM);
    up.position.y = -0.2;
    armG.add(up);
    armG.position.set(0.4, 1.3, 0.04);
    armG.rotation.z = -0.3;
    g.add(armG);
    const armL = new T.Group();
    const upL = new T.Mesh(new T.CylinderGeometry(0.09, 0.08, 0.5, 7), trimM);
    upL.position.y = -0.25;
    const fistL = new T.Mesh(new T.SphereGeometry(0.1, 7, 6), gunM);
    fistL.position.y = -0.55;
    armL.add(upL, fistL);
    armL.position.set(-0.4, 1.3, 0.04);
    armL.rotation.z = 0.3;
    g.add(armL);
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.11, 0.09, 0.55, 7), bodyM);
      put(g, leg, s * 0.17, 0.4, 0);
      const foot = new T.Mesh(new T.BoxGeometry(0.2, 0.1, 0.32), trimM);
      put(g, foot, s * 0.17, 0.08, 0.06);
      legs.push(leg);
    }
    // 背部龙翼
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CircleGeometry(0.4, 3), mat(0xc8d0dc, { r: 0.5, ds: true }));
      w.userData.base = s * 0.7;
      w.position.set(s * 0.34, 1.34, -0.26);
      w.rotation.set(-0.3, s * 1.6, s * 0.4);
      wings.push(w); g.add(w);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { wings, kind: 'xyzcannon' });
    return g;
  }

  /* ---- 编号39 希望皇霍普 84013238 ---- */
  function utopiaModel() {
    const g = new T.Group();
    const armM = mat(0xf0f2f6, { r: 0.35, m: 0.5 });
    const trimM = mat(0x3f6fd8, { r: 0.4, m: 0.5 });
    const goldM = mat(0xd8a832, { r: 0.35, m: 0.8 });
    const eyeM = glowM(0x5ff2e0, 2.8);
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.1, 0.09, 0.58, 7), armM);
      put(g, leg, s * 0.15, 0.4, 0);
      const boot = new T.Mesh(new T.BoxGeometry(0.18, 0.12, 0.28), trimM);
      put(g, boot, s * 0.15, 0.06, 0.05);
      legs.push(leg);
    }
    const torso = new T.Mesh(new T.CylinderGeometry(0.24, 0.28, 0.55, 9), armM);
    put(g, torso, 0, 1.16, 0);
    const chest = new T.Mesh(new T.BoxGeometry(0.3, 0.26, 0.14), trimM);
    put(g, chest, 0, 1.24, 0.16);
    const head = new T.Mesh(new T.SphereGeometry(0.19, 9, 8), armM);
    put(g, head, 0, 1.66, 0.01);
    const helm = new T.Mesh(new T.SphereGeometry(0.21, 9, 7, 0, Math.PI * 2, 0, Math.PI / 2), trimM);
    helm.position.set(0, 1.7, -0.01);
    g.add(helm);
    const visor = new T.Mesh(new T.BoxGeometry(0.26, 0.05, 0.03), eyeM);
    put(g, visor, 0, 1.66, 0.18);
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      armG.position.set(s * 0.3, 1.4, 0.02);
      const up = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.5, 6), armM);
      up.position.y = -0.25;
      armG.add(up);
      const sword = new T.Group();
      const blade = new T.Mesh(new T.BoxGeometry(0.06, 0.9, 0.02), mat(0xe8ecf2, { r: 0.2, m: 0.9 }));
      blade.position.y = 0.55;
      const guard = new T.Mesh(new T.BoxGeometry(0.18, 0.045, 0.05), goldM);
      sword.add(blade, guard);
      sword.position.y = -0.55;
      sword.rotation.x = -1.2;
      armG.add(sword);
      armG.rotation.z = s * 0.3;
      g.add(armG); arms.push(armG);
    }
    // 背后金色翼刃
    const wings = [];
    for (const s of [-1, 1]) {
      const wg = new T.Group();
      for (let f = 0; f < 3; f++) {
        const blade = new T.Mesh(new T.BoxGeometry(0.55 - f * 0.08, 0.04, 0.1), goldM);
        blade.position.set(s * (0.28 + f * 0.06), f * 0.14, -f * 0.08);
        blade.rotation.z = s * (0.35 + f * 0.15);
        wg.add(blade);
      }
      wg.position.set(s * 0.16, 1.5, -0.2);
      wg.rotation.y = s * -0.3;
      g.add(wg); wings.push(wg);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, wings, kind: 'utopia' });
    return g;
  }

  /* ---- 电子龙无限 10443957 ---- */
  function cyberInfinityModel() {
    const g = new T.Group();
    const chromeM = mat(0xb8c0cc, { r: 0.25, m: 0.9 });
    const darkM = mat(0x5a6470, { r: 0.3, m: 0.85 });
    const ringM = glowM(0x5ff2e0, 2.6);
    const eyeM = glowM(0xff3b30, 3.0);
    const segs = [];
    for (let i = 0; i < 5; i++) {
      const seg = new T.Mesh(new T.SphereGeometry(0.3 - i * 0.02, 10, 8), chromeM);
      seg.position.set(Math.sin(i * 0.7) * 0.12, 0.4 + i * 0.36, -i * 0.06);
      seg.scale.set(1, 1.2, 0.9);
      segs.push(seg); g.add(seg);
      if (i < 4) {
        const ring = new T.Mesh(new T.TorusGeometry(0.26 - i * 0.015, 0.03, 6, 18), ringM);
        ring.rotation.x = Math.PI / 2 - 0.2;
        ring.position.set(seg.position.x, seg.position.y + 0.18, seg.position.z - 0.02);
        g.add(ring);
      }
    }
    g.userData.segs = segs;
    const headG = new T.Group();
    const head = new T.Mesh(new T.BoxGeometry(0.26, 0.2, 0.4), chromeM);
    const eye = new T.Mesh(new T.SphereGeometry(0.05, 7, 6), eyeM);
    put(headG, eye, 0, 0.02, 0.2);
    const crest = new T.Mesh(new T.ConeGeometry(0.06, 0.3, 4), darkM);
    put(headG, crest, 0, 0.16, -0.04, -0.4);
    headG.add(head);
    headG.position.set(0, 2.0, 0.1);
    g.add(headG);
    g.userData.headG = headG;
    // 侧触手炮
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      const t1 = new T.Mesh(new T.CylinderGeometry(0.05, 0.08, 0.7, 6), darkM);
      t1.position.y = -0.3;
      const t2 = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.5, 6), chromeM);
      t2.position.y = -0.75; t2.rotation.x = 0.4;
      armG.add(t1, t2);
      armG.position.set(s * 0.36, 1.5, 0);
      armG.rotation.z = s * 0.7;
      g.add(armG); arms.push(armG);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, kind: 'cyberinf' });
    return g;
  }

  /* ---- 解码语者 1861630 ---- */
  function decoderModel() {
    const g = new T.Group();
    const armM = mat(0x1a2340, { r: 0.5, m: 0.4 });
    const pinkM = mat(0xe86a9a, { r: 0.5, e: 0xe86a9a, ei: 0.8 });
    const cyanM = glowM(0x5ff2e0, 2.6);
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.1, 0.08, 0.6, 7), armM);
      put(g, leg, s * 0.15, 0.38, 0);
      const boot = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 0.28), mat(0x10182c, { r: 0.5, m: 0.4 }));
      put(g, boot, s * 0.15, 0.05, 0.05);
      legs.push(leg);
    }
    const torso = new T.Mesh(new T.CylinderGeometry(0.23, 0.27, 0.58, 9), armM);
    put(g, torso, 0, 1.14, 0);
    const chest = new T.Mesh(new T.BoxGeometry(0.28, 0.22, 0.12), pinkM);
    put(g, chest, 0, 1.22, 0.15);
    const head = new T.Mesh(new T.SphereGeometry(0.18, 9, 8), armM);
    put(g, head, 0, 1.64, 0.01);
    const visor = new T.Mesh(new T.BoxGeometry(0.3, 0.06, 0.06), cyanM);
    put(g, visor, 0, 1.66, 0.14);
    for (const s of [-1, 1]) {
      const fin = new T.Mesh(new T.ConeGeometry(0.04, 0.2, 4), pinkM);
      fin.position.set(s * 0.18, 1.76, -0.04);
      fin.rotation.z = s * -0.5;
      g.add(fin);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const armG = new T.Group();
      armG.position.set(s * 0.29, 1.38, 0.02);
      const up = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.52, 6), armM);
      up.position.y = -0.26;
      armG.add(up);
      const hand = new T.Mesh(new T.SphereGeometry(0.07, 7, 6), pinkM);
      hand.position.y = -0.56;
      armG.add(hand);
      armG.rotation.z = s * 0.24;
      g.add(armG); arms.push(armG);
    }
    // 巨型宽刃剑
    const sword = new T.Group();
    const blade = new T.Mesh(new T.BoxGeometry(0.2, 1.0, 0.04), mat(0xe8ecf2, { r: 0.2, m: 0.9 }));
    blade.position.y = 0.62;
    const edge = new T.Mesh(new T.BoxGeometry(0.22, 0.5, 0.045), cyanM);
    edge.position.y = 0.3;
    const guard = new T.Mesh(new T.BoxGeometry(0.3, 0.06, 0.07), pinkM);
    sword.add(blade, edge, guard);
    sword.position.set(0.36, 0.62, 0.12);
    sword.rotation.z = -0.24;
    g.add(sword);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = Object.assign(g.userData, { arms, sword, kind: 'decoder' });
    return g;
  }

  /* ---- 专属建模注册表（卡 ID → 构造器） ---- */
  const FINE = {
    40640057: kuribohModel,
    46986414: () => darkMagicianModel(),
    38033121: () => darkMagicianModel({ girl: true }),
    89631139: () => aceDragonModel(BLUE_EYES),
    74677422: () => aceDragonModel(RED_EYES),
    88819587: babyDragonModel,
    41462083: thousandDragonModel,
    70781052: summonedSkullModel,
    13039848: rockGiantModel,
    91152256: celticModel,
    10000000: obeliskModel,
    10000020: sliferModel,
    10000010: raModel,
    91998119: xyzCannonModel,
    84013238: utopiaModel,
    10443957: cyberInfinityModel
  };

  /* ---- 其余怪兽：按 ID 确定性专属装饰（一卡一模） ---- */
  function vary(g, rec, color) {
    const seed = hashSeed(rec && rec.id);
    const darkM = mat(shade(color, 0.5), { r: 0.5, m: 0.5 });
    const gemC = [0xff5a5a, 0x5ad8ff, 0xffd166, 0x8aff7a, 0xd88aff][(seed >> 4) % 5];
    const gemM = glowM(gemC, 2.2);
    const mode = seed % 4;
    // 头冠双角
    if (mode === 0 || mode === 2) {
      for (const s of [-1, 1]) {
        const h = new T.Mesh(new T.ConeGeometry(0.05, 0.26 + (seed >> 6) % 3 * 0.08, 5), darkM);
        h.position.set(s * (0.1 + (seed >> 3) % 3 * 0.03), 1.62 + (seed >> 9) % 3 * 0.07, -0.02);
        h.rotation.z = s * (0.3 + (seed >> 12) % 3 * 0.12);
        g.add(h);
      }
    }
    // 背部背棘
    if (mode === 1 || mode === 2) {
      for (let i = 0; i < 3; i++) {
        const sp = new T.Mesh(new T.ConeGeometry(0.06, 0.24, 4), darkM);
        sp.position.set(0, 1.28 - i * 0.18, -0.3 - i * 0.05);
        sp.rotation.x = -0.6;
        g.add(sp);
      }
    }
    // 环绕宝石
    if (mode === 3) {
      const gems = [];
      const n = 2 + (seed >> 5) % 2;
      for (let i = 0; i < n; i++) {
        const gm = new T.Mesh(new T.OctahedronGeometry(0.07, 0), gemM);
        gm.userData.a = i / n * TAU;
        g.add(gm); gems.push(gm);
      }
      g.userData.gems = gems;
    }
    // 胸口宝珠
    if ((seed >> 8) % 3 === 0) {
      const orb = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), gemM);
      orb.position.set(0, 1.18, 0.3);
      g.add(orb);
      g.userData.orb2 = orb;
    }
    return g;
  }

  /* ---- 绑定表：卡 ID → 建模规格（保证同卡同模） ---- */
  const bindCache = {};

  /* 卡牌立牌尺寸（世界单位）：比例按标准卡 59:86 */
  const CARD_W = 0.95, CARD_H = 1.385, BOARD_Y = CARD_H / 2 + 0.42;

  /* 卡牌立牌：整卡竖立 + 卡面浮雕图案，board 每帧朝向摄像机（任意视角卡面正对玩家） */
  /* v0.4.0：立牌共享几何体 / 材质（跨全部怪单一实例，spawn 只建 Mesh 节点）
   * v0.4.1：金色边框 4 个 Box 合并为 1 个几何体（同材质，逐顶点合并）——
   * 每只怪 draw call 10 → 7；边框视觉完全不变 */
  function mergeBoxes(parts) {
    /* parts: [{geo, x, y, z, color?}] —— 仅支持 position/normal/uv 三属性的 BoxGeometry；
     * v0.4.2b：color 可选（0xRRGGBB）——给合并体附加顶点色属性，供单材质多色部件使用 */
    let vTotal = 0;
    for (const p of parts) vTotal += p.geo.attributes.position.count;
    const pos = new Float32Array(vTotal * 3), nor = new Float32Array(vTotal * 3), uv = new Float32Array(vTotal * 2);
    const withColor = parts.some(p => p.color !== undefined);
    const col = withColor ? new Float32Array(vTotal * 3) : null;
    const _c = new T.Color();
    let vo = 0;
    const pm = new T.Matrix4(), nm = new T.Matrix3();
    for (const p of parts) {
      const g = p.geo;
      pm.makeTranslation(p.x || 0, p.y || 0, p.z || 0);
      nm.getNormalMatrix(pm);
      const gp = g.attributes.position.array, gn = g.attributes.normal.array, gu = g.attributes.uv.array;
      const n = g.attributes.position.count;
      if (withColor) _c.setHex(p.color === undefined ? 0xffffff : p.color);
      for (let i = 0; i < n; i++) {
        const x = gp[i * 3], y = gp[i * 3 + 1], z = gp[i * 3 + 2];
        pos[vo * 3] = pm.elements[0] * x + pm.elements[4] * y + pm.elements[8] * z + pm.elements[12];
        pos[vo * 3 + 1] = pm.elements[1] * x + pm.elements[5] * y + pm.elements[9] * z + pm.elements[13];
        pos[vo * 3 + 2] = pm.elements[2] * x + pm.elements[6] * y + pm.elements[10] * z + pm.elements[14];
        const nx = gn[i * 3], ny = gn[i * 3 + 1], nz = gn[i * 3 + 2];
        nor[vo * 3] = nm.elements[0] * nx + nm.elements[3] * ny + nm.elements[6] * nz;
        nor[vo * 3 + 1] = nm.elements[1] * nx + nm.elements[4] * ny + nm.elements[7] * nz;
        nor[vo * 3 + 2] = nm.elements[2] * nx + nm.elements[5] * ny + nm.elements[8] * nz;
        uv[vo * 2] = gu[i * 2]; uv[vo * 2 + 1] = gu[i * 2 + 1];
        if (withColor) { col[vo * 3] = _c.r; col[vo * 3 + 1] = _c.g; col[vo * 3 + 2] = _c.b; }
        vo++;
      }
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (withColor) out.setAttribute('color', new T.BufferAttribute(col, 3));
    return out;
  }
  const BB = {
    faceGeo: new T.PlaneGeometry(CARD_W, CARD_H),
    slabGoldGeo: null,                              // v0.4.2b：背板+金框合并体（下方构建，顶点色区分）
    pedGeo: new T.CylinderGeometry(0.3, 0.42, 0.07, 14),
    pedRingGeo: new T.TorusGeometry(0.38, 0.02, 5, 28),
    /* v0.4.2b：背板（暗、粗糙）+ 金框（亮、金属）合并为单 Mesh —— 顶点色区分色相，
     * 粗糙度/金属度取折中（0.45/0.72）：金框观感几乎无损，暗背板呈深色微金属边缘。
     * draw call 2→1，80 敌场面再省 80 call */
    slabGoldM: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.72 }),
    pedM: std(0x2a2032, { r: 0.6, m: 0.3 }),
    pedRingM: new T.MeshBasicMaterial({ color: 0xd8b45c, transparent: true, opacity: 0.75 })
  };
  BB.slabGoldGeo = mergeBoxes([
    { geo: new T.BoxGeometry(CARD_W + 0.06, CARD_H + 0.06, 0.05), z: -0.032, color: 0x191219 },
    { geo: new T.BoxGeometry(CARD_W + 0.07, 0.035, 0.045), y: CARD_H / 2 + 0.0175, z: 0.006, color: 0xd8b45c },
    { geo: new T.BoxGeometry(CARD_W + 0.07, 0.035, 0.045), y: -CARD_H / 2 - 0.0175, z: 0.006, color: 0xd8b45c },
    { geo: new T.BoxGeometry(0.035, CARD_H, 0.045), x: CARD_W / 2 + 0.0175, z: 0.006, color: 0xd8b45c },
    { geo: new T.BoxGeometry(0.035, CARD_H, 0.045), x: -CARD_W / 2 - 0.0175, z: 0.006, color: 0xd8b45c }
  ]);
  const faceMatCache = new WeakMap();
  function faceMat(img, rec) {
    let m = faceMatCache.get(img);
    if (!m) { m = new T.MeshBasicMaterial({ map: standFace(img, rec) }); faceMatCache.set(img, m); }
    return m;
  }
  /* v0.4.1：脚下光晕材质按颜色缓存 —— 此前每只怪 new 一个 SpriteMaterial。
   * Boss 需要独立调 opacity（受击高亮）时懒 clone 一份，避免共享材质串扰 */
  const auraMatCache = new Map();
  function auraMat(color) {
    let m = auraMatCache.get(color);
    if (!m) {
      m = new T.SpriteMaterial({
        map: glow(), color: shade(color, 1.8), transparent: true, opacity: 0.35,
        blending: T.AdditiveBlending, depthWrite: false
      });
      auraMatCache.set(color, m);
    }
    return m;
  }
  function ownAura(sp) {
    const a = sp.userData.aura;
    if (a && a.material === auraMatCache.get(sp.userData.color)) a.material = a.material.clone();
    return a;
  }

  /* v0.5.1：假阴影 —— 共享几何/材质的黑色半透明椭圆，垫在建模怪兽脚下，
   * 让卡牌看起来「立」在地面上而不是悬浮的 UI（纯视觉，零玩法影响）。
   * 按需开启（opt.shadow）：敌人/Boss 已由 game.js 的 shadowInst 实例化阴影覆盖，
   * 只有玩家场上怪兽等未被覆盖的对象才需要挂一份，避免重复 draw call */
  let _shGeo = null, _shMat = null;
  function fakeShadow(rx) {
    if (!_shGeo) _shGeo = new T.CircleGeometry(1, 22);
    if (!_shMat) _shMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
    const s = new T.Mesh(_shGeo, _shMat);
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.018;
    s.scale.set(rx, rx * 0.55, 1);
    s.renderOrder = -1;
    return s;
  }

  function cardBillboard(rec, opt) {
    const img = opt.img;
    const color = opt.color || artColor(img, 0x8a7a5c);
    const g = new T.Group();
    const board = new T.Group();
    board.position.y = BOARD_Y;
    g.add(board);
    // 背板 + 金色边框（v0.4.2b：合并为 1 Mesh，顶点色区分暗背板/金框，draw call 2→1）
    board.add(new T.Mesh(BB.slabGoldGeo, BB.slabGoldM));
    // 整卡卡面
    const face = new T.Mesh(BB.faceGeo, faceMat(img, rec));
    face.position.z = 0.004;
    board.add(face);
    // 卡面浮雕图案（v0.4.2b：双层视差合并为单 Mesh；opt.hq=精档 44×48）
    const rl = reliefLayers(img, !!opt.hq);
    if (rl) {
      rl.position.set(0, 0.14, 0.052);
      board.add(rl);
      g.userData.relief = rl;          // v0.4.1：远距离剔除/LOD 用（updateEnemies 按距离切 visible 与几何体档位）
    }
    // 底座 + 全息光环
    const ped = new T.Mesh(BB.pedGeo, BB.pedM);
    ped.position.y = 0.035;
    const pedRing = new T.Mesh(BB.pedRingGeo, BB.pedRingM);
    pedRing.rotation.x = Math.PI / 2; pedRing.position.y = 0.075;
    g.add(ped, pedRing);
    if (opt.shadow) g.add(fakeShadow(0.95));        // v0.5.1：脚下假阴影（按需）
    g.userData.pedRing = pedRing;
    // 脚下光晕（v0.4.1：材质按颜色缓存）
    const aura = new T.Sprite(auraMat(color));
    aura.scale.set(1.6, 1.0, 1);
    aura.position.y = 0.4;
    g.add(aura);
    g.userData.aura = aura;
    // 立牌引用：animate() 每帧朝向摄像机 + 悬浮呼吸
    g.userData.cardBoard = board;
    g.userData.boardBase = BOARD_Y;
    g.userData.recId = rec && rec.id;
    g.userData.color = color;
    if (opt.scale) g.scale.setScalar(opt.scale);
    return g;
  }

  /* 立体全身建模（Boss / 无卡图回退路径保留；18 种族骨架 + FINE 定制） */
  function monsterBody(rec, opt) {
    opt = opt || {};
    const img = opt.img;
    const color = opt.color || artColor(img, 0x8a7a5c);
    const id = rec && rec.id;
    let g = null;
    if (id && FINE[id]) {
      g = FINE[id]();
    } else {
      g = pickModel(rec || {}, color);
      vary(g, rec || {}, color);    // 种族骨架 + ID 专属装饰
    }
  g.userData.recId = id;
  g.userData.color = color;
  if (opt.scale) g.scale.setScalar(g.scale.x * opt.scale);
  g.add(fakeShadow(1.15));                         // v0.5.1：脚下假阴影（建模怪兽无实例化阴影，常开）
  // 脚下光晕（v0.4.1：与立牌共用按颜色缓存的材质）
  const aura = new T.Sprite(auraMat(color));
  aura.scale.set(1.9, 1.2, 1);
  aura.position.y = 0.5;
  g.add(aura);
  g.userData.aura = aura;
    // 脚下绑定卡：本卡卡面斜立于怪兽脚前
    if (img) {
      const bindCard = new T.Mesh(new T.PlaneGeometry(0.52, 0.75),
        new T.MeshBasicMaterial({ map: cardTexture(img), transparent: false }));
      bindCard.rotation.x = -Math.PI / 2 + 0.22;
      bindCard.position.set(0, 0.085, 0.52);
      g.add(bindCard);
      const cardGlow = new T.Mesh(new T.PlaneGeometry(0.58, 0.81),
        new T.MeshBasicMaterial({ map: glow(), color: 0xffd166, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false }));
      cardGlow.rotation.x = -Math.PI / 2 + 0.22;
      cardGlow.position.set(0, 0.082, 0.52);
      g.add(cardGlow);
    }
    return g;
  }

  function monster(rec, opt) {
    opt = opt || {};
    if (opt.img) return cardBillboard(rec, opt);   // 有卡图 → 卡牌立牌（浮雕卡面始终面向玩家）
    return monsterBody(rec, opt);                  // 无卡图（Boss）→ 保留立体全身建模
  }

  /* 王牌：更大、带光环与粒子 */
  function ace(who, rec, img) {
    const g = monster(rec, { img: img, scale: 1.35 });
    const halo = new T.Mesh(new T.TorusGeometry(0.9, 0.03, 6, 40),
      new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8 }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    g.add(halo);
    g.userData.halo = halo;
    return g;
  }

  function animate(g, t, dt) {
    const u = g.userData;
    // 卡牌立牌：整卡每帧朝向摄像机（无论视角怎么转，卡面浮雕始终正对玩家）
    if (u.cardBoard) {
      if (MODELS.camera) u.cardBoard.quaternion.copy(MODELS.camera.quaternion);
      u.cardBoard.position.y = (u.boardBase || 1.1) + Math.sin(t * 1.4) * 0.045;
    }
    if (u.reliefP) {
      u.reliefP.position.y = (u.reliefBase || 1.04) + Math.sin(t * 1.5) * 0.05;
      u.reliefP.rotation.y = Math.sin(t * 0.8) * 0.07;
    }
    if (u.pedRing) u.pedRing.rotation.z += dt * 0.9;
    if (u.wings) u.wings.forEach((w, i) => {
      const b = w.userData.base || 0;
      w.rotation.z = b + (i % 2 ? 1 : -1) * Math.sin(t * 2.6) * 0.18;
    });
    if (u.arms) u.arms.forEach((a, i) => {
      a.rotation.x = Math.sin(t * 1.8 + i * 1.7) * 0.16;
    });
    if (u.orb) u.orb.rotation.y += dt * 2;
    if (u.orb2) u.orb2.rotation.y += dt * 1.4;
    if (u.ring) u.ring.rotation.z += dt * 1.6;
    if (u.rings) u.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.7 + i * 0.35);
      r.rotation.y = Math.sin(t * 0.8 + i) * 0.3;
    });
    if (u.core) u.core.rotation.y += dt * 0.8;
    if (u.runes) u.runes.forEach((r, i) => {
      r.rotation.x += dt * 1.4; r.rotation.y += dt * 1.1;
      r.position.y = 1.1 + Math.sin(t * 2 + i) * 0.14;
    });
    if (u.halo) u.halo.rotation.z += dt * 0.6;
    if (u.staff) u.staff.rotation.z = -0.12 + Math.sin(t * 1.4) * 0.05;
    if (u.mouth2) u.mouth2.rotation.x = -0.2 + Math.sin(t * 2.4) * 0.24;
    if (u.jaw) u.jaw.rotation.x = Math.max(0, Math.sin(t * 1.6)) * 0.14;
    if (u.neck) u.neck.rotation.y = Math.sin(t * 0.9) * 0.14;
    if (u.tailG) u.tailG.rotation.y = Math.sin(t * 1.2) * 0.2;
    if (u.headG) u.headG.rotation.y = Math.sin(t * 0.7) * 0.1;
    if (u.segs) u.segs.forEach((s, i) => {
      s.position.x = (s.userData.bx === undefined ? (s.userData.bx = s.position.x) : s.userData.bx)
        + Math.sin(t * 1.6 + i * 0.8) * 0.05;
    });
    if (u.hands) u.hands.forEach((h, i) => {
      const a = t * 1.3 + i * Math.PI;
      h.position.y = 1.1 + Math.sin(a) * 0.2;
      h.position.x = (h.userData.side || 1) * (0.8 + Math.cos(a) * 0.08);
    });
    if (u.gems) u.gems.forEach((gm, i) => {
      const a = gm.userData.a + t * 0.9;
      gm.position.set(Math.cos(a) * 0.62, 1.15 + Math.sin(t * 1.7 + i) * 0.1, Math.sin(a) * 0.62);
      gm.rotation.y += dt * 2.2;
    });
  }

  global.MODELS = {
    duelist, monster, monsterBody, ace, animate, artColor, DUELIST, FINE,
    has: id => !!DUELIST[id],
    isFine: id => !!FINE[id],
    ownAura,                                   // v0.4.1：Boss 光晕独立材质（共享材质懒 clone）
    setReliefLOD                               // v0.4.2b：浮雕 LOD 切换（近端标准/精档 ↔ 远端低档）
  };
})(window);
