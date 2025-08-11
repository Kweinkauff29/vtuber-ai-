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

const LLM_ENDPOINT = process.env.LLM_ENDPOINT ?? "http://localhost:8000/v1/chat/completions";
const MODEL_NAME   = process.env.LLM_MODEL    ?? "Qwen2.5-7B-Instruct";

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [] } = req.body;

    const llm = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {})
      },
      body: JSON.stringify({ model: MODEL_NAME, messages, temperature: 0.8 })
    });
    const data = await llm.json();
    const content = data?.choices?.[0]?.message?.content ?? "(no reply)";

    const audioBuf = await synth(content);
    const audioB64 = audioBuf.toString("base64");
    res.json({ content, audioB64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "LLM backend error" });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`⚡ http://localhost:${PORT}`));
