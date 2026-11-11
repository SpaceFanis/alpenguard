// Voice input for the plan. Uses the browser's speech recognition where it really works (Chrome, Edge, Safari),
// and falls back to recording + on-device Whisper where it doesn't (Brave, Firefox) or when it fails.
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState =
  | { kind: 'idle' }
  | { kind: 'listening' }                    // native recognition running
  | { kind: 'recording'; seconds: number }   // fallback recorder running
  | { kind: 'loading'; progress: number }    // downloading the on-device model (first time only)
  | { kind: 'transcribing' }
  | { kind: 'error'; message: string };

interface Rec { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null }
type RecCtor = new () => Rec;

const nativeCtor = (): RecCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor; navigator: Navigator & { brave?: unknown } };
  if (w.navigator.brave) return undefined; // Brave exposes the API but has no recognition service
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const MAX_SECONDS = 15;

export function useVoice(onText: (t: string) => void) {
  const [state, setState] = useState<VoiceState>({ kind: 'idle' });
  const worker = useRef<Worker | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const native = useRef<Rec | null>(null);
  const timer = useRef<number>(0);
  const supported = typeof window !== 'undefined' && (!!nativeCtor() || (!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'));

  useEffect(() => () => { worker.current?.terminate(); clearInterval(timer.current); }, []);

  const getWorker = () => {
    if (!worker.current) worker.current = new Worker(new URL('./asr.worker.ts', import.meta.url), { type: 'module' });
    return worker.current;
  };

  const transcribe = useCallback(async (blob: Blob) => {
    setState({ kind: 'transcribing' });
    const ctx = new AudioContext({ sampleRate: 16000 });
    const audio = (await ctx.decodeAudioData(await blob.arrayBuffer())).getChannelData(0);
    void ctx.close();
    const w = getWorker();
    const files = new Map<string, number>();
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') {
        files.set(m.file, m.progress);
        const vals = [...files.values()];
        setState({ kind: 'loading', progress: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) });
      } else if (m.type === 'text') { setState({ kind: 'idle' }); if (m.text) onText(m.text); else setState({ kind: 'error', message: "Didn't catch anything. Try again a little closer to the microphone." }); }
      else if (m.type === 'error') setState({ kind: 'error', message: 'The on-device speech model could not load. Type the plan instead.' });
    };
    w.postMessage({ type: 'run', audio }, [audio.buffer]);
  }, [onText]);

  const startRecorder = useCallback(async () => {
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setState({ kind: 'error', message: 'Microphone access is blocked. Allow it in the address bar, or type the plan.' }); return; }
    getWorker().postMessage({ type: 'warm' }); // start the model download while you speak
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream);
    recorder.current = r;
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); void transcribe(new Blob(chunks, { type: r.mimeType })); };
    r.start();
    let s = 0;
    setState({ kind: 'recording', seconds: 0 });
    timer.current = window.setInterval(() => { s += 1; setState({ kind: 'recording', seconds: s }); if (s >= MAX_SECONDS) r.stop(); }, 1000);
  }, [transcribe]);

  const start = useCallback(() => {
    const Ctor = nativeCtor();
    if (!Ctor) { void startRecorder(); return; }
    const rec = new Ctor();
    native.current = rec;
    rec.lang = 'en-GB'; rec.interimResults = false; rec.continuous = false;
    let got = false;
    rec.onresult = (e) => { got = true; onText(Array.from(e.results).map((r) => r[0].transcript).join(' ')); };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') setState({ kind: 'error', message: 'Microphone access is blocked. Allow it in the address bar, or type the plan.' });
      else if (e.error === 'no-speech') setState({ kind: 'error', message: "Didn't hear anything. Press Speak and talk straight away." });
      else { got = true; void startRecorder(); } // network / service errors: the service isn't there, so record instead
    };
    rec.onend = () => { setState((st) => (st.kind === 'listening' ? { kind: 'idle' } : st)); if (!got) return; };
    setState({ kind: 'listening' });
    rec.start();
  }, [onText, startRecorder]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    native.current?.stop();
  }, []);

  return { state, start, stop, supported };
}
