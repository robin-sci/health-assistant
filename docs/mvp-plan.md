# Personal Health AI — MVP Plan

## MVP Definition (v1)

### Kern-Features
1. **Blutwerte Upload + Parsing**: PDF/Bild hochladen → Docling OCR → LLM Extraktion → strukturierte Laborwerte in DB
2. **Apple Health Import**: XML-Export importieren → normalisierte Zeitreihen (HR, HRV, Schlaf, Schritte)
3. **Symptom-Tracking**: Tägliches Erfassen von Migräne, Kopfschmerzen, Rückenschmerzen, Stimmung, Energie (0-10 Skala)
4. **AI Chat**: "Frag mich über meine Gesundheit" — Ollama-basiert, Tool-Calling über MCP

### Was MVP NICHT kann
- Keine Echtzeit-Apple-Watch-Sync (nur manueller XML-Import)
- Keine OAuth-Provider-Anbindung (Garmin, Whoop etc. — existiert in OW, aber nicht Fokus)
- Kein automatisches Pattern-Matching
- Kein Multi-User (Single-User-First)
- Keine Mobile App

### Erfolgs-Kriterien
- [ ] PDF-Blutbild hochladen → korrekte Werte extrahiert (>90% Genauigkeit für Standard-Labs)
- [ ] Apple Health XML → HR/HRV/Schlaf/Schritte sichtbar als Zeitreihen
- [ ] 7 Tage Symptom-Tracking → Timeline sichtbar
- [ ] Chat: "Wie war mein Schlaf letzte Woche?" → korrekte Antwort
- [ ] Chat: "Zeig mir meinen HbA1c-Trend" → korrekte Antwort
- [ ] Alles läuft lokal auf Mac mini + Ollama auf Windows PC

## Phasen-Übersicht

```
v1 (MVP)           v2                    v3
4-6 Wochen         +4 Wochen             +4 Wochen
─────────────────  ────────────────────   ──────────────────
✅ Lab Upload      ✅ Auto Apple Health   ✅ Pattern Detection
✅ Apple Health    ✅ Garmin/Whoop OAuth  ✅ Korrelations-UI
   XML Import      ✅ Trend-Dashboard     ✅ Arztbrief-Parsing
✅ Symptom-Track   ✅ Symptom-Trigger     ✅ Multi-User
✅ AI Chat (basic)    Erkennung           ✅ Mobile PWA
                   ✅ Erweiterte Lab-     ✅ Personalisierte
                      Schema (200+)          Empfehlungen
```

## v1 — MVP (4-6 Wochen)

### Woche 1-2: Foundation
**Ziel**: Fork aufsetzen, neue Modelle, Parsing-Pipeline

| Task | Details | Aufwand |
|---|---|---|
| Fork Open Wearables | Repo forken, lokal aufsetzen, Docker Compose anpassen | 2h |
| Docling Sidecar hinzufügen | `docling-serve` Container in docker-compose.yml | 2h |
| DB-Modelle erstellen | `MedicalDocument`, `LabResult`, `SymptomEntry`, `ChatSession`, `ChatMessage` | 4h |
| Alembic Migrations | Neue Tabellen migrieren | 1h |
| Document Upload API | `POST /v1/documents/upload` — Datei speichern, Parsing-Task starten | 4h |
| Celery Parsing Task | Worker: Upload → Docling → Raw Text → DB | 6h |
| LLM Extraction Task | Worker: Raw Text → Ollama Prompt → Structured JSON → LabResult[] | 8h |
| Pydantic Lab Schema | MVP-Schema: 30 wichtigste Laborwerte (Blutbild, Lipide, Schilddrüse, Leber, Niere) | 3h |
| Lab API Endpoints | `GET /v1/labs`, `GET /v1/labs/trends/{test_name}` | 3h |

### Woche 2-3: Symptom-Tracking + Apple Health
**Ziel**: Tägliches Tracking, Apple Health Import funktioniert

| Task | Details | Aufwand |
|---|---|---|
| Symptom API | `POST /v1/symptoms`, `GET /v1/symptoms/timeline` | 4h |
| Symptom-Typen definieren | Migräne, Kopfschmerz, Rücken, Stimmung, Energie, Custom | 2h |
| Apple Health XML Import | Existiert in OW — testen, ggf. anpassen für lokalen Upload | 4h |
| Daten-Validierung | Zeitzonen-Handling, Duplikat-Erkennung | 4h |
| Health Dashboard API | `GET /v1/dashboard/summary` — Tagesübersicht aller Datenquellen | 6h |

### Woche 3-4: AI Chat
**Ziel**: Funktionierender Chat mit Tool-Calling

| Task | Details | Aufwand |
|---|---|---|
| Ollama Integration | httpx-Client, LAN-Konfiguration, Model-Management | 4h |
| MCP Tools erweitern | `get_recent_labs`, `get_lab_trend`, `get_symptom_timeline`, `get_daily_summary` | 8h |
| Chat API | `POST /v1/chat/sessions`, `POST /v1/chat/sessions/{id}/messages` | 6h |
| Streaming Response | SSE/WebSocket für Chat-Streaming | 4h |
| System Prompt | Health-Assistant Persona, Tool-Nutzung, Grenzen definieren | 3h |
| Kontext-Manager | Rolling Summary pro User (letzte 30 Tage komprimiert) | 6h |

### Woche 4-5: Frontend
**Ziel**: Minimales aber funktionales UI

| Task | Details | Aufwand |
|---|---|---|
| Dashboard Page | Tagesübersicht: Schlaf, Schritte, Symptome, letzte Labs | 8h |
| Document Upload Page | Drag & Drop Upload, Status-Anzeige, extrahierte Werte | 6h |
| Symptom Tracker Page | Schnell-Eingabe: Typ, Severity-Slider, Notiz | 4h |
| Chat Page | Chat-Interface mit Streaming, Markdown-Rendering | 8h |
| Lab Results Page | Tabelle + einfaches Trend-Diagramm pro Marker | 6h |
| Navigation | Sidebar mit Pages, User-Settings (Ollama-URL) | 2h |

### Woche 5-6: Polish + Testing
**Ziel**: Demo-ready

| Task | Details | Aufwand |
|---|---|---|
| Error Handling | Graceful Fehler bei Parsing, Ollama-Timeout, etc. | 4h |
| Demo-Daten | Synthetische Blutwerte + Apple Health Export für Demo | 3h |
| README schreiben | Setup-Anleitung, Screenshots, Architektur-Diagramm | 3h |
| E2E Test | Upload → Parse → Chat darüber | 4h |
| Docker Compose finalisieren | `.env.example`, Health Checks, Volumes | 2h |
| Performance | Parsing-Queue, Response-Caching für häufige Queries | 4h |

## v2 — Wearable-Integration & Trends (nach MVP)

| Feature | Beschreibung |
|---|---|
| **Auto Apple Health Sync** | SDK-Sync über Flutter App oder Auto Health Export Webhook |
| **Garmin/Whoop OAuth** | Provider-Setup über Developer Portal (existiert in OW) |
| **Trend-Dashboard** | Interaktive Charts: Lab-Werte über Monate, Schlaf-Trends, Symptom-Häufigkeit |
| **Erweitertes Lab-Schema** | Von 30 auf 200+ Parameter (inspiriert von OpenHealth Zod Schema) |
| **Symptom-Trigger** | "Deine Migräne korreliert mit <6h Schlaf" — statistische Analyse |
| **Benachrichtigungen** | Webhook/Push bei auffälligen Werten (OW Health Insights Feature) |

## v3 — Intelligenz & Multi-User (Zukunft)

| Feature | Beschreibung |
|---|---|
| **Pattern Detection** | ML-basierte Mustererkennung über alle Datenquellen |
| **Korrelations-UI** | Visuell: "Zeig mir HRV vs. Migräne-Häufigkeit" |
| **Arztbrief-Parsing** | Freitext-Befunde, Diagnose-Codes (ICD-10) |
| **Multi-User** | Familien-Accounts, separate Daten-Isolation |
| **Mobile PWA** | Progressive Web App für Symptom-Tracking unterwegs |
| **Personalisierte Empfehlungen** | Basierend auf Trends + med. Leitlinien |
| **FHIR-Export** | Standardisierter Datenexport für Ärzte |

## MVP Lab-Schema (30 Kern-Marker)

### Blutbild (CBC)
- Hämoglobin, Hämatokrit, Erythrozyten (RBC), Leukozyten (WBC), Thrombozyten
- MCV, MCH, MCHC

### Lipide
- Gesamtcholesterin, HDL, LDL, Triglyceride

### Schilddrüse
- TSH, fT3, fT4

### Leber
- ALT (GPT), AST (GOT), GGT, Alkalische Phosphatase, Bilirubin

### Niere
- Kreatinin, eGFR, Harnstoff (BUN)

### Stoffwechsel
- Glucose (nüchtern), HbA1c

### Entzündung
- CRP, BSG (ESR)

### Mineralstoffe
- Eisen, Ferritin, Vitamin D, Vitamin B12

## Symptom-Typen (MVP)

| Typ | Severity-Skala | Zusatz-Felder |
|---|---|---|
| `migraine` | 0-10 | Dauer (min), Triggers, Aura (ja/nein) |
| `headache` | 0-10 | Dauer (min), Lokalisation |
| `back_pain` | 0-10 | Dauer, Lokalisation (LWS/BWS/HWS) |
| `mood` | 0-10 | (10 = sehr gut) |
| `energy` | 0-10 | (10 = sehr energiegeladen) |
| `sleep_quality` | 0-10 | (subjektiv, ergänzt Apple Health Daten) |
| `custom` | 0-10 | Freitext-Name + Notiz |

## Ollama Modell-Empfehlungen

| Aufgabe | Modell | VRAM | Begründung |
|---|---|---|---|
| Chat (schnell) | Llama 3.1 8B | ~6 GB | Schnelle Antworten, Tool-Calling |
| Chat (qualitativ) | Llama 3.1 70B | ~40 GB | Bessere med. Antworten (RTX 5090 hat 32GB) |
| Lab Extraction | Llama 3.1 70B | ~40 GB | Braucht Genauigkeit für Werte-Extraktion |
| Vision (optional) | LLaVA / Llama 3.2 Vision | ~8 GB | Für Bild-basierte Extraktion |

> **Hinweis**: RTX 5090 hat 32 GB VRAM. Das 70B-Modell passt mit Q4-Quantisierung (~35 GB). Alternativ: Qwen 2.5 72B oder Mixtral als Fallback.

## Erster Start

```bash
# 1. Fork & Clone
git clone https://github.com/DEIN_USER/open-wearables.git health-assistant
cd health-assistant

# 2. Environment
cp backend/config/.env.example backend/config/.env
# → OLLAMA_HOST, OLLAMA_MODEL konfigurieren

# 3. Docker starten
docker compose up -d

# 4. Migrations
make migrate

# 5. Testen
open http://localhost:3000
```
