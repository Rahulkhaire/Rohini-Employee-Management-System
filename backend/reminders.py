import os
from datetime import timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from mailer import send_overdue_email
from models import Task, db, utcnow


def send_overdue_reminders():
    """Email assignees of overdue tasks. Must run inside an app context.

    A task gets its first mail as soon as it is overdue. After that it is
    repeated every OVERDUE_REPEAT_HOURS (0 = only once) until it is done.
    Returns the number of mails sent.
    """
    repeat_hours = float(os.getenv("OVERDUE_REPEAT_HOURS", "24"))
    now = utcnow()
    sent = 0
    overdue = Task.query.filter(Task.status != "done", Task.due_date < now).all()
    for task in overdue:
        if not task.assignee or not task.assignee.is_active:
            continue
        if task.last_reminder_at:
            if repeat_hours <= 0:
                continue
            if now - task.last_reminder_at < timedelta(hours=repeat_hours):
                continue
        send_overdue_email(task)
        # Mark as handled even if SMTP failed so we don't hammer the server;
        # the failure is visible in the Email Log page.
        task.last_reminder_at = now
        task.reminder_count += 1
        db.session.commit()
        sent += 1
    return sent


def start_scheduler(app):
    minutes = max(1, int(os.getenv("REMINDER_CHECK_MINUTES", "15")))

    def job():
        with app.app_context():
            try:
                n = send_overdue_reminders()
                if n:
                    print(f"[reminders] sent {n} overdue reminder(s)")
            except Exception as exc:  # noqa: BLE001
                print(f"[reminders] error: {exc}")

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(job, "interval", minutes=minutes, id="overdue", max_instances=1)
    scheduler.start()
    return scheduler
