# Project Runbook

## 1. Model Service (FastAPI + PyTorch)
1. `cd essay/essay-backend/model`
2. First setup (per machine):
   - `py -m venv .venv`
   - `.venv\Scripts\python -m pip install --upgrade pip`
   - `.venv\Scripts\python -m pip install -r requirements.txt`
3. Start server:
   - `.venv\Scripts\python -m uvicorn src.api:app --host 0.0.0.0 --port 8000`
4. Verify:
   - `Invoke-WebRequest -UseBasicParsing -Uri http://localhost:8000/healthz`
   - Expect `{"status":"ok"}`

## 2. Frontend (Vite React)
1. `cd essay/essay`
2. Install dependencies (first time or after package updates):
   - `npm install`
3. Configure `.env`:
   - `VITE_API_BASE_URL=http://localhost:5000`
   - `VITE_MODEL_API_BASE_URL=http://localhost:8000`
4. Run dev server:
   - `npm run dev -- --host`
5. Access app at the URL Vite prints, e.g. `http://localhost:5173`

## 3. Backend (Express + MongoDB)
1. `cd essay/essay-backend`
2. Copy `.env.example` → `.env`, set:
   - `MONGO_URI=<your Mongo connection string>`
   - `JWT_SECRET=<strong secret>`
   - Optional: `PORT` (default 5000), `LOG_LEVEL`
3. Install dependencies:
   - `npm install`
4. Start dev server:
   - `npm run dev`
5. (Optional) Seed demo data:
   - `npm run seed`
   - Creates user `admin@example.com / password123`, sample students/assignments/essays.

## Running On A New Machine
- Install prerequisites: Node.js ≥18, npm, Python 3.10+ (with `py` launcher on Windows), MongoDB URI, Git (if cloning).
- Clone project or copy files.
- Perform the install steps above in order (model → frontend → backend).
- Ensure MongoDB is reachable from the machine (Atlas IP allowlist or local Mongo service).
- For Windows, if `py` is unavailable, use `python` instead in the model commands.

## Common Issues
- **Token errors**: clear `localStorage` key `essay_auth_token` or click Logout, then log back in. Ensure backend `JWT_SECRET` hasn’t changed without logging out.
- **Mongo connection failure**: verify `MONGO_URI`, network firewall, or start local Mongo service.
- **Ports already used**: stop previous dev servers (`Ctrl+C`) or run with custom ports (`npm run dev -- --host --port 5174`, etc.).
- **Model server missing**: AI evaluation fails unless the model service on port 8000 is running; restart it with the commands above.

## Stopping Servers
- Press `Ctrl+C` in each terminal running dev servers (model, frontend, backend).

