// avatar.js – minimal loader + your lip-sync

// The script tag loaded Live2D already; pull the class off the global
const { Live2DModel } = window;            // comes from live2d.min.js

const canvas = document.getElementById("avatarCanvas");
let model, audioAnalyser;

// ---------- Load Kei ----------
(async () => {
  model = await Live2DModel.from("/assets/model/kei_en/Kei.model3.json");

  model.setTextureFlipY(false);            // WebGL coordinate fix
  model.scale = 2.0;                       // zoom
  model.x = 0;                             // centre
  model.y = -0.2;

  startRenderLoop();
})();

// ---------- Render & lip-sync ----------
function startRenderLoop() {
  requestAnimationFrame(startRenderLoop);
  if (!model) return;

  // idle sway
  const t = performance.now() / 1000;
  model.internalModel.parameters.setValueById(
    "ParamAngleY",
    Math.sin(t) * 10
  );

  // mouth from mic/tts volume
  if (audioAnalyser) {
    const data = new Uint8Array(audioAnalyser.fftSize);
    audioAnalyser.getByteTimeDomainData(data);
    const amp  = Math.max(...data) - 128;       // 0-127
    const open = Math.min(1, amp / 50);
    model.internalModel.parameters.setValueById("ParamMouthOpenY", open);
  }

  model.update();
  model.draw(canvas.getContext("webgl", { premultipliedAlpha: true }));
}

// called by chat.js once it creates an analyser
export function attachAudio(analyserNode) {
  audioAnalyser = analyserNode;
}