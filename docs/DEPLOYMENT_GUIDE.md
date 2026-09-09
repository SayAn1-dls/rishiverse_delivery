# Deployment Guide

## Prerequisites
- Node.js 18+
- MongoDB Atlas cluster
- Render account

## Environment Variables
- `MONGO_URL` — MongoDB connection string
- `NODE_ENV` — set to `production`
- `SESSION_SECRET` — random 32-char secret

## Steps
1. Push code to `main` branch
2. Render auto-deploys on push
3. Check logs at Render dashboard
4. Verify health at `/api/health`
