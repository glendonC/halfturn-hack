#!/usr/bin/env node
/**
 * Generates assets/sounds/beep.wav — the directionless reaction-anchor beep used
 * by turn-and-react mode (a short 880Hz tone with attack/decay so it doesn't
 * click). Committed as an asset; re-run `node scripts/gen-beep.js` to regenerate.
 */
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationSec = 0.16;
const freq = 880; // A5 — cuts through ambient field noise
const n = Math.floor(sampleRate * durationSec);
const bytesPerSample = 2;
const dataSize = n * bytesPerSample;

const buf = Buffer.alloc(44 + dataSize);
let o = 0;
buf.write('RIFF', o); o += 4;
buf.writeUInt32LE(36 + dataSize, o); o += 4;
buf.write('WAVE', o); o += 4;
buf.write('fmt ', o); o += 4;
buf.writeUInt32LE(16, o); o += 4; // PCM fmt chunk size
buf.writeUInt16LE(1, o); o += 2; // audio format = PCM
buf.writeUInt16LE(1, o); o += 2; // channels = mono
buf.writeUInt32LE(sampleRate, o); o += 4;
buf.writeUInt32LE(sampleRate * bytesPerSample, o); o += 4; // byte rate
buf.writeUInt16LE(bytesPerSample, o); o += 2; // block align
buf.writeUInt16LE(16, o); o += 2; // bits per sample
buf.write('data', o); o += 4;
buf.writeUInt32LE(dataSize, o); o += 4;

const attack = Math.floor(n * 0.08);
const release = Math.floor(n * 0.3);
for (let i = 0; i < n; i += 1) {
  let env = 1;
  if (i < attack) env = i / attack;
  else if (i > n - release) env = (n - i) / release;
  const s = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * env * 0.6;
  const clamped = Math.max(-1, Math.min(1, s));
  buf.writeInt16LE(Math.round(clamped * 32767), o); o += 2;
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'beep.wav');
fs.writeFileSync(outFile, buf);
console.log(`wrote ${outFile} (${buf.length} bytes)`);
