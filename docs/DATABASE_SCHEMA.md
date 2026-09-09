# Database Schema

## Collections

### users
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "role": "customer | driver | admin",
  "createdAt": "Date"
}
```

### orders
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "driverId": "ObjectId",
  "status": "pending | in_transit | delivered",
  "pickupAddress": "string",
  "dropAddress": "string",
  "createdAt": "Date"
}
```

### sessions
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "token": "string",
  "expiresAt": "Date"
}
```
