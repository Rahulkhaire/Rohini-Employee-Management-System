import math
from datetime import datetime
from zoneinfo import ZoneInfo
from flask import Blueprint, jsonify, request
from models import db, User, FaceEnrollment, AttendanceRecord, OfficeLocation, utcnow
from routes import login_required, admin_required, err
from face_service import face_service, FaceError

attendance_api=Blueprint("attendance_api",__name__,url_prefix="/api/attendance")
TZ=ZoneInfo("Asia/Kolkata")
def local_date(): return datetime.now(TZ).date().isoformat()
def distance_m(lat1,lon1,lat2,lon2):
    r=6371000; p1=math.radians(lat1); p2=math.radians(lat2)
    dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(a))
def office(): return OfficeLocation.query.get(1)
def location_check(d):
    cfg=office()
    if not cfg or not cfg.enabled or cfg.latitude is None or cfg.longitude is None:
        raise ValueError("Office location has not been configured by the admin.")
    try: lat=float(d.get("latitude")); lon=float(d.get("longitude")); acc=float(d.get("accuracy"))
    except (TypeError,ValueError): raise ValueError("Please allow location access and try again.")
    if not (-90<=lat<=90 and -180<=lon<=180 and 0<acc<=10000): raise ValueError("GPS location details are invalid.")
    if acc>cfg.max_accuracy_m: raise ValueError(f"GPS accuracy is too low ({acc:.0f}m). Try again outdoors or near a window.")
    dist=distance_m(lat,lon,cfg.latitude,cfg.longitude)
    if dist>cfg.radius_m: raise ValueError(f"You are outside the office attendance area ({dist:.0f}m away; limit {cfg.radius_m}m).")
    return lat,lon,acc,dist

@attendance_api.post("/enroll/<int:uid>")
@admin_required
def enroll_face(admin,uid):
    d=request.get_json(silent=True) or {}; person=db.session.get(User,uid)
    if not person or not person.is_active: return err("Active employee not found.",404)
    if person.role!="employee": return err("Face enrollment is for employee accounts.")
    if d.get("consent") is not True: return err("Employee's explicit biometric consent is required.")
    try: feature=face_service.feature(d.get("photo")); encrypted=face_service.encrypt(feature)
    except FaceError as e: return err(str(e))
    row=FaceEnrollment.query.filter_by(user_id=uid).first()
    if row:
        row.encrypted_template=encrypted; row.consent_at=utcnow(); row.enrolled_at=utcnow(); row.revoked_at=None
    else: db.session.add(FaceEnrollment(user_id=uid,encrypted_template=encrypted,consent_at=utcnow(),enrolled_at=utcnow()))
    db.session.commit()
    return jsonify({"ok":True,"enrolled":True,"employee_id":uid})

@attendance_api.get("/status")
@login_required
def my_status(user):
    enrollment=FaceEnrollment.query.filter_by(user_id=user.id,revoked_at=None).first()
    row=AttendanceRecord.query.filter_by(user_id=user.id,work_date=local_date()).first()
    cfg=office()
    return jsonify({"enrolled":bool(enrollment),"today":row.to_dict() if row else None,"office_configured":bool(cfg and cfg.enabled and cfg.latitude is not None),"office_radius_m":cfg.radius_m if cfg else 200})

@attendance_api.post("/mark")
@login_required
def mark(user):
    d=request.get_json(silent=True) or {}; event=d.get("event")
    if event not in ("check_in","check_out"): return err("Choose check-in or check-out.")
    enrollment=FaceEnrollment.query.filter_by(user_id=user.id,revoked_at=None).first()
    if not enrollment: return err("Your face is not enrolled. Contact the admin.",403)
    try: lat,lon,acc,dist=location_check(d)
    except ValueError as e: return err(str(e),403)
    try: matched,score=face_service.match(d.get("photo"),enrollment.encrypted_template)
    except FaceError as e: return err(str(e))
    if not matched: return err("Face verification failed. Please try again or contact the admin.",403)
    date=local_date(); row=AttendanceRecord.query.filter_by(user_id=user.id,work_date=date).first()
    if event=="check_in":
        if row and row.check_in_at: return err("You have already checked in today.",409)
        if not row: row=AttendanceRecord(user_id=user.id,work_date=date); db.session.add(row)
        row.check_in_at=utcnow(); row.check_in_lat=lat; row.check_in_lon=lon; row.check_in_accuracy=acc; row.check_in_distance_m=dist
    else:
        if not row or not row.check_in_at: return err("Check in before checking out.",409)
        if row.check_out_at: return err("You have already checked out today.",409)
        row.check_out_at=utcnow(); row.check_out_lat=lat; row.check_out_lon=lon; row.check_out_accuracy=acc; row.check_out_distance_m=dist
    db.session.commit()
    return jsonify({"ok":True,"message":"Check-in recorded." if event=="check_in" else "Check-out recorded.","attendance":row.to_dict(),"face_score":round(score,3),"office_distance_m":round(dist,1)})

@attendance_api.get("/records")
@admin_required
def records(admin):
    q=AttendanceRecord.query
    date=request.args.get("date")
    if date: q=q.filter_by(work_date=date)
    rows=q.order_by(AttendanceRecord.work_date.desc(),AttendanceRecord.check_in_at.desc()).limit(1000).all()
    return jsonify([r.to_dict() for r in rows])

@attendance_api.get("/office")
@admin_required
def get_office(admin):
    c=office()
    if not c: return jsonify({"name":"Main Office","latitude":"","longitude":"","radius_m":200,"max_accuracy_m":100,"enabled":False})
    return jsonify({"name":c.name,"latitude":c.latitude if c.latitude is not None else "","longitude":c.longitude if c.longitude is not None else "","radius_m":c.radius_m,"max_accuracy_m":c.max_accuracy_m,"enabled":c.enabled})

@attendance_api.put("/office")
@admin_required
def set_office(admin):
    d=request.get_json(silent=True) or {}
    try:
        name=(d.get("name") or "Main Office").strip()[:120]
        lat=float(d.get("latitude")); lon=float(d.get("longitude")); radius=int(d.get("radius_m",200)); accuracy=int(d.get("max_accuracy_m",100))
        if not (-90<=lat<=90 and -180<=lon<=180): raise ValueError()
        if not (25<=radius<=2000 and 10<=accuracy<=500): raise ValueError()
    except (TypeError,ValueError): return err("Enter valid office coordinates, radius (25–2000m), and GPS accuracy (10–500m).")
    c=office()
    if not c: c=OfficeLocation(id=1); db.session.add(c)
    c.name=name or "Main Office"; c.latitude=lat; c.longitude=lon; c.radius_m=radius; c.max_accuracy_m=accuracy; c.enabled=bool(d.get("enabled",True))
    db.session.commit(); return jsonify({"ok":True,"office":{ "name":c.name,"latitude":c.latitude,"longitude":c.longitude,"radius_m":c.radius_m,"max_accuracy_m":c.max_accuracy_m,"enabled":c.enabled}})

@attendance_api.delete("/enrollment")
@login_required
def revoke_my_enrollment(user):
    row=FaceEnrollment.query.filter_by(user_id=user.id,revoked_at=None).first()
    if row:
        db.session.delete(row); db.session.commit()
    return jsonify({"ok":True,"message":"Face template deleted. Contact admin for manual attendance or future re-enrollment."})
