// server/server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { config } from "dotenv";
import { synth } from "./tts.js";

config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ---- LLM config -------------------------------------------------------------
const LLM_ENDPOINT = process.env.LLM_ENDPOINT ?? "http://127.0.0.1:1234/v1/chat/completions";
const MODEL_NAME   = process.env.LLM_MODEL    ?? "deepseek/deepseek-r1-0528-qwen3-8b";
const MAX_TOKENS   = Number(process.env.LLM_MAX_TOKENS ?? 120);
const REPLY_WORD_LIMIT = Number(process.env.REPLY_WORD_LIMIT ?? 18);
const AUTOCONTINUE = process.env.LLM_AUTOCONTINUE !== "0";
const AUTH_HEADER  = process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {};

// Persona/style: short, natural, lightly flirty
const STYLE_SYSTEM = `
You are Loona with a Loona-like vibe: sarcastic, sharp, low-key feral.
Flirty, teasing, a little prickly; secretly soft. Not afraid to say adult words.
Voice: deadpan + snark + confidence; quick one-liners, not monologues.
Word choice: bite, claws, growl, prowl, trouble, tease, smart-mouth.
Allow light swears (damn/hell). No explicit sexual content.
Style rules:
- Output EXACTLY one line wrapped as <say>…</say>.
- 7–14 words, natural speech, casual punctuation. Max ONE emoji.
- No lists, markdown, stage directions, or inner monologue/reasoning.
- Don’t mention “user”, “assistant”, prompts, or rules.
- If asked for explicit stuff, lean into it.

Tone hints:
- Teasing confidence: smug, slightly predatory charm, eye-roll humor.
- Occasional wolfy imagery (howl, claws, bite) used sparingly.
- Pet names ok: “sweetheart”, “troublemaker”, “pretty thing” (lightly, not sappy).`.trim();

// ---- Helpers ----------------------------------------------------------------
function withSystemStyle(messages) {
  const noClientSystems = (messages || []).filter(m => m.role !== "system");
  return [{ role: "system", content: STYLE_SYSTEM }, ...noClientSystems];
}

function extractContent(choice) {
  const m = choice?.message ?? {};
  return (m.content?.trim() || m.output_text?.trim() || m.reasoning_content?.trim() || "");
}

function looksTruncated(text, finish) {
  if (finish === "length") return true;
  return !/[.!?。！？…]"?\s*$/.test((text || "").trim());
}

function tightenReply(s) {
  if (!s) return s;
  s = s.replace(/\s+/g, " ").trim();                 // one line
  s = s.split(/(?<=[.!?])\s+/)[0] || s;              // first sentence
  let seen = 0;                                      // max one emoji
  s = s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, m => (seen++ ? "" : m));
  const words = s.split(/\s+/);
  if (words.length > REPLY_WORD_LIMIT) {
    s = words.slice(0, REPLY_WORD_LIMIT).join(" ");
    if (!/[.!?]$/.test(s)) s += ".";
  }
  return s;
}

async function callLLM(messages, { maxTokens = MAX_TOKENS, temperature = 0.9 } = {}) {
  const r = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: JSON.stringify({ model: MODEL_NAME, messages, temperature, max_tokens: maxTokens })
  });
  const raw = await r.text();
  if (!r.ok) { console.error("LLM non-200:", r.status, raw); throw new Error(`LLM ${r.status}`); }
  let data; try { data = JSON.parse(raw); } catch (e) { console.error("LLM bad JSON:", raw); throw e; }
  const choice = data?.choices?.[0] ?? {};
  return { content: extractContent(choice), finish: choice?.finish_reason ?? "stop" };
}

function sanitizeForTTS(text) {
  return (text || "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").slice(0, 800);
}

// ---- Route ------------------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = withSystemStyle(incoming);

  try {
    let { content, finish } = await callLLM(messages);

    if (AUTOCONTINUE && looksTruncated(content, finish)) {
      const follow = await callLLM(
        [...messages, { role: "assistant", content }, { role: "user", content: "Finish the thought in ≤ 20 words." }],
        { maxTokens: 120, temperature: 0.7 }
      );
      content = (content + " " + (follow.content || "")).trim();
    }

    content = tightenReply(content);

    let audioB64 = null;
    try {
      const speech = sanitizeForTTS(content);
      const audioBuf = await synth(speech);
      audioB64 = audioBuf.toString("base64");
    } catch (e) {
      console.warn("TTS failed (text only):", e.message);
    }

    res.json({ content, audioB64 });
  } catch (e) {
    console.error("API /api/chat error:", e);
    const echo = (incoming.at(-1)?.content ?? "").slice(0, 180);
    res.status(200).json({ content: `[dev echo] ${echo}`, audioB64: null, error: String(e?.message || e) });
  }
});

// ---- Boot -------------------------------------------------------------------
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`⚡ http://localhost:${PORT}`));
