# Security Policy

## Supported Versions
| Version | Supported |
|---------|----------|
| 1.x     | ✅ Yes   |

## Reporting Vulnerabilities
Email security issues to: sayanbhatt2005@gmail.com

## Security Practices
- All passwords hashed with bcrypt (salt rounds: 12)
- Session tokens are cryptographically random
- MongoDB connection uses TLS
- CORS restricted to allowed origins
- Rate limiting on all auth endpoints
- Input sanitization on all user-facing fields
