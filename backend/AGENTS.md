# Backend Development Guide

This file extends the root AGENTS.md with backend-specific patterns.

## Tech Stack
- Python 3.13+
- FastAPI for API framework
- SQLAlchemy 2.0 for ORM
- PostgreSQL for database
- Alembic for migrations
- Celery + Redis for background jobs
- Ruff for linting/formatting
- Ollama for local LLM inference (chat + extraction)

## Project Structure

```
app/
├── api/
│   └── routes/v1/       # API endpoints (incl. chat, ai)
├── models/              # SQLAlchemy models (incl. health assistant)
├── schemas/             # Pydantic schemas
├── services/            # Business logic (incl. Ollama, health tools, chat)
│   └── providers/       # Wearable provider integrations
├── repositories/        # Data access layer
├── integrations/        # External services (Celery, Redis)
├── utils/               # Utilities and helpers
├── constants/           # Workout types, enums
└── config.py            # Settings (incl. Ollama host, Docling URL)
migrations/              # Alembic migrations
scripts/                 # Utility scripts (incl. seed_health_data.py)
```

## Common Patterns

### Creating New Endpoints

```python
# app/api/routes/v1/users.py
from uuid import UUID
from fastapi import APIRouter, status
from app.database import DbSession
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services import ApiKeyDep, user_service

router = APIRouter()

@router.get("/users", response_model=list[UserRead])
async def list_users(db: DbSession, _api_key: ApiKeyDep):
    """List all users."""
    return db.query(user_service.crud.model).all()

@router.post("/users", status_code=status.HTTP_201_CREATED, response_model=UserRead)
async def create_user(payload: UserCreate, db: DbSession, _api_key: ApiKeyDep):
    """Create a new user."""
    return user_service.create(db, payload)
```

### Service Pattern

```python
# app/services/user_service.py
from logging import Logger, getLogger
from app.database import DbSession
from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas import UserCreate, UserCreateInternal
from app.services.services import AppService

class UserService(AppService[UserRepository, User, UserCreateInternal, UserUpdateInternal]):
    def __init__(self, log: Logger, **kwargs):
        super().__init__(crud_model=UserRepository, model=User, log=log, **kwargs)

    def create(self, db_session: DbSession, creator: UserCreate) -> User:
        """Create user with server-generated id and created_at."""
        internal_creator = UserCreateInternal(**creator.model_dump())
        return super().create(db_session, internal_creator)

# Instantiate as singleton
user_service = UserService(log=getLogger(__name__))
```

### Repository Pattern

```python
# app/repositories/user_repository.py
from datetime import datetime
from sqlalchemy import func
from app.database import DbSession
from app.repositories.repositories import CrudRepository

class UserRepository(CrudRepository[User, UserCreateInternal, UserUpdateInternal]):
    def get_count_in_range(self, db: DbSession, start: datetime, end: datetime) -> int:
        return (
            db.query(func.count(self.model.id))
            .filter(self.model.created_at >= start, self.model.created_at < end)
            .scalar() or 0
        )
```

### Database Models

```python
# app/models/user.py
from uuid import UUID
from sqlalchemy.orm import Mapped, relationship
from app.database import BaseDbModel
from app.mappings import PrimaryKey, datetime_tz, str_100

class User(BaseDbModel):
    id: Mapped[PrimaryKey[UUID]]
    created_at: Mapped[datetime_tz]
    first_name: Mapped[str_100 | None]
    last_name: Mapped[str_100 | None]
```

### Pydantic Schemas

```python
# app/schemas/user.py
from datetime import datetime, timezone
from uuid import UUID, uuid4
from pydantic import BaseModel, ConfigDict, Field

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    first_name: str | None = None

class UserCreate(BaseModel):
    first_name: str | None = Field(None, max_length=100)

class UserCreateInternal(UserCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### Error Handling

**General rule:** Let exceptions propagate up to global handlers when possible.

```python
# In services - use raise_404=True
user = user_service.get(db, user_id, raise_404=True)

# In routes - raise HTTPException directly
from fastapi import HTTPException, status

if not user:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
```

**Handled exceptions in background tasks:**

When catching exceptions that are intentionally not propagated (e.g., to collect partial errors), use `log_and_capture_error` to ensure they're reported to Sentry:

```python
from app.utils.sentry_helpers import log_and_capture_error

# DON'T - error never reaches Sentry
try:
    process_item(item)
except Exception as e:
    logger.error(f"Failed to process: {e}")
    continue

# DO - error is logged AND captured in Sentry
try:
    process_item(item)
except Exception as e:
    log_and_capture_error(
        e,
        logger,
        f"Failed to process item {item.id}: {e}",
        extra={"item_id": item.id, "user_id": user_id}
    )
    continue
```

**When to use `log_and_capture_error`:**
- Celery tasks that catch exceptions and return error responses instead of failing
- Batch processing where you want to continue despite errors
- Multi-provider sync where one provider failure shouldn't stop others
- Don't use if exception is re-raised or allowed to propagate naturally

### Provider Strategy Pattern

See `docs/dev-guides/how-to-add-new-provider.mdx` for the full guide.

```python
# app/services/providers/garmin/strategy.py
class GarminStrategy(BaseProviderStrategy):
    @property
    def name(self) -> str:
        return "garmin"

    @property
    def api_base_url(self) -> str:
        return "https://apis.garmin.com"
```

## Health Assistant Models

Five additional models for the health AI features. All use `BaseDbModel`.

| Model | Table | Purpose | Key FKs |
|-------|-------|---------|---------|
| `MedicalDocument` | `medical_document` | Uploaded PDFs/images | `FKUser` |
| `LabResult` | `lab_result` | Parsed blood test values | `FKUser`, `document_id` (nullable, SET NULL) |
| `SymptomEntry` | `symptom_entry` | Daily symptom tracking | `FKUser` |
| `ChatSession` | `chat_session` | AI chat conversation | `FKUser` |
| `ChatMessage` | `chat_message` | Individual chat message | `FKChatSession` |

**ChatSession/ChatMessage use explicit `relationship()`** with `cascade="all, delete-orphan"` — NOT `OneToMany`/`ManyToOne` type aliases. This avoids the AutoRelMeta back_populates bug (see root AGENTS.md anti-patterns).

```python
# app/models/chat_session.py — correct cascade pattern
class ChatSession(BaseDbModel):
    __tablename__ = "chat_session"
    # ... fields ...
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )
```

**JSON columns**: `Mapped[dict | None]` and `Mapped[list | None]` work because `database.py` maps `dict → JSON` and `list → JSON` in `type_annotation_map`.

**LabResult.document_id**: Nullable FK with `ondelete="SET NULL"` — lab results survive document deletion, seeded data doesn't need a parent document.

## Health Assistant Services

### OllamaService (`app/services/ollama_service.py`)

Singleton for Ollama LLM communication. Configured via `config.py` settings.

```python
from app.services.ollama_service import ollama_service

# Health check
status = await ollama_service.health_check()  # -> dict with status, host, models

# Simple chat
response = await ollama_service.chat(messages=[{"role": "user", "content": "Hi"}])

# Streaming chat
async for chunk in ollama_service.chat_stream(messages):
    print(chunk["message"]["content"])

# Chat with tool-calling (used by ChatService)
async for event in ollama_service.chat_with_tools(messages, tools, tool_executor):
    # event types: tool_call, tool_result, content, done
```

**Config** (`backend/config/.env`):
- `OLLAMA_HOST` — LAN URL to Ollama server (e.g., `http://192.168.1.100:11434`)
- `OLLAMA_CHAT_MODEL` — Model for chat (e.g., `qwen2.5:14b`)
- `OLLAMA_EXTRACTION_MODEL` — Model for document extraction
- `OLLAMA_TIMEOUT` — Request timeout in seconds

### Health Tools (`app/services/health_tools.py`)

6 tools in OpenAI function-calling schema, dispatched via `execute_health_tool()`:

| Tool | Description |
|------|-------------|
| `get_recent_labs` | Recent lab results (days, test_name filters) |
| `get_lab_trend` | Time-series trend for a specific lab test |
| `get_symptom_timeline` | Symptom entries over time period |
| `get_wearable_summary` | Heart rate, steps, HRV summary |
| `get_daily_summary` | Combined health snapshot for a date |
| `correlate_metrics` | Cross-correlate labs, symptoms, wearables |

```python
from app.services.health_tools import HEALTH_TOOL_DEFINITIONS, execute_health_tool

# HEALTH_TOOL_DEFINITIONS is a list of dicts in Ollama/OpenAI function-calling format
result_json = await execute_health_tool("get_recent_labs", {"days": 90}, db, user_id)
```

### ChatService (`app/services/chat_service.py`)

Session CRUD + SSE streaming with tool-calling. Singleton.

```python
from app.services.chat_service import chat_service

# CRUD
session = chat_service.create_session(db, user_id, title="My Chat")
sessions = chat_service.get_sessions_for_user(db, user_id)
messages = chat_service.get_messages(db, session_id)

# SSE streaming (used by chat route)
async for event in chat_service.send_message_stream(db, session_id, user_id, "How's my health?"):
    # event types: content, tool_call, tool_result, done, error
```

## Health Assistant API Routes

### AI Status (`app/api/routes/v1/ai.py`)
- `GET /ai/status` — Ollama connectivity check

### Chat (`app/api/routes/v1/chat.py`)
- `POST /chat/sessions` — Create session (`{user_id, title?}` → 201)
- `GET /chat/sessions?user_id=UUID` — List sessions
- `GET /chat/sessions/{id}` — Session detail with messages
- `DELETE /chat/sessions/{id}` — Delete session + messages (cascade)
- `GET /chat/sessions/{id}/messages` — List messages
- `POST /chat/sessions/{id}/messages` — Send message → SSE stream

**SSE stream format** (`text/event-stream`):
```
data: {"type":"content","content":"text chunk..."}\n\n
data: {"type":"tool_call","name":"get_recent_labs","arguments":{"days":90}}\n\n
data: {"type":"tool_result","name":"get_recent_labs","result":"{...}"}\n\n
data: {"type":"done"}\n\n
data: {"type":"error","error":"message"}\n\n
```

**Route registration** in `v1/__init__.py`:
```python
v1_router.include_router(ai_router, tags=["ai"])
v1_router.include_router(chat_router, prefix="/chat", tags=["chat"])
```

## Database Migrations

```bash
make create_migration m="Add user table"  # Create
make migrate                               # Apply
make downgrade                             # Rollback
```

**Gotchas:**
- Alembic autogenerate may falsely detect removal of indexes on existing tables — manually review migration files
- If migration fails partway, version may already be stamped — use `alembic stamp <previous_rev>` before re-running
- Multi-word table names need explicit `__tablename__` in model

## Code Style
- Line length: 120 characters
- Type hints required on all functions
- Imports sorted by isort
- All imports at module level — never inside functions or methods
- PEP 8 naming conventions

## Commands

```bash
cd backend

# Lint and format (run after changes)
uv run ruff check . --fix && uv run ruff format .

# Type check
uv run ty check .

# Run tests
uv run pytest -v --cov=app
```

Use `uv add <package-name>` to add new dependencies (automatically updates pyproject.toml, lockfile, and venv).
Run `uv run ruff check . --fix && uv run ruff format .` after making changes.

## Detailed Layer Rules

### Models Layer (`app/models/`)

Models define SQL table structure using SQLAlchemy. Each model represents one table.

**Required files:**
- `app/database.py` - Contains `BaseDbModel` class with `type_annotation_map`, custom Python to SQL type mappings
- `app/mappings.py` - Defines custom Python types with `Annotated` syntax, relationship types and foreign keys

**Model structure:**
```python
from sqlalchemy.orm import Mapped
from app.database import BaseDbModel
from app.mappings import PrimaryKey, Unique, datetime_tz, email, OneToMany, ManyToOne, FKUser

class User(BaseDbModel):
    id: Mapped[PrimaryKey[UUID]]
    email: Mapped[Unique[email]]
    created_at: Mapped[datetime_tz]
    workouts: Mapped[OneToMany["Workout"]]

class Workout(BaseDbModel):
    user_id: Mapped[FKUser]
    user: Mapped[ManyToOne["User"]]
```

**Custom types:**
- `PrimaryKey[T]`, `Unique[T]`, `UniqueIndex[T]`, `Indexed[T]` - Constraints with generic type
- `str_10`, `str_50`, `str_100`, `str_255` - String length limits
- `email`, `numeric_10_2`, `numeric_15_5`, `datetime_tz` - Specialized types
- `FKUser`, `FKMedicalDocument`, `FKChatSession` - Pre-defined foreign key relationships
- `OneToMany[T]`, `ManyToOne[T]` - Relationship types (avoid for cascade-delete models)

### Repositories Layer (`app/repositories/`)

Repositories handle **ONLY** database operations. Input/output must be SQLAlchemy models only (no Pydantic schemas).

**CRUD repository:**
```python
from app.repositories.repositories import CrudRepository

class UserRepository(CrudRepository[User, UserCreate, UserUpdate]):
    def __init__(self, model: type[User]):
        super().__init__(model)

    def get_by_email(self, db_session: DbSession, email: str) -> User | None:
        return db_session.query(self.model).filter(self.model.email == email).one_or_none()
```

**Flow:** database → SQLAlchemy model → repository → SQLAlchemy model → service

### Schemas Layer (`app/schemas/`)

Schemas define API data format through Pydantic models. Handle validation and serialization.

- Use **Pydantic 2+ syntax** exclusively
- Implement validation in schemas, not database models
- Set default values in schemas to avoid database-level defaults
- `response_model` automatically converts SQLAlchemy to Pydantic

### Services Layer (`app/services/`)

Services contain business logic. They **NEVER** perform database operations directly.

**Type annotations are mandatory for all parameters and return types.**

```python
from app.services.services import AppService
from app.utils.exceptions import handle_exceptions

class UserService(AppService[UserRepository, User, UserCreate, UserUpdate]):
    def __init__(self, crud_model: type[UserRepository], model: type[User], log: Logger, **kwargs):
        super().__init__(crud_model, model, log, **kwargs)

# Mixin pattern for additional functionality
class ActivityMixin:
    def __init__(self, activity_repository: ActivityRepository = Depends(), **kwargs):
        self.activity_repository = activity_repository
        super().__init__(**kwargs)

    @handle_exceptions
    def is_user_active(self: "UserService", object_id: UUID) -> bool:
        return self.activity_repository.is_user_active(object_id)
```

**Error handling:** Use `@handle_exceptions` decorator from `app.utils.exceptions`

**Flow:** repository → SQLAlchemy model → service → SQLAlchemy model → route

### Routes Layer (`app/api/routes/`)

**Directory structure:**
```
app/api/routes/
├── __init__.py          # Head router (imports all versions)
├── v1/                  # API version 1
│   ├── __init__.py      # Version router (includes all v1 routes)
│   ├── ai.py            # AI status endpoint
│   ├── chat.py          # Chat session + message endpoints
│   └── example.py       # Specific routes
```

**Router hierarchy:**
1. Module routers - `router = APIRouter()` without prefixes or tags
2. Version router (`v1/__init__.py`) - Includes module routers with tags (singular + kebab-case), NO prefix
3. Head router (`routes/__init__.py`) - Includes version routers with version prefix from settings
4. Main router (`main.py`) - Includes head_router, NO prefix

**Route implementation:**
- Use `@router.method()` decorator with HTTP method and path
- Add `response_model` (Pydantic) and `status_code` (fastapi.status)
- Define functions as `async` by default
- Use **kebab-case** for paths: `/heart-rate`, `/import-data`
- Keep route code minimal, delegate to services
- **No trailing slashes:** Use `""` (empty string) instead of `"/"` for root routes on prefixed routers. A `"/"` path creates a trailing-slash canonical URL, causing FastAPI 307 redirects that break behind HTTPS reverse proxies.

**Flow:**
- Request: request → main.py → head_router → version_router → router → endpoint → service
- Response: service → response_model validation → router → version_router → head_router → main.py → client

## Testing

### Structure
```
tests/
├── conftest.py              # Global fixtures (DB, mocks, test client)
├── factories.py             # Factory-boy factories for all models
├── api/v1/
│   ├── conftest.py          # API auth fixtures (developer, API key)
│   └── test_*.py
├── services/
├── repositories/
├── providers/
│   └── conftest.py          # Provider-specific sample data
├── tasks/
│   └── conftest.py          # Celery sync execution mocking
├── integrations/
└── utils_tests/
```

### Conventions
- Transaction rollback per test for isolation
- Factory-boy for consistent test data (`tests/factories.py`)
- Auto-use fixtures mock Redis, Celery, and external APIs globally
- Hierarchical conftest.py: global → API-specific → provider-specific
- Fast password hashing in tests (avoids bcrypt overhead)
- `asyncio_mode = "auto"` in pytest config

## Verifying Changes

### API Testing
```bash
# Test endpoints with curl (app runs on localhost:8000)
curl -X GET http://localhost:8000/api/v1/endpoint
curl -X POST http://localhost:8000/api/v1/endpoint -H "Content-Type: application/json" -d '{"key": "value"}'
```

### Database Verification
```bash
# Connect to PostgreSQL
docker exec -it postgres__health-assistant psql -U open-wearables -d open-wearables

# Example queries
SELECT * FROM table_name LIMIT 5;
\dt  # list tables
```

### Logs
```bash
docker compose logs -f app          # API logs
docker compose logs -f celery-worker # Worker logs
```
