import { Howl, Howler } from "howler";

const sounds: Record<string, Howl | undefined> = {};
let announcementChime: Howl | undefined;
const SOUND_SETTING_KEY = "haff-sound-enabled";
let soundEnabled = localStorage.getItem(SOUND_SETTING_KEY) !== "false";
let unlocked = false;

export type SoundKey = "score" | "complete" | "checkin";

export function isSoundEnabled() {
  return soundEnabled;
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

export async function unlockAudio() {
  if (unlocked) return true;
  try {
    if (Howler.ctx?.state === "suspended") await Howler.ctx.resume();
    Howler.mute(!soundEnabled);
    unlocked = Howler.ctx?.state === "running" || !Howler.usingWebAudio;
    return unlocked;
  } catch {
    return false;
  }
}

export function speakAnnouncement(message: string) {
  if (!soundEnabled || !("speechSynthesis" in window)) return false;

  window.speechSynthesis.cancel();
  if (!announcementChime) {
    announcementChime = new Howl({
      src: [makeChime()],
      format: ["wav"],
      volume: 0.62,
      preload: true
    });
  }

  const speak = () => {
    window.setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(message);
      const preferredVoice = chooseNaturalVoice(window.speechSynthesis.getVoices());
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.lang = preferredVoice?.lang ?? "en-US";
      utterance.rate = 0.89;
      utterance.pitch = 0.9;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }, 420);
  };

  announcementChime.once("end", speak);
  announcementChime.once("playerror", speak);
  announcementChime.play();
  return true;
}

function chooseNaturalVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  const candidates = englishVoices.length ? englishVoices : voices;
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    let value = 0;
    if (/daniel|aaron|jamie|guy natural|ryan|oliver/.test(name)) value += 180;
    if (/natural|neural|premium|enhanced/.test(name)) value += 100;
    if (/alex|tom|fred/.test(name)) value += 35;
    if (/microsoft|apple|google/.test(name)) value += 30;
    if (/en-ph|filipino/.test(`${voice.lang} ${name}`)) value += 18;
    if (/en-us|en-gb|en-au/.test(voice.lang.toLowerCase())) value += 12;
    if (voice.default) value += 6;
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
