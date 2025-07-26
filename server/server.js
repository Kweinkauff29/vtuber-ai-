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

// === ENV ===
const LLM_ENDPOINT = process.env.LLM_ENDPOINT ?? "http://localhost:8000/v1/chat/completions";
const MODEL_NAME   = process.env.LLM_MODEL    ?? "Qwen3-8B-Instruct";

app.post("/api/chat", async (req, res) => {
  if (process.env.ECHO) {
    const { messages = [] } = req.body;
    const content = (messages.at(-1)?.content || "") + " (echo)";
    const audioBuf = await synth(content);   // ← generate voice even for echo mode
    const audioB64 = audioBuf.toString("base64");
    return res.json({ content, audioB64 });
  }

  try {
    const { messages } = req.body;
    // … fetch LLM reply exactly as before …
    const content = data?.choices?.[0]?.message?.content ?? "(no reply)";

    // NEW: synthesize speech
    const audioBuf = await synth(content);
    const audioB64 = audioBuf.toString("base64");

    res.json({ content, audioB64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "LLM backend error" });
  }
});


const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`⚡  Server running at http://localhost:${PORT}`));