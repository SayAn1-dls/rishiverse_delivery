# Environment Configuration

All configuration is done via environment variables. Never commit secrets to the repository.

## Required Variables

| Variable       | Description                                      | Example                          |
|----------------|--------------------------------------------------|----------------------------------|
| `MONGO_URL`    | Full MongoDB Atlas connection string             | `mongodb+srv://user:pass@cluster/db` |
| `JWT_SECRET`   | Secret key for signing JWT tokens (32+ chars)    | `your-strong-random-secret`      |
| `ADMIN_EMAIL`  | Email for the seeded admin account               | `admin@rishihood.edu.in`         |
| `ADMIN_PASSWORD` | Password for the seeded admin account          | `Admin@123`                      |

## Optional Variables

| Variable              | Description                          | Default  |
|-----------------------|--------------------------------------|----------|
| `PORT`                | Port the server listens on           | `8000`   |
| `TWILIO_ACCOUNT_SID`  | Twilio SID for WhatsApp notifications | —        |
| `TWILIO_AUTH_TOKEN`   | Twilio auth token                    | —        |
| `TWILIO_WHATSAPP_FROM`| Twilio WhatsApp sender number        | —        |

## Setting Variables on Render

1. Go to your Render service dashboard
2. Click Environment → Add Environment Variable
3. Add each key-value pair
4. Click Save — Render will automatically trigger a redeploy

## Local Development

Create a `.env` file in the repo root (already in `.gitignore`):

```
MONGO_URL=mongodb+srv://...
JWT_SECRET=dev-local-secret-do-not-use-in-prod
ADMIN_EMAIL=admin@rishihood.edu.in
ADMIN_PASSWORD=Admin@123
```
