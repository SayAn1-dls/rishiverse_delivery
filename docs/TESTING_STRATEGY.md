# Testing Strategy

## Unit Tests
- Test individual utility functions
- Mock MongoDB calls
- Tools: Jest, ts-jest

## Integration Tests
- Test API routes end-to-end
- Use test MongoDB instance
- Tools: Supertest

## E2E Tests
- Test full user flows (login → order → delivery)
- Tools: Playwright

## Coverage Targets
- Unit: 80%+
- Integration: 60%+
- Critical paths: 100%
