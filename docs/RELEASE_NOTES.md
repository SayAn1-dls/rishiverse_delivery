# Release Notes

## v1.0.0 — Initial Release

### Features
- User authentication via Google OAuth (NextAuth.js)
- Order management system with status tracking
- Delivery agent assignment workflow
- MongoDB Atlas integration for persistent storage
- Deployed on Render (Next.js + Node)

### Known Issues
- Cold start delay on Render free tier (~30-60s)
- No email notifications on order status change (planned for v1.1)

## v1.1.0 — Planned
- Email notifications via Nodemailer
- Route optimization for agents
- Admin analytics dashboard
- Subscription delivery plans
