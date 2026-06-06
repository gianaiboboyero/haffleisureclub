import { Howl, Howler } from "howler";

const sounds: Record<string, Howl | undefined> = {};
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

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}
