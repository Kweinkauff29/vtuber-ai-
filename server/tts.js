// server/tts.js
import { KokoroTTS } from "kokoro-js";
import WaveFilePkg from "wavefile";
const { WaveFile } = WaveFilePkg;

let tts;

function floatToInt16(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export async function synth(text, voice = "af_heart") {
  if (!tts) {
    // engine: "onnx", model: small English, quantized on CPU
    tts = await KokoroTTS.fromPretrained("onnx", "kokoro-small-en",
      { dtype: "q8", device: "cpu" }
    );
  }
  const result = await tts.generate(text, { voice }); // returns Float32Array + sampleRate
  const floats     = result.audio ?? result.samples ?? result;
  const sampleRate = result.sampleRate ?? 24000;

  const int16 = floatToInt16(floats);
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, "16", int16);
  return Buffer.from(wav.toBuffer());
}
