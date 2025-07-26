// public/js/chat.js
const messagesDiv = document.getElementById("messages");
const chatForm    = document.getElementById("chat-form");
const chatInput   = document.getElementById("chat-input");

let history = [
  { role: "system", content: "You are ZanyBot, a chaotic VTuber. Stay PG-13 and witty." }
];

// ---- audio / lip-sync scaffolding ----
let audioCtx, analyser, audioHooked = false;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
  }
  if (!audioHooked) {
    import("./avatar.js").then(m => m.attachAudio(analyser, audioCtx));
    audioHooked = true;
  }
}

function addMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = role;
  bubble.textContent = text;
  messagesDiv.appendChild(bubble);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
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

  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history })
  });

  const { content, audioB64 } = await resp.json();

  typing.remove();
  addMessage("bot", content);
  history.push({ role: "assistant", content });

  if (audioB64) {
    ensureAudio();
    const blob = new Blob(
      [Uint8Array.from(atob(audioB64), c => c.charCodeAt(0))],
      { type: "audio/wav" }
    );
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    source.connect(audioCtx.destination);
    audio.play();
  }
});