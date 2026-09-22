# CivicPulse

**See it. Report it. Resolve it.**

CivicPulse is a civic intelligence workspace for reporting local issues, tracking resolution, and giving city teams a live operational view. The current build includes a polished React/Vite citizen dashboard, interactive civic map surface, report wizard, MongoDB-ready Express API, JWT authentication, Socket.IO events, geospatial issue queries, and a development seed flow.

## Run locally

Prerequisites: Node.js 20+, npm, and a MongoDB Atlas cluster.

```powershell
npm install
Copy-Item .env.example .env
npm run seed
npm run dev
```

Open `http://localhost:5173` for the client and `http://localhost:5000/api/health` for the API.

If MongoDB is installed as a Windows service:

```powershell
The application uses MongoDB Atlas through `MONGODB_URI`; no local MongoDB service is required.
```

## Demo accounts

Seeded account passwords:

- `citizen@demo.com`
- `authority@demo.com` uses password `admin`
- `worker@demo.com`
- `admin@demo.com`

The citizen, field worker, and admin accounts use password `CivicPulse2026!`.

## Commands

- `npm run dev` starts the API and Vite client together.
- `npm run client` starts only the client.
- `npm run server` starts only the API.
- `npm run seed` creates demo users and MongoDB issue records.
- `npm run build` creates the production client bundle.

## Configuration

Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB Atlas connection string. `AI_PROVIDER` and `AI_API_KEY` are intentionally optional. Without a configured provider, the API returns an explicit unavailable response instead of claiming an AI result.

For the deployed client, set `VITE_API_URL` and `VITE_SOCKET_URL` in Vercel to `https://team219c61.onrender.com`, then redeploy. The Render URL is the API service, so `/api/health` is the health check; the browser application itself is served by Vercel.

## Structure

```text
client/                 React + Vite interface
server/src/index.js     Express, Mongoose, Socket.IO API
server/src/seed.js      Development/demo data
.env.example            Local and Atlas-ready configuration template
```

## Current scope

The dashboard and report wizard are fully interactive in the browser, including report submission, new map markers, notification feedback, responsive navigation, and graceful visual states. The API provides the core auth, issue, nearby geospatial, confirmation, notification, and AI abstraction routes. Production image storage, provider-specific AI adapters, and authority/field-worker screens are the next expansion points; the API boundary is already separated so those additions do not require rewriting the client foundation.
