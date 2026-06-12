# 🛡️ ShieldNet — Cloud DDoS Mitigation & Detection Platform

Full-stack DDoS detection and mitigation platform powered by a two-stage XGBoost ML pipeline trained on UNSW-NB15 and CICIDS datasets.

---

## 📁 Folder Structure

```
shieldnet/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/           # Node.js + Express + Socket.io
├── ml-service/        # Python FastAPI — XGBoost inference
├── database/          # PostgreSQL schema
├── docker-compose.yml
└── README.md
```

---

## ⚙️ Stack

| Layer       | Tech                              |
|-------------|-----------------------------------|
| Frontend    | React 18, Vite, Tailwind CSS, Recharts, Socket.io-client |
| Backend     | Node.js, Express, Socket.io, JWT  |
| Database    | PostgreSQL 16                     |
| ML Service  | Python, FastAPI, XGBoost, joblib  |

---

## 🚀 Quick Start (Docker — Recommended)

### 1. Add your trained model files

Copy your `.joblib` files into `ml-service/models/`:

```
ml-service/models/
├── xgb_unsw_nb15_model.joblib
├── unsw_features_list.joblib
├── unsw_label_encoders.joblib
├── cic_xgb_model.joblib
├── cic_scaler.joblib
└── cic_label_encoder.joblib
```

### 2. Start everything

```bash
docker-compose up --build
```

### 3. Open the app

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **ML Service docs:** http://localhost:8000/docs

### 4. Create your first user

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@shieldnet.io","password":"Admin@1234","role":"admin"}'
```

---

## 🛠️ Manual Setup (without Docker)

### PostgreSQL

```bash
createdb shieldnet
psql shieldnet < database/schema.sql
```

### ML Service

```bash
cd ml-service
pip install -r requirements.txt
# Place your .joblib files in ml-service/models/
uvicorn main:app --reload --port 8000
```

### Backend

```bash
cd backend
npm install
cp .env.example .env      # Fill in your DB + JWT values
npm run dev               # Starts on port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev               # Starts on port 5173
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login → JWT |
| GET  | `/api/auth/me` | Current user |

### Traffic
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/traffic/ingest` | Ingest flow → run ML → store |
| GET  | `/api/traffic` | Paginated logs |
| GET  | `/api/traffic/live-stats` | Last 60s per-second stats |

### Detection
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/detection/attacks` | Attack events |
| GET  | `/api/detection/stats` | Aggregated stats |
| POST | `/api/detection/predict` | Ad-hoc prediction |
| GET  | `/api/detection/model-info` | Model metadata |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | KPI summary |
| GET | `/api/analytics/traffic-series` | Time-series data |
| GET | `/api/analytics/attack-types` | Attack breakdown |
| GET | `/api/analytics/top-attackers` | Top attacker IPs |

### Mitigation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/mitigation/rules` | All rules |
| PATCH  | `/api/mitigation/rules/:id/toggle` | Enable/disable rule |
| GET    | `/api/mitigation/blocked-ips` | IP blocklist |
| POST   | `/api/mitigation/blocked-ips` | Block an IP |
| DELETE | `/api/mitigation/blocked-ips/:id` | Unblock IP |

---

## 🤖 ML Pipeline

```
Network Flow
     │
     ▼
┌─────────────────────────────┐
│  Stage 1 — UNSW-NB15        │
│  XGBoost Binary Classifier  │
│  Threshold: 0.30 probability│
└─────────────────────────────┘
     │ suspicious?
     ▼
┌─────────────────────────────┐
│  Stage 2 — CICIDS           │
│  XGBoost Multi-Class        │
│  DDoS / DoS Hulk / Slowloris│
│  HTTP Flood / Bot / etc.    │
└─────────────────────────────┘
     │
     ▼
  Auto-block HIGH/CRITICAL IPs
  WebSocket broadcast to UI
  Alert stored in PostgreSQL
```

---

## 🔴 WebSocket Events

| Event | Direction | Data |
|-------|-----------|------|
| `traffic:snapshot` | Server→Client | `{total_rps, attack_rps, bytes_per_sec}` |
| `attack:new` | Server→Client | Attack event object |
| `alert:new` | Server→Client | Alert object |
| `dashboard:summary` | Server→Client | `{blocked_ips, attacks_1h, unread_alerts}` |

---

## 📊 Dashboard Pages

| Page | Description |
|------|-------------|
| Overview | Real-time stats, traffic chart, attack feed, ML metrics |
| Traffic Monitor | 60s live chart, 24h distribution, bandwidth |
| Threat Detection | Full attack feed, confidence scores, geo breakdown |
| Analytics | 7-day charts, attack type breakdown, top attackers |
| Mitigation | Toggle rules, manage IP blocklist |
| Reports | Summary report, export options |
