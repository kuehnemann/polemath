# polemath (Web-App)

Mit dieser Web-App machst du aus einem Pole-Dance-Clip ein Instagram-Reel im Format 1080×1920. Ein mathematisches 3D-Konstrukt (Torusknoten, Lorenz-Attraktor, Kugelflächenwelle, DNA-Doppelhelix oder Fourier-Epizykel) folgt dabei der Bewegung der Tänzerin. Eine Fourier-Analyse misst ihre Drehfrequenz. Alles läuft im Browser, auch in Safari auf dem iPhone. Videos werden nirgendwo hochgeladen.

## Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues **öffentliches** Repository anlegen, zum Beispiel `polemath`.
2. Im Repo „Add file → Upload files“ wählen und den **Inhalt** dieses Ordners hineinziehen, also `index.html`, `style.css`, `manifest.webmanifest`, `.nojekyll` und die Ordner `js/` und `icons/`. Danach „Commit changes“. Die Dateien müssen im Hauptverzeichnis des Repos liegen, nicht in einem Unterordner.
3. Unter **Settings → Pages** bei „Source“ *Deploy from a branch* wählen, als Branch `main` und `/ (root)`, dann speichern.
4. Nach ein bis zwei Minuten ist die App online unter `https://<dein-github-name>.github.io/polemath/`.

Mit der Kommandozeile geht es so:

```bash
cd polemath-web
git init && git add . && git commit -m "polemath web app"
gh repo create polemath --public --source . --push
gh api -X POST repos/{owner}/polemath/pages -f "source[branch]=main" -f "source[path]=/"
```

## Auf dem iPhone

1. Öffne die Adresse in Safari und tippe auf **Teilen → Zum Home-Bildschirm**. Danach startet die App wie eine normale App.
2. Tippe auf **Video wählen** und such den Clip aus Fotos oder Dateien aus. Die Analyse läuft im Schnelldurchlauf und dauert etwa halb so lange wie der Clip.
3. Wähle Konstrukt, Layout und Credit und schau dir das Ergebnis mit **Vorschau** an.
4. Tippe auf **Reel exportieren**. Der Clip wird in Echtzeit mit Ton aufgenommen. Lass den Bildschirm dabei an und bleib in der App.
5. Tippe auf **In Fotos sichern / Teilen** und dann auf „Video sichern“. Kopiere die Bildunterschrift und poste das Reel in Instagram, am besten als Collab mit der Tänzerin.

Ruckelt der Export, stell die Qualität auf 720 × 1280. Instagram skaliert das Video ohnehin.

## Lokal testen

ES-Module funktionieren nicht über `file://`, deshalb brauchst du einen kleinen Server:

```bash
cd polemath-web && python3 -m http.server 8000     # → http://localhost:8000
```

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/analysis.js` | Bewegungsanalyse per Block-Matching-Fluss auf 128 px Breite: Energie, Schwerpunkt, Rotation, Auf/Ab, Spannweite. Daraus entstehen auf einem 30-fps-Raster geglättete Steuerkurven (Phase Φ, Welle Ψ, Amplitude). Außerdem die Heuristik für „Automatisch“ |
| `js/fourier.js` | Fourier-Analyse der Drehung: FFT, Kurzzeit-Fourier-Transformation (Spektrogramm und f₀), Hilbert-Transformation (Drehwinkel φ(t)) |
| `js/constructs.js` | Die fünf Konstrukte. Für ein neues Konstrukt legst du eine Klasse mit `curves(i)` und `camera(i)` an und trägst sie in `CONSTRUCTS` und im `<select>` in `index.html` ein |
| `js/render.js` | Perspektivische Projektion, Linien mit Glow, Textebene und Komposition des Frames |
| `js/app.js` | Bedienoberfläche, Vorschau und Export (Canvas-Stream plus Ton über Web Audio → MediaRecorder) und Teilen-Dialog |

Die Logik entspricht der Python-Pipeline `polemath.py`. Es gibt zwei Unterschiede: Die Bewegung wird hier mit Block-Matching gemessen statt mit dem Farnebäck-Fluss, und die Pose-Erkennung („kopfüber“) fehlt bisher.

## Fourier-Analyse

Dreht sich die Tänzerin um die Stange, sieht die Kamera die Projektion einer Kreisbewegung. Der waagerechte Bewegungsschwerpunkt schwingt also etwa wie x(t) ≈ R·sin φ(t).

- **Spektrogramm:** Eine Kurzzeit-Fourier-Transformation von x(t) (4-s-Hann-Fenster, Auflösung etwa 0,06 Hz, Spitze per Parabel verfeinert) liefert das Spektrogramm in der Analyse-Zeile und die live eingeblendete Drehfrequenz f₀ in Hz und Umdrehungen pro Minute.
- **Drehwinkel:** Das analytische Signal z = x + i·H[x] entsteht per Hilbert-Transformation über die FFT, kombiniert mit einem Bandpass von 0,15 bis 3 Hz. Sein Winkel arg z(t) rekonstruiert den tatsächlichen Drehwinkel φ(t). Sein Betrag |z| sagt, wie eindeutig die Drehung gerade ist. Wo die Drehung unklar ist, etwa beim Halten einer Pose, übernimmt die bisherige Phase Φ(t).
- **DNA-Doppelhelix:** Sie dreht sich mit φ(t) um die Stange, also im Takt mit der Tänzerin.
- **Fourier-Epizykel:** Sie zerlegen die Schwerpunktsbahn der letzten 4 s in eine diskrete Fourier-Reihe und bauen sie aus den 12 stärksten Termen als Kette rotierender Kreise wieder auf. Die Zeit läuft dabei in die Tiefe: Ein einzelner Term e^(iωt), über der Zeit aufgetragen, ist selbst eine Helix.
- **Grenzen:** Die Drehrichtung ist aus der Seitenansicht grundsätzlich nicht eindeutig, weil sin φ in beide Richtungen gleich aussieht. Sie wird pro Drehphase aus dem Rotationsfeld geschätzt und kann falsch herum sein.

## Gut zu wissen

- **Format:** Safari auf dem iPhone und auf dem Mac speichert MP4 mit H.264, das kann Instagram direkt verarbeiten. Andere Browser speichern je nach Unterstützung MP4 oder WebM.
- **Bildrate:** Die Aufnahme läuft in Echtzeit. Ist das Gerät zu langsam für 30 fps, fallen Frames weg, Bild und Ton bleiben aber synchron.
- **Stromsparmodus:** Startet die Analyse nicht von selbst, erscheint nach spätestens 5 Sekunden der Knopf „Analyse starten“.
- **Updates:** GitHub Pages und Safari speichern alte Versionen etwa 10 Minuten zwischen. Nach einem Update die Seite neu laden. Wenn die App auf dem Home-Bildschirm liegt, schließt du sie dafür ganz und öffnest sie neu.
- **Rechte:** Die Clips gehören der Tänzerin. Teile nur Clips, für die du ihre Erlaubnis hast, nenne sie im Post und leg keine Videos ins Repository.
