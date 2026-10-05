# Analyty promo video

30-second 1920x1080 / 60 fps promo with a soundtrack, fully procedural:
no stock footage or images. Every frame is drawn on a canvas
(`scene.js`) and the music is synthesised in Python (`music.py`).

Result: [`analyty-promo.mp4`](analyty-promo.mp4)

| Time | Scene |
|---|---|
| 0–3.5s | Particles converge into the Analyty logo (the lens opens like an eye), wordmark, "AI-zichtbaarheid, gemeten" |
| 3.5–6.8s | "Je klanten googelen niet meer. Ze vragen het aan AI." |
| 6.8–12s | AI chat lists Testbedrijf 1–3; "Jouw bedrijf: niet genoemd" |
| 12–17s | Analyty sends hundreds of questions to ChatGPT, Gemini and Claude |
| 17–22.5s | GEO report: score, visibility per AI model, KPIs |
| 22.5–27s | Recommendations are ticked off, score rises 64 → 87 |
| 27–30s | "Word gevonden door AI." + CTA "Start je gratis AI-scan" · analyty.com |

## Rebuilding

```bash
pip install numpy
python3 music.py          # -> music.wav
node render.mjs           # -> out/analyty-promo.mp4 (needs Playwright + ffmpeg)
node render.mjs --stills 2,9,20   # individual frames for review
```

Live preview: serve this folder (`npx serve .`), open `index.html`
and click to play with sound.

Copy, colours and timings live at the top of each scene function in `scene.js`.

## Brand

- Logo: `logo.png` (dark disc with lime lens), redrawn as vectors in `logo()` / `lensPath()`.
- Palette: ink `#121212`, lime `#c9f24e`, beige `#efe8d8`, white. Warm red is only used for the "niet genoemd" warning.
- All companies in the video are placeholders (Testbedrijf 1, 2, 3); scores and percentages are illustrative.
