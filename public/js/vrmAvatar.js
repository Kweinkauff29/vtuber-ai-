// public/js/vrmAvatar.js
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.159.0/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMUtils } from 'https://unpkg.com/@pixiv/three-vrm@2.0.3/lib/three-vrm.module.js';

const canvas = document.getElementById('avatarCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
camera.position.set(0, 1.3, 2.2);

scene.add(new THREE.DirectionalLight(0xffffff, 1.2).position.set(1,1,1));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

let vrm, analyser;
const clock = new THREE.Clock();

export function attachAudio(a) { analyser = a; }

function tick() {
  requestAnimationFrame(tick);
  const delta = clock.getDelta();

  if (vrm && analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const open = Math.min(1, (Math.max(...data) - 128) / 40);
    vrm.expressionManager?.setValue('aa', open);
    vrm.expressionManager?.update(delta);
    vrm.update(delta);
  }
  renderer.render(scene, camera);
}
tick();

new GLTFLoader().load('/assets/vrm/AliciaSolid.vrm', (gltf) => {
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  VRM.from(gltf).then(v => {
    vrm = v;
    v.scene.rotation.y = Math.PI; // face camera
    scene.add(v.scene);
  });
}, undefined, (e) => console.warn('VRM load failed—did you put AliciaSolid.vrm in public/assets/vrm/?', e));

window.addEventListener('resize', () => {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
