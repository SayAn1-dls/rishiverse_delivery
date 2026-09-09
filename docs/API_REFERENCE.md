# API Reference

## Authentication
All endpoints require a valid session token passed as a cookie.

## Endpoints

### POST /api/auth/login
Initiates user login flow.

### GET /api/users/:id
Fetch user profile by ID.

### POST /api/orders
Create a new delivery order.

### GET /api/orders/:id
Fetch order details.

### PATCH /api/orders/:id/status
Update delivery status.
