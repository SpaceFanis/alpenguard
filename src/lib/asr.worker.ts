/// <reference lib="webworker" />
// On-device speech-to-text (Whisper base, English) for browsers whose built-in speech recognition
// has no service behind it (Brave, Firefox, some Chromium builds). Audio never leaves the device.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
function load() {
  asr ??= pipeline('automatic-speech-recognition', 'onnx-community/whisper-base.en', {
    dtype: 'q8',
    progress_callback: (p: { status: string; progress?: number; file?: string }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') self.postMessage({ type: 'progress', file: p.file, progress: p.progress });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  return asr;
}

self.onmessage = async (e: MessageEvent<{ type: 'warm' } | { type: 'run'; audio: Float32Array }>) => {
  try {
    const run = await load();
    if (e.data.type === 'warm') { self.postMessage({ type: 'ready' }); return; }
    const out = await run(e.data.audio);
    const text = (Array.isArray(out) ? out[0] : out).text.trim();
    self.postMessage({ type: 'text', text });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message });
  }
};
