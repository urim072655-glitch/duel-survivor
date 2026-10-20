/* ============================================================
   决斗幸存者 · DUEL SURVIVOR  v2
   游戏王主题 · 类吸血鬼幸存者 · 王家神殿 · 真实卡组抽卡
   ============================================================ */
(function () {
'use strict';
const T = THREE;
const V3 = T.Vector3;
const TAU = Math.PI * 2;
/* 版本号（主界面左上角展示） */
const GAME_VERSION = '0.4.2g';

/* ---------------- 工具 ---------------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const $ = id => document.getElementById(id);
const fmtTime = s => {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ---------------- 渲染基础 ---------------- */
const canvas = $('game');
/* v0.4.1：触屏检测提前到渲染器创建之前 —— 手机 GPU 填充率有限，MSAA 代价极高，直接关闭 */
const IS_COARSE = (() => {
  try {
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  } catch (e) { return false; }
})();
const renderer = new T.WebGLRenderer({ canvas, antialias: !IS_COARSE, powerPreference: 'high-performance' });
/* v0.4.0：触屏设备降载 —— 像素比上限 1.5 + 关阴影（手机 GPU 填充率有限） */
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_COARSE ? 1.5 : 2));
renderer.shadowMap.enabled = !IS_COARSE;
renderer.shadowMap.type = T.PCFSoftShadowMap;
if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;

const scene = new T.Scene();
scene.fog = new T.FogExp2(0x140d1a, 0.0088);
scene.background = new T.Color(0x0b0806);
scene.fog = new T.FogExp2(0x171009, 0.0115);

const camera = new T.PerspectiveCamera(52, 1, 0.1, 400);
camera.position.set(0, 18, 14);
camera.lookAt(0, 0, 0);
if (window.MODELS) MODELS.camera = camera;   // 卡牌立牌 billboard 朝向摄像机

let W = 1, H = 1;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  if (show3d) { show3d.cam.aspect = W / H; show3d.cam.updateProjectionMatrix(); }
}
window.addEventListener('resize', resize);
resize();

/* ---------------- 纹理 ---------------- */
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
const TEX_GLOW = glowTex();

/* 王家神殿地面 */
function templeFloorTex() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#5f4a30'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 16000; i++) {
    const a = Math.random() * 0.07;
    x.fillStyle = `rgba(${150 + Math.random() * 80 | 0},${110 + Math.random() * 60 | 0},${60 + Math.random() * 40 | 0},${a})`;
    const r = Math.random() * 2.4 + 0.6;
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, r, 0, TAU); x.fill();
  }
  x.strokeStyle = 'rgba(20,10,4,0.4)'; x.lineWidth = 2.4;
  for (let i = 0; i <= 8; i++) {
    const p = i * S / 8;
    x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.stroke();
    x.beginPath(); x.moveTo(0, p); x.lineTo(S, p); x.stroke();
  }
  for (let i = 0; i < 40; i++) {
    let px = Math.random() * S, py = Math.random() * S;
    x.strokeStyle = 'rgba(30,18,8,0.35)'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += rnd(-46, 46); py += rnd(-46, 46); x.lineTo(px, py); }
    x.stroke();
  }

  x.save(); x.translate(S / 2, S / 2);
  const G_ = '201,163,78', V_ = '232,168,92';
  [{ r: 332, w: 4, a: .55 }, { r: 318, w: 1.4, a: .4 }, { r: 300, w: 2.4, a: .42, c: V_ },
   { r: 228, w: 1.4, a: .34 }, { r: 152, w: 2.2, a: .32 }, { r: 80, w: 1.6, a: .34, c: V_ }]
  .forEach(o => {
    x.beginPath(); x.arc(0, 0, o.r, 0, TAU);
    x.strokeStyle = `rgba(${o.c || G_},${o.a})`; x.lineWidth = o.w; x.stroke();
  });
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU, r1 = 300, r2 = i % 5 === 0 ? 316 : 309;
    x.beginPath();
    x.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    x.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    x.strokeStyle = 'rgba(201,163,78,0.34)'; x.lineWidth = 2; x.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    x.beginPath();
    x.moveTo(Math.cos(a) * 90, Math.sin(a) * 90);
    x.lineTo(Math.cos(a) * 146, Math.sin(a) * 146);
    x.strokeStyle = 'rgba(232,168,92,0.14)'; x.lineWidth = 5; x.stroke();
  }
  x.lineWidth = 3;
  const tri = (r, alpha) => {
    x.beginPath();
    x.moveTo(0, r * 0.86); x.lineTo(-r * 0.75, -r * 0.5); x.lineTo(r * 0.75, -r * 0.5); x.closePath();
    x.strokeStyle = `rgba(${G_},${alpha})`; x.stroke();
  };
  tri(148, 0.6); tri(112, 0.45); tri(78, 0.4);
  for (let i = 0; i < 4; i++) {
    const y0 = 128 - i * 34, w = (148 - i * 20) * 0.72;
    x.beginPath(); x.moveTo(-w, y0); x.lineTo(w, y0);
    x.strokeStyle = 'rgba(201,163,78,0.3)'; x.lineWidth = 1.6; x.stroke();
  }
  x.beginPath(); x.ellipse(0, 6, 34, 16, 0, 0, TAU);
  x.strokeStyle = `rgba(${G_},0.65)`; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.arc(0, 6, 9, 0, TAU);
  x.fillStyle = 'rgba(201,163,78,0.5)'; x.fill();
  x.beginPath(); x.moveTo(-30, 12); x.quadraticCurveTo(-38, 30, -18, 34);
  x.strokeStyle = `rgba(${G_},0.55)`; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.moveTo(30, 12); x.quadraticCurveTo(38, 30, 18, 34); x.stroke();
  x.font = '20px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const glyphs = '𓂀𓃭𓆣𓅓𓊪𓋹𓇳𓈖𓎛𓌻𓁿𓄿𓍯𓏏𓎡𓄹';
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * TAU;
    x.save();
    x.translate(Math.cos(a) * 264, Math.sin(a) * 264);
    x.rotate(a + Math.PI / 2);
    x.fillStyle = 'rgba(201,163,78,0.3)';
    x.fillText(glyphs[i % glyphs.length], 0, 0);
    x.restore();
  }
  x.restore();

  const vg = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.56);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,3,1,0.9)');
  x.fillStyle = vg; x.fillRect(0, 0, S, S);

  const t = new T.CanvasTexture(c);
  if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
  return t;
}
function templeWallTex() {
  const w = 2048, h = 512, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#241609'); g.addColorStop(0.5, '#3d2a14'); g.addColorStop(1, '#1a0f06');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(10,5,2,0.55)'; x.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { const y = i * h / 8; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
  for (let i = 0; i < 32; i++) {
    const off = (i % 2) * 32;
    x.beginPath(); x.moveTo(i * 64 + off, 0); x.lineTo(i * 64 + off, h); x.stroke();
  }
  x.font = '52px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const glyphs = '𓂀𓃭𓆣𓅓𓊪𓋹𓇳𓈖𓎛𓌻𓁿𓄿𓍯𓏏𓎡𓄹𓇋𓐍𓅱𓏠𓈗𓊃𓏞𓎟';
  for (let i = 0; i < 44; i++) {
    x.fillStyle = i % 4 === 0 ? 'rgba(201,163,78,0.5)' : 'rgba(201,163,78,0.24)';
    x.fillText(glyphs[i % glyphs.length], 24 + i * 46, h * 0.42);
  }
  x.fillStyle = 'rgba(201,163,78,0.18)';
  x.fillRect(0, h * 0.56, w, 8);
  x.fillRect(0, h * 0.28, w, 4);
  const t = new T.CanvasTexture(c);
  t.wrapS = T.RepeatWrapping; t.repeat.set(4, 1);
  if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
  return t;
}

/* ---------------- 光照（夜景：整体压暗，让火光与金饰突出） ---------------- */
scene.add(new T.AmbientLight(0x6a4e30, 0.46));
scene.add(new T.HemisphereLight(0x5a4a72, 0x120b06, 0.38));
const moon = new T.DirectionalLight(0x8ea2cc, 0.55);
moon.position.set(-14, 26, 10);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -16; moon.shadow.camera.right = 16;
moon.shadow.camera.top = 16; moon.shadow.camera.bottom = -16;
moon.shadow.camera.near = 1; moon.shadow.camera.far = 70;
moon.shadow.bias = -0.0012;
scene.add(moon); scene.add(moon.target);
const rimL = new T.DirectionalLight(0xcc7a3a, 0.5);
rimL.position.set(14, 10, -16);
scene.add(rimL);
const playerLight = new T.PointLight(0xffc070, 1.5, 14, 1.6);
scene.add(playerLight);

/* ---------------- 场地：王家神殿（扩建 + 高低差） ---------------- */
const ARENA_R = 52;
const FLAT_R = 12;
function terrainH(x, z) {
  const d = Math.hypot(x, z);
  const k = clamp((d - FLAT_R) / 10, 0, 1);              // 中央魔法阵保持平整
  let h = Math.sin(x * 0.082) * Math.cos(z * 0.071) * 2.2
    + Math.sin(x * 0.19 + 1.7) * 0.7
    + Math.cos(z * 0.16 - 0.6) * 0.8;
  h *= k;
  h += Math.pow(clamp((d - 26) / 26, 0, 1), 1.7) * 7.2 * k;   // 外圈丘陵抬升
  // 两处高台
  h += Math.max(0, 3.4 - Math.hypot(x - 26, z + 14) * 0.55) * k;
  h += Math.max(0, 4.2 - Math.hypot(x + 24, z - 20) * 0.5) * k;
  return h;
}
function groundY(x, z) { return terrainH(x, z); }

function terrainTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#3a2c1c'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 38 + Math.random() * 44;
    x.fillStyle = 'rgba(' + (v + 40) + ',' + (v + 20) + ',' + (v - 10) + ',' + (0.05 + Math.random() * 0.16) + ')';
    const s = 2 + Math.random() * 26;
    x.fillRect(Math.random() * 512, Math.random() * 512, s, s * (0.4 + Math.random()));
  }
  x.strokeStyle = 'rgba(40,28,14,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke();
    x.beginPath(); x.moveTo(i * 64 + (i % 2) * 32, 0); x.lineTo(i * 64 + (i % 2) * 32, 512); x.stroke();
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(14, 14);
  t.anisotropy = 4;
  return t;
}

/* v0.4.2b：132→96 段 —— 地形基波波长 33~76 格，96 段（1.875 格/段）采样充裕，
 * 三角形 34848→18432（-47%），起伏观感无差 */
const groundGeo = new T.PlaneGeometry(180, 180, 96, 96);
groundGeo.rotateX(-Math.PI / 2);
{
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vz = pos.getZ(i);
    pos.setY(i, terrainH(vx, vz));
  }
  groundGeo.computeVertexNormals();
}
const ground = new T.Mesh(groundGeo, new T.MeshStandardMaterial({
  map: terrainTex(), roughness: 0.96, metalness: 0.04
}));
ground.receiveShadow = true;
scene.add(ground);

// 中央魔法阵石板（保持平整，作为决斗场中心）
const plate = new T.Mesh(
  new T.CircleGeometry(FLAT_R, 72),
  new T.MeshStandardMaterial({ map: templeFloorTex(), roughness: 0.9, metalness: 0.08 })
);
plate.rotation.x = -Math.PI / 2;
plate.position.y = 0.03;
plate.receiveShadow = true;
scene.add(plate);

// 边界光墙
function wallTex() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,190,90,0.55)');
  g.addColorStop(0.45, 'rgba(232,140,60,0.16)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 8, 128);
  return new T.CanvasTexture(c);
}
const boundary = new T.Mesh(
  new T.CylinderGeometry(ARENA_R, ARENA_R, 6, 96, 1, true),
  new T.MeshBasicMaterial({
    map: wallTex(), transparent: true, opacity: 0.75,
    side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending
  })
);
boundary.position.y = 3;
scene.add(boundary);
const boundary2 = new T.Mesh(
  new T.TorusGeometry(ARENA_R, 0.1, 6, 140),
  new T.MeshBasicMaterial({ color: 0xe8783a, transparent: true, opacity: 0.5 })
);
boundary2.rotation.x = -Math.PI / 2; boundary2.position.y = 0.08;
scene.add(boundary2);

const stoneMat = new T.MeshStandardMaterial({ color: 0x9a7a4e, roughness: 0.9, metalness: 0.03, flatShading: true });
const stoneDark = new T.MeshStandardMaterial({ color: 0x6b5030, roughness: 0.92, flatShading: true });
const stoneLight = new T.MeshStandardMaterial({ color: 0xb99a66, roughness: 0.85, metalness: 0.04, flatShading: true });
const goldMat = new T.MeshStandardMaterial({ color: 0xc9a34e, roughness: 0.3, metalness: 0.85 });
const flameMat = new T.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95 });
const flameGeo = new T.ConeGeometry(0.34, 1.1, 6);
const torchLights = [];
const flames = [];

/* ---- 象形文字浮雕带（程序化绘制，不依赖字体） ---- */
function drawGlyph(x, cx, cy, s, i) {
  x.save();
  x.translate(cx, cy);
  x.strokeStyle = 'rgba(24,14,6,0.85)';
  x.fillStyle = 'rgba(24,14,6,0.85)';
  x.lineWidth = Math.max(1, s * 0.09);
  const t = i % 7;
  if (t === 0) {                       // 安卡（生命之符）
    x.beginPath(); x.ellipse(0, -s * 0.28, s * 0.16, s * 0.22, 0, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(0, -s * 0.06); x.lineTo(0, s * 0.5); x.stroke();
    x.beginPath(); x.moveTo(-s * 0.26, s * 0.06); x.lineTo(s * 0.26, s * 0.06); x.stroke();
  } else if (t === 1) {                // 荷鲁斯之眼
    x.beginPath(); x.moveTo(-s * 0.3, 0); x.quadraticCurveTo(0, -s * 0.32, s * 0.3, 0);
    x.quadraticCurveTo(0, s * 0.2, -s * 0.3, 0); x.stroke();
    x.beginPath(); x.arc(0, -s * 0.04, s * 0.09, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(-s * 0.1, s * 0.14); x.lineTo(-s * 0.16, s * 0.36); x.stroke();
  } else if (t === 2) {                // 水波
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      for (let j = 0; j <= 6; j++) {
        const px = -s * 0.3 + j * s * 0.1, py = -s * 0.18 + k * s * 0.18 + Math.sin(j * 1.4) * s * 0.06;
        j ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    }
  } else if (t === 3) {                // 日轮
    x.beginPath(); x.arc(0, 0, s * 0.22, 0, TAU); x.stroke();
    x.beginPath(); x.arc(0, 0, s * 0.09, 0, TAU); x.fill();
  } else if (t === 4) {                // 鸟形
    x.beginPath(); x.moveTo(-s * 0.24, s * 0.24); x.lineTo(0, -s * 0.05); x.lineTo(s * 0.2, s * 0.22);
    x.stroke();
    x.beginPath(); x.moveTo(0, -s * 0.05); x.lineTo(s * 0.3, -s * 0.24); x.stroke();
  } else if (t === 5) {                // 方框（象形屋）
    x.strokeRect(-s * 0.22, -s * 0.2, s * 0.44, s * 0.4);
    x.beginPath(); x.moveTo(-s * 0.22, 0); x.lineTo(s * 0.22, 0); x.stroke();
  } else {                             // 蛇形
    x.beginPath();
    for (let j = 0; j <= 7; j++) {
      const px = -s * 0.3 + j * s * 0.09, py = Math.sin(j * 0.9) * s * 0.16;
      j ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  x.restore();
}
function hieroBandTex(rep) {
  const w = 768, h = 128, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a98552'); g.addColorStop(0.5, '#8d6a3e'); g.addColorStop(1, '#7a5a32');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {                 // 砂岩颗粒
    x.fillStyle = 'rgba(' + (180 + Math.random() * 50 | 0) + ',' + (150 + Math.random() * 40 | 0) + ',100,' + (0.03 + Math.random() * 0.09) + ')';
    x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2 + Math.random() * 4);
  }
  x.fillStyle = 'rgba(40,24,10,0.5)';
  x.fillRect(0, 0, w, 7); x.fillRect(0, h - 7, w, 7);
  x.fillStyle = 'rgba(201,163,78,0.35)';
  x.fillRect(0, 9, w, 2); x.fillRect(0, h - 11, w, 2);
  for (let i = 0; i < 12; i++) drawGlyph(x, 34 + i * 62, h / 2, 46, i);
  const t = new T.CanvasTexture(c);
  t.wrapS = T.RepeatWrapping;
  t.repeat.set(rep || 1, 1);
  if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
  return t;
}
const BAND_TEX = hieroBandTex(1);

/* ---- 莲花柱 ---- */
function templeColumn(h, r) {
  const g = new T.Group();
  const plinth = new T.Mesh(new T.BoxGeometry(r * 3.0, 0.55, r * 3.0), stoneDark);
  plinth.position.y = 0.28;
  const torus = new T.Mesh(new T.CylinderGeometry(r * 1.42, r * 1.55, 0.42, 16), stoneLight);
  torus.position.y = 0.75;
  const shaftM = new T.MeshStandardMaterial({ map: hieroBandTex(1), roughness: 0.9, metalness: 0.02 });
  shaftM.map.repeat.set(1, 3);
  const shaft = new T.Mesh(new T.CylinderGeometry(r * 0.86, r * 1.02, h, 10), shaftM);
  shaft.position.y = 0.96 + h / 2;
  const neck = new T.Mesh(new T.CylinderGeometry(r * 1.28, r * 0.9, 0.5, 12), stoneLight);
  neck.position.y = 0.96 + h + 0.18;
  // 莲花柱头
  const capital = new T.Group();
  capital.position.y = 0.96 + h + 0.62;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    const petal = new T.Mesh(new T.ConeGeometry(r * 0.42, r * 1.15, 4), stoneLight);
    petal.position.set(Math.cos(a) * r * 0.62, 0.1, Math.sin(a) * r * 0.62);
    petal.rotation.set(Math.cos(a) * 0.42, 0, -Math.sin(a) * 0.42);
    capital.add(petal);
  }
  const abacus = new T.Mesh(new T.BoxGeometry(r * 3.1, 0.5, r * 3.1), stoneDark);
  abacus.position.y = 0.98 + h + 0.95;
  [plinth, torus, shaft, neck, abacus].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
  g.add(plinth, torus, shaft, neck, capital, abacus);
  g.userData.top = 1.2 + h;
  return g;
}

/* ---- 翼日浮雕（神殿徽记） ---- */
function wingedSun(w) {
  const g = new T.Group();
  const disc = new T.Mesh(new T.CylinderGeometry(w * 0.16, w * 0.16, 0.16, 16), goldMat);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const feather = new T.Mesh(new T.BoxGeometry(w * (0.26 - i * 0.03), w * 0.05, 0.1), goldMat);
      feather.position.set(s * (w * 0.18 + i * w * 0.09), w * 0.03 - i * w * 0.028, 0);
      feather.rotation.z = s * (0.08 + i * 0.06);
      g.add(feather);
    }
  }
  return g;
}

/* ---- 楣梁（柱间横梁 + 象形带） ---- */
function architrave(x1, z1, x2, z2, y, w) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new T.Mesh(new T.BoxGeometry(len, w, 0.9), new T.MeshStandardMaterial({
    map: hieroBandTex(Math.max(1, Math.round(len / 6))), roughness: 0.9, flatShading: false
  }));
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

/* ---- 柱廊：16 根莲花柱 + 楣梁围合（半径 40，保证战斗中可见） ---- */
const COL_N = 16, COL_R = 40, COL_H = 10;
const colPts = [];
for (let i = 0; i < COL_N; i++) {
  const a = i / COL_N * TAU + Math.PI / COL_N;
  const cx = Math.cos(a) * COL_R, cz = Math.sin(a) * COL_R;
  const gy = groundY(cx, cz);
  const col = templeColumn(COL_H, 1.05);
  col.position.set(cx, gy, cz);
  col.rotation.y = -a;
  scene.add(col);
  colPts.push({ x: cx, z: cz, y: gy + col.userData.top });
}
for (let i = 0; i < COL_N; i++) {
  const a = colPts[i], b = colPts[(i + 1) % COL_N];
  architrave(a.x, a.z, b.x, b.z, a.y + 0.5, 1.15);
}
// 楣梁上的翼日徽记（四面各一）
for (let k = 0; k < 4; k++) {
  const a = k / 4 * TAU + Math.PI / 4;
  const ws = wingedSun(5.2);
  ws.position.set(Math.cos(a) * (COL_R - 0.9), COL_H + 2.6, Math.sin(a) * (COL_R - 0.9));
  ws.rotation.y = -a + Math.PI / 2;
  scene.add(ws);
}

/* ---- 塔门（北侧入口）+ 阶梯 ---- */
{
  const gz = -(COL_R + 1.5);
  const gate = new T.Group();
  const towerH = 17;
  for (const s of [-1, 1]) {
    const tower = new T.Mesh(new T.CylinderGeometry(3.1, 4.4, towerH, 4), stoneMat);
    tower.position.set(s * 6.6, towerH / 2, 0);
    tower.rotation.y = Math.PI / 4;
    tower.castShadow = true; tower.receiveShadow = true;
    gate.add(tower);
    const cap = new T.Mesh(new T.BoxGeometry(6.4, 0.7, 6.4), stoneDark);
    cap.position.set(s * 6.6, towerH + 0.3, 0);
    gate.add(cap);
    // 塔身象形带
    const band = new T.Mesh(new T.BoxGeometry(5.9, 2.4, 0.3), new T.MeshStandardMaterial({
      map: hieroBandTex(3), roughness: 0.9
    }));
    band.position.set(s * 6.6, towerH * 0.62, 2.5);
    gate.add(band);
    // 塔顶旗帜
    const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 4.2, 6), goldMat);
    pole.position.set(s * 6.6, towerH + 2.4, 0);
    gate.add(pole);
    const flag = new T.Mesh(new T.PlaneGeometry(2.6, 1.5), new T.MeshBasicMaterial({
      color: 0x8b1a2a, side: T.DoubleSide, transparent: true, opacity: 0.92
    }));
    flag.position.set(s * 6.6 + 1.3, towerH + 3.6, 0);
    gate.add(flag);
    flag.userData.wave = s;
  }
  // 门楣 + 翼日
  const lintel = new T.Mesh(new T.BoxGeometry(13.2, 1.6, 3.4), stoneLight);
  lintel.position.set(0, towerH * 0.86, 0);
  gate.add(lintel);
  const ws = wingedSun(7.4);
  ws.position.set(0, towerH * 0.86 + 1.7, 1.5);
  gate.add(ws);
  // 门洞（深色）
  const doorway = new T.Mesh(new T.PlaneGeometry(8.4, towerH * 0.78), new T.MeshBasicMaterial({
    color: 0x0a0603
  }));
  doorway.position.set(0, towerH * 0.39, 1.1);
  gate.add(doorway);
  gate.position.set(0, groundY(0, gz) - 1.2, gz);
  scene.add(gate);
  // 阶梯（从塔门延伸到场地）
  for (let i = 0; i < 6; i++) {
    const step = new T.Mesh(new T.BoxGeometry(15 - i * 0.6, 0.42, 1.5), i % 2 ? stoneDark : stoneMat);
    step.position.set(0, -0.9 + i * 0.42, gz + 3.6 + i * 1.5);
    step.receiveShadow = true; step.castShadow = true;
    scene.add(step);
  }
  // 大门两侧火盆柱
  for (const s of [-1, 1]) {
    const px = s * 9.8, pz = gz + 4.6;
    const py = groundY(px, pz);
    const post = new T.Mesh(new T.CylinderGeometry(0.34, 0.5, 4.4, 8), stoneDark);
    post.position.set(px, py + 2.2, pz);
    scene.add(post);
    const bowl = new T.Mesh(new T.CylinderGeometry(0.85, 0.4, 0.6, 10), goldMat);
    bowl.position.set(px, py + 4.6, pz);
    scene.add(bowl);
    const fl = new T.Mesh(flameGeo, flameMat);
    fl.position.set(px, py + 5.5, pz);
    fl.scale.setScalar(1.5);
    fl.userData.ph = s * 1.7;
    scene.add(fl); flames.push(fl);
    const pl = new T.PointLight(0xff8a30, 1.8, 22, 1.7);
    pl.position.set(px, py + 5.8, pz);
    scene.add(pl);
    torchLights.push(pl);
  }
}

/* ---- 法老坐像（塔门两侧，奥西里斯式） ---- */
function pharaohStatue(sc) {
  const g = new T.Group();
  const ped = new T.Mesh(new T.BoxGeometry(3.6, 1.5, 4.4), stoneDark);
  ped.position.y = 0.75;
  g.add(ped);
  const thighs = new T.Mesh(new T.BoxGeometry(3.0, 1.1, 3.6), stoneLight);
  thighs.position.set(0, 2.05, 0.4);
  g.add(thighs);
  const legs = new T.Mesh(new T.BoxGeometry(2.6, 1.5, 2.2), stoneLight);
  legs.position.set(0, 1.9, 2.0);
  g.add(legs);
  const torso = new T.Mesh(new T.CylinderGeometry(1.25, 1.5, 3.2, 4), stoneMat);
  torso.position.set(0, 4.0, 0.35);
  torso.rotation.y = Math.PI / 4;
  g.add(torso);
  // 交叉的弯钩与连枷
  for (const s of [-1, 1]) {
    const arm = new T.Mesh(new T.BoxGeometry(1.9, 0.42, 0.42), stoneLight);
    arm.position.set(0, 4.5, 1.15);
    arm.rotation.z = s * 0.42;
    g.add(arm);
    const tool = new T.Mesh(new T.BoxGeometry(0.22, 1.5, 0.22), goldMat);
    tool.position.set(s * 0.6, 4.7, 1.35);
    tool.rotation.z = s * 0.3;
    g.add(tool);
  }
  const head = new T.Mesh(new T.SphereGeometry(0.95, 10, 8), stoneLight);
  head.position.set(0, 6.2, 0.3);
  g.add(head);
  // 尼美斯头巾
  const nemes = new T.Mesh(new T.CylinderGeometry(1.35, 1.05, 1.5, 4), stoneMat);
  nemes.position.set(0, 6.15, 0.15);
  nemes.rotation.y = Math.PI / 4;
  g.add(nemes);
  for (const s of [-1, 1]) {
    const lappet = new T.Mesh(new T.BoxGeometry(0.55, 2.0, 0.4), stoneMat);
    lappet.position.set(s * 1.0, 5.3, 0.95);
    g.add(lappet);
  }
  // 王冠（阿特夫冠）
  const crown = new T.Mesh(new T.ConeGeometry(0.62, 2.2, 6), goldMat);
  crown.position.set(0, 7.6, 0.15);
  g.add(crown);
  const beard = new T.Mesh(new T.BoxGeometry(0.42, 1.1, 0.4), goldMat);
  beard.position.set(0, 5.55, 1.05);
  g.add(beard);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(sc || 1);
  return g;
}
[[-13.5, -(COL_R + 2.6)], [13.5, -(COL_R + 2.6)]].forEach(([sx, sz], i) => {
  const st = pharaohStatue(1.15);
  st.position.set(sx, groundY(sx, sz) - 0.6, sz);
  st.rotation.y = i === 0 ? 0.22 : -0.22;
  scene.add(st);
});

/* ---- 阿努比斯胡狼像（侧门守卫） ---- */
function jackalStatue() {
  const g = new T.Group();
  const ped = new T.Mesh(new T.BoxGeometry(1.9, 1.1, 3.0), stoneDark);
  ped.position.y = 0.55;
  g.add(ped);
  const body = new T.Mesh(new T.BoxGeometry(1.05, 1.35, 2.3), stoneMat);
  body.position.set(0, 1.75, -0.1);
  g.add(body);
  const chest = new T.Mesh(new T.BoxGeometry(1.0, 1.5, 0.9), stoneMat);
  chest.position.set(0, 2.1, 0.85);
  chest.rotation.x = -0.12;
  g.add(chest);
  const head = new T.Mesh(new T.BoxGeometry(0.78, 0.7, 1.5), stoneMat);
  head.position.set(0, 2.95, 1.35);
  g.add(head);
  const snout = new T.Mesh(new T.BoxGeometry(0.52, 0.38, 0.85), stoneLight);
  snout.position.set(0, 2.82, 2.1);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new T.Mesh(new T.ConeGeometry(0.19, 1.25, 4), stoneLight);
    ear.position.set(s * 0.34, 3.85, 1.1);
    ear.rotation.z = s * 0.12;
    g.add(ear);
    const paw = new T.Mesh(new T.BoxGeometry(0.34, 0.4, 0.9), stoneLight);
    paw.position.set(s * 0.34, 1.25, 1.35);
    g.add(paw);
  }
  const tail = new T.Mesh(new T.ConeGeometry(0.24, 1.5, 5), stoneMat);
  tail.position.set(0, 1.9, -1.45);
  tail.rotation.x = -0.55;
  g.add(tail);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
[[-24, -(COL_R - 6)], [24, -(COL_R - 6)], [-30, 8], [30, 8]].forEach(([sx, sz], i) => {
  const jk = jackalStatue();
  jk.position.set(sx, groundY(sx, sz), sz);
  jk.rotation.y = Math.atan2(-sx, -sz) + (i % 2 ? 0.1 : -0.1);
  jk.scale.setScalar(1.3);
  scene.add(jk);
});

/* ---- 千年石板（三幻神浮雕，悬挂于塔门内侧） ---- */
{
  const tx = 0, tz = -(COL_R - 2.5), ty = groundY(tx, tz);
  const slab = new T.Group();
  const board = new T.Mesh(new T.BoxGeometry(9.2, 11.5, 0.7), stoneDark);
  board.castShadow = true; board.receiveShadow = true;
  slab.add(board);
  const frame = new T.Mesh(new T.BoxGeometry(9.9, 12.2, 0.45), goldMat);
  frame.position.z = -0.25;
  slab.add(frame);
  // 三幻神浮雕
  const gods = [
    { y: 3.3, c: 0x2f5fae },   // 巨神兵
    { y: 0.4, c: 0xc4342a },   // 天空龙
    { y: -2.6, c: 0xd8a832 }   // 翼神龙
  ];
  const glyphTex = hieroBandTex(2);
  gods.forEach((g0, i) => {
    const relief = new T.Mesh(new T.BoxGeometry(6.6, 2.4, 0.3),
      new T.MeshStandardMaterial({ color: g0.c, roughness: 0.6, metalness: 0.35, emissive: g0.c, emissiveIntensity: 0.35 }));
    relief.position.set(0, g0.y, 0.42);
    slab.add(relief);
    const nm = new T.Mesh(new T.PlaneGeometry(6.2, 0.9), new T.MeshBasicMaterial({
      map: glyphTex, transparent: true, opacity: 0.85
    }));
    nm.position.set(0, g0.y - 1.5, 0.42);
    slab.add(nm);
  });
  const glow = new T.PointLight(0xffcf6a, 2.2, 26, 1.6);
  glow.position.set(0, 0.5, 3);
  slab.add(glow);
  slab.position.set(tx, ty + 8.2, tz);
  slab.rotation.y = Math.PI;
  scene.add(slab);
  const halo = new T.Mesh(new T.TorusGeometry(6.6, 0.09, 6, 60),
    new T.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: 0.5 }));
  halo.position.set(tx, ty + 8.2, tz + 0.9);
  scene.add(halo);
}

/* ---- 四方方尖碑 + 铭文 ---- */
[[26, -14], [-24, 20], [30, 26], [-32, -26]].forEach(([ox, oz]) => {
  const gy = groundY(ox, oz);
  const base = new T.Mesh(new T.BoxGeometry(2.6, 1.0, 2.6), stoneDark);
  base.position.set(ox, gy + 0.5, oz);
  base.castShadow = true; base.receiveShadow = true;
  scene.add(base);
  const ob = new T.Mesh(new T.CylinderGeometry(0.42, 0.92, 9, 4), new T.MeshStandardMaterial({
    map: hieroBandTex(1), roughness: 0.85, metalness: 0.06
  }));
  ob.position.set(ox, gy + 5.2, oz);
  ob.rotation.y = Math.PI / 4;
  ob.castShadow = true; ob.receiveShadow = true;
  scene.add(ob);
  const tip = new T.Mesh(new T.ConeGeometry(0.46, 1.1, 4), goldMat);
  tip.position.set(ox, gy + 10.2, oz);
  tip.rotation.y = Math.PI / 4;
  scene.add(tip);
  const gl = new T.PointLight(0xffb040, 1.6, 18, 1.7);
  gl.position.set(ox, gy + 11, oz);
  scene.add(gl);
});

/* ---- 遗迹残件（断柱、倒下的柱头） ---- */
for (let i = 0; i < 18; i++) {
  const a = rnd(0, TAU), r = rnd(18, 46);
  const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
  const gy = groundY(bx, bz);
  if (i % 3 === 0) {
    const drum = new T.Mesh(new T.CylinderGeometry(0.9, 0.95, 0.9, 10), stoneMat);
    drum.position.set(bx, gy + 0.42, bz);
    drum.rotation.set(rnd(-0.2, 0.2), rnd(0, TAU), rnd(-0.3, 0.3));
    drum.castShadow = true; drum.receiveShadow = true;
    scene.add(drum);
  } else {
    const shard = new T.Mesh(new T.BoxGeometry(rnd(1.0, 2.4), rnd(0.4, 1.0), rnd(0.9, 2.0)), stoneDark);
    shard.position.set(bx, gy + 0.32, bz);
    shard.rotation.set(rnd(-0.18, 0.18), rnd(0, TAU), rnd(-0.18, 0.18));
    shard.castShadow = true; shard.receiveShadow = true;
    scene.add(shard);
  }
}


/* ---- 场景归组：神殿装饰纳入 arenaGroup；地面/边界/灯光常驻 scene ---- */
const arenaGroup = new T.Group();
{
  const keepAlways = new Set([ground, plate, boundary, boundary2, moon, moon.target, rimL, playerLight]);
  const list = scene.children.slice();
  for (const o of list) {
    scene.remove(o);
    if (keepAlways.has(o) || o.isLight) scene.add(o);
    else arenaGroup.add(o);
  }
}
scene.add(arenaGroup);

/* ---- 其余两关的场景装饰（构建时隐藏，进关时切换） ---- */
const decorKingdom = new T.Group();
const decorCity = new T.Group();
function buildLevelDecor() {
  /* 决斗者王国：星光孤岛 · 佩加索斯城堡 */
  {
    const cas = new T.Group();
    const cMat = new T.MeshStandardMaterial({ color: 0xcfd8e8, roughness: 0.8, flatShading: true });
    const rMat = new T.MeshStandardMaterial({ color: 0x2a6cb0, roughness: 0.6 });
    // 主堡（北侧远端）
    const keep = new T.Mesh(new T.CylinderGeometry(6, 7.5, 22, 8), cMat);
    keep.position.set(0, 11, -46); cas.add(keep);
    const keepRoof = new T.Mesh(new T.ConeGeometry(7.5, 7, 8), rMat);
    keepRoof.position.set(0, 25.5, -46); cas.add(keepRoof);
    const spire = new T.Mesh(new T.ConeGeometry(1.1, 6, 6), goldMat);
    spire.position.set(0, 32, -46); cas.add(spire);
    for (const s of [-1, 1]) {
      const tw = new T.Mesh(new T.CylinderGeometry(2.4, 3, 14, 6), cMat);
      tw.position.set(s * 10, 7, -44); cas.add(tw);
      const twr = new T.Mesh(new T.ConeGeometry(3.2, 5, 6), rMat);
      twr.position.set(s * 10, 16.5, -44); cas.add(twr);
      const wall = new T.Mesh(new T.BoxGeometry(9, 7, 2), cMat);
      wall.position.set(s * 5, 3.5, -40); cas.add(wall);
    }
    decorKingdom.add(cas);
    // 树木与发光蘑菇（环带）
    const trunkM = new T.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.9, flatShading: true });
    const leafM = new T.MeshStandardMaterial({ color: 0x2f7a44, roughness: 0.85, flatShading: true });
    const shroomM = new T.MeshStandardMaterial({ color: 0x8affc0, emissive: 0x2bd48f, emissiveIntensity: 1.1 });
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU + 0.2, r = rnd(30, 46);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const g = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.25, 0.4, 1.8, 5), trunkM);
      trunk.position.y = 0.9; g.add(trunk);
      const leaf = new T.Mesh(new T.ConeGeometry(1.5, 3.4, 6), leafM);
      leaf.position.y = 3.2; g.add(leaf);
      g.position.set(x, groundY(x, z), z);
      decorKingdom.add(g);
      if (i % 3 === 0) {
        const sh = new T.Mesh(new T.SphereGeometry(0.22, 6, 5), shroomM);
        sh.position.set(-Math.cos(a) * 2.4, groundY(x, z) + 0.2, -Math.sin(a) * 2.4);
        decorKingdom.add(sh);
      }
    }
  }
  decorKingdom.visible = false;
  scene.add(decorKingdom);
  /* 战斗都市：海马都市 · 霓虹高楼夜景 */
  {
    const bMat = new T.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.7, metalness: 0.2 });
    const winC = document.createElement('canvas');
    winC.width = 64; winC.height = 128;
    const wx = winC.getContext('2d');
    wx.fillStyle = '#141a28'; wx.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 124; y += 8) {
      for (let x = 4; x < 60; x += 8) {
        if (Math.random() < 0.42) {
          wx.fillStyle = Math.random() < 0.8 ? '#ffd98a' : '#7fd4ff';
          wx.fillRect(x, y, 4, 5);
        }
      }
    }
    const winT = new T.CanvasTexture(winC);
    winT.wrapS = winT.wrapT = T.RepeatWrapping;
    const winM = new T.MeshStandardMaterial({ map: winT, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: 0.55, roughness: 0.6 });
    for (let i = 0; i < 44; i++) {
      const a = i / 44 * TAU, r = rnd(30, 47);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = rnd(8, 22), w2 = rnd(4, 7);
      const b = new T.Mesh(new T.BoxGeometry(w2, h, w2), i % 2 ? winM : bMat);
      b.position.set(x, groundY(x, z) + h / 2, z);
      b.rotation.y = -a;
      decorCity.add(b);
    }
    // KC 塔楼（中央地标，蓝光带）
    const kc = new T.Group();
    const kcB = new T.Mesh(new T.BoxGeometry(9, 34, 9), bMat);
    kcB.position.y = 17; kc.add(kcB);
    for (let k = 0; k < 5; k++) {
      const band = new T.Mesh(new T.BoxGeometry(9.3, 0.5, 9.3),
        new T.MeshBasicMaterial({ color: 0x5aa8ff }));
      band.position.y = 6 + k * 6.4; kc.add(band);
    }
    const kcTop = new T.Mesh(new T.ConeGeometry(5.5, 6, 4),
      new T.MeshStandardMaterial({ color: 0x2a3a5c, emissive: 0x5aa8ff, emissiveIntensity: 0.4 }));
    kcTop.position.y = 37; kc.add(kcTop);
    kc.position.set(0, 0, -44);
    decorCity.add(kc);
    // 路灯
    const lampM = new T.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd166, emissiveIntensity: 1.4 });
    const poleM = new T.MeshStandardMaterial({ color: 0x30363f, roughness: 0.6 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + 0.26, r = 26;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 3.4, 5), poleM);
      pole.position.set(x, groundY(x, z) + 1.7, z);
      const lamp = new T.Mesh(new T.SphereGeometry(0.24, 6, 5), lampM);
      lamp.position.set(x, groundY(x, z) + 3.5, z);
      decorCity.add(pole, lamp);
    }
  }
  decorCity.visible = false;
  scene.add(decorCity);
}
buildLevelDecor();

/* ---- 进关切换场景主题 ---- */
function applyLevelScene(id) {
  arenaGroup.visible = id === 'temple';
  decorKingdom.visible = id === 'kingdom';
  decorCity.visible = id === 'city';
  if (id === 'kingdom') {
    scene.fog = new T.FogExp2(0x0a1810, 0.0125);
    scene.background = new T.Color(0x040a07);
    ground.material.color.set(0x86b878);
    plate.material.color.set(0x9fd89a);
    boundary2.material.color.set(0x51e88a);
  } else if (id === 'city') {
    scene.fog = new T.FogExp2(0x0a0c1c, 0.012);
    scene.background = new T.Color(0x05060f);
    ground.material.color.set(0x8a92a8);
    plate.material.color.set(0x9fb2d8);
    boundary2.material.color.set(0x5aa8ff);
  } else {
    scene.fog = new T.FogExp2(0x171009, 0.0115);
    scene.background = new T.Color(0x0b0806);
    ground.material.color.set(0xffffff);
    plate.material.color.set(0xffffff);
    boundary2.material.color.set(0xe8783a);
  }
}

/* ---------------- 模型：黑魔导 ---------------- */
function buildMagician() {
  const g = new T.Group();
  const robeM = new T.MeshStandardMaterial({ color: 0x3d2270, roughness: 0.72, metalness: 0.18, flatShading: true });
  const robe2M = new T.MeshStandardMaterial({ color: 0x2a164d, roughness: 0.7, metalness: 0.2, flatShading: true });
  const trimM = new T.MeshStandardMaterial({ color: 0xc9a34e, roughness: 0.32, metalness: 0.9, flatShading: true });
  const skinM = new T.MeshStandardMaterial({ color: 0xe8cba9, roughness: 0.62 });
  const hatM = new T.MeshStandardMaterial({ color: 0x24134a, roughness: 0.68, flatShading: true });
  const glowM = new T.MeshStandardMaterial({ color: 0xb07bff, emissive: 0x8b5cf6, emissiveIntensity: 2.6, roughness: 0.18 });

  const robe = new T.Mesh(new T.ConeGeometry(0.62, 1.46, 10), robeM); robe.position.y = 0.73;
  const hem = new T.Mesh(new T.ConeGeometry(0.64, 0.16, 10), trimM); hem.position.y = 0.08;
  const torso = new T.Mesh(new T.CylinderGeometry(0.3, 0.5, 0.62, 10), robe2M); torso.position.y = 1.42;
  const belt = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.1, 10), trimM); belt.position.y = 1.18;
  const shoulderL = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), robeM); shoulderL.position.set(-0.34, 1.66, 0); shoulderL.scale.set(1.1, 0.85, 1.1);
  const shoulderR = shoulderL.clone(); shoulderR.position.x = 0.34;
  const neck = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.16, 8), skinM); neck.position.y = 1.79;
  const head = new T.Mesh(new T.SphereGeometry(0.235, 10, 8), skinM); head.position.y = 1.98;
  const eyeL = new T.Mesh(new T.SphereGeometry(0.032, 6, 5), glowM); eyeL.position.set(-0.085, 2.0, 0.205);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.085;
  const hatBrim = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.05, 12), trimM); hatBrim.position.y = 2.15;
  const hat = new T.Mesh(new T.ConeGeometry(0.4, 0.86, 10), hatM); hat.position.set(0, 2.58, -0.03); hat.rotation.x = -0.2;
  const hatGem = new T.Mesh(new T.OctahedronGeometry(0.1), glowM); hatGem.position.set(0, 2.26, 0.36);
  const cape = new T.Mesh(new T.PlaneGeometry(0.95, 1.2), new T.MeshStandardMaterial({
    color: 0x1e0f3a, roughness: 0.85, side: T.DoubleSide, flatShading: true
  }));
  cape.position.set(0, 1.16, -0.42); cape.rotation.x = 0.14;

  const staff = new T.Group();
  const shaft = new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 2.3, 8), trimM); shaft.position.y = 1.15;
  const orb = new T.Mesh(new T.IcosahedronGeometry(0.17, 1), glowM); orb.position.y = 2.4;
  const ringA = new T.Mesh(new T.TorusGeometry(0.27, 0.022, 5, 16), trimM); ringA.position.y = 2.4;
  const ringB = ringA.clone(); ringB.rotation.y = Math.PI / 2;
  staff.add(shaft, orb, ringA, ringB);
  staff.position.set(0.62, 0.06, 0.12);
  staff.rotation.z = -0.13;

  g.add(robe, hem, torso, belt, shoulderL, shoulderR, neck, head, eyeL, eyeR, hatBrim, hat, hatGem, cape, staff);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.orb = orb; g.userData.ringA = ringA; g.userData.ringB = ringB;
  g.userData.kind = 'magician';
  return g;
}

/* ---------------- 模型：龙 ---------------- */
let WING_GEO = null;
function wingShape() {
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.55, 0.62);
  s.lineTo(1.5, 0.78);
  s.lineTo(1.42, 0.18);
  s.lineTo(1.62, -0.1);
  s.lineTo(1.1, -0.3);
  s.lineTo(0.72, -0.26);
  s.lineTo(0.28, -0.1);
  s.lineTo(0, 0);
  return new T.ShapeGeometry(s);
}
function buildDragon(cfg) {
  const g = new T.Group();
  const bodyM = new T.MeshStandardMaterial({ color: cfg.body, roughness: 0.58, metalness: 0.22, flatShading: true });
  const bellyM = new T.MeshStandardMaterial({ color: cfg.belly, roughness: 0.7, metalness: 0.1, flatShading: true });
  const hornM = new T.MeshStandardMaterial({ color: cfg.horn, roughness: 0.42, metalness: 0.5, flatShading: true });
  const eyeM = new T.MeshStandardMaterial({ color: cfg.eye, emissive: cfg.eye, emissiveIntensity: 2.4, roughness: 0.2 });
  const wingM = new T.MeshStandardMaterial({
    color: cfg.wing, roughness: 0.72, metalness: 0.1, flatShading: true,
    side: T.DoubleSide, transparent: true, opacity: 0.94
  });
  if (!WING_GEO) WING_GEO = wingShape();

  const torso = new T.Mesh(new T.SphereGeometry(0.56, 10, 8), bodyM);
  torso.position.set(0, 1.02, 0); torso.scale.set(1.05, 0.98, 1.4);
  const chest = new T.Mesh(new T.SphereGeometry(0.42, 8, 6), bellyM);
  chest.position.set(0, 0.92, 0.28); chest.scale.set(0.85, 0.8, 0.9);
  const n1 = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), bodyM); n1.position.set(0, 1.3, 0.5);
  const n2 = new T.Mesh(new T.SphereGeometry(0.26, 8, 6), bodyM); n2.position.set(0, 1.6, 0.78);
  const n3 = new T.Mesh(new T.SphereGeometry(0.23, 8, 6), bodyM); n3.position.set(0, 1.86, 1.0);
  const head = new T.Mesh(new T.BoxGeometry(0.44, 0.34, 0.56), bodyM); head.position.set(0, 2.0, 1.24);
  const snout = new T.Mesh(new T.BoxGeometry(0.3, 0.19, 0.34), bodyM); snout.position.set(0, 1.95, 1.58);
  const jaw = new T.Mesh(new T.BoxGeometry(0.28, 0.09, 0.3), bellyM); jaw.position.set(0, 1.85, 1.55);
  const browL = new T.Mesh(new T.BoxGeometry(0.1, 0.07, 0.2), hornM); browL.position.set(-0.16, 2.16, 1.36); browL.rotation.z = 0.2;
  const browR = browL.clone(); browR.position.x = 0.16; browR.rotation.z = -0.2;
  const hornL = new T.Mesh(new T.ConeGeometry(0.07, 0.52, 6), hornM);
  hornL.position.set(-0.17, 2.28, 1.1); hornL.rotation.set(0.55, 0, 0.32);
  const hornR = hornL.clone(); hornR.position.x = 0.17; hornR.rotation.z = -0.32;
  const eyeL = new T.Mesh(new T.SphereGeometry(0.062, 6, 5), eyeM); eyeL.position.set(-0.155, 2.03, 1.47);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.155;
  const hornTop = new T.Mesh(new T.ConeGeometry(0.055, 0.34, 5), hornM);
  hornTop.position.set(0, 2.3, 1.28); hornTop.rotation.x = -0.25;
  const spikes = [];
  for (let i = 0; i < 4; i++) {
    const s = new T.Mesh(new T.ConeGeometry(0.09, 0.3 - i * 0.04, 5), hornM);
    s.position.set(0, 1.55 - i * 0.06, 0.18 - i * 0.34); s.rotation.x = -0.35;
    spikes.push(s);
  }
  const t1 = new T.Mesh(new T.ConeGeometry(0.2, 0.7, 6), bodyM); t1.position.set(0, 0.92, -0.85); t1.rotation.x = Math.PI / 2 - 0.15;
  const t2 = new T.Mesh(new T.ConeGeometry(0.13, 0.7, 6), bodyM); t2.position.set(0, 0.82, -1.4); t2.rotation.x = Math.PI / 2 - 0.1;
  const t3 = new T.Mesh(new T.ConeGeometry(0.075, 0.6, 5), hornM); t3.position.set(0, 0.74, -1.9); t3.rotation.x = Math.PI / 2;
  const legs = [];
  [[-0.4, 0.42], [0.4, 0.42], [-0.38, -0.34], [0.38, -0.34]].forEach(p => {
    const l = new T.Mesh(new T.CylinderGeometry(0.13, 0.16, 0.66, 6), bodyM);
    l.position.set(p[0], 0.38, p[1]);
    const f = new T.Mesh(new T.BoxGeometry(0.24, 0.12, 0.3), hornM);
    f.position.set(p[0], 0.09, p[1] + 0.06);
    legs.push(l, f);
  });
  const wings = [];
  for (const sgn of [-1, 1]) {
    const w = new T.Group();
    const membrane = new T.Mesh(WING_GEO, wingM);
    membrane.scale.set(sgn * 1, 1, 1);
    const bone1 = new T.Mesh(new T.CylinderGeometry(0.045, 0.06, 1.6, 5), hornM);
    bone1.position.set(sgn * 0.72, 0.42, 0); bone1.rotation.z = sgn * Math.PI / 2 - sgn * 0.42;
    const bone2 = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 1.1, 5), hornM);
    bone2.position.set(sgn * 0.5, 0.1, 0.05); bone2.rotation.z = sgn * 1.1;
    w.add(membrane, bone1, bone2);
    w.position.set(sgn * 0.38, 1.42, -0.05);
    w.rotation.z = sgn * 0.16;
    w.userData.base = w.rotation.z;
    wings.push(w);
  }
  g.add(torso, chest, n1, n2, n3, head, snout, jaw, browL, browR, hornL, hornR, eyeL, eyeR, hornTop,
    t1, t2, t3, ...spikes, ...legs, ...wings);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.wings = wings;
  g.userData.kind = 'dragon';
  return g;
}
const DRAGON_CFG = {
  blueeyes: { body: 0xeef4ff, belly: 0xd6e6f7, horn: 0xa9c9e8, eye: 0x38bdf8, wing: 0x8fd8ff },
  redeyes: { body: 0x1a1a24, belly: 0x2c2c38, horn: 0x7f1d1d, eye: 0xff2b2b, wing: 0x3f0f18 }
};

/* ---------------- 卡图加载 ---------------- */
const imgCache = {};
function loadImg(id) {
  return new Promise((res, rej) => {
    if (imgCache[id]) return res(imgCache[id]);
    const im = new Image();
    im.onload = () => { imgCache[id] = im; res(im); };
    im.onerror = () => rej(new Error('card img load failed: ' + id));
    const src = (window.__cardImg && window.__cardImg(id)) || ('data/cardimg/' + id + '.jpg');
    /* 远程图必须 CORS 授权，否则 canvas 会被污染 → WebGL 纹理全黑（浮雕卡牌变纯黑）。
     * 加载失败时走无图回退（立体建模），绝不使用被污染的图。 */
    if (src.indexOf('data:') !== 0 && src.indexOf('data/cardimg/') !== 0) im.crossOrigin = 'anonymous';
    im.src = src;
  });
}
const artCache = {};
const ART_BOX = { x: 46, y: 102, w: 308, h: 325 };
function artTexture(id, aspect) {
  const key = id + '|' + aspect;
  if (artCache[key]) return artCache[key];
  const im = imgCache[id];
  if (!im) return null;
  let sx = ART_BOX.x, sy = ART_BOX.y, sw = ART_BOX.w, sh = ART_BOX.h;
  const target = aspect, src = sw / sh;
  if (src > target) { const nw = sh * target; sx += (sw - nw) / 2; sw = nw; }
  else { const nh = sw / target; sy += (sh - nh) / 2; sh = nh; }
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 / target);
  const x = c.getContext('2d');
  let t;
  try {
    x.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    t = new T.CanvasTexture(c);
  } catch (e) {
    return null;                 // 跨域卡图（CDN）无法读画布时退回纯色卡背
  }
  if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
  t.minFilter = T.LinearFilter;
  artCache[key] = t;
  return t;
}

/* ---------------- 角色数据（决斗者） ---------------- */
const CHARS = {
  yugi: {
    id: 'yugi', name: '武藤游戏', title: '千年积木的持有者', glyph: '遊',
    lp: 8000, speed: 5.6, color: 0x8b5cf6, hue: 268,
    deck: 'yugi', starter: 40640057, ace: 46986414,
    ultName: '黑·魔·导', ultGlyph: '魔', ultKind: 'meteor',
    trait: '魔法师 · 检索与特招',
    desc: '以黑魔导为核心的魔法师牌组。擅长检索与特殊召唤，擅长用魔法清扫战场。',
    tags: ['王牌 黑魔导', '魔法特招', '检索']
  },
  joey: {
    id: 'joey', name: '城之内克也', title: '凡骨的决斗者', glyph: '城',
    lp: 8000, speed: 5.2, color: 0xd85a30, hue: 20,
    deck: 'joey', starter: 88819587, ace: 74677422,
    ultName: '黑炎·狱炎弹', ultGlyph: '炎', ultKind: 'inferno',
    trait: '战士与龙 · 攻击压制',
    desc: '真红眼黑龙与战士族的混合牌组。依靠高攻击力怪兽正面压制，直觉型打法。',
    tags: ['王牌 真红眼黑龙', '高攻', '战士']
  },
  kaiba: {
    id: 'kaiba', name: '海马濑人', title: 'KC 社长', glyph: '海',
    lp: 8000, speed: 5.0, color: 0x4a7fe0, hue: 210,
    deck: 'kaiba', starter: 11321183, ace: 89631139,
    ultName: '毁灭之爆裂疾风弹', ultGlyph: '爆', ultKind: 'burst',
    trait: '青眼白龙 · 高星压制',
    desc: '以青眼白龙为绝对王牌的牌组。需要祭品堆积，但一旦登场便是绝对火力。',
    tags: ['王牌 青眼白龙', '高星', '龙']
  }
};

/* ---------------- 关卡数据 ---------------- */
/* bosses: { key, t, recId, label, hp, dmg, spd, scale, color, moves, tip, hpMul, dmgMul, failAfter } */
const LEVELS = [
  {
    id: 'temple', name: '王家神殿', en: 'TEMPLE OF THE KINGS', glyph: '神',
    sub: '三幻神沉睡的圣域', desc: '武藤游戏与无名法老王最后对决之地',
    duration: 480, pharaohAt: 480,
    bosses: [
      { key: 'obelisk', t: 120, recId: 10000000, hpMul: 1, dmgMul: 1 },
      { key: 'slifer', t: 240, recId: 10000020, hpMul: 1.35, dmgMul: 1.18 },
      { key: 'ra', t: 360, recId: 10000010, hpMul: 1.8, dmgMul: 1.36 }
    ],
    winText: '你击败了无名法老王，守住了王家神殿'
  },
  {
    id: 'kingdom', name: '决斗者王国', en: 'DUELIST KINGDOM', glyph: '王',
    sub: '幻之决斗孤岛', desc: '佩加索斯城堡下的星光决斗',
    duration: 480,
    bosses: [
      { key: 'skull', t: 110, recId: 70781052, label: '恶魔召唤', hp: 12000, dmg: 700, spd: 2.3, scale: 2.9, color: 0x9a4ae0, moves: ['fist', 'quake'], tip: '恶魔之拳 · 大地粉碎' },
      { key: 'bewd', t: 230, recId: 89631139, label: '青眼白龙', hp: 20000, dmg: 800, spd: 2.7, scale: 3.0, color: 0x4fa8e8, moves: ['breath', 'thunder'], tip: '破坏的咆哮 · 闪电风暴' },
      { key: 'gate', t: 350, recId: 98434877, label: '门之守护者', hp: 38000, dmg: 900, spd: 2.0, scale: 3.4, color: 0x51e88a, moves: ['quake', 'sun', 'breath'], tip: '死之磁圈 · 三合一雷击', phases: 3 }
    ],
    winText: '你穿越了决斗者王国，下一座舞台是战斗都市'
  },
  {
    id: 'city', name: '战斗都市', en: 'BATTLE CITY', glyph: '海',
    sub: '海马都市 · 夜战', desc: '霓虹高楼间的传说之决斗',
    duration: 480,
    bosses: [
      { key: 'bewd2', t: 100, recId: 89631139, label: '青眼白龙 · 改', hp: 16000, dmg: 860, spd: 3.0, scale: 3.0, color: 0x60c8ff, moves: ['breath', 'thunder'], tip: '强化咆哮' },
      { key: 'ultdy', t: 220, recId: 23995346, label: '青眼究极龙', hp: 42000, dmg: 980, spd: 2.3, scale: 3.6, color: 0x8fd4ff, moves: ['breath', 'sun', 'pillar'], tip: '破灭的爆裂疾风弹',
        failAfter: 70, failTitle: '破灭的爆裂疾风弹', failSub: '青眼究极龙的疾风弹轰穿了整座都市 —— 没有决斗者能在三连白光下存续' },
      { key: 'chmax', t: 340, recId: 55410871, label: '青眼混沌极龙', hp: 52000, dmg: 1080, spd: 2.2, scale: 3.5, color: 0xb08cff, moves: ['quake', 'sun', 'pillar'], tip: '混沌之炎 · 极龙咆哮', phases: 3 }
    ],
    winText: '你称霸了战斗都市 —— 海马都市的夜空为你而亮'
  }
];
/* 各关 Boss 元数据与卡片记录：进关时注入 BOSS_META / GOD_REC */
function injectLevelBosses(lv) {
  for (const b of (lv.bosses || [])) {
    if (!b.label) continue;
    BOSS_META[b.key] = {
      label: b.label, hp: b.hp, dmg: b.dmg, spd: b.spd,
      color: b.color, scale: b.scale, moves: b.moves, tip: b.tip
    };
    GOD_REC[b.key] = { id: b.recId, name: b.label, race: 'Dragon', level: 8, kind: 'effect' };
  }
}
const BOSS_META = {
  obelisk: {
    label: '欧贝利斯克的巨神兵', hp: 9000, dmg: 620, spd: 2.15, color: 0x4a7fe0,
    scale: 3.1, moves: ['fist', 'quake'], tip: '巨神兵拳 · 大地粉碎'
  },
  slifer: {
    label: '奥西里斯的天空龙', hp: 17000, dmg: 720, spd: 2.5, color: 0xe04a3a,
    scale: 3.2, moves: ['thunder', 'breath'], tip: '召雷弹 · 雷之吹息'
  },
  ra: {
    label: '太阳神之翼神龙', hp: 26000, dmg: 820, spd: 2.2, color: 0xe0a83a,
    scale: 3.3, moves: ['pillar', 'sun'], tip: '神炎加农 · 太阳烈焰'
  },
  pharaoh: {
    label: '无名的法老王', hp: 34000, dmg: 950, spd: 1.7, color: 0xffd166,
    scale: 2.5, moves: ['scepter', 'godCall'], tip: '千年锡杖 · 幻神降临'
  }
};
BOSS_META.rival = {
  label: '对决者', hp: 8000, dmg: 640, spd: 3.0, color: 0x8b5cf6,
  scale: 1.35, moves: ['duel'], tip: '王牌攻击'
};
BOSS_META.ace = {
  label: '王牌守护', hp: 4200, dmg: 520, spd: 2.0, color: 0xc9a06a,
  scale: 2.2, moves: ['aceBeam'], tip: '必杀攻击'
};
const GOD_REC = {
  obelisk: { id: 10000000, name: '欧贝利斯克的巨神兵', race: 'Divine-Beast', level: 10, kind: 'effect' },
  slifer: { id: 10000020, name: '奥西里斯的天空龙', race: 'Divine-Beast', level: 10, kind: 'effect' },
  ra: { id: 10000010, name: '太阳神之翼神龙', race: 'Divine-Beast', level: 10, kind: 'effect' }
};
const BOSS_TIMES = [120, 240, 360];   // 三幻神严格按 2 / 4 / 6 分钟降临
const PHARAOH_TIME = 480;
/* v0.3.1 最终 Boss 三阶段决战：每阶段 LP 固定 80,000，
 * 第 1 阶段怪兽 = 巨神兵，第 2 阶段 = 巨神兵+天空龙，第 3 阶段 = 三幻神 */
const PHASE_LP = 80000;
const PHASE_GODS = ['obelisk', 'slifer', 'ra'];
const BOSSES = [
  { key: 'obelisk', id: 10000000 },
  { key: 'slifer', id: 10000020 },
  { key: 'ra', id: 10000010 }
];

/* ---------------- 难度参数（v18：整体提升 2 倍） ---------------- */
/* 所有刷怪/属性成长参数集中于此，便于统一调节。
   v17 旧值：spawnBase 1.05 / halfLife 55 / floor 0.22 / batch 1+⌊t/46⌋
            hp 0.017·cap8 / dmg 0.003·cap3.6 / spd ×1 */
const DIFF = {
  spawnBase: 0.52,      // 刷怪间隔基数（旧 1.05 → 减半，出怪速度翻倍）
  spawnHalfLife: 38,    // 间隔每 38s 减半（旧 55）
  spawnFloor: 0.13,     // 间隔下限（旧 0.22）
  batchBase: 2,         // 每批基础只数（旧 1）
  batchEvery: 26,       // 每 26s 每批 +1（旧 46）
  maxEnemies: 280,      // 同屏上限（旧 220）
  hpScale: 0.032,       // HP 成长系数（旧 0.017）
  hpCap: 14,            // HP 成长上限倍数（旧 8）
  dmgScale: 0.0052,     // 伤害成长系数（旧 0.003）
  dmgCap: 5.2,          // 伤害成长上限倍数（旧 3.6）
  spdMul: 1.12,         // 敌人基础移速（旧 1.0）
  bossHpMul: 1.6,       // 关卡 Boss 生命（旧 1.0）
  bossDmgMul: 1.4,      // 关卡 Boss 伤害（旧 1.0）
  failTimeMul: 1.8      // Boss 限时失败倒计时同比例放宽（旧 1.0，避免血厚后无法达成）
};

/* ---------------- 怪兽数据 ---------------- */
const ENEMY_ART = {
  kuriboh: 40640057,   // 库里波
  mushroom: 89091579,  // 昆虫人
  rock: 13039848,      // 岩石巨兵
  gaia: 97204936,      // 大地之骑士 盖亚骑士（精英）
  mammoth: 40374923    // 猛犸的墓场
};
const ENEMY = {
  kuriboh: { key: 'kuriboh', hp: 36, spd: 3.4, dmg: 90, rad: 0.55, exp: 5, h: 1.15, ar: 0.95, from: 0 },
  mushroom: { key: 'mushroom', hp: 82, spd: 2.4, dmg: 140, rad: 0.62, exp: 10, h: 1.4, ar: 0.95, from: 35 },
  rock: { key: 'rock', hp: 235, spd: 1.55, dmg: 250, rad: 0.85, exp: 26, h: 1.65, ar: 0.95, from: 150 },
  gaia: { key: 'gaia', hp: 520, spd: 4.4, dmg: 320, rad: 0.7, exp: 60, h: 2.1, ar: 0.95, from: 90, elite: true },
  mammoth: { key: 'mammoth', hp: 500, spd: 1.9, dmg: 380, rad: 1.2, exp: 55, h: 2.3, ar: 0.95, from: 250 }
};

/* ---------------- 游戏状态 ---------------- */
const G = {
  screen: 'title',
  level: LEVELS[0],
  time: 0,
  charId: 'yugi',
  pendingChar: null,
  lv: 1, exp: 0, expNeed: 30,
  kills: 0, ult: 0,
  shake: 0, flashT: 0,
  bossIdx: 0, boss: null,
  spawnT: 2,
  best: parseFloat(localStorage.getItem('ds_best3') || '0') || 0,
  deck: [], deckPos: 0, extra: [], extraPos: 0,
  hand: [], field: [], grave: [],
  drawn: {},
  drawCd: 0, normalCd: 0, summonMode: null,
  normalUsed: 0, spSummon: 0, spellUsed: 0,
  atkBuff: 0, drBuff: 0, slowBuff: 0, thornsBuff: 0,
  yenEarned: 0, ach: {},
  pharaoh: null, godsCalled: {}, pharaohT: 0, rival: null, mode: 'normal', burned: 0,
  mag: { X: false, Y: false, Z: false }, burnT: 9, magT: 16, pharaohSpawned: false,
  handCd: {}, coinBusy: false,
  eff: { atk: 0, area: 0, aspd: 0, move: 0, dr: 0, crit: 0, proj: 0, slow: 0, thorns: 0, iframe: 0 }
};
const P = {
  pos: new V3(), model: null, lp: 8000, maxLP: 8000, face: 0,
  atk: 0, atkMul: 1, cdMul: 1, areaMul: 1, spdMul: 1,
  proj: 1, crit: 0.05, critMul: 2, pickMul: 1, expMul: 1, dr: 0, thorns: 0,
  iframe: 0, iframeDur: 0.55, fireT: 0, bob: 0,
  vy: 0, air: false, dashT: 0, jumpH: 0
};

const MAX_FIELD = 5;
const enemies = [];
const bullets = [];
const rings = [];
const blades = [];
const mines = [];
const timers = [];
const heals = [];
const eBullets = [];

/* ---------------- 粒子 ---------------- */
const _colCache = new Map();          // v0.4.1：color → T.Color 查表（spawn 热路径零分配）
class Particles {
  constructor(max, size) {
    this.max = max; this.i = 0;
    this.d = [];
    for (let i = 0; i < max; i++) this.d.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, max: 1, grav: 6 });
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('color', new T.BufferAttribute(this.col, 3).setUsage(T.DynamicDrawUsage));
    const m = new T.PointsMaterial({
      size, map: TEX_GLOW, vertexColors: true, transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    this.mesh = new T.Points(g, m);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  spawn(x, y, z, vx, vy, vz, life, color, grav) {
    const p = this.d[this.i];
    this.i = (this.i + 1) % this.max;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.grav = grav === undefined ? 6 : grav;
    /* v0.4.1：颜色查表缓存 —— 战斗高峰期每秒上百次 spawn，不再每次 new T.Color */
    let c = _colCache.get(color);
    if (!c) { c = new T.Color(color); _colCache.set(color, c); }
    p.r = c.r; p.g = c.g; p.b = c.b;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.d[i], o = i * 3;
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 0.94; p.vz *= 0.94;
        const k = Math.max(0, p.life / p.max);
        this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
        this.col[o] = p.r * k; this.col[o + 1] = p.g * k; this.col[o + 2] = p.b * k;
      } else {
        this.col[o] = this.col[o + 1] = this.col[o + 2] = 0;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
const pxSmall = new Particles(700, 0.42);
const pxBig = new Particles(260, 1.15);

function burst(x, y, z, n, color, spd, life, big, grav) {
  const sys = big ? pxBig : pxSmall;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, e = Math.random() * Math.PI - Math.PI / 2;
    const s = spd * (0.4 + Math.random() * 0.9);
    sys.spawn(x, y, z,
      Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1.2, Math.sin(a) * Math.cos(e) * s,
      life * (0.6 + Math.random() * 0.7), color, grav);
  }
}

/* ---------------- 经验星屑 ---------------- */
const ORB_MAX = 320;
const orbMesh = new T.InstancedMesh(
  new T.OctahedronGeometry(0.15, 0),
  new T.MeshStandardMaterial({ color: 0xffd76b, emissive: 0xffb020, emissiveIntensity: 1.9, roughness: 0.3, metalness: 0.4 }),
  ORB_MAX
);
orbMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
orbMesh.frustumCulled = false;
scene.add(orbMesh);
const orbs = [];
for (let i = 0; i < ORB_MAX; i++) orbs.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, val: 1, t: 0, mag: false });
let orbCursor = 0;
const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _v = new V3(), _s = new V3();
const _UP = new V3(0, 1, 0);

function spawnOrb(x, z, val, mag) {
  const o = orbs[orbCursor];
  orbCursor = (orbCursor + 1) % ORB_MAX;
  o.alive = true; o.x = x; o.y = 0.55; o.z = z;
  const a = Math.random() * TAU, s = rnd(1.5, 4);
  o.vx = Math.cos(a) * s; o.vz = Math.sin(a) * s;
  o.val = val; o.t = 0; o.mag = !!mag;
}
function updateOrbs(dt) {
  const pr = 1.15 * P.pickMul;
  let maxAlive = -1;
  for (let i = 0; i < ORB_MAX; i++) {
    const o = orbs[i];
    if (!o.alive) { _m4.makeScale(0, 0, 0); orbMesh.setMatrixAt(i, _m4); continue; }
    if (i > maxAlive) maxAlive = i;
    o.t += dt;
    const dx = P.pos.x - o.x, dz = P.pos.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < pr && o.t > 0.25) {
      const k = 1 - d / pr;
      o.x += dx * (8 + k * 22) * dt;
      o.z += dz * (8 + k * 22) * dt;
      if (d < 0.55) {
        o.alive = false;
        G.exp += o.val * P.expMul;
        G.ult = Math.min(100, G.ult + 0.42);
        burst(o.x, 0.5, o.z, 2, 0xffd76b, 2, 0.25);
        checkLevel();
        _m4.makeScale(0, 0, 0); orbMesh.setMatrixAt(i, _m4);
        continue;
      }
    } else {
      o.x += o.vx * dt; o.z += o.vz * dt;
      o.vx *= 0.94; o.vz *= 0.94;
      o.y = groundY(o.x, o.z) + 0.55 + Math.sin(o.t * 4 + i) * 0.1;
    }
    const sc = o.mag ? 2.2 : 1;
    _q.setFromAxisAngle(_UP, o.t * 2.4);
    _v.set(o.x, o.y, o.z); _s.set(sc, sc, sc);
    _m4.compose(_v, _q, _s);
    orbMesh.setMatrixAt(i, _m4);
  }
  /* v0.4.2b：仅渲染到最大存活索引 —— 过去恒绘 320 个实例（零缩放同样耗顶点处理） */
  orbMesh.count = maxAlive + 1;
  orbMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- 伤害数字 ---------------- */
const dmgPool = [];
for (let i = 0; i < 26; i++) {
  const d = document.createElement('div');
  d.className = 'dnum'; d.style.opacity = 0;
  $('dmglayer').appendChild(d);
  dmgPool.push({ el: d, t: 0, x: 0, y: 0, vx: 0 });
}
let dmgCursor = 0;
const _pv = new V3();
function popDamage(x, y, z, text, cls) {
  const p = dmgPool[dmgCursor]; dmgCursor = (dmgCursor + 1) % dmgPool.length;
  _pv.set(x, y, z).project(camera);
  p.x = (_pv.x * 0.5 + 0.5) * W + rnd(-8, 8);
  p.y = (-_pv.y * 0.5 + 0.5) * H;
  p.vx = rnd(-16, 16);
  p.t = 0.85;
  p.el.textContent = text;
  p.el.className = 'dnum' + (cls ? ' ' + cls : '');
  p.el.style.left = p.x + 'px'; p.el.style.top = p.y + 'px'; p.el.style.opacity = 1;
}
function updateDamageNumbers(dt) {
  for (const p of dmgPool) {
    if (p.t > 0) {
      p.t -= dt;
      p.y -= 46 * dt; p.x += p.vx * dt;
      p.el.style.left = p.x + 'px'; p.el.style.top = p.y + 'px';
      p.el.style.opacity = Math.max(0, Math.min(1, p.t * 1.6));
    } else if (p.el.style.opacity !== '0') p.el.style.opacity = 0;
  }
}

/* ---------------- 冲击环 ---------------- */
const ringGeo = new T.TorusGeometry(1, 0.055, 5, 56);
function addRing(x, z, r0, r1, dmg, color, dur) {
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
  m.position.set(x, 0.12, z); m.rotation.x = -Math.PI / 2;
  scene.add(m);
  rings.push({ mesh: m, x, z, r0, r1, dmg, t: 0, dur: dur || 0.55, hit: new Set() });
}
function updateRings(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const k = Math.min(1, r.t / r.dur);
    const rad = lerp(r.r0, r.r1, 1 - Math.pow(1 - k, 2));
    r.mesh.scale.set(rad, rad, 1);
    r.mesh.material.opacity = 0.95 * (1 - k);
    const band = Math.max(1.1, r.r1 * 0.16);
    if (r.dmg > 0) {
      for (const e of enemies) {
        if (e.dead || r.hit.has(e)) continue;
        const d = Math.hypot(e.pos.x - r.x, e.pos.z - r.z);
        if (Math.abs(d - rad) < band) { r.hit.add(e); hurtEnemy(e, r.dmg, false); }
      }
    }
    if (r.t >= r.dur) {
      scene.remove(r.mesh); r.mesh.material.dispose();
      rings.splice(i, 1);
    }
  }
}
function explodeAt(x, z, radius, dmg, color) {
  addRing(x, z, radius * 0.25, radius, dmg, color, 0.42);
  burst(x, 0.7, z, 16, color, 7, 0.6, false);
  burst(x, 0.7, z, 5, 0xffffff, 5, 0.4, true);
  G.shake = Math.max(G.shake, 0.18);
}

/* ---------------- 怪兽（卡图立绘） ---------------- */
const shadowInst = new T.InstancedMesh(
  new T.CircleGeometry(1, 14),
  new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  300
);
shadowInst.instanceMatrix.setUsage(T.DynamicDrawUsage);
shadowInst.frustumCulled = false;
scene.add(shadowInst);
const _shadowQ = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0));

function spawnEnemy(type, x, z) {
  const def = ENEMY[type];
  const rec = CARD_DB.cards[ENEMY_ART[type]];
  if (!rec || !imgCache[rec.id]) return null;
  const tScale = 1 + G.time * DIFF.hpScale;
  const h = def.h * rnd(0.94, 1.08);
  const w = h * def.ar;
  /* 浮雕卡牌立牌：怪物以自己的卡牌姿态登场，卡面始终面向玩家 */
  const scale = clamp(def.h / 1.9, 0.42, 1.0);
  let sp;
  if (window.MODELS && MODELS.monster) {
    sp = MODELS.monster(rec, { img: imgCache[rec.id], scale: scale });
  } else {
    const tex = artTexture(rec.id, def.ar);
    if (!tex) return null;
    sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.12 }));
    sp.scale.set(w, h, 1);
  }
  const e = {
    type, def, boss: false, rec,
    hp: def.hp * Math.min(DIFF.hpCap, tScale), maxHp: def.hp * Math.min(DIFF.hpCap, tScale),
    dmg: def.dmg * Math.min(DIFF.dmgCap, 1 + G.time * DIFF.dmgScale),
    spd: def.spd * DIFF.spdMul * rnd(0.9, 1.12),
    rad: def.rad, exp: def.exp, h, w,
    pos: new V3(x, 0, z),
    mesh: sp, baseS: sp.scale.x,
    hitT: 0, dead: false, orbitCd: 0, knock: new V3(),
    elite: !!def.elite
  };
  sp.position.set(x, groundY(x, z), z);
  if (e.elite) {
    if (!spawnEnemy._ringGeo) spawnEnemy._ringGeo = new T.TorusGeometry(1, 0.04, 5, 32);
    if (!spawnEnemy._ringMat) spawnEnemy._ringMat = new T.MeshBasicMaterial({ color: 0xe04a3a, transparent: true, opacity: 0.8 });
    const ring = new T.Mesh(spawnEnemy._ringGeo, spawnEnemy._ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.08, z);
    scene.add(ring);
    e.groundRing = ring;
  }
  scene.add(sp);
  enemies.push(e);
  return e;
}

/* 无名的法老王：程序化专属卡图（画窗 = 夜空金字塔 + 法老剪影），供浮雕立牌使用
 * v0.4.2b：画质精修 —— 银河雾霭 / 月晕月坑 / 远景雾山 / 石材砌缝 / 狮身人面像剪影 /
 * 沙丘双色明暗 / 两侧象形文字柱。纯 canvas 绘制（仅加载时一次），零运行时开销；
 * 明暗层次更丰富 → hq 浮雕（44×48 采样亮度）立体感更强 */
function makePharaohFaceImg() {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 580;
  const x = c.getContext('2d');
  /* 画窗内容（与 ART_BOX 46/102/308/325 对齐） */
  const ax = 46, ay = 102, aw = 308, ah = 325;
  const sky = x.createLinearGradient(0, ay, 0, ay + ah);
  sky.addColorStop(0, '#120a24'); sky.addColorStop(0.45, '#3a2258'); sky.addColorStop(0.8, '#7a4030'); sky.addColorStop(1, '#a86838');
  x.fillStyle = sky; x.fillRect(0, 0, 400, 580);
  // 银河雾霭（斜向淡雾带）
  x.save();
  x.globalAlpha = 0.16;
  const mw = x.createLinearGradient(ax, ay, ax + aw, ay + ah * 0.7);
  mw.addColorStop(0, 'rgba(140,110,220,0)'); mw.addColorStop(0.5, 'rgba(190,160,255,0.9)'); mw.addColorStop(1, 'rgba(140,110,220,0)');
  x.fillStyle = mw;
  x.beginPath();
  x.moveTo(ax, ay + 40); x.quadraticCurveTo(ax + aw * 0.5, ay + 90, ax + aw, ay + 10);
  x.lineTo(ax + aw, ay + 66); x.quadraticCurveTo(ax + aw * 0.5, ay + 146, ax, ay + 96);
  x.closePath(); x.fill();
  x.restore();
  // 星（大小分层 + 大星十字眩光）
  for (let i = 0; i < 46; i++) {
    const sx = ax + Math.random() * aw, sy = ay + Math.random() * ah * 0.6;
    const r = Math.random() * 1.4 + 0.4;
    x.fillStyle = 'rgba(255,244,214,' + (0.35 + Math.random() * 0.6).toFixed(2) + ')';
    x.beginPath(); x.arc(sx, sy, r, 0, TAU); x.fill();
    if (r > 1.5) {
      x.strokeStyle = 'rgba(255,244,214,0.5)'; x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(sx - 4, sy); x.lineTo(sx + 4, sy); x.moveTo(sx, sy - 4); x.lineTo(sx, sy + 4); x.stroke();
    }
  }
  // 月（月晕 + 月面 + 陨石坑）
  const mx = ax + aw - 58, my = ay + 42, mr = 21;
  const halo = x.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
  halo.addColorStop(0, 'rgba(255,238,190,0.5)'); halo.addColorStop(1, 'rgba(255,238,190,0)');
  x.fillStyle = halo; x.beginPath(); x.arc(mx, my, mr * 2.6, 0, TAU); x.fill();
  x.fillStyle = '#ffeec2';
  x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
  x.fillStyle = 'rgba(214,190,140,0.55)';
  [[-7, -5, 4.5], [6, 2, 3.4], [-2, 9, 2.8], [9, -8, 2.2]].forEach(d => {
    x.beginPath(); x.arc(mx + d[0], my + d[1], d[2], 0, TAU); x.fill();
  });
  // 远景金字塔（雾色两座，制造纵深）
  [[ax + 18, 158, 0.72], [ax + 252, 172, 0.62]].forEach(p => {
    x.fillStyle = 'rgba(120,96,140,0.5)';
    x.beginPath();
    x.moveTo(p[0], p[1]); x.lineTo(p[0] + 62 * p[2], p[1] - 74 * p[2]); x.lineTo(p[0] + 124 * p[2], p[1]);
    x.closePath(); x.fill();
  });
  // 近景三座金字塔（受光面 + 石材砌缝）
  const base0 = ay + ah * 0.72;
  [[ax + 40, 168, 1.0, '#a8813f'], [ax + 152, 128, 1.28, '#d8b45c'], [ax + 248, 178, 0.86, '#8a6a3e']].forEach(p => {
    const w = 66 * p[2], top = p[1];
    x.fillStyle = p[3];
    x.beginPath(); x.moveTo(p[0], base0); x.lineTo(p[0] + w / 2, top); x.lineTo(p[0] + w, base0); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,228,160,0.28)';                       // 受光右面
    x.beginPath(); x.moveTo(p[0] + w / 2, top); x.lineTo(p[0] + w / 2, base0); x.lineTo(p[0] + w, base0); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(40,26,12,0.28)'; x.lineWidth = 1;       // 砌缝横纹
    for (let i = 1; i <= 6; i++) {
      const t = i / 7, yy = top + (base0 - top) * t, half = (w / 2) * (1 - t);
      x.beginPath(); x.moveTo(p[0] + w / 2 - half, yy); x.lineTo(p[0] + w / 2 + half, yy); x.stroke();
    }
  });
  // 狮身人面像剪影（右前景，卧于沙丘，被法老身影部分遮挡形成纵深）
  const spx = ax + aw - 92, spy = ay + ah * 0.88;
  x.fillStyle = '#241a10';
  x.beginPath();
  x.moveTo(spx, spy);
  x.quadraticCurveTo(spx - 6, spy - 26, spx + 14, spy - 30);
  x.quadraticCurveTo(spx + 20, spy - 44, spx + 30, spy - 40);
  x.quadraticCurveTo(spx + 44, spy - 46, spx + 42, spy - 30);
  x.quadraticCurveTo(spx + 52, spy - 22, spx + 48, spy - 8);
  x.quadraticCurveTo(spx + 60, spy, spx + 56, spy);
  x.closePath(); x.fill();
  // 沙丘（双色：向阳面 + 阴影面）
  x.fillStyle = '#c09050';
  x.beginPath();
  x.moveTo(ax, ay + ah);
  x.quadraticCurveTo(ax + aw * 0.35, ay + ah - 56, ax + aw * 0.62, ay + ah - 26);
  x.quadraticCurveTo(ax + aw * 0.85, ay + ah - 8, ax + aw, ay + ah - 18);
  x.lineTo(ax + aw, ay + ah); x.closePath(); x.fill();
  x.fillStyle = '#7a5428';
  x.beginPath();
  x.moveTo(ax, ay + ah);
  x.quadraticCurveTo(ax + aw * 0.2, ay + ah - 20, ax + aw * 0.45, ay + ah - 34);
  x.quadraticCurveTo(ax + aw * 0.3, ay + ah - 12, ax + aw * 0.62, ay + ah - 4);
  x.quadraticCurveTo(ax + aw * 0.3, ay + ah + 4, ax, ay + ah);
  x.closePath(); x.fill();
  // 两侧象形文字柱（神庙壁铭感）
  const glyphs = ['ankh', 'eye', 'bird', 'wave', 'reed'];
  [ax + 12, ax + aw - 20].forEach(gx0 => {
    for (let i = 0; i < 4; i++) {
      const gy = ay + ah * 0.52 + i * 26, g = glyphs[(i + (gx0 < ax + 100 ? 0 : 2)) % glyphs.length];
      x.save(); x.translate(gx0, gy);
      x.strokeStyle = 'rgba(216,180,92,0.5)'; x.fillStyle = 'rgba(216,180,92,0.5)'; x.lineWidth = 1.8;
      if (g === 'ankh') { x.beginPath(); x.arc(0, -6, 4, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(0, -2); x.lineTo(0, 11); x.stroke(); }
      else if (g === 'eye') { x.beginPath(); x.moveTo(-6, 0); x.quadraticCurveTo(0, -5, 6, 0); x.quadraticCurveTo(0, 5, -6, 0); x.stroke(); x.beginPath(); x.arc(0, 0, 1.6, 0, TAU); x.fill(); }
      else if (g === 'bird') { x.beginPath(); x.moveTo(-6, 6); x.quadraticCurveTo(0, -8, 7, 4); x.stroke(); }
      else if (g === 'wave') { x.beginPath(); x.moveTo(-6, 0); x.quadraticCurveTo(-3, -5, 0, 0); x.quadraticCurveTo(3, 5, 6, 0); x.stroke(); }
      else { x.fillRect(-1.5, -7, 3, 13); }
      x.restore();
    }
  });
  // 法老剪影（尼美斯头巾 + 双手权杖）
  const cx = ax + aw / 2, by = ay + ah - 8;
  x.fillStyle = '#12101c';
  x.beginPath();
  x.moveTo(cx - 92, by);
  x.quadraticCurveTo(cx - 96, by - 120, cx - 44, by - 138);   // 左肩→头
  x.quadraticCurveTo(cx, by - 160, cx + 44, by - 138);        // 头顶
  x.quadraticCurveTo(cx + 96, by - 120, cx + 92, by);         // 右肩
  x.closePath(); x.fill();
  // 头巾条纹（金）
  x.fillStyle = '#d8b45c';
  for (let i = 0; i < 5; i++) {
    x.fillRect(cx - 88 + i * 36, by - 128, 14, 60);
  }
  // 面部（金面具）
  x.fillStyle = '#f0d890';
  x.beginPath();
  x.moveTo(cx - 30, by - 132);
  x.quadraticCurveTo(cx, by - 152, cx + 30, by - 132);
  x.quadraticCurveTo(cx + 24, by - 96, cx, by - 84);
  x.quadraticCurveTo(cx - 24, by - 96, cx - 30, by - 132);
  x.closePath(); x.fill();
  // 双眼
  x.fillStyle = '#1a1030';
  x.fillRect(cx - 20, by - 124, 14, 5);
  x.fillRect(cx + 6, by - 124, 14, 5);
  // 弯钩与连枷
  x.strokeStyle = '#d8b45c'; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 74, by - 20); x.lineTo(cx - 58, by - 88); x.stroke();
  x.strokeStyle = '#8a2a2a';
  x.beginPath(); x.moveTo(cx + 74, by - 20); x.lineTo(cx + 58, by - 88); x.stroke();
  // 千年锥光点
  x.fillStyle = 'rgba(255,225,150,0.5)';
  x.beginPath(); x.arc(cx, by - 150, 34, 0, TAU); x.fill();
  const im = new Image();
  im.onload = () => { imgCache.pharaoh = im; };
  im.src = c.toDataURL('image/png');
}
makePharaohFaceImg();   // 页面加载即生成，进关时早已就绪

function bossMesh(key, meta, recOverride) {
  const rec = recOverride || GOD_REC[key] || { id: 0, name: meta.label, race: 'Divine-Beast', level: 10 };
  let mesh;
  if (key === 'pharaoh' && window.MODELS) {
    /* 无名法老：程序化专属卡图 → 浮雕卡牌立牌（与其他 Boss 统一） */
    rec.id = 'pharaoh';
    if (!imgCache.pharaoh) makePharaohFaceImg();
    mesh = MODELS.monster(rec, { img: imgCache.pharaoh, color: meta.color, scale: 1, hq: true });
  } else if (window.MODELS) {
    /* Boss 同样以浮雕卡牌立牌登场（三幻神/青眼等巨型卡牌，卡面始终面向玩家）
     * v0.4.2b：hq 精档浮雕 44×48 —— Boss 单对象不惜代价，保留全部视差细节 */
    mesh = MODELS.monster(rec, { img: imgCache[rec.id], color: meta.color, scale: 1, hq: true });
  } else {
    mesh = new T.Group();
    const sp = new T.Sprite(new T.SpriteMaterial({ map: TEX_GLOW, color: meta.color, transparent: true }));
    sp.scale.set(6, 6, 1);
    mesh.add(sp);
  }
  mesh.scale.multiplyScalar(meta.scale);
  const aura = new T.Sprite(new T.SpriteMaterial({
    map: TEX_GLOW, color: meta.color, transparent: true, opacity: 0.45,
    blending: T.AdditiveBlending, depthWrite: false
  }));
  aura.scale.set(7, 6, 1);
  aura.position.y = 2.4;
  mesh.add(aura);
  mesh.userData.aura = aura;
  return mesh;
}

function spawnBoss(idx, opt) {
  if (idx === undefined) idx = Math.min(G.bossIdx || 0, BOSSES.length - 1);
  const b = BOSSES[idx];
  if (!b) return;
  return spawnBossKey(b.key, opt);
}

/* ---- v0.3.1 Boss 血量标注 + 三阶段决战 ---- */
const fmtN = n => Math.round(n).toLocaleString('en-US');
/* 刷新顶部血条上的血量数字与阶段徽标（e = 血条当前指向的 Boss） */
function refreshBossHud(e) {
  const el = $('boss-hp');
  if (!el) return;
  if (!e) { el.textContent = ''; return; }
  el.textContent = fmtN(e.hp) + ' / ' + fmtN(e.maxHp);
  const ph = $('boss-phase');
  if (ph) {
    if (e.finalBoss && e.phase) { ph.textContent = '第 ' + e.phase + ' 阶段 / 3'; ph.classList.remove('hidden'); }
    else ph.classList.add('hidden');
  }
}
/* 保证第 n 阶段的幻神在场（1=巨神兵 2=巨神兵+天空龙 3=三幻神），缺席的按顺序补齐召唤 */
function ensurePhaseGods(n, cx, cz) {
  const summoned = [];
  for (let i = 0; i < n && i < PHASE_GODS.length; i++) {
    const k = PHASE_GODS[i];
    if (enemies.some(en => en.key === k && !en.dead)) continue;
    summoned.push(k);
    (G.godsCalled = G.godsCalled || {})[k] = true;
    spawnBossKey(k, {
      noHud: true,
      x: clamp((cx !== undefined ? cx : P.pos.x) + rnd(-9, 9), -ARENA_R + 10, ARENA_R - 10),
      z: clamp((cz !== undefined ? cz : P.pos.z) + rnd(-9, 9), -ARENA_R + 10, ARENA_R - 10)
    });
  }
  summoned.forEach(k => toast('「' + BOSS_META[k].label + '」加入战场！'));
  return summoned;
}
/* 阶段切换：主 Boss 满血复活进入下一阶段，并补齐该阶段应有的幻神 */
function bossNextPhase(e) {
  e.phase = Math.min(3, (e.phase || 1) + 1);
  e.hp = e.maxHp = PHASE_LP;
  G.flashT = 0.5; G.shake = 0.8;
  addRing(e.pos.x, e.pos.z, 0.6, 12, 0, 0xffd166, 1.0);
  G.boss = e;                          // 血条回到主 Boss
  $('boss-name').textContent = BOSS_META[e.key].label;
  $('boss-fill').style.width = '100%';
  $('boss-wrap').classList.remove('hidden');
  refreshBossHud(e);
  ensurePhaseGods(e.phase, e.pos.x, e.pos.z);
  toast('「' + BOSS_META[e.key].label + '」· 进入第 ' + e.phase + ' 阶段！');
  playSfx('boss');
}

function spawnBossKey(key, opt) {
  opt = opt || {};
  const meta = BOSS_META[key];
  if (!meta) return null;
  /* BGM：三幻神 / 无名法老 → 「神の怒り」；其他 BOSS → 「闇のゲーム」；对手决斗保持「決闘者の魂」 */
  if (!opt.keepBgm) {
    if (G.mode === 'rival') setBgmTrack('battle');
    else if (key === 'pharaoh' || key === 'obelisk' || key === 'slifer' || key === 'ra') setBgmTrack('godwrath');
    else setBgmTrack('darkgame');
  }
  const mesh = bossMesh(key, meta, opt.rec);
  const h = key === 'pharaoh' ? 6.4 : 7.0;
  const ang = Math.random() * TAU;
  const dist = opt.dist || 17;
  let x = clamp(P.pos.x + Math.cos(ang) * dist, -ARENA_R + 8, ARENA_R - 8);
  let z = clamp(P.pos.z + Math.sin(ang) * dist, -ARENA_R + 8, ARENA_R - 8);
  if (opt.x !== undefined) { x = opt.x; z = opt.z; }
  mesh.position.set(x, groundY(x, z), z);
  scene.add(mesh);
  const ring = new T.Mesh(new T.TorusGeometry(2.4, 0.09, 6, 56),
    new T.MeshBasicMaterial({ color: meta.color, transparent: true, opacity: 0.85 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, groundY(x, z) + 0.1, z);
  scene.add(ring);

  const hp = Math.round(meta.hp * (opt.hpMul || 1) * DIFF.bossHpMul);
  const e = {
    type: 'boss_' + key, def: { rad: 2.2 }, boss: true, key,
    rec: GOD_REC[key] || { id: 0, name: meta.label },
    hp: hp, maxHp: hp, dmg: Math.round(meta.dmg * DIFF.bossDmgMul), spd: meta.spd,
    rad: 2.2, exp: 700, h: h, w: h,
    pos: new V3(x, 0, z), mesh: mesh,
    hitT: 0, dead: false, orbitCd: 0, knock: new V3(),
    moveT: 2.2, summonT: 7, color: meta.color, groundRing: ring,
    baseS: mesh.scale.x,
    isGod: key !== 'pharaoh', isPharaoh: key === 'pharaoh',
    orbitA: Math.random() * TAU
  };
  /* v0.3.1：三阶段最终 Boss —— 每阶段 LP 固定 80,000（覆盖按 meta 计算的血量） */
  if (opt.phaseHp) { e.hp = e.maxHp = opt.phaseHp; e.finalBoss = true; e.phase = 1; G.finalBoss = e; }
  enemies.push(e);
  if (key === 'pharaoh') G.pharaoh = e;
  else if (!opt.noHud) G.boss = e;
  // 法老王 / 对手决斗在场时，召唤物不覆盖顶部血条
  if (!opt.noHud && !(G.pharaoh && key !== 'pharaoh')) {
    $('boss-name').textContent = meta.label;
    $('boss-fill').style.width = '100%';
    $('boss-wrap').classList.remove('hidden');
    refreshBossHud(e);
  }
  addRing(x, z, 0.6, 7, 0, meta.color, 1.0);
  G.flashT = 0.35; G.shake = 0.5;
  playSfx('boss');
  return e;
}


/* ---------------- 决斗者挑战（对手决斗） ---------------- */
function spawnRivalDuel(who) {
  const c = CHARS[who];
  const meta = BOSS_META.rival;
  const mesh = (window.MODELS && MODELS.duelist(who)) || buildMagician();
  mesh.scale.multiplyScalar(meta.scale * 1.5);
  const ang = Math.PI * 0.5;
  const x = Math.cos(ang) * 13, z = Math.sin(ang) * 13;
  mesh.position.set(x, groundY(x, z), z);
  scene.add(mesh);
  const ring = new T.Mesh(new T.TorusGeometry(1.6, 0.06, 6, 40),
    new T.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, groundY(x, z) + 0.1, z);
  scene.add(ring);

  const e = {
    type: 'boss_rival', def: { rad: 1.4 }, boss: true, key: 'rival',
    rec: { id: 0, name: c.name }, rivalWho: who,
    hp: meta.hp, maxHp: meta.hp, dmg: meta.dmg, spd: meta.spd,
    rad: 1.4, exp: 900, h: 4.2, w: 4.2,
    pos: new V3(x, 0, z), mesh: mesh,
    hitT: 0, dead: false, orbitCd: 0, knock: new V3(),
    moveT: 2.6, summonT: 8, color: c.color, groundRing: ring,
    isPharaoh: false, orbitA: Math.PI,
    rival: true
  };
  enemies.push(e);
  G.boss = e;
  $('boss-name').textContent = c.name + ' · 决斗者挑战';
  $('boss-wrap').classList.remove('hidden');
  $('boss-fill').style.width = '100%';
  refreshBossHud(e);
  $('timer-sub').textContent = '击败 ' + c.name + ' 以解锁';

  // 王牌怪兽守护
  const aceRec = CARD_DB.cards[c.ace];
  if (aceRec) {
    BOSS_META.ace.label = aceRec.name;
    BOSS_META.ace.color = c.color;
    const ace = spawnBossKey('ace', {
      x: x + 4.5, z: z - 3.5, rec: aceRec, noHud: true
    });
    if (ace) ace.isAce = true;
  }
  addRing(x, z, 0.6, 8, 0, c.color, 1.0);
  G.flashT = 0.3;
  toast('决斗者挑战 · ' + c.name);
}
const RIVAL = 1;

/* 对手决斗：抽卡并打出魔法 / 陷阱 / 怪兽卡（限制 30 秒抽一张） */
function rivalPlayCard(e) {
  if (e.dead) return;
  const who = e.rivalWho || 'kaiba';
  const c = CHARS[who] || CHARS.kaiba;
  if (!e.rivalDeck) {
    const pool = [];
    for (const id in CARD_DB.cards) {
      const rec = CARD_DB.cards[id];
      if (!rec) continue;
      if (rec.kind === 'spell' && rec.effect &&
          (rec.effect.aoe || rec.effect.draw || rec.effect.burn || rec.effect.buffAtk || rec.effect.heal)) pool.push(+id);
      else if (rec.kind === 'trap' && rec.effect) pool.push(+id);
    }
    e.rivalDeck = pool.length ? pool : BURN_IDS.slice();
  }
  const id = pick(e.rivalDeck);
  const rec = CARD_DB.cards[id];
  if (!rec) return;
  playSfx('draw');
  toast(c.name + ' 抽卡 →「' + rec.name + '」');
  const eff = rec.effect || {};
  if (rec.kind === 'trap') {
    /* 陷阱卡：以对手为源，向玩家打出紫色扇形弹幕 */
    trapActivateFx(rec);
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const base = Math.atan2(dz, dx);
    for (let i = 0; i < 7; i++) {
      const a = base + (i - 3) * 0.17;
      spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 11, Math.sin(a) * 11, e.dmg * 0.42, 0xc084fc, { r: 0.5 });
    }
    G.shake = 0.3;
    return;
  }
  /* 魔法卡演出 */
  spellArtFx(rec, (eff.aoe || eff.burn) ? 0xff7a3a : 0x62e0b0);
  playSfx('reveal');
  if (eff.aoe || eff.burn) {
    /* 范围魔法：波及玩家 LP 与玩家场上怪兽 */
    addRing(P.pos.x, P.pos.z, 1.0, 12, 0, 0xff7a3a, 0.8);
    G.flashT = 0.22; G.shake = 0.4;
    P.iframe = 0;                                  // 魔法强袭无视无敌帧
    hurtPlayer(Math.round(e.dmg * 0.9));
    for (const m of G.field.slice()) {
      m.hp -= e.dmg * 1.4;
      burst(m.obj.position.x, 1.0, m.obj.position.z, 6, 0xff9a5a, 5, 0.5);
      if (m.hp <= 0 && !magicImmune(m.rec)) destroyMonster(m, true);
      else if (m.hp <= 0) m.hp = 1;
    }
    refreshFieldUI();
  } else if (eff.heal) {
    const amt = Math.round(e.maxHp * eff.heal);
    e.hp = Math.min(e.maxHp, e.hp + amt);
    popDamage(e.pos.x, 3.2, e.pos.z, '+' + amt, 'lp');
  } else if (eff.buffAtk) {
    e.dmg *= (1 + eff.buffAtk);
    addRing(e.pos.x, e.pos.z, 0.8, 6, 0, 0xffd166, 0.7);
    toast(c.name + ' 的怪兽攻击力提升！');
  } else if (eff.draw) {
    toast(c.name + ' 搜索手牌……');
  } else {
    /* 无特殊效果的魔法卡：小弹幕 */
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    spawnEnemyBullet(e.pos.x, e.pos.z, dx / d * 12, dz / d * 12, e.dmg * 0.4, 0x62e0b0, { r: 0.5 });
  }
  /* 怪兽卡：召唤 2 只杂兵（每 3 张卡额外附赠一次） */
  if (rec.kind !== 'trap' && Math.random() < 0.45) {
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * TAU;
      spawnEnemy(pick(['kuriboh', 'mushroom', 'rock']), e.pos.x + Math.cos(a) * 3.2, e.pos.z + Math.sin(a) * 3.2);
    }
  }
}

/* ---------------- Boss 招式 ---------------- */
function bossMove(e) {
  const meta = BOSS_META[e.key];
  if (!meta) return;
  const mv = pick(meta.moves);
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d, nz = dz / d;

  if (mv === 'fist') {
    for (let i = 0; i < 3; i++) {
      timers.push({ t: i * 0.22, fn: function () {
        if (e.dead) return;
        spawnEnemyBullet(e.pos.x + nx * 3, e.pos.z + nz * 3, nx * 16, nz * 16, e.dmg * 0.5, 0x8fb6ff, { r: 0.55 });
      } });
    }
    addRing(e.pos.x, e.pos.z, 1.2, 4.5, 0, 0x8fb6ff, 0.4);
    G.shake = 0.35;
    return;
  }
  if (mv === 'quake') {
    for (let k = 0; k < 4; k++) {
      timers.push({ t: k * 0.32, fn: function () {
        if (e.dead) return;
        addRing(e.pos.x, e.pos.z, 1.0, 11, e.dmg * 0.34, 0xc9a06a, 0.65);
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU + k * 0.3;
          spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 5.5, Math.sin(a) * 5.5, e.dmg * 0.3, 0xd8b06a);
        }
        G.shake = 0.4;
      } });
    }
    return;
  }
  if (mv === 'thunder') {
    toast('奥西里斯 · 召雷弹');
    for (let i = 0; i < 3; i++) {
      timers.push({ t: i * 0.3, fn: function () {
        if (e.dead) return;
        const a = Math.atan2(nz, nx) + (i - 1) * 0.35;
        const b = spawnEnemyBullet(e.pos.x + Math.cos(a) * 2.4, e.pos.z + Math.sin(a) * 2.4,
          Math.cos(a) * 7.5, Math.sin(a) * 7.5, e.dmg * 0.55, 0xffe14d, { r: 0.42, homing: 1.5, life: 3.6 });
        if (b) {
          const glow = new T.Sprite(new T.SpriteMaterial({
            map: TEX_GLOW, color: 0xffe14d, transparent: true, opacity: 0.9,
            blending: T.AdditiveBlending, depthWrite: false
          }));
          glow.scale.set(2.6, 2.6, 1);
          b.mesh.add(glow);
        }
      } });
    }
    G.flashT = 0.12;
    return;
  }
  if (mv === 'breath') {
    for (let i = 0; i < 9; i++) {
      const a = Math.atan2(nz, nx) + (i - 4) * 0.13;
      spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 9, Math.sin(a) * 9, e.dmg * 0.36, 0xff8a5c);
    }
    addRing(e.pos.x, e.pos.z, 0.8, 4.2, 0, 0xff8a5c, 0.4);
    return;
  }
  if (mv === 'pillar') {
    toast('翼神龙 · 神炎加农');
    for (let i = 0; i < 3; i++) {
      const ox = P.pos.x + rnd(-3.5, 3.5), oz = P.pos.z + rnd(-3.5, 3.5);
      const warn = new T.Mesh(new T.RingGeometry(2.9, 3.2, 32),
        new T.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.6, side: T.DoubleSide }));
      warn.rotation.x = -Math.PI / 2;
      warn.position.set(ox, groundY(ox, oz) + 0.12, oz);
      scene.add(warn);
      timers.push({ t: 0.55 + i * 0.35, fn: function () {
        scene.remove(warn); warn.geometry.dispose(); warn.material.dispose();
        if (e.dead) return;
        addRing(ox, oz, 0.4, 3.4, e.dmg * 0.6, 0xffa030, 0.35);
        burst(ox, groundY(ox, oz) + 0.6, oz, 22, 0xff8c1a, 9, 0.7);
        if (Math.hypot(P.pos.x - ox, P.pos.z - oz) < 3.2) hurtPlayer(e.dmg * 0.6, e);
        G.shake = 0.3;
      } });
    }
    return;
  }
  if (mv === 'sun') {
    toast('翼神龙 · 太阳烈焰');
    G.flashT = 0.25;
    for (let k = 0; k < 3; k++) {
      timers.push({ t: k * 0.5, fn: function () {
        if (e.dead) return;
        addRing(e.pos.x, e.pos.z, 2, 16, e.dmg * 0.4, 0xffb020, 0.9);
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * TAU + k;
          spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 4.2, Math.sin(a) * 4.2, e.dmg * 0.25, 0xffb020);
        }
      } });
    }
    return;
  }
  if (mv === 'scepter') {
    toast('无名法老王 · 千年之光');
    for (let i = 0; i < 5; i++) {
      timers.push({ t: i * 0.14, fn: function () {
        if (e.dead) return;
        const a = Math.atan2(P.pos.z - e.pos.z, P.pos.x - e.pos.x);
        spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 19, Math.sin(a) * 19, e.dmg * 0.4, 0xffd166, { r: 0.3, life: 2.4 });
      } });
    }
    return;
  }
  if (mv === 'duel') {
    // 决斗者：瞄准扇形 + 偶尔召唤小怪
    const base = Math.atan2(nz, nx);
    for (let i = 0; i < 5; i++) {
      const a = base + (i - 2) * 0.16;
      spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 11, Math.sin(a) * 11, e.dmg * 0.26, 0xa78bfa);
    }
    addRing(e.pos.x, e.pos.z, 0.6, 3.2, 0, e.color, 0.35);
    if (Math.random() < 0.5) {
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * TAU;
        spawnEnemy(pick(['kuriboh', 'mushroom']), e.pos.x + Math.cos(a) * 3, e.pos.z + Math.sin(a) * 3);
      }
    }
    return;
  }
  if (mv === 'aceBeam') {
    for (let i = 0; i < 3; i++) {
      timers.push({ t: i * 0.2, fn: function () {
        if (e.dead) return;
        const a = Math.atan2(P.pos.z - e.pos.z, P.pos.x - e.pos.x);
        spawnEnemyBullet(e.pos.x, e.pos.z, Math.cos(a) * 17, Math.sin(a) * 17, e.dmg * 0.45, 0xffd166, { r: 0.34, life: 2.6 });
      } });
    }
    return;
  }
  if (mv === 'godCall') {
    const order = ['obelisk', 'slifer', 'ra'];
    const rest = order.filter(function (k) { return !G.godsCalled[k]; });
    if (!rest.length) return;
    const k = rest[0];
    G.godsCalled[k] = true;
    toast('无名法老王召唤了「' + BOSS_META[k].label + '」');
    G.flashT = 0.3;
    spawnBossKey(k, {
      x: clamp(e.pos.x + rnd(-9, 9), -ARENA_R + 10, ARENA_R - 10),
      z: clamp(e.pos.z + rnd(-9, 9), -ARENA_R + 10, ARENA_R - 10)
    });
    return;
  }
}

/* 战士族近战挥砍弧光：扇形环面快速展开并淡出 */
const slashPool = [];
function slashFx(x, z, ang, color) {
  let s = slashPool.find(o => !o.mesh.visible);
  if (!s) {
    const geo = new T.RingGeometry(0.7, 2.9, 20, 1, -0.95, 1.9);   // 109° 扇弧
    const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 1.0;
    scene.add(mesh);
    s = { mesh, t: 0 };
    slashPool.push(s);
  }
  s.mesh.visible = true;
  s.mesh.position.set(x, 1.0, z);
  s.mesh.rotation.z = ang - Math.PI / 2;      // 弧口朝向攻击方向
  s.mesh.scale.setScalar(0.35);
  s.mesh.material.color.setHex(color);
  s.mesh.material.opacity = 0.9;
  s.t = 0;
  s.active = true;
}
function updateSlashes(dt) {
  for (const s of slashPool) {
    if (!s.active) continue;
    s.t += dt;
    const p = s.t / 0.22;
    if (p >= 1) { s.active = false; s.mesh.visible = false; continue; }
    s.mesh.scale.setScalar(0.35 + p * 1.05);
    s.mesh.material.opacity = 0.9 * (1 - p);
  }
}

function hurtEnemy(e, amount, isCrit) {
  if (e.dead) return;
  let dmg = amount * P.atkMul;
  if (isCrit) dmg *= P.critMul;
  e.hp -= dmg;
  e.hitT = 0.13;
  if (isCrit) {                                    // 暴击打击感：脆响 + 微震 + 冲击火花
    playSfx('crit');
    G.shake = Math.max(G.shake, 0.12);
    burst(e.pos.x, (e.h || 1) * 0.55, e.pos.z, 10, 0xfff3b0, 9, 0.5);
  }
  G.ult = Math.min(100, G.ult + dmg * 0.0035);
  if (e.boss) {
    popDamage(e.pos.x, e.h * 0.92, e.pos.z, Math.round(dmg).toString(), isCrit ? 'crit' : '');
    /* 血条只跟随其真正的主人（三阶段主 Boss / 法老王 / 当前主血条对象），召唤物不覆盖 */
    const owner = (G.finalBoss && !G.finalBoss.dead) ? G.finalBoss
      : ((G.pharaoh && !G.pharaoh.dead) ? G.pharaoh
        : ((G.boss && !G.boss.dead) ? G.boss : null));
    if (owner === e) {
      $('boss-fill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
      refreshBossHud(e);
    }
  } else if (Math.random() < 0.75) {
    popDamage(e.pos.x, e.h * 0.9, e.pos.z, Math.round(dmg).toString(), isCrit ? 'crit' : '');
  }
  if (e.hp <= 0) {
    /* v0.3.1：三阶段最终 Boss —— 阶段未满 3 时不会死，进入下一阶段（LP 重置 80k + 补齐幻神） */
    if (e.finalBoss && (e.phase || 1) < 3) { e.hp = 0.01; bossNextPhase(e); return; }
    killEnemy(e);
  }
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.kills++;
  const col = e.boss ? e.color : 0xd6a554;
  burst(e.pos.x, (e.h || 1) * 0.5, e.pos.z, e.boss ? 40 : 9, col, e.boss ? 10 : 5, e.boss ? 1.2 : 0.5, !!e.boss);
  /* 顿帧：精英/Boss 击杀时画面短暂迟滞（打击感） */
  if (e.boss) G.hitStop = Math.max(G.hitStop || 0, 0.14);
  else if (e.elite) { G.hitStop = Math.max(G.hitStop || 0, 0.05); G.shake = Math.max(G.shake, 0.22); }
  if (e.boss) {
    burst(e.pos.x, e.h * 0.5, e.pos.z, 20, 0xffffff, 8, 0.9, true);
    G.shake = 0.7; G.flashT = 0.32;
    addRing(e.pos.x, e.pos.z, 0.5, 10, 0, 0xffffff, 0.9);
    if (G.boss === e) { G.boss = null; $('boss-wrap').classList.add('hidden'); }
    playSfx('bossdown');
    if (e.rival) {
      // 击败对手决斗者：解锁该角色并获胜
      const who = e.rivalWho || G.rival;
      if (window.META && who) META.unlockChar(who);
      if (who) toast('已解锁决斗者 · ' + CHARS[who].name);
      // 王牌守护一同退场
      enemies.forEach(function (o) { if (o.isAce) o.dead = true; });
      G.boss = null;
      $('boss-wrap').classList.add('hidden');
      timers.push({ t: 1.1, fn: function () { gameOver(true); } });
    } else if (e.isPharaoh) {
      G.pharaoh = null;
      G.finalBoss = null;
      $('boss-wrap').classList.add('hidden');
      timers.push({ t: 1.2, fn: function () { gameOver(true); } });
    } else if (G.level && G.level.id !== 'temple' && G.level.bosses && G.level.bosses.length &&
               e.key === G.level.bosses[G.level.bosses.length - 1].key) {
      /* 决斗者王国 / 战斗都市：击破关卡最终 Boss 即通关，解锁下一座城市 */
      G.failSpec = null;                                  // 撤销限时失败倒计时
      G.finalBoss = null;
      $('boss-wrap').classList.add('hidden');
      G.flashT = 0.6; G.shake = 0.9;
      timers.push({ t: 1.2, fn: function () { gameOver(true); } });
    } else if (G.finalBoss && !G.finalBoss.dead) {
      // v0.3.1：三阶段主 Boss 在场时，召唤物倒下 → 恢复主 Boss 血条（含血量数字与阶段徽标）
      const fb = G.finalBoss;
      $('boss-name').textContent = BOSS_META[fb.key].label;
      $('boss-fill').style.width = Math.max(0, fb.hp / fb.maxHp * 100) + '%';
      $('boss-wrap').classList.remove('hidden');
      refreshBossHud(fb);
    } else if (G.pharaoh) {
      // 幻神被击破后重新显示法老王血条
      $('boss-name').textContent = BOSS_META.pharaoh.label;
      $('boss-fill').style.width = Math.max(0, G.pharaoh.hp / G.pharaoh.maxHp * 100) + '%';
      $('boss-wrap').classList.remove('hidden');
      refreshBossHud(G.pharaoh);
    }
    /* BOSS 倒下 → 音乐回到「遊戯」（对手决斗回到「決闘者の魂」） */
    if (!(e.rival || e.isPharaoh)) setBgmTrack(G.mode === 'rival' ? 'battle' : 'yugi');
  } else {
    playSfx('kill');
  }
  const n = e.boss ? 24 : (e.exp > 25 ? 3 : 1);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = e.boss ? rnd(0.5, 3) : rnd(0, 0.4);
    spawnOrb(e.pos.x + Math.cos(a) * r, e.pos.z + Math.sin(a) * r, e.exp / n, e.boss);
  }
  const lm = G.eff.mine || 0;
  if (lm > 0 && !e.boss && Math.random() < 0.2 * lm) {
    explodeAt(e.pos.x, e.pos.z, 2.4 * P.areaMul, 90, 0xff9f43);
  }
  /* v0.4.0：击败三幻神 → 1% 概率获得对应三幻神卡片（入收藏，可在卡组编辑加入卡组） */
  if (isGodCard(e.rec) && e.rec && GOD_IDS.has(+e.rec.id)) {
    if (Math.random() < 0.01 && window.META && META.grantCard) {
      META.grantCard(+e.rec.id);
    }
  }
  if (!e.boss && Math.random() < 0.012) addHealDrop(e.pos.x, e.pos.z);
  if (CHARS[G.charId].steal && !e.boss) {
    P.lp = Math.min(P.maxLP, P.lp + P.maxLP * CHARS[G.charId].steal);
  }
  G.ult = Math.min(100, G.ult + (e.boss ? 22 : 2.2));
  scene.remove(e.mesh);
  if (e.groundRing) scene.remove(e.groundRing);
}

function addHealDrop(x, z) {
  const m = new T.Mesh(new T.OctahedronGeometry(0.28, 0),
    new T.MeshStandardMaterial({ color: 0x5ee8b5, emissive: 0x2bd48f, emissiveIntensity: 1.6, roughness: 0.3 }));
  m.position.set(x, groundY(x, z) + 0.6, z);
  scene.add(m);
  heals.push({ mesh: m, t: 0, gy: groundY(x, z) });
}

/* ---------------- 敌人更新 ---------------- */
/* v0.4.1：远距离细节剔除阈值（与玩家的水平距离，单位=世界格）——浮雕 + additive 光晕
 * 超出阈值只剩几像素，隐藏后可省大量 draw call 与顶点处理，视觉无感
 * v0.4.2b：触屏端再收紧（浮雕 26 / 光晕 32 —— 手机 GPU 填充率敏感）；
 * 新增底座光环 PED_FAR=18 剔除；浮雕 LOD 阈值 RELIEF_LOD_D2 按「与相机距离」
 * 计算（屏幕覆盖准则：立牌在 24 格外已不足 40px，低档 12×13 足够），见 updateEnemies */
const RELIEF_FAR = IS_COARSE ? 26 : 30, AURA_FAR = IS_COARSE ? 32 : 44, PED_FAR = 18;
const RELIEF_LOD_D2 = 24 * 24;
function updateEnemies(dt) {
  const n = enemies.length;
  const slowFactor = 1 - (G.eff.slow || 0);
  for (let i = n - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) {
      enemies.splice(i, 1);
      continue;
    }
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const spd = e.spd * slowFactor;
    const mx = dx / d, mz = dz / d;

    if (e.boss) {
      // 招式循环
      e.moveT = (e.moveT === undefined ? 2.4 : e.moveT) - dt;
      if (e.moveT <= 0) {
        e.moveT = rnd(2.8, 4.0);
        bossMove(e);
      }
      // 召唤小怪（幻神/法老王以外）
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = rnd(9, 12);
        if (!e.isPharaoh) {
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * TAU;
            spawnEnemy(pick(['kuriboh', 'mushroom', 'rock']), e.pos.x + Math.cos(a) * 3.5, e.pos.z + Math.sin(a) * 3.5);
          }
        }
      }
      // 保持距离的环绕移动
      e.orbitA += dt * 0.42;
      // 对手决斗：30 秒抽一张牌并打出魔法 / 陷阱 / 怪兽
      if (e.rival) {
        e.drawT = (e.drawT === undefined ? 12 : e.drawT) - dt;
        if (e.drawT <= 0) { e.drawT = 30; rivalPlayCard(e); }
      }
      const want = e.isPharaoh ? 13 : 11;
      const tgtX = P.pos.x + Math.cos(e.orbitA) * want;
      const tgtZ = P.pos.z + Math.sin(e.orbitA) * want;
      const mvx = tgtX - e.pos.x, mvz = tgtZ - e.pos.z;
      const mvl = Math.hypot(mvx, mvz) || 1;
      e.pos.x += (mvx / mvl) * e.spd * dt;
      e.pos.z += (mvz / mvl) * e.spd * dt;
    }

    e.pos.x += (mx * spd + e.knock.x) * dt;
    e.pos.z += (mz * spd + e.knock.z) * dt;
    e.knock.multiplyScalar(0.86);

    /* v0.4.0：分离检测限流 —— 只检查最近 40 只（按索引相邻），大群时帧耗从 O(n²) 降为 O(n·k) */
    let checks = 0;
    for (let j = i - 1; j >= 0 && checks < 40; j--) {
      const o = enemies[j];
      if (o.dead) continue;
      checks++;
      const ddx = e.pos.x - o.pos.x, ddz = e.pos.z - o.pos.z;
      const dd = ddx * ddx + ddz * ddz;
      const rr = (e.rad + o.rad) * 0.9;
      if (dd < rr * rr && dd > 0.0001) {
        const dl = Math.sqrt(dd);
        const push = (rr - dl) / dl * 0.5;
        const fx = ddx * push, fz = ddz * push;
        const ew = e.boss ? 0.15 : 1, ow = o.boss ? 0.15 : 1;
        e.pos.x += fx * ew; e.pos.z += fz * ew;
        o.pos.x -= fx * ow; o.pos.z -= fz * ow;
      }
    }

    const r = Math.hypot(e.pos.x, e.pos.z);
    if (r > ARENA_R - 1) { const k = (ARENA_R - 1) / r; e.pos.x *= k; e.pos.z *= k; }

    const bob = e.boss ? Math.sin(G.time * 2.2) * 0.12 : Math.sin(G.time * 5 + i) * 0.06;
    const egy = groundY(e.pos.x, e.pos.z);
    const isBB = e.mesh.userData && (e.mesh.userData.cardBoard || e.mesh.userData.kind);
    if (isBB) {
      /* 立牌 / 立体建模：原点在脚底；受击时整体缩放闪烁 */
      e.mesh.position.set(e.pos.x, egy + (e.boss ? bob : bob * 0.5), e.pos.z);
      if (e.baseS) {
        if (e.hitT > 0) e.mesh.scale.setScalar(e.baseS * (1 + (e.hitT / 0.13) * 0.09));
        else e.mesh.scale.setScalar(e.baseS);
      }
      if (window.MODELS) MODELS.animate(e.mesh, G.time + i, dt);
    } else {
      e.mesh.position.set(e.pos.x, egy + e.h / 2 + bob, e.pos.z);
    }
    if (e.groundRing) {
      e.groundRing.position.set(e.pos.x, egy + 0.08, e.pos.z);
      e.groundRing.rotation.z += dt * 1.5;
      e.groundRing.scale.setScalar(1 + Math.sin(G.time * 3) * 0.06);
    }
    /* v0.4.1：远距离细节剔除 —— 浮雕/光晕/底座环超出阈值直接 hidden（跳过绘制与顶点处理）
     * v0.4.2b：浮雕按相机距离做 LOD（<24 格保留标准/精档，之外切 12×13 低档） */
    const ud = e.mesh.userData;
    if (ud.relief) {
      if (d < RELIEF_FAR) {
        ud.relief.visible = true;
        const dcx = camera.position.x - e.pos.x, dcy = camera.position.y, dcz = camera.position.z - e.pos.z;
        if (window.MODELS && MODELS.setReliefLOD) MODELS.setReliefLOD(ud.relief, dcx * dcx + dcy * dcy + dcz * dcz < RELIEF_LOD_D2);
      } else ud.relief.visible = false;
    }
    if (ud.aura) ud.aura.visible = d < AURA_FAR;
    if (ud.pedRing) ud.pedRing.visible = d < PED_FAR;
    if (e.hitT > 0) {
      e.hitT -= dt;
    }
    if (e.boss && e.mesh.userData && e.mesh.userData.aura) {
      /* v0.4.1：光晕材质已按颜色共享，Boss 受击高亮需独立材质（懒 clone，只此一只） */
      const au = (window.MODELS && MODELS.ownAura) ? MODELS.ownAura(e.mesh) : e.mesh.userData.aura;
      au.material.opacity = 0.32 + Math.sin(G.time * 3.2) * 0.12 + (e.hitT > 0 ? 0.35 : 0);
    }

    if (P.iframe <= 0) {
      /* 跳跃滞空可越过地面敌人，不触发接触伤害 */
      if (d < e.rad + 0.55 && !(P.air && P.jumpH > 0.6)) hurtPlayer(e.dmg, e);
    }
  }
  let si = 0;
  for (const e of enemies) {
    if (si >= 300) break;
    const rr = e.rad * 1.05;
    _q.copy(_shadowQ);
    _v.set(e.pos.x, groundY(e.pos.x, e.pos.z) + 0.02, e.pos.z);
    _s.set(rr, rr, 1);
    _m4.compose(_v, _q, _s);
    shadowInst.setMatrixAt(si++, _m4);
  }
  /* v0.4.2b：仅渲染有效实例 —— 过去恒绘 300 个（尾部补零缩放占位），
   * 每个占位仍是 14 三角形顶点处理；count 动态收缩后完全跳过（si 增长时新槽位本帧即被写入） */
  shadowInst.count = si;
  shadowInst.instanceMatrix.needsUpdate = true;
}


/* ---------------- 地图掉落：直伤卡 / XYZ 磁力卡 ---------------- */
const BURN_IDS = [46130346, 33767325, 19523799, 73134082, 76103675];
const BURN_AOE = { 33767325: 1, 19523799: 1, 73134082: 1 };
const MAG_IDS = { X: 62651957, Y: 65622692, Z: 64500000 };
const XYZ_CANNON = 91998119;
const pickups = [];

function pickupMesh(id, color) {
  const rec = CARD_DB.cards[id];
  const kind = (rec && rec.kind) || 'spell';
  const img = imgCache[id];
  /* 旋转卡牌：Card3D 双面实体卡（卡面 + 程序化卡背），绕 Y 轴自转 */
  if (img && window.Card3D) {
    const card = Card3D.build(id, img, kind);
    card.scale.setScalar(0.62);
    return card;
  }
  let mesh;
  if (img) {
    mesh = new T.Mesh(new T.PlaneGeometry(1.0, 1.45),
      new T.MeshBasicMaterial({ map: artTexture(id, 0.69), transparent: true, alphaTest: 0.06, side: T.DoubleSide }));
  } else {
    mesh = new T.Mesh(new T.BoxGeometry(0.95, 1.35, 0.05), new T.MeshStandardMaterial({ color: color }));
  }
  return mesh;
}

/* v0.4.2b：掉落物光环资源共享 —— 过去每颗掉落 new 一个 TorusGeometry + MeshBasicMaterial，
 * 一场战斗几百颗掉落就是几百次小缓冲上传（renderer.info.memory.geometries 累计膨胀的主源）。
 * 光环仅做旋转/缩放变换（逐实例属性在 transform 上），材质共享无串扰 */
const PICKUP_HALO_GEO = new T.TorusGeometry(0.6, 0.04, 6, 26);
const _haloMatCache = new Map();
function pickupHaloMat(color) {
  let m = _haloMatCache.get(color);
  if (!m) {
    m = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
    _haloMatCache.set(color, m);
  }
  return m;
}
function spawnPickup(type, id, x, z) {
  const rec = CARD_DB.cards[id];
  if (!rec) return null;
  const color = type === 'burn' ? 0xff6a3a
    : type === 'xyzmon' ? 0xb08cff
    : (id === MAG_IDS.X ? 0x62d9ff : id === MAG_IDS.Y ? 0x8affc0 : 0xffd166);
  const mesh = pickupMesh(id, color);
  const gy = groundY(x, z);
  mesh.position.set(x, gy + 1.0, z);
  scene.add(mesh);
  const halo = new T.Mesh(PICKUP_HALO_GEO, pickupHaloMat(color));
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(x, gy + 0.09, z);
  scene.add(halo);
  const pillar = new T.Sprite(new T.SpriteMaterial({
    map: TEX_GLOW, color: color, transparent: true, opacity: 0.28,
    blending: T.AdditiveBlending, depthWrite: false
  }));
  pillar.scale.set(1.6, 3.4, 1);
  pillar.position.set(x, gy + 1.6, z);
  scene.add(pillar);
  const pk = { mesh: mesh, halo: halo, pillar: pillar, id: id, type: type, t: 0, gy: gy, x: x, z: z };
  pickups.push(pk);
  /* 卡图尚未加载：加载完成后把占位盒换成真正的卡面+卡背实体卡 */
  if (!imgCache[id]) {
    loadImg(id).then(() => {
      if (pickups.indexOf(pk) < 0 || !window.Card3D) return;
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      const nm = pickupMesh(id, color);
      nm.position.set(x, gy + 1.0, z);
      nm.rotation.y = mesh.rotation.y;
      pk.mesh = nm;
      scene.add(nm);
    }).catch(() => {});
  }
  return pk;
}

function clearPickups() {
  for (const p of pickups) {
    scene.remove(p.mesh); scene.remove(p.halo); scene.remove(p.pillar);
    p.pillar.material.dispose();                       // 光柱材质逐颗独立（opacity 逐实例动画）
    /* v0.4.2b：光环几何/材质已按色共享，绝不能 dispose；
     * Card3D 实体卡的几何/材质同为全局共享；仅无卡图回退的占位盒需释放 */
    if (!(p.mesh.userData && p.mesh.userData.cardId)) {
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    }
  }
  pickups.length = 0;
}

/* 直伤卡：拾取即发动 */
function applyBurnCard(id) {
  const rec = CARD_DB.cards[id];
  const dmg = (rec.effect && rec.effect.burn) || 300;
  const isAoe = !!BURN_AOE[id];
  G.burned = (G.burned || 0) + 1;
  toast('「' + rec.name + '」· ' + (isAoe ? '全场 ' : '单体 ') + dmg + ' 伤害');
  spellArtFx(rec, isAoe ? 0xff7a3a : 0xffb060);
  if (isAoe) {
    addRing(P.pos.x, P.pos.z, 1.0, 22, dmg, 0xff7a3a, 0.7);
    for (const e of enemies.slice()) if (!e.dead) hurtEnemy(e, dmg, false);
    G.shake = 0.4;
  } else {
    const t = nearestEnemy(P.pos.x, P.pos.z, 40);
    if (t) {
      explodeAt(t.pos.x, t.pos.z, 2.6, dmg * 2, 0xffb060);
      hurtEnemy(t, dmg * 2, false);
    }
  }
  G.flashT = 0.18;
}

/* XYZ 磁力卡：吸取全图经验球 */
function absorbAllOrbs() {
  let n = 0;
  for (let i = 0; i < ORB_MAX; i++) {
    const o = orbs[i];
    if (!o.alive) continue;
    o.alive = false;
    G.exp += o.val * P.expMul;
    _m4.makeScale(0, 0, 0);
    orbMesh.setMatrixAt(i, _m4);
    if (n < 26) burst(o.x, o.y || 0.6, o.z, 2, 0x62d9ff, 3, 0.4);
    n++;
  }
  orbMesh.instanceMatrix.needsUpdate = true;
  addRing(P.pos.x, P.pos.z, 0.8, 26, 0, 0x62d9ff, 0.85);
  if (n) checkLevel();
  return n;
}

function pickupMagCard(key) {
  if (G.mag[key]) return;
  G.mag[key] = true;
  const rec = CARD_DB.cards[MAG_IDS[key]];
  toast('获得「' + rec.name + '」· 吸取全场经验球');
  spellArtFx(rec, 0x62d9ff);
  const n = absorbAllOrbs();
  burst(P.pos.x, 1.0, P.pos.z, 26, 0x62d9ff, 10, 0.8);
  G.shake = 0.25;
  refreshMagUI();
  if (G.mag.X && G.mag.Y && G.mag.Z) {
    timers.push({ t: 0.5, fn: function () { summonXYZCannon(); } });
  }
}

function summonXYZCannon() {
  const rec = CARD_DB.cards[XYZ_CANNON];
  if (!rec) return;
  if (G.field.length >= MAX_FIELD) destroyMonster(G.field[0], true);
  fieldSummon(rec, undefined, { type: '特殊召唤' });
  unlockAch('xyz');
  G.xyzDone = true;                              // 集齐 XYZ → 之后刷新 XYZ 怪兽卡（吸取经验球）
  toast('XYZ-神龙炮 · 特殊召唤！');
  spellArtFx(rec, 0xffc14d);
  addRing(P.pos.x, P.pos.z, 0.6, 12, 0xffffff, 1.0);
  G.flashT = 0.35; G.shake = 0.5;
  playSfx('bossdown');
  refreshMagUI();
}

function updatePickups(dt) {
  const pr = 1.5 * P.pickMul;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i];
    k.t += dt;
    k.mesh.position.y = k.gy + 1.0 + Math.sin(k.t * 2.2) * 0.14;
    k.mesh.rotation.y += dt * 0.9;
    k.halo.rotation.z += dt * 1.2;
    k.halo.scale.setScalar(1 + Math.sin(k.t * 3) * 0.08);
    k.pillar.material.opacity = 0.22 + Math.sin(k.t * 2.6) * 0.08;
    const d = Math.hypot(P.pos.x - k.x, P.pos.z - k.z);
    if (d < pr) {
      if (k.type === 'burn') applyBurnCard(k.id);
      else if (k.type === 'xyzmon') applyXyzMonCard(k.id);
      else pickupMagCard(k.type);
      scene.remove(k.mesh); scene.remove(k.halo); scene.remove(k.pillar);
      /* v0.4.2b：光环几何/材质已共享（按色缓存），不能 dispose；仅光柱材质逐颗独立需释放；
       * 无卡图回退的占位盒（独立 BoxGeometry/PlaneGeometry + 材质）同样需要释放 */
      k.pillar.material.dispose();
      if (!(k.mesh.userData && k.mesh.userData.cardId)) {
        if (k.mesh.geometry) k.mesh.geometry.dispose();
        if (k.mesh.material) k.mesh.material.dispose();
      }
      pickups.splice(i, 1);
      continue;
    }
    if (k.t > 42) {
      scene.remove(k.mesh); scene.remove(k.halo); scene.remove(k.pillar);
      k.pillar.material.dispose();
      if (!(k.mesh.userData && k.mesh.userData.cardId)) {
        if (k.mesh.geometry) k.mesh.geometry.dispose();
        if (k.mesh.material) k.mesh.material.dispose();
      }
      pickups.splice(i, 1);
    }
  }
  // 刷新
  G.burnT = (G.burnT === undefined ? 9 : G.burnT) - dt;
  if (G.burnT <= 0) {
    G.burnT = rnd(11, 16);
    if (pickups.filter(x => x.type === 'burn').length < 4) {
      const a = Math.random() * TAU, r = rnd(8, ARENA_R - 8);
      spawnPickup('burn', pick(BURN_IDS), Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  G.magT = (G.magT === undefined ? 16 : G.magT) - dt;
  if (G.magT <= 0) {
    G.magT = rnd(16, 24);
    const rest = ['X', 'Y', 'Z'].filter(k2 => !G.mag[k2] && !pickups.some(pp => pp.type === k2));
    // XYZ 卡刷新概率下调：仅 45% 概率实际投放
    if (rest.length && Math.random() < 0.45) {
      const key = pick(rest);
      const a = Math.random() * TAU, r = rnd(10, ARENA_R - 10);
      spawnPickup(key, MAG_IDS[key], Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  /* 集齐 XYZ（神龙炮召唤后）→ 战场刷新 XYZ 怪兽卡：拾取=吸取全场经验球 */
  if (G.xyzDone) {
    G.xyzT = (G.xyzT === undefined ? 12 : G.xyzT) - dt;
    if (G.xyzT <= 0) {
      G.xyzT = rnd(20, 30);
      if (pickups.filter(x => x.type === 'xyzmon').length < 2) {
        const pool = Object.values(CARD_DB.cards).filter(c => c.kind === 'xyz');
        if (pool.length) {
          const rec = pick(pool);
          const a = Math.random() * TAU, r = rnd(10, ARENA_R - 10);
          spawnPickup('xyzmon', rec.id, Math.cos(a) * r, Math.sin(a) * r);
        }
      }
    }
  }
}

/* XYZ 怪兽卡：唯一效果=吸取场内所有经验球 */
function applyXyzMonCard(id) {
  const rec = CARD_DB.cards[id] || { name: 'XYZ 怪兽' };
  toast('「' + rec.name + '」· 吸取全场经验球！');
  spellArtFx(rec, 0xb08cff);
  const n = absorbAllOrbs();
  burst(P.pos.x, 1.0, P.pos.z, 22, 0xb08cff, 9, 0.8);
  G.flashT = 0.22; G.shake = 0.25;
  G.xyzAbs = (G.xyzAbs || 0) + 1;
}

/* ---------------- 敌方弹幕 ---------------- */
const eBulletGeo = new T.SphereGeometry(0.22, 8, 6);
function spawnEnemyBullet(x, z, vx, vz, dmg, color, opt) {
  opt = opt || {};
  const geo = opt.r && opt.r > 0.45 ? new T.SphereGeometry(opt.r, 10, 8) : eBulletGeo;
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: color || 0xff5a6e }));
  m.position.set(x, groundY(x, z) + 0.9, z);
  if (opt.r && opt.r !== 0.22) m.scale.setScalar(opt.r / 0.22);
  scene.add(m);
  const b = {
    mesh: m, x: x, z: z, vx: vx, vz: vz, dmg: dmg, t: 0,
    homing: opt.homing || 0, life: opt.life || 5, rad: opt.r || 0.22
  };
  eBullets.push(b);
  return b;
}
function updateEnemyBullets(dt) {
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.t += dt;
    if (b.homing) {
      const ax = P.pos.x - b.x, az = P.pos.z - b.z;
      const al = Math.hypot(ax, az) || 1;
      const sp = Math.hypot(b.vx, b.vz) || 1;
      b.vx += (ax / al) * b.homing * dt * 6;
      b.vz += (az / al) * b.homing * dt * 6;
      const k = sp / (Math.hypot(b.vx, b.vz) || 1);
      b.vx *= k; b.vz *= k;
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.mesh.position.set(b.x, groundY(b.x, b.z) + 0.9, b.z);
    b.mesh.rotation.y += dt * 6;
    const d = Math.hypot(P.pos.x - b.x, P.pos.z - b.z);
    if (d < 0.72 + (b.rad || 0) * 0.6 && P.iframe <= 0) {
      hurtPlayer(b.dmg, null);
      scene.remove(b.mesh); b.mesh.material.dispose();
      if (b.mesh.geometry !== eBulletGeo) b.mesh.geometry.dispose();   // v0.4.1：大弹丸独立几何体需释放
      eBullets.splice(i, 1); continue;
    }
    if (b.t > (b.life || 5) || Math.hypot(b.x, b.z) > ARENA_R + 4) {
      scene.remove(b.mesh); b.mesh.material.dispose();
      if (b.mesh.geometry !== eBulletGeo) b.mesh.geometry.dispose();   // v0.4.1：大弹丸独立几何体需释放
      eBullets.splice(i, 1);
    }
  }
}
function clearEnemyBullets() {
  for (const b of eBullets) {
    burst(b.x, 0.9, b.z, 2, 0xffd76b, 3, 0.3);
    scene.remove(b.mesh); b.mesh.material.dispose();
    if (b.mesh.geometry !== eBulletGeo) b.mesh.geometry.dispose();     // v0.4.1：大弹丸独立几何体需释放
  }
  eBullets.length = 0;
}

/* ---------------- 玩家 ---------------- */
function hurtPlayer(dmg, src) {
  if (P.iframe > 0 || G.screen !== 'playing') return;
  const real = dmg * (1 - P.dr);
  P.lp -= real;
  P.iframe = P.iframeDur;
  G.shake = Math.max(G.shake, 0.36);
  G.hitStop = Math.max(G.hitStop || 0, 0.07);     // 受击顿帧
  G.flashT = Math.max(G.flashT, 0.10);
  popDamage(P.pos.x, 1.9, P.pos.z, '-' + Math.round(real), 'lp');
  playSfx('hurt');
  if (P.thorns > 0 && src) hurtEnemy(src, real * P.thorns, false);
  if (P.lp <= 0) {
    /* 栗子球效果：手牌中的库里波送入墓地，抵消一次致死伤害 */
    const ki = G.hand.findIndex(x => +x === 40640057);
    if (ki >= 0) {
      G.hand.splice(ki, 1);
      G.grave.push(40640057);
      P.lp = Math.max(1, Math.round(P.maxLP * 0.05));
      P.iframe = 1.4;
      const krec = CARD_DB.cards[40640057];
      if (krec) spellArtFx(krec, 0xc98a45);
      burst(P.pos.x, 1.2, P.pos.z, 24, 0x8a5c2e, 9, 0.8);
      addRing(P.pos.x, P.pos.z, 0.6, 8, 0, 0xc98a45, 0.9);
      G.flashT = 0.3; G.shake = 0.4;
      toast('库里波的效果！破坏代替 —— 致死伤害被抵消');
      refreshHandUI();
      playSfx('reveal');
    } else {
      P.lp = 0; gameOver(false);
    }
  }
}

/* ---------------- 手牌怪兽效果（v18） ---------------- */
/* 效果表：key = 卡片 id
   cd    冷却秒数（0 = 无冷却，纯被动）
   active 是否按 G 主动发动
   tip   说明文案（HUD 提示） */
const HAND_FX = {
  /* 栗子球：致死伤害代替（被动，见 hurtPlayer） */
  40640057: { name: '库里波', cd: 0, active: false, badge: '守',
    tip: '手牌中时，可将此卡送入墓地，抵消一次致死伤害' },
  /* 时间魔术师：每 3 分钟投一次硬币 */
  71625222: { name: '时间魔术', cd: 180, active: true, badge: 'G',
    tip: '每 3 分钟投掷 1 次硬币：正面 —— 破坏全部敌方怪兽；反面 —— 破坏我方场上全部怪兽' }
};

function handFxId() {
  for (let i = 0; i < G.hand.length; i++) {
    const fx = HAND_FX[+G.hand[i]];
    if (fx && fx.active) return +G.hand[i];
  }
  return 0;
}
function handFxReadyIn(id) {
  return Math.max(0, (G.handCd && G.handCd[id] || 0) - G.time);
}

/* 按 G / 弹窗发动：目前只有「时间魔术」（v0.4.0：可指定手牌 id） */
function tryHandEffect(forceId, skipConfirm) {
  if (G.screen !== 'playing') return false;
  const id = forceId || handFxId();
  if (!id || !HAND_FX[id] || !HAND_FX[id].active || G.hand.indexOf(id) < 0) { toast('手牌中没有可发动的怪兽效果'); return false; }
  const fx = HAND_FX[id];
  const left = handFxReadyIn(id);
  if (left > 0.05) { toast(fx.name + ' 冷却中 · 还需 ' + fmtTime(left)); playSfx('hurt'); return false; }
  if (G.coinBusy) return false;
  /* v0.4.2：发动效果先弹确认窗（时间魔术师硬币反面会破坏自己场上全部怪兽） */
  if (!skipConfirm) { openRiskConfirm(id); return true; }
  if (!G.handCd) G.handCd = {};
  G.handCd[id] = G.time + fx.cd;
  startCoinFlip();
  return true;
}
/* v0.4.2：怪兽效果发动确认（复用代价弹窗，列示风险行） */
function openRiskConfirm(id) {
  const rec = CARD_DB.cards[id], fx = HAND_FX[id];
  if (!rec || !fx) return false;
  G.costPending = { id: id, risk: true };
  const box = $('cost-card');
  if (box) { box.innerHTML = ''; box.appendChild(cardThumb(rec, 'pp-thumb')); }
  const nm = $('cost-name');
  if (nm) nm.textContent = fx.name + ' · ' + rec.name;
  const note = $('cost-fx-note');
  if (note) note.textContent = fx.tip;
  const list = $('cost-list');
  if (list) {
    list.innerHTML = '';
    const ci = document.createElement('div');
    ci.className = 'ci';
    ci.innerHTML = '<b>⚠ 风险</b>硬币反面 → 破坏自己场上全部怪兽';
    list.appendChild(ci);
  }
  const ok = $('cost-ok');
  if (ok) ok.textContent = '确认发动';
  $('s-cost').classList.remove('hidden');
  Cursor.sync();
  playSfx('draw');
  return true;
}

/* 硬币演出：DOM 3D 翻转，1.15s 后揭晓并结算 */
function startCoinFlip() {
  G.coinBusy = true;
  const el = $('coin-fx'), coin = $('coin-body'), res = $('coin-res');
  if (el) {
    el.classList.add('on');
    el.classList.remove('heads', 'tails');
    coin.classList.remove('spin');
    void coin.offsetWidth;            // 强制回流以重启动画
    coin.classList.add('spin');
    res.textContent = '投掷硬币…';
    res.className = 'coin-res';
  }
  const rec = CARD_DB.cards[71625222];
  if (rec) spellArtFx(rec, 0xffe08a);
  playSfx('reveal');
  G.flashT = Math.max(G.flashT, 0.14);
  timers.push({ t: 1.15, fn: () => resolveCoinFlip(Math.random() < 0.5) });
}

function resolveCoinFlip(heads) {
  G.coinBusy = false;
  const el = $('coin-fx'), coin = $('coin-body'), res = $('coin-res');
  if (el) {
    coin.classList.remove('spin');
    el.classList.add(heads ? 'heads' : 'tails');
    res.textContent = heads ? '正 面 · 时间加速' : '反 面 · 时间逆流';
    res.className = 'coin-res ' + (heads ? 'heads' : 'tails');
    setTimeout(() => el.classList.remove('on'), 1150);
  }
  if (heads) {
    /* 正面：破坏全部敌方怪兽。Boss 具「效果破坏抗性」→ 改为承受 30% 最大生命伤害 */
    const list = enemies.filter(e => !e.dead);
    let n = 0, bosses = 0;
    const am = Math.max(0.01, P.atkMul);
    list.forEach(e => {
      if (e.boss) { bosses++; hurtEnemy(e, (e.maxHp * 0.3) / am, false); }
      else { n++; hurtEnemy(e, (e.hp + 1) / am, false); }
    });
    /* 全屏冲击波 */
    for (let i = 0; i < 6; i++) addRing(P.pos.x, P.pos.z, 1 + i * 3.5, 6, 0.05 * i, 0xffe08a, 0.85);
    burst(P.pos.x, 1.4, P.pos.z, 70, 0xffe8a8, 12, 1.3, true);
    G.flashT = 0.55; G.shake = 0.85; G.hitStop = Math.max(G.hitStop || 0, 0.1);
    playSfx('bossdown');
    toast('时间魔术 · 正面！破坏敌方 ' + n + ' 只怪兽' + (bosses ? '，Boss 受到 30% 最大生命伤害' : ''));
  } else {
    /* 反面：破坏我方场上全部怪兽 */
    const mine = G.field.slice();
    mine.forEach(m => destroyMonster(m, true));
    refreshFieldPositions(true);
    refreshFieldUI(); refreshHandUI();
    for (let i = 0; i < 3; i++) addRing(P.pos.x, P.pos.z, 1.2 + i * 2.4, 5, 0.4 * i, 0x9a6bff, 0.8);
    burst(P.pos.x, 1.0, P.pos.z, 40, 0x9a6bff, 8, 1.0, true);
    G.flashT = 0.35; G.shake = 0.7;
    playSfx('hurt');
    toast('时间魔术 · 反面！我方场上 ' + mine.length + ' 只怪兽被破坏');
  }
  updateHandFxChip(true);
}

/* HUD 手牌效果条：显示手牌中可发动效果与冷却 */
let fxChipText = '';
function updateHandFxChip(force) {
  const el = $('fx-chip');
  if (!el) return;
  if (G.screen !== 'playing') {
    if (fxChipText !== '') { el.classList.remove('on'); fxChipText = ''; }
    return;
  }
  const id = handFxId();
  if (!id) {
    if (fxChipText !== '') { el.classList.remove('on'); fxChipText = ''; }
    return;
  }
  const fx = HAND_FX[id];
  const left = handFxReadyIn(id);
  const txt = left > 0.05
    ? fx.name + ' · 冷却 ' + fmtTime(left)
    : fx.name + ' · 按 G 发动';
  el.classList.add('on');
  el.classList.toggle('ready', left <= 0.05);
  if (force || txt !== fxChipText) { el.textContent = txt; fxChipText = txt; }
}


/* v0.4.1：玩家子弹彻底移除 —— 主体材质 + 光晕 Sprite 材质（几何体跨弹共享，不释放） */
function removeBullet(b) {
  scene.remove(b.mesh);
  b.mesh.material.dispose();
  if (b.mesh.children) b.mesh.children.forEach(ch => { if (ch.material) ch.material.dispose(); });
}
const bulletGeo = new T.IcosahedronGeometry(0.17, 0);
const bulletGeoBig = new T.IcosahedronGeometry(0.26, 0);
function spawnPlayerBullet(x, z, dx, dz, dmg, opt) {
  opt = opt || {};
  const isBig = opt.kind === 'fire' || opt.kind === 'beam';
  const color = opt.color || 0xb07bff;
  const m = new T.Mesh(isBig ? bulletGeoBig : bulletGeo, new T.MeshBasicMaterial({ color }));
  m.position.set(x, 0.95, z);
  const glow = new T.Sprite(new T.SpriteMaterial({
    map: TEX_GLOW, color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.95
  }));
  glow.scale.setScalar(isBig ? 2.6 : 1.9);
  m.add(glow);
  scene.add(m);
  /* 枪口闪光：发射瞬间的迸发火花 */
  burst(x, 1.0, z, 3, color, 3.2, 0.28);
  const spd = opt.spd || 15;
  bullets.push({
    mesh: m, x, z,
    vx: dx * spd, vz: dz * spd,
    dmg, pierce: opt.pierce || 1, life: opt.life || 1.6,
    kind: opt.kind || 'orb', radius: opt.radius || 0.55,
    explodeR: opt.explodeR || 0, hit: new Set(),
    homing: opt.homing || 0, color,
    stretch: Math.min(2.4, 0.6 + spd * 0.07)          // 高速弹拉伸呈梭形
  });
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    if (b.homing > 0) {
      let best = null, bd = 999;
      for (const e of enemies) {
        if (e.dead || b.hit.has(e)) continue;
        const d = (e.pos.x - b.x) ** 2 + (e.pos.z - b.z) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const a = Math.atan2(best.pos.x - b.x, best.pos.z - b.z);
        const cur = Math.atan2(b.vx, b.vz);
        const na = angLerp(cur, a, Math.min(1, b.homing * dt));
        const sp = Math.hypot(b.vx, b.vz);
        b.vx = Math.sin(na) * sp; b.vz = Math.cos(na) * sp;
      }
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.mesh.position.set(b.x, 0.95, b.z);
    /* 弹体视觉：沿速度方向拉伸成梭形 + 脉动缩放 */
    b.mesh.rotation.y = Math.atan2(b.vx, b.vz);
    const pulse = 1 + Math.sin(b.life * 22) * 0.08;
    b.mesh.scale.set(pulse, pulse, (b.stretch || 1) * pulse);

    let done = false;
    for (const e of enemies) {
      if (e.dead || b.hit.has(e)) continue;
      const rr = e.rad + b.radius;
      const dx = e.pos.x - b.x, dz = e.pos.z - b.z;
      if (dx * dx + dz * dz < rr * rr) {
        b.hit.add(e);
        const isCrit = Math.random() < P.crit;
        hurtEnemy(e, b.dmg, isCrit);
        playSfx('hit');
        /* 命中冲击：白色闪光核心 + 彩色火花，暴击再加一圈冲击环 */
        burst(b.x, 1, b.z, isCrit ? 9 : 5, isCrit ? 0xfff3b0 : 0xffffff, 5.5, 0.32);
        burst(b.x, 1, b.z, 4, b.color, 4, 0.3);
        if (isCrit) addRing(b.x, b.z, 0.2, 2.2, 0, 0xfff3b0, 0.3);
        if (b.explodeR > 0) {
          explodeAt(b.x, b.z, b.explodeR * P.areaMul, b.dmg * 0.55, b.color);
          done = true;
        } else if (b.pierce-- <= 1) done = true;
        if (done) break;
      }
    }
    if (done || b.life <= 0 || Math.hypot(b.x, b.z) > ARENA_R + 3) {
      removeBullet(b);
      bullets.splice(i, 1);
    }
  }
}

function nearestEnemy(x, z, maxD) {
  let best = null, bd = (maxD || 999) ** 2;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = (e.pos.x - x) ** 2 + (e.pos.z - z) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function nearestList(x, z, n, maxD) {
  const arr = [];
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - x, e.pos.z - z);
    if (d < maxD) arr.push([d, e]);
  }
  arr.sort((a, b) => a[0] - b[0]);
  return arr.slice(0, n).map(a => a[1]);
}
/* 场上怪兽永远站在决斗者身后（槽位随玩家朝向旋转） */
const fieldGroup = new T.Group();
scene.add(fieldGroup);
const SLOTS = [
  { x: -2.7, z: -2.1 }, { x: -1.4, z: -3.0 }, { x: 0, z: -3.4 },
  { x: 1.4, z: -3.0 }, { x: 2.7, z: -2.1 }
];

function slotOf(i) { return SLOTS[i] || SLOTS[0]; }
/* 槽位世界坐标：把局部偏移按玩家面朝方向旋转（-z 为身后） */
function slotWorld(slot) {
  const s = slotOf(slot);
  const c = Math.cos(P.face), sn = Math.sin(P.face);
  return { x: P.pos.x + s.x * c + s.z * sn, z: P.pos.z - s.x * sn + s.z * c };
}

function makeMonsterMesh(rec) {
  const g = new T.Group();
  const img = imgCache[rec.id];
  let mesh = null;
  if (window.MODELS) {
    // 卡牌立牌（浮雕卡面始终面向玩家）；Boss 等无卡图时回退立体建模
    mesh = MODELS.monster(rec, { img: img, scale: 0.86 });
    const k = 1.35 - (Math.min(10, rec.level || 4) - 4) * 0.04;
    mesh.scale.multiplyScalar(k);
    g.add(mesh);
  } else if (img && window.Card3D) {
    mesh = Card3D.build(rec.id, img, 'monster');
    mesh.scale.setScalar(0.62);
    mesh.rotation.x = -0.18;
    g.add(mesh);
  } else {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: artTexture(rec.id, 0.69), transparent: true, alphaTest: 0.08 }));
    sp.scale.set(1.0, 1.45, 1);
    g.add(sp);
  }
  g.userData.mesh = mesh;
  // 脚下光环（v0.4.1：几何体/材质按决斗者颜色缓存，避免每次召唤都新建）
  let ringRes = _fieldRingCache[CHARS[G.charId].color];
  if (!ringRes) {
    ringRes = _fieldRingCache[CHARS[G.charId].color] = {
      geo: new T.RingGeometry(0.34, 0.56, 26),
      mat: new T.MeshBasicMaterial({ color: CHARS[G.charId].color, transparent: true, opacity: 0.55, side: T.DoubleSide })
    };
  }
  const ring = new T.Mesh(ringRes.geo, ringRes.mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  g.userData.ring = ring;
  // 名字牌（v0.4.1：SpriteMaterial 同样缓存）
  const nm = new T.Sprite(nameSpriteMat(rec.name));
  nm.scale.set(1.5, 0.3, 1);
  nm.position.y = 1.95;
  g.add(nm);
  g.userData.name = nm;
  return g;
}

const nameTexCache = {};
const _fieldRingCache = {};                 // v0.4.1：场上怪兽光环资源缓存（按决斗者颜色）
const _nameSpriteCache = {};                // v0.4.1：名牌 SpriteMaterial 缓存（按卡名）
function nameSpriteMat(txt) {
  let m = _nameSpriteCache[txt];
  if (!m) {
    m = _nameSpriteCache[txt] = new T.SpriteMaterial({
      map: nameTex(txt), transparent: true, depthWrite: false, opacity: 0.92
    });
  }
  return m;
}
function nameTex(txt) {
  if (nameTexCache[txt]) return nameTexCache[txt];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 52;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,6,4,0.72)';
  x.beginPath();
  x.roundRect ? x.roundRect(6, 8, 244, 36, 8) : x.rect(6, 8, 244, 36);
  x.fill();
  x.strokeStyle = 'rgba(201,160,106,0.55)'; x.lineWidth = 1.5; x.stroke();
  x.font = 'bold 22px "Noto Sans SC",sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#ffe9b0';
  const t = txt.length > 13 ? txt.slice(0, 12) + '…' : txt;
  x.fillText(t, 128, 27);
  const tex = new T.CanvasTexture(c);
  nameTexCache[txt] = tex;
  return tex;
}

function fieldSummon(rec, slot, opt) {
  if (G.field.length >= MAX_FIELD) return false;
  if (slot === undefined || slot < 0 || G.field.some(m => m.slot === slot)) {
    for (let i = 0; i < MAX_FIELD; i++) if (!G.field.some(m => m.slot === i)) { slot = i; break; }
  }
  if (slot === undefined) return false;
  const obj = makeMonsterMesh(rec);
  fieldGroup.add(obj);
  const m = {
    id: rec.id, rec, obj, slot,
    atk: rec.atk || 0, def: rec.def || 1000,
    hp: Math.max(500, rec.def || 1000),
    maxHp: Math.max(500, rec.def || 1000),
    cd: 0, t: Math.random() * 3, kind: rec.kind, level: rec.level || 1,
    summonType: (opt && opt.type) || 'normal'
  };
  G.field.push(m);
  G.summoned = (G.summoned || 0) + 1;
  if (magicImmune(rec)) toast(rec.name + ' · 本作效果：不会因战斗破坏，不会被魔法陷阱卡破坏');
  refreshFieldPositions(true);
  return m;
}

function destroyMonster(m, silent) {
  const i = G.field.indexOf(m);
  if (i < 0) return;
  G.field.splice(i, 1);
  G.grave.push(m.rec.id);
  burst(m.obj.position.x, 0.8, m.obj.position.z, 14, 0xffd76b, 5, 0.6);
  fieldGroup.remove(m.obj);
  if (!silent) playSfx('hurt');
  refreshHandUI();
}

function refreshFieldPositions(instant) {
  for (const m of G.field) {
    const w = slotWorld(m.slot);
    if (instant) { m.obj.position.set(w.x, groundY(w.x, w.z), w.z); }
    m.tx = w.x; m.tz = w.z;
  }
}

function updateField(dt) {
  for (const m of G.field) {
    m.t += dt;
    /* v0.4.0：被死者苏生复活的三幻神只能存在 30 秒 */
    if (m.godLifetime != null) {
      m.godLifetime -= dt;
      m.godTick = (m.godTick || 0) + dt;
      if (m.godTick >= 1) {
        m.godTick = 0;
        popDamage(m.obj.position.x, 2.6, m.obj.position.z, Math.ceil(m.godLifetime) + 's', 'lp');
      }
      if (m.godLifetime <= 0) {
        toast(m.rec.name + ' · 时限已到，回归冥界');
        spellArtFx(m.rec, 0xb08cff);
        destroyMonster(m);
        continue;
      }
    }
    /* 太阳神之翼神龙：攻击力等同决斗者实时 LP */
    if (+m.id === 10000010) {
      const na = Math.max(0, Math.round(P.lp));
      if (m.atk !== na) { m.atk = na; G._raDirty = true; }
    }
    const w = slotWorld(m.slot);
    const tx = w.x, tz = w.z;
    m.obj.position.x += (tx - m.obj.position.x) * Math.min(1, dt * 5.5);
    m.obj.position.z += (tz - m.obj.position.z) * Math.min(1, dt * 5.5);
    const bobY = groundY(tx, tz) + Math.sin(m.t * 1.6 + m.slot) * 0.05;
    m.obj.position.y += (bobY - m.obj.position.y) * Math.min(1, dt * 6);
    const mesh = m.obj.userData.mesh;
    if (mesh) {
      // 立牌（浮雕卡面）由 animate() 每帧朝向摄像机，不再手动转向
      if (!(mesh.userData && mesh.userData.cardBoard)) {
        mesh.rotation.y = P.face + Math.sin(m.t * 0.8 + m.slot * 1.3) * 0.22;
      }
      if (window.MODELS) MODELS.animate(mesh, m.t + m.slot, dt);
    }
    if (m.obj.userData.ring) {
      m.obj.userData.ring.material.opacity = 0.4 + Math.sin(m.t * 2.2) * 0.15;
    }

    // 自动攻击（按种族区分攻击方式）
    m.cd -= dt;
    if (m.cd <= 0) {
      const tgt = nearestEnemy(m.obj.position.x, m.obj.position.z, 30);
      if (tgt) {
        const interval = Math.max(0.42, 1.45 - m.level * 0.07) / (1 + G.atkBuff * 0.3);
        m.cd = interval;
        const dx = tgt.pos.x - m.obj.position.x, dz = tgt.pos.z - m.obj.position.z;
        const len = Math.hypot(dx, dz) || 1;
        const dmg = m.atk * 0.16 * (1 + G.atkBuff);
        const heavy = m.atk >= 2400;
        const race = (m.rec && m.rec.race) || '';
        if (race.indexOf('Warrior') >= 0) {
          /* 战士族：近战挥砍——扇形弧光扫过，半径内敌人直接受伤 */
          const ang = Math.atan2(dx, dz);
          const hitR = 3.6;
          let hits = 0;
          for (const e of enemies) {
            if (e.dead || hits >= 4) continue;
            const ex = e.pos.x - m.obj.position.x, ez = e.pos.z - m.obj.position.z;
            const d = Math.hypot(ex, ez);
            if (d > hitR) continue;
            const ea = Math.atan2(ex, ez);
            let diff = Math.abs(((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (diff > 1.1) continue;                       // 只砍面向的 126° 扇形
            hurtEnemy(e, dmg * 1.35);                        // 近战伤害更高
            playSfx('hit');
            burst(e.pos.x, (e.h || 1) * 0.6, e.pos.z, 7, 0xfff3b0, 7, 0.4);   // 砍中火花
            e.knock.x += (ex / d) * 3.2; e.knock.z += (ez / d) * 3.2;         // 击退
            hits++;
          }
          slashFx(m.obj.position.x, m.obj.position.z, ang, 0xffd76b);
          playSfx('slash');
        } else if (race.indexOf('Spellcaster') >= 0) {
          /* 魔法师族：远程追踪魔弹（紫色星光） */
          spawnPlayerBullet(m.obj.position.x, m.obj.position.z, dx / len, dz / len, dmg, {
            kind: 'orb', spd: 13, pierce: 1, life: 2.4, radius: 0.5,
            homing: 3.4, color: 0xb07bff
          });
          playSfx('shoot');
        } else if (race.indexOf('Dragon') >= 0) {
          /* 龙族：远程龙息光弹（白蓝高速贯穿） */
          spawnPlayerBullet(m.obj.position.x, m.obj.position.z, dx / len, dz / len, dmg * 1.1, {
            kind: heavy ? 'beam' : 'fire', spd: 26, pierce: heavy ? 4 : 2,
            life: 2.0, radius: 0.55, homing: 0.6, color: 0x9fd8ff
          });
          playSfx('shoot');
        } else {
          spawnPlayerBullet(m.obj.position.x, m.obj.position.z, dx / len, dz / len, dmg, {
            kind: heavy ? 'beam' : (m.level >= 5 ? 'fire' : 'orb'),
            spd: heavy ? 24 : 14,
            pierce: heavy ? 3 : 1,
            life: 2.0,
            radius: 0.5,
            homing: m.level <= 4 ? 2.4 : 0,
            color: CHARS[G.charId].color
          });
          playSfx('shoot');
        }
      } else {
        m.cd = 0.2;
      }
    }

    // 敌人接触伤害
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - m.obj.position.x, e.pos.z - m.obj.position.z);
      if (d < (e.rad || 0.6) + 0.62) {
        m.hp -= (e.dmg || 100) * dt * 0.42;
        if (Math.random() < dt * 2.4) {
          burst(m.obj.position.x, 0.9, m.obj.position.z, 3, 0xff8080, 4, 0.4);
        }
        if (m.hp <= 0) {
          if (magicImmune(m.rec)) {
            /* 「不受魔法陷阱影响」→ 本作效果：不会因战斗破坏，HP 锁定 1 */
            m.hp = 1;
            if (!m._immT || m.t - m._immT > 4) {
              m._immT = m.t;
              toast(m.rec.name + ' · 不会因战斗破坏（HP 锁定 1）');
              burst(m.obj.position.x, 1.0, m.obj.position.z, 10, 0x9be8ff, 5, 0.5);
            }
          } else destroyMonster(m);
          break;
        }
      }
    }
  }
}

/* 免疫判定：desc 中文「不受…魔法/陷阱」、日文「魔法・罠…を受けない」或英文 unaffected by spell/trap */
function magicImmune(rec) {
  if (!rec || !rec.desc) return false;
  if (/不受.*?(魔法|陷阱|罠)/.test(rec.desc)) return true;
  if (/(魔法|罠)[\s\S]*を受けない/.test(rec.desc)) return true;
  if (/unaffected by (spell|trap|magic)/i.test(rec.desc)) return true;
  return false;
}

function fireBase() { /* 玩家不再直接攻击，火力来自场上怪兽 */ }

/* ---------------- 千把刀 / 彗星 / 落穴 ---------------- */
const bladeGeo = new T.BoxGeometry(0.1, 0.55, 0.14);
function ensureBlades(n) {
  while (blades.length < n) {
    const m = new T.Mesh(bladeGeo, new T.MeshBasicMaterial({ color: 0xd8c6ff }));
    scene.add(m); blades.push({ mesh: m });
  }
  while (blades.length > n) {
    const b = blades.pop();
    scene.remove(b.mesh); b.mesh.material.dispose();
  }
}
function updateBlades(dt) {
  const n = G.eff.blade | 0;
  const want = n > 0 ? n + 1 : 0;
  if (blades.length !== want) ensureBlades(want);
  if (!n) return;
  const R = (2.0 + n * 0.12) * P.areaMul;
  for (let i = 0; i < blades.length; i++) {
    const b = blades[i];
    const a = G.time * 3.4 + i / blades.length * TAU;
    const x = P.pos.x + Math.cos(a) * R, z = P.pos.z + Math.sin(a) * R;
    b.mesh.position.set(x, 0.85, z);
    b.mesh.rotation.set(0, -a, Math.PI / 2);
    for (const e of enemies) {
      if (e.dead || e.orbitCd > 0) continue;
      const rr = e.rad + 0.42;
      if ((e.pos.x - x) ** 2 + (e.pos.z - z) ** 2 < rr * rr) {
        e.orbitCd = 0.35;
        hurtEnemy(e, 46 + n * 24, Math.random() < P.crit);
      }
    }
  }
}
function updateComet(dt) {
  const lv = G.eff.comet | 0;
  if (!lv) return;
  G.cometT = (G.cometT || 0) - dt;
  if (G.cometT <= 0) {
    G.cometT = Math.max(1.1, 3.4 - lv * 0.25);
    addRing(P.pos.x, P.pos.z, 0.6, 5.2 * P.areaMul, 70 + lv * 46, 0x7dd3fc, 0.6);
    playSfx('nova');
  }
}
const mineGeo = new T.CylinderGeometry(0.42, 0.42, 0.1, 10);
function updateMines(dt) {
  const lv = G.eff.mine | 0;
  if (lv) {
    G.holeT = (G.holeT || 0) - dt;
    if (G.holeT <= 0) {
      G.holeT = Math.max(1.4, 4.2 - lv * 0.3);
      const m = new T.Mesh(mineGeo, new T.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.85 }));
      m.position.set(P.pos.x, 0.06, P.pos.z);
      scene.add(m);
      mines.push({ mesh: m, x: P.pos.x, z: P.pos.z, t: 0, lv });
    }
  }
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.t += dt;
    m.mesh.rotation.y += dt * 2;
    m.mesh.material.opacity = 0.5 + Math.sin(m.t * 8) * 0.35;
    let boom = m.t > 14;
    if (!boom && m.t > 0.35) {
      for (const e of enemies) {
        if (e.dead) continue;
        if ((e.pos.x - m.x) ** 2 + (e.pos.z - m.z) ** 2 < (1.1 + e.rad) ** 2) { boom = true; break; }
      }
    }
    if (boom) {
      explodeAt(m.x, m.z, 3.1 * P.areaMul, 150 + m.lv * 90, 0xb07bff);
      scene.remove(m.mesh); m.mesh.material.dispose();
      mines.splice(i, 1);
    }
  }
}
function updateHeals(dt) {
  for (let i = heals.length - 1; i >= 0; i--) {
    const h = heals[i];
    h.t += dt;
    h.mesh.rotation.y += dt * 2;
    h.mesh.position.y = h.gy + 0.6 + Math.sin(h.t * 3) * 0.12;
    const d = Math.hypot(P.pos.x - h.mesh.position.x, P.pos.z - h.mesh.position.z);
    if (d < 1.3 * P.pickMul) {
      P.lp = Math.min(P.maxLP, P.lp + P.maxLP * 0.12);
      burst(h.mesh.position.x, 0.6, h.mesh.position.z, 10, 0x5ee8b5, 4, 0.5);
      popDamage(P.pos.x, 1.9, P.pos.z, '+LP', 'lp');
      scene.remove(h.mesh); h.mesh.geometry.dispose(); h.mesh.material.dispose();
      heals.splice(i, 1);
    } else if (h.t > 20) {
      scene.remove(h.mesh); h.mesh.geometry.dispose(); h.mesh.material.dispose();
      heals.splice(i, 1);
    }
  }
}

/* ---------------- 终极技 ---------------- */
/* 大招组合强化：特定怪兽同场时威力提升 */
const ULT_COMBO = {
  yugi: { need: [46986414, 38033121], label: '黑魔术合成 · 黑魔导 & 黑魔导女孩' },
  kaiba: { need: [89631139], label: '白龙共鸣' }
};
function castUlt() {
  if (G.screen !== 'playing' || G.ult < 100) return;
  const c = CHARS[G.charId];
  /* 王牌怪兽在场才能发动 */
  const hasAce = G.field.some(m => +m.id === +(c.ace || 0));
  if (!hasAce) {
    toast('「' + (CARD_DB.cards[c.ace] ? CARD_DB.cards[c.ace].name : '王牌怪兽') + '」在场才能发动终极技！');
    playSfx('hurt');
    return;
  }
  let boost = 1, boostTip = '';
  const combo = ULT_COMBO[G.charId];
  if (combo && combo.need.every(id => G.field.some(m => +m.id === +id))) {
    boost = 1.6;
    boostTip = combo.label;
  }
  G.ult = 0;
  G.flashT = 0.45;
  G.shake = 0.6;
  playSfx('ult');
  if (boostTip) { toast('终极技强化 · ' + boostTip); G.flashT = 0.7; G.shake = 0.9; }
  const px = P.pos.x, pz = P.pos.z;
  if (c.ultKind === 'meteor') {
    const targets = nearestList(px, pz, 10, 16);
    const n = boostTip ? 13 : 10;
    const dmg = Math.round(620 * boost);
    for (let i = 0; i < n; i++) {
      const e = targets[i];
      const tx = e ? e.pos.x : px + rnd(-8, 8);
      const tz = e ? e.pos.z : pz + rnd(-8, 8);
      timers.push({
        t: i * 0.09, fn: () => {
          explodeAt(tx, tz, 3.0 * P.areaMul, dmg, 0xa855f7);
          burst(tx, 0.3, tz, 14, 0xc084fc, 9, 0.7, true);
        }
      });
    }
    addRing(px, pz, 0.5, 12, Math.round(700 * boost), 0x8b5cf6, 0.9);
  } else if (c.ultKind === 'burst') {
    for (let i = 0; i < 3; i++) {
      timers.push({
        t: i * 0.16, fn: () => {
          addRing(px, pz, 1, 13 * (1 + i * 0.12), Math.round(780 * boost), 0xa8e8ff, 0.75);
          G.shake = Math.max(G.shake, 0.3);
        }
      });
    }
    const tgt = nearestEnemy(px, pz, 30);
    const a = tgt ? Math.atan2(tgt.pos.x - px, tgt.pos.z - pz) : P.face;
    for (let i = 1; i <= 10; i++) {
      timers.push({
        t: i * 0.05, fn: () => {
          const d = i * 2.6;
          explodeAt(px + Math.sin(a) * d, pz + Math.cos(a) * d, 2.4, Math.round(420 * boost), 0x9fe4ff);
        }
      });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      timers.push({
        t: i * 0.14, fn: () => {
          addRing(px, pz, 1, 10.5, Math.round(620 * boost), 0xff6b3d, 0.7);
          burst(px, 0.4, pz, 18, 0xff8c42, 10, 0.8, true);
        }
      });
    }
  }
}

/* ================= 卡组 · 手牌 · 召唤系统 ================= */
const D = { phase: 'idle', pending: 0, card: null };

/* ---------------- 魔法 / 陷阱特效（卡面原画浮现） ---------------- */
const spellFx = [];
function spellArtFx(rec, color) {
  color = color || 0xffd76b;
  const tex = imgCache[rec.id] ? artTexture(rec.id, 0.69) : null;
  let card;
  if (tex) {
    card = new T.Mesh(new T.PlaneGeometry(1.9, 2.7),
      new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.98, side: T.DoubleSide, depthWrite: false }));
  } else {
    card = new T.Mesh(new T.BoxGeometry(1.7, 2.5, 0.05), new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.6 }));
  }
  const gy = groundY(P.pos.x, P.pos.z);
  card.position.set(P.pos.x, gy + 3.1, P.pos.z + 1.4);
  card.rotation.y = Math.PI * 0.04;
  scene.add(card);

  const ring = new T.Mesh(new T.TorusGeometry(1.0, 0.06, 6, 48),
    new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
  ring.position.set(P.pos.x, gy + 3.1, P.pos.z + 1.4);
  scene.add(ring);

  const glow = new T.Sprite(new T.SpriteMaterial({
    map: TEX_GLOW, color: color, transparent: true, opacity: 0.75,
    blending: T.AdditiveBlending, depthWrite: false
  }));
  glow.scale.set(5.4, 5.4, 1);
  glow.position.set(P.pos.x, gy + 3.1, P.pos.z + 1.4);
  scene.add(glow);

  // 符文粒子
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * TAU, r = rnd(0.6, 2.6);
    burst(P.pos.x + Math.cos(a) * r, gy + rnd(0.6, 3.4), P.pos.z + Math.sin(a) * r, 1, color, rnd(2, 5), 0.6);
  }
  spellFx.push({ card: card, ring: ring, glow: glow, t: 0, dur: 1.25, color: color });
}

function updateSpellFx(dt) {
  for (let i = spellFx.length - 1; i >= 0; i--) {
    const f = spellFx[i];
    f.t += dt;
    const k = f.t / f.dur;
    const pop = Math.min(1, f.t / 0.28);
    const sc = 0.35 + (1 - Math.pow(1 - pop, 3)) * 0.95;
    f.card.scale.setScalar(sc);
    f.card.rotation.y += dt * 1.4;
    f.card.position.y += dt * 0.55;
    f.ring.scale.setScalar(1 + k * 2.4);
    f.ring.rotation.z += dt * 2.2;
    f.glow.material.opacity = 0.75 * (1 - k);
    f.card.material.opacity = Math.max(0, 1 - Math.pow(k, 2.2));
    if (k >= 1) {
      scene.remove(f.card); scene.remove(f.ring); scene.remove(f.glow);
      /* v0.4.1：贴图走 artCache 共享，仅释放几何体与材质本体 */
      if (f.card.geometry) f.card.geometry.dispose();
      if (f.card.material) f.card.material.dispose();
      f.ring.geometry.dispose(); f.ring.material.dispose(); f.glow.material.dispose();
      spellFx.splice(i, 1);
    }
  }
}

/* ---------------- 陷阱卡生效演出 ----------------
 * 盖伏→弹起→紫色发动光环→冲击波→碎裂消散，卡面全程面向玩家 */
const trapFx = [];
function trapActivateFx(rec) {
  const img = imgCache[rec.id];
  let card;
  if (img && window.Card3D) {
    card = Card3D.build(rec.id, img, 'trap');       // 紫框 3D 卡
    card.scale.setScalar(0.1);
  } else if (img) {
    card = new T.Mesh(new T.PlaneGeometry(1.9, 2.7),
      new T.MeshBasicMaterial({ map: artTexture(rec.id, 0.69), transparent: true, side: T.DoubleSide, depthWrite: false }));
    card.scale.setScalar(0.1);
  } else {
    card = new T.Mesh(new T.BoxGeometry(1.7, 2.5, 0.05),
      new T.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.6 }));
    card.scale.setScalar(0.1);
  }
  const gy = groundY(P.pos.x, P.pos.z);
  card.position.set(P.pos.x, gy + 0.2, P.pos.z + 1.6);
  scene.add(card);
  const glow = new T.Sprite(new T.SpriteMaterial({
    map: TEX_GLOW, color: 0xa855f7, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false
  }));
  glow.scale.set(4.6, 4.6, 1);
  glow.position.copy(card.position);
  scene.add(glow);
  trapFx.push({ card, glow, t: 0, dur: 1.5, gy });
}

function updateTrapFx(dt) {
  for (let i = trapFx.length - 1; i >= 0; i--) {
    const f = trapFx[i];
    f.t += dt;
    const k = f.t / f.dur;
    if (f.t < 0.34) {
      // 弹起展开：从地面立起并放大，卡面转向玩家
      const p = f.t / 0.34;
      const e = 1 - Math.pow(1 - p, 3);
      f.card.scale.setScalar(0.1 + e * 1.35);
      f.card.position.y = f.gy + 0.2 + e * 1.5;
      f.card.quaternion.copy(MODELS.camera ? MODELS.camera.quaternion : f.card.quaternion);
      f.glow.material.opacity = e * 0.7;
      f.glow.position.copy(f.card.position);
    } else {
      if (!f.burst) {
        // 发动瞬间：冲击波 + 紫闪 + 符文粒子
        f.burst = true;
        addRing(P.pos.x, P.pos.z, 0.8, 14, 0, 0xa855f7, 0.85);
        burst(P.pos.x, 1.2, P.pos.z + 1, 20, 0xc084fc, 9, 0.7);
        G.flashT = Math.max(G.flashT, 0.16);
        G.shake = Math.max(G.shake, 0.24);
        playSfx('reveal');
      }
      // 悬浮旋转 + 碎裂消散
      const q = (f.t - 0.34) / (f.dur - 0.34);
      f.card.position.y = f.gy + 1.7 + Math.sin(f.t * 3) * 0.08;
      f.card.rotation.y += dt * (2.4 + q * 6);
      f.card.scale.setScalar(1.45 * (1 - Math.pow(q, 2.4)));
      f.glow.material.opacity = 0.5 * (1 - q);
      if (q >= 1) {
        scene.remove(f.card); scene.remove(f.glow);
        /* v0.4.1：释放卡片几何体/材质与光晕材质（贴图共享不释放） */
        if (f.card.geometry) f.card.geometry.dispose();
        if (f.card.material) f.card.material.dispose();
        f.glow.material.dispose();
        trapFx.splice(i, 1);
      }
    }
  }
}

const HAND_MAX = 7;

/* ---- 艾克佐迪亚（被封印的 Exodia）：五部件同时在手牌 → 特殊胜利 ---- */
const EXODIA_PARTS = [
  { id: 33396948, name: '被封印的艾克佐迪亚', slot: '本体' },
  { id: 7902349,  name: '被封印者的左腕',     slot: '左腕' },
  { id: 70903634, name: '被封印者的右腕',     slot: '右腕' },
  { id: 44519536, name: '被封印者的左足',     slot: '左足' },
  { id: 8124921,  name: '被封印者的右足',     slot: '右足' }
];
const EXODIA_IDS = new Set(EXODIA_PARTS.map(p => p.id));
function isExodiaPart(id) { return EXODIA_IDS.has(+id); }

function buildDeck() {
  const who = G.charId;
  let ids = (window.META && META.deckFor) ? META.deckFor(who) : null;
  if (!ids || !ids.length) {
    ids = [];
    (CARD_DB.decks[who] || []).forEach(d => { for (let i = 0; i < d.n; i++) ids.push(d.id); });
  }
  // 禁限表校验（同样作用于已保存卡组）：表内卡限 1、同名卡限 3
  {
    const cnt = {};
    ids = ids.filter(id => { cnt[id] = (cnt[id] || 0) + 1; return cnt[id] <= limitOf(id); });
  }
  // 融合 / 同调 / 超量 / 连接 怪兽自动进入额外卡组
  const main = [], extra = [], seenEx = {};
  ids.forEach(id => {
    const r = CARD_DB.cards[id];
    if (!r) return;
    if (r.burn) return;              // 直伤卡只在战场掉落，不进抽牌池
    if (isExtraKind(r.kind)) {
      if (seenEx[id]) return;
      seenEx[id] = 1; extra.push(id);
    } else main.push(id);
  });
  if (window.META && META.extraFor) {
    META.extraFor(who).forEach(id => {
      if (!CARD_DB.cards[id] || seenEx[id]) return;
      seenEx[id] = 1; extra.push(id);
    });
  }
  G.deck = main.slice();
  /* 决斗者牌组必带「太阳神之翼神龙」：攻击力等同决斗者实时 LP（需 3 只祭品上级召唤） */
  if (CARD_DB.cards[10000010]) G.deck.push(10000010);
  /* 必带「时间魔术师」：手牌中每 3 分钟可投一次硬币（G 键） */
  if (CARD_DB.cards[71625222] && G.deck.indexOf(71625222) < 0) G.deck.push(71625222);
  shuffle(G.deck);
  G.deckPos = 0;
  G.extra = extra.slice();
  shuffle(G.extra);
  G.extraPos = 0;
  G.drawn = {};
  G.hand = [];
  G.grave = [];
  G.atkBuff = 0; G.drBuff = 0; G.slowBuff = 0; G.thornsBuff = 0;
}
function deckLeft() { return G.deck.length - G.deckPos; }
function drawFromDeck() {
  if (G.deckPos >= G.deck.length) { shuffle(G.deck); G.deckPos = 0; }
  /* 等概率抽卡：在「本局尚未抽过的卡种」中均匀抽取，
   * 同名多拷（≤3 张）不再抬高该卡的抽取率 */
  const unseen = [];
  const seenSet = new Set();
  for (let i = G.deckPos; i < G.deck.length; i++) {
    const id = G.deck[i];
    if (!G.drawn[id] && !seenSet.has(id)) { seenSet.add(id); unseen.push(id); }
  }
  if (!unseen.length) {
    // 卡组内卡种已全部抽过：洗牌并重置标记，进入下一轮循环
    shuffle(G.deck); G.deckPos = 0; G.drawn = {};
    for (let i = G.deckPos; i < G.deck.length; i++) {
      const id = G.deck[i];
      if (!seenSet.has(id)) { seenSet.add(id); unseen.push(id); }
    }
  }
  const id = unseen.length ? unseen[(Math.random() * unseen.length) | 0] : G.deck[G.deckPos];
  const idx = G.deck.indexOf(id, G.deckPos);
  if (idx > G.deckPos) { G.deck[idx] = G.deck[G.deckPos]; G.deck[G.deckPos] = id; }
  G.deckPos++;
  G.drawn[id] = (G.drawn[id] || 0) + 1;
  return id;
}
function recalc() {
  const E = G.eff;
  P.spdMul = 1 + E.move;
  P.dr = Math.min(0.7, E.dr + G.drBuff);
  P.thorns = Math.min(0.8, E.thorns + G.thornsBuff);
}

/* ---- 手牌 ---- */
function handAdd(id) {
  if (G.hand.length >= HAND_MAX) { toast('手牌已满（' + HAND_MAX + ' 张）'); return false; }
  G.hand.push(id);
  checkExodiaWin();
  return true;
}
function drawCard(silent, isEffect) {
  if (G.hand.length >= HAND_MAX) {
    /* 满手（多为低星怪兽堵手）：玩家按 R 时进入「弃 1 抽 1」模式，
       效果抽卡则直接失败；这样才能把手牌倒腾开继续抽牌 */
    if (!silent) {
      if (isEffect) toast('手牌已满（' + HAND_MAX + ' 张）');
      else beginDiscardDraw();
    }
    return false;
  }
  if (!isEffect) {
    // 玩家抽卡（R）：只有升级获得的抽卡机会才能抽
    if (!G.draws) {
      toast('需要升级才能抽卡（每升 1 级 +1 次）');
      playSfx('hurt');
      return false;
    }
    G.draws--;
  }
  const id = drawFromDeck();
  G.hand.push(id);
  G.drawCount = (G.drawCount || 0) + 1;
  if (G.drawCount >= 20) unlockAch('draw20');
  const rec = CARD_DB.cards[id];
  if (!silent && rec) {
    playSfx('draw');
    popDamage(P.pos.x, 2.4, P.pos.z, rec.name, 'lp');
  }
  refreshHandUI();
  checkExodiaWin();          // 入手后立即判定五部件齐手
  return true;
}
function handRemove(idx) {
  const id = G.hand[idx];
  G.hand.splice(idx, 1);
  refreshHandUI();
  return id;
}

/* ---- 艾克佐迪亚特殊胜利：五张必须「同时」存在于手牌 ---- */
function exodiaProgress() {
  const has = new Set(G.hand);
  return EXODIA_PARTS.filter(p => has.has(p.id));
}
function exodiaReady() { return exodiaProgress().length === EXODIA_PARTS.length; }
function checkExodiaWin() {
  if (G.screen === 'result') return false;
  if (!G.hand || !G.hand.length) return false;
  if (!exodiaReady()) return false;
  exodiaEnd();
  return true;
}
function exodiaEnd() {
  if (G.screen === 'result') return;
  gameOver(true, {
    kicker: 'EXODIA COMPLETE',
    winTitle: '封 印 解 除',
    titleClass: 'exodia',
    sub: '「被封印的艾克佐迪亚」+ 左腕·右腕·左足·右足 同时在手牌 —— 无限之力觉醒，特殊胜利！',
    bgCard: 33396948
  });
}

/* ---- 召唤条件 ---- */
/* 三幻神：欧贝利斯克 / 太阳神 / 欧西里斯 —— 固定需要 3 只祭品（原作幻神兽族规格） */
const GOD_IDS = new Set([10000000, 10000010, 10000020]);
function isGodCard(rec) {
  return !!rec && (GOD_IDS.has(+rec.id) || rec.race === 'Divine-Beast');
}
function tributeNeed(rec) {
  if (isGodCard(rec)) return 3;          // 三幻神：3 只祭品
  const lv = rec.level || 1;
  if (lv <= 4) return 0;
  if (lv <= 6) return 1;
  return 2;
}
function isExtraKind(k) { return k === 'fusion' || k === 'synchro' || k === 'xyz' || k === 'link'; }

/* ---- 禁限卡表（参照 OCG/TCG 制限表，表内卡每卡组限投 1 张，同名卡最多 3 张） ---- */
const LIMIT1_IDS = new Set([
  55144522,  // 强欲之壶
  79571449,  // 天使的施舍
  83764718,  // 死者苏生
  53129443,  // 黑洞
  19613556,  // 大岚
  72302403,  // 光之护封剑
  44095762,  // 神圣防护罩－反射镜力－
  53582587,  // 激流葬
  62279055,  // 魔法之筒
]);
const DECK_MAX_SAME = 3;
function limitOf(id) { return LIMIT1_IDS.has(+id) ? 1 : DECK_MAX_SAME; }
function limitLabel(id) { return LIMIT1_IDS.has(+id) ? '限 1' : '最多 3'; }

function syncCandidates(card) {
  const tuners = G.field.filter(m => m.rec.kind === 'tuner' || m.rec.tuner);
  const others = G.field.filter(m => !(m.rec.kind === 'tuner' || m.rec.tuner));
  const target = card.level || 0;
  const outs = [];
  for (const t of tuners) {
    const need = target - (t.level || 1);
    if (need <= 0) continue;
    // 1~3 只非调整怪兽，等级合计等于目标等级
    const find = (start, left, acc) => {
      if (left === 0) { if (acc.length) outs.push([t, ...acc]); return; }
      if (acc.length >= 3) return;
      for (let i = start; i < others.length; i++) {
        if (find(i + 1, left - (others[i].level || 1), [...acc, others[i]])) return;
      }
    };
    find(0, need, []);
    if (outs.length) break;
  }
  return outs;
}
function xyzCandidates(card) {
  const outs = [];
  for (let i = 0; i < G.field.length; i++) {
    for (let j = i + 1; j < G.field.length; j++) {
      const a = G.field[i], b = G.field[j];
      if ((a.level || 0) === (b.level || 0) && a.level === (card.level || 0)) outs.push([a, b]);
    }
  }
  return outs;
}
function linkCandidates(card) {
  const need = card.link || 2;
  if (G.field.length < need) return [];
  return [G.field.slice(0, need)];
}
/* 融合召唤：官方 OCG 素材（card.mats），素材可来自手牌或场上（场上优先）；
 * 手牌/场上凑不齐指定素材时无法发动。返回素材计划（纯函数，不改变状态） */
function fusionCandidates(card) {
  const hasFusionSpell = G.hand.some(id => CARD_DB.cards[id].name === '融合');
  if (!hasFusionSpell) return [];
  const mats = card.mats;
  if (!mats) {                                 // 无官方素材表的融合卡：任意 2 只场上怪兽（旧规）
    if (G.field.length < 2) return [];
    return [[{ src: 'field', m: G.field[0] }, { src: 'field', m: G.field[1] }]];
  }
  const pool = G.field.slice();
  const plan = [];
  for (const mid of mats) {
    const fi = pool.findIndex(m => m.id === mid);
    if (fi >= 0) { plan.push({ src: 'field', m: pool.splice(fi, 1)[0] }); continue; }
    const hi = G.hand.findIndex(hid => +hid === +mid);
    if (hi >= 0) { plan.push({ src: 'hand', idx: hi }); continue; }
    return [];                                 // 缺素材：无法发动
  }
  return [plan];
}

/* ---- 召唤 ---- */
function performSummon(handIdx) {
  const id = G.hand[handIdx];
  const rec = CARD_DB.cards[id];
  if (!rec) return false;
  const kind = rec.kind;

  if (isExtraKind(kind)) {
    let cand = [], type = '';
    if (kind === 'synchro') {
      // 同调召唤：由玩家在弹窗中自选调整+素材
      if (G.pick && G.pick.type === 'synchro' && G.pick.handIdx === handIdx) { cancelPick(); return false; }
      if (!syncCandidates(rec).length) { toast(extraHint(rec)); return false; }
      startSynchroPick(rec, { src: 'hand', handIdx });
      return true;
    }
    else if (kind === 'link') { cand = linkCandidates(rec); type = '连接召唤'; }
    else if (kind === 'xyz') {
      // 超量召唤：由玩家自选场上 2 只同级素材
      if (G.pick && G.pick.type === 'xyz' && G.pick.handIdx === handIdx) { cancelPick(); return false; }
      if (!xyzCandidates(rec).length) { toast(extraHint(rec)); return false; }
      startXyzPick(rec, { src: 'hand', handIdx });
      return true;
    }
    else {
      /* v23：融合召唤 → 弹窗选目标（本卡已在额外卡组外）与素材 */
      if (G.pick && G.pick.type === 'fusion' && G.pick.handIdx === handIdx) { cancelPick(); return false; }
      if (!G.extra.some(x => CARD_DB.cards[x] && CARD_DB.cards[x].kind === 'fusion')) { toast('额外卡组没有融合怪兽'); return false; }
      if (fusionSpellIdx() < 0) { toast('需要手牌中的「融合」魔法卡'); return false; }
      return startFusionPick(null, { spellIdx: fusionSpellIdx() });
    }
    if (!cand.length) { toast(extraHint(rec)); return false; }
    const plan = cand[0];
    plan.forEach(p => { if (p.src === 'field') destroyMonster(p.m, true); });
    refreshHandUI();
    fieldSummon(rec, undefined, { type });
    afterSummon(type, rec);
    return true;
  }

  if (kind === 'spell' || kind === 'trap') return activateSpell(handIdx);

  /* v0.4.2：仪式怪兽只能通过仪式魔法召唤，不能通常/祭品召唤 */
  if (kind === 'ritual') {
    toast('「' + rec.name + '」是仪式怪兽 —— 只能通过仪式魔法从卡组特殊召唤');
    playSfx('hurt');
    return false;
  }

  const need = tributeNeed(rec);
  // 满场 5 只时：禁止★1-4 通常召唤，仅允许上级召唤（解放祭品腾位）
  if (G.field.length >= MAX_FIELD && need === 0) {
    toast('场上已满（5 只）：只能上级召唤或融合/超量/同调'); return false;
  }
  if (G.normalCd > 0) { toast('通常召唤冷却中'); return false; }
  if (G.field.length < need) { toast('需要 ' + need + ' 只祭品'); return false; }

  if (need > 0) {
    // 上级召唤：玩家自选祭品（★5-6 一只，★7 以上两只）
    if (G.pick && G.pick.type === 'tribute' && G.pick.handIdx === handIdx) { cancelPick(); return false; }
    if (!startTributePick(handIdx, need)) return false;
    return true;
  }

  handRemove(handIdx);
  const m = fieldSummon(rec, undefined, { type: '通常召唤' });
  G.normalCd = 2.0;
  afterSummon('通常召唤', rec);
  return !!m;
}

/* 从额外卡组直接召唤（消耗场上素材，不进手牌） */
function summonFromExtra(ei) {
  if (G.screen !== 'playing') return false;
  const id = G.extra[ei];
  const rec = CARD_DB.cards[id];
  if (!rec) return false;
  const kind = rec.kind;
  let cand = [], type = '';
  if (kind === 'synchro') {
    if (G.pick && G.pick.type === 'synchro' && G.pick.extraIdx === ei) { cancelPick(); return false; }
    if (!syncCandidates(rec).length) { toast(extraHint(rec)); playSfx('hurt'); return false; }
    startSynchroPick(rec, { src: 'extra', extraIdx: ei });
    return true;
  }
  else if (kind === 'link') { cand = linkCandidates(rec); type = '连接召唤'; }
  else if (kind === 'xyz') {
    if (G.pick && G.pick.type === 'xyz' && G.pick.extraIdx === ei) { cancelPick(); return false; }
    if (!xyzCandidates(rec).length) { toast(extraHint(rec)); playSfx('hurt'); return false; }
    startXyzPick(rec, { src: 'extra', extraIdx: ei });
    return true;
  }
  else {
    /* v23：由额外卡组点融合怪兽 → 弹窗第 2 步选素材（可返回第 1 步换目标） */
    if (G.pick && G.pick.type === 'fusion' && G.pick.extraIdx === ei) { cancelPick(); return false; }
    return startFusionPick(rec, { extraIdx: ei, spellIdx: fusionSpellIdx() });
  }
  if (!cand.length) { toast(extraHint(rec)); playSfx('hurt'); return false; }
  const plan = cand[0];
  plan.forEach(p => { if (p.src === 'field') destroyMonster(p.m, true); });
  refreshHandUI();
  G.extra.splice(ei, 1);
  fieldSummon(rec, undefined, { type });
  afterSummon(type, rec);
  return true;
}

/* ---- 召唤选择弹窗（游戏暂停，五格放置区，点击选祭品/素材） ---- */
function openSummonModal(title, hint) {
  $('summon-title').textContent = title;
  $('summon-hint').textContent = hint ||
    '点击怪兽卡作为素材 · 选满自动召唤 · ESC 取消';
  renderSummonSlots();
  $('s-summon').classList.remove('hidden');
  if (G.screen === 'playing') { G.screen = 'summon'; Cursor.sync(); }   // 弹窗期间游戏暂停 + 释放指针
}
function closeSummonModal() {
  $('s-summon').classList.add('hidden');
  if (G.screen === 'summon') { G.screen = 'playing'; lockNow(); }
}
function renderSummonSlots() {
  const box = $('summon-slots');
  if (!box) return;
  const p = G.pick;
  const isFusion = !!p && p.type === 'fusion';
  const targetStage = isFusion && p.phase === 'target';
  const matStage = isFusion && p.phase === 'mat';
  /* v23：融合分两步 —— ①选融合目标 ②选素材（手牌行 + 场上五格） */
  $('summon-tip').classList.toggle('hidden', !targetStage);
  $('summon-targets').classList.toggle('hidden', !targetStage);
  $('summon-hand-tip').classList.toggle('hidden', !matStage);
  $('summon-handrow').classList.toggle('hidden', !matStage);
  $('btn-summon-back').classList.toggle('hidden', !matStage);
  $('btn-summon-cancel').textContent = isFusion ? '取消融合' : '取消召唤';
  box.classList.toggle('hidden', targetStage);
  if (targetStage) { renderFusionTargets(); return; }
  if (!p) { box.innerHTML = ''; $('btn-summon-confirm').classList.add('hidden'); return; }

  box.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const m = G.field.find(mm => mm.slot === i);
    const el = document.createElement('div');
    const picked = m && p.picked.includes(m);
    const usable = m && (!isFusion || fusionUsable(p, m.id));
    el.className = 'sum-slot' + (m ? '' : ' empty') + (picked ? ' picked' : '') +
      (m && isFusion ? (usable ? ' can' : ' no') : '');
    if (m) {
      el.innerHTML = '<img src="' + (window.__cardImg ? __cardImg(m.id) : 'data/cardimg/' + m.id + '.jpg') + '" alt="">';
      el.title = m.rec.name + '　★' + (m.level || 1) + (m.rec.tuner ? ' · 调整' : '');
      el.addEventListener('click', () => togglePickField(m));
    }
    box.appendChild(el);
  }
  if (matStage) renderFusionHand();

  const n = p.picked.length + (isFusion ? p.handPicked.length : 0);
  /* 融合 / 同调需要玩家点「确认」，祭品 / 超量选满即自动召唤 */
  const needConfirm = p.type === 'synchro' || isFusion;
  $('btn-summon-confirm').classList.toggle('hidden', !needConfirm);
  if (needConfirm) {
    const ok = p.type === 'synchro' ? synchroPickOk() : fusionCheckOk(p);
    const btn = $('btn-summon-confirm');
    btn.textContent = isFusion ? '确认融合' : '确认召唤';
    btn.disabled = !ok;
    btn.classList.toggle('off', !ok);
  }

  if (p.type === 'synchro') {
    $('summon-hint').textContent = '已选 ' + n + ' 只（第 1 只须为调整怪兽）· 等级合计须 = ★' +
      (p.rec.level || 0) + ' · 选好后点「确认召唤」';
  } else if (isFusion) {
    const need = fusionNeed(p.rec);
    $('summon-hint').textContent = '已选 ' + n + ' / ' + need + ' 只 · 官方素材：' + fusionMatText(p.rec) +
      (fusionCheckOk(p) ? ' · 可融合！点「确认融合」' : '');
  } else {
    const need2 = p.type === 'tribute' ? p.need : 2;
    $('summon-hint').textContent = '已选 ' + n + ' / ' + need2 + ' · 选满自动召唤 · ESC 取消';
  }
}

/* ---- 祭品 / 超量 / 同调素材选择 ---- */
function startTributePick(handIdx, need) {
  if (!G.field.length) { toast('场上没有可作为祭品的怪兽'); return false; }
  cancelPick(true);
  G.pick = { type: 'tribute', handIdx, need, picked: [] };
  toast('上级召唤：在弹窗中选择 ' + need + ' 只祭品');
  openSummonModal('上级召唤 · 选择祭品 ×' + need);
  refreshFieldUI(); refreshHandUI();
  return true;
}
function startXyzPick(rec, src) {
  cancelPick(true);
  G.pick = { type: 'xyz', rec, picked: [], src: src.src, handIdx: src.handIdx, extraIdx: src.extraIdx };
  toast('超量召唤：在弹窗中选择 2 只等级 ' + (rec.level || 0) + ' 的素材');
  openSummonModal('超量召唤 · 选择素材 ×2（等级 ' + (rec.level || 0) + '）');
  refreshFieldUI(); refreshHandUI();
}
function startSynchroPick(rec, src) {
  cancelPick(true);
  G.pick = { type: 'synchro', rec, picked: [], src: src.src, handIdx: src.handIdx, extraIdx: src.extraIdx };
  toast('同调召唤：先点调整怪兽，再点素材（等级合计 ★' + (rec.level || 0) + '）');
  openSummonModal('同调召唤 · ' + rec.name + '（★' + (rec.level || 0) + '）');
  refreshFieldUI(); refreshHandUI();
}
/* ---- v23：融合召唤弹窗（①选融合目标怪兽 ②选融合素材） ---- */
const MON_KINDS = ['normal', 'effect', 'tuner', 'ritual', 'fusion', 'synchro', 'xyz', 'link'];

/* 「融合」魔法卡在手牌中的位置（-1 = 没有） */
function fusionSpellIdx() {
  return G.hand.findIndex(id => { const r = CARD_DB.cards[id]; return r && r.name === '融合'; });
}
/* 官方素材 id 表；null = 该卡无素材表（旧规：任意 2 只怪兽） */
function fusionMatIds(rec) {
  return (rec && rec.mats && rec.mats.length) ? rec.mats.map(Number) : null;
}
function fusionNeed(rec) { const m = fusionMatIds(rec); return m ? m.length : 2; }
function fusionMatText(rec) {
  const mats = fusionMatIds(rec);
  if (!mats) return '任意 2 只怪兽';
  return mats.map(id => { const r = CARD_DB.cards[id]; return r ? r.name : ('#' + id); }).join(' + ');
}
/* 可用素材池：场上怪兽 + 手牌怪兽（排除发动用的「融合」本体） */
function fusionPool(p) {
  const pool = [];
  G.field.forEach(m => pool.push({ src: 'field', m, id: +m.id }));
  G.hand.forEach((id, i) => {
    if (p && i === p.spellIdx) return;
    const r = CARD_DB.cards[id];
    if (r && MON_KINDS.includes(r.kind)) pool.push({ src: 'hand', idx: i, id: +id, rec: r });
  });
  return pool;
}
/* 该素材 id 是否仍被目标怪兽的素材表需要（用于灰化不可用卡片） */
function fusionUsable(p, id) {
  if (!p || !p.rec) return false;
  const mats = fusionMatIds(p.rec);
  if (!mats) return true;
  const used = {};
  p.picked.forEach(m => { used[+m.id] = (used[+m.id] || 0) + 1; });
  p.handPicked.forEach(i => { const hid = +G.hand[i]; used[hid] = (used[hid] || 0) + 1; });
  const total = mats.filter(x => x === +id).length;
  return (used[+id] || 0) < total;
}
/* 场上 + 手牌能否凑齐素材表 */
function fusionFeasible(rec, probe) {
  const mats = fusionMatIds(rec);
  const pool = fusionPool(probe).map(x => x.id);
  if (!mats) return pool.length >= 2;
  const need = mats.slice();
  for (const mid of pool) { const k = need.indexOf(mid); if (k >= 0) need.splice(k, 1); }
  return need.length === 0;
}
/* 额外卡组中所有融合怪兽 + 是否素材齐备 */
function fusionTargets(spellIdx) {
  const si = (spellIdx == null) ? fusionSpellIdx() : spellIdx;
  const probe = { spellIdx: si };
  const out = [];
  G.extra.forEach((id, i) => {
    const rec = CARD_DB.cards[id];
    if (!rec || rec.kind !== 'fusion') return;
    out.push({ id: +id, extraIdx: i, rec, ok: fusionFeasible(rec, probe) });
  });
  return out;
}
/* 当前所选素材是否正好满足融合条件 */
function fusionCheckOk(p) {
  if (!p || p.type !== 'fusion' || !p.rec) return false;
  const ids = p.picked.map(m => +m.id).concat(p.handPicked.map(i => +G.hand[i]));
  const mats = fusionMatIds(p.rec);
  if (!mats) return ids.length === 2;
  if (ids.length !== mats.length) return false;
  const a = ids.slice().sort((x, y) => x - y), b = mats.slice().sort((x, y) => x - y);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* 打开融合弹窗：opt.extraIdx 已定 → 直接进第 2 步；否则从第 1 步选目标开始 */
function startFusionPick(rec, opt) {
  opt = opt || {};
  const spellIdx = (opt.spellIdx != null) ? opt.spellIdx : fusionSpellIdx();
  if (spellIdx < 0) { toast('需要手牌中的「融合」魔法卡'); playSfx('hurt'); return false; }
  const hasFusionMon = G.extra.some(id => { const r = CARD_DB.cards[id]; return r && r.kind === 'fusion'; });
  if (!hasFusionMon) { toast('额外卡组没有融合怪兽'); playSfx('hurt'); return false; }
  cancelPick(true);
  const startMat = opt.extraIdx != null && opt.extraIdx >= 0 && rec;
  G.pick = {
    type: 'fusion', phase: startMat ? 'mat' : 'target',
    rec: rec || null, extraIdx: startMat ? opt.extraIdx : -1,
    spellIdx, picked: [], handPicked: []
  };
  openSummonModal(startMat ? ('融合召唤 · ' + rec.name) : '融合召唤 · 选择融合怪兽');
  renderSummonSlots();
  refreshFieldUI(); refreshHandUI();
  toast(startMat ? '选择融合素材：手牌 + 场上' : '选择要融合出来的怪兽');
  return true;
}
/* 从手牌发动「融合」魔法卡（activateSpell 拦截调用） */
function startFusionFromSpell(handIdx) {
  return startFusionPick(null, { spellIdx: handIdx });
}
/* 第 1 步：选中融合目标 → 进入第 2 步选素材 */
function chooseFusionTarget(extraIdx) {
  const p = G.pick;
  if (!p || p.type !== 'fusion') return false;
  const id = G.extra[extraIdx], rec = CARD_DB.cards[id];
  if (!rec) return false;
  p.rec = rec; p.extraIdx = extraIdx; p.phase = 'mat';
  p.picked = []; p.handPicked = [];
  $('summon-title').textContent = '融合召唤 · ' + rec.name;
  renderSummonSlots();
  playSfx('draw');
  return true;
}
/* 第 2 步：返回目标列表 */
function fusionBack() {
  const p = G.pick;
  if (!p || p.type !== 'fusion' || p.phase !== 'mat') return false;
  p.phase = 'target'; p.rec = null; p.extraIdx = -1; p.picked = []; p.handPicked = [];
  $('summon-title').textContent = '融合召唤 · 选择融合怪兽';
  renderSummonSlots();
  return true;
}
/* 场上素材点选 */
function toggleFusionMatField(m) {
  const p = G.pick;
  if (!p || p.type !== 'fusion') return;
  const at = p.picked.indexOf(m);
  if (at >= 0) p.picked.splice(at, 1);
  else {
    if (!fusionUsable(p, m.id)) { toast('该怪兽不在融合素材要求内'); playSfx('hurt'); return; }
    if (p.picked.length + p.handPicked.length >= fusionNeed(p.rec)) { toast('素材已选满（' + fusionNeed(p.rec) + ' 只）'); return; }
    p.picked.push(m);
  }
  playSfx('draw');
  renderSummonSlots(); refreshFieldUI();
}
/* 手牌素材点选 */
function toggleFusionMatHand(handIdx) {
  const p = G.pick;
  if (!p || p.type !== 'fusion') return;
  const at = p.handPicked.indexOf(handIdx);
  if (at >= 0) p.handPicked.splice(at, 1);
  else {
    if (!fusionUsable(p, G.hand[handIdx])) { toast('该怪兽不在融合素材要求内'); playSfx('hurt'); return; }
    if (p.picked.length + p.handPicked.length >= fusionNeed(p.rec)) { toast('素材已选满（' + fusionNeed(p.rec) + ' 只）'); return; }
    p.handPicked.push(handIdx);
  }
  playSfx('draw');
  renderSummonSlots();
}
/* 渲染第 1 步：可选融合怪兽列表 */
function renderFusionTargets() {
  const box = $('summon-targets');
  const p = G.pick;
  if (!box || !p) return;
  const list = fusionTargets(p.spellIdx);
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<span class="g-empty">额外卡组中没有融合怪兽</span>';
    $('summon-hint').textContent = '额外卡组没有融合怪兽 · ESC 取消';
    return;
  }
  list.forEach(t => {
    const el = document.createElement('div');
    el.className = 'sum-target ' + (t.ok ? 'ok' : 'no');
    el.title = t.rec.name + '　★' + (t.rec.level || 0) + ' / 素材：' + fusionMatText(t.rec);
    el.innerHTML =
      '<img src="' + (window.__cardImg ? __cardImg(t.id) : 'data/cardimg/' + t.id + '.jpg') + '" alt="" draggable="false">' +
      '<em>' + t.rec.name + '</em>' +
      '<span class="st-atk">★' + (t.rec.level || 0) + ' · ATK ' + (t.rec.atk || 0) + '</span>';
    el.addEventListener('click', () => {
      if (!t.ok) { toast('素材不齐：需要 ' + fusionMatText(t.rec)); playSfx('hurt'); return; }
      chooseFusionTarget(t.extraIdx);
    });
    box.appendChild(el);
  });
  const okN = list.filter(t => t.ok).length;
  $('summon-hint').textContent = '共 ' + list.length + ' 张融合怪兽 · 素材齐备 ' + okN +
    ' 张（绿框可点）· 点卡片进入选素材 · ESC 取消';
}
/* 渲染第 2 步：手牌素材行 */
function renderFusionHand() {
  const box = $('summon-handrow');
  const p = G.pick;
  if (!box || !p) return;
  box.innerHTML = '';
  const pool = fusionPool(p).filter(x => x.src === 'hand');
  if (!pool.length) {
    box.innerHTML = '<span class="g-empty">手牌中没有可作为素材的怪兽（可用场上怪兽）</span>';
    return;
  }
  pool.forEach(x => {
    const on = p.handPicked.includes(x.idx);
    const usable = fusionUsable(p, x.id);
    const el = document.createElement('div');
    el.className = 'sum-hcard' + (on ? ' on' : '') + (usable ? '' : ' no');
    el.title = x.rec.name + '　★' + (x.rec.level || 1);
    el.innerHTML = '<img src="' + (window.__cardImg ? __cardImg(x.id) : 'data/cardimg/' + x.id + '.jpg') + '" alt="" draggable="false">' +
      '<i>' + x.rec.name + '</i>';
    el.addEventListener('click', () => toggleFusionMatHand(x.idx));
    box.appendChild(el);
  });
}
/* 确认融合：额外卡组 → 场上，素材与「融合」入墓 */
function confirmFusion(p) {
  if (!p.rec || p.extraIdx < 0) { toast('请先选择融合目标'); return; }
  if (!fusionCheckOk(p)) {
    toast('素材不满足：需要 ' + fusionMatText(p.rec));
    closeSummonModal(); G.pick = null; refreshFieldUI(); refreshHandUI();
    return;
  }
  const rec = p.rec;
  const eIdx = p.extraIdx;
  const fieldMats = p.picked.filter(m => G.field.includes(m));
  const handIdxs = p.handPicked.slice();
  G.pick = null;
  /* 手牌素材 + 「融合」一起送墓（索引降序删除） */
  const idxs = handIdxs.slice();
  if (p.spellIdx >= 0 && !idxs.includes(p.spellIdx)) idxs.push(p.spellIdx);
  const graveIds = idxs.map(i => G.hand[i]).filter(x => x != null);
  idxs.sort((a, b) => b - a).forEach(i => G.hand.splice(i, 1));
  graveIds.forEach(gid => G.grave.push(gid));
  /* 场上素材破坏入墓 */
  fieldMats.forEach(m => destroyMonster(m, true));
  /* 额外卡组取走融合怪兽 */
  const at = G.extra.indexOf(rec.id);
  G.extra.splice(at >= 0 ? at : eIdx, 1);
  closeSummonModal();
  refreshHandUI(); refreshFieldUI();
  fieldSummon(rec, undefined, { type: '融合召唤' });
  afterSummon('融合召唤', rec);
  toast('融合召唤：' + rec.name);
  return true;
}

function togglePickField(m) {
  if (!G.pick || (G.screen !== 'playing' && G.screen !== 'summon')) return;
  if (G.pick.type === 'fusion') { toggleFusionMatField(m); return; }
  const at = G.pick.picked.indexOf(m);
  if (at >= 0) G.pick.picked.splice(at, 1);
  else {
    if (G.pick.type === 'tribute' && G.pick.picked.length >= G.pick.need) { toast('祭品已选满'); return; }
    if (G.pick.type === 'xyz') {
      if ((m.level || 0) !== (G.pick.rec.level || 0)) { toast('超量素材需等级 ' + (G.pick.rec.level || 0)); return; }
      if (G.pick.picked.length >= 2) { toast('素材已选满（2 只）'); return; }
    }
    if (G.pick.type === 'synchro') {
      if (G.pick.picked.length === 0) {
        if (!m.rec.tuner) { toast('第 1 只必须为调整（Tuner）怪兽'); return; }
      } else {
        if (m.rec.tuner) { toast('同调素材只需 1 只调整怪兽，其余选非调整'); return; }
        if (G.pick.picked.length >= 5) { toast('素材最多 5 只'); return; }
      }
    }
    G.pick.picked.push(m);
  }
  refreshFieldUI();
  renderSummonSlots();
  if (G.pick && (G.pick.type === 'tribute' || G.pick.type === 'xyz') &&
      G.pick.picked.length >= (G.pick.type === 'tribute' ? G.pick.need : 2)) confirmPick();
}
function synchroPickOk() {
  const p = G.pick;
  if (!p || p.type !== 'synchro') return false;
  if (!p.picked.length || !p.picked[0].rec.tuner) return false;
  let lv = 0;
  for (const m of p.picked) lv += (m.level || 0);
  return lv === (p.rec.level || 0);
}
function confirmPick() {
  const p = G.pick;
  if (!p) return;
  if (p.type === 'fusion') { confirmFusion(p); return; }   // v23：融合走专用结算
  G.pick = null;
  // 校验所选怪兽仍在场上（中途被摧毁则放弃本次召唤）
  p.picked = (p.picked || []).filter(m => G.field.includes(m));
  if (p.type === 'tribute' && p.picked.length < p.need) { toast('祭品已不在场上，召唤取消'); closeSummonModal(); refreshFieldUI(); return; }
  if (p.type === 'xyz' && p.picked.length < 2) { toast('素材已不在场上，召唤取消'); closeSummonModal(); refreshFieldUI(); return; }
  if (p.type === 'synchro') {
    if (!p.picked.length || !p.picked[0].rec.tuner) { toast('需要 1 只调整怪兽作为同调素材'); closeSummonModal(); refreshFieldUI(); return; }
    let lv = 0;
    for (const m of p.picked) lv += (m.level || 0);
    if (lv !== (p.rec.level || 0)) { toast('素材等级合计 ' + lv + ' ≠ ★' + (p.rec.level || 0) + '，召唤取消'); closeSummonModal(); refreshFieldUI(); return; }
  }
  if (p.type === 'tribute') {
    const rec = CARD_DB.cards[G.hand[p.handIdx]];
    if (!rec) { closeSummonModal(); refreshFieldUI(); return; }
    p.picked.forEach(m => destroyMonster(m, true));
    G.hand.splice(p.handIdx, 1);
    G.tributeCount = (G.tributeCount || 0) + p.picked.length;
    refreshHandUI();
    fieldSummon(rec, undefined, { type: '上级召唤' });
    G.normalCd = 3.0;
    afterSummon('上级召唤', rec);
  } else if (p.type === 'xyz') {
    const rec = p.rec;
    p.picked.forEach(m => destroyMonster(m, true));
    if (p.src === 'hand') G.hand.splice(p.handIdx, 1);
    else if (p.src === 'extra') G.extra.splice(p.extraIdx, 1);
    refreshHandUI();
    fieldSummon(rec, undefined, { type: '超量召唤' });
    afterSummon('超量召唤', rec);
  } else if (p.type === 'synchro') {
    const rec = p.rec;
    p.picked.forEach(m => destroyMonster(m, true));
    if (p.src === 'hand') G.hand.splice(p.handIdx, 1);
    else if (p.src === 'extra') G.extra.splice(p.extraIdx, 1);
    refreshHandUI();
    fieldSummon(rec, undefined, { type: '同调召唤' });
    afterSummon('同调召唤', rec);
  }
  closeSummonModal();
  refreshFieldUI();
}
function cancelPick(silent) {
  if (!G.pick) return;
  G.pick = null;
  closeSummonModal();
  refreshFieldUI(); refreshHandUI();
  if (!silent) toast('已取消选择');
}

function afterSummon(type, rec) {
  G.normalUsed = (G.normalUsed || 0) + 1;
  unlockAch('firstSummon');
  if (G.field.length >= MAX_FIELD) unlockAch('fullField');
  if (type === '同调召唤') unlockAch('synchro');
  if (type === '超量召唤') unlockAch('xyz');
  if (type === '连接召唤') unlockAch('link');
  if (type === '融合召唤') unlockAch('fusion');
  playSfx('reveal');
  popDamage(P.pos.x, 2.6, P.pos.z, type + '！', 'crit');
  addRing(P.pos.x, P.pos.z, 0.6, 4, 0, CHARS[G.charId].color, 0.7);
  burst(P.pos.x, 1.2, P.pos.z, 16, CHARS[G.charId].color, 6, 0.7);
  G.flashT = 0.2;
  refreshHandUI();
  refreshFieldUI();
  /* v19：读取该怪兽卡原文 → 触发对应的「登场效果」 */
  let m = null;
  for (let i = G.field.length - 1; i >= 0; i--) if (+G.field[i].id === +rec.id) { m = G.field[i]; break; }
  if (m) runSummonEffect(m, type);
}

/* ---------------- 怪兽登场效果（v19） ---------------- */
/* 规则：读取卡牌原文 desc，映射为本作可执行效果。
   本作没有连锁/双方回合，故把「召唤成功时发动」类文本统一折成登场瞬间的一次性效果：
     全场攻击（全场破坏 / 给对方伤害 / 展开类）
     登场抽卡、登场回复、登场强化、登场守护（无效系）
     其余有文字的怪兽 → 局部登场冲击；通常怪兽 → 弱化冲击（纯演出）
   full=true 的全场效果只在「上级/融合/同调/超量/连接」或 ★7+ 登场时生效，
   低星通常召唤降级为局部冲击（避免 ★1-4 刷全场）。 */
const SUMMON_FX = {
  aoe:    { label: '全场攻击', color: 0xffcf6b },
  burst:  { label: '登场冲击', color: 0xffd76b },
  draw:   { label: '登场抽卡', color: 0x7fe6a8 },
  heal:   { label: '登场回复', color: 0x8fe0ff },
  atk:    { label: '登场强化', color: 0xff8c42 },
  shield: { label: '登场守护', color: 0xa8b8ff }
};
const BIG_SUMMON = { '上级召唤': 1, '融合召唤': 1, '同调召唤': 1, '超量召唤': 1, '连接召唤': 1 };

/* 说明：卡库中约 98% 的怪兽效果原文为英文（cards_ext.js 来自国际卡库），
   本家 155 张为中文，故规则必须双语并行。 */
const RE = {
  /* 中文 */
  zhAll: /全部|所有|对方场上|场上的.{0,6}怪兽/,
  zhDestroy: /破坏/,
  zhDamage: /伤害/,
  zhDraw: /抽\d*张|加入手牌|卡组最上面/,
  zhHeal: /回复|恢复/,
  zhAtkUp: /攻击力.{0,4}(上升|提高|加\d|变成)/,
  zhNegate: /无效/,
  zhSummon: /特殊召唤|衍生物/,
  /* 英文 */
  enAll: /destroy all|all (?:monsters|cards)[^.]{0,40}(?:opponent|your opponent)|each (?:monster|player)|every/i,
  enDestroy: /\bdestroy(?:ed|s)?\b/i,
  enDamage: /\bdamage\b|inflict/i,
  enDraw: /\bdraw\s*\d*\s*card|add \d+[^.]{0,40}from your Deck to your hand/i,
  enHeal: /gain[^.]{0,30}Life Points|Life Points[^.]{0,20}gain|recover/i,
  enAtkUp: /gains?\s*\d+\s*ATK|ATK[^.]{0,20}(?:increase|gain)|increase[^.]{0,20}ATK/i,
  enNegate: /\bnegate\b|cannot be destroyed/i,
  enSummon: /Special Summon|\bToken\b/i
};
function summonFxOf(rec) {
  if (!rec) return null;
  if (rec._sfx !== undefined) return rec._sfx;
  const raw = String(rec.desc || '');
  const d = raw.replace(/\s+/g, ' ');
  /* 中文规则不会命中英文文本、反之亦然，故直接并行匹配 */
  const has = (a, b) => a.test(d) || b.test(d);
  let fx;
  if (isGodCard(rec)) {
    /* 三幻神：3 祭品降临，登场必为全场冲击（不受召唤类型上限） */
    fx = { kind: 'aoe', full: true, mul: 0.9, god: true, text: '幻神降临 → 全场攻击' };
  } else if (rec.kind === 'normal') {
    /* 通常怪兽：desc 为风味文本（中/英），不做效果解析，仅登场尘土 */
    fx = { kind: 'burst', full: false, weak: true, text: '' };
  } else if ((RE.zhDestroy.test(d) && RE.zhAll.test(d)) || (RE.enDestroy.test(d) && RE.enAll.test(d))) {
    fx = { kind: 'aoe', full: true, mul: 0.85, text: '召唤成功时破坏对方场上全部怪兽 → 全场攻击' };
  } else if (has(RE.zhDestroy, RE.enDestroy)) {
    fx = { kind: 'aoe', full: false, mul: 0.5, text: '召唤成功时破坏怪兽 → 登场冲击' };
  } else if (has(RE.zhDamage, RE.enDamage)) {
    const full = has(RE.zhAll, RE.enAll);
    fx = { kind: 'aoe', full: full, mul: full ? 0.62 : 0.55, text: full ? '召唤成功时给与对方全体伤害 → 全场攻击' : '召唤成功时给与对方伤害 → 冲击' };
  } else if (has(RE.zhDraw, RE.enDraw)) {
    fx = { kind: 'draw', n: 1, text: '召唤成功时检索卡组 → 抽 1 张' };
  } else if (has(RE.zhHeal, RE.enHeal)) {
    fx = { kind: 'heal', text: '召唤成功时回复基本分 → 恢复 LP' };
  } else if (has(RE.zhAtkUp, RE.enAtkUp)) {
    fx = { kind: 'atk', text: '召唤成功时攻击力上升 → 登场强化' };
  } else if (has(RE.zhNegate, RE.enNegate)) {
    fx = { kind: 'shield', text: '召唤成功时使效果无效 → 登场守护' };
  } else if (has(RE.zhSummon, RE.enSummon)) {
    fx = { kind: 'burst', full: true, mul: 0.4, text: '召唤成功时展开 → 全场冲击' };
  } else {
    fx = { kind: 'burst', full: false, text: '' };
  }
  fx.src = d.slice(0, 60);       // 原文片段（调试/详情用）
  rec._sfx = fx;
  return fx;
}
/* 卡牌详情用文案 */
function summonFxText(rec) {
  const fx = summonFxOf(rec);
  if (!fx || !fx.text) return '';
  return fx.text;
}

function runSummonEffect(m, type) {
  const fx = summonFxOf(m.rec);
  if (!fx) return;
  const px = m.obj.position.x, pz = m.obj.position.z;
  const atk = Math.max(500, m.atk || 0, (m.rec && m.rec.atk) || 0);
  const boost = 1 + (G.atkBuff || 0);
  const big = !!BIG_SUMMON[type] || (m.level || 1) >= 7;
  let full = !!fx.full && big;

  if (fx.kind === 'aoe') {
    const dmg = Math.max(60, Math.round(atk * fx.mul * boost * (full ? 1 : 0.55)));
    const col = SUMMON_FX.aoe.color;
    /* 扩散冲击环本体即伤害源（updateRings 逐圈判定），r1=全场半径 */
    addRing(px, pz, 0.8, full ? ARENA_R : 5.2, dmg, col, full ? 0.95 : 0.5);
    if (full) {
      for (let i = 1; i <= 3; i++) addRing(px, pz, 0.6, ARENA_R * (0.5 + i * 0.18), 0, col, 0.7 + i * 0.12);
      burst(px, 1.6, pz, 46, 0xffe8a8, 11, 1.1, true);
      G.flashT = Math.max(G.flashT, 0.3);
      G.shake = Math.max(G.shake, 0.5);
      playSfx('bossdown');
    } else {
      burst(px, 1.0, pz, 18, col, 7, 0.6);
      G.shake = Math.max(G.shake, 0.22);
      playSfx('hit');
    }
    if (m.rec) spellArtFx(m.rec, col);
    toast(m.rec.name + ' · 登场效果：' + (full ? '全场攻击' : '冲击') + ' ' + dmg);
    return;
  }

  if (fx.kind === 'draw') {
    let got = 0;
    for (let i = 0; i < (fx.n || 1); i++) {
      if (G.hand.length >= HAND_MAX) break;
      const id = drawFromDeck();
      if (id === undefined || id === null) break;
      G.hand.push(id); got++;
    }
    if (got) { refreshHandUI(); addRing(px, pz, 0.5, 3.2, 0, 0x7fe6a8, 0.6); }
    toast(m.rec.name + ' · 登场效果：抽 ' + got + ' 张');
    return;
  }

  if (fx.kind === 'heal') {
    const heal = Math.round(P.maxLP * 0.12);
    const before = P.lp;
    P.lp = Math.min(P.maxLP, P.lp + heal);
    const real = Math.round(P.lp - before);
    if (real > 0) popDamage(P.pos.x, 2.0, P.pos.z, '+' + real + ' LP', 'lp');
    addRing(px, pz, 0.5, 3.4, 0, 0x8fe0ff, 0.6);
    burst(px, 1.2, pz, 14, 0x8fe0ff, 6, 0.6);
    toast(m.rec.name + ' · 登场效果：回复 ' + real + ' LP');
    return;
  }

  if (fx.kind === 'atk') {
    const add = Math.round(Math.max(300, m.atk * 0.2));
    m.atk += add;
    addRing(px, pz, 0.5, 3.0, 0, 0xff8c42, 0.55);
    burst(px, 1.4, pz, 12, 0xff8c42, 6, 0.6);
    popDamage(px, 2.2, pz, 'ATK +' + add, 'crit');
    toast(m.rec.name + ' · 登场效果：攻击力 +' + add);
    return;
  }

  if (fx.kind === 'shield') {
    P.iframe = Math.max(P.iframe, 2);
    m.atk = Math.round(m.atk * 1.15);
    addRing(px, pz, 0.5, 3.6, 0, 0xa8b8ff, 0.7);
    burst(px, 1.3, pz, 16, 0xa8b8ff, 5, 0.7);
    toast(m.rec.name + ' · 登场效果：决斗者 2 秒无敌，攻击力 +15%');
    return;
  }

  /* burst：兜底登场冲击（通常怪兽更弱，只作演出） */
  const bd = Math.max(40, Math.round(atk * (fx.weak ? 0.18 : 0.32) * boost));
  addRing(px, pz, 0.5, fx.weak ? 2.6 : 4.2, bd, SUMMON_FX.burst.color, 0.5);
  burst(px, 0.9, pz, fx.weak ? 8 : 14, SUMMON_FX.burst.color, 5, 0.5);
  if (fx.text) toast(m.rec.name + ' · 登场效果：全场冲击 ' + bd);
}


function extraHint(rec) {
  switch (rec.kind) {
    case 'synchro': return '同调：场上需调整怪兽 + 等级合计 ' + (rec.level || 0) + ' 的怪兽';
    case 'xyz': return '超量：场上需 2 只等级 ' + (rec.level || 0) + ' 的怪兽';
    case 'link': return '连接：场上需 ' + (rec.link || 2) + ' 只怪兽作为素材';
    case 'fusion': {
      if (rec.mats) {
        const need = rec.mats.map(mid => {
          const mr = CARD_DB.cards[mid] || {};
          const inHand = G.hand.some(hid => +hid === +mid);
          const onField = G.field.some(m => m.id === mid);
          return mr.name + '（' + (onField ? '场✓' : inHand ? '手✓' : '缺') + '）';
        }).join('、');
        return '融合：需手牌「融合」+ 素材（' + need + '）';
      }
      return '融合：需手牌「融合」+ 场上 2 只怪兽';
    }
  }
  return '无法召唤';
}

/* ---- 魔法 / 陷阱 ---- */
function activateSpell(handIdx) {
  const id = G.hand[handIdx];
  const rec = CARD_DB.cards[id];
  /* v23：「融合」魔法卡 → 先选融合目标、再选素材（卡片留到确认时才送墓） */
  if (rec && rec.name === '融合') {
    if (startFusionFromSpell(handIdx)) { playSfx('reveal'); return true; }
    return false;                    // 额外卡组无融合怪兽 / 无法发动：不消耗
  }
  /* v0.4.2：带负面代价（支付 LP / 丢弃手牌 / 卡组送墓 / 解放）的卡先弹代价确认窗，
   * 确认并校验可支付后才扣卡生效；无代价卡维持原即时结算 */
  if (costHasAny(spellCostOf(rec))) {
    openCostConfirm(id);
    return true;
  }
  return resolveSpell(handIdx);
}
/* 实际结算（代价已在 confirmCost 支付，或本就无代价） */
function resolveSpell(handIdx) {
  const id = G.hand[handIdx];
  const rec = CARD_DB.cards[id];
  if (!rec) return false;
  const eff = rec.effect || {};
  handRemove(handIdx);
  G.spellUsed = (G.spellUsed || 0) + 1;
  unlockAch('firstSpell');
  if (rec.kind === 'trap') trapActivateFx(rec);   // 陷阱专属生效演出
  else spellArtFx(rec, eff.burn ? 0xff7a3a : 0x62e0b0);
  playSfx('reveal');
  popDamage(P.pos.x, 2.4, P.pos.z, rec.name, 'lp');

  if (eff.draw) {
    for (let i = 0; i < eff.draw; i++) drawCard(true, true);
    toast('抽 ' + eff.draw + ' 张');
  }
  if (eff.aoe) {
    addRing(P.pos.x, P.pos.z, 1.0, 26, 0, 0xffd76b, 0.8);
    for (const e of enemies.slice()) {
      if (!e.dead) hurtEnemy(e, eff.aoe, false);
    }
    G.flashT = 0.25; G.shake = 0.4;
  }
  if (eff.clear) clearEnemyBullets();
  if (eff.heal) {
    P.lp = Math.min(P.maxLP, P.lp + P.maxLP * eff.heal);
    popDamage(P.pos.x, 2.0, P.pos.z, '+' + Math.round(P.maxLP * eff.heal) + ' LP', 'lp');
  }
  if (eff.buffAtk) {
    G.atkBuff += eff.buffAtk;
    toast('全部怪兽攻击力 +' + Math.round(eff.buffAtk * 100) + '%');
  }
  if (eff.dr) { G.drBuff += eff.dr; P.dr = Math.min(0.7, P.dr + eff.dr); }
  if (eff.thorns) { G.thornsBuff += eff.thorns; P.thorns = Math.min(0.8, P.thorns + eff.thorns); }
  if (eff.slow) G.slowBuff += eff.slow;
  if (eff.destroyFar) {
    const list = nearestList(P.pos.x, P.pos.z, 999, 60).slice(-eff.destroyFar);
    list.forEach(pair => { if (!pair[0].dead) hurtEnemy(pair[0], 99999, false); });
  }
  if (eff.searchM) {
    const pool = G.deck.slice(G.deckPos).filter(x => {
      const r = CARD_DB.cards[x];
      return r && ['normal', 'effect', 'tuner'].includes(r.kind);
    });
    if (pool.length) {
      G.hand.push(pool[0]);
      toast('检索：' + CARD_DB.cards[pool[0]].name);
    }
  }
  if (eff.revive) {
    /* v0.4.0：死者苏生 → 弹窗由玩家自选墓地怪兽复活（墓地只有 1 只时直接复活） */
    const mons = graveMonsterIdxs();
    if (!mons.length) toast('墓地没有可复活的怪兽');
    else if (mons.length === 1) reviveGraveAt(mons[0], true);
    else beginRevivePick();
  }
  /* v0.4.2：仪式魔法 → 从卡组特殊召唤该仪式怪兽 */
  if (eff.ritual) ritualSummonFromDeck(eff);
  if (eff.special === 'darkmagic') {
    const rec2 = CARD_DB.cards[46986414];
    P.lp = Math.max(1, P.lp - P.maxLP * 0.1);
    fieldSummon(rec2, undefined, { type: '特殊召唤' });
    toast('特殊召唤：黑魔导');
    G.spSummon = (G.spSummon || 0) + 1;
  }
  refreshHandUI();
  refreshFieldUI();
  return true;
}

/* ---------------- v0.4.0 死者苏生：墓地自选复活 ---------------- */
function graveMonsterIdxs() {
  const out = [];
  (G.grave || []).forEach((gid, i) => {
    const r = CARD_DB.cards[gid];
    if (r && MON_KINDS.indexOf(r.kind) >= 0) out.push(i);
  });
  return out;
}
function reviveGraveAt(gi) {
  closeRevivePick();
  const gid = G.grave[gi];
  if (gid == null) return false;
  const rec = CARD_DB.cards[gid];
  if (!rec) return false;
  if (G.field.length >= MAX_FIELD) { toast('场上已满，无法复活'); playSfx('hurt'); return false; }
  G.grave.splice(gi, 1);
  const m = fieldSummon(rec, undefined, { type: '特殊召唤' });
  if (!m) { G.grave.splice(gi, 0, gid); return false; }
  G.spSummon = (G.spSummon || 0) + 1;
  if (isGodCard(rec)) {
    m.godLifetime = 30; m.godTick = 0;
    toast('死者苏生 · ' + rec.name + ' —— 三幻神只能在场上存在 30 秒！');
  } else {
    toast('死者苏生：' + rec.name);
  }
  playSfx('reveal');
  refreshHandUI();
  refreshFieldUI();
  return true;
}
function beginRevivePick() {
  if (G.screen !== 'playing') { reviveGraveAt(graveMonsterIdxs()[0]); return; }
  /* v0.4.1：场上已满时先提示再开选择器（魔法卡已消耗，避免玩家白选一场） */
  if (G.field.length >= MAX_FIELD) { toast('场上已满，无法复活'); playSfx('hurt'); return; }
  renderReviveGrid();
  G.screen = 'revpick';
  $('s-revpick').classList.remove('hidden');
  playSfx('draw');
}
function closeRevivePick() {
  const el = $('s-revpick');
  if (el && !el.classList.contains('hidden')) {
    el.classList.add('hidden');
    if (G.screen === 'revpick') { G.screen = 'playing'; lockNow(); }
  }
}
function renderReviveGrid() {
  const box = $('revp-grid');
  if (!box) return;
  box.innerHTML = '';
  const idxs = graveMonsterIdxs();
  if (!idxs.length) { box.innerHTML = '<span class="g-empty">墓地没有可复活的怪兽</span>'; return; }
  idxs.forEach(gi => {
    const rec = CARD_DB.cards[G.grave[gi]];
    if (!rec) return;
    const el = cardThumb(rec, 'ex-card ok');
    const god = isGodCard(rec);
    el.title = rec.name + (god ? '　⚠ 复活后只能存在 30 秒' : ' · 点击复活');
    if (god) {
      const w = document.createElement('div');
      w.className = 'revp-god-warn';
      w.textContent = '30s';
      el.appendChild(w);
    }
    el.addEventListener('click', () => reviveGraveAt(gi));
    el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(rec); });
    box.appendChild(el);
  });
  const n = $('revp-count');
  if (n) n.textContent = idxs.length;
}

/* ---------------- v0.4.0 手牌弹窗：召唤 or 发动效果 ---------------- */
function openPlayPick(idx) {
  if (G.screen !== 'playing' || G.pick || G.discardMode) return;
  if (G.costPending || G.costPick) return;          // v0.4.2：代价弹窗打开中不叠层
  const id = G.hand[idx];
  const rec = CARD_DB.cards[id];
  if (!rec) return;
  G.playPickIdx = idx;
  const box = $('pp-card');
  if (box) { box.innerHTML = ''; box.appendChild(cardThumb(rec, 'pp-thumb')); }
  const nm = $('pp-name');
  if (nm) nm.textContent = rec.name;
  const isMon = MON_KINDS.indexOf(rec.kind) >= 0;
  const fx = HAND_FX[+id];
  const bSummon = $('pp-summon'), bFx = $('pp-fx'), bMill = $('pp-mill'), bAct = $('pp-act');
  if (bSummon) {
    bSummon.classList.toggle('hidden', !isMon || rec.kind === 'ritual');   // v0.4.2：仪式怪兽无召唤钮
    const need = isMon ? tributeNeed(rec) : 0;
    bSummon.textContent = isMon ? (need > 0 ? '召唤（需 ' + need + ' 只祭品）' : '通常召唤') : '召唤';
  }
  if (bAct) bAct.classList.toggle('hidden', isMon);
  const fxOk = !!(fx && fx.active);
  if (bFx) {
    bFx.classList.toggle('hidden', !fxOk);
    if (fxOk) {
      const left = handFxReadyIn(+id);
      bFx.textContent = left > 0.05 ? '效果（冷却 ' + fmtTime(left) + '）' : '发动效果 · ' + fx.name;
      bFx.disabled = left > 0.05;
    }
  }
  if (bMill) {
    const canMill = !isExtraKind(rec.kind) && (G.millLeft || 0) > 0;
    bMill.classList.toggle('hidden', !canMill);
    bMill.textContent = '弃牌抽 1（剩 ' + (G.millLeft || 0) + '）';
  }
  /* v0.4.2：效果文本 —— 点击卡牌即写出效果（替代长按才显示） */
  {
    const note = $('pp-fx-note');
    if (note) {
      const parts = [];
      if (isMon) {
        if (rec.kind === 'ritual') parts.push('⚠ 仪式怪兽：只能通过仪式魔法从卡组特殊召唤，不能通常召唤');
        else {
          const sfx = summonFxText(rec);
          if (sfx) parts.push('登场效果 · ' + sfx);
          if (isGodCard(rec)) parts.push('三幻神 · 需 3 只祭品，降临即全场攻击');
        }
        const fxH = HAND_FX[+id];
        if (fxH) parts.push('手牌效果 · ' + fxH.tip);
      } else {
        const sum = spellFxSummary(rec);
        if (sum) parts.push('本作效果 · ' + sum);
        if (rec.desc) parts.push('卡面原文 · ' + String(rec.desc).slice(0, 220) + (String(rec.desc).length > 220 ? '…' : ''));
      }
      const costs = spellCostLines(rec);
      let html = parts.join('\n\n');
      if (costs.length) html += (html ? '\n\n' : '') + '<span class="fx-cost">代价 · ' + costs.join('；') + '</span>';
      note.innerHTML = html;
    }
  }
  $('s-playpick').classList.remove('hidden');
  syncUiBlock();                    // v0.4.2：弹窗期间禁摇杆，防吞点击
  Cursor.sync();
}
function closePlayPick() {
  const el = $('s-playpick');
  if (el) el.classList.add('hidden');
  G.playPickIdx = null;
  Cursor.sync();
}

/* ---------------- v0.4.0 手机端手牌面板：卡背点击展开 ---------------- */
function openHandPanel() {
  if (G.screen !== 'playing') return;
  renderHandGrid();
  G.screen = 'handm';
  $('s-handm').classList.remove('hidden');
  playSfx('draw');
}
function closeHandPanel() {
  const el = $('s-handm');
  if (el && !el.classList.contains('hidden')) {
    el.classList.add('hidden');
    if (G.screen === 'handm') { G.screen = 'playing'; lockNow(); }
    /* v0.4.2b：面板关闭 = 取消弃牌模式（触屏无 ESC，必须给退出路径） */
    if (G.discardMode) cancelDiscardDraw(false);
  }
}
function renderHandGrid() {
  const box = $('handm-grid');
  if (!box) return;
  box.innerHTML = '';
  if (!G.hand.length) { box.innerHTML = '<span class="g-empty">手牌空空如也</span>'; }
  /* v0.4.2b：弃牌模式提示（满手抽卡后触屏唯一的弃牌入口） */
  const hint = $('handm-hint');
  if (hint) {
    hint.style.display = G.discardMode ? '' : 'none';
    if (G.discardMode) hint.textContent = '手牌已满 · 点击一张手牌送入墓地并抽 1 张（剩 ' + (G.millLeft || 0) + ' 次）· 关闭面板可取消';
  }
  G.hand.forEach((id, i) => {
    const rec = CARD_DB.cards[id];
    if (!rec) return;
    const el = cardThumb(rec, 'ex-card ok');
    const fx = HAND_FX[+id];
    if (fx) {
      const fb = document.createElement('div');
      fb.className = 'fx-badge' + ((!fx.active || handFxReadyIn(+id) <= 0.05) ? ' ready' : '');
      fb.textContent = fx.badge || '效';
      el.appendChild(fb);
    }
    if (G.discardMode) el.classList.add('discardable');
    el.title = rec.name + (G.discardMode ? ' · 点击作为弃牌送入墓地并抽 1 张' : ' · 点击选择');
    /* v0.4.2b：弃牌模式下点击即弃牌（旧版直接走 openPlayPick，被 discardMode 守卫拒掉 → 卡死） */
    el.addEventListener('click', () => {
      if (G.discardMode) { millHand(i); closeHandPanel(); return; }
      closeHandPanel(); openPlayPick(i);
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(rec); });
    box.appendChild(el);
  });
  const n = $('handm-count');
  if (n) n.textContent = G.hand.length + '/' + HAND_MAX;
}

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 1400);
}
function unlockAch(key) {
  if (window.META && META.unlock) META.unlock(key);
}
window.GAME_TOAST = toast;

/* ---------------- 3D 卡牌展示（抽卡界面） ---------------- */
var show3d = null;   // var 声明避免 resize 提前访问的 TDZ 问题
function cardShowScene() {
  if (show3d) return show3d;
  const sc = new T.Scene();
  sc.background = new T.Color(0x0d0a06);
  sc.fog = new T.Fog(0x0d0a06, 7, 15);
  const cam = new T.PerspectiveCamera(38, W / H, 0.1, 60);
  cam.position.set(0, 0, 4.8);
  sc.add(new T.HemisphereLight(0x8a7350, 0x161009, 0.45));
  const k = new T.DirectionalLight(0xfff1d6, 1.3);
  k.position.set(2.5, 4, 5); sc.add(k);
  const r2 = new T.DirectionalLight(0x6fa8ff, 0.4);
  r2.position.set(-3, 1.5, -2); sc.add(r2);
  try {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, '#fdf3dd'); grd.addColorStop(0.5, '#5a4732'); grd.addColorStop(1, '#0a0806');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(255,244,214,0.95)'; g.fillRect(18, 12, 30, 14);
    const tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    const pm = new T.PMREMGenerator(renderer);
    sc.environment = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose();
  } catch (e) { }
  const halo = new T.Mesh(
    new T.RingGeometry(0.95, 1.55, 48),
    new T.MeshBasicMaterial({ color: 0xc9a06a, transparent: true, opacity: 0.15, side: T.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2; halo.position.y = -1.5;
  sc.add(halo);
  const halo2 = halo.clone();
  halo2.scale.setScalar(1.7); halo2.material = halo.material.clone();
  halo2.material.opacity = 0.07; halo2.position.y = -1.52;
  sc.add(halo2);
  show3d = { sc, cam, mesh: null, anim: null, t: 0 };
  return show3d;
}
function showCard3D(id) {
  const img = imgCache[id];
  if (!img || !window.Card3D) return false;
  const s3 = cardShowScene();
  if (s3.mesh) { s3.sc.remove(s3.mesh); s3.mesh = null; }
  const kind = CARD_DB.cards[id].kind || 'spell';
  const m = Card3D.build(id, img, kind);
  m.rotation.y = Math.PI;
  m.scale.setScalar(0.001);
  s3.sc.add(m);
  s3.mesh = m;
  s3.anim = { t: 0, dur: 0.64 };
  s3.t = 0;
  return true;
}
function hideCard3D() {
  if (show3d && show3d.mesh) {
    show3d.sc.remove(show3d.mesh);
    show3d.mesh = null; show3d.anim = null;
  }
}
function setDraw3D(on) {
  sDraw.classList.toggle('mode3d', !!on);
}

/* ---------------- 手牌 / 场上 UI ---------------- */
function cardThumb(rec, cls) {
  const el = document.createElement('div');
  el.className = cls || 'hcard';
  const rar = rec.rarity || 'N';
  el.innerHTML =
    '<img src="' + (window.__cardImg ? __cardImg(rec.id) : 'data/cardimg/' + rec.id + '.jpg') + '" alt="" draggable="false">' +
    '<div class="hc-bar"><b>' + (rec.level ? '★' + rec.level : (rec.link ? 'L' + rec.link : '魔')) + '</b>' +
    '<span>' + (rec.atk ? rec.atk : '') + '</span></div>' +
    '<i class="hc-rar r-' + rar + '">' + rar + '</i>';
  return el;
}

function refreshHandUI() {
  const box = $('hand-row');
  if (!box) return;
  box.innerHTML = '';
  G.hand.forEach((id, i) => {
    const rec = CARD_DB.cards[id];
    if (!rec) return;
    const el = cardThumb(rec, 'hcard');
    const isMon = ['normal', 'effect', 'tuner', 'ritual', 'fusion', 'synchro', 'xyz', 'link'].includes(rec.kind);
    if (isMon) {
      /* v0.4.2：仪式怪兽不可祭品召唤，不加 need-tribute 标 */
      const need = (rec.kind === 'ritual' || isExtraKind(rec.kind)) ? 0 : tributeNeed(rec);
      if (need) el.classList.add('need-tribute');
      if (isExtraKind(rec.kind)) el.classList.add('extra-kind');
      /* 手牌怪兽效果徽标（库里波 = 守；时间魔术师 = G） */
      const fx = HAND_FX[+rec.id];
      if (fx) {
        el.classList.add('has-fx');
        const fb = document.createElement('div');
        const ready = !fx.active || handFxReadyIn(+rec.id) <= 0.05;
        fb.className = 'fx-badge' + (ready ? ' ready' : '');
        fb.textContent = fx.badge || '效';
        fb.title = fx.tip;
        if (fx.active) fb.addEventListener('click', ev => { ev.stopPropagation(); tryHandEffect(); });
        el.appendChild(fb);
      }
      /* 登场效果徽标：带「全场攻击」类效果的怪兽卡 */
      const sfx = summonFxOf(rec);
      if (sfx && sfx.full) {
        const sb = document.createElement('div');
        sb.className = 'sum-badge';
        sb.textContent = '全';
        sb.title = '登场效果 · ' + (sfx.text || '全场攻击');
        el.appendChild(sb);
      }
    } else {
      el.classList.add('spell-kind');
    }
    /* 弃牌徽标：任意手牌都可送入墓地并抽 1 张（疏通堵手） */
    if (!isExtraKind(rec.kind)) {
      const mb = document.createElement('div');
      mb.className = 'mill-badge' + (G.discardMode ? ' hot' : '');
      mb.textContent = '弃';
      mb.title = '送入墓地并抽 1 张（剩 ' + (G.millLeft || 0) + ' 次 · Shift+数字键）';
      mb.addEventListener('click', e => { e.stopPropagation(); millHand(i); });
      el.appendChild(mb);
    }
    if (isExodiaPart(rec.id)) el.classList.add('exodia-part');
    if (G.discardMode) el.classList.add('discardable');
    if (G.pick && ((G.pick.type === 'tribute' && G.pick.handIdx === i) ||
                   (G.pick.type === 'xyz' && G.pick.src === 'hand' && G.pick.handIdx === i))) {
      el.classList.add('picking');
    }
    el.title = rec.name + (isGodCard(rec) ? '　★' + (rec.level || 1) + ' · 需 3 只祭品' : '');
    el.addEventListener('click', () => {
      if (G.discardMode) { millHand(i); return; }
      playHandCard(i);
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(rec); });
    box.appendChild(el);
  });
  for (let i = G.hand.length; i < HAND_MAX; i++) {
    const ph = document.createElement('div');
    ph.className = 'hcard empty';
    box.appendChild(ph);
  }
  const dc = $('hand-count');
  if (dc) dc.textContent = G.hand.length + '/' + HAND_MAX;
  /* v0.4.0：手机端手牌卡背计数 */
  const hb = $('hand-back-n');
  if (hb) hb.textContent = G.hand.length;
  const hbw = $('hand-back');
  if (hbw) hbw.classList.toggle('has-cards', G.hand.length > 0);
  const ml = $('mill-left');
  if (ml) ml.textContent = G.millLeft || 0;
  const drl = $('draw-left');
  if (drl) drl.textContent = G.draws || 0;
  const dl = $('deck-left');
  if (dl) dl.textContent = deckLeft();
  const ed = $('extra-left');
  if (ed) ed.textContent = G.extra.length;
  refreshExodiaChip();
  refreshExtraUI();
  /* v0.4.2：艾克佐迪亚集齐即时特殊胜利（需求 4）。
   * 原实现只在 handAdd/drawCard/startRun 三处检查，searchM 检索、怪兽登场抽卡等
   * 直接 push 到手牌的路径会绕过 → 集齐不触发。这里作为万能收口：
   * 手牌 UI 每次刷新都检查（gameOver 已先将 screen 置 'result'，无递归风险）。 */
  if (G.screen === 'playing') checkExodiaWin();
}

/* 艾克佐迪亚进度条（持有任意部件时显示，五件齐 → 特殊胜利） */
function refreshExodiaChip() {
  const el = $('exodia-chip');
  if (!el) return;
  const has = new Set(G.hand || []);
  const got = EXODIA_PARTS.filter(p => has.has(p.id));
  if (!got.length) { el.classList.remove('on', 'done'); el.innerHTML = ''; return; }
  el.classList.add('on');
  el.classList.toggle('done', got.length === EXODIA_PARTS.length);
  el.innerHTML = '<span class="exo-t">艾克佐迪亚</span>' +
    '<span class="exo-pips">' + EXODIA_PARTS.map(p => '<i class="' + (has.has(p.id) ? 'on' : '') + '"></i>').join('') + '</span>' +
    '<b>' + got.length + '/' + EXODIA_PARTS.length + '</b>';
  el.title = '五部件同时在手牌即特殊胜利\n已集齐：' + got.map(p => p.name).join(' · ') +
    '\n未集齐：' + (EXODIA_PARTS.filter(p => !has.has(p.id)).map(p => p.name).join(' · ') || '无');
}


function refreshMagUI() {
  const box = $('mag-row');
  if (!box) return;
  box.innerHTML = '';
  const order = ['X', 'Y', 'Z'];
  order.forEach(k => {
    const id = MAG_IDS[k];
    const rec = CARD_DB.cards[id];
    const on = !!(G.mag && G.mag[k]);
    const el = document.createElement('div');
    el.className = 'mag-cell' + (on ? ' on' : '');
    el.innerHTML = '<img src="' + (window.__cardImg ? __cardImg(id) : 'data/cardimg/' + id + '.jpg') + '" alt="">' +
      '<span>' + k + '</span>';
    if (rec) el.title = rec.name + (on ? ' · 已获得' : ' · 未获得');
    box.appendChild(el);
  });
  const cnt = $('mag-count');
  if (cnt) cnt.textContent = order.filter(k => G.mag && G.mag[k]).length + '/3';
}

function refreshExtraUI() {
  const box = $('extra-row');
  if (box) {
    box.style.display = '';
    box.innerHTML = '';
    /* 整合为一组牌堆：三层堆叠 + 数量角标，点击 / Q 键弹出额外卡组弹窗 */
    const stack = document.createElement('div');
    stack.className = 'ex-deck-stack' + (G.extra.length ? '' : ' empty');
    stack.innerHTML =
      '<div class="ex-layer l2"></div><div class="ex-layer l1"></div><div class="ex-layer l0"></div>' +
      '<span class="ex-num">' + G.extra.length + '</span>';
    stack.title = '额外卡组 · 按 Q 查看并选择召唤';
    stack.addEventListener('click', () => { if (G.screen === 'playing') toggleExtraPanel(); });
    box.appendChild(stack);
  }
  const ec = $('extra-count');
  if (ec) ec.textContent = G.extra.length;
}

/* ---- Q 额外卡组弹窗：查看卡牌，点击确认同调 / 超量 / 融合召唤 ---- */
function toggleExtraPanel() {
  if (G.screen === 'playing') {
    renderExtraGrid();
    G.screen = 'extra';
    $('s-extra').classList.remove('hidden');
    Cursor.sync();
    playSfx('draw');
  } else if (G.screen === 'extra') {
    closeExtraPanel();
  }
}
function closeExtraPanel() {
  $('s-extra').classList.add('hidden');
  if (G.screen === 'extra') { G.screen = 'playing'; lockNow(); }
}
function renderExtraGrid() {
  const box = $('extra-grid');
  if (!box) return;
  box.innerHTML = '';
  if (!G.extra.length) { box.innerHTML = '<span class="g-empty">额外卡组为空</span>'; return; }
  G.extra.forEach((id, i) => {
    const rec = CARD_DB.cards[id];
    if (!rec) return;
    const ok = extraCanSummon(id);
    const el = cardThumb(rec, 'ex-card ' + (ok ? 'ok' : 'no'));
    const kindName = { fusion: '融合', synchro: '同调', xyz: '超量', link: '连接' }[rec.kind] || '额外';
    el.title = rec.name + '　' + kindName + (ok ? ' · 点击召唤' : ' · 素材不足');
    if (ok) el.addEventListener('click', () => { closeExtraPanel(); summonFromExtra(i); });
    else el.addEventListener('click', () => { toast('素材不足 · ' + extraHint(rec)); playSfx('hurt'); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(rec); });
    box.appendChild(el);
  });
}

function playHandCard(idx) {
  if (G.screen !== 'playing') return;
  // 正在选择祭品/素材时点击其他手牌：先取消当前选择
  if (G.pick && G.pick.handIdx !== idx && G.pick.type === 'tribute') cancelPick(true);
  const rec = CARD_DB.cards[G.hand[idx]];
  if (!rec) return;
  /* v0.4.0：选中手牌后弹出选择弹窗（召唤 / 发动效果 / 弃牌 / 取消） */
  openPlayPick(idx);
}

/* ---- 弃牌抽牌：手牌任意一张送入墓地并抽 1 张 ----
 * 解决「低星怪兽堵手、抽不到新卡」：次数 = 开局 5 次 + 每升 1 级 +1 次。
 * 满手按 R 自动进入弃牌模式，点任意手牌即弃掉并抽牌；ESC 取消。 */
function beginDiscardDraw() {
  if (G.discardMode) return false;
  if (!G.hand.length) return false;
  if ((G.millLeft || 0) <= 0) {
    toast('手牌已满（' + HAND_MAX + ' 张）· 弃牌次数已用完 —— 升级可继续获得弃牌次数');
    playSfx('hurt');
    return false;
  }
  G.discardMode = true;
  const row = $('hand-row');
  if (row) row.classList.add('discard-mode');
  /* v0.4.2b：触屏端手牌行不可见（.hand-row display:none），弃牌唯一入口是手牌面板 →
   * 直接展开面板；提示文案也去掉 PC 专属的 ESC/Shift 说法 */
  const touch = !!(window.DeviceMode && DeviceMode.active);
  toast(touch
    ? '手牌已满 · 在手牌面板点击一张卡送入墓地并抽 1 张（剩 ' + G.millLeft + ' 次）'
    : '手牌已满 · 点击一张手牌送入墓地并抽 1 张（剩 ' + G.millLeft + ' 次 · ESC 取消）');
  playSfx('draw');
  refreshHandUI();
  if (touch && G.screen === 'playing') openHandPanel();
  return true;
}
function cancelDiscardDraw(silent) {
  if (!G.discardMode) return false;
  G.discardMode = false;
  const row = $('hand-row');
  if (row) row.classList.remove('discard-mode');
  refreshHandUI();
  if (!silent) toast('已取消弃牌');
  return true;
}
function millHand(idx) {
  /* v0.4.2b：允许 handm 面板内弃牌（触屏弃牌入口；旧版 screen!=='playing' 把面板点击也挡掉） */
  if ((G.screen !== 'playing' && G.screen !== 'handm') || G.pick) return false;
  if (idx < 0 || idx >= G.hand.length) return false;
  const id = G.hand[idx];
  const rec = CARD_DB.cards[id];
  if (!rec) return false;
  if ((G.millLeft || 0) <= 0) {
    toast('弃牌次数已用完 · 升级可获得新的弃牌次数');
    playSfx('hurt');
    return false;
  }
  G.millLeft--;
  G.millCount = (G.millCount || 0) + 1;
  G.hand.splice(idx, 1);
  G.grave.push(id);
  if (G.discardMode) cancelDiscardDraw(true);
  playSfx('draw');
  toast('「' + rec.name + '」送入墓地 → 抽 1 张（弃牌剩 ' + G.millLeft + ' 次）');
  drawCard(true, true);          // 效果抽卡：不消耗升级抽卡机会
  refreshHandUI();
  refreshGraveUI();
  return true;
}

/* ---- 墓地 / 额外卡组查询面板（Tab） ---- */
function refreshGraveUI() {
  const g = $('grave-cards'), x = $('grave-extra-cards');
  if (!g) return;
  g.innerHTML = '';
  G.grave.forEach(id => {
    const rec = CARD_DB.cards[id];
    if (!rec) return;
    const el = cardThumb(rec, 'gcard');
    el.title = rec.name;
    el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(rec); });
    g.appendChild(el);
  });
  if (!G.grave.length) g.innerHTML = '<span class="g-empty">墓地空空如也</span>';
  x.innerHTML = '';
  G.extra.forEach(id => {
    const rec = CARD_DB.cards[id];
    if (!rec) return;
    const el = cardThumb(rec, 'gcard');
    el.title = rec.name;
    el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(rec); });
    x.appendChild(el);
  });
  if (!G.extra.length) x.innerHTML = '<span class="g-empty">额外卡组已空</span>';
  const gc = $('grave-count'), xc = $('grave-extra-count');
  if (gc) gc.textContent = G.grave.length;
  if (xc) xc.textContent = G.extra.length;
}
function toggleGravePanel() {
  if (G.screen === 'playing') {
    refreshGraveUI();
    G.screen = 'grave';
    $('s-grave').classList.remove('hidden');
    Cursor.sync();
    playSfx('draw');
  } else if (G.screen === 'grave') {
    G.screen = 'playing';
    $('s-grave').classList.add('hidden');
    lockNow();
  }
}

function refreshFieldUI() {
  const box = $('field-row');
  if (!box) return;
  box.innerHTML = '';
  const pick = G.pick;
  for (let i = 0; i < MAX_FIELD; i++) {
    const m = G.field.find(x => x.slot === i);
    const el = document.createElement('div');
    let cls = 'fslot' + (m ? ' on' : '');
    if (m && pick) {
      const pi = pick.picked.indexOf(m);
      if (pi >= 0) cls += ' picked';
      else {
        if (pick.type === 'tribute') cls += ' pickable';
        if (pick.type === 'xyz' && (m.level || 0) === (pick.rec.level || 0)) cls += ' pickable';
      }
    }
    el.className = cls;
    if (m) {
      const pct = Math.max(0, Math.min(1, m.hp / m.maxHp));
      const isPicked = pick && pick.picked.indexOf(m) >= 0;
      el.innerHTML =
        '<img src="' + (window.__cardImg ? __cardImg(m.id) : 'data/cardimg/' + m.id + '.jpg') + '" alt="">' +
        '<div class="fs-hp"><i style="width:' + (pct * 100) + '%"></i></div>' +
        '<b>' + m.atk + '</b>' +
        (isPicked ? '<em class="fs-pick">' + (pick.type === 'tribute' ? '祭品' : '素材') + '</em>' : '');
      el.title = m.rec.name + '　ATK ' + m.atk + '　HP ' + Math.round(m.hp) +
        (pick ? '（点击选择/取消）' : '');
      if (pick) el.addEventListener('click', () => togglePickField(m));
    } else {
      el.innerHTML = '<span>空</span>';
    }
    box.appendChild(el);
  }
  const n = $('field-count');
  if (n) n.textContent = G.field.length + '/' + MAX_FIELD;
}

function showCardDetail(rec) {
  const el = $('card-detail');
  if (!el) return;
  el.innerHTML =
    '<img src="' + (window.__cardImg ? __cardImg(rec.id) : 'data/cardimg/' + rec.id + '.jpg') + '" alt="">' +
    '<div class="cd-box"><b>' + rec.name + '</b>' +
    '<p>' + (rec.type || '') + (rec.atk ? '　ATK ' + rec.atk + ' / DEF ' + rec.def : '') + '</p>' +
    '<p class="cd-desc">' + (rec.desc || '') + '</p>' +
    (summonFxText(rec) ? '<p class="cd-fx">登场效果 · ' + summonFxText(rec) + '</p>' : '') +
    '<p class="cd-note">' + (rec.note || (rec.kind === 'spell' || rec.kind === 'trap' ? '' : '召唤后可自动攻击最近敌人')) + '</p></div>';
  el.classList.add('on');
  clearTimeout(showCardDetail._t);
  showCardDetail._t = setTimeout(() => el.classList.remove('on'), 3600);
}

function checkLevel() {
  while (G.exp >= G.expNeed) {
    G.exp -= G.expNeed;
    G.lv++;
    G.expNeed = Math.floor(30 + G.lv * 16 + Math.pow(G.lv, 1.7));
    G.atkBuff += 0.03;
    G.draws = (G.draws || 0) + 1;                 // 每升 1 级获得 1 次抽卡机会
    G.millLeft = Math.min(30, (G.millLeft || 0) + 1);   // 每升 1 级 +1 次弃牌（疏通手牌）
    P.lp = Math.min(P.maxLP, P.lp + P.maxLP * 0.04);
    playSfx('reveal');
    popDamage(P.pos.x, 2.6, P.pos.z, '决斗等级 ' + G.lv, 'crit');
    popDamage(P.pos.x, 3.4, P.pos.z, '+1 抽卡机会（R）', 'lp');
    addRing(P.pos.x, P.pos.z, 0.5, 3.4, 0, 0xffd76b, 0.6);
  }
}

/* ---------------- 刷怪 ---------------- */
function enemyPoolByTime(t) {
  const p = [['kuriboh', 5]];
  if (t > 35) p.push(['mushroom', 4]);
  if (t > 90) p.push(['gaia', 2.6]);
  if (t > 150) p.push(['rock', 2.4]);
  if (t > 250) p.push(['mammoth', 1.8]);
  let total = 0; p.forEach(o => total += o[1]);
  let r = Math.random() * total;
  for (const o of p) { r -= o[1]; if (r <= 0) return o[0]; }
  return 'kuriboh';
}
function updateSpawn(dt) {
  if (G.time < 1.5) return;
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  /* 刷怪速度递增（v18 难度 ×2）：每 38 秒约翻倍，下限 0.13s；每 26 秒每批 +1 只
   * v0.4.0：触屏端降载 —— 同屏上限减半、间隔下限放宽、每批封顶 4 只（防 3 分钟后卡成 PPT） */
  const touch = !!(window.DeviceMode && DeviceMode.active);
  const floor = touch ? DIFF.spawnFloor * 1.9 : DIFF.spawnFloor;
  const maxE = touch ? Math.round(DIFF.maxEnemies * 0.5) : DIFF.maxEnemies;
  const batchCap = touch ? 4 : 99;
  G.spawnT = Math.max(floor, DIFF.spawnBase * Math.pow(0.5, G.time / DIFF.spawnHalfLife));
  const batch = Math.min(batchCap, DIFF.batchBase + Math.floor(G.time / DIFF.batchEvery));
  if (enemies.length > maxE) return;
  for (let i = 0; i < batch; i++) {
    const a = Math.random() * TAU, r = rnd(23, 28);
    let x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
    const rr = Math.hypot(x, z);
    if (rr > ARENA_R - 2) { const k = (ARENA_R - 2) / rr; x *= k; z *= k; }
    spawnEnemy(enemyPoolByTime(G.time), x, z);
  }
  if (G.mode === 'normal') {
    /* 按关卡 Boss 时间表降临 */
    const tbl = G.level.bosses || [];
    while (G.bossIdx < tbl.length && G.time >= tbl[G.bossIdx].t) {
      const spec = tbl[G.bossIdx];
      const e = spawnBossKey(spec.key, { hpMul: spec.hpMul || 1 });
      if (e && spec.dmgMul) e.dmg = Math.round(e.dmg * spec.dmgMul);
      if (spec.label) toast(spec.phases ? '「' + spec.label + '」降临 · 三阶段决战！' : '「' + spec.label + '」降临！');
      G.bossIdx++;
      /* v0.3.1：最终 Boss 三阶段 —— 每阶段 LP 80k，第 1 阶段召唤巨神兵 */
      if (e && spec.phases) {
        e.finalBoss = true; e.phase = 1; G.finalBoss = e;
        e.hp = e.maxHp = PHASE_LP;
        $('boss-fill').style.width = '100%';
        refreshBossHud(e);
        ensurePhaseGods(1, e.pos.x, e.pos.z);
      }
      /* 特殊失败倒计时：最终 Boss 限时未击杀 → 关卡专属毁灭演出 */
      if (spec.failAfter) {
        G.failSpec = { key: spec.key, t: G.time + spec.failAfter * DIFF.failTimeMul, title: spec.failTitle, sub: spec.failSub };
      }
      /* 神殿关保留：三幻神同席 → 光之创造神降临 */
      if (G.level.id === 'temple') {
        const godsAlive = enemies.filter(en => en.isGod && !en.dead).length;
        if (godsAlive >= 3) { holactieEnd(); return; }
      }
    }
  }
}

/* ---------------- 主更新 ---------------- */
/* 跳跃：Space 触发，滞空期间躲开地面接触伤害 */
function tryJump() {
  if (G.screen !== 'playing' || P.air) return;
  P.vy = 7.4; P.air = true;
  burst(P.pos.x, 0.15, P.pos.z, 6, 0xc9b08a, 4, 0.4);   // 起跳蹬尘
}

let dustT = 0;
function updatePlayer(dt) {
  /* 移动只由 WASD / 方向键驱动；鼠标仅转视角（不再有虚拟摇杆） */
  let fwd = 0, strafe = 0;
  if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
  if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) strafe += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) strafe -= 1;
  /* v0.3.0：手机端虚拟摇杆（模拟量 -1..1，叠加在键盘输入上，由 touch.js 写入） */
  const tv = window.__touchVec;
  if (tv) { fwd += tv.fwd; strafe += tv.strafe; }
  /* 镜头相对移动：W 永远朝屏幕里走（视角旋转后方向随之改变） */
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);   // 前
  const rx = -fz, rz = fx;                                 // 右
  let ix = fx * fwd + rx * strafe;
  let iz = fz * fwd + rz * strafe;
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  /* Shift 冲刺：按住加速 + 蓝色残影 */
  const dashing = (keys['ShiftLeft'] || keys['ShiftRight']) && len > 0.05;
  const spd = CHARS[G.charId].speed * P.spdMul * (dashing ? 1.62 : 1);
  P.pos.x += ix * spd * dt;
  P.pos.z += iz * spd * dt;
  const r = Math.hypot(P.pos.x, P.pos.z);
  if (r > ARENA_R - 1.2) { const k = (ARENA_R - 1.2) / r; P.pos.x *= k; P.pos.z *= k; }
  if (P.air) {
    P.vy -= 21 * dt;
    P.pos.y += P.vy * dt;
    const gy = groundY(P.pos.x, P.pos.z);
    if (P.pos.y <= gy) {
      P.pos.y = gy; P.air = false; P.vy = 0; P.jumpH = 0;
      burst(P.pos.x, 0.12, P.pos.z, 8, 0xc9b08a, 5, 0.45);   // 落地扬尘
    } else P.jumpH = P.pos.y - gy;
  } else {
    P.pos.y = groundY(P.pos.x, P.pos.z);
    P.jumpH = 0;
  }

  if (len > 0.05) { P.face = angLerp(P.face, Math.atan2(ix, iz), Math.min(1, dt * 14)); P.bob += dt * (P.air ? 4 : 13); }
  else P.bob += dt * 3;
  P.model.position.set(P.pos.x, P.pos.y + (P.air ? 0.12 : Math.abs(Math.sin(P.bob)) * 0.06), P.pos.z);
  P.model.rotation.y = P.face;
  playerLight.position.set(P.pos.x, P.pos.y + 2.2, P.pos.z);
  if (dashing) {
    P.dashT -= dt;
    if (P.dashT <= 0) {
      P.dashT = 0.06;
      burst(P.pos.x, 0.55, P.pos.z, 3, 0x7ec8ff, 3.2, 0.32);
    }
  }

  const md = P.model.userData;
  if (md.orb) { md.orb.rotation.y += dt * 2.5; md.orb.position.y = 2.4 + Math.sin(G.time * 3) * 0.05; }
  if (md.ringA) { md.ringA.rotation.z += dt * 1.8; md.ringB.rotation.x += dt * 1.4; }
  if (md.wings) md.wings.forEach((w, i) => {
    const s = i === 0 ? -1 : 1;
    w.rotation.z = w.userData.base + s * Math.sin(G.time * 3.4) * 0.22;
  });
  if (md.kind === 'duelist' && window.MODELS) {
    MODELS.animate(P.model, G.time, dt);
    if (md.arms) {
      const sw = Math.sin(P.bob) * 0.22;
      md.arms[0].rotation.x = sw;
      md.arms[1].rotation.x = -sw;
    }
  }

  if (P.iframe > 0) {
    P.iframe -= dt;
    P.model.visible = Math.floor(G.time * 22) % 2 === 0;
  } else P.model.visible = true;

  // 场上怪兽（自动攻击 / 接触伤害）
  updateField(dt);
  if (G.normalCd > 0) G.normalCd = Math.max(0, G.normalCd - dt);
}
function updateCamera(dt) {
  if (G.camFreeze) return;               // 测试钩子：冻结跟随，便于任意视角截图
  const tx = P.pos.x, tz = P.pos.z;
  const gy = groundY(tx, tz);
  /* 鼠标右键拖拽旋转视角：camYaw 环绕玩家（v0.4.1：复用向量，避免每帧 new） */
  const ox = Math.sin(camYaw) * 14.5, oz = Math.cos(camYaw) * 14.5;
  _camTarget.set(tx + ox, gy + 18.5, tz + oz);
  camera.position.lerp(_camTarget, Math.min(1, dt * 4.5));
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 2.2);
    const s = G.shake * 0.55;
    camera.position.x += rnd(-s, s);
    camera.position.y += rnd(-s, s);
  }
  camera.lookAt(tx, gy + 1.1, tz - 1.2);
  moon.position.set(tx - 14, gy + 26, tz + 10);
  moon.target.position.set(tx, gy, tz);
}
let hudAcc = 0;
const _camTarget = new V3();          // v0.4.1：相机跟随目标复用向量
function updateHUD(dt) {
  hudAcc += dt;
  if (hudAcc < 0.06) return;
  hudAcc = 0;
  if (G._raDirty) { G._raDirty = false; refreshFieldUI(); }   // 翼神龙 ATK=LP 实时刷新
  const pct = clamp(P.lp / P.maxLP, 0, 1);
  const lpf = $('lp-fill');
  lpf.style.width = (pct * 100) + '%';
  lpf.classList.toggle('low', pct < 0.35);
  $('lp-num').textContent = Math.max(0, Math.round(P.lp));
  $('lp-max').textContent = Math.round(P.maxLP);
  $('timer').textContent = fmtTime(G.time);
  $('kill-count').textContent = G.kills;
  $('lv-count').textContent = G.lv;
  $('exp-fill').style.width = (G.exp / G.expNeed * 100) + '%';
  $('exp-text').textContent = 'Lv.' + G.lv + '  ' + Math.floor(G.exp) + ' / ' + G.expNeed;
  const ub = $('ult-btn');
  ub.classList.toggle('ready', G.ult >= 100);
  $('ult-ring').style.strokeDashoffset = (289 * (1 - G.ult / 100)).toFixed(0);
}
function updateGame(dt) {
  /* 打击感·顿帧：精英/Boss 击杀、受击瞬间画面短暂迟滞 */
  if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.12; }
  G.time += dt;
  updatePlayer(dt);
  updateSpawn(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateSlashes(dt);
  updateEnemyBullets(dt);
  updateBlades(dt);
  updateComet(dt);
  updateMines(dt);
  updateRings(dt);
  updateOrbs(dt);
  updateDamageNumbers(dt);
  updateHeals(dt);
  updatePickups(dt);
  updateSpellFx(dt);
  updateTrapFx(dt);
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { timers[i].fn(); timers.splice(i, 1); }
  }
  for (const e of enemies) if (e.orbitCd > 0) e.orbitCd -= dt;
  updateHandFxChip();
  pxSmall.update(dt); pxBig.update(dt);
  const ft = performance.now() * 0.006;
  flames.forEach(f => {
    const k = 0.7 + Math.sin(ft + f.userData.ph * 3) * 0.2 + Math.random() * 0.1;
    f.scale.set(k, 0.8 + Math.sin(ft * 1.7 + f.userData.ph) * 0.3, k);
  });
  torchLights.forEach((l, i) => { l.intensity = 1.3 + Math.sin(ft * 1.3 + i * 2) * 0.3; });
  dustT -= dt;
  if (dustT <= 0) {
    dustT = 0.08;
    pxSmall.spawn(
      P.pos.x + rnd(-16, 16), rnd(0.2, 5), P.pos.z + rnd(-16, 16),
      rnd(-0.25, 0.25), rnd(0.1, 0.5), rnd(-0.25, 0.25),
      rnd(2, 4.5), 0xc9a06a, -0.02);
  }
  if (G.flashT > 0) {
    G.flashT -= dt;
    $('flash').style.opacity = Math.max(0, G.flashT * 0.9);
  }
  updateCamera(dt);
  updateHUD(dt);
  /* 特殊失败：关卡最终 Boss 限时未击杀 */
  if (G.failSpec && G.screen === 'playing' && !G.failSpec.done) {
    const boss = enemies.find(en => en.key === G.failSpec.key && !en.dead);
    if (!boss) {
      G.failSpec = null;                       // Boss 已被击杀，解除倒计时
    } else if (G.time >= G.failSpec.t) {
      G.failSpec.done = true;
      G.flashT = 1.2; G.shake = 1.2;
      addRing(P.pos.x, P.pos.z, 1, 40, 0, 0xffffff, 1);
      burst(P.pos.x, 1.5, P.pos.z, 60, 0xffffff, 14, 1.4, true);
      G.failTitle = G.failSpec.title;
      G.failSub = G.failSpec.sub;
      timers.push({ t: 0.8, fn: () => gameOver(false, { failTitle: G.failTitle, failSub: G.failSub }) });
      G.failSpec = null;
    }
  }
  if (G.mode === 'normal' && G.level.id === 'temple' && G.time >= PHARAOH_TIME && !G.pharaoh && !G.pharaohSpawned) {
    G.pharaohSpawned = true;
    G.godsCalled = {};
    const ph = spawnBossKey('pharaoh', { dist: 15, phaseHp: PHASE_LP, finalBoss: true });
    if (ph) {
      $('boss-fill').style.width = '100%';
      refreshBossHud(ph);
      ensurePhaseGods(1, ph.pos.x, ph.pos.z);   // 第 1 阶段：巨神兵
    }
    toast('无名的法老王手持千年锡杖降临 · 三阶段决战！');
    G.shake = 0.8; G.flashT = 0.5;
    $('timer-sub').textContent = '三阶段决战 · 击败无名的法老王';
  }
}

/* ---------------- 输入 ---------------- */
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  /* v0.4.2：代价确认 / 代价弃牌弹窗打开期间，屏蔽全部战斗快捷键（防手牌索引失效），ESC 关闭 */
  if (G.costPick) {
    if (e.code === 'Escape') { e.preventDefault(); closeCostPick(); }
    return;
  }
  if (G.costPending) {
    if (e.code === 'Escape') { e.preventDefault(); closeCostConfirm(); }
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    if (G.screen === 'playing' || G.screen === 'grave') toggleGravePanel();
    return;
  }
  if (e.code === 'KeyR' && G.screen === 'playing') { e.preventDefault(); drawCard(); }
  if (e.code === 'KeyG' && G.screen === 'playing') { e.preventDefault(); tryHandEffect(); }
  if (e.code === 'KeyE' && G.screen === 'playing') { e.preventDefault(); trySummonExtra(); }
  if (e.code === 'KeyQ' && (G.screen === 'playing' || G.screen === 'extra')) { e.preventDefault(); toggleExtraPanel(); }
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();   // Alt = 鼠标转向加速，屏蔽浏览器菜单
  if (/^Digit[1-7]$/.test(e.code) && G.screen === 'playing') {
    const i = parseInt(e.code.slice(5), 10) - 1;
    if (i < G.hand.length) {
      e.preventDefault();
      if (G.discardMode) millHand(i);
      else if (e.shiftKey) millHand(i);
      else playHandCard(i);
    }
  }
  if (e.code === 'Space') { e.preventDefault(); tryJump(); }
  if (e.code === 'KeyF') { e.preventDefault(); castUlt(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (G.discardMode) { cancelDiscardDraw(); return; }
    if (G.screen === 'playing' && G.playPickIdx != null) { closePlayPick(); return; }
    if (G.screen === 'playing' && !$('s-handm').classList.contains('hidden')) { closeHandPanel(); return; }
    if (G.screen === 'revpick') { closeRevivePick(); return; }
    if (G.screen === 'playing' && G.pick) { cancelPick(); return; }
    if (G.screen === 'summon') { cancelPick(); return; }
    if (G.screen === 'extra') { closeExtraPanel(); return; }
    if (G.screen === 'grave') { toggleGravePanel(); return; }
    if (G.screen === 'playing') pauseGame();
    else if (G.screen === 'pause') resumeGame();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* ---------------- 视角：鼠标移动直接转动镜头（不移动角色） ----------------
 * 左键长按不再移动 / 不再出现虚拟摇杆；角色位移只由 WASD 控制。
 * 鼠标在画布上移动即环绕决斗者旋转视角（HUD 上的手牌、按钮不会触发）。 */
let camYaw = 0;
const CAM_SENS = 0.0032;            // 每像素转角（rad）
function rotateCam(dx, accel) {
  camYaw -= dx * CAM_SENS * (accel ? 2.2 : 1);
}
function setCamYaw(v) { camYaw = v; }
canvas.addEventListener('pointermove', e => {
  if (G.screen !== 'playing' && G.screen !== 'summon') return;
  if (e.pointerType && e.pointerType !== 'mouse') return;   // 触屏滑动不转视角
  if (G.pick) return;                                        // 选祭品/素材时不转，避免误触
  const dx = e.movementX || 0;
  if (!dx || Math.abs(dx) > 300) return;                     // 过滤指针锁定切换等异常跳变
  rotateCam(dx, keys['AltLeft'] || keys['AltRight']);        // 按住 Alt 加速转向
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
/* 左键不再产生移动/摇杆；指针锁定时左键仅用于「重新锁定指针」 */

/* ---------------- 指针锁定（游戏中隐藏指针并固定在屏幕中心） ----------------
 * 战斗中请求 Pointer Lock：光标被浏览器隐藏并锁定在画面中心，鼠标位移全部用于转视角；
 * 打开任何弹窗（暂停 / 召唤 / 额外卡组 / 墓地 / 结算）时自动释放，指针重新出现可点击；
 * 关闭弹窗回到战斗再加锁（若浏览器因缺少用户手势拒绝，下一次点击画面会补一次请求）。
 * 用户按 ESC 主动解锁 → 视为想操作指针 → 自动暂停游戏。 */
/* v0.4.2：弹窗/面板期间禁用触屏摇杆与右侧按键（body.ui-block）。
 * 根因：#touch-ui z-70 压在 .screen z-20 之上，#joy-zone（左下 42vw×56vh）
 * 会吞没手牌面板内的卡牌点击（满 7 张时网格铺满面板，首张卡正落在摇杆区）。
 * 只有「纯战斗中」才恢复指针交互。
 * v0.4.2b：**不含 discardMode** —— 弃牌模式不弹全屏面板，摇杆/大招必须保持可用
 * （v0.4.2 初版把 discardMode 也算进 block，导致满手抽卡后摇杆和大招全部失灵）。 */
function syncUiBlock() {
  if (!document.body) return;
  const block = !(G.screen === 'playing' && G.playPickIdx == null && !G.costPending && !G.costPick) || !!G.pick;
  document.body.classList.toggle('ui-block', block);
}

/* ================= v0.4.2：仪式召唤规则 =================
 * 规则（用户需求 3）：
 *   ① 仪式怪兽（type 含 Ritual 的怪兽）只能通过仪式魔法召唤，不能祭品召唤；
 *   ② 所有仪式魔法的效果更改为「从卡组中特殊召唤该仪式怪兽」。 */
function normalizeCardDB() {
  const cards = (window.CARD_DB && CARD_DB.cards) || {};
  /* ① type 含 Ritual 的怪兽 → kind='ritual' */
  for (const id in cards) {
    const r = cards[id];
    if (!r || r.kind === 'spell' || r.kind === 'trap') continue;
    if (isExtraKind(r.kind)) continue;
    if (/ritual/i.test(String(r.type || ''))) r.kind = 'ritual';
  }
  /* ② 仪式魔法：desc 提及 Ritual Summon → 解析引用对象 → effect.ritual */
  for (const id in cards) {
    const r = cards[id];
    if (!r || r.kind !== 'spell') continue;
    const targets = ritualTargetsFor(r);
    if (targets && targets.length) {
      r.effect = r.effect || {};
      r.effect.ritual = { ids: targets, label: ritualTargetLabel(targets, r._ritualHint) };
      r._isRitualSpell = true;
    }
  }
}
/* 解析仪式魔法 desc 中引用的仪式怪兽（"具体卡名" / "系列名 Ritual Monster" / "any X Ritual Monster" / "any 1 Ritual Monster"） */
function ritualTargetsFor(rec) {
  if (!rec) return null;
  if (rec._ritual !== undefined) return rec._ritual;
  const d = String(rec.desc || '');
  if (!/ritual summon/i.test(d)) { rec._ritual = null; rec._ritualHint = ''; return null; }
  const out = [];
  let hint = '';
  const quoted = d.match(/"([^"]+)"/g);
  if (quoted) {
    quoted.forEach(q => {
      const nm = q.slice(1, -1).trim();
      if (!nm || nm.length < 3) return;
      for (const id in CARD_DB.cards) {
        const r = CARD_DB.cards[id];
        if (!r || r.kind !== 'ritual') continue;
        const en = String(r.en || ''), cn = String(r.name || '');
        if (en === nm || cn === nm || (nm.length >= 4 && (en.indexOf(nm) >= 0 || cn.indexOf(nm) >= 0))) out.push(+id);
      }
    });
  }
  /* 无具体引用名时按种族/属性/泛型匹配：any Dragon Ritual Monster / any 1 Ritual Monster */
  if (!out.length) {
    if (/Ritual Summon any 1 Ritual Monster/i.test(d)) {
      for (const id in CARD_DB.cards) {
        const r = CARD_DB.cards[id];
        if (r && r.kind === 'ritual') out.push(+id);
      }
    } else {
      const g = d.match(/Ritual Summon any (\w+) Ritual Monster/i);
      if (g) {
        hint = g[1];
        const kw = g[1].toLowerCase(), up = g[1].toUpperCase();
        for (const id in CARD_DB.cards) {
          const r = CARD_DB.cards[id];
          if (!r || r.kind !== 'ritual') continue;
          if (String(r.race || '').toLowerCase() === kw || String(r.attr || '').toUpperCase() === up) out.push(+id);
        }
      }
    }
  }
  rec._ritual = out.length ? [...new Set(out)] : null;
  rec._ritualHint = hint;
  return rec._ritual;
}
function ritualTargetLabel(ids, hint) {
  if (!ids || !ids.length) return '';
  if (hint) return hint + ' 系仪式怪兽（卡组内 ' + ids.length + ' 只候选）';
  const nm = [];
  ids.slice(0, 2).forEach(id => { const r = CARD_DB.cards[id]; if (r) nm.push(r.name); });
  return nm.join(' / ') + (ids.length > 2 ? ' 等 ' + ids.length + ' 只' : '');
}
/* 发动仪式魔法：从卡组特殊召唤对应仪式怪兽 */
function ritualSummonFromDeck(eff) {
  const ids = (eff && eff.ritual && eff.ritual.ids) || [];
  if (!ids.length) { toast('卡组中没有对应的仪式怪兽'); return false; }
  let di = -1;
  for (let i = G.deckPos; i < G.deck.length; i++) { if (ids.indexOf(G.deck[i]) >= 0) { di = i; break; } }
  if (di < 0) { toast('卡组中没有对应的仪式怪兽'); return false; }
  const rid = G.deck[di];
  const rec = CARD_DB.cards[rid];
  if (!rec) { toast('卡组中没有对应的仪式怪兽'); return false; }
  if (G.field.length >= MAX_FIELD) { toast('场上已满，无法仪式召唤'); playSfx('hurt'); return false; }
  G.deck.splice(di, 1);                 // 从卡组中取出（deckPos 仍指向原下一张）
  const m = fieldSummon(rec, undefined, { type: '仪式召唤' });
  if (!m) { G.deck.splice(di, 0, rid); return false; }
  G.spSummon = (G.spSummon || 0) + 1;
  toast('仪式召唤：' + rec.name);
  afterSummon('仪式召唤', rec);
  return true;
}

/* ================= v0.4.2：效果代价解析（用户需求 5） =================
 * 从卡面 desc 解析负面代价：支付 LP / 支付一半 LP / 丢弃手牌 / 卡组送墓 / 解放怪兽。
 * 发动带代价的卡时先弹「代价确认」窗，确认并校验可支付后才生效。 */
function spellCostOf(rec) {
  if (!rec || (rec.kind !== 'spell' && rec.kind !== 'trap')) return null;
  if (rec._cost !== undefined) return rec._cost;
  /* v0.4.2：仪式魔法 = 纯「从卡组特殊召唤仪式怪兽」，不再解析原稿中的解放/LP 代价 */
  if (rec._isRitualSpell) { rec._cost = {}; return rec._cost; }
  const d = String(rec.desc || '');
  const c = {};
  let m;
  if ((m = d.match(/pay (\d[\d,]*) Life Points/i)) || (m = d.match(/支付\s*(\d[\d,]*)\s*基本分/))) c.lp = +m[1].replace(/,/g, '');
  else if (/pay half (?:of )?your Life Points/i.test(d) || /支付一半基本分/.test(d)) c.half = true;
  if ((m = d.match(/discard (\d+) cards?/i)) || (m = d.match(/丢弃\s*(?:自己)?\s*(\d+)\s*张手卡/)) || (m = d.match(/(\d+)\s*张手卡\s*丢弃/))) c.discard = +m[1];
  if ((m = d.match(/send(?:ing)? (\d+) "([^"]+)"[^.]{0,40}from your Deck/i))) c.mill = { n: +m[1], label: m[2] };
  else if ((m = d.match(/send(?:ing)? (\d+) ([A-Za-z]+)-Type (?:monster|monsters) from your Deck/i))) c.mill = { n: +m[1], race: m[2] };
  else if ((m = d.match(/send(?:ing)? (\d+) (?:Level \d+ or lower )?([A-Za-z]+) (?:Monster|Spell|Trap|card)s? from your Deck/i))) c.mill = { n: +m[1], label: m[2] };
  else if ((m = d.match(/send(?:ing)? (\d+) cards? from your Deck/i))) c.mill = { n: +m[1], label: '' };
  if ((m = d.match(/Tribute (\d+) monsters?/i)) || (m = d.match(/解放\s*(\d+)\s*只怪兽/))) c.tribute = +m[1];
  rec._cost = c;
  return c;
}
function costHasAny(c) { return !!c && (c.lp || c.half || c.discard || c.mill || c.tribute); }
function costLpAmount(c) { return c.half ? Math.floor(P.lp / 2) : (c.lp || 0); }
/* 卡组送墓条件匹配 */
function millMatch(rec, spec) {
  if (!rec) return false;
  if (!spec) return true;
  if (spec.race) return String(rec.race || '') === spec.race;
  if (spec.label && spec.label !== 'card') {
    const k = spec.label.toLowerCase();
    const kindMap = { normal: 'normal', effect: 'effect', ritual: 'ritual', tuner: 'tuner', fusion: 'fusion', synchro: 'synchro', xyz: 'xyz', link: 'link', spell: 'spell', trap: 'trap' };
    if (kindMap[k]) return rec.kind === kindMap[k];
    return String(rec.name || '').indexOf(spec.label) >= 0 || String(rec.en || '').indexOf(spec.label) >= 0;
  }
  return true;
}
/* 代价可支付性校验 → 返回错误文案或 null */
function costCheck(rec) {
  const c = spellCostOf(rec);
  if (!costHasAny(c)) return null;
  if ((c.lp || c.half) && P.lp - costLpAmount(c) < 1) return '基本分不足（需支付 ' + costLpAmount(c) + ' LP）';
  if (c.discard && G.hand.length < c.discard + 1) return '手牌不足（需另弃 ' + c.discard + ' 张）';
  if (c.mill) {
    let n = 0;
    for (let i = G.deckPos; i < G.deck.length; i++) {
      if (millMatch(CARD_DB.cards[G.deck[i]], c.mill)) n++;
      if (n >= c.mill.n) break;
    }
    if (n < c.mill.n) return '卡组中没有足够的送墓目标';
  }
  if (c.tribute && G.field.length < c.tribute) return '场上怪兽不足（需解放 ' + c.tribute + ' 只）';
  return null;
}
/* 代价清单文案（弹窗 / 效果文本共用） */
function spellCostLines(rec) {
  const c = spellCostOf(rec);
  if (!costHasAny(c)) return [];
  const out = [];
  if (c.lp || c.half) out.push('支付 ' + costLpAmount(c) + ' 基本分');
  if (c.discard) out.push('丢弃 ' + c.discard + ' 张手牌');
  if (c.mill) {
    const lbl = c.mill.label && c.mill.label !== 'card' ? (c.mill.label + ' ') : '';
    const race = c.mill.race ? (c.mill.race + '族 ') : '';
    out.push('从卡组将 ' + c.mill.n + ' 张' + race + lbl + '卡送入墓地');
  }
  if (c.tribute) out.push('解放场上 ' + c.tribute + ' 只怪兽');
  return out;
}

/* ---- 代价确认弹窗（#s-cost） ---- */
function openCostConfirm(id) {
  const rec = CARD_DB.cards[id];
  if (!rec) return false;
  const bad = costCheck(rec);
  if (bad) { toast(bad); playSfx('hurt'); return false; }
  G.costPending = { id: id };
  const box = $('cost-card');
  if (box) { box.innerHTML = ''; box.appendChild(cardThumb(rec, 'pp-thumb')); }
  const nm = $('cost-name');
  if (nm) nm.textContent = rec.name;
  const note = $('cost-fx-note');
  if (note) note.textContent = spellFxSummary(rec) || '';
  const list = $('cost-list');
  if (list) {
    list.innerHTML = '';
    spellCostLines(rec).forEach(t => {
      const ci = document.createElement('div');
      ci.className = 'ci';
      ci.innerHTML = '<b>代价</b>' + t;
      list.appendChild(ci);
    });
  }
  $('s-cost').classList.remove('hidden');
  Cursor.sync();
  playSfx('draw');
  return true;
}
function closeCostConfirm() {
  const el = $('s-cost');
  if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
  G.costPending = null;
  Cursor.sync();
}
/* 确认发动：先支付代价，再结算效果 */
function confirmCost() {
  const p = G.costPending;
  if (!p) return false;
  /* v0.4.2：怪兽效果风险确认 → 直接走原发动流程 */
  if (p.risk) {
    closeCostConfirm();
    if (G.hand.indexOf(p.id) < 0) { toast('该卡已不在手牌'); return false; }
    return tryHandEffect(p.id, true);
  }
  const rec = CARD_DB.cards[p.id];
  if (!rec) { closeCostConfirm(); return false; }
  const idx = G.hand.indexOf(p.id);
  if (idx < 0) { closeCostConfirm(); return false; }
  if (costCheck(rec)) { toast('无法支付代价'); playSfx('hurt'); return false; }
  const c = spellCostOf(rec);
  /* ① 支付 LP */
  if (c.lp || c.half) {
    P.lp = Math.max(1, P.lp - costLpAmount(c));
    popDamage(P.pos.x, 2.2, P.pos.z, '-' + costLpAmount(c) + ' LP', 'lp');
  }
  /* ② 解放场上怪兽（取攻击力最低的 N 只） */
  if (c.tribute) {
    const alive = G.field.slice().sort((a, b) => (a.atk || 0) - (b.atk || 0));
    alive.slice(0, c.tribute).forEach(m => {
      toast('解放：' + (m.rec ? m.rec.name : '怪兽'));
      destroyMonster(m, true);
    });
  }
  /* ③ 卡组送墓 */
  if (c.mill) {
    let sent = 0;
    for (let i = G.deckPos; i < G.deck.length && sent < c.mill.n; i++) {
      if (millMatch(CARD_DB.cards[G.deck[i]], c.mill)) {
        const gid = G.deck.splice(i, 1)[0];
        G.grave.push(gid); i--; sent++;
      }
    }
    if (sent) { toast('从卡组将 ' + sent + ' 张卡送入墓地'); refreshGraveUI(); }
  }
  closeCostConfirm();
  /* ④ 结算效果（discard 代价在效果后通过弃牌选择器支付） */
  resolveSpell(idx);
  const c2 = spellCostOf(rec);
  if (c2 && c2.discard) beginCostDiscard(rec, c2.discard);
  return true;
}

/* ---- 代价弃牌选择器（#s-costpick，多张丢弃时自选） ---- */
function beginCostDiscard(rec, n) {
  if (!n || G.hand.length < 1) return;
  const take = Math.min(n, G.hand.length);
  G.costPick = { n: take, left: take, rec: rec };
  renderCostPickGrid();
  $('s-costpick').classList.remove('hidden');
  Cursor.sync();
}
function renderCostPickGrid() {
  const box = $('costp-grid');
  if (!box) return;
  box.innerHTML = '';
  if (!G.hand.length) { box.innerHTML = '<span class="g-empty">手牌空空如也</span>'; return; }
  G.hand.forEach((id, i) => {
    const rec = CARD_DB.cards[id];
    if (!rec) return;
    const el = cardThumb(rec, 'ex-card ok');
    el.title = rec.name + ' · 点击作为代价丢弃';
    el.addEventListener('click', () => costPickAt(i));
    box.appendChild(el);
  });
  const nd = $('costp-need');
  if (nd && G.costPick) nd.textContent = G.costPick.left;
}
function costPickAt(i) {
  if (!G.costPick || i < 0 || i >= G.hand.length) return;
  const id = G.hand[i];
  G.hand.splice(i, 1);
  G.grave.push(id);
  G.costPick.left--;
  playSfx('draw');
  toast('丢弃「' + (CARD_DB.cards[id] ? CARD_DB.cards[id].name : '卡') + '」作为代价');
  if (G.costPick.left <= 0 || !G.hand.length) { closeCostPick(); refreshHandUI(); refreshGraveUI(); return; }
  renderCostPickGrid();
  refreshHandUI();
}
function closeCostPick() {
  const el = $('s-costpick');
  if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
  G.costPick = null;
  Cursor.sync();
}

/* ---- 本作效果摘要（弹窗效果文本用） ---- */
function spellFxSummary(rec) {
  if (!rec) return '';
  const eff = rec.effect || {};
  const out = [];
  if (eff.ritual) out.push('从卡组特殊召唤仪式怪兽「' + eff.ritual.label + '」');
  if (eff.draw) out.push('抽 ' + eff.draw + ' 张');
  if (eff.aoe) out.push('对全场敌人造成 ' + eff.aoe + ' 伤害');
  if (eff.clear) out.push('清除全部敌方弹幕');
  if (eff.heal) out.push('回复 ' + Math.round(eff.heal * 100) + '% 基本分');
  if (eff.buffAtk) out.push('全部怪兽攻击力 +' + Math.round(eff.buffAtk * 100) + '%');
  if (eff.dr) out.push('受到伤害 -' + Math.round(eff.dr * 100) + '%');
  if (eff.thorns) out.push('反伤 +' + Math.round(eff.thorns * 100) + '%');
  if (eff.slow) out.push('减速周围敌人');
  if (eff.destroyFar) out.push('消灭最远的 ' + eff.destroyFar + ' 只敌人');
  if (eff.searchM) out.push('从卡组检索 1 只怪兽加入手牌');
  if (eff.revive) out.push('从墓地特殊召唤 1 只怪兽');
  if (eff.burn) out.push('对最近敌人造成 ' + eff.burn + ' 伤害');
  if (rec.note) out.push(rec.note);
  return out.join('；');
}
normalizeCardDB();          // 启动即归一化（cards.js / cards_ext.js 均先于 game.js 加载）

const Cursor = {
  want: false,          // 当前界面是否应当锁定
  locked: false,        // 浏览器是否已锁定
  supported: false,
  _releasing: false,
  _denied: false,       // 浏览器拒绝过（无用户手势）→ 等下一次点击再试，避免每帧刷请求
  _lockForTest: false,  // 测试钩子：模拟浏览器锁定状态
  request(force) {
    if (!this.supported) return;
    if (this._denied && !force) return;
    if (document.pointerLockElement === canvas) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { });     // 无手势时会被拒绝，静默降级
    } catch (e) { /* 老浏览器 */ }
  },
  release() {
    this._releasing = true;
    /* 真实退出了浏览器锁 → 其延迟 change 事件不得触发「ESC 自动暂停」；
     * 未真实持锁（模拟/测试钩子）时不设静默，ESC 模拟路径不受影响 */
    if (document.pointerLockElement === canvas) this._quietUntil = performance.now() + 800;
    try {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      else { this.locked = false; document.body.classList.remove('cursor-locked'); }
    } catch (e) { }
    setTimeout(() => { this._releasing = false; }, 150);
  },
  sync() {
    /* v0.4.0：手牌选择弹窗打开时不锁定指针（需点击弹窗按钮） */
    /* v0.4.2：代价确认 / 代价弃牌弹窗同样不锁定 */
    const want = (G.screen === 'playing' && G.playPickIdx == null && !G.costPending && !G.costPick);
    syncUiBlock();                       // v0.4.2：无论 want 是否变化都刷新（弹窗期间禁摇杆，防吞点击）
    if (want === this.want) return;
    this.want = want;
    if (want) { this._denied = false; this.request(); }
    else this.release();
  },
  setLocked(v) {
    const was = this.locked;
    this.locked = !!v;
    document.body.classList.toggle('cursor-locked', this.locked);
    if (this.locked && !was) showCursorHint();
  }
};
try { Cursor.supported = !!(canvas.requestPointerLock && document.exitPointerLock); } catch (e) { Cursor.supported = false; }

/* 锁定成功后短暂提示「ESC 可释放指针」 */
let _hintT = 0;
function showCursorHint() {
  const el = $('cursor-hint');
  if (!el) return;
  el.classList.add('on');
  clearTimeout(_hintT);
  _hintT = setTimeout(() => el.classList.remove('on'), 2800);
}
/* 战斗但未锁定（浏览器要求用户手势 / 用户刚退出）→ 屏幕中央提示点击画面 */
function updateCursorUI() {
  const el = $('lock-prompt');
  if (!el) return;
  const show = Cursor.supported && Cursor.want && !Cursor.locked;
  el.classList.toggle('on', show);
}
/* 在点击手势内主动请求一次锁定（弹窗关闭 / 恢复战斗的瞬间最有效） */
function lockNow() {
  if (!Cursor.supported) return;
  Cursor._denied = false;
  Cursor.request(true);
}
document.addEventListener('pointerlockchange', () => {
  const locked = (document.pointerLockElement === canvas) || Cursor._lockForTest;
  Cursor.setLocked(locked);
  const quiet = performance.now() < (Cursor._quietUntil || 0);
  if (!locked && !Cursor._releasing && !quiet && Cursor.want && G.screen === 'playing') {
    /* 用户按 ESC 解锁 → 直接给到指针操作（暂停）；
     * 程序化 release 的延迟事件由 _quietUntil 屏蔽，避免误暂停 */
    pauseGame();
    toast('指针已释放 · 暂停中');
  }
});
document.addEventListener('pointerlockerror', () => {
  Cursor._denied = true;            // 等下一次点击画面再补请求
  Cursor.setLocked(false);
});
/* 点击画面补一次锁定请求（浏览器要求用户手势） */
canvas.addEventListener('pointerdown', () => {
  if (Cursor.want && !Cursor.locked) Cursor.request(true);
});

$('ult-btn').addEventListener('click', castUlt);
$('btn-pause').addEventListener('click', pauseGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-grave-close').addEventListener('click', () => { if (G.screen === 'grave') toggleGravePanel(); });
$('btn-summon-cancel').addEventListener('click', () => { if (G.pick) cancelPick(); });
$('btn-summon-confirm').addEventListener('click', () => { if (G.pick) confirmPick(); });
$('btn-summon-back').addEventListener('click', () => fusionBack());
$('btn-extra-close').addEventListener('click', closeExtraPanel);
/* ---- v0.4.0：手牌弹窗 / 墓地复活弹窗 / 手机端手牌面板 ---- */
(function bindPlayPick() {
  const doSummon = () => { const i = G.playPickIdx; closePlayPick(); if (i != null) { const ok = performSummon(i); if (!ok) playSfx('hurt'); } };
  const doAct = () => { const i = G.playPickIdx; closePlayPick(); if (i != null) { const ok = activateSpell(i); if (!ok) playSfx('hurt'); } };
  const doFx = () => { const i = G.playPickIdx; const id = i != null ? +G.hand[i] : 0; closePlayPick(); if (id) tryHandEffect(id); };
  const doMill = () => { const i = G.playPickIdx; closePlayPick(); if (i != null) millHand(i); };
  const b = id => $(id);
  if (b('pp-summon')) b('pp-summon').addEventListener('click', doSummon);
  if (b('pp-act')) b('pp-act').addEventListener('click', doAct);
  if (b('pp-fx')) b('pp-fx').addEventListener('click', doFx);
  if (b('pp-mill')) b('pp-mill').addEventListener('click', doMill);
  if (b('pp-cancel')) b('pp-cancel').addEventListener('click', closePlayPick);
  const pp = $('s-playpick');
  if (pp) pp.addEventListener('click', e => { if (e.target === pp) closePlayPick(); });
  if (b('revp-close')) b('revp-close').addEventListener('click', closeRevivePick);
  const rp = $('s-revpick');
  if (rp) rp.addEventListener('click', e => { if (e.target === rp) closeRevivePick(); });
  if (b('hand-back')) b('hand-back').addEventListener('click', openHandPanel);
  if (b('handm-close')) b('handm-close').addEventListener('click', closeHandPanel);
  const hm = $('s-handm');
  if (hm) hm.addEventListener('click', e => { if (e.target === hm) closeHandPanel(); });
})();
/* ---- v0.4.2：代价确认弹窗 / 代价弃牌选择器 ---- */
(function bindCostUI() {
  const b = id => $(id);
  if (b('cost-ok')) b('cost-ok').addEventListener('click', confirmCost);
  if (b('cost-cancel')) b('cost-cancel').addEventListener('click', closeCostConfirm);
  const cs = $('s-cost');
  if (cs) cs.addEventListener('click', e => { if (e.target === cs) closeCostConfirm(); });
  if (b('costp-close')) b('costp-close').addEventListener('click', closeCostPick);
  const cp = $('s-costpick');
  if (cp) cp.addEventListener('click', e => { if (e.target === cp) closeCostPick(); });
})();
$('btn-restart').addEventListener('click', () => { $('s-pause').classList.add('hidden'); startRun(); });
$('btn-quit').addEventListener('click', () => { $('s-pause').classList.add('hidden'); toTitle(); });
$('btn-start').addEventListener('click', () => {
  initAudio();
  /* v0.2.9 流程：开始决斗 → ①选择决斗者 → ②选择游玩地图 → 开战 */
  showSelect();
});
$('btn-deck').addEventListener('click', () => {
  $('s-deck').classList.remove('hidden');
  META.setEditWho('yugi'); META.renderDeck(); META.refreshWallet();
});
$('btn-deck-close').addEventListener('click', () => { $('s-deck').classList.add('hidden'); META.refreshWallet(); });
$('btn-shop').addEventListener('click', () => {
  $('s-shop').classList.remove('hidden');
  META.renderShop(); META.refreshWallet();
});
$('btn-shop-close').addEventListener('click', () => { $('s-shop').classList.add('hidden'); META.refreshWallet(); });
$('btn-ach').addEventListener('click', () => {
  $('s-ach').classList.remove('hidden');
  META.renderAch();
});
$('btn-ach-close').addEventListener('click', () => { $('s-ach').classList.add('hidden'); });
$('btn-howto').addEventListener('click', () => $('s-howto').classList.remove('hidden'));
$('btn-howto-close').addEventListener('click', () => $('s-howto').classList.add('hidden'));
$('btn-level-back').addEventListener('click', () => { showSelect(); });   // 地图 → 决斗者（第 1 步）
$('btn-back').addEventListener('click', () => { $('s-select').classList.add('hidden'); $('s-title').classList.remove('hidden'); G.screen = 'title'; });   // 决斗者 → 标题
$('btn-again').addEventListener('click', () => { hideHolactieBg(); startRun(); });
$('btn-change').addEventListener('click', () => { $('s-result').classList.add('hidden'); hideHolactieBg(); clearRun(); showSelect(); });

/* ---------------- 音效 ---------------- */
let actx = null;
function initAudio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
  }
  if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) { } }
  if (actx) startBgm();
}
function tone(freq, dur, type, vol, slide) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, actx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), actx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.06, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(); o.stop(actx.currentTime + dur + 0.02);
}
let sfxBudget = 0;
function playSfx(k) {
  if (!actx) return;
  if (sfxBudget > 7 && (k === 'shoot' || k === 'kill' || k === 'hit')) return;
  sfxBudget++;
  switch (k) {
    case 'shoot': tone(680, 0.07, 'triangle', 0.028, 1.6); break;
    case 'slash': tone(520, 0.06, 'sawtooth', 0.03, 2.6); break;
    case 'hit':                                                   // 弹体命中（打击感）
      tone(240, 0.05, 'square', 0.02, 0.7);
      tone(1300, 0.03, 'triangle', 0.015, 0.5);
      break;
    case 'crit':                                                  // 暴击：高频脆响 + 低频冲击
      tone(1450, 0.09, 'square', 0.045, 1.9);
      tone(130, 0.12, 'sine', 0.08, 0.55);
      break;
    case 'kill': tone(220, 0.09, 'square', 0.022, 0.6); break;
    case 'hurt': tone(150, 0.24, 'sawtooth', 0.07, 0.5); break;
    case 'draw': tone(300, 0.1, 'sine', 0.05, 1.5); break;
    case 'reveal':
      tone(520, 0.12, 'triangle', 0.05, 1.6);
      setTimeout(() => tone(880, 0.18, 'sine', 0.05, 1.2), 80);
      break;
    case 'nova': tone(420, 0.16, 'sine', 0.03, 0.7); break;
    case 'ult':
      tone(90, 0.7, 'sawtooth', 0.09, 2.4);
      setTimeout(() => tone(520, 0.5, 'triangle', 0.06, 0.4), 90);
      break;
    case 'boss':
      tone(70, 0.9, 'sawtooth', 0.1, 0.7);
      setTimeout(() => tone(120, 0.8, 'square', 0.05, 0.6), 120);
      break;
    case 'bossdown':
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.06), i * 110));
      break;
    case 'god':
      tone(60, 1.4, 'sine', 0.12, 0.5);
      setTimeout(() => tone(120, 1.2, 'sawtooth', 0.07, 0.5), 160);
      setTimeout(() => tone(960, 1.6, 'triangle', 0.05, 0.4), 320);
      break;
  }
}
setInterval(() => { sfxBudget = 0; }, 60);

/* ---------------- 背景音乐（多曲目 · 程序化改编） ----------------
 * 曲目取材自《遊☆戯☆王 デュエルモンスターズ》动画配乐（作曲：光宗信吉），
 * 本作用 WebAudio 实时合成重新编曲（非原曲音频、无外部文件），只保留主题气质与调性：
 *   遊戯 / 神の怒り / 闇のゲーム / 決闘者の魂 / 勝利 / 敗北 / 千年アイテム
 * 每首 = 4 小节（64 个十六分音符）循环：鼓组 + 低音 + 和声垫 + 主旋律动机。
 * 场景切换见 setBgmTrack()：标题→千年アイテム，开局/普通战斗→遊戯，
 * 三幻神降临→神の怒り，关卡 BOSS→闇のゲーム，对手决斗→決闘者の魂，结算→勝利/敗北。 */
let bgmGain = null, bgmTimer = null, bgmStep = 0, bgmNext = 0, bgmNoise = null;
let bgmTrackKey = 'menu';
let bgmVol = (window.META && META.save && META.save.bgmVol !== undefined) ? META.save.bgmVol : 0.35;
const mf = m => 440 * Math.pow(2, (m - 69) / 12);

/* 旋律串记法："step:midi:时长(十六分音符)"，空格分隔 */
function melParse(str) {
  const map = Object.create(null);
  str.trim().split(/\s+/).forEach(tok => {
    const p = tok.split(':').map(Number);
    if (p.length === 3 && !isNaN(p[0])) map[p[0]] = [p[1], p[2]];
  });
  return map;
}

const BGM_TRACKS = {
  /* 标题 / 关卡选择 / 商店：神秘、空灵，竖琴式分解和弦 */
  menu: {
    id: 'menu', name: '千年アイテム', ja: '千年アイテム', composer: '光宗信吉',
    scene: '标题 · 选关 · 商店', bpm: 84, lead: 'sine', leadVol: 0.075,
    roots: [50, 46, 43, 45],          // Dm | Bb | Gm | A
    drums: 'mystic', harm: false,
    mel: melParse('0:74:8 8:77:6 14:81:2 16:70:8 24:74:8 32:67:6 38:74:4 42:77:4 48:73:8 56:76:8')
  },
  /* 关卡开始与普通战斗：庄严的埃及风主题，和声小调 */
  yugi: {
    id: 'yugi', name: '遊戯', ja: '遊戯', composer: '光宗信吉',
    scene: '关卡开始 · 普通战斗', bpm: 96, lead: 'triangle', leadVol: 0.095,
    roots: [50, 46, 43, 45],          // Dm | Bb | Gm | A
    drums: 'march', harm: true,
    mel: melParse('0:74:6 6:69:2 8:77:4 12:76:4 16:70:4 20:74:4 24:77:6 30:76:2 ' +
      '32:74:2 34:73:2 36:74:2 38:76:2 40:77:4 44:81:4 48:79:4 52:77:2 54:76:2 56:73:4 60:74:4')
  },
  /* 三幻神 / 无名法老降临：铜管进行曲，压迫感 */
  godwrath: {
    id: 'godwrath', name: '神の怒り', ja: '神の怒り', composer: '光宗信吉',
    scene: '三幻神 · 无名法老 降临', bpm: 148, lead: 'sawtooth', leadVol: 0.105,
    roots: [48, 44, 41, 43],          // Cm | Ab | Fm | G
    drums: 'march', harm: true, timpani: true,
    mel: melParse('0:72:2 2:72:2 4:75:2 6:72:2 8:79:4 12:77:2 14:75:2 ' +
      '16:80:4 20:79:2 22:77:2 24:75:4 28:72:4 32:77:2 34:77:2 36:80:2 38:77:2 40:83:4 44:80:4 ' +
      '48:79:2 50:77:2 52:75:2 54:72:2 56:71:8')
  },
  /* 关卡 BOSS（决斗者王国 / 战斗都市）：半音暗黑主题 */
  darkgame: {
    id: 'darkgame', name: '闇のゲーム', ja: '闇のゲーム', composer: '光宗信吉',
    scene: '关卡 BOSS 战', bpm: 140, lead: 'square', leadVol: 0.08,
    roots: [52, 46, 52, 54],          // Em | Bb | Em | F#
    drums: 'drive', harm: false,
    mel: melParse('0:76:2 2:76:2 4:79:2 6:76:2 8:82:4 12:79:4 16:77:2 18:79:2 20:82:4 24:83:4 28:82:4 ' +
      '32:76:2 34:75:2 36:76:2 38:79:4 42:82:4 46:83:2 48:84:4 52:83:2 54:82:2 56:79:4 60:76:4')
  },
  /* 对手决斗者挑战：勇往直前的英雄主题 */
  battle: {
    id: 'battle', name: '決闘者の魂', ja: '決闘者の魂', composer: '光宗信吉',
    scene: '决斗者挑战 · 高强度战斗', bpm: 132, lead: 'sawtooth', leadVol: 0.09,
    roots: [45, 41, 48, 43],          // Am | F | C | G
    drums: 'drive', harm: true,
    mel: melParse('0:69:2 2:72:2 4:76:4 8:81:4 12:76:2 14:72:2 16:77:4 20:72:4 24:69:4 28:72:2 30:77:2 ' +
      '32:76:2 34:79:2 36:84:4 40:79:2 42:76:2 44:72:4 48:74:4 52:71:4 56:79:4 60:76:4')
  },
  /* 通关结算：大调号角 */
  victory: {
    id: 'victory', name: '勝利', ja: '勝利', composer: '光宗信吉',
    scene: '通关结算', bpm: 120, lead: 'square', leadVol: 0.1,
    roots: [48, 43, 45, 41],          // C | G | Am | F
    drums: 'march', harm: true, timpani: true,
    mel: melParse('0:72:2 2:76:2 4:79:2 6:84:6 12:79:2 14:84:2 16:83:4 20:79:4 24:76:4 28:74:2 30:71:2 ' +
      '32:72:2 34:76:2 36:81:4 40:79:2 42:76:2 44:72:4 48:77:4 52:81:4 56:84:8')
  },
  /* 败北结算：稀疏下行 */
  defeat: {
    id: 'defeat', name: '敗北', ja: '敗北', composer: '光宗信吉',
    scene: '败北结算', bpm: 66, lead: 'triangle', leadVol: 0.08,
    roots: [45, 41, 38, 40],          // Am | F | Dm | E
    drums: 'none', harm: false,
    mel: melParse('0:69:6 8:67:4 12:65:4 16:65:6 24:64:4 28:62:4 32:62:6 40:65:4 44:67:4 48:64:8 56:69:8')
  }
};

function bgmNote(f, t, dur, type, vol) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bgmGain);
  o.start(t); o.stop(t + dur + 0.05);
}
function bgmNoiseHit(t, vol, dur, hp) {
  if (!bgmNoise) {
    const len = actx.sampleRate;
    bgmNoise = actx.createBuffer(1, len, actx.sampleRate);
    const d = bgmNoise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
  s.buffer = bgmNoise;
  f.type = hp ? 'highpass' : 'bandpass';
  f.frequency.value = hp ? 7000 : 3200;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bgmGain);
  s.start(t); s.stop(t + dur + 0.02);
}
function bgmKick(t, freq, vol) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g); g.connect(bgmGain);
  o.start(t); o.stop(t + 0.16);
}
/* 鼓组：march 进行曲 / drive 四踩 / mystic 空灵 / none */
function bgmDrums(T, t, sub, bar) {
  const st = T.drums;
  if (st === 'none') return;
  const S = 60 / T.bpm / 4;
  if (st === 'march') {
    if (sub === 0 || sub === 8) bgmKick(t, 120, 0.85);
    if (sub === 12) bgmKick(t, 100, 0.5);
    if (sub === 6 || sub === 14) bgmNoiseHit(t, 0.42, 0.1);
    if (sub % 4 === 2) bgmNoiseHit(t, 0.07, 0.04, 1);
    if (T.timpani && sub === 0) bgmNote(mf(T.roots[bar] - 24), t, S * 8, 'sine', 0.16);
  } else if (st === 'drive') {
    if (sub % 4 === 0) bgmKick(t, 135, 0.9);
    if (sub === 4 || sub === 12) bgmNoiseHit(t, 0.46, 0.11);
    if (sub % 2 === 0) bgmNoiseHit(t, 0.06, 0.035, 1);
  } else if (st === 'mystic') {
    if (sub === 0) bgmKick(t, 90, 0.42);
    if (sub === 8) bgmKick(t, 80, 0.3);
    if (sub % 4 === 2) bgmNoiseHit(t, 0.045, 0.06, 1);
  }
}
function schedBgm() {
  if (!actx || !bgmGain) return;
  const T = BGM_TRACKS[bgmTrackKey] || BGM_TRACKS.menu;
  const S = 60 / T.bpm / 4;
  while (bgmNext < actx.currentTime + 0.32) {
    const t = bgmNext;
    const step = bgmStep % 64;
    const bar = (step / 16) | 0;
    const sub = step % 16;
    const root = T.roots[bar];

    bgmDrums(T, t, sub, bar);

    /* 低音 */
    if (sub % 2 === 0 && T.drums !== 'none') {
      const oct = (sub === 14 && T.drums !== 'mystic') ? 12 : 0;
      bgmNote(mf(root - 24 + oct), t, S * 1.9, 'sawtooth', 0.19);
    } else if (sub === 0 && T.drums === 'none') {
      bgmNote(mf(root - 24), t, S * 14, 'sine', 0.13);       // 无鼓时铺长音低音
    }
    /* 和声垫 */
    if (sub === 0) {
      const tri = [root, root + 3, root + 7];
      if (T.id === 'godwrath' || T.id === 'victory') tri[1] = root + 4;
      tri.forEach(m => bgmNote(mf(m), t, S * 15, 'triangle', 0.085));
      bgmNote(mf(root - 12), t, S * 15, 'sine', 0.1);
    }
    /* 主旋律 */
    const note = T.mel[step];
    if (note) {
      const dur = Math.max(1, note[1]) * S;
      bgmNote(mf(note[0]), t, dur * 0.96, T.lead, T.leadVol);
      if (T.harm) bgmNote(mf(note[0] - 12), t, dur * 0.96, 'sine', T.leadVol * 0.42);
    }
    bgmNext += S;
    bgmStep++;
  }
}
function startBgm() {
  if (!actx) return;
  if (!bgmGain) {
    bgmGain = actx.createGain();
    bgmGain.gain.value = bgmVol;
    bgmGain.connect(actx.destination);
  }
  if (bgmTimer) return;
  bgmNext = actx.currentTime + 0.08;
  bgmStep = 0;
  bgmTimer = setInterval(schedBgm, 90);
  updateBgmLabel();
}
/* 切换曲目：淡出 → 复位小节 → 淡入（无音频上下文时只记录状态） */
function setBgmTrack(key) {
  if (!BGM_TRACKS[key] || key === bgmTrackKey) { updateBgmLabel(); return false; }
  bgmTrackKey = key;
  bgmStep = 0;
  if (actx && bgmGain) {
    bgmNext = actx.currentTime + 0.06;
    const t = actx.currentTime;
    try {
      /* 交叉淡出淡入：先压到 0，再回升到用户音量（线性避免 0 值指数错误） */
      bgmGain.gain.cancelScheduledValues(t);
      bgmGain.gain.setValueAtTime(bgmVol, t);
      bgmGain.gain.linearRampToValueAtTime(0, t + 0.14);
      bgmGain.gain.linearRampToValueAtTime(bgmVol, t + 0.52);
    } catch (e) { bgmGain.gain.value = bgmVol; }
  }
  updateBgmLabel(true);
  return true;
}
function currentBgm() { return BGM_TRACKS[bgmTrackKey] || BGM_TRACKS.menu; }
/* 暂停面板与 HUD 曲名条 */
function updateBgmLabel(announce) {
  const T = currentBgm();
  const el = $('bgm-now');
  if (el) el.innerHTML = '♪ <b>' + T.name + '</b><span>' + T.composer + ' · 程序化改编</span>';
  const chip = $('bgm-chip');
  if (chip) {
    chip.querySelector('#bgm-chip-name').textContent = T.name;
    if (announce) {
      chip.classList.remove('on');
      void chip.offsetWidth;
      chip.classList.add('on');
      clearTimeout(updateBgmLabel._t);
      updateBgmLabel._t = setTimeout(() => chip.classList.remove('on'), 2600);
    }
  }
}
function setBgmVol(v) {
  bgmVol = v;
  if (bgmGain && actx) bgmGain.gain.linearRampToValueAtTime(v, actx.currentTime + 0.12);
  if (window.META && META.save) { META.save.bgmVol = v; if (META.persist) META.persist(); }
}
/* BGM 音量滑条（暂停面板） */
{
  const sl = $('bgm-vol');
  const v0 = Math.round(bgmVol * 100);
  sl.value = v0;
  $('bgm-vol-num').textContent = v0 + '%';
  sl.addEventListener('input', () => {
    const v = +sl.value;
    $('bgm-vol-num').textContent = v + '%';
    setBgmVol(v / 100);
  });
}

/* ---------------- 菜单 3D ---------------- */
const menuGroup = new T.Group();
scene.add(menuGroup);
const menuChars = [];
let menuT = 0;
let hoverIdx = -1;
function highlight(i) { hoverIdx = i; }

function buildMenu() {
  const ids = ['yugi', 'joey', 'kaiba'];
  const X = [-4.6, 0, 4.6];
  ids.forEach((id, i) => {
    const c = CHARS[id];
    const holder = new T.Group();
    holder.position.set(X[i], 0, 0);
    menuGroup.add(holder);

    // 决斗者本体
    const d = (window.MODELS && MODELS.duelist(id)) || buildMagician();
    d.scale.setScalar(1.25);
    d.position.set(0, 0.46, 0.9);
    holder.add(d);
    menuChars.push(d);
    d.userData.home = holder;

    // 王牌怪兽：卡牌 3D 立牌（站在决斗者身后，缓缓浮动）
    let ace = null;
    if (window.Card3D && imgCache[c.ace]) {
      ace = Card3D.build(c.ace, imgCache[c.ace], 'monster');
      ace.scale.setScalar(1.5);
      ace.position.set(0, 1.95, -2.0);
      ace.rotation.y = Math.PI * 0.05;
      holder.add(ace);
      menuAces.push(ace);
      const halo = new T.Mesh(new T.TorusGeometry(1.5, 0.04, 6, 48),
        new T.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.7 }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(0, 0.48, -2.0);
      holder.add(halo);
      ace.userData.halo = halo;
    } else if (window.MODELS) {
      const aceRec = CARD_DB.cards[c.ace] || { id: c.ace, name: 'ACE', race: 'Dragon', level: 8 };
      ace = MODELS.monster(aceRec, { img: imgCache[c.ace], scale: 1.15 });
      ace.scale.multiplyScalar(1.35);
      ace.position.set(0, 1.9, -1.9);
      ace.rotation.y = Math.PI * 0.06;
      holder.add(ace);
      menuAces.push(ace);
      const halo = new T.Mesh(new T.TorusGeometry(1.5, 0.04, 6, 48),
        new T.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.7 }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(0, 1.92, -1.9);
      holder.add(halo);
      ace.userData.halo = halo;
    }

    // 台座
    const ped = new T.Mesh(new T.CylinderGeometry(1.35, 1.6, 0.45, 28), stoneMat);
    ped.position.set(0, 0.22, 0.9);
    ped.receiveShadow = true; ped.castShadow = true;
    holder.add(ped);
    const halo2 = new T.Mesh(new T.TorusGeometry(1.42, 0.035, 6, 60),
      new T.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.85 }));
    halo2.rotation.x = -Math.PI / 2;
    halo2.position.set(0, 0.46, 0.9);
    holder.add(halo2);
    const lamp = new T.PointLight(c.color, 1.8, 10);
    lamp.position.set(0, 3.4, 1.6);
    holder.add(lamp);

    // 地面人影
    const shadow = new T.Mesh(new T.CircleGeometry(1.1, 24),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.02, 0.9);
    holder.add(shadow);
  });
  menuGroup.visible = false;
}
const menuAces = [];

function updateMenu(dt) {
  menuT += dt;
  const isSel = G.screen === 'select';
  const focus = isSel ? -2.0 : 2.0;
  const cy = isSel ? 4.0 : 5.6;
  const cz = isSel ? 11.6 : 13.2;
  camera.position.set(Math.sin(menuT * 0.35) * 1.5, cy, cz);
  camera.lookAt(0, focus + 1.6, 0);
  menuChars.forEach((m, i) => {
    m.rotation.y = 0.1 + Math.sin(menuT * 0.7 + i) * 0.1;
    m.scale.setScalar(lerp(m.scale.x, hoverIdx === i ? 1.42 : 1.25, dt * 6));
    m.position.y = lerp(m.position.y, hoverIdx === i ? 0.56 : 0.46, dt * 6);
    if (window.MODELS) MODELS.animate(m, menuT + i, dt);
    const md = m.userData;
    if (md.orb) md.orb.rotation.y += dt * 2;
    if (md.wings) md.wings.forEach((w, k) => {
      const s = k === 0 ? -1 : 1;
      w.rotation.z = w.userData.base + s * Math.sin(menuT * 2.2) * 0.16;
    });
  });
  menuAces.forEach((m, i) => {
    m.position.y = 1.95 + Math.sin(menuT * 1.1 + i) * 0.09;
    m.rotation.y = Math.PI * 0.05 + Math.sin(menuT * 0.5 + i) * 0.1;
    m.rotation.z = Math.sin(menuT * 0.8 + i) * 0.03;
    if (window.MODELS) MODELS.animate(m, menuT * 1.3 + i, dt);
    if (m.userData.halo) m.userData.halo.rotation.z += dt * 0.5;
  });
  pxSmall.update(dt);
}

/* ---------------- UI 构建 ---------------- */
function buildLevelCards() {
  const row = $('lv-cards');
  row.innerHTML = '';
  LEVELS.forEach((lv, idx) => {
    const open = lv.id === 'temple' || (window.META && META.levelUnlocked && META.levelUnlocked(lv.id));
    const el = document.createElement('div');
    el.className = 'arena-card' + (open ? '' : ' locked');
    let lines = '';
    if (open) {
      const names = (lv.bosses || []).map((b, i) =>
        '<div class="ac-line"><span>BOSS ' + (i + 1) + '</span><b>' + (b.label || (CARD_DB.cards[b.recId] || {}).name || '?') + '</b></div>'
      ).join('');
      const last = (lv.bosses || [])[(lv.bosses || []).length - 1];
      lines = names +
        '<div class="ac-line"><span>通关条件</span><b>' + (lv.id === 'temple'
          ? '击败无名法老王'
          : '击破 ' + ((last && (last.label || (CARD_DB.cards[last.recId] || {}).name)) || '最终 BOSS')) + '</b></div>' +
        (lv.bosses || []).filter(b => b.failAfter).map(b =>
          '<div class="ac-line"><span>特殊失败</span><b>' + b.failTitle + '</b></div>').join('') +
        '<div class="ac-badge open">OPEN</div>';
    } else {
      const prev = LEVELS[idx - 1];
      lines = '<div class="ac-line"><span>解锁条件</span></div>' +
        '<div class="ac-line"><b>通关「' + (prev ? prev.name : '前一关') + '」</b></div>' +
        '<div class="ac-badge">LOCKED</div>';
    }
    el.innerHTML =
      '<div class="ac-art"><div class="ac-ring"></div><div class="ac-ring r2"></div><div class="ac-glyph">' + lv.glyph + '</div></div>' +
      '<div class="ac-name">' + lv.name + '</div>' +
      '<div class="ac-sub">' + lv.en + '</div>' +
      '<div class="ac-sep"></div>' + lines;
    if (open) el.addEventListener('click', () => {
      G.level = lv;
      $('s-level').classList.add('hidden');
      /* v0.4.0：手机端开战即请求全屏（隐藏浏览器地址栏；失败静默，可用悬浮按钮再试） */
      try { if (window.DeviceMode && DeviceMode.active && DeviceMode.fullscreen) DeviceMode.fullscreen.enter(); } catch (e) { }
      /* 第 2 步：按第 1 步选定的决斗者开战（未解锁 → 对手挑战） */
      const who = G.pendingChar || G.charId || 'yugi';
      const owned = !window.META || META.isUnlocked(who);
      if (owned) startRun(who);
      else startRivalDuel(who);
    });
    row.appendChild(el);
  });
}
function buildSelectCards() {
  const row = $('sel-cards');
  row.innerHTML = '';
  const order = ['yugi', 'joey', 'kaiba'];
  order.forEach((id, idx) => {
    const c = CHARS[id];
    const ace = CARD_DB.cards[c.ace];
    const st = CARD_DB.cards[c.starter];
    const unlocked = !window.META || META.isUnlocked(id);
    const el = document.createElement('div');
    el.className = 'sel-card' + (unlocked ? '' : ' locked');
    el.style.setProperty('--glow', 'hsl(' + c.hue + ' 80% 60%)');
    el.innerHTML =
      '<div class="sc-art"><img class="sc-ace" src="' + (window.__cardImg ? __cardImg(c.ace) : 'data/cardimg/' + c.ace + '.jpg') + '" alt="">' +
        (unlocked ? '' : '<div class="sc-lock"><span>未解锁</span><em>击败他即可获得使用权</em></div>') +
      '</div>' +
      '<div class="sc-name">' + c.name + '</div>' +
      '<div class="sc-title">' + c.title + ' · ' + c.trait + '</div>' +
      '<div class="sc-sep"></div>' +
      '<div class="sc-line"><span>初始怪兽</span><b>' + (st ? st.name : '—') + '</b></div>' +
      '<div class="sc-line"><span>王牌怪兽</span><b>' + (ace ? ace.name : '—') + '</b></div>' +
      '<div class="sc-line"><span>决斗者 LP</span><b>8000</b></div>' +
      '<div class="sc-line"><span>卡组</span><b>40 张</b></div>' +
      '<div class="sc-sep"></div>' +
      '<div class="sc-desc">' + c.desc + '</div>' +
      '<div class="sc-ult">' + (unlocked ? '◆ 终极技 · ' + c.ultName : '⚔ 决斗者挑战') + '</div>';
    el.addEventListener('click', () => {
      highlight(idx);
      /* 第 1 步：选定决斗者（未解锁 = 对手挑战），第 2 步再选地图 */
      G.pendingChar = id;
      showLevels();
    });
    el.addEventListener('mouseenter', () => highlight(idx));
    row.appendChild(el);
  });
}

/* 与锁定的决斗者对决，胜利后解锁 */
function startRivalDuel(who) {
  const me = (window.META && META.isUnlocked(META.save.lastChar)) ? META.save.lastChar : 'yugi';
  toast('决斗者挑战 · ' + CHARS[who].name);
  startRun(me, { mode: 'rival', rival: who });
}
/* ---- 额外卡组：E 键快捷召唤第一只可特殊召唤的额外怪兽 ---- */
function extraCanSummon(id) {
  const rec = CARD_DB.cards[id];
  if (!rec) return false;
  if (rec.kind === 'synchro') return syncCandidates(rec).length > 0;
  if (rec.kind === 'xyz') return xyzCandidates(rec).length > 0;
  if (rec.kind === 'link') return linkCandidates(rec).length > 0;
  return fusionCandidates(rec).length > 0;
}
function trySummonExtra() {
  if (G.screen !== 'playing') return;
  if (!G.extra.length) { toast('额外卡组为空（融合/同调/超量/连接怪兽放这里）'); return; }
  for (let i = 0; i < G.extra.length; i++) {
    if (extraCanSummon(G.extra[i])) { summonFromExtra(i); return; }
  }
  toast('素材不足 · ' + extraHint(CARD_DB.cards[G.extra[0]]));
  playSfx('hurt');
}

function refreshWeaponList() {
  refreshFieldUI();
}

/* ---------------- 流程 ---------------- */
/* 第 2 步：选择游玩地图（决斗场） */
function showLevels() {
  G.screen = 'level';
  setBgmTrack('menu');                  // 标题/选关：千年アイテム
  buildLevelCards();
  $('s-title').classList.add('hidden');
  $('s-select').classList.add('hidden');
  $('s-level').classList.remove('hidden');
  /* 顶部回显第 1 步选定的决斗者 */
  const w = $('lv-who');
  if (w) {
    const who = G.pendingChar || G.charId || 'yugi';
    const c = CHARS[who] || CHARS.yugi;
    const owned = !window.META || META.isUnlocked(who);
    w.className = 'lv-who' + (owned ? '' : ' rival');
    w.innerHTML = '<i>' + (owned ? '决斗者' : '对手挑战') + '</i><b>' + c.name + '</b><em>' +
      (owned ? c.title + ' · ' + c.trait : '胜利后可获得该决斗者的使用权') + '</em>' +
      '<span class="lv-who-step">STEP 2 / 2</span>';
  }
}
/* 第 1 步：选择决斗者 */
function showSelect() {
  G.screen = 'select';
  setBgmTrack('menu');
  $('s-level').classList.add('hidden');
  $('s-title').classList.add('hidden');
  $('s-select').classList.remove('hidden');
  $('sel-arena-name').textContent = 'STEP 1 / 2 · 选择你的决斗者';
  buildSelectCards();
}
function clearRun() {
  for (const e of enemies) { scene.remove(e.mesh); if (e.groundRing) scene.remove(e.groundRing); }
  enemies.length = 0;
  for (const b of bullets) removeBullet(b);
  bullets.length = 0;
  for (const b of eBullets) { scene.remove(b.mesh); b.mesh.material.dispose(); if (b.mesh.geometry !== eBulletGeo) b.mesh.geometry.dispose(); }
  eBullets.length = 0;
  for (const r of rings) scene.remove(r.mesh);
  rings.length = 0;
  for (const b of blades) scene.remove(b.mesh);
  blades.length = 0;
  for (const m of mines) scene.remove(m.mesh);
  mines.length = 0;
  for (const h of heals) scene.remove(h.mesh);
  heals.length = 0;
  clearPickups();
  G.mag = { X: false, Y: false, Z: false }; G.burnT = 9; G.magT = 16; G.burned = 0;
  G.xyzDone = false; G.xyzT = 12; G.xyzAbs = 0; G.failSpec = null; G.failTitle = null; G.failSub = null;
  G.finalBoss = null;                                  // v0.3.1：三阶段决战状态清空
  G._raDirty = false;
  camYaw = 0;
  for (const f of trapFx) { scene.remove(f.card); scene.remove(f.glow); }
  trapFx.length = 0;
  timers.length = 0;
  for (const o of orbs) o.alive = false;
  for (const m of G.field) fieldGroup.remove(m.obj);
  G.field.length = 0;
  if (P.model) { scene.remove(P.model); P.model = null; }
  G.boss = null;
  G.pharaoh = null; G.pharaohSpawned = false; G.godsCalled = {};
  $('boss-wrap').classList.add('hidden');
  G.time = 0; G.kills = 0; G.lv = 1; G.exp = 0; G.expNeed = 30;
  G.draws = 0;                                  // 抽卡机会需通过升级获得
  G.ult = 0; G.bossIdx = 0; G.spawnT = 2;
  G.cometT = 0; G.holeT = 0; G.shake = 0; G.flashT = 0;
  G.normalCd = 0; G.drawCd = 0; G.hand = []; G.grave = [];
  G.pick = null; G.millLeft = 5; G.millCount = 0; G.tributeCount = 0;
  G.discardMode = false;
  { const hr = $('hand-row'); if (hr) hr.classList.remove('discard-mode');
    const ex = $('exodia-chip'); if (ex) { ex.classList.remove('on', 'done'); ex.innerHTML = ''; } }
  G.handCd = {}; G.coinBusy = false;
  /* v0.4.2：清空代价弹窗状态（含 DOM 隐藏） */
  G.costPending = null; G.costPick = null;
  G.playPickIdx = null;
  ['s-cost', 's-costpick', 's-playpick'].forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });
  const cfx = $('coin-fx'); if (cfx) { cfx.classList.remove('on', 'heads', 'tails'); }
  const fch = $('fx-chip'); if (fch) { fch.classList.remove('on', 'ready'); fxChipText = ''; }
  $('flash').style.opacity = 0;
}
async function startRun(charId, opt) {
  opt = opt || {};
  charId = charId || G.charId;
  G.charId = charId;
  const c = CHARS[charId];
  G.mode = opt.mode || 'normal';
  G.rival = opt.rival || null;
  /* 开局 BGM：「遊戯」（对手决斗为「決闘者の魂」） */
  setBgmTrack(G.mode === 'rival' ? 'battle' : 'yugi');
  clearRun();
  injectLevelBosses(G.level);        // 关卡专属 Boss 元数据/卡记录注入
  applyLevelScene(G.level.id);       // 切换场景主题
  buildDeck();
  recalc();
  P.pos.set(0, 0, 0);
  P.lp = c.lp; P.maxLP = c.lp;
  P.face = 0; P.iframe = 0; P.bob = 0;

  const m = (window.MODELS && MODELS.duelist(charId)) || buildMagician();
  m.position.set(0, 0, 0);
  m.scale.setScalar(1.05);
  scene.add(m);
  P.model = m;

  // 只预载本局会用到的卡图（卡池已达 8000+ 张，不能全量加载）
  const needIds = new Set();
  G.deck.forEach(id => needIds.add(id));
  G.extra.forEach(id => needIds.add(id));
  G.hand.forEach(id => needIds.add(id));
  G.field.forEach(m => needIds.add(m.id));
  const st0 = (window.META && META.starterFor) ? META.starterFor(charId) : c.starter;
  if (st0) needIds.add(st0);
  [c.ace, c.starter].forEach(id => id && needIds.add(id));
  const need = [];
  needIds.forEach(id => need.push(loadImg(id).catch(() => null)));
  BOSSES.forEach(b => need.push(loadImg(b.id).catch(() => null)));
  (G.level.bosses || []).forEach(b => need.push(loadImg(b.recId).catch(() => null)));   // 关卡 Boss 卡图
  /* v0.4.1：预加载加 6 秒超时兜底 —— 此前若某张 CDN 卡图请求挂起，Promise.all 永不 resolve，
   * 玩家将无限卡在选关界面（无任何提示）。超时后照常开战，卡图后台续加载 */
  try {
    await Promise.race([
      Promise.all(need),
      new Promise(r => setTimeout(r, 6000))
    ]);
  } catch (e) { }

  menuGroup.visible = false;
  ['s-title', 's-level', 's-select', 's-result', 's-pause', 's-shop', 's-deck', 's-ach', 's-grave'].forEach(s => { const el = $(s); if (el) el.classList.add('hidden'); });
  $('hud').classList.remove('hidden');

  $('pl-name').textContent = c.name;
  $('pl-title').textContent = c.title;
  $('portrait-glyph').textContent = c.glyph;
  $('ult-glyph').textContent = c.ultGlyph;
  $('ult-label').textContent = 'F';
  $('deck-left').textContent = deckLeft();
  $('extra-left').textContent = G.extra.length;
  camera.position.set(0, 18, 14);

  // 初始怪兽直接登场
  const starterId = (window.META && META.starterFor) ? META.starterFor(charId) : c.starter;
  const stRec = CARD_DB.cards[starterId];
  if (stRec) fieldSummon(stRec, 2, { type: '初始召唤' });

  // 起手 4 张
  for (let i = 0; i < 4; i++) drawCard(true, true);   // 起手手牌不耗抽卡次数

  refreshHandUI();
  refreshFieldUI();
  refreshMagUI();
  G.screen = 'playing';
  checkExodiaWin();                    // 起手五部件齐手也判特殊胜利
  $('timer-sub').textContent = G.mode === 'rival' ? '击败对手以解锁'
    : G.level.id === 'temple' ? ('生存至 ' + fmtTime(G.level.duration) + ' · 击败无名法老王')
    : '击破最终 Boss 通关';
  if (G.mode === 'rival' && G.rival) spawnRivalDuel(G.rival);
  if (window.META) META.markSelectSeen(charId);
  playSfx('reveal');
  /* 操作提示：移动只靠 WASD，鼠标仅转视角 */
  timers.push({ t: 0.7, fn: () => toast('WASD 移动 · 鼠标转视角（Alt 加速）· F 终结技') });
  lockNow();                                    // 开局即隐藏并锁定指针（若被拒→点击画面补锁）
}
function pauseGame() {
  if (G.screen !== 'playing') return;
  if (G.discardMode) cancelDiscardDraw(true);
  G.screen = 'pause';
  $('s-pause').classList.remove('hidden');
  Cursor.sync();                       // 立即释放指针（不必等下一帧）
}
function resumeGame() {
  if (G.screen !== 'pause') return;
  G.screen = 'playing';
  $('s-pause').classList.add('hidden');
  lockNow();                                  // 点击「继续」的手势内直接重新锁定指针
}
function gameOver(win, opt) {
  opt = opt || {};
  if (G.screen === 'result') return;
  if (G.discardMode) cancelDiscardDraw(true);
  G.screen = 'result';
  Cursor.sync();                       // 结算时立即释放指针
  /* 结算 BGM：勝利 / 敗北（作曲：光宗信吉） */
  setBgmTrack(win ? 'victory' : 'defeat');
  { const c = $('fx-chip'); if (c) { c.classList.remove('on', 'ready'); fxChipText = ''; }
    const k = $('coin-fx'); if (k) k.classList.remove('on', 'heads', 'tails'); }
  const best = Math.max(G.best, G.time);
  if (best > G.best) { G.best = best; localStorage.setItem('ds_best3', String(best)); }

  // 日元结算：基础 + 击杀 + 存活 + 通关
  const yen = Math.round(120 + G.kills * 8 + G.time * 2 + (win ? 2000 : 0));
  if (window.META && META.addYen) META.addYen(yen, { kills: G.kills, time: G.time, win: win });
  if (G.kills >= 100) unlockAch('kill100');
  if (G.kills >= 500) unlockAch('kill500');
  if (win) unlockAch('clear');
  /* 通关解锁下一关卡（仅正常模式通关才算推进关卡进度） */
  let unlockedTip = '';
  if (win && G.mode === 'normal' && window.META && META.unlockLevel) {
    const i = LEVELS.indexOf(G.level);
    const nx = LEVELS[i + 1];
    if (nx && !META.levelUnlocked(nx.id)) {
      META.unlockLevel(nx.id);
      unlockedTip = '已解锁新关卡 · ' + nx.name;
    }
  }

  const rivalWin = win && G.mode === 'rival' && G.rival;
  $('res-kicker').textContent = opt.kicker ? opt.kicker
    : opt.failTitle ? 'SPECIAL DEFEAT'
      : rivalWin ? 'DUELIST DEFEATED' : (win ? 'DUEL CLEAR' : 'DUEL OVER');
  const t = $('res-title');
  t.textContent = win ? (opt.winTitle || '胜 利') : '败 北';
  t.className = 'res-title' + (win ? ' win' : '') + (opt.titleClass ? ' ' + opt.titleClass : '');
  $('res-sub').textContent = opt.sub ? opt.sub
    : opt.failSub
      ? opt.failSub
      : rivalWin
        ? '你击败了 ' + CHARS[G.rival].name + ' · 已获得该决斗者的使用权'
        : (win ? (G.level.winText || '你击败了无名法老王，守住了王家神殿') : '你的 LP 归零了')
          + (unlockedTip ? ' —— ' + unlockedTip : '');
  $('res-stats').innerHTML =
    '<div><b>' + fmtTime(G.time) + '</b><span>存活时间</span></div>' +
    '<div><b>' + G.kills + '</b><span>击败怪兽</span></div>' +
    '<div><b>' + G.lv + '</b><span>决斗等级</span></div>' +
    '<div><b>' + (G.burned || 0) + '</b><span>发动直伤卡</span></div>' +
    '<div class="res-yen"><b>¥' + yen.toLocaleString() + '</b><span>获得日元</span></div>';

  const rd = $('res-deck');
  rd.innerHTML = '';
  G.field.forEach(m => {
    const im = document.createElement('img');
    im.src = (window.__cardImg ? __cardImg(m.id) : 'data/cardimg/' + m.id + '.jpg');
    im.title = m.rec.name;
    rd.appendChild(im);
  });
  /* 特殊胜利可指定一张浮雕卡作为标题背板（如艾克佐迪亚） */
  if (opt.bgCard) showResultBg(opt.bgCard);
  else hideHolactieBg();
  $('s-result').classList.remove('hidden');
  playSfx(win ? 'bossdown' : 'hurt');
}
/* 结算面板背后的大幅卡面（金色浮雕效果） */
function showResultBg(cardId) {
  const panel = document.querySelector('#s-result .panel');
  if (!panel) return;
  let bg = $('holactie-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'holactie-bg';
    bg.innerHTML = '<img alt="" draggable="false">';
    panel.insertBefore(bg, panel.firstChild);
  }
  const im = bg.querySelector('img');
  if (im) { im.src = (window.__cardImg ? __cardImg(cardId) : 'data/cardimg/' + cardId + '.jpg'); }
  bg.classList.add('show');
}
/* 三幻神同席 → 光之创造神降临，决斗强制终结 */
function holactieEnd() {
  if (G.screen === 'result') return;
  G.screen = 'result';
  setBgmTrack('defeat');
  const best = Math.max(G.best, G.time);
  if (best > G.best) { G.best = best; localStorage.setItem('ds_best3', String(best)); }
  const yen = Math.round(120 + G.kills * 8 + G.time * 2);
  if (window.META && META.addYen) META.addYen(yen, { kills: G.kills, time: G.time, win: false });
  if (G.kills >= 100) unlockAch('kill100');
  if (G.kills >= 500) unlockAch('kill500');

  $('res-kicker').textContent = 'THE CREATOR OF LIGHT';
  const t = $('res-title');
  t.textContent = '光之创造神降临';
  t.className = 'res-title god';
  $('res-sub').textContent = '三幻神同席 —— 欧西里斯之天空龙、欧贝利斯克之巨神兵、拉的翼神龙齐聚，光之创造神降临，决斗终结';
  $('res-stats').innerHTML =
    '<div><b>' + fmtTime(G.time) + '</b><span>存活时间</span></div>' +
    '<div><b>' + G.kills + '</b><span>击败怪兽</span></div>' +
    '<div><b>' + G.lv + '</b><span>决斗等级</span></div>' +
    '<div><b>' + (G.burned || 0) + '</b><span>发动直伤卡</span></div>' +
    '<div class="res-yen"><b>¥' + yen.toLocaleString() + '</b><span>获得日元</span></div>';
  const rd = $('res-deck');
  rd.innerHTML = '';
  G.field.forEach(m => {
    const im = document.createElement('img');
    im.src = (window.__cardImg ? __cardImg(m.id) : 'data/cardimg/' + m.id + '.jpg');
    im.title = m.rec.name;
    rd.appendChild(im);
  });

  // 标题背后：光之创造神浮雕卡（10000040），金框 + 神光
  const panel = document.querySelector('#s-result .panel');
  let bg = $('holactie-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'holactie-bg';
    bg.innerHTML = '<img alt="光之创造神" draggable="false">';
    panel.insertBefore(bg, panel.firstChild);
  }
  bg.querySelector('img').src = 'data/cardimg/' + 10000040 + '.jpg';
  bg.classList.add('show');

  $('s-result').classList.remove('hidden');
  playSfx('god');
}
function hideHolactieBg() {
  const bg = $('holactie-bg');
  if (bg) bg.classList.remove('show');
}
function toTitle() {
  G.screen = 'title';
  Cursor.sync();                   // 回标题立即释放指针
  setBgmTrack('menu');
  clearRun();
  hideHolactieBg();
  applyLevelScene('temple');       // 回标题界面恢复神殿场景
  ['s-level', 's-select', 's-result', 's-pause', 's-howto', 's-shop', 's-deck', 's-ach', 's-grave'].forEach(s => { const el = $(s); if (el) el.classList.add('hidden'); });
  $('s-title').classList.remove('hidden');
  $('hud').classList.add('hidden');
  menuGroup.visible = true;
  menuChars.forEach(m => { m.visible = true; m.position.set(0, 0.46, 0.9); });
  buildSelectCards();
  updateBestLine();
  if (window.META) META.refreshWallet();
}
function updateBestLine() {
  const line = $('best-line');
  if (!line) return;
  const best = G.best > 0 ? '最佳记录 · ' + fmtTime(G.best) : '最佳记录 —';
  const yen = (window.META && META.save) ? META.save.yen.toLocaleString() : '0';
  line.innerHTML = best + '　<span class="bl-yen">¥' + yen + '</span>';
}

/* ---------------- 主循环 ---------------- */
/* v0.4.1：自适应分辨率 —— 触屏端帧时间 EMA 持续 >25ms 时逐级降 pixelRatio
 * （1.5→1.25→1.0→0.85），持续 <15.5ms 时逐级恢复；PC 端不启用（避免无谓抖动） */
const RES_STEPS = [1.5, 1.25, 1.0, 0.85];
let resIdx = 0, resEma = 1 / 60, resWinT = 0;
function adaptiveRes(dt) {
  if (!IS_COARSE) return;
  resEma += (dt - resEma) * 0.06;
  resWinT += dt;
  if (resWinT < 1.5) return;
  resWinT = 0;
  if (resEma > 0.025 && resIdx < RES_STEPS.length - 1) {
    resIdx++;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RES_STEPS[resIdx]));
  } else if (resEma < 0.0155 && resIdx > 0) {
    resIdx--;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RES_STEPS[resIdx]));
  }
}
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);
  Cursor.sync();                       // 界面状态 → 指针锁定/释放（战斗锁定，弹窗释放）
  updateCursorUI();                    // 未锁定时给出「点击画面」提示
  if (G.screen === 'playing') {
    /* v0.4.0：手牌选择弹窗打开期间暂停战斗推进（画面特效照常）
     * v0.4.2：代价确认 / 代价弃牌弹窗同样暂停（玩家在读弹窗/选手牌） */
    if (G.playPickIdx == null && !G.costPending && !G.costPick) {
      try { updateGame(dt); } catch (err) { window.__gameErr = (err && err.stack) || String(err); }
    } else {
      updateDamageNumbers(dt); pxSmall.update(dt); pxBig.update(dt);
    }
  }
  else if (G.screen === 'title' || G.screen === 'select' || G.screen === 'level') updateMenu(dt);
  else { updateDamageNumbers(dt); pxSmall.update(dt); pxBig.update(dt); }
  boundary.material.opacity = 0.38 + Math.sin(performance.now() * 0.0016) * 0.14;
  boundary2.rotation.z += dt * 0.1;
  adaptiveRes(dt);

  // 抽卡 3D 展示：翻牌动画 + 待机浮动
  if (G.screen === 'draw' && show3d && show3d.mesh) {
    const s3 = show3d, m = s3.mesh;
    s3.t += dt;
    if (s3.anim) {
      s3.anim.t += dt;
      const p = Math.min(1, s3.anim.t / s3.anim.dur);
      const e = 1 - Math.pow(1 - p, 3);
      m.rotation.y = Math.PI * (1 - e);
      m.scale.setScalar(0.74 + 0.26 * e + Math.sin(p * Math.PI) * 0.05);
      if (p >= 1) s3.anim = null;
    } else {
      m.rotation.y = Math.sin(s3.t * 0.8) * 0.26;
      m.scale.setScalar(1);
    }
    m.position.y = 0.18 + Math.sin(s3.t * 1.5) * 0.06;
    renderer.render(s3.sc, s3.cam);
  } else {
    renderer.render(scene, camera);
  }
}

/* ---------------- 启动 ---------------- */
buildMenu();
buildLevelCards();
buildSelectCards();
/* 主界面左上角版本号 */
{ const vb = $('ver-badge'); if (vb) vb.innerHTML = '<i></i>v' + GAME_VERSION; }
toTitle();
/* 启动只预载菜单所需核心卡图（王牌/初始/FINE 建模/Boss）；
   8000+ 扩展池在 startRun 按需预载、商店/卡组编辑用 <img> 直接加载 */
const PRELOAD_CORE = new Set();
Object.values(CHARS).forEach(cc => { if (cc.ace) PRELOAD_CORE.add(cc.ace); if (cc.starter) PRELOAD_CORE.add(cc.starter); });
Object.keys(MODELS.FINE).forEach(id => PRELOAD_CORE.add(+id));
BOSSES.forEach(b => PRELOAD_CORE.add(b.id));
const preload = [...PRELOAD_CORE].map(id => loadImg(id).catch(() => { }));
BOSSES.forEach(b => preload.push(loadImg(b.id).catch(() => { })));
Promise.all(preload).then(() => {
  if (G.screen === 'playing') return;
  menuGroup.clear();
  menuChars.length = 0;
  menuAces.length = 0;
  buildMenu();
  menuGroup.visible = G.screen !== 'playing';
});
requestAnimationFrame(tick);

// 调试钩子
window.LIMIT1_SET = LIMIT1_IDS;                 // 供卡组编辑器（meta.js）共享禁限表
window.__DS = {
  G, P, D, enemies, pickups, castUlt, checkLevel, spawnBoss, startRun, gameOver, scene,
  renderer,                                              // v0.4.1：暴露渲染器（info.memory 资源计数断言）
  drawFromDeck, drawCard, performSummon, fieldSummon, destroyMonster, tryJump,
  hurtEnemy, killEnemy, updateSpawn, refreshHandUI, refreshFieldUI, activateSpell,
  summonFromExtra, refreshExtraUI, buildDeck, CARD_DB: window.CARD_DB,
  spawnBossKey, spawnRivalDuel, spawnPickup, updatePickups, applyBurnCard,
  pickupMagCard, summonXYZCannon, refreshMagUI, spellArtFx, MODELS: window.MODELS,
  holactieEnd, BOSS_TIMES: BOSS_TIMES, spawnEnemy,
  millHand, toggleGravePanel, refreshGraveUI, togglePickField, confirmPick, cancelPick, drawFromDeck,
  /* v0.3.1：Boss 血量标注 / 三阶段决战 */
  refreshBossHud, ensurePhaseGods, bossNextPhase, PHASE_LP, PHASE_GODS,
  /* v25：艾克佐迪亚特殊胜利 / 弃牌抽牌 */
  EXODIA_PARTS, EXODIA_IDS, isExodiaPart, exodiaProgress, exodiaReady, checkExodiaWin, exodiaEnd,
  beginDiscardDraw, cancelDiscardDraw, refreshExodiaChip, showResultBg, HAND_MAX,
  updateBestLine, showSelect, showLevels,
  /* v0.2.8：版本号 */
  GAME_VERSION,
  startTributePick, startXyzPick, startSynchroPick, openSummonModal, closeSummonModal, renderSummonSlots,
  toggleExtraPanel, closeExtraPanel, renderExtraGrid, rivalPlayCard, magicImmune, pickupMesh, extraCanSummon,
  imgCache, camera, loadImg, keys: keys,
  get camYaw() { return camYaw; }, setCamYaw, rotateCam, CAM_SENS,
  LEVELS, spawnOrb, playHandCard, applyXyzMonCard, injectLevelBosses, applyLevelScene, hurtPlayer,
  /* v18：三幻神祭品 / 手牌效果 / 难度参数 */
  DIFF, tributeNeed, isGodCard, GOD_IDS, HAND_FX, tryHandEffect, startCoinFlip, resolveCoinFlip,
  handFxReadyIn, updateHandFxChip, clearRun, buildLevelCards,
  /* v0.4.0：手牌弹窗 / 手机端手牌面板 / 墓地复活 */
  openPlayPick, closePlayPick, openHandPanel, closeHandPanel, beginRevivePick, closeRevivePick, reviveGraveAt, graveMonsterIdxs,
  /* v0.4.1：弹幕工厂 / 子弹移除（资源释放回归测试用） */
  spawnPlayerBullet, removeBullet, spawnEnemyBullet, clearPickups, IS_COARSE,
  /* v0.4.2：仪式召唤 / 代价确认弹窗 */
  normalizeCardDB, ritualTargetsFor, ritualSummonFromDeck, spellCostOf, spellCostLines, costHasAny, costCheck,
  openCostConfirm, closeCostConfirm, confirmCost, beginCostDiscard, closeCostPick, renderCostPickGrid, costPickAt,
  spellFxSummary, openRiskConfirm, resolveSpell, syncUiBlock,
  /* v19：怪兽登场效果 */
  SUMMON_FX, summonFxOf, summonFxText, runSummonEffect, afterSummon, showCardDetail, rings,
  /* v23：融合召唤弹窗 */
  fusionSpellIdx, fusionMatIds, fusionNeed, fusionMatText, fusionPool, fusionUsable,
  fusionFeasible, fusionTargets, fusionCheckOk, startFusionPick, startFusionFromSpell,
  chooseFusionTarget, fusionBack, toggleFusionMatField, toggleFusionMatHand,
  renderFusionTargets, renderFusionHand, confirmFusion,
  /* v20：BGM 曲目系统 */
  BGM_TRACKS, setBgmTrack, currentBgm, updateBgmLabel, startBgm, setBgmVol,
  get bgmTrack() { return bgmTrackKey; },
  get bgmStep() { return bgmStep; },
  /* v22：指针锁定 */
  Cursor,
  get cursor() { return { want: Cursor.want, locked: Cursor.locked, supported: Cursor.supported, denied: Cursor._denied }; },
  BURN_IDS: BURN_IDS, MAG_IDS: MAG_IDS, groundY: groundY, terrainH: terrainH, ARENA_R: ARENA_R,
  timers: timers, spellFx: spellFx,
  step: function (dt, n) {
    for (let i = 0; i < (n || 1); i++) {
      try { updateGame(dt || 0.05); } catch (e) { window.__gameErr = (e && e.stack) || String(e); break; }
    }
    return window.__gameErr || 'ok';
  }
};
})();
