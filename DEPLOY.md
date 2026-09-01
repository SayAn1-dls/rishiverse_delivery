# GateFlow Deployment

## Backend

Set the backend service root directory to `backend/` and use the checked-in `Procfile` start command:

```bash
web: uvicorn server:app --host 0.0.0.0 --port $PORT
```

Required environment variables:

- `MONGO_URL`: MongoDB connection string.
- `DB_NAME`: MongoDB database name.
- `JWT_SECRET`: Secret key used to sign JWT access tokens.
- `CORS_ORIGINS`: Comma-separated list of frontend origins allowed to send credentialed requests, for example `https://gateflow.example.com`.

Optional Twilio WhatsApp variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

Demo data is disabled by default. Set `ENABLE_DEMO_SEED=true` only for local demos or throwaway environments, and change the demo passwords before using it anywhere real.

## Frontend

`REACT_APP_BACKEND_URL` is a build-time React variable. Set it before running `yarn build`; setting it only in a runtime hosting dashboard after the bundle is built will not update API calls in the deployed frontend.
