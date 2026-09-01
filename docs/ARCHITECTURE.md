# System Architecture

## Overview

RishiVerse is a monorepo with a React frontend and FastAPI backend, connected to MongoDB Atlas. Deployment is fully managed on Render (free tier).

```
┌─────────────────────────────────────────────────────┐
│                    Browser / PWA                    │
│         React 19 + Tailwind + shadcn/ui             │
│    https://rishiverse-frontend.onrender.com         │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (REST)
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                    │
│         Uvicorn + Motor (async MongoDB)             │
│     https://rishiverse-backend.onrender.com         │
└──────────────────────┬──────────────────────────────┘
                       │ mongodb+srv
┌──────────────────────▼──────────────────────────────┐
│             MongoDB Atlas (M0 Free)                 │
│          cluster0.r1wrl6i.mongodb.net               │
│           DB: rishiverse_delivery                   │
└─────────────────────────────────────────────────────┘
```

## Collections

| Collection | Purpose |
|------------|---------|
| `users` | Learners, guards, admins |
| `deliveries` | All delivery records |
| `notifications` | In-app notification feed |
| `room_config` | Capacity and aging thresholds |

## Auth Flow

1. Client sends `POST /api/auth/login` with email + password
2. Backend verifies bcrypt hash, issues signed JWT (24h expiry)
3. Client stores token in `localStorage`, sends as `Authorization: Bearer` on all subsequent requests
4. Backend middleware decodes and validates JWT on every protected route

## Delivery Lifecycle

```
LEARNER registers → status: pending
      ↓
Package arrives at gate → GUARD marks arrived → status: arrived
      ↓  (auto-notify learner via WhatsApp / in-app)
LEARNER collects with OTP/QR → GUARD confirms → status: collected
```

## Background Jobs

- **Aging Monitor**: FastAPI `asyncio` background task, runs every 60s. Flags deliveries uncollected past the aging threshold. Sends reminder notifications and escalates to admin after 3 reminders.

## WhatsApp Integration

Twilio SDK is configured at runtime via env vars. If credentials are absent, all notifications fall back to the in-app feed silently — the system never crashes on missing Twilio config.

## Deployment Notes

- Backend: Render Web Service (Python, Oregon region)
- Frontend: Render Static Site
- Cold starts: Render free tier spins down after 15 min inactivity; first request may take 30-60s
- MongoDB Atlas M0: 512MB storage, shared cluster, no dedicated RAM
