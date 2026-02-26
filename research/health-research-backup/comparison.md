# OpenHealth vs. Open Wearables — Vergleichsreport

## Übersicht

| Kriterium | OpenHealth | Open Wearables |
|---|---|---|
| **GitHub** | OpenHealthForAll/open-health | the-momentum/open-wearables |
| **Stars** | ~3.3k | Frühes Stadium |
| **Lizenz** | MIT (impliziert) | MIT |
| **Hauptzweck** | AI Health Assistant für med. Dokumente | Unified Wearable Data Platform |
| **Sprache** | TypeScript (Next.js) | Python (FastAPI) + TypeScript (React) |
| **Datenbank** | PostgreSQL (Prisma ORM) | PostgreSQL (SQLAlchemy 2.0) |
| **Deployment** | Docker (3 Services) | Docker (7 Services) |

## Tech-Stack im Detail

### OpenHealth
- **Frontend/Backend**: Next.js 15 (App Router), React 19, TypeScript
- **ORM**: Prisma 6.5
- **LLM**: LangChain (OpenAI, Anthropic, Google, Ollama)
- **Parsing**: Docling (IBM) als Docker-Sidecar (`docling-serve`)
- **UI**: Radix UI, Tailwind, shadcn/ui, Framer Motion
- **Auth**: next-auth
- **Sonstiges**: trigger.dev (Background Jobs), SWR (Data Fetching)

### Open Wearables
- **Backend**: FastAPI, Python 3.13+, SQLAlchemy 2.0
- **Frontend**: React 19, TanStack Router/Query, Vite, TypeScript
- **Task Queue**: Celery + Redis (Background-Sync, Datenverarbeitung)
- **AI**: MCP Server (FastMCP) für LLM Tool-Calling
- **Auth**: Self-contained (JWT, bcrypt)
- **Monitoring**: Flower (Celery Dashboard), Sentry
- **Code Quality**: Ruff, ty (Python), oxlint + Prettier (TS)

## Datenmodelle

### OpenHealth — Medizinische Daten
```
User
 ├── HealthData (type: string, data: JSON, filePath, fileType, status)
 ├── ChatRoom → ChatMessage[]
 ├── AssistantMode → AssistantModeContext[]
 └── LLMProvider
```
- **HealthData** ist ein generischer JSON-Blob pro Dokument
- Typ-Feld unterscheidet: `PERSONAL_INFO`, Blutwerte, Checkups etc.
- Kein Zeitreihen-Modell — alles ist "ein Dokument zu einem Zeitpunkt"
- **Zod Schema** (`HealthCheckupSchema`): 200+ medizinische Parameter (Albumin, TSH, HbA1c, Cholesterol, etc.) — jeder mit `{unit, value}`

### Open Wearables — Wearable-Zeitreihen
```
User
 ├── UserConnection → DataSource
 │    └── DataPointSeries (recorded_at, value, series_type_definition_id)
 ├── EventRecord → EventRecordDetail
 │    ├── SleepDetails (duration, efficiency, deep/rem/light/awake)
 │    └── WorkoutDetails (hr_min/max/avg, energy, distance, steps)
 └── SeriesTypeDefinition (code, unit)  ← Normalisierungs-Tabelle
```
- **DataPointSeries**: Universelle Zeitreihen-Tabelle (HR, Steps, HRV etc.)
- **SeriesTypeDefinition**: Kanonische Definitionen (code + unit) für Normalisierung
- **EventRecord**: Workouts, Schlaf als diskrete Events mit Detail-Polymorphismus
- **Unique Constraint**: (data_source_id, series_type_definition_id, recorded_at) — keine Duplikate

## Kernfunktionen

### Dokumenten-Parsing (OpenHealth) ⭐
1. **Upload**: PDF, DOCX, Bilder (JPEG/PNG)
2. **Docling-Parsing**: Sidecar-Container (`docling-serve`) konvertiert Dokumente via OCR
   - Engine: EasyOCR, Backend: dlparse_v2
   - Sprachen: EN, KO
   - Output: Markdown oder JSON mit Seitenstruktur + Bounding Boxes
3. **Structured Extraction**: LLM nimmt OCR-Text + Bild-Daten und mappt auf Zod-Schema
   - 3 Strategien: `both` (Text+Bild), `onlyText`, `onlyImage`
   - Cross-Validation: Text vs. Bild zur Fehlerkorrektur
   - Multi-Komponenten-Tests werden separiert (z.B. Blutdruck 118/65 → systolisch/diastolisch)
4. **Speicherung**: Strukturierte JSON in HealthData-Tabelle

### Wearable-Integration (Open Wearables) ⭐
1. **Provider-Support**:
   - Cloud-OAuth: Garmin, Polar, Suunto, Strava, Whoop
   - SDK-Sync: Apple Health (HealthKit), Samsung Health
   - Import: Apple Health XML Export, Auto Health Export App
2. **Normalisierung**: Provider → Strategy → Handler → Unified Model
   - Apple: 100+ HealthKit-Metriken → SeriesType Mapping
   - Jeder Provider hat `base_strategy.py` Implementierung
3. **Apple Health Metriken** (vollständig):
   - Kardio: HR, Resting HR, HRV (SDNN), HR Recovery, Walking HR Avg
   - Blut/Atmung: SpO2, Blutzucker, Blutdruck, Atemfrequenz
   - Körper: Gewicht, Größe, BMI, Körperfett, Lean Mass, Temperatur
   - Fitness: VO2 Max, Schritte, Energie, Steh-Zeit, Stockwerke
   - Schlaf: Detaillierte Phasen (Wach, REM, Kern, Tief)
   - Laufen: Power, Speed, Vertical Oscillation, Ground Contact Time
   - Radfahren: Cadence, Power, Speed
   - Umgebung: Audio-Exposition, Tageslicht-Zeit

### LLM-Integration

| Feature | OpenHealth | Open Wearables |
|---|---|---|
| **Chat** | ✅ Vollständig (Streaming) | ❌ "Coming Soon" |
| **Provider** | Ollama, OpenAI, Anthropic, Google | — |
| **RAG** | Context Injection (JSON in Prompt) | MCP Server (Tool-Calling) |
| **Skalierbarkeit** | ⚠️ Begrenzt durch Context Window | ✅ Tool-basiert, skalierbar |
| **Framework** | LangChain | FastMCP |

**OpenHealth RAG-Ansatz**:
- Alle HealthData-JSON-Blobs werden als String in den System-Prompt injiziert
- Kein Vector DB, kein Embedding, kein Chunking
- Funktioniert gut für wenige Dokumente, skaliert nicht für große Datenmengen

**Open Wearables MCP-Ansatz**:
- Exponiert Tools (`query_user_activity`, `query_user_sleep`, `get_user_summaries`)
- LLM ruft spezifische Daten on-demand ab statt alles im Kontext zu halten
- Besser skalierbar, aber Chat-Interface fehlt noch

## Architektur-Unterschiede

### Service-Architektur
```
OpenHealth (3 Container):          Open Wearables (7 Container):
├── app (Next.js)                  ├── app (FastAPI)
├── database (PostgreSQL)          ├── celery-worker
└── docling-serve                  ├── celery-beat
                                   ├── flower (Monitoring)
                                   ├── redis
                                   ├── db (PostgreSQL)
                                   └── frontend (React/Vite)
```

### Architektur-Stil
- **OpenHealth**: Monolithisch (Next.js full-stack). Einfach, aber wenig Flexibilität.
- **Open Wearables**: Microservice-orientiert mit Task Queue. Komplexer, aber skalierbarer. Backend und Frontend klar getrennt.

## Überlappungen & Ergänzungen

### Überlappungen (gering)
- Beide nutzen PostgreSQL
- Beide haben User-Management
- Beide haben Docker-basiertes Deployment
- Beide haben grundlegende Auth

### Ergänzungen (hoch — darum sind beide relevant)
| Bereich | OpenHealth | Open Wearables |
|---|---|---|
| Dokumenten-Upload/Parsing | ✅ | ❌ |
| Medizinische Schemas | ✅ (200+ Parameter) | ❌ |
| Wearable-Anbindung | ❌ | ✅ (100+ Metriken) |
| Zeitreihen-Daten | ❌ | ✅ |
| Schlaf-Analyse | ❌ | ✅ |
| Workout-Tracking | ❌ | ✅ |
| LLM Chat (fertig) | ✅ | ❌ |
| MCP Server | ❌ | ✅ |
| Daily Symptom Tracking | ❌ | ❌ |
| Pattern Recognition | ❌ | ❌ |

## Stärken & Schwächen

### OpenHealth
| Stärke | Schwäche |
|---|---|
| Exzellentes Dokument-Parsing (Docling) | TypeScript-only (User bevorzugt Python) |
| Umfassender med. Schema (200+ Marker) | Keine Wearable-Integration |
| Funktionierender LLM-Chat | Context Injection skaliert nicht |
| Einfaches Setup (3 Container) | Kein Zeitreihen-Modell |
| Gute Community (3.3k Stars) | Monolithische Architektur |
| Lokal-first (Ollama + Docling) | Kein MCP/Tool-Calling |

### Open Wearables
| Stärke | Schwäche |
|---|---|
| Python/FastAPI (User-Präferenz) | Kein Dokumenten-Parsing |
| Saubere Architektur (Backend/Frontend getrennt) | AI Assistant fehlt noch |
| 100+ Apple Health Metriken | Komplexeres Setup (7 Container) |
| MCP Server für AI Tool-Calling | Frühe Entwicklungsphase |
| Celery für Background-Processing | Kein med. Wissen |
| Provider-Strategie-Pattern (erweiterbar) | Wenig Community bisher |

## Community & Reife

| Aspekt | OpenHealth | Open Wearables |
|---|---|---|
| **Alter** | ~1 Jahr | ~6 Monate |
| **Aktivität** | Aktiv, häufige Releases | Sehr aktiv, daily commits |
| **Contributors** | Mittel | Klein, aber fokussiert |
| **Dokumentation** | README, In-Code | README, AGENTS.md, Mintlify Docs |
| **Tests** | Minimal | Pytest, Factory Boy |
| **Code Quality** | ESLint | Ruff, ty, pre-commit, oxlint |
| **AI-Agent Ready** | Nein | Ja (AGENTS.md, MCP, CLAUDE.md) |

## Fazit

Die Projekte ergänzen sich nahezu perfekt:
- **OpenHealth** = Medizinische Intelligenz (Parsing, Schemas, LLM Chat)
- **Open Wearables** = Wearable-Infrastruktur (Daten-Aggregation, Normalisierung, MCP)

Keines allein erfüllt die Vision des Personal Health AI. Die Kombination — oder ein neues Projekt, das die besten Konzepte beider nutzt — ist der Weg vorwärts.

Die Architektur-Entscheidung (Fork vs. Neu) wird in `docs/architecture.md` behandelt.
