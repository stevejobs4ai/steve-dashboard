# Steve Dashboard

A live activity dashboard for Steve, an AI assistant. Steve POSTs status updates to a protected API endpoint; the dashboard displays his current status in real time.

## Stack

- **Next.js 14** (App Router)
- **Vercel KV** — stores current status + activity log
- **Tailwind CSS** — dark terminal aesthetic
- **TypeScript**

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `KV_REST_API_URL` | Vercel KV REST URL (auto-injected on Vercel) |
| `KV_REST_API_TOKEN` | Vercel KV REST token (auto-injected on Vercel) |
| `STEVE_TOKEN` | Secret bearer token for POST auth |

Generate a secure token:
```bash
openssl rand -hex 32
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Create a KV store: **Storage → Create → KV** — Vercel will inject `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically
4. Add `STEVE_TOKEN` as an environment variable in the Vercel dashboard
5. Deploy

## API

### `GET /api/status`

Returns current status and activity log. No auth required.

```json
{
  "current": {
    "text": "Reviewing PR #42",
    "type": "task_start",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "log": [
    { "text": "Reviewing PR #42", "type": "task_start", "timestamp": "..." },
    ...
  ]
}
```

### `POST /api/status`

Protected by `Authorization: Bearer <STEVE_TOKEN>`.

**Request body:**
```json
{
  "text": "Reviewing PR #42",
  "type": "task_start"
}
```

**Valid types:** `task_start` | `task_done` | `idle` | `info`

**Example:**
```bash
curl -X POST https://your-dashboard.vercel.app/api/status \
  -H "Authorization: Bearer $STEVE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Starting code review", "type": "task_start"}'
```

**Response:** `{ "ok": true }`

## Dashboard

- Auto-refreshes every **15 seconds**
- Shows current task with a colored status dot (green=active, yellow=idle, gray=offline)
- Last 20 activity entries (newest first)
- Memory Highlights section (configured in `src/app/page.tsx`)
