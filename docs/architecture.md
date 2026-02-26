# Personal Health AI — Architektur

## Entscheidung: Fork Open Wearables + Document Parsing Layer

### Bewertung der Optionen

| Option | Aufwand | Stack-Fit | Architektur | Skalierbarkeit | Portfolio | Lokal-first |
|---|---|---|---|---|---|---|
| **A) Fork OpenHealth + Wearables** | Hoch | ❌ TypeScript | ⚠️ Monolithisch | ⚠️ Kein Zeitreihen-Modell | Mittel | ✅ |
| **B) Fork Open Wearables + Parsing** | **Mittel** | **✅ Python** | **✅ Sauber** | **✅ Zeitreihen-ready** | **Hoch** | **✅** |
| C) Neu, Cherry-pick | Hoch | ✅ Python | ✅ Frei wählbar | ✅ | Hoch | ✅ |
| D) OW als Service + AI-Layer | Niedrig | ✅ Python | ⚠️ Zwei Produkte | ⚠️ Integration-Overhead | Mittel | ✅ |

### Warum Option B?

1. **Zeitreihen-Modell ist das Fundament**: OW's `DataPointSeries` + `SeriesTypeDefinition` löst das schwierigste Normalisierungsproblem. Medizinische Daten und Symptome lassen sich in das gleiche temporale Schema einordnen.

2. **Python + FastAPI**: Dein bevorzugter Stack. Ollama-Integration über LAN ist trivial mit `httpx`.

3. **Celery Workers existieren**: Document-Parsing als Background-Job passt nahtlos in die existierende Worker-Architektur (Docling als Sidecar, Parsing als Celery Task).

4. **MCP Server vorhanden**: Das Tool-Calling Pattern ist der richtige Ansatz für die AI-Integration (statt Context Injection wie bei OpenHealth).

5. **Weniger Scaffolding**: Auth, User Management, API-Key Management, Docker-Setup, DB-Migrations — alles existiert bereits.

6. **Was wir von OpenHealth übernehmen** (konzeptionell, nicht Code):
   - Docling als Parsing-Engine
   - Multi-Strategie Prompt-Ansatz (Text + Bild Cross-Validation)
   - Medizinisches Schema-Konzept (aber vereinfacht für MVP)

## Ziel-Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│                     Personal Health AI                           │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ React UI │  │ FastAPI Core │  │ Celery     │  │ Docling   │ │
│  │ (TanStack)│  │ (REST API)  │  │ Workers    │  │ (Sidecar) │ │
│  └─────┬────┘  └──────┬───────┘  └──────┬─────┘  └─────┬─────┘ │
│        │              │                 │               │       │
│        └──────────────┤                 │               │       │
│                       │                 │               │       │
│              ┌────────┴────────┐        │               │       │
│              │   API Routes    │        │               │       │
│              │  /v1/...        │        │               │       │
│              │  /v1/documents  │ NEW    │               │       │
│              │  /v1/symptoms   │ NEW    │               │       │
│              │  /v1/chat       │ NEW    │               │       │
│              └────────┬────────┘        │               │       │
│                       │                 │               │       │
│  ┌────────────────────┴─────────────────┴───────────────┘       │
│  │                 Service Layer                                │
│  │  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐  │
│  │  │Wearable  │ │Document      │ │Symptom     │ │AI Chat   │  │
│  │  │Services  │ │Parsing       │ │Tracking    │ │Service   │  │
│  │  │(existing)│ │Service (NEW) │ │Service(NEW)│ │(NEW)     │  │
│  │  └────┬─────┘ └──────┬───────┘ └─────┬──────┘ └────┬─────┘  │
│  └───────┼──────────────┼────────────────┼─────────────┼────────┘
│          │              │                │             │         │
│  ┌───────┴──────────────┴────────────────┴─────────────┘        │
│  │              Unified Data Layer (PostgreSQL)                 │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │  │DataPointSerie│ │EventRecord   │ │MedicalDocument (NEW) │  │
│  │  │(Zeitreihen)  │ │(Sleep/Workout│ │LabResult (NEW)       │  │
│  │  │              │ │ Symptoms NEW)│ │SymptomEntry (NEW)    │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  AI Layer                                                 │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐ │   │
│  │  │MCP Server│  │Ollama (LAN)  │  │Context Manager      │ │   │
│  │  │(Tools)   │──│RTX 5090      │  │(Rolling Summaries)  │ │   │
│  │  └──────────┘  └──────────────┘  └─────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Datenmodell (Erweiterungen zu Open Wearables)

### Neue Modelle

```python
# Medizinische Dokumente
class MedicalDocument(BaseDbModel):
    """Uploaded medical documents (PDFs, images)."""
    __tablename__ = "medical_document"

    id: Mapped[PrimaryKey[UUID]]
    user_id: Mapped[FKUser]
    title: Mapped[str]                    # "Blutbild 2024-01"
    document_type: Mapped[str]            # "blood_test", "checkup", "report"
    file_path: Mapped[str]               # Pfad zur Originaldatei
    file_type: Mapped[str]               # "application/pdf", "image/jpeg"
    raw_text: Mapped[str | None]         # Docling OCR Output
    parsed_data: Mapped[dict | None]     # Strukturierte JSON
    document_date: Mapped[date | None]   # Datum des Befunds
    status: Mapped[str]                  # "uploading", "parsing", "completed", "failed"
    created_at: Mapped[datetime_tz]


class LabResult(BaseDbModel):
    """Individual lab test results extracted from documents."""
    __tablename__ = "lab_result"

    id: Mapped[PrimaryKey[UUID]]
    document_id: Mapped[FKMedicalDocument]
    user_id: Mapped[FKUser]
    test_name: Mapped[str]               # "HbA1c", "TSH", "Cholesterol Total"
    test_code: Mapped[str | None]        # LOINC-Code wenn verfügbar
    value: Mapped[numeric_10_3]
    unit: Mapped[str]                    # "mg/dL", "mmol/L"
    reference_min: Mapped[numeric_10_3 | None]
    reference_max: Mapped[numeric_10_3 | None]
    status: Mapped[str | None]           # "normal", "high", "low", "critical"
    recorded_at: Mapped[date]            # Datum der Untersuchung

    # Unique pro User + Test + Datum
    __table_args__ = (
        UniqueConstraint("user_id", "test_code", "recorded_at",
                        name="uq_lab_result_user_test_date"),
    )


class SymptomEntry(BaseDbModel):
    """Daily symptom tracking entries."""
    __tablename__ = "symptom_entry"

    id: Mapped[PrimaryKey[UUID]]
    user_id: Mapped[FKUser]
    symptom_type: Mapped[str]            # "migraine", "headache", "back_pain", "mood", "energy"
    severity: Mapped[int]                # 0-10 Skala
    notes: Mapped[str | None]
    recorded_at: Mapped[datetime_tz]
    duration_minutes: Mapped[int | None]
    triggers: Mapped[list[str] | None]   # ["Stress", "Schlafmangel", "Wetter"]

    __table_args__ = (
        Index("idx_symptom_user_type_date", "user_id", "symptom_type", "recorded_at"),
    )


# Chat (für AI Assistant)
class ChatSession(BaseDbModel):
    """AI chat sessions."""
    __tablename__ = "chat_session"

    id: Mapped[PrimaryKey[UUID]]
    user_id: Mapped[FKUser]
    title: Mapped[str | None]
    created_at: Mapped[datetime_tz]
    last_activity_at: Mapped[datetime_tz]


class ChatMessage(BaseDbModel):
    """Individual messages in a chat session."""
    __tablename__ = "chat_message"

    id: Mapped[PrimaryKey[UUID]]
    session_id: Mapped[FKChatSession]
    role: Mapped[str]                    # "user", "assistant", "system"
    content: Mapped[str]
    created_at: Mapped[datetime_tz]
```

### Integration mit existierenden OW-Modellen
- **LabResult** kann optional auch als `DataPointSeries` gespiegelt werden (z.B. HbA1c über Zeit als Zeitreihe)
- **SymptomEntry** nutzt die gleiche temporale Logik wie `EventRecord` — Symptome sind Events mit Severity-Metrik
- **Wearable-Daten** bleiben unverändert im OW-Schema

## AI-Pipeline

### Kontext-Strategie (statt Context Injection)
```
User-Frage
    │
    ▼
┌──────────────┐
│ MCP Router   │ ← Entscheidet welche Tools relevant sind
└──────┬───────┘
       │
       ├── tool: get_recent_labs(user_id, days=90)
       ├── tool: get_wearable_summary(user_id, metric, days=30)
       ├── tool: get_symptom_timeline(user_id, type, days=30)
       ├── tool: get_sleep_analysis(user_id, days=14)
       ├── tool: correlate(metric_a, metric_b, days=90)
       │
       ▼
┌──────────────┐
│ Ollama LLM   │ ← Auf Windows PC (RTX 5090) via LAN
│ (Tool-Calling)│
└──────┬───────┘
       │
       ▼
   Antwort mit Kontext
```

### MCP Tools (Erweiterung des existierenden MCP Servers)
```python
# Neue Tools zusätzlich zu existierenden OW-Tools
@mcp.tool()
def get_recent_labs(user_id: str, days: int = 90) -> list[dict]:
    """Letzte Laborergebnisse eines Users."""

@mcp.tool()
def get_lab_trend(user_id: str, test_name: str, months: int = 12) -> list[dict]:
    """Zeitverlauf eines bestimmten Laborwerts."""

@mcp.tool()
def get_symptom_timeline(user_id: str, symptom_type: str, days: int = 30) -> list[dict]:
    """Symptom-Verlauf über Zeit."""

@mcp.tool()
def get_daily_summary(user_id: str, date: str) -> dict:
    """Tagesübersicht: Schlaf + Aktivität + Symptome + Labs."""

@mcp.tool()
def correlate_metrics(user_id: str, metric_a: str, metric_b: str, days: int = 90) -> dict:
    """Korrelationsanalyse zwischen zwei Metriken."""
```

### Ollama-Integration
```python
# config.py
class OllamaConfig:
    host: str = "192.168.x.x"  # Windows PC im LAN
    port: int = 11434
    model: str = "llama3.1:70b"  # Oder anderes Modell
    timeout: int = 120
```

## Document Parsing Pipeline

```
Upload (PDF/Image)
    │
    ▼
┌──────────────────┐
│ Celery Worker    │
│ Task: parse_doc  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐     ┌──────────────┐
│ Docling Sidecar  │────▶│ Raw Text/    │
│ (OCR + Layout)   │     │ Markdown     │
└──────────────────┘     └──────┬───────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ LLM Extraction       │
                    │ (Ollama)             │
                    │                      │
                    │ Prompt: "Extrahiere  │
                    │  Laborwerte aus      │
                    │  diesem Text..."     │
                    │                      │
                    │ Output: JSON mit     │
                    │  LabResult[]         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Validierung          │
                    │ (Pydantic Schema)    │
                    │                      │
                    │ - Werte plausibel?   │
                    │ - Units normalisiert?│
                    │ - Referenzbereiche?  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ PostgreSQL           │
                    │ medical_document +   │
                    │ lab_result Tabellen  │
                    └──────────────────────┘
```

## Tech-Stack Zusammenfassung

| Komponente | Technologie | Herkunft |
|---|---|---|
| Backend API | FastAPI (Python 3.13+) | Open Wearables |
| Frontend | React 19 + TanStack + Vite | Open Wearables |
| Datenbank | PostgreSQL 18 | Open Wearables |
| ORM | SQLAlchemy 2.0 + Alembic | Open Wearables |
| Task Queue | Celery + Redis | Open Wearables |
| Wearable-Daten | Provider-Strategie Pattern | Open Wearables |
| Doc Parsing | Docling (Docker Sidecar) | Inspiriert von OpenHealth |
| LLM Extraction | Ollama (LAN, RTX 5090) | Neu |
| AI Chat | MCP Server (FastMCP) + Ollama | Erweitert von OW |
| Auth | JWT (self-contained) | Open Wearables |
| Monitoring | Flower + Sentry | Open Wearables |

## Infrastruktur

### Docker Compose (Ziel)
```yaml
services:
  db:           # PostgreSQL 18
  redis:        # Redis 8
  app:          # FastAPI Backend
  worker:       # Celery Worker (Sync + Parsing)
  beat:         # Celery Beat (Scheduled Tasks)
  frontend:     # React App
  docling:      # Docling Sidecar (NEU)
  mcp:          # MCP Server (erweitert)
  # Ollama läuft extern auf Windows PC
```

### Netzwerk
```
Mac mini M1 (Docker Host)          Windows PC (GPU)
├── PostgreSQL                     └── Ollama Server
├── Redis                              ├── llama3.1:70b
├── FastAPI                            ├── llama3.2-vision
├── Celery Workers                     └── (andere Modelle)
├── React Frontend
├── Docling
└── MCP Server ──────── LAN ──────▶ Ollama :11434
```

## Risiken & Mitigationen

| Risiko | Mitigation |
|---|---|
| Docling Parsing-Qualität schwankt | MVP auf kleine Menge Lab-Typen beschränken, iterativ erweitern |
| Zeitzonen-Alignment Apple Health ↔ Labs ↔ Symptome | Konsistente UTC-Speicherung + User-Timezone in Config |
| Ollama-Modelle zu langsam für Chat | Kleineres Modell für Chat (8B), großes für Parsing |
| Open Wearables API-Änderungen (upstream) | Fork stabil halten, selektiv upstream mergen |
| Privacy-Behauptung verifizieren | Keine Third-Party-LLM-Fallbacks, demo mit synthetischen Daten |
