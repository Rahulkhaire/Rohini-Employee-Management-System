import os
import re
import threading
import os
import uuid
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
    send_from_directory,
)

from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    verify_jwt_in_request,
)
from sqlalchemy import func

from mailer import send_assigned_email
from models import (
    PRIORITIES,
    ROLES,
    STATUSES,
    EmailLog,
    Task,
    TaskAttachment,
    User,
    db,
    utcnow,
)
from reminders import send_overdue_reminders
from models import FaceEnrollment
from face_service import face_service, FaceError

api = Blueprint("api", __name__, url_prefix="/api")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------- helpers
def err(msg, code=400):
    return jsonify({"error": msg}), code


def current_user():
    return db.session.get(User, int(get_jwt_identity()))


def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        verify_jwt_in_request()
        user = current_user()
        if not user or not user.is_active:
            return err("Account is disabled or no longer exists.", 401)
        return fn(user, *a, **kw)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(user, *a, **kw):
        if user.role != "admin":
            return err("Admin access required.", 403)
        return fn(user, *a, **kw)

    return wrapper


def parse_dt(value):
    """Parse an ISO datetime from the client into naive UTC."""
    if not value:
        raise ValueError("Due date is required.")
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("Invalid due date.")
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def notify_assigned_async(task_id):
    app = current_app._get_current_object()

    def run():
        with app.app_context():
            task = db.session.get(Task, task_id)
            if task and task.assignee and task.assignee.is_active:
                send_assigned_email(task)

    threading.Thread(target=run, daemon=True).start()


def env_bool(name, default=True):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


# ---------------------------------------------------------------- auth
@api.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(data.get("password") or ""):
        return err("Wrong email or password.", 401)
    if not user.is_active:
        return err("This account has been disabled. Contact your admin.", 403)
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=12))
    return jsonify({"token": token, "user": user.to_dict()})


@api.get("/auth/me")
@login_required
def me(user):
    return jsonify(user.to_dict())


@api.post("/auth/change-password")
@login_required
def change_password(user):
    data = request.get_json(silent=True) or {}
    if not user.check_password(data.get("current_password") or ""):
        return err("Current password is wrong.")
    new = data.get("new_password") or ""
    if len(new) < 6:
        return err("New password must be at least 6 characters.")
    user.set_password(new)
    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------- users
@api.get("/users")
@login_required
def list_users(user):
    q = User.query.order_by(User.name)
    if user.role != "admin":
        q = q.filter_by(is_active=True)
    return jsonify([u.to_dict() if user.role == "admin" else {**u.brief(), "designation": u.designation or ""} for u in q])


@api.post("/users")
@admin_required
def create_user(admin):
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    role = d.get("role") or "employee"
    if not name:
        return err("Name is required.")
    if not EMAIL_RE.match(email):
        return err("Enter a valid email address.")
    if len(password) < 6:
        return err("Password must be at least 6 characters.")
    if role not in ROLES:
        return err("Invalid role.")
    if User.query.filter_by(email=email).first():
        return err("An employee with this email already exists.", 409)
    u = User(
        name=name,
        email=email,
        role=role,
        designation=(d.get("designation") or "").strip(),
        phone=(d.get("phone") or "").strip(),
    )
    u.set_password(password)
    # Employee face registration is part of employee creation. Validate and
    # encrypt the biometric template before committing the account.
    if role == "employee":
        if d.get("face_consent") is not True:
            return err("Employee's explicit biometric consent is required.")
        try:
            feature = face_service.feature(d.get("face_photo"))
            encrypted = face_service.encrypt(feature)
        except FaceError as e:
            return err(str(e))
        db.session.add(u)
        db.session.flush()
        db.session.add(FaceEnrollment(user_id=u.id, encrypted_template=encrypted))
    else:
        db.session.add(u)
    db.session.commit()
    return jsonify(u.to_dict()), 201


@api.put("/users/<int:uid>")
@admin_required
def update_user(admin, uid):
    u = db.session.get(User, uid)
    if not u:
        return err("Employee not found.", 404)
    d = request.get_json(silent=True) or {}
    if "name" in d:
        if not (d["name"] or "").strip():
            return err("Name is required.")
        u.name = d["name"].strip()
    if "email" in d:
        email = (d["email"] or "").strip().lower()
        if not EMAIL_RE.match(email):
            return err("Enter a valid email address.")
        clash = User.query.filter(User.email == email, User.id != u.id).first()
        if clash:
            return err("Another employee already uses this email.", 409)
        u.email = email
    for f in ("designation", "phone"):
        if f in d:
            setattr(u, f, (d[f] or "").strip())
    if "role" in d:
        if d["role"] not in ROLES:
            return err("Invalid role.")
        if u.id == admin.id and d["role"] != "admin":
            return err("You cannot remove your own admin role.")
        u.role = d["role"]
    if "is_active" in d:
        if u.id == admin.id and not d["is_active"]:
            return err("You cannot disable your own account.")
        u.is_active = bool(d["is_active"])
    if d.get("password"):
        if len(d["password"]) < 6:
            return err("Password must be at least 6 characters.")
        u.set_password(d["password"])
    db.session.commit()
    return jsonify(u.to_dict())


# ---------------------------------------------------------------- tasks
def _validate_task_fields(d, partial=False):
    """Return (clean_dict, error_message)."""
    out = {}
    if not partial or "title" in d:
        title = (d.get("title") or "").strip()
        if not title:
            return None, "Title is required."
        out["title"] = title[:200]
    if "description" in d:
        out["description"] = (d.get("description") or "").strip()
    if not partial or "priority" in d:
        pr = d.get("priority") or "medium"
        if pr not in PRIORITIES:
            return None, "Invalid priority."
        out["priority"] = pr
    if not partial or "due_date" in d:
        try:
            out["due_date"] = parse_dt(d.get("due_date"))
        except ValueError as e:
            return None, str(e)
    if not partial or "assigned_to" in d:
        try:
            assignee = db.session.get(User, int(d.get("assigned_to") or 0))
        except (TypeError, ValueError):
            assignee = None
        if not assignee or not assignee.is_active:
            return None, "Choose a valid employee to assign this task to."
        out["assigned_to"] = assignee.id
    return out, None


@api.get("/tasks")
@login_required
def list_tasks(user):
    """scope = mine (assigned to me) | created (assigned by me) | all"""
    scope = request.args.get("scope", "all")
    q = Task.query
    if scope == "mine":
        q = q.filter(Task.assigned_to == user.id)
    elif scope == "created":
        q = q.filter(Task.assigned_by == user.id)
    if request.args.get("assignee"):
        q = q.filter(Task.assigned_to == int(request.args["assignee"]))
    status = request.args.get("status")
    if status in STATUSES:
        q = q.filter(Task.status == status)
    elif status == "open":
        q = q.filter(Task.status != "done")
    if request.args.get("overdue") == "1":
        q = q.filter(Task.status != "done", Task.due_date < utcnow())
    tasks = q.order_by(Task.due_date.asc()).all()
    # open tasks first, finished at the bottom
    tasks.sort(key=lambda t: (t.status == "done", t.due_date))
    return jsonify([t.to_dict() for t in tasks])


@api.post("/tasks")
@login_required
def create_task(user):
    d = request.get_json(silent=True) or {}
    clean, e = _validate_task_fields(d)
    if e:
        return err(e)
    task = Task(assigned_by=user.id, status="todo", **clean)
    db.session.add(task)
    db.session.commit()
    if env_bool("NOTIFY_ON_ASSIGN", True) and task.assigned_to != user.id:
        notify_assigned_async(task.id)
    return jsonify(task.to_dict()), 201


@api.put("/tasks/<int:tid>")
@login_required
def update_task(user, tid):
    task = db.session.get(Task, tid)
    if not task:
        return err("Task not found.", 404)
    if user.role != "admin" and task.assigned_by != user.id:
        return err("Only the person who assigned this task (or an admin) can edit it.", 403)
    d = request.get_json(silent=True) or {}
    clean, e = _validate_task_fields(d, partial=True)
    if e:
        return err(e)
    reassigned = "assigned_to" in clean and clean["assigned_to"] != task.assigned_to
    rescheduled = "due_date" in clean and clean["due_date"] != task.due_date
    for k, v in clean.items():
        setattr(task, k, v)
    if reassigned or rescheduled:
        task.last_reminder_at = None
        task.reminder_count = 0
    db.session.commit()
    if reassigned and env_bool("NOTIFY_ON_ASSIGN", True):
        notify_assigned_async(task.id)
    return jsonify(task.to_dict())


@api.patch("/tasks/<int:tid>/status")
@login_required
def set_status(user, tid):
    task = db.session.get(Task, tid)
    if not task:
        return err("Task not found.", 404)
    if user.role != "admin" and user.id not in (task.assigned_to, task.assigned_by):
        return err("You cannot change this task.", 403)
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in STATUSES:
        return err("Invalid status.")
    task.status = status
    if status == "done":
        task.completed_at = utcnow()
    else:
        task.completed_at = None
        if task.is_overdue is False:
            task.last_reminder_at = None
            task.reminder_count = 0
    db.session.commit()
    return jsonify(task.to_dict())


@api.delete("/tasks/<int:tid>")
@login_required
def delete_task(user, tid):
    task = db.session.get(Task, tid)
    if not task:
        return err("Task not found.", 404)
    if user.role != "admin" and task.assigned_by != user.id:
        return err("Only the person who assigned this task (or an admin) can delete it.", 403)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"ok": True})

# ---------------------------------------------------------------- task attachments

ALLOWED_ATTACHMENT_EXTENSIONS = {
    "xlsx", "xls", "docx", "doc", "pptx", "ppt"
}

MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024


def can_access_task(user, task):
    return (
        user.role == "admin"
        or user.id in (task.assigned_to, task.assigned_by)
    )


@api.get("/tasks/<int:tid>/attachments")
@login_required
def list_task_attachments(user, tid):
    task = db.session.get(Task, tid)

    if not task:
        return err("Task not found.", 404)

    if not can_access_task(user, task):
        return err("You cannot access this task.", 403)

    files = TaskAttachment.query.filter_by(task_id=tid).order_by(
        TaskAttachment.created_at.desc()
    ).all()

    return jsonify([f.to_dict() for f in files])


@api.post("/tasks/<int:tid>/attachments")
@login_required
def upload_task_attachments(user, tid):
    task = db.session.get(Task, tid)

    if not task:
        return err("Task not found.", 404)

    if not can_access_task(user, task):
        return err("You cannot upload to this task.", 403)

    uploaded_files = request.files.getlist("files")

    if not uploaded_files:
        return err("Choose at least one file.")

    folder = current_app.config["TASK_ATTACHMENT_FOLDER"]
    saved = []

    try:
        for file in uploaded_files:
            if not file or not file.filename:
                continue

            original_name = file.filename
            safe_name = secure_filename(original_name)

            if not safe_name or "." not in safe_name:
                raise ValueError("Invalid filename.")

            extension = safe_name.rsplit(".", 1)[1].lower()

            if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
                raise ValueError(
                    f"File type not allowed: {original_name}"
                )

            stored_name = f"{uuid.uuid4().hex}.{extension}"
            path = os.path.join(folder, stored_name)

            file.save(path)
            size = os.path.getsize(path)

            if size > MAX_ATTACHMENT_SIZE:
                os.remove(path)
                raise ValueError(
                    f"{original_name} exceeds the 15 MB limit."
                )

            attachment = TaskAttachment(
                task_id=tid,
                uploaded_by=user.id,
                original_name=original_name,
                stored_name=stored_name,
                file_size=size,
            )

            db.session.add(attachment)
            saved.append(path)

        db.session.commit()

    except ValueError as e:
        db.session.rollback()

        for path in saved:
            if os.path.exists(path):
                os.remove(path)

        return err(str(e))

    except Exception:
        db.session.rollback()

        for path in saved:
            if os.path.exists(path):
                os.remove(path)

        current_app.logger.exception("Attachment upload failed.")
        return err("Attachment upload failed.", 500)

    return jsonify({"attachments": [f.to_dict() for f in TaskAttachment.query.filter_by(task_id=tid).all()]}), 201


@api.get("/tasks/<int:tid>/attachments/<int:aid>/download")
@login_required
def download_task_attachment(user, tid, aid):
    task = db.session.get(Task, tid)
    attachment = db.session.get(TaskAttachment, aid)

    if not task or not attachment or attachment.task_id != tid:
        return err("Attachment not found.", 404)

    if not can_access_task(user, task):
        return err("You cannot access this attachment.", 403)

    return send_from_directory(
        current_app.config["TASK_ATTACHMENT_FOLDER"],
        attachment.stored_name,
        as_attachment=True,
        download_name=attachment.original_name,
    )


@api.delete("/tasks/<int:tid>/attachments/<int:aid>")
@login_required
def delete_task_attachment(user, tid, aid):
    task = db.session.get(Task, tid)
    attachment = db.session.get(TaskAttachment, aid)

    if not task or not attachment or attachment.task_id != tid:
        return err("Attachment not found.", 404)

    if user.role != "admin" and task.assigned_by != user.id:
        return err("Only the task creator or admin can delete attachments.", 403)

    path = os.path.join(
        current_app.config["TASK_ATTACHMENT_FOLDER"],
        attachment.stored_name,
    )

    db.session.delete(attachment)
    db.session.commit()

    if os.path.exists(path):
        os.remove(path)

    return jsonify({"ok": True})
# ---------------------------------------------------------------- dashboard


@api.get("/dashboard")
@login_required
def dashboard(user):
    now = utcnow()
    tasks = Task.query.all()
    open_tasks = [t for t in tasks if t.status != "done"]
    overdue = [t for t in open_tasks if t.due_date < now]
    soon = [t for t in open_tasks if now <= t.due_date <= now + timedelta(hours=48)]
    done = [t for t in tasks if t.status == "done"]
    on_time = [t for t in done if t.completed_at and t.completed_at <= t.due_date]

    mine_open = [t for t in open_tasks if t.assigned_to == user.id]
    mine_overdue = [t for t in mine_open if t.due_date < now]

    workload = []
    for u in User.query.filter_by(is_active=True).order_by(User.name):
        u_tasks = [t for t in tasks if t.assigned_to == u.id]
        u_open = [t for t in u_tasks if t.status != "done"]
        workload.append(
            {
                "id": u.id,
                "name": u.name,
                "designation": u.designation or "",
                "open": len(u_open),
                "overdue": len([t for t in u_open if t.due_date < now]),
                "done": len([t for t in u_tasks if t.status == "done"]),
                "in_progress": len([t for t in u_open if t.status == "in_progress"]),
            }
        )

    overdue.sort(key=lambda t: t.due_date)
    soon.sort(key=lambda t: t.due_date)
    return jsonify(
        {
            "totals": {
                "all": len(tasks),
                "open": len(open_tasks),
                "todo": len([t for t in tasks if t.status == "todo"]),
                "in_progress": len([t for t in tasks if t.status == "in_progress"]),
                "done": len(done),
                "overdue": len(overdue),
                "on_time_rate": round(100 * len(on_time) / len(done)) if done else None,
            },
            "mine": {"open": len(mine_open), "overdue": len(mine_overdue)},
            "overdue_tasks": [t.to_dict() for t in overdue[:8]],
            "due_soon": [t.to_dict() for t in soon[:8]],
            "workload": workload,
        }
    )


# ---------------------------------------------------------------- admin tools
@api.get("/emails")
@admin_required
def email_log(admin):
    rows = EmailLog.query.order_by(EmailLog.created_at.desc()).limit(200).all()
    return jsonify([r.to_dict() for r in rows])


@api.post("/reminders/run")
@admin_required
def run_reminders(admin):
    return jsonify({"sent": send_overdue_reminders()})


@api.get("/health")
def health():
    return jsonify({"ok": True})
