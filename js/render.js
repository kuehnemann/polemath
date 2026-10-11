// Projektion, Linien mit Glow, Komposition des 1080×1920-Frames.
import { curve, GREY, CYAN } from './constructs.js';

export const OUT_W = 1080, OUT_H = 1920, VIDEO_H = 1080;
export const LAYOUTS = {
  split:   { panelY: VIDEO_H, panelH: OUT_H - VIDEO_H, reserve: 290, curveY: VIDEO_H + 20 },
  overlay: { panelY: OUT_H - 1300, panelH: 1300, reserve: 390, curveY: OUT_H - 330 },
};

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const FONT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Roboto, sans-serif';

export class ArtRenderer {
  constructor(w, h, reserve, scale) {
    const avail = h - reserve;
    Object.assign(this, { w, h, scale, cy: 60 + avail / 2, f: 2.2 * avail });
    this.art = canvas(Math.round(w * scale), Math.round(h * scale));
    this.ctx = this.art.getContext('2d');
    // Glow: Kaskade aus verkleinerten Kopien, beim Hochskalieren entsteht die Unschärfe
    this.glow = [2, 4, 12].map(d => canvas(Math.max(1, Math.round(this.art.width / d)), Math.max(1, Math.round(this.art.height / d))));
  }

  project(P, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return P.map(([X, Y, Z]) => {
      const x = X * cy - Y * sy, y = X * sy + Y * cy;
      const y2 = y * cp - Z * sp, z2 = y * sp + Z * cp, d = 6.0 + y2;
      return [this.w / 2 + this.f * x / d, this.cy - this.f * z2 / d, d];
    });
  }

  draw(curves, yaw, pitch, step = 6) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.art.width, this.art.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pole = curve([[0, 0, -1.5], [0, 0, 1.5]], GREY, GREY, 3, 0.6);
    for (const c of [pole, ...curves]) {
      const uv = this.project(c.pts, yaw, pitch), n = uv.length;
      ctx.lineWidth = c.width;
      for (let s = 0; s < n - 1; s += step) {
        const e = Math.min(s + step, n - 1);
        let a = 0;
        for (let k = s; k <= e; k++) {
          const base = Array.isArray(c.alpha) ? c.alpha[k] : c.alpha;
          const d = uv[k][2], fade = d <= 4.3 ? 1 : d >= 7.7 ? 0.35 : 1 - 0.65 * (d - 4.3) / 3.4;
          a += base * fade;
        }
        a /= e - s + 1;
        const t = (s + step / 2) / Math.max(n - 1, 1);
        const col = c.c0.map((v, j) => Math.round((v * (1 - t) + c.c1[j] * t) * a));
        ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.beginPath();
        ctx.moveTo(uv[s][0], uv[s][1]);
        for (let k = s + 1; k <= e; k++) ctx.lineTo(uv[k][0], uv[k][1]);
        ctx.stroke();
      }
    }
    let src = this.art;
    for (const g of this.glow) {
      const gc = g.getContext('2d');
      gc.imageSmoothingQuality = 'high';
      gc.drawImage(src, 0, 0, g.width, g.height);
      src = g;
    }
  }

  // Art + Glow additiv auf den Ziel-Kontext (physische Pixel) legen
  composite(ctx, y) {
    const W = this.art.width, H = this.art.height, Y = Math.round(y * this.scale);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.art, 0, Y, W, H);
    ctx.globalAlpha = 0.9; ctx.drawImage(this.glow[1], 0, Y, W, H);
    ctx.globalAlpha = 0.8; ctx.drawImage(this.glow[2], 0, Y, W, H);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Statische Textebene: Credit, Name, Formel, Zuordnung, Bewegungskurve
export function buildTextLayer(construct, credit, layoutKey, energy, scale) {
  const L = LAYOUTS[layoutKey];
  const c = canvas(Math.round(OUT_W * scale), Math.round(OUT_H * scale)), ctx = c.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'top';

  const label = `Video: ${credit}`;
  ctx.font = `700 38px ${FONT}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, 36, 48, tw + 44, 66, 33); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(label, 58, 61);

  const yT = OUT_H - 250;
  if (layoutKey === 'overlay') { ctx.fillStyle = 'rgba(0,0,0,0.43)'; ctx.fillRect(0, yT - 30, OUT_W, OUT_H); }
  ctx.fillStyle = '#fff'; ctx.font = `700 46px ${FONT}`; ctx.fillText(construct.name, 48, yT);
  ctx.fillStyle = 'rgb(225,225,235)'; ctx.font = `400 27px ${FONT}`; ctx.fillText(construct.formula, 48, yT + 70, OUT_W - 96);
  ctx.fillStyle = 'rgb(170,170,185)'; ctx.font = `400 25px ${FONT}`; ctx.fillText(construct.mapping, 48, yT + 120, OUT_W - 96);

  const pts = curvePoints(energy, L.curveY);
  ctx.strokeStyle = 'rgba(255,255,255,0.43)'; ctx.lineWidth = 2;
  ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.fillStyle = 'rgba(170,170,185,0.8)'; ctx.font = `400 20px ${FONT}`; ctx.fillText('Bewegungsenergie', 48, L.curveY - 6);
  return { canvas: c, pts };
}

function curvePoints(energy, y0) {
  const n = energy.length, step = Math.max(1, Math.floor(n / 600)), pts = [];
  for (let i = 0; i < n; i += step) pts.push([48 + (OUT_W - 96) * i / (n - 1), y0 + 50 - energy[i] * 46]);
  return pts;
}

function drawCover(ctx, video, x, y, tw, th, fx, fy) {
  const vw = video.videoWidth, vh = video.videoHeight, s = Math.max(tw / vw, th / vh);
  const sw = tw / s, sh = th / s;
  const sx = Math.min(Math.max(fx * vw - sw / 2, 0), vw - sw), sy = Math.min(Math.max(fy * vh - sh / 2, 0), vh - sh);
  ctx.drawImage(video, sx, sy, sw, sh, x, y, tw, th);
}

export function composeFrame(ctx, scale, video, art, text, m, i, layoutKey) {
  const L = LAYOUTS[layoutKey];
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, OUT_W, OUT_H);
  ctx.imageSmoothingQuality = 'high';
  if (layoutKey === 'split') {
    drawCover(ctx, video, 0, 0, OUT_W, VIDEO_H, m.cx[i], m.cy[i]);
  } else {
    drawCover(ctx, video, 0, 0, OUT_W, OUT_H, m.cx[i], m.cy[i]);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, OUT_W, OUT_H);
  }
  art.composite(ctx, L.panelY);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(text.canvas, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (layoutKey === 'split') {
    ctx.strokeStyle = 'rgb(70,60,60)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, VIDEO_H); ctx.lineTo(OUT_W, VIDEO_H); ctx.stroke();
  }
  const k = Math.min(text.pts.length - 1, Math.round(i / (m.n - 1) * (text.pts.length - 1)));
  ctx.fillStyle = `rgb(${CYAN.join(',')})`;
  ctx.beginPath(); ctx.arc(text.pts[k][0], text.pts[k][1], 7, 0, Math.PI * 2); ctx.fill();
}
