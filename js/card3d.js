/* ===========================================================
 *  Card3D · 游戏王卡牌三维资产工厂
 *  - 圆角挤出底板（ExtrudeGeometry + bevel）→ 真实厚度与倒角
 *  - 印刷框/画框浮雕（环状挤出，金属材质）→ 卡面凹凸
 *  - 卡面 400×580 原图贴图 + 程序化卡背
 *  - 按卡种（魔法/陷阱/怪兽/幻神）分配框色与材质
 *  尺寸基准：卡宽 1.4 世界单位，比例 400:580
 * =========================================================== */
(function (global) {
  const T = global.THREE;
  if (!T) throw new Error('Card3D 需要 THREE');

  const IMG_W = 400, IMG_H = 580;
  const W = 1.4, H = W * IMG_H / IMG_W;   // 2.03
  const THICK = 0.038;
  const R = 0.062;                         // 圆角半径
  const ART = { x: 52, y: 102, w: 297, h: 326 }; // 与 game.js 一致

  /* ---------- 坐标换算：图像像素 → 卡面局部坐标 ---------- */
  const px = v => (v / IMG_W - 0.5) * W;
  const py = v => (0.5 - v / IMG_H) * H;

  /* ---------- 圆角矩形 Shape ---------- */
  function roundRect(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  /* ---------- 带孔的框（外框/画框） ---------- */
  function frameShape(outerW, outerH, innerW, innerH, r1, r2, cx, cy) {
    const s = roundRect(outerW, outerH, r1);
    const hole = new T.Path();
    const w = innerW, h = innerH, x = cx - w / 2, y = cy - h / 2, r = r2;
    hole.moveTo(x + r, y);
    hole.lineTo(x + w - r, y);
    hole.quadraticCurveTo(x + w, y, x + w, y + r);
    hole.lineTo(x + w, y + h - r);
    hole.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    hole.lineTo(x + r, y + h);
    hole.quadraticCurveTo(x, y + h, x, y + h - r);
    hole.lineTo(x, y + r);
    hole.quadraticCurveTo(x, y, x + r, y);
    s.holes.push(hole);
    return s;
  }

  function uvUnwrap(geo) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / H + 0.5);
    }
    uv.needsUpdate = true;
  }

  /* ---------- 共享几何（按卡尺寸只建一次） ---------- */
  const BEVEL = 0.006;
  const TOP = THICK / 2 + BEVEL;   // 卡体含倒角后的实际表面高度
  let GEO = null;
  function geometries() {
    if (GEO) return GEO;
    // 卡体：圆角挤出 + 倒角（表面实际到 TOP）
    const body = new T.ExtrudeGeometry(roundRect(W, H, R), {
      depth: THICK, bevelEnabled: true, bevelThickness: BEVEL,
      bevelSize: 0.006, bevelSegments: 2, curveSegments: 8
    });
    body.translate(0, 0, -THICK / 2);
    body.computeVertexNormals();

    // 外框：距卡边 6px、宽 7px
    const fo = { x0: 6, x1: 394, y0: 6, y1: 574 };
    const outerW = (fo.x1 - fo.x0) / IMG_W * W;
    const outerH = (fo.y1 - fo.y0) / IMG_H * H;
    const fw = 7 / IMG_W * W;
    const outerFrame = new T.ExtrudeGeometry(
      frameShape(outerW, outerH,
        outerW - fw * 2, outerH - fw * 2, 0.05, 0.042,
        0, (py(fo.y0) + py(fo.y1)) / 2),
      { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 6 }
    );
    outerFrame.translate(0, (py(fo.y0) + py(fo.y1)) / 2, TOP - 0.002);

    // 画框：ART_BOX 精确对齐
    const aw = ART.w / IMG_W * W, ah = ART.h / IMG_H * H;
    const artCX = px(ART.x + ART.w / 2), artCY = py(ART.y + ART.h / 2);
    const afw = 5 / IMG_W * W;
    const artFrame = new T.ExtrudeGeometry(
      frameShape(aw + afw * 2, ah + afw * 2, aw, ah, 0.022, 0.018, 0, 0),
      { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 5 }
    );
    artFrame.translate(artCX, artCY, TOP - 0.001);

    GEO = {
      body,
      outerFrame,
      artFrame,
      face: new T.PlaneGeometry(W, H),
      back: new T.PlaneGeometry(W, H)
    };
    return GEO;
  }

  /* ---------- 卡背纹理（程序化，与游戏内 CSS 卡背一致） ---------- */
  let backTex = null;
  function backTexture() {
    if (backTex) return backTex;
    const c = document.createElement('canvas');
    c.width = 400; c.height = 580;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 400, 580);
    grd.addColorStop(0, '#3a2415'); grd.addColorStop(0.5, '#5b3a1e'); grd.addColorStop(1, '#2d1a0d');
    g.fillStyle = grd; g.fillRect(0, 0, 400, 580);
    g.strokeStyle = 'rgba(214,175,110,0.55)'; g.lineWidth = 5;
    g.strokeRect(18, 18, 364, 544);
    g.strokeStyle = 'rgba(214,175,110,0.28)'; g.lineWidth = 2;
    g.strokeRect(34, 34, 332, 512);
    // 中央漩涡
    g.save(); g.translate(200, 290);
    g.strokeStyle = 'rgba(226,190,122,0.35)'; g.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 2 * 2; a += 0.12) {
        const rr = 8 + a * 11;
        const x = Math.cos(a + k * 1.26) * rr, y = Math.sin(a + k * 1.26) * rr;
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(233,203,146,0.9)';
    g.font = 'bold 118px "Yu Mincho", "Songti SC", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('遊', 200, 292);
    backTex = new T.CanvasTexture(c);
    backTex.encoding = T.sRGBEncoding;
    backTex.anisotropy = 8;
    return backTex;
  }

  /* ---------- 卡种配色 ---------- */
  const FRAME_COLOR = {
    spell: 0x2f9c78,
    trap: 0xa855f7,
    monster: 0xc98a45,
    boss: 0xe8bb54
  };

  /* ---------- 材质缓存 ---------- */
  const faceCache = {}, texCache = {};
  function faceMaterial(id, img) {
    if (faceCache[id]) return faceCache[id];
    let tex = texCache[id];
    if (!tex) {
      // 经 canvas 中转（比直接挂 DOM Image 更稳，且方便后续叠加效果）
      const c = document.createElement('canvas');
      c.width = IMG_W; c.height = IMG_H;
      c.getContext('2d').drawImage(img, 0, 0, IMG_W, IMG_H);
      tex = new T.CanvasTexture(c);
      tex.encoding = T.sRGBEncoding;
      tex.anisotropy = 8;
      texCache[id] = tex;
    }
    const m = new T.MeshStandardMaterial({
      map: tex, roughness: 0.62, metalness: 0.02
    });
    faceCache[id] = m;
    return m;
  }

  const matCache = {};
  function frameMaterial(kind, holo) {
    const key = kind + (holo ? '_h' : '');
    if (matCache[key]) return matCache[key];
    const m = new T.MeshStandardMaterial({
      color: FRAME_COLOR[kind] || 0xc9a06a,
      metalness: 0.92,
      roughness: holo ? 0.16 : 0.3,
      emissive: holo ? new T.Color(FRAME_COLOR[kind]).multiplyScalar(0.28) : new T.Color(0x000000)
    });
    matCache[key] = m;
    return m;
  }

  let paperMat = null;
  function paper() {
    if (!paperMat) paperMat = new T.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.88, metalness: 0.02 });
    return paperMat;
  }

  /* v0.4.1：卡背材质缓存（此前每 build 一张卡 new 一个材质） */
  let backMat = null;
  function backMaterial() {
    if (!backMat) backMat = new T.MeshStandardMaterial({ map: backTexture(), roughness: 0.7, metalness: 0.08 });
    return backMat;
  }

  /* ---------- 构建单张卡 ---------- */
  function build(id, img, kind) {
    const g3 = geometries();
    const group = new T.Group();
    group.name = 'card_' + id;

    const body = new T.Mesh(g3.body, paper());
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    // 正面卡图
    const face = new T.Mesh(g3.face, faceMaterial(id, img));
    face.position.z = TOP + 0.0012;
    group.add(face);

    // 背面
    const back = new T.Mesh(g3.back, backMaterial());
    back.position.z = -TOP - 0.0012;
    back.rotation.y = Math.PI;
    group.add(back);

    const holo = kind === 'boss';
    // 印刷外框 + 画框浮雕
    const of = new T.Mesh(g3.outerFrame, frameMaterial(kind, holo));
    /* v0.4.2b：外框不投影 —— 印刷框阴影与卡体完全重合（同轮廓），
     * 过去每张场上卡多耗一次阴影通道 draw call（ extrude 几何体并不轻） */
    group.add(of);
    const af = new T.Mesh(g3.artFrame, frameMaterial(kind, holo));
    group.add(af);

    // 幻神全息箔片
    if (holo) {
      const foil = new T.Mesh(g3.face, new T.MeshBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0.09,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      foil.position.z = TOP + 0.0035;
      foil.name = 'foil';
      group.add(foil);
    }
    group.userData.cardId = id;
    group.userData.kind = kind;
    return group;
  }

  global.Card3D = {
    W, H, THICK, ART, geometries, build,
    frameColor: FRAME_COLOR,
    /* 进场动画用的轻微倾斜姿态 */
    pose(mesh, t, i) {
      mesh.rotation.y = Math.sin(t * 0.7 + i * 0.55) * 0.32;
      mesh.rotation.x = Math.sin(t * 0.5 + i * 0.9) * 0.05;
    }
  };
})(window);
