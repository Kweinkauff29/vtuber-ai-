// public/js/chat.js
import { attachAudio } from "./vrmAvatar.js";

const messagesDiv = document.getElementById("messages");
const chatForm    = document.getElementById("chat-form");
const chatInput   = document.getElementById("chat-input");

let history = [
];

let audioCtx, analyser;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    attachAudio(analyser);
  }
}

function addMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = role;
  bubble.textContent = text;
  messagesDiv.appendChild(bubble);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

chatForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = chatInput.value.trim();
  if (!user) return;
  chatInput.value = "";
  addMessage("user", user);
  history.push({ role: "user", content: user });

  const typing = document.createElement("div");
  typing.className = "bot typing";
  typing.textContent = "…";
  messagesDiv.appendChild(typing);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history })
  });

  const { content, audioB64, error } = await r.json();
  typing.remove();
  if (error) return addMessage("bot", `Error: ${error}`);

  addMessage("bot", content);
  history.push({ role: "assistant", content });

  if (audioB64) {
    ensureAudio();
    const buf = Uint8Array.from(atob(audioB64), c => c.charCodeAt(0));
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    source.connect(audioCtx.destination);
    audio.play();
  }
});
