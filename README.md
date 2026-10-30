<<<<<<< HEAD
# Rohini-Employee-Management-System
=======
# Rohini Team Manager

Employee / task management system for **Rohini People Technology Pvt. Ltd.**
React (Vite) frontend + Flask (SQLite) backend. Built for a small team (5-6 people) and easy to grow.

## What it does

- **Login with credentials**: the admin adds each employee (email + password); employees sign in with those.
- **Assign tasks**: any employee can assign a task to any teammate, with deadline and priority.
- **Overdue emails**: if a task is not marked Done by its deadline, the assignee is emailed automatically
  (and the person who assigned it is cc'd). It repeats every 24 h until the task is done (configurable).
- **New-task email**: assignee is emailed when a task is assigned to them.
- **Monitoring dashboard**: open / in-progress / overdue / completed counts, on-time rate,
  overdue list, tasks due in 48 h, and per-employee workload.
- **Team page (admin)**: add, edit, disable employees, reset passwords, make someone admin.
- **Email log (admin)**: every email sent, with success / failure, plus a "Check overdue now" button.

### Who can do what

| Action | Admin | Employee |
| --- | --- | --- |
| Add / edit / disable employees | yes | no |
| See all tasks and the dashboard | yes | yes |
| Assign a task to anyone | yes | yes |
| Edit / delete a task | any task | only tasks they assigned |
| Change a task's status | any task | tasks assigned to them or by them |

(To make assigning admin-only, change `create_task` in `backend/routes.py` to use `@admin_required`.)

## Setup

You need **Python 3.10+** and **Node 18+**.

### 1. Backend (Flask), runs on http://localhost:5000

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env   (then edit it)
python app.py
```

On the first start it creates the database and the first admin:

- Email: `admin@rohini.com`
- Password: `Admin@123`  **(change it after first login, or set ADMIN_EMAIL / ADMIN_PASSWORD in `.env` before the first run)**

### 2. Frontend (React), runs on http://localhost:5173

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in. Go to **Team** to add your 5-6 employees.

## Email setup (important for overdue reminders)

Edit `backend/.env`:

```
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=yourcompany@gmail.com
MAIL_PASSWORD=your-16-char-app-password
```

- Gmail: turn on 2-step verification, then create an **App Password** (Google Account -> Security) and use that.
- Google Workspace / Zoho / Outlook work the same way with their SMTP host and port.
- If `MAIL_SERVER` is empty, nothing is sent; emails are printed in the console and shown in **Email log** as "SMTP off". This is handy for testing.
- Test it: create a task with a deadline 1-2 minutes ahead, wait, then open **Email log -> Check overdue now**
  (otherwise the server checks automatically every `REMINDER_CHECK_MINUTES`, default 15).

Other settings in `.env`: `OVERDUE_REPEAT_HOURS` (0 = only one reminder), `CC_ASSIGNER_ON_OVERDUE`, `NOTIFY_ON_ASSIGN`.

## Project layout

```
backend/   app.py (start here) · models.py · routes.py (API) · mailer.py · reminders.py (scheduler)
frontend/  src/pages (Login, Dashboard, Tasks, Team, EmailLog, Profile) · src/components · src/styles.css
```

Colours and logo come from the company profile: teal `#255B7B`, orange `#EE8443`, green `#0A7A3C`
(logo files are in `frontend/public/`).

## Going live (later)

- Build the frontend: `cd frontend && npm run build` (output in `frontend/dist`), serve it with Nginx or any static host.
- Run the API with `gunicorn -w 1 -b 0.0.0.0:5000 "app:create_app()"`.
  **Keep 1 worker** (or move the reminder job to a cron), otherwise each worker would send reminders.
- Set strong `SECRET_KEY` / `JWT_SECRET_KEY`, `FRONTEND_ORIGIN` and `APP_URL` to your real domain, and use HTTPS.
- For more than ~20 users switch `DATABASE_URL` to PostgreSQL (`pip install psycopg2-binary`).
- If the API is on a different domain than the frontend, set `VITE_API_URL` in `frontend/.env` before building.

## API quick reference

`POST /api/auth/login` · `GET /api/auth/me` · `GET|POST /api/users` · `PUT /api/users/:id` ·
`GET|POST /api/tasks` · `PUT|DELETE /api/tasks/:id` · `PATCH /api/tasks/:id/status` ·
`GET /api/dashboard` · `GET /api/emails` · `POST /api/reminders/run`
>>>>>>> 01a4ce9 (Initial commit)
