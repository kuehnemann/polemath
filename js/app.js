import { analyzeVideo, buildMotion, chooseConstruct, FPS } from './analysis.js?v=3';
import { fourierAnalysis } from './fourier.js?v=3';
import { CONSTRUCTS } from './constructs.js?v=3';
import { ArtRenderer, buildTextLayer, composeFrame, LAYOUTS, OUT_W, OUT_H } from './render.js?v=3';

const $ = (s) => document.querySelector(s);
const ui = {
  file: $('#file'), video: $('#src'), canvas: $('#stage'), empty: $('#empty'),
  construct: $('#construct'), layout: $('#layout'), info: $('#info'), credit: $('#credit'), quality: $('#quality'), spin: $('#spin'),
  scrub: $('#scrub'), play: $('#play'), export: $('#export'), status: $('#status'), bar: $('#bar'),
  analyze: $('#analyze'), result: $('#result'), resultVideo: $('#resultVideo'), save: $('#save'),
  download: $('#download'), caption: $('#caption'), copy: $('#copy'), autoInfo: $('#autoInfo'),
};

const state = { analysis: null, motion: null, construct: null, kind: 'knot', art: null, text: null,
                scale: 1, playing: false, exporting: false, blob: null, audio: null };
const ctx = ui.canvas.getContext('2d');

function setStatus(msg, progress = null) {
  ui.status.textContent = msg;
  ui.bar.style.width = progress == null ? '0' : `${Math.round(progress * 100)}%`;
  ui.bar.parentElement.hidden = progress == null;
}

function setBusy(busy) {
  for (const el of [ui.construct, ui.layout, ui.info, ui.credit, ui.quality, ui.spin, ui.scrub, ui.play, ui.export, ui.file])
    el.disabled = busy;
}

const frameIndex = () => Math.max(0, Math.min(state.motion.n - 1, Math.round(ui.video.currentTime * FPS)));

// ───────── Laden & Analyse ─────────
ui.file.addEventListener('change', async () => {
  const f = ui.file.files[0];
  if (!f) return;
  stopPlayback();
  ui.result.hidden = true;
  ui.analyze.hidden = true;
  state.motion = null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);     // Video darunter wird sichtbar
  ui.empty.hidden = true;
  setStatus('Video wird geladen …');
  if (ui.video.src) URL.revokeObjectURL(ui.video.src);
  ui.video.src = URL.createObjectURL(f);
  ui.video.load();
  try {
    await waitForMetadata(ui.video, 15000);
  } catch (e) {
    setStatus(e.message);
    ui.empty.hidden = false;
    return;
  }
  runAnalysis();
});

// iOS lädt vor dem Abspielen oft nur die Metadaten (kein „loadeddata“) → nur darauf warten
function waitForMetadata(video, timeout) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && video.videoWidth) return resolve();
    const t = setTimeout(() => reject(new Error('Video lädt nicht. Anderes Format probieren oder Seite neu laden.')), timeout);
    video.addEventListener('loadedmetadata', () => { clearTimeout(t); resolve(); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(t); reject(new Error('Dieses Video kann der Browser nicht lesen.')); }, { once: true });
  });
}

ui.analyze.addEventListener('click', () => { ui.analyze.hidden = true; runAnalysis(); });

async function runAnalysis() {
  setBusy(true);
  setStatus('Bewegung wird analysiert …', 0);
  try {
    state.analysis = await analyzeVideo(ui.video, p => setStatus('Bewegung wird analysiert …', p));
  } catch (e) {
    // iOS kann Autoplay blockieren (z. B. im Stromsparmodus) → per Fingertipp starten
    setStatus(`Tippe auf „Analyse starten“. (${e.message})`, null);
    ui.analyze.hidden = false;
    ui.file.disabled = false;
    return;
  }
  rebuildMotion();
  setBusy(false);
  setStatus('Bereit. Vorschau ansehen oder direkt exportieren.');
}

function rebuildMotion() {
  state.motion = buildMotion(state.analysis, Number(ui.spin.value));
  state.motion.fourier = fourierAnalysis(state.motion);
  state.motion.rotPhase = state.motion.fourier.rotPhase;
  const auto = chooseConstruct(state.motion), F = state.motion.fourier;
  ui.autoInfo.textContent = `Automatisch: ${CONSTRUCTS[auto.kind].label} · Drehfrequenz ${F.fGlobal.toFixed(2)} Hz ` +
    `(Drehanteil ${(auto.share * 100).toFixed(0)} %), Drehung ${auto.rot.toFixed(2)} rad/s, Schwankung ${auto.cv.toFixed(2)}`;
  state.autoKind = auto.kind;
  ui.scrub.max = state.motion.n - 1;
  rebuildScene();
}

function rebuildScene() {
  if (!state.motion) return;
  state.scale = Number(ui.quality.value);
  ui.canvas.width = Math.round(OUT_W * state.scale);
  ui.canvas.height = Math.round(OUT_H * state.scale);
  state.kind = ui.construct.value === 'auto' ? state.autoKind : ui.construct.value;
  state.construct = new CONSTRUCTS[state.kind](state.motion);
  const L = LAYOUTS[ui.layout.value];
  state.art = new ArtRenderer(OUT_W, L.panelH, L.reserve, state.scale);
  state.text = buildTextLayer(state.construct, ui.credit.value.trim() || '@bendygio', ui.layout.value, state.motion, state.scale, ui.info.value);
  ui.caption.value = captionText();
  renderFrame();
}

function renderFrame() {
  if (!state.motion) return;
  const i = frameIndex();
  state.art.draw(state.construct.curves(i), ...state.construct.camera(i), 6, state.construct.pole !== false);
  composeFrame(ctx, state.scale, ui.video, state.art, state.text, state.motion, i, ui.layout.value);
  if (!state.exporting) ui.scrub.value = i;
}

function captionText() {
  const c = state.construct, credit = ui.credit.value.trim() || '@bendygio';
  const F = state.motion.fourier;
  const fLine = F && F.shareGlobal > 0.2
    ? `Dominante Drehfrequenz (Fourier): ${F.fGlobal.toFixed(2).replace('.', ',')} Hz ≈ ${Math.round(F.fGlobal * 60)} Umdrehungen/min\n` : '';
  return `${c.name}: ${c.formula}\n\nBewegung: ${credit} (geteilt mit ihrer Erlaubnis)\n${c.mapping}\n${fLine}\n` +
         '#poledance #mathart #generativeart #parametric #3d #mathematics #fourier #physics';
}

for (const el of [ui.construct, ui.layout, ui.info, ui.quality]) el.addEventListener('change', rebuildScene);
ui.credit.addEventListener('input', rebuildScene);
ui.spin.addEventListener('change', () => state.analysis && rebuildMotion());

ui.scrub.addEventListener('input', () => {
  stopPlayback();
  ui.video.currentTime = Number(ui.scrub.value) / FPS;
});
ui.video.addEventListener('seeked', () => { if (!state.playing && !state.exporting) renderFrame(); });

// ───────── Vorschau ─────────
function loop() {
  if (!state.playing && !state.exporting) return;
  renderFrame();
  requestAnimationFrame(loop);
}

async function startPlayback(fromStart = false) {
  await ensureAudio();
  if (fromStart || ui.video.ended) { ui.video.currentTime = 0; await once(ui.video, 'seeked'); }
  ui.video.muted = false;
  await ui.video.play();
  state.playing = true;
  ui.play.textContent = '⏸ Pause';
  requestAnimationFrame(loop);
}

function stopPlayback() {
  state.playing = false;
  ui.video.pause();
  ui.play.textContent = '▶ Vorschau';
}

ui.play.addEventListener('click', () => (state.playing ? stopPlayback() : startPlayback().catch(e => setStatus(e.message))));
ui.video.addEventListener('ended', () => { if (!state.exporting) stopPlayback(); });

const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));

// Ton läuft über Web Audio, damit er mit aufgenommen werden kann
async function ensureAudio() {
  if (!state.audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC(), src = ac.createMediaElementSource(ui.video), dest = ac.createMediaStreamDestination();
    src.connect(ac.destination); src.connect(dest);
    state.audio = { ac, dest };
  }
  if (state.audio.ac.state !== 'running') await state.audio.ac.resume();
}

// ───────── Export ─────────
function pickMime() {
  const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4',
                 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

ui.export.addEventListener('click', async () => {
  if (!window.MediaRecorder || !ui.canvas.captureStream) { setStatus('Dieser Browser kann keine Videos aufnehmen.'); return; }
  stopPlayback();
  setBusy(true);
  ui.result.hidden = true;
  try {
    await ensureAudio();
    ui.video.currentTime = 0;
    await once(ui.video, 'seeked');
    state.construct.reset();
    renderFrame();

    const stream = ui.canvas.captureStream(FPS);
    const audioTrack = state.audio && state.audio.dest.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
    const mime = pickMime();
    const rec = new MediaRecorder(stream, { ...(mime && { mimeType: mime }),
      videoBitsPerSecond: state.scale >= 1 ? 10e6 : 6e6, audioBitsPerSecond: 192e3 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const stopped = once(rec, 'stop');

    state.exporting = true;
    rec.start(1000);
    ui.video.muted = false;
    await ui.video.play();
    requestAnimationFrame(loop);
    const tick = setInterval(() => setStatus('Reel wird aufgenommen … Bildschirm anlassen.', ui.video.currentTime / ui.video.duration), 250);
    await once(ui.video, 'ended');
    clearInterval(tick);
    await new Promise(r => setTimeout(r, 150));
    rec.stop();
    await stopped;
    state.exporting = false;
    stream.getVideoTracks().forEach(t => t.stop());

    state.blob = new Blob(chunks, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] });
    showResult();
    setStatus(`Fertig: ${(state.blob.size / 1e6).toFixed(1)} MB`);
  } catch (e) {
    state.exporting = false;
    setStatus('Export fehlgeschlagen: ' + e.message);
  }
  setBusy(false);
});

function showResult() {
  const ext = state.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const url = URL.createObjectURL(state.blob);
  ui.resultVideo.src = url;
  ui.download.href = url;
  ui.download.download = `polemath-${state.kind}.${ext}`;
  ui.result.hidden = false;
  ui.result.scrollIntoView({ behavior: 'smooth' });
}

ui.save.addEventListener('click', async () => {
  const file = new File([state.blob], ui.download.download, { type: state.blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch (_) { /* abgebrochen */ }
  } else {
    ui.download.click();
  }
});

ui.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(ui.caption.value); ui.copy.textContent = 'Kopiert ✓'; }
  catch (_) { ui.caption.select(); document.execCommand('copy'); ui.copy.textContent = 'Kopiert ✓'; }
  setTimeout(() => (ui.copy.textContent = 'Text kopieren'), 1500);
});

setBusy(true);
ui.file.disabled = false;

// Fehler sichtbar machen statt still zu hängen
window.addEventListener('error', e => setStatus('Fehler: ' + e.message));
window.addEventListener('unhandledrejection', e => setStatus('Fehler: ' + (e.reason && e.reason.message || e.reason)));
