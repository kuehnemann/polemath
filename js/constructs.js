// Zeitabhängige 3D-Konstrukte. Jedes liefert pro Frame i eine Liste von 3D-Polylinien
// und eine Kamera (yaw, pitch). Neue Konstrukte: Klasse anlegen und in CONSTRUCTS eintragen.

export const MAGENTA = [255, 60, 200], CYAN = [60, 220, 255], WHITE = [255, 255, 255], GREY = [160, 150, 150];
const TAU = Math.PI * 2;
const linspace = (a, b, n) => Array.from({ length: n }, (_, k) => a + (b - a) * k / (n - 1));

export const curve = (pts, c0, c1, width, alpha) => ({ pts, c0, c1, width, alpha });

class Construct {
  constructor(m) { this.m = m; }
  camera(i) { return [this.m.phase[i], 0.35 + Math.PI * this.m.inverted[i]]; }
  reset() {}
}

export class TorusKnot extends Construct {
  static label = 'Torusknoten';
  name = 'Torusknoten T(2,3)';
  formula = 'γ(t) = ((1+a·cos 3t)·cos 2t, (1+a·cos 3t)·sin 2t, a·sin 3t)';
  mapping = 'Drehung → Rotation · Spannweite → a(t) · Energie → Komet';
  constructor(m) { super(m); this.t = linspace(0, TAU, 900); }
  camera(i) { return [this.m.phase[i], 0.8 + Math.PI * this.m.inverted[i]]; }
  curves(i) {
    const m = this.m, t = this.t, n = t.length;
    const a = 0.3 + 0.35 * m.spread[i], zs = 1 + 0.6 * m.energy[i];
    const pts = t.map(u => {
      const r = 1 + a * Math.cos(3 * u);
      return [0.8 * r * Math.cos(2 * u), 0.8 * r * Math.sin(2 * u), 0.8 * a * Math.sin(3 * u) * zs];
    });
    const frac = ((m.phase[i] * 4 / TAU) % 1 + 1) % 1;
    const head = Math.floor(frac * n), L = 160, tail = [], fade = [];
    for (let k = L - 1; k >= 0; k--) tail.push(pts[((head - k) % n + n) % n]);
    for (let k = 0; k < L; k++) fade.push((k / (L - 1)) ** 2);
    return [curve(pts, MAGENTA, CYAN, 2, 0.5 + 0.3 * m.energy[i]), curve(tail, CYAN, WHITE, 4, fade)];
  }
}

export class Lorenz extends Construct {
  static label = 'Lorenz-Attraktor';
  name = 'Lorenz-Attraktor';
  formula = 'dx/dt = σ(y−x)   dy/dt = x(ρ(t)−z)−y   dz/dt = xy−βz';
  mapping = 'Energie → ρ(t) und Tempo · Drehung → Kamera';
  constructor(m) { super(m); this.reset(); }
  reset() {
    this.state = [1, 1, 20]; this.trail = []; this.lastI = -1;
    for (let k = 0; k < 1500; k++) this.step(28);
  }
  step(rho, dt = 0.006, sigma = 10, beta = 8 / 3) {
    const f = ([x, y, z]) => [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
    const add = (v, k, h) => v.map((c, j) => c + h * k[j]);
    const v = this.state, k1 = f(v), k2 = f(add(v, k1, dt / 2)), k3 = f(add(v, k2, dt / 2)), k4 = f(add(v, k3, dt));
    this.state = v.map((c, j) => c + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    this.trail.push(this.state);
    if (this.trail.length > 2400) this.trail.shift();
  }
  curves(i) {
    if (i < this.lastI || i - this.lastI > 90) { this.reset(); this.lastI = i - 1; }
    for (let k = this.lastI + 1; k <= i; k++) {
      const e = this.m.energy[k], rho = 22 + 14 * e, steps = 3 + Math.floor(18 * e);
      for (let s = 0; s < steps; s++) this.step(rho);
    }
    this.lastI = i;
    const pts = this.trail.map(([x, y, z]) => [x / 20, y / 20, (z - 24) / 20]);
    const fade = pts.map((_, k) => (k / (pts.length - 1)) ** 1.5);
    const head = pts.slice(-40), hf = head.map((_, k) => 0.3 + 0.7 * k / 39);
    return [curve(pts, MAGENTA, CYAN, 2, fade), curve(head, CYAN, WHITE, 4, hf)];
  }
}

export class HarmonicSphere extends Construct {
  static label = 'Kugelflächenwelle';
  name = 'Kugelflächenwelle';
  formula = 'r(θ,φ,t) = 1 + A(t)·sin³θ·cos(3(φ−Φ(t)))·cos(2θ−Ψ(t))';
  mapping = 'Drehung → Φ(t) · Auf/Ab → Ψ(t) · Spannweite → A(t)';
  camera(i) { return [0.15 * i / 30, 0.35 + Math.PI * this.m.inverted[i]]; }
  pt(th, ph, i) {
    const m = this.m, A = 0.12 + 0.38 * m.spread[i];
    const r = 0.95 * (1 + A * Math.sin(th) ** 3 * Math.cos(3 * (ph - m.phase[i])) * Math.cos(2 * th - m.psi[i]));
    return [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)];
  }
  curves(i) {
    const out = [], b = 0.45 + 0.4 * this.m.energy[i];
    const th = linspace(0, Math.PI, 100), ph = linspace(0, TAU, 180);
    for (let k = 0; k < 18; k++) out.push(curve(th.map(t => this.pt(t, k * Math.PI / 9, i)), MAGENTA, CYAN, 2, b));
    for (const tj of linspace(0.25, Math.PI - 0.25, 9)) out.push(curve(ph.map(p => this.pt(tj, p, i)), CYAN, MAGENTA, 2, b * 0.8));
    return out;
  }
}

// DNA-Doppelhelix, die sich um die Stange als Achse dreht. Der Drehwinkel φ(t) stammt aus der
// Hilbert-Transformation ihrer Bewegung (fourier.js), d. h. die Helix dreht sich phasengleich mit ihr.
const BASES = [MAGENTA, CYAN, [255, 200, 110], [150, 120, 255]];      // A, T, G, C
const PAIR = [1, 0, 3, 2];                                              // A–T, G–C
export class DNAHelix extends Construct {
  static label = 'DNA-Doppelhelix';
  name = 'DNA-Doppelhelix';
  formula = 'r±(s,t) = (R·cos(κs + φ(t) + δ±), R·sin(κs + φ(t) + δ±), s)';
  mapping = 'φ(t) aus Hilbert-Transformation · Spannweite → Windung κ · Auf/Ab → Schraubung';
  constructor(m) {
    super(m);
    let seed = 7;
    this.seq = Array.from({ length: 64 }, () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 4);
  }
  camera(i) { return [0.35, 0.12 + Math.PI * this.m.inverted[i]]; }       // feste Seitenansicht wie im Video
  curves(i) {
    const m = this.m, H = 1.35;
    const turns = 3.4 - 1.4 * m.spread[i];                 // gestreckt → weniger Windungen
    const kappa = 2 * Math.PI * turns / (2 * H);
    const phi = (m.rotPhase ? m.rotPhase[i] : m.phase[i]) - 0.6 * m.psi[i];
    const R = 0.55 + 0.08 * m.energy[i], delta = 0.8 * Math.PI;           // Versatz → große/kleine Furche
    const P = (sv, d) => [R * Math.cos(kappa * sv + phi + d), R * Math.sin(kappa * sv + phi + d), sv];
    const ss = linspace(-H, H, 360);
    const out = [curve(ss.map(v => P(v, 0)), MAGENTA, [255, 120, 220], 5, 0.95),
                 curve(ss.map(v => P(v, delta)), CYAN, [140, 230, 255], 5, 0.95)];
    const nbp = Math.round(10.5 * turns);                  // B-DNA: ~10,5 Basenpaare pro Windung
    const glow = 0.45 + 0.45 * m.energy[i];
    for (let b = 0; b < nbp; b++) {
      const sv = -H + (b + 0.5) * 2 * H / nbp, a = P(sv, 0), c = P(sv, delta);
      const mid = a.map((v, j) => (v + c[j]) / 2), base = this.seq[b % this.seq.length];
      out.push(curve([a, mid], BASES[base], BASES[base], 3, glow));
      out.push(curve([mid, c], BASES[PAIR[base]], BASES[PAIR[base]], 3, glow));
    }
    return out;
  }
}

// Fourier-Epizykel: Die Bahn des Bewegungsschwerpunkts der letzten 4 s wird diskret
// Fourier-transformiert und aus den 12 stärksten Termen als Kette rotierender Kreise
// wieder aufgebaut. Die Zeit läuft in die Tiefe: ein Zeiger e^{iωt} über der Zeit ist eine Helix.
export class FourierEpicycles extends Construct {
  static label = 'Fourier-Epizykel';
  name = 'Fourier-Epizykel';
  formula = 'z(t) ≈ Σₖ cₖ·exp(2πi·kt/T),   cₖ = (1/N)·Σₙ zₙ·exp(−2πi·kn/N)';
  pole = false;
  mapping = 'Schwerpunktsbahn der letzten 4 s → 12 stärkste Fourier-Terme · Zeit → Tiefe';
  W = 120; N = 64; K = 12;
  camera(i) { return [0.7 + 0.25 * Math.sin(i / 30 * 0.25), 0.28 + Math.PI * this.m.inverted[i]]; }
  window(i) {                                             // komplexe Bahn z_n, n = 0..N-1
    const m = this.m, zr = [], zi = [];
    for (let n = 0; n < this.N; n++) {
      const t = Math.max(0, i - (this.W - 1) * (1 - n / (this.N - 1)));
      const a = Math.floor(t), b = Math.min(m.n - 1, a + 1), f = t - a;
      zr.push(m.px[a] * (1 - f) + m.px[b] * f);
      zi.push(-(m.py[a] * (1 - f) + m.py[b] * f) * m.aspect);   // Bild-y zeigt nach unten
    }
    const mr = zr.reduce((p, v) => p + v, 0) / this.N, mi = zi.reduce((p, v) => p + v, 0) / this.N;
    const s = 0.8 / this.m.pscale;
    return [zr.map(v => (v - mr) * s), zi.map(v => (v - mi) * s)];
  }
  curves(i) {
    const N = this.N, [zr, zi] = this.window(i), terms = [];
    for (let k = -N / 2; k < N / 2; k++) {                 // DFT
      let cr = 0, ci = 0;
      for (let n = 0; n < N; n++) {
        const a = -2 * Math.PI * k * n / N;
        cr += zr[n] * Math.cos(a) - zi[n] * Math.sin(a);
        ci += zr[n] * Math.sin(a) + zi[n] * Math.cos(a);
      }
      terms.push({ k, cr: cr / N, ci: ci / N, r: Math.hypot(cr, ci) / N });
    }
    const top = terms.filter(t => t.k !== 0).sort((a, b) => b.r - a.r).slice(0, this.K);
    const at = (tau) => {                                  // Rekonstruktion aus K Termen
      let x = 0, y = 0;
      for (const t of top) {
        const a = 2 * Math.PI * t.k * tau / N, c = Math.cos(a), s = Math.sin(a);
        x += t.cr * c - t.ci * s; y += t.cr * s + t.ci * c;
      }
      return [x, y];
    };
    const D = 2.6, out = [];
    // Original-Bahn (dünn) und Fourier-Rekonstruktion (hell), ältere Punkte weiter hinten
    out.push(curve(zr.map((x, n) => [x, D * (1 - n / (N - 1)), zi[n]]), GREY, WHITE, 1, 0.35));
    const taus = linspace(0, N - 1, 256), rec = taus.map(tau => { const [x, y] = at(tau); return [x, D * (1 - tau / (N - 1)), y]; });
    out.push(curve(rec, MAGENTA, CYAN, 3, taus.map(t => 0.15 + 0.85 * (t / (N - 1)) ** 1.5)));
    // Epizykel-Kette zum aktuellen Zeitpunkt τ = N−1
    let x = 0, y = 0;
    const circ = linspace(0, 2 * Math.PI, 48), tau = N - 1;
    top.forEach((t, r) => {
      const a = 2 * Math.PI * t.k * tau / N, c = Math.cos(a), s = Math.sin(a);
      const nx = x + t.cr * c - t.ci * s, ny = y + t.cr * s + t.ci * c;
      const bright = 0.85 - 0.6 * r / this.K;
      out.push(curve(circ.map(u => [x + t.r * Math.cos(u), 0, y + t.r * Math.sin(u)]), CYAN, MAGENTA, 1.5, bright * 0.7));
      out.push(curve([[x, 0, y], [nx, 0, ny]], WHITE, WHITE, 2, bright));
      x = nx; y = ny;
    });
    return out;
  }
}

export const CONSTRUCTS = { knot: TorusKnot, lorenz: Lorenz, harmonic: HarmonicSphere, dna: DNAHelix, fourier: FourierEpicycles };
