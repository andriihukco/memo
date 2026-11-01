/**
 * Live on-device transcription. Needs a development build: Expo Go does not
 * bundle expo-speech-recognition, so we probe for it and fall back to typing.
 */

export interface SpeechHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

type SpeechModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: { lang: string; interimResults: boolean; continuous: boolean }) => void;
  stop: () => void;
  addListener: (
    event: 'result' | 'error' | 'end',
    cb: (e: { results?: { transcript: string }[]; isFinal?: boolean; message?: string }) => void,
  ) => { remove: () => void };
};

function loadModule(): SpeechModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
  } catch {
    return null;
  }
}

export function isLiveSpeechAvailable(): boolean {
  return loadModule() !== null;
}

/** Starts recognition and returns a stop function. Returns null when unavailable. */
export async function startLiveTranscription(lang: string, h: SpeechHandlers): Promise<(() => void) | null> {
  const mod = loadModule();
  if (!mod) return null;

  const perm = await mod.requestPermissionsAsync();
  if (!perm.granted) {
    h.onError('Microphone or speech permission was denied');
    return null;
  }

  const subs = [
    mod.addListener('result', (e) => {
      const text = e.results?.[0]?.transcript ?? '';
      if (e.isFinal) h.onFinal(text);
      else h.onPartial(text);
    }),
    mod.addListener('error', (e) => h.onError(e.message ?? 'Recognition error')),
    mod.addListener('end', () => {
      subs.forEach((s) => s.remove());
      h.onEnd();
    }),
  ];

  mod.start({ lang, interimResults: true, continuous: true });
  return () => mod.stop();
}
