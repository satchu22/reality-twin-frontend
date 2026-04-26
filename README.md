## RealityTwin Local Setup

RealityTwin runs as:
- FastAPI backend in `backend/`
- Next.js frontend in this repo root
- Free data integrations with safe mock fallbacks

## Free Data Sources

- Weather: Open-Meteo
- Traffic: Mapbox free tier
- Global events: GDELT when reachable, otherwise mock adapter
- Satellite hazards: NASA FIRMS when configured, otherwise mock adapter
- Ports: static CSV in `backend/app/data/ports.csv`
- Airports: OpenFlights-style CSV in `backend/app/data/airports_openflights.csv`

## Required Env Vars

Copy `.env.example` to `.env.local` or `.env` and set:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_free_tier_token
DATABASE_URL=sqlite:///./backend/realitytwin.db
MAPBOX_TRAFFIC_TOKEN=your_mapbox_free_tier_token
NASA_FIRMS_CSV_URL=
```

Notes:
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is required for the frontend map.
- `MAPBOX_TRAFFIC_TOKEN` is used by the backend traffic adapter.
- `NASA_FIRMS_CSV_URL` is optional. Leave it blank to use the safe mock satellite adapter.
- If `DATABASE_URL` is omitted, the backend code defaults to SQLite at `backend/realitytwin.db`.

## Install

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Frontend:

```bash
cd /Users/mangeshphadtare/reality-twin-frontend
npm install
```

## Run Locally

Terminal 1:

```bash
cd /Users/mangeshphadtare/reality-twin-frontend/backend
source venv/bin/activate
DATABASE_URL=sqlite:///./realitytwin.db uvicorn app.main:app --reload
```

Terminal 2:

```bash
cd /Users/mangeshphadtare/reality-twin-frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

Open `http://localhost:3000`.

## Workflow

- `Dashboard`: inspect uploaded batches
- `Open Map`: view routes plus external events
- `Simulate Route`: run route simulations from existing route ids
- `Upload CSV / Destination`: upload CSVs or manually enter origin/destination coordinates and generate route options

## Test Steps

1. Start the backend and frontend with the commands above.
2. Open `http://localhost:3000`.
3. Use `Upload CSV / Destination` to upload a CSV to `/data/upload`.
4. On the same page, enter manual origin/destination coordinates and click `Generate Route Options`.
5. Confirm the top 3 route cards show route type, total time, total cost, risk level, explanation bullets, and live events used.
6. Open `Open Map` and confirm markers render as:
   Blue = weather
   Orange = traffic
   Red = satellite hazard
   Purple = global event
7. Click a route on the map, run the simulation, and approve a decision from the route panel.

## Verification Run

Completed locally in this workspace:
- `npm run lint`
- `backend/venv/bin/python -m compileall backend/app`
- Backend service smoke test against SQLite with adapter fallbacks
