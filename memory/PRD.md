# PRD — GateFlow: Rishihood Campus Delivery Experience

## Original Problem Statement
Reimagining the delivery experience at Rishihood University. Deliveries at Gate No. 2 are a logistical hassle for learners, security and ops. Constraints: a guard remains at Gate 2; delivery room has limited capacity; some deliveries (food/perishables) must be collected immediately. Requirement: a WhatsApp-enabled, integrated experience that makes the entire journey seamless for learners and effortless for the people managing it.

## User Choices
- Simulated WhatsApp notifications inside the app (no real WhatsApp API)
- 3 roles: Learner + Gate Guard + Ops/Admin
- JWT email/password auth (seeded demo accounts)
- Core flow as proposed: register expected → guard logs arrival (room slot or collect-immediately) → OTP notification → OTP-verified pickup

## Architecture
- FastAPI + MongoDB (motor), single server.py; all routes under /api
- JWT Bearer auth (PyJWT + bcrypt), roles: learner/guard/admin; seeded on startup
- React 19 + shadcn/ui + Tailwind + recharts; "Tactical Utility" design (Outfit/Manrope/JetBrains Mono, Safety Orange)
- Collections: users, deliveries, notifications, settings
- Delivery lifecycle: expected → arrived (storage=room+slot | counter) → picked_up
- Simulated WhatsApp: notifications collection rendered in WhatsApp-style drawer; created at each status transition
- Dashboards poll every 8–10s

## User Personas
1. Learner — registers expected deliveries, receives WhatsApp-style pings, collects with OTP
2. Gate 2 Guard — logs arrivals/walk-ins, manages room slots, verifies OTP at handover
3. Ops Admin — analytics, room capacity management, full delivery ledger

## Implemented (June 2026 — MVP)
- JWT auth, 4 seeded accounts (see /app/memory/test_credentials.md), role-routed dashboards
- Learner: register expected delivery, delivery cards with status timeline, big OTP display, collect-now alerts, delete expected, history, WhatsApp drawer with unread badge
- Guard: expected queue → Mark Arrived dialog (room slot auto-assign / collect-immediately), capacity meter, collect-immediately urgent queue, walk-in logging, OTP pickup verification
- Admin: KPIs (total, awaiting, picked up, avg pickup time), 7-day trend, status/type charts, capacity editor, deliveries table
- Room capacity enforcement (409 when full), slot auto-assignment (lowest free)
- Testing: iteration_1 — 20/20 backend, all frontend flows pass

## Implemented (June 2026 — Iteration 2)
- Real WhatsApp via Twilio: send_whatsapp helper in server.py sends via Twilio WhatsApp API when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM are set in backend/.env (currently EMPTY → graceful fallback to channel='simulated' in-app drawer). GET /api/whatsapp/status drives the drawer subtitle (live vs simulated). Notification docs carry `channel` field.
- QR pickup: learner card shows QR (qrcode.react, payload GATEFLOW:{id}:{otp}) beside OTP; guard 'Scan Pickup QR' button opens camera scanner (html5-qrcode) with manual code input fallback; POST /api/deliveries/pickup/scan verifies and completes handover (shared complete_pickup helper with manual OTP endpoint)
- Testing: iteration_2 — 29/29 backend, all frontend flows pass

## Implemented (June 2026 — Iteration 3)
- Package Aging Alerts: background monitor (60s loop) auto-reminds learners via WhatsApp-style notification when a room-stored package exceeds aging_hours threshold (default 24h, repeats each threshold period, tracked via last_reminder_at/reminder_count). Guard sees amber Aging badges, 'Xh stored' text, and aging alert under capacity meter. Admin edits threshold via PUT /api/admin/aging; aging_hours/aging_count exposed in /api/room/status and /api/admin/stats.
- Package Photos: guard attaches photo in arrive/walk-in dialogs (PhotoPicker, camera capture on mobile) → POST /api/deliveries/{id}/photo → Emergent Object Storage (gateflow/packages/{id}/{uuid}.ext) → photo_path on delivery. Served via GET /api/deliveries/{id}/photo with Bearer or ?auth= query token (img tags); learner sees photo on card, guard sees thumbnails. EMERGENT_LLM_KEY in backend/.env powers storage.
- Testing: iteration_3 — 36/36 backend (incl. 7 new tests), all frontend flows pass

## Implemented (June 2026 — Iteration 4)
- Guard Shift Summary: GET /api/guard/shift-summary (today's received/walk-ins/handed-over/still-waiting + room/counter split + avg pickup time + waiting list); 'Shift Summary' button in guard header opens recap dialog
- Learner Signup: login page 'Create account' toggle (name, phone, email, password) → POST /api/auth/register → auto-login to learner dashboard
- Admin Escalation: aging monitor sets escalated=true on 3rd reminder; /api/admin/stats returns 'escalated' list; red Escalations panel on admin dashboard (auto-clears once picked up)
- Testing: iteration_4 — 35/35 backend, all frontend flows pass

## Backlog
- P1: Activate Twilio (user pastes credentials into backend/.env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, then restart backend)
- P2: Pickup ratings; email digests; reminder min-interval decoupled from aging_hours
- P2: Pagination for deliveries table; websocket live updates instead of polling; DialogDescription a11y polish
