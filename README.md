```text
   ██╗   ██╗ ██████╗ ██╗  ██╗ ██████╗ ██████╗  █████╗ 
   ██║   ██║██╔═══██╗╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗
   ██║   ██║██║   ██║ ╚███╔╝ ██║   ██║██████╔╝███████║
   ╚██╗ ██╔╝██║   ██║ ██╔██╗ ██║   ██║██╔══██╗██╔══██║
    ╚████╔╝ ╚██████╔╝██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║
     ╚═══╝   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
```

<div align="center">

**Upload meeting audio, get a transcript, and leave with a summary.**

[🔴 Live Demo](https://voxora-frontend.onrender.com) **·** [📦 Source Code](https://github.com/tony19053000/voxora)

---

*Browser-based meeting transcription and summarization. No installs. No onboarding. Just results.*

</div>

---

## The Simplest Version of This Problem

Here's what happens after most meetings:

> Someone says "I'll send notes." Nobody sends notes. Two days later, half the team remembers a different version of what was agreed on. Someone eventually digs up the recording, scrubs through forty minutes of audio looking for the three sentences that actually mattered, and types them into Slack.

There are tools that solve this. Most of them solve it by asking you to install a desktop app, connect your calendar, grant microphone permissions, sit through an onboarding wizard, and subscribe to a workspace plan — all before you've transcribed a single file.

That's solving a ten-second problem with a ten-minute setup.

**Voxora strips all of that away.**

You open a browser tab. You upload the audio file. The backend transcribes it and generates a structured summary. You read the summary, grab what you need, and move on. The entire workflow — from "I have a recording" to "I have usable notes" — happens in one page, in under a minute, with zero setup.

---

## How It Works

```text
   ┌──────────────────────┐
   │   Upload Audio File   │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │   Next.js Frontend    │
   │   → file selection    │
   │   → upload handling   │
   └──────────┬───────────┘
              │
              ▼
   ┌───────────────────────────────┐
   │  FastAPI Backend               │
   │  → validate & receive file     │
   │  → route to transcription      │
   └──────────┬────────────────────┘
              │
              ▼
   ┌───────────────────────────────┐
   │  Speech-to-Text                │
   │  → OpenAI / Groq              │
   │  → auto-fallback if needed    │
   └──────────┬────────────────────┘
              │
              ▼
   ┌───────────────────────────────┐
   │  Summary Generation            │
   │  → structured meeting summary  │
   │  → chunked for long recordings │
   └──────────┬────────────────────┘
              │
              ▼
   ┌───────────────────────────────┐
   │  Results Returned to Browser   │
   │  → full transcript             │
   │  → structured summary          │
   └───────────────────────────────┘
```

One API call handles the full pipeline. The user uploads audio, the backend transcribes it, generates a summary from the transcript, and returns both in a single response. No polling, no async status pages, no "check back in five minutes."

---

## Features

Voxora is intentionally small. It does one workflow and removes every obstacle between the user and the result:

**`Upload-First Design`** — Drop a meeting recording into the browser. No desktop app, no microphone permissions, no calendar integrations. If you have the file, you're ready.

**`Full Transcript Generation`** — Converts meeting audio to text using cloud transcription providers. The entire recording becomes searchable, quotable text.

**`Structured Summary`** — Produces a meeting summary from the transcript so you can scan the key points in thirty seconds instead of replaying forty minutes of audio.

**`Provider Flexibility`** — Supports both OpenAI and Groq for transcription and summarization. When configured in `auto` mode, the system falls back gracefully if a provider is unavailable — no silent failures, no broken responses.

**`Long Recording Handling`** — Transcripts from lengthy meetings are chunked before summarization, so the AI processes manageable segments instead of hitting token limits and truncating the output.

**`Health Monitoring`** — Includes a `/health` endpoint for deployment verification and uptime checks.

**`Split Deployment`** — Frontend and backend are fully decoupled and deploy independently on Render with environment-based wiring.

---

## Tech Stack

```text
┌────────────────────────────────────────────┐
│                Voxora Stack                │
├──────────────┬─────────────────────────────┤
│  Frontend    │  Next.js                    │
│  Backend     │  FastAPI, Python            │
│  AI Layer    │  OpenAI, Groq               │
│  Runtime     │  Uvicorn                    │
│  Hosting     │  Render (dual service)      │
└──────────────┴─────────────────────────────┘
```

Next.js handles the browser-side upload flow and result display. FastAPI powers the backend — file validation, provider routing, transcription orchestration, summary generation, and error handling all live here. OpenAI and Groq serve as the transcription and summarization providers, with automatic fallback logic so the system stays functional even when one provider is down. Uvicorn runs the backend in production, and both services deploy independently on Render.

---

## Local Setup

Run the project in two terminals.

**Clone the repository:**

```bash
git clone https://github.com/tony19053000/voxora.git
cd voxora
```

**Start the backend** (terminal 1):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
DEFAULT_AI_PROVIDER=auto
CORS_ORIGINS=http://localhost:3118
MAX_UPLOAD_MB=25
SUMMARY_CHUNK_CHARS=12000
SUMMARY_CHUNK_OVERLAP=500
```

Then run:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 5167 --reload
```

**Start the frontend** (terminal 2):

```bash
cd frontend
corepack enable
pnpm install
pnpm dev
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5167
```

Open [http://localhost:3118](http://localhost:3118) and upload a recording.

---

## Deployment

Voxora deploys as two independent services on **Render**.

**Backend** — deploy as a Web Service with root directory `backend`, build command `pip install -r requirements.txt`, and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `OPENAI_API_KEY`, `GROQ_API_KEY`, `DEFAULT_AI_PROVIDER`, and `CORS_ORIGINS` (pointing to your frontend URL) as environment variables.

**Frontend** — deploy as a Static Site with root directory `frontend`, build command `corepack enable && pnpm install --no-frozen-lockfile && pnpm build`, and publish directory `out`. Set `NEXT_PUBLIC_API_BASE_URL` to your backend's production URL.

Once both services are live and the environment variables are wired together, the app is production-ready.

---

## Why This Project Matters

The meeting transcription space is crowded with tools that try to own the entire workflow — recording, live captioning, speaker identification, CRM integration, action item tracking, calendar sync. Those tools serve a real market. But they also assume every user wants a platform.

Voxora is built around a different assumption: that a large number of users just want to go from "I have a recording" to "I have notes" as fast as possible, with as little setup as possible.

That constraint — keeping the scope deliberately narrow — is actually what makes the project interesting from an engineering perspective. The backend had to handle provider fallback logic cleanly so a single-endpoint API could stay reliable. Long recordings had to be chunked before summarization to avoid token limit failures. The frontend and backend had to be fully decoupled for independent deployment. And the entire system had to work without accounts, onboarding, or persistent state — which means every request is self-contained and every error path has to resolve gracefully in real time.

That's the difference between a demo that calls a transcription API and a product that someone can actually open in a browser and use. Voxora is the latter.

---

## License & Attribution

This repository is distributed under the **MIT License**. See [`LICENSE.md`](LICENSE.md) for details.

This project includes work based on an earlier MIT-licensed open-source codebase. Required license material and attribution-sensitive files have been preserved where needed.

---

<div align="center">

**Upload. Transcribe. Summarize. Done.**

[Try Voxora →](https://voxora-frontend.onrender.com)

</div>
