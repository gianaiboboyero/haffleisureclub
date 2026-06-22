import { Howl, Howler } from "howler";

const sounds: Record<string, Howl | undefined> = {};
let announcementChime: Howl | undefined;
const SOUND_SETTING_KEY = "haff-sound-enabled";
const VOICE_STYLE_KEY = "haff-announcement-voice-style";
let soundEnabled = localStorage.getItem(SOUND_SETTING_KEY) !== "false";
let unlocked = false;

export type SoundKey = "score" | "complete" | "checkin";
export type VoiceStyle = "british" | "warm" | "clear" | "bright" | "formal";

const voiceProfiles: Record<VoiceStyle, { rate: number; pitch: number; preferred: RegExp; lang?: RegExp }> = {
  british: {
    rate: 1.05,
    pitch: 1.08,
    preferred: /kate|serena|martha|hazel|libby|sonia|fiona|moira|tessa|amy|emma|susan|google.*english.*\(uk\)|google.*en-gb|microsoft.*hazel|microsoft.*libby|microsoft.*sonia|microsoft.*emma|uk english female|en-gb.*female/i,
    lang: /en-gb/i
  },
  warm: { rate: 0.89, pitch: 0.9, preferred: /daniel|aaron|jamie|guy natural|ryan|oliver/ },
  clear: { rate: 0.94, pitch: 1, preferred: /samantha|ava|allison|serena|karen|zoe/ },
  bright: { rate: 0.98, pitch: 1.08, preferred: /google.*us|victoria|susan|zira|aria/ },
  formal: { rate: 0.84, pitch: 0.86, preferred: /alex|tom|fred|david|george|mark/ }
};

const VALID_VOICE_STYLES = new Set<VoiceStyle>(["british", "warm", "clear", "bright", "formal"]);
const storedVoiceStyle = localStorage.getItem(VOICE_STYLE_KEY);
const normalizedStyle = storedVoiceStyle === "warm" ? "british" : storedVoiceStyle;
let voiceStyle: VoiceStyle = VALID_VOICE_STYLES.has(normalizedStyle as VoiceStyle)
  ? (normalizedStyle as VoiceStyle)
  : "british";
if (normalizedStyle === "british" && storedVoiceStyle === "warm") {
  localStorage.setItem(VOICE_STYLE_KEY, "british");
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function getVoiceStyle() {
  return voiceStyle;
}

export function setVoiceStyle(style: VoiceStyle) {
  voiceStyle = style;
  localStorage.setItem(VOICE_STYLE_KEY, style);
}

export async function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  localStorage.setItem(SOUND_SETTING_KEY, String(enabled));
  Howler.mute(!enabled);
  window.dispatchEvent(new CustomEvent("haff-sound-change", { detail: enabled }));
  if (enabled) {
    await unlockAudio();
    playSound("checkin");
  }
}

let voicesLoadPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  if (voicesLoadPromise) return voicesLoadPromise;

  voicesLoadPromise = new Promise((resolve) => {
    const pick = () => window.speechSynthesis.getVoices();
    const existing = pick();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    const onVoicesChanged = () => {
      const loaded = pick();
      if (loaded.length > 0) {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(loaded);
      }
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    // Safari/Chrome sometimes need a nudge before voices populate.
    pick();
    window.setTimeout(() => resolve(pick()), 600);
  });

  return voicesLoadPromise;
}

export async function unlockAudio() {
  if (unlocked) return true;
  try {
    if (Howler.ctx?.state === "suspended") await Howler.ctx.resume();
    Howler.mute(!soundEnabled);
    unlocked = Howler.ctx?.state === "running" || !Howler.usingWebAudio;
    void loadSpeechVoices();
    return unlocked;
  } catch {
    return false;
  }
}

export function speakAnnouncement(message: string) {
  if (!soundEnabled || !("speechSynthesis" in window)) return false;

  if (!announcementChime) {
    announcementChime = new Howl({
      src: [makeChime()],
      format: ["wav"],
      volume: 0.62,
      preload: true
    });
  }

  window.setTimeout(() => {
    try {
      window.speechSynthesis.cancel();
      void loadSpeechVoices().then((voices) => {
        const utterance = new SpeechSynthesisUtterance(message);
        const profile = voiceProfiles[voiceStyle];
        const preferredVoice = chooseNaturalVoice(voices, profile, voiceStyle);
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.lang = preferredVoice?.lang ?? (profile.lang ? "en-GB" : "en-US");
        utterance.rate = profile.rate;
        utterance.pitch = profile.pitch;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
      });
    } catch (e) {
      console.warn("Speech synthesis failed:", e);
    }
  }, 20);

  void unlockAudio();
  announcementChime.play();
  return true;
}

function chooseNaturalVoice(
  voices: SpeechSynthesisVoice[],
  profile: { preferred: RegExp; lang?: RegExp },
  style: VoiceStyle = voiceStyle
) {
  const englishVoices = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  let candidates = englishVoices.length ? englishVoices : voices;

  if (style === "british") {
    const gbVoices = candidates.filter((voice) => /en-gb/i.test(voice.lang));
    if (gbVoices.length > 0) candidates = gbVoices;
  }

  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    let value = 0;
    if (profile.preferred.test(name)) value += 180;
    if (profile.lang?.test(voice.lang)) value += 220;
    if (/natural|neural|premium|enhanced/.test(name)) value += 100;
    if (/microsoft|apple|google/.test(name)) value += 30;
    if (/daniel|arthur|ryan|oliver|george|james|thomas|male|guy/.test(name)) value -= 140;
    if (/en-ph|filipino/.test(`${voice.lang} ${name}`)) value += 18;
    if (/en-gb/.test(voice.lang.toLowerCase())) value += 40;
    if (voice.default && style !== "british") value += 6;
    return value;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

export function playSound(key: SoundKey) {
  if (!soundEnabled) return;

  if (!sounds[key]) {
    const frequencies = key === "complete" ? [587, 784] : key === "checkin" ? [440, 660] : [330];
    sounds[key] = new Howl({
      src: [makeTone(frequencies)],
      format: ["wav"],
      volume: 0.48,
      preload: true,
      onplayerror() {
        void unlockAudio().then((ready) => {
          if (ready) sounds[key]?.play();
        });
      }
    });
  }
  void unlockAudio();
  sounds[key].play();
}

function makeTone(frequencies: number[]) {
  const sampleRate = 44100;
  const duration = frequencies.length > 1 ? 0.34 : 0.18;
  const length = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeString(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i += 1) {
    const progress = i / length;
    const noteIndex = Math.min(frequencies.length - 1, Math.floor(progress * frequencies.length));
    const noteProgress = (progress * frequencies.length) % 1;
    const attack = Math.min(1, noteProgress / 0.08);
    const release = Math.min(1, (1 - noteProgress) / 0.2);
    const envelope = attack * release;
    const frequency = frequencies[noteIndex];
    const fundamental = Math.sin((i / sampleRate) * frequency * Math.PI * 2);
    const harmonic = Math.sin((i / sampleRate) * frequency * 2 * Math.PI * 2) * 0.18;
    view.setInt16(44 + i * 2, (fundamental + harmonic) * 15000 * envelope, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function makeChime() {
  const sampleRate = 44100;
  const duration = 1.05;
  const length = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeString(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length * 2, true);

  for (let i = 0; i < length; i += 1) {
    const time = i / sampleRate;
    const bell = (start: number, frequency: number) => {
      if (time < start) return 0;
      const age = time - start;
      const decay = Math.exp(-5.4 * age);
      return (
        Math.sin(age * frequency * Math.PI * 2) +
        Math.sin(age * frequency * 2.01 * Math.PI * 2) * 0.34 +
        Math.sin(age * frequency * 3.98 * Math.PI * 2) * 0.12
      ) * decay;
    };
    const sample = bell(0, 659.25) * 0.55 + bell(0.28, 880) * 0.48;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 15000, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}
