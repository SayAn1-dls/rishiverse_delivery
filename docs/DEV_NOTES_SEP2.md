# Dev Notes — Sep 2, 2026

## Session: Morning

### MongoDB Schema Draft
Began drafting schema for core collections.

**orders** collection:
- `_id`, `userId`, `agentId`, `items[]`, `totalAmount`, `status`, `createdAt`, `updatedAt`

**users** collection:
- `_id`, `name`, `email`, `role` (customer | agent | admin), `createdAt`

### Decisions Made
- Use soft deletes (add `deletedAt` field) instead of hard deletes
- Status enum: `pending` | `assigned` | `in_transit` | `delivered` | `cancelled`
- All timestamps in UTC

### TODO
- [ ] Write Mongoose models
- [ ] Add validation middleware
