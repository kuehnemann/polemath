// Bewegungsanalyse im Browser: Block-Matching-Fluss auf einem verkleinerten Graustufenbild.
// Entspricht den Merkmalen der Python-Pipeline (Energie, Schwerpunkt, Rotation, Auf/Ab, Spannweite).

export const FPS = 30;              // internes Raster für alle Steuerkurven
const AW = 128;                     // Analysebreite in px
const B = 8;                        // Blockgröße
const R = 4;                        // Suchradius

function toGray(rgba, n) {
  const g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  return g;
}

function boxBlur(src, w, h) {                       // 3×3, separierbar
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    tmp[i] = (src[i - (x > 0)] + src[i] + src[i + (x < w - 1)]) / 3;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    out[i] = (tmp[i - (y > 0) * w] + tmp[i] + tmp[i + (y < h - 1) * w]) / 3;
  }
  return out;
}

function sad(prev, cur, w, bx, by, dx, dy) {
  let s = 0;
  for (let y = 0; y < B; y++) {
    const rc = (by + y) * w + bx, rp = (by + y - dy) * w + bx - dx;
    for (let x = 0; x < B; x++) s += Math.abs(cur[rc + x] - prev[rp + x]);
  }
  return s;
}

function subpixel(m, c, p) {                          // Parabel durch drei SAD-Werte
  const d = m - 2 * c + p;
  return d > 1e-6 ? Math.max(-0.5, Math.min(0.5, 0.5 * (m - p) / d)) : 0;
}

function blockFlow(prev, cur, w, h) {
  const vecs = [], S = 2 * R + 1, grid = new Float32Array(S * S);
  for (let by = R; by + B + R <= h; by += B) {
    for (let bx = R; bx + B + R <= w; bx += B) {
      const sad0 = sad(prev, cur, w, bx, by, 0, 0);
      if (sad0 < B * B * 2) { vecs.push([bx + B / 2, by + B / 2, 0, 0]); continue; }
      let best = Infinity, bi = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const k = (dy + R) * S + dx + R, s = sad(prev, cur, w, bx, by, dx, dy);
        grid[k] = s;
        if (s < best) { best = s; bi = k; }
      }
      const iy = Math.floor(bi / S), ix = bi % S;
      let vx = ix - R, vy = iy - R;
      if (ix > 0 && ix < S - 1) vx += subpixel(grid[bi - 1], best, grid[bi + 1]);
      if (iy > 0 && iy < S - 1) vy += subpixel(grid[bi - S], best, grid[bi + S]);
      vecs.push([bx + B / 2, by + B / 2, vx, vy]);
    }
  }
  return vecs;
}

const EMPTY = { energy: 0, cx: NaN, cy: NaN, curl: 0, vy: 0, spread: NaN };

function features(vecs, w, h, scale) {
  const mags = vecs.map(v => Math.hypot(v[2], v[3]) * scale);
  const energy = mags.reduce((a, b) => a + b, 0) / mags.length;
  const thr = Math.max(0.2, 0.5 * percentile(mags, 95));
  let tot = 0, sx = 0, sy = 0;
  vecs.forEach((v, k) => { const m = mags[k] > thr ? mags[k] : 0; tot += m; sx += m * v[0]; sy += m * v[1]; });
  if (tot < 1e-6) return { ...EMPTY, energy };
  const cx = sx / tot, cy = sy / tot;
  let num = 0, den = 0, svy = 0, sr2 = 0;
  vecs.forEach((v, k) => {
    const m = mags[k] > thr ? mags[k] : 0;
    if (!m) return;
    const rx = v[0] - cx, ry = v[1] - cy, r2 = rx * rx + ry * ry;
    const fx = v[2] * scale, fy = v[3] * scale;
    num += m * (rx * fy - ry * fx); den += m * r2; svy += m * fy; sr2 += m * r2;
  });
  return { energy, cx: cx / w, cy: cy / h, curl: num / Math.max(den, 1e-6), vy: svy / tot / h, spread: Math.sqrt(sr2 / tot) / w };
}

// Spielt das Video stumm im Schnelldurchlauf ab und sammelt Merkmale.
export function analyzeVideo(video, onProgress, rate = 2) {
  const w = AW, h = Math.round(AW * video.videoHeight / video.videoWidth);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  const samples = [];
  let prev = null, prevT = null, done = false;

  return new Promise((resolve, reject) => {
    const grab = (t) => {
      if (done) return;
      ctx.drawImage(video, 0, 0, w, h);
      const gray = boxBlur(toGray(ctx.getImageData(0, 0, w, h).data, w * h), w, h);
      if (prev && t > prevT + 1e-4) {
        const dtFrames = (t - prevT) * FPS;          // Fluss auf „pro 1/30 s“ normieren
        samples.push({ t, ...features(blockFlow(prev, gray, w, h), w, h, 1 / dtFrames) });
      }
      prev = gray; prevT = t;
      onProgress(Math.min(1, t / video.duration));
    };
    const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const loop = (now, meta) => {
      if (done) return;
      grab(meta ? meta.mediaTime : video.currentTime);
      if (useRVFC) video.requestVideoFrameCallback(loop); else requestAnimationFrame(() => loop());
    };
    const finish = () => {
      if (done) return;
      done = true;
      video.pause();
      video.playbackRate = 1;
      video.currentTime = 0;
      if (!samples.length) return reject(new Error('Keine Bilder gelesen'));
      resolve({ samples, duration: video.duration, aspect: video.videoHeight / video.videoWidth });
    };
    video.addEventListener('ended', finish, { once: true });
    video.muted = true;
    video.playbackRate = rate;
    video.currentTime = 0;
    // Watchdog: kommt nach dem Start kein Bild, abbrechen und per Fingertipp neu starten
    const watchdog = setInterval(() => {
      if (done) return clearInterval(watchdog);
      if (prevT === null && performance.now() - started > 5000) {
        clearInterval(watchdog);
        done = true;
        video.pause();
        video.playbackRate = 1;
        reject(new Error('Video startet nicht automatisch'));
      }
    }, 500);
    const started = performance.now();
    const p = video.play();
    (p && p.then ? p : Promise.resolve()).then(() => loop()).catch(err => {
      done = true; clearInterval(watchdog); reject(err);
    });
  });
}

// ───────── Signalverarbeitung (wie scipy/numpy in der Python-Version) ─────────
export function percentile(arr, p) {
  const a = Array.from(arr).filter(v => !Number.isNaN(v)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const k = (a.length - 1) * p / 100, f = Math.floor(k), c = Math.min(f + 1, a.length - 1);
  return a[f] + (a[c] - a[f]) * (k - f);
}

export function gaussian(x, sigma) {
  sigma = Math.max(1, sigma);
  const r = Math.ceil(4 * sigma), ker = [];
  let s = 0;
  for (let k = -r; k <= r; k++) { const v = Math.exp(-k * k / (2 * sigma * sigma)); ker.push(v); s += v; }
  const n = x.length, out = new Float64Array(n);
  const idx = (i) => {                                // scipy „reflect“
    while (i < 0 || i >= n) i = i < 0 ? -i - 1 : 2 * n - i - 1;
    return i;
  };
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += x[idx(i + k)] * ker[k + r];
    out[i] = acc / s;
  }
  return out;
}

function fillNaN(x, def) {
  const ok = [];
  x.forEach((v, i) => { if (!Number.isNaN(v)) ok.push(i); });
  if (!ok.length) return Float64Array.from(x, () => def);
  return Float64Array.from(x, (v, i) => {
    if (!Number.isNaN(v)) return v;
    if (i <= ok[0]) return x[ok[0]];
    if (i >= ok[ok.length - 1]) return x[ok[ok.length - 1]];
    let j = 0; while (ok[j + 1] < i) j++;
    const a = ok[j], b = ok[j + 1];
    return x[a] + (x[b] - x[a]) * (i - a) / (b - a);
  });
}

function norm01(x) {
  const lo = percentile(x, 5), hi = percentile(x, 95);
  return Float64Array.from(x, v => Math.min(1, Math.max(0, (v - lo) / (hi - lo + 1e-9))));
}

function resample(samples, key, n) {                  // unregelmäßige Samples → 30-fps-Raster
  const ts = samples.map(s => s.t), vs = fillNaN(samples.map(s => s[key]), key === 'spread' ? 0.15 : 0.5);
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    while (j < ts.length - 2 && ts[j + 1] < t) j++;
    if (t <= ts[0]) out[i] = vs[0];
    else if (t >= ts[ts.length - 1]) out[i] = vs[vs.length - 1];
    else { const a = ts[j], b = ts[j + 1]; out[i] = vs[j] + (vs[j + 1] - vs[j]) * (t - a) / (b - a); }
  }
  return out;
}

export function buildMotion({ samples, duration, aspect = 16 / 9 }, spinSpeed = 0.5) {
  const n = Math.max(2, Math.floor(duration * FPS));
  if (samples.length < 2) samples = [{ t: 0, ...EMPTY }, { t: duration, ...EMPTY }];
  const raw = {};
  for (const k of ['energy', 'cx', 'cy', 'curl', 'vy', 'spread']) raw[k] = resample(samples, k, n);
  const s = (x, sec = 0.15) => gaussian(x, sec * FPS);

  const m = { n, raw };
  m.energy = norm01(s(raw.energy));
  m.cx = s(raw.cx, 1.0);
  m.cy = s(raw.cy, 1.0);
  m.spread = norm01(s(raw.spread));
  const curl = s(raw.curl, 0.3), c95 = percentile(curl.map(Math.abs), 95) + 1e-9;
  m.curl = curl.map(v => Math.max(-1, Math.min(1, v / c95)));
  const dir = s(raw.curl, 1.5).map(v => (v < 0 ? -1 : 1));
  m.phase = new Float64Array(n); m.psi = new Float64Array(n);
  const vy = s(raw.vy, 0.3);
  let ph = 0, ps = 0;
  for (let i = 0; i < n; i++) {
    ph += (0.6 * m.energy[i] + 0.4 * Math.abs(m.curl[i])) * dir[i] * (2 * Math.PI * spinSpeed / FPS);
    ps += vy[i] * 2 * Math.PI * 3;
    m.phase[i] = ph; m.psi[i] = ps;
  }
  const jerk = raw.energy.map((v, i) => Math.abs(v - raw.energy[Math.max(0, i - 1)]));
  m.chaos = norm01(s(jerk, 0.3));
  m.inverted = new Float64Array(n);                    // ohne Pose-Erkennung immer 0
  m.dir = dir;
  m.px = s(raw.cx, 0.1); m.py = s(raw.cy, 0.1);        // Schwerpunktsbahn für die Epizykel
  m.aspect = aspect;
  const dev = [];
  const tx = s(raw.cx, 1.5), ty = s(raw.cy, 1.5);
  for (let i = 0; i < n; i++) dev.push(Math.hypot(m.px[i] - tx[i], (m.py[i] - ty[i]) * aspect));
  m.pscale = percentile(dev, 95) + 1e-6;
  return m;
}

export function chooseConstruct(m) {
  const curl = gaussian(m.raw.curl, FPS * 0.3);
  const rot = curl.reduce((a, v) => a + Math.abs(v), 0) / curl.length * FPS;     // rad/s
  const e = gaussian(m.raw.energy, FPS * 0.3);
  const mean = e.reduce((a, v) => a + v, 0) / e.length;
  const sd = Math.sqrt(e.reduce((a, v) => a + (v - mean) ** 2, 0) / e.length);
  const cv = sd / (mean + 1e-9);
  // Anteil des Clips mit klar periodischer Drehung (Hilbert-Vertrauen > 0,5)
  const share = m.fourier ? m.fourier.weight.reduce((a, w) => a + (w > 0.5), 0) / m.n : 0;
  // Schwellen grob kalibriert (Block-Matching schätzt Drehung schwächer als Farnebäck)
  const kind = share > 0.5 ? 'dna' : rot > 0.25 ? 'knot' : cv > 0.5 ? 'lorenz' : 'harmonic';
  return { kind, rot, cv, share };
}
