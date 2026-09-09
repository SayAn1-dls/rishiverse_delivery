# Troubleshooting Guide

## MongoDB Connection Fails
- Check `MONGO_URL` env var is correctly set on Render
- Ensure IP `0.0.0.0/0` is whitelisted in MongoDB Atlas Network Access
- Verify the cluster URL uses the correct cluster ID

## Render Deploy Stuck
- Check build logs for yarn install errors
- Ensure Node version matches (use `.nvmrc` or set in Render settings)
- Clear build cache and redeploy

## 401 on API Routes
- Session cookie missing or expired
- Re-login and try again
- Check `SESSION_SECRET` is set

## Orders Not Updating
- Check MongoDB write permissions for the DB user
- Look for validation errors in server logs
