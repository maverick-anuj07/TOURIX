# TOURIX
> **Your AI-Powered Travel Companion for Safer Exploration** 🛡️🗺️
> Specially tailored for Nashik, Maharashtra — India's Wine Capital and Ancient Pilgrim Heritage City.

---

## 🌟 Key Features

1. **🏛️ Comprehensive Verified Places Database**
   - 38+ verified cultural, spiritual, adventure, and vineyard destinations.
   - Proximity search (`/api/places/near-me?lat=...&lng=...&radius_km=10`) with exact distance calculations.
   - Filter by categories: *Spiritual, Heritage, Nature, Vineyards, Adventure, Food, Culture*.

2. **🤖 AI Travel & Safety Companion (Gemini 1.5 Flash)**
   - **Smart Multilingual Chat**: Local tourism guidance with safety context (supports English, Hindi, and Marathi).
   - **Dynamic Itinerary Generator**: Custom hourly schedules tailored by duration (e.g., 4 hrs, 8 hrs), budget, and pace (relaxed vs packed).
   - **Route Risk Analysis**: Evaluates GPS route corridors against Nashik terrain risks (Godavari river flood surges, steep Harihar steps, night travel).

3. **👥 Real-time Group Tracking & Separation Alerts**
   - Live WebSocket connection (`/ws/group/{group_id}`).
   - Automatic separation detection when any member drifts beyond 300 meters from the group anchor.
   - Instant calculation of nearest **Safe Haven / Regroup Point** (Safe Cafes, Police Stations).

4. **🚨 SOS & Emergency Management System**
   - Official Nashik District Government helplines (Police 100, Women Helpline 1091, Disaster 1077, Ambulance 108).
   - One-touch SOS dispatch with geolocation broadcast, battery level, and nearest hospital/police locator.

---

## 🏗️ Backend Architecture

```
TOURIX/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI Application Factory & Lifecycle
│   │   ├── core/
│   │   │   └── config.py        # Pydantic Settings & Environment
│   │   ├── models/              # Pydantic Request/Response Schemas
│   │   │   ├── places.py
│   │   │   ├── ai.py
│   │   │   ├── group.py
│   │   │   └── emergency.py
│   │   ├── services/            # Business Logic
│   │   │   ├── ai_service.py    # Gemini 1.5 integration + Offline fallbacks
│   │   │   ├── geo_service.py   # Haversine distance, Safe Haven & Risk calculation
│   │   │   └── group_service.py # Room-isolated WebSocket group manager
│   │   ├── api/                 # REST & WebSocket Routers
│   │   │   ├── places.py        # Places & near-me search
│   │   │   ├── ai.py            # AI Chat & Itinerary endpoints
│   │   │   ├── group.py         # Group WebSocket & status
│   │   │   └── emergency.py     # SOS & Helplines
│   │   └── data/
│   │       ├── places.json      # Complete Nashik places catalog
│   │       └── safety_data.py   # Verified Safe Havens & Risk Zones
│   ├── requirements.txt         # Production dependencies
│   └── run.py                   # Dev server runner
├── server.py                    # Root entrypoint
├── src/                         # Vite frontend application
└── index.html
```

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run backend server
python server.py
# Or:
python backend/run.py
```

- **API Server**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Alternative ReDoc**: `http://localhost:8000/redoc`

### 2. Frontend Setup

```bash
npm install
npm run dev
```

---

## 🧪 Testing

Run backend endpoint test suite:

```bash
python test_backend.py
```

## Production Integrations

Copy `backend/.env.example` to the repository-root `.env` and configure real provider credentials before deployment. Do not commit the resulting `.env` file.

- The onboarding prototype uses `SMS_PROVIDER=free` to generate a random OTP on the backend and display it in the UI. The entered code is verified by the backend; wrong, expired, and over-attempt codes are rejected. This mode does not send SMS and must not be used as production authentication.
- For real delivery, select Twilio or MSG91 and configure provider credentials. In provider modes the OTP is delivered by the provider and is not exposed by the API.
- For MSG91, set `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, and `MSG91_OTP_TEMPLATE_ID`. Create and approve the OTP template and complete the required sender/DLT configuration in MSG91 before testing. MSG91 generates and verifies these OTPs.
- Sessions are signed and expire after 24 hours. Tourist registration requires a matching verified OTP session.
- Apply `backend/migrations/001_production_schema.sql` to Supabase before setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is server-only and must never be exposed to the browser.
- SOS alerts are persisted and can notify configured emergency contacts/dispatch sinks through Twilio or SMTP. Direct dispatch into police, ambulance, or government systems is not integrated; the API reports whether notifications were actually sent.
- Configure `ROUTING_PROVIDER=openrouteservice` and `OPENROUTESERVICE_KEY` for road geometry. Without them, the API returns an explicitly labeled straight-line estimate.
- The issued TOURIX traveler ID is an app credential linked to verified contact. It is not a government ID or a government identity check.
- Offline caching covers the deployed app shell and same-origin assets after they have been loaded online. External map tiles, live APIs, OTP delivery, and SOS dispatch are not available offline.
