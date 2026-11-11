// Build-time: sample the elevation model on a regular grid around the sample tour for the point-cloud scene.
// Writes public/terrain.bin (Int16 metres, row-major, north row first) and src/data/terrain.json (grid header).
import fs from 'node:fs';
import { elev } from './dem.mjs';
const lon0 = 6.482, lon1 = 6.566, lat0 = 45.612, lat1 = 45.668, step = 0.00025;
const cols = Math.round((lon1 - lon0) / step) + 1, rows = Math.round((lat1 - lat0) / step) + 1;
const out = new Int16Array(cols * rows);
for (let r = 0; r < rows; r++) {
  const lat = lat1 - r * step;
  for (let c = 0; c < cols; c++) out[r * cols + c] = Math.round(await elev(lon0 + c * step, lat));
}
fs.writeFileSync('public/terrain.bin', Buffer.from(out.buffer));
fs.writeFileSync('src/data/terrain.json', JSON.stringify({ lon0, lat1, step, cols, rows }));
console.log(cols, rows, cols * rows, 'points', Math.min(...out), Math.max(...out));
