/**
 * Generates lightweight retro arena SFX as WAV files for Howler.js.
 * Run: node scripts/generate-sounds.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "sounds");
const SAMPLE_RATE = 44100;

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let peak = 0;
  for (let i = 0; i < numSamples; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(clamped * 32767), 44 + i * 2);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, filename), buffer);

  if (peak < 0.01) {
    console.warn(`  warning: ${filename} is nearly silent (peak=${peak.toFixed(4)})`);
  }

  return peak;
}

/** Envelope in seconds (attack/release from start/end of clip). */
function env(i, total, attackSec = 0.01, releaseSec = 0.12) {
  const t = i / SAMPLE_RATE;
  const dur = total / SAMPLE_RATE;
  const attack = Math.min(1, t / Math.max(attackSec, 0.0001));
  const release = Math.min(1, (dur - t) / Math.max(releaseSec, 0.0001));
  return Math.max(0, Math.min(attack, release));
}

function sine(freq, duration, volume = 0.4, attackSec = 0.005, releaseSec = 0.12) {
  const total = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    out[i] =
      Math.sin(2 * Math.PI * freq * t) *
      volume *
      env(i, total, attackSec, releaseSec);
  }
  return out;
}

function noise(duration, volume = 0.25, attackSec = 0.001, releaseSec = 0.06) {
  const total = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    out[i] =
      (Math.random() * 2 - 1) *
      volume *
      env(i, total, attackSec, releaseSec);
  }
  return out;
}

function mix(...arrays) {
  const len = Math.max(...arrays.map((a) => a.length));
  const out = new Float32Array(len);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) out[i] += arr[i];
  }
  for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}

function seq(...parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** ~3.5s arena fanfare when a match is found. */
function matchFoundStinger() {
  return seq(
    mix(sine(196, 0.14, 0.22), sine(261.63, 0.14, 0.18)),
    mix(sine(392, 0.16, 0.28), sine(493.88, 0.16, 0.22)),
    mix(sine(523.25, 0.18, 0.32), sine(659.25, 0.18, 0.26)),
    mix(sine(783.99, 0.22, 0.34), sine(987.77, 0.22, 0.28)),
    seq(
      sine(1046.5, 0.28, 0.36),
      sine(1318.51, 0.35, 0.32),
      sine(1567.98, 0.55, 0.26, 0.01, 0.35)
    )
  );
}

const sounds = {
  "ui-click.wav": mix(sine(880, 0.04, 0.25), noise(0.02, 0.08)),
  "ui-tab.wav": sine(660, 0.06, 0.2, 0.002, 0.04),
  "ui-nav.wav": sine(520, 0.05, 0.18, 0.003, 0.035),
  "ui-success.wav": seq(
    sine(523, 0.08, 0.28),
    sine(659, 0.08, 0.28),
    sine(784, 0.12, 0.32)
  ),
  "ui-error.wav": mix(
    sine(180, 0.2, 0.35, 0.005, 0.1),
    sine(140, 0.25, 0.2, 0.005, 0.12)
  ),
  "game-move.wav": mix(sine(220, 0.06, 0.22), noise(0.04, 0.12)),
  "game-capture.wav": mix(
    sine(160, 0.1, 0.35),
    noise(0.08, 0.2),
    sine(90, 0.12, 0.15)
  ),
  "game-drop.wav": mix(
    sine(440, 0.05, 0.2, 0.002, 0.05),
    sine(330, 0.08, 0.25, 0.002, 0.08)
  ),
  "game-select.wav": sine(740, 0.05, 0.22, 0.002, 0.035),
  "match-found.wav": seq(
    sine(392, 0.1, 0.3),
    sine(523, 0.1, 0.32),
    sine(659, 0.1, 0.34),
    sine(784, 0.2, 0.36)
  ),
  "match-start.wav": seq(
    sine(220, 0.15, 0.25),
    sine(330, 0.15, 0.28),
    sine(440, 0.25, 0.32)
  ),
  "queue-pulse.wav": sine(440, 0.08, 0.12, 0.008, 0.05),
  "loader-complete.wav": seq(sine(523, 0.1, 0.28), sine(784, 0.2, 0.32)),
  "chat-message.wav": seq(
    sine(880, 0.05, 0.22, 0.002, 0.04),
    sine(1174.66, 0.07, 0.26, 0.002, 0.06)
  ),
};

/** 8s seamless retro arena lobby loop. */
function lobbyAmbient() {
  const duration = 8;
  const total = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(total);

  const chordAt = (t) => {
    const bar = Math.floor(t / 2) % 4;
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
    ];
    return chords[bar];
  };

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const freqs = chordAt(t);
    const swell = 0.65 + 0.35 * Math.sin(2 * Math.PI * (1 / 8) * t);
    const pulse = 0.88 + 0.12 * Math.sin(2 * Math.PI * (2 / 8) * t);

    let sample = 0;
    for (const f of freqs) {
      sample += Math.sin(2 * Math.PI * f * t) * 0.07;
    }
    sample += Math.sin(2 * Math.PI * 440 * t) * 0.025;
    sample += Math.sin(2 * Math.PI * 880 * t + Math.sin(2 * Math.PI * 0.5 * t)) * 0.018;

    const beat = Math.floor(t * 2) % 2 === 0 ? 1 : 0.92;
    out[i] = sample * swell * pulse * beat;
  }

  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(out[i]));
  for (let i = 0; i < total; i++) out[i] = (out[i] / peak) * 0.55;

  return out;
}

sounds["lobby-ambient.wav"] = lobbyAmbient();
sounds["match-found-stinger.wav"] = matchFoundStinger();

for (const [name, samples] of Object.entries(sounds)) {
  const peak = writeWav(name, samples);
  const dur = (samples.length / SAMPLE_RATE).toFixed(2);
  console.log(`Wrote ${name} (${dur}s, peak=${peak.toFixed(3)})`);
}

console.log("Done —", Object.keys(sounds).length, "sounds in public/sounds/");
