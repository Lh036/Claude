// Analyty promo — 30s, 1920x1080. Everything is drawn procedurally on one canvas.
// renderAt(t) is a pure function of time so frames can be rendered deterministically.

const W = 1920, H = 1080, DURATION = 30;
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const C = {
  bg: "#05071a",
  indigo: "#6366f1",
  indigoDeep: "#4f46e5",
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  green: "#34d399",
  red: "#f87171",
  amber: "#fbbf24",
  text: "#f8fafc",
  muted: "#94a3b8",
  faint: "#64748b",
  card: "rgba(17, 22, 48, 0.78)",
  cardHi: "rgba(30, 36, 72, 0.85)",
  border: "rgba(148, 163, 184, 0.16)",
};
const PROVIDERS = [
  { name: "ChatGPT", color: "#10b981", value: 71 },
  { name: "Gemini", color: "#60a5fa", value: 52 },
  { name: "Claude", color: "#f59e6b", value: 68 },
];
const SANS = "Inter, system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

// ---------- math helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
const easeInCubic = (k) => k * k * k;
const easeInOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
// Visibility window: fades in over [a,b], out over [c,d].
const win = (t, a, b, c, d) => seg(t, a, b) * (1 - seg(t, c, d));

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- drawing helpers ----------
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function font(size, weight = 600, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }
function text(str, x, y, { size = 32, weight = 600, color = C.text, align = "left", baseline = "alphabetic", ls = 0, family = SANS } = {}) {
  font(size, weight, family);
  ctx.letterSpacing = `${ls}px`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.letterSpacing = "0px";
}
function measure(str, size, weight = 600, ls = 0, family = SANS) {
  font(size, weight, family);
  ctx.letterSpacing = `${ls}px`;
  const w = ctx.measureText(str).width;
  ctx.letterSpacing = "0px";
  return w;
}
function withAlpha(a, fn) {
  if (a <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= a;
  fn();
  ctx.restore();
}
function glassCard(x, y, w, h, r = 28, { fill = C.card, border = C.border, glow = null } = {}) {
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 80; }
  rr(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  // top highlight
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.22)");
  g.addColorStop(0.35, border);
  g.addColorStop(1, "rgba(148,163,184,0.06)");
  rr(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function hexPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// Analyty mark: rounded indigo tile, white hexagon, center dot (matches the app favicon).
function logo(cx, cy, size, { draw = 1, dot = 1, glow = 1 } = {}) {
  const s = size;
  ctx.save();
  ctx.shadowColor = `rgba(99,102,241,${0.75 * glow})`;
  ctx.shadowBlur = s * 0.6 * glow;
  rr(cx - s / 2, cy - s / 2, s, s, s * 0.24);
  const g = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
  g.addColorStop(0, "#7c7ff7");
  g.addColorStop(0.55, C.indigoDeep);
  g.addColorStop(1, "#6d28d9");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // hexagon outline, drawn progressively
  const per = 6 * s * 0.3;
  ctx.save();
  hexPath(cx, cy, s * 0.3);
  ctx.lineDashOffset = 0;
  ctx.setLineDash([per * draw, per]);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = s * 0.0625;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
  if (dot > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.094 * dot, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
}
function check(cx, cy, s, k, color = "#fff", lw = 4) {
  if (k <= 0) return;
  const p = [[cx - s * 0.5, cy], [cx - s * 0.15, cy + s * 0.35], [cx + s * 0.55, cy - s * 0.4]];
  const l1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
  const l2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...p[0]);
  ctx.lineTo(...p[1]);
  ctx.lineTo(...p[2]);
  ctx.setLineDash([(l1 + l2) * k, l1 + l2]);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}
function cross(cx, cy, s, color, lw = 4) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
  ctx.stroke();
  ctx.restore();
}
function sparkle(cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.32;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Words rise out of a mask one by one. Returns total width.
function revealLine(str, cx, y, t0, t, { size = 80, weight = 700, color = C.text, stagger = 0.07, dur = 0.6, align = "center", gradient = null, ls = -2 } = {}) {
  const words = str.split(" ");
  const space = measure(" ", size, weight, ls);
  const widths = words.map((w) => measure(w, size, weight, ls));
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let x = align === "center" ? cx - total / 2 : cx;
  const x0 = x;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-W * 2, y - size * 1.1, W * 5, size * 1.45);
  ctx.clip();
  let fill = color;
  if (gradient) {
    const g = ctx.createLinearGradient(x0, 0, x0 + total, 0);
    gradient.forEach((c, i) => g.addColorStop(i / (gradient.length - 1), c));
    fill = g;
  }
  words.forEach((w, i) => {
    const k = easeOutExpo(seg(t, t0 + i * stagger, t0 + i * stagger + dur));
    if (k > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.4);
      text(w, x, y + (1 - k) * size * 1.1, { size, weight, color: fill, ls });
      ctx.restore();
    }
    x += widths[i] + space;
  });
  ctx.restore();
  return total;
}

// ---------- shared assets ----------
const R = rng(7);
const DUST = Array.from({ length: 140 }, () => ({ x: R() * W, y: R() * H, r: 0.6 + R() * 1.8, s: 6 + R() * 22, p: R() * 6.28 }));
const BURST = Array.from({ length: 260 }, () => ({ a: R() * 6.28, d: 500 + R() * 900, r: 1 + R() * 2.6, spin: (R() - 0.5) * 2.2, delay: R() * 0.45, hue: R() }));
const grain = document.createElement("canvas");
grain.width = grain.height = 256;
{
  const g = grain.getContext("2d");
  const img = g.createImageData(256, 256);
  const gr = rng(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = gr() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ---------- background ----------
function background(t) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Red danger tint during the "not mentioned" moment, green lift during improvements.
  const danger = win(t, 10.4, 10.9, 11.6, 12.2);
  const success = win(t, 24.0, 25.5, 27.0, 28.0);
  const blobs = [
    { x: W * 0.25 + Math.sin(t * 0.35) * 220, y: H * 0.3 + Math.cos(t * 0.27) * 120, r: 760, c: [99, 102, 241], a: 0.32 },
    { x: W * 0.78 + Math.cos(t * 0.3) * 200, y: H * 0.65 + Math.sin(t * 0.4) * 140, r: 700, c: [139, 92, 246], a: 0.26 },
    { x: W * 0.55 + Math.sin(t * 0.22 + 2) * 300, y: H * 0.95, r: 620, c: [34, 211, 238], a: 0.12 },
  ];
  ctx.globalCompositeOperation = "lighter";
  for (const b of blobs) {
    let [r, g, bl] = b.c;
    r = lerp(lerp(r, 239, danger * 0.9), 52, success * 0.6);
    g = lerp(lerp(g, 68, danger * 0.9), 211, success * 0.6);
    bl = lerp(lerp(bl, 68, danger * 0.9), 153, success * 0.6);
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    grd.addColorStop(0, `rgba(${r | 0},${g | 0},${bl | 0},${b.a})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = "source-over";

  // Perspective grid floor drifting toward camera.
  const horizon = H * 0.56;
  ctx.save();
  ctx.strokeStyle = "rgba(129,140,248,0.10)";
  ctx.lineWidth = 1;
  for (let i = -24; i <= 24; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 18, horizon);
    ctx.lineTo(W / 2 + i * 260, H + 40);
    ctx.stroke();
  }
  const off = (t * 0.35) % 1;
  for (let i = 0; i < 14; i++) {
    const z = (i + off) / 14;
    const y = horizon + Math.pow(z, 2.4) * (H - horizon + 40);
    ctx.globalAlpha = Math.pow(z, 1.2) * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  const fadeG = ctx.createLinearGradient(0, horizon - 10, 0, horizon + 260);
  fadeG.addColorStop(0, C.bg);
  fadeG.addColorStop(1, "rgba(5,7,26,0)");
  ctx.fillStyle = fadeG;
  ctx.fillRect(0, horizon - 10, W, 270);

  // Dust
  for (const d of DUST) {
    const y = (((d.y - t * d.s) % H) + H) % H;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + d.p));
    ctx.fillStyle = `rgba(199,210,254,${0.35 * tw})`;
    ctx.beginPath();
    ctx.arc(d.x + Math.sin(t * 0.5 + d.p) * 12, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function postFx(t) {
  // Vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // Film grain
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  const ox = Math.floor((t * 977) % 256), oy = Math.floor((t * 613) % 256);
  ctx.fillStyle = ctx.createPattern(grain, "repeat");
  ctx.translate(-ox, -oy);
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
  // Fade in from / out to black
  const black = 1 - seg(t, 0, 0.5) + seg(t, 29.55, 30);
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(black)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- Scene 1: logo reveal (0 – 3.5) ----------
function sceneIntro(t) {
  const a = 1 - seg(t, 3.0, 3.5);
  if (a <= 0) return;
  const camZoom = 1 + seg(t, 2.9, 3.5) * 0.25;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = a;

  const cx = W / 2, cy = H / 2 - 40;
  // Particles spiral into the center.
  ctx.globalCompositeOperation = "lighter";
  for (const p of BURST) {
    const k = easeInCubic(seg(t, 0.1 + p.delay, 1.45));
    if (k >= 1) continue;
    const dist = p.d * (1 - k);
    const ang = p.a + p.spin * k * 2.5;
    const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist * 0.75;
    const col = p.hue < 0.6 ? "129,140,248" : p.hue < 0.85 ? "167,139,250" : "103,232,249";
    ctx.fillStyle = `rgba(${col},${(0.5 + 0.5 * k) * seg(t, 0.1 + p.delay, 0.4 + p.delay)})`;
    ctx.beginPath();
    ctx.arc(x, y, p.r * (1.5 - k * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  // Flash + shockwave when the logo lands.
  const flash = seg(t, 1.45, 1.5) * (1 - seg(t, 1.5, 2.1));
  if (flash > 0) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
    g.addColorStop(0, `rgba(165,180,252,${0.55 * flash})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const wave = seg(t, 1.48, 2.4);
  if (wave > 0 && wave < 1) {
    ctx.strokeStyle = `rgba(165,180,252,${0.6 * (1 - wave)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 80 + easeOutCubic(wave) * 620, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // Logo pops, then shifts left to make room for the wordmark.
  const pop = easeOutBack(seg(t, 1.42, 1.85));
  const shift = easeInOutCubic(seg(t, 1.95, 2.55));
  const wordW = measure("Analyty", 150, 800, -5);
  const logoSize = 170;
  const gap = 46;
  const groupW = logoSize + gap + wordW;
  const lx = lerp(cx, cx - groupW / 2 + logoSize / 2, shift);
  if (pop > 0) {
    ctx.save();
    ctx.translate(lx, cy);
    ctx.scale(pop, pop);
    logo(0, 0, logoSize, { draw: easeInOutCubic(seg(t, 1.5, 2.1)), dot: easeOutBack(seg(t, 1.9, 2.2)) });
    ctx.restore();
  }
  // Wordmark wipes in from behind the logo.
  const wk = easeOutCubic(seg(t, 2.1, 2.75));
  if (wk > 0) {
    const wx = cx - groupW / 2 + logoSize + gap;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx - 10, cy - 140, (wordW + 40) * wk, 280);
    ctx.clip();
    text("Analyty", wx - (1 - wk) * 60, cy + 52, { size: 150, weight: 800, ls: -5 });
    ctx.restore();
  }
  withAlpha(seg(t, 2.45, 2.9), () => {
    text("AI-ZICHTBAARHEID, GEMETEN", cx, cy + 190 + (1 - easeOutCubic(seg(t, 2.45, 2.9))) * 20, { size: 26, weight: 600, color: C.muted, align: "center", ls: 10 });
  });
  ctx.restore();
}

// ---------- Scene 2: the shift (3.5 – 6.8) ----------
const PROMPTS = [
  { s: "Beste advocaat in Amsterdam?", x: 260, y: 230, d: 0.55 },
  { s: "Welke loodgieter is snel?", x: 1500, y: 200, d: 0.75 },
  { s: "Goede tandarts in de buurt?", x: 220, y: 860, d: 0.85 },
  { s: "Welk CRM past bij ons?", x: 1560, y: 880, d: 0.65 },
  { s: "Leukste restaurant in Utrecht?", x: 1640, y: 540, d: 0.45 },
  { s: "Betrouwbare accountant mkb?", x: 230, y: 550, d: 0.5 },
];
function promptPill(str, x, y, scale = 1) {
  const size = 26 * scale;
  const w = measure(str, size, 500) + 70 * scale;
  const h = 58 * scale;
  glassCard(x - w / 2, y - h / 2, w, h, h / 2, { fill: "rgba(23,28,60,0.7)" });
  sparkle(x - w / 2 + 30 * scale, y, 10 * scale, C.cyan);
  text(str, x - w / 2 + 50 * scale, y + size * 0.36, { size, weight: 500, color: "#cbd5e1" });
}
function sceneShift(t) {
  const a = win(t, 3.45, 3.6, 6.45, 6.85);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const exit = easeInCubic(seg(t, 6.4, 6.85));
  ctx.translate(W / 2, H / 2);
  ctx.scale(1 + exit * 0.35, 1 + exit * 0.35);
  ctx.translate(-W / 2, -H / 2);

  // Floating AI prompts in depth.
  PROMPTS.forEach((p, i) => {
    const k = easeOutCubic(seg(t, 5.0 + i * 0.12, 5.7 + i * 0.12));
    if (k <= 0) return;
    const drift = Math.sin(t * 0.8 + i) * 10;
    withAlpha(k * p.d, () => {
      ctx.save();
      ctx.filter = p.d < 0.6 ? "blur(2px)" : "none";
      promptPill(p.s, p.x, p.y + drift + (1 - k) * 40, 0.75 + p.d * 0.4);
      ctx.restore();
    });
  });

  const move = easeInOutCubic(seg(t, 4.85, 5.35));
  withAlpha(1 - move * 0.6, () => {
    const y = lerp(H / 2 + 30, H / 2 - 70, move);
    const s = lerp(1, 0.62, move);
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.scale(s, s);
    revealLine("Je klanten googelen niet meer.", 0, 0, 3.6, t, { size: 104, weight: 800, ls: -3 });
    ctx.restore();
  });
  revealLine("Ze vragen het aan AI.", W / 2, H / 2 + 80, 5.05, t, { size: 136, weight: 800, ls: -4, gradient: ["#a5b4fc", "#c4b5fd", "#67e8f9"], stagger: 0.09 });
  ctx.restore();
}

// ---------- Scene 3: the AI answer (6.6 – 12) ----------
const QUESTION = "Wat is de beste fysiotherapeut in Utrecht?";
const ANSWERS = [
  { n: "FysioPlus Centrum", r: "4,9" },
  { n: "Utrecht Beweegt", r: "4,8" },
  { n: "Praktijk De Brug", r: "4,7" },
];
function sceneChat(t) {
  const a = win(t, 6.6, 7.0, 11.55, 12.0);
  if (a <= 0) return;
  const enter = easeOutExpo(seg(t, 6.6, 7.3));
  const exit = easeInCubic(seg(t, 11.55, 12.0));
  const push = easeInOutCubic(seg(t, 9.6, 11.6)) * 0.05;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H / 2 + 40);
  const s = lerp(0.82, 1, enter) + push - exit * 0.12;
  ctx.scale(s, s);
  ctx.translate(-W / 2, -H / 2 - 40);
  if (exit > 0) ctx.filter = `blur(${exit * 12}px)`;

  const cw = 1180, ch = 640;
  const x = (W - cw) / 2, y = 270;
  glassCard(x, y, cw, ch, 32, { glow: "rgba(99,102,241,0.35)" });
  // window chrome
  ["#f87171", "#fbbf24", "#34d399"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.globalAlpha = a * 0.8;
    ctx.beginPath();
    ctx.arc(x + 40 + i * 26, y + 38, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = a;
  text("AI-assistent", x + cw / 2, y + 46, { size: 22, weight: 600, color: C.faint, align: "center" });
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 76, cw, 1);

  // User bubble (typed)
  const typeK = seg(t, 7.0, 8.4);
  const shown = QUESTION.slice(0, Math.round(QUESTION.length * typeK));
  const qSize = 30;
  const fullW = measure(QUESTION, qSize, 500);
  const bw = fullW + 64, bh = 74;
  const bx = x + cw - 48 - bw, by = y + 112;
  withAlpha(easeOutCubic(seg(t, 6.9, 7.15)), () => {
    rr(bx, by, bw, bh, [26, 26, 8, 26]);
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, C.indigoDeep);
    g.addColorStop(1, "#7c3aed");
    ctx.fillStyle = g;
    ctx.fill();
    text(shown, bx + 32, by + 47, { size: qSize, weight: 500 });
    if (typeK < 1 && Math.floor(t * 3) % 2 === 0) {
      const cx2 = bx + 32 + measure(shown, qSize, 500) + 3;
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx2, by + 22, 3, 34);
    }
  });

  // Assistant reply
  const ax = x + 48, ay = y + 230;
  withAlpha(easeOutCubic(seg(t, 8.45, 8.7)), () => {
    ctx.beginPath();
    ctx.arc(ax + 26, ay + 26, 26, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(ax, ay, ax + 52, ay + 52);
    g.addColorStop(0, "#22d3ee");
    g.addColorStop(1, "#6366f1");
    ctx.fillStyle = g;
    ctx.fill();
    sparkle(ax + 26, ay + 26, 14, "#fff");
  });
  // typing dots
  const dotsA = win(t, 8.5, 8.6, 9.0, 9.1);
  withAlpha(dotsA, () => {
    for (let i = 0; i < 3; i++) {
      const b = Math.sin(t * 12 - i * 0.9) * 5;
      ctx.fillStyle = C.muted;
      ctx.beginPath();
      ctx.arc(ax + 90 + i * 22, ay + 26 + b, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  withAlpha(easeOutCubic(seg(t, 9.05, 9.35)), () => {
    text("Dit zijn de best beoordeelde fysiotherapeuten in Utrecht:", ax + 80, ay + 36, { size: 28, weight: 500, color: "#e2e8f0" });
  });
  const scanK = seg(t, 10.0, 10.75);
  ANSWERS.forEach((item, i) => {
    const k = easeOutCubic(seg(t, 9.3 + i * 0.16, 9.75 + i * 0.16));
    const iy = ay + 72 + i * 74;
    withAlpha(k, () => {
      const ix = ax + 80 + (1 - k) * 30;
      rr(ix, iy, 760, 60, 14);
      ctx.fillStyle = "rgba(148,163,184,0.07)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ix + 32, iy + 30, 16, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(129,140,248,0.22)";
      ctx.fill();
      text(String(i + 1), ix + 32, iy + 38, { size: 20, weight: 700, color: "#c7d2fe", align: "center" });
      text(item.n, ix + 66, iy + 39, { size: 27, weight: 600 });
      text(`★ ${item.r}`, ix + 740, iy + 39, { size: 22, weight: 600, color: C.amber, align: "right" });
      // scanner highlight
      const local = clamp(scanK * 3 - i);
      if (local > 0 && local < 1) {
        const g = ctx.createLinearGradient(ix, 0, ix + 760, 0);
        const p = local;
        g.addColorStop(clamp(p - 0.15), "rgba(34,211,238,0)");
        g.addColorStop(p, "rgba(34,211,238,0.35)");
        g.addColorStop(clamp(p + 0.02), "rgba(34,211,238,0)");
        rr(ix, iy, 760, 60, 14);
        ctx.fillStyle = g;
        ctx.fill();
      }
    });
  });
  // Not-mentioned badge
  const nb = easeOutBack(seg(t, 10.75, 11.1));
  if (nb > 0) {
    const bx2 = ax + 80, by2 = ay + 72 + 3 * 74 + 18;
    const label = "Jouw bedrijf: niet genoemd";
    const w2 = measure(label, 26, 700) + 92;
    ctx.save();
    ctx.translate(bx2 + w2 / 2, by2 + 30);
    ctx.scale(nb, nb);
    ctx.shadowColor = "rgba(248,113,113,0.6)";
    ctx.shadowBlur = 30;
    rr(-w2 / 2, -30, w2, 60, 30);
    ctx.fillStyle = "rgba(127,29,29,0.55)";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(248,113,113,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-w2 / 2 + 34, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = C.red;
    ctx.fill();
    cross(-w2 / 2 + 34, 0, 6, "#3f0d0d", 3.5);
    text(label, -w2 / 2 + 62, 9, { size: 26, weight: 700, color: "#fecaca" });
    ctx.restore();
  }
  ctx.filter = "none";
  ctx.restore();

  // Heading above the card
  withAlpha(a, () => {
    revealLine("Wordt jouw bedrijf genoemd?", W / 2, 180, 9.85, t, { size: 76, weight: 800, ls: -2 });
  });
}

// ---------- Scene 4: the scan (12 – 17) ----------
const QUESTIONS = [
  "Beste fysio in Utrecht?", "Fysiotherapeut voor rugklachten", "Sportfysio met avondopening",
  "Fysio vergoed door verzekering?", "Snel terecht bij een fysio", "Fysio met goede reviews",
  "Dry needling in Utrecht", "Fysio voor hardlopers", "Knieblessure behandelen",
  "Fysiotherapie aan huis", "Beste praktijk Utrecht-Oost", "Fysio zonder wachtlijst",
];
function bez(p0, p1, p2, p3, k) {
  const u = 1 - k;
  return [
    u * u * u * p0[0] + 3 * u * u * k * p1[0] + 3 * u * k * k * p2[0] + k * k * k * p3[0],
    u * u * u * p0[1] + 3 * u * u * k * p1[1] + 3 * u * k * k * p2[1] + k * k * k * p3[1],
  ];
}
function counter(label, value, x, y, k, suffix = "") {
  withAlpha(easeOutCubic(clamp(k * 4)), () => {
    text(Math.round(value * easeOutCubic(k)).toLocaleString("nl-NL") + suffix, x, y, { size: 58, weight: 800, align: "center", ls: -1 });
    text(label, x, y + 40, { size: 22, weight: 500, color: C.muted, align: "center" });
  });
}
function sceneScan(t) {
  const a = win(t, 11.95, 12.35, 16.55, 17.0);
  if (a <= 0) return;
  const exit = easeInCubic(seg(t, 16.55, 17.0));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H / 2);
  const s = lerp(1.08, 1, easeOutExpo(seg(t, 12, 12.8))) - exit * 0.06;
  ctx.scale(s, s);
  ctx.translate(-W / 2, -H / 2);

  revealLine("Analyty stelt honderden echte klantvragen", W / 2, 150, 12.1, t, { size: 64, weight: 800, ls: -2, stagger: 0.05 });
  withAlpha(easeOutCubic(seg(t, 12.55, 13.0)), () => {
    text("aan ChatGPT, Gemini en Claude. Automatisch.", W / 2, 212, { size: 32, weight: 500, color: C.muted, align: "center" });
  });

  const hub = [880, 560];
  const provY = [380, 560, 740];
  const provX = 1330;

  // Question column (scrolling)
  const colX = 150, colW = 470, top = 280, bottom = 850;
  const scroll = (t - 12) * 95;
  ctx.save();
  ctx.beginPath();
  ctx.rect(colX - 20, top, colW + 40, bottom - top);
  ctx.clip();
  for (let i = 0; i < 16; i++) {
    const qy = bottom + 20 - ((i * 82 + scroll + 200) % (16 * 82)) + 0;
    if (qy < top - 60 || qy > bottom + 60) continue;
    const appear = easeOutCubic(seg(t, 12.25 + i * 0.05, 12.8 + i * 0.05));
    const edge = Math.min(seg(qy, top - 20, top + 90), 1 - seg(qy, bottom - 90, bottom + 20));
    const near = 1 - clamp(Math.abs(qy - hub[1]) / 220);
    withAlpha(appear * edge, () => {
      const q = QUESTIONS[i % QUESTIONS.length];
      const pw = colW;
      rr(colX + (1 - appear) * -40, qy - 30, pw, 60, 16);
      ctx.fillStyle = `rgba(30,36,72,${0.55 + near * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(129,140,248,${0.12 + near * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text("?", colX + 28, qy + 9, { size: 24, weight: 700, color: C.cyan, align: "center", family: MONO });
      text(q, colX + 54, qy + 9, { size: 23, weight: 500, color: near > 0.5 ? C.text : "#cbd5e1" });
    });
  }
  ctx.restore();

  // Connector from column into hub
  withAlpha(seg(t, 12.6, 13.0), () => {
    const g = ctx.createLinearGradient(colX + colW, 0, hub[0], 0);
    g.addColorStop(0, "rgba(129,140,248,0)");
    g.addColorStop(1, "rgba(129,140,248,0.7)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(colX + colW + 10, hub[1]);
    ctx.lineTo(hub[0] - 80, hub[1]);
    ctx.stroke();
    for (let j = 0; j < 4; j++) {
      const k = ((t * 1.6 + j / 4) % 1);
      const px = lerp(colX + colW + 10, hub[0] - 80, k);
      ctx.fillStyle = `rgba(165,180,252,${Math.sin(k * Math.PI)})`;
      ctx.beginPath();
      ctx.arc(px, hub[1], 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Curves hub -> providers with travelling pulses
  const links = provY.map((py) => [[hub[0] + 70, hub[1]], [hub[0] + 260, hub[1]], [provX - 220, py], [provX - 10, py]]);
  links.forEach((L, i) => {
    const lk = easeOutCubic(seg(t, 12.7 + i * 0.12, 13.3 + i * 0.12));
    if (lk <= 0) return;
    ctx.save();
    ctx.strokeStyle = "rgba(129,140,248,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([900 * lk, 900]);
    ctx.beginPath();
    ctx.moveTo(...L[0]);
    ctx.bezierCurveTo(...L[1], ...L[2], ...L[3]);
    ctx.stroke();
    ctx.restore();
    if (t < 13.1) return;
    ctx.globalCompositeOperation = "lighter";
    for (let j = 0; j < 5; j++) {
      // outgoing (indigo)
      let k = ((t - 13.1) * 0.9 + j / 5 + i * 0.13) % 1;
      let [px, py] = bez(...L, k);
      ctx.fillStyle = `rgba(165,180,252,${Math.sin(k * Math.PI)})`;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      // returning (provider colour)
      k = 1 - (((t - 13.4) * 0.75 + j / 5 + i * 0.29) % 1);
      if (t > 13.4) {
        [px, py] = bez(...L, k);
        ctx.fillStyle = PROVIDERS[i].color;
        ctx.globalAlpha = a * Math.sin(k * Math.PI) * 0.9;
        ctx.beginPath(); ctx.arc(px, py + 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a;
      }
    }
    ctx.globalCompositeOperation = "source-over";
  });

  // Hub
  const hk = easeOutBack(seg(t, 12.3, 12.75));
  if (hk > 0) {
    ctx.save();
    ctx.translate(...hub);
    ctx.scale(hk, hk);
    ctx.strokeStyle = "rgba(129,140,248,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 12]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.arc(0, 0, 96, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    const pulse = (t * 1.2) % 1;
    ctx.strokeStyle = `rgba(129,140,248,${0.5 * (1 - pulse)})`;
    ctx.beginPath(); ctx.arc(0, 0, 70 + pulse * 70, 0, Math.PI * 2); ctx.stroke();
    logo(0, 0, 112);
    ctx.restore();
  }

  // Provider cards
  PROVIDERS.forEach((p, i) => {
    const k = easeOutCubic(seg(t, 12.8 + i * 0.12, 13.3 + i * 0.12));
    if (k <= 0) return;
    const cx = provX + (1 - k) * 60, cy = provY[i];
    const w = 500, h = 128;
    withAlpha(k, () => {
      glassCard(cx, cy - h / 2, w, h, 24, { fill: C.cardHi });
      ctx.beginPath();
      ctx.arc(cx + 50, cy - 14, 20, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      sparkle(cx + 50, cy - 14, 10, "rgba(255,255,255,0.9)");
      text(p.name, cx + 86, cy - 4, { size: 30, weight: 700 });
      const prog = easeInOutCubic(seg(t, 13.2 + i * 0.25, 15.9 + i * 0.2));
      const done = prog >= 1;
      text(done ? "Klaar" : "Antwoorden ophalen…", cx + w - 30, cy - 4, { size: 19, weight: 600, color: done ? C.green : C.muted, align: "right" });
      rr(cx + 30, cy + 26, w - 60, 10, 5);
      ctx.fillStyle = "rgba(148,163,184,0.15)";
      ctx.fill();
      if (prog > 0) {
        rr(cx + 30, cy + 26, (w - 60) * prog, 10, 5);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    });
  });

  // Counters
  const ck = seg(t, 13.0, 16.2);
  counter("klantvragen", 248, 560, 950, ck);
  counter("AI-modellen", 3, 960, 950, seg(t, 13.0, 13.6));
  counter("antwoorden geanalyseerd", 744, 1360, 950, ck);
  ctx.restore();
}

// ---------- Scene 5+6: dashboard and recommendations (17 – 27.2) ----------
const RECS = [
  { t: "Voeg FAQ-schema toe aan je dienstpagina's", s: "AI-modellen citeren gestructureerde antwoorden vaker", tag: "Hoge impact", c: C.amber },
  { t: "Verzamel reviews op platforms die AI raadpleegt", s: "Concurrenten worden genoemd om hun reviewprofiel", tag: "Hoge impact", c: C.amber },
  { t: "Publiceer een vergelijkingspagina", s: "Beantwoord “wie is de beste…” vragen zelf", tag: "Snelle winst", c: "#a5b4fc" },
];
const CHECKS = [24.0, 24.7, 25.4];
function gauge(cx, cy, r, value, k, colorMix) {
  const start = Math.PI * 0.75, sweep = Math.PI * 1.5;
  ctx.lineCap = "round";
  ctx.lineWidth = 28;
  ctx.strokeStyle = "rgba(148,163,184,0.12)";
  ctx.beginPath(); ctx.arc(cx, cy, r, start, start + sweep); ctx.stroke();
  // ticks
  for (let i = 0; i <= 20; i++) {
    const a = start + (sweep * i) / 20;
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 34), cy + Math.sin(a) * (r - 34));
    ctx.lineTo(cx + Math.cos(a) * (r - (i % 5 ? 40 : 46)), cy + Math.sin(a) * (r - (i % 5 ? 40 : 46)));
    ctx.stroke();
  }
  const end = start + (sweep * value) / 100;
  if (value > 0.2) {
    const g = ctx.createConicGradient(start - 0.2, cx, cy);
    const c1 = colorMix > 0.5 ? "#10b981" : C.indigo;
    const c2 = colorMix > 0.5 ? "#67e8f9" : "#22d3ee";
    g.addColorStop(0, c1);
    g.addColorStop(0.75, c2);
    g.addColorStop(1, c1);
    ctx.save();
    ctx.shadowColor = colorMix > 0.5 ? "rgba(52,211,153,0.7)" : "rgba(99,102,241,0.7)";
    ctx.shadowBlur = 30;
    ctx.strokeStyle = g;
    ctx.lineWidth = 28;
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
    ctx.restore();
    // head dot
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx + Math.cos(end) * r, cy + Math.sin(end) * r, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
}
function sceneDashboard(t) {
  const a = win(t, 16.9, 17.4, 26.7, 27.2);
  if (a <= 0) return;
  const enter = easeOutExpo(seg(t, 16.9, 17.8));
  const exit = easeInCubic(seg(t, 26.7, 27.2));
  const drift = (t - 17) * 0.004;

  // Headings
  withAlpha(a * (1 - seg(t, 22.3, 22.6)), () => {
    revealLine("Zie precies hoe zichtbaar je bent.", W / 2, 160, 17.15, t, { size: 72, weight: 800, ls: -2, stagger: 0.06 });
  });
  withAlpha(a, () => {
    revealLine("En wat je eraan kunt doen.", W / 2, 160, 22.55, t, { size: 72, weight: 800, ls: -2, stagger: 0.06, gradient: ["#ffffff", "#a7f3d0", "#67e8f9"] });
  });

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H / 2 + 60);
  const s = lerp(0.9, 1, enter) + drift - exit * 0.1;
  ctx.scale(s, s);
  ctx.translate(-W / 2, -H / 2 - 60 + (1 - enter) * 60);
  if (exit > 0) ctx.filter = `blur(${exit * 10}px)`;

  const px = 170, py = 230, pw = 1580, ph = 740;
  glassCard(px, py, pw, ph, 32, { glow: "rgba(99,102,241,0.28)" });
  // Top bar
  logo(px + 52, py + 46, 40, { glow: 0.3 });
  text("GEO-rapport", px + 88, py + 56, { size: 26, weight: 700 });
  text("·  Jouw bedrijf  ·  Fysiotherapie, Utrecht", px + 100 + measure("GEO-rapport", 26, 700), py + 56, { size: 22, weight: 500, color: C.muted });
  const pillK = easeOutBack(seg(t, 17.6, 17.95));
  if (pillK > 0) {
    ctx.save();
    ctx.translate(px + pw - 130, py + 47);
    ctx.scale(pillK, pillK);
    rr(-100, -21, 200, 42, 21);
    ctx.fillStyle = "rgba(16,185,129,0.15)";
    ctx.fill();
    ctx.beginPath(); ctx.arc(-74, 0, 6, 0, Math.PI * 2); ctx.fillStyle = C.green; ctx.fill();
    text("Scan voltooid", -60, 7, { size: 19, weight: 600, color: "#6ee7b7" });
    ctx.restore();
  }
  ctx.fillStyle = C.border;
  ctx.fillRect(px, py + 92, pw, 1);
  ctx.fillRect(px + 600, py + 92, 1, ph - 92);

  // Gauge with score
  const g1 = easeOutCubic(seg(t, 17.5, 19.3)) * 64;
  const steps = CHECKS.map((c, i) => easeOutCubic(seg(t, c + 0.1, c + 0.7)) * [8, 8, 7][i]);
  const score = g1 + steps.reduce((x, y) => x + y, 0);
  const green = seg(t, 24.0, 25.8);
  const gcx = px + 300, gcy = py + 400;
  gauge(gcx, gcy, 200, score, 1, green);
  text(String(Math.round(score)), gcx, gcy + 40, { size: 128, weight: 800, align: "center", ls: -4 });
  text("/ 100", gcx, gcy + 86, { size: 24, weight: 600, color: C.muted, align: "center" });
  text("GEO-SCORE", gcx, gcy + 210, { size: 22, weight: 700, color: C.muted, align: "center", ls: 5 });
  const dk = easeOutBack(seg(t, 26.0, 26.35));
  if (dk > 0) {
    ctx.save();
    ctx.translate(gcx, gcy - 108);
    ctx.scale(dk, dk);
    ctx.shadowColor = "rgba(52,211,153,0.7)";
    ctx.shadowBlur = 24;
    rr(-62, -24, 124, 48, 24);
    ctx.fillStyle = "#065f46";
    ctx.fill();
    ctx.shadowBlur = 0;
    text("▲ +23", 0, 9, { size: 24, weight: 800, color: "#6ee7b7", align: "center" });
    ctx.restore();
  }

  const rx = px + 660, rw = pw - 720;
  // Phase A: provider bars + KPI tiles
  const outA = easeInCubic(seg(t, 22.2, 22.7));
  withAlpha(1 - outA, () => {
    ctx.save();
    ctx.translate(-outA * 80, 0);
    text("Zichtbaarheid per AI-model", rx, py + 160, { size: 26, weight: 700 });
    text("% van de antwoorden waarin je genoemd wordt", rx + rw, py + 160, { size: 20, weight: 500, color: C.faint, align: "right" });
    PROVIDERS.forEach((p, i) => {
      const k = easeOutCubic(seg(t, 17.9 + i * 0.18, 19.4 + i * 0.18));
      const by = py + 210 + i * 78;
      withAlpha(clamp(k * 3), () => {
        ctx.beginPath(); ctx.arc(rx + 10, by + 18, 9, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        text(p.name, rx + 32, by + 27, { size: 25, weight: 600 });
        const bx = rx + 190, bw = rw - 300;
        rr(bx, by + 6, bw, 24, 12);
        ctx.fillStyle = "rgba(148,163,184,0.12)";
        ctx.fill();
        rr(bx, by + 6, bw * (p.value / 100) * k, 24, 12);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, p.color);
        g.addColorStop(1, "#c7d2fe");
        ctx.fillStyle = g;
        ctx.fill();
        text(`${Math.round(p.value * k)}%`, rx + rw, by + 28, { size: 26, weight: 700, align: "right", family: SANS });
      });
    });
    const tiles = [
      { l: "Vermeld in", v: 58, f: (v) => `${Math.round(v)}%`, s: "van alle AI-antwoorden" },
      { l: "Gem. positie", v: 2.8, f: (v) => `#${v.toFixed(1).replace(".", ",")}`, s: "als je genoemd wordt" },
      { l: "Concurrenten", v: 7, f: (v) => `${Math.round(v)}`, s: "vaker genoemd dan jij", warn: true },
    ];
    const tw = (rw - 2 * 28) / 3;
    tiles.forEach((tile, i) => {
      const k = easeOutCubic(seg(t, 19.0 + i * 0.2, 19.8 + i * 0.2));
      if (k <= 0) return;
      const tx = rx + i * (tw + 28), ty = py + 470 + (1 - k) * 30;
      withAlpha(k, () => {
        rr(tx, ty, tw, 210, 22);
        ctx.fillStyle = "rgba(148,163,184,0.07)";
        ctx.fill();
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        text(tile.l.toUpperCase(), tx + 28, ty + 46, { size: 18, weight: 700, color: C.muted, ls: 2.5 });
        const vk = easeOutCubic(seg(t, 19.2 + i * 0.2, 20.6 + i * 0.2));
        const v = tile.l === "Gem. positie" ? lerp(9, tile.v, vk) : tile.v * vk;
        text(tile.f(v), tx + 26, ty + 128, { size: 70, weight: 800, color: tile.warn ? "#fda4af" : C.text, ls: -2 });
        text(tile.s, tx + 28, ty + 172, { size: 20, weight: 500, color: C.faint });
      });
    });
    ctx.restore();
  });

  // Phase B: recommendations
  const inB = easeOutCubic(seg(t, 22.6, 23.2));
  withAlpha(inB, () => {
    text("Aanbevelingen", rx + (1 - inB) * 60, py + 160, { size: 26, weight: 700 });
    text("op basis van 744 AI-antwoorden", rx + rw, py + 160, { size: 20, weight: 500, color: C.faint, align: "right" });
  });
  RECS.forEach((r, i) => {
    const k = easeOutExpo(seg(t, 22.75 + i * 0.15, 23.5 + i * 0.15));
    if (k <= 0) return;
    const cy = py + 200 + i * 162;
    const cx = rx + (1 - k) * 120;
    const done = easeOutBack(seg(t, CHECKS[i], CHECKS[i] + 0.3));
    const doneLin = seg(t, CHECKS[i], CHECKS[i] + 0.3);
    withAlpha(k, () => {
      ctx.save();
      if (doneLin > 0) { ctx.shadowColor = `rgba(52,211,153,${0.35 * (1 - seg(t, CHECKS[i] + 0.3, CHECKS[i] + 1.2))})`; ctx.shadowBlur = 40; }
      rr(cx, cy, rw, 138, 22);
      ctx.fillStyle = doneLin > 0 ? `rgba(16,${lerp(30, 70, doneLin) | 0},${lerp(60, 55, doneLin) | 0},0.55)` : "rgba(148,163,184,0.07)";
      ctx.fill();
      ctx.restore();
      rr(cx, cy, rw, 138, 22);
      ctx.strokeStyle = doneLin > 0 ? `rgba(52,211,153,${0.2 + 0.4 * doneLin})` : C.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // checkbox
      const bx = cx + 54, by = cy + 69;
      ctx.beginPath(); ctx.arc(bx, by, 22, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(148,163,184,0.45)"; ctx.lineWidth = 2.5; ctx.stroke();
      if (done > 0) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(done, done);
        ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.fillStyle = C.green; ctx.fill();
        ctx.restore();
        check(bx, by, 18, seg(t, CHECKS[i] + 0.08, CHECKS[i] + 0.32), "#052e1f", 4.5);
      }
      const tw2 = measure(r.tag.toUpperCase(), 15, 700, 1.5) + 28;
      rr(cx + 100, cy + 20, tw2, 30, 15);
      ctx.fillStyle = r.c === C.amber ? "rgba(251,191,36,0.14)" : "rgba(129,140,248,0.16)";
      ctx.fill();
      text(r.tag.toUpperCase(), cx + 100 + tw2 / 2, cy + 40, { size: 15, weight: 700, color: r.c, align: "center", ls: 1.5 });
      text(r.t, cx + 100, cy + 87, { size: 27, weight: 700 });
      text(r.s, cx + 100, cy + 120, { size: 21, weight: 500, color: C.muted });
    });
  });
  ctx.filter = "none";
  ctx.restore();
}

// ---------- Scene 7: outro (27 – 30) ----------
function sceneOutro(t) {
  if (t < 26.95) return;
  const cx = W / 2;
  const lk = easeOutBack(seg(t, 27.05, 27.5));
  // shockwave
  const wv = seg(t, 27.1, 28.2);
  if (wv > 0 && wv < 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(165,180,252,${0.55 * (1 - wv)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, 330, 70 + easeOutCubic(wv) * 900, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (lk > 0) {
    ctx.save();
    ctx.translate(cx, 330);
    ctx.scale(lk, lk);
    const glowPulse = 1 + Math.sin(t * 3) * 0.15;
    logo(0, 0, 150, { glow: glowPulse });
    ctx.restore();
  }
  revealLine("Word gevonden door AI.", cx, 560, 27.3, t, { size: 112, weight: 800, ls: -4, stagger: 0.08, gradient: ["#ffffff", "#ffffff", "#c7d2fe", "#67e8f9"] });

  const bk = easeOutBack(seg(t, 27.9, 28.35));
  if (bk > 0) {
    const label = "Start je gratis AI-scan";
    const bw = measure(label, 34, 700) + 150, bh = 92;
    ctx.save();
    ctx.translate(cx, 700);
    ctx.scale(bk, bk);
    const pulse = 0.5 + 0.5 * Math.sin((t - 28.3) * 4);
    ctx.shadowColor = `rgba(99,102,241,${0.55 + 0.3 * pulse})`;
    ctx.shadowBlur = 50 + 20 * pulse;
    rr(-bw / 2, -bh / 2, bw, bh, bh / 2);
    const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    g.addColorStop(0, "#6366f1");
    g.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    // shimmer sweep
    const sh = ((t - 28.4) % 1.6) / 1.6;
    if (t > 28.4) {
      ctx.save();
      rr(-bw / 2, -bh / 2, bw, bh, bh / 2);
      ctx.clip();
      const sx = -bw / 2 - 200 + sh * (bw + 400);
      const sg = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(0.5, "rgba(255,255,255,0.35)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    }
    text(label, -24, 12, { size: 34, weight: 700, align: "center" });
    // arrow
    const ax = bw / 2 - 62 + Math.sin(t * 5) * 4;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ax - 14, 0); ctx.lineTo(ax + 12, 0);
    ctx.moveTo(ax + 2, -10); ctx.lineTo(ax + 12, 0); ctx.lineTo(ax + 2, 10);
    ctx.stroke();
    ctx.restore();
  }
  withAlpha(easeOutCubic(seg(t, 28.3, 28.8)), () => {
    text("analyty.com", cx, 828 + (1 - easeOutCubic(seg(t, 28.3, 28.8))) * 16, { size: 38, weight: 600, color: "#c7d2fe", align: "center", ls: 3 });
  });
}

// ---------- main ----------
function renderAt(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  background(t);
  sceneIntro(t);
  sceneShift(t);
  sceneChat(t);
  sceneScan(t);
  sceneDashboard(t);
  sceneOutro(t);
  postFx(t);
}
window.renderAt = renderAt;
window.DURATION = DURATION;
window.ready = document.fonts.load("800 40px Inter").then(() => document.fonts.load("500 20px 'JetBrains Mono'")).then(() => document.fonts.ready);

// Realtime preview (skipped when the renderer drives frames with ?render).
if (!location.search.includes("render")) {
  let start = null, paused = false, pauseAt = 0;
  const audio = new Audio("music.wav");
  window.ready.then(() => renderAt(0));
  const loop = (now) => {
    if (start !== null && !paused) {
      let t = (now - start) / 1000;
      if (!audio.paused) t = audio.currentTime;
      if (t >= DURATION) { t = DURATION; start = null; }
      renderAt(Math.min(t, DURATION - 1e-3));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.addEventListener("click", () => {
    paused = false;
    start = performance.now();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  });
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || start === null) return;
    paused = !paused;
    if (paused) { pauseAt = performance.now(); audio.pause(); }
    else { start += performance.now() - pauseAt; audio.play().catch(() => {}); }
  });
} else {
  document.body.classList.add("render");
}
