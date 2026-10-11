# polemath (Web-App)

Mit dieser Web-App machst du aus einem Pole-Dance-Clip ein Instagram-Reel im Format 1080×1920. Ein mathematisches 3D-Konstrukt (Torusknoten, Lorenz-Attraktor oder Kugelflächenwelle) folgt dabei der Bewegung der Tänzerin. Alles läuft im Browser, auch in Safari auf dem iPhone. Videos werden nirgendwo hochgeladen.

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
| `js/constructs.js` | Die drei Konstrukte. Für ein neues Konstrukt legst du eine Klasse mit `curves(i)` und `camera(i)` an und trägst sie in `CONSTRUCTS` und im `<select>` in `index.html` ein |
| `js/render.js` | Perspektivische Projektion, Linien mit Glow, Textebene und Komposition des Frames |
| `js/app.js` | Bedienoberfläche, Vorschau und Export (Canvas-Stream plus Ton über Web Audio → MediaRecorder) und Teilen-Dialog |

Die Logik entspricht der Python-Pipeline `polemath.py`. Es gibt zwei Unterschiede: Die Bewegung wird hier mit Block-Matching gemessen statt mit dem Farnebäck-Fluss, und die Pose-Erkennung („kopfüber“) fehlt bisher.

## Gut zu wissen

- **Format:** Safari auf dem iPhone und auf dem Mac speichert MP4 mit H.264, das kann Instagram direkt verarbeiten. Andere Browser speichern je nach Unterstützung MP4 oder WebM.
- **Bildrate:** Die Aufnahme läuft in Echtzeit. Ist das Gerät zu langsam für 30 fps, fallen Frames weg, Bild und Ton bleiben aber synchron.
- **Stromsparmodus:** Startet die Analyse nicht von selbst, erscheint der Knopf „Analyse starten“.
- **Rechte:** Die Clips gehören der Tänzerin. Teile nur Clips, für die du ihre Erlaubnis hast, nenne sie im Post und leg keine Videos ins Repository.
