# Rohini Employee Management System

A web-based Employee Management System designed to simplify employee administration, task management, attendance tracking, and team coordination for Rohini.

## Overview

The **Rohini Employee Management System** is a centralized platform that helps administrators manage employees and coordinate daily organizational activities.

The application provides separate access for administrators and employees, with features for managing tasks, monitoring attendance, and maintaining employee information.

## Features

### Employee Management
- Centralized employee information management
- Employee and administrator accounts
- Role-based access

### Task Management
- Assign tasks to employees
- Set task priorities and deadlines
- Track task status
- View tasks in list and calendar views
- Upload and download task attachments

### Attendance Management
- Employee check-in and check-out
- Face-based attendance verification
- GPS-based location verification
- Office geofence configuration
- Attendance records for administrators

### Dashboard and Team Coordination
- Centralized management interface
- Employee task visibility
- Attendance monitoring
- Team-wide task overview

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Build Tool | Vite |
| Backend | Python, Flask |
| Database | SQLite (current local setup) |
| ORM | SQLAlchemy |
| Authentication | JWT |
| API | REST API |
| Containerization | Docker (where configured) |
| Version Control | Git and GitHub |

## Project Structure

```text
rohini-team-manager/
│
├── backend/
│   ├── app.py
│   ├── models.py
│   ├── routes.py
│   ├── attendance_routes.py
│   ├── requirements.txt
│   └── uploads/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api.js
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

*The structure above is representative. Update it if your local project has additional files or folders.*

## Getting Started

Follow these steps to run the application locally.

### Prerequisites

Install the following:

- Python 3.10 or later
- Node.js and npm
- Git

Docker is optional if your project has a configured Docker setup.

### 1. Clone the Repository

```bash
git clone https://github.com/Rahulkhaire/Rohini-Employee-Management-System.git
cd Rohini-Employee-Management-System
```

### 2. Backend Setup

Open a terminal:

```bash
cd backend
python3 -m venv venv
```

Activate the virtual environment.

**macOS/Linux:**

```bash
source venv/bin/activate
```

**Windows:**

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure the environment variables required by your backend in a `.env` file. Do not commit secrets or production credentials.

### 3. Start the Backend

From the backend directory, run:

```bash
python app.py
```

The backend is expected to run at:

```text
http://localhost:5000
```

### 4. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

Open the application in your browser:

```text
http://localhost:5173
```

## Database

The current local development setup uses SQLite.

The database is stored locally and is not included in the GitHub repository.

For production deployment, configure a production database and migrate the existing data before switching over.

## Security Notes

- Never upload `.env` files or secret keys.
- Do not commit employee personal information or attendance photos.
- Protect administrative accounts with strong passwords.
- Use HTTPS in production.
- Configure appropriate permissions for employee records and uploaded attachments.

## Future Improvements

- Production database integration
- Cloud-based file storage
- Improved analytics and reporting
- Automated notifications
- Enhanced attendance reporting
- Production deployment and monitoring

## Author

**Rahul Khaire**

GitHub: [@Rahulkhaire](https://github.com/Rahulkhaire)

## Repository

[ Rohini Employee Management System](https://github.com/Rahulkhaire/Rohini-Employee-Management-System)

---

*Developed to improve employee management, attendance tracking, and team coordination at Rohini.*