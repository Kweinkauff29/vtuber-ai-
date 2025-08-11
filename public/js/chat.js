// public/js/chat.js
import { attachAudio } from "./vrmAvatar.js";

const messagesDiv = document.getElementById("messages");
const chatForm    = document.getElementById("chat-form");
const chatInput   = document.getElementById("chat-input");

let history = [];

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
  bubble.className = role; // "user" or "bot" for UI only
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

  // history for LLM: roles must be "user"/"assistant" only
  history.push({ role: "user", content: user });

  const typing = document.createElement("div");
  typing.className = "bot typing";
  typing.textContent = "…";
  messagesDiv.appendChild(typing);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // send only role + content, never blobs or extra fields
        messages: history.map(m => ({ role: m.role, content: String(m.content) }))
      })
    });

    const { content, audioB64, error } = await res.json();

    typing.remove();

    if (error) {
      addMessage("bot", `Error: ${error}`);
      return;
    }

    addMessage("bot", content);

    // push ONLY assistant text to convo history
    history.push({ role: "assistant", content });

    if (audioB64) {
      ensureAudio();

      // convert base64 -> wav blob
      const binary = atob(audioB64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      source.connect(audioCtx.destination);

      try { await audioCtx.resume(); } catch {}

      audio.play().catch(() => {});
      audio.onended = () => {
        try { source.disconnect(); } catch {}
        URL.revokeObjectURL(url);
      };
    }
  } catch (err) {
    typing.remove();
    addMessage("bot", `Error: ${err?.message || err}`);
  }
});
