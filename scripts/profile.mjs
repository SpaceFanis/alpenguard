// Build-time: compute the route profile the same way the worker does, as an offline fallback and test fixture.
import fs from 'node:fs';
import { elev } from './dem.mjs';
import { gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
const { horn, resample } = await import('../src/lib/terrain-math.ts');
const doc = new DOMParser().parseFromString(fs.readFileSync('src/data/route.gpx', 'utf8'), 'text/xml');
const coords = gpx(doc).features[0].geometry.coordinates;
const CELL = 20;
async function sample(lon, lat) {
  const dLat = CELL / 111320, dLon = CELL / (111320 * Math.cos(lat * Math.PI / 180));
  const z = [];
  for (let r = 1; r >= -1; r--) { const row = []; for (let c = -1; c <= 1; c++) row.push(await elev(lon + c * dLon, lat + r * dLat)); z.push(row); }
  return { elev: z[1][1], ...horn(z, CELL, CELL) };
}
async function profileOf(cs) {
  const out = [];
  for (const p of resample(cs, 25)) { const s = await sample(p.lon, p.lat); out.push({ lon: +p.lon.toFixed(6), lat: +p.lat.toFixed(6), d: Math.round(p.d), elev: Math.round(s.elev), slope: +s.slope.toFixed(1), aspect: Math.round(s.aspect) }); }
  return out;
}
const alt = JSON.parse(fs.readFileSync('src/data/alternative.json', 'utf8')).geometry.coordinates;
fs.writeFileSync('src/data/profile.cache.json', JSON.stringify({ route: await profileOf(coords), alternative: await profileOf(alt) }));
console.log('ok');
