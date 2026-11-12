// The risk map: 3D terrain, contours, slope-angle bands, the route, flagged stretches and pinned reports.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import mlcontour from 'maplibre-contour';
import { registerSlopeProtocol, SLOPE_BANDS, TERRARIUM } from '../lib/slope-protocol';
import type { Evaluation, Report } from '../lib/rules';
import { routePoints, type RoutePoint } from '../lib/route-points';
import { scrollState } from '../lib/motion';

export interface RiskMapHandle { focusFlag: (id: string) => void; overview: () => void; resize: () => void }
interface Props {
  points?: RoutePoint[];
  route: number[][];
  alternative?: number[][] | null;
  evaluation?: Evaluation | null;
  reports?: Report[];
  selected?: string | null;
  onSelectFlag?: (id: string) => void;
  mode: 'stage' | 'demo';
  camera?: { center: [number, number]; zoom: number; pitch: number; bearing: number; duration?: number } | null;
  showSlope?: boolean;
  imagery?: boolean;
  orbit?: boolean;
  className?: string;
  label?: string;
}

let dem: InstanceType<typeof mlcontour.DemSource> | null = null;
function setupProtocols() {
  maplibregl.setWorkerUrl(workerUrl);
  registerSlopeProtocol();
  if (!dem) {
    dem = new mlcontour.DemSource({ url: TERRARIUM, encoding: 'terrarium', maxzoom: 13, worker: true });
    dem.setupMaplibre(maplibregl as never);
  }
  return dem;
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function bounds(coords: number[][]) {
  const b = new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]);
  coords.forEach((c) => b.extend(c as [number, number]));
  return b;
}

const line = (coords: number[][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } });
const fc = (features: object[]) => ({ type: 'FeatureCollection' as const, features }) as unknown as Parameters<maplibregl.GeoJSONSource['setData']>[0];

function style(): maplibregl.StyleSpecification {
  const d = setupProtocols();
  return {
    version: 8,
    sources: {
      terrain: { type: 'raster-dem', tiles: [TERRARIUM], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Elevation: Mapzen Terrain Tiles on AWS' },
      shade: { type: 'raster-dem', tiles: [TERRARIUM], encoding: 'terrarium', tileSize: 256, maxzoom: 14 },
      slope: { type: 'raster', tiles: ['slope://{z}/{x}/{y}'], tileSize: 256, minzoom: 10, maxzoom: 14 },
      imagery: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 17, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics' },
      contours: {
        type: 'vector', maxzoom: 15,
        tiles: [d.contourProtocolUrl({ multiplier: 1, thresholds: { 11: [200, 1000], 12: [100, 500], 13: [50, 250], 14: [20, 100] }, elevationKey: 'ele', levelKey: 'level', contourLayer: 'contours' })],
      },
      route: { type: 'geojson', data: fc([]) },
      alt: { type: 'geojson', data: fc([]) },
      flags: { type: 'geojson', data: fc([]) },
      noted: { type: 'geojson', data: fc([]) },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#eef2f5' } },
      { id: 'imagery', type: 'raster', source: 'imagery', layout: { visibility: 'none' }, paint: { 'raster-saturation': -0.2, 'raster-brightness-min': 0.05 } },
      { id: 'shade', type: 'hillshade', source: 'shade', paint: { 'hillshade-method': 'igor', 'hillshade-shadow-color': '#4f6478', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#8fa3b5', 'hillshade-exaggeration': 0.7, 'hillshade-illumination-direction': 315 } },
      { id: 'contour-minor', type: 'line', source: 'contours', 'source-layer': 'contours', filter: ['==', ['get', 'level'], 0], paint: { 'line-color': '#2f4a63', 'line-opacity': 0.16, 'line-width': 0.6 } },
      { id: 'contour-major', type: 'line', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0], paint: { 'line-color': '#2f4a63', 'line-opacity': 0.32, 'line-width': 1 } },
      { id: 'slope', type: 'raster', source: 'slope', paint: { 'raster-opacity': 0.42, 'raster-resampling': 'linear' } },
      { id: 'alt-line', type: 'line', source: 'alt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1f6f8b', 'line-width': 3.5, 'line-dasharray': [1.4, 1.6] } },
      { id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } },
      { id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0b1722', 'line-width': 3.5 } },
      { id: 'noted-line', type: 'line', source: 'noted', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#b8860b', 'line-width': 5, 'line-dasharray': [0.6, 1.2] } },
      { id: 'flag-casing', type: 'line', source: 'flags', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 13 } },
      { id: 'flag-glow', type: 'line', source: 'flags', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ff9900', 'line-width': 22, 'line-opacity': 0.22, 'line-blur': 8 } },
      { id: 'flag-line', type: 'line', source: 'flags', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#e67e00', 'line-width': 7 } },
    ],
    sky: { 'sky-color': '#cfe0ee', 'horizon-color': '#eef2f5', 'fog-color': '#eef2f5', 'fog-ground-blend': 0.55, 'horizon-fog-blend': 0.5, 'sky-horizon-blend': 0.6, 'atmosphere-blend': 0 },
  } as maplibregl.StyleSpecification;
}

function el(cls: string, html: string) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }

export const RiskMap = forwardRef<RiskMapHandle, Props>(function RiskMap(
  { route, points, alternative, evaluation, reports = [], selected, onSelectFlag, mode, camera, showSlope = true, imagery = false, orbit = false, className, label }, ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false); // first complete frame drawn: fade the map in
  const [settling, setSettling] = useState(true); // markers wait until the terrain under them has loaded
  const orbitRef = useRef(orbit);
  orbitRef.current = orbit;
  const selectRef = useRef(onSelectFlag);
  selectRef.current = onSelectFlag;
  const evalRef = useRef(evaluation);
  evalRef.current = evaluation;

  const overview = () => {
    const m = map.current; if (!m) return;
    m.fitBounds(bounds(route), { padding: 60, pitch: 58, bearing: 125, duration: reduced() ? 0 : 1600 });
  };
  const focusFlag = (id: string) => {
    const m = map.current; const f = evalRef.current?.flags.find((x) => x.id === id);
    if (!m || !f) return;
    m.flyTo({ center: f.center, zoom: 14.1, pitch: 60, bearing: 128, duration: reduced() ? 0 : 2200, essential: true });
  };
  useImperativeHandle(ref, () => ({ focusFlag, overview, resize: () => map.current?.resize() }));

  // Create the map once it is near the viewport, so it never competes with the first screen.
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!box.current) return;
    // Building the map is heavy (shaders, terrain, workers). Never start it in the middle of a scroll step:
    // wait until the page is still and the browser has a free moment.
    let timer = 0, idle = 0;
    const start = () => {
      if (scrollState.stepping) { timer = window.setTimeout(start, 180); return; }
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => number }).requestIdleCallback;
      if (ric) idle = ric(() => setNear(true), { timeout: 600 }); else timer = window.setTimeout(() => setNear(true), 60);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); start(); } }, { rootMargin: window.innerWidth < 700 ? '900px 0px' : '200% 0px' }); // phones: later, so the build never lands on a swipe
    io.observe(box.current);
    return () => { io.disconnect(); clearTimeout(timer); (window as unknown as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(idle); };
  }, []);
  useEffect(() => {
    if (!box.current || !near) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: box.current, style: style(), bounds: bounds(route), fitBoundsOptions: { padding: 60 },
        pitch: 58, bearing: 125, maxPitch: 75, attributionControl: { compact: true },
        cooperativeGestures: mode === 'demo' && matchMedia('(pointer: coarse)').matches, interactive: mode === 'demo', canvasContextAttributes: { antialias: true },
      });
    } catch { setFailed(true); return; }
    map.current = m;
    if (import.meta.env.DEV) (window as unknown as { __map: unknown }).__map = m;
    m.scrollZoom.disable(); // until the map is visible, the wheel scrolls the page
    if (mode === 'demo') m.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), 'top-right');
    m.on('load', () => {
      m.setTerrain({ source: 'terrain', exaggeration: 1.25 });
      m.getContainer().dataset.ready = '1';
      setReady(true);
      // Fade in once the first view is complete (or after a few seconds on a slow connection).
      // Fade in once the ground itself is drawn (terrain and shading); the slope colours and contours can
      // fill in on top. On a slow connection, show what there is after 2.5 s.
      let shown = false;
      const show = () => {
        if (shown) return; shown = true;
        setPainted(true); if (mode === 'demo') m.scrollZoom.enable();
        m.off('render', check); window.setTimeout(() => setSettling(false), 1200); // markers: at the next idle, or soon after
      };
      const check = () => { if (m.isSourceLoaded('terrain') && m.isSourceLoaded('shade')) show(); };
      m.on('render', check); m.once('idle', show); window.setTimeout(show, 2500);
    });
    m.on('error', (e) => { if (String(e.error?.message ?? '').includes('WebGL')) setFailed(true); });
    m.on('click', 'flag-line', (e) => { const id = e.features?.[0]?.properties?.id as string | undefined; if (id) selectRef.current?.(id); });
    // Markers are placed from terrain height; re-seat them once the terrain tiles under them have loaded.
    // Markers sit at the terrain height under them. When sharper terrain tiles arrive, that height changes, so
    // re-seat them right away (once per frame at most), not only when the whole map goes idle.
    let reseat = 0;
    const seat = () => { reseat = 0; markers.current.forEach((k) => k.setLngLat(k.getLngLat())); };
    m.on('sourcedata', (e) => { if (e.sourceId === 'terrain' && e.tile && !reseat) reseat = requestAnimationFrame(seat); });
    m.on('idle', () => { seat(); setSettling(false); });
    m.on('mouseenter', 'flag-line', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'flag-line', () => { m.getCanvas().style.cursor = ''; });
    // Slow orbit on the hero, paused while the visitor handles the map.
    let raf = 0, last = 0, held = false;
    const spin = (t: number) => {
      if (orbitRef.current && !held && !reduced() && !m.isMoving()) m.setBearing(m.getBearing() + ((t - last) / 1000) * 1.6);
      last = t; raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    const hold = () => { held = true; };
    m.on('mousedown', hold); m.on('touchstart', hold);
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(reseat); m.remove(); map.current = null; setReady(false); setPainted(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  // Stage mode: the page's scroll position drives the camera.
  useEffect(() => {
    const m = map.current; if (!m || !ready || !camera) return;
    m.easeTo({ ...camera, duration: reduced() ? 0 : camera.duration ?? 1400, essential: true });
  }, [ready, camera]);

  // Data layers.
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    (m.getSource('route') as maplibregl.GeoJSONSource).setData(fc([line(route)]));
    (m.getSource('alt') as maplibregl.GeoJSONSource).setData(fc(alternative ? [line(alternative)] : []));
    (m.getSource('flags') as maplibregl.GeoJSONSource).setData(fc((evaluation?.flags ?? []).map((f) => ({ ...line(f.coords), properties: { id: f.id } }))));
    (m.getSource('noted') as maplibregl.GeoJSONSource).setData(fc((evaluation?.noted ?? []).map((n) => line(n.coords))));
    markers.current.forEach((k) => k.remove());
    markers.current = [];
    const add = (lngLat: number[], node: HTMLElement, anchor: maplibregl.PositionAnchor = 'center') => {
      markers.current.push(new maplibregl.Marker({ element: node, anchor }).setLngLat(lngLat as [number, number]).addTo(m));
    };
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    for (const pt of points ?? routePoints(route, null)) {
      const icon = pt.kind === 'top' ? '<span class="mk-tri"></span>' : pt.kind === 'end' ? '<span class="mk-dot mk-dot-end"></span>' : '<span class="mk-dot"></span>';
      add(pt.lngLat, el('mk mk-point', `${icon}<span class="mk-label">${esc(pt.label)}</span>`), 'left');
    }
    for (const f of evaluation?.flags ?? []) {
      const n = el('mk mk-flag' + (selected === f.id ? ' is-selected' : ''), `<span class="mk-pulse"></span><span class="mk-flag-label">km ${(f.from / 1000).toFixed(2)}–${(f.to / 1000).toFixed(2)}</span>`);
      n.setAttribute('role', 'button'); n.setAttribute('tabindex', '0'); n.setAttribute('aria-label', `Flagged stretch, km ${(f.from / 1000).toFixed(1)}`);
      n.addEventListener('click', () => selectRef.current?.(f.id));
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') selectRef.current?.(f.id); });
      add(f.center, n);
    }
    if (evaluation) for (const r of reports) {
      const used = evaluation.flags.some((f) => f.reports.some((x) => x.id === r.document_id));
      const why = used ? 'Attached to the flagged stretch' : `Set aside. ${evaluation.excludedReports.find((x) => x.id === r.document_id)?.reason ?? ''}`;
      const n = el('mk mk-report' + (used ? ' is-used' : ''), `<span>${r.lang.toUpperCase()}</span>`);
      n.title = `${r.lang.toUpperCase()} report. ${why}`;
      n.setAttribute('aria-label', n.title);
      add(r.point, n);
    }
  }, [ready, route, points, alternative, evaluation, reports, selected]);

  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    m.setLayoutProperty('slope', 'visibility', showSlope ? 'visible' : 'none');
    m.setPaintProperty('slope', 'raster-opacity', mode === 'stage' ? 0.26 : 0.42);
    m.setLayoutProperty('imagery', 'visibility', imagery ? 'visible' : 'none');
    m.setPaintProperty('shade', 'hillshade-exaggeration', imagery ? 0.25 : 0.75);
  }, [ready, showSlope, imagery, mode]);

  useEffect(() => { if (ready && map.current && !camera) { setSettling(true); map.current.fitBounds(bounds(route), { padding: 60, pitch: 58, bearing: 125, duration: 0 }); } }, [ready, route]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`riskmap${painted ? ' is-painted' : ''}${settling ? ' is-settling' : ''} ${className ?? ''}`} data-ui aria-label={label ?? 'Risk map'} role="region">
      <div ref={box} className="riskmap-canvas" />
      {!painted && !failed && <p className="riskmap-loading" aria-hidden="true">Loading terrain…</p>}
      {failed && <p className="riskmap-fallback">The 3D map needs WebGL, which this browser has turned off. The analysis below still works.</p>}
      {showSlope && (
        <div className="slope-legend" aria-label="Slope angle bands">
          {SLOPE_BANDS.map((b) => (
            <span key={b.from}><i style={{ background: `rgb(${b.color.join(',')})` }} />{b.from === 45 ? '45°+' : `${b.from}–${b.to}°`}</span>
          ))}
        </div>
      )}
    </div>
  );
});
