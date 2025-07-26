import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { config } from "dotenv";
config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// === ENV ===
const LLM_ENDPOINT = process.env.LLM_ENDPOINT ?? "http://localhost:8000/v1/chat/completions";
const MODEL_NAME   = process.env.LLM_MODEL    ?? "Qwen3-8B-Instruct";

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const body = {
      model: MODEL_NAME,
      messages,
      temperature: 0.8,
      max_tokens: 512,
      stream: false
    };

    const llmRes = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await llmRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "(no reply)";
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "LLM backend error" });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`⚡  Server running at http://localhost:${PORT}`));