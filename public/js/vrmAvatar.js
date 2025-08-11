// public/js/vrmAvatar.js
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "https://unpkg.com/@pixiv/three-vrm@2.0.6/lib/three-vrm.module.js";

const canvas = document.getElementById("avatarCanvas");

// renderer / scene / camera
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
function sizeCanvas() {
  const w = canvas.clientWidth || 512;
  const h = canvas.clientHeight || 512;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
camera.position.set(0, 1.35, 2.1);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(1, 1, 1);
scene.add(dir);

let vrm, analyser;
export function attachAudio(an) { analyser = an; }

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

loader.load(
  "/assets/vrm/AliciaSolid.vrm",
  (gltf) => {
    vrm = gltf.userData.vrm;
    // tidy for performance
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.removeUnnecessaryJoints(gltf.scene);
    vrm.scene.rotation.y = Math.PI;   // face the camera
    vrm.scene.position.set(0, 0, 0);
    scene.add(vrm.scene);
  },
  undefined,
  (e) => console.error("VRM load error (is the file at /assets/vrm/AliciaSolid.vrm ?):", e)
);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  // idle blink every ~3s
  if (vrm?.expressionManager) {
    const t = performance.now() * 0.001;
    const blinkPulse = (t % 3 < 0.07) ? 1 : 0;
    vrm.expressionManager.setValue("blink", blinkPulse);
  }

  // lip-sync from audio analyser
  if (vrm?.expressionManager && analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i] - 128));
    const open = Math.min(1, max / 50);
    vrm.expressionManager.setValue("aa", open);
    vrm.expressionManager.setValue("ih", open * 0.4);
  }

  const delta = clock.getDelta();
  vrm?.update?.(delta);
  renderer.render(scene, camera);
}
sizeCanvas();
animate();
window.addEventListener("resize", sizeCanvas);
