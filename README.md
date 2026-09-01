# RishiVerse — Campus Delivery Experience

A WhatsApp-enabled delivery management system for Gate No. 2, Rishihood University. Learners pre-register deliveries, get real-time pings when packages arrive, and collect with an OTP or QR scan. Guards get a streamlined console; ops get full analytics.

## Live Deployment

| Service | URL |
|---------|-----|
| Frontend | https://rishiverse-frontend.onrender.com |
| Backend API | https://rishiverse-backend.onrender.com |
| API Docs | https://rishiverse-backend.onrender.com/docs |

## Features
- **Learner**: register expected deliveries, live status timeline, pickup OTP + QR code, package photos, WhatsApp-style notification feed, self-signup
- **Guard (Gate 2)**: expected queue → one-tap arrival logging with auto slot assignment, delivery-room capacity meter, collect-immediately queue (food/perishables), walk-in logging with photo, OTP or QR-scan verified handover, shift summary
- **Admin (Ops)**: KPIs, 7-day trend, status/type charts, room capacity & aging threshold controls, escalations panel (3+ ignored reminders), full delivery ledger
- **Automation**: background aging monitor auto-reminds learners; Twilio WhatsApp integration ready (falls back to simulated in-app feed until credentials are set)

## Stack
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, recharts, qrcode.react, html5-qrcode
- **Backend**: FastAPI, MongoDB (Motor async driver), JWT auth (bcrypt + PyJWT), Twilio SDK
- **Database**: MongoDB Atlas (M0 free tier)
- **Hosting**: Render (frontend + backend)
- **Monorepo**: `/frontend` + `/backend`

## Run Locally
```bash
# Backend
cd backend
cp .env.example .env   # fill in values
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
cp .env.example .env
yarn install
yarn start
```

## Demo Accounts (seeded on startup)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rishihood.edu.in | Admin@123 |
| Guard | guard@rishihood.edu.in | guard123 |
| Learner | aarav@rishihood.edu.in | learner123 |

## Environment Variables
See `backend/.env.example` for all required variables. Key ones:

```env
MONGO_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/
DB_NAME=rishiverse_delivery
JWT_SECRET=<random-hex-64-chars>
CORS_ORIGINS=*
```

## Enabling Real WhatsApp
Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` in `backend/.env` and restart. Each recipient phone must join the Twilio WhatsApp sandbox first.
