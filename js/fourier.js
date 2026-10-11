// Fourier-Analyse der Drehbewegung.
//
// Idee: Dreht sie sich um die Stange, sieht die Kamera die Projektion einer Kreisbewegung,
// der waagerechte Bewegungsschwerpunkt schwingt also ungefähr wie x(t) ≈ R·sin φ(t).
//  • Kurzzeit-Fourier-Transformation (STFT) von x(t) → Spektrogramm und dominante Frequenz f₀(t)
//  • Analytisches Signal z = x + i·H[x] (Hilbert-Transformation über die FFT) → Zeiger, dessen
//    Winkel arg z(t) den Drehwinkel φ(t) rekonstruiert und dessen Betrag |z| zeigt, wie
//    eindeutig die Drehung gerade ist.
import { FPS, gaussian, percentile } from './analysis.js?v=3';

const F_MIN = 0.15, F_MAX = 3.0;          // Band für Drehbewegungen in Hz
export const SPEC_FMAX = 2.5;             // angezeigter Bereich im Spektrogramm
const WIN = 4 * FPS, HOP = 3, NFFT = 512;  // STFT: 4-s-Hann-Fenster, Auflösung 30/512 ≈ 0,06 Hz

export function fft(re, im, inverse = false) {           // iterativ, radix-2, in place
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

const pow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function analytic(x) {                    // Bandpass + Hilbert in einem Schritt
  const n = x.length, N = pow2(2 * n), re = new Float64Array(N), im = new Float64Array(N);
  const taper = Math.min(FPS / 2, n / 4);
  for (let i = 0; i < n; i++) {
    const w = Math.min(1, i / taper, (n - 1 - i) / taper);   // weiche Ränder gegen Sprünge
    re[i] = x[i] * (0.5 - 0.5 * Math.cos(Math.PI * clamp01(w)));
  }
  fft(re, im);
  for (let k = 0; k < N; k++) {
    const f = k * FPS / N;
    const keep = k > 0 && k < N / 2 && f >= F_MIN && f <= F_MAX;
    const g = keep ? 2 : 0;               // negative Frequenzen weg, positive verdoppeln
    re[k] *= g; im[k] *= g;
  }
  fft(re, im, true);
  return { re: re.subarray(0, n), im: im.subarray(0, n) };
}

function stft(x) {
  const n = x.length, bins = Math.floor(SPEC_FMAX * NFFT / FPS) + 1, cols = Math.max(1, Math.ceil(n / HOP));
  const spec = new Float32Array(cols * bins), f0c = new Float64Array(cols), confc = new Float64Array(cols);
  const kMin = Math.ceil(F_MIN * NFFT / FPS), hann = Float64Array.from({ length: WIN }, (_, k) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (WIN - 1)));
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
  for (let c = 0; c < cols; c++) {
    re.fill(0); im.fill(0);
    const start = c * HOP - WIN / 2;
    for (let k = 0; k < WIN; k++) { const j = start + k; if (j >= 0 && j < n) re[k] = x[j] * hann[k]; }
    fft(re, im);
    let best = kMin, tot = 1e-12;
    for (let k = 0; k < bins; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      spec[c * bins + k] = p;
      if (k >= kMin) { tot += p; if (p > spec[c * bins + best]) best = k; }
    }
    const P = (k) => spec[c * bins + Math.min(bins - 1, Math.max(0, k))];
    const a = Math.log(P(best - 1) + 1e-12), b = Math.log(P(best) + 1e-12), d = Math.log(P(best + 1) + 1e-12);
    const off = (a - 2 * b + d) < 0 ? 0.5 * (a - d) / (a - 2 * b + d) : 0;          // Parabel → Sub-Bin
    f0c[c] = (best + Math.max(-0.5, Math.min(0.5, off))) * FPS / NFFT;
    confc[c] = (P(best - 1) + P(best) + P(best + 1)) / tot;                           // Anteil der Spitze
  }
  return { spec, cols, bins, f0c, confc };
}

export function fourierAnalysis(m) {
  const n = m.n, raw = m.raw;
  // Signal: waagerechter Schwerpunkt, leicht geglättet, ohne langsame Drift (Kamerabewegung, Wandern)
  const xs = gaussian(raw.cx, 0.1 * FPS), trend = gaussian(raw.cx, 1.5 * FPS);
  const x = Float64Array.from(xs, (v, i) => v - trend[i]);

  // Hilbert → Drehwinkel
  const z = analytic(x);
  const amp = gaussian(Float64Array.from(z.re, (r, i) => Math.hypot(r, z.im[i])), 0.5 * FPS);
  const ref = percentile(amp, 80) + 1e-9;
  const rotPhase = new Float64Array(n), weight = new Float64Array(n), dphi = new Float64Array(n);
  let prevArg = Math.atan2(z.im[0], z.re[0]);
  for (let i = 1; i < n; i++) {
    const arg = Math.atan2(z.im[i], z.re[i]);
    let d = arg - prevArg;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));                                 // unwrap
    prevArg = arg;
    dphi[i] = Math.abs(d);
    weight[i] = clamp01((amp[i] / ref - 0.25) / 0.5);   // Vertrauen: klare Schwingung → Hilbert-Winkel
  }
  // Drehrichtung ist aus der Seitenansicht nicht eindeutig (sin φ sieht in beide Richtungen gleich aus).
  // Sie wird pro zusammenhängender Drehphase einmal aus dem Rotationsfeld (curl) bestimmt, damit sie
  // innerhalb einer Drehung nicht flackert.
  const dir = new Float64Array(n).fill(1);
  for (let i = 0; i < n;) {
    const on = weight[i] > 0.3;
    let j = i, sum = 0;
    while (j < n && (weight[j] > 0.3) === on) sum += raw.curl[j++];
    for (let k = i; k < j; k++) dir[k] = on ? (sum < 0 ? -1 : 1) : m.dir[k];
    i = j;
  }
  for (let i = 1; i < n; i++)
    rotPhase[i] = rotPhase[i - 1] + weight[i] * dir[i] * dphi[i] + (1 - weight[i]) * (m.phase[i] - m.phase[i - 1]);

  // STFT → Spektrogramm, f₀(t)
  const S = stft(x);
  const f0 = new Float64Array(n), conf = new Float64Array(n);
  for (let i = 0; i < n; i++) { const c = Math.min(S.cols - 1, Math.round(i / HOP)); f0[i] = S.f0c[c]; conf[i] = S.confc[c]; }
  const conf_s = gaussian(conf, 0.3 * FPS);

  // Gesamtspektrum des Clips (Mittel der Spalten)
  const mean = new Float64Array(S.bins);
  for (let c = 0; c < S.cols; c++) for (let k = 0; k < S.bins; k++) mean[k] += S.spec[c * S.bins + k] / S.cols;
  const kMin = Math.ceil(F_MIN * NFFT / FPS);
  let kb = kMin, tot = 1e-12;
  for (let k = kMin; k < S.bins; k++) { tot += mean[k]; if (mean[k] > mean[kb]) kb = k; }
  const fGlobal = kb * FPS / NFFT;
  const shareGlobal = (mean[kb - 1] + mean[kb] + (mean[kb + 1] || 0)) / tot;

  // Darstellung: Wurzel-Skalierung, auf 99. Perzentil normiert
  const p99 = percentile(S.spec.filter((_, k) => k % S.bins >= kMin), 99) + 1e-12;
  const display = Float32Array.from(S.spec, v => clamp01(Math.sqrt(v / p99)));

  return { rotPhase, weight, f0, conf: conf_s, spec: display, cols: S.cols, bins: S.bins, hop: HOP,
           fGlobal, shareGlobal, x };
}
