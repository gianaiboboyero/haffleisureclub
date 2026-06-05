import { Howl } from "howler";

const sounds: Record<string, Howl | undefined> = {};

export function playSound(key: "score" | "complete" | "checkin") {
  if (!sounds[key]) {
    const tone = key === "complete" ? 740 : key === "checkin" ? 520 : 360;
    const wav = makeTone(tone);
    sounds[key] = new Howl({ src: [wav], volume: 0.24 });
  }
  sounds[key]?.play();
}

function makeTone(frequency: number) {
  const sampleRate = 22050;
  const length = sampleRate * 0.12;
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
    const fade = 1 - i / length;
    view.setInt16(44 + i * 2, Math.sin((i / sampleRate) * frequency * Math.PI * 2) * 16000 * fade, true);
  }
  return URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}
