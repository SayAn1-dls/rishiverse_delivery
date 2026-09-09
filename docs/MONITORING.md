# Monitoring & Observability

## Render Dashboard
- Check build logs for deploy failures
- Monitor memory/CPU usage per service
- Set up health check at `/api/health`

## Application Metrics
- Track request count per endpoint
- Monitor P95 response times
- Alert on 5xx error rate > 0.5%

## Database Monitoring
- MongoDB Atlas built-in metrics
- Watch connection pool saturation
- Index usage stats via Atlas Performance Advisor

## Logging
- Use structured JSON logs
- Include requestId, userId, duration in every log line
- Retain logs for 30 days minimum
