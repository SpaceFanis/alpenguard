// Build-time: export the demo tour (GPX) and the low-angle alternative (GeoJSON) from the DEM grid.
import fs from 'node:fs';
import { G_, ll, idx, dijkstra } from './paths.mjs';
const { E, S } = G_;
const sum = idx(45.632, 6.538), th = idx(45.6436, 6.4996);
const km2 = (a, b) => Math.hypot((a.lat - b.lat) * 111.32, (a.lon - b.lon) * 111.32 * Math.cos(45.63 * Math.PI / 180));
const trace = (prev, k) => { const p = []; while (k !== -1) { p.push(k); k = prev[k]; } return p; };
const main = trace(dijkstra(sum, (k, nk, len) => S[nk] > 40 ? Infinity : len * (1 + Math.max(0, S[nk] - 18) / 6)).prev, th);
const altD = dijkstra(sum, (k, nk, len) => (S[nk] > 30 && km2(ll(nk), ll(sum)) > 0.06) ? Infinity : len * (1 + Math.max(0, S[nk] - 15) / 6));
let kmAcc = 0, j = 0; for (let i = 1; i < main.length; i++) { kmAcc += km2(ll(main[i - 1]), ll(main[i])); if (kmAcc >= 0.27) { j = i; break; } }
const alt = trace(altD.prev, main[j]);
// Simplify (keep every 2nd) then Chaikin smoothing twice; keep endpoints.
function smooth(pts) {
  let p = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
  for (let r = 0; r < 2; r++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } q.push(p.at(-1)); p = q; }
  return p.map(([lon, lat]) => [+lon.toFixed(6), +lat.toFixed(6)]);
}
const toLL = (ks) => ks.map(k => { const p = ll(k); return [p.lon, p.lat]; });
const mainPts = smooth(toLL(main)), altPts = smooth(toLL(alt));
const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AlpenGuard demo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Sample tour, Beaufortain (test data)</name></metadata>
  <trk><name>Sample tour, Beaufortain</name><trkseg>
${mainPts.map(([lon, lat]) => `    <trkpt lat="${lat}" lon="${lon}"/>`).join('\n')}
  </trkseg></trk>
</gpx>
`;
fs.writeFileSync('src/data/route.gpx', gpx);
fs.writeFileSync('src/data/alternative.json', JSON.stringify({ type: 'Feature', properties: { name: 'West ridge alternative' }, geometry: { type: 'LineString', coordinates: altPts } }));
console.log('main pts', mainPts.length, 'alt pts', altPts.length, 'trailhead', mainPts[0], 'summit', mainPts.at(-1));
