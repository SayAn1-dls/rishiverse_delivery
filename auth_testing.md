# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

Step 2: API Testing
```
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@rishihood.edu.in","password":"admin123"}'
```
Login returns `{user, access_token}`. Use `Authorization: Bearer <token>` for authenticated calls:
```
curl http://localhost:8001/api/auth/me -H "Authorization: Bearer <token>"
```
