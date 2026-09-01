# Changelog

All notable changes to RishiVerse are documented here.

## [1.0.0] — 2026-09-01

### Added
- Full learner, guard, and admin portals with role-based routing
- JWT authentication (bcrypt password hashing, 24h token expiry)
- Delivery registration with expected date, package type, and sender details
- One-tap arrival logging for guards with auto slot assignment
- Room capacity meter with configurable thresholds
- OTP + QR-scan verified handover flow
- Package photo capture via webcam/camera at arrival
- Walk-in delivery logging (unregistered packages)
- Collect-immediately queue for perishables and food
- WhatsApp-style in-app notification feed
- Background aging monitor — auto-reminds learners, escalates after 3 reminders
- Admin KPI dashboard: pickup rate, avg wait time, volume trend, escalations panel
- Full delivery ledger with status/type filters
- Twilio WhatsApp integration (falls back gracefully if not configured)
- MongoDB Atlas persistence with Motor async driver
- Render deployment (frontend static site + backend web service, Oregon region)
- Seeded demo accounts for admin, guard, and learner roles

### Technical
- FastAPI + Uvicorn async backend
- React 19 frontend with Tailwind CSS and shadcn/ui component library
- recharts for analytics visualizations
- qrcode.react + html5-qrcode for QR generation and scanning
- CORS configured for cross-origin frontend-backend communication
- Graceful MongoDB startup (seed wrapped in try/except, server starts even if DB is temporarily unreachable)
