// server/tts.js
import { KokoroTTS } from "kokoro-js";
import WaveFilePkg from "wavefile";
const { WaveFile } = WaveFilePkg;

// server/tts.js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env as hfenv } from "@huggingface/transformers";

const HF_CACHE =
  process.env.HF_HOME ||
  process.env.HUGGINGFACE_HUB_CACHE ||
  process.env.TRANSFORMERS_CACHE ||
  path.join(os.homedir() || process.cwd(), ".hf-cache");

fs.mkdirSync(HF_CACHE, { recursive: true });
hfenv.cacheDir = HF_CACHE;


let tts;

function floatToInt16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

const MODEL_ID = process.env.KOKORO_MODEL_ID || "onnx-community/Kokoro-82M-ONNX";
const DTYPE    = process.env.KOKORO_DTYPE    || "q8"; // fp32|fp16|q8|q4|q4f16

export async function synth(text, voice = "af_heart") {
  if (!tts) tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE });
  const r = await tts.generate(text, { voice });       // Float32Array + sampleRate
  const floats = r.audio ?? r.samples ?? r;
  const sr     = r.sampleRate ?? r.sample_rate ?? 24000;

  const pcm16 = floatToInt16(floats);
  const wav = new WaveFile();
  wav.fromScratch(1, sr, "16", pcm16);
  return Buffer.from(wav.toBuffer());
}
