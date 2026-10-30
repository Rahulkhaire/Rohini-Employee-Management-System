import base64, os, json
import cv2
import numpy as np
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

class FaceError(ValueError): pass

class FaceService:
    def __init__(self):
        base=os.path.join(os.path.dirname(__file__), "models")
        self.det_path=os.getenv("FACE_DETECTOR_MODEL", os.path.join(base,"face_detection_yunet_2023mar.onnx"))
        self.rec_path=os.getenv("FACE_RECOGNIZER_MODEL", os.path.join(base,"face_recognition_sface_2021dec.onnx"))
        self.detector=None; self.recognizer=None
    def _load(self):
        if not os.path.isfile(self.det_path) or not os.path.isfile(self.rec_path):
            raise FaceError("Face model files are missing. Download both ONNX files into backend/models.")
        if self.detector is None:
            try:
                self.detector=cv2.FaceDetectorYN.create(self.det_path,"",(320,320),0.9,0.3,5000)
                self.recognizer=cv2.FaceRecognizerSF.create(self.rec_path,"")
            except Exception as e: raise FaceError(f"Could not load OpenCV face models: {e}")
    def _image(self, data):
        if not isinstance(data,str) or "," not in data: raise FaceError("A camera photo is required.")
        try: raw=base64.b64decode(data.split(",",1)[1],validate=True)
        except Exception: raise FaceError("The camera photo is invalid.")
        if len(raw)>5*1024*1024: raise FaceError("Photo is too large. Please capture again.")
        img=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR)
        if img is None: raise FaceError("Could not read the camera photo.")
        h,w=img.shape[:2]
        if w<160 or h<160: raise FaceError("Photo resolution is too small.")
        return img
    def feature(self, data):
        self._load(); img=self._image(data); h,w=img.shape[:2]
        self.detector.setInputSize((w,h)); _,faces=self.detector.detect(img)
        if faces is None or len(faces)==0: raise FaceError("No face detected. Face the camera in good lighting.")
        if len(faces)!=1: raise FaceError("Please ensure only one face is visible.")
        aligned=self.recognizer.alignCrop(img,faces[0])
        feature=self.recognizer.feature(aligned).flatten().astype(np.float32)
        norm=np.linalg.norm(feature)
        if norm==0: raise FaceError("Face could not be verified. Please try again.")
        return feature/norm
    def encrypt(self, feature):
        key=os.getenv("FACE_ENCRYPTION_KEY","").strip()
        if not key: raise FaceError("FACE_ENCRYPTION_KEY is missing from backend/.env.")
        try: f=Fernet(key.encode())
        except Exception: raise FaceError("FACE_ENCRYPTION_KEY is invalid. Generate a Fernet key.")
        return f.encrypt(json.dumps(feature.tolist()).encode())
    def decrypt(self, encrypted):
        key=os.getenv("FACE_ENCRYPTION_KEY","").strip()
        if not key: raise FaceError("FACE_ENCRYPTION_KEY is missing from backend/.env.")
        try: return np.asarray(json.loads(Fernet(key.encode()).decrypt(encrypted)),dtype=np.float32)
        except (InvalidToken,ValueError,TypeError): raise FaceError("Stored face template cannot be decrypted. Check your encryption key.")
    def match(self, data, encrypted):
        probe=self.feature(data); enrolled=self.decrypt(encrypted)
        score=float(np.dot(probe,enrolled)/(np.linalg.norm(probe)*np.linalg.norm(enrolled)))
        threshold=float(os.getenv("FACE_MATCH_THRESHOLD","0.363"))
        return score >= threshold, score

face_service=FaceService()
