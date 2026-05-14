## RealityTwin

RealityTwin is a logistics simulation platform with:
- a Next.js frontend in the repository root
- a FastAPI backend in `backend/`
- optional realtime updates over WebSockets
- route simulation, map visualization, uploads, notifications, and transaction flows

## Project Structure

- `app/`: Next.js App Router pages and route handlers
- `components/`: shared React UI and realtime provider
- `lib/`: frontend API, simulation, map, and data helpers
- `backend/app/`: FastAPI app code
- `backend/app/data/`: bundled route, airport, and port reference data
- `realitytwin-mobile/`: mobile client code

## Environment Variables

Frontend (`.env.local` for local development):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_free_tier_token
```

Backend (`backend/.env` locally):

```bash
DATABASE_URL=sqlite:///./realitytwin.db
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
TRANSACTION_REMINDER_HOUR=0
TRANSACTION_REMINDER_MINUTE=0
LIVE_EVENT_REFRESH_MINUTES=10
OPENWEATHER_API_KEY=
MAPBOX_TRAFFIC_TOKEN=
NASA_FIRMS_CSV_URL=
```

Notes:
- `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000` when unset.
- Frontend API requests use shared URL helpers so moving to a hosted backend later only requires changing environment variables.
- Keep API keys and tokens only in environment variables, never in git.

## Local Development

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

3. Start the backend:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

4. Start the frontend in a second terminal:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

5. Open `http://localhost:3000`

## Verification

Recommended checks before pushing:

```bash
npm run lint
npm run build
backend/venv/bin/python -m compileall backend/app
```

## Security Notes

Do not commit:
- `.env`
- `.env.local`
- API keys
- Mapbox tokens
- database files
- `node_modules`
- `venv` or `.venv`

The repository `.gitignore` is configured to protect those files.
