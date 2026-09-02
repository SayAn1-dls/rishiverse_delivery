# Security Policy

## Supported Versions

| Version | Supported |
|---------|----------|
| 1.0.x   | ✅        |

## Reporting a Vulnerability

Please do NOT open a public GitHub issue for security vulnerabilities.

Email: sayanbhatt2005@gmail.com with subject line `[SECURITY] RishiVerse`.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix

Expect a response within 48 hours. If the issue is confirmed, a patch will be released as soon as possible.

## Security Practices

- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens expire after 24 hours
- CORS restricted to known frontend origins in production
- Environment variables used for all secrets — no credentials in source
- MongoDB connection string stored as a Render environment variable, never committed
- Input validation on all API endpoints before DB writes
