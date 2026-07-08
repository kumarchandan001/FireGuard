# 🛡️ FireGuard AI

**Intelligent Fire Detection, Alarm & Emergency Response Platform**

FireGuard AI is a real-time fire and smoke detection system powered by YOLOv8 computer vision. It captures live camera feeds, runs AI inference on each frame, and triggers multi-level alarms with incident tracking when threats are detected.

---

## 🚀 Features

### Core Detection Pipeline
- **Real-time Camera Capture** — Background thread captures frames at configurable FPS
- **YOLOv8 AI Inference** — Fire and smoke detection with configurable confidence threshold
- **Frame Skipping** — Tunable inference frequency to balance accuracy vs. performance
- **Cooldown Mechanism** — Prevents duplicate incident creation from the same fire event

### Alarm System
- **State Machine** — `IDLE → TRIGGERED → ACTIVE → ACKNOWLEDGED → IDLE`
- **Auto-confirmation** — Alarms auto-escalate from triggered to active after configurable delay
- **WebSocket Broadcasting** — All alarm state changes pushed to connected clients instantly
- **Audible + Visual** — Emergency mode transforms the UI with red theme and pulsing animations

### Incident Management
- **Automatic Creation** — Incidents created from detection events with screenshot capture
- **Lifecycle Tracking** — Acknowledge → Resolve with resolution notes
- **Filtered Pagination** — Query by detection type, status, date range
- **Screenshot Storage** — Date-partitioned directory structure

### Dashboard
- **Live Camera Feed** — WebSocket-streamed annotated frames with detection overlays
- **Status Cards** — Camera, AI Engine, WebSocket, and incident counts
- **Emergency Mode** — CSS theme auto-switches to high-contrast red on detection
- **Recent Incidents** — Real-time list with type badges and confidence scores

### Infrastructure
- **Event Bus** — In-process async pub/sub for module decoupling
- **Modular Monolith** — Clean separation: camera, ai_engine, alarm, incident, settings
- **Docker Ready** — Multi-stage Dockerfiles with docker-compose orchestration
- **SQLite + SQLAlchemy** — Lightweight DB with ORM and Alembic migrations

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │Dashboard │ │Incidents │ │Analytics │ │  Settings  │  │
│  │  (Live)  │ │  (CRUD)  │ │ (Charts) │ │   (API)    │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│       │WebSocket    │REST API    │REST API      │REST API │
├───────┼─────────────┼────────────┼──────────────┼────────┤
│       ▼             ▼            ▼              ▼        │
│                    Backend (FastAPI)                      │
│  ┌──────────────────────────────────────────────────────┐│
│  │                  API Layer (Routers)                  ││
│  ├──────────────────────────────────────────────────────┤│
│  │                 Service Layer (Logic)                 ││
│  │  ┌────────┐ ┌──────────┐ ┌───────┐ ┌──────────────┐ ││
│  │  │Camera  │ │AI Engine │ │Alarm  │ │  Incident    │ ││
│  │  │Service │→│Detector  │→│FSM    │→│  Service     │ ││
│  │  └────────┘ └──────────┘ └───────┘ └──────────────┘ ││
│  │         ↕ Event Bus (async pub/sub) ↕                ││
│  ├──────────────────────────────────────────────────────┤│
│  │              Data Layer (SQLAlchemy + SQLite)         ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4    |
| **Backend**  | Python 3.12+, FastAPI, Uvicorn, SQLAlchemy, Alembic |
| **AI/CV**    | YOLOv8 (Ultralytics), OpenCV, NumPy              |
| **Real-time**| WebSocket (native), Event Bus (in-process)       |
| **Database** | SQLite (dev), PostgreSQL-ready via SQLAlchemy     |
| **Deploy**   | Docker, Docker Compose, Nginx                    |

---

## ⚡ Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Webcam (built-in or USB)

### 1. Clone & Setup Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate       # Windows
# source .venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
```

### 2. Setup Frontend

```bash
cd frontend
npm install
```

### 3. Run

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4. Start Detection

Click **"▶ Start Camera"** on the dashboard, or:
```bash
curl -X POST http://localhost:8000/api/v1/camera/start
```

### Docker

```bash
docker compose up --build
```
Access at **http://localhost** (port 80).

---

## 📁 Project Structure

```
fireguard-ai/
├── backend/
│   ├── app/
│   │   ├── core/           # Shared infrastructure
│   │   │   ├── base_model.py
│   │   │   ├── base_repository.py
│   │   │   ├── database.py
│   │   │   ├── event_bus.py
│   │   │   ├── exceptions.py
│   │   │   └── utils.py
│   │   ├── camera/         # Camera capture module
│   │   ├── ai_engine/      # YOLOv8 detection module
│   │   ├── alarm/          # Alarm state machine
│   │   ├── incident/       # Incident CRUD + lifecycle
│   │   ├── settings/       # KV configuration store
│   │   ├── health/         # Health check endpoint
│   │   ├── websocket/      # WS connection manager
│   │   ├── config.py       # Pydantic Settings
│   │   ├── dependencies.py # FastAPI DI
│   │   └── main.py         # App factory + lifespan
│   ├── alembic/            # Database migrations
│   ├── models/             # AI model weights
│   ├── data/               # SQLite DB + screenshots
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/            # Fetch-based API client
│   │   ├── components/
│   │   │   ├── dashboard/  # Live feed, alarm banner, status cards
│   │   │   ├── layout/     # Sidebar, Header, MainLayout
│   │   │   └── shared/     # Card, Badge, Button, Spinner
│   │   ├── hooks/          # useWebSocket, useApi
│   │   ├── pages/          # Dashboard, Incidents, Analytics, Reports, Settings
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Constants, formatters
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | System health check |
| `GET` | `/api/v1/camera/status` | Camera status |
| `POST` | `/api/v1/camera/start` | Start camera capture |
| `POST` | `/api/v1/camera/stop` | Stop camera capture |
| `GET` | `/api/v1/ai-engine/status` | AI engine status |
| `GET` | `/api/v1/alarm/status` | Current alarm state |
| `POST` | `/api/v1/alarm/acknowledge` | Acknowledge alarm |
| `POST` | `/api/v1/alarm/dismiss` | Dismiss alarm |
| `GET` | `/api/v1/incidents` | List incidents (paginated) |
| `GET` | `/api/v1/incidents/recent` | Recent incidents |
| `GET` | `/api/v1/incidents/summary` | Incident statistics |
| `GET` | `/api/v1/incidents/:id` | Get single incident |
| `PATCH` | `/api/v1/incidents/:id/acknowledge` | Acknowledge incident |
| `PATCH` | `/api/v1/incidents/:id/resolve` | Resolve incident |
| `GET` | `/api/v1/incidents/:id/screenshot` | Get incident screenshot |
| `GET` | `/api/v1/settings` | List all settings |
| `PUT` | `/api/v1/settings/:key` | Update a setting |
| `WS` | `/ws/feed` | Real-time camera feed + events |

Interactive API docs available at **http://localhost:8000/docs** (development only).

---

## ⚙️ Configuration

All settings can be overridden via environment variables prefixed with `FIREGUARD_`:

| Variable | Default | Description |
|----------|---------|-------------|
| `FIREGUARD_ENV` | `development` | Environment (development/production) |
| `FIREGUARD_CAMERA_INDEX` | `0` | Webcam device index |
| `FIREGUARD_CAMERA_FPS` | `15` | Target capture FPS |
| `FIREGUARD_CONFIDENCE_THRESHOLD` | `0.65` | Min detection confidence |
| `FIREGUARD_DETECTION_COOLDOWN_SECONDS` | `30` | Seconds between incidents |
| `FIREGUARD_ALARM_CONFIRMATION_SECONDS` | `2` | Delay before alarm activates |
| `FIREGUARD_MODEL_PATH` | `models/yolov8n_fire.pt` | Path to fire detection model |

---

## 📄 License

This project is for educational and demonstration purposes. See individual dependency licenses for production use.
