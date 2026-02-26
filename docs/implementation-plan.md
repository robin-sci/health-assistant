# Implementation Plan — Personal Health AI

## Approach
Fork Open Wearables → AI Chat first → then Document Parsing → then Symptom Tracking.

Starting with AI Chat means we need **data to talk about**. So Phase 1 sets up the foundation (fork, models, seed data) and the chat simultaneously.

## Phase 1: Foundation + AI Chat (Week 1-2)

### 1.1 Fork & Local Setup
- [ ] Fork `the-momentum/open-wearables` on GitHub
- [ ] Clone to local machine
- [ ] Add `docling-serve` to `docker-compose.yml` (for later, but wire it now)
- [ ] Configure `.env` with Ollama host (Windows PC LAN IP)
- [ ] `docker compose up` — verify everything runs
- [ ] Seed sample data (`make seed`) to have wearable data to chat about

### 1.2 New Data Models + Migrations
- [ ] `MedicalDocument` model (for later, but schema now)
- [ ] `LabResult` model (test_name, value, unit, reference range, recorded_at)
- [ ] `SymptomEntry` model (type, severity 0-10, notes, recorded_at)
- [ ] `ChatSession` model (user_id, title, timestamps)
- [ ] `ChatMessage` model (session_id, role, content, timestamps)
- [ ] Alembic migrations for all new tables
- [ ] Seed script: insert sample lab results + symptom entries for testing

### 1.3 Ollama Integration
- [ ] `OllamaService` class — httpx client to Ollama on LAN
  - `chat()` — streaming completion
  - `chat_with_tools()` — tool-calling support
  - Model selection (configurable via .env)
  - Timeout handling, retry logic
  - Health check endpoint (`GET /v1/ai/status`)
- [ ] Test: verify connection to Ollama from Docker container over LAN

### 1.4 MCP Tools (extend existing MCP server)
- [ ] `get_recent_labs(user_id, days=90)` — query LabResult table
- [ ] `get_lab_trend(user_id, test_name, months=12)` — time series for one marker
- [ ] `get_symptom_timeline(user_id, symptom_type, days=30)` — symptom history
- [ ] `get_daily_summary(user_id, date)` — all sources combined for one day
- [ ] `get_wearable_summary(user_id, metric, days=30)` — from existing OW data
- [ ] `correlate_metrics(user_id, metric_a, metric_b, days=90)` — basic correlation
- [ ] Wire tools into existing MCP server (`mcp/app/main.py`)

### 1.5 Chat API
- [ ] `POST /v1/chat/sessions` — create new chat session
- [ ] `GET /v1/chat/sessions` — list user's sessions
- [ ] `GET /v1/chat/sessions/{id}` — get session with messages
- [ ] `DELETE /v1/chat/sessions/{id}` — delete session
- [ ] `POST /v1/chat/sessions/{id}/messages` — send message, get streaming response
  - Accepts user message
  - Builds system prompt (health assistant persona)
  - Calls Ollama with tool definitions
  - Handles tool calls → execute → feed results back to LLM
  - Streams response via SSE
- [ ] System prompt: health assistant persona, tool usage instructions, safety disclaimers

### 1.6 Chat Frontend
- [ ] Chat page route (`/chat`)
- [ ] Session list sidebar
- [ ] Message input + send
- [ ] Streaming response display (SSE)
- [ ] Markdown rendering in responses
- [ ] New session / delete session
- [ ] Settings: Ollama URL + model selection

### 1.7 Milestone Check
- [ ] Can send a message and get a streaming response from Ollama
- [ ] LLM correctly uses tools to query wearable data, labs, symptoms
- [ ] "How was my sleep last week?" returns real data from seeded OW data
- [ ] "Show me my HbA1c trend" returns seeded lab data

## Phase 2: Document Parsing (Week 3-4)

### 2.1 Upload Pipeline
- [ ] `POST /v1/documents/upload` — file upload endpoint
- [ ] Store original file (local volume)
- [ ] Create `MedicalDocument` record (status: "uploading")
- [ ] Trigger Celery task for parsing

### 2.2 Docling Integration
- [ ] Celery task: `parse_document`
  - Send file to `docling-serve` sidecar (HTTP API)
  - Receive raw text / markdown
  - Store raw text in `MedicalDocument.raw_text`
  - Update status: "parsed"

### 2.3 LLM Extraction
- [ ] Celery task: `extract_lab_results`
  - Send raw text to Ollama with extraction prompt
  - Prompt: "Extract lab values from this text into structured JSON"
  - Parse response against Pydantic schema (MVP: 30 markers)
  - Validate: plausible values, normalize units
  - Store as `LabResult` rows
  - Update document status: "completed"
- [ ] Error handling: retry, fallback to simpler prompt, mark as "failed"

### 2.4 Lab Results API + UI
- [ ] `GET /v1/labs` — list all lab results for user
- [ ] `GET /v1/labs/trends/{test_name}` — time series for one marker
- [ ] `GET /v1/documents` — list uploaded documents with status
- [ ] Frontend: Document upload page (drag & drop, status indicator)
- [ ] Frontend: Lab results table + simple trend chart per marker

### 2.5 Milestone Check
- [ ] Upload a real blood test PDF → correctly extracted values
- [ ] Ask in chat: "What were my last blood test results?" → correct answer
- [ ] Lab trend visible in UI

## Phase 3: Symptom Tracking (Week 4-5)

### 3.1 Symptom API
- [ ] `POST /v1/symptoms` — log a symptom entry
- [ ] `GET /v1/symptoms` — list entries (filterable by type, date range)
- [ ] `GET /v1/symptoms/timeline` — aggregated view
- [ ] `GET /v1/symptoms/types` — available symptom types

### 3.2 Symptom Types
- [ ] Predefined: migraine, headache, back_pain, mood, energy, sleep_quality
- [ ] Custom: user-defined symptom types
- [ ] Each with: severity (0-10), optional notes, optional triggers, optional duration

### 3.3 Symptom Frontend
- [ ] Quick-entry widget (type selector, severity slider, notes field)
- [ ] Timeline view (calendar or list)
- [ ] Frequency chart per symptom type

### 3.4 AI Integration
- [ ] MCP tools already wired from Phase 1 — verify they work with real symptom data
- [ ] Test: "When did I last have a migraine?" → correct answer
- [ ] Test: "Is there a pattern between my sleep and headaches?" → meaningful correlation

### 3.5 Milestone Check
- [ ] Log symptoms daily for a week → visible in timeline
- [ ] Chat correctly references symptom data alongside wearable + lab data

## Phase 4: Dashboard + Polish (Week 5-6)

### 4.1 Dashboard
- [ ] Daily overview: sleep score, steps, symptoms, latest labs
- [ ] Weekly trends: key metrics over time
- [ ] Quick actions: log symptom, upload document, start chat

### 4.2 Apple Health Import
- [ ] Verify existing OW XML import works for local single-user
- [ ] Test with real Apple Health export
- [ ] Ensure HR, HRV, sleep, steps, energy data flows into dashboard

### 4.3 Polish
- [ ] Error handling across all endpoints
- [ ] Loading states in UI
- [ ] Responsive layout
- [ ] README with setup instructions + screenshots
- [ ] Demo data script (synthetic, anonymized)
- [ ] Docker Compose health checks for all services

### 4.4 Final Milestone
- [ ] End-to-end: Upload blood test + import Apple Health + log symptoms + chat about all of it
- [ ] Everything runs locally (Mac mini + Ollama on Windows)
- [ ] Clean README, portfolio-ready

## Technical Decisions

### Ollama Tool-Calling
Ollama supports tool calling natively since v0.5. We use structured tool definitions in the chat API and handle tool call responses in a loop until the LLM produces a final text response.

### Streaming
SSE (Server-Sent Events) via FastAPI's `StreamingResponse`. Frontend consumes with `EventSource` or fetch + ReadableStream.

### File Storage
Local volume mount for uploaded documents. No S3/cloud storage — privacy first.

### Auth
Single-user for MVP. The existing OW auth (JWT) stays but we simplify to a single admin account. Multi-user is v3.

### Models Recommendation
| Task | Model | Why |
|---|---|---|
| Chat | `llama3.1:8b` or `qwen2.5:14b` | Fast responses, good tool-calling |
| Lab extraction | `llama3.1:70b-q4` or `qwen2.5:72b-q4` | Accuracy matters for medical values |
| Vision (future) | `llama3.2-vision` | For image-based extraction |
