# VTuber AI – Quick Start (Phase 1)

```bash
# clone repo then…
npm install               # install Node deps
cp .env.example .env      # edit if needed

# (optional) run local Qwen‑3 via vLLM
auth_token=…
vllm serve Qwen/Qwen3-8B  # or point .env at HF Inference API

npm run dev               # start Node server
# open http://localhost:3000 in browser