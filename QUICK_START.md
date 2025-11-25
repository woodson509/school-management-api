# Quick Setup Guide

## 🚀 Getting Started in 5 Minutes

### 1. Prerequisites Check
```bash
node --version   # Should be v14+
psql --version   # Should be PostgreSQL 12+
```

### 2. Install Dependencies
```bash
cd school-management-api
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and set your database credentials:
```env
DB_PASSWORD=your_actual_password
JWT_SECRET=generate_a_random_secret_key_here
```

### 4. Create & Setup Database
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE school_management;
\q

# Run schema
psql -U postgres -d school_management -f schema.sql
```

### 5. Start Server
```bash
npm start
```

Server should now be running at `http://localhost:3000`

## 🧪 Quick Test

### Test 1: Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Test 2: Login with Default Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

You should receive a JWT token. Copy it for the next test.

### Test 3: Get Profile (Protected Route)
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📊 Sample Data Creation

### Create a School
```bash
# First, login and get token, then:
psql -U postgres -d school_management

INSERT INTO schools (name, address, email) 
VALUES ('Tech University', '123 Main St', 'admin@techuni.edu');
```

### Register a Teacher
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "teacher@techuni.edu",
    "password": "teacher123",
    "full_name": "Dr. Jane Smith",
    "role": "teacher",
    "school_id": "YOUR_SCHOOL_ID"
  }'
```

### Create a Course
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN" \
  -d '{
    "title": "Introduction to Programming",
    "code": "CS-101",
    "credits": 3,
    "school_id": "YOUR_SCHOOL_ID"
  }'
```

## 🔧 Common Issues

### Issue: Database connection failed
**Solution:** Ensure PostgreSQL is running and credentials in `.env` are correct
```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Or on Mac with Homebrew
brew services list
```

### Issue: Port 3000 already in use
**Solution:** Change PORT in `.env` file or kill the process using port 3000
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 PID
```

### Issue: JWT token expired
**Solution:** Login again to get a new token

## 📚 Next Steps

1. Read the full API documentation in `README.md`
2. Test all endpoints using Postman or cURL
3. Customize the schema for your needs
4. Add additional validation rules
5. Implement more features (file uploads, notifications, etc.)

## 🎯 Production Deployment Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Set NODE_ENV=production
- [ ] Use environment-specific database
- [ ] Enable HTTPS
- [ ] Set up proper CORS origins
- [ ] Implement rate limiting
- [ ] Add logging (Winston, Morgan)
- [ ] Set up monitoring (PM2, New Relic)
- [ ] Configure backups for database
- [ ] Review and harden security settings

## 💡 Tips

- Use Postman for easier API testing
- Keep your JWT_SECRET secure and never commit it
- Regularly backup your database
- Use transactions for operations involving multiple tables
- Log important events for debugging
- Implement request rate limiting in production

Happy coding! 🚀
