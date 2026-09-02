# API Design — Rishiverse Delivery

## Base URL
`/api/v1`

## Endpoints

### Auth
- `GET /api/auth/session` — Get current session
- `POST /api/auth/signin` — Initiate Google OAuth
- `POST /api/auth/signout` — End session

### Orders
- `GET /api/orders` — List all orders for current user
- `POST /api/orders` — Create a new order
- `GET /api/orders/:id` — Get order by ID
- `PATCH /api/orders/:id/status` — Update order status
- `DELETE /api/orders/:id` — Soft-delete an order

### Agents
- `GET /api/agents` — List all delivery agents
- `POST /api/agents/:id/assign` — Assign agent to order

## Response Format
```json
{
  "success": true,
  "data": {},
  "error": null
}
```
