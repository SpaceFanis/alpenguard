// Runs the terrain worker, falling back to the pre-computed profile for the sample tour if tiles cannot load.
import type { ProfilePoint } from './terrain-math';

export function computeProfile(coords: number[][], onProgress: (f: number) => void, fallback?: ProfilePoint[]) {
  return new Promise<{ profile: ProfilePoint[]; source: 'live' | 'cached' }>((resolve, reject) => {
    const w = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => w.terminate();
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.done / m.total);
      else if (m.type === 'done') { finish(); resolve({ profile: m.profile, source: 'live' }); }
      else if (m.type === 'error') {
        finish();
        if (fallback) resolve({ profile: fallback, source: 'cached' });
        else reject(new Error(m.message));
      }
    };
    w.postMessage({ coords });
  });
}
