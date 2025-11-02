# ATS AI Resume Builder (Next.js + Vercel)

A modern, end-to-end website that lets users:
- **Upload** existing resumes (PDF/DOCX) → **AI-extract** sections/data
- **Paste a Job Description** → **Analyze & compute a match score**
- **Generate ATS-friendly resumes & cover letters** tailored to that JD using an **OpenAI-compatible API** (Groq / xAI Grok / OpenAI)
- **Download** high-quality **DOCX or PDF** using built-in templates
- **Beautiful, clean UI** with **3D animation** (react-three-fiber) and a premium feel
- **One-click deploy** to **Vercel**

> This starter is production-ready but kept intentionally lightweight. Extend as needed.

## Quick Start

1) **Install**:
```bash
pnpm i   # or npm i / yarn
```

2) **Environment**: copy `.env.example` → `.env.local` and fill keys:
```bash
cp .env.example .env.local
```

- `AI_BASE_URL`: The base URL for an OpenAI-compatible endpoint.
  - **Groq**: `https://api.groq.com/openai/v1`
  - **xAI Grok**: If their endpoint supports OpenAI-style Chat Completions, set it here (e.g. `https://api.x.ai/v1`).
  - **OpenAI**: `https://api.openai.com/v1`
- `AI_API_KEY`: Secret key for the provider.
- `AI_MODEL`: Model name (e.g., `llama-3.1-70b-versatile` for Groq, or a Grok/OpenAI model).
- `EMBEDDINGS_BASE_URL` / `EMBEDDINGS_API_KEY` / `EMBEDDINGS_MODEL` (optional): If you want embedding-based similarity instead of TF-IDF.

3) **Run Dev**:
```bash
pnpm dev
```

4) **Deploy to Vercel**:
- Push to GitHub
- Click "New Project" in Vercel and import repo
- Add the **Environment Variables** from `.env.example`
- Deploy! ✨

## Features

- **Upload & Parse**
  - PDF → `pdf-parse`
  - DOCX → `mammoth`
- **AI Provider Adapter** (OpenAI-compatible):
  - Works with Groq / xAI Grok / OpenAI via `AI_BASE_URL` + `AI_API_KEY`
- **Match Score**
  - Default: TF-IDF cosine similarity (no external embeddings)
  - Optional: Embeddings (set EMBEDDINGS_* envs)
- **Export**
  - DOCX → `docx` library
  - PDF → `pdf-lib`
- **UI**
  - Next.js App Router, Tailwind CSS, Framer Motion
  - 3D Hero (react-three-fiber + drei + three)
- **Vercel-ready** (NodeJS runtime functions)

## Security & Notes

- Never commit your `.env.local`.
- This project avoids non-portable binaries where possible.
- If your provider’s API is not strictly OpenAI-compatible, adjust `/lib/ai.ts` accordingly.

## Folder Structure

```
app/                # Next.js (App Router)
  api/              # Serverless API routes
  dashboard/
components/         # UI components
lib/                # Server utilities (AI, parsing, scoring, export helpers)
public/             # Static assets
types/              # Custom type declarations (e.g., pdf-parse)
```

## License
MIT – Use freely, modify, and build your business. Good luck!
