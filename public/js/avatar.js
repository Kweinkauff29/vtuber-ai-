// Phase 2 – Live2D loader & basic lip‑sync (volume‑based)
import { Live2DCubismFramework as cubism } from "../libs/live2d.min.js";

const canvas = document.getElementById("avatar-canvas");
let model, audioAnalyser, audioCtx;

(async function init() {
  await cubism.CubismFramework.startUp();
  await cubism.CubismFramework.initialize();

  // Load model JSON (change file name if you use a different avatar)
  const modelJsonUrl = "/assets/model/model.json";
  const { Live2DModelWebGL } = await cubism.CubismModel.load(canvas, modelJsonUrl);
  model = Live2DModelWebGL;
  startRenderLoop();
})();

function startRenderLoop() {
  requestAnimationFrame(startRenderLoop);
  if (!model) return;

  // Idle breathing animation (simple sine‑wave on angleY)
  const t = performance.now() / 1000;
  model.setParameterValueById("ParamAngleY", Math.sin(t) * 10);

  // Lip‑sync based on audio volume
  if (audioAnalyser) {
    const data = new Uint8Array(audioAnalyser.fftSize);
    audioAnalyser.getByteTimeDomainData(data);
    const amp = Math.max(...data) - 128; // crude amplitude
    const mouth = Math.min(1, amp / 50);
    model.setParameterValueById("ParamMouthOpenY", mouth);
  }

  model.update();
  model.draw(canvas.getContext("webgl"));
}

// Expose hook to chat.js so it can pass AudioContext when TTS is implemented
export function attachAudio(analyserNode, audioContext) {
  audioAnalyser = analyserNode;
  audioCtx = audioContext;
}