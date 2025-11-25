# School Management System API

A comprehensive REST API for school management with JWT authentication, course management, exam system, and sales tracking.

## 🚀 Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Multi-Role Support**: Admin, Teacher, Student, and Agent roles
- **Course Management**: Create and manage courses
- **Exam System**: Create exams, start attempts, and submit answers
- **Sales Tracking**: Record and track agent sales
- **PostgreSQL Database**: Robust relational database with proper indexing
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Detailed error responses

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
```bash
cd school-management-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=edika
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h
```

4. **Set up the database**

Create the database:
```bash
psql -U postgres
CREATE DATABASE school_management;
\q
```

Run the schema:
```bash
psql -U postgres -d school_management -f schema.sql
```

5. **Start the server**

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication Endpoints

### 1. Register User

**POST** `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "role": "student",
  "school_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Roles:** `admin`, `teacher`, `student`, `agent`

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "987fcdeb-51a2-43f7-9abc-123456789def",
      "email": "john.doe@example.com",
      "full_name": "John Doe",
      "role": "student",
      "school_id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response:** `409 Conflict`
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

---

### 2. Login

**POST** `/api/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "987fcdeb-51a2-43f7-9abc-123456789def",
      "email": "john.doe@example.com",
      "full_name": "John Doe",
      "role": "student",
      "school_id": "123e4567-e89b-12d3-a456-426614174000"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response:** `401 Unauthorized`
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 3. Get Current User Profile

**GET** `/api/auth/me`

Get authenticated user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "987fcdeb-51a2-43f7-9abc-123456789def",
    "email": "john.doe@example.com",
    "full_name": "John Doe",
    "role": "student",
    "school_id": "123e4567-e89b-12d3-a456-426614174000",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 📖 Course Endpoints

### 4. Create Course

**POST** `/api/courses`

**Access:** Admin, Teacher

**Request Body:**
```json
{
  "title": "Introduction to Computer Science",
  "description": "Learn the fundamentals of programming and algorithms",
  "code": "CS-101",
  "credits": 3,
  "school_id": "123e4567-e89b-12d3-a456-426614174000",
  "teacher_id": "456e7890-e12b-34c5-d678-901234567abc"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "id": "abc12345-6789-0def-1234-567890abcdef",
    "school_id": "123e4567-e89b-12d3-a456-426614174000",
    "teacher_id": "456e7890-e12b-34c5-d678-901234567abc",
    "title": "Introduction to Computer Science",
    "description": "Learn the fundamentals of programming and algorithms",
    "code": "CS-101",
    "credits": 3,
    "is_active": true,
    "created_at": "2024-01-15T11:00:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### 5. Get All Courses

**GET** `/api/courses`

**Query Parameters:**
- `school_id` (optional): Filter by school
- `teacher_id` (optional): Filter by teacher
- `is_active` (optional): Filter by active status

**Example:** `/api/courses?school_id=123e4567-e89b-12d3-a456-426614174000&is_active=true`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "abc12345-6789-0def-1234-567890abcdef",
      "school_id": "123e4567-e89b-12d3-a456-426614174000",
      "teacher_id": "456e7890-e12b-34c5-d678-901234567abc",
      "title": "Introduction to Computer Science",
      "description": "Learn the fundamentals of programming and algorithms",
      "code": "CS-101",
      "credits": 3,
      "is_active": true,
      "created_at": "2024-01-15T11:00:00.000Z",
      "updated_at": "2024-01-15T11:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 6. Get Course by ID

**GET** `/api/courses/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "abc12345-6789-0def-1234-567890abcdef",
    "school_id": "123e4567-e89b-12d3-a456-426614174000",
    "teacher_id": "456e7890-e12b-34c5-d678-901234567abc",
    "title": "Introduction to Computer Science",
    "description": "Learn the fundamentals of programming and algorithms",
    "code": "CS-101",
    "credits": 3,
    "is_active": true,
    "teacher_name": "Dr. Jane Smith",
    "school_name": "Tech University",
    "created_at": "2024-01-15T11:00:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

---

## 📝 Exam Endpoints

### 7. Create Exam

**POST** `/api/exams`

**Access:** Admin, Teacher

**Request Body:**
```json
{
  "course_id": "abc12345-6789-0def-1234-567890abcdef",
  "title": "Midterm Exam",
  "description": "Covers chapters 1-5",
  "duration_minutes": 90,
  "total_marks": 100,
  "passing_marks": 60,
  "exam_date": "2024-02-01T14:00:00.000Z"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Exam created successfully",
  "data": {
    "id": "def45678-90ab-cdef-1234-567890abcdef",
    "course_id": "abc12345-6789-0def-1234-567890abcdef",
    "created_by": "456e7890-e12b-34c5-d678-901234567abc",
    "title": "Midterm Exam",
    "description": "Covers chapters 1-5",
    "duration_minutes": 90,
    "total_marks": 100,
    "passing_marks": 60,
    "exam_date": "2024-02-01T14:00:00.000Z",
    "is_published": false,
    "created_at": "2024-01-15T12:00:00.000Z",
    "updated_at": "2024-01-15T12:00:00.000Z"
  }
}
```

---

### 8. Get All Exams

**GET** `/api/exams`

**Query Parameters:**
- `course_id` (optional): Filter by course
- `is_published` (optional): Filter by published status

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "def45678-90ab-cdef-1234-567890abcdef",
      "course_id": "abc12345-6789-0def-1234-567890abcdef",
      "created_by": "456e7890-e12b-34c5-d678-901234567abc",
      "title": "Midterm Exam",
      "description": "Covers chapters 1-5",
      "duration_minutes": 90,
      "total_marks": 100,
      "passing_marks": 60,
      "exam_date": "2024-02-01T14:00:00.000Z",
      "is_published": true,
      "course_title": "Introduction to Computer Science",
      "course_code": "CS-101",
      "created_by_name": "Dr. Jane Smith",
      "created_at": "2024-01-15T12:00:00.000Z",
      "updated_at": "2024-01-15T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 9. Start Exam

**POST** `/api/exams/:id/start`

**Access:** Student only

Students can start an exam to create an attempt record.

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Exam started successfully",
  "data": {
    "attempt_id": "789abc01-2345-6789-0abc-def123456789",
    "exam_id": "def45678-90ab-cdef-1234-567890abcdef",
    "started_at": "2024-02-01T14:05:00.000Z",
    "duration_minutes": 90,
    "total_marks": 100
  }
}
```

**Error Response:** `409 Conflict`
```json
{
  "success": false,
  "message": "You have already started this exam"
}
```

---

### 10. Submit Exam

**POST** `/api/exams/:id/submit`

**Access:** Student only

**Request Body:**
```json
{
  "answers": {
    "question_1": "answer_a",
    "question_2": "answer_c",
    "question_3": "The answer is...",
    "question_4": ["option_a", "option_d"]
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Exam submitted successfully",
  "data": {
    "attempt_id": "789abc01-2345-6789-0abc-def123456789",
    "submitted_at": "2024-02-01T15:20:00.000Z",
    "time_taken_minutes": 75,
    "status": "submitted"
  }
}
```

---

### 11. Get Exam Attempts

**GET** `/api/exams/:id/attempts`

**Access:** Admin, Teacher

Get all student attempts for a specific exam.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "789abc01-2345-6789-0abc-def123456789",
      "exam_id": "def45678-90ab-cdef-1234-567890abcdef",
      "student_id": "987fcdeb-51a2-43f7-9abc-123456789def",
      "started_at": "2024-02-01T14:05:00.000Z",
      "submitted_at": "2024-02-01T15:20:00.000Z",
      "score": null,
      "answers": { "question_1": "answer_a", "question_2": "answer_c" },
      "status": "submitted",
      "time_taken_minutes": 75,
      "student_name": "John Doe",
      "student_email": "john.doe@example.com",
      "created_at": "2024-02-01T14:05:00.000Z",
      "updated_at": "2024-02-01T15:20:00.000Z"
    }
  ],
  "count": 1
}
```

---

## 💰 Agent/Sales Endpoints

### 12. Record Sale

**POST** `/api/agents/sales`

**Access:** Agent only

**Request Body:**
```json
{
  "school_id": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 5000.00,
  "subscription_type": "Premium",
  "subscription_months": 12,
  "notes": "Annual subscription for Tech University"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Sale recorded successfully",
  "data": {
    "sale_id": "012abc34-5678-90de-f123-456789abcdef",
    "amount": 5000.00,
    "commission": 500.00,
    "subscription_type": "Premium",
    "subscription_months": 12,
    "sale_date": "2024-01-15T13:00:00.000Z",
    "payment_status": "pending"
  }
}
```

---

### 13. Get All Sales

**GET** `/api/agents/sales`

**Access:** Agent (own sales), Admin (all sales)

**Query Parameters:**
- `agent_id` (optional, admin only): Filter by agent
- `school_id` (optional): Filter by school
- `payment_status` (optional): Filter by status (pending, completed, failed)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "012abc34-5678-90de-f123-456789abcdef",
      "agent_id": "234def56-7890-abcd-ef12-34567890abcd",
      "school_id": "123e4567-e89b-12d3-a456-426614174000",
      "amount": 5000.00,
      "commission": 500.00,
      "subscription_type": "Premium",
      "subscription_months": 12,
      "payment_status": "pending",
      "notes": "Annual subscription for Tech University",
      "sale_date": "2024-01-15T13:00:00.000Z",
      "agent_code": "AGT-ABC123",
      "agent_name": "Mike Johnson",
      "school_name": "Tech University",
      "created_at": "2024-01-15T13:00:00.000Z",
      "updated_at": "2024-01-15T13:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 14. Get Sale by ID

**GET** `/api/agents/sales/:id`

**Access:** Agent (own sales), Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "012abc34-5678-90de-f123-456789abcdef",
    "agent_id": "234def56-7890-abcd-ef12-34567890abcd",
    "school_id": "123e4567-e89b-12d3-a456-426614174000",
    "amount": 5000.00,
    "commission": 500.00,
    "subscription_type": "Premium",
    "subscription_months": 12,
    "payment_status": "completed",
    "notes": "Annual subscription for Tech University",
    "sale_date": "2024-01-15T13:00:00.000Z",
    "agent_code": "AGT-ABC123",
    "agent_name": "Mike Johnson",
    "school_name": "Tech University",
    "school_email": "admin@techuni.edu",
    "created_at": "2024-01-15T13:00:00.000Z",
    "updated_at": "2024-01-16T10:00:00.000Z"
  }
}
```

---

### 15. Update Sale Payment Status

**PUT** `/api/agents/sales/:id`

**Access:** Admin only

**Request Body:**
```json
{
  "payment_status": "completed"
}
```

**Valid statuses:** `pending`, `completed`, `failed`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Sale status updated successfully",
  "data": {
    "id": "012abc34-5678-90de-f123-456789abcdef",
    "payment_status": "completed",
    "updated_at": "2024-01-16T10:00:00.000Z"
  }
}
```

---

### 16. Get Agent Dashboard

**GET** `/api/agents/dashboard`

**Access:** Agent only

Get agent statistics and recent sales.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "234def56-7890-abcd-ef12-34567890abcd",
      "full_name": "Mike Johnson",
      "email": "mike.agent@example.com",
      "agent_code": "AGT-ABC123",
      "commission_rate": 10.00,
      "total_sales": 15000.00,
      "is_active": true
    },
    "statistics": {
      "total_sales_count": 5,
      "completed_sales": 12000.00,
      "pending_sales": 3000.00,
      "total_commission_earned": 1200.00
    },
    "recent_sales": [
      {
        "id": "012abc34-5678-90de-f123-456789abcdef",
        "amount": 5000.00,
        "commission": 500.00,
        "school_name": "Tech University",
        "payment_status": "completed",
        "sale_date": "2024-01-15T13:00:00.000Z"
      }
    ]
  }
}
```

---

## 🔧 Error Responses

All endpoints return consistent error responses:

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    },
    {
      "field": "password",
      "message": "Password must be at least 6 characters long"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Access denied. Required role: admin or teacher"
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

---

## 📝 Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

### Create Course (with authentication)
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Mathematics 101",
    "code": "MATH-101",
    "credits": 3,
    "school_id": "YOUR_SCHOOL_ID"
  }'
```

### Get All Courses
```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🏗️ Project Structure

```
school-management-api/
├── src/
│   ├── config/
│   │   └── database.js          # Database connection configuration
│   ├── middleware/
│   │   └── auth.js               # JWT authentication middleware
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── courseController.js   # Course management logic
│   │   ├── examController.js     # Exam management logic
│   │   └── agentController.js    # Sales/agent logic
│   ├── routes/
│   │   └── index.js              # API routes definition
│   └── utils/
│       └── validation.js         # Input validation rules
├── .env.example                  # Environment variables template
├── package.json                  # Project dependencies
├── schema.sql                    # Database schema
├── server.js                     # Application entry point
└── README.md                     # Documentation
```

---

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- CORS configuration
- Environment variable configuration

---

## 🚦 Database Schema

### Tables
1. **users** - All user accounts (admin, teacher, student, agent)
2. **schools** - School information
3. **agents** - Agent details and commission tracking
4. **courses** - Course information
5. **exams** - Exam details
6. **exam_attempts** - Student exam submissions
7. **sales** - Agent sales records

### Key Relationships
- Users belong to Schools
- Courses belong to Schools and Teachers
- Exams belong to Courses
- Exam Attempts link Students to Exams
- Sales link Agents to Schools

---

## 📄 License

MIT

---

## 👨‍💻 Author

School Management API - Backend Engineering Team

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📞 Support

For issues and questions, please open an issue in the repository.
