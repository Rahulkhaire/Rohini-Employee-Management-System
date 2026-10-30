import os

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify  # noqa: E402
from flask_cors import CORS  # noqa: E402
from flask_jwt_extended import JWTManager  # noqa: E402

from models import User, db  # noqa: E402
from reminders import start_scheduler  # noqa: E402
from routes import api  # noqa: E402
from attendance_routes import attendance_api  # noqa: E402


def create_app(start_jobs=True):
    app = Flask(__name__)
    from pathlib import Path

    upload_folder = Path(app.root_path) / "uploads" / "task_attachments"
    upload_folder.mkdir(parents=True, exist_ok=True)

    app.config["TASK_ATTACHMENT_FOLDER"] = str(upload_folder)
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
    
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///ems.db")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me")

    CORS(app, origins=[o.strip() for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")])
    db.init_app(app)
    jwt = JWTManager(app)

    @jwt.unauthorized_loader
    def _missing(msg):
        return jsonify({"error": "Please log in."}), 401

    @jwt.invalid_token_loader
    def _invalid(msg):
        return jsonify({"error": "Session invalid. Please log in again."}), 401

    @jwt.expired_token_loader
    def _expired(h, p):
        return jsonify({"error": "Session expired. Please log in again."}), 401

    app.register_blueprint(api)
    app.register_blueprint(attendance_api)

    with app.app_context():
        db.create_all()
        seed_admin()

    if start_jobs:
        start_scheduler(app)
    return app


def seed_admin():
    if User.query.count():
        return
    email = os.getenv("ADMIN_EMAIL", "admin@rohini.com").lower()
    admin = User(
        name=os.getenv("ADMIN_NAME", "Admin"),
        email=email,
        role="admin",
        designation="Administrator",
    )
    admin.set_password(os.getenv("ADMIN_PASSWORD", "Admin@123"))
    db.session.add(admin)
    db.session.commit()
    print(f"Created first admin account: {email}")


if __name__ == "__main__":
    # use_reloader=False so the reminder scheduler is not started twice
    create_app().run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True, use_reloader=False)
