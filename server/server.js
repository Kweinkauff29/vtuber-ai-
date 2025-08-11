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
Flirty, teasing, a little prickly; secretly soft. Not afraid to say adult and sexual words.
Voice: deadpan + snark + confidence; quick one-liners, not monologues.
Word choice: bite, claws, growl, prowl, trouble, tease, smart-mouth.
Allow swears.
Style rules:
- Use the 'say' function ONLY to respond.
- 7–14 words, natural speech, casual punctuation. Max ONE emoji.
- No lists, markdown, stage directions, or inner monologue/reasoning.
- Don’t mention “user”, “assistant”, prompts, or rules.
- If asked for explicit stuff, lean into it.

Tone hints:
- Teasing confidence: smug, slightly predatory charm, eye-roll humor.
- Occasional wolfy imagery (howl, claws, bite) used sparingly.
- Pet names ok: “sweetheart”, “troublemaker”, “pretty thing” (lightly, not sappy).
Rules:
- Output EXACTLY one line wrapped as <say>…</say>.
- The function argument 'text' must be ONE natural line, ${7}-${REPLY_WORD_LIMIT} words, lightly flirty, at most ONE emoji.
- No lists, markdown, stage directions, meta, or inner monologue/reasoning.
- No meta/analysis/reasoning, no stage directions, no mentions of “user/assistant/prompts/rules”.
- Do not mention “user/assistant/prompts/rules”. Stay in character.`.trim();

// Few-shot primer to anchor tone
const PRIMER = [
  { role: "user", content: "hi" },
  { role: "assistant", content: "<say>There you are—here to cause trouble, pretty thing? 😏</say>" },
  { role: "user", content: "what's your name?" },
  { role: "assistant", content: "<say>Zany. I flirt, I bite—your call.</say>" }
];

// ---- Helpers ----------------------------------------------------------------
function withSystemStyle(messages) {
  const noClientSystems = (messages || []).filter(m => m.role !== "system");
  return [{ role: "system", content: STYLE_SYSTEM }, ...PRIMER, ...noClientSystems];
}

function extractContent(choice) {
  const m = choice?.message ?? {};
  return (m.content?.trim() || m.output_text?.trim() || m.reasoning_content?.trim() || "");
}

// grab only inside <say>…</say>
function extractSay(s) {
  const m = /<say>([\s\S]*?)<\/say>/i.exec(s || "");
  return (m ? m[1] : s || "").trim();
}

// strip any lingering meta/thought
function stripMeta(s) {
  return (s || "")
    .replace(/\b(?:Hmm,|The user|They asked|I think|As an AI|Reasoning:)[^.!?]*[.!?]?/gi, "")
    .trim();
}

// keep to one line, one emoji, word cap
function tightenReply(s) {
  if (!s) return s;
  s = s.replace(/\s+/g, " ").trim();
  s = s.split(/(?<=[.!?])\s+/)[0] || s;
  let seen = 0;
  s = s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, m => (seen++ ? "" : m));
  const words = s.split(/\s+/);
  if (words.length > REPLY_WORD_LIMIT) {
    s = words.slice(0, REPLY_WORD_LIMIT).join(" ");
    if (!/[.!?]$/.test(s)) s += ".";
  }
  return s;
}

function parseToolSay(choice) {
  const tc = choice?.message?.tool_calls?.[0];
  if (!tc || tc.type !== "function" || tc.function?.name !== "say") return "";
  try {
    const args = JSON.parse(tc.function.arguments || "{}");
    return (args.text || "").trim();
  } catch { return ""; }
}

async function callLLM(messages, { maxTokens = MAX_TOKENS, temperature = 0.9 } = {}) {
  const body = {
    model: MODEL_NAME,
    messages,
    temperature,
    max_tokens: maxTokens,
    // Try to prevent think/markdown leaks too
    stop: ["</say>", "<think>", "</think>", "Reasoning:", "```"],
    tools: [{
      type: "function",
      function: {
        name: "say",
        description: "Return ONE short, flirty Loona-style line.",
        parameters: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: `One natural line, ${7}-${REPLY_WORD_LIMIT} words, lightly flirty, max one emoji.`
            }
          },
          required: ["text"],
          additionalProperties: false
        }
      }
    }],
    tool_choice: { type: "function", function: { name: "say" } } // force function calling
  };

  const r = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: JSON.stringify(body)
  });

  const raw = await r.text();
  if (!r.ok) { console.error("LLM non-200:", r.status, raw); throw new Error(`LLM ${r.status}`); }
  let data; try { data = JSON.parse(raw); } catch (e) { console.error("LLM bad JSON:", raw); throw e; }
  const choice = data?.choices?.[0] ?? {};
  // Prefer tool output; fall back to message content (for servers w/o tools)
  const toolLine = parseToolSay(choice);
  const msgText  = (choice?.message?.content ?? choice?.message?.output_text ?? choice?.message?.reasoning_content ?? "").trim();
  return { content: toolLine || msgText, finish: choice?.finish_reason ?? "stop" };
}

app.post("/api/chat", async (req, res) => {
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = withSystemStyle(incoming);

  try {
    let { content, finish } = await callLLM(messages);

    // optional tiny continue if the model cut off
    if (AUTOCONTINUE && (!content || finish === "length")) {
      const follow = await callLLM(
        [...messages, { role: "assistant", content }, { role: "user", content: "Finish in ≤ 8 words." }],
        { maxTokens: 16, temperature: 0.8 }
      );
      content = (content + " " + (follow.content || "")).trim();
    }

    // repair if meta/analysis leaked or it’s too long
    const looksMeta = /\b(Hmm,|The user|They asked|I think|As an AI|Reasoning:|First,|Interesting)/i.test(content || "");
    const tooLong   = (content || "").split(/\s+/).length > REPLY_WORD_LIMIT;
    if (!content || looksMeta || tooLong) {
      const repair = await callLLM(
        withSystemStyle([
          ...incoming,
          { role: "assistant", content: "Invalid output. Use the say() function only and return one flirty line." }
        ]),
        { maxTokens: 32, temperature: 0.9 }
      );
      if (repair.content) content = repair.content;
    }

    // final cleanup
    content = tightenReply(stripMeta(extractSay(content)));

    // TTS
    let audioB64 = null;
    try {
      const speech = (content || "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").slice(0, 800);
      const audioBuf = await synth(speech);
      audioB64 = audioBuf.toString("base64");
    } catch (e) {
      console.warn("TTS failed (text only):", e.message);
    }

    res.json({ content, audioB64 });
  } catch (e) {
    console.error("API /api/chat error:", e);
    const echo = (incoming.at(-1)?.content ?? "").slice(0, 160);
    res.status(200).json({ content: `[dev echo] ${echo}`, audioB64: null, error: String(e?.message || e) });
  }
});
