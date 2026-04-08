# MeetMind

MeetMind is a meeting intelligence workspace for uploading recordings, capturing live audio, or pasting transcript text and turning that input into:

- clean transcript lines
- executive summary
- action items
- decisions
- participant sentiment

The project is built as a hybrid app:

- browser UI in [index.html](./index.html), [style.css](./style.css), and [app.js](./app.js)
- local Node server in [server.js](./server.js)
- optional local Python transcription helper in [tools/faster_whisper_transcribe.py](./tools/faster_whisper_transcribe.py)

## Processing Modes

MeetMind can run in three practical modes:

1. Hybrid mode
OpenAI is configured and the local Python stack is also ready. MeetMind can use cloud processing first and keep local fallback available.

2. Cloud mode
OpenAI is configured, but the local Python stack is not fully available. This is the best choice for future hosted deployment.

3. Local mode
OpenAI is not configured, but the local Python stack is ready. MeetMind can still transcribe files locally and generate local fallback analysis.

## Quick Start

### 1. Create your environment file

Copy [`.env.example`](./.env.example) to `.env`.

You can run the app in either of these ways:

- Cloud or hybrid setup: set `OPENAI_API_KEY`
- Local-only setup: leave `OPENAI_API_KEY` empty and install the Python transcription stack

### 2. Install Node.js

Use Node.js 18 or later.

There is no required npm dependency install for the main app right now because the server uses built-in Node modules.

### 3. Optional: install the local transcription stack

Create a virtual environment if you want a clean local setup:

```powershell
py -3.12 -m venv .venv312
.venv312\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-local.txt
```

Optional speaker diarization:

```powershell
pip install -r requirements-diarization.txt
```

If you want local speaker diarization, also add `HUGGINGFACE_TOKEN` to `.env`.

### 4. Run diagnostics

Before starting the app, you can validate the environment:

```powershell
npm run doctor
```

This reports whether OpenAI is configured, whether Python is available, and whether the local transcription packages were detected.

You can also run a quick smoke test for the app shell and core API flow:

```powershell
npm test
```

This checks that the server boots, the homepage renders, and pasted transcript processing still works.

### 5. Start the app

```powershell
node server.js
```

Or on Windows:

- double-click [start-meetmind.bat](./start-meetmind.bat)

Then open:

- `http://localhost:3000`

Do not open `index.html` directly as a `file://` page.

## Public Demo Link

For quick sharing from your own computer, use:

- [start-meetmind-public.bat](./start-meetmind-public.bat)

This starts the local server and opens a temporary public tunnel. Keep both command windows open while the link is in use.

## Environment Variables

Important variables in [`.env.example`](./.env.example):

- `OPENAI_API_KEY`: enables cloud analysis and cloud transcription
- `MEETMIND_MEDIA_PROCESSING_MODE`: `auto`, `openai`, or `local`
- `MEETMIND_OPENAI_TIMEOUT_MS`: request timeout for OpenAI calls in milliseconds
- `MEETMIND_LOCAL_TRANSCRIPTION`: enables the Python faster-whisper path
- `MEETMIND_LOCAL_ONLY_MEDIA_PROCESSING`: forces local file transcription
- `MEETMIND_LOCAL_WHISPER_MODEL`: local faster-whisper model name
- `MEETMIND_PYTHON_BIN`: Python executable path
- `MEETMIND_LOCAL_DIARIZATION`: enables optional local speaker diarization
- `HUGGINGFACE_TOKEN`: required only for local diarization

## Deployment Guidance

For a future hosted deployment, the simplest production shape is cloud mode:

1. keep the Node server
2. set `OPENAI_API_KEY` as a secret on the host
3. set `MEETMIND_LOCAL_TRANSCRIPTION=false`
4. serve the app through the host's HTTPS URL

That avoids packaging Python, Whisper, and diarization dependencies into your first live deployment.

If you later want a fully local or hybrid hosted deployment, treat that as a separate deployment milestone because it adds Python runtime, model, and system dependency management.

## Repo Notes

- [tools/doctor.js](./tools/doctor.js) provides a setup health report
- [requirements-local.txt](./requirements-local.txt) contains the core local transcription dependencies
- [requirements-diarization.txt](./requirements-diarization.txt) contains the optional diarization dependency
- [.gitignore](./.gitignore) excludes secrets, venvs, temp files, and tunnel logs

## Recommended Next Steps

If you want to keep improving this into a more production-ready project, the best next moves are:

1. split [app.js](./app.js) into smaller modules
2. add automated smoke tests for `/api/health` and `/api/process`
3. add authentication and request limits before public deployment
4. add a real deployment pipeline for your chosen host
