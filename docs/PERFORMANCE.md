# Performance Optimization Guide

## Overview
This document outlines performance best practices for Rishiverse Delivery.

## API Response Times
- Target P95 latency: < 200ms
- Database queries should be indexed appropriately
- Use connection pooling for MongoDB

## Caching Strategy
- Cache frequently accessed delivery routes
- Session tokens cached in-memory for fast validation
- Static assets served via CDN

## Monitoring
- Track request duration per endpoint
- Alert on error rate > 1%
- Monitor MongoDB connection pool usage
