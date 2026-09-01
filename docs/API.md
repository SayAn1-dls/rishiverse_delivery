# RishiVerse API Reference

Base URL: `https://rishiverse-backend.onrender.com`

All protected routes require `Authorization: Bearer <token>` header.

---

## Auth

### POST /api/auth/login
Authenticate a user and receive a JWT.

**Body**
```json
{ "email": "admin@rishihood.edu.in", "password": "Admin@123" }
```
**Response 200**
```json
{
  "user": { "id": "...", "name": "Ops Admin", "email": "...", "role": "admin" },
  "access_token": "<jwt>"
}
```

### POST /api/auth/signup
Self-register a new learner account.

**Body**
```json
{ "name": "Aarav Singh", "email": "aarav@rishihood.edu.in", "password": "secret", "phone": "+919999999999" }
```
**Response 201** — same shape as login response.

---

## Deliveries

### GET /api/deliveries
List deliveries. Admins/guards see all; learners see their own.

**Query params**: `status`, `page`, `limit`

### POST /api/deliveries
Create a new delivery registration (learner).

**Body**
```json
{
  "sender_name": "Amazon",
  "tracking_id": "AMZ1234567",
  "package_type": "standard",
  "expected_date": "2026-09-05",
  "notes": "Fragile"
}
```

### PATCH /api/deliveries/{id}/arrive
Mark a delivery as arrived at the gate (guard only).

### POST /api/deliveries/{id}/handover
Complete pickup with OTP or QR verification.

**Body**: `{ "otp": "482910" }` or `{ "qr_token": "..." }`

---

## Room

### GET /api/room/status
Get current room capacity and slot occupancy.

### PATCH /api/room/config
Update capacity thresholds (admin only).

---

## Notifications

### GET /api/notifications
Get notification feed for the authenticated user.

### PATCH /api/notifications/{id}/read
Mark a notification as read.

---

## Admin

### GET /api/admin/kpis
Dashboard KPIs: total deliveries, pickup rate, avg wait time, escalations.

### GET /api/admin/trend
7-day delivery volume trend data.

### GET /api/admin/escalations
List deliveries with 3+ ignored reminders.

---

## Error Format
```json
{ "detail": "Error message here" }
```
HTTP status codes follow REST conventions (400 bad request, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error).
