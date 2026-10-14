> **Note:** This document predates the React rewrite and may be outdated (it may mention the removed Flutter app). The current, maintained documentation is in [docs/ai/](ai/README.md).

# REST API Documentation - Smart Workforce System

Base URL: `http://localhost:5000/api` (Android Emulator: `http://10.0.2.2:5000/api`)

## Authentication Endpoints (`/api/auth`)

### 1. Register Employee
- **POST** `/auth/register`
- **Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john.doe@smartworkflow.org",
  "password": "password123",
  "confirmPassword": "password123",
  "jobPosition": "Software Engineer",
  "phoneNumber": "+8801700000002",
  "departmentId": 1
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "userId": 2,
    "employeeId": 2,
    "employeeCode": "EMP002",
    "approvalStatus": "PENDING",
    "message": "Registration successful. Your account is pending administrator approval."
  }
}
```

### 2. Login User
- **POST** `/auth/login`
- **Request Body:**
```json
{
  "email": "admin@smartworkflow.org",
  "password": "password123"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "admin@smartworkflow.org",
      "role": "ADMIN",
      "approvalStatus": "APPROVED"
    }
  }
}
```

### 3. Get Current User Profile
- **GET** `/auth/me`
- **Headers:** `Authorization: Bearer <token>`

---

## Admin Endpoints (`/api/admin`)

### 1. List Pending Registrations
- **GET** `/admin/registrations`

### 2. Approve Registration
- **POST** `/admin/registrations/:id/approve`

### 3. Reject Registration
- **POST** `/admin/registrations/:id/reject`
- **Request Body:** `{ "rejectionReason": "Invalid information provided" }`

---

## Task & Allocation Endpoints (`/api/tasks`)

### 1. List Tasks
- **GET** `/tasks?status=ASSIGNED&employeeId=2`

### 2. Create Task with Required Skills
- **POST** `/tasks`
- **Request Body:**
```json
{
  "title": "Build Flutter UI Screens",
  "description": "Develop Material 3 screens",
  "projectId": 1,
  "priority": "HIGH",
  "estimatedHours": 16.0,
  "deadline": "2026-10-25 18:00:00",
  "requiredSkills": [
    { "skillId": 3, "minProficiencyLevel": "ADVANCED" }
  ]
}
```

### 3. Get Smart Recommendations
- **GET** `/tasks/:id/recommendations`
- **Response (200 OK):** Weighted scores calculated using actual database records.

### 4. Assign Task
- **POST** `/tasks/:id/assign`
- **Request Body:** `{ "employeeId": 2 }`

### 5. Reassign Task
- **POST** `/tasks/:id/reassign`
- **Request Body:** `{ "newEmployeeId": 4, "reassignmentReason": "Reallocated workload" }`

---

## Reports Endpoints (`/api/reports`)

- `GET /reports/workload`: Aggregate workload per employee.
- `GET /reports/overdue-tasks`: List of overdue tasks.
- `GET /reports/department-workload`: Workload summary by department.
- `GET /reports/project-progress`: Tasks completed percentage per project.
