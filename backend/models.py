from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()

STATUSES = ("todo", "in_progress", "done")
PRIORITIES = ("low", "medium", "high")
ROLES = ("admin", "employee")


def utcnow():
    return datetime.utcnow()


def iso(dt):
    """All datetimes are stored as naive UTC; send them as ISO with a Z."""
    return dt.isoformat() + "Z" if dt else None


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="employee")
    designation = db.Column(db.String(120), default="")
    phone = db.Column(db.String(30), default="")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    def brief(self):
        return {"id": self.id, "name": self.name, "email": self.email}

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "designation": self.designation or "",
            "phone": self.phone or "",
            "is_active": self.is_active,
            "created_at": iso(self.created_at),
        }


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    priority = db.Column(db.String(10), nullable=False, default="medium")
    status = db.Column(db.String(20), nullable=False, default="todo", index=True)
    due_date = db.Column(db.DateTime, nullable=False, index=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    completed_at = db.Column(db.DateTime)
    last_reminder_at = db.Column(db.DateTime)
    reminder_count = db.Column(db.Integer, nullable=False, default=0)

    assignee = db.relationship("User", foreign_keys=[assigned_to])
    creator = db.relationship("User", foreign_keys=[assigned_by])

    @property
    def is_overdue(self):
        return self.status != "done" and self.due_date < utcnow()

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "priority": self.priority,
            "status": self.status,
            "due_date": iso(self.due_date),
            "assigned_to": self.assignee.brief() if self.assignee else None,
            "assigned_by": self.creator.brief() if self.creator else None,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
            "completed_at": iso(self.completed_at),
            "is_overdue": self.is_overdue,
            "completed_late": bool(
                self.completed_at and self.completed_at > self.due_date
            ),
            "reminder_count": self.reminder_count,
            "last_reminder_at": iso(self.last_reminder_at),
        }


class EmailLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    to_email = db.Column(db.String(300), nullable=False)
    subject = db.Column(db.String(300), nullable=False)
    kind = db.Column(db.String(30), default="general")  # overdue / assigned / general
    status = db.Column(db.String(30), nullable=False)  # sent / failed / not_configured
    error = db.Column(db.Text, default="")
    task_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "to_email": self.to_email,
            "subject": self.subject,
            "kind": self.kind,
            "status": self.status,
            "error": self.error or "",
            "task_id": self.task_id,
            "created_at": iso(self.created_at),
        }


# Face attendance tables. db.create_all() creates these new tables without
# altering existing User, Task, or EmailLog tables.
class FaceEnrollment(db.Model):
    __tablename__ = "face_enrollments"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False, index=True)
    encrypted_template = db.Column(db.LargeBinary, nullable=False)
    consent_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    enrolled_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    revoked_at = db.Column(db.DateTime)
    model_version = db.Column(db.String(40), nullable=False, default="opencv-sface-2021dec")

class AttendanceRecord(db.Model):
    __tablename__ = "attendance_records"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    verification_method = db.Column(
        db.String(30), nullable=False, default="face+gps"
    )
    verification_passed = db.Column(
        db.Boolean, nullable=False, default=True
    )
    work_date = db.Column(db.String(10), nullable=False, index=True)
    check_in_at = db.Column(db.DateTime)
    check_out_at = db.Column(db.DateTime)
    check_in_lat = db.Column(db.Float)
    check_in_lon = db.Column(db.Float)
    check_in_accuracy = db.Column(db.Float)
    check_in_distance_m = db.Column(db.Float)
    check_out_lat = db.Column(db.Float)
    check_out_lon = db.Column(db.Float)
    check_out_accuracy = db.Column(db.Float)
    check_out_distance_m = db.Column(db.Float)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    employee = db.relationship("User", foreign_keys=[user_id])
    __table_args__ = (db.UniqueConstraint("user_id", "work_date", name="uq_attendance_user_date"),)

    def to_dict(self):
        return {
            "id": self.id, "user_id": self.user_id,
            "employee_name": self.employee.name if self.employee else "",
            "employee_email": self.employee.email if self.employee else "",
            "work_date": self.work_date,
            "check_in_at": iso(self.check_in_at), "check_out_at": iso(self.check_out_at),
            "check_in_distance_m": round(self.check_in_distance_m, 1) if self.check_in_distance_m is not None else None,
            "check_out_distance_m": round(self.check_out_distance_m, 1) if self.check_out_distance_m is not None else None,
        }

class OfficeLocation(db.Model):
    __tablename__ = "office_location"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, default="Main Office")
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    radius_m = db.Column(db.Integer, nullable=False, default=200)
    max_accuracy_m = db.Column(db.Integer, nullable=False, default=100)
    enabled = db.Column(db.Boolean, nullable=False, default=False)


class TaskAttachment(db.Model):
    __tablename__ = "task_attachments"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(
        db.Integer,
        db.ForeignKey("task.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    uploaded_by = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False
    )
    original_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False, unique=True)
    file_size = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    uploader = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "original_name": self.original_name,
            "file_size": self.file_size,
            "uploaded_by": self.uploader.name if self.uploader else "",
            "created_at": iso(self.created_at),
        }