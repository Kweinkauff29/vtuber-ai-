const messagesDiv = document.getElementById("messages");
const chatForm    = document.getElementById("chat-form");
const chatInput   = document.getElementById("chat-input");

let history = [
  { role: "system", content: "You are ZanyBot, a chaotic VTuber. Stay PG‑13 and witty." }
];

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

  // typing indicator
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
  const { content } = await resp.json();

  typing.remove();
  addMessage("bot", content);
  history.push({ role: "assistant", content });
});