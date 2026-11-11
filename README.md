# AlpenGuard: demo MVP

A one-page site and working demo for AlpenGuard, an AI safety assistant for ski touring. It puts the avalanche bulletin, the slope of every part of your route and climbers' reports (in any language) on one map, and alerts your contacts if you don't check in.

Made by Fanis Papaspyrou, Anastasis Skourtis, Ioannis Manis and Christos Gkotzamanis (student prototype).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules engine and terrain math
npm run build      # static site in dist/
```

## What is real and what is test data

| Part | In this demo |
|---|---|
| Terrain, slope, aspect | **Real.** Computed in the browser (Web Worker) from AWS Terrarium elevation tiles, using Horn's method every 25 m along the route. |
| Sample route | **Real terrain**, Beaufortain (French Alps), 4.9 km, 1,498 → 2,645 m. Generated from the elevation model by `scripts/` (`npm run data`). |
| Slope-angle map layer | **Real.** A MapLibre custom protocol computes 30–35 / 35–40 / 40–45 / 45°+ bands from the same tiles. |
| Avalanche bulletin | Test data in the EAWS CAAML v6 JSON shape (`src/data/bulletin.caaml.json`). |
| Climber reports | Test data shaped like Camptocamp API outings, in FR / DE / IT (`src/data/reports.json`). |
| AI (translation, plan parsing) | Cached model output (`src/data/ai-cache.json`). Unknown plans go through an offline fallback parser. No API key is needed. |
| Rules engine | **Real**, in `src/lib/rules.ts`. A stretch is flagged when it is ≥30°, on an aspect and at an elevation the bulletin names. Reports within 500 m and under 48 h strengthen a flag. |
| Overdue timer and dossier | Simulated clock. Nothing is sent. |
| Voice plan | The browser's speech recognition where it works (Chrome, Edge, Safari). In Brave, Firefox, or when the service fails, it records and transcribes on the device with Whisper base (transformers.js, ~80 MB downloaded once). Audio never leaves the device. |

## Stack

Vite, React, TypeScript, MapLibre GL JS (3D terrain, light hillshade, slope tiles computed in a worker pool), maplibre-contour, fast-png, @huggingface/transformers (on-device speech), @tmcw/togeojson, GSAP, Lenis, Vitest. Type: Newsreader and Hanken Grotesk.

## Credits

Photographs (Wikimedia Commons / Flickr, CC BY and CC BY-SA) are listed in `src/data/credits.json` and credited in the page footer. Elevation: Mapzen Terrain Tiles on AWS.
