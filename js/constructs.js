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

export const CONSTRUCTS = { knot: TorusKnot, lorenz: Lorenz, harmonic: HarmonicSphere };
