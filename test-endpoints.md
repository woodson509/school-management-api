# API Endpoint Tests

Use these cURL commands to test the new API endpoints.
Replace `YOUR_TOKEN_HERE` with the JWT token received from the login response.
Replace `AGENT_ID` with a real UUID from the agent list.

## Section 1: Authentication

### Login as SuperAdmin
**Expected Status:** `200 OK`
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@school.com",
    "password": "SuperAdmin123!"
  }'
```
*Copy the `token` from the response for subsequent requests.*

---

## Section 2: Agents Management

### 1. Get All Agents
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. Create New Agent
**Expected Status:** `201 Created`
```bash
curl -X POST http://localhost:5000/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "password": "Password123!",
    "phone": "+509 3000-0000",
    "commission_rate": 15.5
  }'
```

### 3. Get Agent by ID
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/agents/AGENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Update Agent
**Expected Status:** `200 OK`
```bash
curl -X PUT http://localhost:5000/api/agents/AGENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "commission_rate": 20.0,
    "is_active": true,
    "phone": "+509 3999-9999"
  }'
```

### 5. Get Agent Statistics
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/agents/AGENT_ID/stats?period=month \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Delete Agent (Soft Delete)
**Expected Status:** `200 OK`
```bash
curl -X DELETE http://localhost:5000/api/agents/AGENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Section 3: Dashboards

### 1. SuperAdmin Dashboard
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/dashboard/superadmin \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. Admin Dashboard (School Admin)
*Requires login as a School Admin*
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/dashboard/admin \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Teacher Dashboard
*Requires login as a Teacher*
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/dashboard/teacher \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Student Dashboard
*Requires login as a Student*
**Expected Status:** `200 OK`
```bash
curl -X GET http://localhost:5000/api/dashboard/student \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
