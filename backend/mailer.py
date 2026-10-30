import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape

from models import EmailLog, db

BRAND = "Rohini People Technology Pvt. Ltd."


def _env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def mail_configured():
    return bool(os.getenv("MAIL_SERVER") and os.getenv("MAIL_USERNAME"))


def send_mail(to, subject, html, kind="general", task_id=None, cc=None):
    """Send an email and always record it in EmailLog. Never raises.

    Must be called inside an app context.
    """
    to_list = [to] if isinstance(to, str) else list(to)
    cc_list = [c for c in (cc or []) if c and c not in to_list]
    log = EmailLog(
        to_email=", ".join(to_list + cc_list),
        subject=subject,
        kind=kind,
        task_id=task_id,
        status="sent",
    )

    if not mail_configured():
        log.status = "not_configured"
        log.error = "SMTP not configured (set MAIL_SERVER / MAIL_USERNAME in .env)."
        print(f"[MAIL not sent - SMTP off] to={to_list} subject={subject!r}")
    else:
        try:
            sender = os.getenv("MAIL_FROM") or os.getenv("MAIL_USERNAME")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = formataddr((os.getenv("MAIL_FROM_NAME", BRAND), sender))
            msg["To"] = ", ".join(to_list)
            if cc_list:
                msg["Cc"] = ", ".join(cc_list)
            msg.attach(MIMEText(html, "html", "utf-8"))

            host = os.getenv("MAIL_SERVER")
            port = int(os.getenv("MAIL_PORT", "587"))
            recipients = to_list + cc_list
            if port == 465:
                with smtplib.SMTP_SSL(
                    host, port, timeout=20, context=ssl.create_default_context()
                ) as s:
                    s.login(os.getenv("MAIL_USERNAME"), os.getenv("MAIL_PASSWORD", ""))
                    s.sendmail(sender, recipients, msg.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=20) as s:
                    if _env_bool("MAIL_USE_TLS", True):
                        s.starttls(context=ssl.create_default_context())
                    s.login(os.getenv("MAIL_USERNAME"), os.getenv("MAIL_PASSWORD", ""))
                    s.sendmail(sender, recipients, msg.as_string())
        except Exception as exc:  # noqa: BLE001 - we must never crash the caller
            log.status = "failed"
            log.error = str(exc)[:500]
            print(f"[MAIL failed] {exc}")

    db.session.add(log)
    db.session.commit()
    return log.status == "sent"


def _wrap(title, body_html):
    return f"""
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e3e8ec;border-radius:10px;overflow:hidden">
  <div style="background:#255B7B;color:#fff;padding:16px 22px;font-size:18px;font-weight:600">{escape(BRAND)}</div>
  <div style="padding:22px;color:#1F2D3A;font-size:15px;line-height:1.55">
    <h2 style="margin:0 0 12px;font-size:18px">{escape(title)}</h2>
    {body_html}
  </div>
  <div style="background:#f4f8fa;color:#4A5663;padding:12px 22px;font-size:12px">empowering every possibility</div>
</div>"""


def _task_box(task, fmt_due):
    return f"""
<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
  <tr><td style="padding:6px 0;color:#4A5663;width:90px">Task</td><td><b>{escape(task.title)}</b></td></tr>
  <tr><td style="padding:6px 0;color:#4A5663">Priority</td><td>{escape(task.priority.title())}</td></tr>
  <tr><td style="padding:6px 0;color:#4A5663">Due</td><td>{escape(fmt_due)}</td></tr>
  <tr><td style="padding:6px 0;color:#4A5663">Assigned by</td><td>{escape(task.creator.name)}</td></tr>
</table>"""


def _fmt(dt):
    tz = os.getenv("DISPLAY_TZ", "Asia/Kolkata")
    try:
        from zoneinfo import ZoneInfo
        from datetime import timezone

        local = dt.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(tz))
        return local.strftime("%d %b %Y, %I:%M %p") + f" ({tz})"
    except Exception:  # noqa: BLE001
        return dt.strftime("%d %b %Y, %H:%M") + " UTC"


def send_overdue_email(task):
    app_url = os.getenv("APP_URL", "http://localhost:5173")
    body = (
        f"<p>Hi {escape(task.assignee.name)},</p>"
        "<p>This task has passed its deadline and is still not marked as done:</p>"
        + _task_box(task, _fmt(task.due_date))
        + "<p>Please complete it, or talk to the person who assigned it if you need more time.</p>"
        f'<p><a href="{escape(app_url)}" style="background:#EE8443;color:#fff;padding:10px 18px;'
        'border-radius:6px;text-decoration:none;display:inline-block">Open my tasks</a></p>'
    )
    cc = []
    if _env_bool("CC_ASSIGNER_ON_OVERDUE", True) and task.creator.id != task.assignee.id:
        cc = [task.creator.email]
    return send_mail(
        task.assignee.email,
        f"Overdue: {task.title}",
        _wrap("Task overdue", body),
        kind="overdue",
        task_id=task.id,
        cc=cc,
    )


def send_assigned_email(task):
    app_url = os.getenv("APP_URL", "http://localhost:5173")
    body = (
        f"<p>Hi {escape(task.assignee.name)},</p>"
        f"<p>{escape(task.creator.name)} assigned you a new task:</p>"
        + _task_box(task, _fmt(task.due_date))
        + (f"<p>{escape(task.description)}</p>" if task.description else "")
        + f'<p><a href="{escape(app_url)}" style="background:#255B7B;color:#fff;padding:10px 18px;'
        'border-radius:6px;text-decoration:none;display:inline-block">Open my tasks</a></p>'
    )
    return send_mail(
        task.assignee.email,
        f"New task: {task.title}",
        _wrap("New task assigned", body),
        kind="assigned",
        task_id=task.id,
    )
