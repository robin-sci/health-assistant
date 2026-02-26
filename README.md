
# Health Assistant

<div align="left">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Built with: FastAPI + React + Tanstack](https://img.shields.io/badge/Built%20with-FastAPI%20%2B%20React%20%2B%20Tanstack-green.svg)
![AI: Ollama (Local)](https://img.shields.io/badge/AI-Ollama%20(Local)-blueviolet.svg)

</div>

---

Personal health AI assistant that combines wearable data, medical documents, and symptom tracking with an AI chat interface powered by local LLMs. Built on top of [Open Wearables](https://github.com/the-momentum/open-wearables). Privacy-first: everything runs locally.

## What It Does

Health Assistant unifies three data sources into a single platform with an AI chat interface:

1. **Wearable Data** — Heart rate, HRV, sleep, steps, workouts from Apple Watch (and Garmin, Polar, Suunto, Whoop)
2. **Medical Documents** — Blood tests, doctor reports parsed via OCR/AI (Docling) into structured lab results
3. **Symptom Tracking** — Daily logging of migraines, headaches, pain, mood, energy, and more

An **AI chat** powered by Ollama (running on your own hardware) can query all three data sources via tool-calling to answer health questions grounded in your actual data.

> **Privacy First**: No data leaves your network. The LLM runs locally on your GPU via Ollama. No third-party API calls. Your health data stays yours.

## Key Features

- **AI Health Chat** — Ask questions about your health data in natural language. The AI uses tool-calling to query your labs, symptoms, and wearables, giving answers grounded in real data instead of generic advice.
- **Unified Wearable Data** — 100+ Apple HealthKit metrics normalized into a single time-series model. Supports Garmin, Polar, Suunto, Whoop, and Apple Health.
- **Medical Document Parsing** — Upload blood test PDFs/images. Docling (IBM) extracts text, then an LLM structures it into lab results with values, units, and reference ranges.
- **Symptom Tracking** — Log daily symptoms with severity (0-10), duration, triggers, and notes. Track patterns over time.
- **Correlation Analysis** — Cross-correlate any combination of wearable metrics, lab results, and symptoms to find patterns.
- **Local LLM** — Powered by Ollama running on your own hardware (e.g., RTX 5090 over LAN). No cloud dependencies.
- **MCP Server** — Model Context Protocol server exposes health data tools to external AI assistants (Claude Desktop, Cursor, etc.)

## Architecture

```
health-assistant/
├── backend/           # Python/FastAPI backend
│   ├── app/
│   │   ├── api/routes/v1/  # REST endpoints (chat, labs, symptoms, ai)
│   │   ├── models/         # SQLAlchemy models (wearables + health assistant)
│   │   ├── services/       # Ollama integration, health tools, chat service
│   │   └── repositories/   # Data access layer
│   └── migrations/         # Alembic migrations
├── frontend/          # React 19 + TypeScript
│   └── src/
│       ├── routes/         # Pages (dashboard, chat, users)
│       ├── components/     # UI components (chat sidebar, messages, input)
│       └── hooks/          # TanStack Query hooks
├── mcp/               # MCP server (FastMCP) for AI tool-calling
└── docs/              # Documentation
```

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13+, FastAPI, SQLAlchemy 2.0, Celery + Redis |
| Frontend | React 19, TypeScript, TanStack Router/Query, Tailwind + shadcn/ui |
| AI/ML | Ollama (local LLM), Docling (OCR/PDF parsing) |
| Database | PostgreSQL |
| Infrastructure | Docker Compose (8 services) |

## Getting Started

### Prerequisites

- Docker and Docker Compose
- An Ollama instance running on your network (e.g., on a machine with a GPU)

### 1. Clone and configure

```bash
git clone https://github.com/robin-sci/health-assistant.git
cd health-assistant

# Backend config
cp ./backend/config/.env.example ./backend/config/.env
# Edit .env to set OLLAMA_HOST to your Ollama instance (e.g., http://192.168.1.100:11434)

# Frontend config
cp ./frontend/.env.example ./frontend/.env
```

### 2. Start all services

```bash
docker compose up -d
```

This starts 8 containers:

| Container | Purpose |
|-----------|---------|
| `backend__health-assistant` | FastAPI app |
| `frontend__health-assistant` | React dev server |
| `postgres__health-assistant` | PostgreSQL database |
| `redis__health-assistant` | Redis (Celery broker + cache) |
| `celery-worker__health-assistant` | Background task worker |
| `celery-beat__health-assistant` | Periodic task scheduler |
| `flower__health-assistant` | Celery monitoring |
| `docling__health-assistant` | Document OCR/parsing sidecar |

### 3. Apply migrations and seed data

```bash
make migrate
make seed    # Creates test users, 120 lab results, ~147 symptom entries, sample wearable data
```

### 4. Access the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Celery Flower | http://localhost:5555 |

Default admin credentials: `admin@admin.com` / `your-secure-password`

## AI Chat

The chat interface lets you ask health questions in natural language. The AI has access to 6 health data tools:

| Tool | What it does |
|------|-------------|
| `get_recent_labs` | Fetch recent blood test results with reference ranges |
| `get_lab_trend` | Track how a specific lab marker changes over time |
| `get_symptom_timeline` | View symptom entries with severity and frequency stats |
| `get_wearable_summary` | Heart rate, steps, sleep, HRV, and other wearable metrics |
| `get_daily_summary` | Combined snapshot of all health data for a specific date |
| `correlate_metrics` | Find correlations between any two health metrics |

Example questions:
- "How has my HbA1c trended over the last year?"
- "Do my migraines correlate with poor sleep?"
- "Give me a summary of yesterday's health data"
- "What were my iron levels in the last blood test?"

## Development

### Rebuilding after changes

No volume mounts for app code. Must rebuild containers after changes:

```bash
docker compose up -d --build app        # After backend changes
docker compose up -d --build frontend   # After frontend changes
```

### Code quality

```bash
# Backend
cd backend && uv run ruff check . --fix && uv run ruff format .

# Frontend
cd frontend && pnpm run lint:fix && pnpm run format
```

### Useful commands

| Command | Description |
|---------|-------------|
| `make build` | Build Docker images |
| `make run` | Start in detached mode |
| `make stop` | Stop containers |
| `make test` | Run backend tests |
| `make migrate` | Apply database migrations |
| `make create_migration m="..."` | Create new migration |
| `make seed` | Seed sample data |

## Based On

This project is a fork of [Open Wearables](https://github.com/the-momentum/open-wearables), an open-source platform for unified wearable data. Health Assistant extends it with:
- Medical document parsing (Docling + LLM extraction)
- Symptom tracking
- AI chat interface with tool-calling (Ollama)
- Health data correlation engine

## License

[MIT License](LICENSE)
